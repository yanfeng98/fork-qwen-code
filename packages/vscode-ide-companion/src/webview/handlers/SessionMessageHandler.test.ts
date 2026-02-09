/**
 * @license
 * Copyright 2025 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { QwenAgentManager } from '../../services/qwenAgentManager.js';
import type { ConversationStore } from '../../services/conversationStore.js';
import { SessionMessageHandler } from './SessionMessageHandler.js';
import {
  stripAcpErrorData,
  ACP_ERROR_DATA_PREFIX,
} from './SessionMessageHandler.js';
import * as vscode from 'vscode';

const vscodeMock = vi.hoisted(() => ({
  window: {
    showErrorMessage: vi.fn(),
    showWarningMessage: vi.fn(),
    showInformationMessage: vi.fn(),
  },
  commands: {
    executeCommand: vi.fn(),
  },
  workspace: {
    workspaceFolders: [],
  },
  ProgressLocation: {
    Notification: 15,
  },
}));

vi.mock('vscode', () => vscodeMock);

// ---------------------------------------------------------------------------
// Helper: create a minimal SessionMessageHandler wired to the provided stubs
// ---------------------------------------------------------------------------

function createHandler(overrides: {
  agentManager?: Partial<QwenAgentManager>;
  sendToWebView?: ReturnType<typeof vi.fn>;
}) {
  const sendToWebView = overrides.sendToWebView ?? vi.fn();
  const conversationStore = {
    createConversation: vi.fn(),
    getConversation: vi.fn(),
    addMessage: vi.fn(),
  } as unknown as ConversationStore;

  const handler = new SessionMessageHandler(
    (overrides.agentManager ?? {}) as unknown as QwenAgentManager,
    conversationStore,
    null,
    sendToWebView,
  );

  return { handler, sendToWebView, conversationStore };
}

// ===========================================================================
// stripAcpErrorData  (exported helper)
// ===========================================================================

describe('stripAcpErrorData', () => {
  it('returns the original message when there is no Data: payload', () => {
    expect(stripAcpErrorData('Something went wrong')).toBe(
      'Something went wrong',
    );
  });

  it('strips the Data: JSON payload', () => {
    const raw = `Authentication required (code: -32000)${ACP_ERROR_DATA_PREFIX}{"details":"expired"}`;
    expect(stripAcpErrorData(raw)).toBe(
      'Authentication required (code: -32000)',
    );
  });

  it('trims trailing whitespace before the payload marker', () => {
    const raw = `Error message  ${ACP_ERROR_DATA_PREFIX}{"a":1}`;
    expect(stripAcpErrorData(raw)).toBe('Error message');
  });

  it('handles empty string', () => {
    expect(stripAcpErrorData('')).toBe('');
  });

  it('handles message that is only the prefix', () => {
    expect(stripAcpErrorData(ACP_ERROR_DATA_PREFIX)).toBe('');
  });
});

// ===========================================================================
// SessionMessageHandler – setModel
// ===========================================================================

describe('SessionMessageHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---- empty message guard ------------------------------------------------

  it('ignores empty sendMessage text', async () => {
    const { handler, sendToWebView, conversationStore } = createHandler({
      agentManager: { isConnected: true },
    });

    await handler.handle({ type: 'sendMessage', data: { text: '   ' } });

    expect(conversationStore.createConversation).not.toHaveBeenCalled();
    expect(conversationStore.addMessage).not.toHaveBeenCalled();
    expect(sendToWebView).not.toHaveBeenCalled();
  });

  it('ignores zero-width-space-only sendMessage text', async () => {
    const { handler, sendToWebView, conversationStore } = createHandler({
      agentManager: { isConnected: true },
    });

    await handler.handle({
      type: 'sendMessage',
      data: { text: '\u200B \u200B' },
    });

    expect(conversationStore.createConversation).not.toHaveBeenCalled();
    expect(sendToWebView).not.toHaveBeenCalled();
  });

  // ---- setModel: auth-required error --------------------------------------

  it('notifies and emits loginRequired on auth-required setModel', async () => {
    const setModelFromUi = vi
      .fn()
      .mockRejectedValueOnce(
        new Error(
          'Authentication required (code: -32000)\nData: {"details":"Qwen OAuth credentials expired.","authMethods":[{"id":"qwen-oauth"}]}',
        ),
      );

    const { handler, sendToWebView } = createHandler({
      agentManager: { setModelFromUi },
    });

    await handler.handle({
      type: 'setModel',
      data: { modelId: 'coder-model' },
    });

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('coder-model'),
    );
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('Authentication required'),
    );
    expect(sendToWebView).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'loginRequired' }),
    );
  });

  it('detects auth error via "Unauthorized" keyword', async () => {
    const setModelFromUi = vi
      .fn()
      .mockRejectedValueOnce(new Error('Unauthorized'));

    const { handler, sendToWebView } = createHandler({
      agentManager: { setModelFromUi },
    });

    await handler.handle({
      type: 'setModel',
      data: { modelId: 'some-model' },
    });

    expect(sendToWebView).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'loginRequired' }),
    );
  });

  it('detects auth error via "Invalid token" keyword', async () => {
    const setModelFromUi = vi
      .fn()
      .mockRejectedValueOnce(new Error('Invalid token'));

    const { handler, sendToWebView } = createHandler({
      agentManager: { setModelFromUi },
    });

    await handler.handle({
      type: 'setModel',
      data: { modelId: 'some-model' },
    });

    expect(sendToWebView).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'loginRequired' }),
    );
  });

  it('detects auth error via "Session expired" keyword', async () => {
    const setModelFromUi = vi
      .fn()
      .mockRejectedValueOnce(new Error('Session expired'));

    const { handler, sendToWebView } = createHandler({
      agentManager: { setModelFromUi },
    });

    await handler.handle({
      type: 'setModel',
      data: { modelId: 'some-model' },
    });

    expect(sendToWebView).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'loginRequired' }),
    );
  });

  // ---- setModel: generic (non-auth) error ---------------------------------

  it('shows generic error when setModel fails for non-auth reason', async () => {
    const setModelFromUi = vi
      .fn()
      .mockRejectedValueOnce(new Error('Network timeout'));

    const { handler, sendToWebView } = createHandler({
      agentManager: { setModelFromUi },
    });

    await handler.handle({
      type: 'setModel',
      data: { modelId: 'qwen3-coder-plus' },
    });

    // Should show generic error, NOT loginRequired
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('Network timeout'),
    );
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('qwen3-coder-plus'),
    );
    expect(sendToWebView).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error' }),
    );
    expect(sendToWebView).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'loginRequired' }),
    );
  });

  it('strips ACP Data payload from generic error message', async () => {
    const setModelFromUi = vi
      .fn()
      .mockRejectedValueOnce(
        new Error(
          `Model not found (code: -32001)${ACP_ERROR_DATA_PREFIX}{"detail":"unknown model"}`,
        ),
      );

    const { handler, sendToWebView } = createHandler({
      agentManager: { setModelFromUi },
    });

    await handler.handle({
      type: 'setModel',
      data: { modelId: 'bad-model' },
    });

    // The Data: ... portion should be stripped from the user-facing message
    const errorCall = sendToWebView.mock.calls.find(
      (args: unknown[]) =>
        (args[0] as { type: string } | undefined)?.type === 'error',
    );
    expect(errorCall).toBeDefined();
    const errorData = (errorCall![0] as { data: { message: string } }).data;
    expect(errorData.message).not.toContain('unknown model');
    expect(errorData.message).toContain('Model not found');
  });

  // ---- setModel: missing modelId ------------------------------------------

  it('shows error when modelId is missing', async () => {
    const setModelFromUi = vi.fn();

    const { handler, sendToWebView } = createHandler({
      agentManager: { setModelFromUi },
    });

    await handler.handle({ type: 'setModel', data: {} });

    expect(setModelFromUi).not.toHaveBeenCalled();
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('Model ID is required'),
    );
    expect(sendToWebView).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error' }),
    );
  });

  // ---- setModel: success ---------------------------------------------------

  it('shows success notification on successful model switch', async () => {
    const setModelFromUi = vi.fn().mockResolvedValueOnce({
      modelId: 'qwen3-coder-plus',
      name: 'qwen3-coder-plus',
    });

    const { handler, sendToWebView } = createHandler({
      agentManager: { setModelFromUi },
    });

    await handler.handle({
      type: 'setModel',
      data: { modelId: 'qwen3-coder-plus' },
    });

    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      'Model switched to: qwen3-coder-plus',
    );
    expect(vscode.window.showErrorMessage).not.toHaveBeenCalled();
    expect(sendToWebView).not.toHaveBeenCalled();
  });

  // ---- setModel: non-Error throw ------------------------------------------

  it('handles non-Error throw (e.g. string) gracefully', async () => {
    const setModelFromUi = vi.fn().mockRejectedValueOnce('plain string error');

    const { handler, sendToWebView } = createHandler({
      agentManager: { setModelFromUi },
    });

    await handler.handle({
      type: 'setModel',
      data: { modelId: 'some-model' },
    });

    expect(vscode.window.showErrorMessage).toHaveBeenCalled();
    expect(sendToWebView).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'error' }),
    );
  });
});
