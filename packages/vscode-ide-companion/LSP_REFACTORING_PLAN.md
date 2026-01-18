# LSP 工具重构计划

## 背景

对比 Claude Code 的 LSP tool 定义和当前实现，发现以下关键差异：

### Claude Code 的设计（目标）

```json
{
  "name": "LSP",
  "operations": [
    "goToDefinition",
    "findReferences",
    "hover",
    "documentSymbol",
    "workspaceSymbol",
    "goToImplementation",
    "prepareCallHierarchy",
    "incomingCalls",
    "outgoingCalls"
  ],
  "required_params": ["operation", "filePath", "line", "character"]
}
```

### 当前实现

- **分散的 3 个工具**：`lsp_go_to_definition`, `lsp_find_references`, `lsp_workspace_symbol`
- **支持 3 个操作**：goToDefinition, findReferences, workspaceSymbol
- **缺少 6 个操作**：hover, documentSymbol, goToImplementation, prepareCallHierarchy, incomingCalls, outgoingCalls

---

## 重构目标

1. **统一工具设计**：将 3 个分散的工具合并为 1 个统一的 `LSP` 工具
2. **扩展操作支持**：添加缺失的 6 个 LSP 操作
3. **简化参数设计**：统一使用 operation + filePath + line + character 方式
4. **保持向后兼容**：旧工具名称继续支持

---

## 实施步骤

### Step 1: 扩展类型定义

**文件**: `packages/core/src/lsp/types.ts`

新增类型：

```typescript
// Hover 结果
interface LspHoverResult {
  contents: string | { language: string; value: string }[];
  range?: LspRange;
}

// Call Hierarchy 类型
interface LspCallHierarchyItem {
  name: string;
  kind: number;
  uri: string;
  range: LspRange;
  selectionRange: LspRange;
  detail?: string;
  data?: unknown;
  serverName?: string;
}

interface LspCallHierarchyIncomingCall {
  from: LspCallHierarchyItem;
  fromRanges: LspRange[];
}

interface LspCallHierarchyOutgoingCall {
  to: LspCallHierarchyItem;
  fromRanges: LspRange[];
}
```

扩展 LspClient 接口：

```typescript
interface LspClient {
  // 现有方法
  workspaceSymbols(query, limit): Promise<LspSymbolInformation[]>;
  definitions(location, serverName, limit): Promise<LspDefinition[]>;
  references(
    location,
    serverName,
    includeDeclaration,
    limit,
  ): Promise<LspReference[]>;

  // 新增方法
  hover(location, serverName): Promise<LspHoverResult | null>;
  documentSymbols(uri, serverName, limit): Promise<LspSymbolInformation[]>;
  implementations(location, serverName, limit): Promise<LspDefinition[]>;
  prepareCallHierarchy(location, serverName): Promise<LspCallHierarchyItem[]>;
  incomingCalls(
    item,
    serverName,
    limit,
  ): Promise<LspCallHierarchyIncomingCall[]>;
  outgoingCalls(
    item,
    serverName,
    limit,
  ): Promise<LspCallHierarchyOutgoingCall[]>;
}
```

### Step 2: 创建统一 LSP 工具

**新文件**: `packages/core/src/tools/lsp.ts`

参数设计（采用灵活的操作特定验证）：

```typescript
interface LspToolParams {
  operation: LspOperation; // 必填
  filePath?: string; // 位置类操作必填
  line?: number; // 精确位置操作必填 (1-based)
  character?: number; // 可选 (1-based)
  query?: string; // workspaceSymbol 必填
  callHierarchyItem?: object; // incomingCalls/outgoingCalls 必填
  serverName?: string; // 可选
  limit?: number; // 可选
  includeDeclaration?: boolean; // findReferences 可选
}

type LspOperation =
  | 'goToDefinition'
  | 'findReferences'
  | 'hover'
  | 'documentSymbol'
  | 'workspaceSymbol'
  | 'goToImplementation'
  | 'prepareCallHierarchy'
  | 'incomingCalls'
  | 'outgoingCalls';
```

