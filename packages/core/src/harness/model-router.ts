export * as HarnessModelRouter from "./model-router"

export interface ModelCandidate {
  readonly id: string
  readonly name: string
  readonly provider: string
  readonly priority: number
  readonly tier: "primary" | "secondary" | "fallback"
  readonly reasoningEffort?: "low" | "medium" | "high"
  readonly enabled: boolean
}

export interface SubstitutionEvent {
  readonly fromModel: string
  readonly toModel: string
  readonly reason: string
  readonly timestamp: number
}

export class ModelRouter {
  private readonly pool: ModelCandidate[]
  private readonly substitutions: SubstitutionEvent[] = []
  private readonly unavailableModels: Set<string> = new Set()

  constructor(customPool?: readonly ModelCandidate[]) {
    this.pool = customPool
      ? [...customPool]
      : [
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

  selectModelForRole(
    role: "explorer" | "planner" | "implementer" | "verifier" | "debugger",
    exclude: readonly string[] = [],
  ): string {
    const excludedSet = new Set([...exclude, ...this.unavailableModels])

    const prioritizedIds =
      role === "planner" || role === "debugger"
        ? [
            "opencode-go/kimi-k2.6",
            "opencode-go/qwen3.8-max",
            "opencode-go/glm-5.3-flash",
            "hetzner/Qwen3.8-27B",
          ]
        : [
            "opencode-go/glm-5.3-flash",
            "opencode-go/kimi-k2.6",
            "opencode-go/qwen3.8-max",
            "hetzner/Qwen3.8-27B",
          ]

    for (const id of prioritizedIds) {
      const candidate = this.pool.find((m) => m.id === id && m.enabled && !excludedSet.has(m.id))
      if (candidate) {
        return candidate.id
      }
    }

    return this.selectModel(exclude)
  }

  selectModel(exclude: readonly string[] = []): string {
    const excludedSet = new Set([...exclude, ...this.unavailableModels])
    const available = this.pool
      .filter((m) => m.enabled && !excludedSet.has(m.id))
      .sort((a, b) => a.priority - b.priority)

    if (available.length > 0) {
      return available[0].id
    }
    return "opencode-go/glm-5.3-flash"
  }

  isQuotaOrAvailabilityError(errorMessage: string): boolean {
    const msg = errorMessage.toLowerCase()
    return (
      msg.includes("quota") ||
      msg.includes("rate limit") ||
      msg.includes("429") ||
      msg.includes("exhausted") ||
      msg.includes("503") ||
      msg.includes("service overloaded") ||
      msg.includes("temporarily unavailable") ||
      msg.includes("capacity")
    )
  }

  handleModelFailure(failedModelId: string, reason: string): { readonly newModel: string; readonly substituted: boolean } {
    this.unavailableModels.add(failedModelId)
    const newModel = this.selectModel()

    const event: SubstitutionEvent = {
      fromModel: failedModelId,
      toModel: newModel,
      reason,
      timestamp: Date.now(),
    }
    this.substitutions.push(event)

    return {
      newModel,
      substituted: newModel !== failedModelId,
    }
  }
}
