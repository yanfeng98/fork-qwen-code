/**
 * @license
 * Copyright 2025 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Preview } from '@storybook/react-vite';
import React from 'react';
import './preview.css';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#1e1e1e' },
        { name: 'light', value: '#ffffff' },
      ],
    },
  },
  decorators: [
    (Story) =>
      React.createElement(
        'div',
        {
          style: {
            backgroundColor: 'var(--app-background)',
            color: 'var(--app-primary-foreground)',
            minHeight: '100px',
            padding: '16px',
          },
        },
        React.createElement(Story),
      ),
  ],
};

export default preview;
