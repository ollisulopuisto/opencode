/**
 * OpenCode Harness V5.2 - Automated Model Cost-Benefit & ROI Analyzer
 * 
 * Automatically analyzes available providers & models against economic pricing tiers
 * (flat-fee/subscription vs. metered/pay-as-you-go) and assigns optimal models
 * to each harness role (Explorer, Planner, Implementer, Verifier, Debugger).
 */

import * as fs from "node:fs"
import * as path from "node:path"
import { type ModelRole, type ModelProfile } from "./model-registry"

export type PricingModel = "flat_fee" | "metered_cheap" | "metered_standard" | "metered_premium"

export type RoiPreference = "flat_fee_first" | "balanced" | "performance_first" | "lowest_cost"

export interface ModelCapabilitySpec {
  id: string
  name: string
  provider: string
  pricing: PricingModel
  contextWindow: number
  supportsThinking: boolean
  codingCapability: number // 1-100
  reasoningCapability: number // 1-100
  speedScore: number // 1-100
  costPerMillionTokens: number // USD est. (0 for flat-fee)
}

export interface RoleRoiAssessment {
  role: ModelRole
  selectedModel: ModelCapabilitySpec
  fallbackModel?: ModelCapabilitySpec
  roiScore: number
  rationale: string
}

export interface RoiAnalysisResult {
  preference: RoiPreference
  availableProviders: string[]
  assignedRoles: Record<ModelRole, RoleRoiAssessment>
  generatedAt: number
  allCandidateModels: ModelCapabilitySpec[]
}

export class ModelRoiAnalyzer {
  private static KNOWN_CATALOG: ModelCapabilitySpec[] = [
    // Flat-fee / Subscription / Local Providers (Zero Marginal Cost)
    {
      id: "opencode-go/glm-5.3-flash",
      name: "GLM 5.3 Flash (2x Usage Allowance)",
      provider: "opencode-go",
      pricing: "flat_fee",
      contextWindow: 128_000,
      supportsThinking: false,
      codingCapability: 92,
      reasoningCapability: 85,
      speedScore: 98,
      costPerMillionTokens: 0.0,
    },
    {
      id: "opencode-go/kimi-k2.6",
      name: "Kimi K2.6 (200k Deep Reasoning)",
      provider: "opencode-go",
      pricing: "flat_fee",
      contextWindow: 200_000,
      supportsThinking: true,
      codingCapability: 94,
      reasoningCapability: 97,
      speedScore: 84,
      costPerMillionTokens: 0.0,
    },
    {
      id: "opencode-go/qwen3.8-max",
      name: "Qwen 3.8 Max",
      provider: "opencode-go",
      pricing: "flat_fee",
      contextWindow: 128_000,
      supportsThinking: true,
      codingCapability: 93,
      reasoningCapability: 94,
      speedScore: 78,
      costPerMillionTokens: 0.0,
    },
    {
      id: "local-mlx/qwen2.5-coder-32b",
      name: "Qwen 2.5 Coder 32B (Local MLX)",
      provider: "local-mlx",
      pricing: "flat_fee",
      contextWindow: 65_536,
      supportsThinking: false,
      codingCapability: 89,
      reasoningCapability: 85,
      speedScore: 90,
      costPerMillionTokens: 0.0,
    },
    {
      id: "hetzner/Qwen3.8-27B",
      name: "Qwen 3.8 27B (Hetzner VPS)",
      provider: "hetzner",
      pricing: "flat_fee",
      contextWindow: 32_768,
      supportsThinking: false,
      codingCapability: 87,
      reasoningCapability: 83,
      speedScore: 88,
      costPerMillionTokens: 0.0,
    },

    // Metered / Pay-As-You-Go Providers
    {
      id: "cerebras/llama-3.3-70b",
      name: "Llama 3.3 70B (Cerebras Ultra-Fast)",
      provider: "cerebras",
      pricing: "metered_cheap",
      contextWindow: 128_000,
      supportsThinking: false,
      codingCapability: 88,
      reasoningCapability: 86,
      speedScore: 100,
      costPerMillionTokens: 0.6,
    },
    {
      id: "cloudflare-workers-ai/deepseek-r1",
      name: "DeepSeek R1 (Cloudflare)",
      provider: "cloudflare-workers-ai",
      pricing: "metered_cheap",
      contextWindow: 64_000,
      supportsThinking: true,
      codingCapability: 93,
      reasoningCapability: 96,
      speedScore: 70,
      costPerMillionTokens: 0.8,
    },
    {
      id: "google/gemini-2.5-flash",
      name: "Gemini 2.5 Flash",
      provider: "google",
      pricing: "metered_cheap",
      contextWindow: 1_000_000,
      supportsThinking: true,
      codingCapability: 90,
      reasoningCapability: 91,
      speedScore: 92,
      costPerMillionTokens: 0.3,
    },
    {
      id: "openrouter/anthropic/claude-3.7-sonnet",
      name: "Claude 3.7 Sonnet (OpenRouter)",
      provider: "openrouter",
      pricing: "metered_premium",
      contextWindow: 200_000,
      supportsThinking: true,
      codingCapability: 98,
      reasoningCapability: 98,
      speedScore: 75,
      costPerMillionTokens: 15.0,
    },
  ]

