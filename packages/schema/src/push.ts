export * as Push from "./push"

import { Schema } from "effect"
import { optional } from "./schema"

export const Subscription = Schema.Struct({
  endpoint: Schema.String,
  expirationTime: optional(Schema.NullOr(Schema.Number)),
  keys: Schema.Struct({
    p256dh: Schema.String,
    auth: Schema.String,
  }),
}).annotate({ identifier: "Push.Subscription" })
export interface Subscription extends Schema.Schema.Type<typeof Subscription> {}

export const PublicKey = Schema.Struct({
  publicKey: Schema.String,
}).annotate({ identifier: "Push.PublicKey" })
export interface PublicKey extends Schema.Schema.Type<typeof PublicKey> {}

export const Unsubscribe = Schema.Struct({
  endpoint: Schema.String,
}).annotate({ identifier: "Push.Unsubscribe" })
export interface Unsubscribe extends Schema.Schema.Type<typeof Unsubscribe> {}
