import { describe, expect, it, beforeEach, afterEach } from "bun:test"
import * as fs from "node:fs"
import * as path from "node:path"
import * as os from "node:os"
import { OnboardingEngine } from "../src/onboarding"

describe("OnboardingEngine", () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "onboarding-test-"))
    // Mock TypeScript workspace
    fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify({ name: "my-test-app" }))
    fs.writeFileSync(path.join(tmpDir, "AGENTS.md"), "- Follow early returns.\n")
    fs.mkdirSync(path.join(tmpDir, "src"), { recursive: true })
    fs.writeFileSync(path.join(tmpDir, "src", "math.ts"), "export const add = (a: number, b: number) => a + b\n")
    fs.writeFileSync(path.join(tmpDir, "src", "math.test.ts"), "import { expect, test } from 'bun:test'\n")
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it("accurately assesses workspace language and discovered test suites", () => {
    const engine = new OnboardingEngine(tmpDir)
    const assessment = engine.assessWorkspace()

    expect(assessment.detectedLanguage).toBe("typescript")
    expect(assessment.hasPackageJson).toBe(true)
    expect(assessment.hasAgentsMd).toBe(true)
    expect(assessment.discoveredTestsCount).toBeGreaterThan(0)
    expect(assessment.availableProviders.length).toBeGreaterThan(0)
  })

  it("initializes complete harness directory structure and configuration", () => {
    const engine = new OnboardingEngine(tmpDir)
    const result = engine.initializeHarness({ preference: "flat_fee_first" })

    expect(fs.existsSync(path.join(tmpDir, ".opencode", "harness.json"))).toBe(true)
    expect(fs.existsSync(path.join(tmpDir, ".opencode", "memory", "project-memory.json"))).toBe(true)

    expect(result.config.economicPreference).toBe("flat_fee_first")
    expect(result.config.roles.explorer).toContain("glm-5.3-flash")
    expect(result.config.roles.planner).toContain("kimi-k2.6")
    expect(result.config.budget.maxFilesChanged).toBe(8)
    expect(result.summaryMarkdown).toContain("OpenCode Harness V5.2 Initialized Successfully")
  })
})
