/** @jsxImportSource @opentui/solid */
import { afterEach, expect, test } from "bun:test"
import { testRender } from "@opentui/solid"
import { ThemeProvider } from "../../src/context/theme"
import { HarnessPanel } from "../../src/component/harness/harness-panel"
import { resolve as resolveConfig, TuiConfigProvider } from "../../src/config"
import { TestTuiContexts } from "../fixture/tui-environment"
import { KVProvider } from "../../src/context/kv"
import { tmpdir } from "../fixture/fixture"

let app: Awaited<ReturnType<typeof testRender>> | undefined

afterEach(() => {
  app?.renderer.destroy()
  app = undefined
})

async function wait(fn: () => boolean, timeout = 2000) {
  const start = Date.now()
  while (!fn()) {
    if (Date.now() - start > timeout) throw new Error("timed out waiting for condition")
    await Bun.sleep(10)
  }
}

test("renders harness verification gates, work units, and budget meter", async () => {
  await using tmp = await tmpdir()
  await Bun.write(`${tmp.path}/kv.json`, "{}")

  const taskState = {
    taskId: "task_test_123",
    objective: "Implement timestamp formatting",
    currentState: "EXECUTE" as const,
    constraints: ["No external dependencies"],
    decisions: ["Directive: Keep timezone deterministic"],
    workUnits: [
      {
        id: "wu_1",
        title: "Create formatter function",
        objective: "Add formatTimestamp in core",
        writeSet: ["packages/core/src/time.ts"],
        relevantFiles: [],
        dependencies: [],
        status: "verified" as const,
      },
      {
        id: "wu_2",
        title: "Add unit tests",
        objective: "Cover leap years and edge cases",
        writeSet: ["packages/core/test/time.test.ts"],
        relevantFiles: [],
        dependencies: ["wu_1"],
        status: "in_progress" as const,
      },
    ],
    activeWorkUnitId: "wu_2",
    filesChanged: ["packages/core/src/time.ts"],
    linesAdded: 30,
    linesDeleted: 5,
    testsRun: [
      { name: "Tier 0 Static: typecheck", passed: true, durationMs: 120 },
      { name: "Tier 1 Targeted: time.test.ts", passed: true, durationMs: 45 },
    ],
    failures: [],
    currentHypothesis: "Format with ISO 8601 UTC representation",
    remainingWork: ["Cover leap years"],
    knownUnknowns: [],
    history: [],
    supervisorInterventions: 0,
    modelTurns: 3,
  }

  app = await testRender(
    () => (
      <TestTuiContexts paths={{ state: tmp.path }}>
        <KVProvider>
          <TuiConfigProvider config={resolveConfig({}, { terminalSuspend: false })}>
            <ThemeProvider mode="dark">
              <HarnessPanel state={taskState} />
            </ThemeProvider>
          </TuiConfigProvider>
        </KVProvider>
      </TestTuiContexts>
    ),
    { width: 80, height: 24 },
  )

  await wait(() => app!.captureCharFrame().includes("Tier 0"))
  const frame = app.captureCharFrame()
  expect(frame).toContain("Tier 0")
  expect(frame).toContain("Create formatter function")
  expect(frame).toContain("Format with ISO 8601")
})