  /**
   * Discovers available providers from user auth.json and environment variables.
   */
  static discoverAvailableProviders(): string[] {
    const providers = new Set<string>()

    // 1. Inspect ~/.local/share/opencode/auth.json
    const homeDir = process.env.HOME || process.env.USERPROFILE || ""
    const authPath = path.join(homeDir, ".local", "share", "opencode", "auth.json")
    if (fs.existsSync(authPath)) {
      try {
        const raw = fs.readFileSync(authPath, "utf8")
        const auth = JSON.parse(raw) as Record<string, any>
        for (const key of Object.keys(auth)) {
          providers.add(key)
        }
      } catch {}
    }

    // 2. Inspect active environment variables
    if (process.env.OPENCODE_GO_TOKEN) providers.add("opencode-go")
    if (process.env.OPENAI_API_KEY) providers.add("openai")
    if (process.env.ANTHROPIC_API_KEY) providers.add("anthropic")
    if (process.env.GEMINI_API_KEY) providers.add("google")
    if (process.env.OPENROUTER_API_KEY) providers.add("openrouter")
    if (process.env.HETZNER_API_KEY) providers.add("hetzner")

    // Default fallback if running offline or unauthenticated
    if (providers.size === 0) {
      providers.add("opencode-go")
      providers.add("hetzner")
    }

    return Array.from(providers)
  }

  /**
   * Computes the ROI score for a model for a specific role and user preference.
   */
  static calculateRoiScore(
    model: ModelCapabilitySpec,
    role: ModelRole,
    preference: RoiPreference = "flat_fee_first"
  ): number {
    let capabilityWeight = 0

    switch (role) {
      case "explorer":
        // Explorer needs high throughput, fast speed, and decent coding comprehension
        capabilityWeight = model.speedScore * 0.6 + model.codingCapability * 0.3 + (model.contextWindow >= 128_000 ? 10 : 5)
        break
      case "planner":
        // Planner needs high reasoning, extended context, and structured thinking
        capabilityWeight = model.reasoningCapability * 0.6 + (model.supportsThinking ? 25 : 0) + (model.contextWindow >= 200_000 ? 15 : 5)
        break
      case "implementer":
        // Implementer needs high speed, fast tool execution, and strong coding capability
        capabilityWeight = model.speedScore * 0.5 + model.codingCapability * 0.5
        break
      case "verifier":
        // Verifier needs fast execution and solid test analysis
        capabilityWeight = model.speedScore * 0.5 + model.reasoningCapability * 0.4 + model.codingCapability * 0.1
        break
      case "debugger":
        // Debugger needs deep diagnostic reasoning and stack analysis
        capabilityWeight = model.reasoningCapability * 0.6 + (model.supportsThinking ? 25 : 0) + model.codingCapability * 0.15
        break
    }

    // Cost multiplier based on user economic preference
    let costMultiplier = 1.0

    if (preference === "flat_fee_first") {
      // Flat-fee gets maximum multiplier (zero marginal cost)
      if (model.pricing === "flat_fee") costMultiplier = 2.5
      else if (model.pricing === "metered_cheap") costMultiplier = 0.8
      else if (model.pricing === "metered_standard") costMultiplier = 0.4
      else costMultiplier = 0.1 // metered_premium
    } else if (preference === "lowest_cost") {
      if (model.pricing === "flat_fee") costMultiplier = 3.0
      else if (model.pricing === "metered_cheap") costMultiplier = 0.5
      else costMultiplier = 0.05
    } else if (preference === "performance_first") {
      // Raw performance regardless of cost
      costMultiplier = 1.0
    } else {
      // Balanced
      if (model.pricing === "flat_fee") costMultiplier = 1.6
      else if (model.pricing === "metered_cheap") costMultiplier = 1.2
      else if (model.pricing === "metered_standard") costMultiplier = 0.9
      else costMultiplier = 0.6
    }

    return Math.round(capabilityWeight * costMultiplier)
  }

