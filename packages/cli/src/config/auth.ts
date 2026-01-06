/**
 * @license
 * Copyright 2025 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { AuthType } from '@qwen-code/qwen-code-core';
import type {
  ModelProvidersConfig,
  ProviderModelConfig,
} from '@qwen-code/qwen-code-core';
import { loadEnvironment, loadSettings, type Settings } from './settings.js';

/**
 * Default environment variable names for each auth type
 */
const DEFAULT_ENV_KEYS: Record<string, string> = {
  [AuthType.USE_OPENAI]: 'OPENAI_API_KEY',
  [AuthType.USE_ANTHROPIC]: 'ANTHROPIC_API_KEY',
  [AuthType.USE_GEMINI]: 'GEMINI_API_KEY',
  [AuthType.USE_VERTEX_AI]: 'GOOGLE_API_KEY',
};

/**
 * Find model configuration from modelProviders by authType and modelId
 */
function findModelConfig(
  modelProviders: ModelProvidersConfig | undefined,
  authType: string,
  modelId: string | undefined,
): ProviderModelConfig | undefined {
  if (!modelProviders || !modelId) {
    return undefined;
  }

  const models = modelProviders[authType];
  if (!Array.isArray(models)) {
    return undefined;
  }

  return models.find((m) => m.id === modelId);
}

/**
 * Check if API key is available for the given auth type and model configuration.
 * Prioritizes custom envKey from modelProviders over default environment variables.
 */
function hasApiKeyForAuth(
  authType: string,
  settings: Settings,
): { hasKey: boolean; checkedEnvKey: string | undefined } {
  const modelProviders = settings.modelProviders as
    | ModelProvidersConfig
    | undefined;
  const modelId = settings.model?.name;

  // Try to find model-specific envKey from modelProviders
  const modelConfig = findModelConfig(modelProviders, authType, modelId);
  if (modelConfig?.envKey) {
    const hasKey = !!process.env[modelConfig.envKey];
    return { hasKey, checkedEnvKey: modelConfig.envKey };
  }

  // Fallback to default environment variable
  const defaultEnvKey = DEFAULT_ENV_KEYS[authType];
  if (defaultEnvKey) {
    const hasKey = !!process.env[defaultEnvKey];
    return { hasKey, checkedEnvKey: defaultEnvKey };
  }

  // Also check settings.security.auth.apiKey as fallback
  if (settings.security?.auth?.apiKey) {
    return { hasKey: true, checkedEnvKey: undefined };
  }

  return { hasKey: false, checkedEnvKey: undefined };
}

export function validateAuthMethod(authMethod: string): string | null {
  const settings = loadSettings();
  loadEnvironment(settings.merged);

  if (authMethod === AuthType.USE_OPENAI) {
    const { hasKey, checkedEnvKey } = hasApiKeyForAuth(
      authMethod,
      settings.merged,
    );
    if (!hasKey) {
      const envKeyHint = checkedEnvKey
        ? `'${checkedEnvKey}'`
        : "'OPENAI_API_KEY' (or configure modelProviders[].envKey)";
      return (
        'Missing API key for OpenAI-compatible auth. ' +
        `Set settings.security.auth.apiKey, or set the ${envKeyHint} environment variable.`
      );
    }
    return null;
  }

  if (authMethod === AuthType.QWEN_OAUTH) {
    // Qwen OAuth doesn't require any environment variables for basic setup
    // The OAuth flow will handle authentication
    return null;
  }

  if (authMethod === AuthType.USE_ANTHROPIC) {
    const { hasKey, checkedEnvKey } = hasApiKeyForAuth(
      authMethod,
      settings.merged,
    );
    if (!hasKey) {
      const envKeyHint = checkedEnvKey || 'ANTHROPIC_API_KEY';
      return `${envKeyHint} environment variable not found.`;
    }

    // Check baseUrl - can come from modelProviders or environment
    const modelProviders = settings.merged.modelProviders as
      | ModelProvidersConfig
      | undefined;
    const modelId = settings.merged.model?.name;
    const modelConfig = findModelConfig(modelProviders, authMethod, modelId);
    const hasBaseUrl =
      modelConfig?.baseUrl || process.env['ANTHROPIC_BASE_URL'];
    if (!hasBaseUrl) {
      return 'ANTHROPIC_BASE_URL environment variable not found (or configure modelProviders[].baseUrl).';
    }

    return null;
  }

  if (authMethod === AuthType.USE_GEMINI) {
    const { hasKey, checkedEnvKey } = hasApiKeyForAuth(
      authMethod,
      settings.merged,
    );
    if (!hasKey) {
      const envKeyHint = checkedEnvKey || 'GEMINI_API_KEY';
      return `${envKeyHint} environment variable not found. Please set it in your .env file or environment variables.`;
    }
    return null;
  }

  if (authMethod === AuthType.USE_VERTEX_AI) {
    const { hasKey, checkedEnvKey } = hasApiKeyForAuth(
      authMethod,
      settings.merged,
    );
    if (!hasKey) {
      const envKeyHint = checkedEnvKey || 'GOOGLE_API_KEY';
      return `${envKeyHint} environment variable not found. Please set it in your .env file or environment variables.`;
    }

    process.env['GOOGLE_GENAI_USE_VERTEXAI'] = 'true';
    return null;
  }

  return 'Invalid auth method selected.';
}
