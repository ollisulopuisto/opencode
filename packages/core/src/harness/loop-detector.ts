export * as HarnessLoopDetector from "./loop-detector"

export interface ToolCallEvent {
  readonly id: string
  readonly tool: string
  readonly args: Readonly<Record<string, unknown>>
  readonly output?: string
  readonly status: "completed" | "error"
  readonly timestamp: number
}

export interface LoopDetectionResult {
  readonly loopDetected: boolean
  readonly loopType?: "REPEATED_TOOL_CALL" | "REPEATED_FAILURE" | "OSCILLATING_EDIT" | "COMMAND_LOOP"
  readonly pattern?: string
  readonly count: number
  readonly recommendedAction: "HALT_AND_RECOVER" | "ESCALATE_SUPERVISOR" | "CONTINUE"
}

export class LoopDetector {
  private readonly history: ToolCallEvent[] = []
  private readonly fileEditHashes: Map<string, string[]> = new Map()
  private readonly failureSignatures: Map<string, number> = new Map()
  private readonly maxIdenticalCalls: number
  private readonly maxIdenticalFailures: number

  constructor(options: { readonly maxIdenticalCalls?: number; readonly maxIdenticalFailures?: number } = {}) {
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

    // Check 1: Repeated identical error signatures
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
          recommendedAction: count >= 3 ? "ESCALATE_SUPERVISOR" : "HALT_AND_RECOVER",
        }
      }
    }

    // Check 2: Consecutive identical tool calls
    const callSignature = this.hashCall(event.tool, event.args)
    const recent = this.history.slice(-(this.maxIdenticalCalls + 1))
    const matchingRecent = recent.filter((e) => this.hashCall(e.tool, e.args) === callSignature)

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
      const filePath = (event.args.path || event.args.file || event.args.filePath) as string
      if (filePath && event.args.content) {
        const contentHash = this.simpleHash(String(event.args.content))
        const hashes = this.fileEditHashes.get(filePath) ?? []
        hashes.push(contentHash)
        this.fileEditHashes.set(filePath, hashes)

        if (hashes.length >= 4) {
          const l = hashes.length
          // A -> B -> A pattern
          if (hashes[l - 1] === hashes[l - 3] && hashes[l - 2] !== hashes[l - 1]) {
            return {
              loopDetected: true,
              loopType: "OSCILLATING_EDIT",
              pattern: `File '${filePath}' edits oscillating between two states`,
              count: 3,
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
    this.history.length = 0
    this.fileEditHashes.clear()
    this.failureSignatures.clear()
  }

  private hashCall(tool: string, args: Readonly<Record<string, unknown>>): string {
    const sorted = Object.keys(args)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = args[key]
        return acc
      }, {})
    return `${tool}:${JSON.stringify(sorted)}`
  }

  private extractErrorSignature(output: string): string {
    const errorLines = output
      .split("\n")
      .map((l) => l.trim())
      .filter(
        (l) =>
          l.toLowerCase().includes("error") ||
          l.toLowerCase().includes("fail") ||
          l.toLowerCase().includes("exception"),
      )
      .slice(0, 3)

    if (errorLines.length > 0) {
      return errorLines.join(" | ")
    }
    return output.slice(0, 150)
  }

  private simpleHash(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash |= 0
    }
    return hash.toString(16)
  }
}