各操作参数要求：
| 操作 | filePath | line | character | query | callHierarchyItem |
|------|----------|------|-----------|-------|-------------------|
| goToDefinition | 必填 | 必填 | 可选 | - | - |
| findReferences | 必填 | 必填 | 可选 | - | - |
| hover | 必填 | 必填 | 可选 | - | - |
| documentSymbol | 必填 | - | - | - | - |
| workspaceSymbol | - | - | - | 必填 | - |
| goToImplementation | 必填 | 必填 | 可选 | - | - |
| prepareCallHierarchy | 必填 | 必填 | 可选 | - | - |
| incomingCalls | - | - | - | - | 必填 |
| outgoingCalls | - | - | - | - | 必填 |

### Step 3: 扩展 NativeLspService

**文件**: `packages/cli/src/services/lsp/NativeLspService.ts`

新增 6 个方法：

1. `hover()` - 调用 `textDocument/hover`
2. `documentSymbols()` - 调用 `textDocument/documentSymbol`
3. `implementations()` - 调用 `textDocument/implementation`
4. `prepareCallHierarchy()` - 调用 `textDocument/prepareCallHierarchy`
5. `incomingCalls()` - 调用 `callHierarchy/incomingCalls`
6. `outgoingCalls()` - 调用 `callHierarchy/outgoingCalls`

### Step 4: 更新工具名称映射

**文件**: `packages/core/src/tools/tool-names.ts`

```typescript
export const ToolNames = {
  LSP: 'lsp', // 新增
  // 保留旧名称（标记 deprecated）
  LSP_WORKSPACE_SYMBOL: 'lsp_workspace_symbol',
  LSP_GO_TO_DEFINITION: 'lsp_go_to_definition',
  LSP_FIND_REFERENCES: 'lsp_find_references',
} as const;

export const ToolNamesMigration = {
  lsp_go_to_definition: ToolNames.LSP,
  lsp_find_references: ToolNames.LSP,
  lsp_workspace_symbol: ToolNames.LSP,
} as const;
```

### Step 5: 更新 Config 工具注册

**文件**: `packages/core/src/config/config.ts`

- 注册新的统一 `LspTool`
- 保留旧工具注册（向后兼容）
- 可通过配置选项禁用旧工具

### Step 6: 向后兼容处理

**文件**: 现有 3 个 LSP 工具文件

- 添加 `@deprecated` 标记
- 添加 deprecation warning 日志
- 可选：内部转发到新工具实现

---

## 关键文件列表

| 文件路径                                            | 操作                        |
| --------------------------------------------------- | --------------------------- |
| `packages/core/src/lsp/types.ts`                    | 修改 - 扩展类型定义         |
| `packages/core/src/tools/lsp.ts`                    | 新建 - 统一 LSP 工具        |
| `packages/core/src/tools/tool-names.ts`             | 修改 - 添加工具名称         |
| `packages/cli/src/services/lsp/NativeLspService.ts` | 修改 - 添加 6 个新方法      |
| `packages/core/src/config/config.ts`                | 修改 - 注册新工具           |
| `packages/core/src/tools/lsp-*.ts` (3个)            | 修改 - 添加 deprecated 标记 |

---

## 验证方式

1. **单元测试**：
   - 新 `LspTool` 参数验证测试
   - 各操作执行逻辑测试
   - 向后兼容测试

2. **集成测试**：
   - TypeScript Language Server 测试所有 9 个操作
   - Python LSP 测试
   - 多服务器场景测试

3. **手动验证**：
   - 在 VS Code 中测试各操作
   - 验证旧工具名称仍可使用
   - 验证 deprecation warning 输出

---

## 风险与缓解

| 风险                        | 缓解措施                               |
| --------------------------- | -------------------------------------- |
| 部分 LSP 服务器不支持新操作 | 独立 try-catch，返回清晰错误消息       |
| Call Hierarchy 两步流程复杂 | 文档说明使用方式，提供示例             |
| 向后兼容增加维护成本        | 设置明确弃用时间线，配置选项控制旧工具 |

---

## 后续优化建议

1. 考虑是否需要支持更多 LSP 操作（如 `textDocument/rename`, `textDocument/formatting`）
2. 考虑添加 LSP 服务器能力查询，动态返回支持的操作列表
3. 考虑优化 TypeScript Server warm-up 逻辑，减少首次调用延迟
