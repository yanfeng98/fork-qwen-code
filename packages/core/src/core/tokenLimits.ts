type Model = string;
type TokenCount = number;

/**
 * Token limit types for different use cases.
 * - 'input': Maximum input context window size
 * - 'output': Maximum output tokens that can be generated in a single response
 */
export type TokenLimitType = 'input' | 'output';

export const DEFAULT_TOKEN_LIMIT: TokenCount = 131_072;
export const DEFAULT_OUTPUT_TOKEN_LIMIT: TokenCount = 4_096;

const LIMITS = {
  '32k': 32_768,
  '64k': 65_536,
  '128k': 131_072,
  '200k': 200_000,
  '256k': 262_144,
  '512k': 524_288,
  '1m': 1_048_576,
  '2m': 2_097_152,
  '10m': 10_485_760,
  '4k': 4_096,
  '8k': 8_192,
  '16k': 16_384,
} as const;

export function normalize(model: string): string {
  let s = (model ?? '').toLowerCase().trim();

  s = s.replace(/^.*\//, '');
  s = s.split('|').pop() ?? s;
  s = s.split(':').pop() ?? s;

  s = s.replace(/\s+/g, '-');

  s = s.replace(/-preview/g, '');
  if (
    !s.match(/^qwen-(?:plus|flash|vl-max)-latest$/) &&
    !s.match(/^kimi-k2-\d{4}$/)
  ) {
    s = s.replace(
      /-(?:\d{4,}|\d+x\d+b|v\d+(?:\.\d+)*|(?<=-[^-]+-)\d+(?:\.\d+)+|latest|exp)$/g,
      '',
    );
  }

  s = s.replace(/-(?:\d?bit|int[48]|bf16|fp16|q[45]|quantized)$/g, '');

  return s;
}

const PATTERNS: Array<[RegExp, TokenCount]> = [
  [/^gemini-1\.5-pro$/, LIMITS['2m']],
  [/^gemini-1\.5-flash$/, LIMITS['1m']],
  [/^gemini-2\.5-pro.*$/, LIMITS['1m']],
  [/^gemini-2\.5-flash.*$/, LIMITS['1m']],
  [/^gemini-2\.0-flash-image-generation$/, LIMITS['32k']],
  [/^gemini-2\.0-flash.*$/, LIMITS['1m']],

  // -------------------
  // OpenAI (o3 / o4-mini / gpt-4.1 / gpt-4o family)
  // o3 and o4-mini document a 200,000-token context window (decimal).
  // Note: GPT-4.1 models typically report 1_048_576 (1M) context in OpenAI announcements.
  [/^o3(?:-mini|$).*$/, LIMITS['200k']],
  [/^o3.*$/, LIMITS['200k']],
  [/^o4-mini.*$/, LIMITS['200k']],
  [/^gpt-4\.1-mini.*$/, LIMITS['1m']],
  [/^gpt-4\.1.*$/, LIMITS['1m']],
  [/^gpt-4o-mini.*$/, LIMITS['128k']],
  [/^gpt-4o.*$/, LIMITS['128k']],
  [/^gpt-4.*$/, LIMITS['128k']],

  // -------------------
  // Anthropic Claude
  // - Claude Sonnet / Sonnet 3.5 and related Sonnet variants: 200,000 tokens documented.
  // - Some Sonnet/Opus models offer 1M in beta/enterprise tiers (handled separately if needed).
  [/^claude-3\.5-sonnet.*$/, LIMITS['200k']],
  [/^claude-3\.7-sonnet.*$/, LIMITS['1m']], // some Sonnet 3.7/Opus variants advertise 1M beta in docs
  [/^claude-sonnet-4.*$/, LIMITS['1m']],
  [/^claude-opus-4.*$/, LIMITS['1m']],

  // -------------------
  // Alibaba / Qwen
  // -------------------
  // Commercial Qwen3-Coder-Plus: 1M token context
  [/^qwen3-coder-plus(-.*)?$/, LIMITS['1m']], // catches "qwen3-coder-plus" and date variants

  // Commercial Qwen3-Coder-Flash: 1M token context
  [/^qwen3-coder-flash(-.*)?$/, LIMITS['1m']], // catches "qwen3-coder-flash" and date variants

  // Generic coder-model: same as qwen3-coder-plus (1M token context)
  [/^coder-model$/, LIMITS['1m']],

  // Commercial Qwen3-Max-Preview: 256K token context
  [/^qwen3-max(-preview)?(-.*)?$/, LIMITS['256k']], // catches "qwen3-max" or "qwen3-max-preview" and date variants

  // Open-source Qwen3-Coder variants: 256K native
  [/^qwen3-coder-.*$/, LIMITS['256k']],
  // Open-source Qwen3 2507 variants: 256K native
  [/^qwen3-.*-2507-.*$/, LIMITS['256k']],

  // Open-source long-context Qwen2.5-1M
  [/^qwen2\.5-1m.*$/, LIMITS['1m']],

  [/^qwen2\.5.*$/, LIMITS['128k']],

  // Studio commercial Qwen-Plus / Qwen-Flash / Qwen-Turbo
  [/^qwen-plus-latest$/, LIMITS['1m']], // Commercial latest: 1M
  [/^qwen-plus.*$/, LIMITS['128k']], // Standard: 128K
  [/^qwen-flash-latest$/, LIMITS['1m']],
  [/^qwen-turbo.*$/, LIMITS['128k']],

  // Qwen Vision Models
  [/^qwen3-vl-plus$/, LIMITS['256k']], // Qwen3-VL-Plus: 256K input
  [/^qwen-vl-max.*$/, LIMITS['128k']],

  // Generic vision-model: same as qwen-vl-max (128K token context)
  [/^vision-model$/, LIMITS['128k']],

  // -------------------
  // ByteDance Seed-OSS (512K)
  // -------------------
  [/^seed-oss.*$/, LIMITS['512k']],

  // -------------------
  // Zhipu GLM
  // -------------------
  [/^glm-4\.5v(?:-.*)?$/, LIMITS['64k']],
  [/^glm-4\.5-air(?:-.*)?$/, LIMITS['128k']],
  [/^glm-4\.5(?:-.*)?$/, LIMITS['128k']],
  [/^glm-4\.6(?:-.*)?$/, 202_752 as unknown as TokenCount], // exact limit from the model config file

  [/^deepseek(?:-.*)?$/, LIMITS['128k']],

  // -------------------
  // Moonshot / Kimi
  // -------------------
  [/^kimi-k2-0905$/, LIMITS['256k']], // Kimi-k2-0905-preview: 256K context
  [/^kimi-k2-turbo.*$/, LIMITS['256k']], // Kimi-k2-turbo-preview: 256K context
  [/^kimi-k2-0711$/, LIMITS['128k']], // Kimi-k2-0711-preview: 128K context
  [/^kimi-k2-instruct.*$/, LIMITS['128k']], // Kimi-k2-instruct: 128K context

  // -------------------
  // GPT-OSS / Llama & Mistral examples
  // -------------------
  [/^gpt-oss.*$/, LIMITS['128k']],
  [/^llama-4-scout.*$/, LIMITS['10m']],
  [/^mistral-large-2.*$/, LIMITS['128k']],
];

const OUTPUT_PATTERNS: Array<[RegExp, TokenCount]> = [
  // -------------------
  // Alibaba / Qwen - DashScope Models
  // -------------------
  // Qwen3-Coder-Plus: 65,536 max output tokens
  [/^qwen3-coder-plus(-.*)?$/, LIMITS['64k']],

  // Generic coder-model: same as qwen3-coder-plus (64K max output tokens)
  [/^coder-model$/, LIMITS['64k']],

  // Qwen3-Max: 65,536 max output tokens
  [/^qwen3-max(-preview)?(-.*)?$/, LIMITS['64k']],

  // Qwen-VL-Max-Latest: 8,192 max output tokens
  [/^qwen-vl-max-latest$/, LIMITS['8k']],

  // Generic vision-model: same as qwen-vl-max-latest (8K max output tokens)
  [/^vision-model$/, LIMITS['8k']],

  // Qwen3-VL-Plus: 32K max output tokens
  [/^qwen3-vl-plus$/, LIMITS['32k']],

  // Deepseek-chat: 8k max tokens
  [/^deepseek-chat$/, LIMITS['8k']],

  // Deepseek-reasoner: 64k max tokens
  [/^deepseek-reasoner$/, LIMITS['64k']],
];

export function tokenLimit(
  model: Model,
  type: TokenLimitType = 'input',
): TokenCount {
  const norm = normalize(model);
  const patterns = type === 'output' ? OUTPUT_PATTERNS : PATTERNS;

  for (const [regex, limit] of patterns) {
    if (regex.test(norm)) {
      return limit;
    }
  }

  return type === 'output' ? DEFAULT_OUTPUT_TOKEN_LIMIT : DEFAULT_TOKEN_LIMIT;
}
