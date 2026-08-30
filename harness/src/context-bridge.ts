import { TaskStateMachine, type TaskState } from "./state"
import { TaskStatePersistence } from "./persistence"
import { TaskStateRenderer } from "./state-renderer"
import { CompactionGuard } from "./compaction-guard"
import { ChangeBudgetGuard } from "./budget"
import { ProjectMemory } from "./project-memory"
import { ReasoningTuner } from "./reasoning-tuner"
import { PromptAdapter } from "./prompt-adapter"
import { TaskComplexityClassifier, type TaskComplexity } from "./classifier"

export interface ContextBridgeOptions {
  persistence?: TaskStatePersistence
  budgetGuard?: ChangeBudgetGuard
  projectMemory?: ProjectMemory
  baseDir?: string
}

export class ContextBridge {
  private persistence: TaskStatePersistence
  private budgetGuard?: ChangeBudgetGuard
  private projectMemory: ProjectMemory

  constructor(options: ContextBridgeOptions = {}) {
    this.persistence = options.persistence ?? new TaskStatePersistence(options.baseDir)
    this.budgetGuard = options.budgetGuard
    this.projectMemory = options.projectMemory ?? new ProjectMemory(options.baseDir)
  }

  /**
   * Generates the initial turn prompt for a task.
   */
  buildInitialPrompt(
    stateMachine: TaskStateMachine,
    options: { modelId?: string; complexity?: TaskComplexity; assignedWriteSet?: string[] } = {}
  ): string {
    const state = stateMachine.snapshot
    const contextPrompt = TaskStateRenderer.render(state, { mode: "context_prompt" })
    const memoryPrompt = this.projectMemory.formatForPrompt(state.objective, state.filesChanged)

    const modelId = options.modelId ?? "opencode-go/glm-5.3-flash"
    const complexity = options.complexity ?? TaskComplexityClassifier.classify(state.objective).complexity
    const reasoningConfig = ReasoningTuner.compute({
      complexity,
      recoveryAttempts: 0,
    })

    const adaptedInstructions = PromptAdapter.formatInstructions({
      modelId,
      taskObjective: state.objective,
      effort: reasoningConfig.effort,
      reasoningDirectives: reasoningConfig.reasoningDirectives,
      assignedWriteSet: options.assignedWriteSet,
    })

    const parts = [contextPrompt]
    if (memoryPrompt) {
      parts.push(memoryPrompt)
    }

    parts.push(`TASK OBJECTIVE: ${state.objective}`)
    parts.push(adaptedInstructions)

    return parts.join("\n\n")
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
