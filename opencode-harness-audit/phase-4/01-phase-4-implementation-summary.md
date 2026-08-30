# OpenCode Harness V5.2 — Phase 4 Implementation Summary
## Planning, Complexity Classification & Work-Unit Decomposition

**Date:** 2026-08-30  
**Status:** IMPLEMENTED & FULLY VERIFIED  
**Target:** Complexity Classifier, Task Planner, Plan Validator & Work-Unit Decomposition  

---

## 1. Executive Summary

Phase 4 implements **Lane 2 (Planner)** of Master Design V5.2. Autonomous software engineering fails when agents either:
1. Over-plan trivial 1-line bugfixes, wasting tokens and context space.
2. Under-plan complex multi-file architectural changes, leading to sprawling, uncoordinated edits and race conditions.

Phase 4 introduces a deterministic **Complexity Classifier**, **Task Planner**, and **Plan Validator** that dynamically adapts the planning lifecycle to task complexity.

---

## 2. Implemented Components

### 1. Task Complexity Classifier ([`harness/src/classifier.ts`](file:///Users/dst/Documents/koodi/opencode/harness/src/classifier.ts))
- **Complexity Tiers:**
  - `TRIVIAL`: Localized bug fixes, typos, off-by-one errors (0 planning overhead; direct transition `UNDERSTAND ➔ EXECUTE`).
  - `ROUTINE`: Standard features or localized refactors (1-3 files; lightweight plan).
  - `COMPLEX`: Multi-file changes, schema updates, cross-module refactors (requires full work-unit decomposition and DAG).
  - `ARCHITECTURAL`: High-uncertainty cross-system redesigns (flags for supervisor planning).
- **Proportional Budgets:** Automatically suggests appropriate change budgets (e.g. 2 files / 25 lines for `TRIVIAL` vs 12 files / 600 lines for `ARCHITECTURAL`).

### 2. Task Planner & Decomposition Engine ([`harness/src/planner.ts`](file:///Users/dst/Documents/koodi/opencode/harness/src/planner.ts))
- **Work-Unit Decomposition:** Decomposes complex objectives into bounded `WorkUnit` objects with explicit `id`, `title`, `objective`, `writeSet`, `relevantFiles`, and `dependencies`.
- **Markdown Plan Generation:** Emits canonical Master Design V5.2 plans with sections:
  1. `# Objective`
  2. `# Current Architecture & Context`
  3. `# Proposed Changes`
  4. `# Work Units & Scope Allocation`
  5. `# Risks & Mitigation`
  6. `# Verification Strategy`
  7. `# Rollback Plan`

### 3. Deterministic Plan Validator ([`harness/src/plan-validator.ts`](file:///Users/dst/Documents/koodi/opencode/harness/src/plan-validator.ts))
- **DAG Cycle Detection:** Runs depth-first cycle detection on work units to ensure dependency graphs are strictly acyclic.
- **Write-Set Boundary Enforcement:** Fails validation if any work unit defines an empty or unbounded write set.
- **Collision Warning:** Flags overlapping write sets among independent work units that must be serialized.

### 4. Runner Integration ([`harness/src/runner.ts`](file:///Users/dst/Documents/koodi/opencode/harness/src/runner.ts))
- Integrated complexity assessment and plan validation into the orchestrator lifecycle:
  - `UNDERSTAND ➔ PLAN ➔ DECOMPOSE ➔ EXECUTE ➔ VERIFY ➔ COMPLETE`
- Automatically registers work units and activates the primary work unit's write set on the `ChangeBudgetGuard`.

---

## 3. Architecture Overview

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Lane 2: Planning Engine                         │
│                                                                        │
│   ┌──────────────────────────┐                                         │
│   │ Complexity Classifier    │                                         │
│   │(TRIVIAL, ROUTINE, COMPLEX│                                         │
│   └────────────┬─────────────┘                                         │
│                │                                                       │
│                ▼                                                       │
│   ┌──────────────────────────┐         ┌───────────────────────────┐   │
│   │       Task Planner       │────────►│      Plan Validator       │   │
│   │(WorkUnit Decomposition)  │         │ (DAG & Collision Checks)  │   │
│   └────────────┬─────────────┘         └───────────────────────────┘   │
│                │                                                       │
│                ▼                                                       │
│   ┌──────────────────────────┐                                         │
│   │ State Machine Work Units │                                         │
│   │ (Bounded Write Sets)     │                                         │
│   └──────────────────────────┘                                         │
└────────────────────────────────────────────────────────────────────────┘
```
