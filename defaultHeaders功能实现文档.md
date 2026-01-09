# defaultHeaders 功能实现文档

## 概述

本次修改为 Qwen Code 项目添加了 `model.generationConfig.defaultHeaders` 配置属性，允许用户为 API 请求自定义 HTTP headers。该功能支持 OpenAI、Gemini 和 Anthropic 三种 content generators，并在 ModelProviders 级别提供支持。

## 修改文件清单

共修改了 8 个文件：

### 1. 类型定义文件（3个）

- `packages/core/src/core/contentGenerator.ts`
- `packages/core/src/models/types.ts`
- `packages/core/src/models/constants.ts`

### 2. 配置解析器（1个）

- `packages/core/src/models/modelConfigResolver.ts`

### 3. Content Generators 实现（4个）

- `packages/core/src/core/openaiContentGenerator/provider/default.ts`
- `packages/core/src/core/openaiContentGenerator/provider/dashscope.ts`
- `packages/core/src/core/geminiContentGenerator/geminiContentGenerator.ts`
- `packages/core/src/core/anthropicContentGenerator/anthropicContentGenerator.ts`

---

## 详细修改说明

### 1. packages/core/src/core/contentGenerator.ts

**修改位置：** 第 93 行附近，`ContentGeneratorConfig` 类型定义

**修改内容：**

```typescript
export type ContentGeneratorConfig = {
  // ... 其他字段
  schemaCompliance?: 'auto' | 'openapi_30';
  // 新增字段
  defaultHeaders?: Record<string, string>;
};
```

**修改意图：**

- 在核心配置类型 `ContentGeneratorConfig` 中添加 `defaultHeaders` 字段
- 类型为 `Record<string, string>`，表示键值对形式的 HTTP headers
- 设置为可选字段（`?`），不影响现有代码的兼容性
- 这是整个功能的基础类型定义，所有 content generators 都会使用这个配置

---

### 2. packages/core/src/models/types.ts

**修改位置：** 第 26-34 行，`ModelGenerationConfig` 类型定义

**修改内容：**

```typescript
export type ModelGenerationConfig = Pick<
  ContentGeneratorConfig,
  | 'samplingParams'
  | 'timeout'
  | 'maxRetries'
  | 'disableCacheControl'
  | 'schemaCompliance'
  | 'reasoning'
  | 'defaultHeaders' // 新增
>;
```

**修改意图：**

- 将 `defaultHeaders` 添加到 `ModelGenerationConfig` 类型中
- `ModelGenerationConfig` 是模型级别的配置类型，用于 ModelProviders 配置
- 这样用户就可以在 `settings.json` 的 `modelProviders` 配置中使用 `defaultHeaders`
- 确保配置可以从 ModelProviders 层级传递到 ContentGeneratorConfig

---

### 3. packages/core/src/models/constants.ts

**修改位置：** 第 16-23 行，`MODEL_GENERATION_CONFIG_FIELDS` 常量数组

**修改内容：**

```typescript
export const MODEL_GENERATION_CONFIG_FIELDS = [
  'samplingParams',
  'timeout',
  'maxRetries',
  'disableCacheControl',
  'schemaCompliance',
  'reasoning',
  'defaultHeaders', // 新增
] as const satisfies ReadonlyArray<keyof ContentGeneratorConfig>;
```

**修改意图：**

- 将 `defaultHeaders` 添加到模型生成配置字段列表中
- 这个常量数组用于配置解析器遍历和处理所有生成配置字段
- 添加后，配置解析器会自动处理 `defaultHeaders` 的层级解析
- 确保类型安全，使用 TypeScript 的 `satisfies` 关键字验证字段名正确

---

### 4. packages/core/src/models/modelConfigResolver.ts

**修改位置：** 第 338-370 行，`resolveGenerationConfig` 函数

**修改内容：**

```typescript
function resolveGenerationConfig(
  settingsConfig: Partial<ContentGeneratorConfig> | undefined,
  modelProviderConfig: Partial<ContentGeneratorConfig> | undefined,
  authType: AuthType | undefined,
  modelId: string | undefined,
  sources: ConfigSources,
): Partial<ContentGeneratorConfig> {
  const result: Partial<ContentGeneratorConfig> = {};

  for (const field of MODEL_GENERATION_CONFIG_FIELDS) {
    // 新增：defaultHeaders 的特殊处理
    if (field === 'defaultHeaders') {
      const settingsHeaders = settingsConfig?.defaultHeaders;
      const providerHeaders = modelProviderConfig?.defaultHeaders;

      if (settingsHeaders || providerHeaders) {
        // 合并 headers：provider headers 覆盖 settings headers
        result.defaultHeaders = {
          ...(settingsHeaders || {}),
          ...(providerHeaders || {}),
        };

        // 跟踪配置来源
        if (providerHeaders && authType) {
          sources[field] = modelProvidersSource(
            authType,
            modelId || '',
            `generationConfig.${field}`,
          );
        } else if (settingsHeaders) {
          sources[field] = settingsSource(`model.generationConfig.${field}`);
        }
      }
      continue;
    }

    // 其他字段的处理逻辑保持不变
    // ...
  }

  return result;
}
```

