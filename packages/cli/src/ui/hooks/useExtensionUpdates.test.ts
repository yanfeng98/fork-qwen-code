/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { useExtensionUpdates } from './useExtensionUpdates.js';
import {
  QWEN_DIR,
  type ExtensionManager,
  type Extension,
  type ExtensionUpdateInfo,
  ExtensionUpdateState,
} from '@qwen-code/qwen-code-core';
import { renderHook, waitFor } from '@testing-library/react';
import { MessageType } from '../types.js';

vi.mock('os', async (importOriginal) => {
  const mockedOs = await importOriginal<typeof os>();
  return {
    ...mockedOs,
    homedir: vi.fn(),
  };
});

function createMockExtension(overrides: Partial<Extension> = {}): Extension {
  return {
    id: 'test-extension-id',
    name: 'test-extension',
    version: '1.0.0',
    path: '/some/path',
    isActive: true,
    config: {
      name: 'test-extension',
      version: '1.0.0',
    },
    contextFiles: [],
    installMetadata: {
      type: 'git',
      source: 'https://some/repo',
      autoUpdate: false,
    },
    ...overrides,
  };
}

function createMockExtensionManager(
  extensions: Extension[],
  checkCallback?: (
    callback: (extensionName: string, state: ExtensionUpdateState) => void,
  ) => Promise<void>,
  updateResult?: ExtensionUpdateInfo | undefined,
): ExtensionManager {
  return {
    getLoadedExtensions: vi.fn(() => extensions),
    checkForAllExtensionUpdates: vi.fn(
      async (
        callback: (extensionName: string, state: ExtensionUpdateState) => void,
      ) => {
        if (checkCallback) {
          await checkCallback(callback);
        }
      },
    ),
    updateExtension: vi.fn(async () => updateResult),
  } as unknown as ExtensionManager;
}

