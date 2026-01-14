/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Converter for Claude Code plugins to Qwen Code format.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { glob } from 'glob';
import type { ExtensionConfig } from './extensionManager.js';
import type { MCPServerConfig } from '@qwen-code/qwen-code-core';
import { ExtensionStorage } from './storage.js';

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

  // Direct field mapping - commands, skills, agents will be collected as folders
  return {
    name: claudeConfig.name,
    version: claudeConfig.version,
    mcpServers,
  };
}

/**
 * Converts a complete Claude plugin package to Qwen Code format.
 * Creates a new temporary directory with:
 * 1. Converted qwen-extension.json
 * 2. Commands, skills, and agents collected to respective folders
 * 3. MCP servers resolved from JSON files if needed
 * 4. All other files preserved
 *
 * @param extensionDir Path to the Claude plugin directory
 * @param marketplace Marketplace information for loading marketplace.json
 * @returns Object containing converted config and the temporary directory path
 */
export async function convertClaudePluginPackage(
  extensionDir: string,
  marketplace: { marketplaceSource: string; pluginName: string },
): Promise<{ config: ExtensionConfig; convertedDir: string }> {
  // Step 1: Load marketplace.json
  const marketplaceJsonPath = path.join(
    extensionDir,
    '.claude-plugin',
    'marketplace.json',
  );
  if (!fs.existsSync(marketplaceJsonPath)) {
    throw new Error(
      `Marketplace configuration not found at ${marketplaceJsonPath}`,
    );
  }

  const marketplaceContent = fs.readFileSync(marketplaceJsonPath, 'utf-8');
  const marketplaceConfig: ClaudeMarketplaceConfig =
    JSON.parse(marketplaceContent);

  // Find the target plugin in marketplace
  const marketplacePlugin = marketplaceConfig.plugins.find(
    (p) => p.name === marketplace.pluginName,
  );
  if (!marketplacePlugin) {
    throw new Error(
      `Plugin ${marketplace.pluginName} not found in marketplace.json`,
    );
  }

  // Step 2: Resolve plugin source directory based on source field
  const source = marketplacePlugin.source;
  let pluginSourceDir: string;

  if (typeof source === 'string') {
    // Check if it's a URL (online path)
    if (source.startsWith('http://') || source.startsWith('https://')) {
      throw new Error(
        `Online plugin sources are not supported in convertClaudePluginPackage. ` +
          `Plugin ${marketplace.pluginName} has source: ${source}. ` +
          `This should be downloaded and resolved before calling this function.`,
      );
    }
    // Relative path within marketplace directory
    const marketplaceDir = marketplaceConfig.metadata?.pluginRoot
      ? path.join(extensionDir, marketplaceConfig.metadata.pluginRoot)
      : extensionDir;
    pluginSourceDir = path.join(marketplaceDir, source);
  } else if (source.source === 'github' || source.source === 'url') {
    throw new Error(
      `Online plugin sources (github/url) are not supported in convertClaudePluginPackage. ` +
        `Plugin ${marketplace.pluginName} has source type: ${source.source}. ` +
        `This should be downloaded and resolved before calling this function.`,
    );
  } else {
    throw new Error(
      `Unsupported plugin source type for ${marketplace.pluginName}: ${JSON.stringify(source)}`,
    );
  }

  if (!fs.existsSync(pluginSourceDir)) {
    throw new Error(`Plugin source directory not found: ${pluginSourceDir}`);
  }

  // Step 3: Load and merge plugin.json if exists (based on strict mode)
  const strict = marketplacePlugin.strict ?? true;
  let mergedConfig: ClaudePluginConfig;

  if (strict) {
    const pluginJsonPath = path.join(
      pluginSourceDir,
      '.claude-plugin',
      'plugin.json',
    );
    if (!fs.existsSync(pluginJsonPath)) {
      throw new Error(`Strict mode requires plugin.json at ${pluginJsonPath}`);
    }
    const pluginContent = fs.readFileSync(pluginJsonPath, 'utf-8');
    const pluginConfig: ClaudePluginConfig = JSON.parse(pluginContent);
    mergedConfig = mergeClaudeConfigs(marketplacePlugin, pluginConfig);
  } else {
    mergedConfig = marketplacePlugin as ClaudePluginConfig;
  }

  // Step 4: Resolve MCP servers from JSON files if needed
  if (mergedConfig.mcpServers && typeof mergedConfig.mcpServers === 'string') {
    const mcpServersPath = path.isAbsolute(mergedConfig.mcpServers)
      ? mergedConfig.mcpServers
      : path.join(pluginSourceDir, mergedConfig.mcpServers);

    if (fs.existsSync(mcpServersPath)) {
      try {
        const mcpContent = fs.readFileSync(mcpServersPath, 'utf-8');
        mergedConfig.mcpServers = JSON.parse(mcpContent) as Record<
          string,
          MCPServerConfig
        >;
      } catch (error) {
        console.warn(
          `Failed to parse MCP servers file ${mcpServersPath}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  // Step 5: Create temporary directory for converted extension
  const tmpDir = await ExtensionStorage.createTmpDir();

  try {
    // Step 6: Copy plugin files to temporary directory
    await copyDirectory(pluginSourceDir, tmpDir);

    // Step 7: Collect commands to commands folder
    if (mergedConfig.commands) {
      const commandsDestDir = path.join(tmpDir, 'commands');
      await collectResources(
        mergedConfig.commands,
        pluginSourceDir,
        commandsDestDir,
      );
    }

    // Step 8: Collect skills to skills folder
    if (mergedConfig.skills) {
      const skillsDestDir = path.join(tmpDir, 'skills');
      await collectResources(
        mergedConfig.skills,
        pluginSourceDir,
        skillsDestDir,
      );
    }

    // Step 9: Collect agents to agents folder
    if (mergedConfig.agents) {
      const agentsDestDir = path.join(tmpDir, 'agents');
      await collectResources(
        mergedConfig.agents,
        pluginSourceDir,
        agentsDestDir,
      );
    }

    // Step 10: Convert to Qwen format config
    const qwenConfig = convertClaudeToQwenConfig(mergedConfig);

    // Step 11: Write qwen-extension.json
    const qwenConfigPath = path.join(tmpDir, 'qwen-extension.json');
    fs.writeFileSync(
      qwenConfigPath,
      JSON.stringify(qwenConfig, null, 2),
      'utf-8',
    );

    return {
      config: qwenConfig,
      convertedDir: tmpDir,
    };
  } catch (error) {
    // Clean up temporary directory on error
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
    throw error;
  }
}

/**
 * Recursively copies a directory and its contents.
 * @param source Source directory path
 * @param destination Destination directory path
 */
async function copyDirectory(
  source: string,
  destination: string,
): Promise<void> {
  // Create destination directory if it doesn't exist
  if (!fs.existsSync(destination)) {
    fs.mkdirSync(destination, { recursive: true });
  }

  const entries = fs.readdirSync(source, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const destPath = path.join(destination, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, destPath);
    } else {
      fs.copyFileSync(sourcePath, destPath);
    }
  }
}

/**
 * Collects resources (commands, skills, agents) to a destination folder.
 * If a resource is already in the destination folder, it will be skipped.
 * @param resourcePaths String or array of resource paths
 * @param pluginRoot Root directory of the plugin
 * @param destDir Destination directory for collected resources
 */
async function collectResources(
  resourcePaths: string | string[],
  pluginRoot: string,
  destDir: string,
): Promise<void> {
  const paths = Array.isArray(resourcePaths) ? resourcePaths : [resourcePaths];

  // Create destination directory
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }

  // Get the destination folder name (e.g., 'commands', 'skills', 'agents')
  const destFolderName = path.basename(destDir);

  for (const resourcePath of paths) {
    const resolvedPath = path.isAbsolute(resourcePath)
      ? resourcePath
      : path.join(pluginRoot, resourcePath);

    if (!fs.existsSync(resolvedPath)) {
      console.warn(`Resource path not found: ${resolvedPath}`);
      continue;
    }

    const stat = fs.statSync(resolvedPath);

    if (stat.isDirectory()) {
      // If it's a directory, check if it's already the destination folder
      const dirName = path.basename(resolvedPath);
      const parentDir = path.dirname(resolvedPath);

      // If the directory is already named as the destination folder (e.g., 'commands')
      // and it's at the plugin root level, skip it
      if (dirName === destFolderName && parentDir === pluginRoot) {
        console.log(
          `Skipping ${resolvedPath} as it's already in the correct location`,
        );
        continue;
      }

      // Copy all files from the directory
      const files = await glob('**/*', {
        cwd: resolvedPath,
        nodir: true,
        dot: false,
      });

      for (const file of files) {
        const srcFile = path.join(resolvedPath, file);
        const destFile = path.join(destDir, file);

        // Ensure parent directory exists
        const destFileDir = path.dirname(destFile);
        if (!fs.existsSync(destFileDir)) {
          fs.mkdirSync(destFileDir, { recursive: true });
        }

        fs.copyFileSync(srcFile, destFile);
      }
    } else {
      // If it's a file, check if it's already in the destination folder
      const relativePath = path.relative(pluginRoot, resolvedPath);

      // Check if the file path starts with the destination folder name
      // e.g., 'commands/test1.md' or 'commands/me/test.md' should be skipped
      const segments = relativePath.split(path.sep);
      if (segments.length > 0 && segments[0] === destFolderName) {
        console.log(
          `Skipping ${resolvedPath} as it's already in ${destFolderName}/`,
        );
        continue;
      }

      // Copy the file to destination
      const fileName = path.basename(resolvedPath);
      const destFile = path.join(destDir, fileName);
      fs.copyFileSync(resolvedPath, destFile);
    }
  }
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
  extensionDir: string,
  marketplace: { marketplaceSource: string; pluginName: string },
) {
  const marketplaceConfigFilePath = path.join(
    extensionDir,
    '.claude-plugin/marketplace.json',
  );
  if (!fs.existsSync(marketplaceConfigFilePath)) {
    return false;
  }

  const marketplaceConfigContent = fs.readFileSync(
    marketplaceConfigFilePath,
    'utf-8',
  );
  const marketplaceConfig = JSON.parse(marketplaceConfigContent);

  if (typeof marketplaceConfig !== 'object' || marketplaceConfig === null) {
    return false;
  }

  const marketplaceConfigObj = marketplaceConfig as Record<string, unknown>;

  // Must have name and owner
  if (
    typeof marketplaceConfigObj['name'] !== 'string' ||
    typeof marketplaceConfigObj['owner'] !== 'object'
  ) {
    return false;
  }

  if (!Array.isArray(marketplaceConfigObj['plugins'])) {
    return false;
  }

  const marketplacePluginObj = marketplaceConfigObj['plugins'].find(
    (plugin: ClaudeMarketplacePluginConfig) =>
      plugin.name === marketplace.pluginName,
  );

  if (!marketplacePluginObj) return false;

  return true;
}
