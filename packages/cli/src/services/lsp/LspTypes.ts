/**
 * @license
 * Copyright 2025 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * LSP Service Type Definitions
 *
 * Centralized type definitions for the LSP service modules.
 */

import type { ChildProcess } from 'node:child_process';

// ============================================================================
// LSP Initialization Options
// ============================================================================

/**
 * LSP server initialization options passed during the initialize request.
 */
export interface LspInitializationOptions {
  [key: string]: unknown;
}

// ============================================================================
// LSP Socket Options
// ============================================================================

/**
 * Socket connection options for TCP or Unix socket transport.
 */
export interface LspSocketOptions {
  /** Host address for TCP connections */
  host?: string;
  /** Port number for TCP connections */
  port?: number;
  /** Path for Unix socket connections */
  path?: string;
}

// ============================================================================
// LSP Server Configuration
// ============================================================================

/**
 * Configuration for an LSP server instance.
 */
export interface LspServerConfig {
  /** Unique name identifier for the server */
  name: string;
  /** List of languages this server handles */
  languages: string[];
  /** Command to start the server (required for stdio transport) */
  command?: string;
  /** Command line arguments */
  args?: string[];
  /** Transport type: stdio, tcp, or socket */
  transport: 'stdio' | 'tcp' | 'socket';
  /** Environment variables for the server process */
  env?: Record<string, string>;
  /** LSP initialization options */
  initializationOptions?: LspInitializationOptions;
  /** Server-specific settings */
  settings?: Record<string, unknown>;
  /** Custom file extension to language mappings */
  extensionToLanguage?: Record<string, string>;
  /** Root URI for the workspace */
  rootUri: string;
  /** Workspace folder path */
  workspaceFolder?: string;
  /** Startup timeout in milliseconds */
  startupTimeout?: number;
  /** Shutdown timeout in milliseconds */
  shutdownTimeout?: number;
  /** Whether to restart on crash */
  restartOnCrash?: boolean;
  /** Maximum number of restart attempts */
  maxRestarts?: number;
  /** Whether trusted workspace is required */
  trustRequired?: boolean;
  /** Socket connection options */
  socket?: LspSocketOptions;
}

// ============================================================================
// LSP JSON-RPC Message
// ============================================================================

/**
 * JSON-RPC message format for LSP communication.
 */
export interface JsonRpcMessage {
  jsonrpc: string;
  id?: number | string;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

// ============================================================================
// LSP Connection Interface
// ============================================================================

/**
 * Interface for LSP JSON-RPC connection.
 */
export interface LspConnectionInterface {
  /** Start listening on a readable stream */
  listen: (readable: NodeJS.ReadableStream) => void;
  /** Send a message to the server */
  send: (message: JsonRpcMessage) => void;
  /** Register a notification handler */
  onNotification: (handler: (notification: JsonRpcMessage) => void) => void;
  /** Register a request handler */
  onRequest: (handler: (request: JsonRpcMessage) => Promise<unknown>) => void;
  /** Send a request and wait for response */
  request: (method: string, params: unknown) => Promise<unknown>;
  /** Send initialize request */
  initialize: (params: unknown) => Promise<unknown>;
  /** Send shutdown request */
  shutdown: () => Promise<void>;
  /** End the connection */
  end: () => void;
}

// ============================================================================
// LSP Server Status
// ============================================================================

/**
 * Status of an LSP server instance.
 */
export type LspServerStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'READY'
  | 'FAILED';

// ============================================================================
// LSP Server Handle
// ============================================================================

/**
 * Handle for managing an LSP server instance.
 */
export interface LspServerHandle {
  /** Server configuration */
  config: LspServerConfig;
  /** Current status */
  status: LspServerStatus;
  /** Active connection to the server */
  connection?: LspConnectionInterface;
  /** Server process (for stdio transport) */
  process?: ChildProcess;
  /** Error that caused failure */
  error?: Error;
  /** Whether TypeScript server has been warmed up */
  warmedUp?: boolean;
  /** Whether stop was explicitly requested */
  stopRequested?: boolean;
  /** Number of restart attempts */
  restartAttempts?: number;
  /** Lock to prevent concurrent startup attempts */
  startingPromise?: Promise<void>;
}

// ============================================================================
// LSP Service Options
// ============================================================================

/**
 * Options for NativeLspService constructor.
 */
export interface NativeLspServiceOptions {
  /** Whether to require trusted workspace */
  requireTrustedWorkspace?: boolean;
  /** Override workspace root path */
  workspaceRoot?: string;
}

// ============================================================================
// LSP Connection Result
// ============================================================================

/**
 * Result from creating an LSP connection.
 */
export interface LspConnectionResult {
  /** The JSON-RPC connection */
  connection: LspConnectionInterface;
  /** Server process (for stdio transport) */
  process?: ChildProcess;
  /** Shutdown the connection gracefully */
  shutdown: () => Promise<void>;
  /** Force exit the connection */
  exit: () => void;
  /** Send initialize request */
  initialize: (params: unknown) => Promise<unknown>;
}
