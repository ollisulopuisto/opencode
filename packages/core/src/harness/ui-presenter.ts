export * as HarnessUiPresenter from "./ui-presenter"

import type { TaskState, WorkUnit } from "./state"
import { GitLifecycleEngine } from "./git-lifecycle"

export type GateStatus = "pending" | "running" | "passed" | "failed" | "skipped"

export interface VerificationTierPresenter {
  readonly name: string
  readonly status: GateStatus
  readonly durationMs?: number
  readonly diagnostics?: string
}

export interface VerificationGatesPresenter {
  readonly tier0: VerificationTierPresenter
  readonly tier1: VerificationTierPresenter
  readonly tier2: VerificationTierPresenter
  readonly allPassed: boolean
}

export interface PlanProgressPresenter {
  readonly totalUnits: number
  readonly completedUnits: number
  readonly percentage: number
  readonly activeUnit?: WorkUnit
  readonly units: readonly WorkUnit[]
}

export interface ChangeBudgetPresenter {
  readonly filesChanged: readonly string[]
  readonly filesChangedCount: number
  readonly linesAdded: number
  readonly linesDeleted: number
  readonly totalLinesModified: number
  readonly maxFiles: number
  readonly maxLines: number
  readonly isExceeded: boolean
  readonly percentageOfBudget: number
  readonly violations: readonly string[]
}

export interface SupervisorPresenter {
  readonly activeHypothesis: string
  readonly bannedHypotheses: readonly string[]
  readonly hasActiveDirective: boolean
  readonly activeDirective?: string
  readonly interventionsCount: number
}

export interface CalVerCommitDraftPresenter {
  readonly readyToCommit: boolean
  readonly calverVersion: string
  readonly commitTitle: string
  readonly commitBody: string
  readonly fullMessage: string
}

export function presentVerificationGates(taskState: TaskState): VerificationGatesPresenter {
  const tests = taskState.testsRun

  const parseTier = (pattern: RegExp, defaultName: string): VerificationTierPresenter => {
    const matching = tests.filter((t) => pattern.test(t.name))
    if (matching.length === 0) {
      return {
        name: defaultName,
        status: "pending",
      }
    }
    const failed = matching.find((t) => !t.passed)
    if (failed) {
      return {
        name: failed.name,
        status: "failed",
        durationMs: failed.durationMs,
        diagnostics: failed.output ?? "Verification assertion failed",
      }
    }
    const totalDuration = matching.reduce((sum, t) => sum + (t.durationMs ?? 0), 0)
    return {
      name: matching[0].name,
      status: "passed",
      durationMs: totalDuration,
    }
  }

  const tier0 = parseTier(/tier\s*0|static|typecheck|lint/i, "Tier 0: Static Analysis & Types")
  const tier1 = parseTier(/tier\s*1|targeted|unit/i, "Tier 1: Targeted Tests")
  const tier2 = parseTier(/tier\s*2|regression|suite/i, "Tier 2: Workspace Regression")

  const allPassed =
    tier0.status === "passed" &&
    tier1.status === "passed" &&
    tier2.status === "passed"

  return {
    tier0,
    tier1,
    tier2,
    allPassed,
  }
}

export function presentPlanProgress(taskState: TaskState): PlanProgressPresenter {
  const units = taskState.workUnits
  const totalUnits = units.length
  const completedUnits = units.filter((u) => u.status === "verified").length
  const percentage = totalUnits > 0 ? Math.round((completedUnits / totalUnits) * 100) : 0
  const activeUnit = units.find((u) => u.id === taskState.activeWorkUnitId)

  return {
    totalUnits,
    completedUnits,
    percentage,
    activeUnit,
    units,
  }
}

export function presentBudget(
  taskState: TaskState,
  limits: { maxFiles?: number; maxLines?: number } = {},
): ChangeBudgetPresenter {
  const maxFiles = limits.maxFiles ?? 5
  const maxLines = limits.maxLines ?? 300
  const filesChanged = taskState.filesChanged
  const filesChangedCount = filesChanged.length
  const linesAdded = taskState.linesAdded
  const linesDeleted = taskState.linesDeleted
  const totalLinesModified = linesAdded + linesDeleted

  const violations: string[] = []
  if (filesChangedCount > maxFiles) {
    violations.push(`Modified files (${filesChangedCount}) exceeds limit of ${maxFiles}`)
  }
  if (totalLinesModified > maxLines) {
    violations.push(`Total lines changed (${totalLinesModified}) exceeds limit of ${maxLines}`)
  }

  const percentageOfBudget = Math.min(100, Math.round((totalLinesModified / maxLines) * 100))

  return {
    filesChanged,
    filesChangedCount,
    linesAdded,
    linesDeleted,
    totalLinesModified,
    maxFiles,
    maxLines,
    isExceeded: violations.length > 0,
    percentageOfBudget,
    violations,
  }
}

export function presentSupervisor(
  taskState: TaskState,
  bannedHypotheses: readonly string[] = [],
): SupervisorPresenter {
  const activeDirectiveDecision = taskState.decisions.find(
    (d) => d.toLowerCase().includes("directive") || d.toLowerCase().includes("supervisor"),
  )

  return {
    activeHypothesis: taskState.currentHypothesis,
    bannedHypotheses,
    hasActiveDirective: activeDirectiveDecision !== undefined,
    activeDirective: activeDirectiveDecision,
    interventionsCount: taskState.supervisorInterventions,
  }
}

export function presentCommitDraft(
  taskState: TaskState,
  options: { commitCount?: number; date?: Date } = {},
): CalVerCommitDraftPresenter {
  const gates = presentVerificationGates(taskState)
  const commit = GitLifecycleEngine.synthesizeCommit({
    taskState,
    commitCount: options.commitCount ?? 1,
    currentDate: options.date ?? new Date(),
  })

  return {
    readyToCommit: gates.allPassed,
    calverVersion: commit.calver,
    commitTitle: `${commit.type}${commit.scope ? `(${commit.scope})` : ""}: ${commit.summary}`,
    commitBody: commit.body,
    fullMessage: commit.fullMessage,
  }
}
