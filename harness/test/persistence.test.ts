import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import * as fs from "node:fs"
import * as path from "node:path"
import * as os from "node:os"
import { TaskStateMachine } from "../src/state"
import { TaskStatePersistence } from "../src/persistence"

describe("TaskStatePersistence", () => {
  let tmpDir: string
  let persistence: TaskStatePersistence

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-persistence-test-"))
    persistence = new TaskStatePersistence(tmpDir)
  })

  afterEach(() => {
    persistence.clean()
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it("serializes and deserializes task state with 100% fidelity", () => {
    const sm = new TaskStateMachine("task-123", "Fix auth timeout", ["Must pass tests"])
    sm.setHypothesis("Increase token cache TTL")
    sm.recordFileMutation("src/auth.ts", 12, 4)
    sm.recordTestResult("bun test", true, 45)
    sm.recordFailure("TEST_FAILURE", "Assertion failed on line 42", 1, "test context")

    const original = sm.snapshot
    const serialized = TaskStatePersistence.serialize(original)
    const deserialized = TaskStatePersistence.deserialize(serialized)

    expect(deserialized.taskId).toBe(original.taskId)
    expect(deserialized.objective).toBe(original.objective)
    expect(deserialized.constraints).toEqual(original.constraints)
    expect(deserialized.currentHypothesis).toBe(original.currentHypothesis)
    expect(deserialized.filesChanged).toEqual(original.filesChanged)
    expect(deserialized.linesAdded).toBe(original.linesAdded)
    expect(deserialized.linesDeleted).toBe(original.linesDeleted)
    expect(deserialized.testsRun.length).toBe(1)
    expect(deserialized.failures.length).toBe(1)
  })

  it("saves and loads state atomically from disk", () => {
    const sm = new TaskStateMachine("task-456", "Add user endpoint")
    sm.transition("PLAN", "Planning endpoints")
    sm.addWorkUnit({
      id: "wu-1",
      title: "Write route",
      objective: "Add /user route",
      writeSet: ["src/routes/user.ts"],
      relevantFiles: ["src/routes/user.ts"],
      dependencies: [],
    })

    persistence.save(sm.snapshot)

    const loaded = persistence.load()
    expect(loaded).not.toBeNull()
    expect(loaded?.taskId).toBe("task-456")
    expect(loaded?.currentState).toBe("PLAN")
    expect(loaded?.workUnits.length).toBe(1)
    expect(loaded?.workUnits[0].title).toBe("Write route")
  })

  it("hydrates a functional TaskStateMachine from persisted state", () => {
    const sm = new TaskStateMachine("task-789", "Refactor database")
    sm.transition("PLAN", "Decomposing task")
    sm.transition("EXECUTE", "Executing changes")
    sm.recordFileMutation("src/db.ts", 50, 10)

    const state = sm.snapshot
    const hydrated = TaskStatePersistence.hydrate(state)

    expect(hydrated.currentState).toBe("EXECUTE")
    expect(hydrated.snapshot.filesChanged).toEqual(["src/db.ts"])

    // Verify hydrated state machine can continue transitions and operations
    hydrated.recordTestResult("bun test", true, 20)
    const trans = hydrated.transition("VERIFY", "Testing done")
    expect(trans.success).toBe(true)
    expect(hydrated.currentState).toBe("VERIFY")

    const completeTrans = hydrated.transition("COMPLETE", "Done")
    expect(completeTrans.success).toBe(true)
    expect(hydrated.currentState).toBe("COMPLETE")
  })

  it("creates, lists, and restores point-in-time snapshots", () => {
    const sm = new TaskStateMachine("task-snap", "Snapshot test")
    sm.setHypothesis("Hypothesis A")
    const snap1 = persistence.createSnapshot(sm.snapshot, "step_1")

    sm.setHypothesis("Hypothesis B")
    sm.recordFileMutation("test.ts", 5, 0)
    const snap2 = persistence.createSnapshot(sm.snapshot, "step_2")

    const snapshots = persistence.listSnapshots()
    expect(snapshots.length).toBe(2)
    expect(snapshots[0].label).toBe("step_1")
    expect(snapshots[1].label).toBe("step_2")

    // Restore snapshot 1
    const restoredSM = persistence.restoreSnapshot(snap1.snapshotId)
    expect(restoredSM).not.toBeNull()
    expect(restoredSM?.snapshot.currentHypothesis).toBe("Hypothesis A")
    expect(restoredSM?.snapshot.filesChanged.length).toBe(0)
  })
})
