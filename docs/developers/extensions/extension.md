# Qwen Code Extensions

Qwen Code extensions package prompts, MCP servers, and custom commands into a familiar and user-friendly format. With extensions, you can expand the capabilities of Qwen Code and share those capabilities with others. They are designed to be easily installable and shareable.

## Extension management

We offer a suite of extension management tools using both `qwen extensions` CLI commands and `/extensions` slash commands within the interactive CLI.

### Runtime Extension Management (Slash Commands)

You can manage extensions at runtime within the interactive CLI using `/extensions` slash commands. These commands support hot-reloading, meaning changes take effect immediately without restarting the application.

| Command                                                | Description                                                     |
| ------------------------------------------------------ | --------------------------------------------------------------- |
| `/extensions` or `/extensions list`                    | List all installed extensions with their status                 |
| `/extensions install <source>`                         | Install an extension from a git URL, local path, or marketplace |
| `/extensions uninstall <name>`                         | Uninstall an extension                                          |
| `/extensions enable <name> --scope <user\|workspace>`  | Enable an extension                                             |
| `/extensions disable <name> --scope <user\|workspace>` | Disable an extension                                            |
| `/extensions update <name>`                            | Update a specific extension                                     |
| `/extensions update --all`                             | Update all extensions with available updates                    |

### CLI Extension Management

You can also manage extensions using `qwen extensions` CLI commands. Note that changes made via CLI commands will be reflected in active CLI sessions on restart.

### Installing an extension

You can install an extension using `qwen extensions install` with either a GitHub URL or a local path`.

Note that we create a copy of the installed extension, so you will need to run `qwen extensions update` to pull in changes from both locally-defined extensions and those on GitHub.

```
qwen extensions install https://github.com/qwen-cli-extensions/security
```

This will install the Qwen Code Security extension, which offers support for a `/security:analyze` command.

### Uninstalling an extension

To uninstall, run `qwen extensions uninstall extension-name`, so, in the case of the install example:

```
qwen extensions uninstall qwen-cli-security
```

### Disabling an extension

Extensions are, by default, enabled across all workspaces. You can disable an extension entirely or for specific workspace.

For example, `qwen extensions disable extension-name` will disable the extension at the user level, so it will be disabled everywhere. `qwen extensions disable extension-name --scope=workspace` will only disable the extension in the current workspace.

### Enabling an extension

You can enable extensions using `qwen extensions enable extension-name`. You can also enable an extension for a specific workspace using `qwen extensions enable extension-name --scope=workspace` from within that workspace.

This is useful if you have an extension disabled at the top-level and only enabled in specific places.

### Updating an extension

For extensions installed from a local path or a git repository, you can explicitly update to the latest version (as reflected in the `qwen-extension.json` `version` field) with `qwen extensions update extension-name`.

You can update all extensions with:

```
qwen extensions update --all
```

## Extension creation

We offer commands to make extension development easier.

### Create a boilerplate extension

We offer several example extensions `context`, `custom-commands`, `exclude-tools` and `mcp-server`. You can view these examples [here](https://github.com/QwenLM/qwen-code/tree/main/packages/cli/src/commands/extensions/examples).

To copy one of these examples into a development directory using the type of your choosing, run:

```
qwen extensions new path/to/directory custom-commands
```

### Link a local extension

The `qwen extensions link` command will create a symbolic link from the extension installation directory to the development path.

This is useful so you don't have to run `qwen extensions update` every time you make changes you'd like to test.

```
qwen extensions link path/to/directory
```

## How it works

On startup, Qwen Code looks for extensions in `<home>/.qwen/extensions`

Extensions exist as a directory that contains a `qwen-extension.json` file. For example:

`<home>/.qwen/extensions/my-extension/qwen-extension.json`

### `qwen-extension.json`

The `qwen-extension.json` file contains the configuration for the extension. The file has the following structure:

```json
{
  "name": "my-extension",
  "version": "1.0.0",
  "mcpServers": {
    "my-server": {
      "command": "node my-server.js"
    }
  },
  "contextFileName": "QWEN.md",
  "commands": "commands",
  "skills": "skills",
  "agents": "agents",
  "settings": [
    {
      "name": "API Key",
      "description": "Your API key for the service",
      "envVar": "MY_API_KEY",
      "sensitive": true
    }
  ]
}
```

- `name`: The name of the extension. This is used to uniquely identify the extension and for conflict resolution when extension commands have the same name as user or project commands. The name should be lowercase or numbers and use dashes instead of underscores or spaces. This is how users will refer to your extension in the CLI. Note that we expect this name to match the extension directory name.
- `version`: The version of the extension.
- `mcpServers`: A map of MCP servers to configure. The key is the name of the server, and the value is the server configuration. These servers will be loaded on startup just like MCP servers configured in a [`settings.json` file](./cli/configuration.md). If both an extension and a `settings.json` file configure an MCP server with the same name, the server defined in the `settings.json` file takes precedence.
  - Note that all MCP server configuration options are supported except for `trust`.
- `contextFileName`: The name of the file that contains the context for the extension. This will be used to load the context from the extension directory. If this property is not used but a `QWEN.md` file is present in your extension directory, then that file will be loaded.
- `commands`: The directory containing custom commands (default: `commands`). Commands are `.md` files that define prompts.
- `skills`: The directory containing custom skills (default: `skills`). Skills are discovered automatically and become available via the `/skills` command.
- `agents`: The directory containing custom subagents (default: `agents`). Subagents are `.yaml` or `.md` files that define specialized AI assistants.
- `settings`: An array of settings that the extension requires. When installing, users will be prompted to provide values for these settings. The values are stored securely and passed to MCP servers as environment variables.

When Qwen Code starts, it loads all the extensions and merges their configurations. If there are any conflicts, the workspace configuration takes precedence.

### Custom commands

Extensions can provide [custom commands](./cli/commands.md#custom-commands) by placing Markdown files in a `commands/` subdirectory within the extension directory. These commands follow the same format as user and project custom commands and use standard naming conventions.

> **Note:** The command format has been updated from TOML to Markdown. TOML files are deprecated but still supported. You can migrate existing TOML commands using the automatic migration prompt that appears when TOML files are detected.

**Example**

An extension named `gcp` with the following structure:

```
.qwen/extensions/gcp/
├── qwen-extension.json
└── commands/
    ├── deploy.md
    └── gcs/
        └── sync.md
