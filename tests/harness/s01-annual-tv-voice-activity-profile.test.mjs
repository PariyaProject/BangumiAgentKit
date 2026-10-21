import assert from 'node:assert/strict';
import test from 'node:test';
import { getAgentMcpProfileById } from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import {
  assertS01AnnualTvVoiceProfile,
  createS01AnnualTvPublicFetch,
  expectedS01PublicRequestScope,
  S01_CANONICAL_CAVEAT,
  S01_EXPECTED_ARGUMENTS,
  S01_MAX_RESPONSE_BYTES,
  S01_PROFILE_ID,
  summarizeS01AnnualTvVoiceResult,
  validateS01McpTextProjection,
  verifyS01AnnualTvVoiceAnswer,
} from '../../scripts/lib/s01-annual-tv-voice-activity-profile.mjs';

const ALLOWED_HEADERS = {
  accept: 'application/json',
  'user-agent':
    'Kurarion/BangumiAgentKit/0.1.0 (https://github.com/PariyaProject/BangumiAgentKit)',
};

function makeResult(overrides = {}) {
  const coverage = {
    relationRowsObserved: 4,
    relationRowsSelected: 4,
    relationRowsDroppedAtLimit: 0,
    sampled: false,
    subjectIdsObserved: 4,
    subjectIdsSelected: 4,
    subjectIdsDroppedAtRelationLimit: 0,
    subjectDetailIdsObserved: 4,
    subjectDetailRequests: 4,
    subjectDetailsSucceeded: 4,
    subjectDetailsFailed: 0,
    subjectDetailIdsDroppedAtLimit: 0,
    rowsEligible: 4,
    rowsReturned: 4,
    outputTruncated: false,
    uniqueSubjects: 4,
    uniqueCharacters: 3,
    missingSubjectIdRows: 0,
    missingDateRows: 0,
    invalidDateRows: 0,
    maxRelations: 48,
    maxSubjectDetails: 16,
    maxRows: 8,
    truncated: false,
    retrievedAt: '2026-10-21T00:00:00.000Z',
  };
  return {
    personId: S01_EXPECTED_ARGUMENTS.personId,
    state: 'complete',
    kind: 'voice',
    media: 'tv',
    window: {
      months: 36,
      start: '2023-11-01',
      end: '2026-10-21',
      asOfSemantics: 'calendar_months_ending_on_as_of_date',
    },
    rows: [{}, {}, {}, {}],
    summary: {
      creditRows: 4,
      uniqueSubjects: 4,
      uniqueCharacters: 3,
      byYear: [
        {
          year: 2023,
          start: '2023-11-01',
          end: '2023-12-31',
          creditRows: 1,
          uniqueSubjects: 1,
          uniqueCharacters: 1,
        },
        {
          year: 2024,
          start: '2024-01-01',
          end: '2024-12-31',
          creditRows: 0,
          uniqueSubjects: 0,
          uniqueCharacters: 0,
        },
        {
          year: 2025,
          start: '2025-01-01',
          end: '2025-12-31',
          creditRows: 2,
          uniqueSubjects: 2,
          uniqueCharacters: 1,
        },
        {
          year: 2026,
          start: '2026-01-01',
          end: '2026-10-21',
          creditRows: 1,
          uniqueSubjects: 1,
          uniqueCharacters: 1,
        },
      ],
    },
    coverage,
    ...overrides,
  };
}

function mockRequest(url, overrides = {}) {
  return [url, {
    method: 'GET',
    headers: ALLOWED_HEADERS,
    credentials: 'omit',
    ...overrides,
  }];
}

test('S01 registry profile is exactly one fixed anonymous annual TV activity call', () => {
  const profile = getAgentMcpProfileById(S01_PROFILE_ID);
  assert.equal(assertS01AnnualTvVoiceProfile(profile), true);
  assert.equal(profile.calls.length, 1);
  assert.equal(profile.toolName, 'bangumi.get_person_activity');
  assert.equal(profile.acceptanceScope, 'agent-mcp-matrix-only');
  assert.equal(
    assertS01AnnualTvVoiceProfile({
      ...profile,
      calls: [{ ...profile.calls[0], arguments: { ...profile.calls[0].arguments, media: 'all' } }],
    }),
    false,
  );
});

