/**
 * OpenCode Harness V5.2 - Parallel Worker Contract & Pool Manager
 * 
 * Manages concurrent execution workers with strictly enforced contracts,
 * isolated write-sets, and resource concurrency bounds (§4, §5).
 */

import { type WorkUnit } from "./state"
import { type WorkerWorkspace } from "./worktree-manager"

export interface WorkerContract {
  workerId: string
  workUnit: WorkUnit
  objective: string
  writeSetWhitelist: string[]
  relevantReadFiles: string[]
  constraints: string[]
  verificationCmd?: string
  expectedArtifacts: string[]
}

export interface WorkerTaskResult {
  workerId: string
  workUnitId: string
  success: boolean
  filesModified: string[]
  durationMs: number
  patch: string
  error?: string
}

export class WorkerPoolManager {
  private maxWorkers: number
  private activeWorkers: Map<string, WorkerContract> = new Map()

  constructor(maxWorkers: number = 2) {
    this.maxWorkers = maxWorkers
  }

  /**
   * Formats the canonical Master Design V5.2 Parallel Worker Contract prompt.
   */
  static formatWorkerContractPrompt(contract: WorkerContract): string {
    const lines: string[] = []

    lines.push(`# PARALLEL WORKER CONTRACT [${contract.workerId}]`)
    lines.push(`## 1. OBJECTIVE`)
    lines.push(contract.workUnit.objective)
    lines.push("")

    lines.push(`## 2. WORK UNIT IDENTITY`)
    lines.push(`- **Unit ID:** \`${contract.workUnit.id}\``)
    lines.push(`- **Title:** ${contract.workUnit.title}`)
    lines.push("")

    lines.push(`## 3. STRICT WRITE-SET WHITELIST (MANDATORY CONSTRAINT)`)
    lines.push(`You are STRICTLY CONSTRAINED to modify ONLY the following files:`)
    for (const f of contract.writeSetWhitelist) {
      lines.push(`- \`${f}\``)
    }
    lines.push(`**DO NOT edit, create, or delete any files outside this whitelist.** Modifying other files will be blocked by the change budget guard.`)
    lines.push("")

    lines.push(`## 4. RELEVANT READ-ONLY CONTEXT`)
    if (contract.relevantReadFiles.length > 0) {
      for (const f of contract.relevantReadFiles) {
        lines.push(`- \`${f}\` (read-only reference)`)
      }
    } else {
      lines.push(`*No additional reference files specified.*`)
    }
    lines.push("")

    lines.push(`## 5. INVARIANTS & CONSTRAINTS`)
    if (contract.constraints.length > 0) {
      for (const c of contract.constraints) {
        lines.push(`- ${c}`)
      }
    } else {
      lines.push(`- Preserve existing interfaces and clean test passes.`)
    }
    lines.push("")

    lines.push(`## 6. VERIFICATION TARGET`)
    lines.push(
      contract.verificationCmd
        ? `Ensure targeted command succeeds: \`${contract.verificationCmd}\``
        : `Ensure local tests pass without regression.`
    )

    return lines.join("\n")
  }

  get availableSlots(): number {
    return Math.max(0, this.maxWorkers - this.activeWorkers.size)
  }

  registerWorker(contract: WorkerContract): boolean {
    if (this.activeWorkers.size >= this.maxWorkers) {
      return false
    }
    this.activeWorkers.set(contract.workerId, contract)
    return true
  }

  releaseWorker(workerId: string): void {
    this.activeWorkers.delete(workerId)
  }

  getActiveCount(): number {
    return this.activeWorkers.size
  }
}
