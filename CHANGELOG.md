# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Calendar Versioning](https://calver.org/) (`vYY.MM.DD.N`).

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
