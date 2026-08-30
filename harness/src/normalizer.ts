/**
 * OpenCode Harness V5 - Structured Tool Output Normalizer & Log Spill
 * 
 * Normalizes, compresses, and extracts high-signal diagnostics from verbose
 * tool outputs, preventing context window pollution and token exhaustion.
 */

import * as fs from "node:fs"
import * as path from "node:path"

export interface NormalizerOptions {
  maxLines?: number
  maxBytes?: number
  logsDir?: string
}

export interface DiagnosticIssue {
  file?: string
  line?: number
  column?: number
  ruleOrCode?: string
  message: string
  severity: "error" | "warning" | "info"
}

export interface NormalizedOutput {
  summary: string
  diagnostics: DiagnosticIssue[]
  isTruncated: boolean
  originalBytes: number
  originalLines: number
  logFilePath?: string
}

export class ToolOutputNormalizer {
  private logsDir: string
  private defaultMaxLines: number
  private defaultMaxBytes: number

  constructor(options: NormalizerOptions = {}) {
    this.logsDir = path.resolve(options.logsDir ?? path.join(process.cwd(), ".opencode", "logs"))
    this.defaultMaxLines = options.maxLines ?? 50
    this.defaultMaxBytes = options.maxBytes ?? 4096
  }

  /**
   * Normalizes raw tool execution output.
   */
  normalize(tool: string, raw: string, options: NormalizerOptions = {}): NormalizedOutput {
    const text = String(raw ?? "").trim()
    const originalBytes = Buffer.byteLength(text, "utf-8")
    const lines = text.split("\n")
    const originalLines = lines.length

    const maxLines = options.maxLines ?? this.defaultMaxLines
    const maxBytes = options.maxBytes ?? this.defaultMaxBytes

    // Extract tool-specific diagnostics
    const diagnostics = this.extractDiagnostics(tool, text)

    const needsTruncation = originalLines > maxLines || originalBytes > maxBytes

    if (!needsTruncation) {
      return {
        summary: text,
        diagnostics,
        isTruncated: false,
        originalBytes,
        originalLines,
      }
    }

    // Spill full output to disk
    const logFilePath = this.spillToDisk(tool, text)

    // Build compressed summary
    const summary = this.compressSummary(tool, lines, diagnostics, logFilePath, maxLines)

    return {
      summary,
      diagnostics,
      isTruncated: true,
      originalBytes,
      originalLines,
      logFilePath,
    }
  }

  /**
   * Extract diagnostics based on tool output patterns.
   */
  private extractDiagnostics(tool: string, text: string): DiagnosticIssue[] {
    const issues: DiagnosticIssue[] = []

    // 1. TypeScript / TSC errors: path/to/file.ts(10,5): error TS2322: Type 'string' is not assignable to type 'number'.
    const tsRegex = /([^\s()]+)\((\d+),(\d+)\):\s+(error|warning)\s+(TS\d+):\s+(.+)/g
    let match: RegExpExecArray | null
    while ((match = tsRegex.exec(text)) !== null) {
      issues.push({
        file: match[1],
        line: parseInt(match[2], 10),
        column: parseInt(match[3], 10),
        severity: match[4] === "error" ? "error" : "warning",
        ruleOrCode: match[5],
        message: match[6],
      })
    }

    // 2. Bun test failure lines: (fail) suite > test name [12ms]
    const bunFailRegex = /\(fail\)\s+([^\n]+)/g
    while ((match = bunFailRegex.exec(text)) !== null) {
      issues.push({
        message: `Failed test: ${match[1].trim()}`,
        severity: "error",
      })
    }

    // 3. Pytest fail lines: FAILED path/to/test.py::test_name - AssertionError: ...
    const pytestFailRegex = /FAILED\s+([^:\s]+)::(\S+)(?:\s+-\s+(.+))?/g
    while ((match = pytestFailRegex.exec(text)) !== null) {
      issues.push({
        file: match[1],
        message: `Pytest failure in ${match[2]}: ${match[3] ?? ""}`.trim(),
        severity: "error",
      })
    }

    // 4. Linter / Ruff errors: path/to/file.py:10:5: E501 Line too long
    const ruffRegex = /([^\s:]+):(\d+):(\d+):\s+([A-Z]\d+)\s+(.+)/g
    while ((match = ruffRegex.exec(text)) !== null) {
      issues.push({
        file: match[1],
        line: parseInt(match[2], 10),
        column: parseInt(match[3], 10),
        ruleOrCode: match[4],
        message: match[5],
        severity: "error",
      })
    }

    return issues
  }

  /**
   * Spills full log to .opencode/logs/
   */
  private spillToDisk(tool: string, content: string): string {
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true })
    }

    const timestamp = Date.now()
    const sanitizedTool = tool.replace(/[^a-zA-Z0-9_-]/g, "_")
    const filename = `tool-${sanitizedTool}-${timestamp}.log`
    const fullPath = path.join(this.logsDir, filename)

    try {
      fs.writeFileSync(fullPath, content, "utf-8")
    } catch {
      // ignore
    }

    return fullPath
  }

  /**
   * Compresses lines into a head/tail structure with extracted diagnostics.
   */
  private compressSummary(
    tool: string,
    lines: string[],
    diagnostics: DiagnosticIssue[],
    logFilePath: string,
    maxLines: number
  ): string {
    const headCount = Math.floor(maxLines * 0.3)
    const tailCount = Math.floor(maxLines * 0.5)

    const head = lines.slice(0, headCount)
    const tail = lines.slice(-tailCount)
    const skipped = lines.length - headCount - tailCount

    const output: string[] = []

    // Add diagnostics callout if any detected
    if (diagnostics.length > 0) {
      output.push(`[NORMALIZED DIAGNOSTICS: ${diagnostics.length} issue(s) detected]`)
      for (const diag of diagnostics.slice(0, 10)) {
        const loc = diag.file ? `${diag.file}:${diag.line ?? 0}: ` : ""
        const code = diag.ruleOrCode ? `[${diag.ruleOrCode}] ` : ""
        output.push(`- ${loc}${code}${diag.message}`)
      }
      if (diagnostics.length > 10) {
        output.push(`- ... and ${diagnostics.length - 10} more issues.`)
      }
      output.push("")
    }

    // Add Head
    output.push(...head)
    // Add Truncation Marker
    output.push("")
    output.push(`--- [TRUNCATED ${skipped} lines | Full output: ${logFilePath}] ---`)
    output.push("")
    // Add Tail
    output.push(...tail)

    return output.join("\n")
  }
}
