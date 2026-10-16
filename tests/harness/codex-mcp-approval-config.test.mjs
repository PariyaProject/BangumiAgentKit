import assert from 'node:assert/strict';
import test from 'node:test';
import {
  codexMcpExactToolApprovalConfig,
  summarizeCodexErrorItems,
} from '../../scripts/lib/codex-mcp-approval-config.mjs';

test('Codex MCP approval is scoped to exact enabled tools with quoted dotted names', () => {
  assert.deepEqual(
    codexMcpExactToolApprovalConfig('bgk_r01_relations', ['bangumi.get_subject_relations']),
    ['mcp_servers.bgk_r01_relations.tools."bangumi.get_subject_relations".approval_mode="approve"'],
  );
  assert.deepEqual(
    codexMcpExactToolApprovalConfig('bgk_c04', [
      'bangumi.compare_subject_cohorts',
      'bangumi.render_subject_cohort_comparison',
    ]),
    [
      'mcp_servers.bgk_c04.tools."bangumi.compare_subject_cohorts".approval_mode="approve"',
      'mcp_servers.bgk_c04.tools."bangumi.render_subject_cohort_comparison".approval_mode="approve"',
    ],
  );
});

test('Codex MCP approval config rejects broad or ambiguous tool sets', () => {
  assert.throws(() => codexMcpExactToolApprovalConfig('*', ['bangumi.get_subject_relations']));
  assert.throws(() => codexMcpExactToolApprovalConfig('bgk_r01', ['*']));
  assert.throws(() =>
    codexMcpExactToolApprovalConfig('bgk_r01', [
      'bangumi.get_subject_relations',
      'bangumi.get_subject_relations',
    ]),
  );
});

test('only blocked disabled web-search errors are classified as expected', () => {
  const summary = summarizeCodexErrorItems([
    {
      type: 'item.completed',
      item: { id: 'web-1', type: 'error', message: 'The web search tool is disabled.' },
    },
    {
      type: 'item.completed',
      item: { id: 'web-1', type: 'error', message: 'The web search tool is disabled.' },
    },
    {
      type: 'item.completed',
      item: { id: 'unknown-1', type: 'error', message: 'MCP server did not start.' },
    },
    {
      type: 'item.completed',
      item: { id: 'not-error', type: 'mcp_tool_call', status: 'completed' },
    },
  ]);
  assert.deepEqual(summary, {
    errorItemCount: 2,
    blockedWebSearchErrorItemCount: 1,
    unexpectedCodexErrorItemCount: 1,
  });
});
