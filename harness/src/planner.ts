/**
 * OpenCode Harness V5.2 - Task Planner & Decomposition Engine
 * 
 * Generates structured execution plans and decomposes complex tasks into
 * bounded WorkUnit objects with explicit write-sets and dependency DAGs.
 */

import { type WorkUnit } from "./state"

export interface ExecutionPlan {
  planId: string
  objective: string
  architectureOverview: string
  proposedChanges: string
  workUnits: WorkUnit[]
  risks: string[]
  verificationStrategy: string
  rollbackPlan: string
  openQuestions: string[]
  generatedAt: number
}

export class TaskPlanner {
  /**
   * Generates a structured execution plan from an objective and constraints.
   */
  static createPlan(
    objective: string,
    options: {
      constraints?: string[]
      relevantFiles?: string[]
      workUnits?: Omit<WorkUnit, "status">[]
    } = {}
  ): ExecutionPlan {
    const constraints = options.constraints ?? []
    const relevantFiles = options.relevantFiles ?? []

    // If explicit work units are not provided, synthesize default work units
    const workUnits: WorkUnit[] = (options.workUnits ?? []).map((u) => ({
      ...u,
      status: "pending",
    }))

    if (workUnits.length === 0) {
      const lowerObj = objective.toLowerCase()
      if (
        (lowerObj.includes("schema") && lowerObj.includes("handler")) ||
        lowerObj.includes("multi-file") ||
        relevantFiles.length >= 3
      ) {
        // Multi-stage DAG decomposition for multi-file tasks
        workUnits.push({
          id: "wu_1_schema",
          title: "Schema & Interface Definitions",
          objective: "Define and update core type definitions and interfaces",
          writeSet: relevantFiles.filter(f => f.includes("type") || f.includes("schema")).length > 0
            ? relevantFiles.filter(f => f.includes("type") || f.includes("schema"))
            : ["src/types.ts", "src/schema.ts"],
          relevantFiles: relevantFiles,
          dependencies: [],
          status: "pending",
        })
        workUnits.push({
          id: "wu_2_store",
          title: "Storage & State Persistence",
          objective: "Implement storage logic, state mutations, and persistence helpers",
          writeSet: relevantFiles.filter(f => f.includes("store") || f.includes("db") || f.includes("repo")).length > 0
            ? relevantFiles.filter(f => f.includes("store") || f.includes("db") || f.includes("repo"))
            : ["src/store.ts"],
          relevantFiles: relevantFiles,
          dependencies: ["wu_1_schema"],
          status: "pending",
        })
        workUnits.push({
          id: "wu_3_handlers",
          title: "Consumer Handlers & Verification",
          objective: "Update consumer handlers, endpoints, and verify end-to-end suite",
          writeSet: relevantFiles.filter(f => f.includes("handler") || f.includes("controller") || f.includes("api") || f.includes("test")).length > 0
            ? relevantFiles.filter(f => f.includes("handler") || f.includes("controller") || f.includes("api") || f.includes("test"))
            : ["src/handler.ts", "src/index.ts", "test/**/*.ts"],
          relevantFiles: relevantFiles,
          dependencies: ["wu_2_store"],
          status: "pending",
        })
      } else {
        workUnits.push({
          id: "wu_1_impl",
          title: "Core Implementation",
          objective: objective,
          writeSet: relevantFiles.length > 0 ? relevantFiles : ["src/**/*.ts"],
          relevantFiles: relevantFiles,
          dependencies: [],
          status: "pending",
        })
      }
    }

    return {
      planId: `plan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      objective,
      architectureOverview: `Target workspace contains ${relevantFiles.length > 0 ? `${relevantFiles.length} key files` : "standard project structure"}.`,
      proposedChanges: `Implement: "${objective}" while respecting constraints: ${constraints.join(", ") || "none"}.`,
      workUnits,
      risks: [
        "Unintended scope expansion beyond assigned write sets",
        "Regressions in existing test suites",
      ],
      verificationStrategy: "Multi-Tier verification pipeline (Tier 0 static checks, Tier 1 scoped tests, Tier 2 full regression, Tier 3 diff audit).",
      rollbackPlan: "Revert git working tree state using git restore / rollback snapshot if verification fails.",
      openQuestions: [],
      generatedAt: Date.now(),
    }
  }

  /**
   * Renders the execution plan into canonical Master Design V5.2 Markdown.
   */
  static toMarkdown(plan: ExecutionPlan): string {
    const lines: string[] = []

    lines.push(`# Execution Plan: [${plan.planId}]`)
    lines.push(`## 1. Objective`)
    lines.push(plan.objective)
    lines.push("")

    lines.push(`## 2. Current Architecture & Context`)
    lines.push(plan.architectureOverview)
    lines.push("")

    lines.push(`## 3. Proposed Changes`)
    lines.push(plan.proposedChanges)
    lines.push("")

    lines.push(`## 4. Work Units & Scope Allocation`)
    for (let i = 0; i < plan.workUnits.length; i++) {
      const u = plan.workUnits[i]
      lines.push(`### Work Unit ${i + 1}: ${u.title} (\`${u.id}\`)`)
      lines.push(`- **Objective:** ${u.objective}`)
      lines.push(`- **Write Set Whitelist:** ${u.writeSet.map((f) => `\`${f}\``).join(", ")}`)
      lines.push(`- **Relevant Files:** ${u.relevantFiles.length > 0 ? u.relevantFiles.map((f) => `\`${f}\``).join(", ") : "*none*"}`)
      lines.push(`- **Dependencies:** ${u.dependencies.length > 0 ? u.dependencies.map((d) => `\`${d}\``).join(", ") : "*none (ready)*"}`)
      if (u.verificationCmd) {
        lines.push(`- **Targeted Verification:** \`${u.verificationCmd}\``)
      }
      lines.push("")
    }

    lines.push(`## 5. Risks & Mitigation`)
    for (const r of plan.risks) {
      lines.push(`- ${r}`)
    }
    lines.push("")

    lines.push(`## 6. Verification Strategy`)
    lines.push(plan.verificationStrategy)
    lines.push("")

    lines.push(`## 7. Rollback Plan`)
    lines.push(plan.rollbackPlan)

    return lines.join("\n")
  }
}
