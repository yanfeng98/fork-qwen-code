/**
 * @license
 * Copyright 2025 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, vi } from 'vitest';
import { buildRuntimeFetchOptions } from './runtimeFetchOptions.js';

type UndiciOptions = Record<string, unknown>;

vi.mock('undici', () => {
  class MockAgent {
    options: UndiciOptions;
    constructor(options: UndiciOptions) {
      this.options = options;
    }
  }

  class MockProxyAgent {
    options: UndiciOptions;
    constructor(options: UndiciOptions) {
      this.options = options;
    }
  }

  return {
    Agent: MockAgent,
    ProxyAgent: MockProxyAgent,
  };
});

vi.mock('https-proxy-agent', () => {
  class MockHttpsProxyAgent {
    proxyUrl: string;
    constructor(proxyUrl: string) {
      this.proxyUrl = proxyUrl;
    }
  }

  return {
    HttpsProxyAgent: MockHttpsProxyAgent,
  };
});

describe('buildRuntimeFetchOptions (node runtime)', () => {
  it('disables undici timeouts for Agent in OpenAI options', () => {
    const result = buildRuntimeFetchOptions('openai');

    expect(result).toBeDefined();
    expect(result && 'dispatcher' in result).toBe(true);

    const dispatcher = (result as { dispatcher?: { options?: UndiciOptions } })
      .dispatcher;
    expect(dispatcher?.options).toMatchObject({
      headersTimeout: 0,
      bodyTimeout: 0,
    });
  });

  it('uses ProxyAgent with disabled timeouts when proxy is set', () => {
    const result = buildRuntimeFetchOptions('openai', 'http://proxy.local');

    expect(result).toBeDefined();
    expect(result && 'dispatcher' in result).toBe(true);

    const dispatcher = (result as { dispatcher?: { options?: UndiciOptions } })
      .dispatcher;
    expect(dispatcher?.options).toMatchObject({
      uri: 'http://proxy.local',
      headersTimeout: 0,
      bodyTimeout: 0,
    });
  });

  it('returns empty object for Anthropic without proxy (uses SDK default agent)', () => {
    const result = buildRuntimeFetchOptions('anthropic');

    expect(result).toEqual({});
  });

  it('returns HttpsProxyAgent for Anthropic with proxy', () => {
    const result = buildRuntimeFetchOptions('anthropic', 'http://proxy.local');

    expect(result).toBeDefined();
    expect(result && 'httpAgent' in result).toBe(true);

    const httpAgent = (result as { httpAgent?: { proxyUrl?: string } })
      .httpAgent;
    expect(httpAgent?.proxyUrl).toBe('http://proxy.local');
  });
});
