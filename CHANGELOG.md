# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Calendar Versioning](https://calver.org/) (`vYY.MM.DD.N`).

## [v26.08.31.15668] - 2026-08-31

### Added
- **Attach Command Harness Option**: Added `--harness` option to `opencode attach` so sessions attached remotely inherit autonomous harness tracking.

### Fixed
- **Tailscale Zero-Auth Headless Server**: Updated `opencode serve` to use `resolveHostConfig` and detect active Tailscale Serve endpoints, running in passwordless mode over the tailnet WireGuard boundary without generating unsolicited random passwords.
- **TUI Continue Graceful Fallback**: Removed dummy session ID placeholder during initial route initialization when using `-c` / `--continue`. When resuming in a project directory without prior sessions, the TUI now gracefully falls back to starting a fresh new session instead of throwing `Expected a string starting with "ses", got "dummy"`.

## [v26.08.31.15667] - 2026-08-31

### Fixed
- **Directory Picker Multi-Level Browsing & Navigation**: Enabled cascading preloading of subdirectories, automatic expansion and loading on folder row selection/tap, and double-click navigation into folders in the Add/Open Project dialog (`DialogSelectDirectoryV2`).

## [v26.08.31.15666] - 2026-08-31

### Added
- **QR Code Project & Session Route Encoding**: Encoded the active working directory and session ID into the QR pairing URL so scanning with a phone camera directly opens the matching project and session in the PWA / Web UI.

## [v26.08.31.15665] - 2026-08-31

### Fixed
- **Prompt Input CSS Artifact**: Removed erroneous `empty:before:content-['\\200B']` pseudo-element rule from Session UI prompt input editor (`packages/session-ui/src/v2/components/prompt-input/index.tsx`), eliminating visible literal `\200B` text artifact in PWA.

## [v26.08.31.15664] - 2026-08-31

### Changed
- **Repository Issue Tracking Links**: Updated TUI crash report generator and desktop menu feedback/bug report URLs to point to fork issue tracker (`ollisulopuisto/opencode`).

## [v26.08.31.15663] - 2026-08-31

### Fixed
- **Harness Verification Gates Null Safety**: Made verification gate presenters and TUI/Web components defensively handle missing or undefined task states and properties, resolving TUI crash on evaluating `tier0`.

## [v26.08.31.15662] - 2026-08-31

### Fixed
- **Host TUI Terminal Noise Suppression**: Safely suppressed unhandled promise rejections on the hosting server process during interactive TUI execution in `opencode host`, preventing ANSI error output from leaking to stderr and corrupting the terminal prompt textarea.
- **Host Command Harness Option Forwarding**: Forwarded `--harness` CLI argument from `opencode host` into the interactive and mini session options.

## [v26.08.30.15661] - 2026-08-30

### Added
- **Native Harness UI & TUI Presentation Integration** (`HARNESS_V6_MASTER_PLAN.md`):
  - Core UI presentation engine (`@opencode-ai/core/harness/ui-presenter.ts`) with deterministic gate status formatting, DAG work-unit progress calculation, change budget enforcement, and conventional CalVer commit drafting.
  - TUI Harness widgets (`packages/tui/src/component/harness/`): `HarnessPanel` sidebar widget, `HarnessBadge` footer status indicator, and `DialogHarness` modal inspection view.
  - `/harness` slash command registered in OpenCode TUI command palette for instant governance inspection.
  - Web GUI & PWA Inspector panel (`packages/app/src/components/harness-inspector-panel.tsx`) featuring expandable test failure diagnostic callouts, change budget meters, and one-click conventional commit actions.
- **Master Plan & AGY Control Directives** (`HARNESS_V6_MASTER_PLAN.md`): Documented phased roadmap, keybinding directives (`/harness`, `Ctrl+H`, `Ctrl+E`), and Red-Green TDD verification standards.

### Fixed
- **Mobile PWA Double-Encoding Bug**: Resolved query parameter double encoding in `packages/sdk/js/src/v2/client.ts` and `packages/server/src/location.ts` that caused 500 crashes and `FileSystem.realPath` lookup failures on remote PWA clients.
- **Reasoning Model Loop Sensitivity**: Added per-turn loop detector reset and increased read-only inspection tolerance to prevent false-positive Step-2 aborts on long-thinking reasoning models.
- **Monorepo Test Guard Compatibility**: Updated `VerifierPolicy` to execute package-scoped test runs (`bun test --cwd packages/opencode`) avoiding root guard blocks.

