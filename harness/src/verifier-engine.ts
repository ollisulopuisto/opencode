/**
 * OpenCode Harness V5.2 - Multi-Tier Verification Pipeline & Diff Auditor
 * 
 * Implements Lane 4 (Verifier) multi-tier validation:
 * - Tier 0: Fast static checks (typechecks / linters) < 2s
 * - Tier 1: Scoped unit tests for changed files & direct dependencies
 * - Tier 2: Full workspace regression test suite
 * - Tier 3: Diff audit (checks for disabled/commented-out tests or empty assertions)
 */

import * as fs from "node:fs"
import * as path from "node:path"
import { VerificationGate, type VerificationResult } from "./verifier"
import { TestMapper } from "./test-mapper"
import { VerifierPolicy, type VerificationTierConfig } from "./verifier-policy"

export interface TierExecutionResult {
  tier: 0 | 1 | 2 | 3
  name: string
  command?: string
  passed: boolean
  durationMs: number
  exitCode: number
  output: string
  issues: string[]
}

export interface MultiTierVerificationResult {
  correct: boolean
  confidence: number
  tierResults: TierExecutionResult[]
  totalDurationMs: number
  failedTier?: 0 | 1 | 2 | 3
  diagnostics: string[]
  regressions: string[]
}

export interface MultiTierOptions {
  cwd: string
  changedFiles?: string[]
  explicitCmd?: string
  policy?: VerificationTierConfig
  skipTiers?: Array<0 | 1 | 2 | 3>
}

export class MultiTierVerifierEngine {
  private workspaceRoot: string
  private testMapper: TestMapper
  private policy: VerificationTierConfig

  constructor(workspaceRoot: string = process.cwd(), customPolicy?: VerificationTierConfig) {
    this.workspaceRoot = path.resolve(workspaceRoot)
    this.testMapper = new TestMapper(this.workspaceRoot)
    const policyDiscoverer = new VerifierPolicy(this.workspaceRoot)
    this.policy = customPolicy ?? policyDiscoverer.discoverPolicy()
  }

  /**
   * Runs the full multi-tier verification sequence.
   */
  async runFullVerification(options: MultiTierOptions): Promise<MultiTierVerificationResult> {
    const cwd = options.cwd || this.workspaceRoot
    const changedFiles = options.changedFiles ?? []
    const tierResults: TierExecutionResult[] = []
    const startTime = Date.now()
    const diagnostics: string[] = []
    const regressions: string[] = []

    const skipTiers = new Set(options.skipTiers ?? [])

    // ==========================================
    // Tier 0: Fast Static Analysis (Linters / Typechecks)
    // ==========================================
    if (!skipTiers.has(0) && this.policy.tier0StaticCmds.length > 0) {
      for (const cmd of this.policy.tier0StaticCmds) {
        const res = await VerificationGate.verify(cmd, { cwd, timeoutMs: 15_000 })
        const tierRes: TierExecutionResult = {
          tier: 0,
          name: `Tier 0 Static: ${cmd}`,
          command: cmd,
          passed: res.correct,
          durationMs: res.durationMs,
          exitCode: res.exitCode,
          output: res.stdout + "\n" + res.stderr,
          issues: res.issues,
        }
        tierResults.push(tierRes)

        if (!res.correct) {
          diagnostics.push(...res.issues)
          if (this.policy.fastFail) {
            return this.buildResult(false, tierResults, startTime, diagnostics, regressions, 0)
          }
        }
      }
    }

    // ==========================================
    // Tier 1: Scoped Targeted Testing
    // ==========================================
    if (!skipTiers.has(1) && changedFiles.length > 0) {
      const targetedTests = this.testMapper.findTargetedTests(changedFiles)
      const tier1Cmd = this.policy.tier1TargetedTestTemplate(targetedTests)

      if (tier1Cmd) {
        const res = await VerificationGate.verify(tier1Cmd, { cwd, timeoutMs: 30_000 })
        const tierRes: TierExecutionResult = {
          tier: 1,
          name: `Tier 1 Scoped: ${tier1Cmd}`,
          command: tier1Cmd,
          passed: res.correct,
          durationMs: res.durationMs,
          exitCode: res.exitCode,
          output: res.stdout + "\n" + res.stderr,
          issues: res.issues,
        }
        tierResults.push(tierRes)

        if (!res.correct) {
          diagnostics.push(...res.issues)
          if (this.policy.fastFail) {
            return this.buildResult(false, tierResults, startTime, diagnostics, regressions, 1)
          }
        }
      }
    }

    // ==========================================
    // Tier 2: Full Workspace Regression Test
    // ==========================================
    if (!skipTiers.has(2)) {
      const regressionCmds = options.explicitCmd ? [options.explicitCmd] : this.policy.tier2RegressionCmds
      for (const cmd of regressionCmds) {
        const res = await VerificationGate.verify(cmd, { cwd, timeoutMs: this.policy.timeoutMs })
        const tierRes: TierExecutionResult = {
          tier: 2,
          name: `Tier 2 Regression: ${cmd}`,
          command: cmd,
          passed: res.correct,
          durationMs: res.durationMs,
          exitCode: res.exitCode,
          output: res.stdout + "\n" + res.stderr,
          issues: res.issues,
        }
        tierResults.push(tierRes)

        if (!res.correct) {
          diagnostics.push(...res.issues)
          if (this.policy.fastFail) {
            return this.buildResult(false, tierResults, startTime, diagnostics, regressions, 2)
          }
        }
      }
    }

    // ==========================================
    // Tier 3: Diff & Assertion Integrity Audit
    // ==========================================
    if (!skipTiers.has(3) && changedFiles.length > 0) {
      const diffAudit = this.auditDiffIntegrity(cwd, changedFiles)
      const tierRes: TierExecutionResult = {
        tier: 3,
        name: "Tier 3 Diff & Assertion Integrity Audit",
        passed: diffAudit.passed,
        durationMs: 5,
        exitCode: diffAudit.passed ? 0 : 1,
        output: diffAudit.issues.join("\n"),
        issues: diffAudit.issues,
      }
      tierResults.push(tierRes)

      if (!diffAudit.passed) {
        diagnostics.push(...diffAudit.issues)
        regressions.push(...diffAudit.issues)
        return this.buildResult(false, tierResults, startTime, diagnostics, regressions, 3)
      }
    }

    const allPassed = tierResults.every((t) => t.passed)
    return this.buildResult(allPassed, tierResults, startTime, diagnostics, regressions)
  }

