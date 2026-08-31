import { Effect } from "effect"
import { HttpApiBuilder, HttpApiSchema } from "effect/unstable/httpapi"
import { InvalidRequestError, ServiceUnavailableError } from "@opencode-ai/protocol/errors"
import { Api } from "../api"
import { InvalidPushSubscriptionError, WebPush, WebPushError } from "../push"

function mapPushError<A>(effect: Effect.Effect<A, WebPushError | InvalidPushSubscriptionError>) {
  return effect.pipe(
    Effect.catchTag("InvalidPushSubscriptionError", (error) =>
      Effect.fail(new InvalidRequestError({ message: error.message })),
    ),
    Effect.catchTag("WebPushError", (error) =>
      Effect.fail(new ServiceUnavailableError({ message: error.message, service: "web-push" })),
    ),
  )
}

export const PushHandler = HttpApiBuilder.group(Api, "server.push", (handlers) =>
  Effect.gen(function* () {
    const push = yield* WebPush.Service

    return handlers
      .handle("push.publicKey", () => mapPushError(push.publicKey.pipe(Effect.map((publicKey) => ({ publicKey })))))
      .handle("push.subscription.register", (ctx) =>
        mapPushError(push.subscribe(ctx.payload)).pipe(Effect.as(HttpApiSchema.NoContent.make())),
      )
      .handle("push.subscription.remove", (ctx) =>
        mapPushError(push.unsubscribe(ctx.payload.endpoint)).pipe(Effect.as(HttpApiSchema.NoContent.make())),
      )
  }),
)
