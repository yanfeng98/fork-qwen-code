# Language Server Protocol (LSP) Support

Qwen Code provides native Language Server Protocol (LSP) support, enabling advanced code intelligence features like go-to-definition, find references, diagnostics, and code actions. This integration allows the AI agent to understand your code more deeply and provide more accurate assistance.

## Overview

LSP support in Qwen Code works by connecting to language servers that understand your code. When you work with TypeScript, Python, Go, or other supported languages, Qwen Code can automatically start the appropriate language server and use it to:

- Navigate to symbol definitions
- Find all references to a symbol
- Get hover information (documentation, type info)
- View diagnostic messages (errors, warnings)
- Access code actions (quick fixes, refactorings)
- Analyze call hierarchies

## Quick Start

LSP is enabled by default in Qwen Code. For most common languages, Qwen Code will automatically detect and start the appropriate language server if it's installed on your system.

### Prerequisites

You need to have the language server for your programming language installed:

| Language | Language Server | Install Command |
|----------|----------------|-----------------|
| TypeScript/JavaScript | typescript-language-server | `npm install -g typescript-language-server typescript` |
| Python | pylsp | `pip install python-lsp-server` |
| Go | gopls | `go install golang.org/x/tools/gopls@latest` |
| Rust | rust-analyzer | [Installation guide](https://rust-analyzer.github.io/manual.html#installation) |

## Configuration

### Settings

You can configure LSP behavior in your `settings.json`:

```json
{
  "lsp": {
    "enabled": true,
    "autoDetect": true,
    "serverTimeout": 10000,
    "allowed": [],
    "excluded": []
  }
}
```

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `lsp.enabled` | boolean | `true` | Enable/disable LSP support |
| `lsp.autoDetect` | boolean | `true` | Automatically detect and start language servers |
| `lsp.serverTimeout` | number | `10000` | Server startup timeout in milliseconds |
| `lsp.allowed` | string[] | `[]` | Allow only these servers (empty = allow all) |
| `lsp.excluded` | string[] | `[]` | Exclude these servers from starting |

### Custom Language Servers

You can configure custom language servers using a `.lsp.json` file in your project root:

```json
{
  "languageServers": {
    "my-custom-lsp": {
      "languages": ["mylang"],
      "command": "my-lsp-server",
      "args": ["--stdio"],
      "transport": "stdio",
      "initializationOptions": {},
      "settings": {}
    }
  }
}
```

#### Configuration Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `languages` | string[] | Yes | Languages this server handles |
| `command` | string | Yes* | Command to start the server |
| `args` | string[] | No | Command line arguments |
| `transport` | string | No | Transport type: `stdio` (default), `tcp`, or `socket` |
| `env` | object | No | Environment variables |
| `initializationOptions` | object | No | LSP initialization options |
| `settings` | object | No | Server settings |
| `workspaceFolder` | string | No | Override workspace folder |
| `startupTimeout` | number | No | Startup timeout in ms |
| `shutdownTimeout` | number | No | Shutdown timeout in ms |
| `restartOnCrash` | boolean | No | Auto-restart on crash |
| `maxRestarts` | number | No | Maximum restart attempts |
| `trustRequired` | boolean | No | Require trusted workspace |

*Required for `stdio` transport

#### TCP/Socket Transport

For servers that use TCP or Unix socket transport:

```json
{
  "languageServers": {
    "remote-lsp": {
      "languages": ["custom"],
      "transport": "tcp",
      "socket": {
        "host": "127.0.0.1",
        "port": 9999
      }
    }
  }
}
```

## Available LSP Operations

Qwen Code exposes LSP functionality through the unified `lsp` tool. Here are the available operations:

### Code Navigation

#### Go to Definition
Find where a symbol is defined.

```
Operation: goToDefinition
Parameters:
  - filePath: Path to the file
  - line: Line number (1-based)
  - character: Column number (1-based)
```

#### Find References
Find all references to a symbol.

```
Operation: findReferences
Parameters:
  - filePath: Path to the file
  - line: Line number (1-based)
  - character: Column number (1-based)
  - includeDeclaration: Include the declaration itself (optional)
```

#### Go to Implementation
Find implementations of an interface or abstract method.

```
Operation: goToImplementation
Parameters:
  - filePath: Path to the file
  - line: Line number (1-based)
  - character: Column number (1-based)
```

### Symbol Information

#### Hover
Get documentation and type information for a symbol.

```
Operation: hover
Parameters:
  - filePath: Path to the file
  - line: Line number (1-based)
  - character: Column number (1-based)
```

#### Document Symbols
Get all symbols in a document.

```
Operation: documentSymbol
Parameters:
  - filePath: Path to the file
```

#### Workspace Symbol Search
Search for symbols across the workspace.

```
Operation: workspaceSymbol
Parameters:
  - query: Search query string
  - limit: Maximum results (optional)
```

### Call Hierarchy

#### Prepare Call Hierarchy
Get the call hierarchy item at a position.

```
Operation: prepareCallHierarchy
Parameters:
  - filePath: Path to the file
  - line: Line number (1-based)
  - character: Column number (1-based)
```

#### Incoming Calls
Find all functions that call the given function.

```
Operation: incomingCalls
Parameters:
  - callHierarchyItem: Item from prepareCallHierarchy
```

#### Outgoing Calls
Find all functions called by the given function.

```
Operation: outgoingCalls
Parameters:
  - callHierarchyItem: Item from prepareCallHierarchy
```

### Diagnostics

#### File Diagnostics
Get diagnostic messages (errors, warnings) for a file.

```
Operation: diagnostics
Parameters:
  - filePath: Path to the file
```

#### Workspace Diagnostics
Get all diagnostic messages across the workspace.

```
Operation: workspaceDiagnostics
Parameters:
  - limit: Maximum results (optional)
```

### Code Actions

#### Get Code Actions
Get available code actions (quick fixes, refactorings) at a location.

```
Operation: codeActions
Parameters:
  - filePath: Path to the file
  - line: Start line number (1-based)
  - character: Start column number (1-based)
  - endLine: End line number (optional, defaults to line)
  - endCharacter: End column (optional, defaults to character)
  - diagnostics: Diagnostics to get actions for (optional)
  - codeActionKinds: Filter by action kind (optional)
```

Code action kinds:
- `quickfix` - Quick fixes for errors/warnings
- `refactor` - Refactoring operations
- `refactor.extract` - Extract to function/variable
- `refactor.inline` - Inline function/variable
- `source` - Source code actions
- `source.organizeImports` - Organize imports
- `source.fixAll` - Fix all auto-fixable issues

## Security

LSP servers are only started in trusted workspaces by default. This is because language servers run with your user permissions and can execute code.

### Trust Controls

- **Trusted Workspace**: LSP servers start automatically
- **Untrusted Workspace**: LSP servers won't start unless `trustRequired: false`

To mark a workspace as trusted, use the `/trust` command or configure trusted folders in settings.

### Server Allowlists

You can restrict which servers are allowed to run:

```json
{
  "lsp": {
    "allowed": ["typescript-language-server", "gopls"],
    "excluded": ["untrusted-server"]
  }
}
```

## Troubleshooting

### Server Not Starting

1. **Check if the server is installed**: Run the command manually to verify
2. **Check the PATH**: Ensure the server binary is in your system PATH
3. **Check workspace trust**: The workspace must be trusted for LSP
4. **Check logs**: Look for error messages in the console output

### Slow Performance

1. **Large projects**: Consider excluding `node_modules` and other large directories
2. **Server timeout**: Increase `lsp.serverTimeout` for slow servers
3. **Multiple servers**: Exclude unused language servers

### No Results

1. **Server not ready**: The server may still be indexing
2. **File not saved**: Save your file for the server to pick up changes
3. **Wrong language**: Check if the correct server is running for your language

### Debugging

Enable debug logging to see LSP communication:

```bash
DEBUG=lsp* qwen
```

Or check the LSP debugging guide at `packages/cli/LSP_DEBUGGING_GUIDE.md`.

## Claude Code Compatibility

Qwen Code supports Claude Code-style `.lsp.json` configuration files. If you're migrating from Claude Code, your existing LSP configuration should work with minimal changes.

### Legacy Format

The legacy format (used by earlier versions) is still supported but deprecated:

```json
{
  "typescript": {
    "command": "typescript-language-server",
    "args": ["--stdio"],
    "transport": "stdio"
  }
}
```

We recommend migrating to the new `languageServers` format:

```json
{
  "languageServers": {
    "typescript-language-server": {
      "languages": ["typescript", "javascript"],
      "command": "typescript-language-server",
      "args": ["--stdio"],
      "transport": "stdio"
    }
  }
}
```

## Best Practices

1. **Install language servers globally**: This ensures they're available in all projects
2. **Use project-specific settings**: Configure server options per project when needed
3. **Keep servers updated**: Update your language servers regularly for best results
4. **Trust wisely**: Only trust workspaces from trusted sources

## FAQ

### Q: How do I know which language servers are running?

Use the `/lsp status` command to see all configured and running language servers.

### Q: Can I use multiple language servers for the same file type?

Yes, but only one will be used for each operation. The first server that returns results wins.

### Q: Does LSP work in sandbox mode?

LSP servers run outside the sandbox to access your code. They're subject to workspace trust controls.

### Q: How do I disable LSP for a specific project?

Add to your project's `.qwen/settings.json`:

```json
{
  "lsp": {
    "enabled": false
  }
}
```
