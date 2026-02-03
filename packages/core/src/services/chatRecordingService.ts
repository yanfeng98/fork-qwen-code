import { type Config } from '../config/config.js';
import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import {
  type PartListUnion,
  type Content,
  type GenerateContentResponseUsageMetadata,
  createUserContent,
  createModelContent,
} from '@google/genai';
import * as jsonl from '../utils/jsonl-utils.js';
import { getGitBranch } from '../utils/gitUtils.js';
import type {
  ChatCompressionInfo,
  ToolCallResponseInfo,
} from '../core/turn.js';
import type { Status } from '../core/coreToolScheduler.js';
import type { TaskResultDisplay } from '../tools/tools.js';
import type { UiEvent } from '../telemetry/uiTelemetry.js';

export interface ChatRecord {
  uuid: string;
  parentUuid: string | null;
  sessionId: string;
  timestamp: string;
  type: 'user' | 'assistant' | 'tool_result' | 'system';
  subtype?: 'chat_compression' | 'slash_command' | 'ui_telemetry';
  cwd: string;
  version: string;
  gitBranch?: string;

  message?: Content;

  usageMetadata?: GenerateContentResponseUsageMetadata;
  model?: string;
  toolCallResult?: Partial<ToolCallResponseInfo>;
  systemPayload?:
    | ChatCompressionRecordPayload
    | SlashCommandRecordPayload
    | UiTelemetryRecordPayload;
}

export interface ChatCompressionRecordPayload {
  info: ChatCompressionInfo;
  compressedHistory: Content[];
}

export interface SlashCommandRecordPayload {
  /** Whether this record represents the invocation or the resulting output. */
  phase: 'invocation' | 'result';
  /** Raw user-entered slash command (e.g., "/about"). */
  rawCommand: string;
  /**
   * History items the UI displayed for this command, in the same shape used by
   * the CLI (without IDs). Stored as plain objects for replay on resume.
   */
  outputHistoryItems?: Array<Record<string, unknown>>;
}

export interface UiTelemetryRecordPayload {
  uiEvent: UiEvent;
}

export class ChatRecordingService {
  private lastRecordUuid: string | null = null;
  private readonly config: Config;

  constructor(config: Config) {
    this.config = config;
    this.lastRecordUuid =
      config.getResumedSessionData()?.lastCompletedUuid ?? null;
  }

  private getSessionId(): string {
    return this.config.getSessionId();
  }

  private ensureChatsDir(): string {
    const projectDir = this.config.storage.getProjectDir();
    const chatsDir = path.join(projectDir, 'chats');

    try {
      fs.mkdirSync(chatsDir, { recursive: true });
    } catch {
      // Ignore errors - directory will be created if it doesn't exist
    }

    return chatsDir;
  }

  private ensureConversationFile(): string {
    const chatsDir = this.ensureChatsDir();
    const sessionId = this.getSessionId();
    const safeFilename = `${sessionId}.jsonl`;
    const conversationFile = path.join(chatsDir, safeFilename);

    if (fs.existsSync(conversationFile)) {
      return conversationFile;
    }

    try {
      fs.writeFileSync(conversationFile, '', { flag: 'wx', encoding: 'utf8' });
    } catch (error) {
      const nodeError = error as NodeJS.ErrnoException;
      if (nodeError.code !== 'EEXIST') {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          `Failed to create conversation file at ${conversationFile}: ${message}`,
        );
      }
    }

