import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeCodexEvents } from '../../scripts/acceptance/run-g26-codex-agent-mcp.mjs';

const TOOL = 'diagnostic_result';
const PAYLOAD = { resultState: 'synthetic_diagnostic', marker: 'structured-content-wire-shape-v1' };

function summarizeResult(result) {
  return summarizeCodexEvents([
    { type: 'thread.started' },
    { type: 'turn.started' },
    {
      type: 'item.completed',
      item: {
        id: 'synthetic-call',
        type: 'mcp_tool_call',
        server: 'local_wire_diag',
        tool: TOOL,
        arguments: {},
        status: 'completed',
        result,
      },
    },
    { type: 'turn.completed' },
  ]);
}

test('normalizes the Codex CLI snake_case MCP structured result field', () => {
  const summary = summarizeResult({
    content: [{ type: 'text', text: JSON.stringify(PAYLOAD) }],
    structured_content: PAYLOAD,
  });

  assert.deepEqual(summary.completedMcpCalls[0].result, {
    content: [{ type: 'text', text: JSON.stringify(PAYLOAD) }],
    structuredContent: PAYLOAD,
  });
  assert.equal(summary.mcpToolErrorResultCount, 0);
  assert.deepEqual(summary.toolCalls, [{ name: TOOL, arguments: {}, state: 'DONE' }]);
});

test('normalizes a snake_case MCP error flag and keeps failed calls rejected', () => {
  const summary = summarizeResult({
    content: [{ type: 'text', text: JSON.stringify(PAYLOAD) }],
    structured_content: PAYLOAD,
    is_error: true,
  });

  assert.equal(summary.completedMcpCalls[0].result.isError, true);
  assert.equal(Object.hasOwn(summary.completedMcpCalls[0].result, 'is_error'), false);
  assert.equal(summary.mcpToolErrorResultCount, 1);
  assert.deepEqual(summary.toolCalls, [{ name: TOOL, arguments: {}, state: 'ERROR' }]);
});

test('conflicting camelCase and snake_case result fields fail closed', () => {
  const summary = summarizeResult({
    content: [],
    structuredContent: { resultState: 'wrong' },
    structured_content: PAYLOAD,
  });

  assert.equal(Object.hasOwn(summary.completedMcpCalls[0].result, 'structuredContent'), false);
  assert.equal(summary.completedMcpCalls[0].result.isError, true);
  assert.equal(summary.mcpToolErrorResultCount, 1);
  assert.deepEqual(summary.toolCalls, [{ name: TOOL, arguments: {}, state: 'ERROR' }]);
});
