import { Effect } from "effect"
import { effectCmd } from "../effect-cmd"
import { withNetworkOptions, resolveNetworkOptions } from "../network"
import { Flag } from "@opencode-ai/core/flag/flag"

export const ServeCommand = effectCmd({
  command: "serve",
  builder: (yargs) => withNetworkOptions(yargs),
  describe: "starts a headless opencode server",
  // Server loads instances per-request via x-opencode-directory header — no
  // need for an ambient project InstanceContext at startup.
  instance: false,
  handler: Effect.fn("Cli.serve")(function* (args) {
    const { Server } = yield* Effect.promise(() => import("../../server/server"))
    if (!Flag.OPENCODE_SERVER_PASSWORD) {
      const generatedPassword = crypto.randomUUID().replace(/-/g, "").slice(0, 16)
      process.env.OPENCODE_SERVER_PASSWORD = generatedPassword
      console.log(`🔒 OPENCODE_SERVER_PASSWORD was not set. Generated secure password: ${generatedPassword}`)
      console.log(`   Export OPENCODE_SERVER_PASSWORD in your shell/environment to use a permanent password.\n`)
    }
    const opts = yield* resolveNetworkOptions(args)
    const server = yield* Effect.promise(() => Server.listen(opts))
    if (opts.socket) {
      console.log(`opencode server listening on unix:${opts.socket}`)
    } else {
      console.log(`opencode server listening on http://${server.hostname}:${server.port}`)
    }

    yield* Effect.never
  }),
})
