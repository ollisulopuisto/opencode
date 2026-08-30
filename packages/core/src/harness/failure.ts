export * as HarnessFailure from "./failure"

export type FailureType =
  | "BUILD_FAILURE"
  | "TYPE_FAILURE"
  | "TEST_FAILURE"
  | "LINT_FAILURE"
  | "RUNTIME_FAILURE"
  | "IMPORT_FAILURE"
  | "DEPENDENCY_FAILURE"
  | "ENVIRONMENT_FAILURE"
  | "GIT_FAILURE"
  | "TIMEOUT"
  | "PERMISSION_FAILURE"
  | "MERGE_CONFLICT"
  | "LOOP_DETECTED"
  | "SCOPE_EXPANSION"
  | "UNKNOWN"

export interface FailureDiagnosis {
  readonly type: FailureType
  readonly rawMessage: string
  readonly rootCauseSummary: string
  readonly suggestedAction: "RETRY_WITH_NEW_HYPOTHESIS" | "RUN_DIAGNOSTIC_COMMAND" | "ESCALATE_SUPERVISOR" | "ROLLBACK"
  readonly attemptsOnCurrentHypothesis: number
  readonly maxAttemptsAllowed: number
}

export class FailureClassifier {
  static classify(errorText: string, exitCode?: number): FailureType {
    const text = errorText.toLowerCase()

    if (/type\s*error|cannot find name|ts\d{4}|type '.*' is not assignable/i.test(text)) {
      return "TYPE_FAILURE"
    }
    if (/assertionerror|expect\(.*received|tests? failed|failing test/i.test(text)) {
      return "TEST_FAILURE"
    }
    if (/syntaxerror|compilation error|build failed|cannot compile|failed to parse/i.test(text)) {
      return "BUILD_FAILURE"
    }
    if (/linter error|eslint|ruff|prettier|style error/i.test(text)) {
      return "LINT_FAILURE"
    }
    if (/cannot find module|modulenotfounderror|no module named|import.*failed/i.test(text)) {
      return "IMPORT_FAILURE"
    }
    if (/package.*not found|npm err|bun install failed|missing dependency/i.test(text)) {
      return "DEPENDENCY_FAILURE"
    }
    if (/timed out|timeout exceeded|execution timed out/i.test(text)) {
      return "TIMEOUT"
    }
    if (/permission denied|eacces|eperm|operation not permitted/i.test(text)) {
      return "PERMISSION_FAILURE"
    }
    if (/merge conflict|conflict in|automatic merge failed/i.test(text)) {
      return "MERGE_CONFLICT"
    }
    if (/loop detected|oscillating edits|duplicate tool calls/i.test(text)) {
      return "LOOP_DETECTED"
    }
    if (/change budget exceeded|outside write set/i.test(text)) {
      return "SCOPE_EXPANSION"
    }

    return exitCode !== 0 && exitCode !== undefined ? "RUNTIME_FAILURE" : "UNKNOWN"
  }

  static diagnose(
    errorText: string,
    currentHypothesisAttempts: number,
    totalRecoveries: number,
  ): FailureDiagnosis {
    const type = this.classify(errorText)
    const maxAttempts = type === "TIMEOUT" || type === "DEPENDENCY_FAILURE" ? 3 : 2

    let suggestedAction: FailureDiagnosis["suggestedAction"] = "RETRY_WITH_NEW_HYPOTHESIS"
    if (currentHypothesisAttempts >= maxAttempts) {
      suggestedAction = totalRecoveries >= 3 ? "ESCALATE_SUPERVISOR" : "ROLLBACK"
    }

    const firstLine = errorText.split("\n").filter((l) => l.trim().length > 0)[0] ?? "Unknown failure"
    const rootCauseSummary = `[${type}] ${firstLine.slice(0, 120)}`

    return {
      type,
      rawMessage: errorText,
      rootCauseSummary,
      suggestedAction,
      attemptsOnCurrentHypothesis: currentHypothesisAttempts,
      maxAttemptsAllowed: maxAttempts,
    }
  }

  static formatRecoveryPrompt(
    diagnosis: FailureDiagnosis,
    previousHypotheses: readonly string[],
  ): string {
    return [
      "## ⚠️ VERIFICATION FAILURE INTERCEPTED",
      "",
      `**Failure Type:** \`${diagnosis.type}\``,
      `**Summary:** ${diagnosis.rootCauseSummary}`,
      `**Hypothesis Attempts:** ${diagnosis.attemptsOnCurrentHypothesis} / ${diagnosis.maxAttemptsAllowed}`,
      "",
      "### Previous Disproven Hypotheses:",
      previousHypotheses.length > 0
        ? previousHypotheses.map((h, i) => `${i + 1}. ${h}`).join("\n")
        : "None recorded.",
      "",
      "### Required Recovery Protocol:",
      "1. **STOP**: Do not repeat the exact same edit or command.",
      "2. **DIAGNOSE**: State what specific assumption was proven false by the error above.",
      "3. **NEW HYPOTHESIS**: Formulate a fundamentally different hypothesis before editing files.",
      "4. **VERIFY**: Run targeted tests to confirm the fix before claiming completion.",
    ].join("\n")
  }
}
