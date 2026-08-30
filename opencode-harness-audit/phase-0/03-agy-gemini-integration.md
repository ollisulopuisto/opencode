# Agy / Gemini Integration Audit
## Phase 0 — Supervisory Bridge, CLI Interface & Process Lifecycle

**Date:** 2026-08-30  
**Audit Target:** Agy / Gemini 3.7 to OpenCode Execution Substrate Integration  
**Status:** FACT-BASED AUDIT COMPLETED

---

## 1. System Topology & Supervisory Boundary

In the V5 architecture, Gemini 3.7 (operating via the Antigravity / Agy runtime) acts as the scarce, high-judgment senior engineering supervisor, while OpenCode executes Qwen3.8-27B workers in headless CLI mode.

```
┌─────────────────────────────────────────────────────────┐
│              GEMINI 3.7 VIA AGY SUPERVISOR              │
│  - Architecture & High-Risk Planning                     │
│  - Trajectory Inspection & Anomaly Detection             │
│  - Escalation Resolution & Recovery                      │
└────────────────────────────┬────────────────────────────┘
                             │ Subprocess Management / IPC
                             ▼
┌─────────────────────────────────────────────────────────┐
│            OPENCODE HARNESS / ORCHESTRATOR              │
│  - FSM State Machine & Phase Transitions                │
│  - Deterministic Verification Gates                     │
│  - Loop Detection & Change Budget Enforcer              │
└────────────────────────────┬────────────────────────────┘
                             │ opencode run --format json
                             ▼
┌─────────────────────────────────────────────────────────┐
│                  OPENCODE RUNNER (CLI)                  │
│  - Model: Qwen3.8-27B (Hetzner Cloud Inference)         │
│  - Session V2 SQLite Store                              │
│  - Local Tool Execution (read, edit, bash, test)        │
└─────────────────────────────────────────────────────────┘
```

---

## 2. Invocation Mechanism & CLI Protocol

Agy launches and controls OpenCode as an external subprocess using the headless streaming CLI interface.

### Canonical Subprocess Invocation Command:
```bash
opencode run "<PROMPT>" \
  --format json \
  --auto \
  --model hetzner/Qwen3.8-27B \
  --agent build \
  --dir <WORKSPACE_PATH>
```

### Key CLI Parameters Audited:
1. **`--format json`:** Enables streaming of machine-readable line-delimited JSON events over `stdout` instead of human-facing TUI rendering.
2. **`--auto` (or `--yolo` / `--dangerously-skip-permissions`):** Automatically approves all non-destructive permission requests (file reads, writes, shell commands). Crucial for headless execution to avoid the interactive prompt auto-rejecting tool calls.
3. **`--session <sessionID>` & `--continue` (`-c`):** Resumes an existing session without re-sending earlier message history.
4. **`--fork`:** Forks the target session into an isolated branch before executing, enabling safe speculative execution.
5. **`--variant <string>`:** Allows passing provider-specific reasoning effort (e.g. `high`, `max`, `minimal`).

---

## 3. Structured Stream & Event Protocol

The output stream emitted by `opencode run --format json` produces standard JSON objects with top-level fields:
```json
{
  "type": "tool_use" | "step_start" | "step_finish" | "text" | "reasoning" | "error",
  "timestamp": 1756525000000,
  "sessionID": "ses_01954...",
  "part": { ... }
}
```

### Event Stream Signatures:
- **`step_start`:** Emitted when a new provider turn begins.
- **`tool_use`:** Emitted when a tool call finishes execution (status `completed` or `error`), containing input arguments, tool name, and settlement payload.
- **`text`:** Emitted when the assistant produces a markdown or conversational text chunk.
- **`reasoning`:** Emitted when model thinking/reasoning blocks finish.
- **`error`:** Emitted when a runtime, provider, or tool exception occurs.
- **`session.status`:** Emitted internally with `status.type === "idle"` when all pending turns settle, causing the CLI process to terminate.

---

## 4. Process Lifecycle & State Machine

```
   [ Spawn Subprocess ]
           │
           ▼
 [ Stream JSONL Events ] ───► [ Harness Anomaly Monitor ]
           │                         │
           │                  - Loop detected?
           │                  - Budget exceeded?
           │                  - Test failed?
           ▼                         │
   [ Process Settles ]               ▼
   (Exit code 0 or 1)        [ Trigger Recovery / Escalation ]
           │
           ▼
[ Run Verification Gate ]
           │
     ┌─────┴─────┐
   Passed      Failed
     │           │
     ▼           ▼
 [ Complete ]  [ Replan / Gemini Intervene ]
```

1. **Start:** Subprocess spawned with dedicated workspace working directory and isolated environment variables.
2. **Execution:** Line-by-line JSON stream consumed asynchronously. The supervisor tracks tool call counts, file mutations, and step numbers in real-time.
3. **Termination:** OpenCode exits cleanly with exit code `0` when the session transitions to `idle`.
4. **Interruption:** The supervisor can terminate a misbehaving or looping Qwen run immediately via `SIGINT` / `SIGTERM` to the process PID.
5. **Restart & Rollback:** If a run fails or is interrupted, the session can be rolled back using Git or resumed cleanly via `--session <id> --continue`.

---

## 5. Gemini Intervention Protocol & Budgeting

To maintain Gemini scarcity and prevent wasteful supervisor overhead:
1. **Zero Turn-by-Turn Interference:** Gemini is **never** invoked for individual tool calls, file reads, or minor edits.
2. **Escalation Trigger Conditions:**
   - Qwen executes >3 consecutive failing tool calls or identical repeated commands (Loop Detection).
   - Qwen modifies files outside the assigned write set or exceeds the change budget (Scope Expansion).
   - Qwen asserts completion but the deterministic verification gate fails (Verification Contradiction).
   - Qwen fails two consecutive autonomous recovery attempts.
3. **Supervisor Deliverable:**
   When escalated, Gemini produces a structured intervention payload (corrected hypothesis, constrained write set, revised step plan) which is injected into the session via `opencode run "INSTRUCTION" --session <id>`.

---

## 6. Security Boundaries & Workspace Isolation

- **File System Boundary:** Non-sandboxed CLI execution with `--auto` grants full shell authority to Qwen within the host user's permissions.
- **Harness Write Guard:** The harness orchestrator must validate Qwen's write operations against the assigned work-unit write set prior to merging changes or advancing the state machine.
- **Branch / Worktree Isolation:** For parallel Qwen execution (Phase 5), each worker must operate within an isolated `git worktree` to prevent concurrent write collisions on the primary repository working tree.
