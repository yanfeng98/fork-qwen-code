import { Box, Text } from 'ink';
import type React from 'react';
import { t } from '../i18n/index.js';
import { useUIActions } from './contexts/UIActionsContext.js';
import { useUIState } from './contexts/UIStateContext.js';
import { useKeypress } from './hooks/useKeypress.js';

export const FeedbackDialog: React.FC = () => {
  const uiState = useUIState();
  const uiActions = useUIActions();

  useKeypress(
    (key) => {
      if (key.name === 'escape') {
        uiActions.closeFeedbackDialog();
      } else if (key.name === '1') {
        uiActions.submitFeedback(1);
      } else if (key.name === '2') {
        uiActions.submitFeedback(2);
      } else if (key.name === '3') {
        uiActions.submitFeedback(3);
      } else if (key.name === '0') {
        uiActions.closeFeedbackDialog();
      }
    },
    { isActive: uiState.isFeedbackDialogOpen },
  );

  if (!uiState.isFeedbackDialogOpen) {
    return null;
  }

  return (
    <Box flexDirection="column" marginY={1}>
      <Box>
        <Text color="cyan">● </Text>
        <Text bold>{t('How is Qwen doing this session? (optional)')}</Text>
      </Box>
      <Box marginTop={1}>
        <Text color="cyan">1: </Text>
        <Text>{t('Bad')}</Text>
        <Text> </Text>
        <Text color="cyan">2: </Text>
        <Text>{t('Fine')}</Text>
        <Text> </Text>
        <Text color="cyan">3: </Text>
        <Text>{t('Good')}</Text>
        <Text> </Text>
        <Text color="cyan">0: </Text>
        <Text>{t('Dismiss')}</Text>
      </Box>
    </Box>
  );
};
