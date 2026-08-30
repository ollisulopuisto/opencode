import { describe, expect, it } from "bun:test"
import { GitLifecycleEngine } from "../src/git-lifecycle"
import { TaskStateMachine } from "../src/state"

describe("GitLifecycleEngine", () => {
  it("computes accurate CalVer string from date and commit count", () => {
    const fixedDate = new Date("2026-08-30T12:00:00Z")
    const calver = GitLifecycleEngine.computeCalVer(fixedDate, 15636)
    expect(calver).toBe("v26.08.30.15636")
  })

  it("infers conventional commit types and scopes accurately", () => {
    expect(GitLifecycleEngine.inferCommitType("Fix race condition in store", ["packages/core/store.ts"])).toBe("fix")
    expect(GitLifecycleEngine.inferCommitType("Implement multi-tier verifier", ["harness/src/verifier.ts"])).toBe("feat")
    expect(GitLifecycleEngine.inferCommitType("Refactor session runner loops", ["packages/opencode/runner.ts"])).toBe("refactor")

    expect(GitLifecycleEngine.inferScope(["harness/src/runner.ts", "harness/src/state.ts"])).toBe("harness")
    expect(GitLifecycleEngine.inferScope(["packages/core/src/project.ts"])).toBe("core")
    expect(GitLifecycleEngine.inferScope(["packages/core/src/project.ts", "harness/src/runner.ts"])).toBeUndefined()
  })

  it("synthesizes conventional commit message with body and verification metadata", () => {
    const sm = new TaskStateMachine("task-1", "Fix database pool leak in session store")
    sm.recordFileMutation("packages/core/src/db.ts", 12, 4)
    sm.addWorkUnit({ id: "u-1", title: "Close idle connections", writeSet: ["packages/core/src/db.ts"] })

    const commit = GitLifecycleEngine.synthesizeCommit({
      taskState: sm.snapshot,
      commitCount: 15636,
      currentDate: new Date("2026-08-30T12:00:00Z"),
      verification: {
        correct: true,
        confidence: 1.0,
        diagnostics: [],
        tierResults: [
          { name: "Tier 1", passed: true, durationMs: 120, output: "ok" },
          { name: "Tier 2", passed: true, durationMs: 450, output: "ok" },
        ],
      },
    })

    expect(commit.type).toBe("fix")
    expect(commit.scope).toBe("core")
    expect(commit.fullMessage).toContain("fix(core): database pool leak in session store")
    expect(commit.fullMessage).toContain("Close idle connections")
    expect(commit.fullMessage).toContain("Modified files:")
    expect(commit.fullMessage).toContain("packages/core/src/db.ts")
    expect(commit.fullMessage).toContain("Verification: Passed all 2 tiers with 100% confidence.")
    expect(commit.fullMessage).toContain("CalVer: v26.08.30.15636")
  })

  it("synthesizes structured Pull Request markdown description", () => {
    const sm = new TaskStateMachine("task-2", "Add adaptive reasoning tuner for multi-lane harness")
    sm.recordFileMutation("harness/src/reasoning-tuner.ts", 80, 0)
    sm.addWorkUnit({ id: "u-2", title: "Compute reasoning effort by complexity", writeSet: ["harness/src/reasoning-tuner.ts"] })

    const pr = GitLifecycleEngine.synthesizePullRequest({
      taskState: sm.snapshot,
      calver: "v26.08.30.15636",
      verification: {
        correct: true,
        confidence: 1.0,
        diagnostics: [],
        tierResults: [
          { name: "Unit Tests", passed: true, durationMs: 250, output: "pass" },
          { name: "Typecheck", passed: true, durationMs: 800, output: "pass" },
        ],
      },
    })

    expect(pr.title).toContain("feat(harness): adaptive reasoning tuner for multi-lane harness")
    expect(pr.body).toContain("## Summary")
    expect(pr.body).toContain("## Completed Work Units")
    expect(pr.body).toContain("## Verification Evidence")
    expect(pr.body).toContain("Target CalVer:** `v26.08.30.15636`")
  })
})
