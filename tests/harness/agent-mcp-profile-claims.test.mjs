import assert from 'node:assert/strict';
import test from 'node:test';
import {
  AgentMcpProfileClaimError,
  acquireAgentMcpProfileGitHubLatch,
  acquireAgentMcpProfileTerminalGitHubLatch,
  agentMcpProfileArgumentsSha256,
  agentMcpProfileClaimLabelDescription,
  agentMcpProfileRegistrySha256,
  agentMcpProfileTerminalLabelDescription,
  agentMcpProfileTerminalLabelName,
  normalizeAgentMcpProfileDiagnostics,
  classifyAgentMcpProfileInconclusiveReport,
  claimAgentMcpProfileAtomically,
  getAgentMcpProfile,
  getAgentMcpProfileById,
  listAgentMcpProfiles,
} from '../../scripts/lib/agent-mcp-profile-claims.mjs';

const PROFILE = getAgentMcpProfile(
  'bangumi.get_person_activity',
  'fixed-c03-voice-pair-4765-17075-tv-36m-48r-16d-8rows-v1',
);
const C04_PROFILE = getAgentMcpProfileById('c04-cohort-comparison-agent-mcp-matrix-v1');

test('C04 matrix profile binds its two exact read-only tools in order', () => {
  assert.ok(C04_PROFILE);
  assert.equal(C04_PROFILE.frontierId, 'A01');
  assert.equal(C04_PROFILE.acceptanceScope, 'agent-mcp-matrix-only');
  assert.deepEqual(C04_PROFILE.toolNames, [
    'bangumi.compare_subject_cohorts',
    'bangumi.render_subject_cohort_comparison',
  ]);
  const expectedArguments = {
    cohorts: [
      {
        label: 'Run95 C04 2025 winter original anime sample',
        query: {
          media: 'anime',
          season: '2025-winter',
          metaTags: ['原创'],
          resultMode: 'all',
        },
      },
      {
        label: 'Run95 C04 2025 spring original anime sample',
        query: {
          media: 'anime',
          season: '2025-spring',
          metaTags: ['原创'],
          resultMode: 'all',
        },
      },
    ],
    maxSubjects: 1,
  };
  assert.deepEqual(C04_PROFILE.calls, [
    { toolName: 'bangumi.compare_subject_cohorts', arguments: expectedArguments },
    { toolName: 'bangumi.render_subject_cohort_comparison', arguments: expectedArguments },
  ]);
  assert.equal(
    getAgentMcpProfile('bangumi.compare_subject_cohorts', C04_PROFILE.argumentProfile),
    C04_PROFILE,
  );
  assert.equal(
    getAgentMcpProfile('bangumi.render_subject_cohort_comparison', C04_PROFILE.argumentProfile),
    C04_PROFILE,
  );
});

