import { describe, it, expect } from "bun:test"
import { SupervisorBridge, type SupervisoryDirective } from "../src/supervisor-bridge"
import { TaskStateMachine } from "../src/state"

describe("SupervisorBridge", () => {
  it("compiles structured Supervisory Escalation Packet from state machine", () => {
    const sm = new TaskStateMachine("task_esc_1", "Implement OAuth2 client")
    sm.recordFailure("TEST_FAILURE", "Invalid token response", 1, "Expected 200 OK got 401")
    sm.recordFailure("TEST_FAILURE", "Invalid token response", 2, "Expected 200 OK got 401")

    const packet = SupervisorBridge.compilePacket(
      sm,
      "REPEATED_RECOVERY_FAILURE",
      "OAuth2 token endpoint returned HTTP 401 Unauthorized",
      "Provide correct token exchange parameter requirements."
    )

    expect(packet.taskId).toBe("task_esc_1")
    expect(packet.trigger).toBe("REPEATED_RECOVERY_FAILURE")
    expect(packet.attemptedHypotheses.length).toBe(2)
    expect(packet.diagnosticsSummary).toContain("HTTP 401")

    const md = SupervisorBridge.formatPacketMarkdown(packet)
    expect(md).toContain("# GEMINI SUPERVISORY ESCALATION: [task_esc_1]")
    expect(md).toContain("## 1. ESCALATION TRIGGER & REASON")
    expect(md).toContain("`REPEATED_RECOVERY_FAILURE`")
    expect(md).toContain("## 6. REQUESTED SUPERVISORY DECISION")
  })

  it("applies supervisory directive and updates state machine without amnesia", () => {
    const sm = new TaskStateMachine("task_esc_2", "Fix database lock")
    const bridge = new SupervisorBridge()

    const directive: SupervisoryDirective = {
      rootCauseDiagnosis: "Deadlock caused by out-of-order table locking in transactions.",
      actionableDirective: "Acquire locks strictly in alphabetical table order across both repositories.",
      newHypothesis: "Alphabetical locking eliminates cycle deadlock condition.",
    }

    bridge.applyDirective(sm, directive)

    expect(sm.snapshot.geminiInterventions).toBe(1)
    expect(sm.snapshot.currentHypothesis).toBe("Alphabetical locking eliminates cycle deadlock condition.")
    expect(sm.snapshot.decisions.length).toBeGreaterThanOrEqual(1)
    expect(sm.snapshot.decisions.some((d) => d.includes("Deadlock caused by out-of-order"))).toBe(true)
  })
})
