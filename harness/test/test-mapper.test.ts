import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import * as fs from "node:fs"
import * as path from "node:path"
import * as os from "node:os"
import { TestMapper } from "../src/test-mapper"

describe("TestMapper", () => {
  let tmpDir: string
  let mapper: TestMapper

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-test-mapper-"))
    mapper = new TestMapper(tmpDir)

    // Setup dummy project files
    fs.mkdirSync(path.join(tmpDir, "src"), { recursive: true })
    fs.mkdirSync(path.join(tmpDir, "test"), { recursive: true })

    fs.writeFileSync(path.join(tmpDir, "src", "auth.ts"), "export const auth = true")
    fs.writeFileSync(path.join(tmpDir, "test", "auth.test.ts"), "import { auth } from '../src/auth'")
    fs.writeFileSync(path.join(tmpDir, "src", "user.ts"), "export const user = true")
    fs.writeFileSync(path.join(tmpDir, "test", "user.spec.ts"), "import { user } from '../src/user'")
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it("discovers all test files across the workspace", () => {
    const tests = mapper.discoverAllTestFiles()
    expect(tests.length).toBe(2)
    expect(tests.some((t) => t.includes("auth.test.ts"))).toBe(true)
    expect(tests.some((t) => t.includes("user.spec.ts"))).toBe(true)
  })

  it("identifies test files vs source files accurately", () => {
    expect(mapper.isTestFile("auth.test.ts")).toBe(true)
    expect(mapper.isTestFile("auth.spec.js")).toBe(true)
    expect(mapper.isTestFile("test_parser.py")).toBe(true)
    expect(mapper.isTestFile("range_test.go")).toBe(true)
    expect(mapper.isTestFile("auth.ts")).toBe(false)
  })

  it("maps modified source files to targeted test suites", () => {
    const targeted = mapper.findTargetedTests(["src/auth.ts"])
    expect(targeted.length).toBe(1)
    expect(targeted[0]).toContain("auth.test.ts")
  })

  it("builds and persists test-map registry to .opencode/test-map.json", () => {
    const registry = mapper.buildRegistry()
    expect(registry.allTestFiles.length).toBe(2)
    expect(fs.existsSync(path.join(tmpDir, ".opencode", "test-map.json"))).toBe(true)
  })
})
