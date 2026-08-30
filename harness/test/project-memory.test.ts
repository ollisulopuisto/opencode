import { describe, expect, it, beforeEach, afterEach } from "bun:test"
import * as fs from "node:fs"
import * as path from "node:path"
import * as os from "node:os"
import { ProjectMemory } from "../src/project-memory"

describe("ProjectMemory", () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "project-memory-test-"))
    // Create mock workspace structure
    fs.mkdirSync(path.join(tmpDir, ".opencode"), { recursive: true })
    fs.writeFileSync(
      path.join(tmpDir, "AGENTS.md"),
      "- Always run `bun typecheck` from package directories.\n- Avoid else statements.\n"
    )
    fs.mkdirSync(path.join(tmpDir, "packages", "core"), { recursive: true })
    fs.writeFileSync(
      path.join(tmpDir, "packages", "core", "package.json"),
      JSON.stringify({ name: "@opencode-ai/core", description: "Core domain logic" })
    )
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it("initializes and automatically scans repository structure and conventions", () => {
    const memory = new ProjectMemory(tmpDir)
    memory.scanRepository()

    const snapshot = memory.snapshot
    expect(snapshot.conventions.length).toBeGreaterThan(0)
    expect(snapshot.conventions.some((c) => c.includes("bun typecheck"))).toBe(true)
    expect(snapshot.modules.some((m) => m.name === "@opencode-ai/core")).toBe(true)
    expect(snapshot.riskyFiles.length).toBeGreaterThan(0)
  })

  it("persists and reloads learned rules and historical task outcomes across instances", () => {
    const memory1 = new ProjectMemory(tmpDir)
    memory1.addLearnedRule("Never run migrations directly on primary sqlite db without backup.", "database", ["migrate", "sqlite"])
    memory1.recordTaskResult("task-101", "Fix database connection leak", "success", ["packages/core/db.ts"], "Always close SQLite statements in finally blocks")

    // Create a new instance pointing to same tmpDir
    const memory2 = new ProjectMemory(tmpDir)
    const snapshot2 = memory2.snapshot

    expect(snapshot2.learnedRules.length).toBe(1)
    expect(snapshot2.learnedRules[0].rule).toContain("Never run migrations")
    expect(snapshot2.taskHistory.length).toBe(1)
    expect(snapshot2.taskHistory[0].learnedInsight).toContain("finally blocks")
  })

  it("extracts targeted, high-signal prompt blocks for model injection", () => {
    const memory = new ProjectMemory(tmpDir)
    memory.scanRepository()
    memory.addLearnedRule("Wrap SSE stream writes in try/catch to avoid unhandled socket exceptions.", "stream", ["sse", "stream", "socket"])
    memory.recordTaskResult("task-202", "Implement SSE event streaming", "success", ["packages/server/src/routes/events.ts"], "Use TextEncoder with keepalive heartbeat")

    const formattedPrompt = memory.formatForPrompt("Implement SSE stream handler", ["packages/server/src/routes/events.ts"])

    expect(formattedPrompt).toContain("LONG-TERM PROJECT MEMORY & REPO INTELLIGENCE")
    expect(formattedPrompt).toContain("Repository Conventions")
    expect(formattedPrompt).toContain("Wrap SSE stream writes")
    expect(formattedPrompt).toContain("Architecture Risk Warnings")
    expect(formattedPrompt).toContain("TextEncoder with keepalive heartbeat")
  })
})
