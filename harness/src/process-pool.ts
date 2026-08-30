/**
 * OpenCode Harness V5.2 - Subprocess & Resource Pool Manager (Phase 9)
 * 
 * Manages concurrency limits, background process lifecycle, execution timeouts,
 * and command pooling to minimize startup latency and prevent resource exhaustion.
 */

export interface QueuedCommand<T> {
  id: string
  task: () => Promise<T>
  resolve: (value: T | PromiseLike<T>) => void
  reject: (reason?: any) => void
  timeoutMs?: number
}

export class ProcessPoolManager {
  private maxConcurrency: number
  private activeCount: number = 0
  private queue: QueuedCommand<any>[] = []

  constructor(maxConcurrency: number = 4) {
    this.maxConcurrency = Math.max(1, maxConcurrency)
  }

  /**
   * Schedules a task in the managed pool with concurrency limits and optional timeout.
   */
  async run<T>(task: () => Promise<T>, timeoutMs: number = 60_000): Promise<T> {
    if (this.activeCount < this.maxConcurrency) {
      return this.executeDirectly(task, timeoutMs)
    }

    return new Promise<T>((resolve, reject) => {
      const id = `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
      this.queue.push({
        id,
        task,
        resolve,
        reject,
        timeoutMs,
      })
    })
  }

  private async executeDirectly<T>(task: () => Promise<T>, timeoutMs: number): Promise<T> {
    this.activeCount++

    let timer: NodeJS.Timeout | undefined
    const timeoutPromise = new Promise<T>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(`Task timed out after ${timeoutMs}ms`))
      }, timeoutMs)
    })

    try {
      const result = await Promise.race([task(), timeoutPromise])
      return result
    } finally {
      if (timer) clearTimeout(timer)
      this.activeCount--
      this.processNext()
    }
  }

  private processNext(): void {
    if (this.activeCount >= this.maxConcurrency || this.queue.length === 0) {
      return
    }

    const next = this.queue.shift()
    if (!next) return

    this.executeDirectly(next.task, next.timeoutMs ?? 60_000)
      .then(next.resolve)
      .catch(next.reject)
  }

  get activeWorkers(): number {
    return this.activeCount
  }

  get queueLength(): number {
    return this.queue.length
  }
}
