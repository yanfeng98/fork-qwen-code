import type {
  ContentGenerator,
  ContentGeneratorConfig,
} from '../contentGenerator.js';
import type { Config } from '../../config/config.js';
import { OpenAIContentGenerator } from './openaiContentGenerator.js';
import {
  DashScopeOpenAICompatibleProvider,
  DeepSeekOpenAICompatibleProvider,
  OpenRouterOpenAICompatibleProvider,
  type OpenAICompatibleProvider,
  DefaultOpenAICompatibleProvider,
} from './provider/index.js';

export { OpenAIContentGenerator } from './openaiContentGenerator.js';
export { ContentGenerationPipeline, type PipelineConfig } from './pipeline.js';

export {
  type OpenAICompatibleProvider,
  DashScopeOpenAICompatibleProvider,
  DeepSeekOpenAICompatibleProvider,
  OpenRouterOpenAICompatibleProvider,
} from './provider/index.js';

export { OpenAIContentConverter } from './converter.js';

export function createOpenAIContentGenerator(
  contentGeneratorConfig: ContentGeneratorConfig,
  cliConfig: Config,
): ContentGenerator {
  const provider = determineProvider(contentGeneratorConfig, cliConfig);
  return new OpenAIContentGenerator(
    contentGeneratorConfig,
    cliConfig,
    provider,
  );
}

export function determineProvider(
  contentGeneratorConfig: ContentGeneratorConfig,
  cliConfig: Config,
): OpenAICompatibleProvider {
  const config =
    contentGeneratorConfig || cliConfig.getContentGeneratorConfig();

  if (DashScopeOpenAICompatibleProvider.isDashScopeProvider(config)) {
    return new DashScopeOpenAICompatibleProvider(
      contentGeneratorConfig,
      cliConfig,
    );
  }

  if (DeepSeekOpenAICompatibleProvider.isDeepSeekProvider(config)) {
    return new DeepSeekOpenAICompatibleProvider(
      contentGeneratorConfig,
      cliConfig,
    );
  }

  if (OpenRouterOpenAICompatibleProvider.isOpenRouterProvider(config)) {
    return new OpenRouterOpenAICompatibleProvider(
      contentGeneratorConfig,
      cliConfig,
    );
  }

  return new DefaultOpenAICompatibleProvider(contentGeneratorConfig, cliConfig);
}

// Services
export {
  type TelemetryService,
  type RequestContext,
  DefaultTelemetryService,
} from './telemetryService.js';

export { type ErrorHandler, EnhancedErrorHandler } from './errorHandler.js';
