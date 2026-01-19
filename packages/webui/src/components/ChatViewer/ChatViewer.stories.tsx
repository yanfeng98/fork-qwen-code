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
