import { describe, expect, it } from "bun:test"
import { FailureClassifier } from "../src/failure"

describe("FailureClassifier", () => {
  it("classifies standard failure types accurately", () => {
    expect(
      FailureClassifier.classify("error TS2322: Type 'string' is not assignable to type 'number'")
    ).toBe("TYPE_FAILURE")

    expect(
      FailureClassifier.classify("AssertionError: expected true to equal false")
    ).toBe("TEST_FAILURE")

    expect(
      FailureClassifier.classify("SyntaxError: Unexpected token '{'")
    ).toBe("BUILD_FAILURE")

    expect(
      FailureClassifier.classify("Cannot find module './missing'")
    ).toBe("IMPORT_FAILURE")

    expect(
      FailureClassifier.classify("Execution timed out after 60000ms")
    ).toBe("TIMEOUT")

    expect(
      FailureClassifier.classify("EACCES: permission denied, open '/etc/passwd'")
    ).toBe("PERMISSION_FAILURE")
  })

  it("suggests retry with new hypothesis for first failure", () => {
    const diagnosis = FailureClassifier.diagnose(
      "AssertionError: expected 404 to equal 200",
      1,
      1
    )
    expect(diagnosis.type).toBe("TEST_FAILURE")
    expect(diagnosis.suggestedAction).toBe("RETRY_WITH_NEW_HYPOTHESIS")
  })

  it("suggests escalation or rollback after exceeding max attempts", () => {
    const diagnosis = FailureClassifier.diagnose(
      "AssertionError: expected 404 to equal 200",
      3,
      3
    )
    expect(diagnosis.suggestedAction).toBe("ESCALATE_TO_GEMINI")
  })

  it("generates structured recovery prompt with hypothesis shifting", () => {
    const diagnosis = FailureClassifier.diagnose("TypeError: x is not a function", 1, 1)
    const prompt = FailureClassifier.buildRecoveryPrompt(diagnosis, "Fix null pointer", {
      failedHypotheses: ["Optional chaining on user object"],
    })
    expect(prompt).toContain("RECOVERY PROTOCOL TRIGGERED")
    expect(prompt).toContain("TYPE_FAILURE")
    expect(prompt).toContain("1. STOP")
    expect(prompt).toContain("3. HYPOTHESIS SHIFT")
    expect(prompt).toContain("PREVIOUS FAILED HYPOTHESES")
    expect(prompt).toContain("Optional chaining on user object")
  })

  it("injects anti-oscillation rules when loop is detected", () => {
    const diagnosis = FailureClassifier.diagnose("Loop detected: oscillating file edits", 2, 2)
    const prompt = FailureClassifier.buildRecoveryPrompt(diagnosis, "Fix type error", {
      antiOscillationAdvice: "Change the return type in interface definition instead of casting",
    })
    expect(prompt).toContain("ANTI-OSCILLATION ENFORCEMENT")
    expect(prompt).toContain("Change the return type in interface definition instead of casting")
  })
})
