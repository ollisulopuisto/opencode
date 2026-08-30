import { describe, expect } from "bun:test"
import { Effect } from "effect"
import { GlobalBus, type GlobalEvent } from "../../src/bus/global"
import { ServerShutdown } from "../../src/server/shutdown"
import { testEffect } from "../lib/effect"

const exits: number[] = []
const seen: GlobalEvent[] = []

const it = testEffect(
  ServerShutdown.layer(
    Effect.sync(() => {
      exits.push(1)
    }),
  ),
)

describe("ServerShutdown", () => {
  it.effect("emits server.shutting_down and exits once per request", () =>
    Effect.gen(function* () {
      const shutdown = yield* ServerShutdown.Service
      const handler = (event: GlobalEvent) => seen.push(event)
      GlobalBus.on("event", handler)
      yield* Effect.addFinalizer(() => Effect.sync(() => GlobalBus.off("event", handler)))

      yield* shutdown.request()
      yield* shutdown.request()

      expect(exits).toHaveLength(1)
      expect(seen).toHaveLength(1)
      expect(seen[0].directory).toBe("global")
      expect(seen[0].payload.type).toBe("server.shutting_down")
    }),
  )
})