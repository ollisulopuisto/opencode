/**
 * OpenCode Harness V5 - System Context State Bridge
 * 
 * Bridges TaskStateMachine and TaskStatePersistence into live OpenCode prompts,
 * ensuring seamless context injection, write-set guidance, and hypothesis tracking.
 */

import { TaskStateMachine, type TaskState } from "./state"
import { TaskStatePersistence } from "./persistence"
import { TaskStateRenderer } from "./state-renderer"
import { CompactionGuard } from "./compaction-guard"
import { ChangeBudgetGuard } from "./budget"

export interface ContextBridgeOptions {
  persistence?: TaskStatePersistence
  budgetGuard?: ChangeBudgetGuard
  baseDir?: string
}

export class ContextBridge {
  private persistence: TaskStatePersistence
  private budgetGuard?: ChangeBudgetGuard

  constructor(options: ContextBridgeOptions = {}) {
    this.persistence = options.persistence ?? new TaskStatePersistence(options.baseDir)
    this.budgetGuard = options.budgetGuard
  }

  /**
   * Generates the initial turn prompt for a task.
   */
  buildInitialPrompt(stateMachine: TaskStateMachine): string {
    const state = stateMachine.snapshot
    const contextPrompt = TaskStateRenderer.render(state, { mode: "context_prompt" })

    return [
      contextPrompt,
      "",
      `TASK OBJECTIVE: ${state.objective}`,
      "",
      `EXECUTION RULES:`,
      `1. Follow TDD: analyze existing tests or write targeted tests before modifying code.`,
      `2. Work within the assigned Work Unit and Write-Set whitelist.`,
      `3. Minimize code modifications; do not refactor unrelated files.`,
      `4. Verify your implementation thoroughly using the test suite before reporting completion.`,
    ].join("\n")
  }

  /**
   * Generates prompt for continuing a turn with updated context.
   */
  buildContinuationPrompt(stateMachine: TaskStateMachine, lastActionSummary?: string): string {
    const state = stateMachine.snapshot
    const contextPrompt = TaskStateRenderer.render(state, { mode: "context_prompt" })

    const lines = [contextPrompt]
    if (lastActionSummary) {
      lines.push(`\nLAST ACTION: ${lastActionSummary}`)
    }
    lines.push(`\nNEXT STEP: Proceed with the next implementation or verification step according to active hypothesis.`)

    return lines.join("\n")
  }

  /**
   * Saves current state checkpoint to disk.
   */
  checkpoint(stateMachine: TaskStateMachine, label: string): void {
    const state = stateMachine.snapshot
    this.persistence.save(state)
    this.persistence.createSnapshot(state, label)
  }

  /**
   * Restores state from persisted storage.
   */
  restoreLatest(): TaskStateMachine | null {
    const state = this.persistence.load()
    if (!state) return null
    return TaskStatePersistence.hydrate(state)
  }

  /**
   * Generates a context preservation block for compaction.
   */
  getCompactionPreservation(stateMachine: TaskStateMachine): string {
    return CompactionGuard.formatForPrompt(stateMachine.snapshot)
  }
}
