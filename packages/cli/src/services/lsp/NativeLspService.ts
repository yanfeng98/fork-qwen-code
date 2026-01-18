import type {
  Config as CoreConfig,
  WorkspaceContext,
  FileDiscoveryService,
  IdeContextStore,
  LspCallHierarchyIncomingCall,
  LspCallHierarchyItem,
  LspCallHierarchyOutgoingCall,
  LspDefinition,
  LspHoverResult,
  LspLocation,
  LspRange,
  LspReference,
  LspSymbolInformation,
} from '@qwen-code/qwen-code-core';
import type { EventEmitter } from 'events';
import { LspConnectionFactory } from './LspConnectionFactory.js';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { spawn, type ChildProcess } from 'node:child_process';
import * as fs from 'node:fs';
import { globSync } from 'glob';

// 定义 LSP 初始化选项的类型
interface LspInitializationOptions {
  [key: string]: unknown;
}

interface LspSocketOptions {
  host?: string;
  port?: number;
  path?: string;
}

// 定义 LSP 服务器配置类型
interface LspServerConfig {
  name: string;
  languages: string[];
  command?: string;
  args?: string[];
  transport: 'stdio' | 'tcp' | 'socket';
  env?: Record<string, string>;
  initializationOptions?: LspInitializationOptions;
  settings?: Record<string, unknown>;
  extensionToLanguage?: Record<string, string>;
  rootUri: string;
  workspaceFolder?: string;
  startupTimeout?: number;
  shutdownTimeout?: number;
  restartOnCrash?: boolean;
  maxRestarts?: number;
  trustRequired?: boolean;
  socket?: LspSocketOptions;
}

// 定义 LSP 连接接口
interface LspConnectionInterface {
  listen: (readable: NodeJS.ReadableStream) => void;
  send: (message: unknown) => void;
  onNotification: (handler: (notification: unknown) => void) => void;
  onRequest: (handler: (request: unknown) => Promise<unknown>) => void;
  request: (method: string, params: unknown) => Promise<unknown>;
  initialize: (params: unknown) => Promise<unknown>;
  shutdown: () => Promise<void>;
  end: () => void;
}

// 定义 LSP 服务器状态
type LspServerStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'READY' | 'FAILED';

// 定义 LSP 服务器句柄
interface LspServerHandle {
  config: LspServerConfig;
  status: LspServerStatus;
  connection?: LspConnectionInterface;
  process?: ChildProcess;
  error?: Error;
  warmedUp?: boolean;
  stopRequested?: boolean;
  restartAttempts?: number;
}

/**
 * Symbol kind labels for converting numeric LSP SymbolKind to readable strings.
 * Based on the LSP specification: https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#symbolKind
 */
const SYMBOL_KIND_LABELS: Record<number, string> = {
  1: 'File',
  2: 'Module',
  3: 'Namespace',
  4: 'Package',
  5: 'Class',
  6: 'Method',
  7: 'Property',
  8: 'Field',
  9: 'Constructor',
  10: 'Enum',
  11: 'Interface',
  12: 'Function',
  13: 'Variable',
  14: 'Constant',
  15: 'String',
  16: 'Number',
  17: 'Boolean',
  18: 'Array',
  19: 'Object',
  20: 'Key',
  21: 'Null',
  22: 'EnumMember',
  23: 'Struct',
  24: 'Event',
  25: 'Operator',
  26: 'TypeParameter',
};

const DEFAULT_LSP_STARTUP_TIMEOUT_MS = 10000;
const DEFAULT_LSP_MAX_RESTARTS = 3;

interface NativeLspServiceOptions {
  allowedServers?: string[];
  excludedServers?: string[];
  requireTrustedWorkspace?: boolean;
  workspaceRoot?: string;
  inlineServerConfigs?: Record<string, unknown>;
}

export class NativeLspService {
  private serverHandles: Map<string, LspServerHandle> = new Map();
  private config: CoreConfig;
  private workspaceContext: WorkspaceContext;
  private fileDiscoveryService: FileDiscoveryService;
  private allowedServers?: string[];
  private excludedServers?: string[];
  private requireTrustedWorkspace: boolean;
  private workspaceRoot: string;
  private inlineServerConfigs?: Record<string, unknown>;
  private warnedLegacyConfig = false;

  constructor(
    config: CoreConfig,
    workspaceContext: WorkspaceContext,
    _eventEmitter: EventEmitter, // 未使用，用下划线前缀
    fileDiscoveryService: FileDiscoveryService,
    _ideContextStore: IdeContextStore, // 未使用，用下划线前缀
    options: NativeLspServiceOptions = {},
  ) {
    this.config = config;
    this.workspaceContext = workspaceContext;
    this.fileDiscoveryService = fileDiscoveryService;
    this.allowedServers = options.allowedServers?.filter(Boolean);
    this.excludedServers = options.excludedServers?.filter(Boolean);
    this.requireTrustedWorkspace = options.requireTrustedWorkspace ?? true;
    this.workspaceRoot =
      options.workspaceRoot ??
      (config as { getProjectRoot: () => string }).getProjectRoot();
    this.inlineServerConfigs = options.inlineServerConfigs;
  }

  /**
   * 发现并准备 LSP 服务器
   */
  async discoverAndPrepare(): Promise<void> {
    const workspaceTrusted = this.config.isTrustedFolder();
    this.serverHandles.clear();

    // 检查工作区是否受信任
    if (this.requireTrustedWorkspace && !workspaceTrusted) {
      console.log('工作区不受信任，跳过 LSP 服务器发现');
      return;
    }

    // 检测工作区中的语言
    const userConfigs = await this.loadUserConfigs();
    const extensionOverrides =
      this.collectExtensionToLanguageOverrides(userConfigs);
    const detectedLanguages = await this.detectLanguages(extensionOverrides);

    // 合并配置：内置预设 + 用户 .lsp.json + 可选 cclsp 兼容转换
    const serverConfigs = this.mergeConfigs(detectedLanguages, userConfigs);

    // 创建服务器句柄
    for (const config of serverConfigs) {
      this.serverHandles.set(config.name, {
        config,
        status: 'NOT_STARTED' as LspServerStatus,
      });
    }
  }

  /**
   * 启动所有 LSP 服务器
   */
  async start(): Promise<void> {
    for (const [name, handle] of Array.from(this.serverHandles)) {
      await this.startServer(name, handle);
    }
  }

  /**
   * 停止所有 LSP 服务器
   */
  async stop(): Promise<void> {
    for (const [name, handle] of Array.from(this.serverHandles)) {
      await this.stopServer(name, handle);
    }
    this.serverHandles.clear();
  }

  /**
   * 获取 LSP 服务器状态
   */
  getStatus(): Map<string, LspServerStatus> {
    const statusMap = new Map<string, LspServerStatus>();
    for (const [name, handle] of Array.from(this.serverHandles)) {
      statusMap.set(name, handle.status);
    }
    return statusMap;
  }

  /**
   * Workspace symbol search across all ready LSP servers.
   */
  async workspaceSymbols(
    query: string,
    limit = 50,
  ): Promise<LspSymbolInformation[]> {
    const results: LspSymbolInformation[] = [];

    for (const [serverName, handle] of Array.from(this.serverHandles)) {
      if (handle.status !== 'READY' || !handle.connection) {
        continue;
      }
      try {
        await this.warmupTypescriptServer(handle);
        let response = await handle.connection.request('workspace/symbol', {
          query,
        });
        if (
          this.isTypescriptServer(handle) &&
          this.isNoProjectErrorResponse(response)
        ) {
          await this.warmupTypescriptServer(handle, true);
          response = await handle.connection.request('workspace/symbol', {
            query,
          });
        }
        if (!Array.isArray(response)) {
          continue;
        }
        for (const item of response) {
          const symbol = this.normalizeSymbolResult(item, serverName);
          if (symbol) {
            results.push(symbol);
          }
          if (results.length >= limit) {
            return results.slice(0, limit);
          }
        }
      } catch (error) {
        console.warn(`LSP workspace/symbol failed for ${serverName}:`, error);
      }
    }

    return results.slice(0, limit);
  }

