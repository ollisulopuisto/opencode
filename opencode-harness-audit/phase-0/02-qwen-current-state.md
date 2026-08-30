# Qwen Current State Audit
## Phase 0 — Execution Model Integration & Behavioral Baseline

**Date:** 2026-08-30  
**Audit Target:** Qwen3.8-27B Integration & Runtime Environment  
**Status:** FACT-BASED AUDIT COMPLETED

---

## 1. Exact Model & Provider Configuration

- **Primary Configured Model:** `hetzner/Qwen3.8-27B`
- **Secondary Configured Model:** `hetzner/Qwen/Qwen3.6-35B-A3B-FP8`
- **Provider Name:** `hetzner` (Hetzner Inference API)
- **API Driver Type:** `@ai-sdk/openai-compatible`
- **Base URL:** `https://inference.hetzner.com/api/v1`
- **Authentication:** Bearer token via environment variable `{env:HETZNER_INFERENCE_TOKEN}`
- **Protocol Handler:** `packages/llm/src/protocols/openai-compatible-chat.ts` routing through `openai-chat.ts` via Server-Sent Events (`/chat/completions`).

---

## 2. Invocation Pipeline & Token Lifecycle

```
[ OpenCode CLI / SessionRunner ]
               │
               ▼
   [ LLMClient (@opencode-ai/llm) ]
               │
               ▼
[ openai-compatible-chat protocol ]
   - SSE streaming (/chat/completions)
   - Headers: x-session-affinity, X-Session-Id
   - Provider Options: openai promptCacheKey
               │
               ▼
 [ Hetzner Cloud Inference Endpoint ]
               │
               ▼
    [ Qwen3.8-27B LLM Stream ]
```

### Turn Resolution & Context Assembly:
1. **System Prompt Injection:** Injects agent system prompt (`build`, `plan`, `explore`) concatenated with dynamic baseline context epoch (`SystemContextEpoch`).
2. **Context Window Tracking:** Messages are projected into LLM canonical format (`toLLMMessages`).
3. **Session Affinity & Cache Keys:** `x-session-affinity` and `openai.promptCacheKey` headers are passed to facilitate server-side prefix caching.
4. **Context Overflow Detection:** `isContextOverflowFailure` inspects provider HTTP/stream errors. If detected prior to assistant turn start, `SessionCompaction.compactAfterOverflow` is triggered.

---

## 3. Tool Calling & Prompt Formatting Contradictions

An empirical investigation of the configuration revealed a critical structural conflict in how tool calls are presented to Qwen:

### The Conflict:
1. **Core OpenCode Tool Materialization:**
   - In `packages/core/src/session/runner/llm.ts` (lines 204-222), OpenCode passes formal JSON Schema tool definitions (`tools: [...]`) to the OpenAI `/chat/completions` endpoint.
   - Provider responses deliver structured tool calls via `event.type === "tool-call"`.
2. **Configured `gemma-prompt.txt` Prompt Injection:**
   - In `/Users/dst/.config/opencode/opencode.json`, the `build` agent is configured with `"prompt": "{file:./gemma-prompt.txt}"`.
   - The contents of `gemma-prompt.txt` explicitly dictate:
     ```text
     YOUR CRITICAL DIRECTIVES:
     1. INVOKE THE TOOL API: When asked to write or edit code, you MUST use the provided tools.
     2. USE STRICT QWEN XML FORMAT: You must format your tool calls EXACTLY using the following custom XML tags. NEVER use JSON for the tool call.
     Example:
     <tool_call>
     <function=write_file>
     <parameter=path>snake.py</parameter>
     ...
     </tool_call>
     ```
3. **Consequence:**
   - Qwen is instructed via prompt text to output `<tool_call><function=...>` XML blocks in its raw text stream, while the OpenAI-compatible API substrate expects native JSON function calling arguments.
   - When Qwen emits XML in plain text, OpenCode interprets it as assistant text (`part.type === "text"`) rather than a registered tool call, leading to tool execution stalling, markdown dumps, or unparsed commands.

---

## 4. Strengths & Execution Capabilities

- **High-Speed Mechanical Execution:** Rapid code generation, single-file edits, and quick syntax transformation.
- **Low Operational Cost:** Significantly cheaper per token than proprietary frontier reasoning models, making it ideal as a continuous workhorse.
- **Effective Read-Only Exploration:** Capable of running fast grep/glob searches and analyzing file structures when given narrow, unambiguous instructions.
- **TDD Compliance:** Follows TDD patterns (Red -> Green -> Refactor) when explicit verification instructions and test commands are provided.

---

## 5. Weaknesses & Failure Trajectories

- **Loop Traps on Ambiguous Failures:** When a build or test fails repeatedly with ambiguous error outputs, Qwen tends to repeat the same edit or oscillatory edits (flipping types/imports back and forth) without forming a new hypothesis.
- **Premature Completion Assertions:** Tends to claim a task is complete simply because an edit was written, without running the test suite or verifying runtime behavior.
- **Unbounded Scope Creep:** Modifies adjacent files, changes build configurations, or deletes tests when fixing edge cases unless constrained by a strict write set.
- **Inability to Self-Recover from Architectural Dead-Ends:** Once an incorrect architectural assumption is embedded in the prompt context, Qwen doubles down on the error rather than rolling back.

---

## 6. Model Adaptation Requirements for V5 Harness

To harness Qwen3.8-27B reliably without supervisory micromanagement:
1. **Unify Tool Calling:** Remove custom XML prompt hacks and rely on native OpenAI-compatible tool schemas or enforce deterministic regex-based XML parsers if native schemas fail on specific endpoints.
2. **Deterministic Pre-Execution Plan:** Do not allow Qwen to execute multi-file changes without an approved step-by-step plan.
3. **Strict Write Sets:** Restrict Qwen's write operations to explicitly assigned files per work unit.
4. **Harness-Enforced Verification:** Never mark a work unit complete based on model text; require deterministic test execution passing with exit code 0.
5. **Change Budget Enforcement:** Trigger automatic recovery or escalation if Qwen modifies more than $N$ files or $K$ lines.
