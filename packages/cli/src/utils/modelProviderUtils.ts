/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AuthType,
  type ContentGeneratorConfig,
  type ContentGeneratorConfigSource,
  type ContentGeneratorConfigSources,
  type ModelProvidersConfig,
  type ProviderModelConfig as ModelConfig,
} from '@qwen-code/qwen-code-core';
import type { Settings } from '../config/settings.js';

export interface GenerationConfigSourceInputs {
  argv: {
    model?: string | undefined;
    openaiApiKey?: string | undefined;
    openaiBaseUrl?: string | undefined;
  };
  settings: Settings;
  selectedAuthType: AuthType | undefined;
  /**
   * Injectable env for testability. Defaults to process.env at callsites.
   */
  env?: Record<string, string | undefined>;
}

/**
 * Get models configuration from settings, grouped by authType.
 * Returns the models config from the merged settings without mutating files.
 */
export function getModelProvidersConfigFromSettings(
  settings: Settings,
): ModelProvidersConfig {
  return (settings.modelProviders as ModelProvidersConfig) || {};
}

/**
 * Get models for a specific authType from settings.
 */
export function getModelsForAuthType(
  settings: Settings,
  authType: AuthType,
): ModelConfig[] {
  const modelProvidersConfig = getModelProvidersConfigFromSettings(settings);
  return modelProvidersConfig[authType] || [];
}

/**
 * Best-effort attribution for the seed generationConfig fields.
 *
 * NOTE:
 * - This does not attempt to distinguish user vs workspace settings; it reflects merged settings.
 * - This should stay consistent with the actual precedence used to compute the corresponding values.
 */
export function buildGenerationConfigSources(
  inputs: GenerationConfigSourceInputs,
): ContentGeneratorConfigSources {
  const { argv, settings, selectedAuthType } = inputs;
  const env = inputs.env ?? (process.env as Record<string, string | undefined>);

  const sources: ContentGeneratorConfigSources = {};

  const setSource = (path: string, source: ContentGeneratorConfigSource) => {
    sources[path] = source;
  };

  // Model/apiKey/baseUrl attribution mirrors current CLI precedence:
  // - model: argv.model > (OPENAI_MODEL|QWEN_MODEL|settings.model.name) only for OpenAI auth
  // - apiKey/baseUrl: only meaningful for OpenAI auth in current CLI wiring
  if (selectedAuthType === AuthType.USE_OPENAI) {
    if (argv.model) {
      setSource('model', { kind: 'cli', detail: '--model' });
    } else if (env['OPENAI_MODEL']) {
      setSource('model', { kind: 'env', envKey: 'OPENAI_MODEL' });
    } else if (env['QWEN_MODEL']) {
      setSource('model', { kind: 'env', envKey: 'QWEN_MODEL' });
    } else if (settings.model?.name) {
      setSource('model', { kind: 'settings', settingsPath: 'model.name' });
    }

    if (argv.openaiApiKey) {
      setSource('apiKey', { kind: 'cli', detail: '--openaiApiKey' });
    } else if (env['OPENAI_API_KEY']) {
      setSource('apiKey', { kind: 'env', envKey: 'OPENAI_API_KEY' });
    } else if (settings.security?.auth?.apiKey) {
      setSource('apiKey', {
        kind: 'settings',
        settingsPath: 'security.auth.apiKey',
      });
    }

    if (argv.openaiBaseUrl) {
      setSource('baseUrl', { kind: 'cli', detail: '--openaiBaseUrl' });
    } else if (env['OPENAI_BASE_URL']) {
      setSource('baseUrl', { kind: 'env', envKey: 'OPENAI_BASE_URL' });
    } else if (settings.security?.auth?.baseUrl) {
      setSource('baseUrl', {
        kind: 'settings',
        settingsPath: 'security.auth.baseUrl',
      });
    }
  } else if (argv.model) {
    // For non-openai auth types, the CLI only wires through an explicit raw model override.
    setSource('model', { kind: 'cli', detail: '--model' });
  }

  const mergedGenerationConfig = settings.model?.generationConfig as
    | Partial<ContentGeneratorConfig>
    | undefined;
  if (mergedGenerationConfig) {
    setSource('generationConfig', {
      kind: 'settings',
      settingsPath: 'model.generationConfig',
    });
    // We also map the known top-level fields used by core.
    if (mergedGenerationConfig.samplingParams) {
      setSource('samplingParams', {
        kind: 'settings',
        settingsPath: 'model.generationConfig.samplingParams',
      });
    }
    for (const k of [
      'timeout',
      'maxRetries',
      'disableCacheControl',
      'schemaCompliance',
    ] as const) {
      if (mergedGenerationConfig[k] !== undefined) {
        setSource(k, {
          kind: 'settings',
          settingsPath: `model.generationConfig.${k}`,
        });
      }
    }
  }

  return sources;
}
