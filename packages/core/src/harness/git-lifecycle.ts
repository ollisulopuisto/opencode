export * as HarnessGitLifecycle from "./git-lifecycle"

import path from "path"
import type { MultiTierVerificationResult } from "./verifier"
import type { TaskState } from "./state"

export interface CommitSynthesisOptions {
  readonly taskState: TaskState
  readonly verification?: MultiTierVerificationResult
  readonly commitCount?: number
  readonly currentDate?: Date
}

export interface GeneratedCommit {
  readonly type: "feat" | "fix" | "refactor" | "test" | "chore" | "docs"
  readonly scope?: string
  readonly summary: string
  readonly calver: string
  readonly fullMessage: string
  readonly body: string
}

export interface PullRequestSynthesisOptions {
  readonly taskState: TaskState
  readonly verification?: MultiTierVerificationResult
  readonly branchName?: string
  readonly calver?: string
}

export interface GeneratedPullRequest {
  readonly title: string
  readonly body: string
}

export class GitLifecycleEngine {
  private readonly workspaceRoot: string

  constructor(workspaceRoot: string = process.cwd()) {
    this.workspaceRoot = path.resolve(workspaceRoot)
  }

  static computeCalVer(date: Date = new Date(), commitCount: number = 0): string {
    const yy = String(date.getFullYear()).slice(-2)
    const mm = String(date.getMonth() + 1).padStart(2, "0")
    const dd = String(date.getDate()).padStart(2, "0")
    return `v${yy}.${mm}.${dd}.${commitCount}`
  }

  static inferCommitType(
    objective: string,
    filesChanged: readonly string[],
  ): "feat" | "fix" | "refactor" | "test" | "chore" | "docs" {
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

  static inferScope(filesChanged: readonly string[]): string | undefined {
    if (filesChanged.length === 0) return undefined
    if (filesChanged.every((f) => f.startsWith("harness/"))) return "harness"
    if (filesChanged.every((f) => f.startsWith("packages/opencode/"))) return "opencode"
    if (filesChanged.every((f) => f.startsWith("packages/core/"))) return "core"
    if (filesChanged.every((f) => f.startsWith("packages/server/"))) return "server"
    if (filesChanged.every((f) => f.startsWith("packages/tui/"))) return "tui"
    if (filesChanged.every((f) => f.startsWith("packages/sdk/"))) return "sdk"
    return undefined
  }

  static synthesizeCommit(options: CommitSynthesisOptions): GeneratedCommit {
    const { taskState, verification, commitCount = 0, currentDate = new Date() } = options
    const calver = this.computeCalVer(currentDate, commitCount)
    const type = this.inferCommitType(taskState.objective, taskState.filesChanged)
    const scope = this.inferScope(taskState.filesChanged)

    let summary = taskState.objective.trim().replace(/\.$/, "")
    if (summary.length > 50) {
      summary = summary.slice(0, 47) + "..."
    }

    const header = scope ? `${type}(${scope}): ${summary}` : `${type}: ${summary}`
    const bodyLines: string[] = ["", `Version: ${calver}`, ""]

    if (taskState.decisions.length > 0) {
      bodyLines.push("Key decisions:", ...taskState.decisions.map((d) => `- ${d}`), "")
    }

    if (verification) {
      bodyLines.push("Verification:", `- Multi-Tier Status: ${verification.correct ? "PASSED" : "FAILED"}`)
      for (const t of verification.tierResults) {
        bodyLines.push(`  * ${t.name}: ${t.passed ? "PASS" : "FAIL"} (${t.durationMs}ms)`)
      }
    }

    const body = bodyLines.join("\n").trim()
    const fullMessage = `${header}\n\n${body}`

    return {
      type,
      scope,
      summary,
      calver,
      fullMessage,
      body,
    }
  }

  static synthesizePullRequest(options: PullRequestSynthesisOptions): GeneratedPullRequest {
    const { taskState, verification, calver = "v26.08.30.1" } = options
    const type = this.inferCommitType(taskState.objective, taskState.filesChanged)
    const scope = this.inferScope(taskState.filesChanged)
    const title = scope
      ? `${type}(${scope}): ${taskState.objective} [${calver}]`
      : `${type}: ${taskState.objective} [${calver}]`

    const bodyParts: string[] = [
      `## Summary`,
      taskState.objective,
      "",
      `### Release Version`,
      `\`${calver}\``,
      "",
      `### Changes Made`,
    ]

    if (taskState.filesChanged.length > 0) {
      bodyParts.push(...taskState.filesChanged.map((f) => `- \`${f}\``))
    }

    bodyParts.push("", "### Verification Evidence")
    if (verification) {
      bodyParts.push(
        `| Tier | Name | Result | Duration |`,
        `| :--- | :--- | :--- | :--- |`,
      )
      for (const t of verification.tierResults) {
        bodyParts.push(`| Tier ${t.tier} | ${t.name} | ${t.passed ? "✅ PASS" : "❌ FAIL"} | ${t.durationMs}ms |`)
      }
    }

    return {
      title,
      body: bodyParts.join("\n"),
    }
  }
}
