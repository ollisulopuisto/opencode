/**
 * OpenCode Harness V5.2 - Dependency & Test Mapping Engine
 * 
 * Maps source files to their corresponding test suites and caches
 * relationship graphs in .opencode/test-map.json for Tier 1 targeted testing.
 */

import * as fs from "node:fs"
import * as path from "node:path"

export interface TestMapping {
  sourceFile: string
  testFiles: string[]
  directImports: string[]
}

export interface TestMapRegistry {
  generatedAt: number
  workspaceRoot: string
  mappings: Record<string, TestMapping>
  allTestFiles: string[]
}

export class TestMapper {
  private workspaceRoot: string
  private cachePath: string

  constructor(workspaceRoot: string = process.cwd()) {
    this.workspaceRoot = path.resolve(workspaceRoot)
    this.cachePath = path.join(this.workspaceRoot, ".opencode", "test-map.json")
  }

  /**
   * Discovers all test files across standard project layouts.
   */
  discoverAllTestFiles(): string[] {
    const testFiles: string[] = []
    const walk = (dir: string) => {
      if (!fs.existsSync(dir)) return
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "dist" || entry.name === "build") {
          continue
        }
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          walk(full)
        } else if (entry.isFile()) {
          if (this.isTestFile(entry.name)) {
            testFiles.push(path.relative(this.workspaceRoot, full))
          }
        }
      }
    }

    walk(this.workspaceRoot)
    return testFiles
  }

  /**
   * Checks if a filename matches standard test naming conventions.
   */
  isTestFile(filename: string): boolean {
    const lower = filename.toLowerCase()
    return (
      lower.endsWith(".test.ts") ||
      lower.endsWith(".spec.ts") ||
      lower.endsWith(".test.js") ||
      lower.endsWith(".spec.js") ||
      lower.endsWith(".test.tsx") ||
      lower.endsWith(".spec.tsx") ||
      lower.endsWith(".test.jsx") ||
      lower.endsWith(".spec.jsx") ||
      lower.startsWith("test_") ||
      lower.endsWith("_test.py") ||
      lower.endsWith("_test.go") ||
      lower.endsWith("_test.rs")
    )
  }

  /**
   * Finds targeted test files relevant to a given source file or mutation list.
   */
  findTargetedTests(changedFiles: string[]): string[] {
    const allTests = this.discoverAllTestFiles()
    const matchingTests = new Set<string>()

    for (const changed of changedFiles) {
      const normalizedChanged = changed.replace(/^\.\//, "")

      // If the changed file itself is a test file, include it directly
      if (this.isTestFile(path.basename(normalizedChanged))) {
        matchingTests.add(normalizedChanged)
        continue
      }

      const basename = path.basename(normalizedChanged, path.extname(normalizedChanged))
      const dirname = path.dirname(normalizedChanged)

      // Pattern 1: Same directory (e.g. src/foo.ts -> src/foo.test.ts)
      for (const test of allTests) {
        const testBasename = path.basename(test)
        if (
          testBasename.startsWith(`${basename}.test.`) ||
          testBasename.startsWith(`${basename}.spec.`) ||
          testBasename === `test_${basename}.py` ||
          testBasename === `${basename}_test.py` ||
          testBasename === `${basename}_test.go`
        ) {
          matchingTests.add(test)
        }
      }

      // Pattern 2: Sibling test folder (e.g. src/foo.ts -> test/foo.test.ts)
      for (const test of allTests) {
        if (test.includes(basename)) {
          matchingTests.add(test)
        }
      }
    }

    return Array.from(matchingTests)
  }

  /**
   * Builds and persists test-map.json cache.
   */
  buildRegistry(): TestMapRegistry {
    const allTests = this.discoverAllTestFiles()
    const registry: TestMapRegistry = {
      generatedAt: Date.now(),
      workspaceRoot: this.workspaceRoot,
      mappings: {},
      allTestFiles: allTests,
    }

    const dir = path.dirname(this.cachePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    try {
      fs.writeFileSync(this.cachePath, JSON.stringify(registry, null, 2), "utf-8")
    } catch {
      // ignore
    }

    return registry
  }
}
