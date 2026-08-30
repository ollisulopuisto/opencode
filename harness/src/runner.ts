/**
 * OpenCode Harness V5 - Orchestrator & OpenCode Subprocess Runner
 * 
 * Drives headless OpenCode execution, enforces state machine transitions,
 * normalizes verbose tool outputs, persists task state across epochs,
 * monitors real-time streaming JSON events, and executes verification gates.
 */

import { TaskStateMachine, type CanonicalState } from "./state"
import { VerificationGate, type VerificationResult } from "./verifier"
import { LoopDetector, type ToolCallEvent } from "./loop-detector"
import { ChangeBudgetGuard, type ChangeBudget } from "./budget"
import { FailureClassifier, type FailureDiagnosis } from "./failure"
import { TaskTelemetry, type TaskMetrics } from "./observability"
import { TaskStatePersistence } from "./persistence"
import { ToolOutputNormalizer } from "./normalizer"
import { ContextBridge } from "./context-bridge"
import { ModelRouter } from "./model-router"
import { MultiTierVerifierEngine, type MultiTierVerificationResult } from "./verifier-engine"

import { TaskComplexityClassifier, type ComplexityAssessment } from "./classifier"
import { TaskPlanner, type ExecutionPlan } from "./planner"
import { PlanValidator } from "./plan-validator"

export interface HarnessTaskConfig {
  taskId: string
  objective: string
  cwd: string
  model?: string
  agent?: string
  verificationCmd?: string
  budget?: Partial<ChangeBudget>
  maxRecoveries?: number
  timeoutMs?: number
  enablePersistence?: boolean
  skipPlanning?: boolean
}

export interface HarnessRunResult {
  success: boolean
  taskId: string
  finalState: CanonicalState
  metrics: TaskMetrics
  verification?: MultiTierVerificationResult
  plan?: ExecutionPlan
  failures: string[]
}

export class OpenCodeHarnessRunner {
  private config: HarnessTaskConfig
  private stateMachine: TaskStateMachine
  private loopDetector: LoopDetector
  private budgetGuard: ChangeBudgetGuard
  private telemetry: TaskTelemetry
  private persistence: TaskStatePersistence
  private normalizer: ToolOutputNormalizer
  private bridge: ContextBridge
  private modelRouter: ModelRouter
  private verifierEngine: MultiTierVerifierEngine
  private plan?: ExecutionPlan

  constructor(config: HarnessTaskConfig) {
    this.modelRouter = new ModelRouter()
    const activeModel = config.model ?? this.modelRouter.selectModel()

    this.config = {
      model: activeModel,
      agent: "build",
      maxRecoveries: 2,
      timeoutMs: 180_000,
      enablePersistence: true,
      skipPlanning: false,
      ...config,
      model: activeModel,
    }
    this.stateMachine = new TaskStateMachine(this.config.taskId, this.config.objective)
    this.loopDetector = new LoopDetector()
    this.budgetGuard = new ChangeBudgetGuard(this.config.budget)
    this.telemetry = new TaskTelemetry(this.config.taskId, this.config.model)
    this.persistence = new TaskStatePersistence(this.config.cwd)
    this.normalizer = new ToolOutputNormalizer({
      logsDir: `${this.config.cwd}/.opencode/logs`,
    })
    this.bridge = new ContextBridge({
      persistence: this.persistence,
      budgetGuard: this.budgetGuard,
      baseDir: this.config.cwd,
    })
    this.verifierEngine = new MultiTierVerifierEngine(this.config.cwd)
  }

