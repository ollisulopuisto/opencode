import { describe, expect, test } from "bun:test"
import net from "node:net"
import { resolveAttachTarget } from "../../src/cli/cmd/attach"
import { tmpdir } from "../fixture/fixture"

function listenSocket(socketPath: string) {
  return new Promise<net.Server>((resolve, reject) => {
    const server = net.createServer()
    server.once("error", reject)
    server.listen(socketPath, () => resolve(server))
  })
}

describe("resolveAttachTarget", () => {
  test("returns an explicit url untouched", async () => {
    expect(await resolveAttachTarget({ url: "http://localhost:1234" })).toBe("http://localhost:1234")
  })

  test("returns an explicit socket untouched", async () => {
    expect(await resolveAttachTarget({ socket: "/tmp/explicit.sock" })).toBe("/tmp/explicit.sock")
  })

  test("prefers a connectable default socket over the default url", async () => {
    await using tmp = await tmpdir()
    const socketPath = `${tmp.path}/live.sock`
    const server = await listenSocket(socketPath)
    try {
      expect(await resolveAttachTarget({ defaultSocket: socketPath })).toBe(socketPath)
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })

  test("falls back to the default url when the socket path is dead", async () => {
    await using tmp = await tmpdir()
    const socketPath = `${tmp.path}/dead.sock`
    await Bun.write(socketPath, "")
    expect(await resolveAttachTarget({ defaultSocket: socketPath })).toBe("http://127.0.0.1:8090")
  })

  test("warns when the default socket path exists but is dead", async () => {
    await using tmp = await tmpdir()
    const socketPath = `${tmp.path}/dead.sock`
    await Bun.write(socketPath, "")
    let output = ""
    // oxlint-disable-next-line typescript-eslint/unbound-method -- restored in finally after temporarily capturing stderr.
    const original = process.stderr.write
    process.stderr.write = ((chunk) => {
      output += String(chunk)
      return true
    }) as typeof process.stderr.write
    try {
      await resolveAttachTarget({ defaultSocket: socketPath })
    } finally {
      process.stderr.write = original
    }
    expect(output).toContain("refuses connections")
  })

  test("falls back to the default url when no socket file exists", async () => {
    await using tmp = await tmpdir()
    expect(await resolveAttachTarget({ defaultSocket: `${tmp.path}/absent.sock` })).toBe("http://127.0.0.1:8090")
  })
})
