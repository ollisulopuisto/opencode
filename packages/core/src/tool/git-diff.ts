export * as GitDiffTool from "./git-diff"

import { Effect, Layer, Schema } from "effect"
import { Tool } from "./tool"
import { Tools } from "./tools"
import { Location } from "../location"
import { PermissionV2 } from "../permission"
import { spawnSync } from "child_process"

export const name = "git_diff"

export const Input = Schema.Struct({
  staged: Schema.optional(
    Schema.Boolean.annotate({
      description: "If true, shows only staged changes (--staged / --cached)",
    }),
  ),
  target: Schema.optional(
    Schema.String.annotate({
      description: "Optional commit, branch, or ref to diff against (e.g. 'main', 'HEAD~1')",
    }),
  ),
  stat: Schema.optional(
    Schema.Boolean.annotate({
      description: "If true, returns only the diffstat summary instead of full patch",
    }),
  ),
}).annotate({ identifier: "GitDiffInput" })

export const Output = Schema.Struct({
  diff: Schema.String,
  stat: Schema.optional(Schema.String),
  files: Schema.Array(Schema.String),
}).annotate({ identifier: "GitDiffOutput" })

export type Output = typeof Output.Type

export const toModelOutput = (output: Output) => {
  if (output.diff.trim() === "" && (!output.stat || output.stat.trim() === "")) {
    return "Working directory is clean (no git changes detected)."
  }
  const summary = output.stat ? `Summary:\n${output.stat}\n\n` : ""
  return `${summary}Diff:\n${output.diff}`
}

const layer = Layer.effectDiscard(
  Effect.gen(function* () {
    const tools = yield* Tools.Service
    const location = yield* Location.Service
    const permission = yield* PermissionV2.Service

    yield* tools.register({
      [name]: Tool.make({
        description:
          "Inspect git working-tree changes, unified diffs against HEAD/branches, or git diffstat summary.",
        input: Input,
        output: Output,
        structured: Output,
        toStructuredOutput: ({ output }) => output,
        toModelOutput: ({ output }) => [{ type: "text", text: toModelOutput(output) }],
        execute: (input, context) =>
          Effect.gen(function* () {
            yield* permission.assert({
              action: name,
              resources: ["*"],
              save: ["*"],
              sessionID: context.sessionID,
              agent: context.agent,
              source: { type: "tool", messageID: context.assistantMessageID, callID: context.toolCallID },
            })

            const args = ["diff"]
            if (input.staged) args.push("--staged")
            if (input.target) args.push(input.target)

            const dir = location.directory
            const diffRes = spawnSync("git", args, { cwd: dir, encoding: "utf8", maxBuffer: 10 * 1024 * 1024 })
            if (diffRes.status !== 0) {
              return yield* Effect.fail(
                new Tool.Failure({ message: `git diff failed: ${diffRes.stderr || diffRes.stdout}` }),
              )
            }

            const statRes = spawnSync("git", ["diff", "--stat", ...(input.staged ? ["--staged"] : []), ...(input.target ? [input.target] : [])], {
              cwd: dir,
              encoding: "utf8",
            })

            const nameOnlyRes = spawnSync("git", ["diff", "--name-only", ...(input.staged ? ["--staged"] : []), ...(input.target ? [input.target] : [])], {
              cwd: dir,
              encoding: "utf8",
            })

            const files = nameOnlyRes.status === 0 ? nameOnlyRes.stdout.trim().split("\n").filter(Boolean) : []

            return {
              diff: diffRes.stdout,
              stat: statRes.status === 0 ? statRes.stdout.trim() : undefined,
              files,
            }
          }).pipe(Effect.mapError((err) => new Tool.Failure({ message: `git_diff failed: ${err}` }))),
      }),
    })
      .pipe(Effect.orDie)
  }),
)

import { makeLocationNode } from "../effect/app-node"
import { ToolRegistry } from "./registry"

export const node = makeLocationNode({
  name: "tool/git-diff",
  layer,
  deps: [ToolRegistry.node, Location.node, PermissionV2.node],
})
