import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parseCodexOneToolMcpArguments } from '../../scripts/lib/codex-one-tool-mcp-arguments.mjs';
import { profileRequiresExactCiRunEvidence } from '../../scripts/lib/agent-mcp-profile-ci-evidence.mjs';
import { getAgentMcpProfileById } from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import {
  assertP01PersonActivityDirectorOfflineProfile,
  P01_PERSON_ACTIVITY_DIRECTOR_OFFLINE_ARGUMENT_PROFILE,
  P01_PERSON_ACTIVITY_DIRECTOR_OFFLINE_EXPECTED_ARGUMENTS,
  P01_PERSON_ACTIVITY_DIRECTOR_OFFLINE_NETWORK_MODE,
  P01_PERSON_ACTIVITY_DIRECTOR_OFFLINE_OUTPUT_SCHEMA,
  P01_PERSON_ACTIVITY_DIRECTOR_OFFLINE_PROFILE_ID,
  P01_PERSON_ACTIVITY_DIRECTOR_TOOL_NAME,
  createP01PersonActivityDirectorOfflineFetch,
  isP01PersonActivityDirectorOfflineProjection,
  summarizeP01PersonActivityDirectorOfflineResult,
} from '../../scripts/lib/p01-person-activity-director-offline-profile.mjs';

const REQUIRED = [
  '--summary-file',
  '/tmp/p01-director-summary.json',
  '--candidate-sha',
  'a'.repeat(40),
  '--bundle-sha256',
  'b'.repeat(64),
];

test('P01 director profile is distinct, registered, fixed, and requires exact CI evidence', () => {
  const profile = getAgentMcpProfileById(P01_PERSON_ACTIVITY_DIRECTOR_OFFLINE_PROFILE_ID);
  assert.equal(assertP01PersonActivityDirectorOfflineProfile(profile), true);
  assert.equal(profile.argumentProfile, P01_PERSON_ACTIVITY_DIRECTOR_OFFLINE_ARGUMENT_PROFILE);
  assert.equal(profileRequiresExactCiRunEvidence(profile.id), true);
  const config = parseCodexOneToolMcpArguments([
    '--profile-id',
    profile.id,
    ...REQUIRED,
  ]);
  assert.equal(config.toolName, P01_PERSON_ACTIVITY_DIRECTOR_TOOL_NAME);
  assert.equal(config.networkMode, P01_PERSON_ACTIVITY_DIRECTOR_OFFLINE_NETWORK_MODE);
  assert.deepEqual(config.expectedArgumentSequence, [P01_PERSON_ACTIVITY_DIRECTOR_OFFLINE_EXPECTED_ARGUMENTS]);
  assert.deepEqual(config.expectedToolSequence, [P01_PERSON_ACTIVITY_DIRECTOR_TOOL_NAME]);
  assert.equal(P01_PERSON_ACTIVITY_DIRECTOR_OFFLINE_OUTPUT_SCHEMA.additionalProperties, false);

  const changed = { ...profile, networkMode: 'network' };
  assert.equal(assertP01PersonActivityDirectorOfflineProfile(changed), false);
  assert.equal(profileRequiresExactCiRunEvidence('c03-person-activity-offline-agent-mcp-matrix-v2'), true);
});

test('P01 fixture allows only the three ordered anonymous GETs and denies repeats', async () => {
  const profile = getAgentMcpProfileById(P01_PERSON_ACTIVITY_DIRECTOR_OFFLINE_PROFILE_ID);
  const { fetchFn, snapshot } = createP01PersonActivityDirectorOfflineFetch(profile);
  const person = await fetchFn('https://api.bgm.tv/v0/persons/991337');
  assert.equal(person.status, 200);
  const relations = await fetchFn('https://api.bgm.tv/v0/persons/991337/subjects');
  assert.equal(relations.status, 200);
  const relationRows = await relations.json();
  assert.equal(relationRows.length, 3);
  assert.equal(relationRows.filter((row) => row.staff === 'director').length, 1);
  assert.equal(relationRows.filter((row) => row.staff === 'script').length, 1);
  assert.equal(relationRows.filter((row) => row.staff === '').length, 1);
  const detail = await fetchFn('https://api.bgm.tv/v0/subjects/991338');
  assert.equal(detail.status, 200);
  assert.deepEqual(snapshot(), {
    profile: P01_PERSON_ACTIVITY_DIRECTOR_OFFLINE_NETWORK_MODE,
    requestCount: 3,
    personRequestCount: 1,
    subjectsRequestCount: 1,
    subjectDetailRequestCount: 1,
    unexpectedRequestCount: 0,
    authorizationHeaderCount: 0,
    expectedOperationsComplete: true,
    operations: ['person', 'subjects', 'subject_detail'],
  });
  const repeated = await fetchFn('https://api.bgm.tv/v0/persons/991337');
  assert.equal(repeated.status, 404);
  assert.equal(snapshot().expectedOperationsComplete, false);
});

