import { describe, expect, it } from "bun:test"
import { ModelRoiAnalyzer } from "../src/model-roi"

describe("ModelRoiAnalyzer", () => {
  it("discovers active providers from environment and user auth", () => {
    const providers = ModelRoiAnalyzer.discoverAvailableProviders()
    expect(providers.length).toBeGreaterThan(0)
    expect(providers).toContain("opencode-go")
  })

  it("prioritizes flat-fee zero-marginal-cost models under flat_fee_first policy", () => {
    const analysis = ModelRoiAnalyzer.analyzeAndAssign("flat_fee_first")
    
    // Under flat_fee_first, explorer, implementer, and verifier should prefer zero marginal cost models
    expect(analysis.assignedRoles.explorer.selectedModel.pricing).toBe("flat_fee")
    expect(analysis.assignedRoles.implementer.selectedModel.pricing).toBe("flat_fee")
    expect(analysis.assignedRoles.verifier.selectedModel.pricing).toBe("flat_fee")
    expect(analysis.assignedRoles.planner.selectedModel.pricing).toBe("flat_fee")
  })

  it("assigns top reasoning models for planner and debugger under performance_first policy", () => {
    const analysis = ModelRoiAnalyzer.analyzeAndAssign("performance_first")
    expect(analysis.assignedRoles.planner.selectedModel.supportsThinking).toBe(true)
    expect(analysis.assignedRoles.debugger.selectedModel.reasoningCapability).toBeGreaterThanOrEqual(90)
  })

  it("converts ROI analysis into valid ModelProfiles for ModelRegistry", () => {
    const analysis = ModelRoiAnalyzer.analyzeAndAssign("flat_fee_first")
    const profiles = ModelRoiAnalyzer.toModelProfiles(analysis)

    expect(profiles.length).toBeGreaterThan(0)
    for (const p of profiles) {
      expect(p.roles.length).toBeGreaterThan(0)
      expect(p.health).toBe("healthy")
    }
  })

  it("generates markdown ROI analysis table and rationale", () => {
    const analysis = ModelRoiAnalyzer.analyzeAndAssign("flat_fee_first")
    const report = ModelRoiAnalyzer.formatReport(analysis)

    expect(report).toContain("Automated Model Cost-Benefit & ROI Analysis")
    expect(report).toContain("Economic Preference")
    expect(report).toContain("EXPLORER")
    expect(report).toContain("IMPLEMENTER")
    expect(report).toContain("PLANNER")
  })
})
