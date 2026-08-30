import { cmd } from "./cmd"
import { UI } from "@/cli/ui"
import { errorMessage } from "@opencode-ai/tui/util/error"
import { withNetworkOptions, resolveNetworkOptionsNoConfig, hasArg } from "@/cli/network"
import { validateSession } from "../tui/validate-session"
import { ServerAuth } from "@/server/auth"
import { printPairingInfo } from "@/cli/qr"
import { HostState } from "@/cli/host-state"
import { resolveThreadDirectory } from "./tui"
import { Filesystem } from "@/util/filesystem"
import { Flag } from "@opencode-ai/core/flag/flag"
import { ClientTracker } from "@opencode-ai/server/client-tracker"

const DEFAULT_IDLE_EXIT_SECONDS = 30
const DEFAULT_PORT = 4096

export const HostCommand = cmd({
  command: "host [project]",
  describe: "start (or reuse) an opencode server, pair a remote client over QR, and attach a TUI to it",
  builder: (yargs) =>
    withNetworkOptions(yargs)
      .positional("project", {
        type: "string",
        describe: "path to start the TUI in",
      })
      .option("password", {
        alias: ["p"],
        type: "string",
        describe: "basic auth password (defaults to OPENCODE_SERVER_PASSWORD or the running server's)",
      })
      .option("username", {
        alias: ["u"],
        type: "string",
        describe: "basic auth username (defaults to OPENCODE_SERVER_USERNAME or 'opencode')",
      })
      .option("continue", {
        alias: ["c"],
        describe: "continue the last session",
        type: "boolean",
      })
      .option("session", {
        alias: ["s"],
        type: "string",
        describe: "session id to continue",
      })
      .option("fork", {
        type: "boolean",
        describe: "fork the session when continuing (use with --continue or --session)",
      })
      .option("idle-exit", {
        type: "number",
        describe: "seconds to keep the server alive after the last client disconnects (0 disables)",
        default: DEFAULT_IDLE_EXIT_SECONDS,
      })
      .option("no-qr", {
        type: "boolean",
        describe: "skip printing the QR pairing code",
        default: false,
      })
      .option("mini", {
        type: "boolean",
        describe: "start the minimal interactive interface",
        default: false,
      })
      .option("replay", {
        type: "boolean",
        hidden: true,
      })
      .option("no-replay", {
        type: "boolean",
        describe: "disable mini session history replay on resume and after resize",
      })
      .option("replay-limit", {
        type: "number",
        describe: "cap visible mini replay to the newest N messages",
      }),
  handler: async (args) => {
    if (args.replay === true) {
      UI.error("--replay is not supported; replay is enabled by default")
      process.exitCode = 1
      return
    }
    const noReplay = args.replay === false || args.noReplay === true

    if (args.fork && !args.continue && !args.session) {
      UI.error("--fork requires --continue or --session")
      process.exitCode = 1
      return
    }

    const next = resolveThreadDirectory(args.project)
    try {
      process.chdir(next)
    } catch {
      UI.error("Failed to change directory to " + next)
      process.exitCode = 1
      return
    }
    const directory = Filesystem.resolve(process.cwd())

    const network = resolveNetworkOptionsNoConfig(args)
    const socket = network.socket || undefined
    const record = await HostState.read()
    const suppliedPassword = args.password ?? Flag.OPENCODE_SERVER_PASSWORD ?? record?.password

    const existing = await findExistingServer({ socket, network, record })
    const owned = !existing

    let port = existing?.port
    let password = suppliedPassword

    if (!existing) {
      if (!password) {
        password = crypto.randomUUID().replace(/-/g, "").slice(0, 16)
        process.env.OPENCODE_SERVER_PASSWORD = password
        UI.println(
          UI.Style.TEXT_DIM +
            `🔒 OPENCODE_SERVER_PASSWORD was not set. Generated password: ${password}` +
            UI.Style.TEXT_NORMAL,
        )
      }
      const { Server } = await import("../../server/server")
      const server = await Server.listen({
        hostname: network.hostname,
        port: network.port,
        socket,
        mdns: network.mdns,
        mdnsDomain: network.mdnsDomain,
        cors: network.cors,
        ...(args.idleExit > 0
          ? {
              idleExit: {
                graceMs: args.idleExit * 1000,
                onIdle: () => {
                  HostState.clear().catch(() => {})
                  process.exit(0)
                },
              },
            }
          : {}),
      })
      port = server.port
      await HostState.write({
        port: server.port,
        socket,
        password,
        pid: process.pid,
        startedAt: Date.now(),
      })
    }

    const url = socket ? socket : `http://127.0.0.1:${port}`
    const headers = ServerAuth.headers({ password, username: args.username })

    if (!args.noQr) {
      await printPairingInfo({ port, socket, password })
    }

    try {
      await validateSession({ url, sessionID: args.session, directory, headers })
    } catch (error) {
      UI.error(errorMessage(error))
      if (owned) {
        HostState.clear().catch(() => {})
        process.exit(1)
      }
      process.exitCode = 1
      return
    }

    try {
      if (args.mini) {
        const { runMini } = await import("./run")
        await runMini({
          attach: url,
          directory,
          password,
          username: args.username,
          continue: args.continue,
          session: args.session,
          fork: args.fork,
          replay: noReplay ? false : undefined,
          replayLimit: args.replayLimit,
        })
      } else {
        const { TuiConfig } = await import("@/config/tui")
        const config = await TuiConfig.get()
        const { Effect } = await import("effect")
        const { run } = await import("../tui/layer")
        const { createLegacyTuiPluginHost } = await import("@/plugin/tui/runtime")
        await Effect.runPromise(
          run({
            url,
            config,
            pluginHost: createLegacyTuiPluginHost(),
            args: {
              continue: args.continue,
              sessionID: args.session,
              fork: args.fork,
            },
            directory,
            headers,
          }),
        )
      }
    } catch (error) {
      if (owned) {
        HostState.clear().catch(() => {})
        process.exit(1)
      }
      throw error
    }

    if (!owned) return

    const idleNote =
      args.idleExit > 0
        ? `exits ${args.idleExit}s after the last client disconnects`
        : "stays running until you stop it with Ctrl-C"
    UI.println(
      UI.Style.TEXT_DIM + `TUI detached — server still up (${ClientTracker.count()} client(s) connected), ${idleNote}.`,
    )
    await new Promise(() => {})
  },
})

async function findExistingServer(input: {
  socket?: string
  network: ReturnType<typeof resolveNetworkOptionsNoConfig>
  record?: HostState.HostRecord
}) {
  if (input.socket) {
    const fs = await import("fs")
    if (fs.existsSync(input.socket)) return { socket: input.socket, port: 0 }
    return undefined
  }
  const explicitPort = hasArg("--port") ? input.network.port : undefined
  const port = explicitPort ?? input.record?.port ?? DEFAULT_PORT
  if (await HostState.probe(`http://127.0.0.1:${port}`)) return { port }
  return undefined
}
