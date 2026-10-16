import assert from 'node:assert/strict';
import test from 'node:test';
import { getAgentMcpProfileById } from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import { parseCodexOneToolMcpArguments } from '../../scripts/lib/codex-one-tool-mcp-arguments.mjs';
import { summarizeProfileToolResult } from '../../scripts/lib/codex-profile-tool-summary.mjs';
import {
  assertR02PositiveDirectRelationsProfile,
  createR02PositiveDirectRelationsPublicFetch,
  expectedR02PositiveDirectRelationsRequestScope,
  r02PositiveDirectRelationsRequestScopeIsValid,
  R02_POSITIVE_DIRECT_RELATIONS_EXPECTED_CALLS,
  R02_POSITIVE_DIRECT_RELATIONS_EXPECTED_RESULT_SUMMARIES,
  R02_POSITIVE_DIRECT_RELATIONS_NETWORK_MODE,
  R02_POSITIVE_DIRECT_RELATIONS_PROFILE_ID,
} from '../../scripts/lib/r02-positive-direct-relations-profile.mjs';

const PROFILE = getAgentMcpProfileById(R02_POSITIVE_DIRECT_RELATIONS_PROFILE_ID);
const BASE_ARGS = [
  '--profile-id',
  PROFILE.id,
  '--summary-file',
  '/tmp/r02-summary.json',
  '--candidate-sha',
  'a'.repeat(40),
  '--bundle-sha256',
  'b'.repeat(64),
];

test('R02 registry profile is the exact bounded sequence of three direct relation calls', () => {
  assert.equal(assertR02PositiveDirectRelationsProfile(PROFILE), true);
  assert.deepEqual(PROFILE.calls, R02_POSITIVE_DIRECT_RELATIONS_EXPECTED_CALLS);
  assert.equal(PROFILE.networkMode, R02_POSITIVE_DIRECT_RELATIONS_NETWORK_MODE);
  const parsed = parseCodexOneToolMcpArguments(BASE_ARGS);
  assert.deepEqual(parsed.expectedToolSequence, [
    'bangumi.get_subject_relations',
    'bangumi.get_subject_relations',
    'bangumi.get_subject_relations',
  ]);
  assert.deepEqual(
    parsed.expectedArgumentSequence,
    PROFILE.calls.map((call) => call.arguments),
  );
  assert.equal(parsed.networkMode, R02_POSITIVE_DIRECT_RELATIONS_NETWORK_MODE);
  assert.throws(() =>
    parseCodexOneToolMcpArguments([...BASE_ARGS, '--tool', 'bangumi.query_subjects']),
  );
});

function result(subjectId, targetRows, responseRowsObserved, overrides = {}) {
  const fillerRows = Array.from(
    { length: Math.max(0, responseRowsObserved - targetRows.length) },
    (_, index) => ({
      id: 500000 + index,
      relation: 'unrelated',
      name: 'This private title must not enter the projection.',
    }),
  );
  return {
    state: 'observed',
    subjectId,
    source: {
      direction: 'source_subject_to_returned_target',
      operation: 'GET /v0/subjects/{subject_id}/subjects',
    },
    coverage: {
      responseRowsObserved,
      rowsReturned: responseRowsObserved,
      schemaDriftRows: 0,
      truncated: false,
      paginationAvailable: false,
      totalCountAvailable: false,
      completeness: 'not_provided_by_source',
      ...overrides.coverage,
    },
    items: [...targetRows, ...fillerRows],
    ...overrides.result,
  };
}

test('R02 projection retains only the four expected direct IDs and raw labels', () => {
  const samples = [
    result(
      4923,
      [
        { id: 315, relation: '动画' },
        { id: 1428, relation: '动画' },
      ],
      53,
    ),
    result(315, [{ id: 1935, relation: '续集' }], 33),
    result(1428, [{ id: 10799, relation: '衍生' }], 41),
  ];
  const projected = samples.map((sample, index) =>
    summarizeProfileToolResult(sample, PROFILE.calls[index].arguments, PROFILE.id),
  );
  assert.deepEqual(projected, R02_POSITIVE_DIRECT_RELATIONS_EXPECTED_RESULT_SUMMARIES);
  assert.equal(JSON.stringify(projected).includes('private title'), false);
  assert.equal(JSON.stringify(projected).includes('unrelated'), false);
});

test('R02 projection rejects mismatched labels, missing rows, bad direction, and truncation', () => {
  const args = PROFILE.calls[0].arguments;
  const wrongLabel = result(
    4923,
    [
      { id: 315, relation: '续集' },
      { id: 1428, relation: '动画' },
    ],
    53,
  );
  assert.equal(summarizeProfileToolResult(wrongLabel, args, PROFILE.id), null);
  const missing = result(4923, [{ id: 315, relation: '动画' }], 52);
  assert.equal(summarizeProfileToolResult(missing, args, PROFILE.id), null);
  const wrongDirection = result(
    4923,
    [
      { id: 315, relation: '动画' },
      { id: 1428, relation: '动画' },
    ],
    53,
    {
      result: { source: { direction: 'target_to_source' } },
    },
  );
  assert.equal(summarizeProfileToolResult(wrongDirection, args, PROFILE.id), null);
  const truncated = result(
    4923,
    [
      { id: 315, relation: '动画' },
      { id: 1428, relation: '动画' },
    ],
    53,
    {
      coverage: { truncated: true },
    },
  );
  assert.equal(summarizeProfileToolResult(truncated, args, PROFILE.id), null);
});

