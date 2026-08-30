import { describe, it, expect, beforeEach, afterEach } from "bun:test"
import * as fs from "node:fs"
import * as path from "node:path"
import * as os from "node:os"
import { VerifierPolicy } from "../src/verifier-policy"

describe("VerifierPolicy", () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "harness-policy-test-"))
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it("auto-discovers Bun + TypeScript verification policy", () => {
    fs.writeFileSync(path.join(tmpDir, "bunfig.toml"), "")
    fs.writeFileSync(path.join(tmpDir, "tsconfig.json"), "{}")

    const policy = new VerifierPolicy(tmpDir).discoverPolicy()
    expect(policy.tier0StaticCmds).toContain("tsc --noEmit")
    expect(policy.tier2RegressionCmds).toContain("bun test")
    expect(policy.tier1TargetedTestTemplate(["test/foo.test.ts"])).toBe("bun test test/foo.test.ts")
  })

  it("auto-discovers Python verification policy", () => {
    fs.writeFileSync(path.join(tmpDir, "pyproject.toml"), "")

    const policy = new VerifierPolicy(tmpDir).discoverPolicy()
    expect(policy.tier0StaticCmds).toContain("ruff check .")
    expect(policy.tier2RegressionCmds).toContain("pytest")
    expect(policy.tier1TargetedTestTemplate(["test/test_foo.py"])).toBe("pytest test/test_foo.py")
  })

  it("auto-discovers Rust verification policy", () => {
    fs.writeFileSync(path.join(tmpDir, "Cargo.toml"), "")

    const policy = new VerifierPolicy(tmpDir).discoverPolicy()
    expect(policy.tier0StaticCmds).toContain("cargo clippy --quiet")
    expect(policy.tier2RegressionCmds).toContain("cargo test")
  })
})
