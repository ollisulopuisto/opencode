/** @jsxImportSource @opentui/solid */
import { afterEach, expect, test } from "bun:test"
import { onMount } from "solid-js"
import { testRender } from "@opentui/solid"
import { tmpdir } from "../../fixture/fixture"
import { createEventSource, createFetch, directory, json } from "../../fixture/tui-sdk"
import { TestTuiContexts } from "../../fixture/tui-environment"
import { ArgsProvider } from "../../../src/context/args"
import { KVProvider } from "../../../src/context/kv"
import { SDKProvider } from "../../../src/context/sdk"
import { PermissionProvider } from "../../../src/context/permission"
import { ProjectProvider } from "../../../src/context/project"
import { ExitProvider } from "../../../src/context/exit"
import { SyncProvider, useSync } from "../../../src/context/sync"
import { ThemeProvider } from "../../../src/context/theme"
import { resolve as resolveConfig, TuiConfigProvider } from "../../../src/config"
import { createPluginRuntime, PluginRuntimeProvider } from "../../../src/plugin/runtime"
import { Sidebar } from "../../../src/routes/session/sidebar"

const serverURL = "http://127.0.0.1:4096"
const sessionID = "ses_sidebar"
const session = {
  id: sessionID,
  projectID: "proj_test",
  title: "Sidebar session",
  version: "1.15.13",
  time: { created: 0, updated: 0 },
  directory,
}

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

test("shows the connected server in the sidebar footer", async () => {
  await using tmp = await tmpdir()
  await Bun.write(`${tmp.path}/kv.json`, "{}")

  const events = createEventSource()
  const calls = createFetch((request) => {
    if (request.pathname === "/session") return json([session])
    return undefined
  })

  app = await testRender(
    () => (
      <TestTuiContexts paths={{ state: tmp.path }}>
        <ArgsProvider continue>
          <KVProvider>
            <SDKProvider url={serverURL} directory={directory} fetch={calls.fetch} events={events.source}>
              <PermissionProvider>
                <ProjectProvider>
                  <ExitProvider exit={() => {}}>
                    <TuiConfigProvider config={resolveConfig({}, { terminalSuspend: false })}>
                      <PluginRuntimeProvider value={createPluginRuntime()}>
                        <SyncProvider>
                          <ThemeProvider mode="dark">
                            <Sidebar sessionID={sessionID} />
                          </ThemeProvider>
                        </SyncProvider>
                      </PluginRuntimeProvider>
                    </TuiConfigProvider>
                  </ExitProvider>
                </ProjectProvider>
              </PermissionProvider>
            </SDKProvider>
          </KVProvider>
        </ArgsProvider>
      </TestTuiContexts>
    ),
    { width: 80, height: 24 },
  )

  await wait(() => app!.captureCharFrame().includes("Sidebar session"))
  expect(app!.captureCharFrame()).toContain(serverURL)
})