/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type React from 'react';
import { Box, Text } from 'ink';
import Gradient from 'ink-gradient';
import { AuthType, shortenPath, tildeifyPath } from '@qwen-code/qwen-code-core';
import { theme } from '../semantic-colors.js';
import { shortAsciiLogo } from './AsciiArt.js';
import { getAsciiArtWidth } from '../utils/textUtils.js';
import { useTerminalSize } from '../hooks/useTerminalSize.js';

interface HeaderProps {
  customAsciiArt?: string; // For user-defined ASCII art
  version: string;
  authType?: AuthType;
  model: string;
  workingDirectory: string;
}

// Format auth type for display
function formatAuthType(authType?: AuthType): string {
  switch (authType) {
    case AuthType.QWEN_OAUTH:
      return 'Qwen OAuth';
    case AuthType.USE_OPENAI:
      return 'OpenAI';
    default:
      return 'Unknown';
  }
}

export const Header: React.FC<HeaderProps> = ({
  customAsciiArt,
  version,
  authType,
  model,
  workingDirectory,
}) => {
  const { columns: terminalWidth } = useTerminalSize();

  const displayLogo = customAsciiArt ?? shortAsciiLogo;
  const logoWidth = getAsciiArtWidth(displayLogo);
  const formattedAuthType = formatAuthType(authType);

  // Calculate available space properly:
  // First determine if logo can be shown, then use remaining space for path
  const logoGap = 4; // Gap between logo and info panel
  const infoPanelPadding = 4; // paddingX={1} on each side + borders = ~4 chars
  const minPathLength = 40; // Minimum readable path length
  const minInfoPanelWidth = minPathLength + infoPanelPadding;

  // Check if we have enough space for logo + gap + minimum info panel
  const showLogo = terminalWidth >= logoWidth + logoGap + minInfoPanelWidth;

  // Calculate available width for info panel (use all remaining space)
  const availableInfoPanelWidth = showLogo
    ? terminalWidth - logoWidth - logoGap
    : terminalWidth;

  // Calculate max path length (subtract padding/borders from available space)
  const maxPathLength = Math.max(
    minPathLength,
    availableInfoPanelWidth - infoPanelPadding,
  );

  // Now shorten the path to fit the available space
  const displayPath = shortenPath(
    tildeifyPath(workingDirectory),
    maxPathLength,
  );

  // Use theme gradient colors if available, otherwise use text colors (excluding primary)
  const gradientColors = theme.ui.gradient || [
    theme.text.secondary,
    theme.text.link,
    theme.text.accent,
  ];

  return (
    <Box flexDirection="row" alignItems="center" marginLeft={2} marginRight={2}>
      {/* Left side: ASCII logo (only if enough space) */}
      {showLogo && (
        <>
          <Box flexShrink={0}>
            <Gradient colors={gradientColors}>
              <Text>{displayLogo}</Text>
            </Gradient>
          </Box>
          {/* Fixed gap between logo and info panel */}
          <Box width={4} />
        </>
      )}

      {/* Right side: Info panel (flexible width) */}
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={theme.border.default}
        paddingX={1}
        flexGrow={1}
      >
        {/* Title line: >_ Qwen Code (v{version}) */}
        <Text>
          <Text bold color={theme.text.accent}>
            &gt;_ Qwen Code
          </Text>
          <Text color={theme.text.secondary}> (v{version})</Text>
        </Text>
        {/* Empty line for spacing */}
        <Text> </Text>
        {/* Auth and Model line */}
        <Text>
          <Text color={theme.text.secondary}>
            {formattedAuthType} | {model}
          </Text>
          <Text color={theme.text.secondary}> (/auth to change)</Text>
        </Text>
        {/* Directory line */}
        <Text color={theme.text.secondary}>{displayPath}</Text>
      </Box>
    </Box>
  );
};
