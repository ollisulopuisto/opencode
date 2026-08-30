import { buildLocationServiceMap } from "../location-services"
import { LocationServiceMap } from "../location-service-map"
import { LayerNode } from "./layer-node"
import { makeGlobalNode } from "./app-node"

export function build<A, E>(root: LayerNode.Node<A, E, any>, replacements: LayerNode.Replacements = []) {
  let allReplacements = replacements

  // Only build the location service map if it's actually needed.
  // Also walk replacement target nodes in case they transitively need LocationServiceMap.
  const nodeReplacements = replacements
    .map(([, target]) => target)
    .filter((t): t is LayerNode.Node<unknown, unknown, any> => typeof t === "object" && t !== null && "kind" in t)

  const needsLocationMap =
    LayerNode.hasUnbound(root, LocationServiceMap.node) ||
    nodeReplacements.some((t) => LayerNode.hasUnbound(t, LocationServiceMap.node))

  if (needsLocationMap && !hasReplacement(replacements, LocationServiceMap.node)) {
    const locationMap = buildLocationServiceMap(replacements)
    const locationMapNode = makeGlobalNode({ service: LocationServiceMap.Service, layer: locationMap, deps: [] })
    allReplacements = replacements.concat([[LocationServiceMap.node, locationMapNode]])
  }

  return LayerNode.compile(root, allReplacements)
}

function hasReplacement(replacements: LayerNode.Replacements, node: LayerNode.Node<unknown, unknown, any>) {
  return replacements.some(([source]) => source.name === node.name)
}

export * as AppNodeBuilder from "./app-node-builder"
