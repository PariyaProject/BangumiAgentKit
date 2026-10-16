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

test('C03 profile registry is closed, immutable, and binds two exact calls', () => {
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
  assert.equal(listAgentMcpProfiles().length, 11);
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
