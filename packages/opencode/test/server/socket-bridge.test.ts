import { afterEach, describe, expect, test } from "bun:test"
import net from "node:net"
import { Flag } from "@opencode-ai/core/flag/flag"
import { Server } from "../../src/server/server"
import { resetDatabase } from "../fixture/db"
import { disposeAllInstances, tmpdir } from "../fixture/fixture"
import { withTimeout } from "../../src/util/timeout"

const original = {
  OPENCODE_SERVER_PASSWORD: Flag.OPENCODE_SERVER_PASSWORD,
  OPENCODE_SERVER_USERNAME: Flag.OPENCODE_SERVER_USERNAME,
  envPassword: process.env.OPENCODE_SERVER_PASSWORD,
  envUsername: process.env.OPENCODE_SERVER_USERNAME,
}

afterEach(async () => {
  Flag.OPENCODE_SERVER_PASSWORD = original.OPENCODE_SERVER_PASSWORD
  Flag.OPENCODE_SERVER_USERNAME = original.OPENCODE_SERVER_USERNAME
  if (original.envPassword === undefined) delete process.env.OPENCODE_SERVER_PASSWORD
  else process.env.OPENCODE_SERVER_PASSWORD = original.envPassword
  if (original.envUsername === undefined) delete process.env.OPENCODE_SERVER_USERNAME
  else process.env.OPENCODE_SERVER_USERNAME = original.envUsername
  await disposeAllInstances()
  await resetDatabase()
})

async function startListener(socket?: string) {
  Flag.OPENCODE_SERVER_PASSWORD = "bridge-secret"
  Flag.OPENCODE_SERVER_USERNAME = "opencode"
  process.env.OPENCODE_SERVER_PASSWORD = "bridge-secret"
  process.env.OPENCODE_SERVER_USERNAME = "opencode"
  return Server.listen({ hostname: "127.0.0.1", port: 0, socket })
}

function stop(listener: Awaited<ReturnType<typeof startListener>>, label: string) {
  return withTimeout(listener.stop(true), 10_000, label)
}

function requestThroughSocket(socketPath: string, target: string) {
  return withTimeout(
    new Promise<string>((resolve, reject) => {
      const socket = net.connect(socketPath)
      let data = ""
      socket.on("connect", () => socket.write(`GET ${target} HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n`))
      socket.on("data", (chunk) => {
        data += String(chunk)
        if (data.includes("\r\n\r\n") && !data.includes("HTTP/1.1 100")) return resolve(data)
        if (data.includes("HTTP/1.1") && data.split("\r\n\r\n")[1] !== undefined) {
          const headers = data.split("\r\n\r\n")[0]
          const length = Number(headers.match(/content-length: (\d+)/i)?.[1] ?? 0)
          const body = data.split("\r\n\r\n").slice(1).join("\r\n\r\n")
          if (body.length >= length) resolve(data)
        }
      })
      socket.on("error", reject)
    }),
    5_000,
    "timed out waiting for HTTP response over the unix socket bridge",
  )
}

describe("Server socket bridge", () => {
  test("pipes HTTP requests from the unix socket to the TCP listener", async () => {
    await using tmp = await tmpdir({ config: { formatter: false, lsp: false } })
    const socketPath = `${tmp.path}/opencode.sock`
    const listener = await startListener(socketPath)
    try {
      expect(listener.socket).toBe(socketPath)
      const response = await requestThroughSocket(socketPath, "/global/health")
      expect(response).toContain("HTTP/1.1")
    } finally {
      await stop(listener, "timed out cleaning up socket bridge listener").catch(() => undefined)
    }
    expect(await Bun.file(socketPath).exists()).toBe(false)
  })

  test("fails loudly when the socket path cannot be listened on", async () => {
    await using tmp = await tmpdir({ config: { formatter: false, lsp: false } })
    const badSocketPath = `${tmp.path}/missing-directory/opencode.sock`
    await expect(startListener(badSocketPath)).rejects.toThrow()
  })
})
