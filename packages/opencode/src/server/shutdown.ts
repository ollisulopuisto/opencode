import { GlobalBus } from "@/bus/global"
import { Context, Effect, Layer } from "effect"

export interface Interface {
  readonly request: () => Effect.Effect<void>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/ServerShutdown") {}

export const layer = (exit: Effect.Effect<void>) =>
  Layer.effect(
    Service,
    Effect.gen(function* () {
      let requested = false
      const request = Effect.fn("ServerShutdown.request")(function* () {
        if (requested) return
        requested = true
        GlobalBus.emit("event", {
          directory: "global",
          payload: { type: "server.shutting_down", properties: {} },
        })
        yield* exit
      })
      return Service.of({ request })
    }),
  )

export * as ServerShutdown from "./shutdown"