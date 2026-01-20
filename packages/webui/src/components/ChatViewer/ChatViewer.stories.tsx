/**
 * @license
 * Copyright 2025 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { useRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  ChatViewer,
  type ChatMessageData,
  type ChatViewerHandle,
  type ToolCallData,
} from './ChatViewer.js';

/**
 * ChatViewer component displays a read-only conversation flow.
 * It accepts JSONL-formatted chat messages and renders them using
 * UserMessage and AssistantMessage components with timeline styling.
 *
 * Features:
 * - Auto-scroll to bottom when new messages arrive
 * - Programmatic scroll control via ref
 * - Light/dark/auto theme support
 * - Empty state with customizable message
 */
const meta: Meta<typeof ChatViewer> = {
  title: 'Chat/ChatViewer',
  component: ChatViewer,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    messages: {
      control: 'object',
      description: 'Array of chat messages in JSONL format',
    },
    className: {
      control: 'text',
      description: 'Additional CSS class name',
    },
    onFileClick: { action: 'fileClicked' },
    emptyMessage: {
      control: 'text',
      description: 'Message to show when there are no messages',
    },
    autoScroll: {
      control: 'boolean',
      description: 'Whether to auto-scroll to bottom when new messages arrive',
    },
    theme: {
      control: 'select',
      options: ['dark', 'light', 'auto'],
      description: 'Theme variant for the viewer',
    },
    showEmptyIcon: {
      control: 'boolean',
      description: 'Whether to show the icon in empty state',
    },
  },
  decorators: [
    (Story) => (
      <div
        style={{
          background: 'var(--app-background, #1e1e1e)',
          padding: '20px',
          height: '500px',
        }}
      >
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

// Helper function to create message data
const createMessage = (
  uuid: string,
  type: 'user' | 'assistant',
  text: string,
  timestamp: string,
  model?: string,
): ChatMessageData => ({
  uuid,
  parentUuid: null,
  sessionId: 'story-session',
  timestamp,
  type,
  message: {
    role: type === 'user' ? 'user' : 'model',
    parts: [{ text }],
  },
  model,
});

export const Default: Story = {
  args: {
    messages: [
      createMessage(
        '1',
        'user',
        'How do I create a React component?',
        '2026-01-19T10:00:00.000Z',
      ),
      createMessage(
        '2',
        'assistant',
        "To create a React component, you can use either a function or a class. Here's a simple example of a functional component:\n\n```tsx\nimport React from 'react';\n\nconst MyComponent: React.FC = () => {\n  return <div>Hello, World!</div>;\n};\n\nexport default MyComponent;\n```\n\nThis creates a basic component that renders \"Hello, World!\". You can then use it in other components like `<MyComponent />`.",
        '2026-01-19T10:00:05.000Z',
        'coder-model',
      ),
    ],
  },
};

export const MultiTurn: Story = {
  args: {
    messages: [
      createMessage(
        '1',
        'user',
        'What is TypeScript?',
        '2026-01-19T10:00:00.000Z',
      ),
      createMessage(
        '2',
        'assistant',
        'TypeScript is a strongly typed programming language that builds on JavaScript. It adds optional static typing and class-based object-oriented programming to the language.',
        '2026-01-19T10:00:05.000Z',
        'coder-model',
      ),
      createMessage(
        '3',
        'user',
        'How do I define an interface?',
        '2026-01-19T10:00:30.000Z',
      ),
      createMessage(
        '4',
        'assistant',
        'You can define an interface in TypeScript like this:\n\n```typescript\ninterface User {\n  id: number;\n  name: string;\n  email?: string; // optional property\n}\n\nconst user: User = {\n  id: 1,\n  name: "John Doe"\n};\n```\n\nInterfaces help you define the shape of objects and enable better type checking.',
        '2026-01-19T10:00:35.000Z',
        'coder-model',
      ),
      createMessage(
        '5',
        'user',
        'Can interfaces extend other interfaces?',
        '2026-01-19T10:01:00.000Z',
      ),
      createMessage(
        '6',
        'assistant',
        'Yes! Interfaces can extend one or more interfaces. Here\'s an example:\n\n```typescript\ninterface Person {\n  name: string;\n  age: number;\n}\n\ninterface Employee extends Person {\n  employeeId: string;\n  department: string;\n}\n\n// Employee now has: name, age, employeeId, and department\nconst employee: Employee = {\n  name: "Jane",\n  age: 30,\n  employeeId: "E001",\n  department: "Engineering"\n};\n```\n\nYou can also extend multiple interfaces: `interface Manager extends Person, Employee { ... }`',
        '2026-01-19T10:01:05.000Z',
        'coder-model',
      ),
    ],
  },
};

export const WithCodeBlocks: Story = {
  args: {
    messages: [
      createMessage(
        '1',
        'user',
        'Show me how to implement a debounce function',
        '2026-01-19T10:00:00.000Z',
      ),
      createMessage(
        '2',
        'assistant',
        `Here's a debounce function implementation in TypeScript:

\`\`\`typescript
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return function (...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      func.apply(this, args);
      timeoutId = null;
    }, wait);
  };
}
\`\`\`

**Usage example:**

\`\`\`typescript
const handleSearch = debounce((query: string) => {
  console.log('Searching for:', query);
  // Make API call here
}, 300);

// This will only execute once, 300ms after the last call
handleSearch('h');
handleSearch('he');
handleSearch('hel');
handleSearch('hello');
\`\`\`

The debounce function delays the execution until there's a pause in calls for the specified wait time (300ms in this case).`,
        '2026-01-19T10:00:10.000Z',
        'coder-model',
      ),
    ],
  },
};

export const LongConversation: Story = {
  args: {
    messages: [
      createMessage(
        '1',
        'user',
        'I need to build a REST API. What framework should I use?',
        '2026-01-19T10:00:00.000Z',
      ),
      createMessage(
        '2',
        'assistant',
        'For building a REST API, there are several excellent options depending on your needs:\n\n1. **Express.js** - Minimal and flexible, great for small to medium projects\n2. **Fastify** - High performance, excellent for high-throughput APIs\n3. **NestJS** - Full-featured framework with TypeScript, great for enterprise applications\n4. **Hono** - Ultra-fast and lightweight, perfect for edge computing\n\nWhat language/runtime are you planning to use?',
        '2026-01-19T10:00:05.000Z',
        'coder-model',
      ),
      createMessage(
        '3',
        'user',
        'I want to use TypeScript with Node.js. The API will handle about 10k requests per second.',
        '2026-01-19T10:00:30.000Z',
      ),
      createMessage(
        '4',
        'assistant',
        "For high throughput (10k req/s) with TypeScript, I recommend **Fastify**. It's designed for performance and has excellent TypeScript support out of the box.\n\nHere's a quick setup:\n\n```bash\nnpm init -y\nnpm install fastify\nnpm install -D typescript @types/node\n```\n\n```typescript\nimport Fastify from 'fastify';\n\nconst app = Fastify({ logger: true });\n\napp.get('/health', async () => {\n  return { status: 'ok' };\n});\n\napp.listen({ port: 3000 }, (err) => {\n  if (err) throw err;\n});\n```\n\nFastify benchmarks show it can handle 30k+ req/s on modest hardware.",
        '2026-01-19T10:00:35.000Z',
        'coder-model',
      ),
      createMessage(
        '5',
        'user',
        'How do I add request validation?',
        '2026-01-19T10:01:00.000Z',
      ),
      createMessage(
        '6',
        'assistant',
        "Fastify has built-in JSON Schema validation. Here's how to add it:\n\n```typescript\nconst createUserSchema = {\n  body: {\n    type: 'object',\n    required: ['email', 'name'],\n    properties: {\n      email: { type: 'string', format: 'email' },\n      name: { type: 'string', minLength: 2 },\n      age: { type: 'integer', minimum: 0 }\n    }\n  },\n  response: {\n    201: {\n      type: 'object',\n      properties: {\n        id: { type: 'string' },\n        email: { type: 'string' },\n        name: { type: 'string' }\n      }\n    }\n  }\n};\n\napp.post('/users', { schema: createUserSchema }, async (req, reply) => {\n  const { email, name, age } = req.body;\n  // Create user...\n  reply.code(201).send({ id: '123', email, name });\n});\n```\n\nInvalid requests automatically return 400 with detailed error messages.",
        '2026-01-19T10:01:10.000Z',
        'coder-model',
      ),
    ],
  },
};

export const Empty: Story = {
  args: {
    messages: [],
    emptyMessage: 'Start a conversation to see messages here',
  },
};

export const CustomEmptyMessage: Story = {
  args: {
    messages: [],
    emptyMessage: 'No chat history available',
  },
};

export const SingleUserMessage: Story = {
  args: {
    messages: [
      createMessage(
        '1',
        'user',
        'This is a single user message without any response yet.',
        '2026-01-19T10:00:00.000Z',
      ),
    ],
  },
};

export const SingleAssistantMessage: Story = {
  args: {
    messages: [
      createMessage(
        '1',
        'assistant',
        'This is a standalone assistant message, perhaps from a system prompt or welcome message.',
        '2026-01-19T10:00:00.000Z',
        'coder-model',
      ),
    ],
  },
};

// Real conversation example - Chrome Extension Native Host debugging session
export const RealConversation: Story = {
  args: {
    messages: [
      {
        uuid: '20fb9426-40ca-4e85-92a1-7add59082167',
        parentUuid: null,
        sessionId: 'f05dd1fc-2947-44e0-9f31-cbddce461844',
        timestamp: '2026-01-09T02:58:32.415Z',
        type: 'user',
        message: {
          role: 'user',
          content: `Message received: Object from: Object
service-worker.js:137 Attempting to connect to Native Host: com.qwen.cli.bridge
service-worker.js:202 Sending handshake...
service-worker.js:175 Native host disconnected
service-worker.js:177 Disconnect error: Object
service-worker.js:178 Disconnect error message: Native host has exited.
service-worker.js:207 Handshake timeout - no response from Native Host

接收不到 host 的信息。正常应该是:
service-worker.js:150 [Native Event] host_info Object
service-worker.js:552 [Qwen] host_info Object  
service-worker.js:617 [Host] Info Object
service-worker.js:164 [Native Message] handshake_response Object
service-worker.js:231 Handshake successful: Object`,
        },
      },
      {
        uuid: '86f72c75-4626-4292-a26f-13db6f80d4be',
        parentUuid: '20fb9426-40ca-4e85-92a1-7add59082167',
        sessionId: 'f05dd1fc-2947-44e0-9f31-cbddce461844',
        timestamp: '2026-01-09T02:58:45.239Z',
        type: 'assistant',
        model: 'claude-opus-4-5-20251101',
        message: {
          role: 'assistant',
          content: `I can see you're experiencing an issue with the Chrome extension's native host connection. The error shows that the native host is disconnecting with "Native host has exited" and there's a handshake timeout. However, the logs also show that sometimes the handshake is successful when the host_info is received properly.

Let me help you troubleshoot this issue. First, I'll explore the codebase to understand how the native host communication works.`,
        },
      },
      {
        uuid: '6ffff579-8020-4ccb-9b79-7c1da76bbf82',
        parentUuid: '86f72c75-4626-4292-a26f-13db6f80d4be',
        sessionId: 'f05dd1fc-2947-44e0-9f31-cbddce461844',
        timestamp: '2026-01-09T02:58:52.409Z',
        type: 'assistant',
        model: 'claude-opus-4-5-20251101',
        message: {
          role: 'assistant',
          content: `Let me create a todo list to track the troubleshooting steps:

1. **Explore the codebase** to understand the native host implementation
2. **Check the native host configuration** and setup
3. **Analyze the service worker code** that handles native messaging
4. **Identify why the native host exits** unexpectedly
5. **Propose fixes** for the native host connection issue`,
        },
      },
      {
        uuid: '8fd3dc96-1d34-4dae-845a-4827f435b890',
        parentUuid: '6ffff579-8020-4ccb-9b79-7c1da76bbf82',
        sessionId: 'f05dd1fc-2947-44e0-9f31-cbddce461844',
        timestamp: '2026-01-09T02:58:57.366Z',
        type: 'assistant',
        model: 'claude-opus-4-5-20251101',
        message: {
          role: 'assistant',
          content: `Let me start by exploring the codebase to understand the native host implementation.

Looking at the project structure, I found the following relevant files:

\`\`\`
packages/chrome-extension/
├── src/
│   ├── service-worker.ts      # Main service worker
│   ├── native-messaging/
│   │   ├── host.ts            # Native host communication
│   │   └── protocol.ts        # Message protocol
│   └── manifest.json          # Extension manifest
└── native-host/
    ├── index.js               # Native host entry
    └── com.qwen.cli.bridge.json  # Host manifest
\`\`\`

The issue appears to be in the handshake timing. The native host is exiting before the handshake completes.`,
        },
      },
      {
        uuid: 'user-follow-up-1',
        parentUuid: '8fd3dc96-1d34-4dae-845a-4827f435b890',
        sessionId: 'f05dd1fc-2947-44e0-9f31-cbddce461844',
        timestamp: '2026-01-09T03:00:15.000Z',
        type: 'user',
        message: {
          role: 'user',
          content: '那应该怎么修复这个问题？',
        },
      },
      {
        uuid: 'assistant-fix-1',
        parentUuid: 'user-follow-up-1',
        sessionId: 'f05dd1fc-2947-44e0-9f31-cbddce461844',
        timestamp: '2026-01-09T03:00:45.000Z',
        type: 'assistant',
        model: 'claude-opus-4-5-20251101',
        message: {
          role: 'assistant',
          content: `Based on my analysis, here's how to fix the native host connection issue:

## Root Cause
The native host process is exiting prematurely because it's not keeping the stdin stream open for communication.

## Solution

Update the native host's \`index.js\`:

\`\`\`javascript
// native-host/index.js
const { stdin, stdout } = process;

// Keep the process alive by not closing stdin
stdin.resume();

// Handle incoming messages
stdin.on('data', (data) => {
  try {
    const length = data.readUInt32LE(0);
    const message = JSON.parse(data.slice(4, 4 + length).toString());
    
    if (message.type === 'handshake') {
      sendMessage({ type: 'handshake_response', status: 'ok' });
    }
    // Handle other messages...
  } catch (err) {
    console.error('Error parsing message:', err);
  }
});

function sendMessage(msg) {
  const json = JSON.stringify(msg);
  const length = Buffer.alloc(4);
  length.writeUInt32LE(json.length, 0);
  stdout.write(Buffer.concat([length, Buffer.from(json)]));
}

// Send host info on startup
sendMessage({
  type: 'host_info',
  pid: process.pid,
  node: process.execPath
});
\`\`\`

## Key Changes
1. Added \`stdin.resume()\` to prevent the process from exiting
2. Properly handle the native messaging protocol (4-byte length prefix)
3. Send \`host_info\` immediately on startup

Would you like me to apply these changes to your codebase?`,
        },
      },
    ],
  },
  parameters: {
    docs: {
      description: {
        story:
          'A real debugging conversation about Chrome extension native host connection issues. Demonstrates multi-turn conversation with code blocks and mixed languages (English and Chinese).',
      },
    },
  },
};

// Helper to create tool call data
const createToolCall = (
  id: string,
  kind: string,
  title: string,
  status: 'pending' | 'in_progress' | 'completed' | 'failed',
  content?: ToolCallData['content'],
  locations?: ToolCallData['locations'],
): ToolCallData => ({
  toolCallId: id,
  kind,
  title,
  status,
  content,
  locations,
});

// Conversation with tool calls - File reading and editing
export const WithToolCalls: Story = {
  args: {
    messages: [
      {
        uuid: 'tc-1',
        timestamp: '2026-01-15T14:00:00.000Z',
        type: 'user',
        message: {
          role: 'user',
          parts: [
            { text: '帮我看看 package.json 文件，然后添加一个 lodash 依赖' },
          ],
        },
      },
      {
        uuid: 'tc-2',
        timestamp: '2026-01-15T14:00:05.000Z',
        type: 'assistant',
        message: {
          role: 'assistant',
          content: '好的，我先读取 package.json 文件来查看当前的依赖配置。',
        },
      },
      {
        uuid: 'tc-3',
        timestamp: '2026-01-15T14:00:06.000Z',
        type: 'tool_call',
        toolCall: createToolCall(
          'read-1',
          'read',
          'package.json',
          'completed',
          [
            {
              type: 'content',
              content: {
                type: 'text',
                text: `{
  "name": "my-project",
  "version": "1.0.0",
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "vite": "^5.0.0"
  }
}`,
              },
            },
          ],
          [{ path: 'package.json', line: 1 }],
        ),
      },
      {
        uuid: 'tc-4',
        timestamp: '2026-01-15T14:00:10.000Z',
        type: 'assistant',
        message: {
          role: 'assistant',
          content:
            '我看到当前项目使用 React 18 和 TypeScript。现在我来添加 lodash 依赖。',
        },
      },
      {
        uuid: 'tc-5',
        timestamp: '2026-01-15T14:00:11.000Z',
        type: 'tool_call',
        toolCall: createToolCall(
          'edit-1',
          'edit',
          'package.json',
          'completed',
          [
            {
              type: 'diff',
              path: 'package.json',
              oldText: `  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },`,
              newText: `  "dependencies": {
    "lodash": "^4.17.21",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },`,
            },
          ],
          [{ path: 'package.json', line: 4 }],
        ),
      },
      {
        uuid: 'tc-6',
        timestamp: '2026-01-15T14:00:15.000Z',
        type: 'assistant',
        message: {
          role: 'assistant',
          content: `已经成功添加 lodash 依赖到 package.json。

你需要运行以下命令来安装新的依赖：

\`\`\`bash
npm install
\`\`\`

或者如果你使用 pnpm:

\`\`\`bash
pnpm install
\`\`\``,
        },
      },
    ],
  },
  parameters: {
    docs: {
      description: {
        story:
          'Demonstrates a conversation with Read and Edit tool calls, showing file reading and modification.',
      },
    },
  },
};

// Conversation with Shell commands
export const WithShellCommands: Story = {
  args: {
    messages: [
      {
        uuid: 'sh-1',
        timestamp: '2026-01-15T15:00:00.000Z',
        type: 'user',
        message: {
          role: 'user',
          parts: [{ text: '帮我创建一个新的 React 组件文件夹结构' }],
        },
      },
      {
        uuid: 'sh-2',
        timestamp: '2026-01-15T15:00:05.000Z',
        type: 'assistant',
        message: {
          role: 'assistant',
          content: '好的，我来创建一个标准的 React 组件文件夹结构。',
        },
      },
      {
        uuid: 'sh-3',
        timestamp: '2026-01-15T15:00:06.000Z',
        type: 'tool_call',
        toolCall: createToolCall(
          'shell-1',
          'bash',
          'mkdir -p src/components/Button',
          'completed',
          [
            {
              type: 'content',
              content: {
                type: 'text',
                text: '',
              },
            },
          ],
        ),
      },
      {
        uuid: 'sh-4',
        timestamp: '2026-01-15T15:00:08.000Z',
        type: 'tool_call',
        toolCall: createToolCall(
          'write-1',
          'write',
          'src/components/Button/Button.tsx',
          'completed',
          [
            {
              type: 'content',
              content: {
                type: 'text',
                text: `import React from 'react';
import './Button.css';

interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary';
}

export const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  variant = 'primary',
}) => {
  return (
    <button className={\`button button--\${variant}\`} onClick={onClick}>
      {children}
    </button>
  );
};`,
              },
            },
          ],
          [{ path: 'src/components/Button/Button.tsx' }],
        ),
      },
      {
        uuid: 'sh-5',
        timestamp: '2026-01-15T15:00:10.000Z',
        type: 'tool_call',
        toolCall: createToolCall(
          'write-2',
          'write',
          'src/components/Button/Button.css',
          'completed',
          [
            {
              type: 'content',
              content: {
                type: 'text',
                text: `.button {
  padding: 8px 16px;
  border-radius: 4px;
  border: none;
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
}

.button--primary {
  background-color: #3b82f6;
  color: white;
}

.button--secondary {
  background-color: #e5e7eb;
  color: #1f2937;
}`,
              },
            },
          ],
          [{ path: 'src/components/Button/Button.css' }],
        ),
      },
      {
        uuid: 'sh-6',
        timestamp: '2026-01-15T15:00:12.000Z',
        type: 'tool_call',
        toolCall: createToolCall(
          'write-3',
          'write',
          'src/components/Button/index.ts',
          'completed',
          [
            {
              type: 'content',
              content: {
                type: 'text',
                text: `export { Button } from './Button';
export type { ButtonProps } from './Button';`,
              },
            },
          ],
          [{ path: 'src/components/Button/index.ts' }],
        ),
      },
      {
        uuid: 'sh-7',
        timestamp: '2026-01-15T15:00:15.000Z',
        type: 'assistant',
        message: {
          role: 'assistant',
          content: `已创建完整的 Button 组件结构：

\`\`\`
src/components/Button/
├── Button.tsx      # 主组件
├── Button.css      # 样式
└── index.ts        # 导出
\`\`\`

你可以这样使用：

\`\`\`tsx
import { Button } from './components/Button';

<Button variant="primary" onClick={() => alert('Clicked!')}>
  Click me
</Button>
\`\`\``,
        },
      },
    ],
  },
  parameters: {
    docs: {
      description: {
        story:
          'Shows a conversation with Shell and Write tool calls, creating a complete component structure.',
      },
    },
  },
};

// Conversation with Search and multiple file reads
export const WithSearchAndRead: Story = {
  args: {
    messages: [
      {
        uuid: 'sr-1',
        timestamp: '2026-01-15T16:00:00.000Z',
        type: 'user',
        message: {
          role: 'user',
          parts: [{ text: '帮我找一下项目中所有使用了 useState 的文件' }],
        },
      },
      {
        uuid: 'sr-2',
        timestamp: '2026-01-15T16:00:05.000Z',
        type: 'assistant',
        message: {
          role: 'assistant',
          content: '好的，我来搜索项目中所有使用 useState 的文件。',
        },
      },
      {
        uuid: 'sr-3',
        timestamp: '2026-01-15T16:00:06.000Z',
        type: 'tool_call',
        toolCall: createToolCall(
          'search-1',
          'grep',
          'useState',
          'completed',
          [
            {
              type: 'content',
              content: {
                type: 'text',
                text: `src/App.tsx:3:import { useState } from 'react';
src/components/Counter.tsx:1:import { useState } from 'react';
src/components/Form.tsx:2:import { useState, useEffect } from 'react';
src/hooks/useLocalStorage.ts:1:import { useState, useEffect } from 'react';`,
              },
            },
          ],
          [
            { path: 'src/App.tsx', line: 3 },
            { path: 'src/components/Counter.tsx', line: 1 },
            { path: 'src/components/Form.tsx', line: 2 },
            { path: 'src/hooks/useLocalStorage.ts', line: 1 },
          ],
        ),
      },
      {
        uuid: 'sr-4',
        timestamp: '2026-01-15T16:00:10.000Z',
        type: 'assistant',
        message: {
          role: 'assistant',
          content: `找到了 **4 个文件** 使用了 \`useState\`：

| 文件 | 行号 |
|------|------|
| \`src/App.tsx\` | 3 |
| \`src/components/Counter.tsx\` | 1 |
| \`src/components/Form.tsx\` | 2 |
| \`src/hooks/useLocalStorage.ts\` | 1 |

需要我详细查看其中某个文件吗？`,
        },
      },
      {
        uuid: 'sr-5',
        timestamp: '2026-01-15T16:00:30.000Z',
        type: 'user',
        message: {
          role: 'user',
          parts: [{ text: '看看 Counter.tsx' }],
        },
      },
      {
        uuid: 'sr-6',
        timestamp: '2026-01-15T16:00:31.000Z',
        type: 'tool_call',
        toolCall: createToolCall(
          'read-2',
          'read',
          'src/components/Counter.tsx',
          'completed',
          [
            {
              type: 'content',
              content: {
                type: 'text',
                text: `import { useState } from 'react';

export const Counter = () => {
  const [count, setCount] = useState(0);

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(c => c + 1)}>+</button>
      <button onClick={() => setCount(c => c - 1)}>-</button>
    </div>
  );
};`,
              },
            },
          ],
          [{ path: 'src/components/Counter.tsx' }],
        ),
      },
      {
        uuid: 'sr-7',
        timestamp: '2026-01-15T16:00:35.000Z',
        type: 'assistant',
        message: {
          role: 'assistant',
          content: `这是一个简单的计数器组件，使用 \`useState\` 管理计数状态。

**代码分析：**
- 使用函数式更新 \`c => c + 1\` 来确保状态更新正确
- 组件结构简洁，只有一个状态变量

**潜在改进：**
1. 可以添加 TypeScript 类型注解
2. 可以提取 min/max 限制
3. 可以添加 step 参数

需要我帮你优化这个组件吗？`,
        },
      },
    ],
  },
  parameters: {
    docs: {
      description: {
        story:
          'Demonstrates Search (grep) and Read tool calls in a code exploration conversation.',
      },
    },
  },
};

// Conversation with Todo/Plan updates
export const WithPlanUpdates: Story = {
  args: {
    messages: [
      {
        uuid: 'plan-1',
        timestamp: '2026-01-15T17:00:00.000Z',
        type: 'user',
        message: {
          role: 'user',
          parts: [{ text: '帮我重构这个项目的认证模块' }],
        },
      },
      {
        uuid: 'plan-2',
        timestamp: '2026-01-15T17:00:05.000Z',
        type: 'assistant',
        message: {
          role: 'assistant',
          content:
            '好的，这是一个比较复杂的任务。让我先创建一个计划来跟踪进度。',
        },
      },
      {
        uuid: 'plan-3',
        timestamp: '2026-01-15T17:00:06.000Z',
        type: 'tool_call',
        toolCall: createToolCall(
          'todo-1',
          'todowrite',
          'Create refactoring plan',
          'completed',
          [
            {
              type: 'content',
              content: {
                type: 'text',
                text: JSON.stringify([
                  { content: '分析现有认证代码结构', status: 'in_progress' },
                  { content: '设计新的认证架构', status: 'pending' },
                  { content: '实现 JWT token 管理', status: 'pending' },
                  { content: '添加 refresh token 机制', status: 'pending' },
                  { content: '更新相关测试', status: 'pending' },
                ]),
              },
            },
          ],
        ),
      },
      {
        uuid: 'plan-4',
        timestamp: '2026-01-15T17:00:10.000Z',
        type: 'assistant',
        message: {
          role: 'assistant',
          content: '我已经创建了重构计划。现在让我先分析现有的认证代码。',
        },
      },
      {
        uuid: 'plan-5',
        timestamp: '2026-01-15T17:00:11.000Z',
        type: 'tool_call',
        toolCall: createToolCall(
          'search-2',
          'glob',
          '**/auth/**',
          'completed',
          undefined,
          [
            { path: 'src/auth/index.ts' },
            { path: 'src/auth/login.ts' },
            { path: 'src/auth/logout.ts' },
            { path: 'src/auth/middleware.ts' },
            { path: 'src/auth/types.ts' },
          ],
        ),
      },
      {
        uuid: 'plan-6',
        timestamp: '2026-01-15T17:00:15.000Z',
        type: 'tool_call',
        toolCall: createToolCall(
          'read-3',
          'read',
          'src/auth/index.ts',
          'completed',
          [
            {
              type: 'content',
              content: {
                type: 'text',
                text: `// Legacy auth module
export { login } from './login';
export { logout } from './logout';
export { authMiddleware } from './middleware';
export type { AuthUser, AuthToken } from './types';`,
              },
            },
          ],
          [{ path: 'src/auth/index.ts' }],
        ),
      },
      {
        uuid: 'plan-7',
        timestamp: '2026-01-15T17:00:20.000Z',
        type: 'assistant',
        message: {
          role: 'assistant',
          content: `分析完成！现有的认证模块结构：

\`\`\`
src/auth/
├── index.ts      # 导出入口
├── login.ts      # 登录逻辑
├── logout.ts     # 登出逻辑
├── middleware.ts # 认证中间件
└── types.ts      # 类型定义
\`\`\`

**发现的问题：**
1. 没有 token 刷新机制
2. 缺少认证状态持久化
3. 错误处理不完善

**建议的新架构：**
- 添加 \`tokenManager.ts\` 管理 JWT
- 添加 \`storage.ts\` 处理持久化
- 添加 \`errors.ts\` 统一错误处理

要我继续实现吗？`,
        },
      },
    ],
  },
  parameters: {
    docs: {
      description: {
        story:
          'Shows a complex refactoring task with Todo/Plan updates, file search, and code analysis.',
      },
    },
  },
};

export const LightTheme: Story = {
  args: {
    messages: [
      createMessage(
        '1',
        'user',
        'Show me how to use the light theme.',
        '2026-01-19T10:00:00.000Z',
      ),
      createMessage(
        '2',
        'assistant',
        'The ChatViewer supports light, dark, and auto themes. Set `theme="light"` for light mode styling.',
        '2026-01-19T10:00:05.000Z',
        'coder-model',
      ),
    ],
    theme: 'light',
  },
  decorators: [
    (Story) => (
      <div
        style={{
          background: '#ffffff',
          padding: '20px',
          height: '500px',
        }}
      >
        <Story />
      </div>
    ),
  ],
};

export const AutoScrollDisabled: Story = {
  args: {
    messages: [
      createMessage(
        '1',
        'user',
        'This story has auto-scroll disabled.',
        '2026-01-19T10:00:00.000Z',
      ),
      createMessage(
        '2',
        'assistant',
        'When `autoScroll={false}`, the viewer will not automatically scroll to the bottom when new messages arrive. This is useful when you want users to manually control the scroll position.',
        '2026-01-19T10:00:05.000Z',
        'coder-model',
      ),
    ],
    autoScroll: false,
  },
};

export const EmptyWithoutIcon: Story = {
  args: {
    messages: [],
    emptyMessage: 'No messages yet',
    showEmptyIcon: false,
  },
};

// Interactive story demonstrating ref functionality
const WithRefControlTemplate = () => {
  const chatRef = useRef<ChatViewerHandle>(null);

  const messages: ChatMessageData[] = Array.from({ length: 20 }, (_, i) =>
    createMessage(
      String(i + 1),
      i % 2 === 0 ? 'user' : 'assistant',
      i % 2 === 0
        ? `Question ${Math.floor(i / 2) + 1}: How does feature ${Math.floor(i / 2) + 1} work?`
        : `This is the answer to question ${Math.floor(i / 2) + 1}. The feature works by processing data through multiple stages and returning the result to the caller.`,
      new Date(2026, 0, 19, 10, i).toISOString(),
      i % 2 === 1 ? 'coder-model' : undefined,
    ),
  );

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '500px',
        gap: '10px',
      }}
    >
      <div style={{ display: 'flex', gap: '10px' }}>
        <button
          onClick={() => chatRef.current?.scrollToTop('smooth')}
          style={{ padding: '8px 16px', cursor: 'pointer' }}
        >
          Scroll to Top
        </button>
        <button
          onClick={() => chatRef.current?.scrollToBottom('smooth')}
          style={{ padding: '8px 16px', cursor: 'pointer' }}
        >
          Scroll to Bottom
        </button>
      </div>
      <div style={{ flex: 1 }}>
        <ChatViewer ref={chatRef} messages={messages} autoScroll={false} />
      </div>
    </div>
  );
};

export const WithRefControl: Story = {
  render: () => <WithRefControlTemplate />,
  parameters: {
    docs: {
      description: {
        story:
          'Demonstrates programmatic scroll control using the `ref` prop. The `ChatViewerHandle` provides `scrollToTop()`, `scrollToBottom()`, and `getScrollContainer()` methods.',
      },
    },
  },
};