  /**
   * 跳转到定义
   */
  async definitions(
    location: LspLocation,
    serverName?: string,
    limit = 50,
  ): Promise<LspDefinition[]> {
    const handles = Array.from(this.serverHandles.entries()).filter(
      ([name, handle]) =>
        handle.status === 'READY' &&
        handle.connection &&
        (!serverName || name === serverName),
    );

    for (const [name, handle] of handles) {
      if (!handle.connection) {
        continue;
      }
      try {
        await this.warmupTypescriptServer(handle);
        await this.warmupTypescriptServer(handle);
        const response = await handle.connection.request(
          'textDocument/definition',
          {
            textDocument: { uri: location.uri },
            position: location.range.start,
          },
        );
        const candidates = Array.isArray(response)
          ? response
          : response
            ? [response]
            : [];
        const definitions: LspDefinition[] = [];
        for (const def of candidates) {
          const normalized = this.normalizeLocationResult(def, name);
          if (normalized) {
            definitions.push(normalized);
            if (definitions.length >= limit) {
              return definitions.slice(0, limit);
            }
          }
        }
        if (definitions.length > 0) {
          return definitions.slice(0, limit);
        }
      } catch (error) {
        console.warn(`LSP textDocument/definition failed for ${name}:`, error);
      }
    }

    return [];
  }

  /**
   * 查找引用
   */
  async references(
    location: LspLocation,
    serverName?: string,
    includeDeclaration = false,
    limit = 200,
  ): Promise<LspReference[]> {
    const handles = Array.from(this.serverHandles.entries()).filter(
      ([name, handle]) =>
        handle.status === 'READY' &&
        handle.connection &&
        (!serverName || name === serverName),
    );

    for (const [name, handle] of handles) {
      if (!handle.connection) {
        continue;
      }
      try {
        await this.warmupTypescriptServer(handle);
        await this.warmupTypescriptServer(handle);
        const response = await handle.connection.request(
          'textDocument/references',
          {
            textDocument: { uri: location.uri },
            position: location.range.start,
            context: { includeDeclaration },
          },
        );
        if (!Array.isArray(response)) {
          continue;
        }
        const refs: LspReference[] = [];
        for (const ref of response) {
          const normalized = this.normalizeLocationResult(ref, name);
          if (normalized) {
            refs.push(normalized);
          }
          if (refs.length >= limit) {
            return refs.slice(0, limit);
          }
        }
        if (refs.length > 0) {
          return refs.slice(0, limit);
        }
      } catch (error) {
        console.warn(`LSP textDocument/references failed for ${name}:`, error);
      }
    }

    return [];
  }

  /**
   * 获取悬停信息
   */
  async hover(
    location: LspLocation,
    serverName?: string,
  ): Promise<LspHoverResult | null> {
    const handles = Array.from(this.serverHandles.entries()).filter(
      ([name, handle]) =>
        handle.status === 'READY' &&
        handle.connection &&
        (!serverName || name === serverName),
    );

    for (const [name, handle] of handles) {
      if (!handle.connection) {
        continue;
      }
      try {
        await this.warmupTypescriptServer(handle);
        const response = await handle.connection.request('textDocument/hover', {
          textDocument: { uri: location.uri },
          position: location.range.start,
        });
        const normalized = this.normalizeHoverResult(response, name);
        if (normalized) {
          return normalized;
        }
      } catch (error) {
        console.warn(`LSP textDocument/hover failed for ${name}:`, error);
      }
    }

    return null;
  }

  /**
   * 获取文档符号
   */
  async documentSymbols(
    uri: string,
    serverName?: string,
    limit = 200,
  ): Promise<LspSymbolInformation[]> {
    const handles = Array.from(this.serverHandles.entries()).filter(
      ([name, handle]) =>
        handle.status === 'READY' &&
        handle.connection &&
        (!serverName || name === serverName),
    );

    for (const [name, handle] of handles) {
      if (!handle.connection) {
        continue;
      }
      try {
        await this.warmupTypescriptServer(handle);
        const response = await handle.connection.request(
          'textDocument/documentSymbol',
          {
            textDocument: { uri },
          },
        );
        if (!Array.isArray(response)) {
          continue;
        }
        const symbols: LspSymbolInformation[] = [];
        for (const item of response) {
          if (!item || typeof item !== 'object') {
            continue;
          }
          const itemObj = item as Record<string, unknown>;
          if (this.isDocumentSymbol(itemObj)) {
            this.collectDocumentSymbol(itemObj, uri, name, symbols, limit);
          } else {
            const normalized = this.normalizeSymbolResult(itemObj, name);
            if (normalized) {
              symbols.push(normalized);
            }
          }
          if (symbols.length >= limit) {
            return symbols.slice(0, limit);
          }
        }
        if (symbols.length > 0) {
          return symbols.slice(0, limit);
        }
      } catch (error) {
        console.warn(
          `LSP textDocument/documentSymbol failed for ${name}:`,
          error,
        );
      }
    }

    return [];
  }

  /**
   * 查找实现
   */
  async implementations(
    location: LspLocation,
    serverName?: string,
    limit = 50,
  ): Promise<LspDefinition[]> {
    const handles = Array.from(this.serverHandles.entries()).filter(
      ([name, handle]) =>
        handle.status === 'READY' &&
        handle.connection &&
        (!serverName || name === serverName),
    );

    for (const [name, handle] of handles) {
      if (!handle.connection) {
        continue;
      }
      try {
        await this.warmupTypescriptServer(handle);
        const response = await handle.connection.request(
          'textDocument/implementation',
          {
            textDocument: { uri: location.uri },
            position: location.range.start,
          },
        );
        const candidates = Array.isArray(response)
          ? response
          : response
            ? [response]
            : [];
        const implementations: LspDefinition[] = [];
        for (const item of candidates) {
          const normalized = this.normalizeLocationResult(item, name);
          if (normalized) {
            implementations.push(normalized);
            if (implementations.length >= limit) {
              return implementations.slice(0, limit);
            }
          }
        }
        if (implementations.length > 0) {
          return implementations.slice(0, limit);
        }
      } catch (error) {
        console.warn(
          `LSP textDocument/implementation failed for ${name}:`,
          error,
        );
      }
    }

    return [];
  }

  /**
   * 准备调用层级
   */
  async prepareCallHierarchy(
    location: LspLocation,
    serverName?: string,
    limit = 50,
  ): Promise<LspCallHierarchyItem[]> {
    const handles = Array.from(this.serverHandles.entries()).filter(
      ([name, handle]) =>
        handle.status === 'READY' &&
        handle.connection &&
        (!serverName || name === serverName),
    );

    for (const [name, handle] of handles) {
      if (!handle.connection) {
        continue;
      }
      try {
        await this.warmupTypescriptServer(handle);
        const response = await handle.connection.request(
          'textDocument/prepareCallHierarchy',
          {
            textDocument: { uri: location.uri },
            position: location.range.start,
          },
        );
        const candidates = Array.isArray(response)
          ? response
          : response
            ? [response]
            : [];
        const items: LspCallHierarchyItem[] = [];
        for (const item of candidates) {
          const normalized = this.normalizeCallHierarchyItem(item, name);
          if (normalized) {
            items.push(normalized);
            if (items.length >= limit) {
              return items.slice(0, limit);
            }
          }
        }
        if (items.length > 0) {
          return items.slice(0, limit);
        }
      } catch (error) {
        console.warn(
          `LSP textDocument/prepareCallHierarchy failed for ${name}:`,
          error,
        );
      }
    }

    return [];
  }

