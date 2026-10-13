import assert from 'node:assert/strict';
import test from 'node:test';
import {
  d07RunnerProcessTitle,
  isD07RunnerProcessActive,
  setD07RunnerProcessTitle,
} from '../../scripts/lib/d07-runner-liveness.mjs';

const claimId = 'd07-run-95-pr-158-8b935648f793-cccccccccccc';

test('D07 liveness uses a claim-specific process title and confirms the current PID', () => {
  const originalTitle = process.title;
  try {
    assert.equal(setD07RunnerProcessTitle(claimId), `d07-run95-${claimId}`);
    assert.equal(isD07RunnerProcessActive({ runnerPid: process.pid, claimId }), true);
    assert.equal(
      isD07RunnerProcessActive({ runnerPid: process.pid, claimId: `${claimId}0` }),
      false,
    );
    assert.equal(isD07RunnerProcessActive({ runnerPid: -1, claimId }), false);
  } finally {
    process.title = originalTitle;
  }
});

test('rejects malformed D07 claim identities before using them as process titles', () => {
  assert.throws(() => d07RunnerProcessTitle('unknown'), TypeError);
});
