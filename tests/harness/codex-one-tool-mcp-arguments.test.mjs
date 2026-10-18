import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCodexOneToolMcpArguments } from '../../scripts/lib/codex-one-tool-mcp-arguments.mjs';
import { getAgentMcpProfileById } from '../../scripts/lib/agent-mcp-profile-claims.mjs';

test('C04 MCP profile parser exposes one indexed tool per separate Codex run', () => {
  const profile = getAgentMcpProfileById('c04-cohort-comparison-agent-mcp-matrix-v1');
  for (const [index, call] of profile.calls.entries()) {
    const config = parseCodexOneToolMcpArguments([
      '--profile-id',
      profile.id,
      '--profile-call-index',
      String(index),
      '--summary-file',
      `/tmp/c04-mcp-summary-${index}.json`,
      '--candidate-sha',
      'a'.repeat(40),
      '--bundle-sha256',
      'b'.repeat(64),
    ]);

    assert.equal(config.profile.id, profile.id);
    assert.equal(config.profileCallIndex, index);
    assert.equal(config.toolName, call.toolName);
    assert.deepEqual(config.toolNames, [call.toolName]);
    assert.deepEqual(config.expectedToolSequence, [call.toolName]);
    assert.deepEqual(config.expectedArgumentSequence, [call.arguments]);
    assert.equal(config.networkMode, profile.networkMode);
  }
  assert.throws(
    () =>
      parseCodexOneToolMcpArguments([
        '--profile-id',
        profile.id,
        '--summary-file',
        '/tmp/c04-mcp-summary.json',
        '--candidate-sha',
        'a'.repeat(40),
        '--bundle-sha256',
        'b'.repeat(64),
      ]),
    /profile-call-index/u,
  );
  assert.throws(
    () =>
      parseCodexOneToolMcpArguments([
        '--profile-id',
        profile.id,
        '--profile-call-index',
        '2',
        '--summary-file',
        '/tmp/c04-mcp-summary.json',
        '--candidate-sha',
        'a'.repeat(40),
        '--bundle-sha256',
        'b'.repeat(64),
      ]),
    /profile-call-index/u,
  );
  assert.throws(
    () =>
      parseCodexOneToolMcpArguments([
        '--tool',
        'bangumi.auth_status',
        '--arguments-json',
        '{}',
        '--profile-call-index',
        '0',
        '--summary-file',
        '/tmp/c04-mcp-summary.json',
        '--candidate-sha',
        'a'.repeat(40),
        '--bundle-sha256',
        'b'.repeat(64),
      ]),
    /reserved for the registered C04 profile/u,
  );
});

test('G01 query-subjects profile is fixed to one exact synthetic offline read', () => {
  const profile = getAgentMcpProfileById('g01-query-subjects-offline-agent-mcp-matrix-v1');
  assert.ok(profile);
  const config = parseCodexOneToolMcpArguments([
    '--profile-id',
    profile.id,
    '--summary-file',
    '/tmp/g01-query-subjects-mcp-summary.json',
    '--candidate-sha',
    'a'.repeat(40),
    '--bundle-sha256',
    'b'.repeat(64),
  ]);
  assert.equal(config.profile.id, profile.id);
  assert.equal(config.toolName, 'bangumi.query_subjects');
  assert.deepEqual(config.toolNames, ['bangumi.query_subjects']);
  assert.deepEqual(config.expectedToolSequence, ['bangumi.query_subjects']);
  assert.equal(config.networkMode, 'run95-g01-query-subjects-synthetic-offline-v1');
  assert.throws(
    () =>
      parseCodexOneToolMcpArguments([
        '--profile-id',
        profile.id,
        '--tool',
        'bangumi.query_subjects',
        '--summary-file',
        '/tmp/g01-query-subjects-mcp-summary.json',
        '--candidate-sha',
        'a'.repeat(40),
        '--bundle-sha256',
        'b'.repeat(64),
      ]),
    /cannot be combined/u,
  );
});

test('R04 v2 render profile is fixed to the new offline matrix input', () => {
  const profile = getAgentMcpProfileById(
    'r04-render-series-watch-order-offline-agent-mcp-matrix-v2',
  );
  assert.ok(profile);
  const config = parseCodexOneToolMcpArguments([
    '--profile-id',
    profile.id,
    '--summary-file',
    '/tmp/r04-render-v2-mcp-summary.json',
    '--candidate-sha',
    'a'.repeat(40),
    '--bundle-sha256',
    'b'.repeat(64),
  ]);
  assert.equal(config.profile.id, profile.id);
  assert.equal(config.toolName, 'bangumi.render_series_watch_order');
  assert.deepEqual(config.expectedArgumentSequence, [profile.calls[0].arguments]);
  assert.equal(config.networkMode, 'run95-r04-render-series-watch-order-offline-v2');
});
