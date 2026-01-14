/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { getErrorMessage } from '../../utils/errors.js';
import { ExtensionUpdateState } from '../state/extensions.js';
import { MessageType } from '../types.js';
import {
  type CommandContext,
  type SlashCommand,
  CommandKind,
} from './types.js';
import { t } from '../../i18n/index.js';
import type { ExtensionUpdateInfo } from '@qwen-code/qwen-code-core';

function showMessageIfNoExtensions(
  context: CommandContext,
  extensions: unknown[],
): boolean {
  if (extensions.length === 0) {
    context.ui.addItem(
      {
        type: MessageType.INFO,
        text: 'No extensions installed. Run `/extensions explore` to check out the gallery.',
      },
      Date.now(),
    );
    return true;
  }
  return false;
}

async function listAction(context: CommandContext) {
  const extensions = context.services.config
    ? context.services.config.getExtensions()
    : [];

  if (showMessageIfNoExtensions(context, extensions)) {
    return;
  }

  context.ui.addItem(
    {
      type: MessageType.EXTENSIONS_LIST,
    },
    Date.now(),
  );
}

async function updateAction(context: CommandContext, args: string) {
  const updateArgs = args.split(' ').filter((value) => value.length > 0);
  const all = updateArgs.length === 1 && updateArgs[0] === '--all';
  const names = all ? undefined : updateArgs;

  if (!all && names?.length === 0) {
    context.ui.addItem(
      {
        type: MessageType.ERROR,
        text: 'Usage: /extensions update <extension-names>|--all',
      },
      Date.now(),
    );
    return;
  }

  let updateInfos: ExtensionUpdateInfo[] = [];

  const extensionManager = context.services.config!.getExtensionManager();
  const extensions = context.services.config
    ? context.services.config.getExtensions()
    : [];

  if (showMessageIfNoExtensions(context, extensions)) {
    return Promise.resolve();
  }

  try {
    context.ui.dispatchExtensionStateUpdate({ type: 'BATCH_CHECK_START' });
    await extensionManager.checkForAllExtensionUpdates((extensionName, state) =>
      context.ui.dispatchExtensionStateUpdate({
        type: 'SET_STATE',
        payload: { name: extensionName, state },
      }),
    );
    context.ui.dispatchExtensionStateUpdate({ type: 'BATCH_CHECK_END' });

    context.ui.setPendingItem({
      type: MessageType.EXTENSIONS_LIST,
    });
    if (all) {
      updateInfos = await extensionManager.updateAllUpdatableExtensions(
        context.ui.extensionsUpdateState,
        (extensionName, state) =>
          context.ui.dispatchExtensionStateUpdate({
            type: 'SET_STATE',
            payload: { name: extensionName, state },
          }),
      );
    } else if (names?.length) {
      const extensions = context.services.config!.getExtensions();
      for (const name of names) {
        const extension = extensions.find(
          (extension) => extension.name === name,
        );
        if (!extension) {
          context.ui.addItem(
            {
              type: MessageType.ERROR,
              text: `Extension ${name} not found.`,
            },
            Date.now(),
          );
          continue;
        }
        const updateInfo = await extensionManager.updateExtension(
          extension,
          context.ui.extensionsUpdateState.get(extension.name)?.status ??
            ExtensionUpdateState.UNKNOWN,
          (extensionName, state) =>
            context.ui.dispatchExtensionStateUpdate({
              type: 'SET_STATE',
              payload: { name: extensionName, state },
            }),
        );
        if (updateInfo) updateInfos.push(updateInfo);
      }
    }

    if (updateInfos.length === 0) {
      context.ui.addItem(
        {
          type: MessageType.INFO,
          text: 'No extensions to update.',
        },
        Date.now(),
      );
      return;
    }
  } catch (error) {
    context.ui.addItem(
      {
        type: MessageType.ERROR,
        text: getErrorMessage(error),
      },
      Date.now(),
    );
  } finally {
    context.ui.addItem(
      {
        type: MessageType.EXTENSIONS_LIST,
      },
      Date.now(),
    );
    context.ui.setPendingItem(null);
  }
}

const listExtensionsCommand: SlashCommand = {
  name: 'list',
  get description() {
    return t('List active extensions');
  },
  kind: CommandKind.BUILT_IN,
  action: listAction,
};

const updateExtensionsCommand: SlashCommand = {
  name: 'update',
  get description() {
    return t('Update extensions. Usage: update <extension-names>|--all');
  },
  kind: CommandKind.BUILT_IN,
  action: updateAction,
  completion: async (context, partialArg) => {
    const extensions = context.services.config?.getExtensions() ?? [];
    const extensionNames = extensions.map((ext) => ext.name);
    const suggestions = extensionNames.filter((name) =>
      name.startsWith(partialArg),
    );

    if ('--all'.startsWith(partialArg) || 'all'.startsWith(partialArg)) {
      suggestions.unshift('--all');
    }

    return suggestions;
  },
};

export const extensionsCommand: SlashCommand = {
  name: 'extensions',
  get description() {
    return t('Manage extensions');
  },
  kind: CommandKind.BUILT_IN,
  subCommands: [listExtensionsCommand, updateExtensionsCommand],
  action: (context, args) =>
    // Default to list if no subcommand is provided
    listExtensionsCommand.action!(context, args),
};
