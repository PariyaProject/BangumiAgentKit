import assert from 'node:assert/strict';
import test from 'node:test';
import { parseArguments } from '../../apps/mcp/codex-one-tool-mcp-server.mjs';
import {
  P06_RENDER_PERSON_PROFILE_EXPECTED_ARGUMENTS,
  P06_RENDER_PERSON_PROFILE_OFFLINE_NETWORK_MODE,
  P06_RENDER_PERSON_PROFILE_OFFLINE_PROFILE_ID,
} from '../../scripts/lib/p06-render-person-profile-offline-fixture.mjs';

const REQUIRED = [
  '--summary-file',
  '/tmp/p06-mcp-summary.json',
  '--candidate-sha',
  'a'.repeat(40),
  '--bundle-sha256',
  'b'.repeat(64),
];

test('registered P06 profile selects only its immutable offline network mode', () => {
  const config = parseArguments([
    '--profile-id',
    P06_RENDER_PERSON_PROFILE_OFFLINE_PROFILE_ID,
    ...REQUIRED,
  ]);
  assert.equal(config.toolName, 'bangumi.render_person_profile');
  assert.equal(config.profile.id, P06_RENDER_PERSON_PROFILE_OFFLINE_PROFILE_ID);
  assert.equal(config.networkMode, P06_RENDER_PERSON_PROFILE_OFFLINE_NETWORK_MODE);
  assert.deepEqual(config.expectedArgumentSequence, [P06_RENDER_PERSON_PROFILE_EXPECTED_ARGUMENTS]);
});

test('P06 registered profile rejects arbitrary arguments and caller-selected network modes', () => {
  assert.throws(() =>
    parseArguments([
      '--profile-id',
      P06_RENDER_PERSON_PROFILE_OFFLINE_PROFILE_ID,
      '--network-mode',
      P06_RENDER_PERSON_PROFILE_OFFLINE_NETWORK_MODE,
      ...REQUIRED,
    ]),
  );
  assert.throws(() =>
    parseArguments([
      '--profile-id',
      P06_RENDER_PERSON_PROFILE_OFFLINE_PROFILE_ID,
      '--tool',
      'bangumi.render_person_profile',
      ...REQUIRED,
    ]),
  );
});

test('P06 offline network mode cannot be selected by an arbitrary one-tool invocation', () => {
  assert.throws(() =>
    parseArguments([
      '--tool',
      'bangumi.render_person_profile',
      '--arguments-json',
      JSON.stringify(P06_RENDER_PERSON_PROFILE_EXPECTED_ARGUMENTS),
      '--network-mode',
      P06_RENDER_PERSON_PROFILE_OFFLINE_NETWORK_MODE,
      ...REQUIRED,
    ]),
  );
});
