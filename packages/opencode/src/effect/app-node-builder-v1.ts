import { AppNodeBuilder } from "@opencode-ai/core/effect/app-node-builder"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { InstanceBootstrap } from "@/project/bootstrap"
import { InstanceStore } from "@/project/instance-store"
import { SessionExecution } from "@opencode-ai/core/session/execution"
import { SessionExecutionLocal } from "@opencode-ai/core/session/execution/local"

const defaultReplacements: LayerNode.Replacements = [
  [InstanceStore.bootstrapNode, InstanceBootstrap.node],
  [SessionExecution.node, SessionExecutionLocal.node],
]

export function build<A, E>(root: LayerNode.Node<A, E, any>, replacements: LayerNode.Replacements = []) {
  return AppNodeBuilder.build(root, replacements.concat(defaultReplacements))
}

export * as AppNodeBuilderV1 from "./app-node-builder-v1"
