import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import * as fs from "node:fs"
import * as path from "node:path"
import * as os from "node:os"
import { ChurnRecoveryEngine } from "../src/churn-engine"
import { ModelRegistry } from "../src/model-registry"
import { TaskStateMachine } from "../src/state"
import { TaskStatePersistence } from "../src/persistence"

describe("ChurnRecoveryEngine", () => {
  let tmpDir: string
  let registry: ModelRegistry
  let churnEngine: ChurnRecoveryEngine
  let stateMachine: TaskStateMachine
  let persistence: TaskStatePersistence

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-churn-test-"))
    registry = new ModelRegistry()
    churnEngine = new ChurnRecoveryEngine(registry)
    stateMachine = new TaskStateMachine("task_churn_1", "Test model churn recovery")
    persistence = new TaskStatePersistence(tmpDir)
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it("detects model quota and outage signatures accurately", () => {
    expect(churnEngine.isModelOutageOrQuotaError("HTTP 429: Insufficient quota")).toBe(true)
    expect(churnEngine.isModelOutageOrQuotaError("503: Service overloaded / temporarily unavailable")).toBe(true)
    expect(churnEngine.isModelOutageOrQuotaError("TypeError: Cannot read properties of undefined")).toBe(false)
  })

  it("seamlessly substitutes model on quota loss and persists state snapshot", async () => {
    const primary = "opencode-go/glm-5.3-flash"
    const errorText = "429: Monthly quota limit reached for GLM"

    const res = await churnEngine.handleModelLoss(
      primary,
      "implementer",
      errorText,
      stateMachine,
      persistence
    )

    expect(res.substituted).toBe(true)
    expect(res.previousModel).toBe(primary)
    expect(res.activeModel).not.toBe(primary)
    expect(res.log).toBeDefined()
    expect(res.log?.fromModel).toBe(primary)
    expect(res.log?.toModel).toBe(res.activeModel)

    // Verify snapshot was created on disk
    const snapshots = persistence.listSnapshots()
    expect(snapshots.length).toBeGreaterThan(0)

    // Verify substitution history is recorded
    const history = churnEngine.getSubstitutionHistory()
    expect(history.length).toBe(1)
  })
})
