export * as HarnessBudget from "./budget"

export interface ChangeBudget {
  readonly maxFiles: number
  readonly maxLinesAdded: number
  readonly maxLinesDeleted: number
  readonly writeSet: readonly string[]
}

export interface BudgetStatus {
  readonly allowed: boolean
  readonly filesModified: readonly string[]
  readonly linesAdded: number
  readonly linesDeleted: number
  readonly violations: readonly string[]
  readonly recommendedAction: "PROCEED" | "HALT_FOR_REPLAN" | "REJECT_EDIT"
}

export class ChangeBudgetGuard {
  private readonly budget: ChangeBudget
  private readonly modifiedFiles: Set<string> = new Set()
  private totalLinesAdded = 0
  private totalLinesDeleted = 0

  constructor(budget: Partial<ChangeBudget> = {}) {
    this.budget = {
      maxFiles: budget.maxFiles ?? 8,
      maxLinesAdded: budget.maxLinesAdded ?? 500,
      maxLinesDeleted: budget.maxLinesDeleted ?? 300,
      writeSet: budget.writeSet ?? ["*"],
    }
  }

  canModifyFile(filePath: string): { readonly allowed: boolean; readonly reason?: string } {
    if (this.budget.writeSet.includes("*")) {
      return { allowed: true }
    }

    const matched = this.budget.writeSet.some((pattern) => {
      if (pattern.endsWith("/*")) {
        const dir = pattern.slice(0, -2)
        return filePath.startsWith(dir)
      }
      return filePath === pattern || filePath.endsWith(pattern)
    })

    if (!matched) {
      return {
        allowed: false,
        reason: `File '${filePath}' is outside assigned write set [${this.budget.writeSet.join(", ")}]`,
      }
    }

    return { allowed: true }
  }

  recordMutation(filePath: string, linesAdded: number = 0, linesDeleted: number = 0): BudgetStatus {
    this.modifiedFiles.add(filePath)
    this.totalLinesAdded += linesAdded
    this.totalLinesDeleted += linesDeleted

    const violations: string[] = []

    const writeSetCheck = this.canModifyFile(filePath)
    if (!writeSetCheck.allowed && writeSetCheck.reason) {
      violations.push(writeSetCheck.reason)
    }

    if (this.modifiedFiles.size > this.budget.maxFiles) {
      violations.push(`Max files budget exceeded: ${this.modifiedFiles.size} > ${this.budget.maxFiles}`)
    }

    if (this.totalLinesAdded > this.budget.maxLinesAdded) {
      violations.push(`Max lines added budget exceeded: ${this.totalLinesAdded} > ${this.budget.maxLinesAdded}`)
    }

    if (this.totalLinesDeleted > this.budget.maxLinesDeleted) {
      violations.push(`Max lines deleted budget exceeded: ${this.totalLinesDeleted} > ${this.budget.maxLinesDeleted}`)
    }

    const allowed = violations.length === 0
    return {
      allowed,
      filesModified: Array.from(this.modifiedFiles),
      linesAdded: this.totalLinesAdded,
      linesDeleted: this.totalLinesDeleted,
      violations,
      recommendedAction: allowed ? "PROCEED" : "HALT_FOR_REPLAN",
    }
  }

  reset(): void {
    this.modifiedFiles.clear()
    this.totalLinesAdded = 0
    this.totalLinesDeleted = 0
  }
}
