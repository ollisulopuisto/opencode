export * as HarnessNormalizer from "./normalizer"

import fs from "fs"
import path from "path"

export interface NormalizerOptions {
  readonly maxLines?: number
  readonly maxBytes?: number
  readonly logsDir?: string
}

export interface DiagnosticIssue {
  readonly file?: string
  readonly line?: number
  readonly column?: number
  readonly ruleOrCode?: string
  readonly message: string
  readonly severity: "error" | "warning" | "info"
}

export interface NormalizedOutput {
  readonly summary: string
  readonly diagnostics: readonly DiagnosticIssue[]
  readonly isTruncated: boolean
  readonly originalBytes: number
  readonly originalLines: number
  readonly logFilePath?: string
}

export class ToolOutputNormalizer {
  private readonly logsDir: string
  private readonly defaultMaxLines: number
  private readonly defaultMaxBytes: number

  constructor(options: NormalizerOptions = {}) {
    this.logsDir = path.resolve(options.logsDir ?? path.join(process.cwd(), ".opencode", "logs"))
    this.defaultMaxLines = options.maxLines ?? 50
    this.defaultMaxBytes = options.maxBytes ?? 4096
  }

  normalize(tool: string, raw: string, options: NormalizerOptions = {}): NormalizedOutput {
    const text = String(raw ?? "").trim()
    const originalBytes = Buffer.byteLength(text, "utf-8")
    const lines = text.split("\n")
    const originalLines = lines.length

    const maxLines = options.maxLines ?? this.defaultMaxLines
    const maxBytes = options.maxBytes ?? this.defaultMaxBytes

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

    const logFilePath = this.spillToDisk(tool, text)
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

  private extractDiagnostics(tool: string, text: string): readonly DiagnosticIssue[] {
    const issues: DiagnosticIssue[] = []

    const tsRegex = /([^\s()]+)\((\d+),(\d+)\):\s+(error|warning)\s+(TS\d+):\s+(.+)/g
    let match = tsRegex.exec(text)
    while (match !== null) {
      issues.push({
        file: match[1],
        line: Number(match[2]),
        column: Number(match[3]),
        severity: match[4] as "error" | "warning",
        ruleOrCode: match[5],
        message: match[6],
      })
      match = tsRegex.exec(text)
    }

    const pytestRegex = /FAILED\s+([^\s:]+)(?:::([^\s]+))?\s+-\s+(.+)/g
    let pyMatch = pytestRegex.exec(text)
    while (pyMatch !== null) {
      issues.push({
        file: pyMatch[1],
        message: pyMatch[3] ?? "Test failed",
        severity: "error",
      })
      pyMatch = pytestRegex.exec(text)
    }

    return issues
  }

  private spillToDisk(tool: string, content: string): string {
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true })
    }

    const timestamp = Date.now()
    const safeTool = tool.replace(/[^a-zA-Z0-9_-]/g, "_")
    const filename = `${safeTool}_${timestamp}.log`
    const filePath = path.join(this.logsDir, filename)

    fs.writeFileSync(filePath, content, "utf-8")
    return filePath
  }

  private compressSummary(
    tool: string,
    lines: readonly string[],
    diagnostics: readonly DiagnosticIssue[],
    logFilePath: string,
    maxLines: number,
  ): string {
    const headCount = Math.floor(maxLines / 2)
    const tailCount = maxLines - headCount

    const headLines = lines.slice(0, headCount)
    const tailLines = lines.slice(-tailCount)
    const omittedCount = lines.length - (headCount + tailCount)

    const outputParts: string[] = []

    if (diagnostics.length > 0) {
      outputParts.push(
        `[Extracted Diagnostics (${diagnostics.length} issues)]`,
        ...diagnostics
          .slice(0, 10)
          .map(
            (d) =>
              `  - ${d.severity.toUpperCase()}: ${d.file ? `${d.file}:${d.line ?? 0}: ` : ""}${d.message}`,
          ),
        "",
      )
    }

    outputParts.push(
      ...headLines,
      `\n... [${omittedCount} lines omitted. Full tool log spilled to: ${logFilePath}] ...\n`,
      ...tailLines,
    )

    return outputParts.join("\n")
  }
}
