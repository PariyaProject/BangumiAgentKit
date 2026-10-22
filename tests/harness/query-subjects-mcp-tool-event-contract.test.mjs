import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseCodexJsonl,
  summarizeCodexEvents,
} from '../../scripts/acceptance/run-g26-codex-agent-mcp.mjs';
import { getAgentMcpProfileById } from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import { QUERY_SUBJECTS_FRESH_PUBLIC_PROFILE_ID } from '../../scripts/lib/query-subjects-fresh-public-matrix-profile.mjs';
import { QUERY_SUBJECTS_FRESH_PUBLIC_V2_PROFILE_ID } from '../../scripts/lib/query-subjects-fresh-public-matrix-v2-profile.mjs';
import { isExactQuerySubjectsToolCallSummary as isExactV1Summary } from '../../scripts/acceptance/run-query-subjects-fresh-public-agent-mcp.mjs';
import { isExactQuerySubjectsToolCallSummary as isExactV2Summary } from '../../scripts/acceptance/run-query-subjects-fresh-public-agent-mcp-v2.mjs';

function summarizeSyntheticCalls(
  profile,
  { toolName = profile.toolName, status = 'completed', isError = false, callCount = 1 } = {},
) {
  const calls = Array.from({ length: callCount }, (_, index) => ({
    type: 'item.completed',
    item: {
      id: `call_${index + 1}`,
      type: 'mcp_tool_call',
      server: 'synthetic-query-subjects-server',
      tool: toolName,
      arguments: profile.calls[0].arguments,
      status,
      result: { isError, content: [{ type: 'text', text: 'synthetic bounded result' }] },
    },
  }));
  const events = [
    { type: 'thread.started', thread_id: 'synthetic-thread' },
    { type: 'turn.started', turn_id: 'synthetic-turn' },
    ...calls,
    {
      type: 'item.completed',
      item: { id: 'answer_1', type: 'agent_message', text: 'SYNTHETIC_ACK' },
    },
    { type: 'turn.completed', turn_id: 'synthetic-turn' },
  ];
  const parsed = parseCodexJsonl(events.map((event) => JSON.stringify(event)).join('\n'));
  assert.equal(parsed.parsed, true);
  return summarizeCodexEvents(parsed.events);
}

test('query_subjects v1 and v2 accept the shared canonical completed-tool event shape only', () => {
  const profiles = [
    [QUERY_SUBJECTS_FRESH_PUBLIC_PROFILE_ID, isExactV1Summary],
    [QUERY_SUBJECTS_FRESH_PUBLIC_V2_PROFILE_ID, isExactV2Summary],
  ];

  for (const [profileId, isExact] of profiles) {
    const profile = getAgentMcpProfileById(profileId);
    assert.ok(profile);

    const completed = summarizeSyntheticCalls(profile);
    assert.deepEqual(
      completed.toolCalls.map(({ name, state }) => ({ name, state })),
      [{ name: profile.toolName, state: 'DONE' }],
    );
    assert.equal(isExact(completed), true);

    assert.equal(
      isExact(summarizeSyntheticCalls(profile, { toolName: 'bangumi.unexpected_tool' })),
      false,
      'wrong tool name must fail closed',
    );
    assert.equal(
      isExact(summarizeSyntheticCalls(profile, { status: 'in_progress' })),
      false,
      'a non-completed MCP call must fail closed',
    );
    assert.equal(
      isExact(summarizeSyntheticCalls(profile, { isError: true })),
      false,
      'an MCP error result must fail closed',
    );
    assert.equal(
      isExact(summarizeSyntheticCalls(profile, { callCount: 2 })),
      false,
      'multiple MCP calls must fail closed',
    );
  }
});
