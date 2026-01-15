# WebUI 组件库抽离计划

## 一、背景与目标

### 1.1 背景

`packages/vscode-ide-companion` 是一个 VSCode 插件，其核心内容是一个 WebView 页面，大量 UI 部分由 React 组件提供。随着产品线扩展，越来越多的场景需要构建包含 Web UI 的产品：

- **Chrome 浏览器扩展** - 侧边栏聊天界面
- **Web 端聊天页面** - 纯 Web 应用
- **对话分享页面** - 将对话渲染为静态 HTML

对于优秀的软件工程架构，我们需要让 UI 做到统一且可复用。

### 1.2 目标

1. 将 `vscode-ide-companion/src/webview/` 中的组件抽离到独立的 `@qwen-code/webui` 包
2. 建立分层架构：纯 UI 组件 + 业务 UI 组件
3. 使用 Vite + Storybook 进行开发和组件展示
4. 通过 Platform Context 抽象平台能力，实现跨平台复用
5. 提供 Tailwind CSS 预设，保证多产品 UI 一致性

---

## 二、现状分析

### 2.1 当前代码结构

`packages/vscode-ide-companion/src/webview/` 包含 77 个文件：

```
webview/
├── App.tsx                    # 主入口
├── components/
│   ├── icons/                 # 8 个图标组件
│   ├── layout/                # 8 个布局组件
│   │   ├── ChatHeader.tsx
│   │   ├── InputForm.tsx
│   │   ├── SessionSelector.tsx
│   │   ├── EmptyState.tsx
│   │   ├── Onboarding.tsx
│   │   └── ...
│   ├── messages/              # 消息展示组件
│   │   ├── UserMessage.tsx
│   │   ├── Assistant/
│   │   ├── MarkdownRenderer/
│   │   ├── ThinkingMessage.tsx
│   │   ├── Waiting/
│   │   └── toolcalls/         # 16 个工具调用组件
│   ├── PermissionDrawer/      # 权限请求抽屉
│   └── Tooltip.tsx
├── hooks/                     # 自定义 hooks
├── handlers/                  # 消息处理器
├── styles/                    # CSS 样式
└── utils/                     # 工具函数
```

### 2.2 关键依赖分析

**平台耦合点：**

- `useVSCode` hook - 调用 `acquireVsCodeApi()` 进行消息通信
- `handlers/` - 处理 VSCode 消息协议
- 部分类型定义来自 `../types/` 目录

```
┌─────────────────────────────────────────────────────────┐
│                    App.tsx (入口)                        │
├─────────────────────────────────────────────────────────┤
│  hooks/          │  handlers/       │  components/      │
│  ├─useVSCode ◄───┼──────────────────┼──────────────────┤
│  ├─useSession    │  ├─MessageRouter │  ├─icons/        │
│  ├─useFileContext│  ├─AuthHandler   │  ├─layout/       │
│  └─...           │  └─...           │  ├─messages/     │
│                  │                  │  └─PermDrawer/   │
├─────────────────────────────────────────────────────────┤
│            VSCode API (acquireVsCodeApi)                │
└─────────────────────────────────────────────────────────┘
```

---

## 三、目标架构

### 3.1 分层架构设计

```
┌─────────────────────────────────────────────────────────┐
│              Layer 3: Platform Adapters                 │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐    │
│  │VSCode Adapter│ │Chrome Adapter│ │ Web Adapter  │    │
│  └──────┬───────┘ └──────┬───────┘ └──────┬───────┘    │
├─────────┼────────────────┼────────────────┼────────────┤
│         │                │                │             │
│         ▼                ▼                ▼             │
│  ┌─────────────────────────────────────────────────┐   │
│  │           Platform Context Provider              │   │
│  └─────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────┤
│              Layer 2: Chat Components                   │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐          │
│  │ MessageList│ │ ChatHeader │ │ InputForm  │          │
│  └────────────┘ └────────────┘ └────────────┘          │
├─────────────────────────────────────────────────────────┤
│              Layer 1: Primitives (纯 UI)                │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐          │
│  │ Button │ │ Input  │ │ Icons  │ │Tooltip │          │
│  └────────┘ └────────┘ └────────┘ └────────┘          │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Platform Context 设计

```typescript
// @qwen-code/webui/src/context/PlatformContext.ts
interface PlatformContext {
  // 消息通信
  postMessage: (message: unknown) => void;
  onMessage: (handler: (message: unknown) => void) => () => void;

  // 文件操作
  openFile?: (path: string) => void;
  attachFile?: () => void;

  // 认证
  login?: () => void;

