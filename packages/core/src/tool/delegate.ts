export * as DelegateTool from "./delegate"

import { ToolFailure } from "@opencode-ai/llm"
import { Effect, Layer, Schema } from "effect"
import { makeLocationNode } from "../effect/app-node"
import { PermissionV2 } from "../permission"
import { SessionExecution } from "../session/execution"
import { SessionInput } from "../session/input"
import { SessionMessage } from "../session/message"
import { SessionSchema } from "../session/schema"
import { Prompt } from "../session/prompt"
import { Database } from "../database/database"
import { EventV2 } from "../event"
import { ToolRegistry } from "./registry"
import { Tool } from "./tool"
import { Tools } from "./tools"

export const name = "delegate"

export const Input = Schema.Struct({
  sessionID: Schema.String.annotate({
    description: "Target session ID to send the message or task to.",
  }),
  prompt: Schema.String.annotate({
    description: "The instructions, message, or delegated task for the target session.",
  }),
  mode: Schema.optional(Schema.Literals(["steer", "queue"])).annotate({
    description: "Delivery mode: 'steer' (default) promotes at the next turn boundary; 'queue' waits until the target is idle.",
  }),
})

export const Output = Schema.Struct({
  sessionID: Schema.String,
  messageID: Schema.String,
  status: Schema.String,
})

export type Output = typeof Output.Type

export const toModelOutput = (output: Output) =>
  `Message admitted to session ${output.sessionID} with message ID ${output.messageID} (status: ${output.status}). Target session execution scheduled.`

const layer = Layer.effectDiscard(
  Effect.gen(function* () {
    const tools = yield* Tools.Service
    const { db } = yield* Database.Service
    const events = yield* EventV2.Service
    const execution = yield* SessionExecution.Service
    const permission = yield* PermissionV2.Service

    yield* tools
      .register({
        [name]: Tool.make({
          description:
            "Send a message or delegate a task to another OpenCode session. Enables inter-instance coordination, subagent orchestration, and background task execution.",
          input: Input,
          output: Output,
          structured: Output,
          toStructuredOutput: ({ output }) => output,
          toModelOutput: ({ output }) => [{ type: "text", text: toModelOutput(output) }],
          execute: (input, context) =>
            Effect.gen(function* () {
              yield* permission.assert({
                action: name,
                resources: [input.sessionID],
                save: [input.sessionID],
                sessionID: context.sessionID,
                agent: context.agent,
                source: { type: "tool", messageID: context.assistantMessageID, callID: context.toolCallID },
              })

              const messageID = SessionMessage.ID.make(`msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`)
              const targetSessionID = SessionSchema.ID.make(input.sessionID)
              const delivery = input.mode === "queue" ? SessionInput.Delivery.make("queue") : SessionInput.Delivery.make("steer")

              const prompt = Prompt.make({
                text: input.prompt,
              })

              yield* SessionInput.admit(db, events, {
                id: messageID,
                sessionID: targetSessionID,
                prompt,
                delivery,
              })

              yield* execution.wake(targetSessionID)

              return {
                sessionID: input.sessionID,
                messageID,
                status: "admitted",
              }
            }).pipe(Effect.mapError((error) => new ToolFailure({ message: `Failed to delegate to session ${input.sessionID}: ${error}` }))),
        }),
      })
      .pipe(Effect.orDie)
  }),
)

export const node = makeLocationNode({
  name: "tool/delegate",
  layer,
  deps: [ToolRegistry.node, Database.node, EventV2.node, SessionExecution.node, PermissionV2.node],
})
