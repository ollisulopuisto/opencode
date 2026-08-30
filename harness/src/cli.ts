#!/usr/bin/env bun
/**
 * OpenCode Harness V5.2 - Interactive Task Runner CLI
 * 
 * Usage:
 *   bun harness/src/cli.ts "<objective>" [--dir <path>] [--model <modelId>] [--verify "<cmd>"]
 */

import * as path from "node:path"
import { OpenCodeHarnessRunner } from "./runner"

async function main() {
  const args = process.argv.slice(2)
  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(`
OpenCode Harness V5.2 — Autonomous Multi-Lane Engineering Runner

Usage:
  bun harness/src/cli.ts "<objective>" [options]

Options:
  --dir <path>       Target workspace directory (default: current directory)
  --model <modelId>  Override default execution model (default: opencode-go/glm-5.3-flash)
  --verify "<cmd>"   Explicit verification command override (e.g. "bun test", "pytest")
  --no-planning      Skip complexity classification & planning (run directly)
  --help, -h         Show this help message

Examples:
  bun harness/src/cli.ts "Fix off-by-one index in range parser"
  bun harness/src/cli.ts "Add avatar upload endpoint" --dir /Users/dst/Documents/koodi/my-app
  bun harness/src/cli.ts "Refactor auth middleware" --verify "bun test test/auth.test.ts"
`)
    process.exit(0)
  }

  let objective = ""
  let targetDir = process.cwd()
  let model: string | undefined
  let verificationCmd: string | undefined
  let skipPlanning = false

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === "--dir" && i + 1 < args.length) {
      targetDir = path.resolve(args[++i])
    } else if (arg === "--model" && i + 1 < args.length) {
      model = args[++i]
    } else if (arg === "--verify" && i + 1 < args.length) {
      verificationCmd = args[++i]
    } else if (arg === "--no-planning") {
      skipPlanning = true
    } else if (!arg.startsWith("--") && !objective) {
      objective = arg
    }
  }

  if (!objective) {
    console.error("Error: Please provide a task objective string.")
    process.exit(1)
  }

  console.log(`======================================================`)
  console.log(`  OpenCode Harness V5.2 — Task Execution Runner`)
  console.log(`  Workspace: ${targetDir}`)
  console.log(`  Objective: "${objective}"`)
  console.log(`======================================================\n`)

  const taskId = `task_${Date.now()}`
  const runner = new OpenCodeHarnessRunner({
    taskId,
    objective,
    cwd: targetDir,
    model,
    verificationCmd,
    skipPlanning,
  })

  const result = await runner.run()

  console.log(`\n======================================================`)
  console.log(`  Execution Finished: ${result.success ? "✅ SUCCESS" : "❌ FAILED"}`)
  console.log(`  Final State: ${result.finalState}`)
  console.log(`  Duration: ${(result.metrics.totalDurationMs / 1000).toFixed(1)}s`)
  console.log(`  Turns: ${result.metrics.turns}`)
  console.log(`  Tool Calls: ${result.metrics.toolCalls}`)
  console.log(`  Tests Passed: ${result.metrics.testsPassed}`)
  console.log(`  Budget Violations: ${result.metrics.budgetViolations}`)
  if (result.verification) {
    console.log(`  Confidence: ${(result.verification.confidence * 100).toFixed(0)}%`)
  }
  console.log(`======================================================\n`)

  process.exit(result.success ? 0 : 1)
}

main().catch((err) => {
  console.error("Harness execution error:", err)
  process.exit(1)
})