  // 平台信息
  platform: 'vscode' | 'chrome' | 'web' | 'share';
}
```

---

## 四、技术方案

### 4.1 构建配置（Vite Library Mode）

**输出格式：**

- ESM (`dist/index.js`) - 主要格式
- CJS (`dist/index.cjs`) - 兼容性
- TypeScript 声明 (`dist/index.d.ts`)

```javascript
// vite.config.ts
export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es', 'cjs'],
      fileName: (format) => `index.${format === 'es' ? 'js' : 'cjs'}`,
    },
    rollupOptions: {
      external: ['react', 'react-dom'],
    },
  },
});
```

### 4.2 Tailwind 预设方案

```javascript
// @qwen-code/webui/tailwind.preset.js
module.exports = {
  theme: {
    extend: {
      colors: {
        'app-primary': 'var(--app-primary)',
        'app-background': 'var(--app-primary-background)',
        'app-foreground': 'var(--app-primary-foreground)',
      },
    },
  },
};

// 消费方 tailwind.config.js
module.exports = {
  presets: [require('@qwen-code/webui/tailwind.preset')],
  content: [
    './src/**/*.{ts,tsx}',
    './node_modules/@qwen-code/webui/dist/**/*.js',
  ],
};
```

### 4.3 Storybook 配置

```
packages/webui/
├── .storybook/
│   ├── main.ts      # Storybook 配置
│   ├── preview.ts   # 全局装饰器
│   └── manager.ts   # UI 配置
└── src/
    └── stories/     # Story 文件
```

---

## 五、组件迁移分类

### 5.1 第一批：无依赖组件（可立即迁移）

| 组件               | 来源路径                 | 复杂度 | 说明                 |
| ------------------ | ------------------------ | ------ | -------------------- |
| Icons              | `components/icons/`      | 低     | 8 个图标组件，纯 SVG |
| Tooltip            | `components/Tooltip.tsx` | 低     | 纯 UI                |
| WaitingMessage     | `messages/Waiting/`      | 低     | 加载状态展示         |
| InterruptedMessage | `messages/Waiting/`      | 低     | 中断状态展示         |

### 5.2 第二批：轻度依赖组件（需要抽象 props）

| 组件             | 来源路径                       | 依赖        | 改造方式        |
| ---------------- | ------------------------------ | ----------- | --------------- |
| UserMessage      | `messages/UserMessage.tsx`     | onFileClick | 通过 props 注入 |
| AssistantMessage | `messages/Assistant/`          | onFileClick | 通过 props 注入 |
| ThinkingMessage  | `messages/ThinkingMessage.tsx` | onFileClick | 通过 props 注入 |
| MarkdownRenderer | `messages/MarkdownRenderer/`   | 无          | 直接迁移        |
| EmptyState       | `layout/EmptyState.tsx`        | 无          | 直接迁移        |
| ChatHeader       | `layout/ChatHeader.tsx`        | callbacks   | 通过 props 注入 |

### 5.3 第三批：中度依赖组件（需要 Context）

| 组件             | 来源路径                     | 依赖           | 改造方式        |
| ---------------- | ---------------------------- | -------------- | --------------- |
| InputForm        | `layout/InputForm.tsx`       | 多个 callbacks | Context + Props |
| SessionSelector  | `layout/SessionSelector.tsx` | session 数据   | Props 注入      |
| CompletionMenu   | `layout/CompletionMenu.tsx`  | items 数据     | Props 注入      |
| PermissionDrawer | `PermissionDrawer/`          | 回调函数       | Context + Props |
| ToolCall 组件    | `messages/toolcalls/`        | 多种工具展示   | 分模块迁移      |

### 5.4 第四批：重度依赖（保留在平台包）

| 组件/模块  | 说明                     |
| ---------- | ------------------------ |
| App.tsx    | 总入口，包含业务编排逻辑 |
| hooks/     | 大部分需要平台适配       |
| handlers/  | VSCode 消息处理          |
| Onboarding | 认证相关，平台特定       |

---

## 六、渐进式迁移策略

### 6.1 迁移原则

1. **双向兼容**：迁移期间，vscode-ide-companion 可以同时从 webui 和本地导入
2. **逐个替换**：每迁移一个组件，在 VSCode 插件中替换导入路径并验证
3. **不破坏现有功能**：确保每次迁移后插件可正常构建和运行

### 6.2 迁移流程

```
开发者 ──► @qwen-code/webui ──► vscode-ide-companion
  │              │                      │
  │   1. 复制组件到 webui               │
  │   2. 添加 Story 验证                │
  │   3. 从 index.ts 导出               │
  │              │                      │
  │              └──────────────────────┤
  │                                     │
  │                      4. 更新 import 路径
  │                      5. 删除原组件文件
  │                      6. 构建测试验证
```

### 6.3 示例：迁移 Icons

```typescript
// Before: vscode-ide-companion/src/webview/components/icons/index.ts
export { FileIcon } from './FileIcons.js';

