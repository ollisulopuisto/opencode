/**
 * OpenCode Harness V5.2 - Dynamic Model Registry & Adaptive Role Mapper
 * 
 * Manages model profiles, capabilities, health states, and role-based assignments
 * as specified in Master Design V5.2 (§27A, §33).
 */

import { ModelRoiAnalyzer, type RoiPreference } from "./model-roi"

export type ModelRole = "explorer" | "planner" | "implementer" | "verifier" | "debugger"
export type ModelCostTier = "free" | "cheap" | "standard" | "premium"
export type ModelHealthStatus = "healthy" | "rate_limited" | "unreachable" | "degraded"

export interface ModelProfile {
  id: string
  name: string
  provider: string
  contextWindow: number
  supportsThinking: boolean
  costTier: ModelCostTier
  roles: ModelRole[]
  health: ModelHealthStatus
  failureCount: number
  lastUsedAt?: number
  rateLimitResetAt?: number
}

export class ModelRegistry {
  private profiles: Map<string, ModelProfile> = new Map()

  /**
   * Creates a ModelRegistry initialized automatically via economic ROI analysis.
   */
  static fromAutoRoi(preference: RoiPreference = "flat_fee_first"): ModelRegistry {
    const analysis = ModelRoiAnalyzer.analyzeAndAssign(preference)
    const profiles = ModelRoiAnalyzer.toModelProfiles(analysis)
    return new ModelRegistry(profiles)
  }

  constructor(initialProfiles?: ModelProfile[]) {
    const defaults: ModelProfile[] = initialProfiles ?? [
      {
        id: "opencode-go/glm-5.3-flash",
        name: "GLM 5.3 Flash (OpenCode Go)",
        provider: "opencode-go",
        contextWindow: 128_000,
        supportsThinking: false,
        costTier: "cheap",
        roles: ["explorer", "implementer", "debugger"],
        health: "healthy",
        failureCount: 0,
      },
      {
        id: "opencode-go/qwen3.8-max",
        name: "Qwen3.8 Max (OpenCode Go)",
        provider: "opencode-go",
        contextWindow: 128_000,
        supportsThinking: true,
        costTier: "standard",
        roles: ["planner", "implementer", "debugger"],
        health: "healthy",
        failureCount: 0,
      },
      {
        id: "hetzner/Qwen3.8-27B",
        name: "Qwen3.8 27B (Hetzner)",
        provider: "hetzner",
        contextWindow: 32_768,
        supportsThinking: false,
        costTier: "free",
        roles: ["implementer", "debugger", "verifier"],
        health: "healthy",
        failureCount: 0,
      },
      {
        id: "opencode-go/kimi-k2.6",
        name: "Kimi K2.6 (OpenCode Go)",
        provider: "opencode-go",
        contextWindow: 200_000,
        supportsThinking: true,
        costTier: "standard",
        roles: ["explorer", "planner", "implementer"],
        health: "healthy",
        failureCount: 0,
      },
    ]

    for (const p of defaults) {
      this.profiles.set(p.id, p)
    }
  }

  /**
   * Selects the optimal available model for a specific lane/role.
   */
  selectForRole(role: ModelRole, excludeIds: string[] = []): ModelProfile {
    const excluded = new Set(excludeIds)
    const candidates = Array.from(this.profiles.values())
      .filter((p) => p.roles.includes(role) && p.health === "healthy" && !excluded.has(p.id))
      .sort((a, b) => {
        // Prefer cheaper healthy models for routine tasks
        const costWeights: Record<ModelCostTier, number> = { free: 0, cheap: 1, standard: 2, premium: 3 }
        return costWeights[a.costTier] - costWeights[b.costTier]
      })

    if (candidates.length > 0) {
      return candidates[0]
    }

    // If all candidate models for this role are unavailable, return highest priority overall
    const fallback = Array.from(this.profiles.values()).find((p) => !excluded.has(p.id))
    return fallback ?? Array.from(this.profiles.values())[0]
  }

  /**
   * Registers or updates a model profile.
   */
  register(profile: ModelProfile): void {
    this.profiles.set(profile.id, profile)
  }

  /**
   * Updates the health status of a model.
   */
  markHealth(modelId: string, status: ModelHealthStatus, cooldownMs?: number): void {
    const profile = this.profiles.get(modelId)
    if (profile) {
      profile.health = status
      if (status === "rate_limited") {
        profile.rateLimitResetAt = Date.now() + (cooldownMs ?? 60_000)
        profile.failureCount++
      } else if (status === "healthy") {
        profile.failureCount = 0
        profile.rateLimitResetAt = undefined
      }
    }
  }

  /**
   * Recovers models whose rate limit cooldown has expired.
   */
  refreshRateLimits(): void {
    const now = Date.now()
    for (const profile of this.profiles.values()) {
      if (profile.health === "rate_limited" && profile.rateLimitResetAt && profile.rateLimitResetAt <= now) {
        profile.health = "healthy"
        profile.rateLimitResetAt = undefined
      }
    }
  }

  getProfile(modelId: string): ModelProfile | undefined {
    return this.profiles.get(modelId)
  }

  getAllProfiles(): ModelProfile[] {
    return Array.from(this.profiles.values())
  }
}
