import { describe, expect, it } from "bun:test"
import { Effect } from "effect"
import { SystemContext } from "@opencode-ai/core/system-context"
import { TaskStateContext, type TaskStatePayload } from "@opencode-ai/core/system-context/task-state"

describe("SystemContext.TaskState", () => {
  const sampleState: TaskStatePayload = {
    taskId: "task-001",
    objective: "Implement native system context source for task state",
    currentState: "UNDERSTAND",
    constraints: ["Zero child process overhead", "Strict type checking"],
    decisions: ["Use Effect Schema for JSON codec"],
    workUnits: [
      {
        id: "wu_1_schema",
        title: "Define TaskState schema and codec",
        objective: "Define Schema Struct for TaskState",
        writeSet: ["packages/core/src/system-context/task-state.ts"],
        relevantFiles: ["packages/core/src/system-context/index.ts"],
        dependencies: [],
        status: "in_progress",
      },
    ],
    activeWorkUnitId: "wu_1_schema",
    filesChanged: ["packages/core/src/system-context/task-state.ts"],
    testsRun: [],
    failures: [],
    currentHypothesis: "TaskState as ContextSource preserves state across compaction epochs",
    remainingWork: ["Write tests", "Wire to registry"],
    knownUnknowns: [],
  }

  it("initializes baseline rendering with structured task state tags", async () => {
    const context = TaskStateContext.makeTaskStateContext(Effect.succeed(sampleState))
    const result = await Effect.runPromise(SystemContext.initialize(context))

    expect(result.snapshot["harness/task-state"]).toBeDefined()
    expect(result.baseline).toContain("<task_state>")
    expect(result.baseline).toContain("Task ID: task-001")
    expect(result.baseline).toContain("State: UNDERSTAND")
    expect(result.baseline).toContain("Active Hypothesis: TaskState as ContextSource")
    expect(result.baseline).toContain("[IN_PROGRESS] wu_1_schema: Define TaskState schema and codec (ACTIVE)")
  })

  it("reconciles updates and renders mid-conversation system message on state transition", async () => {
    let currentState = sampleState
    const context = TaskStateContext.makeTaskStateContext(
      Effect.sync(() => currentState),
    )

    const initial = await Effect.runPromise(SystemContext.initialize(context))

    // Transition state
    const updatedState: TaskStatePayload = {
      ...sampleState,
      currentState: "EXECUTE",
      currentHypothesis: "Writing implementation files",
      filesChanged: [
        "packages/core/src/system-context/task-state.ts",
        "packages/core/test/system-context/task-state.test.ts",
      ],
    }
    currentState = updatedState

    const reconciliation = await Effect.runPromise(
      SystemContext.reconcile(context, initial.snapshot),
    )

    expect(reconciliation._tag).toBe("Updated")
    if (reconciliation._tag === "Updated") {
      expect(reconciliation.text).toContain("<task_state_update>")
      expect(reconciliation.text).toContain("State: UNDERSTAND ➔ EXECUTE")
      expect(reconciliation.text).toContain("New Hypothesis: Writing implementation files")
      expect(reconciliation.text).toContain("Newly Changed Files: packages/core/test/system-context/task-state.test.ts")
    }
  })

  it("reports Unchanged when task state has not modified", async () => {
    const context = TaskStateContext.makeTaskStateContext(Effect.succeed(sampleState))
    const initial = await Effect.runPromise(SystemContext.initialize(context))
    const reconciliation = await Effect.runPromise(
      SystemContext.reconcile(context, initial.snapshot),
    )

    expect(reconciliation._tag).toBe("Unchanged")
  })
})
