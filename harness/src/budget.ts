/**
 * OpenCode Harness V5 - Change Budget & Write-Set Guard
 * 
 * Enforces per-task / per-work-unit file mutation boundaries.
 * Prevents unintended refactoring and scope creep.
 */

export interface ChangeBudget {
  maxFiles: number
  maxLinesAdded: number
  maxLinesDeleted: number
  writeSet: string[] // Allowed file paths or glob patterns
}

export interface BudgetStatus {
  allowed: boolean
  filesModified: string[]
  linesAdded: number
  linesDeleted: number
  violations: string[]
  recommendedAction: "PROCEED" | "HALT_FOR_REPLAN" | "REJECT_EDIT"
}

export class ChangeBudgetGuard {
  private budget: ChangeBudget
  private modifiedFiles: Set<string> = new Set()
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

  /**
   * Validate if a proposed file edit is within the assigned write set.
   */
  canModifyFile(filePath: string): { allowed: boolean; reason?: string } {
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

  /**
   * Record a file mutation and check whether the overall change budget is exceeded.
   */
  recordMutation(filePath: string, linesAdded: number = 0, linesDeleted: number = 0): BudgetStatus {
    this.modifiedFiles.add(filePath)
    this.totalLinesAdded += linesAdded
    this.totalLinesDeleted += linesDeleted

    const violations: string[] = []

    // Check write-set violation
    const writeSetCheck = this.canModifyFile(filePath)
    if (!writeSetCheck.allowed && writeSetCheck.reason) {
      violations.push(writeSetCheck.reason)
    }

    // Check file count ceiling
    if (this.modifiedFiles.size > this.budget.maxFiles) {
      violations.push(
        `Max files budget exceeded: ${this.modifiedFiles.size} > ${this.budget.maxFiles}`
      )
    }

    // Check lines added ceiling
    if (this.totalLinesAdded > this.budget.maxLinesAdded) {
      violations.push(
        `Max lines added budget exceeded: ${this.totalLinesAdded} > ${this.budget.maxLinesAdded}`
      )
    }

    // Check lines deleted ceiling
    if (this.totalLinesDeleted > this.budget.maxLinesDeleted) {
      violations.push(
        `Max lines deleted budget exceeded: ${this.totalLinesDeleted} > ${this.budget.maxLinesDeleted}`
      )
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

  get currentStatus(): BudgetStatus {
    return {
      allowed:
        this.modifiedFiles.size <= this.budget.maxFiles &&
        this.totalLinesAdded <= this.budget.maxLinesAdded &&
        this.totalLinesDeleted <= this.budget.maxLinesDeleted,
      filesModified: Array.from(this.modifiedFiles),
      linesAdded: this.totalLinesAdded,
      linesDeleted: this.totalLinesDeleted,
      violations: [],
      recommendedAction: "PROCEED",
    }
  }
}
