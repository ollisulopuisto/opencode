# V5 Implementation Plan Audit
## Phase 0 — Roadmap, Task Allocation & Architectural Strategy

**Date:** 2026-08-30  
**Audit Target:** Master Design V5 Staged Implementation Plan  
**Status:** FACT-BASED AUDIT COMPLETED

---

## 1. Executive Implementation Strategy

The V5 implementation is strictly phased to build execution reliability before introducing concurrency or complex supervisory layers. Each component is structured according to the Senior vs. Junior task allocation model: Senior engineers own state machines, safety gates, and recovery semantics, while Junior engineers own deterministic wrappers, parsers, test fixtures, and telemetry.

```
 Phase 0 ──► Phase 1 ──► Phase 2 ──► Phase 3 ──► Phase 4 ──► Phase 5 ──► Phase 6
 (Audit)    (P0 Gate &   (Context   (Verifier)  (Planning)  (Parallel    (Gemini
            Reliability)  State)                             Qwen)     Supervisor)
```

---

## 2. Component Specifications

### Component 1: Deterministic Verification Gate
```text
priority: P0
component: Verification Gate & Completion Guard
current_state: Sessions settle to COMPLETE solely when the LLM finishes tool calling and transitions to idle.
desired_state: A non-bypassable verification gate that runs targeted tests, type checks, and linters before allowing state transition to COMPLETE.
rationale: Eliminates the primary failure mode where models falsely assert completion on broken code.
dependencies: OpenCode CLI headless runner.
senior_task: Design gate evaluation semantics, exit-code validation, and failure routing.
junior_task: Implement test runner wrappers (bun test, pytest, cargo test) and output parsers.
estimated_complexity: Medium (3 days)
measurable_success_metric: Verified completion rate increases from baseline to >85% on standard benchmark suites.
rollback_strategy: Fall back to un-gated execution mode via configuration flag.
```

### Component 2: Loop & Oscillation Detector
```text
priority: P0
component: Anomaly & Loop Monitor
current_state: Runner allows unbounded identical tool calls or oscillating file edits up to max agent steps.
desired_state: Real-time event stream monitor that tracks rolling command hashes and AST diffs, halting on >=2 identical failures.
rationale: Prevents token budget exhaustion and infinite loops on intractable bugs.
dependencies: Event stream parser from `opencode run --format json`.
senior_task: Define loop detection algebra, oscillation threshold rules, and recovery triggers.
junior_task: Build command hash buffer, diff comparison utility, and event listener.
estimated_complexity: Low-Medium (2 days)
measurable_success_metric: Zero runaway sessions exceeding 3 duplicate tool calls.
rollback_strategy: Disable loop monitor hook; allow standard step counter to govern timeouts.
```

### Component 3: Change Budget & Scope Guard
```text
priority: P0
component: Write-Set & Change Budget Enforcer
current_state: Unbounded file write permissions across the entire workspace.
desired_state: Explicit write-set whitelists per work unit combined with soft line/file delta limits.
rationale: Prevents unintended refactoring and catastrophic scope expansion on simple bug fixes.
dependencies: Git working-tree snapshot tracking (`Snapshot.capture`).
senior_task: Define budget evaluation policy and checkpoint trigger conditions.
junior_task: Git diff line counter and file path pattern validator.
estimated_complexity: Low (1-2 days)
measurable_success_metric: 100% of single-file bug fix tasks touch <= 2 files.
rollback_strategy: Increase budget limits or disable enforcement in config.
```

### Component 4: Failure Classification & Structured Recovery Protocol
```text
priority: P1
component: Failure Taxonomy & Recovery Engine
current_state: Tool failures return raw error strings; model retries ad-hoc without structured hypotheses.
desired_state: Normalized failure taxonomy (BUILD_FAILURE, TYPE_FAILURE, TEST_FAILURE, RUNTIME_FAILURE, LOOP_DETECTED) paired with a strict STOP -> DIAGNOSE -> HYPOTHESIZE -> VERIFY protocol.
rationale: Transforms random guessing into systematic engineering debugging.
dependencies: Verification Gate & Loop Detector.
senior_task: Design failure classification taxonomy and hypothesis recovery state machine.
junior_task: Implement error pattern matchers and regex extractors for standard toolchains.
estimated_complexity: Medium (3 days)
measurable_success_metric: First-recovery success rate on failed tests exceeds 60%.
rollback_strategy: Pass raw error messages directly without taxonomy categorization.
```

