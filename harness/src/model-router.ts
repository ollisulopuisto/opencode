/**
 * OpenCode Harness V5.2 - Dynamic Model Router & Churn Continuity Engine
 * 
 * Implements model-pool selection, quota-overflow detection, and adaptive fallback
 * as specified in Master Design V5.2 (§27A, §33, §38A).
 */

export interface ModelCandidate {
  id: string
  name: string
  provider: string
  priority: number
  tier: "primary" | "secondary" | "fallback"
  reasoningEffort?: "low" | "medium" | "high"
  enabled: boolean
}

export interface SubstitutionEvent {
  fromModel: string
  toModel: string
  reason: string
  timestamp: number
}

export class ModelRouter {
  private pool: ModelCandidate[]
  private substitutions: SubstitutionEvent[] = []
  private unavailableModels: Set<string> = new Set()

  constructor(customPool?: ModelCandidate[]) {
    this.pool = customPool ?? [
      {
        id: "opencode-go/glm-5.3-flash",
        name: "GLM 5.3 Flash (OpenCode Go)",
        provider: "opencode-go",
        priority: 1,
        tier: "primary",
        enabled: true,
      },
      {
        id: "opencode-go/qwen3.8-max",
        name: "Qwen3.8 Max (OpenCode Go)",
        provider: "opencode-go",
        priority: 2,
        tier: "secondary",
        enabled: true,
      },
      {
        id: "hetzner/Qwen3.8-27B",
        name: "Qwen3.8 27B (Hetzner)",
        provider: "hetzner",
        priority: 3,
        tier: "fallback",
        enabled: true,
      },
      {
        id: "opencode-go/kimi-k2.6",
        name: "Kimi K2.6 (OpenCode Go)",
        provider: "opencode-go",
        priority: 4,
        tier: "fallback",
        enabled: true,
      },
    ]
  }

  /**
   * Selects the optimal available model from the pool for a specific harness lane/role.
   */
  selectModelForRole(role: "explorer" | "planner" | "implementer" | "verifier" | "debugger", exclude: string[] = []): string {
    const excludedSet = new Set([...exclude, ...this.unavailableModels])

    // Specific role prioritization:
    // • Explorer / Implementer / Verifier: GLM 5.3 Flash (high throughput, 2x usage) -> Qwen 3.8 Max -> Hetzner -> Kimi
    // • Planner / Debugger: Kimi K2.6 (200k context, thinking) -> Qwen 3.8 Max -> GLM 5.3 Flash -> Hetzner
    let prioritizedIds: string[] = []
    if (role === "planner" || role === "debugger") {
      prioritizedIds = ["opencode-go/kimi-k2.6", "opencode-go/qwen3.8-max", "opencode-go/glm-5.3-flash", "hetzner/Qwen3.8-27B"]
    } else {
      prioritizedIds = ["opencode-go/glm-5.3-flash", "opencode-go/kimi-k2.6", "opencode-go/qwen3.8-max", "hetzner/Qwen3.8-27B"]
    }

    for (const id of prioritizedIds) {
      const candidate = this.pool.find((m) => m.id === id && m.enabled && !excludedSet.has(m.id))
      if (candidate) {
        return candidate.id
      }
    }

    return this.selectModel(exclude)
  }

  /**
   * Selects the highest-priority available model from the pool.
   */
  selectModel(exclude: string[] = []): string {
    const excludedSet = new Set([...exclude, ...this.unavailableModels])
    const available = this.pool
      .filter((m) => m.enabled && !excludedSet.has(m.id))
      .sort((a, b) => a.priority - b.priority)

    if (available.length === 0) {
      console.warn(`[ModelRouter] All candidate models exhausted; resetting temporary exclusions.`)
      return this.pool[0]?.id ?? "opencode-go/glm-5.3-flash"
    }

    return available[0].id
  }

  /**
   * Determines if an error represents quota exhaustion, rate limit, or model unavailability.
   */
  static isQuotaOrAvailabilityError(errorText: string): boolean {
    const lower = errorText.toLowerCase()
    return (
      lower.includes("rate limit") ||
      lower.includes("rate_limit") ||
      lower.includes("429") ||
      lower.includes("quota") ||
      lower.includes("insufficient_quota") ||
      lower.includes("credits") ||
      lower.includes("balance") ||
      lower.includes("usage limit") ||
      lower.includes("usage_limit") ||
      lower.includes("limit reached") ||
      lower.includes("reset in") ||
      lower.includes("capacity") ||
      lower.includes("overloaded") ||
      lower.includes("temporarily unavailable") ||
      lower.includes("503") ||
      lower.includes("context_length_exceeded")
    )
  }

  /**
   * Handles a model failure, flags unavailable if quota exceeded, and selects fallback.
   */
  handleModelFailure(currentModel: string, errorText: string): { substituted: boolean; nextModel: string; reason?: string } {
    const isAvailabilityIssue = ModelRouter.isQuotaOrAvailabilityError(errorText)

    if (isAvailabilityIssue) {
      console.warn(`[ModelRouter] Model ${currentModel} encountered quota/availability failure: ${errorText}`)
      this.unavailableModels.add(currentModel)
      
      const nextModel = this.selectModel()
      const event: SubstitutionEvent = {
        fromModel: currentModel,
        toModel: nextModel,
        reason: `Quota/Availability exhaustion: ${errorText.slice(0, 120)}`,
        timestamp: Date.now(),
      }
      this.substitutions.push(event)

      console.log(`[ModelRouter] Switching execution model from ${currentModel} -> ${nextModel}`)
      return {
        substituted: true,
        nextModel,
        reason: event.reason,
      }
    }

    return {
      substituted: false,
      nextModel: currentModel,
    }
  }

  getSubstitutions(): ReadonlyArray<SubstitutionEvent> {
    return this.substitutions
  }

  reset(): void {
    this.unavailableModels.clear()
    this.substitutions = []
  }
}
