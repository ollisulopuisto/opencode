import { describe, expect, it } from "bun:test"
import { LoopDetector } from "../src/loop-detector"

describe("LoopDetector", () => {
  it("allows non-repetitive tool calls", () => {
    const detector = new LoopDetector()
    const res1 = detector.record({
      id: "1",
      tool: "read",
      args: { path: "a.ts" },
      status: "completed",
      timestamp: 100,
    })
    expect(res1.loopDetected).toBe(false)

    const res2 = detector.record({
      id: "2",
      tool: "read",
      args: { path: "b.ts" },
      status: "completed",
      timestamp: 200,
    })
    expect(res2.loopDetected).toBe(false)
  })

  it("detects consecutive duplicate tool calls", () => {
    const detector = new LoopDetector({ maxIdenticalCalls: 2 })
    detector.record({
      id: "1",
      tool: "edit",
      args: { path: "a.ts", content: "foo" },
      status: "completed",
      timestamp: 100,
    })
    detector.record({
      id: "2",
      tool: "edit",
      args: { path: "a.ts", content: "foo" },
      status: "completed",
      timestamp: 200,
    })

    const res3 = detector.record({
      id: "3",
      tool: "edit",
      args: { path: "a.ts", content: "foo" },
      status: "completed",
      timestamp: 300,
    })

    expect(res3.loopDetected).toBe(true)
    expect(res3.loopType).toBe("REPEATED_TOOL_CALL")
    expect(res3.recommendedAction).toBe("HALT_AND_RECOVER")
  })

  it("detects oscillating file edits", () => {
    const detector = new LoopDetector()
    detector.record({
      id: "1",
      tool: "edit",
      args: { path: "a.ts", content: "state_A" },
      status: "completed",
      timestamp: 100,
    })
    detector.record({
      id: "2",
      tool: "edit",
      args: { path: "a.ts", content: "state_B" },
      status: "completed",
      timestamp: 200,
    })
    const res3 = detector.record({
      id: "3",
      tool: "edit",
      args: { path: "a.ts", content: "state_A" },
      status: "completed",
      timestamp: 300,
    })

    expect(res3.loopDetected).toBe(true)
    expect(res3.loopType).toBe("OSCILLATING_EDIT")
  })

  it("detects repeated identical failure messages", () => {
    const detector = new LoopDetector({ maxIdenticalFailures: 2 })
    detector.record({
      id: "1",
      tool: "bash",
      args: { command: "test" },
      output: "TypeError: cannot read properties of undefined (reading 'foo')",
      status: "error",
      timestamp: 100,
    })
    detector.record({
      id: "2",
      tool: "bash",
      args: { command: "test" },
      output: "TypeError: cannot read properties of undefined (reading 'foo')",
      status: "error",
      timestamp: 200,
    })
    const res3 = detector.record({
      id: "3",
      tool: "bash",
      args: { command: "test" },
      output: "TypeError: cannot read properties of undefined (reading 'foo')",
      status: "error",
      timestamp: 300,
    })

    expect(res3.loopDetected).toBe(true)
    expect(res3.loopType).toBe("REPEATED_FAILURE")
  })
})
