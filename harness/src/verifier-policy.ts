/**
 * OpenCode Harness V5.2 - Multi-Language Verification Policy & Discovery
 * 
 * Auto-discovers static analysis (Tier 0), targeted testing (Tier 1),
 * and full regression suites (Tier 2) across TypeScript, Python, Rust, and Go.
 */

import * as fs from "node:fs"
import * as path from "node:path"

export interface VerificationTierConfig {
  tier0StaticCmds: string[]
  tier1TargetedTestTemplate: (testFiles: string[]) => string | undefined
  tier2RegressionCmds: string[]
  timeoutMs: number
  fastFail: boolean
}

export class VerifierPolicy {
  private workspaceRoot: string

  constructor(workspaceRoot: string = process.cwd()) {
    this.workspaceRoot = path.resolve(workspaceRoot)
  }

  /**
   * Auto-discovers the verification policy for the active workspace.
   */
  discoverPolicy(): VerificationTierConfig {
    const isBun = fs.existsSync(path.join(this.workspaceRoot, "bun.lock")) || fs.existsSync(path.join(this.workspaceRoot, "bunfig.toml"))
    const isNode = fs.existsSync(path.join(this.workspaceRoot, "package.json"))
    const isTs = fs.existsSync(path.join(this.workspaceRoot, "tsconfig.json"))
    const isPython = fs.existsSync(path.join(this.workspaceRoot, "pyproject.toml")) || fs.existsSync(path.join(this.workspaceRoot, "setup.py"))
    const isRust = fs.existsSync(path.join(this.workspaceRoot, "Cargo.toml"))
    const isGo = fs.existsSync(path.join(this.workspaceRoot, "go.mod"))

    const tier0StaticCmds: string[] = []
    const tier2RegressionCmds: string[] = []
    let tier1TargetedTestTemplate: (testFiles: string[]) => string | undefined = () => undefined

    // 1. TypeScript / JavaScript Ecosystem
    if (isNode || isBun) {
      if (isTs) {
        tier0StaticCmds.push("tsc --noEmit")
      }
      if (isBun) {
        tier2RegressionCmds.push("bun test")
        tier1TargetedTestTemplate = (testFiles) => (testFiles.length > 0 ? `bun test ${testFiles.join(" ")}` : undefined)
      } else {
        tier2RegressionCmds.push("npm test")
        tier1TargetedTestTemplate = (testFiles) => (testFiles.length > 0 ? `npm test -- ${testFiles.join(" ")}` : undefined)
      }
    }

    // 2. Python Ecosystem
    if (isPython) {
      tier0StaticCmds.push("ruff check .")
      tier2RegressionCmds.push("pytest")
      tier1TargetedTestTemplate = (testFiles) => (testFiles.length > 0 ? `pytest ${testFiles.join(" ")}` : undefined)
    }

    // 3. Rust Ecosystem
    if (isRust) {
      tier0StaticCmds.push("cargo clippy --quiet")
      tier2RegressionCmds.push("cargo test")
      tier1TargetedTestTemplate = (testFiles) => (testFiles.length > 0 ? `cargo test --test ${testFiles.join(" ")}` : undefined)
    }

    // 4. Go Ecosystem
    if (isGo) {
      tier0StaticCmds.push("go vet ./...")
      tier2RegressionCmds.push("go test ./...")
      tier1TargetedTestTemplate = (testFiles) => (testFiles.length > 0 ? `go test ${testFiles.join(" ")}` : undefined)
    }

    // Default fallback if no known manifests found
    if (tier2RegressionCmds.length === 0) {
      tier2RegressionCmds.push("bun test")
      tier1TargetedTestTemplate = (testFiles) => (testFiles.length > 0 ? `bun test ${testFiles.join(" ")}` : undefined)
    }

    return {
      tier0StaticCmds,
      tier1TargetedTestTemplate,
      tier2RegressionCmds,
      timeoutMs: 60_000,
      fastFail: true,
    }
  }
}
