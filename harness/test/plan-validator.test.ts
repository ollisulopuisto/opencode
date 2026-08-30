import { describe, it, expect } from "bun:test"
import { PlanValidator } from "../src/plan-validator"
import { TaskPlanner } from "../src/planner"

describe("PlanValidator", () => {
  it("validates a valid DAG execution plan with 0 errors", () => {
    const plan = TaskPlanner.createPlan("Valid multi-file task", {
      workUnits: [
        {
          id: "wu_1",
          title: "Unit 1",
          objective: "First step",
          writeSet: ["src/a.ts"],
          relevantFiles: ["src/a.ts"],
          dependencies: [],
        },
        {
          id: "wu_2",
          title: "Unit 2",
          objective: "Second step",
          writeSet: ["src/b.ts"],
          relevantFiles: ["src/b.ts"],
          dependencies: ["wu_1"],
        },
      ],
    })

    const res = PlanValidator.validate(plan)
    expect(res.valid).toBe(true)
    expect(res.errors.length).toBe(0)
  })

  it("detects circular dependency cycles", () => {
    const plan = TaskPlanner.createPlan("Cyclic task", {
      workUnits: [
        {
          id: "wu_a",
          title: "Unit A",
          objective: "A",
          writeSet: ["src/a.ts"],
          relevantFiles: [],
          dependencies: ["wu_b"],
        },
        {
          id: "wu_b",
          title: "Unit B",
          objective: "B",
          writeSet: ["src/b.ts"],
          relevantFiles: [],
          dependencies: ["wu_a"],
        },
      ],
    })

    const res = PlanValidator.validate(plan)
    expect(res.valid).toBe(false)
    expect(res.errors.some((e) => e.includes("Circular dependency cycle"))).toBe(true)
  })

  it("detects empty writeSet violations", () => {
    const plan = TaskPlanner.createPlan("Unbounded task", {
      workUnits: [
        {
          id: "wu_bad",
          title: "Unbounded Unit",
          objective: "Do stuff everywhere",
          writeSet: [], // Invalid: empty write set
          relevantFiles: [],
          dependencies: [],
        },
      ],
    })

    const res = PlanValidator.validate(plan)
    expect(res.valid).toBe(false)
    expect(res.errors.some((e) => e.includes("empty writeSet"))).toBe(true)
  })

  it("warns about potential write-set collisions among independent units", () => {
    const plan = TaskPlanner.createPlan("Conflicting task", {
      workUnits: [
        {
          id: "wu_x",
          title: "Unit X",
          objective: "Modify shared file",
          writeSet: ["src/shared.ts"],
          relevantFiles: [],
          dependencies: [],
        },
        {
          id: "wu_y",
          title: "Unit Y",
          objective: "Also modify shared file concurrently",
          writeSet: ["src/shared.ts"],
          relevantFiles: [],
          dependencies: [],
        },
      ],
    })

    const res = PlanValidator.validate(plan)
    expect(res.warnings.length).toBeGreaterThan(0)
    expect(res.warnings[0]).toContain("Potential write conflict")
  })
})
