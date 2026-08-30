import type { Argv } from "yargs"
import { UI } from "../ui"
import * as prompts from "@clack/prompts"
import path from "path"
import { existsSync } from "fs"

export const HarnessCommand = {
  command: "harness [objective]",
  describe: "executes autonomous multi-lane engineering harness with verification gates and recovery",
  builder: (yargs: Argv) => {
    return yargs
      .positional("objective", {
        describe: "task objective string for autonomous execution",
        type: "string",
      })
      .option("dir", {
        alias: "d",
        describe: "target repository or workspace directory",
        type: "string",
      })
      .option("model", {
        alias: "m",
        describe: "execution model override (default: opencode-go/glm-5.3-flash)",
        type: "string",
      })
      .option("verify", {
        describe: "explicit verification command override (e.g. 'bun test', 'pytest')",
        type: "string",
      })
      .option("no-planning", {
        describe: "skip DAG task decomposition and plan validation",
        type: "boolean",
        default: false,
      })
      .option("smoke", {
        describe: "run the 6-task canonical smoke benchmark suite",
        type: "boolean",
        default: false,
      })
      .option("bench", {
        describe: "run the full 60-task benchmark matrix",
        type: "boolean",
        default: false,
      })
      .option("init", {
        describe: "run interactive workspace onboarding and harness initialization",
        type: "boolean",
        default: false,
      })
      .option("roi", {
        describe: "perform automated model cost-benefit ROI analysis and role assignment",
        type: "boolean",
        default: false,
      })
      .option("roi-pref", {
        describe: "ROI economic preference (flat_fee_first, balanced, performance_first, lowest_cost)",
        type: "string",
        default: "flat_fee_first",
      })
      .option("concurrency", {
        describe: "worker concurrency for benchmark runs",
        type: "number",
        default: 4,
      })
  },
  handler: async (args: {
    objective?: string
    dir?: string
    model?: string
    verify?: string
    noPlanning: boolean
    smoke: boolean
    bench: boolean
    init: boolean
    roi: boolean
    roiPref: string
    concurrency: number
  }) => {
    UI.empty()
    UI.println(UI.logo("  "))
    UI.empty()
    prompts.intro("OpenCode Harness V5.2 — Autonomous Engineering Runner")

    let currentDir = __dirname
    let harnessDir = ""
    while (currentDir !== "/" && currentDir !== path.dirname(currentDir)) {
      const candidate = path.join(currentDir, "harness")
      if (existsSync(candidate) && existsSync(path.join(candidate, "src"))) {
        harnessDir = candidate
        break
      }
      currentDir = path.dirname(currentDir)
    }
    if (!harnessDir) {
      harnessDir = path.resolve(process.cwd(), "harness")
    }

    if (args.init || args.objective === "init") {
      prompts.log.info("Launching OpenCode Harness V5.2 Workspace Onboarding Wizard...")
      const { OnboardingEngine } = await import(path.join(harnessDir, "src/onboarding.ts"))
      const engine = new OnboardingEngine(args.dir ?? process.cwd())
      const assessment = engine.assessWorkspace()

      prompts.log.step(`Detected Ecosystem: ${assessment.detectedLanguage.toUpperCase()} (${assessment.discoveredTestsCount} test files)`)
      prompts.log.step(`Discovered Active Providers: ${assessment.availableProviders.join(", ")}`)

      const prefChoice = await prompts.select({
        message: "Select your Economic Model Preference:",
        options: [
          { value: "flat_fee_first", label: "Flat-Fee / Subscription First (Recommended for OpenCode Go - Zero Marginal Cost)" },
          { value: "balanced", label: "Balanced (Cost-Effective Mix)" },
          { value: "performance_first", label: "Performance First (Maximum Raw Capability)" },
          { value: "lowest_cost", label: "Lowest Cost (Cheapest Available)" },
        ],
        initialValue: "flat_fee_first",
      })

      if (prompts.isCancel(prefChoice)) {
        prompts.cancel("Onboarding cancelled.")
        return
      }

      const s = prompts.spinner()
      s.start("Configuring multi-lane roles, test verification policies, and long-term project memory...")
      const result = engine.initializeHarness({ preference: prefChoice as any })
      s.stop("Harness workspace initialized successfully!")

      UI.println(result.summaryMarkdown)
      prompts.outro("🏆 OpenCode Harness Onboarding Complete! You are ready to build.")
      return
    }

    if (args.roi) {
      prompts.log.info(`Analyzing available model providers with preference '${args.roiPref}'...`)
      const { ModelRoiAnalyzer } = await import(path.join(harnessDir, "src/model-roi.ts"))
      const analysis = ModelRoiAnalyzer.analyzeAndAssign(args.roiPref as any)
      const report = ModelRoiAnalyzer.formatReport(analysis)
      UI.println(report)
      prompts.outro("✅ Automated Model Cost-Benefit & ROI Analysis Complete")
      return
    }

    if (args.smoke) {
      prompts.log.info("Running 6-Task Canonical Smoke Benchmark Suite...")
      const { SmokeTestRunner } = await import(path.join(harnessDir, "src/smoke-runner.ts"))
      const runner = new SmokeTestRunner({
        model: args.model,
      })
      const result = await runner.run()
      const verifiedRate = ((result.verifiedSuccessCount / result.totalTasks) * 100).toFixed(1)
      prompts.outro(`🏆 Smoke Benchmark Complete: ${result.verifiedSuccessCount}/${result.totalTasks} Passed (${verifiedRate}%)`)
      return
    }

    if (args.bench) {
      prompts.log.info(`Running Full 60-Task Benchmark Matrix (Concurrency: ${args.concurrency})...`)
      const { FullBenchmarkRunner } = await import(path.join(harnessDir, "src/full-benchmark-runner.ts"))
      const runner = new FullBenchmarkRunner({
        model: args.model,
        concurrency: args.concurrency,
      })
      const result = await runner.run()
      const verifiedRate = ((result.verifiedSuccessCount / result.totalTasks) * 100).toFixed(1)
      prompts.outro(`🏆 Benchmark Matrix Complete: ${result.verifiedSuccessCount}/${result.totalTasks} Passed (${verifiedRate}%)`)
      return
    }

    const objective = args.objective?.trim()
    if (!objective) {
      prompts.log.error("Please provide a task objective string or specify --smoke / --bench.")
      prompts.outro("Aborted")
      return
    }

    const targetDir = args.dir ? path.resolve(args.dir) : process.cwd()
    if (!existsSync(targetDir)) {
      prompts.log.error(`Target directory not found: ${targetDir}`)
      prompts.outro("Aborted")
      return
    }

    prompts.log.info(`Workspace: ${targetDir}`)
    prompts.log.info(`Objective: "${objective}"`)

    const { OpenCodeHarnessRunner } = await import(path.join(harnessDir, "src/runner.ts"))
    const taskId = `harness_${Date.now()}`

    const runner = new OpenCodeHarnessRunner({
      taskId,
      objective,
      cwd: targetDir,
      model: args.model,
      verificationCmd: args.verify,
      skipPlanning: args.noPlanning,
    })

    const spinner = prompts.spinner()
    spinner.start("Executing autonomous engineering pipeline...")

    const result = await runner.run()

    if (result.success) {
      spinner.stop("Execution completed with 100% verified confidence!")
      prompts.log.success(`Final State: ${result.finalState}`)
      prompts.log.info(`Duration: ${(result.metrics.totalDurationMs / 1000).toFixed(1)}s | Turns: ${result.metrics.turns} | Tool Calls: ${result.metrics.toolCalls}`)
      prompts.outro("✅ Task finished successfully!")
    } else {
      spinner.stop("Execution stopped before verified completion", 1)
      prompts.log.error(`Final State: ${result.finalState}`)
      if (result.failures.length > 0) {
        prompts.log.error(`Issues: ${result.failures.join("; ")}`)
      }
      prompts.outro("❌ Task failed verification.")
    }
  },
}
