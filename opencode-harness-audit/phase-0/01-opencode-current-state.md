# OpenCode Current State Audit
## Phase 0 — System Architecture & Component Classification

**Date:** 2026-08-30  
**Audit Target:** Local OpenCode Installation & Repository (`ollisulopuisto/opencode`)  
**Status:** FACT-BASED AUDIT COMPLETED

---

## 1. Installation & Environment Overview

- **Installed CLI Version:** `1.18.20`
- **Installed Binary Path:** `/opt/homebrew/bin/opencode`
- **Host Runtime Engine:** Bun `1.4.0` (Darwin arm64, macOS Mac Studio)
- **Repository Location:** `/Users/dst/Documents/koodi/opencode` (Git branch `dev`, commit fork `ollisulopuisto/opencode`)
- **Global Configuration Path:** `/Users/dst/.config/opencode/`
  - `opencode.json` (Provider definitions, default model `hetzner/Qwen3.8-27B`, `build` agent prompt template)
  - `AGENTS.md` (Global agent guidelines: TDD workflow, mandatory linter passes, no raw markdown code blocks)
  - `gemma-prompt.txt` (Specialized tool-call prompt for `build` agent)
  - `antigravity-accounts.json`
- **Data & Cache Storage:** `/Users/dst/.local/share/opencode/` (Durable SQLite databases, logs, tool outputs, cached repos)
- **Socket / Server Daemon:** Active Unix Domain Socket at `/tmp/opencode.sock` and dual TCP listener support on port `8090`.

---

## 2. Core Architecture & Monorepo Structure

OpenCode is built as an Effect-TS TypeScript monorepo with 32 packages. The execution core is designed around typed functional effects (`effect`), durable relational persistence (SQLite via Drizzle), and event-driven architecture.

### Key Package Boundaries:
1. **`packages/core` (`@opencode-ai/core`):**
   - **V2 Session Core (`src/session/`):** Manages durable session state, `session_input` table with explicit `steer` vs `queue` delivery modes, context epochs (`SessionContextEpoch`), history projections (`SessionHistory`), run coordination (`SessionRunCoordinator`), and compaction (`SessionCompaction`).
   - **Session Runner (`src/session/runner/llm.ts`):** Controls turn-by-turn provider streaming (`llm.stream(request)`), eager tool execution via fiber sets (`FiberSet`), step settlement, snapshot delta tracking, and post-session notification hooks (`Ntfy.send`).
   - **Tool Engine (`src/tool/`):** Registry and definitions for built-in tools (`read`, `write`, `edit`, `apply-patch`, `bash`/`shell`, `glob`, `grep`, `task`, `clone`, `todowrite`, `question`, `webfetch`, `websearch`).
   - **Permissions Engine (`src/permission/`):** Glob-based permission system evaluating operations against rule sets with `allow`, `ask`, and `deny` actions.
   - **System Context (`src/system-context/`):** Composable context algebra for project structure, skills, references, and environment state.
2. **`packages/opencode`:**
   - **CLI Layer (`src/cli/`):** Yargs-based CLI engine implementing `opencode run`, `opencode attach`, `opencode serve`, `opencode mcp`, `opencode agent`, `opencode models`, `opencode update`, and `opencode clone`.
   - **Headless & Streaming Runner (`src/cli/cmd/run.ts`):** Supports `--format json` streaming of structured JSON lines (`step_start`, `step_finish`, `tool_use`, `text`, `reasoning`, `error`), `--auto` permission auto-approval, `--agent`, `--model`, and `--variant`.
   - **Server (`src/server/server.ts`):** HTTP/WebSocket server supporting Unix socket (`/tmp/opencode.sock`) and TCP/Tailscale listeners for multi-viewer real-time collaboration.
3. **`packages/llm` (`@opencode-ai/llm`):**
   - Protocol abstraction supporting Anthropic Messages, Bedrock Converse, OpenAI Chat, and OpenAI-Compatible endpoints (`openai-compatible-chat.ts`).
   - Handles token streaming, SSE event framing, prompt cache keys, provider error normalization, and context overflow detection (`isContextOverflowFailure`).
4. **`packages/session-ui` & `packages/app`:** SolidJS frontend with web/PWA interface, working-tree diff visualizer, and plan execution card transition components.

---

## 3. Agents & Execution Roles

The system registers native and configured agents categorized by `mode` (`primary`, `subagent`, `all`):

| Agent Name | Mode | Native | Visibility | Purpose & Tools |
| :--- | :--- | :--- | :--- | :--- |
| **`build`** | `primary` | Yes | Visible (Default) | Default execution agent. Unrestricted tool permissions (except destructive defaults), supports `question` and `plan_enter`. Configured with `gemma-prompt.txt`. |
| **`plan`** | `primary` | Yes | Visible | Read-only planning agent. Disallows file edits (except `.opencode/plans/*.md` and data plan directory) and task delegation. |
| **`explore`** | `subagent` | Yes | Visible | Read-only discovery agent specialized for grep, glob, list, bash (read), webfetch, websearch, and read operations. |
| **`general`** | `subagent` | Yes | Visible | Multi-step subagent used for delegating concurrent child tasks via `task` tool. |
| **`triage`** | `primary` | No | Visible (Local) | GitHub triage agent configured in `.opencode/agent/triage.md`. |
| **`duplicate-pr`**| `primary` | No | Visible (Local) | PR deduplication agent in `.opencode/agent/duplicate-pr.md`. |
| **`compaction`**| `primary` | Yes | Hidden | System agent invoked automatically to summarize message history when token threshold or overflow occurs. |
| **`title`** | `primary` | Yes | Hidden | Generates concise session titles from first turn prompt. |
| **`summary`** | `primary` | Yes | Hidden | Produces durable summaries of session turns. |

