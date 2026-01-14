import { useState, useCallback, useEffect } from 'react';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  type Config,
  logUserFeedback,
  UserFeedbackEvent,
  type UserFeedbackRating,
  Storage,
  isNodeError,
} from '@qwen-code/qwen-code-core';
import { StreamingState, MessageType, type HistoryItem } from '../types.js';
import type { LoadedSettings } from '../../config/settings.js';
import type { SessionStatsState } from '../contexts/SessionContext.js';

const FEEDBACK_SHOW_PROBABILITY = 0.25; // 25% probability of showing feedback dialog
const MIN_TOOL_CALLS = 10; // Minimum tool calls to show feedback dialog
const MIN_USER_MESSAGES = 5; // Minimum user messages to show feedback dialog

// Fatigue mechanism constants
const FEEDBACK_COOLDOWN_HOURS = 24; // Hours to wait before showing feedback dialog again
const FEEDBACK_HISTORY_FILENAME = 'feedback-history.json';

/**
 * Check if there's an AI response after the last user message in the conversation history
 */
const hasAIResponseAfterLastUserMessage = (history: HistoryItem[]): boolean => {
  // Find the last user message
  let lastUserMessageIndex = -1;
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
        return true;
      }
    }
  }

  return false;
};

/**
 * Count the number of user messages in the conversation history
 */
const countUserMessages = (history: HistoryItem[]): number =>
  history.filter((item) => item.type === MessageType.USER).length;

/**
 * Interface for feedback history storage
 */
interface FeedbackHistory {
  lastShownTimestamp: number;
}

/**
 * Get the feedback history file path using global Storage
 */
function getFeedbackHistoryPath(): string {
  const globalQwenDir = Storage.getGlobalQwenDir();
  return path.join(globalQwenDir, FEEDBACK_HISTORY_FILENAME);
}

/**
 * Get the last feedback dialog show time from file storage
 */
const getFeedbackHistory = async (): Promise<FeedbackHistory | null> => {
  try {
    const filePath = getFeedbackHistoryPath();
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as FeedbackHistory;
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      // File doesn't exist yet, which is normal for first time
      return null;
    }
    console.warn('Failed to read feedback history from file:', error);
    return null;
  }
};

/**
 * Save feedback history to file storage
 */
const saveFeedbackHistory = async (history: FeedbackHistory): Promise<void> => {
  try {
    const filePath = getFeedbackHistoryPath();

    // Ensure the directory exists
    await fs.mkdir(path.dirname(filePath), { recursive: true });

    // Write the history file
    await fs.writeFile(filePath, JSON.stringify(history, null, 2), 'utf-8');
  } catch (error) {
    console.warn('Failed to save feedback history to file:', error);
  }
};

/**
 * Check if we should show the feedback dialog based on fatigue mechanism
 */
const shouldShowFeedbackBasedOnFatigue = async (): Promise<boolean> => {
  const history = await getFeedbackHistory();
  if (!history) return true; // No history, allow showing

  const now = Date.now();
  const timeSinceLastShown = now - history.lastShownTimestamp;
  const cooldownMs = FEEDBACK_COOLDOWN_HOURS * 60 * 60 * 1000;

  return timeSinceLastShown >= cooldownMs;
};

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

    // Record the timestamp when feedback dialog is shown (fire and forget)
    saveFeedbackHistory({
      lastShownTimestamp: Date.now(),
    });
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

  useEffect(() => {
    const checkAndShowFeedback = async () => {
      if (streamingState === StreamingState.Idle && history.length > 0) {
        const hasAIResponseAfterLastUser =
          hasAIResponseAfterLastUserMessage(history);

        const sessionDurationMs =
          Date.now() - sessionStats.sessionStartTime.getTime();

        // Get tool calls count and user messages count
        const toolCallsCount = sessionStats.metrics.tools.totalCalls;
        const userMessagesCount = countUserMessages(history);

        // Check if the session meets the minimum requirements:
        // Either tool calls > 10 OR user messages > 5
        const meetsMinimumRequirements =
          toolCallsCount > MIN_TOOL_CALLS ||
          userMessagesCount > MIN_USER_MESSAGES;

        // Check fatigue mechanism (async)
        let passedFatigueCheck = false;
        try {
          passedFatigueCheck = await shouldShowFeedbackBasedOnFatigue();
        } catch (error) {
          console.warn('Failed to check feedback fatigue:', error);
        }

        // Show feedback dialog if:
        // 1. Telemetry is enabled (required for feedback submission)
        // 2. User feedback is enabled in settings
        // 3. There's an AI response after the last user message (real AI conversation)
        // 4. Session duration > 10 seconds (meaningful interaction)
        // 5. Not already shown for this session
        // 6. Random chance (25% probability)
        // 7. Meets minimum requirements (tool calls > 10 OR user messages > 5)
        // 8. Fatigue mechanism allows showing (not shown recently across sessions)
        if (
          config.getUsageStatisticsEnabled() &&
          settings.merged.ui?.enableUserFeedback !== false &&
          hasAIResponseAfterLastUser &&
          sessionDurationMs > 10000 &&
          !feedbackShownForSession &&
          Math.random() < FEEDBACK_SHOW_PROBABILITY &&
          meetsMinimumRequirements &&
          passedFatigueCheck
        ) {
          openFeedbackDialog();
        }
      }
    };

    checkAndShowFeedback().catch((error) => {
      console.warn('Error in feedback check:', error);
    });
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