test('P01 fixture denies auth headers, external origins, queries, and writes', async () => {
  const profile = getAgentMcpProfileById(P01_PERSON_ACTIVITY_DIRECTOR_OFFLINE_PROFILE_ID);
  const auth = createP01PersonActivityDirectorOfflineFetch(profile);
  assert.equal(
    (await auth.fetchFn('https://api.bgm.tv/v0/persons/991337', {
      headers: { authorization: 'synthetic-test-only' },
    })).status,
    401,
  );
  assert.equal(auth.snapshot().authorizationHeaderCount, 1);
  assert.equal(auth.snapshot().expectedOperationsComplete, false);

  const denied = createP01PersonActivityDirectorOfflineFetch(profile);
  for (const [url, method] of [
    ['https://example.invalid/v0/persons/991337', 'GET'],
    ['https://api.bgm.tv/v0/persons/991337?limit=1', 'GET'],
    ['https://api.bgm.tv/v0/persons/991337', 'POST'],
  ]) {
    const response = await denied.fetchFn(url, { method });
    assert.equal(response.status, 404);
  }
  assert.equal(denied.snapshot().unexpectedRequestCount, 3);
  assert.equal(denied.snapshot().expectedOperationsComplete, false);

  const body = createP01PersonActivityDirectorOfflineFetch(profile);
  assert.equal(
    (await body.fetchFn('https://api.bgm.tv/v0/persons/991337', { method: 'GET', body: 'x' })).status,
    404,
  );
  assert.equal(body.snapshot().expectedOperationsComplete, false);
});

test('P01 summary exposes bounded filter and coverage counts without source rows', () => {
  const projection = summarizeP01PersonActivityDirectorOfflineResult({
    state: 'partial',
    window: { months: 36 },
    coverage: {
      relationRowsObserved: 3,
      relationRowsSelected: 1,
      relationRowsDroppedAtLimit: 0,
      subjectDetailsSucceeded: 1,
      subjectDetailsFailed: 0,
      rowsEligible: 1,
      rowsReturned: 1,
      staffRoleExcludedRows: 2,
      staffRoleUnknownRows: 1,
      outputTruncated: false,
      truncated: false,
    },
    rows: [{ subjectName: 'Synthetic Director Match', rawRole: 'director' }],
  });
  assert.deepEqual(projection, {
    resultState: 'partial',
    windowMonths: 36,
    matchedDirectorRows: 1,
    excludedOtherRoleRows: 1,
    unknownRoleRows: 1,
    coverage: {
      relationRowsObserved: 3,
      relationRowsSelected: 1,
      relationRowsDroppedAtLimit: 0,
      subjectDetailsSucceeded: 1,
      subjectDetailsFailed: 0,
      rowsEligible: 1,
      rowsReturned: 1,
      outputTruncated: false,
      truncated: false,
    },
  });
  assert.equal(isP01PersonActivityDirectorOfflineProjection(projection), true);
  assert.equal(JSON.stringify(projection).includes('Synthetic Director Match'), false);
  assert.equal(isP01PersonActivityDirectorOfflineProjection({ ...projection, rawRows: [] }), false);
});

test('MCP server and result summarizer dispatch the P01 profile to its bounded fixture', () => {
  const source = readFileSync(
    new URL('../../apps/mcp/codex-one-tool-mcp-server.mjs', import.meta.url),
    'utf8',
  );
  assert.match(source, /assertP01PersonActivityDirectorOfflineProfile/u);
  assert.match(source, /createP01PersonActivityDirectorOfflineFetch\(config\.profile\)/u);
  assert.match(source, /P01_DIRECTOR_SUMMARY_UNAVAILABLE/u);
});
