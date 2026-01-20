# @qwen-code/webui

A shared React component library for Qwen Code applications, providing cross-platform UI components with consistent styling and behavior.

## Features

- **Cross-platform support**: Components work seamlessly across VS Code extension, web, and other platforms
- **Platform Context**: Abstraction layer for platform-specific capabilities
- **Tailwind CSS**: Shared styling preset for consistent design
- **TypeScript**: Full type definitions for all components
- **Storybook**: Interactive component documentation and development

## Installation

```bash
npm install @qwen-code/webui
```

## Quick Start

```tsx
import { Button, Input, Tooltip } from '@qwen-code/webui';
import { PlatformProvider } from '@qwen-code/webui/context';

function App() {
  return (
    <PlatformProvider value={platformContext}>
      <Button variant="primary" onClick={handleClick}>
        Click me
      </Button>
    </PlatformProvider>
  );
}
```

## Components

### UI Components

#### Button

```tsx
import { Button } from '@qwen-code/webui';

<Button variant="primary" size="md" loading={false}>
  Submit
</Button>;
```

**Props:**

- `variant`: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline'
- `size`: 'sm' | 'md' | 'lg'
- `loading`: boolean
- `leftIcon`: ReactNode
- `rightIcon`: ReactNode
- `fullWidth`: boolean

#### Input

```tsx
import { Input } from '@qwen-code/webui';

<Input
  label="Email"
  placeholder="Enter email"
  error={hasError}
  errorMessage="Invalid email"
/>;
```

**Props:**

- `size`: 'sm' | 'md' | 'lg'
- `error`: boolean
- `errorMessage`: string
- `label`: string
- `helperText`: string
- `leftElement`: ReactNode
- `rightElement`: ReactNode

#### Tooltip

```tsx
import { Tooltip } from '@qwen-code/webui';

<Tooltip content="Helpful tip">
  <span>Hover me</span>
</Tooltip>;
```

### Icons

```tsx
import { FileIcon, FolderIcon, CheckIcon } from '@qwen-code/webui/icons';

<FileIcon size={16} className="text-gray-500" />;
```

Available icon categories:

- **FileIcons**: FileIcon, FolderIcon, SaveDocumentIcon
- **StatusIcons**: CheckIcon, ErrorIcon, WarningIcon, LoadingIcon
- **NavigationIcons**: ArrowLeftIcon, ArrowRightIcon, ChevronIcon
- **EditIcons**: EditIcon, DeleteIcon, CopyIcon
- **SpecialIcons**: SendIcon, StopIcon, CloseIcon

### Layout Components

- `Container`: Main layout wrapper
- `Header`: Application header
- `Footer`: Application footer
- `Sidebar`: Side navigation
- `Main`: Main content area

### Message Components

- `Message`: Chat message display
- `MessageList`: List of messages
- `MessageInput`: Message input field
- `WaitingMessage`: Loading/waiting state
- `InterruptedMessage`: Interrupted state display

## Platform Context

The Platform Context provides an abstraction layer for platform-specific capabilities:

```tsx
import { PlatformProvider, usePlatform } from '@qwen-code/webui/context';

const platformContext = {
  postMessage: (message) => vscode.postMessage(message),
  onMessage: (handler) => {
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  },
  openFile: (path) => {
    /* platform-specific */
  },
  platform: 'vscode',
};

function App() {
  return (
    <PlatformProvider value={platformContext}>
      <YourApp />
    </PlatformProvider>
  );
}

function Component() {
  const { postMessage, platform } = usePlatform();
  // Use platform capabilities
}
```

## Tailwind Preset

Use the shared Tailwind preset for consistent styling:

```js
// tailwind.config.js
module.exports = {
  presets: [require('@qwen-code/webui/tailwind.preset.cjs')],
  // your customizations
};
```

## Development

### Running Storybook

```bash
cd packages/webui
npm run storybook
```

### Building

```bash
npm run build
```

### Type Checking

```bash
npm run typecheck
```

## Project Structure

```
packages/webui/
├── src/
│   ├── components/
│   │   ├── icons/          # Icon components
│   │   ├── layout/         # Layout components
│   │   ├── messages/       # Message components
│   │   └── ui/             # UI primitives
│   ├── context/            # Platform context
│   ├── hooks/              # Custom hooks
│   └── types/              # Type definitions
├── .storybook/             # Storybook config
├── tailwind.preset.cjs     # Shared Tailwind preset
└── vite.config.ts          # Build configuration
```

## License

Apache-2.0
