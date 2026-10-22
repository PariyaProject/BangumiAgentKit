import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeG01QuerySubjectsV2CodexErrors } from '../../scripts/lib/g01-query-subjects-v2-error-policy.mjs';

test('G01 v2 accepts only exact disabled-web-search diagnostics and rejects transport failures', () => {
  const summary = summarizeG01QuerySubjectsV2CodexErrors([
    {
      type: 'item.completed',
      item: { id: 'disabled-1', type: 'error', message: 'The web search tool is disabled.' },
    },
    {
      type: 'item.completed',
      item: { id: 'disabled-2', type: 'error', message: 'The web search tool is unavailable.' },
    },
    {
      type: 'item.completed',
      item: {
        id: 'disabled-3',
        type: 'error',
        message:
          'The web_search tool is disabled for this Codex invocation because web search was not enabled in the request configuration.',
      },
    },
    {
      type: 'item.completed',
      item: {
        id: 'disabled-4',
        type: 'error',
        message: 'The web-search tool is disabled by the current Codex configuration.',
      },
    },
    {
      type: 'item.completed',
      item: {
        id: 'aborted',
        type: 'error',
        message: 'The web search tool is disabled because the connection was aborted.',
      },
    },
    {
      type: 'item.completed',
      item: {
        id: 'aborted',
        type: 'error',
        message: 'The web search tool is disabled because the connection was aborted.',
      },
    },
    {
      type: 'item.completed',
      item: {
        id: 'unreachable',
        type: 'error',
        message: 'The web search tool is disabled because the connection is unreachable.',
      },
    },
    {
      type: 'item.completed',
      item: {
        id: 'unknown',
        type: 'error',
        message: 'The web search tool was disabled by policy.',
      },
    },
    { type: 'item.completed', item: { id: 'not-error', type: 'mcp_tool_call' } },
  ]);

  assert.deepEqual(summary, {
    errorItemCount: 7,
    blockedWebSearchErrorItemCount: 4,
    unexpectedCodexErrorItemCount: 3,
  });
});

test('G01 v2 rejects conflicting completed errors with the same ID in either order', () => {
  const messages = ['The web search request returned HTTP 503', 'The web search tool is disabled.'];
  const sequences = [messages, [...messages].reverse()];

  for (const sequence of sequences) {
    const summary = summarizeG01QuerySubjectsV2CodexErrors(
      sequence.map((message) => ({
        type: 'item.completed',
        item: { id: 'conflicting-error', type: 'error', message },
      })),
    );

    assert.deepEqual(summary, {
      errorItemCount: 1,
      blockedWebSearchErrorItemCount: 0,
      unexpectedCodexErrorItemCount: 1,
    });
  }
});

test('G01 v2 deduplicates identical completed errors with the same ID', () => {
  const summary = summarizeG01QuerySubjectsV2CodexErrors(
    Array.from({ length: 2 }, () => ({
      type: 'item.completed',
      item: {
        id: 'duplicate-disabled-error',
        type: 'error',
        message: 'The web search tool is disabled.',
      },
    })),
  );

  assert.deepEqual(summary, {
    errorItemCount: 1,
    blockedWebSearchErrorItemCount: 1,
    unexpectedCodexErrorItemCount: 0,
  });
});
