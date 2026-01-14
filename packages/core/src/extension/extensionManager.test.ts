/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  INSTALL_METADATA_FILENAME,
  EXTENSIONS_CONFIG_FILENAME,
} from './variables.js';
import { QWEN_DIR } from '../config/storage.js';
import {
  ExtensionManager,
  SettingScope,
  type ExtensionManagerOptions,
} from './extensionManager.js';
import type { MCPServerConfig, ExtensionInstallMetadata } from '../index.js';

const mockGit = {
  clone: vi.fn(),
  getRemotes: vi.fn(),
  fetch: vi.fn(),
  checkout: vi.fn(),
  listRemote: vi.fn(),
  revparse: vi.fn(),
  path: vi.fn(),
};

vi.mock('simple-git', () => ({
  simpleGit: vi.fn((path: string) => {
    mockGit.path.mockReturnValue(path);
    return mockGit;
  }),
}));

vi.mock('./github.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./github.js')>();
  return {
    ...actual,
    downloadFromGitHubRelease: vi
      .fn()
      .mockRejectedValue(new Error('Mocked GitHub release download failure')),
  };
});

const mockHomedir = vi.hoisted(() => vi.fn());
vi.mock('os', async (importOriginal) => {
  const mockedOs = await importOriginal<typeof os>();
  return {
    ...mockedOs,
    homedir: mockHomedir,
  };
});

const mockLogExtensionEnable = vi.hoisted(() => vi.fn());
const mockLogExtensionInstallEvent = vi.hoisted(() => vi.fn());
const mockLogExtensionUninstall = vi.hoisted(() => vi.fn());
const mockLogExtensionDisable = vi.hoisted(() => vi.fn());
const mockLogExtensionUpdateEvent = vi.hoisted(() => vi.fn());
vi.mock('../telemetry/loggers.js', () => ({
  logExtensionEnable: mockLogExtensionEnable,
  logExtensionUpdateEvent: mockLogExtensionUpdateEvent,
}));

vi.mock('../index.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../index.js')>();
  return {
    ...actual,
    logExtensionEnable: mockLogExtensionEnable,
    logExtensionInstallEvent: mockLogExtensionInstallEvent,
    logExtensionUninstall: mockLogExtensionUninstall,
    logExtensionDisable: mockLogExtensionDisable,
  };
});

const EXTENSIONS_DIRECTORY_NAME = path.join(QWEN_DIR, 'extensions');

function createExtension({
  extensionsDir = 'extensions-dir',
  name = 'my-extension',
  version = '1.0.0',
  addContextFile = false,
  contextFileName = undefined as string | undefined,
  mcpServers = {} as Record<string, MCPServerConfig>,
  installMetadata = undefined as ExtensionInstallMetadata | undefined,
} = {}): string {
  const extDir = path.join(extensionsDir, name);
  fs.mkdirSync(extDir, { recursive: true });
  fs.writeFileSync(
    path.join(extDir, EXTENSIONS_CONFIG_FILENAME),
    JSON.stringify({ name, version, contextFileName, mcpServers }),
  );

  if (addContextFile) {
    fs.writeFileSync(path.join(extDir, 'QWEN.md'), 'context');
  }

  if (contextFileName) {
    fs.writeFileSync(path.join(extDir, contextFileName), 'context');
  }

  if (installMetadata) {
    fs.writeFileSync(
      path.join(extDir, INSTALL_METADATA_FILENAME),
      JSON.stringify(installMetadata),
    );
  }
  return extDir;
}