  /**
   * Audits file modifications for test evasion patterns (commented-out tests, skipped tests, disabled assertions, empty test blocks).
   */
  private auditDiffIntegrity(cwd: string, changedFiles: string[]): { passed: boolean; issues: string[] } {
    const issues: string[] = []

    for (const file of changedFiles) {
      const fullPath = path.resolve(cwd, file)
      if (!fs.existsSync(fullPath)) continue

      try {
        const content = fs.readFileSync(fullPath, "utf-8")

        // Check for test evasion anti-patterns
        if (content.includes(".skip(") || content.includes(".only(") || content.includes("it.todo(")) {
          issues.push(`Test file '${file}' contains disabled or exclusive tests (.skip / .only / .todo)`)
        }
        if (content.includes("@pytest.mark.skip") || content.includes("@unittest.skip")) {
          issues.push(`Python test file '${file}' contains skipped test decorator (@pytest.mark.skip)`)
        }
        if (content.includes("// it(") || content.includes("// test(") || content.includes("// expect(")) {
          issues.push(`File '${file}' contains commented-out test assertions (// it / // test / // expect)`)
        }
        // Vacuous/empty test block detection
        if (/\b(it|test)\s*\(\s*["'`][^"'`]+["'`]\s*,\s*(\(\s*\)|async\s*\(\s*\))\s*=>\s*\{\s*\}\s*\)/.test(content)) {
          issues.push(`Test file '${file}' contains empty vacuous test body with no assertions`)
        }
        // Trivial pass dummy assertions
        if (/expect\s*\(\s*true\s*\)\s*\.toBe\s*\(\s*true\s*\)/.test(content) || /assert\s+True\b/.test(content)) {
          issues.push(`Test file '${file}' contains trivial dummy assertion (expect(true).toBe(true))`)
        }
      } catch {
        // ignore
      }
    }

    return {
      passed: issues.length === 0,
      issues,
    }
  }

  private buildResult(
    correct: boolean,
    tierResults: TierExecutionResult[],
    startTime: number,
    diagnostics: string[],
    regressions: string[],
    failedTier?: 0 | 1 | 2 | 3
  ): MultiTierVerificationResult {
    const totalDurationMs = Date.now() - startTime
    const passedCount = tierResults.filter((t) => t.passed).length
    const confidence = tierResults.length > 0 ? passedCount / tierResults.length : 0.0

    return {
      correct,
      confidence,
      tierResults,
      totalDurationMs,
      failedTier,
      diagnostics,
      regressions,
    }
  }
}
