/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Converter for Gemini CLI extensions to Qwen Code format.
 */

import type { ExtensionConfig, ExtensionSetting } from '../extension.js';

export interface GeminiExtensionConfig {
  name: string;
  version: string;
  mcpServers?: Record<string, unknown>;
  contextFileName?: string | string[];
  excludeTools?: string[];
  commands?: string | string[];
  settings?: ExtensionSetting[];
}

/**
 * Converts a Gemini CLI extension config to Qwen Code format.
 * @param geminiConfig Gemini extension configuration
 * @returns Qwen ExtensionConfig
 */
export function convertGeminiToQwenConfig(
  geminiConfig: GeminiExtensionConfig,
): ExtensionConfig {
  // Validate required fields
  if (!geminiConfig.name || !geminiConfig.version) {
    throw new Error(
      'Gemini extension config must have name and version fields',
    );
  }

  const settings: ExtensionSetting[] | undefined = geminiConfig.settings;

  // Direct field mapping
  return {
    name: geminiConfig.name,
    version: geminiConfig.version,
    mcpServers: geminiConfig.mcpServers as ExtensionConfig['mcpServers'],
    contextFileName: geminiConfig.contextFileName,
    excludeTools: geminiConfig.excludeTools,
    commands: geminiConfig.commands,
    settings,
  };
}

/**
 * Checks if a config object is in Gemini format.
 * This is a heuristic check based on typical Gemini extension patterns.
 * @param config Configuration object to check
 * @returns true if config appears to be Gemini format
 */
export function isGeminiExtensionConfig(
  config: unknown,
): config is GeminiExtensionConfig {
  if (typeof config !== 'object' || config === null) {
    return false;
  }

  const obj = config as Record<string, unknown>;

  // Must have name and version
  if (typeof obj['name'] !== 'string' || typeof obj['version'] !== 'string') {
    return false;
  }

  // Check for Gemini-specific settings format
  if (obj['settings'] && Array.isArray(obj['settings'])) {
    const firstSetting = obj['settings'][0];
    if (
      firstSetting &&
      typeof firstSetting === 'object' &&
      'envVar' in firstSetting
    ) {
      return true;
    }
  }

  // If it has Gemini-specific fields but not Qwen-specific fields, likely Gemini
  return true;
}
