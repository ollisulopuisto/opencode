export * as HarnessProjectMemory from "./project-memory"

import fs from "fs"
import path from "path"

export interface ModuleInfo {
  readonly path: string
  readonly name: string
  readonly description?: string
}

export interface EntrypointInfo {
  readonly name: string
  readonly file: string
  readonly type: "cli" | "server" | "library" | "script"
}

export interface RiskyFileInfo {
  readonly pattern: string
  readonly reason: string
}

export interface LearnedRule {
  readonly id: string
  readonly rule: string
  readonly context?: string
  readonly triggerKeywords?: readonly string[]
}

export interface TaskMemoryEntry {
  readonly taskId: string
  readonly objective: string
  readonly status: "success" | "failed"
  readonly timestamp: number
  readonly filesTouched: readonly string[]
  readonly learnedInsight?: string
}

export interface ProjectMemoryData {
  readonly version: "v6.0"
  readonly workspaceRoot: string
  readonly lastUpdated: number
  readonly architectureSummary: string
  readonly conventions: readonly string[]
  readonly modules: readonly ModuleInfo[]
  readonly entrypoints: readonly EntrypointInfo[]
  readonly riskyFiles: readonly RiskyFileInfo[]
  readonly learnedRules: readonly LearnedRule[]
  readonly taskHistory: readonly TaskMemoryEntry[]
}

export class ProjectMemory {
  private readonly workspaceRoot: string
  private readonly memoryDir: string
  private readonly memoryFilePath: string
  private data: ProjectMemoryData

  constructor(workspaceRoot: string = process.cwd()) {
    this.workspaceRoot = path.resolve(workspaceRoot)
    this.memoryDir = path.join(this.workspaceRoot, ".opencode", "memory")
    this.memoryFilePath = path.join(this.memoryDir, "project-memory.json")
    this.data = this.loadOrCreate()
  }

  private loadOrCreate(): ProjectMemoryData {
    if (fs.existsSync(this.memoryFilePath)) {
      const raw = fs.readFileSync(this.memoryFilePath, "utf8")
      const parsed = JSON.parse(raw) as Partial<ProjectMemoryData>
      return {
        version: "v6.0",
        workspaceRoot: this.workspaceRoot,
        lastUpdated: parsed.lastUpdated ?? Date.now(),
        architectureSummary: parsed.architectureSummary ?? "",
        conventions: parsed.conventions ?? [],
        modules: parsed.modules ?? [],
        entrypoints: parsed.entrypoints ?? [],
        riskyFiles: parsed.riskyFiles ?? [],
        learnedRules: parsed.learnedRules ?? [],
        taskHistory: parsed.taskHistory ?? [],
      }
    }

    return this.createDefaultMemory()
  }

  private createDefaultMemory(): ProjectMemoryData {
    return {
      version: "v6.0",
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

  save(): void {
    if (!fs.existsSync(this.memoryDir)) {
      fs.mkdirSync(this.memoryDir, { recursive: true })
    }
    fs.writeFileSync(this.memoryFilePath, JSON.stringify(this.data, null, 2), "utf8")
  }

  get snapshot(): Readonly<ProjectMemoryData> {
    return this.data
  }

  recordTask(entry: TaskMemoryEntry): void {
    this.data = {
      ...this.data,
      lastUpdated: Date.now(),
      taskHistory: [entry, ...this.data.taskHistory.slice(0, 49)],
    }
    this.save()
  }

  addLearnedRule(rule: LearnedRule): void {
    const existingIndex = this.data.learnedRules.findIndex((r) => r.id === rule.id)
    const updated =
      existingIndex >= 0
        ? this.data.learnedRules.map((r) => (r.id === rule.id ? rule : r))
        : [...this.data.learnedRules, rule]

    this.data = {
      ...this.data,
      lastUpdated: Date.now(),
      learnedRules: updated,
    }
    this.save()
  }
}
