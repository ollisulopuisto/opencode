export * as WebPush from "./push"

import { EventV2 } from "@opencode-ai/core/event"
import { Global } from "@opencode-ai/core/global"
import { makeGlobalNode } from "@opencode-ai/core/effect/app-node"
import { base64Encode } from "@opencode-ai/core/util/encode"
import { Push } from "@opencode-ai/protocol/groups/push"
import { Context, Effect, Layer, Schema } from "effect"
import { chmod, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises"
import path from "node:path"
import webpush from "web-push"

export const PUSH_STATE_FILE = "web-push.json"
const DEFAULT_VAPID_SUBJECT = "mailto:security@opencode.ai"

export type VapidKeys = {
  publicKey: string
  privateKey: string
}

export type PermissionPushPayload = {
  type: "permission"
  sessionID: string
  permissionID: string
  title: string
  body: string
  data: {
    path: string
    permissionID: string
  }
}

type PushState = VapidKeys & {
  subscriptions: Push.Subscription[]
}

type PushSender = (subscription: Push.Subscription, payload: Record<string, unknown>, keys: VapidKeys) => Promise<void>

type PushStoreOptions = {
  stateDirectory?: string
  subject?: string
  generateVapidKeys?: () => VapidKeys | Promise<VapidKeys>
  sendNotification?: PushSender
}

export function isPushSubscription(value: unknown): value is Push.Subscription {
  if (!Schema.is(Push.Subscription)(value)) return false
  if (!isPushEndpoint(value.endpoint)) return false
  return /^[A-Za-z0-9_-]+$/.test(value.keys.p256dh) && /^[A-Za-z0-9_-]+$/.test(value.keys.auth)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function isPushEndpoint(value: unknown): value is string {
  if (typeof value !== "string") return false
  try {
    return new URL(value).protocol === "https:"
  } catch {
    return false
  }
}

export function buildPermissionPushPayload(input: {
  type: "permission.asked" | "permission.v2.asked"
  data: Record<string, unknown>
  directory?: string
  location?: { directory?: string }
}): PermissionPushPayload {
  const sessionID = typeof input.data.sessionID === "string" ? input.data.sessionID : undefined
  const permissionID = typeof input.data.id === "string" ? input.data.id : undefined
  if (!sessionID || !permissionID) throw new Error("Invalid permission event")

  const directory = input.directory ?? input.location?.directory
  const sessionPath = directory ? `/${base64Encode(directory)}/session/${encodeURIComponent(sessionID)}` : "/"
  return {
    type: "permission",
    sessionID,
    permissionID,
    title: "Permission required",
    body: "OpenCode needs your approval",
    data: {
      path: sessionPath,
      permissionID,
    },
  }
}

export function createPushStore(options: PushStoreOptions = {}) {
  const stateDirectory = options.stateDirectory ?? Global.Path.state
  const statePath = path.join(stateDirectory, PUSH_STATE_FILE)
  const generateVapidKeys = options.generateVapidKeys ?? (() => webpush.generateVAPIDKeys())
  const subject = options.subject ?? DEFAULT_VAPID_SUBJECT
  const sendNotification =
    options.sendNotification ??
    ((subscription, payload, keys) => defaultSendNotification(subscription, payload, keys, subject))
  let loaded: Promise<PushState> | undefined
  let queue = Promise.resolve()

  const state = () => {
    loaded ??= loadState({ stateDirectory, statePath, generateVapidKeys })
    return loaded
  }

  const update = (mutate: (value: PushState) => void) => {
    const next = queue.then(async () => {
      const value = await state()
      mutate(value)
      await persistState(statePath, value)
    })
    queue = next.then(
      () => undefined,
      () => undefined,
    )
    return next
  }

  return {
    async publicKey() {
      return (await state()).publicKey
    },
    async subscribe(value: unknown) {
      if (!isPushSubscription(value)) throw new Error("Invalid Web Push subscription")
      await update((current) => {
        const index = current.subscriptions.findIndex((item) => item.endpoint === value.endpoint)
        if (index === -1) {
          current.subscriptions.push(value)
          return
        }
        current.subscriptions[index] = value
      })
    },
    async unsubscribe(endpoint: string) {
      await update((current) => {
        current.subscriptions = current.subscriptions.filter((item) => item.endpoint !== endpoint)
      })
    },
    async list() {
      await queue
      return (await state()).subscriptions.map((item) => ({ ...item, keys: { ...item.keys } }))
    },
    async notify(payload: Record<string, unknown>) {
      await queue
      const current = await state()
      const removed = new Set<string>()
      await Promise.all(
        current.subscriptions.map(async (subscription) => {
          try {
            await sendNotification(subscription, payload, current)
          } catch (error) {
            if (isGone(error)) removed.add(subscription.endpoint)
          }
        }),
      )
      if (removed.size === 0) return
      await update((next) => {
        next.subscriptions = next.subscriptions.filter((item) => !removed.has(item.endpoint))
      })
    },
    statePath,
    subject,
  }
}

export class WebPushError extends Schema.TaggedErrorClass<WebPushError>()("WebPushError", {
  message: Schema.String,
}) {}

export class InvalidPushSubscriptionError extends Schema.TaggedErrorClass<InvalidPushSubscriptionError>()(
  "InvalidPushSubscriptionError",
  { message: Schema.String },
) {}

export interface Interface {
  readonly publicKey: Effect.Effect<string, WebPushError>
  readonly subscribe: (subscription: unknown) => Effect.Effect<void, WebPushError | InvalidPushSubscriptionError>
  readonly unsubscribe: (endpoint: string) => Effect.Effect<void, WebPushError | InvalidPushSubscriptionError>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/WebPush") {}

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const events = yield* EventV2.Service
    const store = createPushStore()
    const unsubscribe = yield* events.listen((event) =>
      Effect.sync(() => {
        if (event.type !== "permission.asked" && event.type !== "permission.v2.asked") return
        const data = event.data
        if (!isRecord(data)) return
        const payload = buildPermissionPushPayload({
          type: event.type,
          data,
          location: event.location,
        })
        void store.notify(payload).catch(() => undefined)
      }),
    )
    yield* Effect.addFinalizer(() => unsubscribe)

    const promise = <A>(task: () => Promise<A>) =>
      Effect.tryPromise({
        try: task,
        catch: (error) => new WebPushError({ message: error instanceof Error ? error.message : String(error) }),
      })

    return Service.of({
      publicKey: promise(() => store.publicKey()),
      subscribe: (subscription) => {
        if (!isPushSubscription(subscription))
          return Effect.fail(new InvalidPushSubscriptionError({ message: "Invalid Web Push subscription" }))
        return promise(() => store.subscribe(subscription))
      },
      unsubscribe: (endpoint) => {
        if (!isPushEndpoint(endpoint))
          return Effect.fail(new InvalidPushSubscriptionError({ message: "Invalid Web Push endpoint" }))
        return promise(() => store.unsubscribe(endpoint))
      },
    })
  }),
)

