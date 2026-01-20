# VSCode IDE Companion UI Migration Test Plan

## Overview

This document outlines the test plan to verify that the UI migration from `vscode-ide-companion` internal components to the shared `@qwen-code/webui` package does not introduce visual or functional regressions.

**Branch**: `feat/unified-ui-for-vscode-extension`  
**Changes**: 162 files, +15,849 lines, -3,699 lines

---

## Test Categories

### 1. Visual Regression Tests

#### 1.1 Message Display

| Test Case                   | Expected Behavior                                   | Priority |
| --------------------------- | --------------------------------------------------- | -------- |
| User message rendering      | Text displays correctly with proper styling         | P0       |
| Assistant message rendering | Markdown renders correctly, code blocks highlighted | P0       |
| Multi-turn conversation     | Messages stack correctly with proper spacing        | P0       |
| Long message handling       | Content wraps properly, no horizontal overflow      | P1       |
| Code blocks in messages     | Syntax highlighting, copy button works              | P0       |

#### 1.2 Tool Call Display

| Test Case                    | Expected Behavior                         | Priority |
| ---------------------------- | ----------------------------------------- | -------- |
| Shell/Bash tool call         | Shows command, status indicator, output   | P0       |
| Read file tool call          | Shows file path, file content preview     | P0       |
| Write file tool call         | Shows file path, diff preview             | P0       |
| Edit tool call               | Shows edit location, old/new content diff | P0       |
| Search (Grep/Glob) tool call | Shows search params, results list         | P0       |
| Think/Memory tool call       | Shows thinking content                    | P1       |
| Generic tool call fallback   | Displays raw JSON properly                | P1       |

#### 1.3 Timeline Visualization

| Test Case                  | Expected Behavior                              | Priority |
| -------------------------- | ---------------------------------------------- | -------- |
| Timeline bullet position   | Bullets aligned at left: 8px, top: 8px         | P0       |
| Timeline vertical line     | Line connects bullets, proper start/end        | P0       |
| First message (data-first) | No line above first item                       | P0       |
| Last message (data-last)   | No line below last item                        | P0       |
| Mixed message types        | Timeline consistent across user/assistant/tool | P0       |

#### 1.4 Theme Compatibility

| Test Case           | Expected Behavior                  | Priority |
| ------------------- | ---------------------------------- | -------- |
| Dark theme          | All colors use VSCode dark tokens  | P0       |
| Light theme         | All colors use VSCode light tokens | P0       |
| High contrast theme | Sufficient contrast ratios         | P2       |
| Custom theme        | CSS variables properly inherited   | P1       |

### 2. Functional Tests

#### 2.1 Input & Interaction

| Test Case        | Expected Behavior                 | Priority |
| ---------------- | --------------------------------- | -------- |
| Text input       | User can type and submit messages | P0       |
| Send button      | Sends message on click            | P0       |
| Enter key        | Sends message (configurable)      | P0       |
| Shift+Enter      | Inserts newline                   | P0       |
| Disabled state   | Input disabled during processing  | P0       |
| Placeholder text | Shows appropriate placeholder     | P1       |

#### 2.2 Tool Call Interactions

| Test Case          | Expected Behavior                           | Priority |
| ------------------ | ------------------------------------------- | -------- |
| File path click    | Opens file in editor                        | P0       |
| Diff view button   | Opens VSCode diff editor                    | P0       |
| Copy code button   | Copies code to clipboard                    | P0       |
| Expand/collapse    | Tool call content expands/collapses         | P1       |
| Permission request | Shows permission drawer, responds to choice | P0       |

#### 2.3 Permission Drawer

| Test Case          | Expected Behavior              | Priority |
| ------------------ | ------------------------------ | -------- |
| Drawer opens       | Shows on permission request    | P0       |
| Options display    | All permission options visible | P0       |
| Keyboard selection | 1/2/3 keys select options      | P0       |
| Confirm button     | Sends response to backend      | P0       |
| Close/cancel       | Drawer closes properly         | P0       |

#### 2.4 Scroll Behavior

