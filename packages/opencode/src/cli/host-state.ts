export * as HostState from "./host-state"

import path from "path"
import { mkdir, writeFile } from "node:fs/promises"
import { Global } from "@opencode-ai/core/global"

// Record of a server started by `opencode host` so later invocations (and
// their TUI clients) can find and authenticate to the running server.
// Contains the server password, hence the 0600 file mode.
export type HostRecord = {
  port: number
  socket?: string
  password?: string
  pid: number
  startedAt: number
}

export function statePath(dir = Global.Path.state) {
  return path.join(dir, "host.json")
}

export async function read(dir = Global.Path.state): Promise<HostRecord | undefined> {
  let parsed: unknown
  try {
    parsed = JSON.parse(await Bun.file(statePath(dir)).text())
  } catch {
    return undefined
  }
  if (typeof parsed !== "object" || parsed === null) return undefined
  if (!("port" in parsed) || !("pid" in parsed) || !("startedAt" in parsed)) return undefined
  const { port, pid, startedAt } = parsed
  if (typeof port !== "number" || typeof pid !== "number" || typeof startedAt !== "number") return undefined
  const socket = "socket" in parsed ? parsed.socket : undefined
  const password = "password" in parsed ? parsed.password : undefined
  if (socket !== undefined && typeof socket !== "string") return undefined
  if (password !== undefined && typeof password !== "string") return undefined
  return { port, socket, password, pid, startedAt }
}

export async function write(record: HostRecord, dir = Global.Path.state) {
  await mkdir(dir, { recursive: true })
  await writeFile(statePath(dir), JSON.stringify(record), { mode: 0o600 })
}

export async function clear(dir = Global.Path.state) {
  await Bun.file(statePath(dir)).delete().catch(() => {})
}

// Any HTTP response — including 401 — proves an opencode server is listening.
export async function probe(url: string, headers?: Record<string, string>, timeoutMs = 1000): Promise<boolean> {
  try {
    const res = await fetch(new URL("/doc", url), { headers, signal: AbortSignal.timeout(timeoutMs) })
    if (res.status === 400) {
      const text = await res.text().catch(() => "")
      if (text.includes("Direct IP access")) return false
    }
    return true
  } catch {
    return false
  }
}
