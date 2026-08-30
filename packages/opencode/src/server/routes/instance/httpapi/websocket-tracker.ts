import { Context, Effect, Layer, Option } from "effect"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import * as Socket from "effect/unstable/socket/Socket"
import { socketIsStale } from "@/util/remote-pwa"

export const SERVER_CLOSING_EVENT = () => new Socket.CloseEvent(1001, "server closing")
export const STALE_CLOSING_EVENT = () => new Socket.CloseEvent(1000, "stale client reaped")

type Close = Effect.Effect<void, unknown>

interface ClientEntry {
  lastSeen?: number
}

export interface Interface {
  readonly add: (close: Close) => Effect.Effect<boolean>
  readonly touch: (close: Close) => Effect.Effect<void>
  readonly remove: (close: Close) => Effect.Effect<void>
  readonly closeAll: Effect.Effect<void>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/HttpApiWebSocketTracker") {}

const layer = Layer.sync(Service)(() => {
  const sockets = new Map<Close, ClientEntry>()
  let closing = false

  const sweep = () => {
    if (closing) return
    const now = Date.now()
    const stale: Close[] = []

    for (const [close, client] of sockets.entries()) {
      if (client.lastSeen === undefined) {
        client.lastSeen = now
        continue
      }
      if (socketIsStale(client.lastSeen, now, 45_000)) {
        stale.push(close)
      }
    }

    for (const close of stale) {
      sockets.delete(close)
      Effect.runFork(
        close.pipe(
          Effect.timeout("1 second"),
          Effect.catch(() => Effect.void),
        ),
      )
    }
  }

  const interval = setInterval(sweep, 15_000)
  if (typeof interval === "object" && "unref" in interval) {
    interval.unref()
  }

  return Service.of({
    add: (close) =>
      Effect.gen(function* () {
        if (closing) return false
        sockets.set(close, { lastSeen: Date.now() })
        return true
      }),
    touch: (close) =>
      Effect.sync(() => {
        const entry = sockets.get(close)
        if (entry) entry.lastSeen = Date.now()
      }),
    remove: (close) =>
      Effect.sync(() => {
        sockets.delete(close)
      }),
    closeAll: Effect.gen(function* () {
      closing = true
      clearInterval(interval)
      const active = Array.from(sockets.keys())
      sockets.clear()
      yield* Effect.all(
        active.map((close) =>
          close.pipe(
            Effect.timeout("1 second"),
            Effect.catch(() => Effect.void),
          ),
        ),
        { concurrency: "unbounded", discard: true },
      )
    }),
  })
})

export const node = LayerNode.make({ service: Service, layer, deps: [] })

export const register = (close: Close) =>
  Effect.gen(function* () {
    const tracker = yield* Effect.serviceOption(Service)
    if (Option.isNone(tracker)) return true
    const registered = yield* tracker.value.add(close)
    if (!registered) return false
    yield* Effect.addFinalizer(() => tracker.value.remove(close))
    return true
  })

export const touch = (close: Close) =>
  Effect.gen(function* () {
    const tracker = yield* Effect.serviceOption(Service)
    if (Option.isSome(tracker)) {
      yield* tracker.value.touch(close)
    }
  })

export * as WebSocketTracker from "./websocket-tracker"
