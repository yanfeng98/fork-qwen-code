/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { FileCommandLoader } from './FileCommandLoader.js';
import type { Config } from '@qwen-code/qwen-code-core';
import { Storage } from '@qwen-code/qwen-code-core';

describe('FileCommandLoader - Extension Commands Support', () => {
  let tempDir: string;
  let mockConfig: Partial<Config>;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'file-command-loader-ext-test-'),
    );

    mockConfig = {
      getFolderTrustFeature: () => false,
      getFolderTrust: () => true,
      getProjectRoot: () => tempDir,
      storage: new Storage(tempDir),
      getExtensions: () => [],
    };
  });

  afterEach(async () => {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  it('should load commands from extension with config.commands path', async () => {
    // Setup extension structure
    const extensionDir = path.join(tempDir, '.qwen', 'extensions', 'test-ext');
    const customCommandsDir = path.join(extensionDir, 'custom-cmds');
    await fs.promises.mkdir(customCommandsDir, { recursive: true });

    // Create extension config with custom commands path
    const extensionConfig = {
      name: 'test-ext',
      version: '1.0.0',
      commands: 'custom-cmds',
    };
    await fs.promises.writeFile(
      path.join(extensionDir, 'qwen-extension.json'),
      JSON.stringify(extensionConfig),
    );

    // Create a test command in custom directory
    const commandContent =
      '---\ndescription: Test command from extension\n---\nDo something';
    await fs.promises.writeFile(
      path.join(customCommandsDir, 'test.md'),
      commandContent,
    );

    // Mock config to return the extension
    mockConfig.getExtensions = () => [
      {
        name: 'test-ext',
        version: '1.0.0',
        isActive: true,
        path: extensionDir,
      },
    ];

    const loader = new FileCommandLoader(mockConfig as Config);
    const commands = await loader.loadCommands(new AbortController().signal);

    expect(commands).toHaveLength(1);
    expect(commands[0].name).toBe('test-ext:test');
    expect(commands[0].description).toBe(
      '[test-ext] Test command from extension',
    );
  });

  it('should load commands from extension with multiple commands paths', async () => {
    // Setup extension structure
    const extensionDir = path.join(tempDir, '.qwen', 'extensions', 'multi-ext');
    const cmdsDir1 = path.join(extensionDir, 'commands1');
    const cmdsDir2 = path.join(extensionDir, 'commands2');
    await fs.promises.mkdir(cmdsDir1, { recursive: true });
    await fs.promises.mkdir(cmdsDir2, { recursive: true });

    // Create extension config with multiple commands paths
    const extensionConfig = {
      name: 'multi-ext',
      version: '1.0.0',
      commands: ['commands1', 'commands2'],
    };
    await fs.promises.writeFile(
      path.join(extensionDir, 'qwen-extension.json'),
      JSON.stringify(extensionConfig),
    );

    // Create test commands in both directories
    await fs.promises.writeFile(
      path.join(cmdsDir1, 'cmd1.md'),
      '---\n---\nCommand 1',
    );
    await fs.promises.writeFile(
      path.join(cmdsDir2, 'cmd2.md'),
      '---\n---\nCommand 2',
    );

    // Mock config to return the extension
    mockConfig.getExtensions = () => [
      {
        name: 'multi-ext',
        version: '1.0.0',
        isActive: true,
        path: extensionDir,
      },
    ];

    const loader = new FileCommandLoader(mockConfig as Config);
    const commands = await loader.loadCommands(new AbortController().signal);

    expect(commands).toHaveLength(2);
    const commandNames = commands.map((c) => c.name).sort();
    expect(commandNames).toEqual(['multi-ext:cmd1', 'multi-ext:cmd2']);
  });

  it('should fallback to default "commands" directory when config.commands not specified', async () => {
    // Setup extension structure with default commands directory
    const extensionDir = path.join(
      tempDir,
      '.qwen',
      'extensions',
      'default-ext',
    );
    const defaultCommandsDir = path.join(extensionDir, 'commands');
    await fs.promises.mkdir(defaultCommandsDir, { recursive: true });

    // Create extension config without commands field
    const extensionConfig = {
      name: 'default-ext',
      version: '1.0.0',
    };
    await fs.promises.writeFile(
      path.join(extensionDir, 'qwen-extension.json'),
      JSON.stringify(extensionConfig),
    );

    // Create a test command in default directory
    await fs.promises.writeFile(
      path.join(defaultCommandsDir, 'default.md'),
      '---\n---\nDefault command',
    );

    // Mock config to return the extension
    mockConfig.getExtensions = () => [
      {
        name: 'default-ext',
        version: '1.0.0',
        isActive: true,
        path: extensionDir,
      },
    ];

    const loader = new FileCommandLoader(mockConfig as Config);
    const commands = await loader.loadCommands(new AbortController().signal);

    expect(commands).toHaveLength(1);
    expect(commands[0].name).toBe('default-ext:default');
  });

  it('should handle extension without commands directory gracefully', async () => {
    // Setup extension structure without commands directory
    const extensionDir = path.join(
      tempDir,
      '.qwen',
      'extensions',
      'no-cmds-ext',
    );
    await fs.promises.mkdir(extensionDir, { recursive: true });

    // Create extension config
    const extensionConfig = {
      name: 'no-cmds-ext',
      version: '1.0.0',
    };
    await fs.promises.writeFile(
      path.join(extensionDir, 'qwen-extension.json'),
      JSON.stringify(extensionConfig),
    );

    // Mock config to return the extension
    mockConfig.getExtensions = () => [
      {
        name: 'no-cmds-ext',
        version: '1.0.0',
        isActive: true,
        path: extensionDir,
      },
    ];

    const loader = new FileCommandLoader(mockConfig as Config);
    const commands = await loader.loadCommands(new AbortController().signal);

    // Should not throw and return empty array
    expect(commands).toHaveLength(0);
  });

  it('should prefix extension commands with extension name', async () => {
    // Setup extension
    const extensionDir = path.join(
      tempDir,
      '.qwen',
      'extensions',
      'prefix-ext',
    );
    const commandsDir = path.join(extensionDir, 'commands');
    await fs.promises.mkdir(commandsDir, { recursive: true });

    const extensionConfig = {
      name: 'prefix-ext',
      version: '1.0.0',
    };
    await fs.promises.writeFile(
      path.join(extensionDir, 'qwen-extension.json'),
      JSON.stringify(extensionConfig),
    );

    await fs.promises.writeFile(
      path.join(commandsDir, 'mycommand.md'),
      '---\n---\nMy command',
    );

    mockConfig.getExtensions = () => [
      {
        name: 'prefix-ext',
        version: '1.0.0',
        isActive: true,
        path: extensionDir,
      },
    ];

    const loader = new FileCommandLoader(mockConfig as Config);
    const commands = await loader.loadCommands(new AbortController().signal);

    expect(commands).toHaveLength(1);
    expect(commands[0].name).toBe('prefix-ext:mycommand');
  });

  it('should load commands from multiple extensions in alphabetical order', async () => {
    // Setup two extensions
    const ext1Dir = path.join(tempDir, '.qwen', 'extensions', 'ext-b');
    const ext2Dir = path.join(tempDir, '.qwen', 'extensions', 'ext-a');

    await fs.promises.mkdir(path.join(ext1Dir, 'commands'), {
      recursive: true,
    });
    await fs.promises.mkdir(path.join(ext2Dir, 'commands'), {
      recursive: true,
    });

    // Extension B
    await fs.promises.writeFile(
      path.join(ext1Dir, 'qwen-extension.json'),
      JSON.stringify({ name: 'ext-b', version: '1.0.0' }),
    );
    await fs.promises.writeFile(
      path.join(ext1Dir, 'commands', 'cmd.md'),
      '---\n---\nCommand B',
    );

    // Extension A
    await fs.promises.writeFile(
      path.join(ext2Dir, 'qwen-extension.json'),
      JSON.stringify({ name: 'ext-a', version: '1.0.0' }),
    );
    await fs.promises.writeFile(
      path.join(ext2Dir, 'commands', 'cmd.md'),
      '---\n---\nCommand A',
    );

    mockConfig.getExtensions = () => [
      { name: 'ext-b', version: '1.0.0', isActive: true, path: ext1Dir },
      { name: 'ext-a', version: '1.0.0', isActive: true, path: ext2Dir },
    ];

    const loader = new FileCommandLoader(mockConfig as Config);
    const commands = await loader.loadCommands(new AbortController().signal);

    expect(commands).toHaveLength(2);
    // Extensions are sorted alphabetically, so ext-a comes before ext-b
    expect(commands[0].name).toBe('ext-a:cmd');
    expect(commands[1].name).toBe('ext-b:cmd');
  });
});
