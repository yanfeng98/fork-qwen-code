/**
 * @license
 * Copyright 2025 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 *
 * FileLink component - Clickable file path links
 * Platform-agnostic version using PlatformContext
 * Supports clicking to open files and jump to specified line and column numbers
 */

import type React from 'react';
import { usePlatform } from '../../context/PlatformContext.js';

/**
 * Props for FileLink component
 */
export interface FileLinkProps {
  /** File path */
  path: string;
  /** Optional line number (starting from 1) */
  line?: number | null;
  /** Optional column number (starting from 1) */
  column?: number | null;
  /** Whether to show full path, default false (show filename only) */
  showFullPath?: boolean;
  /** Optional custom class name */
  className?: string;
  /** Whether to disable click behavior (use when parent element handles clicks) */
  disableClick?: boolean;
}

/**
 * Extract filename from full path
 * @param path File path
 * @returns Filename
 */
function getFileName(path: string): string {
  const segments = path.split(/[/\\]/);
  return segments[segments.length - 1] || path;
}

/**
 * Build full path string including line and column numbers
 * @param path Base file path
 * @param line Optional line number
 * @param column Optional column number
 * @returns Full path with line:column suffix if provided
 */
function buildFullPath(
  path: string,
  line?: number | null,
  column?: number | null,
): string {
  let fullPath = path;
  if (line !== null && line !== undefined) {
    fullPath += `:${line}`;
    if (column !== null && column !== undefined) {
      fullPath += `:${column}`;
    }
  }
  return fullPath;
}

/**
 * FileLink component - Clickable file link
 *
 * Features:
 * - Click to open file using platform-specific handler
 * - Support line and column number navigation
 * - Hover to show full path
 * - Optional display mode (full path vs filename only)
 *
 * @example
 * ```tsx
 * <FileLink path="/src/App.tsx" line={42} />
 * <FileLink path="/src/components/Button.tsx" line={10} column={5} showFullPath={true} />
 * ```
 */
export const FileLink: React.FC<FileLinkProps> = ({
  path,
  line,
  column,
  showFullPath = false,
  className = '',
  disableClick = false,
}) => {
  const platform = usePlatform();

  /**
   * Handle click event - Open file using platform-specific method
   */
  const handleClick = (e: React.MouseEvent) => {
    // Always prevent default behavior (prevent <a> tag # navigation)
    e.preventDefault();

    if (disableClick) {
      // If click is disabled, return directly without stopping propagation
      // This allows parent elements to handle click events
      return;
    }

    // If click is enabled, stop event propagation
    e.stopPropagation();

    // Build full path including line and column numbers
    const fullPath = buildFullPath(path, line, column);

    // Use platform-specific openFile if available, otherwise use postMessage
    if (platform.openFile) {
      platform.openFile(fullPath);
    } else {
      platform.postMessage({
        type: 'openFile',
        data: { path: fullPath },
      });
    }
  };

  // Build display text
  const displayPath = showFullPath ? path : getFileName(path);

  // Build hover tooltip (always show full path)
  const fullDisplayText = buildFullPath(path, line, column);

  return (
    <a
      href="#"
      className={[
        'file-link',
        // Layout + interaction
        // Use items-center + leading-none to vertically center within surrounding rows
        'inline-flex items-center leading-none',
        disableClick
          ? 'pointer-events-none cursor-[inherit] hover:no-underline'
          : 'cursor-pointer',
        // Typography + color: match theme body text and fixed size
        'text-[11px] no-underline hover:underline',
        'text-[var(--app-primary-foreground)]',
        // Transitions
        'transition-colors duration-100 ease-in-out',
        // Focus ring (keyboard nav)
        'focus:outline focus:outline-1 focus:outline-[var(--vscode-focusBorder)] focus:outline-offset-2 focus:rounded-[2px]',
        // Active state
        'active:opacity-80',
        className,
      ].join(' ')}
      onClick={handleClick}
      title={fullDisplayText}
      role="button"
      aria-label={`Open file: ${fullDisplayText}`}
    >
      <span className="file-link-path">{displayPath}</span>
      {line !== null && line !== undefined && (
        <span className="file-link-location opacity-70 text-[0.9em] font-normal dark:opacity-60">
          :{line}
          {column !== null && column !== undefined && <>:{column}</>}
        </span>
      )}
    </a>
  );
};
