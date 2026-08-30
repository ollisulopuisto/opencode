import { describe, expect, it } from "bun:test"
import { BenchmarkRunner } from "../src/benchmark"

describe("BenchmarkRunner", () => {
  it("initializes standard 60-task benchmark suite", () => {
    const tasks = BenchmarkRunner.createStandardBenchmarkSuite()
    expect(tasks.length).toBe(60)

    const categories = new Set(tasks.map((t) => t.category))
    expect(categories.has("bugfix")).toBe(true)
    expect(categories.has("feature")).toBe(true)
    expect(categories.has("refactor")).toBe(true)
    expect(categories.has("debugging")).toBe(true)
    expect(categories.has("multifile")).toBe(true)
    expect(categories.has("unfamiliar")).toBe(true)

    const bugfixes = tasks.filter((t) => t.category === "bugfix")
    expect(bugfixes.length).toBe(10)
  })

  it("generates markdown report from aggregated suite results", () => {
    const report = BenchmarkRunner.toMarkdownReport({
      suiteName: "Baseline Suite",
      totalTasks: 10,
      verifiedSuccessCount: 8,
      firstPassSuccessCount: 6,
      totalDurationMs: 45000,
      totalQwenTurns: 22,
      totalToolCalls: 48,
      totalLoopHalts: 2,
      totalBudgetViolations: 1,
      taskResults: [],
    })

    expect(report).toContain("Benchmark Report: Baseline Suite")
    expect(report).toContain("80.0%")
    expect(report).toContain("60.0%")
    expect(report).toContain("45.0s")
  })
})
