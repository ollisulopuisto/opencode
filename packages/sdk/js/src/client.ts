export * from "./gen/types.gen.js"

import { createClient } from "./gen/client/client.gen.js"
import { type Config } from "./gen/client/types.gen.js"
import { OpencodeClient } from "./gen/sdk.gen.js"
import { wrapClientError } from "./error-interceptor.js"
export { type Config as OpencodeClientConfig, OpencodeClient }

function pick(value: string | null, fallback?: string) {
  if (!value) return
  if (!fallback) return value
  if (value === fallback) return fallback
  if (value === encodeURIComponent(fallback)) return fallback
  return value
}

function rewrite(request: Request, directory?: string) {
  if (request.method !== "GET" && request.method !== "HEAD") return request

  const value = pick(request.headers.get("x-opencode-directory"), directory)
  if (!value) return request

  const url = new URL(request.url)
  if (!url.searchParams.has("directory")) {
    url.searchParams.set("directory", value)
  }

  const next = new Request(url, request)
  next.headers.delete("x-opencode-directory")
  return next
}

export function createOpencodeClient(config?: Config & { directory?: string }) {
  let baseUrl = config?.baseUrl
  let unixSocket: string | undefined
  if (baseUrl) {
    if (baseUrl.startsWith("unix://")) {
      unixSocket = baseUrl.slice(7)
      baseUrl = "http://localhost"
    } else if (baseUrl.startsWith("unix:")) {
      unixSocket = baseUrl.slice(5)
      baseUrl = "http://localhost"
    } else if (baseUrl.startsWith("/") || baseUrl.startsWith("./")) {
      unixSocket = baseUrl
      baseUrl = "http://localhost"
    }
  }

  const baseFetch = config?.fetch ?? fetch
  const customFetch: any = (req: any, init?: any) => {
    if (unixSocket) {
      if (typeof req === "string" || req instanceof URL) {
        return (baseFetch as any)(req, { ...init, unix: unixSocket })
      }
      return (baseFetch as any)(req, { unix: unixSocket })
    }
    // @ts-ignore
    if (req && typeof req === "object") req.timeout = false
    return (baseFetch as any)(req, init)
  }

  config = {
    ...config,
    baseUrl,
    fetch: customFetch,
  }

  if (config?.directory) {
    config.headers = {
      ...config.headers,
      "x-opencode-directory": encodeURIComponent(config.directory),
    }
  }

  const client = createClient(config)
  client.interceptors.request.use((request) => rewrite(request, config?.directory))
  client.interceptors.error.use(wrapClientError)
  return new OpencodeClient({ client })
}
