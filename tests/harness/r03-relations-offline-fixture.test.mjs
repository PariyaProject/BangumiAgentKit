import assert from 'node:assert/strict';
import test from 'node:test';
import { getAgentMcpProfileById } from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import {
  R03_TWO_HOP_RATING_OFFLINE_EXPECTED_CALLS,
  R03_TWO_HOP_RATING_OFFLINE_EXPECTED_RESULT_SUMMARIES,
  R03_TWO_HOP_RATING_OFFLINE_NETWORK_MODE,
  R03_TWO_HOP_RATING_OFFLINE_PROFILE_ID,
  R03_RELATIONS_OFFLINE_EXPECTED_CALLS,
  R03_RELATIONS_OFFLINE_NETWORK_MODE,
  R03_RELATIONS_OFFLINE_PROFILE_ID,
  summarizeR03RelationsOfflineToolResult,
  assertR03RelationsOfflineProfile,
} from '../../scripts/lib/r03-relations-offline-profile.mjs';
import { createR03RelationsOfflineFetch } from '../../scripts/lib/r03-relations-offline-fixture.mjs';
import { parseCodexOneToolMcpArguments } from '../../scripts/lib/codex-one-tool-mcp-arguments.mjs';
import { summarizeProfileToolResult } from '../../scripts/lib/codex-profile-tool-summary.mjs';

const PROFILE = getAgentMcpProfileById(R03_RELATIONS_OFFLINE_PROFILE_ID);
const REQUIRED = [
  '--summary-file',
  '/tmp/r03-summary.json',
  '--candidate-sha',
  'a'.repeat(40),
  '--bundle-sha256',
  'b'.repeat(64),
];
const DIRECT_URL = 'https://api.bgm.tv/v0/subjects/991020/subjects';
const TWO_HOP_URLS = [
  'https://api.bgm.tv/v0/subjects/993811/subjects',
  'https://api.bgm.tv/v0/subjects/993812/subjects',
  'https://api.bgm.tv/v0/subjects/993812',
  'https://api.bgm.tv/v0/subjects/993813',
];
const HTTP_HEADERS = {
  accept: 'application/json',
  'user-agent': 'Kurarion/BangumiAgentKit/0.1.0 (https://github.com/PariyaProject/BangumiAgentKit)',
};

const result = (subjectId, items) => ({
  subjectId,
  state: 'observed',
  source: { direction: 'source_subject_to_returned_target' },
  coverage: {
    completeness: 'not_provided_by_source',
    paginationAvailable: false,
    totalCountAvailable: false,
    truncated: false,
    responseRowsObserved: items.length,
    rowsReturned: items.length,
    schemaDriftRows: 0,
  },
  items,
});

test('R03 profile v2 binds exactly one synthetic direct-relation read', () => {
  assert.equal(assertR03RelationsOfflineProfile(PROFILE), true);
  const config = parseCodexOneToolMcpArguments([
    '--profile-id',
    R03_RELATIONS_OFFLINE_PROFILE_ID,
    ...REQUIRED,
  ]);
  assert.equal(config.toolName, 'bangumi.get_subject_relations');
  assert.equal(config.networkMode, R03_RELATIONS_OFFLINE_NETWORK_MODE);
  assert.deepEqual(
    config.expectedArgumentSequence,
    R03_RELATIONS_OFFLINE_EXPECTED_CALLS.map((call) => call.arguments),
  );
  assert.equal(config.profile.acceptanceScope, 'agent-mcp-matrix-only');
  assert.equal(
    assertR03RelationsOfflineProfile(
      getAgentMcpProfileById('r03-two-hop-relations-offline-agent-mcp-v1'),
    ),
    false,
  );
  assert.throws(() =>
    assertR03RelationsOfflineProfile({
      ...PROFILE,
      calls: [
        { toolName: PROFILE.toolName, arguments: { subjectId: 991022, includeEvidence: true } },
      ],
    }),
  );
  assert.throws(() =>
    parseCodexOneToolMcpArguments([
      '--profile-id',
      R03_RELATIONS_OFFLINE_PROFILE_ID,
      '--network-mode',
      R03_RELATIONS_OFFLINE_NETWORK_MODE,
      ...REQUIRED,
    ]),
  );
});

