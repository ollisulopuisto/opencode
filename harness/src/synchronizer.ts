/**
 * OpenCode Harness V5.2 - Multi-Worker Synchronization Engine
 * 
 * Merges and integrates diffs/patches from parallel workers into the primary workspace,
 * detecting merge conflicts and validating integration invariants (§11).
 */

import * as fs from "node:fs"
import * as path from "node:path"
import { type WorkerTaskResult } from "./worker-pool"
import { MultiTierVerifierEngine, type MultiTierVerificationResult } from "./verifier-engine"

export interface IntegrationSummary {
  success: boolean
  mergedUnits: string[]
  conflicts: string[]
  verification?: MultiTierVerificationResult
  totalDurationMs: number
}

export class WorkerSynchronizer {
  private workspaceRoot: string
  private verifier: MultiTierVerifierEngine

  constructor(workspaceRoot: string = process.cwd()) {
    this.workspaceRoot = path.resolve(workspaceRoot)
    this.verifier = new MultiTierVerifierEngine(this.workspaceRoot)
  }

  /**
   * Applies and synchronizes results from multiple parallel workers.
   */
  async synchronize(
    results: WorkerTaskResult[],
    options: { runVerification?: boolean; verificationCmd?: string } = {}
  ): Promise<IntegrationSummary> {
    const startTime = Date.now()
    const mergedUnits: string[] = []
    const conflicts: string[] = []
    const allModifiedFiles: string[] = []

    for (const res of results) {
      if (!res.success) {
        conflicts.push(`Worker '${res.workerId}' for unit '${res.workUnitId}' reported failure: ${res.error ?? "unknown"}`)
        continue
      }

      // If a patch is provided, apply it
      if (res.patch && res.patch.trim().length > 0) {
        const patchResult = await this.applyPatch(res.patch)
        if (!patchResult.success) {
          conflicts.push(`Patch from worker '${res.workerId}' failed to apply cleanly: ${patchResult.error}`)
          continue
        }
      }

      mergedUnits.push(res.workUnitId)
      allModifiedFiles.push(...res.filesModified)
    }

    if (conflicts.length > 0) {
      return {
        success: false,
        mergedUnits,
        conflicts,
        totalDurationMs: Date.now() - startTime,
      }
    }

    // Run multi-tier verification across integrated changes
    let verification: MultiTierVerificationResult | undefined
    if (options.runVerification !== false) {
      verification = await this.verifier.runFullVerification({
        cwd: this.workspaceRoot,
        changedFiles: allModifiedFiles,
        explicitCmd: options.verificationCmd,
      })

      if (!verification.correct) {
        conflicts.push(`Integration verification failed on Tier ${verification.failedTier}: ${verification.diagnostics.join("; ")}`)
        return {
          success: false,
          mergedUnits,
          conflicts,
          verification,
          totalDurationMs: Date.now() - startTime,
        }
      }
    }

    return {
      success: true,
      mergedUnits,
      conflicts: [],
      verification,
      totalDurationMs: Date.now() - startTime,
    }
  }

  /**
   * Applies a unified diff patch to the target workspace.
   */
  private async applyPatch(patchText: string): Promise<{ success: boolean; error?: string }> {
    try {
      const proc = Bun.spawn(["git", "apply", "--whitespace=nowarn"], {
        cwd: this.workspaceRoot,
        stdin: "pipe",
        stdout: "pipe",
        stderr: "pipe",
      })

      if (proc.stdin) {
        const writer = (proc.stdin as WritableStream<Uint8Array>).getWriter()
        await writer.write(new TextEncoder().encode(patchText))
        await writer.close()
      }

      const exitCode = await proc.exited
      if (exitCode === 0) {
        return { success: true }
      }

      const stderr = await new Response(proc.stderr).text()
      return { success: false, error: stderr || `git apply exited with code ${exitCode}` }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  }
}
