/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

export interface LspPosition {
  line: number;
  character: number;
}

export interface LspRange {
  start: LspPosition;
  end: LspPosition;
}

export interface LspLocation {
  uri: string;
  range: LspRange;
}

export interface LspLocationWithServer extends LspLocation {
  serverName?: string;
}

export interface LspSymbolInformation {
  name: string;
  kind?: string;
  location: LspLocation;
  containerName?: string;
  serverName?: string;
}

export interface LspReference extends LspLocationWithServer {
  readonly serverName?: string;
}

export interface LspDefinition extends LspLocationWithServer {
  readonly serverName?: string;
}

/**
 * Hover result containing documentation or type information.
 */
export interface LspHoverResult {
  /** The hover content as a string (normalized from MarkupContent/MarkedString). */
  contents: string;
  /** Optional range that the hover applies to. */
  range?: LspRange;
  /** The LSP server that provided this result. */
  serverName?: string;
}

/**
 * Call hierarchy item representing a function, method, or callable.
 */
export interface LspCallHierarchyItem {
  /** The name of this item. */
  name: string;
  /** The kind of this item (function, method, constructor, etc.) as readable string. */
  kind?: string;
  /** The raw numeric SymbolKind from LSP, preserved for server communication. */
  rawKind?: number;
  /** Additional details like signature or file path. */
  detail?: string;
  /** The URI of the document containing this item. */
  uri: string;
  /** The full range of this item. */
  range: LspRange;
  /** The range that should be selected when navigating to this item. */
  selectionRange: LspRange;
  /** Opaque data used by the server for subsequent calls. */
  data?: unknown;
  /** The LSP server that provided this item. */
  serverName?: string;
}

/**
 * Incoming call representing a function that calls the target.
 */
export interface LspCallHierarchyIncomingCall {
  /** The caller item. */
  from: LspCallHierarchyItem;
  /** The ranges where the call occurs within the caller. */
  fromRanges: LspRange[];
}

/**
 * Outgoing call representing a function called by the target.
 */
export interface LspCallHierarchyOutgoingCall {
  /** The callee item. */
  to: LspCallHierarchyItem;
  /** The ranges where the call occurs within the caller. */
  fromRanges: LspRange[];
}

/**
 * Diagnostic severity levels from LSP specification.
 */
export type LspDiagnosticSeverity = 'error' | 'warning' | 'information' | 'hint';

/**
 * A diagnostic message from a language server.
 */
export interface LspDiagnostic {
  /** The range at which the diagnostic applies. */
  range: LspRange;
  /** The diagnostic's severity (error, warning, information, hint). */
  severity?: LspDiagnosticSeverity;
  /** The diagnostic's code (string or number). */
  code?: string | number;
  /** A human-readable string describing the source (e.g., 'typescript'). */
  source?: string;
  /** The diagnostic's message. */
  message: string;
  /** Additional metadata about the diagnostic. */
  tags?: LspDiagnosticTag[];
  /** Related diagnostic information. */
  relatedInformation?: LspDiagnosticRelatedInformation[];
  /** The LSP server that provided this diagnostic. */
  serverName?: string;
}

/**
 * Diagnostic tags from LSP specification.
 */
export type LspDiagnosticTag = 'unnecessary' | 'deprecated';

/**
 * Related diagnostic information.
 */
export interface LspDiagnosticRelatedInformation {
  /** The location of the related diagnostic. */
  location: LspLocation;
  /** The message of the related diagnostic. */
  message: string;
}

/**
 * A file's diagnostics grouped by URI.
 */
export interface LspFileDiagnostics {
  /** The document URI. */
  uri: string;
  /** The diagnostics for this document. */
  diagnostics: LspDiagnostic[];
  /** The LSP server that provided these diagnostics. */
  serverName?: string;
}

/**
 * A code action represents a change that can be performed in code.
 */
export interface LspCodeAction {
  /** A short, human-readable title for this code action. */
  title: string;
  /** The kind of the code action (quickfix, refactor, etc.). */
  kind?: LspCodeActionKind;
  /** The diagnostics that this code action resolves. */
  diagnostics?: LspDiagnostic[];
  /** Marks this as a preferred action. */
  isPreferred?: boolean;
  /** The workspace edit this code action performs. */
  edit?: LspWorkspaceEdit;
  /** A command this code action executes. */
  command?: LspCommand;
  /** Opaque data used by the server for subsequent resolve calls. */
  data?: unknown;
  /** The LSP server that provided this code action. */
  serverName?: string;
}

