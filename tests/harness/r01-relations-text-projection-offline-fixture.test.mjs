import assert from 'node:assert/strict';
import test from 'node:test';
import { getAgentMcpProfileById } from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import {
  assertR01RelationsTextProjectionOfflineProfile,
  R01_RELATIONS_TEXT_PROJECTION_OFFLINE_EXPECTED_ARGUMENTS,
  R01_RELATIONS_TEXT_PROJECTION_OFFLINE_NETWORK_MODE,
  R01_RELATIONS_TEXT_PROJECTION_OFFLINE_PROFILE_ID,
  R01_RELATIONS_TEXT_PROJECTION_OFFLINE_ROW_COUNT,
  R01_RELATIONS_TEXT_PROJECTION_OFFLINE_SUBJECT_ID,
  r01RelationsTextProjectionSyntheticRows,
  summarizeR01RelationsTextProjectionToolResult,
} from '../../scripts/lib/r01-relations-text-projection-offline-profile.mjs';
import { createR01RelationsTextProjectionOfflineFetch } from '../../scripts/lib/r01-relations-text-projection-offline-fixture.mjs';
import { parseCodexOneToolMcpArguments } from '../../scripts/lib/codex-one-tool-mcp-arguments.mjs';

const PROFILE = getAgentMcpProfileById(R01_RELATIONS_TEXT_PROJECTION_OFFLINE_PROFILE_ID);
const URL = `https://api.bgm.tv/v0/subjects/${R01_RELATIONS_TEXT_PROJECTION_OFFLINE_SUBJECT_ID}/subjects`;

test('R01 v2 binds a unique one-call synthetic text-projection profile', () => {
  assert.equal(assertR01RelationsTextProjectionOfflineProfile(PROFILE), true);
  assert.equal(PROFILE.acceptanceScope, 'agent-mcp-matrix-only');
  assert.equal(PROFILE.calls.length, 1);
  const config = parseCodexOneToolMcpArguments([
    '--profile-id',
    R01_RELATIONS_TEXT_PROJECTION_OFFLINE_PROFILE_ID,
    '--summary-file',
    '/tmp/r01-text-projection-summary.json',
    '--candidate-sha',
    'a'.repeat(40),
    '--bundle-sha256',
    'b'.repeat(64),
  ]);
  assert.equal(config.toolName, 'bangumi.get_subject_relations');
  assert.equal(config.networkMode, R01_RELATIONS_TEXT_PROJECTION_OFFLINE_NETWORK_MODE);
  assert.deepEqual(config.expectedArgumentSequence, [
    R01_RELATIONS_TEXT_PROJECTION_OFFLINE_EXPECTED_ARGUMENTS,
  ]);
  assert.throws(() =>
    parseCodexOneToolMcpArguments([
      '--profile-id',
      R01_RELATIONS_TEXT_PROJECTION_OFFLINE_PROFILE_ID,
      '--network-mode',
      R01_RELATIONS_TEXT_PROJECTION_OFFLINE_NETWORK_MODE,
      '--summary-file',
      '/tmp/r01-text-projection-summary.json',
      '--candidate-sha',
      'a'.repeat(40),
      '--bundle-sha256',
      'b'.repeat(64),
    ]),
  );
  assert.throws(() =>
    assertR01RelationsTextProjectionOfflineProfile({
      ...PROFILE,
      calls: [
        { toolName: PROFILE.toolName, arguments: { subjectId: 990902, includeEvidence: true } },
      ],
    }),
  );
});

test('R01 v2 fixture returns exactly 30 deterministic synthetic direct relations', async () => {
  const fixture = createR01RelationsTextProjectionOfflineFetch();
  const response = await fixture.fetchFn(URL);
  assert.equal(response.status, 200);
  const rows = await response.json();
  assert.equal(rows.length, R01_RELATIONS_TEXT_PROJECTION_OFFLINE_ROW_COUNT);
  assert.deepEqual(rows, r01RelationsTextProjectionSyntheticRows());
  assert.deepEqual(fixture.snapshot(), {
    profile: R01_RELATIONS_TEXT_PROJECTION_OFFLINE_NETWORK_MODE,
    requestCount: 1,
    relationRequestCount: 1,
    duplicateRequestCount: 0,
    unexpectedRequestCount: 0,
    authorizationHeaderCount: 0,
    expectedOperationsComplete: true,
  });
});