describe('extension tests', () => {
  let tempHomeDir: string;
  let tempWorkspaceDir: string;
  let userExtensionsDir: string;

  beforeEach(() => {
    tempHomeDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'qwen-code-test-home-'),
    );
    tempWorkspaceDir = fs.mkdtempSync(
      path.join(tempHomeDir, 'qwen-code-test-workspace-'),
    );
    userExtensionsDir = path.join(tempHomeDir, EXTENSIONS_DIRECTORY_NAME);
    fs.mkdirSync(userExtensionsDir, { recursive: true });

    mockHomedir.mockReturnValue(tempHomeDir);
    vi.spyOn(process, 'cwd').mockReturnValue(tempWorkspaceDir);
    Object.values(mockGit).forEach((fn) => fn.mockReset());
  });

  afterEach(() => {
    fs.rmSync(tempHomeDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  function createExtensionManager(
    options: Partial<ExtensionManagerOptions> = {},
  ): ExtensionManager {
    return new ExtensionManager({
      workspaceDir: tempWorkspaceDir,
      isWorkspaceTrusted: true,
      ...options,
    });
  }

  describe('loadExtension', () => {
    it('should include extension path in loaded extension', async () => {
      const extensionDir = path.join(userExtensionsDir, 'test-extension');
      fs.mkdirSync(extensionDir, { recursive: true });

      createExtension({
        extensionsDir: userExtensionsDir,
        name: 'test-extension',
        version: '1.0.0',
      });

      const manager = createExtensionManager();
      await manager.refreshCache();
      const extensions = manager.getLoadedExtensions();

      expect(extensions).toHaveLength(1);
      expect(extensions[0].path).toBe(extensionDir);
      expect(extensions[0].config.name).toBe('test-extension');
    });

    it('should load context file path when QWEN.md is present', async () => {
      createExtension({
        extensionsDir: userExtensionsDir,
        name: 'ext1',
        version: '1.0.0',
        addContextFile: true,
      });
      createExtension({
        extensionsDir: userExtensionsDir,
        name: 'ext2',
        version: '2.0.0',
      });

      const manager = createExtensionManager();
      await manager.refreshCache();
      const extensions = manager.getLoadedExtensions();

      expect(extensions).toHaveLength(2);
      const ext1 = extensions.find((e) => e.config.name === 'ext1');
      const ext2 = extensions.find((e) => e.config.name === 'ext2');
      expect(ext1?.contextFiles).toEqual([
        path.join(userExtensionsDir, 'ext1', 'QWEN.md'),
      ]);
      expect(ext2?.contextFiles).toEqual([]);
    });

    it('should load context file path from the extension config', async () => {
      createExtension({
        extensionsDir: userExtensionsDir,
        name: 'ext1',
        version: '1.0.0',
        addContextFile: false,
        contextFileName: 'my-context-file.md',
      });

      const manager = createExtensionManager();
      await manager.refreshCache();
      const extensions = manager.getLoadedExtensions();

      expect(extensions).toHaveLength(1);
      const ext1 = extensions.find((e) => e.config.name === 'ext1');
      expect(ext1?.contextFiles).toEqual([
        path.join(userExtensionsDir, 'ext1', 'my-context-file.md'),
      ]);
    });

    it('should skip extensions with invalid JSON and log a warning', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // Good extension
      createExtension({
        extensionsDir: userExtensionsDir,
        name: 'good-ext',
        version: '1.0.0',
      });

      // Bad extension
      const badExtDir = path.join(userExtensionsDir, 'bad-ext');
      fs.mkdirSync(badExtDir);
      const badConfigPath = path.join(badExtDir, EXTENSIONS_CONFIG_FILENAME);
      fs.writeFileSync(badConfigPath, '{ "name": "bad-ext"'); // Malformed

      const manager = createExtensionManager();
      await manager.refreshCache();
      const extensions = manager.getLoadedExtensions();

      expect(extensions).toHaveLength(1);
      expect(extensions[0].config.name).toBe('good-ext');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Warning: Skipping extension in ${badExtDir}`),
      );

      consoleSpy.mockRestore();
    });

    it('should skip extensions with missing name and log a warning', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      // Good extension
      createExtension({
        extensionsDir: userExtensionsDir,
        name: 'good-ext',
        version: '1.0.0',
      });

      // Bad extension
      const badExtDir = path.join(userExtensionsDir, 'bad-ext-no-name');
      fs.mkdirSync(badExtDir);
      const badConfigPath = path.join(badExtDir, EXTENSIONS_CONFIG_FILENAME);
      fs.writeFileSync(badConfigPath, JSON.stringify({ version: '1.0.0' }));

      const manager = createExtensionManager();
      await manager.refreshCache();
      const extensions = manager.getLoadedExtensions();

      expect(extensions).toHaveLength(1);
      expect(extensions[0].config.name).toBe('good-ext');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Warning: Skipping extension in ${badExtDir}`),
      );

      consoleSpy.mockRestore();
    });

    it('should filter trust out of mcp servers', async () => {
      createExtension({
        extensionsDir: userExtensionsDir,
        name: 'test-extension',
        version: '1.0.0',
        mcpServers: {
          'test-server': {
            command: 'node',
            args: ['server.js'],
            trust: true,
          } as MCPServerConfig,
        },
      });

      const manager = createExtensionManager();
      await manager.refreshCache();
      const extensions = manager.getLoadedExtensions();

      expect(extensions).toHaveLength(1);
      // trust should be filtered from extension.mcpServers (not config.mcpServers)
      expect(extensions[0].mcpServers?.['test-server']?.trust).toBeUndefined();
      // config.mcpServers should still have trust (original config)
      expect(extensions[0].config.mcpServers?.['test-server']?.trust).toBe(
        true,
      );
    });
  });

  describe('enableExtension / disableExtension', () => {
    it('should disable an extension at the user scope', async () => {
      createExtension({
        extensionsDir: userExtensionsDir,
        name: 'my-extension',
        version: '1.0.0',
      });

      const manager = createExtensionManager();
      await manager.refreshCache();

      manager.disableExtension('my-extension', SettingScope.User);
      expect(manager.isEnabled('my-extension', tempWorkspaceDir)).toBe(false);
    });

    it('should disable an extension at the workspace scope', async () => {
      createExtension({
        extensionsDir: userExtensionsDir,
        name: 'my-extension',
        version: '1.0.0',
      });

      const manager = createExtensionManager();
      await manager.refreshCache();

      manager.disableExtension(
        'my-extension',
        SettingScope.Workspace,
        tempWorkspaceDir,
      );

      expect(manager.isEnabled('my-extension', tempHomeDir)).toBe(true);
      expect(manager.isEnabled('my-extension', tempWorkspaceDir)).toBe(false);
    });

    it('should handle disabling the same extension twice', async () => {
      createExtension({
        extensionsDir: userExtensionsDir,
        name: 'my-extension',
        version: '1.0.0',
      });

      const manager = createExtensionManager();
      await manager.refreshCache();

      manager.disableExtension('my-extension', SettingScope.User);
      manager.disableExtension('my-extension', SettingScope.User);
      expect(manager.isEnabled('my-extension', tempWorkspaceDir)).toBe(false);
    });

    it('should throw an error if you request system scope', async () => {
      createExtension({
        extensionsDir: userExtensionsDir,
        name: 'my-extension',
        version: '1.0.0',
      });

      const manager = createExtensionManager();
      await manager.refreshCache();

      expect(() =>
        manager.disableExtension('my-extension', SettingScope.System),
      ).toThrow('System and SystemDefaults scopes are not supported.');
    });

    it('should enable an extension at the user scope', async () => {
      createExtension({
        extensionsDir: userExtensionsDir,
        name: 'ext1',
        version: '1.0.0',
      });

      const manager = createExtensionManager();
      await manager.refreshCache();

      manager.disableExtension('ext1', SettingScope.User);
      expect(manager.isEnabled('ext1')).toBe(false);

      manager.enableExtension('ext1', SettingScope.User);
      expect(manager.isEnabled('ext1')).toBe(true);
    });

    it('should enable an extension at the workspace scope', async () => {
      createExtension({
        extensionsDir: userExtensionsDir,
        name: 'ext1',
        version: '1.0.0',
      });

      const manager = createExtensionManager();
      await manager.refreshCache();

      manager.disableExtension('ext1', SettingScope.Workspace);
      expect(manager.isEnabled('ext1', tempWorkspaceDir)).toBe(false);

      manager.enableExtension('ext1', SettingScope.Workspace);
      expect(manager.isEnabled('ext1', tempWorkspaceDir)).toBe(true);
    });
  });

  describe('validateExtensionOverrides', () => {
    it('should mark all extensions as active if no enabled extensions are provided', async () => {
      createExtension({
        extensionsDir: userExtensionsDir,
        name: 'ext1',
        version: '1.0.0',
      });
      createExtension({
        extensionsDir: userExtensionsDir,
        name: 'ext2',
        version: '1.0.0',
      });

      const manager = createExtensionManager();
      await manager.refreshCache();
      const extensions = manager.getLoadedExtensions();

      expect(extensions).toHaveLength(2);
      expect(extensions.every((e) => e.isActive)).toBe(true);
    });

    it('should mark only the enabled extensions as active', async () => {
      createExtension({
        extensionsDir: userExtensionsDir,
        name: 'ext1',
        version: '1.0.0',
      });
      createExtension({
        extensionsDir: userExtensionsDir,
        name: 'ext2',
        version: '1.0.0',
      });
      createExtension({
        extensionsDir: userExtensionsDir,
        name: 'ext3',
        version: '1.0.0',
      });

      const manager = createExtensionManager({
        enabledExtensionOverrides: ['ext1', 'ext3'],
      });
      await manager.refreshCache();
      const extensions = manager.getLoadedExtensions();

      expect(extensions.find((e) => e.name === 'ext1')?.isActive).toBe(true);
      expect(extensions.find((e) => e.name === 'ext2')?.isActive).toBe(false);
      expect(extensions.find((e) => e.name === 'ext3')?.isActive).toBe(true);
    });

    it('should mark all extensions as inactive when "none" is provided', async () => {
      createExtension({
        extensionsDir: userExtensionsDir,
        name: 'ext1',
        version: '1.0.0',
      });
      createExtension({
        extensionsDir: userExtensionsDir,
        name: 'ext2',
        version: '1.0.0',
      });

      const manager = createExtensionManager({
        enabledExtensionOverrides: ['none'],
      });
      await manager.refreshCache();
      const extensions = manager.getLoadedExtensions();

      expect(extensions.every((e) => !e.isActive)).toBe(true);
    });

    it('should handle case-insensitivity', async () => {
      createExtension({
        extensionsDir: userExtensionsDir,
        name: 'ext1',
        version: '1.0.0',
      });

      const manager = createExtensionManager({
        enabledExtensionOverrides: ['EXT1'],
      });
      await manager.refreshCache();
      const extensions = manager.getLoadedExtensions();

      expect(extensions.find((e) => e.name === 'ext1')?.isActive).toBe(true);
    });

    it('should log an error for unknown extensions', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      createExtension({
        extensionsDir: userExtensionsDir,
        name: 'ext1',
        version: '1.0.0',
      });

      const manager = createExtensionManager({
        enabledExtensionOverrides: ['ext4'],
      });
      await manager.refreshCache();
      const extensions = manager.getLoadedExtensions();
      manager.validateExtensionOverrides(extensions);

      expect(consoleSpy).toHaveBeenCalledWith('Extension not found: ext4');
      consoleSpy.mockRestore();
    });
  });

  describe('loadExtensionConfig', () => {
    it('should resolve environment variables in extension configuration', async () => {
      process.env['TEST_API_KEY'] = 'test-api-key-123';
      process.env['TEST_DB_URL'] = 'postgresql://localhost:5432/testdb';

      try {
        const extDir = path.join(userExtensionsDir, 'test-extension');
        fs.mkdirSync(extDir);

        const extensionConfig = {
          name: 'test-extension',
          version: '1.0.0',
          mcpServers: {
            'test-server': {
              command: 'node',
              args: ['server.js'],
              env: {
                API_KEY: '$TEST_API_KEY',
                DATABASE_URL: '${TEST_DB_URL}',
                STATIC_VALUE: 'no-substitution',
              },
            },
          },
        };
        fs.writeFileSync(
          path.join(extDir, EXTENSIONS_CONFIG_FILENAME),
          JSON.stringify(extensionConfig),
        );

        const manager = createExtensionManager();
        await manager.refreshCache();
        const extensions = manager.getLoadedExtensions();

        expect(extensions).toHaveLength(1);
        const extension = extensions[0];
        expect(extension.config.name).toBe('test-extension');
        expect(extension.config.mcpServers).toBeDefined();

        const serverConfig = extension.config.mcpServers?.['test-server'];
        expect(serverConfig).toBeDefined();
        expect(serverConfig?.env).toBeDefined();
        expect(serverConfig?.env?.['API_KEY']).toBe('test-api-key-123');
        expect(serverConfig?.env?.['DATABASE_URL']).toBe(
          'postgresql://localhost:5432/testdb',
        );
        expect(serverConfig?.env?.['STATIC_VALUE']).toBe('no-substitution');
      } finally {
        delete process.env['TEST_API_KEY'];
        delete process.env['TEST_DB_URL'];
      }
    });

    it('should handle missing environment variables gracefully', async () => {
      const extDir = path.join(userExtensionsDir, 'test-extension');
      fs.mkdirSync(extDir);

      const extensionConfig = {
        name: 'test-extension',
        version: '1.0.0',
        mcpServers: {
          'test-server': {
            command: 'node',
            args: ['server.js'],
            env: {
              MISSING_VAR: '$UNDEFINED_ENV_VAR',
              MISSING_VAR_BRACES: '${ALSO_UNDEFINED}',
            },
          },
        },
      };

      fs.writeFileSync(
        path.join(extDir, EXTENSIONS_CONFIG_FILENAME),
        JSON.stringify(extensionConfig),
      );

      const manager = createExtensionManager();
      await manager.refreshCache();
      const extensions = manager.getLoadedExtensions();

      expect(extensions).toHaveLength(1);
      const extension = extensions[0];
      const serverConfig = extension.config.mcpServers!['test-server'];
      expect(serverConfig.env).toBeDefined();
      expect(serverConfig.env!['MISSING_VAR']).toBe('$UNDEFINED_ENV_VAR');
      expect(serverConfig.env!['MISSING_VAR_BRACES']).toBe('${ALSO_UNDEFINED}');
    });
  });
});