/**
 * Code action kinds from LSP specification.
 */
export type LspCodeActionKind =
  | 'quickfix'
  | 'refactor'
  | 'refactor.extract'
  | 'refactor.inline'
  | 'refactor.rewrite'
  | 'source'
  | 'source.organizeImports'
  | 'source.fixAll'
  | string;

/**
 * A workspace edit represents changes to many resources managed in the workspace.
 */
export interface LspWorkspaceEdit {
  /** Holds changes to existing documents. */
  changes?: Record<string, LspTextEdit[]>;
  /** Versioned document changes (more precise control). */
  documentChanges?: LspTextDocumentEdit[];
}

/**
 * A text edit applicable to a document.
 */
export interface LspTextEdit {
  /** The range of the text document to be manipulated. */
  range: LspRange;
  /** The string to be inserted (empty string for delete). */
  newText: string;
}

/**
 * Describes textual changes on a single text document.
 */
export interface LspTextDocumentEdit {
  /** The text document to change. */
  textDocument: {
    uri: string;
    version?: number | null;
  };
  /** The edits to be applied. */
  edits: LspTextEdit[];
}

/**
 * A command represents a reference to a command.
 */
export interface LspCommand {
  /** Title of the command. */
  title: string;
  /** The identifier of the actual command handler. */
  command: string;
  /** Arguments to the command handler. */
  arguments?: unknown[];
}

/**
 * Context for code action requests.
 */
export interface LspCodeActionContext {
  /** The diagnostics for which code actions are requested. */
  diagnostics: LspDiagnostic[];
  /** Requested kinds of code actions to return. */
  only?: LspCodeActionKind[];
  /** The reason why code actions were requested. */
  triggerKind?: 'invoked' | 'automatic';
}

export interface LspClient {
  /**
   * Search for symbols across the workspace.
   */
  workspaceSymbols(
    query: string,
    limit?: number,
  ): Promise<LspSymbolInformation[]>;

  /**
   * Get hover information (documentation, type info) for a symbol.
   */
  hover(
    location: LspLocation,
    serverName?: string,
  ): Promise<LspHoverResult | null>;

  /**
   * Get all symbols in a document.
   */
  documentSymbols(
    uri: string,
    serverName?: string,
    limit?: number,
  ): Promise<LspSymbolInformation[]>;

  /**
   * Find where a symbol is defined.
   */
  definitions(
    location: LspLocation,
    serverName?: string,
    limit?: number,
  ): Promise<LspDefinition[]>;

  /**
   * Find implementations of an interface or abstract method.
   */
  implementations(
    location: LspLocation,
    serverName?: string,
    limit?: number,
  ): Promise<LspDefinition[]>;

  /**
   * Find all references to a symbol.
   */
  references(
    location: LspLocation,
    serverName?: string,
    includeDeclaration?: boolean,
    limit?: number,
  ): Promise<LspReference[]>;

  /**
   * Prepare call hierarchy item at a position (functions/methods).
   */
  prepareCallHierarchy(
    location: LspLocation,
    serverName?: string,
    limit?: number,
  ): Promise<LspCallHierarchyItem[]>;

  /**
   * Find all functions/methods that call the given function.
   */
  incomingCalls(
    item: LspCallHierarchyItem,
    serverName?: string,
    limit?: number,
  ): Promise<LspCallHierarchyIncomingCall[]>;

  /**
   * Find all functions/methods called by the given function.
   */
  outgoingCalls(
    item: LspCallHierarchyItem,
    serverName?: string,
    limit?: number,
  ): Promise<LspCallHierarchyOutgoingCall[]>;

  /**
   * Get diagnostics for a specific document.
   */
  diagnostics(
    uri: string,
    serverName?: string,
  ): Promise<LspDiagnostic[]>;

  /**
   * Get diagnostics for all open documents in the workspace.
   */
  workspaceDiagnostics(
    serverName?: string,
    limit?: number,
  ): Promise<LspFileDiagnostics[]>;

  /**
   * Get code actions available at a specific location.
   */
  codeActions(
    uri: string,
    range: LspRange,
    context: LspCodeActionContext,
    serverName?: string,
    limit?: number,
  ): Promise<LspCodeAction[]>;

  /**
   * Apply a workspace edit (from code action or other sources).
   */
  applyWorkspaceEdit(
    edit: LspWorkspaceEdit,
    serverName?: string,
  ): Promise<boolean>;
}