  /**
   * 查找调用当前函数的调用者
   */
  async incomingCalls(
    item: LspCallHierarchyItem,
    serverName?: string,
    limit = 50,
  ): Promise<LspCallHierarchyIncomingCall[]> {
    const targetServer = serverName ?? item.serverName;
    const handles = Array.from(this.serverHandles.entries()).filter(
      ([name, handle]) =>
        handle.status === 'READY' &&
        handle.connection &&
        (!targetServer || name === targetServer),
    );

    for (const [name, handle] of handles) {
      if (!handle.connection) {
        continue;
      }
      try {
        await this.warmupTypescriptServer(handle);
        const response = await handle.connection.request(
          'callHierarchy/incomingCalls',
          {
            item: this.toCallHierarchyItemParams(item),
          },
        );
        if (!Array.isArray(response)) {
          continue;
        }
        const calls: LspCallHierarchyIncomingCall[] = [];
        for (const call of response) {
          const normalized = this.normalizeIncomingCall(call, name);
          if (normalized) {
            calls.push(normalized);
            if (calls.length >= limit) {
              return calls.slice(0, limit);
            }
          }
        }
        if (calls.length > 0) {
          return calls.slice(0, limit);
        }
      } catch (error) {
        console.warn(
          `LSP callHierarchy/incomingCalls failed for ${name}:`,
          error,
        );
      }
    }

    return [];
  }

  /**
   * 查找当前函数调用的目标
   */
  async outgoingCalls(
    item: LspCallHierarchyItem,
    serverName?: string,
    limit = 50,
  ): Promise<LspCallHierarchyOutgoingCall[]> {
    const targetServer = serverName ?? item.serverName;
    const handles = Array.from(this.serverHandles.entries()).filter(
      ([name, handle]) =>
        handle.status === 'READY' &&
        handle.connection &&
        (!targetServer || name === targetServer),
    );

    for (const [name, handle] of handles) {
      if (!handle.connection) {
        continue;
      }
      try {
        await this.warmupTypescriptServer(handle);
        const response = await handle.connection.request(
          'callHierarchy/outgoingCalls',
          {
            item: this.toCallHierarchyItemParams(item),
          },
        );
        if (!Array.isArray(response)) {
          continue;
        }
        const calls: LspCallHierarchyOutgoingCall[] = [];
        for (const call of response) {
          const normalized = this.normalizeOutgoingCall(call, name);
          if (normalized) {
            calls.push(normalized);
            if (calls.length >= limit) {
              return calls.slice(0, limit);
            }
          }
        }
        if (calls.length > 0) {
          return calls.slice(0, limit);
        }
      } catch (error) {
        console.warn(
          `LSP callHierarchy/outgoingCalls failed for ${name}:`,
          error,
        );
      }
    }

    return [];
  }

  /**
   * 检测工作区中的编程语言
   */
  private async detectLanguages(
    extensionOverrides: Record<string, string> = {},
  ): Promise<string[]> {
    const extensionMap = this.getExtensionToLanguageMap(extensionOverrides);
    const extensions = Object.keys(extensionMap);
    const patterns =
      extensions.length > 0 ? [`**/*.{${extensions.join(',')}}`] : ['**/*'];
    const excludePatterns = [
      '**/node_modules/**',
      '**/.git/**',
      '**/dist/**',
      '**/build/**',
    ];

    const files = new Set<string>();
    const searchRoots = this.workspaceContext.getDirectories();

    for (const root of searchRoots) {
      for (const pattern of patterns) {
        try {
          const matches = globSync(pattern, {
            cwd: root,
            ignore: excludePatterns,
            absolute: true,
            nodir: true,
          });

          for (const match of matches) {
            if (this.fileDiscoveryService.shouldIgnoreFile(match)) {
              continue;
            }
            files.add(match);
          }
        } catch (_error) {
          // Ignore glob errors for missing/invalid directories
        }
      }
    }

    // 统计不同语言的文件数量
    const languageCounts = new Map<string, number>();
    for (const file of Array.from(files)) {
      const ext = path.extname(file).slice(1).toLowerCase();
      if (ext) {
        const lang = this.mapExtensionToLanguage(ext, extensionMap);
        if (lang) {
          languageCounts.set(lang, (languageCounts.get(lang) || 0) + 1);
        }
      }
    }

    // 也可以通过特定的配置文件来检测语言
    const rootMarkers = await this.detectRootMarkers();
    for (const marker of rootMarkers) {
      const lang = this.mapMarkerToLanguage(marker);
      if (lang) {
        // 使用安全的数字操作避免 NaN
        const currentCount = languageCounts.get(lang) || 0;
        languageCounts.set(lang, currentCount + 100); // 给配置文件更高的权重
      }
    }

    // 返回检测到的语言，按数量排序
    return Array.from(languageCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([lang]) => lang);
  }

  /**
   * 检测根目录标记文件
   */
  private async detectRootMarkers(): Promise<string[]> {
    const markers = new Set<string>();
    const commonMarkers = [
      'package.json',
      'tsconfig.json',
      'pyproject.toml',
      'go.mod',
      'Cargo.toml',
      'pom.xml',
      'build.gradle',
      'composer.json',
      'Gemfile',
      'mix.exs',
      'deno.json',
    ];

    for (const root of this.workspaceContext.getDirectories()) {
      for (const marker of commonMarkers) {
        try {
          const fullPath = path.join(root, marker);
          if (fs.existsSync(fullPath)) {
            markers.add(marker);
          }
        } catch (_error) {
          // ignore missing files
        }
      }
    }

    return Array.from(markers);
  }

  /**
   * 将文件扩展名映射到编程语言
   */
  private mapExtensionToLanguage(
    ext: string,
    extensionMap: Record<string, string>,
  ): string | null {
    return extensionMap[ext] || null;
  }

  private getExtensionToLanguageMap(
    extensionOverrides: Record<string, string> = {},
  ): Record<string, string> {
    const extToLang: Record<string, string> = {
      js: 'javascript',
      ts: 'typescript',
      jsx: 'javascriptreact',
      tsx: 'typescriptreact',
      py: 'python',
      go: 'go',
      rs: 'rust',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
      php: 'php',
      rb: 'ruby',
      cs: 'csharp',
      vue: 'vue',
      svelte: 'svelte',
      html: 'html',
      css: 'css',
      json: 'json',
      yaml: 'yaml',
      yml: 'yaml',
    };

    for (const [key, value] of Object.entries(extensionOverrides)) {
      const normalized = key.startsWith('.') ? key.slice(1) : key;
      if (!normalized) {
        continue;
      }
      extToLang[normalized.toLowerCase()] = value;
    }

    return extToLang;
  }

  private collectExtensionToLanguageOverrides(
    configs: LspServerConfig[],
  ): Record<string, string> {
    const overrides: Record<string, string> = {};
    for (const config of configs) {
      if (!config.extensionToLanguage) {
        continue;
      }
      for (const [key, value] of Object.entries(config.extensionToLanguage)) {
        if (typeof value !== 'string') {
          continue;
        }
        const normalized = key.startsWith('.') ? key.slice(1) : key;
        if (!normalized) {
          continue;
        }
        overrides[normalized.toLowerCase()] = value;
      }
    }
    return overrides;
  }

  /**
   * 将根目录标记映射到编程语言
   */
  private mapMarkerToLanguage(marker: string): string | null {
    const markerToLang: { [key: string]: string } = {
      'package.json': 'javascript',
      'tsconfig.json': 'typescript',
      'pyproject.toml': 'python',
      'go.mod': 'go',
      'Cargo.toml': 'rust',
      'pom.xml': 'java',
      'build.gradle': 'java',
      'composer.json': 'php',
      Gemfile: 'ruby',
      '*.sln': 'csharp',
      'mix.exs': 'elixir',
      'deno.json': 'deno',
    };

    return markerToLang[marker] || null;
  }

