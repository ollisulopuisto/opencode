/**
 * OpenCode Harness V5 - Compaction Preservation Guard
 * 
 * Protects structured task state against amnesia during context compaction.
 * Generates mandatory retention envelopes and reconciles post-compaction summaries.
 */

import type { TaskState } from "./state"
import { TaskStateRenderer } from "./state-renderer"

export interface CompactionEnvelope {
  header: string
  taskStateMarkdown: string
  disprovenApproaches: string[]
  verifiedFacts: string[]
  instructions: string
}

export class CompactionGuard {
  /**
   * Generates a compaction preservation block to be embedded into compaction prompts.
   */
  static generatePreservationEnvelope(state: TaskState): CompactionEnvelope {
    const verifiedFacts = state.testsRun
      .filter((t) => t.passed)
      .map((t) => `Verified passing check: ${t.name}`)

    const disprovenApproaches = state.failures.map(
      (f) => `Disproven Approach (Step ${f.step}): [${f.type}] ${f.message}`
    )

    const taskStateMarkdown = TaskStateRenderer.render(state, { mode: "full" })

    return {
      header: "CRITICAL: TASK STATE PRESERVATION ENVELOPE (DO NOT DISCARD OR ABBREVIATE)",
      taskStateMarkdown,
      disprovenApproaches,
      verifiedFacts,
      instructions: [
        "You are performing context compaction for an autonomous software engineering session.",
        "MANDATORY PRESERVATION RULES:",
        "1. You MUST retain all Verified Facts verbatim. Do not assume or re-test passing checks.",
        "2. You MUST retain all Disproven Approaches and Failures. The worker must NEVER repeat these strategies.",
        "3. You MUST retain all Invariant Constraints and the Active Work Unit Write-Set.",
        "4. Output the updated summary maintaining the exact structured task state format.",
      ].join("\n"),
    }
  }

  /**
   * Formats the preservation envelope into a single string for injection.
   */
  static formatForPrompt(state: TaskState): string {
    const envelope = this.generatePreservationEnvelope(state)
    return [
      `<!-- BEGIN TASK STATE PRESERVATION ENVELOPE -->`,
      envelope.header,
      "",
      envelope.instructions,
      "",
      envelope.taskStateMarkdown,
      `<!-- END TASK STATE PRESERVATION ENVELOPE -->`,
    ].join("\n")
  }

  /**
   * Checks whether a given compaction summary retained essential facts and constraints.
   */
  static auditPreservation(state: TaskState, summaryText: string): { intact: boolean; missingFacts: string[]; missingConstraints: string[] } {
    const missingConstraints = state.constraints.filter(
      (c) => !summaryText.toLowerCase().includes(c.toLowerCase())
    )

    const missingFacts: string[] = []
    for (const test of state.testsRun.filter((t) => t.passed)) {
      if (!summaryText.includes(test.name)) {
        missingFacts.push(`Passing test check '${test.name}' not found in summary`)
      }
    }

    return {
      intact: missingConstraints.length === 0 && missingFacts.length === 0,
      missingFacts,
      missingConstraints,
    }
  }
}
