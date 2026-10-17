import assert from 'node:assert/strict';
import test from 'node:test';
import { getAgentMcpProfileById } from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import {
  assertS05PersonActivityProfile,
  S05_EXPECTED_ARGUMENTS,
  S05_NETWORK_MODE,
  S05_PROFILE_ID,
} from '../../scripts/lib/s05-person-activity-evidence.mjs';
import {
  codexOneToolMcpServerProfileForNetworkMode,
  parseCodexOneToolMcpArguments,
} from '../../scripts/lib/codex-one-tool-mcp-arguments.mjs';

const REQUIRED = [
  '--summary-file',
  '/tmp/s05-mcp-summary.json',
  '--candidate-sha',
  'a'.repeat(40),
  '--bundle-sha256',
  'b'.repeat(64),
];

test('registered S05 profile selects only its exact anonymous public call and mode', () => {
  const profile = getAgentMcpProfileById(S05_PROFILE_ID);
  assert.ok(profile);
  assert.equal(assertS05PersonActivityProfile(profile), true);

  const config = parseCodexOneToolMcpArguments(['--profile-id', profile.id, ...REQUIRED]);
  assert.equal(config.profile.id, profile.id);
  assert.equal(config.toolName, 'bangumi.get_person_activity');
  assert.deepEqual(config.toolNames, ['bangumi.get_person_activity']);
  assert.deepEqual(config.expectedToolSequence, ['bangumi.get_person_activity']);
  assert.deepEqual(config.expectedArgumentSequence, [S05_EXPECTED_ARGUMENTS]);
  assert.equal(config.networkMode, S05_NETWORK_MODE);
});

test('S05 profile assertion rejects altered network modes, calls, and identities', () => {
  const profile = getAgentMcpProfileById(S05_PROFILE_ID);
  assert.ok(profile);
  assert.equal(assertS05PersonActivityProfile({ ...profile, networkMode: 'offline' }), false);
  assert.equal(
    assertS05PersonActivityProfile({
      ...profile,
      calls: [{ ...profile.calls[0], arguments: { ...S05_EXPECTED_ARGUMENTS, maxRows: 9 } }],
    }),
    false,
  );
  assert.equal(assertS05PersonActivityProfile({ ...profile, epochId: 'other-epoch' }), false);
});

test('server labels only registered public modes as anonymous public', () => {
  assert.equal(
    codexOneToolMcpServerProfileForNetworkMode(S05_NETWORK_MODE),
    'closed-profile-sequence-anonymous-public-v1',
  );
  assert.equal(
    codexOneToolMcpServerProfileForNetworkMode(undefined),
    'closed-profile-sequence-anonymous-public-v1',
  );
  assert.equal(
    codexOneToolMcpServerProfileForNetworkMode('run95-unregistered-network-mode'),
    'closed-profile-sequence-anonymous-offline-v1',
  );
});
