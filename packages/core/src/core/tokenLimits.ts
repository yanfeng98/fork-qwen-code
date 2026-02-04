type Model = string;
type TokenCount = number;

export type TokenLimitType = 'input' | 'output';
export const DEFAULT_TOKEN_LIMIT: TokenCount = 131_072;
export const DEFAULT_OUTPUT_TOKEN_LIMIT: TokenCount = 4_096;

const LIMITS = {
  '4k': 4_096,
  '8k': 8_192,
  '16k': 16_384,
  '32k': 32_768,
  '64k': 65_536,
  '128k': 131_072,
  '200k': 200_000,
  '256k': 262_144,
  '512k': 524_288,
  '1m': 1_048_576,
  '2m': 2_097_152,
  '10m': 10_485_760,
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
  [/^claude-sonnet-4.*$/, LIMITS['1m']],
  [/^claude-opus-4.*$/, LIMITS['1m']],

  [/^qwen3-coder-.*$/, LIMITS['256k']],
  [/^qwen3-.*-2507-.*$/, LIMITS['256k']],
  [/^deepseek(?:-.*)?$/, LIMITS['128k']],
  [/^gpt-oss.*$/, LIMITS['128k']],
];

const OUTPUT_PATTERNS: Array<[RegExp, TokenCount]> = [
  [/^deepseek/, LIMITS['32k']],
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