test('S01 summary validates clipped boundary years and separates works from credit rows', () => {
  const summary = summarizeS01AnnualTvVoiceResult(makeResult());
  assert.ok(summary);
  assert.deepEqual(summary.annualObservedCounts.map(({ year, start, end, uniqueSubjects }) => ({
    year, start, end, uniqueSubjects,
  })), [
    { year: 2023, start: '2023-11-01', end: '2023-12-31', uniqueSubjects: 1 },
    { year: 2024, start: '2024-01-01', end: '2024-12-31', uniqueSubjects: 0 },
    { year: 2025, start: '2025-01-01', end: '2025-12-31', uniqueSubjects: 2 },
    { year: 2026, start: '2026-01-01', end: '2026-10-21', uniqueSubjects: 1 },
  ]);
  assert.equal(summary.creditRows, 4);
  assert.equal(summary.uniqueCharacters, 3);
  assert.equal(summary.caveat, S01_CANONICAL_CAVEAT);
});

test('S01 rejects a credit-row count used in place of a distinct-work count', () => {
  const result = makeResult();
  result.summary.byYear[2].uniqueSubjects = 1;
  assert.equal(summarizeS01AnnualTvVoiceResult(result), null);
});

test('S01 rejects incorrect boundary-year clipping and missing years', () => {
  const wrongRange = makeResult();
  wrongRange.summary.byYear[0].start = '2023-01-01';
  assert.equal(summarizeS01AnnualTvVoiceResult(wrongRange), null);
  const missingYear = makeResult();
  missingYear.summary.byYear.pop();
  assert.equal(summarizeS01AnnualTvVoiceResult(missingYear), null);
});

test('S01 preserves a zero observation as a partial sample, not a no-work conclusion', () => {
  const result = makeResult({ state: 'partial' });
  Object.assign(result.coverage, {
    relationRowsObserved: 52,
    relationRowsSelected: 48,
    relationRowsDroppedAtLimit: 4,
    sampled: true,
    truncated: true,
  });
  const summary = summarizeS01AnnualTvVoiceResult(result);
  assert.ok(summary);
  assert.equal(summary.annualObservedCounts[1].uniqueSubjects, 0);
  assert.match(summary.caveat, /0 不代表当年没有作品/u);
  assert.equal(verifyS01AnnualTvVoiceAnswer(JSON.stringify(summary), summary).valid, true);
});

test('S01 answer is bound to summary values and rejects identity, title, or extra claims', () => {
  const summary = summarizeS01AnnualTvVoiceResult(makeResult());
  const answer = JSON.stringify(summary);
  assert.equal(verifyS01AnnualTvVoiceAnswer(answer, summary).valid, true);
  const withIdentity = JSON.stringify({ ...summary, personId: 5745 });
  assert.equal(verifyS01AnnualTvVoiceAnswer(withIdentity, summary).valid, false);
  const withExtraClaim = JSON.stringify({ ...summary, conclusion: '完整职业生涯中共有 4 部。' });
  assert.equal(verifyS01AnnualTvVoiceAnswer(withExtraClaim, summary).valid, false);
  assert.equal(validateS01McpTextProjection(answer, summary).passed, true);
});

