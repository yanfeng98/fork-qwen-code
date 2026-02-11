import { safeJsonParse } from '../../utils/safeJsonParse.js';

/**
 * Type definition for the result of parsing a JSON chunk in tool calls
 */
export interface ToolCallParseResult {
  /** Whether the JSON parsing is complete */
  complete: boolean;
  /** The parsed JSON value (only present when complete is true) */
  value?: Record<string, unknown>;
  /** Error information if parsing failed */
  error?: Error;
  /** Whether the JSON was repaired (e.g., auto-closed unclosed strings) */
  repaired?: boolean;
}

export class StreamingToolCallParser {
  private buffers: Map<number, string> = new Map();
  private depths: Map<number, number> = new Map();
  private inStrings: Map<number, boolean> = new Map();
  private escapes: Map<number, boolean> = new Map();
  private toolCallMeta: Map<number, { id?: string; name?: string }> = new Map();
  private idToIndexMap: Map<string, number> = new Map();
  private nextAvailableIndex: number = 0;

  reset(): void {
    this.buffers.clear();
    this.depths.clear();
    this.inStrings.clear();
    this.escapes.clear();
    this.toolCallMeta.clear();
    this.idToIndexMap.clear();
    this.nextAvailableIndex = 0;
  }

  addChunk(
    index: number,
    chunk: string,
    id?: string,
    name?: string,
  ): ToolCallParseResult {
    let actualIndex = index;

    if (id) {
      if (this.idToIndexMap.has(id)) {
        actualIndex = this.idToIndexMap.get(id)!;
      } else {
        if (this.buffers.has(index)) {
          const existingBuffer = this.buffers.get(index)!;
          const existingDepth = this.depths.get(index)!;
          const existingMeta = this.toolCallMeta.get(index);

          if (
            existingBuffer.trim() &&
            existingDepth === 0 &&
            existingMeta?.id &&
            existingMeta.id !== id
          ) {
            try {
              JSON.parse(existingBuffer);
              actualIndex = this.findNextAvailableIndex();
            } catch {
              // Existing buffer is not complete JSON, we can reuse this index
            }
          }
        }

        this.idToIndexMap.set(id, actualIndex);
      }
    } else {
      if (this.buffers.has(index)) {
        const existingBuffer = this.buffers.get(index)!;
        const existingDepth = this.depths.get(index)!;

        if (existingDepth > 0 || !existingBuffer.trim()) {
          actualIndex = index;
        } else {
          try {
            JSON.parse(existingBuffer);
            actualIndex = this.findMostRecentIncompleteIndex();
          } catch {
            actualIndex = index;
          }
        }
      }
    }

    // Initialize state for the actual index if not exists
    if (!this.buffers.has(actualIndex)) {
      this.buffers.set(actualIndex, '');
      this.depths.set(actualIndex, 0);
      this.inStrings.set(actualIndex, false);
      this.escapes.set(actualIndex, false);
      this.toolCallMeta.set(actualIndex, {});
    }

    // Update metadata
    const meta = this.toolCallMeta.get(actualIndex)!;
    if (id) meta.id = id;
    if (name) meta.name = name;

    // Get current state for the actual index
    const currentBuffer = this.buffers.get(actualIndex)!;
    const currentDepth = this.depths.get(actualIndex)!;
    const currentInString = this.inStrings.get(actualIndex)!;
    const currentEscape = this.escapes.get(actualIndex)!;

    // Add chunk to buffer
    const newBuffer = currentBuffer + chunk;
    this.buffers.set(actualIndex, newBuffer);

    // Track JSON structure depth - only count brackets/braces outside of strings
    let depth = currentDepth;
    let inString = currentInString;
    let escape = currentEscape;

    for (const char of chunk) {
      if (!inString) {
        if (char === '{' || char === '[') depth++;
        else if (char === '}' || char === ']') depth--;
      }

      // Track string boundaries - toggle inString state on unescaped quotes
      if (char === '"' && !escape) {
        inString = !inString;
      }
      // Track escape sequences - backslash followed by any character is escaped
      escape = char === '\\' && !escape;
    }

    // Update state
    this.depths.set(actualIndex, depth);
    this.inStrings.set(actualIndex, inString);
    this.escapes.set(actualIndex, escape);

    // Attempt parse when we're back at root level (depth 0) and have data
    if (depth === 0 && newBuffer.trim().length > 0) {
      try {
        // Standard JSON parsing attempt
        const parsed = JSON.parse(newBuffer);
        return { complete: true, value: parsed };
      } catch (e) {
        // Intelligent repair: try auto-closing unclosed strings
        if (inString) {
          try {
            const repaired = JSON.parse(newBuffer + '"');
            return {
              complete: true,
              value: repaired,
              repaired: true,
            };
          } catch {
            // If repair fails, fall through to error case
          }
        }
        return {
          complete: false,
          error: e instanceof Error ? e : new Error(String(e)),
        };
      }
    }

    // JSON structure is incomplete, continue accumulating chunks
    return { complete: false };
  }

