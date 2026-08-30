import { describe, expect, test } from "bun:test"
import { ClientTracker, Tracker } from "../src/client-tracker"

const tick = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

describe("Tracker", () => {
  test("counts connects and disconnects", () => {
    const tracker = new Tracker({ graceMs: 10, onIdle: () => {} })
    expect(tracker.count).toBe(0)
    tracker.connect()
    tracker.connect()
    expect(tracker.count).toBe(2)
    tracker.disconnect()
    expect(tracker.count).toBe(1)
    tracker.disconnect()
    expect(tracker.count).toBe(0)
  })

  test("disconnect floors at zero", () => {
    const tracker = new Tracker({ graceMs: 10, onIdle: () => {} })
    tracker.disconnect()
    expect(tracker.count).toBe(0)
  })

  test("fires onIdle once after the last client disconnects", async () => {
    let idle = 0
    new Tracker({ graceMs: 20, onIdle: () => idle++ })
    await tick(80)
    expect(idle).toBe(1)
  })

  test("does not fire while clients are connected", async () => {
    let idle = 0
    const tracker = new Tracker({ graceMs: 20, onIdle: () => idle++ })
    tracker.connect()
    await tick(80)
    expect(idle).toBe(0)
    tracker.disconnect()
    await tick(80)
    expect(idle).toBe(1)
  })

  test("reconnect cancels a pending idle callback", async () => {
    let idle = 0
    const tracker = new Tracker({ graceMs: 20, onIdle: () => idle++ })
    tracker.connect()
    tracker.disconnect()
    tracker.connect()
    await tick(80)
    expect(idle).toBe(0)
  })

  test("dispose cancels a pending idle callback", async () => {
    let idle = 0
    const tracker = new Tracker({ graceMs: 20, onIdle: () => idle++ })
    tracker.dispose()
    await tick(80)
    expect(idle).toBe(0)
  })

  test("suspend pauses the idle callback and resume rearms when idle", async () => {
    let idle = 0
    const tracker = new Tracker({ graceMs: 20, onIdle: () => idle++ })
    tracker.suspend()
    await tick(80)
    expect(idle).toBe(0)
    tracker.resume()
    await tick(80)
    expect(idle).toBe(1)
  })

  test("connections during suspend do not trigger onIdle until resume", async () => {
    let idle = 0
    const tracker = new Tracker({ graceMs: 20, onIdle: () => idle++ })
    tracker.suspend()
    tracker.connect()
    tracker.disconnect()
    await tick(80)
    expect(idle).toBe(0)
    tracker.resume()
    await tick(80)
    expect(idle).toBe(1)
  })

  test("resume with connected clients does not fire onIdle", async () => {
    let idle = 0
    const tracker = new Tracker({ graceMs: 20, onIdle: () => idle++ })
    tracker.suspend()
    tracker.connect()
    tracker.resume()
    await tick(80)
    expect(idle).toBe(0)
  })
})

describe("ClientTracker singleton", () => {
  test("configure replaces the previous tracker and disposes its timer", async () => {
    let first = 0
    let second = 0
    ClientTracker.configure({ graceMs: 20, onIdle: () => first++ })
    ClientTracker.connect()
    ClientTracker.configure({ graceMs: 20, onIdle: () => second++ })
    await tick(80)
    expect(first).toBe(0)
    expect(second).toBe(1)
  })

  test("connect and disconnect route through the configured tracker", () => {
    ClientTracker.configure({ graceMs: 10_000, onIdle: () => {} })
    ClientTracker.connect()
    expect(ClientTracker.count()).toBe(1)
    ClientTracker.disconnect()
    expect(ClientTracker.count()).toBe(0)
    ClientTracker.disconnect()
    expect(ClientTracker.count()).toBe(0)
  })

  test("count is zero when no tracker is configured", () => {
    ClientTracker.reset()
    expect(ClientTracker.count()).toBe(0)
    ClientTracker.connect()
    expect(ClientTracker.count()).toBe(0)
  })
})
