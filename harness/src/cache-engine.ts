/**
 * OpenCode Harness V5.2 - Performance Cache Engine (Phase 9)
 * 
 * Provides high-throughput mtime-invalidated caching for repository intelligence,
 * dependency discovery, test mapping, and normalized tool executions.
 */

import * as fs from "node:fs"
import * as path from "node:path"

export interface CacheEntry<T> {
  key: string
  data: T
  mtimeMs: number
  cachedAt: number
  ttlMs?: number
}

export class PerformanceCacheEngine {
  private memoryCache: Map<string, CacheEntry<any>> = new Map()
  private cacheFilePath: string
  private workspaceRoot: string

  constructor(workspaceRoot: string = process.cwd()) {
    this.workspaceRoot = path.resolve(workspaceRoot)
    const cacheDir = path.join(this.workspaceRoot, ".opencode", "cache")
    this.cacheFilePath = path.join(cacheDir, "performance-cache.json")
    this.loadFromDisk()
  }

  /**
   * Retrieves a cached value if valid and un-invalidated by file mtime.
   */
  get<T>(key: string, dependencyFilePath?: string): T | null {
    const entry = this.memoryCache.get(key)
    if (!entry) return null

    // Check TTL expiration
    if (entry.ttlMs && Date.now() - entry.cachedAt > entry.ttlMs) {
      this.memoryCache.delete(key)
      return null
    }

    // Check mtime invalidation if linked to a file on disk
    if (dependencyFilePath) {
      const fullPath = path.isAbsolute(dependencyFilePath)
        ? dependencyFilePath
        : path.join(this.workspaceRoot, dependencyFilePath)

      if (fs.existsSync(fullPath)) {
        try {
          const stats = fs.statSync(fullPath)
          if (stats.mtimeMs > entry.mtimeMs) {
            // File was modified since cache creation
            this.memoryCache.delete(key)
            return null
          }
        } catch {
          return null
        }
      }
    }

    return entry.data as T
  }

  /**
   * Stores a value into memory and queues persistence.
   */
  set<T>(key: string, data: T, options: { dependencyFilePath?: string; ttlMs?: number } = {}): void {
    let mtimeMs = Date.now()

    if (options.dependencyFilePath) {
      const fullPath = path.isAbsolute(options.dependencyFilePath)
        ? options.dependencyFilePath
        : path.join(this.workspaceRoot, options.dependencyFilePath)

      if (fs.existsSync(fullPath)) {
        try {
          mtimeMs = fs.statSync(fullPath).mtimeMs
        } catch {}
      }
    }

    this.memoryCache.set(key, {
      key,
      data,
      mtimeMs,
      cachedAt: Date.now(),
      ttlMs: options.ttlMs,
    })
  }

  /**
   * Invalidates a specific key or all keys matching a prefix.
   */
  invalidate(prefixOrKey: string): number {
    let count = 0
    for (const key of this.memoryCache.keys()) {
      if (key === prefixOrKey || key.startsWith(prefixOrKey)) {
        this.memoryCache.delete(key)
        count++
      }
    }
    return count
  }

  /**
   * Clears the entire cache.
   */
  clear(): void {
    this.memoryCache.clear()
    if (fs.existsSync(this.cacheFilePath)) {
      try {
        fs.unlinkSync(this.cacheFilePath)
      } catch {}
    }
  }

  /**
   * Persists cache to disk atomically.
   */
  saveToDisk(): void {
    try {
      const dir = path.dirname(this.cacheFilePath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      const data: Record<string, CacheEntry<any>> = {}
      for (const [k, v] of this.memoryCache.entries()) {
        data[k] = v
      }
      const tmp = `${this.cacheFilePath}.tmp`
      fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8")
      fs.renameSync(tmp, this.cacheFilePath)
    } catch {}
  }

  private loadFromDisk(): void {
    if (fs.existsSync(this.cacheFilePath)) {
      try {
        const raw = fs.readFileSync(this.cacheFilePath, "utf8")
        const parsed = JSON.parse(raw) as Record<string, CacheEntry<any>>
        for (const [k, v] of Object.entries(parsed)) {
          this.memoryCache.set(k, v)
        }
      } catch {}
    }
  }

  get size(): number {
    return this.memoryCache.size
  }
}
