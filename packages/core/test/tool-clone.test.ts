import { describe, expect } from "bun:test"
import { Effect, Layer } from "effect"
import { Location } from "@opencode-ai/core/location"
import { PermissionV2 } from "@opencode-ai/core/permission"
import { SessionSchema } from "@opencode-ai/core/session/schema"
import { ToolRegistry } from "@opencode-ai/core/tool/registry"
import { CloneTool, sanitizeRepoSlug } from "@opencode-ai/core/tool/clone"
import { AbsolutePath } from "@opencode-ai/core/schema"
import { AppNodeBuilder } from "@opencode-ai/core/effect/app-node-builder"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { location } from "./fixture/location"
import { testEffect } from "./lib/effect"
import { toolDefinitions, settleTool, toolIdentity } from "./lib/tool"

const current = Layer.succeed(
  Location.Service,
  Location.Service.of(location({ directory: AbsolutePath.make("/project") })),
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
    LayerNode.group([ToolRegistry.node, CloneTool.node]),
    [
      [Location.node, current],
      [PermissionV2.node, permission],
    ],
  ),
)

describe("CloneTool", () => {
  it.effect("registers repo_clone tool and validates safe url schemes", () =>
    Effect.gen(function* () {
      const registry = yield* ToolRegistry.Service
      const definitions = yield* toolDefinitions(registry)
      expect(definitions.map((tool) => tool.name)).toContain("repo_clone")

      // Rejects unsafe file:// URLs
      const settlement = yield* settleTool(registry, {
        sessionID: SessionSchema.ID.make("ses_test"),
        ...toolIdentity,
        call: {
          type: "tool-call" as const,
          id: "call_clone",
          name: "repo_clone",
          input: { url: "file:///etc/passwd" },
        },
      })

      const errorText = JSON.stringify(settlement.result)
      expect(errorText).toContain("Only https://, git@, and ssh:// URLs are supported")
    }),
  )

  it.effect("sanitizes repo slugs cleanly", () =>
    Effect.gen(function* () {
      expect(sanitizeRepoSlug("https://github.com/anomalyco/opencode.git")).toBe("opencode")
      expect(sanitizeRepoSlug("git@github.com:user/awesome-project.git")).toBe("awesome-project")
      expect(sanitizeRepoSlug("https://gitlab.com/group/subgroup/backend/")).toBe("backend")
    }),
  )
})
