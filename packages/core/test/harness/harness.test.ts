import { describe, expect, it } from "bun:test"
import { TaskStateMachine } from "@opencode-ai/core/harness/state"
import { LoopDetector } from "@opencode-ai/core/harness/loop-detector"
import { ChangeBudgetGuard } from "@opencode-ai/core/harness/budget"
import { TaskComplexityClassifier } from "@opencode-ai/core/harness/classifier"
import { FailureClassifier } from "@opencode-ai/core/harness/failure"
import { PlanValidator } from "@opencode-ai/core/harness/plan-validator"
import { ToolOutputNormalizer } from "@opencode-ai/core/harness/normalizer"
import { TestMapper } from "@opencode-ai/core/harness/test-mapper"
import { GitLifecycleEngine } from "@opencode-ai/core/harness/git-lifecycle"
import { ModelRouter } from "@opencode-ai/core/harness/model-router"

describe("Core Harness Governance", () => {
  it("governs task state transitions and prevents unverified completion", () => {
    const sm = new TaskStateMachine("task-1", "Fix off-by-one bug")
    expect(sm.currentState).toBe("UNDERSTAND")

    expect(sm.transition("EXECUTE", "Starting fix").success).toBe(true)
    expect(sm.currentState).toBe("EXECUTE")

    // Cannot transition directly to COMPLETE without verified test
    const unverifiedAttempt = sm.transition("COMPLETE", "Finished")
    expect(unverifiedAttempt.success).toBe(false)
    expect(unverifiedAttempt.error).toContain("verified passing test suite")

    // Record passing test
    sm.recordTestResult({ name: "unit.test.ts", passed: true })
    expect(sm.transition("COMPLETE", "Verified test pass").success).toBe(true)
    expect(sm.currentState).toBe("COMPLETE")
  })

  it("detects Step-2 loops on consecutive duplicate calls", () => {
    const detector = new LoopDetector({ maxIdenticalCalls: 2 })

    const call1 = detector.record({
      id: "call-1",
      tool: "read_file",
      args: { path: "src/index.ts" },
      status: "completed",
      timestamp: Date.now(),
    })
    expect(call1.loopDetected).toBe(false)

    const call2 = detector.record({
      id: "call-2",
      tool: "read_file",
      args: { path: "src/index.ts" },
      status: "completed",
      timestamp: Date.now(),
    })
    expect(call2.loopDetected).toBe(false)

    const call3 = detector.record({
      id: "call-3",
      tool: "read_file",
      args: { path: "src/index.ts" },
      status: "completed",
      timestamp: Date.now(),
    })
    expect(call3.loopDetected).toBe(true)
    expect(call3.loopType).toBe("REPEATED_TOOL_CALL")
  })

  it("enforces change budget boundaries and write-set whitelists", () => {
    const guard = new ChangeBudgetGuard({
      maxFiles: 2,
      writeSet: ["packages/core/*"],
    })

    const allowed = guard.recordMutation("packages/core/src/index.ts", 10, 2)
    expect(allowed.allowed).toBe(true)

    const disallowed = guard.recordMutation("packages/opencode/src/cli.ts", 50, 0)
    expect(disallowed.allowed).toBe(false)
    expect(disallowed.violations[0]).toContain("outside assigned write set")
  })

  it("classifies task complexity accurately", () => {
    const trivial = TaskComplexityClassifier.classify("Fix typo in error message")
    expect(trivial.complexity).toBe("TRIVIAL")

    const complex = TaskComplexityClassifier.classify("Implement multi-file schema and handler update")
    expect(complex.complexity).toBe("COMPLEX")
    expect(complex.requiresDecomposition).toBe(true)
  })

  it("diagnoses failures and produces structured recovery prompts", () => {
    const failureType = FailureClassifier.classify("TypeError: Cannot read properties of undefined")
    expect(failureType).toBe("TYPE_FAILURE")

    const diag = FailureClassifier.diagnose("TypeError: undefined is not an object", 1, 0)
    expect(diag.suggestedAction).toBe("RETRY_WITH_NEW_HYPOTHESIS")

    const prompt = FailureClassifier.formatRecoveryPrompt(diag, ["Hypothesis 1 was incorrect"])
    expect(prompt).toContain("VERIFICATION FAILURE INTERCEPTED")
  })

  it("validates execution DAGs and catches circular dependencies", () => {
    const invalidPlan = {
      objective: "Test DAG",
      rationale: "Testing",
      estimatedRisk: "low" as const,
      workUnits: [
        {
          id: "wu_1",
          title: "Unit 1",
          objective: "Obj 1",
          writeSet: ["a.ts"],
          relevantFiles: [],
          dependencies: ["wu_2"],
          status: "pending" as const,
        },
        {
          id: "wu_2",
          title: "Unit 2",
          objective: "Obj 2",
          writeSet: ["b.ts"],
          relevantFiles: [],
          dependencies: ["wu_1"],
          status: "pending" as const,
        },
      ],
    }

    const validation = PlanValidator.validate(invalidPlan)
    expect(validation.valid).toBe(false)
    expect(validation.errors[0]).toContain("Circular dependency cycle")
  })

  it("truncates massive tool outputs and extracts diagnostics", () => {
    const normalizer = new ToolOutputNormalizer({ maxLines: 10, maxBytes: 500 })
    const massiveText = Array.from({ length: 100 }, (_, i) => `src/foo.ts(${i},1): error TS2322: Type mismatch`).join("\n")

    const normalized = normalizer.normalize("tsc", massiveText)
    expect(normalized.isTruncated).toBe(true)
    expect(normalized.diagnostics.length).toBeGreaterThan(0)
    expect(normalized.summary).toContain("omitted")
  })

  it("synthesizes Conventional Commit messages with CalVer", () => {
    const sm = new TaskStateMachine("task-1", "Fix off-by-one bug in parseRange")
    sm.recordFilesChanged(["packages/core/src/parser.ts"], 5, 2)
    const commit = GitLifecycleEngine.synthesizeCommit({
      taskState: sm.snapshot,
      commitCount: 42,
      currentDate: new Date("2026-08-30"),
    })

    expect(commit.type).toBe("fix")
    expect(commit.scope).toBe("core")
    expect(commit.calver).toBe("v26.08.30.42")
    expect(commit.fullMessage).toContain("fix(core):")
  })

  it("routes models by role and cascades fallbacks on failure", () => {
    const router = new ModelRouter()
    const plannerModel = router.selectModelForRole("planner")
    expect(plannerModel).toBe("opencode-go/kimi-k2.6")

    const implementerModel = router.selectModelForRole("implementer")
    expect(implementerModel).toBe("opencode-go/glm-5.3-flash")

    const fallback = router.handleModelFailure("opencode-go/glm-5.3-flash", "429 Quota Exceeded")
    expect(fallback.substituted).toBe(true)
    expect(fallback.newModel).toBe("opencode-go/qwen3.8-max")
  })
})
