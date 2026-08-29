import type { Argv } from "yargs"
import { UI } from "../ui"
import * as prompts from "@clack/prompts"
import { spawnSync } from "child_process"
import { existsSync } from "fs"
import path from "path"
import { sanitizeRepoSlug, resolveProjectsDir } from "@opencode-ai/core/tool/clone"

export const CloneCommand = {
  command: "clone <repo> [prompt]",
  describe: "clones a remote repository to local projects directory and starts opencode on it",
  builder: (yargs: Argv) => {
    return yargs
      .positional("repo", {
        describe: "git repository URL to clone (https:// or git@)",
        type: "string",
        demandOption: true,
      })
      .positional("prompt", {
        describe: "initial instructions/task for opencode to work on",
        type: "string",
      })
      .option("branch", {
        alias: "b",
        describe: "branch to check out",
        type: "string",
      })
      .option("dir", {
        alias: "d",
        describe: "custom destination directory",
        type: "string",
      })
  },
  handler: async (args: { repo: string; prompt?: string; branch?: string; dir?: string }) => {
    UI.empty()
    UI.println(UI.logo("  "))
    UI.empty()
    prompts.intro("OpenCode Remote Repo Spawner")

    const repo = args.repo.trim()
    if (!repo.startsWith("https://") && !repo.startsWith("git@") && !repo.startsWith("ssh://")) {
      prompts.log.error("Invalid repository URL. Only https://, git@, and ssh:// are supported.")
      prompts.outro("Aborted")
      return
    }

    const slug = sanitizeRepoSlug(repo)
    const projectsDir = resolveProjectsDir()
    const targetDir = args.dir ? path.resolve(args.dir) : path.join(projectsDir, slug)

    const spinner = prompts.spinner()

    if (existsSync(targetDir) && existsSync(path.join(targetDir, ".git"))) {
      spinner.stop(`Repository already exists at ${targetDir}`)
    } else {
      spinner.start(`Cloning ${repo} into ${targetDir}...`)
      const cloneArgs = ["clone"]
      if (args.branch) cloneArgs.push("--branch", args.branch)
      cloneArgs.push(repo, targetDir)

      const cloneRes = spawnSync("git", cloneArgs, { encoding: "utf8", timeout: 180000 })
      if (cloneRes.status !== 0) {
        spinner.stop("Git clone failed", 1)
        prompts.log.error(cloneRes.stderr || cloneRes.stdout)
        prompts.outro("Clone aborted")
        return
      }
      spinner.stop(`Cloned successfully to ${targetDir}`)
    }

    prompts.outro(`🚀 Launching OpenCode in ${targetDir}`)

    // Launch opencode in the target directory with initial prompt if provided
    const runArgs = ["dev", targetDir]
    if (args.prompt) {
      runArgs.push(args.prompt)
    }

    const opencodeBin = process.argv[1] || "opencode"
    spawnSync(process.argv[0] || "bun", [opencodeBin, ...runArgs], {
      cwd: targetDir,
      stdio: "inherit",
    })
  },
}
