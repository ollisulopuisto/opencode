/** @jsxImportSource @opentui/solid */
import { test } from "bun:test"
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
import { Sidebar } from "../../../src/routes/session/sidebar"
import { ThemeProvider } from "../../../src/context/theme"
import { resolve as resolveConfig, TuiConfigProvider } from "../../../src/config"
import { createPluginRuntime, PluginRuntimeProvider } from "../../../src/plugin/runtime"

const sessionID = "ses_sidebar"
const session = {
  id: sessionID,
  projectID: "proj_test",
  title: "Sidebar session",
  version: "1.15.13",
  time: { created: 0, updated: 0 },
  directory,
}

test("debug", async () => {
  await using tmp = await tmpdir()
  await Bun.write(`${tmp.path}/kv.json`, "{}")

  const events = createEventSource()
  let sessionRequests: string[] = []
  const calls = createFetch((request) => {
    if (request.pathname === "/session") {
      sessionRequests.push(request.href)
      return json([session])
    }
    return undefined
  })

  let sync!: ReturnType<typeof useSync>
  const app = await testRender(
    () => (
      <TestTuiContexts paths={{ state: tmp.path }}>
        <ArgsProvider continue>
          <KVProvider>
            <SDKProvider url="http://test" directory={directory} fetch={calls.fetch} events={events.source}>
              <PermissionProvider>
                <ProjectProvider>
                  <ExitProvider exit={() => {}}>
                    <TuiConfigProvider config={resolveConfig({}, { terminalSuspend: false })}>
                      <PluginRuntimeProvider value={createPluginRuntime()}>
                        <SyncProvider>
                          <ThemeProvider mode="dark">
                            <Probe />
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

  function Probe() {
    const ctx = useSync()
    onMount(() => {
      sync = ctx
    })
    return <box><text>PROBE</text></box>
  }

  await Bun.sleep(1500)
  await app.renderOnce()
  console.log("sessionRequests:", sessionRequests)
  console.log("status:", sync?.status)
  console.log("sessions:", JSON.stringify(sync?.data.session))
  console.log("path:", JSON.stringify(sync?.path))
  console.log("frame:", JSON.stringify(app.captureCharFrame()))
  app.renderer.destroy()
})