    return conversationFile;
  }

  private createBaseRecord(
    type: ChatRecord['type'],
  ): Omit<ChatRecord, 'message' | 'tokens' | 'model' | 'toolCallsMetadata'> {
    return {
      uuid: randomUUID(),
      parentUuid: this.lastRecordUuid,
      sessionId: this.getSessionId(),
      timestamp: new Date().toISOString(),
      type,
      cwd: this.config.getProjectRoot(),
      version: this.config.getCliVersion() || 'unknown',
      gitBranch: getGitBranch(this.config.getProjectRoot()),
    };
  }

  private appendRecord(record: ChatRecord): void {
    try {
      const conversationFile = this.ensureConversationFile();

      jsonl.writeLineSync(conversationFile, record);
      this.lastRecordUuid = record.uuid;
    } catch (error) {
      console.error('Error appending record:', error);
      throw error;
    }
  }

  recordUserMessage(message: PartListUnion): void {
    try {
      const record: ChatRecord = {
        ...this.createBaseRecord('user'),
        message: createUserContent(message),
      };
      this.appendRecord(record);
    } catch (error) {
      console.error('Error saving user message:', error);
    }
  }

  /**
   * Records an assistant turn with all available data.
   * Writes immediately to disk.
   *
   * @param data.message The raw PartListUnion object from the model response
   * @param data.model The model name
   * @param data.tokens Token usage statistics
   * @param data.toolCallsMetadata Enriched tool call info for UI recovery
   */
  recordAssistantTurn(data: {
    model: string;
    message?: PartListUnion;
    tokens?: GenerateContentResponseUsageMetadata;
  }): void {
    try {
      const record: ChatRecord = {
        ...this.createBaseRecord('assistant'),
        model: data.model,
      };

      if (data.message !== undefined) {
        record.message = createModelContent(data.message);
      }

      if (data.tokens) {
        record.usageMetadata = data.tokens;
      }

      this.appendRecord(record);
    } catch (error) {
      console.error('Error saving assistant turn:', error);
    }
  }

  /**
   * Records tool results (function responses) sent back to the model.
   * Writes immediately to disk.
   *
   * @param message The raw PartListUnion object with functionResponse parts
   * @param toolCallResult Optional tool call result info for UI recovery
   */
  recordToolResult(
    message: PartListUnion,
    toolCallResult?: Partial<ToolCallResponseInfo> & { status: Status },
  ): void {
    try {
      const record: ChatRecord = {
        ...this.createBaseRecord('tool_result'),
        message: createUserContent(message),
      };

      if (toolCallResult) {
        // special case for task executions - we don't want to record the tool calls
        if (
          typeof toolCallResult.resultDisplay === 'object' &&
          toolCallResult.resultDisplay !== null &&
          'type' in toolCallResult.resultDisplay &&
          toolCallResult.resultDisplay.type === 'task_execution'
        ) {
          const taskResult = toolCallResult.resultDisplay as TaskResultDisplay;
          record.toolCallResult = {
            ...toolCallResult,
            resultDisplay: {
              ...taskResult,
              toolCalls: [],
            },
          };
        } else {
          record.toolCallResult = toolCallResult;
        }
      }

      this.appendRecord(record);
    } catch (error) {
      console.error('Error saving tool result:', error);
    }
  }

  /**
   * Records a slash command invocation as a system record. This keeps the model
   * history clean while allowing resume to replay UI output for commands like
   * /about.
   */
  recordSlashCommand(payload: SlashCommandRecordPayload): void {
    try {
      const record: ChatRecord = {
        ...this.createBaseRecord('system'),
        type: 'system',
        subtype: 'slash_command',
        systemPayload: payload,
      };

      this.appendRecord(record);
    } catch (error) {
      console.error('Error saving slash command record:', error);
    }
  }

  recordChatCompression(payload: ChatCompressionRecordPayload): void {
    try {
      const record: ChatRecord = {
        ...this.createBaseRecord('system'),
        type: 'system',
        subtype: 'chat_compression',
        systemPayload: payload,
      };

      this.appendRecord(record);
    } catch (error) {
      console.error('Error saving chat compression record:', error);
    }
  }

  /**
   * Records a UI telemetry event for replaying metrics on resume.
   */
  recordUiTelemetryEvent(uiEvent: UiEvent): void {
    try {
      const record: ChatRecord = {
        ...this.createBaseRecord('system'),
        type: 'system',
        subtype: 'ui_telemetry',
        systemPayload: { uiEvent },
      };

      this.appendRecord(record);
    } catch (error) {
      console.error('Error saving ui telemetry record:', error);
    }
  }
}
