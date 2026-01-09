/**
 * defaultHeaders 功能验证脚本
 * 
 * 使用方法：
 * node verify-defaultHeaders.js
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 开始验证 defaultHeaders 功能实现...\n');

// 验证项目列表
const verifications = [
  {
    name: '1. ContentGeneratorConfig 类型定义',
    file: 'packages/core/src/core/contentGenerator.ts',
    check: (content) => content.includes('defaultHeaders?: Record<string, string>'),
    description: '检查 ContentGeneratorConfig 是否包含 defaultHeaders 字段'
  },
  {
    name: '2. ModelGenerationConfig 类型定义',
    file: 'packages/core/src/models/types.ts',
    check: (content) => content.includes("'defaultHeaders'"),
    description: '检查 ModelGenerationConfig 是否包含 defaultHeaders'
  },
  {
    name: '3. MODEL_GENERATION_CONFIG_FIELDS 常量',
    file: 'packages/core/src/models/constants.ts',
    check: (content) => content.includes("'defaultHeaders'"),
    description: '检查配置字段列表是否包含 defaultHeaders'
  },
  {
    name: '4. modelConfigResolver 合并逻辑',
    file: 'packages/core/src/models/modelConfigResolver.ts',
    check: (content) => content.includes("field === 'defaultHeaders'") && content.includes('settingsHeaders'),
    description: '检查配置解析器是否实现 defaultHeaders 合并逻辑'
  },
  {
    name: '5. DefaultOpenAICompatibleProvider',
    file: 'packages/core/src/core/openaiContentGenerator/provider/default.ts',
    check: (content) => content.includes('this.contentGeneratorConfig.defaultHeaders'),
    description: '检查 OpenAI 默认 provider 是否支持 defaultHeaders'
  },
  {
    name: '6. DashScopeOpenAICompatibleProvider',
    file: 'packages/core/src/core/openaiContentGenerator/provider/dashscope.ts',
    check: (content) => content.includes('this.contentGeneratorConfig.defaultHeaders'),
    description: '检查 DashScope provider 是否支持 defaultHeaders'
  },
  {
    name: '7. GeminiContentGenerator',
    file: 'packages/core/src/core/geminiContentGenerator/geminiContentGenerator.ts',
    check: (content) => content.includes('contentGeneratorConfig?.defaultHeaders'),
    description: '检查 Gemini generator 是否支持 defaultHeaders'
  },
  {
    name: '8. AnthropicContentGenerator',
    file: 'packages/core/src/core/anthropicContentGenerator/anthropicContentGenerator.ts',
    check: (content) => content.includes('this.contentGeneratorConfig.defaultHeaders'),
    description: '检查 Anthropic generator 是否支持 defaultHeaders'
  }
];

let passedCount = 0;
let failedCount = 0;

// 执行验证
verifications.forEach((verification, index) => {
  const filePath = path.join(__dirname, verification.file);
  
  try {
    if (!fs.existsSync(filePath)) {
      console.log(`❌ ${verification.name}`);
      console.log(`   文件不存在: ${verification.file}\n`);
      failedCount++;
      return;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const passed = verification.check(content);

    if (passed) {
      console.log(`✅ ${verification.name}`);
      console.log(`   ${verification.description}`);
      console.log(`   文件: ${verification.file}\n`);
      passedCount++;
    } else {
      console.log(`❌ ${verification.name}`);
      console.log(`   ${verification.description}`);
      console.log(`   文件: ${verification.file}`);
      console.log(`   状态: 未找到预期的代码\n`);
      failedCount++;
    }
  } catch (error) {
    console.log(`❌ ${verification.name}`);
    console.log(`   错误: ${error.message}\n`);
    failedCount++;
  }
});

// 输出总结
console.log('━'.repeat(60));
console.log(`\n📊 验证结果总结:`);
console.log(`   ✅ 通过: ${passedCount}/${verifications.length}`);
console.log(`   ❌ 失败: ${failedCount}/${verifications.length}`);

if (failedCount === 0) {
  console.log(`\n🎉 所有验证项都通过！defaultHeaders 功能已正确实现。\n`);
  process.exit(0);
} else {
  console.log(`\n⚠️  有 ${failedCount} 项验证失败，请检查相关文件。\n`);
  process.exit(1);
}
