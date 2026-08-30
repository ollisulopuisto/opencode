/**
 * OpenCode Harness V5 - Deterministic Verification Gate
 * 
 * Verifies implementation correctness using independent test and lint execution.
 * A task cannot be marked COMPLETE based on LLM claims alone.
 */

export interface VerificationResult {
  correct: boolean
  confidence: number
  durationMs: number
  exitCode: number
  stdout: string
  stderr: string
  command: string
  issues: string[]
  missingTests: string[]
  regressions: string[]
}

export interface VerificationOptions {
  cwd: string
  timeoutMs?: number
  env?: Record<string, string>
}

export class VerificationGate {
  /**
   * Run a deterministic verification command against the working tree.
   */
  static async verify(
    command: string,
    options: VerificationOptions
  ): Promise<VerificationResult> {
    const start = Date.now()
    const timeoutMs = options.timeoutMs ?? 60_000

    try {
      const proc = Bun.spawn(["sh", "-c", command], {
        cwd: options.cwd,
        env: { ...process.env, ...options.env },
        stdout: "pipe",
        stderr: "pipe",
      })

      // Timeout watchdog
      const timer = setTimeout(() => {
        try {
          proc.kill()
        } catch {
          // ignore
        }
      }, timeoutMs)

      const [stdoutBuf, stderrBuf, exitCode] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ])

      clearTimeout(timer)
      const durationMs = Date.now() - start

      const issues: string[] = []
      if (exitCode !== 0) {
        issues.push(`Command '${command}' failed with exit code ${exitCode}`)
        const errLines = (stderrBuf + "\n" + stdoutBuf)
          .split("\n")
          .filter((line) =>
            /error|fail|exception|panic|assert|invalid/i.test(line)
          )
          .slice(0, 10)
        issues.push(...errLines)
      }

      const correct = exitCode === 0
      const confidence = correct ? 1.0 : 0.0

      return {
        correct,
        confidence,
        durationMs,
        exitCode,
        stdout: stdoutBuf,
        stderr: stderrBuf,
        command,
        issues,
        missingTests: [],
        regressions: [],
      }
    } catch (err: unknown) {
      const durationMs = Date.now() - start
      const msg = err instanceof Error ? err.message : String(err)
      return {
        correct: false,
        confidence: 0.0,
        durationMs,
        exitCode: 1,
        stdout: "",
        stderr: msg,
        command,
        issues: [`Verification execution error: ${msg}`],
        missingTests: [],
        regressions: [],
      }
    }
  }

  /**
   * Auto-discover verification commands for standard project types.
   */
  static async discoverVerificationCommands(cwd: string): Promise<string[]> {
    const commands: string[] = []

    const hasPackageJson = await Bun.file(`${cwd}/package.json`).exists()
    const hasPyproject = await Bun.file(`${cwd}/pyproject.toml`).exists()
    const hasCargo = await Bun.file(`${cwd}/Cargo.toml`).exists()
    const hasBunLock = await Bun.file(`${cwd}/bun.lock`).exists()

    if (hasPackageJson) {
      try {
        const pkg = await Bun.file(`${cwd}/package.json`).json()
        if (pkg.scripts?.test) {
          commands.push(hasBunLock ? "bun test" : "npm test")
        }
        if (pkg.scripts?.typecheck) {
          commands.push("bun typecheck")
        }
        if (pkg.scripts?.lint) {
          commands.push("bun run lint")
        }
      } catch {
        // ignore
      }
    }

    if (hasPyproject) {
      commands.push("uv run pytest", "uv run ruff check .")
    }

    if (hasCargo) {
      commands.push("cargo test")
    }

    return commands
  }
}
