# OpenCode Harness V6.0 — Execution Playbook
## Phased Implementation, Core Migration & Benchmark Verification

**Date:** 2026-08-30  
**Status:** In-Progress Execution  
**Scope:** Core system context integration, in-process runner, CLI wiring, test suites, and 60-task benchmark matrix.

---

## Phase Breakdown

### Phase 1: Native System Context (`TaskState` ContextSource)
1. Implement `packages/core/src/system-context/sources/task-state.ts`.
2. Define Schema codec, baseline renderer, update renderer, and `SystemContext.Source<TaskState>`.
3. Verify with unit tests under `packages/core/test/system-context-task-state.test.ts`.

### Phase 2: Core Governance Package (`packages/core/src/harness/`)
1. Migrate the verified heuristics from `harness/src/` into `@opencode-ai/core/harness`:
   * `budget.ts`
   * `classifier.ts`
   * `failure.ts`
   * `loop-detector.ts`
   * `normalizer.ts`
   * `plan-validator.ts`
   * `state.ts`
   * `test-mapper.ts`
   * `verifier.ts`
   * `verifier-policy.ts`
2. Ensure strict adherence to AGENTS.md conventions: no `try/catch`, functional methods, Bun APIs, snake_case schemas, explicit named imports.

### Phase 3: In-Process Runner & Escalation Router
1. Create `harness/src/in-process-runner.ts` utilizing `@opencode-ai/sdk/v2` / embedded OpenCode client.
2. Wire real-time turn listeners for loop detection, output normalization, and verification gating.
3. Update `ModelRouter` to handle self-contained tier escalation (Implementer ➔ Planner/Debugger).

### Phase 4: CLI Flag & Subcommand Integration
1. Wire `--harness` flag in `packages/opencode/src/cli/cmd/run.ts`.
2. Add `packages/opencode/src/cli/cmd/harness.ts` supporting:
   * `opencode harness init` (Auto-discover policies, test suites, and model ROI).
   * `opencode harness bench` (Run smoke / 60-task benchmark suites).

### Phase 5: Verification & Benchmark Matrix
1. Run `bun test` across all packages (`packages/core`, `packages/opencode`, and `harness`).
2. Run `bun typecheck` across all packages.
3. Execute the 60-task benchmark matrix and populate `opencode-harness-audit/benchmark-60-results.md`.
