import { describe, it, expect } from "bun:test"
import { TaskPlanner } from "../src/planner"

describe("TaskPlanner", () => {
  it("generates a structured execution plan with default work units", () => {
    const plan = TaskPlanner.createPlan("Add caching layer to session storage", {
      constraints: ["Must use Redis", "No breaking changes"],
      relevantFiles: ["src/session.ts", "src/cache.ts"],
    })

    expect(plan.objective).toBe("Add caching layer to session storage")
    expect(plan.workUnits.length).toBe(1)
    expect(plan.workUnits[0].writeSet).toEqual(["src/session.ts", "src/cache.ts"])
    expect(plan.verificationStrategy.length).toBeGreaterThan(0)
    expect(plan.rollbackPlan.length).toBeGreaterThan(0)
  })

  it("renders canonical Master Design V5.2 markdown plan", () => {
    const plan = TaskPlanner.createPlan("Migrate user schema", {
      workUnits: [
        {
          id: "wu_schema",
          title: "Update schema definitions",
          objective: "Add avatar column to schema",
          writeSet: ["src/schema.ts"],
          relevantFiles: ["src/schema.ts"],
          dependencies: [],
        },
        {
          id: "wu_handlers",
          title: "Update handlers",
          objective: "Read and save avatar in user controller",
          writeSet: ["src/user.ts"],
          relevantFiles: ["src/user.ts"],
          dependencies: ["wu_schema"],
        },
      ],
    })

    const md = TaskPlanner.toMarkdown(plan)
    expect(md).toContain("# Execution Plan:")
    expect(md).toContain("## 1. Objective")
    expect(md).toContain("## 4. Work Units & Scope Allocation")
    expect(md).toContain("Work Unit 1: Update schema definitions (`wu_schema`)")
    expect(md).toContain("Work Unit 2: Update handlers (`wu_handlers`)")
    expect(md).toContain("## 7. Rollback Plan")
  })
})
