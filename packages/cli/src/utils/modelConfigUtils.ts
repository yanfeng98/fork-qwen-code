/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AuthType,
  type ContentGeneratorConfig,
  type ContentGeneratorConfigSources,
  resolveModelConfig,
  type ModelConfigSourcesInput,
} from '@qwen-code/qwen-code-core';
import type { Settings } from '../config/settings.js';

export interface CliGenerationConfigInputs {
  argv: {
    model?: string | undefined;
    openaiApiKey?: string | undefined;
    openaiBaseUrl?: string | undefined;
    openaiLogging?: boolean | undefined;
    openaiLoggingDir?: string | undefined;
  };
  settings: Settings;
  selectedAuthType: AuthType | undefined;
  /**
   * Injectable env for testability. Defaults to process.env at callsites.
   */
  env?: Record<string, string | undefined>;
}

export interface ResolvedCliGenerationConfig {
  /** The resolved model id (may be empty string if not resolvable at CLI layer) */
  model: string;
  /** API key for OpenAI-compatible auth */
  apiKey: string;
  /** Base URL for OpenAI-compatible auth */
  baseUrl: string;
  /** The full generation config to pass to core Config */
  generationConfig: Partial<ContentGeneratorConfig>;
  /** Source attribution for each resolved field */
  sources: ContentGeneratorConfigSources;
}

/**
 * Unified resolver for CLI generation config.
 *
 * Precedence (for OpenAI auth):
 * - model: argv.model > OPENAI_MODEL > QWEN_MODEL > settings.model.name
 * - apiKey: argv.openaiApiKey > OPENAI_API_KEY > settings.security.auth.apiKey
 * - baseUrl: argv.openaiBaseUrl > OPENAI_BASE_URL > settings.security.auth.baseUrl
 *
 * For non-OpenAI auth, only argv.model override is respected at CLI layer.
 */
export function resolveCliGenerationConfig(
  inputs: CliGenerationConfigInputs,
): ResolvedCliGenerationConfig {
  const { argv, settings, selectedAuthType } = inputs;
  const env = inputs.env ?? (process.env as Record<string, string | undefined>);

  const authType = selectedAuthType ?? AuthType.QWEN_OAUTH;

  const configSources: ModelConfigSourcesInput = {
    authType,
    cli: {
      model: argv.model,
      apiKey: argv.openaiApiKey,
      baseUrl: argv.openaiBaseUrl,
    },
    settings: {
      model: settings.model?.name,
      apiKey: settings.security?.auth?.apiKey,
      baseUrl: settings.security?.auth?.baseUrl,
      generationConfig: settings.model?.generationConfig as
        | Partial<ContentGeneratorConfig>
        | undefined,
    },
    env,
  };

  const resolved = resolveModelConfig(configSources);

  // Log warnings if any
  for (const warning of resolved.warnings) {
    console.warn(`[modelProviderUtils] ${warning}`);
  }

  // Resolve OpenAI logging config (CLI-specific, not part of core resolver)
  const enableOpenAILogging =
    (typeof argv.openaiLogging === 'undefined'
      ? settings.model?.enableOpenAILogging
      : argv.openaiLogging) ?? false;

  const openAILoggingDir =
    argv.openaiLoggingDir || settings.model?.openAILoggingDir;

  // Build the full generation config
  // Note: we merge the resolved config with logging settings
  const generationConfig: Partial<ContentGeneratorConfig> = {
    ...resolved.config,
    enableOpenAILogging,
    openAILoggingDir,
  };

  return {
    model: resolved.config.model || '',
    apiKey: resolved.config.apiKey || '',
    baseUrl: resolved.config.baseUrl || '',
    generationConfig,
    sources: resolved.sources,
  };
}
