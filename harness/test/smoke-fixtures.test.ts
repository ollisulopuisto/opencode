import { describe, it, expect } from "bun:test"
import * as fs from "node:fs"
import * as path from "node:path"
import * as os from "node:os"
import { SMOKE_TASKS } from "../src/smoke-fixtures"

describe("Smoke Test Fixtures", () => {
  it("defines exactly 6 canonical smoke tasks across 6 categories", () => {
    expect(SMOKE_TASKS.length).toBe(6)
    const categories = SMOKE_TASKS.map((t) => t.category)
    expect(categories).toEqual(["bugfix", "feature", "refactor", "debugging", "multifile", "unfamiliar"])
  })

  it("initializes each fixture with valid package.json and tests", () => {
    for (const task of SMOKE_TASKS) {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `harness-fixture-test-${task.id}-`))
      try {
        task.setup(tmpDir)

        expect(fs.existsSync(path.join(tmpDir, "package.json"))).toBe(true)
        expect(fs.existsSync(path.join(tmpDir, "src"))).toBe(true)
        expect(fs.existsSync(path.join(tmpDir, "test"))).toBe(true)

        // Verify verificationCmd is non-empty
        expect(task.verificationCmd).toBe("bun test")
        expect(task.budget.writeSet.length).toBeGreaterThan(0)
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true })
      }
    }
  })
})
