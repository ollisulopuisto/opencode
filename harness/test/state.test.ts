import { describe, expect, it } from "bun:test"
import { TaskStateMachine } from "../src/state"

describe("TaskStateMachine", () => {
  it("initializes with UNDERSTAND state and initial history", () => {
    const sm = new TaskStateMachine("task-1", "Fix bug in auth")
    expect(sm.currentState).toBe("UNDERSTAND")
    expect(sm.snapshot.taskId).toBe("task-1")
    expect(sm.snapshot.objective).toBe("Fix bug in auth")
  })

  it("follows valid state transitions", () => {
    const sm = new TaskStateMachine("task-1", "Fix bug")
    expect(sm.transition("EXPLORE", "Need to explore repo").success).toBe(true)
    expect(sm.currentState).toBe("EXPLORE")

    expect(sm.transition("PLAN", "Planning fix").success).toBe(true)
    expect(sm.currentState).toBe("PLAN")

    expect(sm.transition("EXECUTE", "Executing fix").success).toBe(true)
    expect(sm.currentState).toBe("EXECUTE")

    expect(sm.transition("VERIFY", "Running tests").success).toBe(true)
    expect(sm.currentState).toBe("VERIFY")
  })

  it("blocks illegal transitions", () => {
    const sm = new TaskStateMachine("task-1", "Fix bug")
    const result = sm.transition("COMPLETE", "Direct jump to complete")
    expect(result.success).toBe(false)
    expect(result.error).toContain("Illegal state transition")
    expect(sm.currentState).toBe("UNDERSTAND")
  })

  it("prevents transitioning to COMPLETE if verification has not passed", () => {
    const sm = new TaskStateMachine("task-1", "Fix bug")
    sm.addWorkUnit({
      id: "u1",
      title: "Unit 1",
      objective: "Obj",
      writeSet: ["*"],
      relevantFiles: [],
      dependencies: [],
    })
    sm.transition("PLAN", "plan")
    sm.transition("EXECUTE", "exec")
    sm.transition("VERIFY", "verify")

    // Try to complete without test run
    const result = sm.transition("COMPLETE", "Done")
    expect(result.success).toBe(false)
    expect(result.error).toContain("verification gate has not passed")
  })

  it("allows transition to COMPLETE when verification passed and no unresolved failures exist", () => {
    const sm = new TaskStateMachine("task-1", "Fix bug")
    sm.transition("PLAN", "plan")
    sm.transition("EXECUTE", "exec")
    sm.transition("VERIFY", "verify")

    sm.recordTestResult("bun test", true, 120, "All tests passed")
    const result = sm.transition("COMPLETE", "Verification passed")
    expect(result.success).toBe(true)
    expect(sm.currentState).toBe("COMPLETE")
  })
})
