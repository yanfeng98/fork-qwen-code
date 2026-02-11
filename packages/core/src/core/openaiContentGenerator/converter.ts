import type {
  GenerateContentParameters,
  Part,
  Content,
  Tool,
  ToolListUnion,
  CallableTool,
  FunctionCall,
  FunctionResponse,
  ContentListUnion,
  ContentUnion,
  PartUnion,
  Candidate,
} from '@google/genai';
import { GenerateContentResponse, FinishReason } from '@google/genai';
import type OpenAI from 'openai';
import { safeJsonParse } from '../../utils/safeJsonParse.js';
import { StreamingToolCallParser } from './streamingToolCallParser.js';
import {
  convertSchema,
  type SchemaComplianceMode,
} from '../../utils/schemaConverter.js';

interface ExtendedCompletionUsage extends OpenAI.CompletionUsage {
  cached_tokens?: number;
}

interface ExtendedChatCompletionAssistantMessageParam
  extends OpenAI.Chat.ChatCompletionAssistantMessageParam {
  reasoning_content?: string | null;
}

type ExtendedChatCompletionMessageParam =
  | OpenAI.Chat.ChatCompletionMessageParam
  | ExtendedChatCompletionAssistantMessageParam;

export interface ExtendedCompletionMessage
  extends OpenAI.Chat.ChatCompletionMessage {
  reasoning_content?: string | null;
}

export interface ExtendedCompletionChunkDelta
  extends OpenAI.Chat.ChatCompletionChunk.Choice.Delta {
  reasoning_content?: string | null;
}

/**
 * Tool call accumulator for streaming responses
 */
export interface ToolCallAccumulator {
  id?: string;
  name?: string;
  arguments: string;
}

interface ParsedParts {
  thoughtParts: string[];
  contentParts: string[];
  functionCalls: FunctionCall[];
  functionResponses: FunctionResponse[];
  mediaParts: Array<{
    type: 'image' | 'audio' | 'file';
    data: string;
    mimeType: string;
    fileUri?: string;
  }>;
}

export class OpenAIContentConverter {
  private model: string;
  private schemaCompliance: SchemaComplianceMode;
  private streamingToolCallParser: StreamingToolCallParser =
    new StreamingToolCallParser();

  constructor(model: string, schemaCompliance: SchemaComplianceMode = 'auto') {
    this.model = model;
    this.schemaCompliance = schemaCompliance;
  }

  async convertGeminiToolsToOpenAI(
    geminiTools: ToolListUnion,
  ): Promise<OpenAI.Chat.ChatCompletionTool[]> {
    const openAITools: OpenAI.Chat.ChatCompletionTool[] = [];

    for (const tool of geminiTools) {
      let actualTool: Tool;

      if ('tool' in tool) {
        actualTool = await (tool as CallableTool).tool();
      } else {
        actualTool = tool as Tool;
      }

      if (actualTool.functionDeclarations) {
        for (const func of actualTool.functionDeclarations) {
          if (func.name && func.description) {
            let parameters: Record<string, unknown> | undefined;

            if (func.parametersJsonSchema) {
              const paramsCopy = {
                ...(func.parametersJsonSchema as Record<string, unknown>),
              };
              parameters = paramsCopy;
            } else if (func.parameters) {
              parameters = this.convertGeminiToolParametersToOpenAI(
                func.parameters as Record<string, unknown>,
              );
            }

            if (parameters) {
              parameters = convertSchema(parameters, this.schemaCompliance);
            }

            openAITools.push({
              type: 'function',
              function: {
                name: func.name,
                description: func.description,
                parameters,
              },
            });
          }
        }
      }
    }

    return openAITools;
  }

