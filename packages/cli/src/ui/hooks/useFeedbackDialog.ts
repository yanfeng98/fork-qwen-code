import { useState, useCallback, useEffect } from 'react';
import {
  type Config,
  logUserFeedback,
  UserFeedbackEvent,
  type UserFeedbackRating,
} from '@qwen-code/qwen-code-core';
import { StreamingState, MessageType, type HistoryItem } from '../types.js';
import type { LoadedSettings } from '../../config/settings.js';
import type { SessionStatsState } from '../contexts/SessionContext.js';

export interface UseFeedbackDialogProps {
  config: Config;
  settings: LoadedSettings;
  streamingState: StreamingState;
  history: HistoryItem[];
  sessionStats: SessionStatsState;
}

export const useFeedbackDialog = ({
  config,
  settings,
  streamingState,
  history,
  sessionStats,
}: UseFeedbackDialogProps) => {
  // Feedback dialog state
  const [isFeedbackDialogOpen, setIsFeedbackDialogOpen] = useState(false);
  const [feedbackShownForSession, setFeedbackShownForSession] = useState(false);

  const openFeedbackDialog = useCallback(() => {
    setIsFeedbackDialogOpen(true);
    setFeedbackShownForSession(true);
  }, []);

  const closeFeedbackDialog = useCallback(
    () => setIsFeedbackDialogOpen(false),
    [],
  );

  const submitFeedback = useCallback(
    (rating: number) => {
      // Calculate session duration and turn count
      const sessionDurationMs =
        Date.now() - sessionStats.sessionStartTime.getTime();
      let lastUserMessageIndex = -1;
      for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].type === MessageType.USER) {
          lastUserMessageIndex = i;
          break;
        }
      }
      const turnCount =
        lastUserMessageIndex === -1 ? 0 : history.length - lastUserMessageIndex;

      // Create and log the feedback event
      const feedbackEvent = new UserFeedbackEvent(
        sessionStats.sessionId,
        rating as UserFeedbackRating,
        sessionDurationMs,
        turnCount,
        config.getModel(),
        config.getApprovalMode(),
      );

      logUserFeedback(config, feedbackEvent);
      closeFeedbackDialog();
    },
    [config, sessionStats, history, closeFeedbackDialog],
  );

  // Track when to show feedback dialog
  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    if (streamingState === StreamingState.Idle && history.length > 0) {
      // Find the last user message and check if there's AI response after it
      let lastUserMessageIndex = -1;
      let hasAIResponseAfterLastUser = false;

      for (let i = history.length - 1; i >= 0; i--) {
        if (history[i].type === MessageType.USER) {
          lastUserMessageIndex = i;
          break;
        }
      }

      // Check if there's any AI response (GEMINI message) after the last user message
      if (lastUserMessageIndex !== -1) {
        for (let i = lastUserMessageIndex + 1; i < history.length; i++) {
          if (history[i].type === MessageType.GEMINI) {
            hasAIResponseAfterLastUser = true;
            break;
          }
        }
      }

      const sessionDurationMs =
        Date.now() - sessionStats.sessionStartTime.getTime();

      // Show feedback dialog if:
      // 1. Telemetry is enabled (required for feedback submission)
      // 2. User feedback is enabled in settings
      // 3. There's an AI response after the last user message (real AI conversation)
      // 4. Session duration > 10 seconds (meaningful interaction)
      // 5. Not already shown for this session
      // 6. Random chance (25% probability)
      // Note: We check !isFeedbackDialogOpen to ensure it's not already open
      if (
        config.getUsageStatisticsEnabled() && // Only show if telemetry is enabled
        settings.merged.ui?.enableUserFeedback !== false && // Default to true if not set
        hasAIResponseAfterLastUser &&
        sessionDurationMs > 10000 && // 10 seconds minimum for meaningful interaction
        !feedbackShownForSession &&
        Math.random() < 0.25 // 25% probability
      ) {
        timeoutId = setTimeout(() => {
          openFeedbackDialog();
        }, 1000); // Delay to ensure user has time to see the completion
      }
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [
    streamingState,
    history,
    sessionStats,
    isFeedbackDialogOpen,
    feedbackShownForSession,
    openFeedbackDialog,
    settings.merged.ui?.enableUserFeedback,
    config,
  ]);

  return {
    isFeedbackDialogOpen,
    openFeedbackDialog,
    closeFeedbackDialog,
    submitFeedback,
  };
};
