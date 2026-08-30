/**
 * OpenCode Harness V5 - Persistent Task State & Hydration Engine
 * 
 * Owns serialization, atomic disk persistence, snapshotting, versioning,
 * and state hydration for TaskStateMachine across session epochs and compactions.
 */

import * as fs from "node:fs"
import * as path from "node:path"
import { TaskStateMachine, type TaskState } from "./state"

export interface SerializedTaskState {
  version: number
  schemaVersion: "v5.2"
  savedAt: number
  state: TaskState
  checksum?: string
}

export interface StateSnapshot {
  snapshotId: string
  label: string
  timestamp: number
  state: TaskState
}

export class TaskStatePersistence {
  private baseDir: string
  private stateFilePath: string
  private backupFilePath: string
  private snapshotsDir: string

  constructor(baseDir: string = process.cwd()) {
    this.baseDir = path.resolve(baseDir)
    const opencodeDir = path.join(this.baseDir, ".opencode")
    this.stateFilePath = path.join(opencodeDir, "task-state.json")
    this.backupFilePath = path.join(opencodeDir, "task-state.backup.json")
    this.snapshotsDir = path.join(opencodeDir, "snapshots")
  }

  /**
   * Serializes task state to structured JSON format.
   */
  static serialize(state: TaskState): string {
    const payload: SerializedTaskState = {
      version: 1,
      schemaVersion: "v5.2",
      savedAt: Date.now(),
      state,
    }
    return JSON.stringify(payload, null, 2)
  }

  /**
   * Deserializes raw JSON string back into TaskState with validation.
   */
  static deserialize(jsonString: string): TaskState {
    const parsed = JSON.parse(jsonString)
    const state: TaskState = parsed.state ?? parsed

    if (!state.taskId || !state.objective || !state.currentState) {
      throw new Error("Invalid TaskState payload: missing mandatory fields (taskId, objective, currentState)")
    }

    // Default arrays and numbers if missing from older serialized states
    return {
      taskId: state.taskId,
      objective: state.objective,
      constraints: state.constraints ?? [],
      decisions: state.decisions ?? [],
      workUnits: state.workUnits ?? [],
      activeWorkUnitId: state.activeWorkUnitId,
      filesChanged: state.filesChanged ?? [],
      linesAdded: state.linesAdded ?? 0,
      linesDeleted: state.linesDeleted ?? 0,
      testsRun: state.testsRun ?? [],
      failures: state.failures ?? [],
      currentHypothesis: state.currentHypothesis ?? "",
      remainingWork: state.remainingWork ?? [state.objective],
      knownUnknowns: state.knownUnknowns ?? [],
      currentState: state.currentState,
      history: state.history ?? [],
      geminiInterventions: state.geminiInterventions ?? 0,
      qwenTurns: state.qwenTurns ?? 0,
    }
  }

  /**
   * Hydrates a TaskStateMachine from persisted TaskState.
   */
  static hydrate(state: TaskState): TaskStateMachine {
    const machine = new TaskStateMachine(state.taskId, state.objective, state.constraints)
    // Restore internal state accurately
    ;(machine as unknown as { state: TaskState }).state = {
      ...state,
      constraints: [...state.constraints],
      decisions: [...state.decisions],
      workUnits: state.workUnits.map((u) => ({ ...u })),
      filesChanged: [...state.filesChanged],
      testsRun: state.testsRun.map((t) => ({ ...t })),
      failures: state.failures.map((f) => ({ ...f })),
      remainingWork: [...state.remainingWork],
      knownUnknowns: [...state.knownUnknowns],
      history: state.history.map((h) => ({ ...h })),
    }
    return machine
  }

