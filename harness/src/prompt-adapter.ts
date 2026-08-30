/**
 * OpenCode Harness V5.2 - Model-Specific Prompt & Instruction Adapter
 * 
 * Generates calibrated prompts tailored to specific model families (GLM, Qwen, Gemini)
 * to maximize tool-use precision, TDD adherence, and first-pass success.
 */

import { type ReasoningEffort } from "./reasoning-tuner"

export type ModelFamily = "glm" | "qwen" | "gemini" | "claude" | "generic"

export interface PromptAdaptationOptions {
  modelId: string
  taskObjective: string
  effort: ReasoningEffort
  reasoningDirectives: string[]
  assignedWriteSet?: string[]
  relevantFiles?: string[]
  isRecovery?: boolean
  failureContext?: string
}

export class PromptAdapter {
  /**
   * Detects model family from model identifier.
   */
  static detectFamily(modelId: string): ModelFamily {
    const lower = modelId.toLowerCase()
    if (lower.includes("glm")) return "glm"
    if (lower.includes("qwen")) return "qwen"
    if (lower.includes("gemini")) return "gemini"
    if (lower.includes("claude")) return "claude"
    return "generic"
  }

  /**
   * Adapts instructions for the targeted model family.
   */
  static formatInstructions(options: PromptAdaptationOptions): string {
    const family = this.detectFamily(options.modelId)
    const blocks: string[] = []

    // 1. Model-specific framing
    if (family === "glm" || family === "qwen") {
      blocks.push(
        `## EXECUTION DISCIPLINE`,
        `- Analyze existing tests or write targeted tests first before editing implementation files.`,
        `- Make atomic, precise file modifications. Do not perform speculative refactoring.`,
        `- Never repeat a failed command or edit without changing your underlying hypothesis.`
      )
    } else if (family === "gemini") {
      blocks.push(
        `## STRATEGIC SUPERVISION & ARCHITECTURAL GUIDANCE`,
        `- Identify root causes and structural boundary conditions.`,
        `- Formulate durable hypotheses and clear invariants.`
      )
    }

    // 2. Write-set constraints
    if (options.assignedWriteSet && options.assignedWriteSet.length > 0) {
      blocks.push(
        `## PERMITTED WRITE-SET (STRICT)`,
        `You may ONLY modify the following files/directories:\n` +
          options.assignedWriteSet.map((p) => `- \`${p}\``).join("\n")
      )
    }

    // 3. Reasoning & Guidance
    if (options.reasoningDirectives.length > 0) {
      blocks.push(
        `## REASONING DIRECTIVES (Effort: ${options.effort.toUpperCase()})`,
        options.reasoningDirectives.map((d) => `- ${d}`).join("\n")
      )
    }

    // 4. Recovery Context (if applicable)
    if (options.isRecovery && options.failureContext) {
      blocks.push(
        `## RECOVERY INSTRUCTION`,
        `Previous attempt encountered verification failure:`,
        `\`\`\`\n${options.failureContext.trim()}\n\`\`\``,
        `Diagnose the root failure cause and apply a verified correction.`
      )
    }

    return blocks.join("\n\n")
  }
}
