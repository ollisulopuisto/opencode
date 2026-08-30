import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import * as fs from "node:fs"
import * as path from "node:path"
import * as os from "node:os"
import { TaskStateMachine } from "../src/state"
import { ContextBridge } from "../src/context-bridge"
import { TaskStatePersistence } from "../src/persistence"

describe("ContextBridge", () => {
  let tmpDir: string
  let bridge: ContextBridge
  let persistence: TaskStatePersistence

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-bridge-test-"))
    persistence = new TaskStatePersistence(tmpDir)
    bridge = new ContextBridge({ persistence, baseDir: tmpDir })
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it("builds initial turn prompt with embedded state context", () => {
    const sm = new TaskStateMachine("task-bridge-1", "Implement WebSocket heartbeat", ["Timeout must be 30s"])
    sm.setHypothesis("Ping every 10s")

    const prompt = bridge.buildInitialPrompt(sm)
    expect(prompt).toContain("=== TASK EXECUTION CONTEXT ===")
    expect(prompt).toContain("Objective: Implement WebSocket heartbeat")
    expect(prompt).toContain("Active Hypothesis: Ping every 10s")
    expect(prompt).toContain("Timeout must be 30s")
    expect(prompt).toContain("EXECUTION DISCIPLINE")
  })

  it("builds continuation prompt with updated state and last action summary", () => {
    const sm = new TaskStateMachine("task-bridge-2", "Add retry mechanism")
    sm.recordFileMutation("src/retry.ts", 15, 0)
    sm.recordTestResult("test:retry", true)

    const prompt = bridge.buildContinuationPrompt(sm, "Edited src/retry.ts to add exponential backoff")
    expect(prompt).toContain("LAST ACTION: Edited src/retry.ts to add exponential backoff")
    expect(prompt).toContain("NEXT STEP:")
    expect(prompt).toContain("Files Modified So Far: src/retry.ts")
  })

  it("checkpoints and restores task state seamlessly", () => {
    const sm = new TaskStateMachine("task-bridge-3", "State persistence test")
    sm.transition("PLAN", "Planning")
    sm.recordFileMutation("index.ts", 20, 5)

    bridge.checkpoint(sm, "phase_plan")

    const restoredSM = bridge.restoreLatest()
    expect(restoredSM).not.toBeNull()
    expect(restoredSM?.currentState).toBe("PLAN")
    expect(restoredSM?.snapshot.filesChanged).toEqual(["index.ts"])
  })
})
