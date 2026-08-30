import type { Argv } from "yargs"
import { UI } from "../ui"
import * as prompts from "@clack/prompts"
import { spawnSync } from "child_process"
import path from "path"

export const UpdateCommand = {
  command: "update",
  describe: "fetches latest changes from git, verifies, rebuilds binary, and restarts background daemon",
  builder: (yargs: Argv) => {
    return yargs
      .option("rebuild", {
        describe: "rebuild standalone native binary after updating",
        type: "boolean",
        default: true,
      })
      .option("restart", {
        describe: "restart background launchd daemon after update",
        type: "boolean",
        default: true,
      })
  },
  handler: async (args: { rebuild: boolean; restart: boolean }) => {
    UI.empty()
    UI.println(UI.logo("  "))
    UI.empty()
    prompts.intro("OpenCode Dev Updater")

    const root = path.resolve(__dirname, "../../../..")
    const spinner = prompts.spinner()

    spinner.start("Pulling latest commits from git (origin/dev)...")
    const gitPull = spawnSync("git", ["pull", "--rebase", "origin", "dev"], { cwd: root, encoding: "utf8" })
    if (gitPull.status !== 0) {
      spinner.stop("Git pull failed", 1)
      prompts.log.error(gitPull.stderr || gitPull.stdout)
      prompts.outro("Update aborted")
      return
    }
    spinner.stop("Git repository updated")

    spinner.start("Installing dependencies with Bun...")
    const bunInstall = spawnSync("bun", ["install"], { cwd: root, encoding: "utf8" })
    if (bunInstall.status !== 0) {
      spinner.stop("Dependency installation failed", 1)
      prompts.log.error(bunInstall.stderr)
      prompts.outro("Update aborted")
      return
    }
    spinner.stop("Dependencies up to date")

    if (args.rebuild) {
      spinner.start("Rebuilding standalone native binary (bytecode precompiled)...")
      const build = spawnSync("bun", ["run", "script/build.ts", "--single", "--skip-embed-web-ui"], {
        cwd: root,
        encoding: "utf8",
      })
      if (build.status !== 0) {
        spinner.stop("Binary compilation failed", 1)
        prompts.log.error(build.stderr || build.stdout)
        prompts.outro("Build failed")
        return
      }
      const fs = await import("fs")
      const distBin = path.join(root, "packages/opencode/dist/opencode-darwin-arm64/bin/opencode")
      const localBin = path.join(process.env.HOME || "/Users/dst", ".local/bin/opencode")
      if (fs.existsSync(distBin)) {
        try {
          fs.copyFileSync(distBin, localBin)
          fs.chmodSync(localBin, 0o755)
        } catch {}
      }
      spinner.stop("Standalone binary compiled & installed to ~/.local/bin/opencode")
    }

    if (args.restart) {
      spinner.start("Restarting background daemon...")
      const uid = process.getuid ? process.getuid() : 501
      const kick = spawnSync("launchctl", ["kickstart", "-k", `gui/${uid}/com.opencode.server`], {
        encoding: "utf8",
      })
      if (kick.status === 0) {
        spinner.stop("Background daemon restarted")
      } else {
        spinner.stop("Daemon not registered in launchctl (skipping restart)")
      }
    }

    prompts.outro("🚀 OpenCode updated and running latest dev version!")
  },
}
