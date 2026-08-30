/**
 * OpenCode Harness V5.2 - Model Reasoning Effort Tuner
 * 
 * Dynamically computes optimal model reasoning effort (low, medium, high, highest)
 * based on task complexity, failure recovery depth, and model profile.
 */

import { type TaskComplexity } from "./classifier"
import { type ModelCapabilityProfile } from "./model-registry"

export type ReasoningEffort = "low" | "medium" | "high" | "highest"

export interface TunedReasoningConfig {
  effort: ReasoningEffort
  maxTokens?: number
  temperature?: number
  reasoningDirectives: string[]
  escalationRecommended: boolean
}

export class ReasoningTuner {
  /**
   * Computes the optimal reasoning effort and directives for a turn.
   */
  static compute(options: {
    complexity: TaskComplexity
    recoveryAttempts: number
    modelProfile?: ModelCapabilityProfile
    isRecoveryTurn?: boolean
  }): TunedReasoningConfig {
    const { complexity, recoveryAttempts, isRecoveryTurn } = options

    let effort: ReasoningEffort = "medium"
    const directives: string[] = []

    // 1. Base effort by task complexity (§24 of Master Design V5.2)
    switch (complexity) {
      case "trivial":
        effort = "low"
        directives.push("Fast execution: perform minimal targeted change directly.")
        break
      case "routine_implementation":
        effort = "medium"
        directives.push("Analyze affected module dependencies before editing.")
        break
      case "multi_file_feature":
        effort = "high"
        directives.push("Plan and order multi-file changes carefully. Update types and schemas first.")
        break
      case "architectural":
        effort = "high"
        directives.push("Strict architectural alignment: verify boundary contracts and invariants.")
        break
      case "difficult_debugging":
        effort = "highest"
        directives.push("Deep diagnostic analysis: formulate hypotheses from failure stack traces.")
        break
      default:
        effort = "medium"
    }

    // 2. Recovery elevation: escalate reasoning effort on failure turns
    if (isRecoveryTurn || recoveryAttempts > 0) {
      if (effort === "low") effort = "medium"
      else if (effort === "medium") effort = "high"
      else if (effort === "high") effort = "highest"

      directives.push(
        `Recovery turn (Attempt ${recoveryAttempts}): Re-evaluate assumptions. Do NOT repeat failed edits.`
      )
    }

    const escalationRecommended = recoveryAttempts >= 2 && effort === "highest"

    return {
      effort,
      temperature: effort === "highest" ? 0.2 : 0.4,
      reasoningDirectives: directives,
      escalationRecommended,
    }
  }

  /**
   * Formats reasoning directives for insertion into model system context.
   */
  static formatDirectives(config: TunedReasoningConfig): string {
    if (config.reasoningDirectives.length === 0) return ""

    return [
      `### REASONING & EXECUTION GUIDANCE (Effort: ${config.effort.toUpperCase()})`,
      ...config.reasoningDirectives.map((d) => `- ${d}`),
    ].join("\n")
  }
}
