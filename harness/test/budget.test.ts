import { describe, expect, it } from "bun:test"
import { ChangeBudgetGuard } from "../src/budget"

describe("ChangeBudgetGuard", () => {
  it("allows file mutations within whitelist and ceilings", () => {
    const guard = new ChangeBudgetGuard({
      maxFiles: 3,
      maxLinesAdded: 100,
      maxLinesDeleted: 50,
      writeSet: ["src/auth.ts", "src/user.ts"],
    })

    const res1 = guard.recordMutation("src/auth.ts", 20, 5)
    expect(res1.allowed).toBe(true)
    expect(res1.violations.length).toBe(0)
  })

  it("blocks file mutations outside assigned write set", () => {
    const guard = new ChangeBudgetGuard({
      maxFiles: 3,
      writeSet: ["src/auth.ts"],
    })

    const res = guard.recordMutation("src/database.ts", 10, 0)
    expect(res.allowed).toBe(false)
    expect(res.violations.some((v) => v.includes("outside assigned write set"))).toBe(true)
    expect(res.recommendedAction).toBe("HALT_FOR_REPLAN")
  })

  it("flags violation when file count budget is exceeded", () => {
    const guard = new ChangeBudgetGuard({
      maxFiles: 2,
      writeSet: ["*"],
    })

    guard.recordMutation("a.ts", 5, 0)
    guard.recordMutation("b.ts", 5, 0)
    const res3 = guard.recordMutation("c.ts", 5, 0)

    expect(res3.allowed).toBe(false)
    expect(res3.violations.some((v) => v.includes("Max files budget exceeded"))).toBe(true)
  })

  it("flags violation when line addition budget is exceeded", () => {
    const guard = new ChangeBudgetGuard({
      maxFiles: 5,
      maxLinesAdded: 50,
      writeSet: ["*"],
    })

    const res = guard.recordMutation("a.ts", 60, 0)
    expect(res.allowed).toBe(false)
    expect(res.violations.some((v) => v.includes("Max lines added budget exceeded"))).toBe(true)
  })
})
