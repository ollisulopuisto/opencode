export * as HarnessState from "./state"

export type CanonicalState =
  | "UNDERSTAND"
  | "EXPLORE"
  | "PLAN"
  | "DECOMPOSE"
  | "EXECUTE"
  | "VERIFY"
  | "RECOVER"
  | "REPLAN"
  | "INTEGRATE"
  | "COMPLETE"
  | "BLOCKED"

export interface WorkUnit {
  readonly id: string
  readonly title: string
  readonly objective: string
  readonly writeSet: readonly string[]
  readonly relevantFiles: readonly string[]
  readonly dependencies: readonly string[]
  readonly verificationCmd?: string
  readonly status: "pending" | "in_progress" | "verified" | "failed"
  readonly workerId?: string
}

export interface FailureRecord {
  readonly id: string
  readonly type: string
  readonly message: string
  readonly context?: string
  readonly step: number
  readonly timestamp: number
  readonly recovered: boolean
}

export interface StateTransitionEvent {
  readonly from: CanonicalState
  readonly to: CanonicalState
  readonly reason: string
  readonly timestamp: number
}

export interface TaskState {
  readonly taskId: string
  readonly objective: string
  readonly constraints: readonly string[]
  readonly decisions: readonly string[]
  readonly workUnits: readonly WorkUnit[]
  readonly activeWorkUnitId?: string
  readonly filesChanged: readonly string[]
  readonly linesAdded: number
  readonly linesDeleted: number
  readonly testsRun: ReadonlyArray<{
    readonly name: string
    readonly passed: boolean
    readonly durationMs?: number
    readonly output?: string
  }>
  readonly failures: readonly FailureRecord[]
  readonly currentHypothesis: string
  readonly remainingWork: readonly string[]
  readonly knownUnknowns: readonly string[]
  readonly currentState: CanonicalState
  readonly history: readonly StateTransitionEvent[]
  readonly supervisorInterventions: number
  readonly modelTurns: number
}

const VALID_TRANSITIONS: Record<CanonicalState, readonly CanonicalState[]> = {
  UNDERSTAND: ["EXPLORE", "PLAN", "EXECUTE", "BLOCKED"],
  EXPLORE: ["PLAN", "EXECUTE", "UNDERSTAND", "BLOCKED"],
  PLAN: ["DECOMPOSE", "EXECUTE", "EXPLORE", "BLOCKED"],
  DECOMPOSE: ["EXECUTE", "PLAN", "BLOCKED"],
  EXECUTE: ["VERIFY", "RECOVER", "COMPLETE", "BLOCKED"],
  VERIFY: ["COMPLETE", "RECOVER", "EXECUTE", "REPLAN", "BLOCKED"],
  RECOVER: ["EXECUTE", "VERIFY", "REPLAN", "BLOCKED"],
  REPLAN: ["PLAN", "DECOMPOSE", "EXECUTE", "BLOCKED"],
  INTEGRATE: ["VERIFY", "RECOVER", "BLOCKED"],
  COMPLETE: [],
  BLOCKED: ["REPLAN", "UNDERSTAND", "RECOVER"],
}

export class TaskStateMachine {
  private state: TaskState

  constructor(taskId: string, objective: string, constraints: readonly string[] = []) {
    this.state = {
      taskId,
      objective,
      constraints,
      decisions: [],
      workUnits: [],
      filesChanged: [],
      linesAdded: 0,
      linesDeleted: 0,
      testsRun: [],
      failures: [],
      currentHypothesis: "",
      remainingWork: [objective],
      knownUnknowns: [],
      currentState: "UNDERSTAND",
      history: [
        {
          from: "UNDERSTAND",
          to: "UNDERSTAND",
          reason: "Task initialized",
          timestamp: Date.now(),
        },
      ],
      supervisorInterventions: 0,
      modelTurns: 0,
    }
  }

  get currentState(): CanonicalState {
    return this.state.currentState
  }

