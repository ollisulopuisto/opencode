export * as HarnessTestMapper from "./test-mapper"

import fs from "fs"
import path from "path"

export interface TestMapping {
  readonly sourceFile: string
  readonly testFiles: readonly string[]
  readonly directImports: readonly string[]
}

export interface TestMapRegistry {
  readonly generatedAt: number
  readonly workspaceRoot: string
  readonly mappings: Readonly<Record<string, TestMapping>>
  readonly allTestFiles: readonly string[]
}

export class TestMapper {
  private readonly workspaceRoot: string

  constructor(workspaceRoot: string = process.cwd()) {
    this.workspaceRoot = path.resolve(workspaceRoot)
  }

  discoverAllTestFiles(): readonly string[] {
    const testFiles: string[] = []
    const walk = (dir: string) => {
      if (!fs.existsSync(dir)) return
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (
          entry.name.startsWith(".") ||
          entry.name === "node_modules" ||
          entry.name === "dist" ||
          entry.name === "build"
        ) {
          continue
        }
        const full = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          walk(full)
        }
        if (entry.isFile() && this.isTestFile(entry.name)) {
          testFiles.push(path.relative(this.workspaceRoot, full))
        }
      }
    }

    walk(this.workspaceRoot)
    return testFiles
  }

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

  findTargetedTests(changedFiles: readonly string[]): readonly string[] {
    const allTests = this.discoverAllTestFiles()
    const matchingTests = new Set<string>()

    for (const changed of changedFiles) {
      const normalizedChanged = changed.replace(/^\.\//, "")

      if (this.isTestFile(path.basename(normalizedChanged))) {
        matchingTests.add(normalizedChanged)
        continue
      }

      const basename = path.basename(normalizedChanged, path.extname(normalizedChanged))
      const dirname = path.dirname(normalizedChanged)

      for (const test of allTests) {
        const testBasename = path.basename(test)
        const testDir = path.dirname(test)

        if (
          testBasename === `${basename}.test.ts` ||
          testBasename === `${basename}.spec.ts` ||
          testBasename === `${basename}.test.js` ||
          testBasename === `${basename}.spec.js` ||
          testBasename === `test_${basename}.py` ||
          testBasename === `${basename}_test.py` ||
          testBasename === `${basename}_test.go`
        ) {
          if (testDir === dirname || testDir.endsWith(dirname) || dirname.endsWith(testDir) || testDir === "test" || testDir === "tests") {
            matchingTests.add(test)
          }
        }
      }
    }

    return Array.from(matchingTests)
  }
}