---

## 4. Existing Tool Inventory

1. **File Operations:**
   - `read`: Read file contents with line ranges and chunk offsets.
   - `write`: Create or overwrite files.
   - `edit`: Replace exact substrings within files.
   - `apply-patch`: Apply unified multi-file diff patches.
2. **Search & Discovery:**
   - `glob`: Match file paths using glob patterns.
   - `grep`: Fast ripgrep search with regex and include filters.
   - `lsp`: Language Server Protocol queries (definition, references, symbols, hover).
3. **Execution & Environment:**
   - `bash` / `shell`: Execute command-line scripts and inspect exit codes/output.
   - `repo_clone`: Shallow or deep clone of remote repositories into local workspaces.
4. **Task & State Management:**
   - `task`: Delegate subtasks to child agents (`general`, `explore`).
   - `todowrite` / `todo`: Update persistent session todo lists.
   - `plan`: Enter/exit planning phases and record plan markdown.
   - `question`: Prompt human user for interactive input or clarification.
5. **External Integrations:**
   - `webfetch`: Fetch and parse web pages.
   - `websearch`: Perform external search queries.
   - `mcp`: Dynamic Model Context Protocol client connectors (Gmail, Todoist, Puppeteer, PostgreSQL, GitHub).

---

## 5. V5 Master Design Component Classification

Comparison of Master Design V5 requirements against the existing OpenCode codebase:

| V5 Component | Classification | Evidence & Current Location |
| :--- | :--- | :--- |
| **Headless JSON Streaming** | `ALREADY_EXISTS` | `opencode run --format json` in `packages/opencode/src/cli/cmd/run.ts` emits JSONL events. |
| **Unix Socket IPC Engine** | `ALREADY_EXISTS` | `/tmp/opencode.sock` and dual socket/TCP server in `packages/opencode/src/server/server.ts`. |
| **Durable Session State (SQLite)** | `ALREADY_EXISTS` | `packages/core/src/session/` (`store.ts`, `sql.ts`, `input.ts`, `context-epoch.ts`). |
| **Context Overflow Recovery** | `ALREADY_EXISTS` | `SessionCompaction.compactAfterOverflow` and `isContextOverflowFailure` in `packages/core/src/session/runner/llm.ts`. |
| **Explicit Steer vs Queue Input** | `ALREADY_EXISTS` | `SessionInput.promoteSteers` and `SessionInput.promoteNextQueued` in `packages/core/src/session/input.ts`. |
| **Remote Repo Clone Tool** | `ALREADY_EXISTS` | `packages/core/src/tool/clone.ts` and `opencode clone` CLI command. |
| **Working Tree Diff Component** | `ALREADY_EXISTS` | `packages/session-ui/src/v2/components/working-tree-diff-v2.tsx`. |
| **Interactive Plan Transition** | `ALREADY_EXISTS` | `packages/session-ui/src/v2/components/execute-plan-card-v2.tsx`. |
| **Model Variant / Reasoning Effort** | `PARTIALLY_EXISTS` | CLI option `--variant` and `Model.Info.variants` exist in Schema, but provider mappings to Hetzner/Qwen are unmapped. |
| **Subagent Concurrency (`task`)** | `PARTIALLY_EXISTS` | `task.ts` tool launches child sessions, but lacks write-set isolation, git worktrees, and merge synchronization. |
| **Snapshot & File Mutation Tracking**| `PARTIALLY_EXISTS` | `Snapshot.capture()` records filesystem state before/after turns in `llm.ts`, but diff statistics are not gated. |
| **Deterministic Verification Gate** | `MISSING` | No automated test/lint gate prior to session completion; completion is dictated solely by model settling to `idle`. |
| **Finite State Machine (FSM)** | `MISSING` | No explicit orchestrator state transitions (`UNDERSTAND` -> `EXPLORE` -> `PLAN` -> `EXECUTE` -> `VERIFY`). |
| **Loop & Oscillation Detection** | `MISSING` | No detection for repeated commands, oscillating edits, or recurring hypothesis failures. |
| **Soft Change Budget Engine** | `MISSING` | No tracking or enforcement of file touch limits (`files_changed`, `lines_added`, `lines_deleted`). |
| **Structured Output Normalization** | `MISSING` | Raw command outputs are piped directly into LLM messages without semantic compression/filtering. |
| **Failure Taxonomy & Smart Retry** | `MISSING` | Errors result in raw tool failure strings with no deterministic error classification or structured retry bounds. |
| **Agy/Gemini Supervisor Bridge** | `MISSING` | No external supervisor protocol to monitor Qwen event stream, enforce budgets, or trigger replanning. |
| **Heavy Knowledge Graph (.repo)** | `NOT_NEEDED` | Static indexing / graph parsing is heavy and unnecessary for Phase 1; lightweight file caches suffice. |
| **Multi-Agent Debate / Swarms** | `NOT_NEEDED` | Explicit non-goal per Master Design section 34. |

---

## 6. Audit Conclusion

OpenCode possesses a mature, high-performance V2 session substrate with durable SQLite persistence, Unix socket IPC, robust permission checks, and headless JSON streaming. However, the reasoning and execution flow is completely unguided: Qwen is given full autonomy without verification gates, change budgets, loop detection, or structured failure classification. The harness must supply the supervisory harness around this engine without altering the underlying protocol or database schema.
