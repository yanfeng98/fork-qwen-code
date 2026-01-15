/**
 * @license
 * Copyright 2025 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 *
 * Shared layout components for tool call UI
 * Now re-exports from @qwen-code/webui for backward compatibility
 */

// Re-export all layout components from webui
export {
  ToolCallContainer,
  ToolCallCard,
  ToolCallRow,
  StatusIndicator,
  CodeBlock,
  LocationsList,
} from '@qwen-code/webui';
export type { ToolCallContainerProps } from '@qwen-code/webui';
