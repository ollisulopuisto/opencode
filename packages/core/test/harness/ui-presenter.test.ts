import { describe, expect, it } from "bun:test"
import { TaskStateMachine } from "@opencode-ai/core/harness/state"
import { HarnessUiPresenter } from "@opencode-ai/core/harness/ui-presenter"

describe("HarnessUiPresenter", () => {
  it("formats multi-tier verification gates accurately", () => {
    const sm = new TaskStateMachine("task-1", "Add timestamp helper")
    sm.recordTestResult({ name: "Tier 0 Static: bun run typecheck", passed: true, durationMs: 150 })
    sm.recordTestResult({ name: "Tier 1 Targeted: test/helper.test.ts", passed: true, durationMs: 80 })
    sm.recordTestResult({ name: "Tier 2 Regression: bun test", passed: false, durationMs: 300, output: "AssertionError: expected true to be false" })

    const gates = HarnessUiPresenter.presentVerificationGates(sm.snapshot)
    expect(gates.tier0.status).toBe("passed")
    expect(gates.tier0.durationMs).toBe(150)

    expect(gates.tier1.status).toBe("passed")
    expect(gates.tier1.durationMs).toBe(80)

    expect(gates.tier2.status).toBe("failed")
    expect(gates.tier2.diagnostics).toContain("AssertionError")

    expect(gates.allPassed).toBe(false)
  })

  it("computes plan progress and work-unit statuses", () => {
    const sm = new TaskStateMachine("task-2", "Refactor auth middleware")
    sm.setPlan([
      {
        id: "wu_1",
        title: "Create schema",
        objective: "Define auth schema",
        writeSet: ["src/auth.ts"],
        relevantFiles: [],
        dependencies: [],
        status: "verified",
      },
      {
        id: "wu_2",
        title: "Update middleware",
        objective: "Apply schema to middleware",
        writeSet: ["src/middleware.ts"],
        relevantFiles: [],
        dependencies: ["wu_1"],
        status: "in_progress",
      },
      {
        id: "wu_3",
        title: "Add tests",
        objective: "Unit tests",
        writeSet: ["test/auth.test.ts"],
        relevantFiles: [],
        dependencies: ["wu_2"],
        status: "pending",
      },
    ])
    sm.setActiveWorkUnit("wu_2")

    const plan = HarnessUiPresenter.presentPlanProgress(sm.snapshot)
    expect(plan.totalUnits).toBe(3)
    expect(plan.completedUnits).toBe(1)
    expect(plan.percentage).toBe(33)
    expect(plan.activeUnit?.id).toBe("wu_2")
  })

  it("evaluates change budget and bounds in real time", () => {
    const sm = new TaskStateMachine("task-3", "Fix CSS styling")
    sm.recordFilesChanged(["src/app.css", "src/button.css"], 80, 20)

    const budget = HarnessUiPresenter.presentBudget(sm.snapshot, {
      maxFiles: 3,
      maxLines: 200,
    })

    expect(budget.filesChangedCount).toBe(2)
    expect(budget.totalLinesModified).toBe(100)
    expect(budget.isExceeded).toBe(false)
    expect(budget.percentageOfBudget).toBe(50)
  })

  it("extracts active supervisory directives and banned hypotheses", () => {
    const sm = new TaskStateMachine("task-4", "Fix race condition")
    sm.setHypothesis("Use Mutex lock around cache access")
    sm.recordFailure("LOOP_DETECTED", "Repeated edit calls", 4, "Oscillating between lock and atomics")
    sm.recordDecision("Supervisory Directive: Use Mutex lock. Do not revert to atomics.")

    const supervisor = HarnessUiPresenter.presentSupervisor(sm.snapshot, [
      "Use atomics for lock-free cache (failed)",
    ])

    expect(supervisor.activeHypothesis).toBe("Use Mutex lock around cache access")
    expect(supervisor.bannedHypotheses.length).toBe(1)
    expect(supervisor.hasActiveDirective).toBe(true)
    expect(supervisor.activeDirective).toContain("Use Mutex lock")
  })

  it("synthesizes one-click CalVer commit draft when verified", () => {
    const sm = new TaskStateMachine("task-5", "Add timestamp helper")
    sm.recordFilesChanged(["packages/core/src/time.ts"], 25, 0)
    sm.recordTestResult({ name: "Tier 0: typecheck", passed: true })
    sm.recordTestResult({ name: "Tier 1: time.test.ts", passed: true })
    sm.recordTestResult({ name: "Tier 2: full suite", passed: true })

    const draft = HarnessUiPresenter.presentCommitDraft(sm.snapshot, {
      commitCount: 15,
      date: new Date("2026-08-30"),
    })

    expect(draft.readyToCommit).toBe(true)
    expect(draft.calverVersion).toBe("v26.08.30.15")
    expect(draft.commitTitle).toBe("feat(core): add timestamp helper")
  })

  it("handles null, undefined, or empty state without crashing", () => {
    const gates = HarnessUiPresenter.presentVerificationGates(undefined)
    expect(gates.tier0.status).toBe("pending")
    expect(gates.tier1.status).toBe("pending")
    expect(gates.tier2.status).toBe("pending")
    expect(gates.allPassed).toBe(false)

    const plan = HarnessUiPresenter.presentPlanProgress(null)
    expect(plan.totalUnits).toBe(0)
    expect(plan.completedUnits).toBe(0)

    const budget = HarnessUiPresenter.presentBudget(undefined)
    expect(budget.filesChangedCount).toBe(0)
    expect(budget.isExceeded).toBe(false)

    const supervisor = HarnessUiPresenter.presentSupervisor(null)
    expect(supervisor.activeHypothesis).toBe("")
    expect(supervisor.hasActiveDirective).toBe(false)

    const draft = HarnessUiPresenter.presentCommitDraft(undefined)
    expect(draft.readyToCommit).toBe(false)
  })
})
