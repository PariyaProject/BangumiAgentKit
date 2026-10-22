import assert from 'node:assert/strict';
import test from 'node:test';
import { parseCodexOneToolMcpArguments } from '../../scripts/lib/codex-one-tool-mcp-arguments.mjs';
import {
  P06_RENDER_PERSON_PROFILE_EXPECTED_ARGUMENTS,
  P06_RENDER_PERSON_PROFILE_OFFLINE_NETWORK_MODE,
  P06_RENDER_PERSON_PROFILE_OFFLINE_PROFILE_ID,
  P06_RENDER_PERSON_PROFILE_OFFLINE_V2_NETWORK_MODE,
  P06_RENDER_PERSON_PROFILE_OFFLINE_V2_PROFILE_ID,
  P06_RENDER_PERSON_PROFILE_V2_EXPECTED_ARGUMENTS,
  P06_RENDER_PERSON_PROFILE_V3_NETWORK_MODE,
  P06_RENDER_PERSON_PROFILE_V3_PROFILE_ID,
  P06_RENDER_PERSON_PROFILE_V3_EXPECTED_ARGUMENTS,
} from '../../scripts/lib/p06-render-person-profile-offline-fixture.mjs';
import { summarizeProfileToolResult } from '../../scripts/lib/codex-profile-tool-summary.mjs';

const REQUIRED = [
  '--summary-file',
  '/tmp/p06-mcp-summary.json',
  '--candidate-sha',
  'a'.repeat(40),
  '--bundle-sha256',
  'b'.repeat(64),
];

test('registered P06 profile selects only its immutable offline network mode', () => {
  const config = parseCodexOneToolMcpArguments([
    '--profile-id',
    P06_RENDER_PERSON_PROFILE_OFFLINE_PROFILE_ID,
    ...REQUIRED,
  ]);
  assert.equal(config.toolName, 'bangumi.render_person_profile');
  assert.equal(config.profile.id, P06_RENDER_PERSON_PROFILE_OFFLINE_PROFILE_ID);
  assert.equal(config.networkMode, P06_RENDER_PERSON_PROFILE_OFFLINE_NETWORK_MODE);
  assert.deepEqual(config.expectedArgumentSequence, [P06_RENDER_PERSON_PROFILE_EXPECTED_ARGUMENTS]);
});

test('registered P06 v2 profile selects only its distinct offline network mode and arguments', () => {
  const config = parseCodexOneToolMcpArguments([
    '--profile-id',
    P06_RENDER_PERSON_PROFILE_OFFLINE_V2_PROFILE_ID,
    ...REQUIRED,
  ]);
  assert.equal(config.toolName, 'bangumi.render_person_profile');
  assert.equal(config.profile.id, P06_RENDER_PERSON_PROFILE_OFFLINE_V2_PROFILE_ID);
  assert.equal(config.networkMode, P06_RENDER_PERSON_PROFILE_OFFLINE_V2_NETWORK_MODE);
  assert.deepEqual(config.expectedArgumentSequence, [
    P06_RENDER_PERSON_PROFILE_V2_EXPECTED_ARGUMENTS,
  ]);
});

test('registered P06 v3 profile selects only chronology-v3 offline mode and arguments', () => {
  const config = parseCodexOneToolMcpArguments([
    '--profile-id',
    P06_RENDER_PERSON_PROFILE_V3_PROFILE_ID,
    ...REQUIRED,
  ]);
  assert.equal(config.toolName, 'bangumi.render_person_profile');
  assert.equal(config.profile.id, P06_RENDER_PERSON_PROFILE_V3_PROFILE_ID);
  assert.equal(config.networkMode, P06_RENDER_PERSON_PROFILE_V3_NETWORK_MODE);
  assert.deepEqual(config.expectedArgumentSequence, [
    P06_RENDER_PERSON_PROFILE_V3_EXPECTED_ARGUMENTS,
  ]);
});

test('P06 v3 profile summary retains only bounded artifact metadata', () => {
  assert.deepEqual(
    summarizeProfileToolResult(
      { artifact: { id: 'synthetic-artifact' }, resultText: 'private renderer output' },
      P06_RENDER_PERSON_PROFILE_V3_EXPECTED_ARGUMENTS,
      P06_RENDER_PERSON_PROFILE_V3_PROFILE_ID,
      {
        returned: true,
        persisted: false,
        mimeType: 'image/png',
        width: 720,
        height: 1280,
        byteLength: 42000,
        sha256: 'a'.repeat(64),
        pngSignatureValid: true,
      },
      'bangumi.render_person_profile',
    ),
    {
      resultState: 'artifact_returned',
      artifact: {
        returned: true,
        persisted: false,
        mimeType: 'image/png',
        width: 720,
        height: 1280,
        byteLength: 42000,
        sha256: 'a'.repeat(64),
        pngSignatureValid: true,
      },
    },
  );
});

test('P06 registered profile rejects arbitrary arguments and caller-selected network modes', () => {
  assert.throws(() =>
    parseCodexOneToolMcpArguments([
      '--profile-id',
      P06_RENDER_PERSON_PROFILE_OFFLINE_PROFILE_ID,
      '--network-mode',
      P06_RENDER_PERSON_PROFILE_OFFLINE_NETWORK_MODE,
      ...REQUIRED,
    ]),
  );
  assert.throws(() =>
    parseCodexOneToolMcpArguments([
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
    parseCodexOneToolMcpArguments([
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
