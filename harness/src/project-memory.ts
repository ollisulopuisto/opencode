/**
 * OpenCode Harness V5.2 - Long-Term Project Memory & Repository Intelligence Engine
 * 
 * Provides persistent repository intelligence, cross-task learning, architectural conventions,
 * and high-signal contextual memory injection across sessions without amnesia or bloat.
 */

import * as fs from "node:fs"
import * as path from "node:path"

export interface ModuleInfo {
  path: string
  name: string
  description?: string
}

export interface EntrypointInfo {
  name: string
  file: string
  type: "cli" | "server" | "library" | "script"
}

export interface RiskyFileInfo {
  pattern: string
  reason: string
}

export interface LearnedRule {
  id: string
  rule: string
  context?: string
  triggerKeywords?: string[]
}

export interface TaskMemoryEntry {
  taskId: string
  objective: string
  status: "success" | "failed"
  timestamp: number
  filesTouched: string[]
  learnedInsight?: string
}

export interface ProjectMemoryData {
  version: "v5.2"
  workspaceRoot: string
  lastUpdated: number
  architectureSummary: string
  conventions: string[]
  modules: ModuleInfo[]
  entrypoints: EntrypointInfo[]
  riskyFiles: RiskyFileInfo[]
  learnedRules: LearnedRule[]
  taskHistory: TaskMemoryEntry[]
}

export class ProjectMemory {
  private workspaceRoot: string
  private memoryDir: string
  private memoryFilePath: string
  private data: ProjectMemoryData

  constructor(workspaceRoot: string = process.cwd()) {
    this.workspaceRoot = path.resolve(workspaceRoot)
    this.memoryDir = path.join(this.workspaceRoot, ".opencode", "memory")
    this.memoryFilePath = path.join(this.memoryDir, "project-memory.json")
    this.data = this.loadOrCreate()
  }

  /**
   * Initializes or loads project memory from disk.
   */
  private loadOrCreate(): ProjectMemoryData {
    if (fs.existsSync(this.memoryFilePath)) {
      try {
        const raw = fs.readFileSync(this.memoryFilePath, "utf8")
        const parsed = JSON.parse(raw) as ProjectMemoryData
        return {
          ...parsed,
          conventions: parsed.conventions ?? [],
          modules: parsed.modules ?? [],
          entrypoints: parsed.entrypoints ?? [],
          riskyFiles: parsed.riskyFiles ?? [],
          learnedRules: parsed.learnedRules ?? [],
          taskHistory: parsed.taskHistory ?? [],
        }
      } catch (err) {
        console.warn(`[ProjectMemory] Failed to parse existing memory file, re-initializing: ${err}`)
      }
    }

    return this.createDefaultMemory()
  }

  private createDefaultMemory(): ProjectMemoryData {
    return {
      version: "v5.2",
      workspaceRoot: this.workspaceRoot,
      lastUpdated: Date.now(),
      architectureSummary: "",
      conventions: [],
      modules: [],
      entrypoints: [],
      riskyFiles: [],
      learnedRules: [],
      taskHistory: [],
    }
  }

  /**
   * Scans the workspace to populate initial repository intelligence.
   */
  scanRepository(): void {
    const conventions: string[] = []
    const modules: ModuleInfo[] = []
    const entrypoints: EntrypointInfo[] = []
    const riskyFiles: RiskyFileInfo[] = []

    // 1. Inspect AGENTS.md or RULES.md
    const agentsPath = path.join(this.workspaceRoot, "AGENTS.md")
    if (fs.existsSync(agentsPath)) {
      const agentsContent = fs.readFileSync(agentsPath, "utf8")
      if (agentsContent.includes("bun typecheck")) {
        conventions.push("Run `bun typecheck` from package directories (e.g. packages/opencode), never run `tsc` directly.")
      }
      if (agentsContent.includes("do-not-run-tests-from-root")) {
        conventions.push("Tests must be run from package directories, not the repo root.")
      }
      if (agentsContent.includes("snake_case for field names")) {
        conventions.push("Use snake_case for Drizzle schema column names.")
      }
      if (agentsContent.includes("Avoid else statements")) {
        conventions.push("Prefer early returns over else statements.")
      }
    }

    // 2. Discover packages / modules
    const packagesDir = path.join(this.workspaceRoot, "packages")
    if (fs.existsSync(packagesDir)) {
      const entries = fs.readdirSync(packagesDir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith(".")) {
          const pkgJsonPath = path.join(packagesDir, entry.name, "package.json")
          let desc = ""
          let pkgName = entry.name
          if (fs.existsSync(pkgJsonPath)) {
            try {
              const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"))
              pkgName = pkgJson.name ?? entry.name
              desc = pkgJson.description ?? ""
            } catch {}
          }
          modules.push({
            path: `packages/${entry.name}`,
            name: pkgName,
            description: desc,
          })
        }
      }
    }

    // 3. Discover entrypoints
    if (fs.existsSync(path.join(this.workspaceRoot, "packages/opencode/src/index.ts"))) {
      entrypoints.push({
        name: "opencode-cli",
        file: "packages/opencode/src/index.ts",
        type: "cli",
      })
    }
    if (fs.existsSync(path.join(this.workspaceRoot, "harness/src/runner.ts"))) {
      entrypoints.push({
        name: "harness-runner",
        file: "harness/src/runner.ts",
        type: "library",
      })
    }

