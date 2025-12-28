<div align="center">

[![npm version](https://img.shields.io/npm/v/@qwen-code/qwen-code.svg)](https://www.npmjs.com/package/@qwen-code/qwen-code)
<a href="https://deepwiki.com/QwenLM/qwen-code"><img src="https://devin.ai/assets/deepwiki-badge.png" alt="Ask DeepWiki.com" style="height:20px;"></a>

**An open-source AI agent that lives in your terminal.**

<a href="https://qwenlm.github.io/qwen-code-docs/zh/users/overview">中文</a>

</div>

Qwen Code is an open-source AI agent for the terminal. It helps you understand large codebases, automate tedious work, and ship faster.

![](./assets/qwen_code.png)

## Why Qwen Code?

- **OpenAI-compatible, OAuth free tier**: use an OpenAI-compatible API, or sign in with Qwen OAuth to get 2,000 free requests/day.
- **Open-source, co-evolving**: both the framework and the Qwen3-Coder model are open-source—and they ship and evolve together.
- **Agentic workflow, feature-rich**: rich built-in tools (Skills, SubAgents, Plan Mode) for a full agentic workflow and a Claude Code-like experience.
- **Terminal-first, IDE-friendly**: built for developers who live in the command line, with optional integration for VS Code and Zed.

## Installation

#### Prerequisites

```bash
# Node.js 20+
curl -qL https://www.npmjs.com/install.sh | sh
```

#### NPM (recommended)

```bash
npm install -g @qwen-code/qwen-code@latest
qwen --version
```

#### Install from source

```bash
git clone git@github.com:yanfeng98/fork-qwen-code.git
cd fork-qwen-code
npm install
npm install -g .

# install in development mode
npm run build
npm run start
```

## Quick Start

```bash
# Start Qwen Code (interactive)
qwen

# Then, in the session:
/help
/auth
```

On first use, you'll be prompted to sign in. You can run `/auth` anytime to switch authentication methods.

Example prompts:

```text
What does this project do?
Explain the codebase structure.
Help me refactor this function.
Generate unit tests for this module.
```

## Authentication

Qwen Code supports two authentication methods:

- **Qwen OAuth (recommended & free)**: sign in with your `qwen.ai` account in a browser.
- **OpenAI-compatible API**: use `OPENAI_API_KEY` (and optionally a custom base URL / model).

#### Qwen OAuth (recommended)

Start `qwen`, then run:

```bash
/auth
```

Choose **Qwen OAuth** and complete the browser flow.

#### OpenAI-compatible API (API key)

Environment variables (recommended for CI / headless environments):

```bash
export OPENAI_API_KEY="your-api-key-here"
export OPENAI_BASE_URL="https://api.openai.com/v1"  # optional
export OPENAI_MODEL="gpt-4o"                        # optional
```

For details (including `.qwen/.env` loading and security notes), see the [authentication guide](https://qwenlm.github.io/qwen-code-docs/en/users/configuration/auth/).

## Usage

As an open-source terminal agent, you can use Qwen Code in four primary ways:

1. Interactive mode (terminal UI)
2. Headless mode (scripts, CI)
3. IDE integration (VS Code, Zed)
4. TypeScript SDK

#### Interactive mode

```bash
cd your-project/
qwen
```

Run `qwen` in your project folder to launch the interactive terminal UI. Use `@` to reference local files (for example `@src/main.ts`).

#### Headless mode

```bash
cd your-project/
qwen -p "your question"
```

Use `-p` to run Qwen Code without the interactive UI—ideal for scripts, automation, and CI/CD. Learn more: [Headless mode](https://qwenlm.github.io/qwen-code-docs/en/users/features/headless).

#### IDE integration

Use Qwen Code inside your editor (VS Code and Zed):

- [Use in VS Code](https://qwenlm.github.io/qwen-code-docs/en/users/integration-vscode/)
- [Use in Zed](https://qwenlm.github.io/qwen-code-docs/en/users/integration-zed/)

#### TypeScript SDK

Build on top of Qwen Code with the TypeScript SDK:

- [Use the Qwen Code SDK](./packages/sdk-typescript/README.md)

## Commands & Shortcuts

### Session Commands

- `/help` - Display available commands
- `/clear` - Clear conversation history
- `/compress` - Compress history to save tokens
- `/stats` - Show current session information
- `/bug` - Submit a bug report
- `/exit` or `/quit` - Exit Qwen Code

### Keyboard Shortcuts

- `Ctrl+C` - Cancel current operation
- `Ctrl+D` - Exit (on empty line)
- `Up/Down` - Navigate command history

> Learn more about [Commands](https://qwenlm.github.io/qwen-code-docs/en/users/features/commands/)
>
> **Tip**: In YOLO mode (`--yolo`), vision switching happens automatically without prompts when images are detected. Learn more about [Approval Mode](https://qwenlm.github.io/qwen-code-docs/en/users/features/approval-mode/)

## Configuration

Qwen Code can be configured via `settings.json`, environment variables, and CLI flags.

- **User settings**: `~/.qwen/settings.json`
- **Project settings**: `.qwen/settings.json`

See [settings](https://qwenlm.github.io/qwen-code-docs/en/users/configuration/settings/) for available options and precedence.

## Ecosystem

Looking for a graphical interface?

- [**Gemini CLI Desktop**](https://github.com/Piebald-AI/gemini-cli-desktop) A cross-platform desktop/web/mobile UI for Qwen Code
