import { describe, expect, it } from "bun:test"
import { PromptAdapter } from "../src/prompt-adapter"

describe("PromptAdapter", () => {
  it("detects model families accurately", () => {
    expect(PromptAdapter.detectFamily("opencode-go/glm-5.3-flash")).toBe("glm")
    expect(PromptAdapter.detectFamily("hetzner/Qwen3.8-27B")).toBe("qwen")
    expect(PromptAdapter.detectFamily("gemini-2.5-flash")).toBe("gemini")
    expect(PromptAdapter.detectFamily("custom-model-id")).toBe("generic")
  })

  it("formats model-adapted instructions with write set and reasoning directives", () => {
    const formatted = PromptAdapter.formatInstructions({
      modelId: "opencode-go/glm-5.3-flash",
      taskObjective: "Fix type error in project store",
      effort: "high",
      reasoningDirectives: ["Check interface exports", "Run bun typecheck"],
      assignedWriteSet: ["packages/core/src/project.ts"],
    })

    expect(formatted).toContain("EXECUTION DISCIPLINE")
    expect(formatted).toContain("PERMITTED WRITE-SET (STRICT)")
    expect(formatted).toContain("packages/core/src/project.ts")
    expect(formatted).toContain("REASONING DIRECTIVES (Effort: HIGH)")
  })

  it("formats recovery instructions when failureContext is supplied", () => {
    const formatted = PromptAdapter.formatInstructions({
      modelId: "hetzner/Qwen3.8-27B",
      taskObjective: "Fix unit test regression",
      effort: "highest",
      reasoningDirectives: ["Inspect test assertions"],
      isRecovery: true,
      failureContext: "Expected 200 OK but received 404 Not Found",
    })

    expect(formatted).toContain("RECOVERY INSTRUCTION")
    expect(formatted).toContain("Expected 200 OK but received 404 Not Found")
  })
})
