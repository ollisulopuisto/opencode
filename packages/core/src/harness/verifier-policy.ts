export * as HarnessVerifierPolicy from "./verifier-policy"

import fs from "fs"
import path from "path"

export interface VerificationTierConfig {
  readonly tier0StaticCmds: readonly string[]
  readonly tier1TargetedTestTemplate: (testFiles: readonly string[]) => string | undefined
  readonly tier2RegressionCmds: readonly string[]
  readonly timeoutMs: number
  readonly fastFail: boolean
}

export class VerifierPolicy {
  private readonly workspaceRoot: string

  static discover(workspaceRoot: string = process.cwd()): VerificationTierConfig {
    return new VerifierPolicy(workspaceRoot).discoverPolicy()
  }

  constructor(workspaceRoot: string = process.cwd()) {
    this.workspaceRoot = path.resolve(workspaceRoot)
  }

  discoverPolicy(): VerificationTierConfig {
    const isBun =
      fs.existsSync(path.join(this.workspaceRoot, "bun.lock")) ||
      fs.existsSync(path.join(this.workspaceRoot, "bunfig.toml"))
    const isNode = fs.existsSync(path.join(this.workspaceRoot, "package.json"))
    const isTs = fs.existsSync(path.join(this.workspaceRoot, "tsconfig.json"))
    const isPython =
      fs.existsSync(path.join(this.workspaceRoot, "pyproject.toml")) ||
      fs.existsSync(path.join(this.workspaceRoot, "setup.py"))
    const isRust = fs.existsSync(path.join(this.workspaceRoot, "Cargo.toml"))
    const isGo = fs.existsSync(path.join(this.workspaceRoot, "go.mod"))

    let hasTypecheckScript = false
    let isMonorepo = false
    try {
      const pkgPath = path.join(this.workspaceRoot, "package.json")
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"))
        hasTypecheckScript = !!pkg.scripts?.typecheck
        isMonorepo = !!pkg.workspaces || fs.existsSync(path.join(this.workspaceRoot, "turbo.json"))
      }
    } catch {}

    const tier0StaticCmds: string[] = []
    const tier2RegressionCmds: string[] = []
    let tier1TargetedTestTemplate: (testFiles: readonly string[]) => string | undefined = () => undefined

    if (isNode || isBun) {
      if (hasTypecheckScript) {
        tier0StaticCmds.push(isBun ? "bun run typecheck" : "npm run typecheck")
      } else if (isTs) {
        tier0StaticCmds.push("tsc --noEmit")
      }
      if (isBun) {
        tier1TargetedTestTemplate = (testFiles) => (testFiles.length > 0 ? `bun test ${testFiles.join(" ")}` : undefined)
        tier2RegressionCmds.push(isMonorepo ? "bun test packages/opencode/test harness/test" : "bun test")
      } else {
        tier1TargetedTestTemplate = (testFiles) =>
          testFiles.length > 0 ? `npm test -- ${testFiles.join(" ")}` : undefined
        tier2RegressionCmds.push("npm test")
      }
    }

    if (isPython) {
      tier0StaticCmds.push("ruff check .")
      tier2RegressionCmds.push("pytest")
      tier1TargetedTestTemplate = (testFiles) => (testFiles.length > 0 ? `pytest ${testFiles.join(" ")}` : undefined)
    }

    if (isRust) {
      tier0StaticCmds.push("cargo clippy --quiet")
      tier2RegressionCmds.push("cargo test")
      tier1TargetedTestTemplate = (testFiles) =>
        testFiles.length > 0 ? `cargo test --test ${testFiles.join(" ")}` : undefined
    }

    if (isGo) {
      tier0StaticCmds.push("go vet ./...")
      tier2RegressionCmds.push("go test ./...")
      tier1TargetedTestTemplate = (testFiles) => (testFiles.length > 0 ? `go test ${testFiles.join(" ")}` : undefined)
    }

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