test('Agent/MCP profile registry is closed and immutable, including C03 exact calls', () => {
  for (const profile of listAgentMcpProfiles()) {
    assert.ok(
      profile.claimLabelName.length <= 50,
      `${profile.id} claim label exceeds GitHub's limit`,
    );
    const terminalLabelName = profile.claimLabelName.replace(/-claimed$/u, '-terminal');
    assert.ok(
      terminalLabelName.length <= 50,
      `${profile.id} terminal label exceeds GitHub's limit`,
    );
  }
  assert.ok(PROFILE);
  assert.equal(PROFILE.id, 'c03-voice-actor-comparison-v1');
  assert.equal(PROFILE.frontierId, 'C03');
  assert.equal(PROFILE.calls.length, 2);
  assert.deepEqual(
    PROFILE.calls.map((call) => call.arguments.personId),
    [4765, 17075],
  );
  assert.ok(Object.isFrozen(PROFILE));
  assert.equal(getAgentMcpProfile('bangumi.get_person_activity', 'unknown'), null);
  assert.equal(getAgentMcpProfile('bangumi.get_subject_relations', PROFILE.argumentProfile), null);
  assert.equal(getAgentMcpProfileById('unknown-profile'), null);
  assert.equal(listAgentMcpProfiles().length, 25);
  const c07RenderComparison = getAgentMcpProfileById(
    'c07-render-comparison-offline-agent-mcp-matrix-v1',
  );
  assert.ok(c07RenderComparison);
  assert.equal(c07RenderComparison.frontierId, 'C07');
  assert.equal(
    c07RenderComparison.argumentProfile,
    'fixed-c07-synthetic-single-cohort-render-comparison-v1',
  );
  assert.equal(c07RenderComparison.acceptanceScope, 'agent-mcp-matrix-only');
  assert.equal(c07RenderComparison.networkMode, 'run95-c07-render-comparison-synthetic-offline-v1');
  assert.equal(c07RenderComparison.claimLabelName, 'harness-r95-c07-cohort-render-offline-claimed');
  const g01RenderQuery = getAgentMcpProfileById('g01-render-query-subjects-offline-agent-mcp-v1');
  assert.ok(g01RenderQuery);
  assert.equal(g01RenderQuery.frontierId, 'G01');
  assert.equal(g01RenderQuery.toolName, 'bangumi.render_query_subjects');
  assert.equal(g01RenderQuery.calls.length, 1);
  assert.equal(g01RenderQuery.acceptanceScope, 'agent-mcp-matrix-only');
  assert.equal(g01RenderQuery.networkMode, 'run95-g01-render-query-subjects-synthetic-offline-v1');
  assert.notEqual(g01RenderQuery.id, 'query-render-title-agent-mcp-v1');
  const g01RenderQueryV2 = getAgentMcpProfileById('g01-render-query-subjects-offline-agent-mcp-v2');
  assert.ok(g01RenderQueryV2);
  assert.equal(g01RenderQueryV2.frontierId, 'G01');
  assert.equal(g01RenderQueryV2.epochId, 'run95-g01-render-query-offline-matrix-v2-call-20261018');
  assert.equal(g01RenderQueryV2.toolName, 'bangumi.render_query_subjects');
  assert.equal(g01RenderQueryV2.acceptanceScope, 'agent-mcp-matrix-only');
  assert.equal(
    g01RenderQueryV2.networkMode,
    'run95-g01-render-query-subjects-synthetic-offline-v2',
  );
  assert.notEqual(g01RenderQueryV2.argumentProfile, g01RenderQuery.argumentProfile);
  assert.notDeepEqual(g01RenderQueryV2.calls, g01RenderQuery.calls);
  assert.notEqual(g01RenderQueryV2.claimLabelName, g01RenderQuery.claimLabelName);
  const g01QuerySubjects = getAgentMcpProfileById('g01-query-subjects-offline-agent-mcp-matrix-v1');
  assert.ok(g01QuerySubjects);
  assert.equal(g01QuerySubjects.frontierId, 'G01');
  assert.equal(g01QuerySubjects.toolName, 'bangumi.query_subjects');
  assert.equal(g01QuerySubjects.calls.length, 1);
  assert.equal(g01QuerySubjects.acceptanceScope, 'agent-mcp-matrix-only');
  assert.equal(g01QuerySubjects.networkMode, 'run95-g01-query-subjects-synthetic-offline-v1');
  assert.notDeepEqual(
    g01QuerySubjects.calls[0].arguments,
    getAgentMcpProfileById('query-render-title-agent-mcp-v1').calls[0].arguments,
  );
  assert.notEqual(
    g01QuerySubjects.claimLabelName,
    getAgentMcpProfileById('query-render-title-agent-mcp-v1').claimLabelName,
  );
  const a01RenderAggregation = getAgentMcpProfileById(
    'a01-render-cohort-aggregation-agent-mcp-offline-v1',
  );
  assert.ok(a01RenderAggregation);
  assert.equal(a01RenderAggregation.frontierId, 'A01');
  assert.equal(a01RenderAggregation.toolName, 'bangumi.render_subject_cohort_aggregation');
  assert.equal(a01RenderAggregation.acceptanceScope, 'agent-mcp-matrix-only');
  const a01RatingDispersion = getAgentMcpProfileById('a01-rating-dispersion-1998-spring-v1');
  assert.ok(a01RatingDispersion);
  assert.equal(a01RatingDispersion.frontierId, 'A01');
  assert.equal(a01RatingDispersion.toolName, 'bangumi.compare_subject_cohorts');
  assert.equal(a01RatingDispersion.acceptanceScope, 'agent-mcp-scenario-and-matrix');
  assert.equal(a01RatingDispersion.calls.length, 1);
  const m07 = getAgentMcpProfileById('m07-manage-index-unbound-agent-mcp-v1');
  assert.ok(m07);
  assert.equal(m07.frontierId, 'M07');
  assert.equal(m07.acceptanceScope, 'agent-mcp-matrix-only');
  assert.deepEqual(m07.calls, [
    {
      toolName: 'bangumi.manage_index',
      arguments: { action: 'create', title: 'Run95 no-account gate check' },
    },
  ]);
  const r04Render = getAgentMcpProfileById('r04-render-series-watch-order-offline-agent-mcp-v1');
  const r04Get = getAgentMcpProfileById('r04-series-watch-order-offline-agent-mcp-v1');
  assert.ok(r04Render);
  assert.equal(r04Render.frontierId, 'R04');
  assert.equal(r04Render.acceptanceScope, 'agent-mcp-matrix-only');
  assert.equal(r04Render.toolName, 'bangumi.render_series_watch_order');
  assert.equal(getAgentMcpProfile(r04Render.toolName, r04Render.argumentProfile), r04Render);
  assert.deepEqual(r04Render.calls[0].arguments, {
    subjectId: 990802,
    depth: 0,
    maxNodes: 1,
    media: 'anime',
  });
  assert.notDeepEqual(r04Render.calls[0].arguments, r04Get.calls[0].arguments);
  const c01 = getAgentMcpProfileById('c01-rating-count-gap-v1');
  assert.ok(c01);
  assert.equal(c01.frontierId, 'C01');
  assert.equal(c01.epochId, 'run95-c01-rating-count-gap-agent-mcp-20261015');
  assert.deepEqual(c01.calls, [
    {
      toolName: 'bangumi.get_subject_comparison',
      arguments: {
        subjectIds: [41529, 46729],
        maxCast: 1,
        maxStaff: 1,
        maxRelations: 1,
      },
    },
  ]);
  assert.equal(getAgentMcpProfile('bangumi.get_subject_comparison', c01.argumentProfile), c01);
  assert.equal(
    agentMcpProfileClaimLabelDescription(c01),
    'Run 95 C01 profile c01-rating-count-gap-v1; permanent one-shot latch.',
  );
  assert.match(agentMcpProfileRegistrySha256(c01.id), /^[0-9a-f]{64}$/u);
  const p03 = getAgentMcpProfileById('p03-person-name-cn-agent-mcp-v1');
  assert.ok(p03);
  assert.equal(p03.frontierId, 'P03');
  assert.equal(p03.calls.length, 1);
  assert.equal(getAgentMcpProfile('bangumi.get_person_profile', p03.argumentProfile), p03);
  const p07 = getAgentMcpProfileById('p07-person-season-distribution-agent-mcp-v1');
  assert.ok(p07);
  assert.equal(p07.frontierId, 'P07');
  assert.equal(p07.calls.length, 1);
  assert.equal(p07.calls[0].arguments.personId, 3474);
  assert.equal(p07.calls[0].arguments.kind, 'staff');
  assert.equal(p07.calls[0].arguments.media, 'anime');
  assert.equal(p07.calls[0].arguments.maxRows, 8);
  const s05 = getAgentMcpProfileById('s05-bounded-non-tv-voice-agent-mcp-v1');
  assert.ok(s05);
  assert.equal(s05.frontierId, 'S05');
  assert.equal(s05.epochId, 'run95-s05-bounded-non-tv-voice-agent-mcp-20261017');
  assert.equal(s05.toolName, 'bangumi.get_person_activity');
  assert.deepEqual(s05.calls, [
    {
      toolName: 'bangumi.get_person_activity',
      arguments: {
        personId: 3474,
        kind: 'voice',
        media: 'anime',
        windowMonths: 6,
        maxRelations: 48,
        maxSubjectDetails: 16,
        maxRows: 8,
      },
    },
  ]);
  assert.notDeepEqual(s05.calls, p07.calls);
  assert.ok(s05.claimLabelName.length <= 50);
  assert.ok(agentMcpProfileTerminalLabelName(s05).length <= 50);
  assert.match(agentMcpProfileArgumentsSha256(s05), /^[0-9a-f]{64}$/u);
  assert.match(agentMcpProfileRegistrySha256(s05.id), /^[0-9a-f]{64}$/u);
  const r05 = getAgentMcpProfileById('r05-k-on-season-shared-person-v1');
  assert.ok(r05);
  assert.equal(r05.frontierId, 'R05');
  assert.equal(r05.epochId, 'run95-r05-k-on-season-shared-person-20261015');
  assert.deepEqual(r05.calls, [
    {
      toolName: 'bangumi.get_subject_overlap',
      arguments: {
        subjectIds: [1424, 3774],
        kind: 'cast',
        castRole: 'all',
        maxCast: 80,
        maxPairs: 1,
        maxPeople: 8,
      },
    },
  ]);
  assert.equal(getAgentMcpProfile('bangumi.get_subject_overlap', r05.argumentProfile), r05);
  assert.equal(
    agentMcpProfileClaimLabelDescription(r05),
    'Run 95 R05 profile r05-k-on-season-shared-person-v1; permanent one-shot latch.',
  );
  const p06 = getAgentMcpProfileById('p06-render-person-profile-offline-agent-mcp-v1');
  assert.ok(p06);
  assert.equal(p06.frontierId, 'P06');
  assert.equal(p06.acceptanceScope, 'agent-mcp-matrix-only');
  assert.equal(p06.networkMode, 'run95-p06-render-person-profile-offline-v1');
  assert.deepEqual(p06.calls, [
    {
      toolName: 'bangumi.render_person_profile',
      arguments: {
        personId: 990601,
        maxSubjects: 1,
        maxCharacters: 1,
        maxCredits: 1,
        includeChronology: false,
      },
    },
  ]);
  assert.equal(
    agentMcpProfileClaimLabelDescription(p06),
    'Run 95 P06 profile p06-render-person-profile-offline-agent-mcp-v1; permanent one-shot latch.',
  );
  assert.match(agentMcpProfileArgumentsSha256(p06), /^[0-9a-f]{64}$/u);
  assert.match(agentMcpProfileRegistrySha256(p06.id), /^[0-9a-f]{64}$/u);
  const p02 = getAgentMcpProfileById('p02-person-profile-offline-agent-mcp-v1');
  assert.ok(p02);
  assert.equal(p02.frontierId, 'P02');
  assert.equal(p02.acceptanceScope, 'agent-mcp-matrix-only');
  assert.equal(p02.networkMode, 'run95-p02-person-profile-offline-v1');
  assert.equal(getAgentMcpProfile('bangumi.get_person_profile', p02.argumentProfile), p02);
  assert.deepEqual(p02.calls, [
    {
      toolName: 'bangumi.get_person_profile',
      arguments: {
        personId: 990701,
        includeCredits: true,
        maxSubjects: 1,
        maxCharacters: 1,
        includeChronology: false,
      },
    },
  ]);
  assert.equal(
    agentMcpProfileClaimLabelDescription(p02),
    'Run 95 P02 profile p02-person-profile-offline-agent-mcp-v1; permanent one-shot latch.',
  );
  assert.match(agentMcpProfileArgumentsSha256(p02), /^[0-9a-f]{64}$/u);
  assert.match(agentMcpProfileRegistrySha256(p02.id), /^[0-9a-f]{64}$/u);
  const r04 = getAgentMcpProfileById('r04-series-watch-order-offline-agent-mcp-v1');
  assert.ok(r04);
  assert.equal(r04.frontierId, 'R04');
  assert.equal(r04.acceptanceScope, 'agent-mcp-matrix-only');
  assert.equal(r04.networkMode, 'run95-r04-series-watch-order-offline-v1');
  assert.equal(r04.toolName, 'bangumi.get_series_watch_order');
  assert.deepEqual(r04.calls, [
    {
      toolName: 'bangumi.get_series_watch_order',
      arguments: {
        subjectId: 990801,
        depth: 0,
        maxNodes: 1,
        media: 'anime',
      },
    },
  ]);
  assert.match(agentMcpProfileArgumentsSha256(r04), /^[0-9a-f]{64}$/u);
  assert.match(agentMcpProfileRegistrySha256(r04.id), /^[0-9a-f]{64}$/u);
  assert.equal(
    agentMcpProfileClaimLabelDescription(r04),
    'Run 95 R04 profile r04-series-watch-order-offline-agent-mcp-v1; permanent one-shot latch.',
  );
  const r01Offline = getAgentMcpProfileById('r01-subject-relations-offline-agent-mcp-v1');
  assert.ok(r01Offline);
  assert.equal(r01Offline.frontierId, 'R01');
  assert.equal(r01Offline.acceptanceScope, 'agent-mcp-matrix-only');
  assert.equal(r01Offline.networkMode, 'run95-r01-relations-offline-v1');
  assert.equal(r01Offline.toolName, 'bangumi.get_subject_relations');
  assert.deepEqual(r01Offline.calls, [
    {
      toolName: 'bangumi.get_subject_relations',
      arguments: { subjectId: 990902, includeEvidence: true },
    },
  ]);
  assert.match(agentMcpProfileArgumentsSha256(r01Offline), /^[0-9a-f]{64}$/u);
  assert.match(agentMcpProfileRegistrySha256(r01Offline.id), /^[0-9a-f]{64}$/u);
  assert.equal(
    agentMcpProfileClaimLabelDescription(r01Offline),
    'Run 95 R01 profile r01-subject-relations-offline-agent-mcp-v1; permanent one-shot latch.',
  );
  const r03Offline = getAgentMcpProfileById('r03-two-hop-relations-offline-agent-mcp-v1');
  assert.ok(r03Offline);
  assert.equal(r03Offline.frontierId, 'R03');
  assert.equal(r03Offline.acceptanceScope, 'agent-mcp-matrix-only');
  assert.equal(r03Offline.networkMode, 'run95-r03-two-hop-relations-offline-v1');
  assert.equal(r03Offline.toolName, 'bangumi.get_subject_relations');
  assert.equal(r03Offline.calls.length, 2);
  assert.deepEqual(
    r03Offline.calls.map((call) => call.arguments),
    [
      { subjectId: 990910, includeEvidence: true },
      { subjectId: 990911, includeEvidence: true },
    ],
  );
  assert.match(agentMcpProfileArgumentsSha256(r03Offline), /^[0-9a-f]{64}$/u);
  assert.match(agentMcpProfileRegistrySha256(r03Offline.id), /^[0-9a-f]{64}$/u);
  assert.equal(
    agentMcpProfileClaimLabelDescription(r03Offline),
    'Run 95 R03 profile r03-two-hop-relations-offline-agent-mcp-v1; permanent one-shot latch.',
  );
  const r03MatrixV2 = getAgentMcpProfileById('r03-direct-relations-offline-agent-mcp-matrix-v2');
  assert.ok(r03MatrixV2);
  assert.equal(r03MatrixV2.frontierId, 'R03');
  assert.equal(
    r03MatrixV2.epochId,
    'run95-r03-direct-relations-offline-agent-mcp-matrix-v2-20261017',
  );
  assert.equal(r03MatrixV2.acceptanceScope, 'agent-mcp-matrix-only');
  assert.equal(r03MatrixV2.networkMode, 'run95-r03-direct-relations-offline-matrix-v2');
  assert.equal(r03MatrixV2.toolName, 'bangumi.get_subject_relations');
  assert.equal(r03MatrixV2.argumentProfile, 'fixed-r03-synthetic-direct-relations-991020-v2');
  assert.deepEqual(r03MatrixV2.calls, [
    {
      toolName: 'bangumi.get_subject_relations',
      arguments: { subjectId: 991020, includeEvidence: true },
    },
  ]);
  assert.notEqual(r03MatrixV2.claimLabelName, r03Offline.claimLabelName);
  assert.notEqual(r03MatrixV2.argumentProfile, r03Offline.argumentProfile);
  assert.match(agentMcpProfileArgumentsSha256(r03MatrixV2), /^[0-9a-f]{64}$/u);
  assert.match(agentMcpProfileRegistrySha256(r03MatrixV2.id), /^[0-9a-f]{64}$/u);
  const r02 = getAgentMcpProfileById('r02-positive-direct-relations-agent-mcp-v1');
  assert.ok(r02);
  assert.equal(r02.frontierId, 'R02');
  assert.equal(r02.epochId, 'run95-r02-positive-direct-relations-agent-mcp-20261016');
  assert.equal(r02.acceptanceScope, 'agent-mcp-matrix-only');
  assert.equal(r02.networkMode, 'run95-r02-positive-direct-relations-public-v1');
  assert.deepEqual(r02.calls, [
    {
      toolName: 'bangumi.get_subject_relations',
      arguments: { subjectId: 4923, includeEvidence: true },
    },
    {
      toolName: 'bangumi.get_subject_relations',
      arguments: { subjectId: 315, includeEvidence: true },
    },
    {
      toolName: 'bangumi.get_subject_relations',
      arguments: { subjectId: 1428, includeEvidence: true },
    },
  ]);
  assert.match(agentMcpProfileArgumentsSha256(r02), /^[0-9a-f]{64}$/u);
  assert.match(agentMcpProfileRegistrySha256(r02.id), /^[0-9a-f]{64}$/u);
  assert.equal(
    agentMcpProfileClaimLabelDescription(r02),
    'Run 95 R02 profile r02-positive-direct-relations-agent-mcp-v1; permanent one-shot latch.',
  );
  assert.equal(
    agentMcpProfileRegistrySha256(),
    '7e3bfd3c5f7815faf5f279759739572e86f62308e81faff518d775aa1eaa9e92',
  );
  assert.match(agentMcpProfileRegistrySha256(p03.id), /^[0-9a-f]{64}$/u);
  assert.notEqual(agentMcpProfileRegistrySha256(p03.id), agentMcpProfileRegistrySha256());
  assert.match(agentMcpProfileArgumentsSha256(PROFILE), /^[0-9a-f]{64}$/u);
  assert.throws(() => {
    PROFILE.calls[0].arguments.personId = 1;
  }, TypeError);
});