  private normalizeLocationResult(
    item: unknown,
    serverName: string,
  ): LspReference | null {
    if (!item || typeof item !== 'object') {
      return null;
    }

    const itemObj = item as Record<string, unknown>;
    const uri = (itemObj['uri'] ??
      itemObj['targetUri'] ??
      (itemObj['target'] as Record<string, unknown>)?.['uri']) as
      | string
      | undefined;

    const range = (itemObj['range'] ??
      itemObj['targetSelectionRange'] ??
      itemObj['targetRange'] ??
      (itemObj['target'] as Record<string, unknown>)?.['range']) as
      | { start?: unknown; end?: unknown }
      | undefined;

    if (!uri || !range?.start || !range?.end) {
      return null;
    }

    const start = range.start as { line?: number; character?: number };
    const end = range.end as { line?: number; character?: number };

    return {
      uri,
      range: {
        start: {
          line: Number(start?.line ?? 0),
          character: Number(start?.character ?? 0),
        },
        end: {
          line: Number(end?.line ?? 0),
          character: Number(end?.character ?? 0),
        },
      },
      serverName,
    };
  }

  private normalizeSymbolResult(
    item: unknown,
    serverName: string,
  ): LspSymbolInformation | null {
    if (!item || typeof item !== 'object') {
      return null;
    }

    const itemObj = item as Record<string, unknown>;
    const location = itemObj['location'] ?? itemObj['target'] ?? item;
    if (!location || typeof location !== 'object') {
      return null;
    }

    const locationObj = location as Record<string, unknown>;
    const range = (locationObj['range'] ??
      locationObj['targetRange'] ??
      itemObj['range'] ??
      undefined) as { start?: unknown; end?: unknown } | undefined;

    if (!locationObj['uri'] || !range?.start || !range?.end) {
      return null;
    }

    const start = range.start as { line?: number; character?: number };
    const end = range.end as { line?: number; character?: number };

    return {
      name: (itemObj['name'] ?? itemObj['label'] ?? 'symbol') as string,
      kind: this.normalizeSymbolKind(itemObj['kind']),
      containerName: (itemObj['containerName'] ?? itemObj['container']) as
        | string
        | undefined,
      location: {
        uri: locationObj['uri'] as string,
        range: {
          start: {
            line: Number(start?.line ?? 0),
            character: Number(start?.character ?? 0),
          },
          end: {
            line: Number(end?.line ?? 0),
            character: Number(end?.character ?? 0),
          },
        },
      },
      serverName,
    };
  }

  private normalizeRange(range: unknown): LspRange | null {
    if (!range || typeof range !== 'object') {
      return null;
    }

    const rangeObj = range as Record<string, unknown>;
    const start = rangeObj['start'];
    const end = rangeObj['end'];

    if (
      !start ||
      typeof start !== 'object' ||
      !end ||
      typeof end !== 'object'
    ) {
      return null;
    }

    const startObj = start as Record<string, unknown>;
    const endObj = end as Record<string, unknown>;

    return {
      start: {
        line: Number(startObj['line'] ?? 0),
        character: Number(startObj['character'] ?? 0),
      },
      end: {
        line: Number(endObj['line'] ?? 0),
        character: Number(endObj['character'] ?? 0),
      },
    };
  }

  private normalizeRanges(ranges: unknown): LspRange[] {
    if (!Array.isArray(ranges)) {
      return [];
    }

    const results: LspRange[] = [];
    for (const range of ranges) {
      const normalized = this.normalizeRange(range);
      if (normalized) {
        results.push(normalized);
      }
    }

    return results;
  }

  private normalizeSymbolKind(kind: unknown): string | undefined {
    if (typeof kind === 'number') {
      return SYMBOL_KIND_LABELS[kind] ?? String(kind);
    }
    if (typeof kind === 'string') {
      const trimmed = kind.trim();
      if (trimmed === '') {
        return undefined;
      }
      const numeric = Number(trimmed);
      if (Number.isFinite(numeric) && SYMBOL_KIND_LABELS[numeric]) {
        return SYMBOL_KIND_LABELS[numeric];
      }
      return trimmed;
    }
    return undefined;
  }

  private normalizeHoverContents(contents: unknown): string {
    if (!contents) {
      return '';
    }
    if (typeof contents === 'string') {
      return contents;
    }
    if (Array.isArray(contents)) {
      const parts = contents
        .map((item) => this.normalizeHoverContents(item))
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
      return parts.join('\n');
    }
    if (typeof contents === 'object') {
      const contentsObj = contents as Record<string, unknown>;
      const value = contentsObj['value'];
      if (typeof value === 'string') {
        const language = contentsObj['language'];
        if (typeof language === 'string' && language.trim() !== '') {
          return `\`\`\`${language}\n${value}\n\`\`\``;
        }
        return value;
      }
    }
    return '';
  }

  private normalizeHoverResult(
    response: unknown,
    serverName: string,
  ): LspHoverResult | null {
    if (!response) {
      return null;
    }
    if (typeof response !== 'object') {
      const contents = this.normalizeHoverContents(response);
      if (!contents.trim()) {
        return null;
      }
      return {
        contents,
        serverName,
      };
    }

    const responseObj = response as Record<string, unknown>;
    const contents = this.normalizeHoverContents(responseObj['contents']);
    if (!contents.trim()) {
      return null;
    }

    const range = this.normalizeRange(responseObj['range']);
    return {
      contents,
      range: range ?? undefined,
      serverName,
    };
  }

  private normalizeCallHierarchyItem(
    item: unknown,
    serverName: string,
  ): LspCallHierarchyItem | null {
    if (!item || typeof item !== 'object') {
      return null;
    }

    const itemObj = item as Record<string, unknown>;
    const nameValue = itemObj['name'] ?? itemObj['label'] ?? 'symbol';
    const name =
      typeof nameValue === 'string' ? nameValue : String(nameValue ?? '');
    const uri = itemObj['uri'];

    if (!name || typeof uri !== 'string') {
      return null;
    }

    const range = this.normalizeRange(itemObj['range']);
    const selectionRange =
      this.normalizeRange(itemObj['selectionRange']) ?? range;

    if (!range || !selectionRange) {
      return null;
    }

    const serverOverride =
      typeof itemObj['serverName'] === 'string'
        ? (itemObj['serverName'] as string)
        : undefined;

    // Preserve raw numeric kind for server communication
    // Priority: rawKind field > numeric kind > parsed numeric string
    let rawKind: number | undefined;
    if (typeof itemObj['rawKind'] === 'number') {
      rawKind = itemObj['rawKind'];
    } else if (typeof itemObj['kind'] === 'number') {
      rawKind = itemObj['kind'];
    } else if (typeof itemObj['kind'] === 'string') {
      const parsed = Number(itemObj['kind']);
      if (Number.isFinite(parsed)) {
        rawKind = parsed;
      }
    }

    return {
      name,
      kind: this.normalizeSymbolKind(itemObj['kind']),
      rawKind,
      detail:
        typeof itemObj['detail'] === 'string'
          ? (itemObj['detail'] as string)
          : undefined,
      uri,
      range,
      selectionRange,
      data: itemObj['data'],
      serverName: serverOverride ?? serverName,
    };
  }

  private normalizeIncomingCall(
    item: unknown,
    serverName: string,
  ): LspCallHierarchyIncomingCall | null {
    if (!item || typeof item !== 'object') {
      return null;
    }
    const itemObj = item as Record<string, unknown>;
    const from = this.normalizeCallHierarchyItem(itemObj['from'], serverName);
    if (!from) {
      return null;
    }
    return {
      from,
      fromRanges: this.normalizeRanges(itemObj['fromRanges']),
    };
  }

