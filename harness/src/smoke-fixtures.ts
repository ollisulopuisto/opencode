/**
 * OpenCode Harness V5 - Smoke Test Fixture Generator
 * 
 * Creates isolated sandbox workspaces with reproducible codebases and failing/passing tests
 * for each of the 6 canonical task categories.
 */

import * as fs from "node:fs"
import * as path from "node:path"

export interface SmokeTaskConfig {
  id: string
  category: "bugfix" | "feature" | "refactor" | "debugging" | "multifile" | "unfamiliar"
  title: string
  objective: string
  setup: (targetDir: string) => void
  verificationCmd: string
  budget: {
    maxFiles: number
    maxLinesAdded: number
    maxLinesDeleted: number
    writeSet: string[]
  }
}

export const SMOKE_TASKS: SmokeTaskConfig[] = [
  // 1. BUG FIX
  {
    id: "smoke_bugfix_1",
    category: "bugfix",
    title: "Bug Fix: Fix off-by-one error in parseRange helper",
    objective: "Fix parseRange in src/range.ts so range boundaries are inclusive (e.g. '1-3' -> [1, 2, 3]). Ensure 'bun test' passes.",
    verificationCmd: "bun test",
    budget: {
      maxFiles: 2,
      maxLinesAdded: 15,
      maxLinesDeleted: 5,
      writeSet: ["src/range.ts", "test/range.test.ts"],
    },
    setup: (dir: string) => {
      fs.mkdirSync(path.join(dir, "src"), { recursive: true })
      fs.mkdirSync(path.join(dir, "test"), { recursive: true })

      fs.writeFileSync(
        path.join(dir, "package.json"),
        JSON.stringify({ name: "smoke-bugfix", type: "module" }, null, 2)
      )

      // Buggy code (exclusive upper bound)
      fs.writeFileSync(
        path.join(dir, "src", "range.ts"),
        `export function parseRange(rangeStr: string): number[] {
  const parts = rangeStr.split("-").map((s) => parseInt(s.trim(), 10))
  if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) {
    return []
  }
  const result: number[] = []
  // BUG: < instead of <=
  for (let i = parts[0]; i < parts[1]; i++) {
    result.push(i)
  }
  return result
}
`
      )

      // Test suite
      fs.writeFileSync(
        path.join(dir, "test", "range.test.ts"),
        `import { describe, it, expect } from "bun:test"
import { parseRange } from "../src/range"

describe("parseRange", () => {
  it("parses single range with inclusive bounds", () => {
    expect(parseRange("1-3")).toEqual([1, 2, 3])
    expect(parseRange("5-8")).toEqual([5, 6, 7, 8])
  })

  it("handles identical start and end", () => {
    expect(parseRange("4-4")).toEqual([4])
  })

  it("returns empty array for invalid input", () => {
    expect(parseRange("invalid")).toEqual([])
  })
})
`
      )
    },
  },

  // 2. FEATURE
  {
    id: "smoke_feature_1",
    category: "feature",
    title: "Feature: Add hex formatting option to formatNumber",
    objective: "Extend formatNumber in src/formatter.ts to support { format: 'hex' } returning lowercase hex with '0x' prefix (e.g. 255 -> '0xff'). Ensure 'bun test' passes.",
    verificationCmd: "bun test",
    budget: {
      maxFiles: 2,
      maxLinesAdded: 25,
      maxLinesDeleted: 5,
      writeSet: ["src/formatter.ts", "test/formatter.test.ts"],
    },
    setup: (dir: string) => {
      fs.mkdirSync(path.join(dir, "src"), { recursive: true })
      fs.mkdirSync(path.join(dir, "test"), { recursive: true })

      fs.writeFileSync(
        path.join(dir, "package.json"),
        JSON.stringify({ name: "smoke-feature", type: "module" }, null, 2)
      )

      fs.writeFileSync(
        path.join(dir, "src", "formatter.ts"),
        `export interface FormatOptions {
  format?: "decimal" | "hex"
  precision?: number
}

export function formatNumber(n: number, options: FormatOptions = {}): string {
  if (options.format === "hex") {
    // TODO: implement hex formatting
    return "0x0"
  }
  return n.toFixed(options.precision ?? 0)
}
`
      )

      fs.writeFileSync(
        path.join(dir, "test", "formatter.test.ts"),
        `import { describe, it, expect } from "bun:test"
import { formatNumber } from "../src/formatter"

describe("formatNumber", () => {
  it("formats standard decimals", () => {
    expect(formatNumber(42)).toBe("42")
    expect(formatNumber(3.14159, { precision: 2 })).toBe("3.14")
  })

  it("formats hex numbers with 0x prefix", () => {
    expect(formatNumber(255, { format: "hex" })).toBe("0xff")
    expect(formatNumber(16, { format: "hex" })).toBe("0x10")
    expect(formatNumber(0, { format: "hex" })).toBe("0x0")
  })
})
`
      )
    },
  },

  // 3. REFACTOR
  {
    id: "smoke_refactor_1",
    category: "refactor",
    title: "Refactor: Extract common rounding logic into helper",
    objective: "Refactor src/pricing.ts to extract repeated tax/discount rounding logic into a single helper function 'roundToCents'. Tests must remain 100% passing.",
    verificationCmd: "bun test",
    budget: {
      maxFiles: 2,
      maxLinesAdded: 30,
      maxLinesDeleted: 30,
      writeSet: ["src/pricing.ts"],
    },
    setup: (dir: string) => {
      fs.mkdirSync(path.join(dir, "src"), { recursive: true })
      fs.mkdirSync(path.join(dir, "test"), { recursive: true })

      fs.writeFileSync(
        path.join(dir, "package.json"),
        JSON.stringify({ name: "smoke-refactor", type: "module" }, null, 2)
      )

      fs.writeFileSync(
        path.join(dir, "src", "pricing.ts"),
        `export function calculateTax(amount: number, rate: number): number {
  const raw = amount * rate
  // Repeated rounding logic
  return Math.round(raw * 100) / 100
}

export function calculateDiscount(amount: number, discountPercentage: number): number {
  const raw = amount * (discountPercentage / 100)
  // Repeated rounding logic
  return Math.round(raw * 100) / 100
}

export function calculateTotal(amount: number, taxRate: number, discountPercentage: number): number {
  const tax = calculateTax(amount, taxRate)
  const discount = calculateDiscount(amount, discountPercentage)
  const raw = amount + tax - discount
  return Math.round(raw * 100) / 100
}
`
      )

      fs.writeFileSync(
        path.join(dir, "test", "pricing.test.ts"),
        `import { describe, it, expect } from "bun:test"
import { calculateTax, calculateDiscount, calculateTotal } from "../src/pricing"

describe("pricing calculations", () => {
  it("calculates tax correctly", () => {
    expect(calculateTax(100, 0.24)).toBe(24)
    expect(calculateTax(19.99, 0.10)).toBe(2.00)
  })

  it("calculates discount correctly", () => {
    expect(calculateDiscount(100, 15)).toBe(15)
    expect(calculateDiscount(49.95, 20)).toBe(9.99)
  })

  it("calculates total correctly", () => {
    expect(calculateTotal(100, 0.24, 10)).toBe(114)
  })
})
`
      )
    },
  },

  // 4. DEBUGGING
  {
    id: "smoke_debugging_1",
    category: "debugging",
    title: "Debugging: Fix unhandled rejection in retry helper",
    objective: "Fix withRetry in src/retry.ts so failed attempts retry up to maxRetries times before throwing the final error. Ensure 'bun test' passes.",
    verificationCmd: "bun test",
    budget: {
      maxFiles: 2,
      maxLinesAdded: 20,
      maxLinesDeleted: 10,
      writeSet: ["src/retry.ts", "test/retry.test.ts"],
    },
    setup: (dir: string) => {
      fs.mkdirSync(path.join(dir, "src"), { recursive: true })
      fs.mkdirSync(path.join(dir, "test"), { recursive: true })

      fs.writeFileSync(
        path.join(dir, "package.json"),
        JSON.stringify({ name: "smoke-debugging", type: "module" }, null, 2)
      )

      // Buggy retry: fails immediately on first rejection
      fs.writeFileSync(
        path.join(dir, "src", "retry.ts"),
        `export async function withRetry<T>(fn: () => Promise<T>, maxRetries: number = 3): Promise<T> {
  let lastError: unknown
  for (let i = 0; i <= maxRetries; i++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      // BUG: breaks immediately instead of retrying
      break
    }
  }
  throw lastError
}
`
      )

      fs.writeFileSync(
        path.join(dir, "test", "retry.test.ts"),
        `import { describe, it, expect } from "bun:test"
import { withRetry } from "../src/retry"

describe("withRetry", () => {
  it("resolves immediately on first success", async () => {
    const res = await withRetry(async () => "ok")
    expect(res).toBe("ok")
  })

  it("retries on intermittent failures and succeeds", async () => {
    let attempts = 0
    const res = await withRetry(async () => {
      attempts++
      if (attempts < 3) throw new Error("transient error")
      return "recovered"
    }, 3)
    expect(res).toBe("recovered")
    expect(attempts).toBe(3)
  })

  it("throws after exhausting max retries", async () => {
    let attempts = 0
    await expect(
      withRetry(async () => {
        attempts++
        throw new Error("persistent error")
      }, 2)
    ).rejects.toThrow("persistent error")
    expect(attempts).toBe(3)
  })
})
`
      )
    },
  },

  // 5. MULTI-FILE
  {
    id: "smoke_multifile_1",
    category: "multifile",
    title: "Multi-File: Add priority field to task schema and formatters",
    objective: "Add optional 'priority' ('low' | 'medium' | 'high') to Task interface in src/types.ts and update renderTask in src/renderer.ts to prepend '[HIGH]', '[MEDIUM]', or '[LOW]' when present. Ensure 'bun test' passes.",
    verificationCmd: "bun test",
    budget: {
      maxFiles: 3,
      maxLinesAdded: 30,
      maxLinesDeleted: 10,
      writeSet: ["src/types.ts", "src/renderer.ts", "test/task.test.ts"],
    },
    setup: (dir: string) => {
      fs.mkdirSync(path.join(dir, "src"), { recursive: true })
      fs.mkdirSync(path.join(dir, "test"), { recursive: true })

      fs.writeFileSync(
        path.join(dir, "package.json"),
        JSON.stringify({ name: "smoke-multifile", type: "module" }, null, 2)
      )

      fs.writeFileSync(
        path.join(dir, "src", "types.ts"),
        `export interface Task {
  id: string
  title: string
  completed: boolean
}
`
      )

      fs.writeFileSync(
        path.join(dir, "src", "renderer.ts"),
        `import type { Task } from "./types"

export function renderTask(task: Task): string {
  const status = task.completed ? "[x]" : "[ ]"
  return \`\${status} \${task.title}\`
}
`
      )

      fs.writeFileSync(
        path.join(dir, "test", "task.test.ts"),
        `import { describe, it, expect } from "bun:test"
import { renderTask } from "../src/renderer"
import type { Task } from "../src/types"

describe("renderTask", () => {
  it("renders basic task", () => {
    const task: Task = { id: "1", title: "Write tests", completed: false }
    expect(renderTask(task)).toBe("[ ] Write tests")
  })

  it("renders task with priority tag when priority is set", () => {
    const highTask: any = { id: "2", title: "Fix security bug", completed: false, priority: "high" }
    expect(renderTask(highTask)).toBe("[HIGH] [ ] Fix security bug")

    const lowTask: any = { id: "3", title: "Update readme", completed: true, priority: "low" }
    expect(renderTask(lowTask)).toBe("[LOW] [x] Update readme")
  })
})
`
      )
    },
  },

  // 6. UNFAMILIAR CODEBASE
  {
    id: "smoke_unfamiliar_1",
    category: "unfamiliar",
    title: "Unfamiliar Codebase: Add version tag to event telemetry collector",
    objective: "Locate the metric collector in src/core/telemetry/collector.ts and ensure every recorded event includes 'schemaVersion: 2'. Ensure 'bun test' passes.",
    verificationCmd: "bun test",
    budget: {
      maxFiles: 3,
      maxLinesAdded: 20,
      maxLinesDeleted: 5,
      writeSet: ["src/core/telemetry/collector.ts", "test/telemetry.test.ts"],
    },
    setup: (dir: string) => {
      fs.mkdirSync(path.join(dir, "src", "core", "telemetry"), { recursive: true })
      fs.mkdirSync(path.join(dir, "test"), { recursive: true })

      fs.writeFileSync(
        path.join(dir, "package.json"),
        JSON.stringify({ name: "smoke-unfamiliar", type: "module" }, null, 2)
      )

      fs.writeFileSync(
        path.join(dir, "src", "core", "telemetry", "collector.ts"),
        `export interface TelemetryEvent {
  name: string
  timestamp: number
  data?: Record<string, unknown>
  schemaVersion?: number
}

export class MetricCollector {
  private events: TelemetryEvent[] = []

  record(name: string, data?: Record<string, unknown>): TelemetryEvent {
    const event: TelemetryEvent = {
      name,
      timestamp: Date.now(),
      data,
    }
    this.events.push(event)
    return event
  }

  getEvents(): ReadonlyArray<TelemetryEvent> {
    return this.events
  }
}
`
      )

      fs.writeFileSync(
        path.join(dir, "test", "telemetry.test.ts"),
        `import { describe, it, expect } from "bun:test"
import { MetricCollector } from "../src/core/telemetry/collector"

describe("MetricCollector", () => {
  it("records event with schemaVersion 2", () => {
    const collector = new MetricCollector()
    const event = collector.record("user_login", { userId: "u123" })

    expect(event.name).toBe("user_login")
    expect(event.schemaVersion).toBe(2)
    expect(collector.getEvents().length).toBe(1)
  })
})
`
      )
    },
  },
]