  /**
   * Execute the full canonical harness execution lifecycle.
   */
  async run(): Promise<HarnessRunResult> {
    console.log(`[Harness] Starting task ${this.config.taskId}: "${this.config.objective}"`)
    
    // Checkpoint initial state
    if (this.config.enablePersistence) {
      this.bridge.checkpoint(this.stateMachine, "init")
    }

    // 1. Planning & Complexity Assessment (Phase 4)
    const assessment = TaskComplexityClassifier.classify(
      this.config.objective,
      this.stateMachine.snapshot.constraints
    )
    console.log(`[Harness] Complexity: ${assessment.complexity} (${assessment.rationale})`)

    if (assessment.requiresDecomposition && !this.config.skipPlanning) {
      this.stateMachine.transition("PLAN", "Task requires structured decomposition")
      this.plan = TaskPlanner.createPlan(this.config.objective, {
        constraints: this.stateMachine.snapshot.constraints,
      })
      const validation = PlanValidator.validate(this.plan)
      if (!validation.valid) {
        console.warn(`[Harness] Plan validation warnings: ${validation.errors.join("; ")}`)
      }

      this.stateMachine.transition("DECOMPOSE", "Decomposing task into bounded work units")
      for (const unit of this.plan.workUnits) {
        this.stateMachine.addWorkUnit(unit)
      }
      if (this.plan.workUnits.length > 0) {
        this.stateMachine.setActiveWorkUnit(this.plan.workUnits[0].id)
      }
    }

    // 2. Transition to EXECUTE
    this.stateMachine.transition("EXECUTE", "Starting implementation execution")

    let prompt = this.bridge.buildInitialPrompt(this.stateMachine)
    let recoveryCount = 0
    let sessionId: string | undefined

    while (recoveryCount <= (this.config.maxRecoveries ?? 2)) {
      this.telemetry.recordTurn()
      this.stateMachine.incrementTurn()
      
      // Run OpenCode subprocess turn
      const turnOutcome = await this.runOpenCodeTurn(prompt, sessionId)
      sessionId = turnOutcome.sessionId ?? sessionId

      // Checkpoint post-turn
      if (this.config.enablePersistence) {
        this.bridge.checkpoint(this.stateMachine, `turn_${this.stateMachine.snapshot.qwenTurns}`)
      }

      if (turnOutcome.interruptedByLoop) {
        console.warn(`[Harness] Turn halted by Loop Detector on step ${turnOutcome.stepCount}`)
        this.telemetry.recordLoopHalt()
        this.stateMachine.transition("RECOVER", "Loop detected during tool execution")
        this.stateMachine.recordFailure("LOOP_DETECTED", "Repeated tool calls detected", turnOutcome.stepCount)
        
        const diagnosis = FailureClassifier.diagnose("Loop detected: identical tool calls repeated", 1, recoveryCount)
        prompt = FailureClassifier.buildRecoveryPrompt(diagnosis, this.config.objective)
        recoveryCount++
        continue
      }

      // 2. State: VERIFY
      this.stateMachine.transition("VERIFY", "Turn settled; executing multi-tier verification engine")
      
      console.log(`[Harness] Running Multi-Tier Verification Engine...`)
      const verificationResult = await this.verifierEngine.runFullVerification({
        cwd: this.config.cwd,
        changedFiles: this.stateMachine.snapshot.filesChanged,
        explicitCmd: this.config.verificationCmd,
      })

      for (const tier of verificationResult.tierResults) {
        this.telemetry.recordTest(tier.passed)
        this.stateMachine.recordTestResult(tier.name, tier.passed, tier.durationMs, tier.output)
      }

      if (verificationResult.correct) {
        console.log(`[Harness] Multi-Tier Verification Engine Passed (Confidence: ${(verificationResult.confidence * 100).toFixed(0)}%)!`)
        const completeResult = this.stateMachine.transition("COMPLETE", "Multi-tier verification passed with 100% confidence")
        if (this.config.enablePersistence) {
          this.bridge.checkpoint(this.stateMachine, "complete_verified")
        }
        return {
          success: completeResult.success,
          taskId: this.config.taskId,
          finalState: this.stateMachine.currentState,
          metrics: this.telemetry.finish(true),
          verification: verificationResult,
          failures: [],
        }
      }

      // 3. Verification Failed -> RECOVER
      console.warn(`[Harness] Multi-Tier Verification Failed on Tier ${verificationResult.failedTier}`)
      const failureMsg = verificationResult.diagnostics[0] ?? "Verification failed"
      this.stateMachine.transition("RECOVER", `Verification failed: ${failureMsg}`)
      this.stateMachine.recordFailure("TEST_FAILURE", failureMsg, turnOutcome.stepCount, verificationResult.diagnostics.join("; "))
      this.telemetry.recordFailureType("TEST_FAILURE")

      recoveryCount++
      if (recoveryCount > (this.config.maxRecoveries ?? 2)) {
        console.error(`[Harness] Max recovery attempts (${this.config.maxRecoveries}) exceeded.`)
        this.stateMachine.transition("BLOCKED", "Exceeded max autonomous recovery attempts")
        if (this.config.enablePersistence) {
          this.bridge.checkpoint(this.stateMachine, "blocked")
        }
        return {
          success: false,
          taskId: this.config.taskId,
          finalState: this.stateMachine.currentState,
          metrics: this.telemetry.finish(false),
          verification: verificationResult,
          failures: verificationResult.diagnostics,
        }
      }

      const diagnosis = FailureClassifier.diagnose(
        verificationResult.diagnostics.join("\n"),
        recoveryCount,
        recoveryCount
      )
      prompt = FailureClassifier.buildRecoveryPrompt(diagnosis, this.config.objective)
      this.stateMachine.transition("EXECUTE", "Executing recovery attempt")
    }

    this.stateMachine.transition("BLOCKED", "Exhausted recovery attempts")
    if (this.config.enablePersistence) {
      this.bridge.checkpoint(this.stateMachine, "blocked_exhausted")
    }
    return {
      success: false,
      taskId: this.config.taskId,
      finalState: this.stateMachine.currentState,
      metrics: this.telemetry.finish(false),
      failures: ["Exhausted recovery attempts"],
    }
  }