test('R03 fixture returns one bounded synthetic direct-relation response', async () => {
  const fixture = createR03RelationsOfflineFetch();
  const direct = await fixture.fetchFn(DIRECT_URL, { headers: HTTP_HEADERS });
  assert.equal(direct.status, 200);
  assert.deepEqual(await direct.json(), [
    {
      id: 991021,
      type: 2,
      name: 'Synthetic R03 matrix target 991021',
      name_cn: '合成 R03 矩阵目标 991021',
      relation: '续篇',
    },
  ]);
  assert.deepEqual(fixture.snapshot(), {
    profile: R03_RELATIONS_OFFLINE_NETWORK_MODE,
    requestCount: 1,
    relationRequestCount: 1,
    rootRequestCount: 1,
    intermediateRequestCount: 0,
    duplicateRequestCount: 0,
    unexpectedRequestCount: 0,
    authorizationHeaderCount: 0,
    expectedOperationsComplete: true,
  });
});

test('R03 fixture rejects unregistered routes, requests, authorization, and duplicates', async () => {
  const invalidCalls = [
    [`${DIRECT_URL}?limit=1`, { headers: HTTP_HEADERS }],
    [DIRECT_URL, undefined],
    [DIRECT_URL, { headers: { ...HTTP_HEADERS, 'x-unexpected': 'value' } }],
    [DIRECT_URL, { headers: { ...HTTP_HEADERS, 'user-agent': 'unexpected' } }],
    [DIRECT_URL, { method: 'POST', headers: HTTP_HEADERS }],
    [DIRECT_URL, { headers: { ...HTTP_HEADERS, authorization: 'Bearer synthetic' } }],
    ['https://example.test/v0/subjects/991020/subjects', { headers: HTTP_HEADERS }],
    ['https://api.bgm.tv/v0/subjects/991022/subjects', { headers: HTTP_HEADERS }],
  ];
  for (const [url, init] of invalidCalls) {
    const fixture = createR03RelationsOfflineFetch();
    assert.equal((await fixture.fetchFn(url, init)).status, 599);
    assert.equal(fixture.snapshot().unexpectedRequestCount, 1);
  }
  const duplicate = createR03RelationsOfflineFetch();
  await duplicate.fetchFn(DIRECT_URL, { headers: HTTP_HEADERS });
  assert.equal((await duplicate.fetchFn(DIRECT_URL, { headers: HTTP_HEADERS })).status, 599);
  assert.equal(duplicate.snapshot().duplicateRequestCount, 1);
  const body = createR03RelationsOfflineFetch();
  assert.equal((await body.fetchFn(DIRECT_URL, { ...HTTP_HEADERS, body: '{}' })).status, 599);
});

