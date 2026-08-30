/**
 * OpenCode Harness V5 - Task State Markdown Renderer
 * 
 * Generates high-density, structured Markdown representations of TaskState
 * for injection into system context, compaction summaries, and recovery prompts.
 */

import type { TaskState, WorkUnit, FailureRecord } from "./state"

export interface RenderOptions {
  mode?: "full" | "compact" | "context_prompt"
  includeHistory?: boolean
  maxFailures?: number
}

export class TaskStateRenderer {
  /**
   * Renders the complete task state into structured markdown.
   */
  static render(state: TaskState, options: RenderOptions = {}): string {
    const mode = options.mode ?? "full"

    if (mode === "compact") {
      return this.renderCompact(state)
    }

    if (mode === "context_prompt") {
      return this.renderContextPrompt(state)
    }

    return this.renderFull(state, options)
  }

  /**
   * Full markdown representation for state inspection and persistence archives.
   */
  private static renderFull(state: TaskState, options: RenderOptions): string {
    const lines: string[] = []

    lines.push(`# Task Execution State: [${state.taskId}]`)
    lines.push(`- **Status:** \`${state.currentState}\``)
    lines.push(`- **Objective:** ${state.objective}`)
    lines.push(`- **Qwen Turns:** ${state.qwenTurns} | **Gemini Interventions:** ${state.geminiInterventions}`)
    lines.push("")

    // 1. Constraints
    lines.push(`## 1. Invariant Constraints`)
    if (state.constraints.length === 0) {
      lines.push(`*None specified.*`)
    } else {
      for (const c of state.constraints) {
        lines.push(`- [x] ${c}`)
      }
    }
    lines.push("")

    // 2. Verified Facts & Tests
    lines.push(`## 2. Verified Facts & Verification Results`)
    if (state.testsRun.length === 0) {
      lines.push(`*No verification runs recorded yet.*`)
    } else {
      for (const test of state.testsRun) {
        const icon = test.passed ? "✅ PASS" : "❌ FAIL"
        const dur = test.durationMs ? ` (${test.durationMs}ms)` : ""
        lines.push(`- ${icon}: \`${test.name}\`${dur}`)
      }
    }
    lines.push("")

    // 3. Active Work Unit & Write Set
    lines.push(`## 3. Work Units & Scope`)
    if (state.workUnits.length === 0) {
      lines.push(`*No explicit work units decomposed.*`)
    } else {
      for (const unit of state.workUnits) {
        const active = unit.id === state.activeWorkUnitId ? " **[ACTIVE]**" : ""
        lines.push(`### Work Unit: ${unit.title} (${unit.status})${active}`)
        lines.push(`- **ID:** \`${unit.id}\``)
        lines.push(`- **Objective:** ${unit.objective}`)
        lines.push(`- **Write Set Whitelist:** ${unit.writeSet.length > 0 ? unit.writeSet.map((f) => `\`${f}\``).join(", ") : "*unrestricted*"}`)
        lines.push(`- **Relevant Files:** ${unit.relevantFiles.length > 0 ? unit.relevantFiles.map((f) => `\`${f}\``).join(", ") : "*none*"}`)
      }
    }
    lines.push("")

    // 4. File Mutations & Budget Consumption
    lines.push(`## 4. File Mutations & Change Budget`)
    lines.push(`- **Files Changed (${state.filesChanged.length}):** ${state.filesChanged.length > 0 ? state.filesChanged.map((f) => `\`${f}\``).join(", ") : "none"}`)
    lines.push(`- **Lines Delta:** +${state.linesAdded} / -${state.linesDeleted}`)
    lines.push("")

    // 5. Hypotheses & Decisions
    lines.push(`## 5. Working Hypotheses & Architectural Decisions`)
    lines.push(`- **Active Hypothesis:** ${state.currentHypothesis || "*No active hypothesis adopted.*"}`)
    if (state.decisions.length > 0) {
      lines.push(`- **Decisions Log:**`)
      for (const d of state.decisions) {
        lines.push(`  - ${d}`)
      }
    }
    lines.push("")

    // 6. Failures & Disproven Hypotheses
    lines.push(`## 6. Failure Log & Disproven Approaches`)
    if (state.failures.length === 0) {
      lines.push(`*No failures recorded.*`)
    } else {
      const maxF = options.maxFailures ?? 10
      const recent = state.failures.slice(-maxF)
      for (const f of recent) {
        const status = f.recovered ? "🟢 RECOVERED" : "🔴 UNRESOLVED"
        lines.push(`- [${status}] **${f.type}** (Step ${f.step}): ${f.message}`)
        if (f.context) {
          lines.push(`  - Context: \`${f.context}\``)
        }
      }
    }
    lines.push("")

    // 7. Remaining Work
    lines.push(`## 7. Remaining Work`)
    for (const r of state.remainingWork) {
      lines.push(`- [ ] ${r}`)
    }

    return lines.join("\n")
  }

  /**
   * High-signal compact rendering for context window injection.
   */
  private static renderContextPrompt(state: TaskState): string {
    const lines: string[] = []

    lines.push(`=== TASK EXECUTION CONTEXT ===`)
    lines.push(`Objective: ${state.objective}`)
    lines.push(`Current State: ${state.currentState}`)

    if (state.constraints.length > 0) {
      lines.push(`Constraints:`)
      for (const c of state.constraints) {
        lines.push(`  - ${c}`)
      }
    }

    if (state.currentHypothesis) {
      lines.push(`Active Hypothesis: ${state.currentHypothesis}`)
    }

    const activeUnit = state.workUnits.find((u) => u.id === state.activeWorkUnitId)
    if (activeUnit) {
      lines.push(`Active Work Unit: ${activeUnit.title}`)
      if (activeUnit.writeSet.length > 0) {
        lines.push(`Permitted Write Set: ${activeUnit.writeSet.join(", ")}`)
      }
    }

    if (state.filesChanged.length > 0) {
      lines.push(`Files Modified So Far: ${state.filesChanged.join(", ")} (+${state.linesAdded}/-${state.linesDeleted})`)
    }

    const unrecoveredFailures = state.failures.filter((f) => !f.recovered)
    if (unrecoveredFailures.length > 0) {
      lines.push(`Unresolved Failures:`)
      for (const f of unrecoveredFailures.slice(-3)) {
        lines.push(`  - [${f.type}] ${f.message}`)
      }
    }

    const passedTests = state.testsRun.filter((t) => t.passed)
    if (passedTests.length > 0) {
      lines.push(`Verified Passed Checks: ${passedTests.map((t) => t.name).join(", ")}`)
    }

    lines.push(`==============================`)
    return lines.join("\n")
  }

  /**
   * Ultra-compact single-paragraph representation.
   */
  private static renderCompact(state: TaskState): string {
    const passed = state.testsRun.filter((t) => t.passed).length
    const failed = state.failures.filter((f) => !f.recovered).length
    return `[Task ${state.taskId} | State: ${state.currentState} | Files: ${state.filesChanged.length} (+${state.linesAdded}/-${state.linesDeleted}) | Tests Passed: ${passed} | Failures: ${failed} | Active Unit: ${state.activeWorkUnitId ?? "none"}]`
  }
}
