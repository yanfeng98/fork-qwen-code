/**
 * @license
 * Copyright 2025 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import type { FC, RefObject } from 'react';

export interface PermissionOption {
  name: string;
  kind: string;
  optionId: string;
}

export interface PermissionToolCall {
  title?: string;
  kind?: string;
  toolCallId?: string;
  rawInput?: {
    command?: string;
    description?: string;
    [key: string]: unknown;
  };
  content?: Array<{
    type: string;
    [key: string]: unknown;
  }>;
  locations?: Array<{
    path: string;
    line?: number | null;
  }>;
  status?: string;
}

export interface PermissionDrawerProps {
  isOpen: boolean;
  options: PermissionOption[];
  toolCall: PermissionToolCall;
  onResponse: (optionId: string) => void;
  onClose?: () => void;
}

const PermissionDrawer: FC<PermissionDrawerProps> = ({
  isOpen,
  options,
  toolCall,
  onResponse,
  onClose,
}) => {
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [customMessage, setCustomMessage] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const customInputRef = useRef<HTMLInputElement>(null);

  // Prefer file name from locations, fall back to content[].path if present
  const getAffectedFileName = (): string => {
    const fromLocations = toolCall.locations?.[0]?.path;
    if (fromLocations) {
      return fromLocations.split('/').pop() || fromLocations;
    }
    // Some tool calls (e.g. write/edit with diff content) only include path in content
    const fromContent = Array.isArray(toolCall.content)
      ? (
          toolCall.content.find(
            (c: unknown) =>
              typeof c === 'object' &&
              c !== null &&
              'path' in (c as Record<string, unknown>),
          ) as { path?: unknown } | undefined
        )?.path
      : undefined;
    if (typeof fromContent === 'string' && fromContent.length > 0) {
      return fromContent.split('/').pop() || fromContent;
    }
    return 'file';
  };

  // Get the title for the permission request
  const getTitle = () => {
    if (toolCall.kind === 'edit' || toolCall.kind === 'write') {
      const fileName = getAffectedFileName();
      return (
        <>
          Make this edit to{' '}
          <span className="font-mono text-[var(--app-primary-foreground)]">
            {fileName}
          </span>
          ?
        </>
      );
    }
    if (toolCall.kind === 'execute' || toolCall.kind === 'bash') {
      return 'Allow this bash command?';
    }
    if (toolCall.kind === 'read') {
      const fileName = getAffectedFileName();
      return (
        <>
          Allow read from{' '}
          <span className="font-mono text-[var(--app-primary-foreground)]">
            {fileName}
          </span>
          ?
        </>
      );
    }
    return toolCall.title || 'Permission Required';
  };

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) {
        return;
      }

      // Number keys 1-9 for quick select
      const numMatch = e.key.match(/^[1-9]$/);
      if (
        numMatch &&
        !customInputRef.current?.contains(document.activeElement)
      ) {
        const index = parseInt(e.key, 10) - 1;
        if (index < options.length) {
          e.preventDefault();
          onResponse(options[index].optionId);
        }
        return;
      }

      // Arrow keys for navigation
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const totalItems = options.length + 1; // +1 for custom input
        if (e.key === 'ArrowDown') {
          setFocusedIndex((prev) => (prev + 1) % totalItems);
        } else {
          setFocusedIndex((prev) => (prev - 1 + totalItems) % totalItems);
        }
      }

      // Enter to select
      if (
        e.key === 'Enter' &&
        !customInputRef.current?.contains(document.activeElement)
      ) {
        e.preventDefault();
        if (focusedIndex < options.length) {
          onResponse(options[focusedIndex].optionId);
        }
      }

      // Escape to cancel permission and close (align with CLI behavior)
      if (e.key === 'Escape') {
        e.preventDefault();
        const rejectOptionId =
          options.find((o) => o.kind.includes('reject'))?.optionId ||
          options.find((o) => o.optionId === 'cancel')?.optionId ||
          'cancel';
        onResponse(rejectOptionId);
        if (onClose) {
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, options, onResponse, onClose, focusedIndex]);

  // Focus container when opened
  useEffect(() => {
    if (isOpen && containerRef.current) {
      containerRef.current.focus();
    }
  }, [isOpen]);

  // Reset focus to the first option when the drawer opens or the options change
  useEffect(() => {
    if (isOpen) {
      setFocusedIndex(0);
    }
  }, [isOpen, options.length]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-[1000] p-2">
      {/* Main container */}
      <div
        ref={containerRef}
        className="relative flex flex-col rounded-large border p-2 outline-none animate-slide-up"
        style={{
          backgroundColor: 'var(--app-input-secondary-background)',
          borderColor: 'var(--app-input-border)',
        }}
        tabIndex={0}
        data-focused-index={focusedIndex}
      >
        {/* Background layer */}
        <div
          className="p-2 absolute inset-0 rounded-large"
          style={{ backgroundColor: 'var(--app-input-background)' }}
        />

        {/* Title + Description (from toolCall.title) */}
        <div className="relative z-[1] text-[1.1em] text-[var(--app-primary-foreground)] flex flex-col min-h-0">
          <div className="font-bold text-[var(--app-primary-foreground)] mb-0.5">
            {getTitle()}
          </div>
          {(toolCall.kind === 'edit' ||
            toolCall.kind === 'write' ||
            toolCall.kind === 'read' ||
            toolCall.kind === 'execute' ||
            toolCall.kind === 'bash') &&
            toolCall.title && (
              <div
                /* 13px, normal font weight; normal whitespace wrapping + long word breaking; maximum 3 lines with overflow ellipsis */
                className="text-[13px] font-normal text-[var(--app-secondary-foreground)] opacity-90 font-mono whitespace-normal break-words q-line-clamp-3 mb-2"
                style={{
                  fontSize: '.9em',
                  color: 'var(--app-secondary-foreground)',
                  marginBottom: '6px',
                }}
                title={toolCall.title}
              >
                {toolCall.title}
              </div>
            )}
        </div>

        {/* Options */}
        <div className="relative z-[1] flex flex-col gap-1 pb-1">
          {options.map((option, index) => {
            const isFocused = focusedIndex === index;

            return (
              <button
                key={option.optionId}
                className={`flex items-center gap-2 px-2 py-1.5 text-left w-full box-border rounded-[4px] border-0 shadow-[inset_0_0_0_1px_var(--app-transparent-inner-border)] transition-colors duration-150 text-[var(--app-primary-foreground)] hover:bg-[var(--app-button-background)] ${
                  isFocused
                    ? 'text-[var(--app-list-active-foreground)] bg-[var(--app-list-active-background)] hover:text-[var(--app-button-foreground)] hover:font-bold hover:relative hover:border-0'
                    : 'hover:bg-[var(--app-button-background)] hover:text-[var(--app-button-foreground)] hover:font-bold hover:relative hover:border-0'
                }`}
                onClick={() => onResponse(option.optionId)}
                onMouseEnter={() => setFocusedIndex(index)}
              >
                {/* Number badge */}
                <span className="inline-flex items-center justify-center min-w-[10px] h-5 font-semibold opacity-60">
                  {index + 1}
                </span>
                {/* Option text */}
                <span className="font-semibold">{option.name}</span>
              </button>
            );
          })}

          {(() => {
            const isFocused = focusedIndex === options.length;
            const rejectOptionId = options.find((o) =>
              o.kind.includes('reject'),
            )?.optionId;
            return (
              <CustomMessageInputRow
                isFocused={isFocused}
                customMessage={customMessage}
                setCustomMessage={setCustomMessage}
                onFocusRow={() => setFocusedIndex(options.length)}
                onSubmitReject={() => {
                  if (rejectOptionId) {
                    onResponse(rejectOptionId);
                  }
                }}
                inputRef={customInputRef}
              />
            );
          })()}
        </div>
      </div>
    </div>
  );
};

