import { Effect } from "effect"
import { UI } from "../ui"
import { effectCmd } from "../effect-cmd"
import { withNetworkOptions, resolveNetworkOptions } from "../network"
import { Flag } from "@opencode-ai/core/flag/flag"
import open from "open"
import { networkInterfaces } from "os"

function getNetworkIPs() {
  const nets = networkInterfaces()
  const results: string[] = []

  for (const name of Object.keys(nets)) {
    const net = nets[name]
    if (!net) continue

    for (const netInfo of net) {
      // Skip internal and non-IPv4 addresses
      if (netInfo.internal || netInfo.family !== "IPv4") continue

      // Skip Docker bridge networks (typically 172.x.x.x)
      if (netInfo.address.startsWith("172.")) continue

      results.push(netInfo.address)
    }
  }

  return results
}

import { printPairingInfo, enableTailscaleServe, detectTailscaleServe } from "../qr"

const DEFAULT_PORT = 4096

export const WebCommand = effectCmd({
  command: "web",
  builder: (yargs) => withNetworkOptions(yargs),
  describe: "start opencode server and open web interface",
  // Server loads instances per-request via x-opencode-directory header — no
  // ambient project InstanceContext needed at startup.
  instance: false,
  handler: Effect.fn("Cli.web")(function* (args) {
    const { Server } = yield* Effect.promise(() => import("../../server/server"))
    if (!Flag.OPENCODE_SERVER_PASSWORD) {
      const generatedPassword = crypto.randomUUID().replace(/-/g, "").slice(0, 16)
      process.env.OPENCODE_SERVER_PASSWORD = generatedPassword
      UI.println(UI.Style.TEXT_SUCCESS_BOLD + `🔒 OPENCODE_SERVER_PASSWORD was not set. Generated password: ${generatedPassword}`)
    }
    const opts = yield* resolveNetworkOptions(args)
    const socket = opts.socket || undefined
    const bindPort = socket ? opts.port : opts.port || DEFAULT_PORT

    let serveUrl = socket ? undefined : enableTailscaleServe(bindPort)
    if (!serveUrl && !socket) {
      serveUrl = yield* Effect.promise(() => detectTailscaleServe(bindPort))
    }

    const server = yield* Effect.promise(() =>
      Server.listen({
        ...opts,
        port: bindPort,
      }),
    )
    UI.empty()
    UI.println(UI.logo("  "))

    if (!socket && server.port !== bindPort) {
      serveUrl = enableTailscaleServe(server.port) ?? serveUrl
    }

    yield* Effect.promise(() =>
      printPairingInfo({
        port: server.port,
        socket: opts.socket,
        password: process.env.OPENCODE_SERVER_PASSWORD,
        httpsUrl: serveUrl,
      }),
    )

    const localhostUrl = `http://localhost:${server.port}`
    open(localhostUrl).catch(() => {})

    yield* Effect.never
  }),
})
