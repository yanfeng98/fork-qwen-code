/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Converter for Claude Code plugins to Qwen Code format.
 */

import type { ExtensionConfig } from '../extension.js';
import type { MCPServerConfig } from '@qwen-code/qwen-code-core';

export interface ClaudePluginConfig {
  name: string;
  version: string;
  description?: string;
  author?: { name?: string; email?: string; url?: string };
  homepage?: string;
  repository?: string;
  license?: string;
  keywords?: string[];
  commands?: string | string[];
  agents?: string | string[];
  skills?: string | string[];
  hooks?: string;
  mcpServers?: string | Record<string, MCPServerConfig>;
  outputStyles?: string | string[];
  lspServers?: string;
}

export type ClaudePluginSource =
  | { source: 'github'; repo: string }
  | { source: 'url'; url: string };

export interface ClaudeMarketplacePluginConfig extends ClaudePluginConfig {
  source: string | ClaudePluginSource;
  category?: string;
  strict?: boolean;
  tags?: string[];
}

export interface ClaudeMarketplaceConfig {
  name: string;
  owner: { name: string; email: string };
  plugins: ClaudeMarketplacePluginConfig[];
  metadata?: { description?: string; version?: string; pluginRoot?: string };
}

/**
 * Converts a Claude plugin config to Qwen Code format.
 * @param claudeConfig Claude plugin configuration
 * @returns Qwen ExtensionConfig
 */
export function convertClaudeToQwenConfig(
  claudeConfig: ClaudePluginConfig,
): ExtensionConfig {
  // Validate required fields
  if (!claudeConfig.name || !claudeConfig.version) {
    throw new Error('Claude plugin config must have name and version fields');
  }

  // Parse MCP servers
  let mcpServers: Record<string, MCPServerConfig> | undefined;
  if (claudeConfig.mcpServers) {
    if (typeof claudeConfig.mcpServers === 'string') {
      // TODO: Load from file path
      console.warn(
        `[Claude Converter] MCP servers path not yet supported: ${claudeConfig.mcpServers}`,
      );
    } else {
      mcpServers = claudeConfig.mcpServers;
    }
  }

  // Warn about unsupported fields
  if (claudeConfig.hooks) {
    console.warn(
      `[Claude Converter] Hooks are not yet supported in ${claudeConfig.name}`,
    );
  }
  if (claudeConfig.outputStyles) {
    console.warn(
      `[Claude Converter] Output styles are not yet supported in ${claudeConfig.name}`,
    );
  }
  if (claudeConfig.lspServers) {
    console.warn(
      `[Claude Converter] LSP servers are not yet supported in ${claudeConfig.name}`,
    );
  }

  // Direct field mapping
  return {
    name: claudeConfig.name,
    version: claudeConfig.version,
    mcpServers,
    commands: claudeConfig.commands,
    skills: claudeConfig.skills,
    agents: claudeConfig.agents,
  };
}

/**
 * Merges marketplace plugin config with the actual plugin.json config.
 * Marketplace config takes precedence for conflicting fields.
 * @param marketplacePlugin Marketplace plugin definition
 * @param pluginConfig Actual plugin.json config (optional if strict=false)
 * @returns Merged Claude plugin config
 */
export function mergeClaudeConfigs(
  marketplacePlugin: ClaudeMarketplacePluginConfig,
  pluginConfig?: ClaudePluginConfig,
): ClaudePluginConfig {
  if (!pluginConfig && marketplacePlugin.strict !== false) {
    throw new Error(
      `Plugin ${marketplacePlugin.name} requires plugin.json (strict mode)`,
    );
  }

  // Start with plugin.json config (if exists)
  const merged: ClaudePluginConfig = pluginConfig
    ? { ...pluginConfig }
    : {
        name: marketplacePlugin.name,
        version: '1.0.0', // Default version if not in marketplace
      };

  // Overlay marketplace config (takes precedence)
  if (marketplacePlugin.name) merged.name = marketplacePlugin.name;
  if (marketplacePlugin.version) merged.version = marketplacePlugin.version;
  if (marketplacePlugin.description)
    merged.description = marketplacePlugin.description;
  if (marketplacePlugin.author) merged.author = marketplacePlugin.author;
  if (marketplacePlugin.homepage) merged.homepage = marketplacePlugin.homepage;
  if (marketplacePlugin.repository)
    merged.repository = marketplacePlugin.repository;
  if (marketplacePlugin.license) merged.license = marketplacePlugin.license;
  if (marketplacePlugin.keywords) merged.keywords = marketplacePlugin.keywords;
  if (marketplacePlugin.commands) merged.commands = marketplacePlugin.commands;
  if (marketplacePlugin.agents) merged.agents = marketplacePlugin.agents;
  if (marketplacePlugin.skills) merged.skills = marketplacePlugin.skills;
  if (marketplacePlugin.hooks) merged.hooks = marketplacePlugin.hooks;
  if (marketplacePlugin.mcpServers)
    merged.mcpServers = marketplacePlugin.mcpServers;
  if (marketplacePlugin.outputStyles)
    merged.outputStyles = marketplacePlugin.outputStyles;
  if (marketplacePlugin.lspServers)
    merged.lspServers = marketplacePlugin.lspServers;

  return merged;
}

/**
 * Checks if a config object is in Claude plugin format.
 * @param config Configuration object to check
 * @returns true if config appears to be Claude format
 */
export function isClaudePluginConfig(
  config: unknown,
): config is ClaudePluginConfig {
  if (typeof config !== 'object' || config === null) {
    return false;
  }

  const obj = config as Record<string, unknown>;

  // Must have name and version
  if (typeof obj['name'] !== 'string' || typeof obj['version'] !== 'string') {
    return false;
  }

  // Check for Claude-specific fields
  const hasClaudeFields =
    'agents' in obj ||
    'hooks' in obj ||
    'outputStyles' in obj ||
    'lspServers' in obj;

  return hasClaudeFields;
}
