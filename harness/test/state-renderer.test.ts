import { describe, it, expect } from "bun:test"
import { TaskStateMachine } from "../src/state"
import { TaskStateRenderer } from "../src/state-renderer"

describe("TaskStateRenderer", () => {
  it("renders full markdown structure with all critical sections", () => {
    const sm = new TaskStateMachine("task-001", "Implement caching layer", ["Must use Redis", "No breaking changes"])
    sm.setHypothesis("Redis cache with 60s TTL")
    sm.recordFileMutation("src/cache.ts", 30, 2)
    sm.recordTestResult("bun test", true, 35)
    sm.recordFailure("TYPE_FAILURE", "Missing type definition for RedisClient", 1, "TS2304")
    sm.addWorkUnit({
      id: "wu-cache",
      title: "Cache implementation",
      objective: "Build Redis client wrapper",
      writeSet: ["src/cache.ts"],
      relevantFiles: ["src/cache.ts", "src/types.ts"],
      dependencies: [],
    })
    sm.setActiveWorkUnit("wu-cache")

    const md = TaskStateRenderer.render(sm.snapshot, { mode: "full" })

    expect(md).toContain("# Task Execution State: [task-001]")
    expect(md).toContain("## 1. Invariant Constraints")
    expect(md).toContain("Must use Redis")
    expect(md).toContain("## 2. Verified Facts & Verification Results")
    expect(md).toContain("✅ PASS: `bun test`")
    expect(md).toContain("## 3. Work Units & Scope")
    expect(md).toContain("Cache implementation")
    expect(md).toContain("## 4. File Mutations & Change Budget")
    expect(md).toContain("`src/cache.ts`")
    expect(md).toContain("## 5. Working Hypotheses & Architectural Decisions")
    expect(md).toContain("Redis cache with 60s TTL")
    expect(md).toContain("## 6. Failure Log & Disproven Approaches")
    expect(md).toContain("Missing type definition for RedisClient")
  })

  it("renders high-signal context prompt format for model injection", () => {
    const sm = new TaskStateMachine("task-002", "Fix race condition", ["Do not delete mutex"])
    sm.setHypothesis("Wrap counter in atomic mutex")
    sm.recordFileMutation("src/counter.ts", 5, 2)
    sm.recordTestResult("test:unit", true, 12)

    const contextPrompt = TaskStateRenderer.render(sm.snapshot, { mode: "context_prompt" })

    expect(contextPrompt).toContain("=== TASK EXECUTION CONTEXT ===")
    expect(contextPrompt).toContain("Objective: Fix race condition")
    expect(contextPrompt).toContain("Active Hypothesis: Wrap counter in atomic mutex")
    expect(contextPrompt).toContain("Constraints:")
    expect(contextPrompt).toContain("Do not delete mutex")
    expect(contextPrompt).toContain("Verified Passed Checks: test:unit")
    expect(contextPrompt).toContain("==============================")
  })

  it("renders compact single-line representation", () => {
    const sm = new TaskStateMachine("task-003", "Compact test")
    sm.recordFileMutation("index.ts", 10, 0)
    sm.recordTestResult("test", true)

    const compact = TaskStateRenderer.render(sm.snapshot, { mode: "compact" })
    expect(compact).toContain("[Task task-003 | State: UNDERSTAND | Files: 1 (+10/-0) | Tests Passed: 1 | Failures: 0 | Active Unit: none]")
  })
})