interface CustomMessageInputRowProps {
  isFocused: boolean;
  customMessage: string;
  setCustomMessage: (val: string) => void;
  onFocusRow: () => void;
  onSubmitReject: () => void;
  inputRef: RefObject<HTMLInputElement | null>;
}

const CustomMessageInputRow: FC<CustomMessageInputRowProps> = ({
  isFocused,
  customMessage,
  setCustomMessage,
  onFocusRow,
  onSubmitReject,
  inputRef,
}) => (
  <div
    className={`flex items-center gap-2 px-2 py-1.5 text-left w-full box-border rounded-[4px] border-0 shadow-[inset_0_0_0_1px_var(--app-transparent-inner-border)] cursor-text text-[var(--app-primary-foreground)] ${
      isFocused ? 'text-[var(--app-list-active-foreground)]' : ''
    }`}
    onMouseEnter={onFocusRow}
    onClick={() => inputRef.current?.focus()}
  >
    <input
      ref={inputRef as unknown as RefObject<HTMLInputElement>}
      type="text"
      placeholder="Tell Qwen what to do instead"
      spellCheck={false}
      className="flex-1 bg-transparent border-0 outline-none text-sm placeholder:opacity-70"
      style={{ color: 'var(--app-input-foreground)' }}
      value={customMessage}
      onChange={(e) => setCustomMessage(e.target.value)}
      onFocus={onFocusRow}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey && customMessage.trim()) {
          e.preventDefault();
          onSubmitReject();
        }
      }}
    />
  </div>
);

export default PermissionDrawer;
