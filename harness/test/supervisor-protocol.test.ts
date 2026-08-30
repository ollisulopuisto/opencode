import { describe, it, expect } from "bun:test"
import { SupervisorProtocol, type EscalationRequest } from "../src/supervisor-protocol"

describe("SupervisorProtocol", () => {
  it("allows architectural plan approval escalation", () => {
    const protocol = new SupervisorProtocol(2)
    const req: EscalationRequest = {
      taskId: "t1",
      trigger: "PLAN_APPROVAL",
      recoveryAttempts: 0,
      failedTests: [],
      budgetViolations: [],
      contextDetails: "Architectural plan review",
    }

    const res = protocol.evaluateEscalation(req)
    expect(res.allowed).toBe(true)
    expect(res.remainingInterventions).toBe(1)
    expect(protocol.usedInterventions).toBe(1)
  })

  it("rejects repeated recovery failure escalation if recovery attempts < 2", () => {
    const protocol = new SupervisorProtocol(2)
    const req: EscalationRequest = {
      taskId: "t2",
      trigger: "REPEATED_RECOVERY_FAILURE",
      recoveryAttempts: 1, // Invalid: must have tried at least 2 turns
      failedTests: ["bun test test/auth.test.ts"],
      budgetViolations: [],
      contextDetails: "Test failed once",
    }

    const res = protocol.evaluateEscalation(req)
    expect(res.allowed).toBe(false)
    expect(res.rejectionReason).toContain("Insufficient local recovery attempts")
    expect(protocol.usedInterventions).toBe(0)
  })

  it("allows repeated recovery failure escalation after ≥2 failed local recovery turns", () => {
    const protocol = new SupervisorProtocol(2)
    const req: EscalationRequest = {
      taskId: "t3",
      trigger: "REPEATED_RECOVERY_FAILURE",
      recoveryAttempts: 2,
      failedTests: ["bun test test/auth.test.ts"],
      budgetViolations: [],
      contextDetails: "Two consecutive test failures",
    }

    const res = protocol.evaluateEscalation(req)
    expect(res.allowed).toBe(true)
    expect(res.remainingInterventions).toBe(1)
  })

  it("enforces strict intervention budget caps (max 2)", () => {
    const protocol = new SupervisorProtocol(2)
    const req: EscalationRequest = {
      taskId: "t4",
      trigger: "PLAN_APPROVAL",
      recoveryAttempts: 0,
      failedTests: [],
      budgetViolations: [],
      contextDetails: "Plan 1",
    }

    expect(protocol.evaluateEscalation(req).allowed).toBe(true) // #1
    expect(protocol.evaluateEscalation(req).allowed).toBe(true) // #2
    const res3 = protocol.evaluateEscalation(req)
    expect(res3.allowed).toBe(false) // #3 -> Exceeded
    expect(res3.rejectionReason).toContain("Supervisory intervention budget exhausted")
  })
})
