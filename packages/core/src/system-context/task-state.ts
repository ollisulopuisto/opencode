export * as TaskStateContext from "./task-state"

import { Effect, Schema } from "effect"
import { optional } from "../schema"
import { SystemContext } from "./index"

export const CanonicalStateSchema = Schema.Literals([
  "UNDERSTAND",
  "EXPLORE",
  "PLAN",
  "DECOMPOSE",
  "EXECUTE",
  "VERIFY",
  "RECOVER",
  "REPLAN",
  "INTEGRATE",
  "COMPLETE",
  "BLOCKED",
])
export type CanonicalState = typeof CanonicalStateSchema.Type

export const WorkUnitSchema = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  objective: Schema.String,
  writeSet: Schema.Array(Schema.String),
  relevantFiles: Schema.Array(Schema.String),
  dependencies: Schema.Array(Schema.String),
  verificationCmd: optional(Schema.String),
  status: Schema.Literals(["pending", "in_progress", "verified", "failed"]),
  workerId: optional(Schema.String),
})
export type WorkUnit = typeof WorkUnitSchema.Type

export const FailureRecordSchema = Schema.Struct({
  id: Schema.String,
  type: Schema.String,
  message: Schema.String,
  context: optional(Schema.String),
  step: Schema.Number,
  timestamp: Schema.Number,
  recovered: Schema.Boolean,
})
export type FailureRecord = typeof FailureRecordSchema.Type

export const TestResultSchema = Schema.Struct({
  name: Schema.String,
  passed: Schema.Boolean,
  durationMs: optional(Schema.Number),
  output: optional(Schema.String),
})
export type TestResult = typeof TestResultSchema.Type

export const TaskStatePayload = Schema.Struct({
  taskId: Schema.String,
  objective: Schema.String,
  currentState: CanonicalStateSchema,
  constraints: Schema.Array(Schema.String),
  decisions: Schema.Array(Schema.String),
  workUnits: Schema.Array(WorkUnitSchema),
  activeWorkUnitId: optional(Schema.String),
  filesChanged: Schema.Array(Schema.String),
  testsRun: Schema.Array(TestResultSchema),
  failures: Schema.Array(FailureRecordSchema),
  currentHypothesis: Schema.String,
  remainingWork: Schema.Array(Schema.String),
  knownUnknowns: Schema.Array(Schema.String),
})
export type TaskStatePayload = typeof TaskStatePayload.Type

export function renderTaskStateBaseline(state: TaskStatePayload): string {
  const lines: string[] = [
    "<task_state>",
    `  Task ID: ${state.taskId}`,
    `  State: ${state.currentState}`,
    `  Objective: ${state.objective}`,
  ]

  if (state.constraints.length > 0) {
    lines.push("  Constraints:")
    for (const c of state.constraints) {
      lines.push(`    - ${c}`)
    }
  }

  if (state.currentHypothesis) {
    lines.push(`  Active Hypothesis: ${state.currentHypothesis}`)
  }

  if (state.workUnits.length > 0) {
    lines.push("  Work Units:")
    for (const wu of state.workUnits) {
      const active = wu.id === state.activeWorkUnitId ? " (ACTIVE)" : ""
      lines.push(`    - [${wu.status.toUpperCase()}] ${wu.id}: ${wu.title}${active}`)
    }
  }

  if (state.filesChanged.length > 0) {
    lines.push("  Files Changed:")
    for (const f of state.filesChanged) {
      lines.push(`    - ${f}`)
    }
  }

  if (state.remainingWork.length > 0) {
    lines.push("  Remaining Work:")
    for (const rw of state.remainingWork) {
      lines.push(`    - ${rw}`)
    }
  }

  lines.push("</task_state>")
  return lines.join("\n")
}

export function renderTaskStateUpdate(previous: TaskStatePayload, current: TaskStatePayload): string {
  const lines: string[] = [
    "<task_state_update>",
    `  State: ${previous.currentState} ➔ ${current.currentState}`,
  ]

  if (previous.currentHypothesis !== current.currentHypothesis && current.currentHypothesis) {
    lines.push(`  New Hypothesis: ${current.currentHypothesis}`)
  }

  if (previous.activeWorkUnitId !== current.activeWorkUnitId && current.activeWorkUnitId) {
    lines.push(`  Active Work Unit: ${current.activeWorkUnitId}`)
  }

  const newlyChanged = current.filesChanged.filter((f) => !previous.filesChanged.includes(f))
  if (newlyChanged.length > 0) {
    lines.push(`  Newly Changed Files: ${newlyChanged.join(", ")}`)
  }

  const newFailures = current.failures.filter((f) => !previous.failures.some((pf) => pf.id === f.id))
  if (newFailures.length > 0) {
    lines.push(`  Recent Failures: ${newFailures.map((f) => `${f.type}: ${f.message}`).join("; ")}`)
  }

  lines.push("</task_state_update>")
  return lines.join("\n")
}

export function makeTaskStateContext(
  loadEffect: Effect.Effect<TaskStatePayload | SystemContext.Unavailable>,
): SystemContext.SystemContext {
  return SystemContext.make({
    key: SystemContext.Key.make("harness/task-state"),
    codec: Schema.toCodecJson(TaskStatePayload),
    load: loadEffect,
    baseline: (current) =>
      ["Current structured engineering task state:", renderTaskStateBaseline(current)].join("\n"),
    update: (previous, current) =>
      ["Engineering task state has updated:", renderTaskStateUpdate(previous, current)].join("\n"),
  })
}