**修改意图：**

- 实现 `defaultHeaders` 的多层级配置解析和合并逻辑
- **合并策略**：
  - 从 `settings.model.generationConfig.defaultHeaders` 读取基础 headers
  - 从 `modelProviders[authType][].generationConfig.defaultHeaders` 读取覆盖 headers
  - 使用对象展开运算符合并，高优先级（modelProvider）的同名 header 会覆盖低优先级（settings）
  - 不同名的 headers 会被保留和合并
- **来源跟踪**：记录最终生效的配置来源，便于调试和 UI 展示
- **特殊处理原因**：与其他字段不同，`defaultHeaders` 需要合并而不是简单替换

---

### 5. packages/core/src/core/openaiContentGenerator/provider/default.ts

**修改位置：** 第 25-32 行，`buildHeaders` 方法

**修改内容：**

```typescript
buildHeaders(): Record<string, string | undefined> {
  const version = this.cliConfig.getCliVersion() || 'unknown';
  const userAgent = `QwenCode/${version} (${process.platform}; ${process.arch})`;
  const baseHeaders: Record<string, string | undefined> = {
    'User-Agent': userAgent,
  };

  // 新增：合并自定义 defaultHeaders
  const customHeaders = this.contentGeneratorConfig.defaultHeaders || {};
  return {
    ...baseHeaders,
    ...customHeaders,
  };
}
```

**修改意图：**

- 在 DefaultOpenAICompatibleProvider 中实现 `defaultHeaders` 支持
- 将用户配置的自定义 headers 与系统默认 headers（如 User-Agent）合并
- 自定义 headers 会覆盖同名的默认 headers（如果用户想自定义 User-Agent）
- 这个修改会自动影响所有继承自 DefaultOpenAICompatibleProvider 的子类：
  - ModelScopeOpenAICompatibleProvider
  - DeepSeekOpenAICompatibleProvider
  - OpenRouterOpenAICompatibleProvider（虽然它 override 了 buildHeaders，但会调用 super.buildHeaders()）

---

### 6. packages/core/src/core/openaiContentGenerator/provider/dashscope.ts

**修改位置：** 第 45-58 行，`buildHeaders` 方法

**修改内容：**

```typescript
buildHeaders(): Record<string, string | undefined> {
  const version = this.cliConfig.getCliVersion() || 'unknown';
  const userAgent = `QwenCode/${version} (${process.platform}; ${process.arch})`;
  const { authType } = this.contentGeneratorConfig;
  const baseHeaders: Record<string, string | undefined> = {
    'User-Agent': userAgent,
    'X-DashScope-CacheControl': 'enable',
    'X-DashScope-UserAgent': userAgent,
    'X-DashScope-AuthType': authType,
  };

  // 新增：合并自定义 defaultHeaders
  const customHeaders = this.contentGeneratorConfig.defaultHeaders || {};
  return {
    ...baseHeaders,
    ...customHeaders,
  };
}
```

**修改意图：**

- DashScopeOpenAICompatibleProvider 有自己独立的 `buildHeaders` 实现
- 需要单独添加 `defaultHeaders` 支持
- 保持与 DefaultOpenAICompatibleProvider 相同的合并逻辑
- DashScope 特有的 headers（如 X-DashScope-\*）会与自定义 headers 合并
- 确保 DashScope（阿里云百炼）用户也能使用自定义 headers 功能

---

### 7. packages/core/src/core/geminiContentGenerator/geminiContentGenerator.ts

**修改位置：** 第 30-48 行，`constructor` 方法

**修改内容：**

```typescript
constructor(
  options: {
    apiKey?: string;
    vertexai?: boolean;
    httpOptions?: { headers: Record<string, string> };
  },
  contentGeneratorConfig?: ContentGeneratorConfig,
) {
  // 新增：合并自定义 defaultHeaders 到 httpOptions
  const customHeaders = contentGeneratorConfig?.defaultHeaders || {};
  const mergedOptions = {
    ...options,
    httpOptions: {
      headers: {
        ...(options.httpOptions?.headers || {}),
        ...customHeaders,
      },
    },
  };

  this.googleGenAI = new GoogleGenAI(mergedOptions);
  this.contentGeneratorConfig = contentGeneratorConfig;
}
```

**修改意图：**

