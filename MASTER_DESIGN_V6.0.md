# OpenCode Harness V6.0
## Native, In-Process, Model-Adaptive Autonomous Coding Harness

**Version:** 6.0  
**Status:** Architecture Specification & Core Integration Plan  
**Target Codebase:** `@opencode-ai/core`, `@opencode-ai/sdk-next`, `@opencode-ai/schema`, `packages/opencode`

---

## 0. Executive Objective

OpenCode Harness V6.0 integrates autonomous software engineering governance directly into the OpenCode V2 engine. It eliminates external child-process wrappers and sidecar CLI dependencies, embedding deterministic reliability heuristics directly into OpenCode's in-process Session Core:

- **In-Process Execution**: Zero child-process spawn overhead; runs directly against `@opencode-ai/sdk-next` and `SessionV2`.
- **First-Class System Context**: Task state, hypotheses, and execution plans live as typed `ContextSource` instances with immutable provider-caching baselines and clean epoch compaction.
- **Deterministic Multi-Tier Verification**: 4-Tier verification gates (Static ➔ Scoped ➔ Full Regression ➔ Anti-Evasion Diff Audit) prevent hallucinated completions.
- **Step-2 Loop & Oscillation Interception**: Real-time event stream monitoring that halts command oscillations and reverting file edits before credit burn.
- **Self-Contained Model Registry Escalation**: Dynamic role-based escalation (Implementer ➔ Planner/Debugger) using OpenCode's native model catalog and ROI discovery.
- **Monorepo Integration**: Packaged directly within `packages/core/src/harness/` and exposed via CLI `--harness` flag and `opencode harness` management commands.

---

## 1. System Architecture Overview

```mermaid
flowchart TD
    subgraph CLI / Entrypoints
        CLI["opencode run <prompt> --harness"] --> RUNNER["Harness In-Process Runner"]
        INIT["opencode harness --init"] --> ONBOARD["Onboarding & Model ROI Engine"]
        BENCH["opencode harness --bench"] --> BM["60-Task Benchmark Matrix"]
    end

    subgraph Native Session Runtime (@opencode-ai/core)
        RUNNER --> SESSION["SessionV2 & SessionExecution"]
        SESSION --> SYSCTX["System Context Registry"]
        SYSCTX --> TS_SRC["TaskState ContextSource<br/>(packages/core/src/system-context/sources/task-state.ts)"]
        TS_SRC --> EPOCH["Context Epoch & Baseline Cache"]
    end

    subgraph Harness Governance Pipeline
        SESSION --> STREAM["Real-Time Turn Stream"]
        STREAM --> LOOP["Step-2 Loop & Oscillation Detector"]
        STREAM --> NORM["Tool Output Normalizer & Disk Spill"]
        STREAM --> BUDGET["Strict Change Budget Guard"]
        STREAM --> VERIFY["Multi-Tier Verification Gate<br/>(Tiers 0, 1, 2, 3)"]
    end

    subgraph Autonomous Recovery & Escalation
        LOOP -- "Loop Detected (>=2)" --> RECOVERY["Failure Classifier & Recovery Engine"]
        VERIFY -- "Verification Failed" --> RECOVERY
        RECOVERY -- "Local Recovery (< 2)" --> SESSION
        RECOVERY -- "Exhausted (>= 2)" --> ESCALATE["ModelRouter Escalation<br/>(e.g., Kimi-K2.6 / Claude 3.7 / Qwen Max)"]
        ESCALATE --> SESSION
    end

    VERIFY -- "All Tiers Passed" --> SUCCESS["Verified Complete ✅"]
```

---

## 2. Core Pillars & Specifications

### Pillar 1: Native System Context (`TaskState` ContextSource)
Instead of injecting markdown envelopes into prompt text, task state is modeled as an infallible `ContextSource<TaskState>`:
* **Key**: `opencode/task-state`
* **Codec**: Schema-validated JSON representation of `{ objective, state, activeHypothesis, modifiedFiles, completedUnits, failedAttempts }`.
* **Baseline Renderer**: Compact Markdown block for initial Context Epoch generation.
* **Update Renderer**: Generates a `Mid-Conversation System Message` at safe provider-turn boundaries when state advances.
* **Epoch Durability**: Automatically re-rendered and preserved during context compaction without transcript pollution.

