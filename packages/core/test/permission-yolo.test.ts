import { describe, expect } from "bun:test"
import { Effect, Layer } from "effect"
import { AgentV2 } from "@opencode-ai/core/agent"
import { Database } from "@opencode-ai/core/database/database"
import { AppNodeBuilder } from "@opencode-ai/core/effect/app-node-builder"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { EventV2 } from "@opencode-ai/core/event"
import { Location } from "@opencode-ai/core/location"
import { PermissionV2 } from "@opencode-ai/core/permission"
import { PermissionSaved } from "@opencode-ai/core/permission/saved"
import { AbsolutePath } from "@opencode-ai/core/schema"
import { SessionV2 } from "@opencode-ai/core/session"
import { SessionStore } from "@opencode-ai/core/session/store"
import { SessionMessage } from "@opencode-ai/core/session/message"
import { location } from "./fixture/location"
import { testEffect } from "./lib/effect"

const current = Layer.succeed(
  Location.Service,
  Location.Service.of(location({ directory: AbsolutePath.make("/project") })),
)

const it = testEffect(
  AppNodeBuilder.build(
    LayerNode.group([
      Database.node,
      EventV2.node,
      SessionStore.node,
      PermissionSaved.node,
      AgentV2.node,
      PermissionV2.node,
    ]),
    [[Location.node, current]],
  ),
)

describe("PermissionV2 YOLO auto-accept", () => {
  it.effect("allows actions immediately when OPENCODE_AUTO_ACCEPT is enabled", () =>
    Effect.gen(function* () {
      process.env.OPENCODE_AUTO_ACCEPT = "1"
      try {
        const permission = yield* PermissionV2.Service
        // Should succeed without hanging or erroring
        yield* permission.assert({
          action: "bash",
          resources: ["rm -rf /tmp/test"],
          save: ["rm -rf /tmp/test"],
          sessionID: SessionV2.ID.make("ses_test"),
          source: { type: "tool", messageID: SessionMessage.ID.make("msg_1"), callID: "call_1" },
        })
      } finally {
        delete process.env.OPENCODE_AUTO_ACCEPT
      }
    }),
  )
})
