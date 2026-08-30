import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import * as fs from "node:fs"
import * as path from "node:path"
import * as os from "node:os"
import { ToolOutputNormalizer } from "../src/normalizer"

describe("ToolOutputNormalizer", () => {
  let tmpDir: string
  let normalizer: ToolOutputNormalizer

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-normalizer-test-"))
    normalizer = new ToolOutputNormalizer({ logsDir: tmpDir, maxLines: 10, maxBytes: 500 })
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it("passes through small output unchanged without truncation", () => {
    const raw = "Pass: 5 tests passed in 12ms"
    const res = normalizer.normalize("bash", raw)

    expect(res.isTruncated).toBe(false)
    expect(res.summary).toBe(raw)
    expect(res.logFilePath).toBeUndefined()
  })

  it("extracts TypeScript compiler errors accurately", () => {
    const raw = `
src/server.ts(25,12): error TS2339: Property 'port' does not exist on type 'ServerConfig'.
src/client.ts(40,5): warning TS6133: 'unusedVar' is declared but its value is never read.
`
    const res = normalizer.normalize("tsc", raw)
    expect(res.diagnostics.length).toBe(2)
    expect(res.diagnostics[0].file).toBe("src/server.ts")
    expect(res.diagnostics[0].line).toBe(25)
    expect(res.diagnostics[0].ruleOrCode).toBe("TS2339")
    expect(res.diagnostics[0].severity).toBe("error")
  })

  it("extracts Bun test failure diagnostics accurately", () => {
    const raw = `
(pass) suite > test one [1ms]
(fail) suite > test two [5ms]
(pass) suite > test three [2ms]
`
    const res = normalizer.normalize("bun test", raw)
    expect(res.diagnostics.length).toBe(1)
    expect(res.diagnostics[0].message).toContain("Failed test: suite > test two [5ms]")
  })

  it("truncates large outputs and spills full logs to disk", () => {
    const lines = Array.from({ length: 50 }, (_, i) => `Line ${i + 1}: processing step data...`)
    const raw = lines.join("\n")

    const res = normalizer.normalize("build", raw, { maxLines: 10 })
    expect(res.isTruncated).toBe(true)
    expect(res.originalLines).toBe(50)
    expect(res.logFilePath).toBeDefined()
    expect(fs.existsSync(res.logFilePath!)).toBe(true)

    const diskContent = fs.readFileSync(res.logFilePath!, "utf-8")
    expect(diskContent).toBe(raw)

    expect(res.summary).toContain("--- [TRUNCATED")
    expect(res.summary).toContain("Line 1:")
    expect(res.summary).toContain("Line 50:")
  })
})
