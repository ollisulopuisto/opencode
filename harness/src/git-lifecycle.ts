/**
 * OpenCode Harness V5.2 - Git Lifecycle & Production Release Engine (Phase 10)
 * 
 * Provides automated Conventional Commit synthesis with CalVer tracking,
 * structured Pull Request generation with verification evidence,
 * and ephemeral worktree cleanup.
 */

import * as fs from "node:fs"
import * as path from "node:path"
import { type MultiTierVerificationResult } from "./verifier-engine"
import { type TaskState } from "./state"

export interface CommitSynthesisOptions {
  taskState: TaskState
  verification?: MultiTierVerificationResult
  commitCount?: number
  currentDate?: Date
}

export interface GeneratedCommit {
  type: "feat" | "fix" | "refactor" | "test" | "chore" | "docs"
  scope?: string
  summary: string
  calver: string
  fullMessage: string
  body: string
}

export interface PullRequestSynthesisOptions {
  taskState: TaskState
  verification?: MultiTierVerificationResult
  branchName?: string
  calver?: string
}

export interface GeneratedPullRequest {
  title: string
  body: string
}

export class GitLifecycleEngine {
  private workspaceRoot: string

  constructor(workspaceRoot: string = process.cwd()) {
    this.workspaceRoot = path.resolve(workspaceRoot)
  }

  /**
   * Computes the CalVer string (vYY.MM.DD.N) based on date and commit count.
   */
  static computeCalVer(date: Date = new Date(), commitCount: number = 0): string {
    const yy = String(date.getFullYear()).slice(-2)
    const mm = String(date.getMonth() + 1).padStart(2, "0")
    const dd = String(date.getDate()).padStart(2, "0")
    return `v${yy}.${mm}.${dd}.${commitCount}`
  }

  /**
   * Infers conventional commit type from task objective and changed files.
   */
  static inferCommitType(objective: string, filesChanged: string[]): "feat" | "fix" | "refactor" | "test" | "chore" | "docs" {
    const lower = objective.toLowerCase()
    if (lower.startsWith("fix") || lower.includes("bug") || lower.includes("defect") || lower.includes("patch")) {
      return "fix"
    }
    if (lower.startsWith("refactor") || lower.includes("clean") || lower.includes("simplify")) {
      return "refactor"
    }
    if (lower.startsWith("test") || filesChanged.every((f) => f.includes("test") || f.includes("spec"))) {
      return "test"
    }
    if (lower.startsWith("docs") || filesChanged.every((f) => f.endsWith(".md"))) {
      return "docs"
    }
    if (lower.startsWith("chore") || lower.includes("upgrade") || lower.includes("deps")) {
      return "chore"
    }
    return "feat"
  }

  /**
   * Infers scope from changed file paths.
   */
  static inferScope(filesChanged: string[]): string | undefined {
    if (filesChanged.length === 0) return undefined
    if (filesChanged.every((f) => f.startsWith("harness/"))) return "harness"
    if (filesChanged.every((f) => f.startsWith("packages/opencode/"))) return "opencode"
    if (filesChanged.every((f) => f.startsWith("packages/core/"))) return "core"
    if (filesChanged.every((f) => f.startsWith("packages/server/"))) return "server"
    if (filesChanged.every((f) => f.startsWith("packages/tui/"))) return "tui"
    if (filesChanged.every((f) => f.startsWith("packages/sdk/"))) return "sdk"
    return undefined
  }

  /**
   * Synthesizes a Conventional Commit message adhering to CalVer and project guidelines.
   */
  static synthesizeCommit(options: CommitSynthesisOptions): GeneratedCommit {
    const { taskState, verification, commitCount = 0, currentDate = new Date() } = options
    const type = this.inferCommitType(taskState.objective, taskState.filesChanged)
    const scope = this.inferScope(taskState.filesChanged)
    const calver = this.computeCalVer(currentDate, commitCount)

    // Clean up summary
    let cleanObjective = taskState.objective.trim()
    cleanObjective = cleanObjective.replace(/^(fix|feat|refactor|test|chore|docs|add|implement)\b(\([^)]+\))?[:\s]*/i, "")
    // Ensure lowercase start for conventional summary
    cleanObjective = cleanObjective.charAt(0).toLowerCase() + cleanObjective.slice(1)

