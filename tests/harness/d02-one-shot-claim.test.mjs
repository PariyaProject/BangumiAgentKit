import test from 'node:test';
import assert from 'node:assert/strict';
import {
  acquireD02OneShotGitHubLatch,
  acquireD02OneShotTerminalGitHubLatch,
  claimD02OneShotAtomically,
  D02OneShotClaimError,
  d02OneShotClaimLabelDescription,
  d02OneShotClaimLabelName,
  d02OneShotTerminalLabelDescription,
  d02OneShotTerminalLabelName,
  verifyD02OneShotGitHubLatch,
  verifyD02OneShotTerminalLabel,
} from '../../scripts/lib/d02-one-shot-claim.mjs';

const claim = {
  schemaVersion: 1,
  claimId: 'd02-run-95-0123456789abcdef01234567',
  runNumber: 95,
  frontierId: 'D02',
  epochId: 'run95-d02-public-search-candidate-boundary',
  toolName: 'bangumi.search_subjects',
  argumentProfile: 'fixed-d02-apocalypse-travel-keyword-anime-top8-v1',
  expectedArgumentsSha256: 'a'.repeat(64),
  state: 'CLAIMED',
  candidateSha: 'b'.repeat(40),
  baseSha: 'c'.repeat(40),
  ciSha: 'b'.repeat(40),
  ciStatus: 'SUCCESS',
  bundleSha256: 'd'.repeat(64),
  prNumber: 152,
  reviewerId: 'gpt-6-luna-max-run95-pr152-round1',
  model: 'gpt-6-luna',
  reasoningEffort: 'max',
  reportWritten: false,
  retryAllowed: false,
  claimedAt: '2026-10-13T00:00:00.000Z',
};

test('D02 repository latch is deterministic and binds the exact reviewed query profile', () => {
  assert.equal(d02OneShotClaimLabelName(), 'harness-r95-d02-search-subjects-claimed');
  assert.equal(d02OneShotClaimLabelDescription(claim), d02OneShotClaimLabelDescription({ ...claim }));
  assert.equal(d02OneShotClaimLabelDescription(claim).length < 100, true);
  assert.notEqual(
    d02OneShotClaimLabelDescription(claim),
    d02OneShotClaimLabelDescription({ ...claim, candidateSha: 'e'.repeat(40) }),
  );
});

test('D02 global claim is create-only and refuses an already-owned label', () => {
  const name = d02OneShotClaimLabelName();
  const description = d02OneShotClaimLabelDescription(claim);
  const gh = (...args) => {
    if (args[1] === 'repos/{owner}/{repo}/labels' && args.includes('--method')) {
      const error = new Error('HTTP 422 Validation Failed');
      error.stderr = '422 label already exists';
      throw error;
    }
    assert.equal(args[1], `repos/{owner}/{repo}/labels/${encodeURIComponent(name)}`);
    return JSON.stringify({ name, description });
  };
  assert.throws(() => acquireD02OneShotGitHubLatch(gh, claim), (error) =>
    error instanceof D02OneShotClaimError && error.code === 'D02_ONESHOT_ALREADY_CLAIMED');
  assert.deepEqual(verifyD02OneShotGitHubLatch((...args) => {
    assert.equal(args[1], `repos/{owner}/{repo}/labels/${encodeURIComponent(name)}`);
    return JSON.stringify({ name, description });
  }, claim), { name, description });
});

test('D02 claim persists and reads back only after its global latch is acquired', () => {
  const calls = [];
  let stored = null;
  const result = claimD02OneShotAtomically({
    claim,
    assertReady: () => calls.push('ready'),
    acquireGlobalLatch: (value) => {
      calls.push('latch');
      assert.equal(value, claim);
      return true;
    },
    persistClaim: (value) => {
      calls.push('persist');
      stored = structuredClone(value);
    },
    readClaim: () => {
      calls.push('readback');
      return stored;
    },
  });
  assert.deepEqual(calls, ['ready', 'latch', 'persist', 'readback']);
  assert.deepEqual(result, claim);
});

test('D02 claim fails closed when exact PR-body readback differs', () => {
  let persisted = false;
  assert.throws(() => claimD02OneShotAtomically({
    claim,
    assertReady() {},
    acquireGlobalLatch() { return true; },
    persistClaim() { persisted = true; },
    readClaim() { return { ...claim, baseSha: 'f'.repeat(40) }; },
  }), (error) => error instanceof D02OneShotClaimError &&
    error.code === 'D02_ONESHOT_CLAIM_READBACK_MISMATCH');
  assert.equal(persisted, true);
});

test('D02 terminal labels bind the immutable claim and sanitized report digest', () => {
  const reportSha = 'e'.repeat(64);
  const description = d02OneShotTerminalLabelDescription(claim, 'REPORT_WRITTEN', reportSha);
  const inconclusive = d02OneShotTerminalLabelDescription(claim, 'INCONCLUSIVE');
  assert.equal(d02OneShotTerminalLabelName(), 'harness-r95-d02-search-subjects-terminal');
  assert.notEqual(description, inconclusive);
  assert.equal(description.length < 100, true);
  const gh = (...args) => {
    assert.equal(args[1], 'repos/{owner}/{repo}/labels');
    return JSON.stringify({ name: d02OneShotTerminalLabelName(), description });
  };
  const label = acquireD02OneShotTerminalGitHubLatch(gh, claim, 'REPORT_WRITTEN', reportSha);
  assert.equal(verifyD02OneShotTerminalLabel(label, claim, 'REPORT_WRITTEN', reportSha), true);
  assert.equal(verifyD02OneShotTerminalLabel(label, claim, 'REPORT_WRITTEN', 'f'.repeat(64)), false);
});