test('R01 v2 fixture rejects every route except its exact anonymous relation request', async () => {
  const invalidCalls = [
    [`${URL}?limit=1`, undefined],
    [URL, { method: 'POST' }],
    [URL, { headers: { authorization: 'Bearer synthetic' } }],
    ['https://example.test/v0/subjects/991408/subjects', undefined],
    ['https://api.bgm.tv/v0/subjects/991409/subjects', undefined],
    [{ url: URL, method: 'GET', body: '{}' }, undefined],
  ];
  for (const [url, init] of invalidCalls) {
    const fixture = createR01RelationsTextProjectionOfflineFetch();
    assert.equal((await fixture.fetchFn(url, init)).status, 599);
    assert.equal(fixture.snapshot().unexpectedRequestCount, 1);
  }
  const duplicate = createR01RelationsTextProjectionOfflineFetch();
  await duplicate.fetchFn(URL);
  assert.equal((await duplicate.fetchFn(URL)).status, 599);
  assert.equal(duplicate.snapshot().duplicateRequestCount, 1);
  const body = createR01RelationsTextProjectionOfflineFetch();
  assert.equal((await body.fetchFn(URL, { body: '{}' })).status, 599);
  assert.equal(body.snapshot().unexpectedRequestCount, 1);

  const requestWithoutBody = createR01RelationsTextProjectionOfflineFetch();
  assert.equal((await requestWithoutBody.fetchFn(new Request(URL, { method: 'GET' }))).status, 200);
});

test('R01 v2 source summary accepts only the exact complete synthetic fixture', () => {
  const result = {
    state: 'observed',
    subjectId: R01_RELATIONS_TEXT_PROJECTION_OFFLINE_SUBJECT_ID,
    source: {
      operation: 'GET /v0/subjects/{subject_id}/subjects',
      direction: 'source_subject_to_returned_target',
      scope: 'visible_direct_rows_returned_for_source_subject',
    },
    coverage: {
      responseRowsObserved: R01_RELATIONS_TEXT_PROJECTION_OFFLINE_ROW_COUNT,
      rowsReturned: R01_RELATIONS_TEXT_PROJECTION_OFFLINE_ROW_COUNT,
      schemaDriftRows: 0,
      truncated: false,
      paginationAvailable: false,
      totalCountAvailable: false,
      completeness: 'not_provided_by_source',
    },
    items: r01RelationsTextProjectionSyntheticRows().map(({ id, name, name_cn, relation }) => ({
      id,
      type: 'anime',
      name,
      nameCn: name_cn,
      relation,
    })),
  };
  const summary = summarizeR01RelationsTextProjectionToolResult(
    result,
    R01_RELATIONS_TEXT_PROJECTION_OFFLINE_EXPECTED_ARGUMENTS,
  );
  assert.deepEqual(summary, {
    state: 'observed',
    sourceRowsObserved: 30,
    sourceRowsReturned: 30,
    sourceSchemaDriftRows: 0,
    sourceTruncated: false,
    paginationAvailable: false,
    totalCountAvailable: false,
    completeness: 'not_provided_by_source',
  });
  assert.equal(JSON.stringify(summary).includes('991409'), false);
  assert.equal(JSON.stringify(summary).includes('Synthetic R01'), false);
  assert.equal(
    summarizeR01RelationsTextProjectionToolResult(
      { ...result, coverage: { ...result.coverage, rowsReturned: 29 } },
      R01_RELATIONS_TEXT_PROJECTION_OFFLINE_EXPECTED_ARGUMENTS,
    ),
    null,
  );
  assert.equal(
    summarizeR01RelationsTextProjectionToolResult(result, {
      subjectId: 990902,
      includeEvidence: true,
    }),
    null,
  );
});
