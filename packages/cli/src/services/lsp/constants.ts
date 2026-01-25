/**
 * @license
 * Copyright 2025 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import type {
  LspCodeActionKind,
  LspDiagnosticSeverity,
} from '@qwen-code/qwen-code-core';

// ============================================================================
// Timeout Constants
// ============================================================================

/** Default timeout for LSP server startup in milliseconds */
export const DEFAULT_LSP_STARTUP_TIMEOUT_MS = 10000;

/** Default timeout for LSP requests in milliseconds */
export const DEFAULT_LSP_REQUEST_TIMEOUT_MS = 15000;

/** Default delay for TypeScript server warm-up in milliseconds */
export const DEFAULT_LSP_WARMUP_DELAY_MS = 150;

/** Default timeout for command existence check in milliseconds */
export const DEFAULT_LSP_COMMAND_CHECK_TIMEOUT_MS = 2000;

/** Default timeout for LSP server shutdown in milliseconds */
export const DEFAULT_LSP_SHUTDOWN_TIMEOUT_MS = 5000;

// ============================================================================
// Retry Constants
// ============================================================================

/** Default maximum number of server restart attempts */
export const DEFAULT_LSP_MAX_RESTARTS = 3;

/** Default initial delay between socket connection retries in milliseconds */
export const DEFAULT_LSP_SOCKET_RETRY_DELAY_MS = 250;

/** Default maximum delay between socket connection retries in milliseconds */
export const DEFAULT_LSP_SOCKET_MAX_RETRY_DELAY_MS = 1000;

// ============================================================================
// LSP Protocol Labels
// ============================================================================

/**
 * Symbol kind labels for converting numeric LSP SymbolKind to readable strings.
 * Based on the LSP specification:
 * https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/#symbolKind
 */
export const SYMBOL_KIND_LABELS: Record<number, string> = {
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

/**
 * Diagnostic severity labels for converting numeric LSP DiagnosticSeverity to readable strings.
 * Based on the LSP specification.
 */
export const DIAGNOSTIC_SEVERITY_LABELS: Record<number, LspDiagnosticSeverity> =
  {
    1: 'error',
    2: 'warning',
    3: 'information',
    4: 'hint',
  };

/**
 * Code action kind labels from LSP specification.
 */
export const CODE_ACTION_KIND_LABELS: Record<string, LspCodeActionKind> = {
  '': 'quickfix',
  quickfix: 'quickfix',
  refactor: 'refactor',
  'refactor.extract': 'refactor.extract',
  'refactor.inline': 'refactor.inline',
  'refactor.rewrite': 'refactor.rewrite',
  source: 'source',
  'source.organizeImports': 'source.organizeImports',
  'source.fixAll': 'source.fixAll',
};

// ============================================================================
// Language Detection
// ============================================================================

/**
 * Common root marker files that indicate project type/language.
 */
export const COMMON_ROOT_MARKERS = [
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
] as const;

/**
 * Mapping from root marker files to programming languages.
 */
export const MARKER_TO_LANGUAGE: Record<string, string> = {
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

/**
 * Default mapping from file extensions to language identifiers.
 */
export const DEFAULT_EXTENSION_TO_LANGUAGE: Record<string, string> = {
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

/**
 * Glob patterns to exclude when detecting languages.
 */
export const LANGUAGE_DETECTION_EXCLUDE_PATTERNS = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
] as const;

// ============================================================================
// Default Limits for LSP Operations
// ============================================================================

/** Default limit for workspace symbol search results */
export const DEFAULT_LSP_WORKSPACE_SYMBOL_LIMIT = 50;

/** Default limit for definition/implementation results */
export const DEFAULT_LSP_DEFINITION_LIMIT = 50;

/** Default limit for reference results */
export const DEFAULT_LSP_REFERENCE_LIMIT = 200;

/** Default limit for document symbol results */
export const DEFAULT_LSP_DOCUMENT_SYMBOL_LIMIT = 200;

/** Default limit for call hierarchy results */
export const DEFAULT_LSP_CALL_HIERARCHY_LIMIT = 50;

/** Default limit for diagnostics results */
export const DEFAULT_LSP_DIAGNOSTICS_LIMIT = 100;

/** Default limit for code action results */
export const DEFAULT_LSP_CODE_ACTION_LIMIT = 20;

/** Maximum number of files to scan during language detection */
export const DEFAULT_LSP_LANGUAGE_DETECTION_FILE_LIMIT = 1000;
