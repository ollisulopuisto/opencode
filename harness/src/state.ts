/**
 * OpenCode Harness V5 - State Machine & Task State Representation
 * 
 * Owns canonical execution state transitions and persistent task state.
 * Core Principle:
 *   The model decides WHAT should happen.
 *   The harness decides WHETHER the next action or transition is permitted.
 */

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
  id: string
  title: string
  objective: string
  writeSet: string[]
  relevantFiles: string[]
  dependencies: string[]
  verificationCmd?: string
  status: "pending" | "in_progress" | "verified" | "failed"
  workerId?: string
}

export interface FailureRecord {
  id: string
  type: string
  message: string
  context?: string
  step: number
  timestamp: number
  recovered: boolean
}

export interface StateTransitionEvent {
  from: CanonicalState
  to: CanonicalState
  reason: string
  timestamp: number
}

export interface TaskState {
  taskId: string
  objective: string
  constraints: string[]
  decisions: string[]
  workUnits: WorkUnit[]
  activeWorkUnitId?: string
  filesChanged: string[]
  linesAdded: number
  linesDeleted: number
  testsRun: Array<{ name: string; passed: boolean; durationMs?: number; output?: string }>
  failures: FailureRecord[]
  currentHypothesis: string
  remainingWork: string[]
  knownUnknowns: string[]
  currentState: CanonicalState
  history: StateTransitionEvent[]
  geminiInterventions: number
  qwenTurns: number
}

const VALID_TRANSITIONS: Record<CanonicalState, CanonicalState[]> = {
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

  constructor(taskId: string, objective: string, constraints: string[] = []) {
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
      geminiInterventions: 0,
      qwenTurns: 0,
    }
  }

  get currentState(): CanonicalState {
    return this.state.currentState
  }

  get snapshot(): Readonly<TaskState> {
    return JSON.parse(JSON.stringify(this.state))
  }

  canTransition(target: CanonicalState): boolean {
    if (this.state.currentState === target) return true
    const allowed = VALID_TRANSITIONS[this.state.currentState] ?? []
    return allowed.includes(target)
  }

  transition(to: CanonicalState, reason: string): { success: boolean; error?: string } {
    if (to === this.state.currentState) {
      return { success: true }
    }

    if (!this.canTransition(to)) {
      const error = `Illegal state transition from ${this.state.currentState} to ${to}`
      return { success: false, error }
    }

    // Guard: Cannot transition to COMPLETE without passing verification
    if (to === "COMPLETE") {
      const lastTest = this.state.testsRun[this.state.testsRun.length - 1]
      const hasVerifiedTest = this.state.testsRun.length > 0 && lastTest?.passed === true
      const hasUnresolvedFailures = this.state.failures.some((f) => !f.recovered)

      if (!hasVerifiedTest) {
        return {
          success: false,
          error: "Cannot transition to COMPLETE: verification gate has not passed.",
        }
      }

      if (hasUnresolvedFailures) {
        for (const f of this.state.failures) {
          f.recovered = true
        }
      }
    }

    const event: StateTransitionEvent = {
      from: this.state.currentState,
      to,
      reason,
      timestamp: Date.now(),
    }

    this.state.currentState = to
    this.state.history.push(event)
    return { success: true }
  }

  setHypothesis(hypothesis: string): void {
    this.state.currentHypothesis = hypothesis
    this.state.decisions.push(`Hypothesis adopted: ${hypothesis}`)
  }

  recordFailure(type: string, message: string, step: number, context?: string): FailureRecord {
    const failure: FailureRecord = {
      id: `fail_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type,
      message,
      step,
      context,
      timestamp: Date.now(),
      recovered: false,
    }
    this.state.failures.push(failure)
    return failure
  }

  markFailureRecovered(failureId: string): void {
    const failure = this.state.failures.find((f) => f.id === failureId)
    if (failure) {
      failure.recovered = true
    }
  }

  recordTestResult(name: string, passed: boolean, durationMs?: number, output?: string): void {
    this.state.testsRun.push({ name, passed, durationMs, output })
  }

  recordFileMutation(file: string, added: number = 0, deleted: number = 0): void {
    if (!this.state.filesChanged.includes(file)) {
      this.state.filesChanged.push(file)
    }
    this.state.linesAdded += added
    this.state.linesDeleted += deleted
  }

  incrementTurn(): void {
    this.state.qwenTurns += 1
  }

  incrementGeminiIntervention(): void {
    this.state.geminiInterventions += 1
  }

  recordGeminiIntervention(): void {
    this.state.geminiInterventions += 1
  }

  recordDecision(decision: string, rationale?: string): void {
    const entry = rationale ? `${decision} (Rationale: ${rationale})` : decision
    this.state.decisions.push(entry)
  }

  addWorkUnit(unit: Omit<WorkUnit, "status">): WorkUnit {
    const newUnit: WorkUnit = {
      ...unit,
      status: "pending",
    }
    this.state.workUnits.push(newUnit)
    return newUnit
  }

  setActiveWorkUnit(unitId: string): void {
    const unit = this.state.workUnits.find((u) => u.id === unitId)
    if (unit) {
      unit.status = "in_progress"
      this.state.activeWorkUnitId = unitId
    }
  }

  completeActiveWorkUnit(): void {
    if (this.state.activeWorkUnitId) {
      const unit = this.state.workUnits.find((u) => u.id === this.state.activeWorkUnitId)
      if (unit) {
        unit.status = "verified"
      }
      this.state.activeWorkUnitId = undefined
    }
  }
}
