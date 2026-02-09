/**
 * @license
 * Copyright 2025 Qwen Team
 * SPDX-License-Identifier: Apache-2.0
 */

/** @vitest-environment jsdom */

import type React from 'react';
import { act } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';

declare global {
   
  var acquireVsCodeApi:
    | undefined
    | (() => {
        postMessage: (message: unknown) => void;
        getState: () => unknown;
        setState: (state: unknown) => void;
      });
}

const createProps = (overrides: Record<string, unknown> = {}) => ({
  sessionManagement: {
    currentSessionId: null,
    setQwenSessions: vi.fn(),
    setCurrentSessionId: vi.fn(),
    setCurrentSessionTitle: vi.fn(),
    setShowSessionSelector: vi.fn(),
    setNextCursor: vi.fn(),
    setHasMore: vi.fn(),
    setIsLoading: vi.fn(),
    handleSaveSessionResponse: vi.fn(),
  },
  fileContext: {
    setActiveFileName: vi.fn(),
    setActiveFilePath: vi.fn(),
    setActiveSelection: vi.fn(),
    setWorkspaceFilesFromResponse: vi.fn(),
    addFileReference: vi.fn(),
  },
  messageHandling: {
    setMessages: vi.fn(),
    addMessage: vi.fn(),
    clearMessages: vi.fn(),
    startStreaming: vi.fn(),
    appendStreamChunk: vi.fn(),
    endStreaming: vi.fn(),
    breakAssistantSegment: vi.fn(),
    appendThinkingChunk: vi.fn(),
    clearThinking: vi.fn(),
    setWaitingForResponse: vi.fn(),
    clearWaitingForResponse: vi.fn(),
  },
  handleToolCallUpdate: vi.fn(),
  clearToolCalls: vi.fn(),
  setPlanEntries: vi.fn(),
  handlePermissionRequest: vi.fn(),
  inputFieldRef: {
    current: document.createElement('div'),
  } as React.RefObject<HTMLDivElement>,
  setInputText: vi.fn(),
  ...overrides,
});

const renderHook = async (props: Record<string, unknown>) => {
  const { useWebViewMessages } = await import('./useWebViewMessages.js');
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  const Harness = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useWebViewMessages(props as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return <div ref={(props as any).inputFieldRef} />;
  };

  await act(async () => {
    root.render(<Harness />);
  });
  await act(async () => {});

  return {
    unmount: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
};

const setup = async (overrides: Record<string, unknown> = {}) => {
  const postMessage = vi.fn();
  (
    globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.acquireVsCodeApi = () => ({
    postMessage,
    getState: vi.fn(),
    setState: vi.fn(),
  });

  const props = createProps(overrides);
  const { unmount } = await renderHook(props);

  return { props, unmount, postMessage };
};

// ---------------------------------------------------------------------------
// Helpers – dispatch a webview message event
// ---------------------------------------------------------------------------

function dispatchWebViewMessage(type: string, data?: unknown) {
  act(() => {
    window.dispatchEvent(new MessageEvent('message', { data: { type, data } }));
  });
}

// ===========================================================================
// Tests
// ===========================================================================

describe('useWebViewMessages', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    globalThis.acquireVsCodeApi = undefined;
    delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
      .IS_REACT_ACT_ENVIRONMENT;
  });

  // ---- loginRequired -------------------------------------------------------

  it('enters login-required state on loginRequired message', async () => {
    const setForceLogin = vi.fn();
    const setIsAuthenticated = vi.fn();

    const { unmount } = await setup({
      setForceLogin,
      setIsAuthenticated,
    });

    dispatchWebViewMessage('loginRequired', {
      message: 'Session expired. Please login again.',
    });

    expect(setIsAuthenticated).toHaveBeenCalledWith(false);
    expect(setForceLogin).toHaveBeenCalledWith(true);

    unmount();
  });

  it('clears waitingForResponse when loginRequired arrives', async () => {
    const setForceLogin = vi.fn();
    const setIsAuthenticated = vi.fn();
    const clearWaitingForResponse = vi.fn();

    const { unmount } = await setup({
      setForceLogin,
      setIsAuthenticated,
      messageHandling: {
        setMessages: vi.fn(),
        addMessage: vi.fn(),
        clearMessages: vi.fn(),
        startStreaming: vi.fn(),
        appendStreamChunk: vi.fn(),
        endStreaming: vi.fn(),
        breakAssistantSegment: vi.fn(),
        appendThinkingChunk: vi.fn(),
        clearThinking: vi.fn(),
        setWaitingForResponse: vi.fn(),
        clearWaitingForResponse,
      },
    });

    dispatchWebViewMessage('loginRequired', {
      message: 'Auth needed.',
    });

    expect(clearWaitingForResponse).toHaveBeenCalled();

    unmount();
  });

  // ---- loginSuccess clears forceLogin --------------------------------------

  it('clears forceLogin on loginSuccess message', async () => {
    const setForceLogin = vi.fn();
    const setIsAuthenticated = vi.fn();

    const { unmount } = await setup({
      setForceLogin,
      setIsAuthenticated,
    });

    dispatchWebViewMessage('loginSuccess', {});

    expect(setIsAuthenticated).toHaveBeenCalledWith(true);
    expect(setForceLogin).toHaveBeenCalledWith(false);

    unmount();
  });

  // ---- loginRequired → loginSuccess round-trip -----------------------------

  it('handles loginRequired → loginSuccess round-trip correctly', async () => {
    const setForceLogin = vi.fn();
    const setIsAuthenticated = vi.fn();

    const { unmount } = await setup({
      setForceLogin,
      setIsAuthenticated,
    });

    // First: trigger loginRequired
    dispatchWebViewMessage('loginRequired', {
      message: 'Session expired.',
    });

    expect(setForceLogin).toHaveBeenCalledWith(true);
    expect(setIsAuthenticated).toHaveBeenCalledWith(false);

    // Then: loginSuccess
    dispatchWebViewMessage('loginSuccess', {});

    expect(setForceLogin).toHaveBeenCalledWith(false);
    expect(setIsAuthenticated).toHaveBeenCalledWith(true);

    unmount();
  });

  // ---- setForceLogin not provided (graceful no-op) -------------------------

  it('does not crash when setForceLogin is not provided', async () => {
    const setIsAuthenticated = vi.fn();

    const { unmount } = await setup({
      // intentionally NOT providing setForceLogin
      setIsAuthenticated,
    });

    // Should not throw
    dispatchWebViewMessage('loginRequired', {
      message: 'Auth needed.',
    });

    expect(setIsAuthenticated).toHaveBeenCalledWith(false);

    unmount();
  });
});
