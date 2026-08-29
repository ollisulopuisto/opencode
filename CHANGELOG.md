# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Calendar Versioning](https://calver.org/) (`vYY.MM.DD.N`).

## [v26.08.30.15614] - 2026-08-30

### Added
- Built-in `delegate` tool (`@opencode-ai/core/tool/delegate`) enabling OpenCode agents to send messages, delegate tasks across sessions, and orchestrate subagent execution.
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
- Implemented Slotted Tool Output Collapsing for historical turns older than 2 turns (`to-llm-message.ts`) to reduce working context tokens and cut memory allocations.
- Implemented Head/Tail Subprocess Ring Buffer for shell executions (`bash.ts`), bounding verbose output while preserving initial invocation and exit errors.
- Sorted tool definitions deterministically in LLM runner (`llm.ts`) for maximum prompt cache hit rate across turns.
- Configured high-performance SQLite WAL pragmas (`synchronous=NORMAL`, `wal_autocheckpoint=1000`, `mmap_size=256MB`, `temp_store=MEMORY`) to bound WAL growth and enable zero-copy memory-mapped reads.
- Enabled JavaScriptCore bytecode compilation (`bytecode: true`) and minification in binary bundler.
- Added `--smol` flag to binary runtime configuration for aggressive heap compaction.
