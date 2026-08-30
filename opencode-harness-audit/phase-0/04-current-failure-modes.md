# Current Failure Modes Audit
## Phase 0 — Empirical Weakness Analysis & Failure Taxonomy

**Date:** 2026-08-30  
**Audit Target:** OpenCode CLI & Qwen3.8-27B Runtime Trajectories  
**Status:** FACT-BASED AUDIT COMPLETED

---

## 1. High Impact / P0 Weaknesses

### Issue 1: Tool-Calling Format Conflict (`gemma-prompt.txt` vs Native JSON Tools)
```text
issue: Prompt instructs model to output custom XML tool tags while OpenCode core provides standard JSON function schemas.
evidence: ~/.config/opencode/gemma-prompt.txt configures the build agent with "USE STRICT QWEN XML FORMAT: <tool_call><function=write_file>... NEVER use JSON". Meanwhile, packages/core/src/session/runner/llm.ts passes JSON tool schemas to the OpenAI API endpoint.
reproduction: Run `opencode run "create hello.txt"` with the default build agent. Qwen outputs XML text blocks inside `part.type === 'text'`, which OpenCode ignores as unexecuted chat output rather than calling the tool.
impact: P0
confidence: high
likely_cause: Legacy prompt configuration overriding the default agent with incompatible prompt instructions intended for raw completion endpoints.
proposed_fix: Remove or sanitize `gemma-prompt.txt` from `opencode.json` so Qwen uses native JSON tool schemas provided by the OpenAI-compatible protocol handler.
```

### Issue 2: Lack of Deterministic Verification Gate Prior to Completion
```text
issue: A session is marked complete purely because the LLM stops calling tools, without running automated tests or lint checks.
evidence: packages/core/src/session/runner/llm.ts settles turns to `idle` whenever the provider returns text with no tool calls. There is no automated post-execution test verification before finishing.
reproduction: Ask Qwen to fix a bug in a codebase. Qwen edits the file and says "Fixed!", but never executes `bun test` or `pytest`. The session terminates with code 0 even if the test suite is failing.
impact: P0
confidence: high
likely_cause: OpenCode is designed as an interactive agent where the human is assumed to verify results manually.
proposed_fix: Implement a Phase 1 deterministic Verification Gate in the harness that runs targeted test suites and linters before allowing state transition to `COMPLETE`.
```

### Issue 3: Absence of Loop and Oscillation Detection
```text
issue: When a tool or build command fails, the runner allows unbounded repeated tool calls or oscillating file edits without stopping.
evidence: packages/core/src/session/runner/llm.ts has step counter limits (`agent.info.steps`) but no mechanism to detect repeated commands, identical error messages, or reverting edits.
reproduction: Prompt Qwen with a broken TypeScript type that fails `bun typecheck`. Qwen attempts the same syntax edit repeatedly across 10 steps until step limit exhaustion.
impact: P0
confidence: high
likely_cause: The LLM runner does not maintain rolling windows of command history or AST diff hashes.
proposed_fix: Implement a deterministic loop detector that tracks command signatures and edit hashes; trigger `RECOVERY` or escalate to Gemini after 2 identical failures.
```

---

## 2. High Frequency / P1 Weaknesses

### Issue 4: Unbounded Scope Creep & Missing Write-Set Budget
```text
issue: Model edits unrelated files or refactors existing working code when solving narrow tasks.
evidence: Tool permissions in `Agent.defaultInfo` grant write access to the entire workspace directory (`*`). There is no file count or line delta ceiling.
reproduction: Request a 1-line bugfix in a multi-module repository. Qwen proceeds to reformat imports and modify 5 adjacent files across multiple directories.
impact: P1
confidence: high
likely_cause: Lack of per-work-unit write set bounds and lack of soft change budget enforcement.
proposed_fix: Introduce work-unit contracts with explicit `write_set` whitelists and soft change budgets (e.g. max 5 files, 200 lines). Halt and inspect if exceeded.
```

