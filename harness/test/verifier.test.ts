import { describe, expect, it } from "bun:test"
import { VerificationGate } from "../src/verifier"

describe("VerificationGate", () => {
  it("verifies successful commands with exit code 0", async () => {
    const result = await VerificationGate.verify("echo 'test passed'", {
      cwd: process.cwd(),
    })

    expect(result.correct).toBe(true)
    expect(result.exitCode).toBe(0)
    expect(result.confidence).toBe(1.0)
    expect(result.issues.length).toBe(0)
  })

  it("captures failure exit codes and extracts issue diagnostics", async () => {
    const result = await VerificationGate.verify("sh -c 'echo \"AssertionError: expected true but got false\" >&2; exit 1'", {
      cwd: process.cwd(),
    })

    expect(result.correct).toBe(false)
    expect(result.exitCode).toBe(1)
    expect(result.confidence).toBe(0.0)
    expect(result.issues.length).toBeGreaterThan(0)
    expect(result.issues.some((i) => i.includes("AssertionError"))).toBe(true)
  })

  it("handles timeout correctly", async () => {
    const result = await VerificationGate.verify("sleep 5", {
      cwd: process.cwd(),
      timeoutMs: 100,
    })

    expect(result.correct).toBe(false)
  })
})
