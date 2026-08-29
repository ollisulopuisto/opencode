export * as CloneTool from "./clone"

import { Effect, Layer, Schema } from "effect"
import { Tool } from "./tool"
import { Tools } from "./tools"
import { Location } from "../location"
import { PermissionV2 } from "../permission"
import { makeLocationNode } from "../effect/app-node"
import { ToolRegistry } from "./registry"
import { spawnSync } from "child_process"
import { existsSync, mkdirSync } from "fs"
import path from "path"
import os from "os"

export const name = "repo_clone"

export const Input = Schema.Struct({
  url: Schema.String.annotate({
    description: "Git repository URL to clone (e.g. 'https://github.com/user/repo' or 'git@github.com:user/repo.git')",
  }),
  branch: Schema.optional(
    Schema.String.annotate({
      description: "Optional branch to check out (e.g. 'main', 'dev', 'feat-xyz')",
    }),
  ),
  destination: Schema.optional(
    Schema.String.annotate({
      description: "Optional destination folder path. Defaults to ~/Projects/<repo-name>",
    }),
  ),
}).annotate({ identifier: "RepoCloneInput" })

export const Output = Schema.Struct({
  path: Schema.String,
  repo: Schema.String,
  branch: Schema.optional(Schema.String),
  status: Schema.Literals(["cloned", "already_exists"]),
}).annotate({ identifier: "RepoCloneOutput" })

export type Output = typeof Output.Type

export function sanitizeRepoSlug(url: string): string {
  const clean = url.replace(/\.git$/, "").replace(/\/$/, "")
  const parts = clean.split(/[/:]/)
  const last = parts[parts.length - 1]
  return (last || "repo").replace(/[^a-zA-Z0-9-_.]/g, "-")
}

export function resolveProjectsDir(): string {
  if (process.env.OPENCODE_PROJECTS_DIR) return path.resolve(process.env.OPENCODE_PROJECTS_DIR)
  const home = os.homedir()
  const defaultDir = path.join(home, "Projects")
  if (!existsSync(defaultDir)) {
    try {
      mkdirSync(defaultDir, { recursive: true })
    } catch {}
  }
  return defaultDir
}

export const toModelOutput = (output: Output) =>
  `Repository ${output.repo} ${output.status === "cloned" ? "cloned successfully" : "already exists"} at ${output.path}.`

const layer = Layer.effectDiscard(
  Effect.gen(function* () {
    const tools = yield* Tools.Service
    const permission = yield* PermissionV2.Service

    yield* tools
      .register({
        [name]: Tool.make({
          description:
            "Clone a remote Git repository into the local projects workspace. Validates URL and safe destination.",
          input: Input,
          output: Output,
          structured: Output,
          toStructuredOutput: ({ output }) => output,
          toModelOutput: ({ output }) => [{ type: "text", text: toModelOutput(output) }],
          execute: (input, context) =>
            Effect.gen(function* () {
              // Safety validation: reject file:// and local paths
              const trimmed = input.url.trim()
              if (!trimmed.startsWith("https://") && !trimmed.startsWith("git@") && !trimmed.startsWith("ssh://")) {
                return yield* Effect.fail(
                  new Tool.Failure({
                    message: "Invalid repository URL. Only https://, git@, and ssh:// URLs are supported.",
                  }),
                )
              }

              const slug = sanitizeRepoSlug(trimmed)
              const projectsDir = resolveProjectsDir()
              const targetDir = input.destination ? path.resolve(input.destination) : path.join(projectsDir, slug)

              yield* permission.assert({
                action: name,
                resources: [targetDir],
                save: [targetDir],
                sessionID: context.sessionID,
                agent: context.agent,
                source: { type: "tool", messageID: context.assistantMessageID, callID: context.toolCallID },
              })

              if (existsSync(targetDir) && existsSync(path.join(targetDir, ".git"))) {
                return {
                  path: targetDir,
                  repo: trimmed,
                  branch: input.branch,
                  status: "already_exists" as const,
                }
              }

              const args = ["clone"]
              if (input.branch) {
                args.push("--branch", input.branch)
              }
              args.push(trimmed, targetDir)

              const cloneRes = spawnSync("git", args, {
                encoding: "utf8",
                timeout: 180000,
              })

              if (cloneRes.status !== 0) {
                return yield* Effect.fail(
                  new Tool.Failure({
                    message: `git clone failed (exit ${cloneRes.status}): ${cloneRes.stderr || cloneRes.stdout}`,
                  }),
                )
              }

              return {
                path: targetDir,
                repo: trimmed,
                branch: input.branch,
                status: "cloned" as const,
              }
            }).pipe(Effect.mapError((err) => new Tool.Failure({ message: `repo_clone failed: ${err}` }))),
        }),
      })
      .pipe(Effect.orDie)
  }),
)

export const node = makeLocationNode({
  name: "tool/repo-clone",
  layer,
  deps: [ToolRegistry.node, Location.node, PermissionV2.node],
})
