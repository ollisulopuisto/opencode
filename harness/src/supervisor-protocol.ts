/**
 * OpenCode Harness V5.2 - Gemini Supervisory Protocol & Quota Policy
 * 
 * Manages Gemini as a scarce strategic supervisor (§1, §7, §28):
 * - Enforces max 2 interventions per task
 * - Deterministically guards escalation triggers
 * - Rejects low-value routine escalations
 */

export type EscalationTrigger =
  | "PLAN_APPROVAL"
  | "REPEATED_RECOVERY_FAILURE"
  | "SCOPE_BUDGET_EXCEEDED"
  | "CONTRADICTORY_EVIDENCE"

export interface EscalationRequest {
  taskId: string
  trigger: EscalationTrigger
  recoveryAttempts: number
  failedTests: string[]
  budgetViolations: string[]
  contextDetails: string
}

export interface EscalationDecision {
  allowed: boolean
  rejectionReason?: string
  remainingInterventions: number
}

export class SupervisorProtocol {
  private maxInterventionsPerTask: number
  private interventionsUsed: number = 0

  constructor(maxInterventions: number = 2) {
    this.maxInterventionsPerTask = maxInterventions
  }

  /**
   * Evaluates whether an escalation request meets supervisory trigger criteria and budget.
   */
  evaluateEscalation(request: EscalationRequest): EscalationDecision {
    // 1. Check intervention quota budget
    if (this.interventionsUsed >= this.maxInterventionsPerTask) {
      return {
        allowed: false,
        rejectionReason: `Supervisory intervention budget exhausted (${this.interventionsUsed}/${this.maxInterventionsPerTask} used).`,
        remainingInterventions: 0,
      }
    }

    // 2. Validate trigger criteria
    switch (request.trigger) {
      case "PLAN_APPROVAL":
        // Allowed for high-complexity / architectural plans
        return this.grantIntervention()

      case "REPEATED_RECOVERY_FAILURE":
        // Strict requirement: must have attempted at least 2 local recovery turns
        if (request.recoveryAttempts < 2) {
          return {
            allowed: false,
            rejectionReason: `Insufficient local recovery attempts (${request.recoveryAttempts}/2). Local execution model must attempt hypothesis-driven recovery before escalating.`,
            remainingInterventions: this.maxInterventionsPerTask - this.interventionsUsed,
          }
        }
        return this.grantIntervention()

      case "SCOPE_BUDGET_EXCEEDED":
        if (request.budgetViolations.length === 0) {
          return {
            allowed: false,
            rejectionReason: "No actual budget violations recorded in escalation request.",
            remainingInterventions: this.maxInterventionsPerTask - this.interventionsUsed,
          }
        }
        return this.grantIntervention()

      case "CONTRADICTORY_EVIDENCE":
        return this.grantIntervention()

      default:
        return {
          allowed: false,
          rejectionReason: "Unknown escalation trigger.",
          remainingInterventions: this.maxInterventionsPerTask - this.interventionsUsed,
        }
    }
  }

  private grantIntervention(): EscalationDecision {
    this.interventionsUsed++
    return {
      allowed: true,
      remainingInterventions: this.maxInterventionsPerTask - this.interventionsUsed,
    }
  }

  get usedInterventions(): number {
    return this.interventionsUsed
  }

  reset(): void {
    this.interventionsUsed = 0
  }
}
