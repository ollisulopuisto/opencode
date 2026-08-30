import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import * as fs from "node:fs"
import * as path from "node:path"
import * as os from "node:os"
import { MultiTierVerifierEngine } from "../src/verifier-engine"

describe("MultiTierVerifierEngine", () => {
  let tmpDir: string
  let engine: MultiTierVerifierEngine

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-engine-test-"))

    // Setup working dummy project
    fs.mkdirSync(path.join(tmpDir, "src"), { recursive: true })
    fs.mkdirSync(path.join(tmpDir, "test"), { recursive: true })
    fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify({ name: "test-pkg", type: "module" }))
    fs.writeFileSync(path.join(tmpDir, "src", "math.ts"), "export const add = (a: number, b: number) => a + b")
    fs.writeFileSync(
      path.join(tmpDir, "test", "math.test.ts"),
      `import { describe, it, expect } from "bun:test"\nimport { add } from "../src/math"\ndescribe("math", () => { it("adds", () => { expect(add(1, 2)).toBe(3) }) })`
    )

    engine = new MultiTierVerifierEngine(tmpDir, {
      tier0StaticCmds: [],
      tier1TargetedTestTemplate: (files) => (files.length > 0 ? `bun test ${files.join(" ")}` : undefined),
      tier2RegressionCmds: ["bun test"],
      timeoutMs: 30_000,
      fastFail: true,
    })
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it("executes multi-tier verification and passes when code and tests are valid", async () => {
    const res = await engine.runFullVerification({
      cwd: tmpDir,
      changedFiles: ["src/math.ts"],
      skipTiers: [0], // Skip tsc for quick unit test
    })

    expect(res.correct).toBe(true)
    expect(res.confidence).toBeGreaterThanOrEqual(1.0)
    expect(res.tierResults.length).toBeGreaterThanOrEqual(2)
  })

  it("detects test evasion anti-patterns during Tier 3 diff audit", async () => {
    // Write a test file with .skip()
    fs.writeFileSync(
      path.join(tmpDir, "test", "evasion.test.ts"),
      `import { describe, it } from "bun:test"\ndescribe("evasion", () => { it.skip("skipped test", () => {}) })`
    )

    const res = await engine.runFullVerification({
      cwd: tmpDir,
      changedFiles: ["test/evasion.test.ts"],
      skipTiers: [0, 1, 2],
    })

    expect(res.correct).toBe(false)
    expect(res.failedTier).toBe(3)
    expect(res.diagnostics.length).toBeGreaterThan(0)
    expect(res.diagnostics.some((d) => d.includes("disabled or exclusive tests"))).toBe(true)
  })

  it("detects commented-out assertions during Tier 3 diff audit", async () => {
    fs.writeFileSync(
      path.join(tmpDir, "src", "math.ts"),
      `export const add = (a: number, b: number) => a + b\n// expect(add(1, 2)).toBe(3)`
    )

    const res = await engine.runFullVerification({
      cwd: tmpDir,
      changedFiles: ["src/math.ts"],
      skipTiers: [0, 1, 2],
    })

    expect(res.correct).toBe(false)
    expect(res.failedTier).toBe(3)
    expect(res.diagnostics[0]).toContain("commented-out test assertions")
  })

  it("detects vacuous empty test bodies and dummy assertions", async () => {
    fs.writeFileSync(
      path.join(tmpDir, "test", "empty.test.ts"),
      `import { test } from "bun:test"\ntest("vacuous test", () => {})`
    )

    const res = await engine.runFullVerification({
      cwd: tmpDir,
      changedFiles: ["test/empty.test.ts"],
      skipTiers: [0, 1, 2],
    })

    expect(res.correct).toBe(false)
    expect(res.failedTier).toBe(3)
    expect(res.diagnostics[0]).toContain("empty vacuous test body")
  })
})