test('profile latch uses deterministic permanent metadata and rejects an existing latch', () => {
  const calls = [];
  const gh = (...args) => {
    calls.push(args);
    if (args[0] === 'api' && args[1] === 'repos/{owner}/{repo}/labels') {
      throw new Error('already exists');
    }
    return JSON.stringify({
      name: PROFILE.claimLabelName,
      description: agentMcpProfileClaimLabelDescription(PROFILE),
    });
  };
  assert.throws(
    () => acquireAgentMcpProfileGitHubLatch(gh, PROFILE),
    (error) =>
      error instanceof AgentMcpProfileClaimError && error.code === 'PROFILE_ALREADY_CLAIMED',
  );
  assert.equal(calls.length, 2);
  assert.equal(calls[0][2], '--method');
  assert.equal(
    calls[1][1],
    `repos/{owner}/{repo}/labels/${encodeURIComponent(PROFILE.claimLabelName)}`,
  );
});

test('profile latch fails closed on ambiguous or mismatched GitHub state', () => {
  assert.throws(
    () =>
      acquireAgentMcpProfileGitHubLatch(() => {
        throw new Error('offline');
      }, PROFILE),
    (error) => error.code === 'PROFILE_LATCH_UNCERTAIN',
  );
  assert.throws(
    () =>
      acquireAgentMcpProfileGitHubLatch((...args) => {
        if (args[1] === 'repos/{owner}/{repo}/labels')
          return JSON.stringify({ name: 'wrong', description: 'wrong' });
        throw new Error('not found');
      }, PROFILE),
    (error) => error.code === 'PROFILE_LATCH_UNCERTAIN',
  );
  assert.throws(
    () =>
      acquireAgentMcpProfileGitHubLatch(
        () => JSON.stringify({ name: 'wrong', description: 'wrong' }),
        PROFILE,
      ),
    (error) => error.code === 'PROFILE_LATCH_UNCERTAIN',
  );
  assert.throws(
    () =>
      acquireAgentMcpProfileGitHubLatch(() => '{}', {
        ...PROFILE,
        argumentProfile: 'not-registered',
      }),
    (error) => error.code === 'PROFILE_NOT_REGISTERED',
  );
});