## [v26.08.30.15638] - 2026-08-30

### Fixed
- Fixed `serve --socket` silently continuing with a dead unix socket bridge: the bridge now waits for its `listening` event, fails `Server.listen` on socket errors, releases the TCP listener, and removes the socket file instead of leaving a path that refuses connections.
- Fixed `attach` dying with "Was there a typo in the url or port?" when `/tmp/opencode.sock` existed but nothing accepted on it: attach now probe-connects the default socket, warns, and falls back to `http://127.0.0.1:8090`.

### Added
- Added socket bridge regression tests (`packages/opencode/test/server/socket-bridge.test.ts`) and attach target resolution tests (`packages/opencode/test/cli/attach-target.test.ts`).

## [v26.08.30.15637] - 2026-08-30

### Added
- **Remote PWA & Host Collaboration Core** (`patches/upstream/08-feat-remote-pwa-host-and-mobile-enhancements.patch`):
  - `opencode host` CLI command sharing unified server state across terminal TUI and browser/PWA clients.
  - Tailscale HTTPS / Serve loopback binding and automated QR code pairing for remote mobile access.
  - Interactive Mermaid markdown rendering with touch pinch-zoom support on mobile devices.
  - Streaming-safe append-only text tail preserving selection states during real-time model output streaming.
  - Hierarchical slash-command popover grouping custom and built-in commands.
  - Safe server file view endpoints (`/vcs/file-view`) with path containment validation against symlink breakouts.

### Fixed
- **GitHub Actions Node 24 Runtime Compliance**: Configured `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true` in workflow environment variables across `.github/workflows/publish.yml`, `.github/workflows/typecheck.yml`, and `.github/workflows/release.yml` to prevent Node.js 20 deprecation warnings.
- **Strict Lint Compliance**: Escaped CSS zero-width space unicode character in prompt input component class name (`prompt-input/index.tsx`) and removed redundant non-null assertion in e2e timeline transport test (`session-timeline-transport.spec.ts`), achieving 0 errors across 3,406 files in `oxlint`.

## [v26.08.30.15636] - 2026-08-30

### Added
- **Native OpenCode Harness V6.0 Architecture** (`MASTER_DESIGN_V6.0.md`, `EXECUTION_PLAYBOOK_V6.0.md`): Integrated in-process execution core eliminating external subprocess spawning and hardcoded CLI sidecar dependencies.
- **First-Class SystemContext Task State Source** (`@opencode-ai/core/system-context/task-state`): Native `ContextSource<TaskState>` implementation with Schema JSON codec, baseline renderer, and chronological `Mid-Conversation System Message` updates across compaction epochs.
- **Monorepo-Integrated Harness Governance Core** (`@opencode-ai/core/harness`):
  - Deterministic 4-Tier Verification Gate (`verifier.ts`, `verifier-policy.ts`) with static typechecks, scoped test mapping, full workspace regression, and anti-evasion diff audit.
  - Real-Time Step-2 Loop & Oscillation Detector (`loop-detector.ts`) intercepting identical tool calls, reverting edits, and repeating error states.
  - Strict Change Budget & Write-Set Guard (`budget.ts`).
  - Task Complexity Classifier (`classifier.ts`) and DAG Plan Validator (`plan-validator.ts`).
  - Failure Taxonomy & Structured Recovery Protocol Engine (`failure.ts`).
  - Tool Output Normalizer & Disk Log Spill (`normalizer.ts`).
  - Long-Term Project Memory (`project-memory.ts`) and Git Lifecycle Engine (`git-lifecycle.ts`).
  - Self-Contained Dynamic Model Router (`model-router.ts`) for multi-lane role routing and fallback cascading.
- **Full 60-Task Benchmark Matrix Evaluation** (`opencode-harness-audit/benchmark-60-results.md`): 95.0% verified completion rate (57/60 tasks), 83.3% first-pass rate, 0 change budget violations, and 14 loop halts prevented.

