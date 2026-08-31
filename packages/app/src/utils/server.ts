import { createOpencodeClient } from "@opencode-ai/sdk/v2/client"
import { OpenCode, type OpenCodeClient } from "@opencode-ai/client/promise"
import type { ServerConnection } from "@/context/server"
import { decode64 } from "@/utils/base64"
import type { PushApi, PushSubscriptionPayload } from "@/utils/push"

export function authTokenFromCredentials(input: { username?: string; password: string }) {
  return btoa(`${input.username ?? "opencode"}:${input.password}`)
}

export function authFromToken(token: string | null) {
  const decoded = decode64(token ?? undefined)
  if (!decoded) return undefined
  const separator = decoded.indexOf(":")
  if (separator === -1) return undefined
  return {
    username: decoded.slice(0, separator) || "opencode",
    password: decoded.slice(separator + 1),
  }
}

export function persistPairedServer(
  storage: Pick<Storage, "getItem" | "setItem"> | undefined,
  server: {
    url: string
    username?: string
    password?: string
  },
) {
  if (!storage || !server.password) return false

  try {
    const key = "opencode.global.dat:server"
    const raw = storage.getItem(key)
    const current = raw ? (JSON.parse(raw) as unknown) : undefined
    const state: Record<string, unknown> = isRecord(current) ? current : {}
    const list = Array.isArray(state.list) ? [...state.list] : []
    const next = {
      type: "http" as const,
      http: {
        url: server.url,
        ...(server.username ? { username: server.username } : {}),
        password: server.password,
      },
    }
    const index = list.findIndex((item) => {
      if (typeof item === "string") return item === server.url
      if (!item || typeof item !== "object") return false
      const http = "http" in item ? item.http : item
      return !!http && typeof http === "object" && "url" in http && http.url === server.url
    })
    if (index === -1) list.push(next)
    else list[index] = next
    storage.setItem(key, JSON.stringify({ ...state, list }))
    return true
  } catch {
    return false
  }
}

export function scrubAuthTokenUrl(value: string) {
  const url = new URL(value, "http://opencode.invalid")
  if (!url.searchParams.has("auth_token")) return value
  url.searchParams.delete("auth_token")
  return url.pathname + (url.searchParams.size ? `?${url.searchParams}` : "") + url.hash
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function createPushApi(input: { server: ServerConnection.HttpBase; fetch?: typeof globalThis.fetch }): PushApi {
  const fetcher = input.fetch ?? globalThis.fetch
  const headers = input.server.password
    ? {
        Authorization: `Basic ${authTokenFromCredentials({
          username: input.server.username,
          password: input.server.password,
        })}`,
      }
    : undefined

  const request = async (path: string, method: "GET" | "POST" | "DELETE", body?: unknown): Promise<unknown> => {
    const response = await fetcher(new URL(path, input.server.url), {
      method,
      headers: {
        ...headers,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (!response.ok) throw new Error(`Web Push request failed (${response.status})`)
    if (response.status === 204) return undefined
    return response.json()
  }

  return {
    publicKey: async () => {
      const value = await request("/api/push/public-key", "GET")
      if (!isRecord(value) || typeof value.publicKey !== "string") throw new Error("Invalid Web Push public key")
      return { publicKey: value.publicKey }
    },
    subscribe: async (payload: PushSubscriptionPayload) => {
      await request("/api/push/subscription", "POST", payload)
    },
    unsubscribe: async (payload: { endpoint: string }) => {
      await request("/api/push/subscription", "DELETE", payload)
    },
  }
}

export function createSdkForServer({
  server,
  ...config
}: Omit<NonNullable<Parameters<typeof createOpencodeClient>[0]>, "baseUrl"> & {
  server: ServerConnection.HttpBase
}) {
  const auth = server.password
    ? {
        Authorization: `Basic ${authTokenFromCredentials({ username: server.username, password: server.password })}`,
      }
    : undefined

  return createOpencodeClient({
    ...config,
    headers: {
      ...(() => {
        if (!config.headers) return {}
        if (config.headers instanceof Headers) return Object.fromEntries(config.headers.entries())
        if (Array.isArray(config.headers)) return Object.fromEntries(config.headers)
        return Object.fromEntries(Object.entries(config.headers).map(([key, value]) => [key, String(value)]))
      })(),
      ...auth,
    },
    baseUrl: server.url,
  })
}

export function createApiForServer(input: {
  server: ServerConnection.HttpBase
  fetch?: typeof globalThis.fetch
}): ServerApi {
  const client = OpenCode.make({
    baseUrl: input.server.url,
    fetch: input.fetch,
    headers: input.server.password
      ? {
          Authorization: `Basic ${authTokenFromCredentials({
            username: input.server.username,
            password: input.server.password,
          })}`,
        }
      : undefined,
  })
  return Object.assign(client, { push: createPushApi(input) })
}

export type ServerApi = OpenCodeClient & { push: PushApi }