```

Would provide these commands:

- `/deploy` - Shows as `[gcp] Custom command from deploy.md` in help
- `/gcs:sync` - Shows as `[gcp] Custom command from sync.md` in help

### Custom skills

Extensions can provide custom skills by placing skill files in a `skills/` subdirectory within the extension directory. Each skill should have a `SKILL.md` file with YAML frontmatter defining the skill's name and description.

**Example**

```
.qwen/extensions/my-extension/
├── qwen-extension.json
└── skills/
    └── pdf-processor/
        └── SKILL.md
```

The skill will be available via the `/skills` command when the extension is active.

### Custom subagents

Extensions can provide custom subagents by placing agent configuration files in an `agents/` subdirectory within the extension directory. Agents are defined using YAML or Markdown files.

**Example**

```
.qwen/extensions/my-extension/
├── qwen-extension.json
└── agents/
    └── testing-expert.yaml
```

Extension subagents appear in the subagent manager dialog under "Extension Agents" section.

### Conflict resolution

Extension commands have the lowest precedence. When a conflict occurs with user or project commands:

1. **No conflict**: Extension command uses its natural name (e.g., `/deploy`)
2. **With conflict**: Extension command is renamed with the extension prefix (e.g., `/gcp.deploy`)

For example, if both a user and the `gcp` extension define a `deploy` command:

- `/deploy` - Executes the user's deploy command
- `/gcp.deploy` - Executes the extension's deploy command (marked with `[gcp]` tag)

## Variables

Qwen Code extensions allow variable substitution in `qwen-extension.json`. This can be useful if e.g., you need the current directory to run an MCP server using `"cwd": "${extensionPath}${/}run.ts"`.

**Supported variables:**

| variable                   | description                                                                                                                                                   |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `${extensionPath}`         | The fully-qualified path of the extension in the user's filesystem e.g., '/Users/username/.qwen/extensions/example-extension'. This will not unwrap symlinks. |
| `${workspacePath}`         | The fully-qualified path of the current workspace.                                                                                                            |
| `${/} or ${pathSeparator}` | The path separator (differs per OS).                                                                                                                          |
