import { describe, expect, test } from "bun:test"
import {
  authFromToken,
  authTokenFromCredentials,
  createPushApi,
  persistPairedServer,
  scrubAuthTokenUrl,
} from "./server"

describe("authFromToken", () => {
  test("decodes basic auth credentials from auth_token", () => {
    expect(authFromToken(btoa("kit:secret"))).toEqual({ username: "kit", password: "secret" })
  })

  test("defaults blank username to opencode", () => {
    expect(authFromToken(btoa(":secret"))).toEqual({ username: "opencode", password: "secret" })
  })

  test("ignores malformed tokens", () => {
    expect(authFromToken("not base64")).toBeUndefined()
    expect(authFromToken(btoa("missing-separator"))).toBeUndefined()
  })
})

describe("authTokenFromCredentials", () => {
  test("encodes credentials with the default username", () => {
    expect(authTokenFromCredentials({ password: "secret" })).toBe(btoa("opencode:secret"))
  })
})

describe("paired server persistence", () => {
  test("stores startup credentials before the auth token is scrubbed", () => {
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => void values.set(key, value),
    }

    expect(
      persistPairedServer(storage, {
        url: "https://server.example.test",
        username: "kit",
        password: "secret",
      }),
    ).toBe(true)
    expect(JSON.parse(values.get("opencode.global.dat:server") ?? "")).toMatchObject({
      list: [{ type: "http", http: { url: "https://server.example.test", username: "kit", password: "secret" } }],
    })
    expect(scrubAuthTokenUrl("https://server.example.test/project?auth_token=secret&prompt=review#x")).toBe(
      "/project?prompt=review#x",
    )
  })

  test("upgrades a legacy same-url server entry instead of duplicating it", () => {
    const values = new Map([["opencode.global.dat:server", JSON.stringify({ list: ["https://server.example.test"] })]])
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => void values.set(key, value),
    }

    persistPairedServer(storage, { url: "https://server.example.test", password: "secret" })

    expect(JSON.parse(values.get("opencode.global.dat:server") ?? "").list).toHaveLength(1)
  })
})

describe("createPushApi", () => {
  test("sends the server credentials and keeps the response free of credentials", async () => {
    let request: Request | undefined
    const api = createPushApi({
      server: { url: "https://server.example.test", username: "kit", password: "secret" },
      fetch: ((input, init) => {
        request = new Request(input, init)
        return Promise.resolve(new Response(JSON.stringify({ publicKey: "AQID" }), { status: 200 }))
      }) as typeof globalThis.fetch,
    })

    expect(await api.publicKey()).toEqual({ publicKey: "AQID" })
    expect(request?.url).toBe("https://server.example.test/api/push/public-key")
    expect(request?.headers.get("authorization")).toBe(`Basic ${btoa("kit:secret")}`)
    expect(JSON.stringify(await api.publicKey())).not.toContain("secret")
  })
})
