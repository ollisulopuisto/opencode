import { describe, it, expect } from "bun:test"
import { TaskComplexityClassifier } from "../src/classifier"

describe("TaskComplexityClassifier", () => {
  it("classifies trivial tasks accurately", () => {
    const res = TaskComplexityClassifier.classify("Fix off-by-one error in parseRange")
    expect(res.complexity).toBe("TRIVIAL")
    expect(res.requiresDecomposition).toBe(false)
    expect(res.suggestedBudget.maxFiles).toBeLessThanOrEqual(2)
  })

  it("classifies routine feature additions accurately", () => {
    const res = TaskComplexityClassifier.classify("Add formatNumber option flag for hex strings")
    expect(res.complexity).toBe("ROUTINE")
    expect(res.requiresDecomposition).toBe(false)
  })

  it("classifies complex multi-file changes accurately", () => {
    const res = TaskComplexityClassifier.classify("Update task schema and refactor all 3 renderers across modules")
    expect(res.complexity).toBe("COMPLEX")
    expect(res.requiresDecomposition).toBe(true)
    expect(res.requiresSupervisorPlanning).toBe(false)
  })

  it("classifies architectural redesigns as ARCHITECTURAL", () => {
    const res = TaskComplexityClassifier.classify("Redesign database engine concurrency model with breaking changes")
    expect(res.complexity).toBe("ARCHITECTURAL")
    expect(res.requiresDecomposition).toBe(true)
    expect(res.requiresSupervisorPlanning).toBe(true)
  })
})
