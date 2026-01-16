/**
 * @license
 * Copyright 2025 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Meta, StoryObj } from '@storybook/react-vite';
import { ThinkingMessage } from './ThinkingMessage.js';

/**
 * ThinkingMessage component displays AI's internal thought process.
 * Shows with animated dots and distinctive styling.
 */
const meta: Meta<typeof ThinkingMessage> = {
  title: 'Messages/ThinkingMessage',
  component: ThinkingMessage,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    content: {
      control: 'text',
      description: 'The thinking content to display',
    },
    timestamp: {
      control: 'number',
      description: 'Message timestamp',
    },
    onFileClick: { action: 'fileClicked' },
  },
  decorators: [
    (Story) => (
      <div
        style={{
          background: 'var(--app-background, #1e1e1e)',
          padding: '20px',
        }}
      >
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    content: 'Let me analyze this code and think about the best approach...',
    timestamp: Date.now(),
  },
};

export const ShortThought: Story = {
  args: {
    content: 'Checking dependencies...',
    timestamp: Date.now(),
  },
};

export const LongThought: Story = {
  args: {
    content: `I need to consider several factors here:
1. The function structure and its dependencies
2. The type annotations and their implications
3. How this integrates with the rest of the codebase
4. Performance implications of the proposed changes

Let me work through each of these systematically...`,
    timestamp: Date.now(),
  },
};

export const WithFilePath: Story = {
  args: {
    content:
      'Looking at the code in `src/utils/helpers.ts` to understand the pattern...',
    timestamp: Date.now(),
  },
};

export const CodeAnalysis: Story = {
  args: {
    content:
      'The current implementation uses a recursive approach. I should consider whether an iterative solution would be more efficient for large inputs.',
    timestamp: Date.now(),
  },
};