test('R03 two-hop fixture permits only its four exact anonymous GETs', async () => {
  const profile = getAgentMcpProfileById(R03_TWO_HOP_RATING_OFFLINE_PROFILE_ID);
  assert.equal(assertR03RelationsOfflineProfile(profile), true);
  const config = parseCodexOneToolMcpArguments([
    '--profile-id',
    R03_TWO_HOP_RATING_OFFLINE_PROFILE_ID,
    ...REQUIRED,
  ]);
  assert.equal(config.networkMode, R03_TWO_HOP_RATING_OFFLINE_NETWORK_MODE);
  assert.deepEqual(config.expectedArgumentSequence, [
    { subjectId: 993811, analysisMode: 'observed_two_hop_rating' },
  ]);

  const fixture = createR03RelationsOfflineFetch(profile);
  const responses = await Promise.all(
    TWO_HOP_URLS.map((url) => fixture.fetchFn(url, { headers: HTTP_HEADERS })),
  );
  assert.deepEqual(responses.map((response) => response.status), [200, 200, 200, 200]);
  assert.deepEqual(await responses[0].json(), [
    {
      id: 993812,
      type: 2,
      name: 'Synthetic R03 intermediate 993812',
      name_cn: '合成 R03 中间作品 993812',
      relation: '续集',
    },
  ]);
  assert.deepEqual(await responses[1].json(), [
    {
      id: 993813,
      type: 2,
      name: 'Synthetic R03 target 993813',
      name_cn: '合成 R03 目标 993813',
      relation: '续集',
    },
  ]);
  assert.equal((await responses[2].json()).rating.score, 8.1);
  assert.equal((await responses[3].json()).rating.score, 9.2);
  assert.deepEqual(fixture.snapshot(), {
    profile: R03_TWO_HOP_RATING_OFFLINE_NETWORK_MODE,
    requestCount: 4,
    relationRequestCount: 2,
    rootRequestCount: 1,
    intermediateRequestCount: 1,
    subjectDetailRequestCount: 2,
    duplicateRequestCount: 0,
    unexpectedRequestCount: 0,
    authorizationHeaderCount: 0,
    expectedOperationsComplete: true,
  });
  assert.equal(
    (await fixture.fetchFn(TWO_HOP_URLS[0] + '?limit=24', { headers: HTTP_HEADERS })).status,
    599,
  );
  assert.equal(fixture.snapshot().unexpectedRequestCount, 1);
});

