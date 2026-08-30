# OpenCode Harness V5 — Phase 2 Implementation Summary
## Context State Architecture & Persistent Task State

**Date:** 2026-08-30  
**Status:** IMPLEMENTED & FULLY VERIFIED  
**Target:** Persistent Task State, Output Normalization & Context Anti-Amnesia Substrate  

---

## 1. Executive Summary

Phase 2 builds the **Context State & Persistence Architecture** for the OpenCode V5 harness, solving two critical failure modes identified during Phase 0:
1. **Context Amnesia & Hypothesis Forgetting (Issue 9):** Context compaction and multi-turn loops discard intermediate task state (verified facts, disproven hypotheses, constraints), causing models to regress or repeat broken strategies.
2. **Context Window Pollution (Issue 5):** Verbose raw tool logs (large compiler outputs, massive test outputs, directory dumps) flood context windows and trigger premature compactions or token budget exhaustion.

Phase 2 delivers a durable, structured state preservation layer and real-time output normalizer that maintains 100% fidelity across compaction epochs and keeps context windows high-signal.

---

## 2. Implemented Components

### 1. Persistent Task State & Hydration Engine ([`harness/src/persistence.ts`](file:///Users/dst/Documents/koodi/opencode/harness/src/persistence.ts))
- **Schema & Serialization:** Serializes `TaskState` to structured JSON with versioning (`v5.2`) and integrity validation.
- **Atomic Disk Persistence:** Writes state to `.opencode/task-state.json` via atomic rename operations with automatic fallback to `.opencode/task-state.backup.json`.
- **State Checkpointing & Snapshots:** Supports named point-in-time snapshots (`.opencode/snapshots/`) for historical inspection and rollback.
- **Hydration Protocol:** Reconstitutes a live `TaskStateMachine` instance from persisted disk state or snapshots with full state transition history and budget delta counters.

### 2. Task State Markdown Renderer ([`harness/src/state-renderer.ts`](file:///Users/dst/Documents/koodi/opencode/harness/src/state-renderer.ts))
- **Structured Rendering:** Converts raw `TaskState` JSON into high-density Markdown suitable for model context prompts, human inspection, and telemetry logs.
- **Sections Emitted:**
  - `Invariant Constraints`: Guaranteed non-bypassable constraints.
  - `Verified Facts & Checks`: Passed test suites and established codebase facts.
  - `Work Units & Write Set Whitelist`: Explicit per-unit file scopes.
  - `Change Budget Consumption`: Files changed and line additions/deletions.
  - `Working Hypotheses & Decisions`: Active hypothesis and architectural decisions.
  - `Failure Log & Disproven Approaches`: Explicit list of failed strategies to prevent duplicate retries.
- **Render Modes:** `full` (audit/archive), `context_prompt` (optimized for LLM prompt injection), and `compact` (single-line summary).

### 3. Compaction Preservation Guard ([`harness/src/compaction-guard.ts`](file:///Users/dst/Documents/koodi/opencode/harness/src/compaction-guard.ts))
- **Preservation Envelope:** Generates a structured retention envelope (`<!-- BEGIN TASK STATE PRESERVATION ENVELOPE -->`) with explicit instructions forbidding the compaction summarizer from discarding verified facts, disproven approaches, or constraints.
- **Preservation Auditor:** Audits post-compaction summaries to verify whether invariant constraints and passing test records were retained.

### 4. Structured Tool Output Normalizer & Disk Log Spill ([`harness/src/normalizer.ts`](file:///Users/dst/Documents/koodi/opencode/harness/src/normalizer.ts))
- **Diagnostic Extractors:** Parses error signatures from TypeScript compiler (`tsc`), Bun test runner (`bun test`), Pytest (`pytest`), and Linters (`ruff`, `biome`, `eslint`).
- **Compression & Truncation:** Compresses tool outputs exceeding limits (default 50 lines / 4KB) into head/tail excerpts with extracted diagnostic summaries.
- **Disk Spill:** Spills complete un-truncated raw tool output to `.opencode/logs/tool-{name}-{timestamp}.log` and provides clickable disk pointers.

### 5. System Context State Bridge ([`harness/src/context-bridge.ts`](file:///Users/dst/Documents/koodi/opencode/harness/src/context-bridge.ts))
- **Turn Prompt Injection:** Injects real-time task state context, write-set boundaries, and active hypotheses into initial prompts and turn continuation messages.
- **Turn Checkpointing:** Coordinates automatic state snapshots and disk persistence before and after each model turn.

### 6. Subprocess Runner Upgrades ([`harness/src/runner.ts`](file:///Users/dst/Documents/koodi/opencode/harness/src/runner.ts))
- Integrated `TaskStatePersistence`, `ToolOutputNormalizer`, and `ContextBridge` directly into the streaming execution loop.
- Normalizes all streaming `tool_use` events in real-time before updating loop detectors and telemetry.

---

## 3. Architecture Alignment

```
┌─────────────────────────────────────────────────────────────┐
│                    OpenCode Harness V5                      │
│                                                             │
│   ┌──────────────────┐               ┌───────────────────┐  │
│   │ ContextBridge    │◄─────────────►│ TaskStateMachine  │  │
│   └────────┬─────────┘               └─────────┬─────────┘  │
│            │                                   │            │
│            ▼                                   ▼            │
│   ┌──────────────────┐               ┌───────────────────┐  │
│   │ TaskStateRenderer│               │TaskStatePersist.  │  │
│   └────────┬─────────┘               └─────────┬─────────┘  │
│            │                                   │            │
│            ▼                                   ▼            │
│   ┌──────────────────┐               ┌───────────────────┐  │
│   │ CompactionGuard  │               │ .opencode/state   │  │
│   └──────────────────┘               └───────────────────┘  │
│                                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │ ToolOutputNormalizer -> .opencode/logs/ (Disk Spill)│   │
│   └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```