### Component 5: Persistent Task State Architecture
```text
priority: P1
component: Task State Persistence (Phase 2)
current_state: Compaction summarizes conversational history generically, losing structured task context.
desired_state: Structured task state JSON (objective, constraints, hypotheses, files changed, tests run) preserved across compaction epochs.
rationale: Eliminates amnesia and repeated failed strategies across long-running sessions.
dependencies: Phase 1 execution reliability.
senior_task: Design task state schema and state hydration protocol.
junior_task: Build state serializer, disk cache persistence, and markdown state renderer.
estimated_complexity: Medium (3-4 days)
measurable_success_metric: 100% preservation of verified facts and hypotheses after context compaction.
rollback_strategy: Fall back to default OpenCode compaction summarizer.
```

### Component 6: Safe Parallel Qwen Worktree Execution
```text
priority: P2
component: Parallel Worker Isolation & Sync (Phase 5)
current_state: `task` subagents run concurrently in the same working tree without isolation.
desired_state: Dynamic `git worktree` isolation per worker with explicit write-set partitioning and orchestrator merge synchronization.
rationale: Unlocks multi-worker exploration and implementation speedup without git index or working tree corruption.
dependencies: Phase 1-4 stability and clean single-worker trajectories.
senior_task: Concurrency model, dependency graph scheduler, and merge conflict resolution.
junior_task: Git worktree lifecycle management scripts and branch cleanup utilities.
estimated_complexity: High (5-7 days)
measurable_success_metric: 2x speedup on multi-file independent feature tasks with 0 merge collisions.
rollback_strategy: Force serial execution mode across all tasks.
```

### Component 7: Gemini Supervisory Escalation Bridge
```text
priority: P2
component: Scarce Supervisor Protocol (Phase 6)
current_state: No external supervisory integration; all decisions left to local Qwen.
desired_state: Structured escalation pipeline where Gemini 3.7 is invoked only at strategic checkpoints (initial difficult planning, repeated recovery failures, scope budget violations).
rationale: Maximizes high-judgment reasoning where it matters while minimizing expensive supervisor calls.
dependencies: Phase 1-5 harness infrastructure.
senior_task: Escalation threshold policy, replanning protocol, and supervisor budget manager.
junior_task: Escalation payload serializer and supervisor response injector.
estimated_complexity: Medium (3 days)
measurable_success_metric: Average Gemini interventions per task <= 2 while achieving >90% verified task success.
rollback_strategy: Disable automatic escalation; require manual human intervention prompt.
```

---

## 3. Component Reusability & Architecture Alignment

### Existing OpenCode Components to Reuse Directly:
- **`opencode run --format json`:** High-speed JSONL event streaming engine.
- **SQLite V2 Session Store:** Durable session persistence, history projection, and message storage.
- **`packages/llm` OpenAI-Compatible Protocol:** SSE streaming and provider caching headers.
- **`Snapshot.capture()`:** Filesystem baseline and delta tracking.
- **`repo_clone` & Git Tools:** Built-in repository cloning and diff tools.

### V5 Components Identified as Unnecessary or Premature:
- **Heavy Knowledge Graph Database (`.repo/`):** Static code indexers add overhead; ripgrep + LSP + lightweight file maps are sufficient.
- **Multi-Agent Debate Protocol:** High token waste with no proven engineering reliability gains.
- **Turn-by-Turn Gemini Proxy:** Directly violates the Gemini scarcity rule.

---

## 4. Phase 1 Authorization & Recommended Scope

Upon user authorization to enter Phase 1, the immediate implementation scope shall be strictly limited to **P0 Execution Reliability for a Single Qwen Worker**:
1. Remove prompt format conflicts (`gemma-prompt.txt`) to restore native JSON tool schemas.
2. Build the deterministic Verification Gate (pre-completion test/lint validator).
3. Build the Anomaly & Loop Detector (repeated command/edit halting).
4. Build the Soft Change Budget Enforcer.
5. Create the 60-task Baseline Benchmark suite to establish empirical before/after metrics.