    // 4. Identify common risky files
    riskyFiles.push({
      pattern: "packages/core/src/project/**",
      reason: "Core project isolation layer; regressions cause workspace state corruption.",
    })
    riskyFiles.push({
      pattern: "packages/server/src/routes/**",
      reason: "Public HTTP/SSE endpoints; modifying routes requires updating client protocols.",
    })

    this.data.conventions = Array.from(new Set([...this.data.conventions, ...conventions]))
    this.data.modules = modules
    this.data.entrypoints = entrypoints
    this.data.riskyFiles = riskyFiles
    this.data.lastUpdated = Date.now()
    this.save()
  }

  /**
   * Adds or updates a learned rule derived from execution or user guidelines.
   */
  addLearnedRule(rule: string, context?: string, triggerKeywords?: string[]): void {
    const id = `rule_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    this.data.learnedRules.push({
      id,
      rule,
      context,
      triggerKeywords: triggerKeywords ?? [],
    })
    this.data.lastUpdated = Date.now()
    this.save()
  }

  /**
   * Records completed task result and historical insights.
   */
  recordTaskResult(
    taskId: string,
    objective: string,
    status: "success" | "failed",
    filesTouched: string[],
    learnedInsight?: string
  ): void {
    this.data.taskHistory.push({
      taskId,
      objective,
      status,
      timestamp: Date.now(),
      filesTouched,
      learnedInsight,
    })

    // Keep the task history bounded (last 50 tasks)
    if (this.data.taskHistory.length > 50) {
      this.data.taskHistory = this.data.taskHistory.slice(-50)
    }

    this.data.lastUpdated = Date.now()
    this.save()
  }

  /**
   * Extracts relevant long-term memory snippets matching the given task objective and target files.
   */
  getRelevantMemory(taskObjective: string, targetFiles: string[] = []): {
    conventions: string[]
    learnedRules: string[]
    riskyFileAlerts: string[]
    recentInsights: string[]
  } {
    const objectiveLower = taskObjective.toLowerCase()

    // 1. Relevant conventions
    const conventions = [...this.data.conventions]

    // 2. Matching learned rules
    const matchedRules: string[] = []
    for (const lr of this.data.learnedRules) {
      const matchesKeyword = lr.triggerKeywords?.some((kw) => objectiveLower.includes(kw.toLowerCase()))
      const matchesContext = lr.context ? objectiveLower.includes(lr.context.toLowerCase()) : false
      if (matchesKeyword || matchesContext || !lr.triggerKeywords?.length) {
        matchedRules.push(lr.rule)
      }
    }

    // 3. Risky file alerts
    const riskyAlerts: string[] = []
    for (const file of targetFiles) {
      for (const rf of this.data.riskyFiles) {
        const prefix = rf.pattern.replace(/\/\*\*$/, "")
        if (file.startsWith(prefix) || file === rf.pattern) {
          riskyAlerts.push(`⚠️ Risky File [${file}]: ${rf.reason}`)
        }
      }
    }

    // 4. Recent successful task insights matching similar terms
    const recentInsights: string[] = []
    for (const hist of this.data.taskHistory.slice(-10).reverse()) {
      if (hist.learnedInsight && hist.status === "success") {
        recentInsights.push(`[Previous Task: ${hist.objective}] -> ${hist.learnedInsight}`)
      }
    }

    return {
      conventions,
      learnedRules: matchedRules.slice(0, 5),
      riskyFileAlerts: riskyAlerts.slice(0, 3),
      recentInsights: recentInsights.slice(0, 3),
    }
  }

  /**
   * Formats relevant project memory for prompt injection.
   */
  formatForPrompt(taskObjective: string, targetFiles: string[] = []): string {
    const memory = this.getRelevantMemory(taskObjective, targetFiles)
    const sections: string[] = []

    if (memory.conventions.length > 0) {
      sections.push(`### Repository Conventions\n` + memory.conventions.map((c) => `- ${c}`).join("\n"))
    }

    if (memory.learnedRules.length > 0) {
      sections.push(`### Learned Project Rules\n` + memory.learnedRules.map((r) => `- ${r}`).join("\n"))
    }

    if (memory.riskyFileAlerts.length > 0) {
      sections.push(`### Architecture Risk Warnings\n` + memory.riskyFileAlerts.map((a) => `- ${a}`).join("\n"))
    }

    if (memory.recentInsights.length > 0) {
      sections.push(`### Cross-Task Memory & Insights\n` + memory.recentInsights.map((i) => `- ${i}`).join("\n"))
    }

    if (sections.length === 0) return ""

    return [
      `## LONG-TERM PROJECT MEMORY & REPO INTELLIGENCE`,
      sections.join("\n\n"),
    ].join("\n\n")
  }

  /**
   * Persists memory data atomically to disk.
   */
  save(): void {
    if (!fs.existsSync(this.memoryDir)) {
      fs.mkdirSync(this.memoryDir, { recursive: true })
    }
    const tmpPath = `${this.memoryFilePath}.tmp`
    fs.writeFileSync(tmpPath, JSON.stringify(this.data, null, 2), "utf8")
    fs.renameSync(tmpPath, this.memoryFilePath)
  }

  get snapshot(): ProjectMemoryData {
    return JSON.parse(JSON.stringify(this.data))
  }
}
