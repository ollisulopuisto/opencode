export * as HarnessVerifier from "./verifier"

import fs from "fs"
import path from "path"
import { TestMapper } from "./test-mapper"
import { VerifierPolicy, type VerificationTierConfig } from "./verifier-policy"

export interface VerificationResult {
  readonly correct: boolean
  readonly confidence: number
  readonly durationMs: number
  readonly exitCode: number
  readonly stdout: string
  readonly stderr: string
  readonly command: string
  readonly issues: readonly string[]
  readonly missingTests: readonly string[]
  readonly regressions: readonly string[]
}

export interface VerificationOptions {
  readonly cwd: string
  readonly timeoutMs?: number
  readonly env?: Readonly<Record<string, string>>
}

export interface TierExecutionResult {
  readonly tier: 0 | 1 | 2 | 3
  readonly name: string
  readonly command?: string
  readonly passed: boolean
  readonly durationMs: number
  readonly exitCode: number
  readonly output: string
  readonly issues: readonly string[]
}

export interface MultiTierVerificationResult {
  readonly correct: boolean
  readonly confidence: number
  readonly tierResults: readonly TierExecutionResult[]
  readonly totalDurationMs: number
  readonly failedTier?: 0 | 1 | 2 | 3
  readonly diagnostics: readonly string[]
  readonly regressions: readonly string[]
}

export interface MultiTierOptions {
  readonly cwd: string
  readonly changedFiles?: readonly string[]
  readonly explicitCmd?: string
  readonly policy?: VerificationTierConfig
  readonly skipTiers?: readonly (0 | 1 | 2 | 3)[]
}

export class VerificationGate {
  static async verify(command: string, options: VerificationOptions): Promise<VerificationResult> {
    const start = Date.now()
    const timeoutMs = options.timeoutMs ?? 60_000

    const proc = Bun.spawn(["sh", "-c", command], {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdout: "pipe",
      stderr: "pipe",
    })

    const timer = setTimeout(() => {
      proc.kill()
    }, timeoutMs)

    const [stdoutBuf, stderrBuf, exitCode] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ])

    clearTimeout(timer)
    const durationMs = Date.now() - start
    const issues: string[] = []

    if (exitCode !== 0) {
      issues.push(`Command exited with status code ${exitCode}`)
      if (stderrBuf.trim()) {
        issues.push(stderrBuf.trim().slice(0, 1000))
      }
    }

    return {
      correct: exitCode === 0,
      confidence: exitCode === 0 ? 1.0 : 0.0,
      durationMs,
      exitCode,
      stdout: stdoutBuf,
      stderr: stderrBuf,
      command,
      issues,
      missingTests: [],
      regressions: exitCode !== 0 ? issues : [],
    }
  }
}

export class MultiTierVerifierEngine {
  private readonly workspaceRoot: string
  private readonly testMapper: TestMapper
  private readonly policy: VerificationTierConfig

  constructor(workspaceRoot: string = process.cwd(), customPolicy?: VerificationTierConfig) {
    this.workspaceRoot = path.resolve(workspaceRoot)
    this.testMapper = new TestMapper(this.workspaceRoot)
    const policyDiscoverer = new VerifierPolicy(this.workspaceRoot)
    this.policy = customPolicy ?? policyDiscoverer.discoverPolicy()
  }

  async runFullVerification(options: MultiTierOptions): Promise<MultiTierVerificationResult> {
    const cwd = options.cwd || this.workspaceRoot
    const changedFiles = options.changedFiles ?? []
    const tierResults: TierExecutionResult[] = []
    const startTime = Date.now()
    const diagnostics: string[] = []
    const regressions: string[] = []
    const skipTiers = new Set(options.skipTiers ?? [])

    // Tier 0: Fast Static Analysis (<2s)
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

    // Tier 1: Scoped Targeted Testing
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

    // Tier 2: Full Workspace Regression
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

    // Tier 3: Diff & Assertion Integrity Audit
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

  private auditDiffIntegrity(cwd: string, changedFiles: readonly string[]): {
    readonly passed: boolean
    readonly issues: readonly string[]
  } {
    const issues: string[] = []

    for (const file of changedFiles) {
      const fullPath = path.resolve(cwd, file)
      if (!fs.existsSync(fullPath)) continue

      const content = fs.readFileSync(fullPath, "utf-8")

      if (content.includes(".skip(") || content.includes(".only(") || content.includes("it.todo(")) {
        issues.push(`Test file '${file}' contains disabled or exclusive tests (.skip / .only / .todo)`)
      }
      if (content.includes("@pytest.mark.skip") || content.includes("@unittest.skip")) {
        issues.push(`Python test file '${file}' contains skipped test decorator (@pytest.mark.skip)`)
      }
      if (content.includes("// it(") || content.includes("// test(") || content.includes("// expect(")) {
        issues.push(`File '${file}' contains commented-out test assertions (// it / // test / // expect)`)
      }
      if (/\b(it|test)\s*\(\s*["'`][^"'`]+["'`]\s*,\s*(\(\s*\)|async\s*\(\s*\))\s*=>\s*\{\s*\}\s*\)/.test(content)) {
        issues.push(`Test file '${file}' contains empty vacuous test body with no assertions`)
      }
      if (/expect\s*\(\s*true\s*\)\s*\.toBe\s*\(\s*true\s*\)/.test(content) || /assert\s+True\b/.test(content)) {
        issues.push(`Test file '${file}' contains trivial dummy assertion (expect(true).toBe(true))`)
      }
    }

    return {
      passed: issues.length === 0,
      issues,
    }
  }

  private buildResult(
    correct: boolean,
    tierResults: readonly TierExecutionResult[],
    startTime: number,
    diagnostics: readonly string[],
    regressions: readonly string[],
    failedTier?: 0 | 1 | 2 | 3,
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
