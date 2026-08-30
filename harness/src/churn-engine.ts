/**
 * OpenCode Harness V5.2 - Model-Loss Continuity & Churn Recovery Engine
 * 
 * Manages model disappearance, quota exhaustion, and mid-task model substitution
 * without state corruption or task amnesia as specified in Master Design V5.2 (§38A).
 */

import { ModelRegistry, type ModelRole, type ModelProfile } from "./model-registry"
import { TaskStateMachine } from "./state"
import { TaskStatePersistence } from "./persistence"

export interface ModelSubstitutionLog {
  fromModel: string
  toModel: string
  role: ModelRole
  reason: string
  timestamp: number
  turnNumber: number
}

export interface ChurnRecoveryResult {
  substituted: boolean
  previousModel: string
  activeModel: string
  profile: ModelProfile
  promptAdaptationAdvice?: string
  log?: ModelSubstitutionLog
}

export class ChurnRecoveryEngine {
  private registry: ModelRegistry
  private substitutionHistory: ModelSubstitutionLog[] = []

  constructor(registry?: ModelRegistry) {
    this.registry = registry ?? new ModelRegistry()
  }

  /**
   * Evaluates a turn error and executes seamless model substitution if loss/quota failure occurs.
   */
  async handleModelLoss(
    currentModelId: string,
    role: ModelRole,
    errorText: string,
    stateMachine: TaskStateMachine,
    persistence?: TaskStatePersistence
  ): Promise<ChurnRecoveryResult> {
    const isModelOutage = this.isModelOutageOrQuotaError(errorText)

    if (!isModelOutage) {
      const currentProfile = this.registry.getProfile(currentModelId) ?? this.registry.selectForRole(role)
      return {
        substituted: false,
        previousModel: currentModelId,
        activeModel: currentModelId,
        profile: currentProfile,
      }
    }

    console.warn(`[ChurnEngine] Model ${currentModelId} failed for role '${role}': ${errorText.slice(0, 100)}`)

    // 1. Mark failed model
    const cooldownMs = errorText.toLowerCase().includes("rate limit") ? 120_000 : 300_000
    this.registry.markHealth(currentModelId, "rate_limited", cooldownMs)

    // 2. Checkpoint task state before substitution
    if (persistence) {
      persistence.save(stateMachine.snapshot)
      persistence.createSnapshot(stateMachine.snapshot, `model_churn_${Date.now()}`)
    }

    // 3. Select replacement model from registry matching the required role
    const replacement = this.registry.selectForRole(role, [currentModelId])

    // 4. Create substitution record
    const subLog: ModelSubstitutionLog = {
      fromModel: currentModelId,
      toModel: replacement.id,
      role,
      reason: `Outage/Quota: ${errorText.slice(0, 120)}`,
      timestamp: Date.now(),
      turnNumber: stateMachine.snapshot.qwenTurns,
    }
    this.substitutionHistory.push(subLog)

    console.log(`[ChurnEngine] Seamless substitution: ${currentModelId} ➔ ${replacement.id} (${replacement.name})`)

    // 5. Generate prompt adaptation advice
    let promptAdaptationAdvice: string | undefined
    if (replacement.supportsThinking) {
      promptAdaptationAdvice = "Replacement model supports deep chain-of-thought thinking."
    } else if (replacement.contextWindow < 64_000) {
      promptAdaptationAdvice = "Replacement model has compact context window; keep context injection compact."
    }

    return {
      substituted: true,
      previousModel: currentModelId,
      activeModel: replacement.id,
      profile: replacement,
      promptAdaptationAdvice,
      log: subLog,
    }
  }

  /**
   * Detects quota, rate-limit, 503, or provider disconnects.
   */
  isModelOutageOrQuotaError(errorText: string): boolean {
    const lower = errorText.toLowerCase()
    return (
      lower.includes("rate limit") ||
      lower.includes("rate_limit") ||
      lower.includes("429") ||
      lower.includes("quota") ||
      lower.includes("insufficient_quota") ||
      lower.includes("credits") ||
      lower.includes("balance") ||
      lower.includes("503") ||
      lower.includes("502") ||
      lower.includes("service overloaded") ||
      lower.includes("temporarily unavailable") ||
      lower.includes("model not found") ||
      lower.includes("endpoint disabled")
    )
  }

  getSubstitutionHistory(): ReadonlyArray<ModelSubstitutionLog> {
    return this.substitutionHistory
  }

  getRegistry(): ModelRegistry {
    return this.registry
  }
}
