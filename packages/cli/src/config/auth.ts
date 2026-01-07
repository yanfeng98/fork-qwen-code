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
import { t } from '../i18n/index.js';

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
 *
 * @returns hasKey - whether an API key is available
 * @returns checkedEnvKey - the environment variable name that was checked
 * @returns isExplicitEnvKey - true if model has explicit envKey configured (no apiKey fallback allowed)
 */
function hasApiKeyForAuth(
  authType: string,
  settings: Settings,
): {
  hasKey: boolean;
  checkedEnvKey: string | undefined;
  isExplicitEnvKey: boolean;
} {
  const modelProviders = settings.modelProviders as
    | ModelProvidersConfig
    | undefined;
  const modelId = settings.model?.name;

  // Try to find model-specific envKey from modelProviders
  const modelConfig = findModelConfig(modelProviders, authType, modelId);
  if (modelConfig?.envKey) {
    // Explicit envKey configured - only check this env var, no apiKey fallback
    const hasKey = !!process.env[modelConfig.envKey];
    return {
      hasKey,
      checkedEnvKey: modelConfig.envKey,
      isExplicitEnvKey: true,
    };
  }

  // Using default environment variable - apiKey fallback is allowed
  const defaultEnvKey = DEFAULT_ENV_KEYS[authType];
  if (defaultEnvKey) {
    const hasKey = !!process.env[defaultEnvKey];
    if (hasKey) {
      return { hasKey, checkedEnvKey: defaultEnvKey, isExplicitEnvKey: false };
    }
  }

  // Also check settings.security.auth.apiKey as fallback (only for default env key)
  if (settings.security?.auth?.apiKey) {
    return {
      hasKey: true,
      checkedEnvKey: defaultEnvKey || undefined,
      isExplicitEnvKey: false,
    };
  }

  return {
    hasKey: false,
    checkedEnvKey: defaultEnvKey,
    isExplicitEnvKey: false,
  };
}

/**
 * Generate API key error message based on auth check result.
 * Returns null if API key is present, otherwise returns the appropriate error message.
 */
function getApiKeyError(authMethod: string, settings: Settings): string | null {
  const { hasKey, checkedEnvKey, isExplicitEnvKey } = hasApiKeyForAuth(
    authMethod,
    settings,
  );
  if (hasKey) {
    return null;
  }

  const envKeyHint = checkedEnvKey || DEFAULT_ENV_KEYS[authMethod];
  if (isExplicitEnvKey) {
    return t(
      '{{envKeyHint}} environment variable not found. Please set it in your .env file or environment variables.',
      { envKeyHint },
    );
  }
  return t(
    '{{envKeyHint}} environment variable not found (or set settings.security.auth.apiKey). Please set it in your .env file or environment variables.',
    { envKeyHint },
  );
}

export function validateAuthMethod(authMethod: string): string | null {
  const settings = loadSettings();
  loadEnvironment(settings.merged);

  if (authMethod === AuthType.USE_OPENAI) {
    const { hasKey, checkedEnvKey, isExplicitEnvKey } = hasApiKeyForAuth(
      authMethod,
      settings.merged,
    );
    if (!hasKey) {
      const envKeyHint = checkedEnvKey
        ? `'${checkedEnvKey}'`
        : "'OPENAI_API_KEY'";
      if (isExplicitEnvKey) {
        // Explicit envKey configured - only suggest setting the env var
        return t(
          'Missing API key for OpenAI-compatible auth. Set the {{envKeyHint}} environment variable.',
          { envKeyHint },
        );
      }
      // Default env key - can use either apiKey or env var
      return t(
        'Missing API key for OpenAI-compatible auth. Set settings.security.auth.apiKey, or set the {{envKeyHint}} environment variable.',
        { envKeyHint },
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
    const apiKeyError = getApiKeyError(authMethod, settings.merged);
    if (apiKeyError) {
      return apiKeyError;
    }

    // Check baseUrl - can come from modelProviders or environment
    const modelProviders = settings.merged.modelProviders as
      | ModelProvidersConfig
      | undefined;
    const modelId = settings.merged.model?.name;
    const modelConfig = findModelConfig(modelProviders, authMethod, modelId);

    if (modelConfig && !modelConfig.baseUrl) {
      return t(
        'Anthropic provider missing required baseUrl in modelProviders[].baseUrl.',
      );
    }
    if (!modelConfig && !process.env['ANTHROPIC_BASE_URL']) {
      return t('ANTHROPIC_BASE_URL environment variable not found.');
    }

    return null;
  }

  if (authMethod === AuthType.USE_GEMINI) {
    const apiKeyError = getApiKeyError(authMethod, settings.merged);
    if (apiKeyError) {
      return apiKeyError;
    }
    return null;
  }

  if (authMethod === AuthType.USE_VERTEX_AI) {
    const apiKeyError = getApiKeyError(authMethod, settings.merged);
    if (apiKeyError) {
      return apiKeyError;
    }

    process.env['GOOGLE_GENAI_USE_VERTEXAI'] = 'true';
    return null;
  }

  return t('Invalid auth method selected.');
}