  /**
   * Automatically analyzes available models and assigns them to all harness roles.
   */
  static analyzeAndAssign(preference: RoiPreference = "flat_fee_first"): RoiAnalysisResult {
    const availableProviders = this.discoverAvailableProviders()
    const candidates = this.KNOWN_CATALOG.filter((m) => availableProviders.includes(m.provider))

    // Fallback if no matching provider found
    const effectiveCandidates = candidates.length > 0 ? candidates : this.KNOWN_CATALOG

    const roles: ModelRole[] = ["explorer", "planner", "implementer", "verifier", "debugger"]
    const assignedRoles: Record<ModelRole, RoleRoiAssessment> = {} as any

    for (const role of roles) {
      const scored = effectiveCandidates
        .map((m) => ({
          model: m,
          score: this.calculateRoiScore(m, role, preference),
        }))
        .sort((a, b) => b.score - a.score)

      const primary = scored[0]
      const fallback = scored.length > 1 ? scored[1] : undefined

      let rationale = `Selected based on highest ROI score (${primary.score}) under '${preference}' economic policy.`
      if (primary.model.pricing === "flat_fee") {
        rationale += ` Zero marginal token cost via ${primary.model.provider} subscription.`
      } else {
        rationale += ` Estimated cost $${primary.model.costPerMillionTokens}/M tokens.`
      }

      assignedRoles[role] = {
        role,
        selectedModel: primary.model,
        fallbackModel: fallback?.model,
        roiScore: primary.score,
        rationale,
      }
    }

    return {
      preference,
      availableProviders,
      assignedRoles,
      generatedAt: Date.now(),
      allCandidateModels: effectiveCandidates,
    }
  }

  /**
   * Generates ModelProfiles for ModelRegistry from the automated ROI analysis.
   */
  static toModelProfiles(analysis: RoiAnalysisResult): ModelProfile[] {
    const profileMap = new Map<string, ModelProfile>()

    for (const [role, assessment] of Object.entries(analysis.assignedRoles) as [ModelRole, RoleRoiAssessment][]) {
      const spec = assessment.selectedModel
      let profile = profileMap.get(spec.id)

      if (!profile) {
        profile = {
          id: spec.id,
          name: spec.name,
          provider: spec.provider,
          contextWindow: spec.contextWindow,
          supportsThinking: spec.supportsThinking,
          costTier: spec.pricing === "flat_fee" ? "free" : spec.pricing === "metered_cheap" ? "cheap" : "standard",
          roles: [],
          health: "healthy",
          failureCount: 0,
        }
        profileMap.set(spec.id, profile)
      }

      if (!profile.roles.includes(role)) {
        profile.roles.push(role)
      }
    }

    return Array.from(profileMap.values())
  }

  /**
   * Formats a clean markdown report of the ROI assignment.
   */
  static formatReport(analysis: RoiAnalysisResult): string {
    const rows = Object.values(analysis.assignedRoles)
      .map(
        (a) =>
          `| **${a.role.toUpperCase()}** | \`${a.selectedModel.id}\` | ${a.selectedModel.pricing === "flat_fee" ? "✅ Flat-Fee (Zero Marginal Cost)" : `💵 $${a.selectedModel.costPerMillionTokens}/M`} | **${a.roiScore}** | \`${a.fallbackModel?.id ?? "none"}\` |`
      )
      .join("\n")

    return [
      `# Automated Model Cost-Benefit & ROI Analysis`,
      `**Economic Preference:** \`${analysis.preference}\`  `,
      `**Active Providers Discovered:** ${analysis.availableProviders.map((p) => `\`${p}\``).join(", ")}  `,
      `**Generated:** ${new Date(analysis.generatedAt).toISOString()}  `,
      "",
      `| Harness Lane | Assigned Model | Pricing Model | ROI Score | Fallback Model |`,
      `| :--- | :--- | :--- | :--- | :--- |`,
      rows,
      "",
      `### Economic Rationale`,
      Object.values(analysis.assignedRoles)
        .map((a) => `- **${a.role}**: ${a.rationale}`)
        .join("\n"),
    ].join("\n")
  }
}
