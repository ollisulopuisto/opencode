import { cmd } from "./cmd"
import path from "path"
import fs from "node:fs"
import net from "node:net"
import { UI } from "@/cli/ui"
import { errorMessage } from "@opencode-ai/tui/util/error"
import { validateSession } from "../tui/validate-session"
import { ServerAuth } from "@/server/auth"
import { Flag } from "@opencode-ai/core/flag/flag"

const defaultSocketPath = "/tmp/opencode.sock"
const defaultUrl = "http://127.0.0.1:8090"

// A socket file on disk says nothing about a live listener — a crashed server
// leaves the file behind and connect() gets refused. Probe before trusting it,
// then fall back to the TCP default.
export async function resolveAttachTarget(input: { url?: string; socket?: string; defaultSocket?: string; defaultUrl?: string }) {
  if (input.socket) return input.socket
  if (input.url) return input.url
  const socketPath = input.defaultSocket ?? defaultSocketPath
  const fallbackUrl = input.defaultUrl ?? defaultUrl
  if (await probeSocket(socketPath)) return socketPath
  // fs, not Bun.file: Bun.file().exists() reports false for unix sockets.
  if (fs.existsSync(socketPath)) {
    UI.println(`${socketPath} exists but refuses connections; falling back to ${fallbackUrl}`)
  }
  return fallbackUrl
}

function probeSocket(socketPath: string) {
  return new Promise<boolean>((resolve) => {
    const socket = net.connect(socketPath)
    socket.once("connect", () => {
      socket.destroy()
      resolve(true)
    })
    socket.once("error", () => resolve(false))
  })
}

export const AttachCommand = cmd({
  command: "attach [url]",
  describe: "attach to a running opencode server",
  builder: (yargs) =>
    yargs
      .positional("url", {
        type: "string",
        describe: "http://localhost:4096 or /tmp/opencode.sock",
      })
      .option("socket", {
        type: "string",
        describe: "unix domain socket path to attach to (e.g. /tmp/opencode.sock)",
      })
      .option("dir", {
        type: "string",
        description: "directory to run in",
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
      .option("password", {
        alias: ["p"],
        type: "string",
        describe: "basic auth password (defaults to OPENCODE_SERVER_PASSWORD)",
      })
      .option("username", {
        alias: ["u"],
        type: "string",
        describe: "basic auth username (defaults to OPENCODE_SERVER_USERNAME or 'opencode')",
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
    const targetUrl = await resolveAttachTarget(args)

    if (args.replay === true) {
      UI.error("--replay is not supported; replay is enabled by default")
      process.exitCode = 1
      return
    }
    const noReplay = args.replay === false || args.noReplay === true

    const callerDir = process.env["OPENCODE_CALLER_DIR"] || process.env["INIT_CWD"] || process.env.PWD
    const directory = (() => {
      const root = callerDir || process.cwd()
      if (args.dir) {
        try {
          const resolved = path.isAbsolute(args.dir) ? args.dir : path.resolve(root, args.dir)
          process.chdir(resolved)
          return process.cwd()
        } catch {
          // If the directory doesn't exist locally (remote attach), pass it through.
          return args.dir
        }
      }
      try {
        process.chdir(root)
      } catch {}
      return root
    })()

    if (Flag.OPENCODE_DEBUG) {
      console.error(`[attach-debug] targetUrl: ${targetUrl} | callerDir: ${callerDir} | PWD: ${process.env.PWD} | cwd: ${process.cwd()} | directory: ${directory}`)
    }

    if (args.mini) {
      const { runMini } = await import("./run")
      await runMini({
        attach: targetUrl,
        directory,
        password: args.password,
        username: args.username,
        continue: args.continue,
        session: args.session,
        fork: args.fork,
        replay: noReplay ? false : undefined,
        replayLimit: args.replayLimit,
      })
      return
    }

    const unsupported = [
      ["--no-replay", noReplay],
      ["--replay-limit", args.replayLimit !== undefined],
    ].find((entry) => entry[1])?.[0]
    if (unsupported) {
      UI.error(`${unsupported} requires --mini`)
      process.exitCode = 1
      return
    }

    const { TuiConfig } = await import("@/config/tui")
    if (args.fork && !args.continue && !args.session) {
      UI.error("--fork requires --continue or --session")
      process.exitCode = 1
      return
    }

    const headers = ServerAuth.headers({ password: args.password, username: args.username })
    const config = await TuiConfig.get()

    try {
      await validateSession({
        url: targetUrl,
        sessionID: args.session,
        directory,
        headers,
      })
    } catch (error) {
      UI.error(errorMessage(error))
      process.exitCode = 1
      return
    }

    const { Effect } = await import("effect")
    const { run } = await import("../tui/layer")
    const { createLegacyTuiPluginHost } = await import("@/plugin/tui/runtime")
    await Effect.runPromise(
      run({
        url: targetUrl,
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
  },
})