  /**
   * Run one headless OpenCode turn via streaming JSON.
   */
  private async runOpenCodeTurn(
    promptText: string,
    sessionId?: string
  ): Promise<{ sessionId?: string; interruptedByLoop: boolean; stepCount: number }> {
    const args = [
      "opencode",
      "run",
      promptText,
      "--format",
      "json",
      "--auto",
      "--model",
      this.config.model!,
      "--agent",
      this.config.agent!,
      "--dir",
      this.config.cwd,
    ]

    if (sessionId) {
      args.push("--session", sessionId, "--continue")
    }

    const opencodeDir = `${this.config.cwd}/.opencode`
    const proc = Bun.spawn(args, {
      cwd: this.config.cwd,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        XDG_DATA_HOME: process.env.XDG_DATA_HOME ?? `${opencodeDir}/data`,
        XDG_CACHE_HOME: process.env.XDG_CACHE_HOME ?? `${opencodeDir}/cache`,
        XDG_STATE_HOME: process.env.XDG_STATE_HOME ?? `${opencodeDir}/state`,
      },
    })

    let capturedSessionId: string | undefined = sessionId
    let interruptedByLoop = false
    let stepCount = 0

    // Read stdout line by line
    const reader = (proc.stdout as ReadableStream<Uint8Array>).getReader()
    const decoder = new TextDecoder()
    let buffer = ""

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n")
      buffer = lines.pop() ?? ""

      for (const line of lines) {
        if (!line.trim()) continue
        try {
          const event = JSON.parse(line)
          if (event.sessionID && !capturedSessionId) {
            capturedSessionId = event.sessionID
          }

          if (event.type === "step_start") {
            stepCount++
          }

          if (event.type === "tool_use" && event.part) {
            this.telemetry.recordToolCall()
            const part = event.part
            const toolName = part.tool ?? part.name ?? "unknown"
            const toolArgs = part.input ?? part.args ?? {}
            const toolStatus = part.state?.status === "error" ? "error" : "completed"
            const rawToolOutput = part.state?.error ?? part.state?.output ?? ""

            // Normalize tool output
            const normalized = this.normalizer.normalize(toolName, String(rawToolOutput))

            const toolEvent: ToolCallEvent = {
              id: part.id ?? String(Date.now()),
              tool: toolName,
              args: toolArgs,
              output: normalized.summary,
              status: toolStatus,
              timestamp: Date.now(),
            }

            // Check budget if modifying files
            if (toolName === "edit" || toolName === "write" || toolName === "apply-patch") {
              const targetPath = (toolArgs.path || toolArgs.file || toolArgs.filePath) as string
              if (targetPath) {
                const budgetStatus = this.budgetGuard.recordMutation(targetPath, 10, 0)
                this.stateMachine.recordFileMutation(targetPath, 10, 0)
                this.telemetry.recordEdit(targetPath)
                if (!budgetStatus.allowed) {
                  this.telemetry.recordBudgetViolation()
                  console.warn(`[Harness] Budget violation: ${budgetStatus.violations.join(", ")}`)
                }
              }
            }

            // Check loop detector
            const loopCheck = this.loopDetector.record(toolEvent)
            if (loopCheck.loopDetected) {
              interruptedByLoop = true
              try {
                proc.kill()
              } catch {
                // ignore
              }
              break
            }
          }
        } catch {
          // non-json line, ignore
        }
      }

      if (interruptedByLoop) break
    }

    await proc.exited
    return {
      sessionId: capturedSessionId,
      interruptedByLoop,
      stepCount,
    }
  }
}
