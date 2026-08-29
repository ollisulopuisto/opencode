import { describe, expect, test } from "bun:test"
import { DateTime, Effect, Layer } from "effect"
import { Database } from "@opencode-ai/core/database/database"
import { AppNodeBuilder } from "@opencode-ai/core/effect/app-node-builder"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { EventV2 } from "@opencode-ai/core/event"
import { Location } from "@opencode-ai/core/location"
import { PermissionV2 } from "@opencode-ai/core/permission"
import { SessionExecution } from "@opencode-ai/core/session/execution"
import { SessionSchema } from "@opencode-ai/core/session/schema"
import { SessionMessage } from "@opencode-ai/core/session/message"
import { ToolRegistry } from "@opencode-ai/core/tool/registry"
import { DelegateTool } from "@opencode-ai/core/tool/delegate"
import { AbsolutePath } from "@opencode-ai/core/schema"
import { toLLMMessages } from "@opencode-ai/core/session/runner/to-llm-message"
import { Model } from "@opencode-ai/llm"
import * as OpenAIChat from "@opencode-ai/llm/protocols/openai-chat"
import { location } from "./fixture/location"
import { testEffect } from "./lib/effect"
import { settleTool, toolIdentity } from "./lib/tool"

const current = Layer.succeed(
  Location.Service,
  Location.Service.of(location({ directory: AbsolutePath.make("/project") })),
)

const wokenSessions: string[] = []
const execution = Layer.succeed(
  SessionExecution.Service,
  SessionExecution.Service.of({
    active: Effect.succeed(new Set()),
    resume: () => Effect.void,
    wake: (id) => Effect.sync(() => wokenSessions.push(id)),
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
      [SessionExecution.node, execution],
      [PermissionV2.node, permission],
    ],
  ),
)

describe("OpenCode Optimizations Stress Test", () => {
  it.effect("handles 50 concurrent session delegations without race conditions", () =>
    Effect.gen(function* () {
      const registry = yield* ToolRegistry.Service
      const tasks = Array.from({ length: 50 }, (_, i) =>
        settleTool(registry, {
          sessionID: SessionSchema.ID.make(`ses_primary_${i}`),
          ...toolIdentity,
          call: {
            type: "tool-call" as const,
            id: `call_${i}`,
            name: "delegate",
            input: {
              sessionID: `ses_worker_${i}`,
              prompt: `Run parallel subtask #${i}`,
              mode: i % 2 === 0 ? "steer" : "queue",
            },
          },
        }),
      )

      const results = yield* Effect.all(tasks, { concurrency: 25 })
      expect(results.length).toBe(50)
      expect(wokenSessions.length).toBeGreaterThanOrEqual(50)
    }),
  )

  test("slotted tool collapsing compacts historical turns while preserving latest turns", () => {
    const model = Model.make({ id: "model", provider: "provider", route: OpenAIChat.route })
    const largeOutput = "X".repeat(10000)
    const created = DateTime.makeUnsafe(0)

    // Build 8 conversation turns with large tool results
    const messages: SessionMessage.Message[] = Array.from({ length: 8 }, (_, i) =>
      SessionMessage.Assistant.make({
        id: SessionMessage.ID.make(`msg_${i}`),
        type: "assistant",
        agent: "build",
        model: { id: "model" as any, providerID: "provider" as any },
        content: [
          SessionMessage.AssistantTool.make({
            type: "tool",
            id: `call_${i}`,
            name: "grep",
            state: SessionMessage.ToolStateCompleted.make({
              status: "completed",
              input: { query: `search_${i}` },
              content: [{ type: "text", text: largeOutput }],
              structured: {},
            }),
            time: { created, completed: created },
          }),
        ],
        time: { created, completed: created },
      }),
    )

    const lowered = toLLMMessages(messages, model)
    expect(lowered.length).toBeGreaterThan(0)

    // First turns should be historical and compacted
    const earlyTurn = lowered[1]
    expect(earlyTurn).toBeDefined()
    if (earlyTurn) {
      const resultText = JSON.stringify(earlyTurn.content)
      expect(resultText).toContain("collapsed from historical turn")
      expect(resultText.length).toBeLessThan(2500)
    }

    // Last turn should preserve full raw output
    const latestTurn = lowered[lowered.length - 1]
    expect(latestTurn).toBeDefined()
    if (latestTurn) {
      const resultText = JSON.stringify(latestTurn.content)
      expect(resultText).not.toContain("collapsed from historical turn")
      expect(resultText).toContain("XXXXXXXXXX")
      expect(resultText.length).toBeGreaterThanOrEqual(10000)
    }
  })
})
