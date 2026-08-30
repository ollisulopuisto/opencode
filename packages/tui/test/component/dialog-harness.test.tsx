/** @jsxImportSource @opentui/solid */
import { afterEach, expect, test } from "bun:test"
import { testRender } from "@opentui/solid"
import { ThemeProvider } from "../../src/context/theme"
import { DialogHarness } from "../../src/component/harness/dialog-harness"
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

test("renders full DialogHarness modal with verification gates and details", async () => {
  await using tmp = await tmpdir()
  await Bun.write(`${tmp.path}/kv.json`, "{}")

  const taskState = {
    taskId: "task_modal_1",
    objective: "Add CalVer commit dialog",
    currentState: "VERIFY" as const,
    constraints: [],
    decisions: ["Directive: Ensure non-zero exit on test fail"],
    workUnits: [
      {
        id: "wu_1",
        title: "Implement dialog component",
        objective: "Add DialogHarness",
        writeSet: ["packages/tui/src/component/harness/dialog-harness.tsx"],
        relevantFiles: [],
        dependencies: [],
        status: "verified" as const,
      },
    ],
    activeWorkUnitId: "wu_1",
    filesChanged: ["packages/tui/src/component/harness/dialog-harness.tsx"],
    linesAdded: 40,
    linesDeleted: 0,
    testsRun: [
      { name: "Tier 0 Static: typecheck", passed: true, durationMs: 100 },
      { name: "Tier 1 Targeted: dialog.test.tsx", passed: true, durationMs: 50 },
      { name: "Tier 2 Regression: tui suite", passed: true, durationMs: 300 },
    ],
    failures: [],
    currentHypothesis: "Render full modal within Dialog context",
    remainingWork: [],
    knownUnknowns: [],
    history: [],
    supervisorInterventions: 0,
    modelTurns: 1,
  }

  app = await testRender(
    () => (
      <TestTuiContexts paths={{ state: tmp.path }}>
        <KVProvider>
          <TuiConfigProvider config={resolveConfig({}, { terminalSuspend: false })}>
            <ThemeProvider mode="dark">
              <DialogHarness state={taskState} />
            </ThemeProvider>
          </TuiConfigProvider>
        </KVProvider>
      </TestTuiContexts>
    ),
    { width: 80, height: 24 },
  )

  await wait(() => app!.captureCharFrame().includes("Harness Governance"))
  const frame = app.captureCharFrame()
  expect(frame).toContain("Harness Governance")
  expect(frame).toContain("Tier 0")
  expect(frame).toContain("Implement dialog component")
})