  convertGeminiToolParametersToOpenAI(
    parameters: Record<string, unknown>,
  ): Record<string, unknown> | undefined {
    if (!parameters || typeof parameters !== 'object') {
      return parameters;
    }

    const converted = JSON.parse(JSON.stringify(parameters));

    const convertTypes = (obj: unknown): unknown => {
      if (typeof obj !== 'object' || obj === null) {
        return obj;
      }

      if (Array.isArray(obj)) {
        return obj.map(convertTypes);
      }

      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(obj)) {
        if (key === 'type' && typeof value === 'string') {
          const lowerValue = value.toLowerCase();
          if (lowerValue === 'integer') {
            result[key] = 'integer';
          } else if (lowerValue === 'number') {
            result[key] = 'number';
          } else {
            result[key] = lowerValue;
          }
        } else if (
          key === 'minimum' ||
          key === 'maximum' ||
          key === 'multipleOf'
        ) {
          if (typeof value === 'string' && !isNaN(Number(value))) {
            result[key] = Number(value);
          } else {
            result[key] = value;
          }
        } else if (
          key === 'minLength' ||
          key === 'maxLength' ||
          key === 'minItems' ||
          key === 'maxItems'
        ) {
          if (typeof value === 'string' && !isNaN(Number(value))) {
            result[key] = parseInt(value, 10);
          } else {
            result[key] = value;
          }
        } else if (typeof value === 'object') {
          result[key] = convertTypes(value);
        } else {
          result[key] = value;
        }
      }
      return result;
    };