  private normalizeOutgoingCall(
    item: unknown,
    serverName: string,
  ): LspCallHierarchyOutgoingCall | null {
    if (!item || typeof item !== 'object') {
      return null;
    }
    const itemObj = item as Record<string, unknown>;
    const to = this.normalizeCallHierarchyItem(itemObj['to'], serverName);
    if (!to) {
      return null;
    }
    return {
      to,
      fromRanges: this.normalizeRanges(itemObj['fromRanges']),
    };
  }

  private toCallHierarchyItemParams(
    item: LspCallHierarchyItem,
  ): Record<string, unknown> {
    // Use rawKind (numeric) for server communication, fallback to parsing kind string
    let numericKind: number | undefined = item.rawKind;
    if (numericKind === undefined && item.kind !== undefined) {
      const parsed = Number(item.kind);
      if (Number.isFinite(parsed)) {
        numericKind = parsed;
      }
    }

    return {
      name: item.name,
      kind: numericKind,
      detail: item.detail,
      uri: item.uri,
      range: item.range,
      selectionRange: item.selectionRange,
      data: item.data,
    };
  }

  private isDocumentSymbol(item: Record<string, unknown>): boolean {
    const range = item['range'];
    const selectionRange = item['selectionRange'];
    return (
      typeof range === 'object' &&
      range !== null &&
      typeof selectionRange === 'object' &&
      selectionRange !== null
    );
  }

  private collectDocumentSymbol(
    item: Record<string, unknown>,
    uri: string,
    serverName: string,
    results: LspSymbolInformation[],
    limit: number,
    containerName?: string,
  ): void {
    if (results.length >= limit) {
      return;
    }

    const nameValue = item['name'] ?? item['label'] ?? 'symbol';
    const name = typeof nameValue === 'string' ? nameValue : String(nameValue);
    const selectionRange =
      this.normalizeRange(item['selectionRange']) ??
      this.normalizeRange(item['range']);

    if (!selectionRange) {
      return;
    }

    results.push({
      name,
      kind: this.normalizeSymbolKind(item['kind']),
      containerName,
      location: {
        uri,
        range: selectionRange,
      },
      serverName,
    });

    if (results.length >= limit) {
      return;
    }

    const children = item['children'];
    if (Array.isArray(children)) {
      for (const child of children) {
        if (results.length >= limit) {
          break;
        }
        if (child && typeof child === 'object') {
          this.collectDocumentSymbol(
            child as Record<string, unknown>,
            uri,
            serverName,
            results,
            limit,
            name,
          );
        }
      }
    }
  }

  /**
   * 合并配置：内置预设 + 用户配置 + 兼容层
   */
  private mergeConfigs(
    detectedLanguages: string[],
    userConfigs: LspServerConfig[],
  ): LspServerConfig[] {
    // 内置预设配置
    const presets = this.getBuiltInPresets(detectedLanguages);

    // 合并配置，用户配置优先级更高
    const mergedConfigs = [...presets];

    for (const userConfig of userConfigs) {
      // 查找是否有同名的预设配置，如果有则替换
      const existingIndex = mergedConfigs.findIndex(
        (c) => c.name === userConfig.name,
      );
      if (existingIndex !== -1) {
        mergedConfigs[existingIndex] = userConfig;
      } else {
        mergedConfigs.push(userConfig);
      }
    }

    return mergedConfigs;
  }

  /**
   * 获取内置预设配置
   */
  private getBuiltInPresets(detectedLanguages: string[]): LspServerConfig[] {
    const presets: LspServerConfig[] = [];

    // 将目录路径转换为文件 URI 格式
    const rootUri = pathToFileURL(this.workspaceRoot).toString();

    // 根据检测到的语言生成对应的 LSP 服务器配置
    if (
      detectedLanguages.includes('typescript') ||
      detectedLanguages.includes('javascript')
    ) {
      presets.push({
        name: 'typescript-language-server',
        languages: [
          'typescript',
          'javascript',
          'typescriptreact',
          'javascriptreact',
        ],
        command: 'typescript-language-server',
        args: ['--stdio'],
        transport: 'stdio',
        initializationOptions: {},
        rootUri,
        workspaceFolder: this.workspaceRoot,
        trustRequired: true,
      });
    }

    if (detectedLanguages.includes('python')) {
      presets.push({
        name: 'pylsp',
        languages: ['python'],
        command: 'pylsp',
        args: [],
        transport: 'stdio',
        initializationOptions: {},
        rootUri,
        workspaceFolder: this.workspaceRoot,
        trustRequired: true,
      });
    }

    if (detectedLanguages.includes('go')) {
      presets.push({
        name: 'gopls',
        languages: ['go'],
        command: 'gopls',
        args: [],
        transport: 'stdio',
        initializationOptions: {},
        rootUri,
        workspaceFolder: this.workspaceRoot,
        trustRequired: true,
      });
    }

    // 可以根据需要添加更多语言的预设配置

    return presets;
  }

  /**
   * 加载用户 .lsp.json 配置
   */
  private async loadUserConfigs(): Promise<LspServerConfig[]> {
    const configs: LspServerConfig[] = [];
    const sources: Array<{ origin: string; data: unknown }> = [];

    if (this.inlineServerConfigs) {
      sources.push({
        origin: 'settings.lsp.languageServers',
        data: this.inlineServerConfigs,
      });
    }

    const lspConfigPath = path.join(this.workspaceRoot, '.lsp.json');
    if (fs.existsSync(lspConfigPath)) {
      try {
        const configContent = fs.readFileSync(lspConfigPath, 'utf-8');
        sources.push({
          origin: lspConfigPath,
          data: JSON.parse(configContent),
        });
      } catch (e) {
        console.warn('加载用户 .lsp.json 配置失败:', e);
      }
    }

    for (const source of sources) {
      const parsed = this.parseConfigSource(source.data, source.origin);
      if (parsed.usedLegacyFormat && parsed.configs.length > 0) {
        this.warnLegacyConfig(source.origin);
      }
      configs.push(...parsed.configs);
    }

    return configs;
  }

  private parseConfigSource(
    source: unknown,
    origin: string,
  ): { configs: LspServerConfig[]; usedLegacyFormat: boolean } {
    if (!this.isRecord(source)) {
      return { configs: [], usedLegacyFormat: false };
    }

    const configs: LspServerConfig[] = [];
    let serverMap: Record<string, unknown> = source;
    let usedLegacyFormat = false;

    if (this.isRecord(source['languageServers'])) {
      serverMap = source['languageServers'] as Record<string, unknown>;
    } else if (this.isNewFormatServerMap(source)) {
      serverMap = source;
    } else {
      usedLegacyFormat = true;
    }

    for (const [key, spec] of Object.entries(serverMap)) {
      if (!this.isRecord(spec)) {
        continue;
      }

      const languagesValue = spec['languages'];
      const languages = usedLegacyFormat
        ? [key]
        : (this.normalizeStringArray(languagesValue) ??
          (typeof languagesValue === 'string' ? [languagesValue] : []));

      const name = usedLegacyFormat
        ? typeof spec['command'] === 'string'
          ? (spec['command'] as string)
          : key
        : key;

      const config = this.buildServerConfig(name, languages, spec, origin);
      if (config) {
        configs.push(config);
      }
    }

    return { configs, usedLegacyFormat };
  }

