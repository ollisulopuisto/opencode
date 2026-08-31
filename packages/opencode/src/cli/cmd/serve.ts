import { Effect } from "effect"
import { effectCmd } from "../effect-cmd"
import { withNetworkOptions, resolveNetworkOptions } from "../network"
import { Flag } from "@opencode-ai/core/flag/flag"
import { printPairingInfo, enableTailscaleServe, detectTailscaleServe } from "../qr"
import { resolveHostConfig } from "../host-config"
import { UI } from "../ui"

const DEFAULT_PORT = 4096

export const ServeCommand = effectCmd({
  command: "serve",
  builder: (yargs) => withNetworkOptions(yargs),
  describe: "starts a headless opencode server",
  // Server loads instances per-request via x-opencode-directory header — no
  // need for an ambient project InstanceContext at startup.
  instance: false,
  handler: Effect.fn("Cli.serve")(function* (args) {
    const { Server } = yield* Effect.promise(() => import("../../server/server"))
    const opts = yield* resolveNetworkOptions(args)
    const socket = opts.socket || undefined
    const bindPort = socket ? opts.port : opts.port || DEFAULT_PORT

    let serveUrl = socket ? undefined : enableTailscaleServe(bindPort)
    if (!serveUrl && !socket) {
      serveUrl = yield* Effect.promise(() => detectTailscaleServe(bindPort))
    }

    const security = resolveHostConfig({
      tailscale: !!serveUrl,
      socket: !!socket,
      hostnameExplicit: false,
      hostname: opts.hostname,
      password: Flag.OPENCODE_SERVER_PASSWORD,
    })

    if (security.generated) {
      process.env.OPENCODE_SERVER_PASSWORD = security.password
      console.log(`🔒 OPENCODE_SERVER_PASSWORD was not set. Generated secure password: ${security.password}`)
      console.log(`   Export OPENCODE_SERVER_PASSWORD in your shell/environment to use a permanent password.\n`)
    } else if (!security.auth) {
      delete process.env.OPENCODE_SERVER_PASSWORD
    }

    const server = yield* Effect.promise(() =>
      Server.listen({
        ...opts,
        port: bindPort,
        hostname: security.hostname,
      }),
    )

    if (!socket && server.port !== bindPort) {
      serveUrl = enableTailscaleServe(server.port) ?? serveUrl
    }

    yield* Effect.promise(() =>
      printPairingInfo({
        port: server.port,
        socket: opts.socket,
        password: process.env.OPENCODE_SERVER_PASSWORD,
        httpsUrl: serveUrl,
        localOnly: security.hostname === "127.0.0.1",
      }),
    )

    yield* Effect.never
  }),
})