test('profile claim rechecks gates around permanent latch and verifies durable readback', () => {
  const calls = [];
  const claim = { claimId: 'c03-claim', state: 'CLAIMED' };
  const result = claimAgentMcpProfileAtomically({
    claim,
    assertReady: () => calls.push('ready'),
    acquireGlobalLatch: () => {
      calls.push('latch');
      return true;
    },
    persistClaim: (value) => {
      calls.push('persist');
      assert.deepEqual(value, claim);
    },
    readClaim: () => {
      calls.push('read');
      return { ...claim };
    },
    verifyClaim: (observed, expected) => JSON.stringify(observed) === JSON.stringify(expected),
  });
  assert.deepEqual(result, claim);
  assert.deepEqual(calls, ['ready', 'latch', 'ready', 'persist', 'read']);
});

test('profile claim rejects lost latch, persistence/readback mismatch, and missing adapters', () => {
  const base = {
    claim: { claimId: 'c03-claim' },
    assertReady() {},
    acquireGlobalLatch: () => false,
    persistClaim() {},
    readClaim: () => null,
    verifyClaim: () => false,
  };
  assert.throws(
    () => claimAgentMcpProfileAtomically(base),
    (error) => error.code === 'PROFILE_ALREADY_CLAIMED',
  );
  assert.throws(
    () => claimAgentMcpProfileAtomically({ ...base, acquireGlobalLatch: () => true }),
    (error) => error.code === 'PROFILE_CLAIM_READBACK_MISMATCH',
  );
  assert.throws(
    () =>
      claimAgentMcpProfileAtomically({
        ...base,
        acquireGlobalLatch: () => true,
        readClaim: () => ({ claimId: 'other-claim' }),
        verifyClaim: (observed, expected) => JSON.stringify(observed) === JSON.stringify(expected),
      }),
    (error) => error.code === 'PROFILE_CLAIM_READBACK_MISMATCH',
  );
  assert.throws(
    () => claimAgentMcpProfileAtomically({ claim: {} }),
    (error) => error.code === 'PROFILE_CLAIM_INVALID',
  );
});

