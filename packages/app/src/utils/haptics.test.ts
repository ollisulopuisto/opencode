import { describe, expect, test } from "bun:test"
import { handleServiceWorkerMessage, vibrate } from "./haptics"

describe("haptics", () => {
  test("invokes a short vibration when the browser supports it", () => {
    const calls: Array<number | number[]> = []
    const target = {
      vibrate: (pattern: number | number[]) => {
        calls.push(pattern)
        return true
      },
    }

    expect(vibrate(target)).toBe(true)
    expect(calls).toEqual([10])
  })

  test("does nothing when vibration is unavailable or denied", () => {
    expect(vibrate({})).toBe(false)
    expect(
      vibrate({
        vibrate: () => {
          throw new Error("denied")
        },
      }),
    ).toBe(false)
  })

  test("only responds to the push notification click message", () => {
    let count = 0
    const target = { vibrate: () => (count++, true) }

    expect(handleServiceWorkerMessage({ data: { type: "other" } }, target)).toBe(false)
    expect(handleServiceWorkerMessage({ data: { type: "opencode:push-click" } }, target)).toBe(true)
    expect(count).toBe(1)
  })
})
