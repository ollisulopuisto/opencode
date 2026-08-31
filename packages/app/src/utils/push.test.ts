import { describe, expect, test } from "bun:test"
import { disablePushNotifications, enablePushNotifications, type PushSubscriptionPayload } from "./push"

const endpoint = "https://push.example.test/subscription/1"
const subscription = {
  endpoint,
  toJSON: () => ({ endpoint, expirationTime: null, keys: { p256dh: "p256dh", auth: "auth" } }),
  unsubscribe: async () => true,
}

describe("web push subscription", () => {
  test("requests permission, subscribes with the server key, and registers the subscription", async () => {
    const calls: { options?: PushSubscriptionOptionsInit; payload?: PushSubscriptionPayload } = {}
    const serviceWorker = {
      ready: Promise.resolve({
        pushManager: {
          getSubscription: async () => null,
          subscribe: async (options: PushSubscriptionOptionsInit) => {
            calls.options = options
            return subscription
          },
        },
      }),
    }
    const notification = {
      permission: "default" as NotificationPermission,
      requestPermission: async () => "granted" as NotificationPermission,
    }
    const api = {
      publicKey: async () => ({ publicKey: "AQID" }),
      subscribe: async (payload: PushSubscriptionPayload) => {
        calls.payload = payload
      },
      unsubscribe: async () => {},
    }

    await enablePushNotifications({ api, serviceWorker, notification })

    expect(calls.options).toMatchObject({ userVisibleOnly: true })
    const key = calls.options?.applicationServerKey
    if (!(key instanceof Uint8Array)) throw new Error("expected a Uint8Array application server key")
    expect(Array.from(key)).toEqual([1, 2, 3])
    expect(calls.payload).toEqual({ endpoint, expirationTime: null, keys: { p256dh: "p256dh", auth: "auth" } })
  })

  test("does not register a subscription when notification permission is denied", async () => {
    let registered = false
    const api = {
      publicKey: async () => ({ publicKey: "AQID" }),
      subscribe: async () => {
        registered = true
      },
      unsubscribe: async () => {},
    }

    await expect(
      enablePushNotifications({
        api,
        serviceWorker: { ready: Promise.resolve({ pushManager: undefined }) },
        notification: {
          permission: "denied",
          requestPermission: async () => "denied",
        },
      }),
    ).rejects.toThrow()
    expect(registered).toBe(false)
  })

  test("removes a subscription locally and on the server when disabled", async () => {
    const calls: string[] = []
    const api = {
      publicKey: async () => ({ publicKey: "AQID" }),
      subscribe: async () => {},
      unsubscribe: async (value: { endpoint: string }) => {
        calls.push(`server:${value.endpoint}`)
      },
    }
    const serviceWorker = {
      ready: Promise.resolve({
        pushManager: {
          getSubscription: async () => subscription,
          subscribe: async () => subscription,
        },
      }),
    }

    await disablePushNotifications({ api, serviceWorker })
    calls.push("local")

    expect(calls).toEqual([`server:${endpoint}`, "local"])
  })
})
