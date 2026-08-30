import { describe, expect, test } from "bun:test"
import { timestamp } from "../../src/util/locale"

describe("util.locale.timestamp", () => {
  test("formats epoch millis as YYYY-MM-DD HH:mm:ss in local time", () => {
    expect(timestamp(new Date(2025, 0, 15, 9, 5, 3).getTime())).toBe("2025-01-15 09:05:03")
    expect(timestamp(new Date(2025, 11, 31, 23, 59, 59).getTime())).toBe("2025-12-31 23:59:59")
    expect(timestamp(new Date(2026, 5, 1, 0, 0, 0).getTime())).toBe("2026-06-01 00:00:00")
  })

  test("pads single digit date and time components", () => {
    expect(timestamp(new Date(2026, 2, 4, 7, 8, 9).getTime())).toBe("2026-03-04 07:08:09")
  })

  test("returns empty string for invalid input", () => {
    expect(timestamp(NaN)).toBe("")
  })
})
