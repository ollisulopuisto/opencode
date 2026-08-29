import { describe, expect } from "bun:test"
import { Effect, Layer } from "effect"
import { Location } from "@opencode-ai/core/location"
import { PermissionV2 } from "@opencode-ai/core/permission"
import { SessionSchema } from "@opencode-ai/core/session/schema"
import { ToolRegistry } from "@opencode-ai/core/tool/registry"
import { GitDiffTool } from "@opencode-ai/core/tool/git-diff"
import { AbsolutePath } from "@opencode-ai/core/schema"
import { AppNodeBuilder } from "@opencode-ai/core/effect/app-node-builder"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { location } from "./fixture/location"
import { testEffect } from "./lib/effect"
import { toolDefinitions, settleTool, toolIdentity } from "./lib/tool"

const current = Layer.succeed(
  Location.Service,
  Location.Service.of(location({ directory: AbsolutePath.make("/Users/dst/Documents/koodi/opencode") })),
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
    LayerNode.group([ToolRegistry.node, GitDiffTool.node]),
    [
      [Location.node, current],
      [PermissionV2.node, permission],
    ],
  ),
)

describe("GitDiffTool", () => {
  it.effect("registers git_diff tool and returns working tree diff", () =>
    Effect.gen(function* () {
      const registry = yield* ToolRegistry.Service
      const definitions = yield* toolDefinitions(registry)
      expect(definitions.map((tool) => tool.name)).toContain("git_diff")

      const settlement = yield* settleTool(registry, {
        sessionID: SessionSchema.ID.make("ses_test"),
        ...toolIdentity,
        call: {
          type: "tool-call" as const,
          id: "call_git_diff",
          name: "git_diff",
          input: { stat: true },
        },
      })

      expect((settlement.output as any)?.structured).toBeDefined()
      expect(typeof (settlement.output as any)?.structured?.diff).toBe("string")
    }),
  )
})
