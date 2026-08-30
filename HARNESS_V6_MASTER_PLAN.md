# OpenCode Harness V6.0 — Master Plan & AGY Control Architecture

**Document Version:** 6.0.0  
**Updated:** 2026-08-30  
**Target:** Full Native Blend of Autonomous Harness Governance & Interactive Sessions across TUI, Web GUI / PWA, and CLI.

---

## 1. Executive Overview

OpenCode Harness V6.0 unifies autonomous multi-tier test verification, DAG plan execution, loop/anomaly guards, and change budgets with OpenCode's native interactive sessions (TUI, Web PWA, Desktop). 

### Core Architectural Pillars
1. **Ambient System Context**: Real-time task state and hypothesis tracking streamed into model turns via `TaskStateGuidance` (`<task_state>` and `<task_state_update>`).
2. **Deterministic Multi-Tier Verification**:
   - **Tier 0**: Static analysis, typechecking, and linting.
   - **Tier 1**: Targeted test suites mapped to modified files.
   - **Tier 2**: Workspace-wide regression suites.
3. **Change Budget & Anomaly Prevention**:
   - Write-set whitelists and line/file count limits.
   - Step-scoped anomaly detector with read-only heuristics and oscillating edit prevention.
4. **Interactive AGY Control**:
   - Live TUI status badge & sidebar panel.
   - `/harness` command and `Ctrl+H` diagnostic inspection modal.
   - Web GUI / PWA Inspector card with one-click CalVer conventional commit drafting.

---

## 2. Phased Implementation Roadmap

### Phase 1: Presentation & Presentation Layer (Completed)
- [x] Implement `packages/core/src/harness/ui-presenter.ts` with pure presenter functions.
- [x] Red-Green unit tests in `packages/core/test/harness/ui-presenter.test.ts`.
- [x] Export presenter from `@opencode-ai/core/harness`.

### Phase 2: TUI Live Embedding & Command Palette (Current Focus)
- [x] Create `packages/tui/src/component/harness/harness-panel.tsx`.
- [x] Create `packages/tui/src/component/harness/harness-badge.tsx`.
- [ ] Create `packages/tui/src/component/harness/dialog-harness.tsx` for modal inspection.
- [ ] Wire `HarnessBadge` into `packages/tui/src/routes/session/footer.tsx`.
- [ ] Wire `HarnessPanel` into `packages/tui/src/routes/session/sidebar.tsx`.
- [ ] Register `/harness` command and keybinding `Ctrl+H` / `Cmd+H`.
- [ ] Red-Green TUI unit and component tests.

### Phase 3: Web GUI & Mobile PWA Integration
- [x] Implement `packages/app/src/components/harness-inspector-panel.tsx`.
- [x] Unit test `packages/app/src/components/harness-inspector-panel.test.ts`.
- [ ] Embed `HarnessInspectorPanel` in session right-panel/drawer in Web PWA.
- [ ] One-click CalVer commit integration triggering Git commit actions.

### Phase 4: Full In-Process Verification & Benchmarking
- [ ] In-process runner bridging SDK V2 with verification gates.
- [ ] Execute 60-task benchmark matrix (`bun run packages/opencode/src/index.ts harness bench`).
- [ ] Record results in `opencode-harness-audit/benchmark-60-results.md`.

---

## 3. AGY Control Directives & Protocols

### Keybindings & Commands
| Context | Trigger | Action |
| :--- | :--- | :--- |
| **TUI Footer** | `[Harness: ✓ Verified]` | Shows live gate pass/fail summary |
| **TUI Command** | `/harness` | Opens the full Harness Inspection Dialog |
| **TUI Shortcut** | `Ctrl+H` / `Cmd+H` | Toggles the Harness Inspector Modal |
| **TUI Escalation**| `Ctrl+E` | Triggers immediate supervisory model tier shift |
| **Web PWA** | Inspector Tab | Expands live verification cards & test failure diffs |

### Verification Protocol Checklist
Before committing any changes:
1. Red-Green unit tests must exist for all presentation & UI components.
2. `bun turbo typecheck` must complete with 0 errors across all 30 packages.
3. Tests must be executed from package directories (e.g. `packages/tui`, `packages/core`).
4. CalVer commit message must be synthesized adhering to `type(scope): summary`.