test('R03 two-hop result summary binds the top score and exact two-hop path', () => {
  const expected = R03_TWO_HOP_RATING_OFFLINE_EXPECTED_RESULT_SUMMARIES[0];
  const result = {
    state: 'observed',
    subjectId: 993811,
    source: {
      api: 'Bangumi official v0',
      direction: 'outgoing_source_to_target',
      scope: 'highest_observed_rating_in_bounded_two_hop_sample',
      operations: [
        {
          operation: 'GET /v0/subjects/{subject_id}/subjects',
          path: '/v0/subjects/993811/subjects',
          subjectId: 993811,
          depth: 0,
          status: 'succeeded',
          responseRowsObserved: 1,
          rowsReturned: 1,
          schemaDriftRows: 0,
        },
        {
          operation: 'GET /v0/subjects/{subject_id}/subjects',
          path: '/v0/subjects/993812/subjects',
          subjectId: 993812,
          depth: 1,
          status: 'succeeded',
          responseRowsObserved: 1,
          rowsReturned: 1,
          schemaDriftRows: 0,
        },
        {
          operation: 'GET /v0/subjects/{subject_id}',
          path: '/v0/subjects/993812',
          subjectId: 993812,
          depth: 1,
          status: 'succeeded',
        },
        {
          operation: 'GET /v0/subjects/{subject_id}',
          path: '/v0/subjects/993813',
          subjectId: 993813,
          depth: 2,
          status: 'succeeded',
        },
      ],
    },
    warnings: [],
    ratingAnalysis: {
      mode: 'observed_two_hop_rating',
      maxDepth: 2,
      topScore: 9.2,
      topCandidateCount: 1,
      topCandidatesOmitted: 0,
      scoredCandidateCount: 2,
      tiePolicy: 'exact_numeric_score_ties_are_preserved',
      topCandidates: [{
        id: 993813,
        score: 9.2,
        ratingTotal: 37,
        paths: [{
          sourceId: 993811,
          targetId: 993813,
          subjectIds: [993811, 993812, 993813],
          depth: 2,
          relationLabels: ['续集', '续集'],
        }],
      }],
    },
    coverage: {
      rootRelationRowsObserved: 1,
      rootRelationRowsSelected: 1,
      rootRelationRowsOmitted: 0,
      rootRelationSchemaDriftRows: 0,
      intermediateSubjectsObserved: 1,
      intermediateSubjectsSelected: 1,
      intermediateSubjectsOmitted: 0,
      intermediateRelationRowsObserved: 1,
      intermediateRelationRowsSelected: 1,
      intermediateRelationRowsOmitted: 0,
      intermediateRelationSchemaDriftRows: 0,
      depth1CandidatesObserved: 1,
      depth1CandidatesSelected: 1,
      depth1CandidatesOmitted: 0,
      depth2CandidatesObserved: 1,
      depth2CandidatesSelected: 1,
      depth2CandidatesOmitted: 0,
      detailRequestsAttempted: 2,
      detailRequestsSucceeded: 2,
      detailRequestsFailed: 0,
      usableRatings: 2,
      missingRatings: 0,
      duplicateRelationRows: 0,
      cycleEdgesSkipped: 0,
      pathEvidenceOmitted: 0,
      truncated: false,
      partialReasons: [],
      requestBudget: {
        maxResponseBytesPerRequest: 1_048_576,
        logicalRequestsAttempted: 4,
        maxLogicalRequests: 11,
        maxAttemptsPerLogicalRequest: 3,
        maximumPossibleWireAttempts: 33,
      },
    },
  };
  assert.deepEqual(
    summarizeProfileToolResult(
      result,
      R03_TWO_HOP_RATING_OFFLINE_EXPECTED_CALLS[0].arguments,
      R03_TWO_HOP_RATING_OFFLINE_PROFILE_ID,
    ),
    expected,
  );
  assert.equal(
    summarizeR03RelationsOfflineToolResult(
      {
        ...result,
        ratingAnalysis: {
          ...result.ratingAnalysis,
          topCandidates: [{ ...result.ratingAnalysis.topCandidates[0], score: 9.3 }],
        },
      },
      R03_TWO_HOP_RATING_OFFLINE_EXPECTED_CALLS[0].arguments,
      R03_TWO_HOP_RATING_OFFLINE_PROFILE_ID,
    ),
    null,
  );
  assert.equal(
    summarizeR03RelationsOfflineToolResult(
      {
        ...result,
        ratingAnalysis: {
          ...result.ratingAnalysis,
          topCandidates: [{
            ...result.ratingAnalysis.topCandidates[0],
            paths: [
              ...result.ratingAnalysis.topCandidates[0].paths,
              {
                sourceId: 993811,
                targetId: 993813,
                subjectIds: [993811, 993814, 993813],
                depth: 2,
                relationLabels: ['续集', '续集'],
              },
            ],
          }],
        },
      },
      R03_TWO_HOP_RATING_OFFLINE_EXPECTED_CALLS[0].arguments,
      R03_TWO_HOP_RATING_OFFLINE_PROFILE_ID,
    ),
    null,
  );
});

test('R03 summaries omit synthetic IDs, names, and raw relation rows', () => {
  const directResult = result(991020, [
    { id: 991021, name: 'private fixture name', relation: '续篇' },
  ]);
  const directSummary = summarizeProfileToolResult(
    directResult,
    R03_RELATIONS_OFFLINE_EXPECTED_CALLS[0].arguments,
    R03_RELATIONS_OFFLINE_PROFILE_ID,
  );
  assert.equal(directSummary.responseRowsObserved, 1);
  assert.deepEqual(directSummary.relationLabels, ['续篇']);
  const encoded = JSON.stringify(directSummary);
  assert.equal(encoded.includes('9910'), false);
  assert.equal(encoded.includes('private'), false);
  assert.equal(
    summarizeR03RelationsOfflineToolResult(directResult, {
      subjectId: 991099,
      includeEvidence: true,
    }),
    null,
  );
  assert.equal(
    summarizeR03RelationsOfflineToolResult(
      { ...directResult, items: [{ ...directResult.items[0], id: 991099 }] },
      R03_RELATIONS_OFFLINE_EXPECTED_CALLS[0].arguments,
    ),
    null,
  );
});
