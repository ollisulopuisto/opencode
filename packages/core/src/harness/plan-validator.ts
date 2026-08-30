export * as HarnessPlanValidator from "./plan-validator"

import type { WorkUnit } from "./state"

export interface ExecutionPlan {
  readonly objective: string
  readonly rationale: string
  readonly workUnits: readonly WorkUnit[]
  readonly estimatedRisk: "low" | "medium" | "high"
}

export interface PlanValidationResult {
  readonly valid: boolean
  readonly errors: readonly string[]
  readonly warnings: readonly string[]
}

export class PlanValidator {
  static validate(plan: ExecutionPlan): PlanValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    if (!plan.objective.trim()) {
      errors.push("Plan objective cannot be empty.")
    }

    if (plan.workUnits.length === 0) {
      errors.push("Plan must contain at least one work unit.")
      return { valid: false, errors, warnings }
    }

    const unitMap = new Map<string, WorkUnit>()
    for (const unit of plan.workUnits) {
      if (unitMap.has(unit.id)) {
        errors.push(`Duplicate WorkUnit ID detected: '${unit.id}'`)
      }
      unitMap.set(unit.id, unit)

      if (unit.writeSet.length === 0) {
        errors.push(`WorkUnit '${unit.id}' has an empty writeSet whitelist. Every unit must define bounded files.`)
      }
    }

    for (const unit of plan.workUnits) {
      for (const depId of unit.dependencies) {
        if (!unitMap.has(depId)) {
          errors.push(`WorkUnit '${unit.id}' depends on non-existent work unit '${depId}'`)
        }
        if (depId === unit.id) {
          errors.push(`WorkUnit '${unit.id}' cannot depend on itself.`)
        }
      }
    }

    const hasCycles = this.detectCycles(plan.workUnits)
    if (hasCycles) {
      errors.push("Circular dependency cycle detected in plan work units.")
    }

    const independentUnits = plan.workUnits.filter((u) => u.dependencies.length === 0)
    if (independentUnits.length > 1) {
      const seenFiles = new Map<string, string>()
      for (const u of independentUnits) {
        for (const f of u.writeSet) {
          if (seenFiles.has(f)) {
            warnings.push(
              `Potential write conflict: file '${f}' is in write-set of multiple independent units ('${seenFiles.get(f)}' and '${u.id}'). Units must be serialized.`,
            )
          } else {
            seenFiles.set(f, u.id)
          }
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    }
  }

  private static detectCycles(units: readonly WorkUnit[]): boolean {
    const visited = new Set<string>()
    const recStack = new Set<string>()
    const adj = new Map<string, readonly string[]>()

    for (const u of units) {
      adj.set(u.id, u.dependencies)
    }

    const isCyclic = (node: string): boolean => {
      visited.add(node)
      recStack.add(node)

      const neighbors = adj.get(node) ?? []
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (isCyclic(neighbor)) return true
        } else if (recStack.has(neighbor)) {
          return true
        }
      }

      recStack.delete(node)
      return false
    }

    for (const u of units) {
      if (!visited.has(u.id)) {
        if (isCyclic(u.id)) return true
      }
    }

    return false
  }
}