test('a valid report is inconclusive only after its original Candidate becomes stale', () => {
  assert.equal(
    classifyAgentMcpProfileInconclusiveReport({
      reportValid: true,
      claimCurrent: true,
    }),
    'REPORT_WRITTEN_REQUIRED',
  );
  assert.equal(
    classifyAgentMcpProfileInconclusiveReport({
      reportValid: true,
      claimCurrent: false,
    }),
    'INCONCLUSIVE_ALLOWED',
  );
  assert.equal(
    classifyAgentMcpProfileInconclusiveReport({
      reportValid: false,
      claimCurrent: true,
    }),
    'INCONCLUSIVE_ALLOWED',
  );
  assert.throws(() => classifyAgentMcpProfileInconclusiveReport({}), /explicit validity/u);
});

test('profile terminal latch binds one immutable result and rejects a conflicting outcome', () => {
  const digest = 'a'.repeat(64);
  const name = agentMcpProfileTerminalLabelName(PROFILE);
  const description = agentMcpProfileTerminalLabelDescription(PROFILE, 'REPORT_WRITTEN', digest);
  assert.equal(name, 'harness-r95-c03-activity-terminal');
  assert.match(description, /REPORT_WRITTEN/u);
  assert.throws(
    () => agentMcpProfileTerminalLabelDescription(PROFILE, 'REPORT_WRITTEN'),
    (error) => error.code === 'PROFILE_TERMINAL_INVALID',
  );
  let existing = null;
  const gh = (...args) => {
    if (args[1] === 'repos/{owner}/{repo}/labels') {
      const payload = JSON.parse(args.at(-1).input);
      if (existing) throw new Error('already exists');
      existing = payload;
      return JSON.stringify(payload);
    }
    return JSON.stringify(existing);
  };
  assert.deepEqual(
    acquireAgentMcpProfileTerminalGitHubLatch(gh, PROFILE, 'REPORT_WRITTEN', digest),
    {
      created: true,
      name,
      description,
    },
  );
  assert.deepEqual(
    acquireAgentMcpProfileTerminalGitHubLatch(gh, PROFILE, 'REPORT_WRITTEN', digest),
    {
      created: false,
      name,
      description,
    },
  );
  assert.throws(
    () => acquireAgentMcpProfileTerminalGitHubLatch(gh, PROFILE, 'INCONCLUSIVE'),
    (error) => error.code === 'PROFILE_TERMINAL_LATCH_CONFLICT',
  );
});

