/**
 * defaultHeaders 功能测试脚本
 * 
 * 这个脚本会模拟配置并输出最终的 headers
 */

// 模拟配置解析逻辑
function resolveDefaultHeaders(settingsHeaders, providerHeaders) {
  console.log('📋 测试 defaultHeaders 合并逻辑\n');
  
  console.log('输入：');
  console.log('  Settings headers:', JSON.stringify(settingsHeaders, null, 2));
  console.log('  Provider headers:', JSON.stringify(providerHeaders, null, 2));
  console.log('');
  
  const result = {
    ...(settingsHeaders || {}),
    ...(providerHeaders || {}),
  };
  
  console.log('输出（合并后）:');
  console.log('  Final headers:', JSON.stringify(result, null, 2));
  console.log('');
  
  return result;
}

// 测试场景 1：只有 settings 配置
console.log('━'.repeat(60));
console.log('场景 1: 只配置 settings.model.generationConfig.defaultHeaders');
console.log('━'.repeat(60));
resolveDefaultHeaders(
  {
    'X-Custom-Header': 'from-settings',
    'X-Request-ID': 'req-123',
  },
  undefined
);

// 测试场景 2：只有 provider 配置
console.log('━'.repeat(60));
console.log('场景 2: 只配置 modelProviders[].generationConfig.defaultHeaders');
console.log('━'.repeat(60));
resolveDefaultHeaders(
  undefined,
  {
    'X-Provider-Header': 'from-provider',
    'X-API-Version': 'v2',
  }
);

// 测试场景 3：两者都配置，无冲突
console.log('━'.repeat(60));
console.log('场景 3: 两者都配置，header 名称不冲突');
console.log('━'.repeat(60));
resolveDefaultHeaders(
  {
    'X-Settings-Header': 'from-settings',
    'X-Request-ID': 'req-123',
  },
  {
    'X-Provider-Header': 'from-provider',
    'X-API-Version': 'v2',
  }
);

// 测试场景 4：两者都配置，有冲突（provider 优先）
console.log('━'.repeat(60));
console.log('场景 4: 两者都配置，有同名 header（provider 应覆盖 settings）');
console.log('━'.repeat(60));
resolveDefaultHeaders(
  {
    'X-Custom-Header': 'from-settings',
    'X-Request-ID': 'req-123',
    'X-Common-Header': 'settings-value',
  },
  {
    'X-Custom-Header': 'from-provider',
    'X-API-Version': 'v2',
    'X-Common-Header': 'provider-value',  // 这个应该覆盖 settings 的值
  }
);

// 模拟最终与基础 headers 合并
console.log('━'.repeat(60));
console.log('场景 5: 与系统基础 headers 合并（模拟实际使用）');
console.log('━'.repeat(60));

const systemHeaders = {
  'User-Agent': 'QwenCode/0.7.0 (darwin; arm64)',
};

const customHeaders = {
  'X-Custom-Header': 'custom-value',
  'X-Request-ID': 'req-456',
};

console.log('系统基础 headers:', JSON.stringify(systemHeaders, null, 2));
console.log('用户自定义 headers:', JSON.stringify(customHeaders, null, 2));
console.log('');

const finalHeaders = {
  ...systemHeaders,
  ...customHeaders,
};

console.log('最终发送的 headers:', JSON.stringify(finalHeaders, null, 2));
console.log('');

console.log('━'.repeat(60));
console.log('✅ 测试完成！');
console.log('');
console.log('💡 提示：');
console.log('  1. 在实际代码中，在 buildHeaders() 方法打断点可以看到这些值');
console.log('  2. 使用网络抓包工具可以看到实际发送的 HTTP 请求头');
console.log('  3. 高优先级（provider）的 headers 会覆盖低优先级（settings）的同名 headers');
