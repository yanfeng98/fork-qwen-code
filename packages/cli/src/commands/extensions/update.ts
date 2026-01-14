/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import type { CommandModule } from 'yargs';
import { getErrorMessage } from '../../utils/errors.js';
import { ExtensionUpdateState } from '../../ui/state/extensions.js';
import {
  checkForExtensionUpdate,
  type ExtensionUpdateInfo,
} from '@qwen-code/qwen-code-core';
import { getExtensionManager } from './utils.js';

interface UpdateArgs {
  name?: string;
  all?: boolean;
}

const updateOutput = (info: ExtensionUpdateInfo) =>
  `Extension "${info.name}" successfully updated: ${info.originalVersion} → ${info.updatedVersion}.`;

export async function handleUpdate(args: UpdateArgs) {
  const extensionManager = await getExtensionManager();
  const extensions = extensionManager.getLoadedExtensions();

  if (args.name) {
    try {
      const extension = extensions.find(
        (extension) => extension.name === args.name,
      );
      if (!extension) {
        console.log(`Extension "${args.name}" not found.`);
        return;
      }
      if (!extension.installMetadata) {
        console.log(
          `Unable to install extension "${args.name}" due to missing install metadata`,
        );
        return;
      }
      const updateState = await checkForExtensionUpdate(
        extension,
        extensionManager,
      );
      if (updateState !== ExtensionUpdateState.UPDATE_AVAILABLE) {
        console.log(`Extension "${args.name}" is already up to date.`);
        return;
      }
      // TODO(chrstnb): we should list extensions if the requested extension is not installed.
      const updatedExtensionInfo = (await extensionManager.updateExtension(
        extension,
        updateState,
        () => {},
      ))!;
      if (
        updatedExtensionInfo.originalVersion !==
        updatedExtensionInfo.updatedVersion
      ) {
        console.log(
          `Extension "${args.name}" successfully updated: ${updatedExtensionInfo.originalVersion} → ${updatedExtensionInfo.updatedVersion}.`,
        );
      } else {
        console.log(`Extension "${args.name}" is already up to date.`);
      }
    } catch (error) {
      console.error(getErrorMessage(error));
    }
  }
  if (args.all) {
    try {
      const extensionState = new Map();
      await extensionManager.checkForAllExtensionUpdates(
        (extensionName, state) => {
          extensionState.set(extensionName, {
            status: state,
            processed: true, // No need to process as we will force the update.
          });
        },
      );
      let updateInfos = await extensionManager.updateAllUpdatableExtensions(
        extensionState,
        () => {},
      );
      updateInfos = updateInfos.filter(
        (info) => info.originalVersion !== info.updatedVersion,
      );
      if (updateInfos.length === 0) {
        console.log('No extensions to update.');
        return;
      }
      console.log(updateInfos.map((info) => updateOutput(info)).join('\n'));
    } catch (error) {
      console.error(getErrorMessage(error));
    }
  }
}

export const updateCommand: CommandModule = {
  command: 'update [<name>] [--all]',
  describe:
    'Updates all extensions or a named extension to the latest version.',
  builder: (yargs) =>
    yargs
      .positional('name', {
        describe: 'The name of the extension to update.',
        type: 'string',
      })
      .option('all', {
        describe: 'Update all extensions.',
        type: 'boolean',
      })
      .conflicts('name', 'all')
      .check((argv) => {
        if (!argv.all && !argv.name) {
          throw new Error('Either an extension name or --all must be provided');
        }
        return true;
      }),
  handler: async (argv) => {
    await handleUpdate({
      name: argv['name'] as string | undefined,
      all: argv['all'] as boolean | undefined,
    });
  },
};