  private buildServerConfig(
    name: string,
    languages: string[],
    spec: Record<string, unknown>,
    origin: string,
  ): LspServerConfig | null {
    const transport = this.normalizeTransport(spec['transport']);
    const command =
      typeof spec['command'] === 'string'
        ? (spec['command'] as string)
        : undefined;
    const args = this.normalizeStringArray(spec['args']) ?? [];
    const env = this.normalizeEnv(spec['env']);
    const initializationOptions = this.isRecord(spec['initializationOptions'])
      ? (spec['initializationOptions'] as LspInitializationOptions)
      : undefined;
    const settings = this.isRecord(spec['settings'])
      ? (spec['settings'] as Record<string, unknown>)
      : undefined;
    const extensionToLanguage = this.normalizeExtensionToLanguage(
      spec['extensionToLanguage'],
    );
    const workspaceFolder = this.resolveWorkspaceFolder(
      spec['workspaceFolder'],
    );
    const rootUri = pathToFileURL(workspaceFolder).toString();
    const startupTimeout = this.normalizeTimeout(spec['startupTimeout']);
    const shutdownTimeout = this.normalizeTimeout(spec['shutdownTimeout']);
    const restartOnCrash =
      typeof spec['restartOnCrash'] === 'boolean'
        ? (spec['restartOnCrash'] as boolean)
        : undefined;
    const maxRestarts = this.normalizeMaxRestarts(spec['maxRestarts']);
    const trustRequired =
      typeof spec['trustRequired'] === 'boolean'
        ? (spec['trustRequired'] as boolean)
        : true;
    const socket = this.normalizeSocketOptions(spec);

    if (transport === 'stdio' && !command) {
      console.warn(`LSP config error in ${origin}: ${name} missing command`);
      return null;
    }

    if (transport !== 'stdio' && !socket) {
      console.warn(
        `LSP config error in ${origin}: ${name} missing socket info`,
      );
      return null;
    }

    return {
      name,
      languages,
      command,
      args,
      transport,
      env,
      initializationOptions,
      settings,
      extensionToLanguage,
      rootUri,
      workspaceFolder,
      startupTimeout,
      shutdownTimeout,
      restartOnCrash,
      maxRestarts,
      trustRequired,
      socket,
    };
  }

  private isNewFormatServerMap(value: Record<string, unknown>): boolean {
    return Object.values(value).some(
      (entry) => this.isRecord(entry) && this.isNewFormatServerSpec(entry),
    );
  }

  private isNewFormatServerSpec(value: Record<string, unknown>): boolean {
    return (
      Array.isArray(value['languages']) ||
      this.isRecord(value['extensionToLanguage']) ||
      this.isRecord(value['settings']) ||
      value['workspaceFolder'] !== undefined ||
      value['startupTimeout'] !== undefined ||
      value['shutdownTimeout'] !== undefined ||
      value['restartOnCrash'] !== undefined ||
      value['maxRestarts'] !== undefined ||
      this.isRecord(value['env']) ||
      value['socket'] !== undefined
    );
  }

