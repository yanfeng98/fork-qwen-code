/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from 'vitest';
import {
  isClaudePluginConfig,
  convertClaudeToQwenConfig,
  mergeClaudeConfigs,
  type ClaudePluginConfig,
  type ClaudeMarketplacePluginConfig,
} from './claude-converter.js';
import {
  isGeminiExtensionConfig,
  convertGeminiToQwenConfig,
  type GeminiExtensionConfig,
} from './gemini-converter.js';
import { parseMarketplaceSource } from './marketplace.js';

describe('Claude Converter', () => {
  describe('isClaudePluginConfig', () => {
    it('should detect Claude plugin config', () => {
      const config = {
        name: 'test-plugin',
        version: '1.0.0',
        agents: 'agents/',
        hooks: 'hooks.js',
      };
      expect(isClaudePluginConfig(config)).toBe(true);
    });

    it('should return false for non-Claude config', () => {
      const config = {
        name: 'test-plugin',
        version: '1.0.0',
        commands: 'commands/',
      };
      expect(isClaudePluginConfig(config)).toBe(false);
    });

    it('should return false for invalid config', () => {
      expect(isClaudePluginConfig(null)).toBe(false);
      expect(isClaudePluginConfig('string')).toBe(false);
      expect(isClaudePluginConfig({})).toBe(false);
    });
  });

  describe('convertClaudeToQwenConfig', () => {
    it('should convert basic Claude config', () => {
      const claudeConfig: ClaudePluginConfig = {
        name: 'claude-plugin',
        version: '1.0.0',
        commands: 'commands/',
        agents: 'agents/',
      };

      const qwenConfig = convertClaudeToQwenConfig(claudeConfig);

      expect(qwenConfig.name).toBe('claude-plugin');
      expect(qwenConfig.version).toBe('1.0.0');
      expect(qwenConfig.commands).toBe('commands/');
      expect(qwenConfig.agents).toBe('agents/');
    });

    it('should throw error for invalid config', () => {
      expect(() => convertClaudeToQwenConfig({} as ClaudePluginConfig)).toThrow(
        'Claude plugin config must have name and version fields',
      );
    });
  });

  describe('mergeClaudeConfigs', () => {
    it('should merge marketplace and plugin configs', () => {
      const marketplaceConfig: ClaudeMarketplacePluginConfig = {
        name: 'plugin',
        version: '2.0.0',
        source: 'https://github.com/example/plugin',
        description: 'Updated description',
      };

      const pluginConfig: ClaudePluginConfig = {
        name: 'plugin',
        version: '1.0.0',
        description: 'Original description',
        commands: 'commands/',
      };

      const merged = mergeClaudeConfigs(marketplaceConfig, pluginConfig);

      expect(merged.name).toBe('plugin');
      expect(merged.version).toBe('2.0.0');
      expect(merged.description).toBe('Updated description');
      expect(merged.commands).toBe('commands/');
    });

    it('should throw error in strict mode without plugin config', () => {
      const marketplaceConfig: ClaudeMarketplacePluginConfig = {
        name: 'plugin',
        version: '1.0.0',
        source: 'https://github.com/example/plugin',
        strict: true,
      };

      expect(() => mergeClaudeConfigs(marketplaceConfig)).toThrow(
        'Plugin plugin requires plugin.json (strict mode)',
      );
    });
  });
});

describe('Gemini Converter', () => {
  describe('isGeminiExtensionConfig', () => {
    it('should detect Gemini extension config with settings', () => {
      const config = {
        name: 'test-extension',
        version: '1.0.0',
        settings: [
          {
            name: 'API Key',
            description: 'Your API key',
            envVar: 'MY_API_KEY',
          },
        ],
      };
      expect(isGeminiExtensionConfig(config)).toBe(true);
    });

    it('should return true for basic Gemini config without settings', () => {
      const config = {
        name: 'test-extension',
        version: '1.0.0',
        contextFileName: 'QWEN.md',
      };
      expect(isGeminiExtensionConfig(config)).toBe(true);
    });

    it('should return false for invalid config', () => {
      expect(isGeminiExtensionConfig(null)).toBe(false);
      expect(isGeminiExtensionConfig('string')).toBe(false);
      expect(isGeminiExtensionConfig({})).toBe(false);
    });
  });

  describe('convertGeminiToQwenConfig', () => {
    it('should convert basic Gemini config', () => {
      const geminiConfig: GeminiExtensionConfig = {
        name: 'gemini-extension',
        version: '1.0.0',
        commands: 'commands/',
        excludeTools: ['tool1', 'tool2'],
      };

      const qwenConfig = convertGeminiToQwenConfig(geminiConfig);

      expect(qwenConfig.name).toBe('gemini-extension');
      expect(qwenConfig.version).toBe('1.0.0');
      expect(qwenConfig.commands).toBe('commands/');
      expect(qwenConfig.excludeTools).toEqual(['tool1', 'tool2']);
    });

    it('should convert config with settings', () => {
      const geminiConfig: GeminiExtensionConfig = {
        name: 'gemini-extension',
        version: '1.0.0',
        settings: [
          {
            name: 'API Key',
            description: 'Your API key',
            envVar: 'MY_API_KEY',
            sensitive: true,
          },
        ],
      };

      const qwenConfig = convertGeminiToQwenConfig(geminiConfig);

      expect(qwenConfig.settings).toEqual(geminiConfig.settings);
    });

    it('should throw error for invalid config', () => {
      expect(() =>
        convertGeminiToQwenConfig({} as GeminiExtensionConfig),
      ).toThrow('Gemini extension config must have name and version fields');
    });
  });
});

describe('Marketplace Parser', () => {
  describe('parseMarketplaceSource', () => {
    it('should parse valid marketplace source', () => {
      const result = parseMarketplaceSource(
        'https://github.com/example/marketplace:my-plugin',
      );
      expect(result).toEqual({
        marketplaceUrl: 'https://github.com/example/marketplace',
        pluginName: 'my-plugin',
      });
    });

    it('should parse HTTP marketplace source', () => {
      const result = parseMarketplaceSource(
        'http://example.com/marketplace:plugin-name',
      );
      expect(result).toEqual({
        marketplaceUrl: 'http://example.com/marketplace',
        pluginName: 'plugin-name',
      });
    });

    it('should handle multiple colons in URL', () => {
      const result = parseMarketplaceSource(
        'https://github.com:8080/repo:plugin',
      );
      expect(result).toEqual({
        marketplaceUrl: 'https://github.com:8080/repo',
        pluginName: 'plugin',
      });
    });

    it('should return null for invalid sources', () => {
      expect(parseMarketplaceSource('not-a-url:plugin')).toBeNull();
      expect(parseMarketplaceSource('https://github.com/repo')).toBeNull();
      expect(parseMarketplaceSource('https://github.com/repo:')).toBeNull();
    });
  });
});