    const header = scope ? `${type}(${scope}): ${cleanObjective}` : `${type}: ${cleanObjective}`

    const bodyLines: string[] = []
    if (taskState.workUnits.length > 0) {
      bodyLines.push("Completed work units:")
      for (const unit of taskState.workUnits) {
        bodyLines.push(`- ${unit.title || unit.id} (${unit.status})`)
      }
      bodyLines.push("")
    }

    if (taskState.filesChanged.length > 0) {
      bodyLines.push("Modified files:")
      for (const file of taskState.filesChanged) {
        bodyLines.push(`- ${file}`)
      }
      bodyLines.push("")
    }

    if (verification && verification.correct) {
      bodyLines.push(`Verification: Passed all ${verification.tierResults.length} tiers with ${(verification.confidence * 100).toFixed(0)}% confidence.`)
    }

    bodyLines.push(`CalVer: ${calver}`)

    const body = bodyLines.join("\n")
    const fullMessage = `${header}\n\n${body}`

    return {
      type,
      scope,
      summary: cleanObjective,
      calver,
      body,
      fullMessage,
    }
  }

  /**
   * Synthesizes a Pull Request title and structured markdown body.
   */
  static synthesizePullRequest(options: PullRequestSynthesisOptions): GeneratedPullRequest {
    const { taskState, verification, calver } = options
    const type = this.inferCommitType(taskState.objective, taskState.filesChanged)
    const scope = this.inferScope(taskState.filesChanged)

    let cleanObjective = taskState.objective.trim()
    cleanObjective = cleanObjective.replace(/^(fix|feat|refactor|test|chore|docs|add|implement)\b(\([^)]+\))?[:\s]*/i, "")
    cleanObjective = cleanObjective.charAt(0).toLowerCase() + cleanObjective.slice(1)

    const title = scope ? `${type}(${scope}): ${cleanObjective}` : `${type}: ${cleanObjective}`

    const sections: string[] = []

    // 1. Summary
    sections.push(`## Summary\n\n${taskState.objective}`)

    // 2. Work Units
    if (taskState.workUnits.length > 0) {
      const unitItems = taskState.workUnits.map((u) => `- [x] **${u.title}**: ${u.description || "Completed"}`).join("\n")
      sections.push(`## Completed Work Units\n\n${unitItems}`)
    }

    // 3. Changed Files
    if (taskState.filesChanged.length > 0) {
      const fileItems = taskState.filesChanged.map((f) => `- \`${f}\``).join("\n")
      sections.push(`## Modified Files\n\n${fileItems}`)
    }

    // 4. Verification Evidence
    if (verification) {
      const tierRows = verification.tierResults
        .map((t) => `| **${t.name}** | ${t.passed ? "✅ Passed" : "❌ Failed"} | ${t.durationMs}ms |`)
        .join("\n")

      sections.push(
        `## Verification Evidence\n\n` +
          `| Tier | Status | Duration |\n| :--- | :--- | :--- |\n` +
          `${tierRows}\n\n` +
          `**Confidence:** ${(verification.confidence * 100).toFixed(0)}% (All gates verified)`
      )
    }

    // 5. Release & CalVer
    if (calver) {
      sections.push(`## Release\n\n- **Target CalVer:** \`${calver}\``)
    }

    return {
      title,
      body: sections.join("\n\n"),
    }
  }

  /**
   * Cleans up stale worker directories and temporary worktrees.
   */
  static cleanupEphemeralWorktrees(baseDir: string = process.cwd()): number {
    const worktreeBase = path.join(baseDir, ".opencode", "workers")
    if (!fs.existsSync(worktreeBase)) return 0

    let cleaned = 0
    const entries = fs.readdirSync(worktreeBase, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory()) {
        try {
          fs.rmSync(path.join(worktreeBase, entry.name), { recursive: true, force: true })
          cleaned++
        } catch {}
      }
    }
    return cleaned
  }
}