## [v26.08.30.15635] - 2026-08-30

### Added
- Interactive Workspace Onboarding Wizard & Initialization Engine (`onboarding.ts`): Autonomous environment & test discovery, interactive economic ROI preference selection (`flat_fee_first`, `balanced`, `performance_first`), multi-tier test gate setup, project memory seeding, and CLI command `opencode harness init` / `--init`.
- Automated Model Cost-Benefit & ROI Analysis Engine (`model-roi.ts`): Near-automatic provider discovery (`auth.json` / env), economic tier modeling (flat-fee vs metered pay-as-you-go), customizable ROI policies (`flat_fee_first`, `balanced`, `performance_first`, `lowest_cost`), role assignment mapper, and CLI inspection (`opencode harness --roi`).
- Phase 9 Performance & Runtime Acceleration Engine (`cache-engine.ts`, `process-pool.ts`): Mtime-invalidated repository dependency cache, bounded subprocess resource pooling with execution timeouts, and multi-tier test fast-failing.
- Phase 10 Git Lifecycle & Release Engine (`git-lifecycle.ts`): Autonomous Conventional Commit synthesis, CalVer tracking, structured Pull Request generation with verification evidence, and ephemeral worktree cleanup.
- Phase 8 Model-Pool & Reasoning Optimization (`reasoning-tuner.ts`, `prompt-adapter.ts`): Adaptive reasoning effort calculation (low/medium/high/highest) by task complexity and failure recovery depth, with model-family instruction framing.
- Long-Term Project Memory & Repository Intelligence Engine (`project-memory.ts`): Persistent workspace indexing, conventions extraction, learned rules, architectural risk warnings, and cross-task memory feedback loop.
- Built-in `opencode harness [objective]` top-level CLI command (`@opencode-ai/opencode/cli/cmd/harness`) supporting autonomous execution, DAG planning, verification gates, and `--smoke` / `--bench` flags.
- Concurrent Full 60-Task Benchmark Matrix runner (`full-benchmark-runner.ts`) with configurable multi-worker concurrency and automated markdown reporting.
- Executed and validated the complete 6-Task Canonical Smoke Benchmark Suite (`smoke-runner.ts`) across all categories (`bugfix`, `feature`, `refactor`, `debugging`, `multifile`, `unfamiliar`) with a 100% verified pass rate (6/6 tasks) using `opencode-go/glm-5.3-flash`.

### Fixed
- Fixed environment credential inheritance in headless subprocess runner to preserve system `~/.local/share/opencode/auth.json` provider keys.
- Enhanced `LoopDetector` and subprocess runner with stable tool call ID tracking and event deduplication for real-time streaming tool executions.
- Fixed QR pairing URL to prefer Tailscale MagicDNS hostname over raw IP and encode basic auth credentials into `auth_token` query parameter to prevent mobile browsers from stripping credentials during scan.
- Fixed ghost client count accumulation in `WebSocketTracker` by tracking per-client `lastSeen` timestamps on frame arrival and sweeping connections silent > 45s with code 1000.

### Added
- Added secure file viewing endpoint `GET /api/file` (`serveFileView`) enforcing path resolution, symlink containment within sanctioned roots, binary NUL-byte rejection, and 128 KB payload truncation.
- Added remote PWA pure helpers (`remote-pwa.ts`) for device count formatting (`peerNotice`), stale connection checks (`socketIsStale`), transcript file reference parsing (`parseFileRefs`), Mermaid language detection (`isMermaidLang`), pinch-zoom scaling (`clampZoom`), double-tap detection (`isDoubleTap`), and envelope parsing (`parseEnvelope`).
- Added unit test suite in `packages/opencode/test/util/remote-pwa.test.ts`.

## [v26.08.30.15634] - 2026-08-30

### Fixed
- Removed raw `console.error` in server HTTP defect middleware that leaked unformatted defect stacks to stderr and disrupted the interactive TUI display.
- Fixed `GlobalHttpApi.upgrade` handler return format to return plain typed response payloads.
- Updated session runner test assertions to match sorted tool definitions.

## [v26.08.30.15633] - 2026-08-30

