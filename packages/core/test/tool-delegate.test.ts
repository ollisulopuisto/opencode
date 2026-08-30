import { describe, expect } from "bun:test"
import { Effect, Layer } from "effect"
import { AppNodeBuilder } from "@opencode-ai/core/effect/app-node-builder"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { Database } from "@opencode-ai/core/database/database"
import { EventV2 } from "@opencode-ai/core/event"
import { Location } from "@opencode-ai/core/location"
import { PermissionV2 } from "@opencode-ai/core/permission"
import { SessionExecution } from "@opencode-ai/core/session/execution"
import { SessionSchema } from "@opencode-ai/core/session/schema"
import { ToolRegistry } from "@opencode-ai/core/tool/registry"
import { Tools } from "@opencode-ai/core/tool/tools"
import { DelegateTool } from "@opencode-ai/core/tool/delegate"
import { AbsolutePath } from "@opencode-ai/core/schema"
import { location } from "./fixture/location"
import { testEffect } from "./lib/effect"

const current = Layer.succeed(
  Location.Service,
  Location.Service.of(location({ directory: AbsolutePath.make("/project") })),
)

const woken: string[] = []
const execution = Layer.succeed(
  SessionExecution.Service,
  SessionExecution.Service.of({
    active: Effect.succeed(new Set()),
    resume: () => Effect.void,
    wake: (id) => Effect.sync(() => woken.push(id)),
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

const it = testEffect(
  AppNodeBuilder.build(
    LayerNode.group([Database.node, EventV2.node, ToolRegistry.node, DelegateTool.node]),
    [
      [Location.node, current],
      [PermissionV2.node, permission],
    ],
  ).pipe(Layer.provideMerge(execution)),
)

import { toolDefinitions, settleTool, toolIdentity } from "./lib/tool"

describe("DelegateTool", () => {
  it.effect("registers delegate tool and wakes target session", () =>
    Effect.gen(function* () {
      const registry = yield* ToolRegistry.Service
      const definitions = yield* toolDefinitions(registry)
      expect(definitions.map((tool) => tool.name)).toContain("delegate")

      const settlement = yield* settleTool(registry, {
        sessionID: SessionSchema.ID.make("ses_primary"),
        ...toolIdentity,
        call: {
          type: "tool-call" as const,
          id: "call_1",
          name: "delegate",
          input: {
            sessionID: "ses_target_worker",
            prompt: "Please build and run tests",
            mode: "steer",
          },
        },
      })

      expect((settlement.output as any)?.structured?.sessionID).toBe("ses_target_worker")
      expect((settlement.output as any)?.structured?.status).toBe("admitted")
      expect(woken).toContain("ses_target_worker")
    }),
  )
})
