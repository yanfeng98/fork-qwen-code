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
}
