/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { promises as fs } from 'node:fs';
import util from 'node:util';
import { Storage } from '../config/storage.js';

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export interface DebugLogSession {
  getSessionId: () => string;
}

export interface DebugLogger {
  debug: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

let ensureDebugDirPromise: Promise<void> | null = null;
let hasWriteFailure = false;

function ensureDebugDirExists(): Promise<void> {
  if (!ensureDebugDirPromise) {
    ensureDebugDirPromise = fs
      .mkdir(Storage.getGlobalDebugDir(), { recursive: true })
      .then(() => undefined)
      .catch(() => {
        hasWriteFailure = true;
        ensureDebugDirPromise = null;
      });
  }
  return ensureDebugDirPromise ?? Promise.resolve();
}

function formatArgs(args: unknown[]): string {
  return args
    .map((arg) => {
      if (arg instanceof Error) {
        return arg.stack ?? `${arg.name}: ${arg.message}`;
      }
      return arg;
    })
    .map((arg) => (typeof arg === 'string' ? arg : util.inspect(arg)))
    .join(' ');
}

/**
 * Builds a log line in the format:
 * `2026-01-23T06:58:02.011Z [DEBUG] [TAG] message`
 *
 * Tag is optional. If not provided, format is:
 * `2026-01-23T06:58:02.011Z [DEBUG] message`
 */
function buildLogLine(level: LogLevel, message: string, tag?: string): string {
  const timestamp = new Date().toISOString();
  const tagPart = tag ? ` [${tag}]` : '';
  return `${timestamp} [${level}]${tagPart} ${message}\n`;
}

function writeLog(
  session: DebugLogSession,
  level: LogLevel,
  tag: string | undefined,
  args: unknown[],
): void {
  const sessionId = session.getSessionId();
  const logFilePath = Storage.getDebugLogPath(sessionId);
  const message = formatArgs(args);
  const line = buildLogLine(level, message, tag);

  void ensureDebugDirExists()
    .then(() => fs.appendFile(logFilePath, line, 'utf8'))
    .catch(() => {
      hasWriteFailure = true;
    });
}

/**
 * Returns true if any debug log write has failed.
 * Used by the UI to show a degraded mode notice on startup.
 */
export function isDebugLoggingDegraded(): boolean {
  return hasWriteFailure;
}

/**
 * Resets the write failure tracking state.
 * Primarily useful for testing.
 */
export function resetDebugLoggingState(): void {
  hasWriteFailure = false;
  ensureDebugDirPromise = null;
}

/**
 * Creates a debug logger that writes to a session-specific log file.
 *
 * Log files are written to `~/.qwen/debug/<sessionId>.txt`.
 * Write failures are silently ignored to avoid disrupting the user.
 */
export function createDebugLogger(
  session: DebugLogSession | null | undefined,
  tag?: string,
): DebugLogger {
  if (!session) {
    return {
      debug: () => {},
      info: () => {},
      warn: () => {},
      error: () => {},
    };
  }

  return {
    debug: (...args: unknown[]) => writeLog(session, 'DEBUG', tag, args),
    info: (...args: unknown[]) => writeLog(session, 'INFO', tag, args),
    warn: (...args: unknown[]) => writeLog(session, 'WARN', tag, args),
    error: (...args: unknown[]) => writeLog(session, 'ERROR', tag, args),
  };
}