test('profile failure diagnostics keep only bounded allowlisted checks and counters', () => {
  const diagnostics = normalizeAgentMcpProfileDiagnostics({
    schemaVersion: 1,
    reasonCode: 'P03_AGENT_MCP_ASSERTION_FAILED',
    checks: { eventStreamParsed: false, answerValid: true },
    counters: { codexErrorItems: 0, nonMcpToolEvents: 3 },
  });
  assert.deepEqual(diagnostics, {
    schemaVersion: 1,
    reasonCode: 'P03_AGENT_MCP_ASSERTION_FAILED',
    checks: { answerValid: true, eventStreamParsed: false },
    counters: { codexErrorItems: 0, nonMcpToolEvents: 3 },
  });
  assert.deepEqual(
    normalizeAgentMcpProfileDiagnostics({
      schemaVersion: 1,
      reasonCode: 'G01_RENDER_QUERY_AGENT_MCP_ASSERTION_FAILED',
      checks: { mcpToolErrorResultCountZero: false },
      counters: { codexErrorItems: 2, mcpToolErrorResults: 1 },
    }).counters,
    { codexErrorItems: 2, mcpToolErrorResults: 1 },
  );
  assert.throws(
    () =>
      normalizeAgentMcpProfileDiagnostics({
        schemaVersion: 1,
        reasonCode: 'G01_RENDER_QUERY_AGENT_MCP_ASSERTION_FAILED',
        checks: { mcpToolErrorResultCountZero: false },
        counters: { mcpToolErrorResults: 'raw result text' },
      }),
    (error) => error.code === 'PROFILE_DIAGNOSTICS_INVALID',
  );
  for (const reasonCode of [
    'S05_AGENT_MCP_ASSERTION_FAILED',
    'S05_ACTIVE_GATE_CHANGED_DURING_QUERY',
    'S05_CLAIM_READBACK_MISMATCH',
    'S05_PREINVOKE_GATE_MISMATCH',
    'S05_REPORT_FIELDS_INVALID',
    'S05_REPORT_IDENTITY_INVALID',
    'S05_REPORT_RESULT_SUMMARY_INVALID',
    'S05_REPORT_ALREADY_EXISTS_OR_UNWRITABLE',
    'S05_ANSWER_CHECKS_FAILED',
    'S05_RUNNER_FAILED_AFTER_CLAIM',
  ]) {
    assert.equal(
      normalizeAgentMcpProfileDiagnostics({
        schemaVersion: 1,
        reasonCode,
        checks: { resultProjectionValid: false },
        counters: {},
      }).reasonCode,
      reasonCode,
    );
  }
  assert.equal(
    normalizeAgentMcpProfileDiagnostics({
      schemaVersion: 1,
      reasonCode: 'TITLE_QUERY_RENDER_STALE_REPORT_RECOVERY',
      checks: { reportBuildValid: true },
      counters: {},
    }).reasonCode,
    'TITLE_QUERY_RENDER_STALE_REPORT_RECOVERY',
  );
  for (const value of [
    {
      schemaVersion: 1,
      reasonCode: 'P03_FAILURE',
      checks: { answer: 'raw answer text' },
      counters: {},
    },
    {
      schemaVersion: 1,
      reasonCode: 'P03_FAILURE',
      checks: { eventStreamParsed: 'false' },
      counters: {},
    },
    {
      schemaVersion: 1,
      reasonCode: 'P03_FAILURE',
      checks: { eventStreamParsed: false },
      counters: { subjectId: 4765 },
    },
    {
      schemaVersion: 1,
      reasonCode: 'raw failure reason',
      checks: { eventStreamParsed: false },
      counters: {},
    },
  ]) {
    assert.throws(
      () => normalizeAgentMcpProfileDiagnostics(value),
      (error) => error.code === 'PROFILE_DIAGNOSTICS_INVALID',
    );
  }
});
