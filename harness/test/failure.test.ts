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

  it("generates structured recovery prompt", () => {
    const diagnosis = FailureClassifier.diagnose("TypeError: x is not a function", 1, 1)
    const prompt = FailureClassifier.buildRecoveryPrompt(diagnosis, "Fix null pointer")
    expect(prompt).toContain("RECOVERY PROTOCOL TRIGGERED")
    expect(prompt).toContain("TYPE_FAILURE")
    expect(prompt).toContain("1. STOP")
    expect(prompt).toContain("3. HYPOTHESIZE")
  })
})
