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
  assert.equal(listAgentMcpProfiles().length, 1);
  assert.match(agentMcpProfileRegistrySha256(), /^[0-9a-f]{64}$/u);
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
