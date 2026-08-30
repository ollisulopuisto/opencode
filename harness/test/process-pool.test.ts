import { describe, expect, it } from "bun:test"
import { ProcessPoolManager } from "../src/process-pool"

describe("ProcessPoolManager", () => {
  it("executes tasks directly within concurrency limits", async () => {
    const pool = new ProcessPoolManager(2)
    const result = await pool.run(async () => {
      return 42
    })
    expect(result).toBe(42)
  })

  it("queues and drains tasks respecting max concurrency", async () => {
    const pool = new ProcessPoolManager(2)
    let activePeak = 0
    let currentActive = 0

    const makeTask = (delayMs: number) => async () => {
      currentActive++
      activePeak = Math.max(activePeak, currentActive)
      await new Promise((r) => setTimeout(r, delayMs))
      currentActive--
      return true
    }

    const tasks = [
      pool.run(makeTask(30)),
      pool.run(makeTask(30)),
      pool.run(makeTask(30)),
      pool.run(makeTask(30)),
    ]

    await Promise.all(tasks)
    expect(activePeak).toBeLessThanOrEqual(2)
  })

  it("enforces timeout on slow tasks", async () => {
    const pool = new ProcessPoolManager(1)
    const slowTask = pool.run(
      async () => {
        await new Promise((r) => setTimeout(r, 100))
        return "done"
      },
      20 // 20ms timeout
    )

    expect(slowTask).rejects.toThrow("Task timed out")
  })
})
