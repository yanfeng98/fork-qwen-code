/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * This module handles installation of extensions from Claude marketplaces.
 *
 * A marketplace URL format: marketplace-url:plugin-name
 * Example: https://github.com/example/marketplace:my-plugin
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { ExtensionConfig } from './extensionManager.js';
import {
  convertClaudeToQwenConfig,
  mergeClaudeConfigs,
  type ClaudeMarketplaceConfig,
  type ClaudeMarketplacePluginConfig,
  type ClaudePluginConfig,
} from './claude-converter.js';
import { cloneFromGit, downloadFromGitHubRelease } from './github.js';
import type { ExtensionInstallMetadata } from '@qwen-code/qwen-code-core';

export interface MarketplaceInstallOptions {
  marketplaceUrl: string;
  pluginName: string;
  tempDir: string;
  requestConsent: (consent: string) => Promise<boolean>;
}

export interface MarketplaceInstallResult {
  config: ExtensionConfig;
  sourcePath: string;
  installMetadata: ExtensionInstallMetadata;
}

/**
 * Parse marketplace install source string.
 * Format: marketplace-url:plugin-name
 */
export function parseMarketplaceSource(source: string): {
  marketplaceSource: string;
  pluginName: string;
} | null {
  // Check if source contains a colon separator
  const lastColonIndex = source.lastIndexOf(':');
  if (lastColonIndex === -1) {
    return null;
  }

  // Split at the last colon to separate URL from plugin name
  const marketplaceSource = source.substring(0, lastColonIndex);
  const pluginName = source.substring(lastColonIndex + 1);

  // Validate that marketplace URL looks like a URL
  if (
    !marketplaceSource.startsWith('http://') &&
    !marketplaceSource.startsWith('https://')
  ) {
    return null;
  }

  if (!pluginName || pluginName.length === 0) {
    return null;
  }

  return { marketplaceSource, pluginName };
}

/**
 * Install an extension from a Claude marketplace.
 *
 * Process:
 * 1. Download marketplace repository
 * 2. Parse marketplace.json
 * 3. Find the specified plugin
 * 4. Download/copy plugin source
 * 5. Merge configurations (if strict mode)
 * 6. Convert to Qwen format
 */
export async function installFromMarketplace(
  options: MarketplaceInstallOptions,
): Promise<MarketplaceInstallResult> {
  const {
    marketplaceUrl,
    pluginName,
    tempDir,
    requestConsent: _requestConsent,
  } = options;

  // Step 1: Download marketplace repository
  const marketplaceDir = path.join(tempDir, 'marketplace');
  await fs.promises.mkdir(marketplaceDir, { recursive: true });

  console.log(`Downloading marketplace from ${marketplaceUrl}...`);
  const installMetadata: ExtensionInstallMetadata = {
    source: marketplaceUrl,
    type: 'git',
  };

  try {
    await downloadFromGitHubRelease(installMetadata, marketplaceDir);
  } catch {
    await cloneFromGit(installMetadata, marketplaceDir);
  }

  // Step 2: Parse marketplace.json
  const marketplaceConfigPath = path.join(marketplaceDir, 'marketplace.json');
  if (!fs.existsSync(marketplaceConfigPath)) {
    throw new Error(
      `Marketplace configuration not found at ${marketplaceConfigPath}`,
    );
  }

  const marketplaceConfigContent = await fs.promises.readFile(
    marketplaceConfigPath,
    'utf-8',
  );
  const marketplaceConfig: ClaudeMarketplaceConfig = JSON.parse(
    marketplaceConfigContent,
  );

  // Step 3: Find the plugin
  const pluginConfig = marketplaceConfig.plugins.find(
    (p) => p.name.toLowerCase() === pluginName.toLowerCase(),
  );

  if (!pluginConfig) {
    throw new Error(
      `Plugin "${pluginName}" not found in marketplace. Available plugins: ${marketplaceConfig.plugins.map((p) => p.name).join(', ')}`,
    );
  }

  // Step 4: Download/copy plugin source
  const pluginDir = path.join(tempDir, 'plugin');
  await fs.promises.mkdir(pluginDir, { recursive: true });

  const pluginSource = await resolvePluginSource(
    pluginConfig,
    marketplaceDir,
    pluginDir,
  );

  // Step 5: Merge configurations (if strict mode)
  let finalPluginConfig: ClaudePluginConfig;
  const strict = pluginConfig.strict ?? true;

  if (strict) {
    // Read plugin.json from plugin source
    const pluginJsonPath = path.join(
      pluginSource,
      '.claude-plugin',
      'plugin.json',
    );
    if (!fs.existsSync(pluginJsonPath)) {
      throw new Error(
        `Strict mode requires plugin.json at ${pluginJsonPath}, but file not found`,
      );
    }

    const pluginJsonContent = await fs.promises.readFile(
      pluginJsonPath,
      'utf-8',
    );
    const basePluginConfig: ClaudePluginConfig = JSON.parse(pluginJsonContent);

    // Merge marketplace config with plugin config
    finalPluginConfig = mergeClaudeConfigs(pluginConfig, basePluginConfig);
  } else {
    // Use marketplace config directly
    finalPluginConfig = pluginConfig;
  }

  // Step 6: Convert to Qwen format
  const qwenConfig = convertClaudeToQwenConfig(finalPluginConfig);

  return {
    config: qwenConfig,
    sourcePath: pluginSource,
    installMetadata: {
      source: `${marketplaceUrl}:${pluginName}`,
      type: 'git', // Marketplace installs are treated as git installs
    },
  };
}

/**
 * Resolve plugin source from marketplace plugin configuration.
 * Returns the absolute path to the plugin source directory.
 */
async function resolvePluginSource(
  pluginConfig: ClaudeMarketplacePluginConfig,
  marketplaceDir: string,
  pluginDir: string,
): Promise<string> {
  const source = pluginConfig.source;

  // Handle string source (relative path or URL)
  if (typeof source === 'string') {
    // Check if it's a URL
    if (source.startsWith('http://') || source.startsWith('https://')) {
      // Download from URL
      const installMetadata: ExtensionInstallMetadata = {
        source,
        type: 'git',
      };
      try {
        await downloadFromGitHubRelease(installMetadata, pluginDir);
      } catch {
        await cloneFromGit(installMetadata, pluginDir);
      }
      return pluginDir;
    }

    // Relative path within marketplace
    const pluginRoot = marketplaceDir;
    const sourcePath = path.join(pluginRoot, source);

    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Plugin source not found at ${sourcePath}`);
    }

    // Copy to plugin directory
    await fs.promises.cp(sourcePath, pluginDir, { recursive: true });
    return pluginDir;
  }

  // Handle object source (github or url)
  if (source.source === 'github') {
    const installMetadata: ExtensionInstallMetadata = {
      source: `https://github.com/${source.repo}`,
      type: 'git',
    };
    try {
      await downloadFromGitHubRelease(installMetadata, pluginDir);
    } catch {
      await cloneFromGit(installMetadata, pluginDir);
    }
    return pluginDir;
  }

  if (source.source === 'url') {
    const installMetadata: ExtensionInstallMetadata = {
      source: source.url,
      type: 'git',
    };
    try {
      await downloadFromGitHubRelease(installMetadata, pluginDir);
    } catch {
      await cloneFromGit(installMetadata, pluginDir);
    }
    return pluginDir;
  }

  throw new Error(`Unsupported plugin source type: ${JSON.stringify(source)}`);
}
