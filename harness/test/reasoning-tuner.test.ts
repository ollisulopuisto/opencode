import { describe, expect, it } from "bun:test"
import { ReasoningTuner } from "../src/reasoning-tuner"

describe("ReasoningTuner", () => {
  it("computes low effort for trivial tasks", () => {
    const config = ReasoningTuner.compute({
      complexity: "trivial",
      recoveryAttempts: 0,
    })
    expect(config.effort).toBe("low")
    expect(config.escalationRecommended).toBe(false)
  })

  it("computes high/highest effort for multi-file and difficult debugging tasks", () => {
    const config1 = ReasoningTuner.compute({
      complexity: "multi_file_feature",
      recoveryAttempts: 0,
    })
    expect(config1.effort).toBe("high")

    const config2 = ReasoningTuner.compute({
      complexity: "difficult_debugging",
      recoveryAttempts: 0,
    })
    expect(config2.effort).toBe("highest")
  })

  it("elevates reasoning effort during recovery turns and flags escalation after repeated failures", () => {
    const config = ReasoningTuner.compute({
      complexity: "routine_implementation",
      recoveryAttempts: 2,
      isRecoveryTurn: true,
    })
    expect(config.effort).toBe("high")

    const configEscalate = ReasoningTuner.compute({
      complexity: "difficult_debugging",
      recoveryAttempts: 2,
      isRecoveryTurn: true,
    })
    expect(configEscalate.effort).toBe("highest")
    expect(configEscalate.escalationRecommended).toBe(true)
  })

  it("formats reasoning directives cleanly for prompt inclusion", () => {
    const config = ReasoningTuner.compute({
      complexity: "architectural",
      recoveryAttempts: 0,
    })
    const formatted = ReasoningTuner.formatDirectives(config)
    expect(formatted).toContain("REASONING & EXECUTION GUIDANCE")
    expect(formatted).toContain("HIGH")
  })
})
