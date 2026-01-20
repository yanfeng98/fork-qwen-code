/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CommandModule } from 'yargs';
import { getExtensionManager } from './utils.js';
import {
  ExtensionSettingScope,
  getScopedEnvContents,
  promptForSetting,
  updateSetting,
} from '@qwen-code/qwen-code-core';

// --- SET COMMAND ---
interface SetArgs {
  name: string;
  setting: string;
  scope: string;
}

const setCommand: CommandModule<object, SetArgs> = {
  command: 'set [--scope] <name> <setting>',
  describe: 'Set a specific setting for an extension.',
  builder: (yargs) =>
    yargs
      .positional('name', {
        describe: 'Name of the extension to configure.',
        type: 'string',
        demandOption: true,
      })
      .positional('setting', {
        describe: 'The setting to configure (name or env var).',
        type: 'string',
        demandOption: true,
      })
      .option('scope', {
        describe: 'The scope to set the setting in.',
        type: 'string',
        choices: ['user', 'workspace'],
        default: 'user',
      }),
  handler: async (args) => {
    const { name, setting, scope } = args;
    const extensionManager = await getExtensionManager();
    if (!extensionManager) return;
    const extensions = extensionManager.getLoadedExtensions();
    if (!extensions || extensions.length === 0) return;
    const extension = extensions.find((e) => e.name === name);
    if (!extension) {
      console.log(`Extension "${name}" not found.`);
      return;
    }
    await updateSetting(
      extension.config,
      extension.id,
      setting,
      promptForSetting,
      scope as ExtensionSettingScope,
    );
  },
};

// --- LIST COMMAND ---
interface ListArgs {
  name: string;
}

const listCommand: CommandModule<object, ListArgs> = {
  command: 'list <name>',
  describe: 'List all settings for an extension.',
  builder: (yargs) =>
    yargs.positional('name', {
      describe: 'Name of the extension.',
      type: 'string',
      demandOption: true,
    }),
  handler: async (args) => {
    const { name } = args;
    const extensionManager = await getExtensionManager();
    if (!extensionManager) return;
    const extensions = extensionManager.getLoadedExtensions();
    if (!extensions || extensions.length === 0) return;
    const extension = extensions.find((e) => e.name === name);
    if (!extension) {
      console.log(`Extension "${name}" not found.`);
      return;
    }
    if (!extension || !extension.settings || extension.settings.length === 0) {
      console.log(`Extension "${name}" has no settings to configure.`);
      return;
    }

    const userSettings = await getScopedEnvContents(
      extension.config,
      extension.id,
      ExtensionSettingScope.USER,
    );
    const workspaceSettings = await getScopedEnvContents(
      extension.config,
      extension.id,
      ExtensionSettingScope.WORKSPACE,
    );
    const mergedSettings = { ...userSettings, ...workspaceSettings };

    console.log(`Settings for "${name}":`);
    for (const setting of extension.settings) {
      const value = mergedSettings[setting.envVar];
      let displayValue: string;
      let scopeInfo = '';

      if (workspaceSettings[setting.envVar] !== undefined) {
        scopeInfo = ' (workspace)';
      } else if (userSettings[setting.envVar] !== undefined) {
        scopeInfo = ' (user)';
      }

      if (value === undefined) {
        displayValue = '[not set]';
      } else if (setting.sensitive) {
        displayValue = '[value stored in keychain]';
      } else {
        displayValue = value;
      }
      console.log(`
- ${setting.name} (${setting.envVar})`);
      console.log(`  Description: ${setting.description}`);
      console.log(`  Value: ${displayValue}${scopeInfo}`);
    }
  },
};

// --- SETTINGS COMMAND ---
export const settingsCommand: CommandModule = {
  command: 'settings <command>',
  describe: 'Manage extension settings.',
  builder: (yargs) =>
    yargs
      .command(setCommand)
      .command(listCommand)
      .demandCommand(1, 'You need to specify a command (set or list).')
      .version(false),
  handler: () => {
    // This handler is not called when a subcommand is provided.
    // Yargs will show the help menu.
  },
};
