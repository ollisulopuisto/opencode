import { afterEach, describe, expect, test } from "bun:test"
import { ConfigProvider, Layer } from "effect"
import { HttpRouter } from "effect/unstable/http"
import { HttpApiApp } from "../../src/server/routes/instance/httpapi/server"
import { ServerAuth } from "../../src/server/auth"
import { disposeAllInstances } from "../fixture/fixture"
import { resetDatabase } from "../fixture/db"

function app(input: { password?: string; username?: string }) {
  const handler = HttpRouter.toWebHandler(
    HttpApiApp.routes.pipe(
      Layer.provide(
        ConfigProvider.layer(
          ConfigProvider.fromUnknown({
            OPENCODE_SERVER_PASSWORD: input.password,
            OPENCODE_SERVER_USERNAME: input.username,
          }),
        ),
      ),
    ),
    { disableLogger: true },
  ).handler

  return (path: string, init?: RequestInit) => handler(new Request(`http://localhost${path}`, init), HttpApiApp.context)
}

function basic(username: string, password: string) {
  return ServerAuth.header({ username, password }) ?? ""
}

afterEach(async () => {
  await disposeAllInstances()
  await resetDatabase()
})

describe("Web Push HttpApi", () => {
  test("requires the server's existing auth boundary", async () => {
    const request = app({ password: "secret" })
    const response = await request("/api/push/public-key")

    expect(response.status).toBe(401)
  })

  test("rejects malformed or insecure subscriptions at the API boundary", async () => {
    const request = app({ password: "secret" })
    const headers = { authorization: basic("opencode", "secret"), "content-type": "application/json" }

    const malformed = await request("/api/push/subscription", { method: "POST", headers, body: "{}" })
    expect(malformed.status).toBe(400)

    const insecure = await request("/api/push/subscription", {
      method: "POST",
      headers,
      body: JSON.stringify({
        endpoint: "http://push.example.test/subscription",
        keys: { p256dh: "p256dh", auth: "auth" },
      }),
    })
    expect(insecure.status).toBe(400)
    expect(await insecure.text()).not.toContain("secret")

    const insecureRemoval = await request("/api/push/subscription", {
      method: "DELETE",
      headers,
      body: JSON.stringify({ endpoint: "http://push.example.test/subscription" }),
    })
    expect(insecureRemoval.status).toBe(400)
  })
})
