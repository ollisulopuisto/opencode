/**
 * OpenCode Harness V5 - Observability & Telemetry Collector
 * 
 * Aggregates structured task execution metrics for empirical benchmark evaluation.
 */

export interface TaskMetrics {
  taskId: string
  model: string
  startTime: number
  endTime?: number
  durationMs?: number
  timeToFirstEditMs?: number
  timeToVerifiedSuccessMs?: number
  qwenTurns: number
  toolCallsCount: number
  filesChanged: string[]
  linesAdded: number
  linesDeleted: number
  testsRunCount: number
  testsFailedCount: number
  loopHaltsCount: number
  budgetViolationsCount: number
  geminiInterventionsCount: number
  verifiedSuccess: boolean
  firstPassSuccess: boolean
  failureTypes: string[]
}

export class TaskTelemetry {
  private metrics: TaskMetrics

  constructor(taskId: string, model: string = "hetzner/Qwen3.8-27B") {
    this.metrics = {
      taskId,
      model,
      startTime: Date.now(),
      qwenTurns: 0,
      toolCallsCount: 0,
      filesChanged: [],
      linesAdded: 0,
      linesDeleted: 0,
      testsRunCount: 0,
      testsFailedCount: 0,
      loopHaltsCount: 0,
      budgetViolationsCount: 0,
      geminiInterventionsCount: 0,
      verifiedSuccess: false,
      firstPassSuccess: true,
      failureTypes: [],
    }
  }

  recordToolCall(): void {
    this.metrics.toolCallsCount += 1
  }

  recordTurn(): void {
    this.metrics.qwenTurns += 1
  }

  recordEdit(filePath: string, added: number = 0, deleted: number = 0): void {
    if (!this.metrics.timeToFirstEditMs) {
      this.metrics.timeToFirstEditMs = Date.now() - this.metrics.startTime
    }
    if (!this.metrics.filesChanged.includes(filePath)) {
      this.metrics.filesChanged.push(filePath)
    }
    this.metrics.linesAdded += added
    this.metrics.linesDeleted += deleted
  }

  recordTest(passed: boolean): void {
    this.metrics.testsRunCount += 1
    if (!passed) {
      this.metrics.testsFailedCount += 1
      this.metrics.firstPassSuccess = false
    }
  }

  recordLoopHalt(): void {
    this.metrics.loopHaltsCount += 1
    this.metrics.firstPassSuccess = false
  }

  recordBudgetViolation(): void {
    this.metrics.budgetViolationsCount += 1
  }

  recordGeminiIntervention(): void {
    this.metrics.geminiInterventionsCount += 1
  }

  recordFailureType(type: string): void {
    if (!this.metrics.failureTypes.includes(type)) {
      this.metrics.failureTypes.push(type)
    }
    this.metrics.firstPassSuccess = false
  }

  finish(verifiedSuccess: boolean): TaskMetrics {
    this.metrics.endTime = Date.now()
    this.metrics.durationMs = this.metrics.endTime - this.metrics.startTime
    this.metrics.verifiedSuccess = verifiedSuccess
    if (verifiedSuccess && !this.metrics.timeToVerifiedSuccessMs) {
      this.metrics.timeToVerifiedSuccessMs = this.metrics.durationMs
    }
    return this.snapshot
  }

  get snapshot(): Readonly<TaskMetrics> {
    return JSON.parse(JSON.stringify(this.metrics))
  }

  toMarkdownSummary(): string {
    const m = this.metrics
    return [
      `### Task Metrics: ${m.taskId}`,
      `- **Model:** \`${m.model}\``,
      `- **Verified Success:** ${m.verifiedSuccess ? "✅ YES" : "❌ NO"}`,
      `- **First-Pass Success:** ${m.firstPassSuccess ? "✅ YES" : "❌ NO"}`,
      `- **Duration:** ${((m.durationMs ?? 0) / 1000).toFixed(2)}s`,
      `- **Time to First Edit:** ${m.timeToFirstEditMs ? `${(m.timeToFirstEditMs / 1000).toFixed(2)}s` : "N/A"}`,
      `- **Qwen Turns:** ${m.qwenTurns}`,
      `- **Tool Calls:** ${m.toolCallsCount}`,
      `- **Files Changed:** ${m.filesChanged.length} (${m.filesChanged.join(", ") || "none"})`,
      `- **Lines Added / Deleted:** +${m.linesAdded} / -${m.linesDeleted}`,
      `- **Tests Run / Failed:** ${m.testsRunCount} / ${m.testsFailedCount}`,
      `- **Loop Halts:** ${m.loopHaltsCount}`,
      `- **Budget Violations:** ${m.budgetViolationsCount}`,
      `- **Gemini Interventions:** ${m.geminiInterventionsCount}`,
      m.failureTypes.length > 0 ? `- **Failure Types:** ${m.failureTypes.join(", ")}` : "",
    ]
      .filter(Boolean)
      .join("\n")
  }
}