    return convertTypes(converted) as Record<string, unknown> | undefined;
  }

  convertGeminiRequestToOpenAI(
    request: GenerateContentParameters,
    options: { cleanOrphanToolCalls: boolean } = { cleanOrphanToolCalls: true },
  ): OpenAI.Chat.ChatCompletionMessageParam[] {
    let messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    this.addSystemInstructionMessage(request, messages);
    this.processContents(request.contents, messages);

    if (options.cleanOrphanToolCalls) {
      messages = this.cleanOrphanedToolCalls(messages);
    }
    messages = this.mergeConsecutiveAssistantMessages(messages);

    return messages;
  }

  private addSystemInstructionMessage(
    request: GenerateContentParameters,
    messages: OpenAI.Chat.ChatCompletionMessageParam[],
  ): void {
    if (!request.config?.systemInstruction) return;

    const systemText = this.extractTextFromContentUnion(
      request.config.systemInstruction,
    );

    if (systemText) {
      messages.push({
        role: 'system' as const,
        content: systemText,
      });
    }
  }

  private extractTextFromContentUnion(contentUnion: unknown): string {
    if (typeof contentUnion === 'string') {
      return contentUnion;
    }

    if (Array.isArray(contentUnion)) {
      return contentUnion
        .map((item) => this.extractTextFromContentUnion(item))
        .filter(Boolean)
        .join('\n');
    }

    if (typeof contentUnion === 'object' && contentUnion !== null) {
      if ('parts' in contentUnion) {
        const content = contentUnion as Content;
        return (
          content.parts
            ?.map((part: Part) => {
              if (typeof part === 'string') return part;
              if ('text' in part) return part.text || '';
              return '';
            })
            .filter(Boolean)
            .join('\n') || ''
        );
      }
    }

    return '';
  }

  private processContents(
    contents: ContentListUnion,
    messages: ExtendedChatCompletionMessageParam[],
  ): void {
    if (Array.isArray(contents)) {
      for (const content of contents) {
        this.processContent(content, messages);
      }
    } else if (contents) {
      this.processContent(contents, messages);
    }
  }

  private processContent(
    content: ContentUnion | PartUnion,
    messages: ExtendedChatCompletionMessageParam[],
  ): void {
    if (typeof content === 'string') {
      messages.push({ role: 'user' as const, content });
      return;
    }

    if (!this.isContentObject(content)) return;

    const parsedParts = this.parseParts(content.parts || []);

    if (parsedParts.functionResponses.length > 0) {
      for (const funcResponse of parsedParts.functionResponses) {
        messages.push({
          role: 'tool' as const,
          tool_call_id: funcResponse.id || '',
          content: this.extractFunctionResponseContent(funcResponse.response),
        });
      }
      return;
    }

    if (content.role === 'model' && parsedParts.functionCalls.length > 0) {
      const toolCalls = parsedParts.functionCalls.map((fc, index) => ({
        id: fc.id || `call_${index}`,
        type: 'function' as const,
        function: {
          name: fc.name || '',
          arguments: JSON.stringify(fc.args || {}),
        },
      }));

      const assistantMessage: ExtendedChatCompletionAssistantMessageParam = {
        role: 'assistant' as const,
        content: parsedParts.contentParts.join('') || null,
        tool_calls: toolCalls,
      };

      const reasoningContent = parsedParts.thoughtParts.join('');
      if (reasoningContent) {
        assistantMessage.reasoning_content = reasoningContent;
      }

      messages.push(assistantMessage);
      return;
    }

    const role = content.role === 'model' ? 'assistant' : 'user';
    const openAIMessage = this.createMultimodalMessage(role, parsedParts);

    if (openAIMessage) {
      messages.push(openAIMessage);
    }
  }

  private isContentObject(
    content: unknown,
  ): content is { role: string; parts: Part[] } {
    return (
      typeof content === 'object' &&
      content !== null &&
      'role' in content &&
      'parts' in content &&
      Array.isArray((content as Record<string, unknown>)['parts'])
    );
  }

  private parseParts(parts: Part[]): ParsedParts {
    const thoughtParts: string[] = [];
    const contentParts: string[] = [];
    const functionCalls: FunctionCall[] = [];
    const functionResponses: FunctionResponse[] = [];
    const mediaParts: Array<{
      type: 'image' | 'audio' | 'file';
      data: string;
      mimeType: string;
      fileUri?: string;
    }> = [];

    for (const part of parts) {
      if (typeof part === 'string') {
        contentParts.push(part);
      } else if (
        'text' in part &&
        part.text &&
        !('thought' in part && part.thought)
      ) {
        contentParts.push(part.text);
      } else if (
        'text' in part &&
        part.text &&
        'thought' in part &&
        part.thought
      ) {
        thoughtParts.push(part.text);
      } else if ('functionCall' in part && part.functionCall) {
        functionCalls.push(part.functionCall);
      } else if ('functionResponse' in part && part.functionResponse) {
        functionResponses.push(part.functionResponse);
      } else if ('inlineData' in part && part.inlineData) {
        const { data, mimeType } = part.inlineData;
        if (data && mimeType) {
          const mediaType = this.getMediaType(mimeType);
          mediaParts.push({ type: mediaType, data, mimeType });
        }
      } else if ('fileData' in part && part.fileData) {
        const { fileUri, mimeType } = part.fileData;
        if (fileUri && mimeType) {
          const mediaType = this.getMediaType(mimeType);
          mediaParts.push({
            type: mediaType,
            data: '',
            mimeType,
            fileUri,
          });
        }
      }
    }

    return {
      thoughtParts,
      contentParts,
      functionCalls,
      functionResponses,
      mediaParts,
    };
  }

  private getMediaType(mimeType: string): 'image' | 'audio' | 'file' {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('audio/')) return 'audio';
    return 'file';
  }

  private extractFunctionResponseContent(response: unknown): string {
    if (response === null || response === undefined) {
      return '';
    }

    if (typeof response === 'string') {
      return response;
    }

    if (typeof response === 'object') {
      const responseObject = response as Record<string, unknown>;
      const output = responseObject['output'];
      if (typeof output === 'string') {
        return output;
      }

      const error = responseObject['error'];
      if (typeof error === 'string') {
        return error;
      }
    }

    try {
      const serialized = JSON.stringify(response);
      return serialized ?? String(response);
    } catch {
      return String(response);
    }
  }

  private createMultimodalMessage(
    role: 'user' | 'assistant',
    parsedParts: Pick<
      ParsedParts,
      'contentParts' | 'mediaParts' | 'thoughtParts'
    >,
  ): ExtendedChatCompletionMessageParam | null {
    const { contentParts, mediaParts, thoughtParts } = parsedParts;
    const reasoningContent = thoughtParts.join('');
    const content = contentParts.map((text) => ({
      type: 'text' as const,
      text,
    }));

    if (mediaParts.length === 0) {
      if (content.length === 0) return null;
      const message: ExtendedChatCompletionMessageParam = { role, content };
      if (reasoningContent) {
        (
          message as ExtendedChatCompletionAssistantMessageParam
        ).reasoning_content = reasoningContent;
      }
      return message;
    }

    if (role === 'assistant') {
      return content.length > 0
        ? { role: 'assistant' as const, content }
        : null;
    }

    const contentArray: OpenAI.Chat.ChatCompletionContentPart[] = [...content];
    for (const mediaPart of mediaParts) {
      if (mediaPart.type === 'image') {
        if (mediaPart.fileUri) {
          contentArray.push({
            type: 'image_url' as const,
            image_url: { url: mediaPart.fileUri },
          });
        } else if (mediaPart.data) {
          const dataUrl = `data:${mediaPart.mimeType};base64,${mediaPart.data}`;
          contentArray.push({
            type: 'image_url' as const,
            image_url: { url: dataUrl },
          });
        }
      } else if (mediaPart.type === 'audio' && mediaPart.data) {
        const format = this.getAudioFormat(mediaPart.mimeType);
        if (format) {
          contentArray.push({
            type: 'input_audio' as const,
            input_audio: {
              data: mediaPart.data,
              format: format as 'wav' | 'mp3',
            },
          });
        }
      }
    }

    return contentArray.length > 0
      ? { role: 'user' as const, content: contentArray }
      : null;
  }

  private getAudioFormat(mimeType: string): 'wav' | 'mp3' | null {
    if (mimeType.includes('wav')) return 'wav';
    if (mimeType.includes('mp3') || mimeType.includes('mpeg')) return 'mp3';
    return null;
  }

  private cleanOrphanedToolCalls(
    messages: OpenAI.Chat.ChatCompletionMessageParam[],
  ): OpenAI.Chat.ChatCompletionMessageParam[] {
    const cleaned: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    const toolCallIds = new Set<string>();
    const toolResponseIds = new Set<string>();

    for (const message of messages) {
      if (
        message.role === 'assistant' &&
        'tool_calls' in message &&
        message.tool_calls
      ) {
        for (const toolCall of message.tool_calls) {
          if (toolCall.id) {
            toolCallIds.add(toolCall.id);
          }
        }
      } else if (
        message.role === 'tool' &&
        'tool_call_id' in message &&
        message.tool_call_id
      ) {
        toolResponseIds.add(message.tool_call_id);
      }
    }

    for (const message of messages) {
      if (
        message.role === 'assistant' &&
        'tool_calls' in message &&
        message.tool_calls
      ) {
        const validToolCalls = message.tool_calls.filter(
          (toolCall) => toolCall.id && toolResponseIds.has(toolCall.id),
        );

        if (validToolCalls.length > 0) {
          const cleanedMessage = { ...message };
          (
            cleanedMessage as OpenAI.Chat.ChatCompletionMessageParam & {
              tool_calls?: OpenAI.Chat.ChatCompletionMessageToolCall[];
            }
          ).tool_calls = validToolCalls;
          cleaned.push(cleanedMessage);
        } else if (
          typeof message.content === 'string' &&
          message.content.trim()
        ) {
          const cleanedMessage = { ...message };
          delete (
            cleanedMessage as OpenAI.Chat.ChatCompletionMessageParam & {
              tool_calls?: OpenAI.Chat.ChatCompletionMessageToolCall[];
            }
          ).tool_calls;
          cleaned.push(cleanedMessage);
        }
      } else if (
        message.role === 'tool' &&
        'tool_call_id' in message &&
        message.tool_call_id
      ) {
        if (toolCallIds.has(message.tool_call_id)) {
          cleaned.push(message);
        }
      } else {
        cleaned.push(message);
      }
    }

    const finalCleaned: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    const finalToolCallIds = new Set<string>();

    for (const message of cleaned) {
      if (
        message.role === 'assistant' &&
        'tool_calls' in message &&
        message.tool_calls
      ) {
        for (const toolCall of message.tool_calls) {
          if (toolCall.id) {
            finalToolCallIds.add(toolCall.id);
          }
        }
      }
    }

    const finalToolResponseIds = new Set<string>();
    for (const message of cleaned) {
      if (
        message.role === 'tool' &&
        'tool_call_id' in message &&
        message.tool_call_id
      ) {
        finalToolResponseIds.add(message.tool_call_id);
      }
    }

    for (const message of cleaned) {
      if (
        message.role === 'assistant' &&
        'tool_calls' in message &&
        message.tool_calls
      ) {
        const finalValidToolCalls = message.tool_calls.filter(
          (toolCall) => toolCall.id && finalToolResponseIds.has(toolCall.id),
        );

        if (finalValidToolCalls.length > 0) {
          const cleanedMessage = { ...message };
          (
            cleanedMessage as OpenAI.Chat.ChatCompletionMessageParam & {
              tool_calls?: OpenAI.Chat.ChatCompletionMessageToolCall[];
            }
          ).tool_calls = finalValidToolCalls;
          finalCleaned.push(cleanedMessage);
        } else if (
          typeof message.content === 'string' &&
          message.content.trim()
        ) {
          const cleanedMessage = { ...message };
          delete (
            cleanedMessage as OpenAI.Chat.ChatCompletionMessageParam & {
              tool_calls?: OpenAI.Chat.ChatCompletionMessageToolCall[];
            }
          ).tool_calls;
          finalCleaned.push(cleanedMessage);
        }
      } else {
        finalCleaned.push(message);
      }
    }

    return finalCleaned;
  }

  private mergeConsecutiveAssistantMessages(
    messages: OpenAI.Chat.ChatCompletionMessageParam[],
  ): OpenAI.Chat.ChatCompletionMessageParam[] {
    const merged: OpenAI.Chat.ChatCompletionMessageParam[] = [];

    for (const message of messages) {
      if (message.role === 'assistant' && merged.length > 0) {
        const lastMessage = merged[merged.length - 1];

        if (lastMessage.role === 'assistant') {
          const lastContent = lastMessage.content;
          const currentContent = message.content;
          const useArrayFormat =
            Array.isArray(lastContent) || Array.isArray(currentContent);

          let combinedContent:
            | string
            | OpenAI.Chat.ChatCompletionContentPart[]
            | null;

          if (useArrayFormat) {
            const lastParts = Array.isArray(lastContent)
              ? lastContent
              : typeof lastContent === 'string' && lastContent
                ? [{ type: 'text' as const, text: lastContent }]
                : [];

            const currentParts = Array.isArray(currentContent)
              ? currentContent
              : typeof currentContent === 'string' && currentContent
                ? [{ type: 'text' as const, text: currentContent }]
                : [];

            combinedContent = [
              ...lastParts,
              ...currentParts,
            ] as OpenAI.Chat.ChatCompletionContentPart[];
          } else {
            const lastText = typeof lastContent === 'string' ? lastContent : '';
            const currentText =
              typeof currentContent === 'string' ? currentContent : '';
            const mergedText = [lastText, currentText].filter(Boolean).join('');
            combinedContent = mergedText || null;
          }

          const lastToolCalls =
            'tool_calls' in lastMessage ? lastMessage.tool_calls || [] : [];
          const currentToolCalls =
            'tool_calls' in message ? message.tool_calls || [] : [];
          const combinedToolCalls = [...lastToolCalls, ...currentToolCalls];

          (
            lastMessage as OpenAI.Chat.ChatCompletionMessageParam & {
              content: string | OpenAI.Chat.ChatCompletionContentPart[] | null;
              tool_calls?: OpenAI.Chat.ChatCompletionMessageToolCall[];
            }
          ).content = combinedContent || null;
          if (combinedToolCalls.length > 0) {
            (
              lastMessage as OpenAI.Chat.ChatCompletionMessageParam & {
                content:
                  | string
                  | OpenAI.Chat.ChatCompletionContentPart[]
                  | null;
                tool_calls?: OpenAI.Chat.ChatCompletionMessageToolCall[];
              }
            ).tool_calls = combinedToolCalls;
          }

          continue;
        }
      }

      merged.push(message);
    }

    return merged;
  }

  resetStreamingToolCalls(): void {
    this.streamingToolCallParser.reset();
  }

  /**
   * Convert Gemini response to OpenAI completion format (for logging).
   */
  convertGeminiResponseToOpenAI(
    response: GenerateContentResponse,
  ): OpenAI.Chat.ChatCompletion {
    const candidate = response.candidates?.[0];
    const parts = (candidate?.content?.parts || []) as Part[];
    const parsedParts = this.parseParts(parts);

    const message: ExtendedCompletionMessage = {
      role: 'assistant',
      content: parsedParts.contentParts.join('') || null,
      refusal: null,
    };

    const reasoningContent = parsedParts.thoughtParts.join('');
    if (reasoningContent) {
      message.reasoning_content = reasoningContent;
    }

    if (parsedParts.functionCalls.length > 0) {
      message.tool_calls = parsedParts.functionCalls.map((call, index) => ({
        id: call.id || `call_${index}`,
        type: 'function' as const,
        function: {
          name: call.name || '',
          arguments: JSON.stringify(call.args || {}),
        },
      }));
    }

    const finishReason = this.mapGeminiFinishReasonToOpenAI(
      candidate?.finishReason,
    );

    const usageMetadata = response.usageMetadata;
    const usage: OpenAI.CompletionUsage = {
      prompt_tokens: usageMetadata?.promptTokenCount || 0,
      completion_tokens: usageMetadata?.candidatesTokenCount || 0,
      total_tokens: usageMetadata?.totalTokenCount || 0,
    };

    if (usageMetadata?.cachedContentTokenCount !== undefined) {
      (
        usage as OpenAI.CompletionUsage & {
          prompt_tokens_details?: { cached_tokens?: number };
        }
      ).prompt_tokens_details = {
        cached_tokens: usageMetadata.cachedContentTokenCount,
      };
    }

    const createdMs = response.createTime
      ? Number(response.createTime)
      : Date.now();
    const createdSeconds = Number.isFinite(createdMs)
      ? Math.floor(createdMs / 1000)
      : Math.floor(Date.now() / 1000);

    return {
      id: response.responseId || `gemini-${Date.now()}`,
      object: 'chat.completion',
      created: createdSeconds,
      model: response.modelVersion || this.model,
      choices: [
        {
          index: 0,
          message,
          finish_reason: finishReason,
          logprobs: null,
        },
      ],
      usage,
    };
  }

  convertOpenAIResponseToGemini(
    openaiResponse: OpenAI.Chat.ChatCompletion,
  ): GenerateContentResponse {
    const choice = openaiResponse.choices[0];
    const response = new GenerateContentResponse();
    const parts: Part[] = [];

    const reasoningText = (choice.message as ExtendedCompletionMessage)
      .reasoning_content;
    if (reasoningText) {
      parts.push({ text: reasoningText, thought: true });
    }

    if (choice.message.content) {
      parts.push({ text: choice.message.content });
    }

    if (choice.message.tool_calls) {
      for (const toolCall of choice.message.tool_calls) {
        if (toolCall.function) {
          let args: Record<string, unknown> = {};
          if (toolCall.function.arguments) {
            args = safeJsonParse(toolCall.function.arguments, {});
          }

          parts.push({
            functionCall: {
              id: toolCall.id,
              name: toolCall.function.name,
              args,
            },
          });
        }
      }
    }

    response.responseId = openaiResponse.id;
    response.createTime = openaiResponse.created
      ? openaiResponse.created.toString()
      : new Date().getTime().toString();

    response.candidates = [
      {
        content: {
          parts,
          role: 'model' as const,
        },
        finishReason: this.mapOpenAIFinishReasonToGemini(
          choice.finish_reason || 'stop',
        ),
        index: 0,
        safetyRatings: [],
      },
    ];

    response.modelVersion = this.model;
    response.promptFeedback = { safetyRatings: [] };

    if (openaiResponse.usage) {
      const usage = openaiResponse.usage;

      const promptTokens = usage.prompt_tokens || 0;
      const completionTokens = usage.completion_tokens || 0;
      const totalTokens = usage.total_tokens || 0;
      const extendedUsage = usage as ExtendedCompletionUsage;
      const cachedTokens =
        usage.prompt_tokens_details?.cached_tokens ??
        extendedUsage.cached_tokens ??
        0;

      let finalPromptTokens = promptTokens;
      let finalCompletionTokens = completionTokens;

      if (totalTokens > 0 && promptTokens === 0 && completionTokens === 0) {
        finalPromptTokens = Math.round(totalTokens * 0.7);
        finalCompletionTokens = Math.round(totalTokens * 0.3);
      }

      response.usageMetadata = {
        promptTokenCount: finalPromptTokens,
        candidatesTokenCount: finalCompletionTokens,
        totalTokenCount: totalTokens,
        cachedContentTokenCount: cachedTokens,
      };
    }

    return response;
  }

  convertOpenAIChunkToGemini(
    chunk: OpenAI.Chat.ChatCompletionChunk,
  ): GenerateContentResponse {
    const choice = chunk.choices?.[0];
    const response = new GenerateContentResponse();

    if (choice) {
      const parts: Part[] = [];

      const reasoningText = (choice.delta as ExtendedCompletionChunkDelta)
        .reasoning_content;
      if (reasoningText) {
        parts.push({ text: reasoningText, thought: true });
      }

      if (choice.delta?.content) {
        if (typeof choice.delta.content === 'string') {
          parts.push({ text: choice.delta.content });
        }
      }

      if (choice.delta?.tool_calls) {
        for (const toolCall of choice.delta.tool_calls) {
          const index = toolCall.index ?? 0;

          if (toolCall.function?.arguments) {
            this.streamingToolCallParser.addChunk(
              index,
              toolCall.function.arguments,
              toolCall.id,
              toolCall.function.name,
            );
          } else {
            this.streamingToolCallParser.addChunk(
              index,
              '',
              toolCall.id,
              toolCall.function?.name,
            );
          }
        }
      }

      // Only emit function calls when streaming is complete (finish_reason is present)
      if (choice.finish_reason) {
        const completedToolCalls =
          this.streamingToolCallParser.getCompletedToolCalls();

        for (const toolCall of completedToolCalls) {
          if (toolCall.name) {
            parts.push({
              functionCall: {
                id:
                  toolCall.id ||
                  `call_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                name: toolCall.name,
                args: toolCall.args,
              },
            });
          }
        }

        // Clear the parser for the next stream
        this.streamingToolCallParser.reset();
      }

      // Only include finishReason key if finish_reason is present
      const candidate: Candidate = {
        content: {
          parts,
          role: 'model' as const,
        },
        index: 0,
        safetyRatings: [],
      };
      if (choice.finish_reason) {
        candidate.finishReason = this.mapOpenAIFinishReasonToGemini(
          choice.finish_reason,
        );
      }
      response.candidates = [candidate];
    } else {
      response.candidates = [];
    }

    response.responseId = chunk.id;
    response.createTime = chunk.created
      ? chunk.created.toString()
      : new Date().getTime().toString();

    response.modelVersion = this.model;
    response.promptFeedback = { safetyRatings: [] };

    // Add usage metadata if available in the chunk
    if (chunk.usage) {
      const usage = chunk.usage;

      const promptTokens = usage.prompt_tokens || 0;
      const completionTokens = usage.completion_tokens || 0;
      const totalTokens = usage.total_tokens || 0;
      const thinkingTokens =
        usage.completion_tokens_details?.reasoning_tokens || 0;
      // Support both formats: prompt_tokens_details.cached_tokens (OpenAI standard)
      // and cached_tokens (some models return it at top level)
      const extendedUsage = usage as ExtendedCompletionUsage;
      const cachedTokens =
        usage.prompt_tokens_details?.cached_tokens ??
        extendedUsage.cached_tokens ??
        0;

      // If we only have total tokens but no breakdown, estimate the split
      // Typically input is ~70% and output is ~30% for most conversations
      let finalPromptTokens = promptTokens;
      let finalCompletionTokens = completionTokens;

      if (totalTokens > 0 && promptTokens === 0 && completionTokens === 0) {
        // Estimate: assume 70% input, 30% output
        finalPromptTokens = Math.round(totalTokens * 0.7);
        finalCompletionTokens = Math.round(totalTokens * 0.3);
      }

      response.usageMetadata = {
        promptTokenCount: finalPromptTokens,
        candidatesTokenCount: finalCompletionTokens,
        thoughtsTokenCount: thinkingTokens,
        totalTokenCount: totalTokens,
        cachedContentTokenCount: cachedTokens,
      };
    }

    return response;
  }

  private mapOpenAIFinishReasonToGemini(
    openaiReason: string | null,
  ): FinishReason {
    if (!openaiReason) return FinishReason.FINISH_REASON_UNSPECIFIED;
    const mapping: Record<string, FinishReason> = {
      stop: FinishReason.STOP,
      length: FinishReason.MAX_TOKENS,
      content_filter: FinishReason.SAFETY,
      function_call: FinishReason.STOP,
      tool_calls: FinishReason.STOP,
    };
    return mapping[openaiReason] || FinishReason.FINISH_REASON_UNSPECIFIED;
  }

  private mapGeminiFinishReasonToOpenAI(
    geminiReason?: FinishReason,
  ): 'stop' | 'length' | 'tool_calls' | 'content_filter' | 'function_call' {
    if (!geminiReason) {
      return 'stop';
    }

    switch (geminiReason) {
      case FinishReason.STOP:
        return 'stop';
      case FinishReason.MAX_TOKENS:
        return 'length';
      case FinishReason.SAFETY:
        return 'content_filter';
      default:
        if (geminiReason === ('RECITATION' as FinishReason)) {
          return 'content_filter';
        }
        return 'stop';
    }
  }
}
