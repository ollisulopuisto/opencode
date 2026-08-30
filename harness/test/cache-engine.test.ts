import { describe, expect, it, beforeEach, afterEach } from "bun:test"
import * as fs from "node:fs"
import * as path from "node:path"
import * as os from "node:os"
import { PerformanceCacheEngine } from "../src/cache-engine"

describe("PerformanceCacheEngine", () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cache-engine-test-"))
    fs.mkdirSync(path.join(tmpDir, ".opencode", "cache"), { recursive: true })
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it("stores and retrieves cached values efficiently", () => {
    const cache = new PerformanceCacheEngine(tmpDir)
    cache.set("deps:core", { modules: ["a", "b"] })

    const result = cache.get<{ modules: string[] }>("deps:core")
    expect(result).not.toBeNull()
    expect(result?.modules).toEqual(["a", "b"])
  })

  it("invalidates cached values when the dependency file on disk is modified", async () => {
    const targetFile = path.join(tmpDir, "test-file.ts")
    fs.writeFileSync(targetFile, "console.log('v1')")

    const cache = new PerformanceCacheEngine(tmpDir)
    cache.set("file_analysis:test-file.ts", { analyzed: true, version: 1 }, { dependencyFilePath: targetFile })

    expect(cache.get("file_analysis:test-file.ts", targetFile)).not.toBeNull()

    // Simulate file update after a short delay
    await new Promise((r) => setTimeout(r, 50))
    fs.writeFileSync(targetFile, "console.log('v2')")

    const invalidated = cache.get("file_analysis:test-file.ts", targetFile)
    expect(invalidated).toBeNull()
  })

  it("supports key prefix invalidation and persistence", () => {
    const cache = new PerformanceCacheEngine(tmpDir)
    cache.set("tree:src/a", { a: 1 })
    cache.set("tree:src/b", { b: 2 })
    cache.set("other:key", { other: true })

    const count = cache.invalidate("tree:")
    expect(count).toBe(2)
    expect(cache.get("tree:src/a")).toBeNull()
    expect(cache.get("other:key")).not.toBeNull()
  })
})