  get snapshot(): Readonly<TaskState> {
    return this.state
  }

  canTransition(target: CanonicalState): boolean {
    if (this.state.currentState === target) return true
    const allowed = VALID_TRANSITIONS[this.state.currentState] ?? []
    return allowed.includes(target)
  }

  transition(to: CanonicalState, reason: string): { readonly success: boolean; readonly error?: string } {
    if (to === this.state.currentState) {
      return { success: true }
    }

    if (!this.canTransition(to)) {
      const error = `Illegal state transition from ${this.state.currentState} to ${to}`
      return { success: false, error }
    }

    if (to === "COMPLETE") {
      const lastTest = this.state.testsRun[this.state.testsRun.length - 1]
      const hasVerifiedTest = this.state.testsRun.length > 0 && lastTest?.passed === true
      const hasUnresolvedFailures = this.state.failures.some((f) => !f.recovered)

      if (!hasVerifiedTest) {
        return {
          success: false,
          error: "Cannot complete task without verified passing test suite",
        }
      }

      if (hasUnresolvedFailures) {
        return {
          success: false,
          error: "Cannot complete task with unresolved failure records",
        }
      }
    }

    const event: StateTransitionEvent = {
      from: this.state.currentState,
      to,
      reason,
      timestamp: Date.now(),
    }

    this.state = {
      ...this.state,
      currentState: to,
      history: [...this.state.history, event],
    }

    return { success: true }
  }

  setHypothesis(hypothesis: string): void {
    this.state = {
      ...this.state,
      currentHypothesis: hypothesis,
    }
  }

  recordFilesChanged(files: readonly string[], linesAdded: number = 0, linesDeleted: number = 0): void {
    const combinedFiles = Array.from(new Set([...this.state.filesChanged, ...files]))
    this.state = {
      ...this.state,
      filesChanged: combinedFiles,
      linesAdded: this.state.linesAdded + linesAdded,
      linesDeleted: this.state.linesDeleted + linesDeleted,
    }
  }

  recordTestResult(test: {
    readonly name: string
    readonly passed: boolean
    readonly durationMs?: number
    readonly output?: string
  }): void {
    this.state = {
      ...this.state,
      testsRun: [...this.state.testsRun, test],
    }
  }

  recordFailure(
    failureOrType: Omit<FailureRecord, "timestamp" | "recovered"> | string,
    message?: string,
    step?: number,
    context?: string,
  ): void {
    const record: FailureRecord =
      typeof failureOrType === "string"
        ? {
            id: `fail_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            type: failureOrType,
            message: message ?? "Unknown failure",
            step: step ?? 0,
            context,
            timestamp: Date.now(),
            recovered: false,
          }
        : {
            ...failureOrType,
            timestamp: Date.now(),
            recovered: false,
          }
    this.state = {
      ...this.state,
      failures: [...this.state.failures, record],
    }
  }

  recordDecision(decision: string): void {
    this.state = {
      ...this.state,
      decisions: [...this.state.decisions, decision],
    }
  }

  markFailureRecovered(failureId: string): void {
    this.state = {
      ...this.state,
      failures: this.state.failures.map((f) => (f.id === failureId ? { ...f, recovered: true } : f)),
    }
  }

  setPlan(units: readonly WorkUnit[]): void {
    this.setWorkUnits(units)
  }

  setWorkUnits(units: readonly WorkUnit[]): void {
    this.state = {
      ...this.state,
      workUnits: units,
    }
  }

  setActiveWorkUnit(workUnitId?: string): void {
    this.state = {
      ...this.state,
      activeWorkUnitId: workUnitId,
    }
  }

  incrementTurns(): void {
    this.state = {
      ...this.state,
      modelTurns: this.state.modelTurns + 1,
    }
  }

  incrementSupervisorInterventions(): void {
    this.state = {
      ...this.state,
      supervisorInterventions: this.state.supervisorInterventions + 1,
    }
  }
}
