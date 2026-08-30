import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import * as fs from "node:fs"
import * as path from "node:path"
import * as os from "node:os"
import { WorkerSynchronizer } from "../src/synchronizer"
import { type WorkerTaskResult } from "../src/worker-pool"

describe("WorkerSynchronizer", () => {
  let tmpDir: string
  let synchronizer: WorkerSynchronizer

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-sync-test-"))
    synchronizer = new WorkerSynchronizer(tmpDir)

    // Setup working workspace
    fs.mkdirSync(path.join(tmpDir, "src"), { recursive: true })
    fs.mkdirSync(path.join(tmpDir, "test"), { recursive: true })
    fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify({ name: "sync-pkg", type: "module" }))
    fs.writeFileSync(path.join(tmpDir, "src", "feature.ts"), "export const value = 10\n")
    fs.writeFileSync(
      path.join(tmpDir, "test", "feature.test.ts"),
      `import { describe, it, expect } from "bun:test"\nimport { value } from "../src/feature"\ndescribe("feature", () => { it("has value", () => { expect(value).toBe(10) }) })`
    )
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it("synchronizes clean worker results successfully", async () => {
    const results: WorkerTaskResult[] = [
      {
        workerId: "w1",
        workUnitId: "wu_1",
        success: true,
        filesModified: ["src/feature.ts"],
        durationMs: 1200,
        patch: "",
      },
    ]

    const summary = await synchronizer.synchronize(results, { runVerification: true })
    expect(summary.success).toBe(true)
    expect(summary.mergedUnits).toEqual(["wu_1"])
    expect(summary.conflicts.length).toBe(0)
  })

  it("detects and flags failed worker tasks during integration", async () => {
    const results: WorkerTaskResult[] = [
      {
        workerId: "w_failed",
        workUnitId: "wu_err",
        success: false,
        filesModified: [],
        durationMs: 500,
        patch: "",
        error: "Compilation error",
      },
    ]

    const summary = await synchronizer.synchronize(results, { runVerification: false })
    expect(summary.success).toBe(false)
    expect(summary.conflicts.length).toBe(1)
    expect(summary.conflicts[0]).toContain("reported failure: Compilation error")
  })
})