- Gemini 使用 Google 的 `@google/genai` SDK
- 该 SDK 通过 `httpOptions.headers` 参数接收自定义 headers
- 在构造函数中将 `defaultHeaders` 合并到 `httpOptions.headers` 中
- 确保自定义 headers 在创建 GoogleGenAI 实例时就被设置
- 合并逻辑：原有的 httpOptions.headers + 自定义 defaultHeaders

---

### 8. packages/core/src/core/anthropicContentGenerator/anthropicContentGenerator.ts

**修改位置：** 第 140-158 行，`buildHeaders` 方法

**修改内容：**

```typescript
private buildHeaders(): Record<string, string> {
  const version = this.cliConfig.getCliVersion() || 'unknown';
  const userAgent = `QwenCode/${version} (${process.platform}; ${process.arch})`;

  const betas: string[] = [];
  const reasoning = this.contentGeneratorConfig.reasoning;

  // Interleaved thinking 配置
  if (reasoning !== false) {
    betas.push('interleaved-thinking-2025-05-14');
  }

  // Effort (beta) 配置
  if (reasoning !== false && reasoning?.effort !== undefined) {
    betas.push('effort-2025-11-24');
  }

  const headers: Record<string, string> = {
    'User-Agent': userAgent,
  };

  if (betas.length) {
    headers['anthropic-beta'] = betas.join(',');
  }

  // 新增：合并自定义 defaultHeaders
  const customHeaders = this.contentGeneratorConfig.defaultHeaders || {};
  return {
    ...headers,
    ...customHeaders,
  };
}
```

**修改意图：**

- 在 AnthropicContentGenerator 的 `buildHeaders` 方法中添加 `defaultHeaders` 支持
- Anthropic SDK 在构造函数中通过 `defaultHeaders` 参数接收自定义 headers
- 将用户配置的 headers 与系统 headers（User-Agent、anthropic-beta）合并
- 保持与 OpenAI providers 相同的合并逻辑
- 确保 Claude 模型用户也能使用自定义 headers 功能

---

## 配置层级和优先级

### 配置层级

1. **L1（最高优先级）**: `modelProviders[authType][].generationConfig.defaultHeaders`
2. **L2（次优先级）**: `settings.model.generationConfig.defaultHeaders`

### 合并规则

- 两个层级的 headers 会被合并
- 相同名称的 header，高优先级（L1）会覆盖低优先级（L2）
- 不同名称的 headers 会被保留

### 示例

**Settings 配置：**

```json
{
  "model": {
    "generationConfig": {
      "defaultHeaders": {
        "X-Custom-Header": "from-settings",
        "X-Another-Header": "value1"
      }
    }
  }
}
```

**ModelProviders 配置：**

```json
{
  "modelProviders": {
    "openai": [
      {
        "id": "qwen3-coder-plus",
        "generationConfig": {
          "defaultHeaders": {
            "X-Custom-Header": "from-provider",
            "X-Provider-Header": "value2"
          }
        }
      }
    ]
  }
}
```

**最终生效的 headers：**

```json
{
  "X-Custom-Header": "from-provider", // 被 provider 覆盖
  "X-Another-Header": "value1", // 保留自 settings
  "X-Provider-Header": "value2" // 来自 provider
}
```

---

## 使用场景

1. **添加认证 headers**：为需要额外认证的 API 网关添加自定义认证头
2. **请求追踪**：添加 `X-Request-ID`、`X-Trace-ID` 等追踪 headers
3. **API 版本控制**：通过 `X-API-Version` 指定 API 版本
4. **自定义元数据**：添加组织、项目等元数据信息
5. **调试和监控**：添加调试标识或监控标签

---

## 技术亮点

1. **类型安全**：完整的 TypeScript 类型定义，编译时检查
2. **配置来源追踪**：记录每个配置项的来源，便于调试
3. **向后兼容**：所有修改都是可选的，不影响现有代码
4. **统一实现**：三个主要 content generators 都采用相同的合并逻辑
5. **继承友好**：OpenAI providers 的继承体系自动获得支持
6. **灵活合并**：支持多层级配置合并，满足不同场景需求

---

## 测试验证

- ✅ TypeScript 编译通过，无类型错误
- ✅ 所有 OpenAI providers（Default、DashScope、ModelScope、DeepSeek、OpenRouter）都支持
- ✅ Gemini 和 Anthropic generators 正确实现
- ✅ 配置解析器正确处理多层级合并
- ✅ 向后兼容，不影响未配置 defaultHeaders 的用户

---

## 总结

本次修改通过 8 个文件的协同更新，为 Qwen Code 项目添加了完整的自定义 HTTP headers 支持。修改遵循了项目的架构设计，保持了代码的一致性和可维护性，同时确保了向后兼容性和类型安全。用户现在可以通过简单的配置为 API 请求添加自定义 headers，满足各种企业级和高级使用场景的需求。
