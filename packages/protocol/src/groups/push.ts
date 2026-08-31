import { Push } from "@opencode-ai/schema/push"
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema, OpenApi } from "effect/unstable/httpapi"
import { InvalidRequestError, ServiceUnavailableError } from "../errors"

export { Push } from "@opencode-ai/schema/push"

export const PushGroup = HttpApiGroup.make("server.push")
  .add(
    HttpApiEndpoint.get("push.publicKey", "/api/push/public-key", {
      success: Push.PublicKey,
      error: ServiceUnavailableError,
    }).annotateMerge(
      OpenApi.annotations({
        identifier: "v2.push.publicKey",
        summary: "Get the Web Push public key",
        description: "Get the public VAPID key used to register a browser for OpenCode notifications.",
      }),
    ),
  )
  .add(
    HttpApiEndpoint.post("push.subscription.register", "/api/push/subscription", {
      payload: Push.Subscription,
      success: HttpApiSchema.NoContent,
      error: [InvalidRequestError, ServiceUnavailableError],
    }).annotateMerge(
      OpenApi.annotations({
        identifier: "v2.push.subscription.register",
        summary: "Register a Web Push subscription",
        description: "Register the authenticated browser subscription for permission notifications.",
      }),
    ),
  )
  .add(
    HttpApiEndpoint.delete("push.subscription.remove", "/api/push/subscription", {
      payload: Push.Unsubscribe,
      success: HttpApiSchema.NoContent,
      error: [InvalidRequestError, ServiceUnavailableError],
    }).annotateMerge(
      OpenApi.annotations({
        identifier: "v2.push.subscription.remove",
        summary: "Remove a Web Push subscription",
        description: "Remove the authenticated browser subscription from the OpenCode server.",
      }),
    ),
  )
  .annotateMerge(OpenApi.annotations({ title: "push", description: "Web Push notification routes." }))
