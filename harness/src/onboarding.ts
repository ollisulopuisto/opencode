/**
 * OpenCode Harness V5.2 - Interactive Onboarding & Workspace Initialization Engine
 * 
 * Guides users through repository discovery, model economic ROI assignment,
 * multi-tier verification policy setup, and long-term project memory initialization.
 */

import * as fs from "node:fs"
import * as path from "node:path"
import { ModelRoiAnalyzer, type RoiPreference, type RoiAnalysisResult } from "./model-roi"
import { ProjectMemory } from "./project-memory"
import { TestMapper } from "./test-mapper"
import { VerifierPolicy } from "./verifier-policy"
import { type ChangeBudget } from "./budget"

export interface HarnessConfig {
  version: "v5.2"
  economicPreference: RoiPreference
  roles: Record<string, string>
  budget: ChangeBudget
  maxRecoveries: number
  maxSupervisoryInterventions: number
  verification: {
    tier1Pattern: string
    tier2RegressionCmds: string[]
    fastFail: boolean
    timeoutMs: number
  }
  initializedAt: number
}

export interface WorkspaceAssessment {
  root: string
  hasAgentsMd: boolean
  hasPackageJson: boolean
  hasPyproject: boolean
  hasCargoToml: boolean
  detectedLanguage: "typescript" | "python" | "rust" | "generic"
  discoveredTestsCount: number
  availableProviders: string[]
}

export class OnboardingEngine {
  private workspaceRoot: string
  private opencodeDir: string
  private configPath: string

  constructor(workspaceRoot: string = process.cwd()) {
    this.workspaceRoot = path.resolve(workspaceRoot)
    this.opencodeDir = path.join(this.workspaceRoot, ".opencode")
    this.configPath = path.join(this.opencodeDir, "harness.json")
  }

  /**
   * Assesses workspace layout, language ecosystem, and available providers.
   */
  assessWorkspace(): WorkspaceAssessment {
    const hasAgentsMd = fs.existsSync(path.join(this.workspaceRoot, "AGENTS.md"))
    const hasPackageJson = fs.existsSync(path.join(this.workspaceRoot, "package.json"))
    const hasPyproject = fs.existsSync(path.join(this.workspaceRoot, "pyproject.toml"))
    const hasCargoToml = fs.existsSync(path.join(this.workspaceRoot, "Cargo.toml"))

    let detectedLanguage: "typescript" | "python" | "rust" | "generic" = "generic"
    if (hasPackageJson) detectedLanguage = "typescript"
    else if (hasPyproject) detectedLanguage = "python"
    else if (hasCargoToml) detectedLanguage = "rust"

    const testMapper = new TestMapper(this.workspaceRoot)
    const testFiles = testMapper.discoverAllTestFiles()
    const availableProviders = ModelRoiAnalyzer.discoverAvailableProviders()

    return {
      root: this.workspaceRoot,
      hasAgentsMd,
      hasPackageJson,
      hasPyproject,
      hasCargoToml,
      detectedLanguage,
      discoveredTestsCount: testFiles.length,
      availableProviders,
    }
  }

