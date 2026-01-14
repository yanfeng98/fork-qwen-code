/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { ExtensionManager } from '@qwen-code/qwen-code-core';
import { loadSettings } from '../../config/settings.js';
import { requestConsentNonInteractive } from './consent.js';
import { isWorkspaceTrusted } from '../../config/trustedFolders.js';

export async function getExtensionManager(): Promise<ExtensionManager> {
  const workspaceDir = process.cwd();
  const extensionManager = new ExtensionManager({
    workspaceDir,
    requestConsent: requestConsentNonInteractive,
    isWorkspaceTrusted: !!isWorkspaceTrusted(loadSettings(workspaceDir).merged),
  });
  await extensionManager.refreshCache();
  return extensionManager;
}