test('S01 public fetch allows only person, character relations, and relation-derived subject details', async () => {
  const calls = [];
  const publicFetch = createS01AnnualTvPublicFetch({
    fetchImpl: async (input, init) => {
      const url = new URL(typeof input === 'string' ? input : input.url);
      calls.push({ url: url.href, init });
      if (url.pathname.endsWith('/characters')) {
        return new Response(JSON.stringify([{ subject_id: 21 }, { subject_id: 22 }]), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      return new Response('{}', { status: 200 });
    },
  });
  const [person, characters] = [
    'https://api.bgm.tv/v0/persons/5745',
    'https://api.bgm.tv/v0/persons/5745/characters',
  ];
  await publicFetch.fetchFn(...mockRequest(person));
  await publicFetch.fetchFn(...mockRequest(characters));
  await publicFetch.fetchFn(...mockRequest('https://api.bgm.tv/v0/subjects/21'));
  await publicFetch.fetchFn(...mockRequest('https://api.bgm.tv/v0/subjects/22'));
  assert.equal(calls.length, 4);
  assert.equal(calls.every(({ init }) => init.credentials === 'omit' && init.redirect === 'error'), true);
  assert.equal(expectedS01PublicRequestScope(publicFetch.snapshot()), true);
  assert.equal(Object.hasOwn(publicFetch.snapshot(), 'subjectIds'), false);
});

test('S01 public fetch rejects credentials, out-of-order, unrelated IDs, duplicate details, and redirects', async () => {
  const publicFetch = createS01AnnualTvPublicFetch({
    fetchImpl: async (input) => {
      const url = new URL(typeof input === 'string' ? input : input.url);
      if (url.pathname.endsWith('/characters')) {
        return new Response(JSON.stringify([{ subject_id: 21 }]), { status: 200 });
      }
      if (url.pathname.endsWith('/subjects/21')) return new Response('', { status: 302 });
      return new Response('{}', { status: 200 });
    },
  });
  await assert.rejects(
    publicFetch.fetchFn(...mockRequest('https://api.bgm.tv/v0/persons/5745/characters')),
    /denied/u,
  );
  await assert.rejects(
    publicFetch.fetchFn(...mockRequest('https://api.bgm.tv/v0/persons/5745', {
      headers: { ...ALLOWED_HEADERS, authorization: 'Bearer token' },
    })),
    /denied/u,
  );

  const allowed = createS01AnnualTvPublicFetch({
    fetchImpl: async (input) => {
      const url = new URL(typeof input === 'string' ? input : input.url);
      if (url.pathname.endsWith('/characters')) {
        return new Response(JSON.stringify([{ subject_id: 21 }]), { status: 200 });
      }
      return new Response('{}', { status: 200 });
    },
  });
  await allowed.fetchFn(...mockRequest('https://api.bgm.tv/v0/persons/5745'));
  await allowed.fetchFn(...mockRequest('https://api.bgm.tv/v0/persons/5745/characters'));
  await assert.rejects(
    allowed.fetchFn(...mockRequest('https://api.bgm.tv/v0/subjects/999')),
    /denied/u,
  );
  await allowed.fetchFn(...mockRequest('https://api.bgm.tv/v0/subjects/21'));
  await assert.rejects(
    allowed.fetchFn(...mockRequest('https://api.bgm.tv/v0/subjects/21')),
    /duplicate/u,
  );

  const redirected = createS01AnnualTvPublicFetch({
    fetchImpl: async () => new Response('', { status: 302 }),
  });
  await assert.rejects(
    redirected.fetchFn(...mockRequest('https://api.bgm.tv/v0/persons/5745')),
    /redirect/u,
  );
  assert.equal(expectedS01PublicRequestScope(redirected.snapshot()), false);
});

test('S01 public fetch rejects oversized relation payloads', async () => {
  const publicFetch = createS01AnnualTvPublicFetch({
    fetchImpl: async (input) => {
      const url = new URL(typeof input === 'string' ? input : input.url);
      return url.pathname.endsWith('/characters')
        ? new Response('x'.repeat(S01_MAX_RESPONSE_BYTES + 1), { status: 200 })
        : new Response('{}', { status: 200 });
    },
  });
  await publicFetch.fetchFn(...mockRequest('https://api.bgm.tv/v0/persons/5745'));
  await assert.rejects(
    publicFetch.fetchFn(...mockRequest('https://api.bgm.tv/v0/persons/5745/characters')),
    /byte bound/u,
  );
  assert.equal(expectedS01PublicRequestScope(publicFetch.snapshot()), false);
});
