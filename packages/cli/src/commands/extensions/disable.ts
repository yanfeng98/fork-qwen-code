/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { type CommandModule } from 'yargs';
import { SettingScope } from '../../config/settings.js';
import { getErrorMessage } from '../../utils/errors.js';
import { getExtensionManager } from './utils.js';

interface DisableArgs {
  name: string;
  scope?: string;
}

export async function handleDisable(args: DisableArgs) {
  const extensionManager = await getExtensionManager();
  try {
    if (args.scope?.toLowerCase() === 'workspace') {
      extensionManager.disableExtension(args.name, SettingScope.Workspace);
    } else {
      extensionManager.disableExtension(args.name, SettingScope.User);
    }
    console.log(
      `Extension "${args.name}" successfully disabled for scope "${args.scope}".`,
    );
  } catch (error) {
    console.error(getErrorMessage(error));
    process.exit(1);
  }
}

export const disableCommand: CommandModule = {
  command: 'disable [--scope] <name>',
  describe: 'Disables an extension.',
  builder: (yargs) =>
    yargs
      .positional('name', {
        describe: 'The name of the extension to disable.',
        type: 'string',
      })
      .option('scope', {
        describe: 'The scope to disable the extenison in.',
        type: 'string',
        default: SettingScope.User,
      })
      .check((argv) => {
        if (
          argv.scope &&
          !Object.values(SettingScope)
            .map((s) => s.toLowerCase())
            .includes((argv.scope as string).toLowerCase())
        ) {
          throw new Error(
            `Invalid scope: ${argv.scope}. Please use one of ${Object.values(
              SettingScope,
            )
              .map((s) => s.toLowerCase())
              .join(', ')}.`,
          );
        }
        return true;
      }),
  handler: async (argv) => {
    await handleDisable({
      name: argv['name'] as string,
      scope: argv['scope'] as string,
    });
  },
};