### Issue 5: Raw, Unfiltered Tool Output Polluting Context Windows
```text
issue: Extremely verbose tool outputs (e.g., massive build logs or directory dumps) are injected directly into message history, risking context overflow.
evidence: packages/core/src/session/runner/llm.ts captures full tool settlement output (`settlement.output`) directly into `SessionEvent.Tool.Result`.
reproduction: Run a command producing 5,000 lines of output (e.g. `npm test` with verbose stack traces). The entire log is added to LLM messages, triggering expensive compactions.
impact: P1
confidence: high
likely_cause: Absence of an output normalization layer between tool execution and message projection.
proposed_fix: Implement structured tool output normalization to extract failure summaries and error lines, storing raw full logs on disk.
```

### Issue 6: Fragile Headless Permission Handling
```text
issue: Running `opencode run` without `--auto` causes immediate silent rejection of all permissions, aborting agent tasks.
evidence: packages/opencode/src/cli/cmd/run.ts lines 810-820 explicitly auto-rejects any `permission.asked` event in non-interactive mode unless `auto` flag is passed.
reproduction: Execute `opencode run "fix the bug"` without `--auto`. The first file read or edit request is rejected, causing immediate session termination.
impact: P1
confidence: high
likely_cause: Safety default designed to prevent unattended mutations unless explicitly overridden.
proposed_fix: Ensure all headless harness invocations mandate `--auto` combined with fine-grained harness-level sandbox controls.
```

---

## 3. Medium Impact / P2 Weaknesses

### Issue 7: Unisolated Subagent Concurrency (`task` Tool)
```text
issue: Invoking subagents via `task` tool executes in the same working tree without git worktree isolation, risking race conditions and merge conflicts.
evidence: packages/opencode/src/tool/task.ts creates child sessions in the same directory without creating independent git worktrees or branches.
reproduction: Run two subagents concurrently that edit different files in the same workspace. Git index locks and unsynchronized working tree states cause corruption.
impact: P2
confidence: high
likely_cause: Subagent architecture was initially designed for read-only exploration rather than parallel implementation.
proposed_fix: Enforce read-only mode for parallel subagents in early phases, and require dedicated `git worktree` isolation for Phase 5 parallel implementation.
```

### Issue 8: Loss of Reasoning Effort Tuning on OpenAI-Compatible Endpoints
```text
issue: Model variant / reasoning effort flags are not translated into Hetzner / Qwen-compatible API request parameters.
evidence: packages/llm/src/protocols/openai-compatible-chat.ts does not map `variant` parameters into reasoning effort tokens or system prompts for Qwen models.
reproduction: Pass `--variant high` to `opencode run`. The parameter is ignored by the Hetzner OpenAI-compatible route.
impact: P2
confidence: medium
likely_cause: OpenAI-compatible adapter treats the endpoint as generic without model-family specific feature flags.
proposed_fix: Add explicit parameter mapping in the harness to configure temperature and system guidance based on the assigned task complexity.
```

---

## 4. Nice-to-Have / P3 Weaknesses

### Issue 9: Lack of Unified Task State Persistence Across Compactions
```text
issue: Context compaction discards intermediate task state (hypotheses, verified facts, failed attempts), leaving the agent amnesic after compaction.
evidence: packages/opencode/src/agent/prompt/compaction.txt creates a generic summary rather than preserving structured task state schemas.
reproduction: Run a long-running multi-turn session that exceeds context limits. After compaction, Qwen re-attempts previously failed hypotheses.
impact: P3
confidence: medium
likely_cause: Compaction prompt is generalized for conversational chat rather than autonomous software engineering.
proposed_fix: Implement Phase 2 Task-State architecture to maintain structured JSON state across compaction cycles.
```

### Issue 10: Missing Real-Time Observability Metrics Pipeline
```text
issue: Metrics (time-to-first-edit, token usage per phase, tool retry counts) are not aggregated into structured task telemetry.
evidence: OpenCode records individual database events, but lacks an aggregated per-task telemetry summary export.
reproduction: Inspect session output after completion. No single JSON summary of duration, retries, and token efficiency is produced.
impact: P3
confidence: low
likely_cause: Telemetry is focused on real-time UI rendering rather than benchmark evaluation.
proposed_fix: Build a lightweight telemetry collector in the harness to export task metrics for benchmark comparisons.
```
