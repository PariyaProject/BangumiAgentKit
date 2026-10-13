import test from 'node:test';
import assert from 'node:assert/strict';
import {
  acquireG06OneShotGitHubLatch,
  acquireG06OneShotTerminalGitHubLatch,
  claimG06OneShotAtomically,
  g06OneShotLatchLabelDescription,
  g06OneShotLatchLabelName,
  g06OneShotTerminalLabelDescription,
  g06OneShotTerminalLabelName,
  G06OneShotClaimError,
  readG06OneShotTerminalGitHubLatch,
  verifyG06OneShotGitHubLatch,
} from '../../scripts/lib/g06-one-shot-claim.mjs';
import { createG06RunnerReceiptKeyPair } from '../../scripts/acceptance/g06-runner-receipt.mjs';

function mockGitHubApi({ createError = false, labels = new Map() } = {}) {
  const calls = [];
  const gh = (...args) => {
    const options = args.at(-1) && typeof args.at(-1) === 'object' ? args.pop() : {};
    const command = args;
    calls.push(command);
    if (command[0] !== 'api') throw new Error('unexpected command');
    if (command[1] === 'repos/{owner}/{repo}/labels' && command[2] === '--method') {
      if (createError) throw new Error('422 already_exists');
      const body = JSON.parse(options.input);
      if (labels.has(body.name)) throw new Error('422 already_exists');
      labels.set(body.name, body);
      return JSON.stringify(body);
    }
    const prefix = 'repos/{owner}/{repo}/labels/';
    if (command[1]?.startsWith(prefix)) {
      const name = decodeURIComponent(command[1].slice(prefix.length));
      if (!labels.has(name)) throw new Error('404 Not Found');
      return JSON.stringify(labels.get(name));
    }
    throw new Error('unexpected GitHub API request');
  };
  return { gh, calls, labels };
}

test('G06 repository-wide one-shot latch is create-once and verifies exact metadata', () => {
  const { gh, labels } = mockGitHubApi();
  const receiptPublicKey = createG06RunnerReceiptKeyPair().receiptPublicKey;
  assert.equal(g06OneShotLatchLabelName(), 'harness-r95-g06-subject-cast-claimed');
  assert.equal(acquireG06OneShotGitHubLatch(gh, receiptPublicKey), true);
  assert.equal(
    verifyG06OneShotGitHubLatch(gh, receiptPublicKey).description,
    g06OneShotLatchLabelDescription(receiptPublicKey),
  );
  assert.throws(
    () => acquireG06OneShotGitHubLatch(gh, receiptPublicKey),
    (error) =>
      error instanceof G06OneShotClaimError && error.code === 'G06_ONESHOT_ALREADY_CLAIMED',
  );
  assert.throws(
    () => verifyG06OneShotGitHubLatch(gh, createG06RunnerReceiptKeyPair().receiptPublicKey),
    (error) => error instanceof G06OneShotClaimError && error.code === 'G06_ONESHOT_LATCH_MISSING_OR_CONFLICTING',
  );
  labels.set(g06OneShotLatchLabelName(), {
    name: g06OneShotLatchLabelName(),
    description: 'wrong',
  });
  assert.throws(
    () => verifyG06OneShotGitHubLatch(gh, receiptPublicKey),
    (error) =>
      error instanceof G06OneShotClaimError &&
      error.code === 'G06_ONESHOT_LATCH_MISSING_OR_CONFLICTING',
  );
});

test('G06 claim checks readiness before and after taking the global latch', () => {
  const events = [];
  const claim = { claimId: 'claim-1', state: 'CLAIMED' };
  const observed = claimG06OneShotAtomically({
    claim,
    assertReady: () => events.push('ready'),
    acquireGlobalLatch: () => {
      events.push('latch');
      return true;
    },
    persistClaim: (value) => {
      events.push('persist');
      assert.deepEqual(value, claim);
    },
    readClaim: () => {
      events.push('read');
      return { ...claim };
    },
    verifyClaim: (actual, expected) => JSON.stringify(actual) === JSON.stringify(expected),
  });
  assert.deepEqual(observed, claim);
  assert.deepEqual(events, ['ready', 'latch', 'ready', 'persist', 'read']);
});

test('G06 claim fails closed when the global latch outcome is not confirmed', () => {
  assert.throws(
    () =>
      claimG06OneShotAtomically({
        claim: { claimId: 'claim-1' },
        assertReady() {},
        acquireGlobalLatch: () => false,
        persistClaim() {},
        readClaim() {
          return null;
        },
        verifyClaim() {
          return false;
        },
      }),
    (error) =>
      error instanceof G06OneShotClaimError && error.code === 'G06_ONESHOT_ALREADY_CLAIMED',
  );
});

test('G06 terminal latch binds an immutable report digest or no-report inconclusive result', () => {
  const { gh } = mockGitHubApi();
  const digest = 'a'.repeat(64);
  assert.equal(g06OneShotTerminalLabelName(), 'harness-r95-g06-subject-cast-terminal');
  assert.match(g06OneShotTerminalLabelDescription('REPORT_WRITTEN', digest), /REPORT_WRITTEN/);
  assert.equal(g06OneShotTerminalLabelDescription('INCONCLUSIVE'), 'G06-INCONCLUSIVE:report=none');
  assert.throws(() => g06OneShotTerminalLabelDescription('INCONCLUSIVE', digest));
  const reportLabel = acquireG06OneShotTerminalGitHubLatch(gh, 'REPORT_WRITTEN', digest);
  assert.equal(reportLabel.description, `G06-REPORT_WRITTEN:sha256=${digest}`);
  assert.equal(readG06OneShotTerminalGitHubLatch(gh).description, reportLabel.description);
  assert.throws(
    () => acquireG06OneShotTerminalGitHubLatch(gh, 'INCONCLUSIVE'),
    (error) =>
      error instanceof G06OneShotClaimError && error.code === 'G06_ONESHOT_TERMINAL_CONFLICT',
  );
});
