import { describe, expect, it } from "bun:test"
import { Effect, Layer } from "effect"
import { Database } from "@opencode-ai/core/database/database"
import { AppNodeBuilder } from "@opencode-ai/core/effect/app-node-builder"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { EventV2 } from "@opencode-ai/core/event"
import { Location } from "@opencode-ai/core/location"
import { PermissionV2 } from "@opencode-ai/core/permission"
import { SessionExecution } from "@opencode-ai/core/session/execution"
import { SessionSchema } from "@opencode-ai/core/session/schema"
import { ToolRegistry } from "@opencode-ai/core/tool/registry"
import { DelegateTool, resetDelegationCounter } from "@opencode-ai/core/tool/delegate"
import { Ntfy } from "@opencode-ai/core/notify/ntfy"
import { AbsolutePath } from "@opencode-ai/core/schema"
import { location } from "./fixture/location"
import { testEffect } from "./lib/effect"
import { settleTool, toolIdentity } from "./lib/tool"

const current = Layer.succeed(
  Location.Service,
  Location.Service.of(location({ directory: AbsolutePath.make("/project") })),
)

const execution = Layer.succeed(
  SessionExecution.Service,
  SessionExecution.Service.of({
    active: Effect.succeed(new Set()),
    resume: () => Effect.void,
    wake: () => Effect.void,
    interrupt: () => Effect.void,
  }),
)

const permission = Layer.succeed(
  PermissionV2.Service,
  PermissionV2.Service.of({
    assert: () => Effect.void,
    ask: () => Effect.die("unused"),
    reply: () => Effect.die("unused"),
    get: () => Effect.die("unused"),
    forSession: () => Effect.die("unused"),
    list: () => Effect.succeed([]),
  }),
)

const itEffect = testEffect(
  AppNodeBuilder.build(
    LayerNode.group([Database.node, EventV2.node, ToolRegistry.node, DelegateTool.node]),
    [
      [Location.node, current],
      [SessionExecution.node, execution],
      [PermissionV2.node, permission],
    ],
  ),
)

describe("Ping-Pong Loop Guard & Presence Suppression", () => {
  itEffect.effect("stops autonomous delegation after 10 consecutive turns", () =>
    Effect.gen(function* () {
      resetDelegationCounter()
      const registry = yield* ToolRegistry.Service

      const delegateCall = () =>
        settleTool(registry, {
          sessionID: SessionSchema.ID.make("ses_alpha"),
          ...toolIdentity,
          call: {
            type: "tool-call" as const,
            id: "call_loop",
            name: "delegate",
            input: {
              sessionID: "ses_beta",
              prompt: "Keep looping",
              mode: "steer",
            },
          },
        })

      // 1..10 should succeed
      for (let i = 1; i <= 10; i++) {
        const res = yield* delegateCall()
        expect((res.output as any)?.structured?.status).toBe("admitted")
      }

      // 11th should be stopped by the loop guard
      const blocked = yield* delegateCall()
      const errorMsg =
        (blocked.result as any)?.value?.error?.message ??
        (blocked.result as any)?.value?.[0]?.text ??
        JSON.stringify(blocked.result)
      expect(errorMsg).toContain("Autonomous loop guard triggered")
    }),
  )

  it("suppresses push alerts when user is actively present", async () => {
    process.env["OPENCODE_NTFY_TOPIC"] = "test-presence-topic"
    let fetchCalled = false
    const originalFetch = globalThis.fetch
    globalThis.fetch = (async () => {
      fetchCalled = true
      return new Response("ok")
    }) as any

    try {
      // 1. When user is present, ntfy.send should be skipped
      Ntfy.recordPresence()
      expect(Ntfy.isUserPresent()).toBe(true)

      await Effect.runPromise(Ntfy.send({ message: "Task completed" }))
      expect(fetchCalled).toBe(false)

      // 2. When explicit override or user not present, ntfy.send proceeds
      await Effect.runPromise(Ntfy.send({ message: "Urgent task completed" }, { suppressIfPresent: false }))
      expect(fetchCalled).toBe(true)
    } finally {
      globalThis.fetch = originalFetch
      delete process.env["OPENCODE_NTFY_TOPIC"]
    }
  })
})
