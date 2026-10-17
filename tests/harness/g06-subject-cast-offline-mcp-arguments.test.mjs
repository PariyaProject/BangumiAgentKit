import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCodexOneToolMcpArguments } from '../../scripts/lib/codex-one-tool-mcp-arguments.mjs';
import {
  G06_CAST_OFFLINE_PROFILE_ID,
  G06_CAST_OFFLINE_NETWORK_MODE,
} from '../../scripts/lib/g06-subject-cast-offline-profile.mjs';

const exactArgs = [
  '--profile-id',
  G06_CAST_OFFLINE_PROFILE_ID,
  '--summary-file',
  '/tmp/g06-summary.json',
  '--candidate-sha',
  'a'.repeat(40),
  '--bundle-sha256',
  'b'.repeat(64),
];

test('G06 offline MCP arguments expose only the immutable registered call', () => {
  const parsed = parseCodexOneToolMcpArguments(exactArgs);
  assert.equal(parsed.profile.id, G06_CAST_OFFLINE_PROFILE_ID);
  assert.equal(parsed.networkMode, G06_CAST_OFFLINE_NETWORK_MODE);
  assert.deepEqual(parsed.toolNames, ['bangumi.get_subject_cast']);
  assert.deepEqual(parsed.expectedToolSequence, ['bangumi.get_subject_cast']);
  assert.deepEqual(parsed.expectedArgumentSequence, [{ subjectId: 990804, limit: 2 }]);
});

test('G06 offline MCP arguments reject arbitrary profile overrides', () => {
  assert.throws(
    () => parseCodexOneToolMcpArguments([...exactArgs, '--network-mode', 'other']),
    /registered profile cannot be combined/u,
  );
  assert.throws(
    () =>
      parseCodexOneToolMcpArguments([
        '--profile-id',
        'not-registered',
        '--summary-file',
        '/tmp/summary.json',
        '--candidate-sha',
        'a'.repeat(40),
        '--bundle-sha256',
        'b'.repeat(64),
      ]),
    /Unknown closed Agent\/MCP profile/u,
  );
});