  private warnLegacyConfig(origin: string): void {
    if (this.warnedLegacyConfig) {
      return;
    }
    console.warn(
      `Legacy LSP config detected in ${origin}. Please migrate to the languageServers format.`,
    );
    this.warnedLegacyConfig = true;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private normalizeStringArray(value: unknown): string[] | undefined {
    if (!Array.isArray(value)) {
      return undefined;
    }
    return value.filter((item): item is string => typeof item === 'string');
  }

  private normalizeEnv(value: unknown): Record<string, string> | undefined {
    if (!this.isRecord(value)) {
      return undefined;
    }
    const env: Record<string, string> = {};
    for (const [key, val] of Object.entries(value)) {
      if (
        typeof val === 'string' ||
        typeof val === 'number' ||
        typeof val === 'boolean'
      ) {
        env[key] = String(val);
      }
    }
    return Object.keys(env).length > 0 ? env : undefined;
  }

  private normalizeExtensionToLanguage(
    value: unknown,
  ): Record<string, string> | undefined {
    if (!this.isRecord(value)) {
      return undefined;
    }
    const mapping: Record<string, string> = {};
    for (const [key, lang] of Object.entries(value)) {
      if (typeof lang !== 'string') {
        continue;
      }
      const normalized = key.startsWith('.') ? key.slice(1) : key;
      if (!normalized) {
        continue;
      }
      mapping[normalized.toLowerCase()] = lang;
    }
    return Object.keys(mapping).length > 0 ? mapping : undefined;
  }

  private normalizeTransport(value: unknown): 'stdio' | 'tcp' | 'socket' {
    if (typeof value !== 'string') {
      return 'stdio';
    }
    const normalized = value.toLowerCase();
    if (normalized === 'tcp' || normalized === 'socket') {
      return normalized;
    }
    return 'stdio';
  }

  private normalizeTimeout(value: unknown): number | undefined {
    if (typeof value !== 'number') {
      return undefined;
    }
    if (!Number.isFinite(value) || value <= 0) {
      return undefined;
    }
    return value;
  }

  private normalizeMaxRestarts(value: unknown): number | undefined {
    if (typeof value !== 'number') {
      return undefined;
    }
    if (!Number.isFinite(value) || value < 0) {
      return undefined;
    }
    return value;
  }

  private normalizeSocketOptions(
    value: Record<string, unknown>,
  ): LspSocketOptions | undefined {
    const socketValue = value['socket'];
    if (typeof socketValue === 'string') {
      return { path: socketValue };
    }

    const source = this.isRecord(socketValue) ? socketValue : value;
    const host =
      typeof source['host'] === 'string'
        ? (source['host'] as string)
        : undefined;
    const pathValue =
      typeof source['path'] === 'string'
        ? (source['path'] as string)
        : typeof source['socketPath'] === 'string'
          ? (source['socketPath'] as string)
          : undefined;
    const portValue = source['port'];
    const port =
      typeof portValue === 'number'
        ? portValue
        : typeof portValue === 'string'
          ? Number(portValue)
          : undefined;

    const socket: LspSocketOptions = {};
    if (host) {
      socket.host = host;
    }
    if (Number.isFinite(port) && (port as number) > 0) {
      socket.port = port as number;
    }
    if (pathValue) {
      socket.path = pathValue;
    }

    if (!socket.path && !socket.port) {
      return undefined;
    }
    return socket;
  }

  private resolveWorkspaceFolder(value: unknown): string {
    if (typeof value !== 'string' || value.trim() === '') {
      return this.workspaceRoot;
    }

    const resolved = path.isAbsolute(value)
      ? path.resolve(value)
      : path.resolve(this.workspaceRoot, value);
    const root = path.resolve(this.workspaceRoot);

    if (resolved === root || resolved.startsWith(root + path.sep)) {
      return resolved;
    }

    console.warn(
      `LSP workspaceFolder must be within ${this.workspaceRoot}; using workspace root instead.`,
    );
    return this.workspaceRoot;
  }

  /**
   * 启动单个 LSP 服务器
   */
  private async startServer(
    name: string,
    handle: LspServerHandle,
  ): Promise<void> {
    if (handle.status === 'IN_PROGRESS') {
      return;
    }
    handle.stopRequested = false;

    if (this.isServerInList(this.excludedServers, handle.config)) {
      console.log(`LSP 服务器 ${name} 在排除列表中，跳过启动`);
      handle.status = 'FAILED';
      return;
    }

    if (
      this.allowedServers &&
      this.allowedServers.length > 0 &&
      !this.isServerInList(this.allowedServers, handle.config)
    ) {
      console.log(`LSP 服务器 ${name} 不在允许列表中，跳过启动`);
      handle.status = 'FAILED';
      return;
    }

    const workspaceTrusted = this.config.isTrustedFolder();
    if (
      (this.requireTrustedWorkspace || handle.config.trustRequired) &&
      !workspaceTrusted
    ) {
      console.log(`LSP 服务器 ${name} 需要受信任的工作区，跳过启动`);
      handle.status = 'FAILED';
      return;
    }

    // 请求用户确认
    const consent = await this.requestUserConsent(
      name,
      handle.config,
      workspaceTrusted,
    );
    if (!consent) {
      console.log(`用户拒绝启动 LSP 服务器 ${name}`);
      handle.status = 'FAILED';
      return;
    }

    // 检查命令是否存在
    if (handle.config.command) {
      const commandCwd = handle.config.workspaceFolder ?? this.workspaceRoot;
      if (
        !(await this.commandExists(
          handle.config.command,
          handle.config.env,
          commandCwd,
        ))
      ) {
        console.warn(
          `LSP 服务器 ${name} 的命令不存在: ${handle.config.command}`,
        );
        handle.status = 'FAILED';
        return;
      }

      // 检查路径安全性
      if (
        !this.isPathSafe(handle.config.command, this.workspaceRoot, commandCwd)
      ) {
        console.warn(
          `LSP 服务器 ${name} 的命令路径不安全: ${handle.config.command}`,
        );
        handle.status = 'FAILED';
        return;
      }
    }

    try {
      handle.error = undefined;
      handle.warmedUp = false;
      handle.status = 'IN_PROGRESS';

      // 创建 LSP 连接
      const connection = await this.createLspConnection(handle.config);
      handle.connection = connection.connection;
      handle.process = connection.process;

      // 初始化 LSP 服务器
      await this.initializeLspServer(connection, handle.config);

      handle.status = 'READY';
      this.attachRestartHandler(name, handle);
      console.log(`LSP 服务器 ${name} 启动成功`);
    } catch (error) {
      handle.status = 'FAILED';
      handle.error = error as Error;
      console.error(`LSP 服务器 ${name} 启动失败:`, error);
    }
  }

  /**
   * 停止单个 LSP 服务器
   */
  private async stopServer(
    name: string,
    handle: LspServerHandle,
  ): Promise<void> {
    handle.stopRequested = true;

    if (handle.connection) {
      try {
        await this.shutdownConnection(handle);
      } catch (error) {
        console.error(`关闭 LSP 服务器 ${name} 时出错:`, error);
      }
    } else if (handle.process && handle.process.exitCode === null) {
      handle.process.kill();
    }
    handle.connection = undefined;
    handle.process = undefined;
    handle.status = 'NOT_STARTED';
    handle.warmedUp = false;
    handle.restartAttempts = 0;
  }

  private isServerInList(
    list: string[] | undefined,
    config: LspServerConfig,
  ): boolean {
    if (!list || list.length === 0) {
      return false;
    }
    if (list.includes(config.name)) {
      return true;
    }
    if (config.command && list.includes(config.command)) {
      return true;
    }
    return false;
  }

  private async shutdownConnection(handle: LspServerHandle): Promise<void> {
    if (!handle.connection) {
      return;
    }
    try {
      const shutdownPromise = handle.connection.shutdown();
      if (typeof handle.config.shutdownTimeout === 'number') {
        await Promise.race([
          shutdownPromise,
          new Promise<void>((resolve) =>
            setTimeout(resolve, handle.config.shutdownTimeout),
          ),
        ]);
      } else {
        await shutdownPromise;
      }
    } finally {
      handle.connection.end();
    }
  }

  private attachRestartHandler(name: string, handle: LspServerHandle): void {
    if (!handle.process) {
      return;
    }
    handle.process.once('exit', (code) => {
      if (handle.stopRequested) {
        return;
      }
      if (!handle.config.restartOnCrash) {
        handle.status = 'FAILED';
        return;
      }
      const maxRestarts = handle.config.maxRestarts ?? DEFAULT_LSP_MAX_RESTARTS;
      if (maxRestarts <= 0) {
        handle.status = 'FAILED';
        return;
      }
      const attempts = handle.restartAttempts ?? 0;
      if (attempts >= maxRestarts) {
        console.warn(
          `LSP 服务器 ${name} 达到最大重启次数 (${maxRestarts})，停止重启`,
        );
        handle.status = 'FAILED';
        return;
      }
      handle.restartAttempts = attempts + 1;
      console.warn(
        `LSP 服务器 ${name} 退出 (code ${code ?? 'unknown'})，正在重启 (${handle.restartAttempts}/${maxRestarts})`,
      );
      this.resetHandle(handle);
      void this.startServer(name, handle);
    });
  }

  private resetHandle(handle: LspServerHandle): void {
    if (handle.connection) {
      handle.connection.end();
    }
    if (handle.process && handle.process.exitCode === null) {
      handle.process.kill();
    }
    handle.connection = undefined;
    handle.process = undefined;
    handle.status = 'NOT_STARTED';
    handle.error = undefined;
    handle.warmedUp = false;
    handle.stopRequested = false;
  }

  private buildProcessEnv(
    env: Record<string, string> | undefined,
  ): NodeJS.ProcessEnv | undefined {
    if (!env || Object.keys(env).length === 0) {
      return undefined;
    }
    return { ...process.env, ...env };
  }

  private async connectSocketWithRetry(
    socket: LspSocketOptions,
    timeoutMs: number,
  ): Promise<
    Awaited<ReturnType<typeof LspConnectionFactory.createSocketConnection>>
  > {
    const deadline = Date.now() + timeoutMs;
    let attempt = 0;
    while (true) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        throw new Error('LSP server connection timeout');
      }
      try {
        return await LspConnectionFactory.createSocketConnection(
          socket,
          remaining,
        );
      } catch (error) {
        attempt += 1;
        if (Date.now() >= deadline) {
          throw error;
        }
        const delay = Math.min(250 * attempt, 1000);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * 创建 LSP 连接
   */
  private async createLspConnection(config: LspServerConfig): Promise<{
    connection: LspConnectionInterface;
    process?: ChildProcess;
    shutdown: () => Promise<void>;
    exit: () => void;
    initialize: (params: unknown) => Promise<unknown>;
  }> {
    const workspaceFolder = config.workspaceFolder ?? this.workspaceRoot;
    const startupTimeout =
      config.startupTimeout ?? DEFAULT_LSP_STARTUP_TIMEOUT_MS;
    const env = this.buildProcessEnv(config.env);

    if (config.transport === 'stdio') {
      if (!config.command) {
        throw new Error('LSP stdio transport requires a command');
      }

      // 修复：使用 cwd 作为 cwd 而不是 rootUri
      const lspConnection = await LspConnectionFactory.createStdioConnection(
        config.command,
        config.args ?? [],
        { cwd: workspaceFolder, env },
        startupTimeout,
      );

      return {
        connection: lspConnection.connection as LspConnectionInterface,
        process: lspConnection.process as ChildProcess,
        shutdown: async () => {
          await lspConnection.connection.shutdown();
        },
        exit: () => {
          if (lspConnection.process && !lspConnection.process.killed) {
            (lspConnection.process as ChildProcess).kill();
          }
          lspConnection.connection.end();
        },
        initialize: async (params: unknown) =>
          lspConnection.connection.initialize(params),
      };
    } else if (config.transport === 'tcp' || config.transport === 'socket') {
      if (!config.socket) {
        throw new Error('LSP socket transport requires host/port or path');
      }

      let process: ChildProcess | undefined;
      if (config.command) {
        process = spawn(config.command, config.args ?? [], {
          cwd: workspaceFolder,
          env,
          stdio: 'ignore',
        });
        await new Promise<void>((resolve, reject) => {
          process?.once('spawn', () => resolve());
          process?.once('error', (error) => {
            reject(new Error(`Failed to spawn LSP server: ${error.message}`));
          });
        });
      }

      try {
        const lspConnection = await this.connectSocketWithRetry(
          config.socket,
          startupTimeout,
        );

        return {
          connection: lspConnection.connection as LspConnectionInterface,
          process,
          shutdown: async () => {
            await lspConnection.connection.shutdown();
          },
          exit: () => {
            lspConnection.connection.end();
          },
          initialize: async (params: unknown) =>
            lspConnection.connection.initialize(params),
        };
      } catch (error) {
        if (process && process.exitCode === null) {
          process.kill();
        }
        throw error;
      }
    } else {
      throw new Error(`Unsupported transport: ${config.transport}`);
    }
  }

  /**
   * 初始化 LSP 服务器
   */
  private async initializeLspServer(
    connection: Awaited<ReturnType<NativeLspService['createLspConnection']>>,
    config: LspServerConfig,
  ): Promise<void> {
    const workspaceFolderPath = config.workspaceFolder ?? this.workspaceRoot;
    const workspaceFolder = {
      name: path.basename(workspaceFolderPath) || workspaceFolderPath,
      uri: config.rootUri,
    };

    const initializeParams = {
      processId: process.pid,
      rootUri: config.rootUri,
      rootPath: workspaceFolderPath,
      workspaceFolders: [workspaceFolder],
      capabilities: {
        textDocument: {
          completion: { dynamicRegistration: true },
          hover: { dynamicRegistration: true },
          definition: { dynamicRegistration: true },
          references: { dynamicRegistration: true },
          documentSymbol: { dynamicRegistration: true },
          codeAction: { dynamicRegistration: true },
        },
        workspace: {
          workspaceFolders: { supported: true },
        },
      },
      initializationOptions: config.initializationOptions,
    };

    await connection.initialize(initializeParams);

    // Send initialized notification and workspace folders change to help servers (e.g. tsserver)
    // create projects in the correct workspace.
    connection.connection.send({
      jsonrpc: '2.0',
      method: 'initialized',
      params: {},
    });
    connection.connection.send({
      jsonrpc: '2.0',
      method: 'workspace/didChangeWorkspaceFolders',
      params: {
        event: {
          added: [workspaceFolder],
          removed: [],
        },
      },
    });

    if (config.settings && Object.keys(config.settings).length > 0) {
      connection.connection.send({
        jsonrpc: '2.0',
        method: 'workspace/didChangeConfiguration',
        params: {
          settings: config.settings,
        },
      });
    }

    // Warm up TypeScript server by opening a workspace file so it can create a project.
    if (
      config.name.includes('typescript') ||
      (config.command?.includes('typescript') ?? false)
    ) {
      try {
        const tsFile = this.findFirstTypescriptFile();
        if (tsFile) {
          const uri = pathToFileURL(tsFile).toString();
          const languageId = tsFile.endsWith('.tsx')
            ? 'typescriptreact'
            : 'typescript';
          const text = fs.readFileSync(tsFile, 'utf-8');
          connection.connection.send({
            jsonrpc: '2.0',
            method: 'textDocument/didOpen',
            params: {
              textDocument: {
                uri,
                languageId,
                version: 1,
                text,
              },
            },
          });
        }
      } catch (error) {
        console.warn('TypeScript LSP warm-up failed:', error);
      }
    }
  }

  /**
   * 检查命令是否存在
   */
  private async commandExists(
    command: string,
    env?: Record<string, string>,
    cwd?: string,
  ): Promise<boolean> {
    // 实现命令存在性检查
    return new Promise((resolve) => {
      let settled = false;
      const child = spawn(command, ['--version'], {
        stdio: ['ignore', 'ignore', 'ignore'],
        cwd: cwd ?? this.workspaceRoot,
        env: this.buildProcessEnv(env),
      });

      child.on('error', () => {
        settled = true;
        resolve(false);
      });

      child.on('exit', (code) => {
        if (settled) {
          return;
        }
        // 如果命令存在，通常会返回 0 或其他非错误码
        // 有些命令的 --version 选项可能返回非 0，但不会抛出错误
        resolve(code !== 127); // 127 通常表示命令不存在
      });

      // 设置超时，避免长时间等待
      setTimeout(() => {
        settled = true;
        child.kill();
        resolve(false);
      }, 2000);
    });
  }

  /**
   * 检查路径安全性
   */
  private isPathSafe(
    command: string,
    workspacePath: string,
    cwd?: string,
  ): boolean {
    // 检查命令是否在工作区路径内，或者是否在系统 PATH 中
    // 允许全局安装的命令（如在 PATH 中的命令）
    // 只阻止显式指定工作区外绝对路径的情况
    const resolvedWorkspacePath = path.resolve(workspacePath);
    const basePath = cwd ? path.resolve(cwd) : resolvedWorkspacePath;
    const resolvedPath = path.isAbsolute(command)
      ? path.resolve(command)
      : path.resolve(basePath, command);
    return (
      resolvedPath.startsWith(resolvedWorkspacePath + path.sep) ||
      resolvedPath === resolvedWorkspacePath
    );
  }

  /**
   * 请求用户确认启动 LSP 服务器
   */
  private async requestUserConsent(
    serverName: string,
    serverConfig: LspServerConfig,
    workspaceTrusted: boolean,
  ): Promise<boolean> {
    if (workspaceTrusted) {
      return true; // 在受信任工作区中自动允许
    }

    if (this.requireTrustedWorkspace || serverConfig.trustRequired) {
      console.log(
        `工作区未受信任，跳过 LSP 服务器 ${serverName} (${serverConfig.command ?? serverConfig.transport})`,
      );
      return false;
    }

    console.log(
      `未受信任的工作区，LSP 服务器 ${serverName} 标记为 trustRequired=false，将谨慎尝试启动`,
    );
    return true;
  }

  /**
   * Find a representative TypeScript/JavaScript file to warm up tsserver.
   */
  private findFirstTypescriptFile(): string | undefined {
    const patterns = ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'];
    const excludePatterns = [
      '**/node_modules/**',
      '**/.git/**',
      '**/dist/**',
      '**/build/**',
    ];

    for (const root of this.workspaceContext.getDirectories()) {
      for (const pattern of patterns) {
        try {
          const matches = globSync(pattern, {
            cwd: root,
            ignore: excludePatterns,
            absolute: true,
            nodir: true,
          });
          for (const file of matches) {
            if (this.fileDiscoveryService.shouldIgnoreFile(file)) {
              continue;
            }
            return file;
          }
        } catch (_error) {
          // ignore glob errors
        }
      }
    }

    return undefined;
  }

  private isTypescriptServer(handle: LspServerHandle): boolean {
    return (
      handle.config.name.includes('typescript') ||
      (handle.config.command?.includes('typescript') ?? false)
    );
  }

  private isNoProjectErrorResponse(response: unknown): boolean {
    if (!response) {
      return false;
    }
    const message =
      typeof response === 'string'
        ? response
        : typeof (response as Record<string, unknown>)['message'] === 'string'
          ? ((response as Record<string, unknown>)['message'] as string)
          : '';
    return message.includes('No Project');
  }

  /**
   * Ensure tsserver has at least one file open so navto/navtree requests succeed.
   */
  private async warmupTypescriptServer(
    handle: LspServerHandle,
    force = false,
  ): Promise<void> {
    if (!handle.connection || !this.isTypescriptServer(handle)) {
      return;
    }
    if (handle.warmedUp && !force) {
      return;
    }
    const tsFile = this.findFirstTypescriptFile();
    if (!tsFile) {
      return;
    }
    handle.warmedUp = true;
    const uri = pathToFileURL(tsFile).toString();
    const languageId = tsFile.endsWith('.tsx')
      ? 'typescriptreact'
      : tsFile.endsWith('.jsx')
        ? 'javascriptreact'
        : tsFile.endsWith('.js')
          ? 'javascript'
          : 'typescript';
    try {
      const text = fs.readFileSync(tsFile, 'utf-8');
      handle.connection.send({
        jsonrpc: '2.0',
        method: 'textDocument/didOpen',
        params: {
          textDocument: {
            uri,
            languageId,
            version: 1,
            text,
          },
        },
      });
      // Give tsserver a moment to build the project.
      await new Promise((resolve) => setTimeout(resolve, 150));
    } catch (error) {
      console.warn('TypeScript server warm-up failed:', error);
    }
  }
}
