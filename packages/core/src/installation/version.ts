import { readFileSync } from "node:fs"
import path from "node:path"

declare global {
  const OPENCODE_VERSION: string
  const OPENCODE_CHANNEL: string
}

function localVersion() {
  try {
    // Dev builds (e.g. `bun dev`) have no injected OPENCODE_VERSION, so report the
    // workspace version with a calver build date appended to resemble upstream.
    const pkgPath = path.join(path.dirname(import.meta.path), "../../package.json")
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8"))
    if (typeof pkg?.version !== "string") return "local"
    const now = new Date()
    const calver = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`
    return `${pkg.version}+${calver}`
  } catch {
    return "local"
  }
}

export const InstallationVersion = typeof OPENCODE_VERSION === "string" ? OPENCODE_VERSION : localVersion()
export const InstallationChannel = typeof OPENCODE_CHANNEL === "string" ? OPENCODE_CHANNEL : "local"
export const InstallationLocal = InstallationChannel === "local"
