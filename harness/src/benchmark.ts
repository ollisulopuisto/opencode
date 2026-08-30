/**
 * OpenCode Harness V5 - Baseline Benchmark Suite
 * 
 * Defines and runs standardized coding tasks across 6 categories:
 * 1. Bug Fixes (10)
 * 2. Features (10)
 * 3. Refactors (10)
 * 4. Debugging Tasks (10)
 * 5. Multi-File Changes (10)
 * 6. Unfamiliar Codebase Tasks (10)
 */

import { OpenCodeHarnessRunner, type HarnessTaskConfig, type HarnessRunResult } from "./runner"
import { type TaskMetrics } from "./observability"

export interface BenchmarkTaskDefinition {
  id: string
  category: "bugfix" | "feature" | "refactor" | "debugging" | "multifile" | "unfamiliar"
  title: string
  objective: string
  setupScript?: string
  verificationCmd: string
  budget?: {
    maxFiles: number
    maxLinesAdded: number
    maxLinesDeleted: number
    writeSet: string[]
  }
}

export interface BenchmarkSuiteResult {
  suiteName: string
  totalTasks: number
  verifiedSuccessCount: number
  firstPassSuccessCount: number
  totalDurationMs: number
  totalQwenTurns: number
  totalToolCalls: number
  totalLoopHalts: number
  totalBudgetViolations: number
  taskResults: HarnessRunResult[]
}

export class BenchmarkRunner {
  private tasks: BenchmarkTaskDefinition[] = []

  addTask(task: BenchmarkTaskDefinition): void {
    this.tasks.push(task)
  }

  /**
   * Initialize standard 60-task benchmark definitions.
   */
  static createStandardBenchmarkSuite(): BenchmarkTaskDefinition[] {
    const tasks: BenchmarkTaskDefinition[] = []

    // 10 Bug Fix Tasks
    for (let i = 1; i <= 10; i++) {
      tasks.push({
        id: `bench_bugfix_${i}`,
        category: "bugfix",
        title: `Bug Fix #${i}: Fix edge case in data parsing`,
        objective: `Fix off-by-one error and null check in parsing helper #${i}`,
        verificationCmd: "bun test",
        budget: {
          maxFiles: 2,
          maxLinesAdded: 30,
          maxLinesDeleted: 10,
          writeSet: ["src/**/*.ts"],
        },
      })
    }

    // 10 Feature Tasks
    for (let i = 1; i <= 10; i++) {
      tasks.push({
        id: `bench_feature_${i}`,
        category: "feature",
        title: `Feature #${i}: Implement option flags`,
        objective: `Add support for optional configuration parameter #${i} with validation`,
        verificationCmd: "bun test",
        budget: {
          maxFiles: 3,
          maxLinesAdded: 80,
          maxLinesDeleted: 10,
          writeSet: ["src/**/*.ts"],
        },
      })
    }

    // 10 Refactor Tasks
    for (let i = 1; i <= 10; i++) {
      tasks.push({
        id: `bench_refactor_${i}`,
        category: "refactor",
        title: `Refactor #${i}: Extract modular utility`,
        objective: `Refactor duplicate logic in module #${i} into a pure helper function`,
        verificationCmd: "bun test",
        budget: {
          maxFiles: 4,
          maxLinesAdded: 50,
          maxLinesDeleted: 60,
          writeSet: ["src/**/*.ts"],
        },
      })
    }

    // 10 Debugging Tasks
    for (let i = 1; i <= 10; i++) {
      tasks.push({
        id: `bench_debugging_${i}`,
        category: "debugging",
        title: `Debugging #${i}: Diagnose subtle async race condition`,
        objective: `Locate failing promise resolution in pipeline #${i} and make it deterministic`,
        verificationCmd: "bun test",
        budget: {
          maxFiles: 3,
          maxLinesAdded: 40,
          maxLinesDeleted: 20,
          writeSet: ["src/**/*.ts"],
        },
      })
    }

    // 10 Multi-File Tasks
    for (let i = 1; i <= 10; i++) {
      tasks.push({
        id: `bench_multifile_${i}`,
        category: "multifile",
        title: `Multi-File #${i}: Schema and handler update`,
        objective: `Update domain schema and all 3 consumer handlers in module #${i}`,
        verificationCmd: "bun test",
        budget: {
          maxFiles: 6,
          maxLinesAdded: 150,
          maxLinesDeleted: 50,
          writeSet: ["src/**/*.ts"],
        },
      })
    }

    // 10 Unfamiliar Codebase Tasks
    for (let i = 1; i <= 10; i++) {
      tasks.push({
        id: `bench_unfamiliar_${i}`,
        category: "unfamiliar",
        title: `Unfamiliar Codebase #${i}: Locate and modify subsystem`,
        objective: `Explore unfamiliar subsystem #${i}, locate entrypoint, and add trace logging`,
        verificationCmd: "bun test",
        budget: {
          maxFiles: 3,
          maxLinesAdded: 40,
          maxLinesDeleted: 5,
          writeSet: ["src/**/*.ts"],
        },
      })
    }

    return tasks
  }

  /**
   * Run a benchmark suite across the configured task set.
   */
  async runSuite(suiteName: string, workspaceDir: string): Promise<BenchmarkSuiteResult> {
    const results: HarnessRunResult[] = []

    for (const task of this.tasks) {
      if (task.setupScript) {
        await Bun.spawn(["sh", "-c", task.setupScript], { cwd: workspaceDir }).exited
      }

      const runner = new OpenCodeHarnessRunner({
        taskId: task.id,
        objective: task.objective,
        cwd: workspaceDir,
        verificationCmd: task.verificationCmd,
        budget: task.budget,
      })

      const result = await runner.run()
      results.push(result)
    }

    return this.aggregateResults(suiteName, results)
  }

  private aggregateResults(suiteName: string, results: HarnessRunResult[]): BenchmarkSuiteResult {
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

  static toMarkdownReport(suite: BenchmarkSuiteResult): string {
    const verifiedRate = ((suite.verifiedSuccessCount / suite.totalTasks) * 100).toFixed(1)
    const firstPassRate = ((suite.firstPassSuccessCount / suite.totalTasks) * 100).toFixed(1)

    return [
      `# Benchmark Report: ${suite.suiteName}`,
      ``,
      `| Metric | Value |`,
      `| :--- | :--- |`,
      `| **Total Tasks** | ${suite.totalTasks} |`,
      `| **Verified Success Rate** | **${verifiedRate}%** (${suite.verifiedSuccessCount}/${suite.totalTasks}) |`,
      `| **First-Pass Success Rate** | **${firstPassRate}%** (${suite.firstPassSuccessCount}/${suite.totalTasks}) |`,
      `| **Total Duration** | ${(suite.totalDurationMs / 1000).toFixed(1)}s |`,
      `| **Total Qwen Turns** | ${suite.totalQwenTurns} |`,
      `| **Total Tool Calls** | ${suite.totalToolCalls} |`,
      `| **Loop Halts Prevented** | ${suite.totalLoopHalts} |`,
      `| **Change Budget Violations** | ${suite.totalBudgetViolations} |`,
      ``,
    ].join("\n")
  }
}