describe('useExtensionUpdates', () => {
  let tempHomeDir: string;
  let userExtensionsDir: string;

  beforeEach(() => {
    tempHomeDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qwen-cli-test-home-'));
    vi.mocked(os.homedir).mockReturnValue(tempHomeDir);
    userExtensionsDir = path.join(tempHomeDir, QWEN_DIR, 'extensions');
    fs.mkdirSync(userExtensionsDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tempHomeDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it('should check for updates and log a message if an update is available', async () => {
    const extension = createMockExtension({
      name: 'test-extension',
      installMetadata: {
        type: 'git',
        source: 'https://some/repo',
        autoUpdate: false,
      },
    });
    const addItem = vi.fn();
    const cwd = '/test/cwd';

    const extensionManager = createMockExtensionManager(
      [extension],
      async (callback) => {
        callback('test-extension', ExtensionUpdateState.UPDATE_AVAILABLE);
      },
    );

    renderHook(() => useExtensionUpdates(extensionManager, addItem, cwd));

    await waitFor(() => {
      expect(addItem).toHaveBeenCalledWith(
        {
          type: MessageType.INFO,
          text: 'You have 1 extension with an update available, run "/extensions list" for more information.',
        },
        expect.any(Number),
      );
    });
  });

  it('should check for updates and automatically update if autoUpdate is true', async () => {
    const extension = createMockExtension({
      name: 'test-extension',
      installMetadata: {
        type: 'git',
        source: 'https://some.git/repo',
        autoUpdate: true,
      },
    });

    const addItem = vi.fn();

    const extensionManager = createMockExtensionManager(
      [extension],
      async (callback) => {
        callback('test-extension', ExtensionUpdateState.UPDATE_AVAILABLE);
      },
      {
        originalVersion: '1.0.0',
        updatedVersion: '1.1.0',
        name: 'test-extension',
      },
    );

    renderHook(() =>
      useExtensionUpdates(extensionManager, addItem, tempHomeDir),
    );

    await waitFor(
      () => {
        expect(addItem).toHaveBeenCalledWith(
          {
            type: MessageType.INFO,
            text: 'Extension "test-extension" successfully updated: 1.0.0 → 1.1.0.',
          },
          expect.any(Number),
        );
      },
      { timeout: 4000 },
    );
  });

  it('should batch update notifications for multiple extensions', async () => {
    const extension1 = createMockExtension({
      id: 'test-extension-1-id',
      name: 'test-extension-1',
      version: '1.0.0',
      installMetadata: {
        type: 'git',
        source: 'https://some.git/repo1',
        autoUpdate: true,
      },
    });
    const extension2 = createMockExtension({
      id: 'test-extension-2-id',
      name: 'test-extension-2',
      version: '2.0.0',
      installMetadata: {
        type: 'git',
        source: 'https://some.git/repo2',
        autoUpdate: true,
      },
    });

    const addItem = vi.fn();
    let updateCallCount = 0;

    const extensionManager = {
      getLoadedExtensions: vi.fn(() => [extension1, extension2]),
      checkForAllExtensionUpdates: vi.fn(
        async (
          callback: (
            extensionName: string,
            state: ExtensionUpdateState,
          ) => void,
        ) => {
          callback('test-extension-1', ExtensionUpdateState.UPDATE_AVAILABLE);
          callback('test-extension-2', ExtensionUpdateState.UPDATE_AVAILABLE);
        },
      ),
      updateExtension: vi.fn(async () => {
        updateCallCount++;
        if (updateCallCount === 1) {
          return {
            originalVersion: '1.0.0',
            updatedVersion: '1.1.0',
            name: 'test-extension-1',
          };
        }
        return {
          originalVersion: '2.0.0',
          updatedVersion: '2.1.0',
          name: 'test-extension-2',
        };
      }),
    } as unknown as ExtensionManager;

    renderHook(() =>
      useExtensionUpdates(extensionManager, addItem, tempHomeDir),
    );

    await waitFor(
      () => {
        expect(addItem).toHaveBeenCalledTimes(2);
        expect(addItem).toHaveBeenCalledWith(
          {
            type: MessageType.INFO,
            text: 'Extension "test-extension-1" successfully updated: 1.0.0 → 1.1.0.',
          },
          expect.any(Number),
        );
        expect(addItem).toHaveBeenCalledWith(
          {
            type: MessageType.INFO,
            text: 'Extension "test-extension-2" successfully updated: 2.0.0 → 2.1.0.',
          },
          expect.any(Number),
        );
      },
      { timeout: 4000 },
    );
  });

  it('should batch update notifications for multiple extensions with autoUpdate: false', async () => {
    const extension1 = createMockExtension({
      id: 'test-extension-1-id',
      name: 'test-extension-1',
      version: '1.0.0',
      installMetadata: {
        type: 'git',
        source: 'https://some/repo1',
        autoUpdate: false,
      },
    });
    const extension2 = createMockExtension({
      id: 'test-extension-2-id',
      name: 'test-extension-2',
      version: '2.0.0',
      installMetadata: {
        type: 'git',
        source: 'https://some/repo2',
        autoUpdate: false,
      },
    });

    const addItem = vi.fn();
    const cwd = '/test/cwd';

    const extensionManager = createMockExtensionManager(
      [extension1, extension2],
      async (callback) => {
        callback('test-extension-1', ExtensionUpdateState.UPDATE_AVAILABLE);
        await new Promise((r) => setTimeout(r, 50));
        callback('test-extension-2', ExtensionUpdateState.UPDATE_AVAILABLE);
      },
    );

    renderHook(() => useExtensionUpdates(extensionManager, addItem, cwd));

    await waitFor(() => {
      expect(addItem).toHaveBeenCalledTimes(1);
      expect(addItem).toHaveBeenCalledWith(
        {
          type: MessageType.INFO,
          text: 'You have 2 extensions with an update available, run "/extensions list" for more information.',
        },
        expect.any(Number),
      );
    });
  });
});
