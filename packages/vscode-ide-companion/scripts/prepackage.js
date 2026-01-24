/**
 * @license
 * Copyright 2025 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * VS Code extension packaging orchestration.
 *
 * We bundle the CLI into the extension so users don't need a global install.
 * To match the published CLI layout, we need to:
 * - build root bundle (dist/cli.js + vendor/ + sandbox profiles)
 * - run root prepare:package (dist/package.json + locales + README/LICENSE)
 * - install production deps into root dist/ (dist/node_modules) so runtime deps
 *   like optional node-pty are present inside the VSIX payload.
 *
 * Then we generate notices and build the extension.
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import os from 'node:os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const extensionRoot = path.resolve(__dirname, '..');
const repoRoot = path.resolve(extensionRoot, '..', '..');
const bundledCliDir = path.join(extensionRoot, 'dist', 'qwen-cli');

function npmBin() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...opts,
  });
  if (res.error) {
    throw res.error;
  }
  if (typeof res.status === 'number' && res.status !== 0) {
    throw new Error(
      `Command failed (${res.status}): ${cmd} ${args.map((a) => JSON.stringify(a)).join(' ')}`,
    );
  }
}

function main() {
  const npm = npmBin();

  // Root bundling depends on built workspace outputs. Use the root build to
  // ensure all required workspace dist/ artifacts exist.
  console.log('[prepackage] Building repo...');
  run(npm, ['--prefix', repoRoot, 'run', 'build'], { cwd: repoRoot });

  console.log('[prepackage] Bundling root CLI...');
  run(npm, ['--prefix', repoRoot, 'run', 'bundle'], { cwd: repoRoot });

  console.log('[prepackage] Preparing root dist/ package metadata...');
  run(npm, ['--prefix', repoRoot, 'run', 'prepare:package'], { cwd: repoRoot });

  console.log('[prepackage] Generating notices...');
  run(npm, ['run', 'generate:notices'], { cwd: extensionRoot });

  console.log('[prepackage] Building extension (production)...');
  run(npm, ['run', 'build:prod'], { cwd: extensionRoot });

  console.log('[prepackage] Copying bundled CLI dist/ into extension...');
  run(
    'node',
    [`${path.join(extensionRoot, 'scripts', 'copy-bundled-cli.js')}`],
    {
      cwd: extensionRoot,
    },
  );

  const isUniversalBuild = process.env.UNIVERSAL_BUILD === 'true';

  console.log(
    '[prepackage] Installing production deps into extension dist/qwen-cli...',
  );

  const installArgs = [
    '--prefix',
    bundledCliDir,
    'install',
    '--omit=dev',
    '--no-audit',
    '--no-fund',
  ];

  // For universal build, exclude optional dependencies (node-pty native binaries)
  // This ensures the universal VSIX works on all platforms using child_process fallback
  if (isUniversalBuild) {
    installArgs.push('--omit=optional');
    console.log(
      '[prepackage] Universal build: excluding optional dependencies (node-pty)',
    );
  }

  run(npm, installArgs, {
    // Run outside the repo so npm doesn't treat this as a workspace install.
    // This avoids Windows junctions/symlinks in the staged node_modules.
    cwd: os.tmpdir(),
    env: {
      ...process.env,
      npm_config_workspaces: 'false',
      npm_config_include_workspace_root: 'false',
      npm_config_link_workspace_packages: 'false',
    },
  });
}

main();