| Test Case                  | Expected Behavior                         | Priority |
| -------------------------- | ----------------------------------------- | -------- |
| Auto-scroll on new message | Scrolls to bottom when at bottom          | P0       |
| Manual scroll preserved    | Doesn't auto-scroll when user scrolled up | P0       |
| Scroll to bottom button    | Appears when scrolled up, works on click  | P1       |

### 3. Integration Tests

#### 3.1 ACP Protocol Communication

| Test Case          | Expected Behavior                     | Priority |
| ------------------ | ------------------------------------- | -------- |
| Message send       | postMessage works correctly           | P0       |
| Message receive    | onMessage handler processes responses | P0       |
| Tool call response | Permission responses reach backend    | P0       |
| Session state      | State persists across messages        | P0       |

#### 3.2 Platform Provider

| Test Case          | Expected Behavior                     | Priority |
| ------------------ | ------------------------------------- | -------- |
| openFile           | Opens files in VSCode editor          | P0       |
| openDiff           | Opens diff view in VSCode             | P0       |
| copyToClipboard    | Copies to system clipboard            | P0       |
| Features detection | features object reflects capabilities | P1       |

---

## Test Execution Checklist

### Pre-test Setup

- [ ] Build extension: `npm run build`
- [ ] Install extension in VSCode
- [ ] Open a test workspace with varied file types

### Manual Test Execution

#### Phase 1: Basic Rendering (P0)

- [ ] Send a simple text message and verify rendering
- [ ] Receive an assistant response with code blocks
- [ ] Trigger a tool call (e.g., read a file) and verify display
- [ ] Check timeline bullets and lines alignment
- [ ] Verify dark/light theme switching

#### Phase 2: Tool Calls (P0)

- [ ] Shell command execution display
- [ ] File read with content preview
- [ ] File write with diff preview
- [ ] File edit with diff display
- [ ] Search results display (grep/glob)

#### Phase 3: Interactions (P0)

- [ ] Click file path to open in editor
- [ ] Use copy button on code blocks
- [ ] Test permission drawer flow
- [ ] Verify scroll behavior with many messages

#### Phase 4: Edge Cases (P1)

- [ ] Very long messages (1000+ chars)
- [ ] Very long file paths
- [ ] Large diff outputs
- [ ] Multiple tool calls in sequence
- [ ] Error state displays

---

## Comparison Reference

### Before/After Screenshot Comparison

For each component, capture screenshots:

1. **Chat container** - Overall layout
2. **User message** - Single message styling
3. **Assistant message** - With code blocks
4. **Shell tool call** - With output
5. **Read tool call** - With file content
6. **Edit tool call** - With diff
7. **Permission drawer** - Open state
8. **Timeline** - Multiple messages showing bullets/lines

### CSS Variable Mapping Verification

Ensure these CSS variables are properly mapped:

```
--app-primary-foreground    <- --vscode-foreground
--app-primary-background    <- --vscode-sideBar-background
--app-input-background      <- --vscode-input-background
--app-input-border          <- --vscode-inlineChatInput-border
--app-ghost-button-hover    <- --vscode-toolbar-hoverBackground
--app-list-hover-background <- --vscode-list-hoverBackground
```

---

## Known Changes to Verify

### Removed Components (migrated to webui)

- `Execute/Execute.tsx` → `ShellToolCall.tsx`
- `Bash/Bash.tsx` → `ShellToolCall.tsx`
- `Search/SearchToolCall.tsx` → `SearchToolCall.tsx`
- `EditIcons.tsx` → shared icons

### CSS Changes

- Timeline styles moved to webui
- Theme variables consolidated in `App.css`
- Tailwind utilities reduced

### Data Flow Changes

- ACP messages now go through `ACPAdapter`
- Tool call mapping uses shared `getToolCallComponent`

---

## Sign-off Criteria

- [ ] All P0 tests pass
- [ ] No visual regressions in dark theme
- [ ] No visual regressions in light theme
- [ ] File operations work correctly
- [ ] Permission flow works end-to-end
- [ ] No console errors during normal operation
