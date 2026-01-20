# Data Adapter Layer

This document describes the data transformation flow between different data sources and the webui components.

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Data Sources                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  ACP Protocol (vscode-ide-companion)    │    JSONL Files (ChatViewer)       │
│  - Real-time streaming                  │    - Static file format            │
│  - Session updates via WebSocket        │    - Array of messages             │
└─────────────────────────┬───────────────┴──────────────────┬────────────────┘
                          │                                   │
                          ▼                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Adapter Layer (normalize)                             │
│  - ACPAdapter: ACP messages → UnifiedMessage                                │
│  - JSONLAdapter: JSONL format → UnifiedMessage                              │
└─────────────────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Unified Message Format                                │
│  UnifiedMessage {                                                            │
│    id: string                                                                │
│    type: 'user' | 'assistant' | 'tool_call' | 'thinking'                    │
│    timestamp: number                                                         │
│    content?: string                                                          │
│    toolCall?: ToolCallData                                                   │
│    isFirst?: boolean  // timeline position                                   │
│    isLast?: boolean   // timeline position                                   │
│  }                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        WebUI Components                                      │
│  - UserMessage                                                               │
│  - AssistantMessage                                                          │
│  - ThinkingMessage                                                           │
│  - ToolCall (Read/Write/Edit/Shell/Search/...)                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Data Structures

### 1. ACP Protocol Format (vscode-ide-companion)

ACP messages come through WebSocket session updates:

```typescript
// Session update types
type AcpSessionUpdate = {
  sessionUpdate:
    | 'user_message_chunk'
    | 'agent_message_chunk'
    | 'agent_thought_chunk'
    | 'tool_call'
    | 'tool_call_update';
  content?: { text?: string };
  toolCallId?: string;
  kind?: string;
  title?: string;
  status?: string;
  rawInput?: unknown;
  locations?: Array<{ path: string; line?: number | null }>;
};
```

**Flow:**

1. `qwenSessionUpdateHandler.ts` receives ACP messages
2. Converts to internal format and calls callbacks
3. `WebViewProvider.ts` sends to webview
4. `useToolCalls.ts` manages tool call state
5. `App.tsx` combines into `allMessages` array

### 2. JSONL Format (ChatViewer)

Static JSON array with explicit message types:

```typescript
interface ChatMessageData {
  uuid: string;
  timestamp: string; // ISO timestamp
  type: 'user' | 'assistant' | 'tool_call';
  message?: {
    role?: string;
    parts?: Array<{ text: string }>; // Qwen format
    content?: string; // Claude format
  };
  toolCall?: ToolCallData;
}
```

### 3. ToolCallData (Shared)

```typescript
interface ToolCallData {
  toolCallId: string;
  kind: string; // 'read' | 'write' | 'edit' | 'bash' | 'grep' | ...
  title: string | object;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  rawInput?: string | object;
  content?: ToolCallContent[];
  locations?: Array<{ path: string; line?: number | null }>;
}

interface ToolCallContent {
  type: 'content' | 'diff';
  content?: { type: string; text?: string; error?: unknown };
  path?: string;
  oldText?: string | null;
  newText?: string;
}
```

## Adapter Implementation

### ACPAdapter

```typescript
// packages/webui/src/adapters/ACPAdapter.ts

import type { UnifiedMessage, ToolCallData } from './types';

export interface ACPMessage {
  type: 'message' | 'in-progress-tool-call' | 'completed-tool-call';
  data: unknown;
}

export function adaptACPMessages(messages: ACPMessage[]): UnifiedMessage[] {
  return messages.map((item, index, arr) => {
    const prev = arr[index - 1];
    const next = arr[index + 1];

    // Calculate timeline position
    const isUserMessage = (m: ACPMessage | undefined) =>
      m?.type === 'message' && (m.data as any)?.role === 'user';
    const isFirst = !prev || isUserMessage(prev);
    const isLast = !next || isUserMessage(next);

    switch (item.type) {
      case 'message': {
        const msg = item.data as {
          role: string;
          content: string;
          timestamp?: number;
        };
        return {
          id: `msg-${index}`,
          type:
            msg.role === 'user'
              ? 'user'
              : msg.role === 'thinking'
                ? 'thinking'
                : 'assistant',
          timestamp: msg.timestamp || Date.now(),
          content: msg.content,
          isFirst,
          isLast,
        };
      }

      case 'in-progress-tool-call':
      case 'completed-tool-call': {
        const toolCall = item.data as ToolCallData;
        return {
          id: `tool-${toolCall.toolCallId}`,
          type: 'tool_call',
          timestamp: Date.now(),
          toolCall,
          isFirst,
          isLast,
        };
      }

      default:
        throw new Error(`Unknown message type: ${item.type}`);
    }
  });
}
```

### JSONLAdapter

```typescript
// packages/webui/src/adapters/JSONLAdapter.ts

import type { UnifiedMessage, ChatMessageData } from './types';

export function adaptJSONLMessages(
  messages: ChatMessageData[],
): UnifiedMessage[] {
  // Sort by timestamp
  const sorted = [...messages].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  return sorted.map((msg, index, arr) => {
    const prev = arr[index - 1];
    const next = arr[index + 1];

    // User messages break the AI sequence
    const isUserType = (m: ChatMessageData | undefined) =>
      !m || m.type === 'user';
    const isFirst = isUserType(prev);
    const isLast = isUserType(next);

    // Extract content from different formats
    const extractContent = (message?: {
      parts?: Array<{ text: string }>;
      content?: string;
    }) => {
      if (!message) return '';
      if (message.parts?.length) {
        return message.parts.map((p) => p.text).join('');
      }
      return message.content || '';
    };

    return {
      id: msg.uuid,
      type:
        msg.type === 'tool_call'
          ? 'tool_call'
          : msg.message?.role === 'thinking'
            ? 'thinking'
            : msg.type,
      timestamp: new Date(msg.timestamp).getTime(),
      content: extractContent(msg.message),
      toolCall: msg.toolCall,
      isFirst,
      isLast,
    };
  });
}
```

## Usage

### In ChatViewer (JSONL)

```tsx
import { adaptJSONLMessages } from '../adapters/JSONLAdapter';

const ChatViewer = ({ messages }: { messages: ChatMessageData[] }) => {
  const unifiedMessages = useMemo(
    () => adaptJSONLMessages(messages),
    [messages],
  );

  return (
    <div className="chat-viewer-messages">
      {unifiedMessages.map((msg) => renderMessage(msg))}
    </div>
  );
};
```

### In vscode-ide-companion (ACP)

```tsx
import { adaptACPMessages } from '@qwen-code/webui/adapters';

const App = () => {
  const { allMessages } = useWebViewMessages();

  const unifiedMessages = useMemo(
    () => adaptACPMessages(allMessages),
    [allMessages],
  );

  return (
    <div className="chat-messages">
      {unifiedMessages.map((msg) => renderMessage(msg))}
    </div>
  );
};
```

## Timeline Position Calculation

The `isFirst` and `isLast` flags control timeline connector rendering:

- **isFirst=true**: Line starts from bullet point (no line above)
- **isLast=true**: Line ends at bullet point (no line below)
- **Both true**: No timeline connector (single message)
- **Both false**: Full height connector (middle of sequence)

```
User Message (no timeline)
│
├── Assistant Message [isFirst=true]
│   │ (line starts here)
├── Tool Call
│   │
├── Tool Call
│   │
├── Assistant Message [isLast=true]
│   (line ends here)
│
User Message (no timeline)
```