  /**
   * Runs the complete onboarding initialization process.
   */
  initializeHarness(options: {
    preference?: RoiPreference
    budget?: Partial<ChangeBudget>
    maxSupervisoryInterventions?: number
  } = {}): {
    config: HarnessConfig
    roiAnalysis: RoiAnalysisResult
    summaryMarkdown: string
  } {
    const preference = options.preference ?? "flat_fee_first"
    const assessment = this.assessWorkspace()

    // 1. Ensure .opencode directory structure exists
    if (!fs.existsSync(this.opencodeDir)) {
      fs.mkdirSync(this.opencodeDir, { recursive: true })
    }
    fs.mkdirSync(path.join(this.opencodeDir, "memory"), { recursive: true })
    fs.mkdirSync(path.join(this.opencodeDir, "cache"), { recursive: true })
    fs.mkdirSync(path.join(this.opencodeDir, "logs"), { recursive: true })

    // 2. Perform automated Model ROI analysis
    const roiAnalysis = ModelRoiAnalyzer.analyzeAndAssign(preference)
    const roleMapping: Record<string, string> = {
      explorer: roiAnalysis.assignedRoles.explorer.selectedModel.id,
      planner: roiAnalysis.assignedRoles.planner.selectedModel.id,
      implementer: roiAnalysis.assignedRoles.implementer.selectedModel.id,
      verifier: roiAnalysis.assignedRoles.verifier.selectedModel.id,
      debugger: roiAnalysis.assignedRoles.debugger.selectedModel.id,
    }

    // 3. Auto-discover verification policy
    const policy = VerifierPolicy.discover(this.workspaceRoot)

    // 4. Initialize Long-Term Project Memory
    const memory = new ProjectMemory(this.workspaceRoot)
    memory.scanRepository()

    // 5. Default Change Budget
    const defaultBudget: ChangeBudget = {
      maxFilesChanged: 8,
      maxLinesAdded: 500,
      maxLinesDeleted: 300,
      ...options.budget,
    }

    // 6. Assemble configuration
    const config: HarnessConfig = {
      version: "v5.2",
      economicPreference: preference,
      roles: roleMapping,
      budget: defaultBudget,
      maxRecoveries: 2,
      maxSupervisoryInterventions: options.maxSupervisoryInterventions ?? 2,
      verification: {
        tier1Pattern: assessment.detectedLanguage === "typescript" ? "bun test <target>" : "pytest <target>",
        tier2RegressionCmds: policy.tier2RegressionCmds,
        fastFail: policy.fastFail,
        timeoutMs: policy.timeoutMs,
      },
      initializedAt: Date.now(),
    }

    // 7. Save harness.json
    fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), "utf8")

    // 8. Generate Summary Markdown
    const summaryMarkdown = this.formatOnboardingSummary(assessment, config, roiAnalysis)

    return {
      config,
      roiAnalysis,
      summaryMarkdown,
    }
  }

  private formatOnboardingSummary(
    assessment: WorkspaceAssessment,
    config: HarnessConfig,
    roi: RoiAnalysisResult
  ): string {
    return [
      `# 🚀 OpenCode Harness V5.2 Initialized Successfully`,
      "",
      `### 1. Workspace Profile`,
      `- **Ecosystem:** \`${assessment.detectedLanguage.toUpperCase()}\``,
      `- **Discovered Test Suites:** ${assessment.discoveredTestsCount} test files`,
      `- **Active Providers:** ${assessment.availableProviders.map((p) => `\`${p}\``).join(", ")}`,
      "",
      `### 2. Autonomous Multi-Lane Role Assignment (\`${config.economicPreference}\`)`,
      `- **Lane 1 (Explorer):** \`${config.roles.explorer}\` (High-speed repo mapping)`,
      `- **Lane 2 (Planner):** \`${config.roles.planner}\` (Deep architectural planning)`,
      `- **Lane 3 (Implementer):** \`${config.roles.implementer}\` (Precision TDD coding)`,
      `- **Lane 4 (Verifier):** \`${config.roles.verifier}\` (Read-only multi-tier verification)`,
      `- **Lane 5 (Debugger):** \`${config.roles.debugger}\` (Diagnostic stack analysis)`,
      "",
      `### 3. Guardrails & Governance`,
      `- **Change Budget:** Max ${config.budget.maxFilesChanged} files, +${config.budget.maxLinesAdded}/-${config.budget.maxLinesDeleted} lines`,
      `- **Gemini Supervisory Cap:** Max ${config.maxSupervisoryInterventions} escalations/task`,
      `- **Long-Term Memory:** Initialized under \`.opencode/memory/project-memory.json\``,
      `- **Configuration:** Saved to \`.opencode/harness.json\``,
      "",
      `### Quickstart Examples`,
      `\`\`\`bash`,
      `opencode harness "Fix race condition in database pool"`,
      `opencode harness --smoke`,
      `opencode harness --roi`,
      `\`\`\``,
    ].join("\n")
  }
}
