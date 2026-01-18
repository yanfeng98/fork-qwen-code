## WebUI 平台适配指引（Chrome / Web / Share）

本指引用于后续扩展 `@qwen-code/webui` 到新的运行平台（例如 Chrome 扩展、纯 Web 页、分享页）。
VSCode 的适配实现可参考：
`packages/vscode-ide-companion/src/webview/context/VSCodePlatformProvider.tsx`

---

### 1. 核心目标

- 在 **不改 UI 组件** 的前提下复用 WebUI。
- 用 `PlatformProvider` 注入平台能力（消息、文件、登录、剪贴板等）。
- 针对缺失能力，提供**降级方案**或标记 `features`。

---

### 2. PlatformContext 要点（最小实现）

必需字段：

- `platform`: `'chrome' | 'web' | 'share'`
- `postMessage`: 发送消息到宿主
- `onMessage`: 订阅宿主消息

可选能力（按平台支持）：

- `openFile`
- `openDiff`
- `openTempFile`
- `attachFile`
- `login`
- `copyToClipboard`
- `getResourceUrl`
- `features`（标记能力可用性）

类型定义位置：
`packages/webui/src/context/PlatformContext.tsx`

---

### 3. 适配步骤（建议流程）

1. **搭建消息通道**
   - Chrome 扩展：`chrome.runtime.sendMessage` + `chrome.runtime.onMessage`
   - Web/Share：`window.postMessage` + `message` 事件，或自定义事件总线

2. **实现 PlatformProvider**
   - 将平台 API 映射到 `PlatformContextValue`
   - 缺失能力返回 `undefined`，并设置 `features`

3. **应用入口接入**
   - 在平台入口包裹 `<PlatformProvider value={platformValue}>`
   - 确保所有 UI 组件处于 Provider 内

4. **样式与主题**
   - 引入 `@qwen-code/webui/styles.css`
   - 在平台侧定义 CSS 变量（可从 `packages/webui/src/styles/variables.css` 复制初始值）

5. **构建与依赖**
   - Tailwind 使用 `@qwen-code/webui/tailwind.preset`
   - `content` 需要包含 `node_modules/@qwen-code/webui/dist/**/*.js`

6. **功能验收**
   - 消息收发正常（`postMessage`/`onMessage`）
   - 点击文件/差异输出不报错（可降级）
   - `@`/`/` 补全与输入框交互正常

---

### 4. 参考实现（Web 平台示例）

```tsx
import type React from 'react';
import { PlatformProvider } from '@qwen-code/webui';
import type { PlatformContextValue } from '@qwen-code/webui';

const platformValue: PlatformContextValue = {
  platform: 'web',
  postMessage: (message) => {
    window.postMessage(message, '*');
  },
  onMessage: (handler) => {
    const listener = (event: MessageEvent) => handler(event.data);
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  },
  copyToClipboard: async (text) => navigator.clipboard.writeText(text),
  features: {
    canCopy: true,
  },
};

export const WebPlatformProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => <PlatformProvider value={platformValue}>{children}</PlatformProvider>;
```

---

### 5. Chrome 扩展建议映射

- `postMessage` -> `chrome.runtime.sendMessage`
- `onMessage` -> `chrome.runtime.onMessage.addListener`
- `openFile`/`openDiff` -> 触发 background 脚本打开 tab / side panel
- `attachFile` -> `chrome.tabs` 或 `<input type="file">`

---

### 6. Web/Share 场景的降级策略

- `openFile/openDiff`：用新窗口/模态框展示内容
- `openTempFile`：生成 `Blob` 并打开或下载
- `login`：跳转到登录 URL 或弹出登录窗口

---

### 7. 常见坑

- Tailwind 样式未生效：`content` 缺少 `@qwen-code/webui`
- 主题色失效：未加载 `styles.css` 或未设置 CSS 变量
- `postMessage` 无响应：宿主侧未注册对应消息通道