test('R02 public fetch allows only three ordered anonymous official v0 GETs', async () => {
  const requests = [];
  const guard = createR02PositiveDirectRelationsPublicFetch({
    fetchImpl: async (input, init) => {
      requests.push({
        url: String(input),
        method: init.method,
        redirect: init.redirect,
        credentials: init.credentials,
        headers: Object.fromEntries(init.headers.entries()),
      });
      return new Response('[]', { status: 200 });
    },
  });
  for (const subjectId of [4923, 315, 1428]) {
    const response = await guard.fetchFn(`https://api.bgm.tv/v0/subjects/${subjectId}/subjects`, {
      headers: {
        Accept: 'application/json',
        'User-Agent':
          'Kurarion/BangumiAgentKit/0.1.0 (https://github.com/PariyaProject/BangumiAgentKit)',
      },
    });
    assert.equal(response.status, 200);
  }
  assert.equal(requests.length, 3);
  assert.deepEqual(
    requests.map(({ url }) => url),
    [
      'https://api.bgm.tv/v0/subjects/4923/subjects',
      'https://api.bgm.tv/v0/subjects/315/subjects',
      'https://api.bgm.tv/v0/subjects/1428/subjects',
    ],
  );
  assert.ok(
    requests.every(
      ({ method, redirect, credentials, headers }) =>
        method === 'GET' &&
        redirect === 'error' &&
        credentials === 'omit' &&
        headers.accept === 'application/json' &&
        headers['user-agent'] ===
          'Kurarion/BangumiAgentKit/0.1.0 (https://github.com/PariyaProject/BangumiAgentKit)',
    ),
  );
  assert.deepEqual(guard.snapshot(), expectedR02PositiveDirectRelationsRequestScope());
  assert.equal(r02PositiveDirectRelationsRequestScopeIsValid(guard.snapshot()), true);
});

test('R02 public fetch fails closed on credentials, writes, routes, order changes, and redirects', async () => {
  const cases = [
    [
      'https://api.bgm.tv/v0/subjects/4923/subjects',
      { headers: { Authorization: 'Bearer secret' } },
    ],
    ['https://api.bgm.tv/v0/subjects/4923/subjects', { headers: { 'X-Auth': 'secret' } }],
    ['https://api.bgm.tv/v0/subjects/4923/subjects', { headers: { 'X-BGM-Session': 'secret' } }],
    ['https://api.bgm.tv/v0/subjects/4923/subjects', { headers: { 'X-Unexpected': 'value' } }],
    [
      'https://api.bgm.tv/v0/subjects/4923/subjects',
      { headers: { 'User-Agent': 'Bearer secret' } },
    ],
    ['https://api.bgm.tv/v0/subjects/4923/subjects', { method: 'POST', body: '{}' }],
    ['https://example.com/v0/subjects/4923/subjects', {}],
    ['https://api.bgm.tv/v0/subjects/4923/subjects?offset=1', {}],
    ['https://api.bgm.tv/v0/subjects/315/subjects', {}],
  ];
  for (const [url, init] of cases) {
    const guard = createR02PositiveDirectRelationsPublicFetch({
      fetchImpl: async () => new Response('[]'),
    });
    await assert.rejects(guard.fetchFn(url, init));
    assert.equal(guard.snapshot().allowedRequestCount, 0);
    assert.equal(guard.snapshot().deniedRequestCount, 1);
    assert.equal(r02PositiveDirectRelationsRequestScopeIsValid(guard.snapshot()), false);
  }
  for (const credentials of ['include', 'same-origin']) {
    const guard = createR02PositiveDirectRelationsPublicFetch({
      fetchImpl: async () => new Response('[]'),
    });
    await assert.rejects(
      guard.fetchFn('https://api.bgm.tv/v0/subjects/4923/subjects', { credentials }),
    );
    assert.equal(guard.snapshot().credentialModeCount, 1);
    assert.equal(guard.snapshot().anonymousOnly, false);
  }
  const requestGuard = createR02PositiveDirectRelationsPublicFetch({
    fetchImpl: async () => new Response('[]'),
  });
  await assert.rejects(
    requestGuard.fetchFn(
      new Request('https://api.bgm.tv/v0/subjects/4923/subjects', { credentials: 'include' }),
    ),
  );
  assert.equal(requestGuard.snapshot().credentialModeCount, 1);
  assert.equal(requestGuard.snapshot().anonymousOnly, false);
  const redirectGuard = createR02PositiveDirectRelationsPublicFetch({
    fetchImpl: async () =>
      new Response(null, { status: 302, headers: { location: 'https://example.com' } }),
  });
  await assert.rejects(redirectGuard.fetchFn('https://api.bgm.tv/v0/subjects/4923/subjects'));
  assert.equal(redirectGuard.snapshot().allowedRequestCount, 1);
  assert.equal(redirectGuard.snapshot().requestsComplete, false);
});
