/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { Box, Text } from 'ink';
import type { RadioSelectItem } from './components/shared/RadioButtonSelect.js';
import { RadioButtonSelect } from './components/shared/RadioButtonSelect.js';
import { useKeypress } from './hooks/useKeypress.js';
import { theme } from './semantic-colors.js';

export type CommandMigrationNudgeResult = {
  userSelection: 'yes' | 'no';
};

interface CommandFormatMigrationNudgeProps {
  tomlFiles: string[];
  onComplete: (result: CommandMigrationNudgeResult) => void;
}

export function CommandFormatMigrationNudge({
  tomlFiles,
  onComplete,
}: CommandFormatMigrationNudgeProps) {
  useKeypress(
    (key) => {
      if (key.name === 'escape') {
        onComplete({
          userSelection: 'no',
        });
      }
    },
    { isActive: true },
  );

  const OPTIONS: Array<RadioSelectItem<CommandMigrationNudgeResult>> = [
    {
      label: 'Yes',
      value: {
        userSelection: 'yes',
      },
      key: 'Yes',
    },
    {
      label: 'No (esc)',
      value: {
        userSelection: 'no',
      },
      key: 'No (esc)',
    },
  ];

  const count = tomlFiles.length;
  const fileList =
    count <= 3
      ? tomlFiles.map((f) => `  • ${f}`).join('\n')
      : `  • ${tomlFiles.slice(0, 2).join('\n  • ')}\n  • ... and ${count - 2} more`;

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.status.warning}
      padding={1}
      width="100%"
      marginLeft={1}
    >
      <Box marginBottom={1} flexDirection="column">
        <Text>
          <Text color={theme.status.warning}>{'⚠️  '}</Text>
          <Text bold>Command Format Migration</Text>
        </Text>
        <Text color={theme.text.secondary}>
          {`Found ${count} TOML command file${count > 1 ? 's' : ''}:`}
        </Text>
        <Text color={theme.text.secondary}>{fileList}</Text>
        <Text>{''}</Text>
        <Text color={theme.text.secondary}>
          The TOML format is deprecated. Would you like to migrate them to
          Markdown format?
        </Text>
        <Text color={theme.text.secondary}>
          (Backups will be created and original files will be preserved)
        </Text>
      </Box>
      <RadioButtonSelect items={OPTIONS} onSelect={onComplete} />
    </Box>
  );
}