export const node = makeGlobalNode({ service: Service, layer, deps: [EventV2.node] })

async function loadState(input: {
  stateDirectory: string
  statePath: string
  generateVapidKeys: () => VapidKeys | Promise<VapidKeys>
}): Promise<PushState> {
  await mkdir(input.stateDirectory, { recursive: true })
  const raw = await readFile(input.statePath, "utf8").catch(() => undefined)
  const parsed = raw ? parseState(raw) : undefined
  if (parsed) {
    await chmod(input.statePath, 0o600)
    return parsed
  }

  const keys = await input.generateVapidKeys()
  const value: PushState = { ...keys, subscriptions: [] }
  await persistState(input.statePath, value)
  return value
}

function parseState(raw: string): PushState | undefined {
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return undefined
  }
  if (!isRecord(value)) return undefined
  const record = value
  if (typeof record.publicKey !== "string" || typeof record.privateKey !== "string") return undefined
  const subscriptions = Array.isArray(record.subscriptions) ? record.subscriptions.filter(isPushSubscription) : []
  return { publicKey: record.publicKey, privateKey: record.privateKey, subscriptions }
}

async function persistState(statePath: string, value: PushState) {
  const temporary = `${statePath}.${process.pid}.${crypto.randomUUID()}.tmp`
  try {
    await writeFile(temporary, JSON.stringify({ ...value, version: 1 }), { encoding: "utf8", mode: 0o600 })
    await chmod(temporary, 0o600)
    await rename(temporary, statePath)
    await chmod(statePath, 0o600)
  } catch (error) {
    await unlink(temporary).catch(() => undefined)
    throw error
  }
}

function isGone(error: unknown) {
  if (!error || typeof error !== "object") return false
  const statusCode = "statusCode" in error ? error.statusCode : "status" in error ? error.status : undefined
  return statusCode === 404 || statusCode === 410
}

async function defaultSendNotification(
  subscription: Push.Subscription,
  payload: Record<string, unknown>,
  keys: VapidKeys,
  subject: string,
) {
  webpush.setVapidDetails(subject, keys.publicKey, keys.privateKey)
  await webpush.sendNotification(subscription, JSON.stringify(payload))
}