// After: 修改导入
import { FileIcon } from '@qwen-code/webui';
// 或 import { FileIcon } from '@qwen-code/webui/icons';
```

---

## 七、任务拆分

### Phase 0: 基础设施搭建（前置任务）

- [ ] **T0-1**: Vite 构建配置
- [ ] **T0-2**: Storybook 配置
- [ ] **T0-3**: Tailwind 预设创建
- [ ] **T0-4**: Platform Context 定义
- [ ] **T0-5**: 类型定义迁移（共享 types）

### Phase 1: 纯 UI 组件迁移

- [ ] **T1-1**: Icons 组件迁移（8 个文件）
- [ ] **T1-2**: Tooltip 组件迁移
- [ ] **T1-3**: WaitingMessage / InterruptedMessage 迁移
- [ ] **T1-4**: 基础 Button/Input 组件完善

### Phase 2: 消息组件迁移

- [ ] **T2-1**: MarkdownRenderer 迁移
- [ ] **T2-2**: UserMessage 迁移
- [ ] **T2-3**: AssistantMessage 迁移
- [ ] **T2-4**: ThinkingMessage 迁移

### Phase 3: 布局组件迁移

- [ ] **T3-1**: ChatHeader 迁移
- [ ] **T3-2**: EmptyState 迁移
- [ ] **T3-3**: InputForm 迁移（需要 Context）
- [ ] **T3-4**: SessionSelector 迁移
- [ ] **T3-5**: CompletionMenu 迁移

### Phase 4: 复杂组件迁移

- [ ] **T4-1**: PermissionDrawer 迁移
- [ ] **T4-2**: ToolCall 系列组件迁移（16 个文件）

### Phase 5: 平台适配器

- [ ] **T5-1**: VSCode Adapter 实现
- [ ] **T5-2**: Chrome Extension Adapter
- [ ] **T5-3**: Web/Share Page Adapter

---

## 八、风险与注意事项

### 8.1 常见坑点

1. **Tailwind 类名 Tree Shaking**
   - 问题：组件库打包后 Tailwind 类名可能被移除
   - 解决：消费方的 `content` 配置需要包含 `node_modules/@qwen-code/webui`

2. **CSS 变量作用域**
   - 问题：`var(--app-primary)` 等变量需要在消费方定义
   - 解决：提供默认 CSS 变量文件，或在 Tailwind 预设中定义 fallback

3. **React 版本兼容**
   - 当前 vscode-ide-companion 使用 React 19，webui 的 peerDependencies 是 React 18
   - 需要更新 peerDependencies 为 `"react": "^18.0.0 || ^19.0.0"`

4. **ESM/CJS 兼容**
   - VSCode 扩展可能需要 CJS 格式
   - Vite 需要配置双格式输出

### 8.2 业界参考

- **Radix UI**: 纯 Headless 组件，样式完全由消费方控制
- **shadcn/ui**: 复制组件到项目中，而非作为依赖引入
- **Ant Design**: 完整的组件库，通过 ConfigProvider 进行定制

### 8.3 验收标准

每个迁移任务完成后需要：

1. 组件有对应的 Storybook Story
2. vscode-ide-companion 中的导入已更新
3. 插件可正常构建 (`npm run build:vscode`)
4. 插件功能正常（手动测试或已有测试通过）

---

## 九、预估时间

| 阶段    | 任务数 | 预估人天 | 可并行     |
| ------- | ------ | -------- | ---------- |
| Phase 0 | 5      | 2-3 天   | 部分可并行 |
| Phase 1 | 4      | 1-2 天   | 全部可并行 |
| Phase 2 | 4      | 2-3 天   | 全部可并行 |
| Phase 3 | 5      | 3-4 天   | 部分可并行 |
| Phase 4 | 2      | 3-4 天   | 可并行     |
| Phase 5 | 3      | 2-3 天   | 可并行     |

**总计**：约 13-19 人天（单人顺序执行），如果多人并行可缩短至 1-2 周

---

## 十、开发与调试流程

### 10.1 组件开发流程

```
┌─────────────────────────────────────────────────────────────────┐
│                       开发工作流程                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. 开发/修改组件                                                 │
│     └── 在 @qwen-code/webui/src/ 中编辑文件                      │
│                                                                  │
│  2. 使用 Storybook 调试                                          │
│     └── npm run storybook (端口 6006)                            │
│     └── 独立查看组件                                              │
│     └── 测试不同的 props/状态                                     │
│                                                                  │
│  3. 构建组件库                                                    │
│     └── npm run build                                            │
│     └── 输出: dist/index.js, dist/index.cjs, dist/index.d.ts    │
│                                                                  │
│  4. 在 VSCode 插件中使用                                          │
│     └── import { Component } from '@qwen-code/webui'             │
│     └── vscode-ide-companion 中不再修改 UI 代码                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 10.2 调试命令

```bash
# 启动 Storybook 进行组件开发
cd packages/webui
npm run storybook

# 监听模式进行库开发
npm run dev

# 构建生产版本
npm run build

# 类型检查
npm run typecheck
```

### 10.3 核心原则

1. **单一数据源**: 所有 UI 组件都在 `@qwen-code/webui` 中
2. **Storybook 优先**: 在集成前先在 Storybook 中调试和验证组件
3. **消费方不修改 UI 代码**: `vscode-ide-companion` 只导入和使用组件
4. **平台抽象**: 使用 `PlatformContext` 处理平台特定行为
