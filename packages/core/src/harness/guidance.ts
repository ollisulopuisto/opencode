export * as TaskStateGuidance from "./guidance"

import { makeLocationNode } from "../effect/app-node"
import { Effect, Layer, Option, Schema } from "effect"
import { Location } from "../location"
import { FSUtil } from "../fs-util"
import { SystemContext } from "../system-context/index"
import { SystemContextRegistry } from "../system-context/registry"
import { TaskStateContext, TaskStatePayload, TaskStateOptional } from "../system-context/task-state"
import path from "node:path"

const layer = Layer.effectDiscard(
  Effect.gen(function* () {
    const location = yield* Location.Service
    const registry = yield* SystemContextRegistry.Service
    const fs = yield* FSUtil.Service

    const loadTaskState = Effect.gen(function* () {
      const taskStatePath = path.join(location.directory, ".opencode/task-state.json")
      const statePath = path.join(location.directory, ".opencode/state.json")
      const content = yield* fs.readFileStringSafe(taskStatePath).pipe(
        Effect.flatMap((c) => (c ? Effect.succeed(c) : fs.readFileStringSafe(statePath))),
        Effect.catch(() => Effect.succeed(undefined)),
      )
      if (!content) return undefined
      const parsed = Schema.decodeUnknownOption(Schema.UnknownFromJsonString)(content)
      if (Option.isNone(parsed)) return undefined
      const decoded = Schema.decodeUnknownOption(TaskStatePayload)(parsed.value)
      if (Option.isNone(decoded)) return undefined
      return decoded.value
    })

    const source = SystemContext.make({
      key: SystemContext.Key.make("harness/task-state"),
      codec: Schema.toCodecJson(TaskStateOptional),
      load: loadTaskState,
      baseline: (current) =>
        current ? ["Active autonomous task state:", TaskStateContext.renderTaskStateBaseline(current)].join("\n") : "Task state: idle.",
      update: (previous, current) => TaskStateContext.renderTaskStateUpdate(previous, current),
    })

    yield* registry.register({
      key: SystemContext.Key.make("harness/task-state"),
      load: Effect.succeed(source),
    })
  }),
)

export const node = makeLocationNode({
  name: "harness-task-state-guidance",
  layer,
  deps: [Location.node, SystemContextRegistry.node, FSUtil.node],
})
