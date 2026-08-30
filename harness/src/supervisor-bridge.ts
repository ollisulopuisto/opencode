/**
 * OpenCode Harness V5.2 - Gemini Supervisory Bridge & Directive Handshake
 * 
 * Compiles high-density escalation packets and integrates supervisory steering directives
 * back into the task state machine and execution prompt (§7.3, §28).
 */

import { TaskStateMachine, type TaskState } from "./state"
import { SupervisorProtocol, type EscalationTrigger } from "./supervisor-protocol"

export interface SupervisoryEscalationPacket {
  taskId: string
  trigger: EscalationTrigger
  reason: string
  objective: string
  constraints: string[]
  workUnits: { id: string; title: string; writeSet: string[] }[]
  filesChanged: string[]
  failedTests: string[]
  attemptedHypotheses: string[]
  diagnosticsSummary: string
  requestedDecision: string
}

export interface SupervisoryDirective {
  rootCauseDiagnosis: string
  actionableDirective: string
  newHypothesis: string
  modifiedWriteSet?: string[]
  rollbackRecommended?: boolean
}

export class SupervisorBridge {
  private protocol: SupervisorProtocol

  constructor(protocol?: SupervisorProtocol) {
    this.protocol = protocol ?? new SupervisorProtocol()
  }

  /**
   * Compiles the canonical Master Design V5.2 Supervisory Escalation Packet.
   */
  static compilePacket(
    stateMachine: TaskStateMachine,
    trigger: EscalationTrigger,
    diagnosticsSummary: string,
    requestedDecision: string
  ): SupervisoryEscalationPacket {
    const snapshot = stateMachine.snapshot

    return {
      taskId: snapshot.taskId,
      trigger,
      reason: `Escalation triggered by ${trigger}`,
      objective: snapshot.objective,
      constraints: snapshot.constraints,
      workUnits: snapshot.workUnits.map((u) => ({ id: u.id, title: u.title, writeSet: u.writeSet })),
      filesChanged: snapshot.filesChanged,
      failedTests: snapshot.testsRun.filter((t) => !t.passed).map((t) => t.command),
      attemptedHypotheses: snapshot.failures.map((f) => `Turn ${f.turn}: ${f.failureType} (${f.details ?? f.reason})`),
      diagnosticsSummary,
      requestedDecision,
    }
  }

  /**
   * Formats the escalation packet into structured markdown.
   */
  static formatPacketMarkdown(packet: SupervisoryEscalationPacket): string {
    const lines: string[] = []

    lines.push(`# GEMINI SUPERVISORY ESCALATION: [${packet.taskId}]`)
    lines.push(`## 1. ESCALATION TRIGGER & REASON`)
    lines.push(`- **Trigger:** \`${packet.trigger}\``)
    lines.push(`- **Reason:** ${packet.reason}`)
    lines.push("")

    lines.push(`## 2. TASK OBJECTIVE & CONSTRAINTS`)
    lines.push(`- **Objective:** ${packet.objective}`)
    lines.push(`- **Constraints:** ${packet.constraints.join("; ") || "*none*"}`)
    lines.push("")

    lines.push(`## 3. WORK UNITS & SCOPE ALLOCATION`)
    for (const u of packet.workUnits) {
      lines.push(`- **${u.title}** (\`${u.id}\`): Write Set: [${u.writeSet.map((f) => `\`${f}\``).join(", ")}]`)
    }
    lines.push("")

    lines.push(`## 4. FAILURE HISTORY & ATTEMPTED HYPOTHESES`)
    if (packet.attemptedHypotheses.length > 0) {
      for (const h of packet.attemptedHypotheses) {
        lines.push(`- ${h}`)
      }
    } else {
      lines.push(`*No previous failures recorded.*`)
    }
    lines.push("")

    lines.push(`## 5. RECENT DIAGNOSTICS & TEST RESULTS`)
    lines.push("```text")
    lines.push(packet.diagnosticsSummary || "No test output available.")
    lines.push("```")
    lines.push("")

    lines.push(`## 6. REQUESTED SUPERVISORY DECISION`)
    lines.push(packet.requestedDecision)

    return lines.join("\n")
  }

  /**
   * Applies supervisory directive back into task state machine.
   */
  applyDirective(stateMachine: TaskStateMachine, directive: SupervisoryDirective): void {
    // Record intervention in state
    stateMachine.recordGeminiIntervention()

    // Update hypothesis with supervisor's actionable insight
    stateMachine.setHypothesis(directive.newHypothesis)

    // Add decision to state history
    stateMachine.recordDecision(
      `Gemini Supervisor Directive: ${directive.actionableDirective}`,
      directive.rootCauseDiagnosis
    )

    console.log(`[SupervisorBridge] Applied supervisory directive: "${directive.actionableDirective.slice(0, 100)}..."`)
  }

  getProtocol(): SupervisorProtocol {
    return this.protocol
  }
}
