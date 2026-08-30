import { describe, expect, test } from "bun:test"
import { HarnessUiPresenter } from "@opencode-ai/core/harness/ui-presenter"

describe("HarnessInspectorPanel Logic", () => {
  test("formats verification tiers and failure diagnostics correctly for web UI", () => {
    const taskState = {
      taskId: "task_web_1",
      objective: "Fix modal focus trapping",
      currentState: "VERIFY" as const,
      constraints: ["Maintain WCAG 2.1 AA"],
      decisions: ["Use aria-hidden for background elements"],
      workUnits: [
        {
          id: "wu_1",
          title: "Add focus trap listener",
          objective: "Trap focus inside modal",
          writeSet: ["packages/app/src/components/modal.tsx"],
          relevantFiles: [],
          dependencies: [],
          status: "verified" as const,
        },
      ],
      activeWorkUnitId: "wu_1",
      filesChanged: ["packages/app/src/components/modal.tsx"],
      linesAdded: 15,
      linesDeleted: 2,
      testsRun: [
        { name: "Tier 0: typecheck", passed: true, durationMs: 90 },
        { name: "Tier 1: modal.test.tsx", passed: true, durationMs: 40 },
        { name: "Tier 2: web regression", passed: true, durationMs: 250 },
      ],
      failures: [],
      currentHypothesis: "Keydown Tab/Shift+Tab interceptor inside modal container",
      remainingWork: [],
      knownUnknowns: [],
      history: [],
      supervisorInterventions: 0,
      modelTurns: 2,
    }

    const gates = HarnessUiPresenter.presentVerificationGates(taskState)
    expect(gates.allPassed).toBe(true)
    expect(gates.tier0.status).toBe("passed")
    expect(gates.tier1.status).toBe("passed")
    expect(gates.tier2.status).toBe("passed")

    const draft = HarnessUiPresenter.presentCommitDraft(taskState, {
      commitCount: 88,
      date: new Date("2026-08-30"),
    })
    expect(draft.readyToCommit).toBe(true)
    expect(draft.calverVersion).toBe("v26.08.30.88")
    expect(draft.commitTitle).toBe("fix(app): fix modal focus trapping")
  })
})
