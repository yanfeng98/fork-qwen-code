## WebUI Platform Adapter Guide (Chrome / Web / Share)

This guide is for extending `@qwen-code/webui` to new runtime platforms (e.g., Chrome Extension, pure Web pages, Share pages).

For VSCode adapter implementation reference, see:
`packages/vscode-ide-companion/src/webview/context/VSCodePlatformProvider.tsx`

---

### 1. Core Goals

- Reuse WebUI **without modifying UI components**.
- Inject platform capabilities via `PlatformProvider` (messaging, files, login, clipboard, etc.).
- Provide **fallback solutions** or mark `features` for missing capabilities.

---

### 2. PlatformContext Key Points (Minimum Implementation)

Required fields:

- `platform`: `'chrome' | 'web' | 'share'`
- `postMessage`: Send messages to host
- `onMessage`: Subscribe to host messages

Optional capabilities (by platform support):

- `openFile`
- `openDiff`
- `openTempFile`
- `attachFile`
- `login`
- `copyToClipboard`
- `getResourceUrl`
- `features` (mark capability availability)

Type definitions location:
`packages/webui/src/context/PlatformContext.tsx`

---

### 3. Adaptation Steps (Recommended Flow)

1. **Set up message channel**
   - Chrome Extension: `chrome.runtime.sendMessage` + `chrome.runtime.onMessage`
   - Web/Share: `window.postMessage` + `message` event, or custom event bus

2. **Implement PlatformProvider**
   - Map platform APIs to `PlatformContextValue`
   - Return `undefined` for missing capabilities and set `features`

3. **Application entry integration**
   - Wrap with `<PlatformProvider value={platformValue}>` at platform entry
   - Ensure all UI components are within the Provider

4. **Styles and themes**
   - Import `@qwen-code/webui/styles.css`
   - Define CSS variables on platform side (can copy initial values from `packages/webui/src/styles/variables.css`)

5. **Build and dependencies**
   - Tailwind uses `@qwen-code/webui/tailwind.preset`
   - `content` must include `node_modules/@qwen-code/webui/dist/**/*.js`

6. **Feature validation**
   - Message send/receive works (`postMessage`/`onMessage`)
   - Clicking file/diff output doesn't throw errors (can fallback)
   - `@`/`/` completion and input box interactions work

---

### 4. Reference Implementation (Web Platform Example)

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

### 5. Chrome Extension Suggested Mapping

- `postMessage` -> `chrome.runtime.sendMessage`
- `onMessage` -> `chrome.runtime.onMessage.addListener`
- `openFile`/`openDiff` -> Trigger background script to open tab / side panel
- `attachFile` -> `chrome.tabs` or `<input type="file">`

---

### 6. Web/Share Scenario Fallback Strategies

- `openFile/openDiff`: Display content in new window/modal
- `openTempFile`: Generate `Blob` and open or download
- `login`: Redirect to login URL or popup login window

---

### 7. Common Pitfalls

- Tailwind styles not working: `content` missing `@qwen-code/webui`
- Theme colors not working: `styles.css` not loaded or CSS variables not set
- `postMessage` no response: Host side hasn't registered corresponding message channel
