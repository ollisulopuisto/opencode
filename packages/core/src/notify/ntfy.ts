export * as Ntfy from "./ntfy"

import { Effect } from "effect"
import { Flag } from "../flag/flag"

let lastUserActivity = 0

export const recordPresence = () => {
  lastUserActivity = Date.now()
}

export const isUserPresent = (windowMs = 60_000) => {
  return Date.now() - lastUserActivity < windowMs
}

export interface Message {
  readonly title?: string
  readonly message: string
  readonly priority?: "min" | "low" | "default" | "high" | "urgent"
  readonly tags?: ReadonlyArray<string>
}

export type NtfyMessage = Message

export interface NtfyOptions {
  readonly suppressIfPresent?: boolean
}

export const send = (msg: Message, options?: NtfyOptions): Effect.Effect<void> =>
  Effect.gen(function* () {
    if (options?.suppressIfPresent !== false && isUserPresent()) {
      return
    }

    const url = Flag.OPENCODE_NTFY_URL ?? (process.env["OPENCODE_NTFY_TOPIC"] ? `https://ntfy.sh/${process.env["OPENCODE_NTFY_TOPIC"]}` : undefined)
    if (!url) return

    yield* Effect.tryPromise({
      try: async () => {
        await fetch(url, {
          method: "POST",
          headers: {
            ...(msg.title ? { Title: msg.title } : {}),
            ...(msg.priority ? { Priority: msg.priority } : {}),
            ...(msg.tags?.length ? { Tags: msg.tags.join(",") } : {}),
          },
          body: msg.message,
        })
      },
      catch: () => undefined,
    }).pipe(Effect.ignore)
  })
