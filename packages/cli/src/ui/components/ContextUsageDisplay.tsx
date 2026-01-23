/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Text } from 'ink';
import { theme } from '../semantic-colors.js';
import { tokenLimit, type Config } from '@qwen-code/qwen-code-core';

export const ContextUsageDisplay = ({
  promptTokenCount,
  model,
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

  const contentGeneratorConfig = config.getContentGeneratorConfig();
  const contextLimit = tokenLimit(model, 'input', contentGeneratorConfig);
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