  private findNextAvailableIndex(): number {
    while (this.buffers.has(this.nextAvailableIndex)) {
      const buffer = this.buffers.get(this.nextAvailableIndex)!;
      const depth = this.depths.get(this.nextAvailableIndex)!;
      const meta = this.toolCallMeta.get(this.nextAvailableIndex);

      if (!buffer.trim() || depth > 0 || !meta?.id) {
        return this.nextAvailableIndex;
      }

      try {
        JSON.parse(buffer);
        if (depth === 0) {
          this.nextAvailableIndex++;
          continue;
        }
      } catch {
        return this.nextAvailableIndex;
      }

      this.nextAvailableIndex++;
    }
    return this.nextAvailableIndex++;
  }

  private findMostRecentIncompleteIndex(): number {
    // Look for the highest index that has an incomplete tool call
    let maxIndex = -1;
    for (const [index, buffer] of this.buffers.entries()) {
      const depth = this.depths.get(index)!;
      const meta = this.toolCallMeta.get(index);

      // Check if this tool call is incomplete
      if (meta?.id && (depth > 0 || !buffer.trim())) {
        maxIndex = Math.max(maxIndex, index);
      } else if (buffer.trim()) {
        // Check if buffer is parseable (complete)
        try {
          JSON.parse(buffer);
          // Buffer is complete, skip this index
        } catch {
          // Buffer is incomplete, this could be our target
          maxIndex = Math.max(maxIndex, index);
        }
      }
    }

    return maxIndex >= 0 ? maxIndex : this.findNextAvailableIndex();
  }

  /**
   * Gets the current tool call metadata for a specific index
   *
   * @param index - The tool call index
   * @returns Object containing id and name if available
   */
  getToolCallMeta(index: number): { id?: string; name?: string } {
    return this.toolCallMeta.get(index) || {};
  }

  /**
   * Gets all completed tool calls that are ready to be emitted
   *
   * Attempts to parse accumulated buffers using multiple strategies:
   * 1. Standard JSON.parse()
   * 2. Auto-close unclosed strings and retry
   * 3. Fallback to safeJsonParse for malformed data
   *
   * Only returns tool calls with both name metadata and non-empty buffers.
   * Should be called when streaming is complete (finish_reason is present).
   *
   * @returns Array of completed tool calls with their metadata and parsed arguments
   */
  getCompletedToolCalls(): Array<{
    id?: string;
    name?: string;
    args: Record<string, unknown>;
    index: number;
  }> {
    const completed: Array<{
      id?: string;
      name?: string;
      args: Record<string, unknown>;
      index: number;
    }> = [];

    for (const [index, buffer] of this.buffers.entries()) {
      const meta = this.toolCallMeta.get(index);
      if (meta?.name && buffer.trim()) {
        let args: Record<string, unknown> = {};

        // Try to parse the final buffer
        try {
          args = JSON.parse(buffer);
        } catch {
          // Try with repair (auto-close strings)
          const inString = this.inStrings.get(index);
          if (inString) {
            try {
              args = JSON.parse(buffer + '"');
            } catch {
              // If all parsing fails, use safeJsonParse as fallback
              args = safeJsonParse(buffer, {});
            }
          } else {
            args = safeJsonParse(buffer, {});
          }
        }

        completed.push({
          id: meta.id,
          name: meta.name,
          args,
          index,
        });
      }
    }

    return completed;
  }

  /**
   * Resets the parser state for a specific tool call index
   *
   * @param index - The tool call index to reset
   */
  resetIndex(index: number): void {
    this.buffers.set(index, '');
    this.depths.set(index, 0);
    this.inStrings.set(index, false);
    this.escapes.set(index, false);
    this.toolCallMeta.set(index, {});
  }

  /**
   * Gets the current accumulated buffer content for a specific index
   *
   * @param index - The tool call index to retrieve buffer for
   * @returns The current buffer content for the specified index (empty string if not found)
   */
  getBuffer(index: number): string {
    return this.buffers.get(index) || '';
  }

  /**
   * Gets the current parsing state information for a specific index
   *
   * @param index - The tool call index to get state information for
   * @returns Object containing current parsing state (depth, inString, escape)
   */
  getState(index: number): {
    depth: number;
    inString: boolean;
    escape: boolean;
  } {
    return {
      depth: this.depths.get(index) || 0,
      inString: this.inStrings.get(index) || false,
      escape: this.escapes.get(index) || false,
    };
  }
}