### Fixed
- Resolved circular layer dependency defect between `LocationServiceMap` and `SessionExecution` by decoupling `DelegateTool` layer construction from `SessionExecution.node` and injecting runtime execution dynamically during tool execution and runner drains.
- Cleaned up `buildLocationServiceMap()` in server routes and core exports.

## [v26.08.30.15614] - 2026-08-30

### Added
- Pre-configured MCP presets catalog (`@opencode-ai/core/mcp/presets`) and `opencode mcp preset` CLI installer for Todoist, Gmail, Puppeteer, PostgreSQL, and GitHub.
- Mobile Web UI remote repository cloning modal (`DialogCloneRepoV2`).
- One-tap "Execute Plan" card (`ExecutePlanCardV2`) for seamless Plan-to-Build agent transitions.
- Working-tree visual diff component (`WorkingTreeDiffV2`) displaying full-repo changes and diffstats.
- Remote Repo Spawning via built-in `repo_clone` tool (`@opencode-ai/core/tool/clone`) and `opencode clone <repo> [prompt]` CLI command.
- Built-in `git_diff` tool (`@opencode-ai/core/tool/git-diff`) to inspect working-tree changes, unified diffs, and diffstats.
- Ping-Pong Loop Guard in `delegate` tool preventing runaway agent loops (>10 autonomous delegations without human input).
- User Presence Suppression in `ntfy` module (skips push alerts when user is actively typing/working at their machine).
- Terminal QR code pairing and Tailscale auto-detection (`qr.ts`), encoding credentials into camera-scannable QR for instant PWA onboarding.
- Enforced mandatory password protection on HTTP server (`serve.ts`), auto-generating a secure random password when `OPENCODE_SERVER_PASSWORD` is unconfigured.
- Built-in `opencode update` CLI command to pull latest git commits, rebuild binary, and restart the background daemon.
- Built-in `delegate` tool (`@opencode-ai/core/tool/delegate`) enabling OpenCode agents to send messages, delegate tasks across sessions, and orchestrate subagent execution.
- Headless YOLO mode via `OPENCODE_AUTO_ACCEPT=1` / `OPENCODE_YOLO=1` flag in `PermissionV2` for unattended background runs.
- Lightweight zero-dependency `ntfy` webhook notifications module (`@opencode-ai/core/notify/ntfy`) wired to session completion in LLM runner.
- Unix domain socket server and client transport support (`--socket <path>`).
- `--debug` / `-d` CLI option to gate verbose trace logging across client and server.
- Apple Silicon Metal MLX local provider sidecar integration (`@opencode-ai/core/plugin/provider/mlx`).
- Dynamic Tree-sitter WASM grammar lazy loader in TUI to reduce startup memory footprint.

### Fixed
- Fixed directory resolution when attaching over Unix domain sockets or network to preserve caller working directory (`process.env.OPENCODE_CALLER_DIR` / `process.env.OLDPWD`).
- Fixed double URL-encoding issue in SDK request interceptor when rewriting `x-opencode-directory` header to query parameters.
- Fixed server workspace routing middleware to recursively decode percent-encoded directory paths.
- Fixed `TuiPathsProvider` and TUI data context to initialize with client directory rather than root process directory.
- Fixed diff memory consumption by switching from full-file context to compact delta snapshots (`context: 4`).

### Changed
- Tightened default LSP server inactivity timeout from 5m to 2m (`120_000ms`) for aggressive process and RAM reclamation.
- Implemented Slotted Tool Output Collapsing for historical turns older than 2 turns (`to-llm-message.ts`) to reduce working context tokens and cut memory allocations.
- Implemented Head/Tail Subprocess Ring Buffer for shell executions (`bash.ts`), bounding verbose output while preserving initial invocation and exit errors.
- Sorted tool definitions deterministically in LLM runner (`llm.ts`) for maximum prompt cache hit rate across turns.
- Configured high-performance SQLite WAL pragmas (`synchronous=NORMAL`, `wal_autocheckpoint=1000`, `mmap_size=256MB`, `temp_store=MEMORY`) to bound WAL growth and enable zero-copy memory-mapped reads.
- Enabled JavaScriptCore bytecode compilation (`bytecode: true`) and minification in binary bundler.
- Added `--smol` flag to binary runtime configuration for aggressive heap compaction.
