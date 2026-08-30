/**
 * OpenCode Harness V5 - Anomaly & Loop Detector
 * 
 * Detects:
 * - Repeated identical tool calls
 * - Repeated failed commands
 * - Oscillating file edits (e.g. flipping syntax back and forth)
 * - Stalled progress / duplicate hypotheses
 */

export interface ToolCallEvent {
  id: string
  tool: string
  args: Record<string, unknown>
  output?: string
  status: "completed" | "error"
  timestamp: number
}

export interface LoopDetectionResult {
  loopDetected: boolean
  loopType?: "REPEATED_TOOL_CALL" | "REPEATED_FAILURE" | "OSCILLATING_EDIT" | "COMMAND_LOOP"
  pattern?: string
  count: number
  recommendedAction: "HALT_AND_RECOVER" | "ESCALATE_TO_GEMINI" | "CONTINUE"
}

export class LoopDetector {
  private history: ToolCallEvent[] = []
  private fileEditHashes: Map<string, string[]> = new Map()
  private failureSignatures: Map<string, number> = new Map()

  /**
   * Maximum allowed consecutive identical tool calls before halting.
   */
  private readonly maxIdenticalCalls: number
  /**
   * Maximum allowed identical failure messages before halting.
   */
  private readonly maxIdenticalFailures: number

  constructor(options: { maxIdenticalCalls?: number; maxIdenticalFailures?: number } = {}) {
    this.maxIdenticalCalls = options.maxIdenticalCalls ?? 2
    this.maxIdenticalFailures = options.maxIdenticalFailures ?? 2
  }

  record(event: ToolCallEvent): LoopDetectionResult {
    const existingIndex = this.history.findIndex((e) => e.id === event.id)
    if (existingIndex >= 0) {
      this.history[existingIndex] = event
      return {
        loopDetected: false,
        count: 0,
        recommendedAction: "CONTINUE",
      }
    }
    this.history.push(event)

    // Check 1: Repeated identical error signatures (higher priority on errors)
    if (event.status === "error" && event.output) {
      const errSig = this.extractErrorSignature(event.output)
      const count = (this.failureSignatures.get(errSig) ?? 0) + 1
      this.failureSignatures.set(errSig, count)

      if (count > this.maxIdenticalFailures) {
        return {
          loopDetected: true,
          loopType: "REPEATED_FAILURE",
          pattern: `Error repeated ${count} times: ${errSig.slice(0, 100)}`,
          count,
          recommendedAction: count >= 3 ? "ESCALATE_TO_GEMINI" : "HALT_AND_RECOVER",
        }
      }
    }

    // Check 2: Consecutive identical tool calls
    const callSignature = this.hashCall(event.tool, event.args)
    const recent = this.history.slice(- (this.maxIdenticalCalls + 1))
    const matchingRecent = recent.filter(
      (e) => this.hashCall(e.tool, e.args) === callSignature
    )

    if (matchingRecent.length > this.maxIdenticalCalls) {
      return {
        loopDetected: true,
        loopType: "REPEATED_TOOL_CALL",
        pattern: `Tool '${event.tool}' called ${matchingRecent.length} times with identical arguments`,
        count: matchingRecent.length,
        recommendedAction: "HALT_AND_RECOVER",
      }
    }

    // Check 3: Oscillating file edits
    if (event.tool === "edit" || event.tool === "write") {
      const path = (event.args.path || event.args.file || event.args.filePath) as string
      if (path && event.args.content) {
        const contentHash = this.simpleHash(String(event.args.content))
        const hashes = this.fileEditHashes.get(path) ?? []
        hashes.push(contentHash)
        this.fileEditHashes.set(path, hashes)

        // Detect A -> B -> A pattern
        if (hashes.length >= 3) {
          const l = hashes.length
          if (hashes[l - 1] === hashes[l - 3] && hashes[l - 1] !== hashes[l - 2]) {
            return {
              loopDetected: true,
              loopType: "OSCILLATING_EDIT",
              pattern: `Oscillating edits detected on '${path}' (reverted to prior state)`,
              count: 2,
              recommendedAction: "HALT_AND_RECOVER",
            }
          }
        }
      }
    }

    return {
      loopDetected: false,
      count: 0,
      recommendedAction: "CONTINUE",
    }
  }

  reset(): void {
    this.history = []
    this.fileEditHashes.clear()
    this.failureSignatures.clear()
  }

  private hashCall(tool: string, args: Record<string, unknown>): string {
    return `${tool}:${JSON.stringify(args)}`
  }

  private simpleHash(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i)
      hash |= 0
    }
    return String(hash)
  }

  private extractErrorSignature(output: string): string {
    const lines = output
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !/^\s*\d+/.test(l)) // strip line numbers/timestamps
    return lines.slice(0, 3).join(" | ")
  }
}
