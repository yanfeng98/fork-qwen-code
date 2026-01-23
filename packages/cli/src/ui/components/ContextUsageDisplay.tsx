/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Text } from 'ink';
import { theme } from '../semantic-colors.js';
import { DEFAULT_TOKEN_LIMIT, type Config } from '@qwen-code/qwen-code-core';

export const ContextUsageDisplay = ({
  promptTokenCount,
  model: _model,
  terminalWidth,
  config,
}: {
  promptTokenCount: number;
  model: string;
  terminalWidth: number;
  config: Config;
}) => {
  if (promptTokenCount === 0) {
    return null;
  }

  const contextLimit =
    config.getContentGeneratorConfig()?.contextWindowSize ??
    DEFAULT_TOKEN_LIMIT;
  const percentage = promptTokenCount / contextLimit;
  const percentageUsed = (percentage * 100).toFixed(1);

  const label = terminalWidth < 100 ? '% used' : '% context used';

  return (
    <Text color={theme.text.secondary}>
      {percentageUsed}
      {label}
    </Text>
  );
};
