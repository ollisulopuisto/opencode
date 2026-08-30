export * as HarnessClassifier from "./classifier"

export type TaskComplexity = "TRIVIAL" | "ROUTINE" | "COMPLEX" | "ARCHITECTURAL"

export interface ComplexityAssessment {
  readonly complexity: TaskComplexity
  readonly estimatedFiles: number
  readonly requiresDecomposition: boolean
  readonly requiresSupervisorPlanning: boolean
  readonly rationale: string
  readonly suggestedBudget: {
    readonly maxFiles: number
    readonly maxLinesAdded: number
    readonly maxLinesDeleted: number
  }
}

export class TaskComplexityClassifier {
  static classify(objective: string, constraints: readonly string[] = []): ComplexityAssessment {
    const text = (objective + " " + constraints.join(" ")).toLowerCase()

    if (
      text.includes("architect") ||
      text.includes("migration") ||
      text.includes("redesign") ||
      text.includes("protocol") ||
      text.includes("database engine") ||
      text.includes("concurrency model") ||
      text.includes("breaking change")
    ) {
      return {
        complexity: "ARCHITECTURAL",
        estimatedFiles: 8,
        requiresDecomposition: true,
        requiresSupervisorPlanning: true,
        rationale: "Task involves cross-cutting architectural changes or subsystem redesign.",
        suggestedBudget: {
          maxFiles: 12,
          maxLinesAdded: 600,
          maxLinesDeleted: 400,
        },
      }
    }

    if (
      text.includes("multi-file") ||
      text.includes("multiple files") ||
      text.includes("across modules") ||
      text.includes("schema and handler") ||
      text.includes("refactor all") ||
      text.includes("subsystem") ||
      text.includes("integration")
    ) {
      return {
        complexity: "COMPLEX",
        estimatedFiles: 5,
        requiresDecomposition: true,
        requiresSupervisorPlanning: false,
        rationale: "Task spans multiple modules or interdependent components requiring decomposition.",
        suggestedBudget: {
          maxFiles: 6,
          maxLinesAdded: 300,
          maxLinesDeleted: 150,
        },
      }
    }

    if (
      text.includes("typo") ||
      text.includes("off-by-one") ||
      text.includes("null check") ||
      text.includes("fix bug in") ||
      text.includes("1-line") ||
      text.includes("simple fix") ||
      text.includes("rename variable")
    ) {
      return {
        complexity: "TRIVIAL",
        estimatedFiles: 1,
        requiresDecomposition: false,
        requiresSupervisorPlanning: false,
        rationale: "Localized bug fix or single-file adjustment; planning overhead not required.",
        suggestedBudget: {
          maxFiles: 2,
          maxLinesAdded: 25,
          maxLinesDeleted: 10,
        },
      }
    }

    return {
      complexity: "ROUTINE",
      estimatedFiles: 2,
      requiresDecomposition: false,
      requiresSupervisorPlanning: false,
      rationale: "Standard scoped implementation or refactor.",
      suggestedBudget: {
        maxFiles: 4,
        maxLinesAdded: 150,
        maxLinesDeleted: 75,
      },
    }
  }
}
