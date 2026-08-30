import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import * as fs from "node:fs"
import * as path from "node:path"
import * as os from "node:os"
import { WorktreeManager } from "../src/worktree-manager"

describe("WorktreeManager", () => {
  let tmpDir: string
  let manager: WorktreeManager

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-wt-test-"))
    manager = new WorktreeManager(tmpDir)

    fs.mkdirSync(path.join(tmpDir, "src"), { recursive: true })
    fs.writeFileSync(path.join(tmpDir, "src", "index.ts"), "export const val = 42\n")
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it("creates and initializes an isolated worker workspace", async () => {
    const ws = await manager.createWorkspace("worker_1")
    expect(ws.workerId).toBe("worker_1")
    expect(fs.existsSync(ws.worktreePath)).toBe(true)
    expect(fs.existsSync(path.join(ws.worktreePath, "src", "index.ts"))).toBe(true)

    // Cleanup
    await manager.removeWorkspace(ws)
    expect(fs.existsSync(ws.worktreePath)).toBe(false)
  })

  it("safely extracts patch from modified worker workspace", async () => {
    const ws = await manager.createWorkspace("worker_patch")
    const patch = await manager.extractPatch(ws)
    expect(typeof patch).toBe("string")
    await manager.removeWorkspace(ws)
  })
})
