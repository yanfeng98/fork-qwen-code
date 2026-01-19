/**
 * @license
 * Copyright 2025 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import { UserMessage } from '../messages/UserMessage.js';
import { AssistantMessage } from '../messages/Assistant/AssistantMessage.js';
import { ThinkingMessage } from '../messages/ThinkingMessage.js';
import './ChatViewer.css';

/**
 * Message part containing text content
 */
export interface MessagePart {
  text: string;
}

/**
 * Single chat message from JSONL format
 */
export interface ChatMessageData {
  uuid: string;
  parentUuid: string | null;
  sessionId: string;
  timestamp: string; // ISO timestamp string
  type: 'user' | 'assistant' | 'system';
  message: {
    role: string;
    parts: MessagePart[];
  };
  model?: string; // for assistant messages
}

/**
 * ChatViewer ref handle for programmatic control
 */
export interface ChatViewerHandle {
  /** Scroll to the bottom of the messages */
  scrollToBottom: (behavior?: ScrollBehavior) => void;
  /** Scroll to the top of the messages */
  scrollToTop: (behavior?: ScrollBehavior) => void;
  /** Get the scroll container element */
  getScrollContainer: () => HTMLDivElement | null;
}

/**
 * ChatViewer component props
 */
export interface ChatViewerProps {
  /** Array of chat messages in JSONL format */
  messages: ChatMessageData[];
  /** Optional additional CSS class name */
  className?: string;
  /** Optional callback when a file path is clicked */
  onFileClick?: (path: string) => void;
  /** Optional empty state message */
  emptyMessage?: string;
  /** Whether to auto-scroll to bottom when new messages arrive (default: true) */
  autoScroll?: boolean;
  /** Theme variant: 'dark' | 'light' | 'auto' (default: 'auto') */
  theme?: 'dark' | 'light' | 'auto';
  /** Show empty state icon (default: true) */
  showEmptyIcon?: boolean;
}

/**
 * Extract text content from message parts
 */
function extractContent(parts: MessagePart[]): string {
  return parts.map((part) => part.text).join('');
}

/**
 * Convert ISO timestamp string to numeric timestamp
 */
function parseTimestamp(isoString: string): number {
  const date = new Date(isoString);
  return isNaN(date.getTime()) ? Date.now() : date.getTime();
}

/**
 * ChatViewer - A standalone component for displaying chat conversations
 *
 * Renders a conversation flow from JSONL-formatted data using existing
 * message components (UserMessage, AssistantMessage, ThinkingMessage).
 * This is a pure UI component without VSCode or external dependencies.
 *
 * @example
 * ```tsx
 * const messages = [
 *   { uuid: '1', type: 'user', message: { role: 'user', parts: [{ text: 'Hello!' }] }, ... },
 *   { uuid: '2', type: 'assistant', message: { role: 'model', parts: [{ text: 'Hi there!' }] }, ... },
 * ];
 *
 * <ChatViewer messages={messages} onFileClick={(path) => console.log(path)} />
 * ```
 *
 * @example With ref for programmatic control
 * ```tsx
 * const chatRef = useRef<ChatViewerHandle>(null);
 *
 * // Scroll to bottom programmatically
 * chatRef.current?.scrollToBottom('smooth');
 *
 * <ChatViewer ref={chatRef} messages={messages} />
 * ```
 */
export const ChatViewer = forwardRef<ChatViewerHandle, ChatViewerProps>(
  (
    {
      messages,
      className = '',
      onFileClick,
      emptyMessage = 'No messages to display',
      autoScroll = true,
      theme = 'auto',
      showEmptyIcon = true,
    },
    ref,
  ) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const scrollAnchorRef = useRef<HTMLDivElement>(null);
    const prevMessageCountRef = useRef(0);

    // Sort messages by timestamp and filter out system messages
    const sortedMessages = useMemo(
      () =>
        messages
          .filter((msg) => msg.type !== 'system')
          .sort(
            (a, b) => parseTimestamp(a.timestamp) - parseTimestamp(b.timestamp),
          ),
      [messages],
    );

    // Expose imperative handle for programmatic control
    useImperativeHandle(
      ref,
      () => ({
        scrollToBottom: (behavior: ScrollBehavior = 'smooth') => {
          const container = scrollContainerRef.current;
          if (container) {
            container.scrollTo({
              top: container.scrollHeight,
              behavior,
            });
          }
        },
        scrollToTop: (behavior: ScrollBehavior = 'smooth') => {
          const container = scrollContainerRef.current;
          if (container) {
            container.scrollTo({
              top: 0,
              behavior,
            });
          }
        },
        getScrollContainer: () => scrollContainerRef.current,
      }),
      [],
    );

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
      if (!autoScroll) return;

      const currentCount = sortedMessages.length;
      const prevCount = prevMessageCountRef.current;

      // Only auto-scroll when new messages are added
      if (currentCount > prevCount && scrollAnchorRef.current) {
        scrollAnchorRef.current.scrollIntoView({ behavior: 'smooth' });
      }

      prevMessageCountRef.current = currentCount;
    }, [sortedMessages.length, autoScroll]);

    // Render individual message based on type
    const renderMessage = (msg: ChatMessageData, index: number) => {
      const content = extractContent(msg.message.parts);
      const timestamp = parseTimestamp(msg.timestamp);
      const key = msg.uuid || `msg-${index}`;

      // Skip empty messages
      if (!content.trim()) {
        return null;
      }

      switch (msg.type) {
        case 'user':
          return (
            <UserMessage
              key={key}
              content={content}
              timestamp={timestamp}
              onFileClick={onFileClick}
            />
          );

        case 'assistant':
          // Check if this is a thinking message based on role
          if (msg.message.role === 'thinking') {
            return (
              <ThinkingMessage
                key={key}
                content={content}
                timestamp={timestamp}
                onFileClick={onFileClick}
              />
            );
          }
          return (
            <AssistantMessage
              key={key}
              content={content}
              timestamp={timestamp}
              onFileClick={onFileClick}
            />
          );

        default:
          return null;
      }
    };

    // Build container class names
    const containerClasses = [
      'chat-viewer-container',
      theme === 'light' ? 'light-theme' : '',
      theme === 'auto' ? 'auto-theme' : '',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div className={containerClasses}>
        <div ref={scrollContainerRef} className="chat-viewer-messages">
          {sortedMessages.length === 0 ? (
            <div className="chat-viewer-empty">
              {showEmptyIcon && (
                <div className="chat-viewer-empty-icon" aria-hidden="true">
                  💬
                </div>
              )}
              <div className="chat-viewer-empty-text">{emptyMessage}</div>
            </div>
          ) : (
            <>
              {sortedMessages.map((msg, index) => renderMessage(msg, index))}
              {/* Scroll anchor for auto-scroll functionality */}
              <div
                ref={scrollAnchorRef}
                className="chat-viewer-scroll-anchor"
              />
            </>
          )}
        </div>
      </div>
    );
  },
);

ChatViewer.displayName = 'ChatViewer';

export default ChatViewer;
