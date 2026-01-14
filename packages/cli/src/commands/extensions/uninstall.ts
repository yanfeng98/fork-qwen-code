/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CommandModule } from 'yargs';
import { getErrorMessage } from '../../utils/errors.js';
import { ExtensionManager } from '@qwen-code/qwen-code-core';
import { requestConsentNonInteractive } from './consent.js';
import { isWorkspaceTrusted } from '../../config/trustedFolders.js';
import { loadSettings } from '../../config/settings.js';

interface UninstallArgs {
  name: string; // can be extension name or source URL.
}

export async function handleUninstall(args: UninstallArgs) {
  try {
    const workspaceDir = process.cwd();
    const extensionManager = new ExtensionManager({
      workspaceDir,
      requestConsent: requestConsentNonInteractive,
      isWorkspaceTrusted: !!isWorkspaceTrusted(
        loadSettings(workspaceDir).merged,
      ),
    });
    await extensionManager.refreshCache();
    await extensionManager.uninstallExtension(args.name, false);
    console.log(`Extension "${args.name}" successfully uninstalled.`);
  } catch (error) {
    console.error(getErrorMessage(error));
    process.exit(1);
  }
}

export const uninstallCommand: CommandModule = {
  command: 'uninstall <name>',
  describe: 'Uninstalls an extension.',
  builder: (yargs) =>
    yargs
      .positional('name', {
        describe: 'The name or source path of the extension to uninstall.',
        type: 'string',
      })
      .check((argv) => {
        if (!argv.name) {
          throw new Error(
            'Please include the name of the extension to uninstall as a positional argument.',
          );
        }
        return true;
      }),
  handler: async (argv) => {
    await handleUninstall({
      name: argv['name'] as string,
    });
  },
};
