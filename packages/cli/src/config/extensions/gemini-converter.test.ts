/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import {
  convertGeminiToQwenConfig,
  isGeminiExtensionConfig,
  type GeminiExtensionConfig,
} from './gemini-converter.js';

describe('convertGeminiToQwenConfig', () => {
  it('should convert basic Gemini config', () => {
    const geminiConfig: GeminiExtensionConfig = {
      name: 'test-extension',
      version: '1.0.0',
    };

    const result = convertGeminiToQwenConfig(geminiConfig);

    expect(result.name).toBe('test-extension');
    expect(result.version).toBe('1.0.0');
  });

  it('should convert config with commands', () => {
    const geminiConfig: GeminiExtensionConfig = {
      name: 'cmd-extension',
      version: '1.0.0',
      commands: 'commands',
    };

    const result = convertGeminiToQwenConfig(geminiConfig);

    expect(result.commands).toBe('commands');
  });

  it('should throw error for missing name', () => {
    const invalidConfig = {
      version: '1.0.0',
    } as GeminiExtensionConfig;

    expect(() => convertGeminiToQwenConfig(invalidConfig)).toThrow();
  });
});

describe('isGeminiExtensionConfig', () => {
  it('should identify Gemini config with settings', () => {
    const config = {
      name: 'test',
      version: '1.0.0',
      settings: [{ name: 'Test', envVar: 'TEST', description: 'Test' }],
    };

    expect(isGeminiExtensionConfig(config)).toBe(true);
  });

  it('should return false for invalid config', () => {
    expect(isGeminiExtensionConfig(null)).toBe(false);
    expect(isGeminiExtensionConfig({})).toBe(false);
  });
});
