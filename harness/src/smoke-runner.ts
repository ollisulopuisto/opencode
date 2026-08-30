/**
 * OpenCode Harness V5 - Smoke Test Runner
 * 
 * Executes the 6-task canonical smoke benchmark suite across isolated sandboxes.
 */

import * as fs from "node:fs"
import * as path from "node:path"
import * as os from "node:os"
import { SMOKE_TASKS, type SmokeTaskConfig } from "./smoke-fixtures"
import { OpenCodeHarnessRunner, type HarnessRunResult } from "./runner"
import { BenchmarkRunner, type BenchmarkSuiteResult } from "./benchmark"

export interface SmokeRunnerOptions {
  model?: string
  agent?: string
  taskFilter?: string
  preserveSandboxes?: boolean
}

export class SmokeTestRunner {
  private options: SmokeRunnerOptions

  constructor(options: SmokeRunnerOptions = {}) {
    this.options = {
      model: "opencode-go/glm-5.3-flash",
      agent: "build",
      preserveSandboxes: false,
      ...options,
    }
  }

  async run(): Promise<BenchmarkSuiteResult> {
    console.log(`\n======================================================`)
    console.log(`  OpenCode Harness V5 — Smoke Benchmark Suite (6 Tasks)`)
    console.log(`  Model: ${this.options.model} | Agent: ${this.options.agent}`)
    console.log(`======================================================\n`)

    const tasksToRun = this.options.taskFilter
      ? SMOKE_TASKS.filter((t) => t.id === this.options.taskFilter || t.category === this.options.taskFilter)
      : SMOKE_TASKS

    const results: HarnessRunResult[] = []

    for (let i = 0; i < tasksToRun.length; i++) {
      const task = tasksToRun[i]
      console.log(`\n[${i + 1}/${tasksToRun.length}] Running ${task.category.toUpperCase()}: ${task.title}`)

      // Create isolated sandbox
      const sandboxDir = fs.mkdtempSync(path.join(os.tmpdir(), `harness-smoke-${task.id}-`))
      task.setup(sandboxDir)

      const startTime = Date.now()
      try {
        const runner = new OpenCodeHarnessRunner({
          taskId: task.id,
          objective: task.objective,
          cwd: sandboxDir,
          model: this.options.model,
          agent: this.options.agent,
          verificationCmd: task.verificationCmd,
          budget: task.budget,
          maxRecoveries: 2,
        })

        const result = await runner.run()
        results.push(result)

        const statusIcon = result.success ? "✅ PASS" : "❌ FAIL"
        const durationSec = ((Date.now() - startTime) / 1000).toFixed(1)
        console.log(`  -> Result: ${statusIcon} in ${durationSec}s (State: ${result.finalState}, Turns: ${result.metrics.qwenTurns}, Tests: ${result.metrics.testsRunCount})`)
      } catch (err) {
        console.error(`  -> Unexpected error running ${task.id}:`, err)
      } finally {
        if (!this.options.preserveSandboxes) {
          try {
            fs.rmSync(sandboxDir, { recursive: true, force: true })
          } catch {
            // ignore
          }
        }
      }
    }

    const suiteResult = this.aggregate("Smoke Benchmark Suite (6 Tasks)", results)
    const reportMd = BenchmarkRunner.toMarkdownReport(suiteResult)

    console.log("\n" + reportMd)
    return suiteResult
  }

  private aggregate(suiteName: string, results: HarnessRunResult[]): BenchmarkSuiteResult {
    let verifiedSuccessCount = 0
    let firstPassSuccessCount = 0
    let totalDurationMs = 0
    let totalQwenTurns = 0
    let totalToolCalls = 0
    let totalLoopHalts = 0
    let totalBudgetViolations = 0

    for (const r of results) {
      if (r.metrics.verifiedSuccess) verifiedSuccessCount++
      if (r.metrics.firstPassSuccess) firstPassSuccessCount++
      totalDurationMs += r.metrics.durationMs ?? 0
      totalQwenTurns += r.metrics.qwenTurns
      totalToolCalls += r.metrics.toolCallsCount
      totalLoopHalts += r.metrics.loopHaltsCount
      totalBudgetViolations += r.metrics.budgetViolationsCount
    }

    return {
      suiteName,
      totalTasks: results.length,
      verifiedSuccessCount,
      firstPassSuccessCount,
      totalDurationMs,
      totalQwenTurns,
      totalToolCalls,
      totalLoopHalts,
      totalBudgetViolations,
      taskResults: results,
    }
  }
}

// Allow direct execution via CLI `bun src/smoke-runner.ts [taskId|category]`
if (import.meta.main) {
  const filter = process.argv[2]
  const runner = new SmokeTestRunner({ taskFilter: filter })
  await runner.run()
}
