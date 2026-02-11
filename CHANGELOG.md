# Changelog

## 0.0.11

- Added subagents feature with file-based configuration system for specialized AI assistants.
- Added Welcome Back Dialog with project summary and enhanced quit options.
- Fixed performance issues with SharedTokenManager causing 20-minute delays.
- Fixed tool calls UI issues and improved user experience.
- Fixed credential clearing when switching authentication types.
- Enhanced subagent capabilities to use tools requiring user confirmation.
- Improved ReadManyFiles tool with shared line limits across files.
- Re-implemented tokenLimits class for better compatibility with Qwen and other model types.
- Fixed chunk validation to avoid unnecessary retries.
- Resolved EditTool naming inconsistency causing agent confusion loops.
- Fixed unexpected re-authentication when auth-token is expired.
- Added Terminal Bench integration tests.
- Updated multilingual documentation links in README.
- Fixed various Windows compatibility issues.
- Miscellaneous improvements and bug fixes.

## 0.0.9

- Synced upstream `gemini-cli` to v0.1.21.
- Fixed token synchronization among multiple Qwen sessions.
- Improved tool execution with early stop on invalid tool calls.
- Added explicit `is_background` parameter for shell tool.
- Enhanced memory management with sub-commands to switch between project and global memory operations.
- Renamed `GEMINI_DIR` to `QWEN_DIR` for better branding consistency.
- Added support for Qwen Markdown selection.
- Fixed parallel tool usage and improved tool reliability.
- Upgraded integration tests to use Vitest framework.
- Enhanced VS Code IDE integration with launch configurations.
- Added terminal setup command for Shift+Enter and Ctrl+Enter support.
- Fixed GitHub Workflows configuration issues.
- Improved settings directory and command descriptions.
- Fixed locale handling in yargs configuration.
- Added support for `trustedFolders.json` configuration file.
- Enhanced cross-platform compatibility for sandbox build scripts.
- Improved error handling and fixed ambiguous literals.
- Updated documentation links and added IDE integration documentation.
- Miscellaneous improvements and bug fixes.

## 0.0.8

- Synced upstream `gemini-cli` to v0.1.19.
- Updated documentation branding from **Gemini CLI** to **Qwen Code**.
- Added multilingual docs links in `README.md`.
- Added deterministic cache control for the DashScope provider.
- Added option to choose a project-level or global save location.
- Limited `grep` results to 25 items by default.
- `grep` now respects `.qwenignore`.
- Miscellaneous improvements and bug fixes.
