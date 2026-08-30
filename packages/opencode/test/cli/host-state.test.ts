import { describe, expect, test } from "bun:test"
import { readFile, rm } from "node:fs/promises"
import { tmpdir } from "../fixture/fixture"
import { HostState } from "../../src/cli/host-state"

describe("HostState", () => {
  test("round-trips a record", async () => {
    await using tmp = await tmpdir()
    const record = { port: 4096, password: "secret", pid: 123, startedAt: 456 }
    await HostState.write(record, tmp.path)
    expect(await HostState.read(tmp.path)).toEqual(record)
  })

  test("round-trips a socket record", async () => {
    await using tmp = await tmpdir()
    const record = { port: 0, socket: "/tmp/opencode.sock", pid: 1, startedAt: 2 }
    await HostState.write(record, tmp.path)
    expect(await HostState.read(tmp.path)).toEqual(record)
  })

  test("read returns undefined when no record exists", async () => {
    await using tmp = await tmpdir()
    expect(await HostState.read(tmp.path)).toBeUndefined()
  })

  test("read returns undefined for corrupt content", async () => {
    await using tmp = await tmpdir()
    await Bun.write(HostState.statePath(tmp.path), "{not json")
    expect(await HostState.read(tmp.path)).toBeUndefined()
  })

  test("read returns undefined for a record missing required fields", async () => {
    await using tmp = await tmpdir()
    await Bun.write(HostState.statePath(tmp.path), JSON.stringify({ password: "x" }))
    expect(await HostState.read(tmp.path)).toBeUndefined()
  })

  test("write creates the state directory if needed and restricts permissions", async () => {
    await using tmp = await tmpdir()
    const nested = `${tmp.path}/state`
    await HostState.write({ port: 1, pid: 2, startedAt: 3 }, nested)
    expect(await HostState.read(nested)).toEqual({ port: 1, pid: 2, startedAt: 3 })
    const mode = (await Bun.file(HostState.statePath(nested)).stat()).mode & 0o777
    expect(mode).toBe(0o600)
  })

  test("clear removes the record", async () => {
    await using tmp = await tmpdir()
    await HostState.write({ port: 1, pid: 2, startedAt: 3 }, tmp.path)
    await HostState.clear(tmp.path)
    expect(await HostState.read(tmp.path)).toBeUndefined()
  })

  test("clear succeeds when no record exists", async () => {
    await using tmp = await tmpdir()
    await HostState.clear(tmp.path)
    expect(await rm(HostState.statePath(tmp.path), { force: true }).then(() => true)).toBe(true)
    expect(await readFile(HostState.statePath(tmp.path)).catch(() => undefined)).toBeUndefined()
  })

  test("probe returns true when the server answers", async () => {
    const server = Bun.serve({ port: 0, fetch: () => new Response("ok") })
    try {
      expect(await HostState.probe(`http://localhost:${server.port}`)).toBe(true)
    } finally {
      await server.stop(true)
    }
  })

  test("probe returns true even on unauthorized responses", async () => {
    const server = Bun.serve({ port: 0, fetch: () => new Response("nope", { status: 401 }) })
    try {
      expect(await HostState.probe(`http://localhost:${server.port}`)).toBe(true)
    } finally {
      await server.stop(true)
    }
  })

  test("probe returns false when nothing is listening", async () => {
    const server = Bun.serve({ port: 0, fetch: () => new Response("ok") })
    const port = server.port
    await server.stop(true)
    expect(await HostState.probe(`http://localhost:${port}`, undefined, 1000)).toBe(false)
  })
})
