// Renders mermaid diagrams on demand. The library is imported lazily the
// first time a complete ```mermaid block appears so sessions without diagrams
// never pay for the bundle. Renders are serialized: concurrent mermaid
// renders race on internal SVG ids.
import type { Mermaid } from "mermaid"

let loaded: Promise<Mermaid> | undefined
let initialized = false
let sequence = 0
let last: Promise<unknown> = Promise.resolve()

async function mermaidApi(): Promise<Mermaid> {
  loaded ??= import("mermaid").then((mod) => mod.default)
  const api = await loaded
  if (!initialized) {
    api.initialize({ startOnLoad: false, theme: "dark", securityLevel: "strict" })
    initialized = true
  }
  return api
}

export function renderMermaidSvg(source: string): Promise<string> {
  const next = last.then(async () => {
    const api = await mermaidApi()
    const { svg } = await api.render(`mermaid-${++sequence}`, source)
    return svg
  })
  last = next.catch(() => {})
  return next
}
