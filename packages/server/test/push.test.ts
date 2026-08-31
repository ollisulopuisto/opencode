import { describe, expect, test } from "bun:test"
import { mkdtemp, readFile, rm, stat } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { base64Encode } from "@opencode-ai/core/util/encode"
import { buildPermissionPushPayload, createPushStore, PUSH_STATE_FILE } from "../src/push"

const keys = {
  publicKey: "public-key",
  privateKey: "private-key",
}

const subscription = {
  endpoint: "https://push.example.test/subscription/1",
  expirationTime: null,
  keys: {
    p256dh: "p256dh-key",
    auth: "auth-key",
  },
}

async function tempStore(sendNotification?: NonNullable<Parameters<typeof createPushStore>[0]>["sendNotification"]) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "opencode-push-test-"))
  const store = createPushStore({
    stateDirectory: directory,
    generateVapidKeys: () => keys,
    sendNotification,
  })
  return { directory, store }
}

describe("push store", () => {
  test("uses web-push to generate a VAPID key when no state exists", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "opencode-push-default-test-"))
    try {
      const store = createPushStore({ stateDirectory: directory })
      expect((await store.publicKey()).length).toBeGreaterThan(20)
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  test("generates and persists VAPID keys in a 0600 state file", async () => {
    const { directory, store } = await tempStore()

    expect(await store.publicKey()).toBe(keys.publicKey)

    const statePath = path.join(directory, PUSH_STATE_FILE)
    const state = JSON.parse(await readFile(statePath, "utf8"))
    expect(state).toMatchObject(keys)
    expect((await stat(statePath)).mode & 0o777).toBe(0o600)
    expect(await store.publicKey()).toBe(keys.publicKey)
  })

  test("validates, persists, and replaces subscriptions by endpoint", async () => {
    const { store } = await tempStore()

    await store.subscribe(subscription)
    await store.subscribe({ ...subscription, keys: { ...subscription.keys, auth: "updated-auth" } })

    expect(await store.list()).toEqual([{ ...subscription, keys: { ...subscription.keys, auth: "updated-auth" } }])
    await expect(store.subscribe({ ...subscription, endpoint: "http://insecure.test/subscription" })).rejects.toThrow()
  })

  test("removes subscriptions rejected as gone by the push provider", async () => {
    const gone = { ...subscription, endpoint: "https://push.example.test/subscription/gone" }
    const sendNotification = async (item: { endpoint: string }) => {
      if (item.endpoint === gone.endpoint) throw Object.assign(new Error("gone"), { statusCode: 410 })
    }
    const { directory, store } = await tempStore(sendNotification)
    await store.subscribe(subscription)
    await store.subscribe(gone)

    await store.notify({ type: "permission", sessionID: "ses_1", permissionID: "per_1" })

    expect(await store.list()).toEqual([subscription])
    const reloaded = createPushStore({ stateDirectory: directory, generateVapidKeys: () => keys })
    expect(await reloaded.list()).toEqual([subscription])
  })
})

describe("permission push payload", () => {
  test("keeps v1 permission notifications minimal", () => {
    const payload = buildPermissionPushPayload({
      type: "permission.asked",
      data: {
        id: "per_1",
        sessionID: "ses_1",
        permission: "read",
        patterns: ["/secret/file"],
        metadata: { secret: "do-not-send" },
      },
      directory: "/tmp/project",
    })

    expect(payload).toEqual({
      type: "permission",
      sessionID: "ses_1",
      permissionID: "per_1",
      title: "Permission required",
      body: "OpenCode needs your approval",
      data: {
        path: `/${base64Encode("/tmp/project")}/session/ses_1`,
        permissionID: "per_1",
      },
    })
    expect(JSON.stringify(payload)).not.toContain("secret")
    expect(JSON.stringify(payload)).not.toContain("/secret/file")
  })

  test("keeps v2 permission notifications minimal", () => {
    const payload = buildPermissionPushPayload({
      type: "permission.v2.asked",
      data: {
        id: "per_2",
        sessionID: "ses_2",
        action: "shell",
        resources: ["rm -rf /"],
      },
      directory: "/tmp/project",
    })

    expect(payload.sessionID).toBe("ses_2")
    expect(payload.permissionID).toBe("per_2")
    expect(JSON.stringify(payload)).not.toContain("rm -rf")
  })
})
