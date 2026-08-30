import { describe, it, expect } from "bun:test"
import { ModelRegistry } from "../src/model-registry"

describe("ModelRegistry", () => {
  it("initializes with default model profiles across roles", () => {
    const registry = new ModelRegistry()
    const all = registry.getAllProfiles()
    expect(all.length).toBeGreaterThanOrEqual(4)
    expect(all.some((p) => p.id === "opencode-go/glm-5.3-flash")).toBe(true)
    expect(all.some((p) => p.id === "opencode-go/qwen3.8-max")).toBe(true)
  })

  it("selects appropriate model for role based on cost and capability", () => {
    const registry = new ModelRegistry()
    const implModel = registry.selectForRole("implementer")
    expect(implModel.health).toBe("healthy")
    expect(implModel.roles).toContain("implementer")

    const planModel = registry.selectForRole("planner")
    expect(planModel.roles).toContain("planner")
  })

  it("handles rate limiting cooldown and automatic refresh", () => {
    const registry = new ModelRegistry()
    registry.markHealth("opencode-go/glm-5.3-flash", "rate_limited", 50) // 50ms cooldown

    const selected = registry.selectForRole("implementer")
    expect(selected.id).not.toBe("opencode-go/glm-5.3-flash")

    // Wait for cooldown
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
    return wait(60).then(() => {
      registry.refreshRateLimits()
      const refreshed = registry.getProfile("opencode-go/glm-5.3-flash")
      expect(refreshed?.health).toBe("healthy")
    })
  })
})
