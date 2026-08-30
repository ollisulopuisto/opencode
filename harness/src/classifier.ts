/**
 * OpenCode Harness V5.2 - Task Complexity Classifier
 * 
 * Classifies tasks into complexity tiers to determine planning requirements:
 * - TRIVIAL: Single localized fix (bypasses planning; goes directly to execute)
 * - ROUTINE: Standard feature / localized refactor (lightweight plan)
 * - COMPLEX: Multi-file / schema change (full decomposition & dependency graph)
 * - ARCHITECTURAL: High uncertainty / cross-system design (flags for supervisor)
 */

export type TaskComplexity = "TRIVIAL" | "ROUTINE" | "COMPLEX" | "ARCHITECTURAL"

export interface ComplexityAssessment {
  complexity: TaskComplexity
  estimatedFiles: number
  requiresDecomposition: boolean
  requiresSupervisorPlanning: boolean
  rationale: string
  suggestedBudget: {
    maxFiles: number
    maxLinesAdded: number
    maxLinesDeleted: number
  }
}

export class TaskComplexityClassifier {
  /**
   * Classifies task complexity based on objective, constraints, and workspace context.
   */
  static classify(objective: string, constraints: string[] = []): ComplexityAssessment {
    const text = (objective + " " + constraints.join(" ")).toLowerCase()

    // 1. Check for Architectural indicators
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

    // 2. Check for Complex multi-file indicators
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

    // 3. Check for Trivial indicators
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

    // 4. Default to Routine
    return {
      complexity: "ROUTINE",
      estimatedFiles: 2,
      requiresDecomposition: false,
      requiresSupervisorPlanning: false,
      rationale: "Standard feature addition or targeted refactoring within 1-3 files.",
      suggestedBudget: {
        maxFiles: 4,
        maxLinesAdded: 100,
        maxLinesDeleted: 50,
      },
    }
  }
}