  /**
   * Atomically saves current task state to disk with backup.
   */
  save(state: TaskState): void {
    const dir = path.dirname(this.stateFilePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    const serialized = TaskStatePersistence.serialize(state)

    // If current file exists, write to backup first
    if (fs.existsSync(this.stateFilePath)) {
      try {
        fs.copyFileSync(this.stateFilePath, this.backupFilePath)
      } catch {
        // Backup failure non-fatal
      }
    }

    // Atomic write via temp file
    const tempFile = `${this.stateFilePath}.${Date.now()}.tmp`
    fs.writeFileSync(tempFile, serialized, "utf-8")
    fs.renameSync(tempFile, this.stateFilePath)
  }

  /**
   * Loads task state from disk, falling back to backup if primary is corrupted.
   */
  load(): TaskState | null {
    if (fs.existsSync(this.stateFilePath)) {
      try {
        const raw = fs.readFileSync(this.stateFilePath, "utf-8")
        return TaskStatePersistence.deserialize(raw)
      } catch (err) {
        console.warn(`[Persistence] Primary state file corrupted, attempting backup restore...`)
      }
    }

    if (fs.existsSync(this.backupFilePath)) {
      try {
        const backupRaw = fs.readFileSync(this.backupFilePath, "utf-8")
        return TaskStatePersistence.deserialize(backupRaw)
      } catch (err) {
        console.error(`[Persistence] Backup state file also corrupted:`, err)
      }
    }

    return null
  }

  /**
   * Creates a point-in-time state checkpoint/snapshot on disk.
   */
  createSnapshot(state: TaskState, label: string): StateSnapshot {
    if (!fs.existsSync(this.snapshotsDir)) {
      fs.mkdirSync(this.snapshotsDir, { recursive: true })
    }

    const timestamp = Date.now()
    const snapshotId = `snap_${timestamp}_${label.replace(/[^a-zA-Z0-9_-]/g, "_")}`
    const snapshot: StateSnapshot = {
      snapshotId,
      label,
      timestamp,
      state: JSON.parse(JSON.stringify(state)),
    }

    const filePath = path.join(this.snapshotsDir, `${snapshotId}.json`)
    fs.writeFileSync(filePath, JSON.stringify(snapshot, null, 2), "utf-8")
    return snapshot
  }

  /**
   * Lists all existing snapshots sorted chronologically.
   */
  listSnapshots(): StateSnapshot[] {
    if (!fs.existsSync(this.snapshotsDir)) return []
    const files = fs.readdirSync(this.snapshotsDir).filter((f) => f.endsWith(".json"))
    const snapshots: StateSnapshot[] = []

    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(this.snapshotsDir, file), "utf-8")
        const parsed = JSON.parse(content)
        if (parsed.snapshotId && parsed.state) {
          snapshots.push(parsed)
        }
      } catch {
        // ignore corrupted snapshot files
      }
    }

    return snapshots.sort((a, b) => {
      if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp
      return a.snapshotId.localeCompare(b.snapshotId)
    })
  }

  /**
   * Restores a snapshot by ID and hydrates a TaskStateMachine.
   */
  restoreSnapshot(snapshotId: string): TaskStateMachine | null {
    const filePath = path.join(this.snapshotsDir, `${snapshotId}.json`)
    if (!fs.existsSync(filePath)) return null

    try {
      const content = fs.readFileSync(filePath, "utf-8")
      const snapshot: StateSnapshot = JSON.parse(content)
      const state = TaskStatePersistence.deserialize(JSON.stringify(snapshot.state))
      this.save(state) // Persist restored state as current
      return TaskStatePersistence.hydrate(state)
    } catch {
      return null
    }
  }

  /**
   * Cleans up task state files.
   */
  clean(): void {
    if (fs.existsSync(this.stateFilePath)) fs.unlinkSync(this.stateFilePath)
    if (fs.existsSync(this.backupFilePath)) fs.unlinkSync(this.backupFilePath)
    if (fs.existsSync(this.snapshotsDir)) {
      fs.rmSync(this.snapshotsDir, { recursive: true, force: true })
    }
  }
}
