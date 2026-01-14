/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CommandModule } from 'yargs';

import {
  ExtensionManager,
  parseInstallSource,
} from '@qwen-code/qwen-code-core';
import { getErrorMessage } from '../../utils/errors.js';
import { isWorkspaceTrusted } from '../../config/trustedFolders.js';
import { loadSettings } from '../../config/settings.js';
import { requestConsentNonInteractive } from './consent.js';

interface InstallArgs {
  source: string;
  ref?: string;
  autoUpdate?: boolean;
  allowPreRelease?: boolean;
  consent?: boolean;
}

export async function handleInstall(args: InstallArgs) {
  try {
    const installMetadata = await parseInstallSource(args.source);

    if (
      installMetadata.type !== 'git' &&
      installMetadata.type !== 'github-release'
    ) {
      if (args.ref || args.autoUpdate) {
        throw new Error(
          '--ref and --auto-update are not applicable for marketplace extensions.',
        );
      }
    }

    const requestConsent = args.consent
      ? () => Promise.resolve(true)
      : requestConsentNonInteractive;
    const workspaceDir = process.cwd();
    const extensionManager = new ExtensionManager({
      workspaceDir,
      isWorkspaceTrusted: !!isWorkspaceTrusted(
        loadSettings(workspaceDir).merged,
      ),
      requestConsent,
    });
    await extensionManager.refreshCache();

    const extension = await extensionManager.installExtension(
      {
        ...installMetadata,
        ref: args.ref,
        autoUpdate: args.autoUpdate,
        allowPreRelease: args.allowPreRelease,
      },
      requestConsent,
    );
    console.log(
      `Extension "${extension.name}" installed successfully and enabled.`,
    );
  } catch (error) {
    console.error(getErrorMessage(error));
    process.exit(1);
  }
}

export const installCommand: CommandModule = {
  command: 'install <source>',
  describe:
    'Installs an extension from a git repository URL, local path, or claude marketplace (marketplace-url:plugin-name).',
  builder: (yargs) =>
    yargs
      .positional('source', {
        describe:
          'The github URL, local path, or marketplace source (marketplace-url:plugin-name) of the extension to install.',
        type: 'string',
        demandOption: true,
      })
      .option('ref', {
        describe: 'The git ref to install from.',
        type: 'string',
      })
      .option('auto-update', {
        describe: 'Enable auto-update for this extension.',
        type: 'boolean',
      })
      .option('pre-release', {
        describe: 'Enable pre-release versions for this extension.',
        type: 'boolean',
      })
      .option('consent', {
        describe:
          'Acknowledge the security risks of installing an extension and skip the confirmation prompt.',
        type: 'boolean',
        default: false,
      })
      .check((argv) => {
        if (!argv.source) {
          throw new Error('The source argument must be provided.');
        }
        return true;
      }),
  handler: async (argv) => {
    await handleInstall({
      source: argv['source'] as string,
      ref: argv['ref'] as string | undefined,
      autoUpdate: argv['auto-update'] as boolean | undefined,
      allowPreRelease: argv['pre-release'] as boolean | undefined,
      consent: argv['consent'] as boolean | undefined,
    });
  },
};
