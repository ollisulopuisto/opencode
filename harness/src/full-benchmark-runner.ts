/**
 * OpenCode Harness V5.2 - Full 60-Task Benchmark Suite Runner
 * 
 * Executes the complete 60-task evaluation matrix concurrently across isolated
 * sandbox environments, collecting empirical metrics on pass rates, churn, and speed.
 */

import * as fs from "node:fs"
import * as path from "node:path"
import * as os from "node:os"
import { BenchmarkRunner, type BenchmarkSuiteResult } from "./benchmark"
import { OpenCodeHarnessRunner, type HarnessRunResult } from "./runner"
import { SMOKE_TASKS } from "./smoke-fixtures"
import { ModelRouter } from "./model-router"

export interface FullBenchmarkOptions {
  model?: string
  agent?: string
  concurrency?: number
  reportPath?: string
  limit?: number
  enableDynamicRouting?: boolean
}

export class FullBenchmarkRunner {
  private options: FullBenchmarkOptions
  private router: ModelRouter

  constructor(options: FullBenchmarkOptions = {}) {
    this.options = {
      agent: "build",
      concurrency: 4,
      reportPath: path.resolve(process.cwd(), "opencode-harness-audit/benchmark-60-results.md"),
      enableDynamicRouting: true,
      ...options,
    }
    this.router = new ModelRouter()
  }

  async run(): Promise<BenchmarkSuiteResult> {
    const rawTasks = BenchmarkRunner.createStandardBenchmarkSuite()
    const tasks = this.options.limit ? rawTasks.slice(0, this.options.limit) : rawTasks
    const concurrency = this.options.concurrency ?? 4

    console.log(`\n======================================================`)
    console.log(`  OpenCode Harness V5.2 — Full ${tasks.length}-Task Benchmark Matrix`)
    console.log(`  Dynamic Model Routing: ${this.options.enableDynamicRouting && !this.options.model ? "ENABLED (Multi-Lane)" : "DISABLED"}`)
    console.log(`  Concurrency: ${concurrency} workers`)
    console.log(`======================================================\n`)

    const results: HarnessRunResult[] = []
    let completedCount = 0
    const totalCount = tasks.length

    // Concurrency queue
    const queue = [...tasks]
    const workerPromises: Promise<void>[] = []

    for (let w = 0; w < concurrency; w++) {
      workerPromises.push(
        (async () => {
          while (queue.length > 0) {
            const task = queue.shift()
            if (!task) break

            const taskNum = ++completedCount
            
            // Dynamic multi-lane model selection based on task category
            let assignedModel = this.options.model
            if (!assignedModel && this.options.enableDynamicRouting) {
              if (task.category === "multifile") {
                assignedModel = this.router.selectModelForRole("planner")
              } else if (task.category === "debugging") {
                assignedModel = this.router.selectModelForRole("debugger")
              } else if (task.category === "unfamiliar" || task.category === "refactor") {
                assignedModel = this.router.selectModelForRole("explorer")
              } else {
                assignedModel = this.router.selectModelForRole("implementer")
              }
            }
            assignedModel = assignedModel ?? "opencode-go/glm-5.3-flash"

            console.log(`[Worker ${w + 1}] Starting [${taskNum}/${totalCount}] ${task.id} (${task.category}) -> [${assignedModel}]: ${task.title}`)

            const sandboxDir = fs.mkdtempSync(path.join(os.tmpdir(), `harness-bench-${task.id}-`))
            this.setupTaskFixture(task.id, task.category, sandboxDir)

            const taskStartTime = Date.now()
            try {
              const runner = new OpenCodeHarnessRunner({
                taskId: task.id,
                objective: task.objective,
                cwd: sandboxDir,
                model: assignedModel,
                agent: this.options.agent,
                verificationCmd: task.verificationCmd,
                budget: task.budget,
                maxRecoveries: 2,
                maxSupervisoryInterventions: 2,
              })

              const result = await runner.run()
              results.push(result)

              const statusIcon = result.success ? "✅ PASS" : "❌ FAIL"
              const durationSec = ((Date.now() - taskStartTime) / 1000).toFixed(1)
              console.log(
                `[Worker ${w + 1}] Finished [${taskNum}/${totalCount}] ${task.id} -> ${statusIcon} in ${durationSec}s`
              )
            } catch (err) {
              console.error(`[Worker ${w + 1}] Error on task ${task.id}:`, err)
            } finally {
              try {
                fs.rmSync(sandboxDir, { recursive: true, force: true })
              } catch {
                // ignore cleanup errors
              }
            }
          }
        })()
      )
    }

    await Promise.all(workerPromises)

    const suiteResult = this.aggregate("OpenCode Harness V5.2 60-Task Benchmark Matrix", results)
    const reportMd = BenchmarkRunner.toMarkdownReport(suiteResult)

    if (this.options.reportPath) {
      try {
        fs.mkdirSync(path.dirname(this.options.reportPath), { recursive: true })
        fs.writeFileSync(this.options.reportPath, reportMd)
        console.log(`\n[Benchmark] Report written to: ${this.options.reportPath}`)
      } catch (err) {
        console.error("Failed to write benchmark report:", err)
      }
    }

    console.log("\n" + reportMd)
    return suiteResult
  }

  private setupTaskFixture(id: string, category: string, dir: string): void {
    // Map to canonical smoke templates by category modulo
    const templateIndex = Math.abs(this.hashCode(id)) % SMOKE_TASKS.length
    const template = SMOKE_TASKS[templateIndex]
    template.setup(dir)
  }

  private hashCode(str: string): number {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i)
      hash |= 0
    }
    return hash
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

if (import.meta.main) {
  const runner = new FullBenchmarkRunner({ concurrency: 4 })
  await runner.run()
}
