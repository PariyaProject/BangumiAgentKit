import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parseCodexOneToolMcpArguments } from '../../scripts/lib/codex-one-tool-mcp-arguments.mjs';
import {
  assertC03PersonActivityOfflineV2Profile,
  C03_PERSON_ACTIVITY_OFFLINE_V2_COVERAGE_KEYS,
  C03_PERSON_ACTIVITY_OFFLINE_V2_EXPECTED_ARGUMENTS,
  C03_PERSON_ACTIVITY_OFFLINE_V2_NETWORK_MODE,
  C03_PERSON_ACTIVITY_OFFLINE_V2_PROFILE_ID,
  C03_PERSON_ACTIVITY_OFFLINE_V2_PROJECTION_KEYS,
  C03_PERSON_ACTIVITY_OFFLINE_V2_OUTPUT_SCHEMA,
  C03_PERSON_ACTIVITY_TOOL_NAME,
  createC03PersonActivityOfflineV2Fetch,
  isC03PersonActivityOfflineV2Projection,
  summarizeC03PersonActivityOfflineV2Result,
} from '../../scripts/lib/c03-person-activity-offline-matrix-v2-profile.mjs';
import { getAgentMcpProfileById } from '../../scripts/lib/agent-mcp-profile-claims.mjs';

const REQUIRED = [
  '--summary-file',
  '/tmp/c03-activity-v2-summary.json',
  '--candidate-sha',
  'a'.repeat(40),
  '--bundle-sha256',
  'b'.repeat(64),
];

test('C03 v2 is a distinct fixed synthetic offline Agent/MCP matrix profile', () => {
  const profile = getAgentMcpProfileById(C03_PERSON_ACTIVITY_OFFLINE_V2_PROFILE_ID);
  assert.equal(assertC03PersonActivityOfflineV2Profile(profile), true);
  const config = parseCodexOneToolMcpArguments([
    '--profile-id',
    C03_PERSON_ACTIVITY_OFFLINE_V2_PROFILE_ID,
    ...REQUIRED,
  ]);
  assert.equal(config.toolName, C03_PERSON_ACTIVITY_TOOL_NAME);
  assert.equal(config.networkMode, C03_PERSON_ACTIVITY_OFFLINE_V2_NETWORK_MODE);
  assert.deepEqual(config.expectedArgumentSequence, [
    C03_PERSON_ACTIVITY_OFFLINE_V2_EXPECTED_ARGUMENTS,
  ]);
  assert.equal(config.expectedToolSequence.length, 1);
  assert.throws(() =>
    parseCodexOneToolMcpArguments([
      '--profile-id',
      C03_PERSON_ACTIVITY_OFFLINE_V2_PROFILE_ID,
      '--network-mode',
      C03_PERSON_ACTIVITY_OFFLINE_V2_NETWORK_MODE,
      ...REQUIRED,
    ]),
  );
});

test('C03 v2 fixture serves only the fixed three ordered local GET requests', async () => {
  const profile = getAgentMcpProfileById(C03_PERSON_ACTIVITY_OFFLINE_V2_PROFILE_ID);
  const { fetchFn, snapshot } = createC03PersonActivityOfflineV2Fetch(profile);
  const paths = ['/v0/persons/991237', '/v0/persons/991237/characters', '/v0/subjects/991238'];
  for (const requestPath of paths) {
    const response = await fetchFn(new URL(requestPath, 'https://api.bgm.tv'));
    assert.equal(response.status, 200);
    await response.json();
  }
  assert.deepEqual(snapshot(), {
    profile: C03_PERSON_ACTIVITY_OFFLINE_V2_NETWORK_MODE,
    requestCount: 3,
    personRequestCount: 1,
    characterRequestCount: 1,
    subjectDetailRequestCount: 1,
    unexpectedRequestCount: 0,
    authorizationHeaderCount: 0,
    expectedOperationsComplete: true,
    operations: ['person', 'characters', 'subject_detail'],
  });
  const extra = await fetchFn(new URL(paths[0], 'https://api.bgm.tv'));
  assert.equal(extra.status, 404);
  assert.equal(snapshot().unexpectedRequestCount, 1);
  assert.equal(snapshot().expectedOperationsComplete, false);
});

test('C03 v2 summary is an exact bounded projection with no synthetic names or raw rows', () => {
  const projection = summarizeC03PersonActivityOfflineV2Result({
    state: 'partial',
    window: { months: 12 },
    summary: { uniqueSubjects: 1, byRole: [{ key: 'main', uniqueSubjects: 1 }] },
    coverage: {
      relationRowsObserved: 1,
      relationRowsSelected: 1,
      relationRowsDroppedAtLimit: 0,
      subjectDetailsSucceeded: 1,
      subjectDetailsFailed: 0,
      rowsEligible: 1,
      rowsReturned: 1,
      staffRoleUnknownRows: 0,
      outputTruncated: false,
      truncated: false,
    },
    rows: [{ subjectName: 'Synthetic Activity Work', staff: '主角' }],
  });
  assert.deepEqual(
    Object.keys(projection).sort(),
    [...C03_PERSON_ACTIVITY_OFFLINE_V2_PROJECTION_KEYS].sort(),
  );
  assert.deepEqual(
    Object.keys(projection.coverage).sort(),
    [...C03_PERSON_ACTIVITY_OFFLINE_V2_COVERAGE_KEYS].sort(),
  );
  assert.equal(isC03PersonActivityOfflineV2Projection(projection), true);
  assert.equal(JSON.stringify(projection).includes('Synthetic Activity Work'), false);
  assert.equal(JSON.stringify(projection).includes('主角'), false);
  assert.equal(isC03PersonActivityOfflineV2Projection({ ...projection, rawRows: [] }), false);
  assert.deepEqual(C03_PERSON_ACTIVITY_OFFLINE_V2_OUTPUT_SCHEMA.required, [
    ...C03_PERSON_ACTIVITY_OFFLINE_V2_PROJECTION_KEYS,
  ]);
  assert.equal(C03_PERSON_ACTIVITY_OFFLINE_V2_OUTPUT_SCHEMA.additionalProperties, false);
});

test('MCP server wires the v2 profile to its synthetic fixture and sanitized projection', () => {
  const source = readFileSync(
    new URL('../../apps/mcp/codex-one-tool-mcp-server.mjs', import.meta.url),
    'utf8',
  );
  assert.match(source, /assertC03PersonActivityOfflineV2Profile/u);
  assert.match(source, /createC03PersonActivityOfflineV2Fetch\(config\.profile\)/u);
  assert.match(source, /C03_ACTIVITY_V2_SUMMARY_UNAVAILABLE/u);
});
