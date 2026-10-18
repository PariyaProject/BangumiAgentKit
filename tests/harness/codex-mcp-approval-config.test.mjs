import assert from 'node:assert/strict';
import test from 'node:test';
import {
  codexMcpExactToolAccessConfig,
  summarizeCodexErrorItems,
} from '../../scripts/lib/codex-mcp-approval-config.mjs';

test('Codex MCP approval is server-wide and constrained by the exact enabled-tools allowlist', () => {
  assert.deepEqual(
    codexMcpExactToolAccessConfig('bgk_r01_relations', ['bangumi.get_subject_relations']),
    [
      'mcp_servers.bgk_r01_relations.enabled_tools=["bangumi.get_subject_relations"]',
      'mcp_servers.bgk_r01_relations.default_tools_approval_mode="approve"',
    ],
  );
  assert.deepEqual(
    codexMcpExactToolAccessConfig('bgk_c04', [
      'bangumi.compare_subject_cohorts',
      'bangumi.render_subject_cohort_comparison',
    ]),
    [
      'mcp_servers.bgk_c04.enabled_tools=["bangumi.compare_subject_cohorts","bangumi.render_subject_cohort_comparison"]',
      'mcp_servers.bgk_c04.default_tools_approval_mode="approve"',
    ],
  );
  assert.equal(
    codexMcpExactToolAccessConfig('bgk_r01_relations', ['bangumi.get_subject_relations']).some(
      (setting) => setting.includes('.tools.'),
    ),
    false,
  );
});

test('Codex MCP approval config rejects broad or ambiguous tool sets', () => {
  assert.throws(() => codexMcpExactToolAccessConfig('*', ['bangumi.get_subject_relations']));
  assert.throws(() => codexMcpExactToolAccessConfig('bgk_r01', ['*']));
  assert.throws(() =>
    codexMcpExactToolAccessConfig('bgk_r01', [
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
      item: { id: 'web-2', type: 'error', message: 'The web search tool is unavailable.' },
    },
    {
      type: 'item.completed',
      item: {
        id: 'near-match-1',
        type: 'error',
        message: 'An unrelated backend request failed: Web Search is unavailable.',
      },
    },
    {
      type: 'item.completed',
      item: {
        id: 'near-match-2',
        type: 'error',
        message: 'The web search tool is unavailable while attempting a remote request.',
      },
    },
    {
      type: 'item.completed',
      item: { id: 'near-match-3', type: 'error', message: 'The web-search tool is disabled.' },
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
    errorItemCount: 6,
    blockedWebSearchErrorItemCount: 2,
    unexpectedCodexErrorItemCount: 4,
  });
});
