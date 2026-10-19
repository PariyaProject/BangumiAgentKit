import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parseCodexOneToolMcpArguments } from '../../scripts/lib/codex-one-tool-mcp-arguments.mjs';
import {
  A01_AGGREGATE_COHORT_EXPECTED_ARGUMENTS,
  A01_AGGREGATE_COHORT_OFFLINE_NETWORK_MODE,
  A01_AGGREGATE_COHORT_OFFLINE_PROFILE_ID,
  A01_AGGREGATE_COHORT_OFFLINE_V2_EXPECTED_ARGUMENTS,
  A01_AGGREGATE_COHORT_OFFLINE_V2_NETWORK_MODE,
  A01_AGGREGATE_COHORT_OFFLINE_V2_PROFILE_ID,
  A01_AGGREGATE_COHORT_TOOL,
} from '../../scripts/lib/a01-aggregate-cohort-offline-matrix-profile.mjs';

const REQUIRED = [
  '--summary-file',
  '/tmp/a01-aggregate-summary.json',
  '--candidate-sha',
  'a'.repeat(40),
  '--bundle-sha256',
  'b'.repeat(64),
];
const SERVER_SOURCE = readFileSync(
  new URL('../../apps/mcp/codex-one-tool-mcp-server.mjs', import.meta.url),
  'utf8',
);

test('registered A01 aggregate profile selects only its fixed offline network mode', () => {
  const config = parseCodexOneToolMcpArguments([
    '--profile-id',
    A01_AGGREGATE_COHORT_OFFLINE_PROFILE_ID,
    ...REQUIRED,
  ]);
  assert.equal(config.toolName, A01_AGGREGATE_COHORT_TOOL);
  assert.equal(config.profile.id, A01_AGGREGATE_COHORT_OFFLINE_PROFILE_ID);
  assert.equal(config.networkMode, A01_AGGREGATE_COHORT_OFFLINE_NETWORK_MODE);
  assert.deepEqual(config.expectedArgumentSequence, [A01_AGGREGATE_COHORT_EXPECTED_ARGUMENTS]);
});

test('registered A01 aggregate v2 profile has a distinct offline mode and fresh fixed input', () => {
  const config = parseCodexOneToolMcpArguments([
    '--profile-id',
    A01_AGGREGATE_COHORT_OFFLINE_V2_PROFILE_ID,
    ...REQUIRED,
  ]);
  assert.equal(config.toolName, A01_AGGREGATE_COHORT_TOOL);
  assert.equal(config.profile.id, A01_AGGREGATE_COHORT_OFFLINE_V2_PROFILE_ID);
  assert.equal(config.networkMode, A01_AGGREGATE_COHORT_OFFLINE_V2_NETWORK_MODE);
  assert.deepEqual(config.expectedArgumentSequence, [A01_AGGREGATE_COHORT_OFFLINE_V2_EXPECTED_ARGUMENTS]);
  assert.notDeepEqual(
    config.expectedArgumentSequence[0],
    parseCodexOneToolMcpArguments([
      '--profile-id',
      A01_AGGREGATE_COHORT_OFFLINE_PROFILE_ID,
      ...REQUIRED,
    ]).expectedArgumentSequence[0],
  );
});

test('MCP server binds the profile to its defining fixture and bounded summary', () => {
  const fixtureImport = SERVER_SOURCE.match(
    /import\s*\{([^}]+)\}\s*from\s*['"]\.\.\/\.\.\/scripts\/lib\/a01-aggregate-cohort-offline-matrix-profile\.mjs['"]/u,
  );
  assert.ok(fixtureImport);
  assert.match(fixtureImport[1], /\bassertA01AggregateCohortOfflineProfile\b/u);
  assert.match(fixtureImport[1], /\bcreateA01AggregateCohortOfflineFetch\b/u);
  assert.match(SERVER_SOURCE, /A01_AGGREGATE_COHORT_OFFLINE_V2_NETWORK_MODE/u);
  assert.match(SERVER_SOURCE, /A01_AGGREGATE_COHORT_OFFLINE_PROFILE_IDS\.includes\(config\.profile\?\.id\)/u);
  assert.match(SERVER_SOURCE, /A01_AGGREGATE_SUMMARY_UNAVAILABLE/u);
});

test('A01 aggregate offline mode rejects arbitrary arguments and caller-selected modes', () => {
  assert.throws(() =>
    parseCodexOneToolMcpArguments([
      '--profile-id',
      A01_AGGREGATE_COHORT_OFFLINE_PROFILE_ID,
      '--network-mode',
      A01_AGGREGATE_COHORT_OFFLINE_NETWORK_MODE,
      ...REQUIRED,
    ]),
  );
  assert.throws(() =>
    parseCodexOneToolMcpArguments([
      '--tool',
      A01_AGGREGATE_COHORT_TOOL,
      '--arguments-json',
      JSON.stringify(A01_AGGREGATE_COHORT_EXPECTED_ARGUMENTS),
      '--network-mode',
      A01_AGGREGATE_COHORT_OFFLINE_NETWORK_MODE,
      ...REQUIRED,
    ]),
  );
  assert.throws(() => parseCodexOneToolMcpArguments([
    '--profile-id',
    A01_AGGREGATE_COHORT_OFFLINE_V2_PROFILE_ID,
    '--network-mode',
    A01_AGGREGATE_COHORT_OFFLINE_V2_NETWORK_MODE,
    ...REQUIRED,
  ]));
});
