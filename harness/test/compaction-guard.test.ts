import { describe, it, expect } from "bun:test"
import { TaskStateMachine } from "../src/state"
import { CompactionGuard } from "../src/compaction-guard"

describe("CompactionGuard", () => {
  it("generates preservation envelope with mandatory retention rules", () => {
    const sm = new TaskStateMachine("task-comp-1", "Fix database connection leak", ["Never disable pooling"])
    sm.recordTestResult("bun test connection", true)
    sm.recordFailure("RUNTIME_FAILURE", "Connection closed prematurely", 1)

    const envelope = CompactionGuard.generatePreservationEnvelope(sm.snapshot)
    expect(envelope.header).toContain("TASK STATE PRESERVATION ENVELOPE")
    expect(envelope.verifiedFacts).toContain("Verified passing check: bun test connection")
    expect(envelope.disprovenApproaches[0]).toContain("Connection closed prematurely")
    expect(envelope.instructions).toContain("MANDATORY PRESERVATION RULES")
  })

  it("formats preservation envelope with clear markdown boundaries", () => {
    const sm = new TaskStateMachine("task-comp-2", "Optimize query")
    sm.recordTestResult("test:perf", true)

    const promptText = CompactionGuard.formatForPrompt(sm.snapshot)
    expect(promptText).toContain("<!-- BEGIN TASK STATE PRESERVATION ENVELOPE -->")
    expect(promptText).toContain("<!-- END TASK STATE PRESERVATION ENVELOPE -->")
    expect(promptText).toContain("Optimize query")
  })

  it("audits preservation fidelity of post-compaction summaries", () => {
    const sm = new TaskStateMachine("task-comp-3", "Refactor logging", ["Must preserve JSON format"])
    sm.recordTestResult("test:logger", true)

    // Summary retaining all facts
    const goodSummary = `
Summary of session:
- Goal: Refactor logging
- Constraint: Must preserve JSON format
- Passed test: test:logger
`
    const goodAudit = CompactionGuard.auditPreservation(sm.snapshot, goodSummary)
    expect(goodAudit.intact).toBe(true)
    expect(goodAudit.missingConstraints.length).toBe(0)
    expect(goodAudit.missingFacts.length).toBe(0)

    // Amnesic summary missing constraints & facts
    const badSummary = `We edited some files and tried some logging changes.`
    const badAudit = CompactionGuard.auditPreservation(sm.snapshot, badSummary)
    expect(badAudit.intact).toBe(false)
    expect(badAudit.missingConstraints.length).toBe(1)
    expect(badAudit.missingFacts.length).toBe(1)
  })
})