### Pillar 2: In-Process Runner (`@opencode-ai/sdk-next`)
* Executes directly within the Node/Bun memory space using OpenCode's in-memory `HttpClient` and `SessionExecution`.
* Eliminates CLI subprocess spawning, JSON stdio serialization bottlenecks, and sandbox permission auto-rejections.
* Listens directly to `SessionEvent` streams to inspect tool settlements, settlements output, and state transitions in real time.

### Pillar 3: Deterministic 4-Tier Verification Gate
State transition to `COMPLETE` is blocked until all 4 verification tiers pass:
1. **Tier 0 (Fast Static)**: Static typechecking (`bun typecheck`, `tsc --noEmit`, `mypy`) and linting completed in <2s.
2. **Tier 1 (Scoped Tests)**: Tests discovered via `TestMapper` directly targeting modified source files.
3. **Tier 2 (Full Regression)**: Entire workspace test suite (`bun test`, `pytest`, `cargo test`).
4. **Tier 3 (Anti-Evasion Diff Audit)**: AST & Diff inspection ensuring:
   * Zero added `.skip()`, `.only()`, or `it.todo()`
   * Zero commented-out test blocks
   * Zero empty test bodies
   * Zero trivial tautological assertions (`expect(true).toBe(true)`)

### Pillar 4: Real-Time Loop & Anomaly Interception
* Intercepts tool executions at Step 2 of any repetitive sequence:
  * **Identical Tool Invocation**: Same tool + arguments called consecutively.
  * **Oscillating Diff**: File edits reverting to an earlier hash within a 4-step rolling window.
  * **Repeated Failure Message**: Identical error output received across consecutive turns.
* Automatically halts execution, reverts uncommitted churn if necessary, and injects a structured anti-oscillation recovery prompt.

### Pillar 5: Self-Contained Model Registry & ROI Discovery
* Model selection is fully dynamic and self-contained:
  * **Implementer / Explorer Role**: Fast, cost-efficient models (e.g. `glm-5.3-flash`, `qwen3.8-27b`).
  * **Planner / Debugger / Supervisor Role**: High-capability frontier reasoning models (e.g. `kimi-k2.6`, `claude-3-7-sonnet`, `qwen3.8-max`).
* Onboarding scans active environment keys and subscriptions, assigning optimal models per role based on user-selected policy (`flat_fee_first`, `performance_first`, `balanced`).

---

## 3. Directory Layout & Monorepo Integration

```text
packages/core/src/
├── harness/                       # Native Harness Governance Core
│   ├── budget.ts                  # Change budget & write-set validation
│   ├── classifier.ts              # Work-unit classification (single vs multi-file)
│   ├── failure.ts                 # Failure taxonomy & recovery prompt engine
│   ├── loop-detector.ts           # Step-2 loop & oscillation detection
│   ├── normalizer.ts              # Tool output truncation & disk spill
│   ├── plan-validator.ts          # DAG plan validation & write-set isolation
│   ├── state.ts                   # Task state machine & transitions
│   ├── test-mapper.ts             # Workspace test mapping & discovery
│   ├── verifier.ts                # 4-Tier verification engine
│   └── verifier-policy.ts         # Multi-language verification policies
├── system-context/
│   └── sources/
│       └── task-state.ts          # Native TaskState ContextSource
packages/opencode/src/
├── cli/cmd/
│   ├── harness.ts                 # `opencode harness` (init, bench, stats)
│   └── run.ts                     # `--harness` flag wiring
harness/                           # Benchmark & Validation Suite
├── src/
│   ├── benchmark.ts               # 60-Task Benchmark Matrix Engine
│   ├── model-roi.ts               # ROI analyzer & model profile synthesizer
│   └── model-router.ts            # Dynamic model routing & fallback cascading
└── test/                          # Unit & integration test suites
```

---

## 4. Benchmark Matrix & Acceptance Criteria

1. **Unit Test Coverage**: All 112+ harness unit tests pass in <500ms.
2. **Typecheck Clean**: `bun typecheck` passes across `@opencode-ai/core` and `packages/opencode` with 0 errors.
3. **60-Task Benchmark Matrix**:
   * Minimum **90.0% Verified Completion Rate** across all 6 benchmark categories (Bugfix, Feature, Refactor, Debugging, Multi-file, Unfamiliar).
   * **0 Runaway Loop Halts** (100% intercepted at step <= 2).
   * **0 Change Budget Violations**.
