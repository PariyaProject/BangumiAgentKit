import assert from 'node:assert/strict';
import test from 'node:test';
import {
  D07OneShotClaimError,
  acquireD07OneShotGitHubLatch,
  acquireD07OneShotTerminalGitHubLatch,
  claimD07OneShotAtomically,
  d07OneShotLatchLabelDescription,
  d07OneShotLatchLabelName,
  d07OneShotClaimIdFromLabel,
  d07OneShotTerminalLabelDescription,
  d07OneShotTerminalLabelName,
  verifyD07OneShotGitHubLatch,
} from '../../scripts/lib/d07-one-shot-claim.mjs';

const claim = {
  schemaVersion: 1,
  claimId: 'd07-run-95-pr-158-aaaaaaaaaaaa-cccccccccccc',
  runNumber: 95,
  frontierId: 'D07',
  toolName: 'bangumi.query_subjects',
  state: 'CLAIMED',
  sourceCandidateSha: 'a'.repeat(40),
  baseSha: 'b'.repeat(40),
  expectedArgumentsSha256: 'c'.repeat(64),
  retryAllowed: false,
};

test('D07 claim is create-once, readiness is rechecked, and persistence is read back', () => {
  const events = [];
  let saved;
  const result = claimD07OneShotAtomically({
    claim,
    assertReady: () => events.push('ready'),
    acquireGlobalLatch: (value) => {
      assert.equal(value, claim);
      events.push('latch');
      return true;
    },
    persistClaim: (value) => {
      saved = value;
      events.push('persist');
    },
    readClaim: () => {
      events.push('readback');
      return saved;
    },
    verifyClaim: (observed, expected) => observed === expected,
  });

  assert.equal(result, claim);
  assert.deepEqual(events, ['ready', 'latch', 'ready', 'persist', 'readback']);
});

test('persists a local recovery journal before the permanent repository latch', () => {
  const events = [];
  let saved;
  const result = claimD07OneShotAtomically({
    claim,
    assertReady: () => events.push('ready'),
    persistLocalClaim: (value) => {
      assert.equal(value, claim);
      events.push('local');
    },
    acquireGlobalLatch: () => {
      events.push('latch');
      return true;
    },
    persistClaim: (value) => {
      saved = value;
      events.push('persist');
    },
    readClaim: () => {
      events.push('readback');
      return saved;
    },
    verifyClaim: (observed, expected) => observed === expected,
  });

  assert.equal(result, claim);
  assert.deepEqual(events, ['ready', 'local', 'ready', 'latch', 'ready', 'persist', 'readback']);
});

test('a failed local recovery write cannot acquire the permanent latch', () => {
  let latchAttempts = 0;
  assert.throws(
    () =>
      claimD07OneShotAtomically({
        claim,
        assertReady() {},
        persistLocalClaim() {
          throw new Error('disk unavailable');
        },
        acquireGlobalLatch() {
          latchAttempts += 1;
          return true;
        },
        persistClaim() {},
        readClaim: () => claim,
        verifyClaim: () => true,
      }),
    /disk unavailable/u,
  );
  assert.equal(latchAttempts, 0);
});

test('D07 latch identity is deterministic and permanently scoped to Run 95', () => {
  assert.equal(d07OneShotLatchLabelName(), 'harness-r95-d07-query-subjects-claimed');
  assert.match(d07OneShotLatchLabelDescription(), /Run 95 D07 query_subjects one-shot/u);
  assert.equal(d07OneShotLatchLabelDescription().length <= 100, true);
});

test('a mismatch after latch acquisition cannot proceed to the query claim', () => {
  const events = [];
  assert.throws(
    () =>
      claimD07OneShotAtomically({
        claim,
        assertReady: () => events.push('ready'),
        acquireGlobalLatch: () => true,
        persistClaim: () => events.push('persist'),
        readClaim: () => ({ ...claim, sourceCandidateSha: 'd'.repeat(40) }),
        verifyClaim: (observed, expected) =>
          observed.sourceCandidateSha === expected.sourceCandidateSha,
      }),
    D07OneShotClaimError,
  );
  assert.deepEqual(events, ['ready', 'ready', 'persist']);
});

test('creates a repository-wide D07 claim label with permanent no-retry metadata', () => {
  let request;
  const gh = (...args) => {
    request = args;
    return JSON.stringify({
      name: d07OneShotLatchLabelName(),
      description: d07OneShotLatchLabelDescription(),
    });
  };

  assert.equal(acquireD07OneShotGitHubLatch(gh), true);
  assert.equal(request[0], 'api');
  assert.equal(request[1], 'repos/{owner}/{repo}/labels');
  assert.equal(request[2], '--method');
  assert.equal(request[3], 'POST');
  assert.deepEqual(JSON.parse(request.at(-1).input), {
    name: d07OneShotLatchLabelName(),
    color: 'b60205',
    description: d07OneShotLatchLabelDescription(),
  });
});

test('binds the permanent D07 repository latch to the exact claim ID', () => {
  const labels = new Map();
  const gh = (...args) => {
    if (args[0] === 'api' && args[1] === 'repos/{owner}/{repo}/labels') {
      const input = JSON.parse(args.at(-1).input);
      if (labels.has(input.name)) throw new Error('HTTP 422 Validation Failed');
      labels.set(input.name, { name: input.name, ...input });
      return JSON.stringify(labels.get(input.name));
    }
    if (args[0] === 'api' && args[1].includes('/labels/')) {
      const name = decodeURIComponent(args[1].split('/').at(-1));
      if (!labels.has(name)) throw new Error('HTTP 404 Not Found');
      return JSON.stringify(labels.get(name));
    }
    throw new Error('unexpected gh command');
  };
  const claimId = claim.claimId;
  assert.equal(acquireD07OneShotGitHubLatch(gh, claimId), true);
  const label = verifyD07OneShotGitHubLatch(gh, claimId);
  assert.equal(d07OneShotClaimIdFromLabel(label), claimId);
  assert.throws(
    () => verifyD07OneShotGitHubLatch(gh, `${claimId}0`),
    (error) => error instanceof D07OneShotClaimError,
  );
});

test('terminal label binds an immutable D07 report digest', () => {
  const reportSha256 = 'e'.repeat(64);
  let request;
  const gh = (...args) => {
    request = args;
    return JSON.stringify({
      name: d07OneShotTerminalLabelName(),
      description: d07OneShotTerminalLabelDescription('REPORT_WRITTEN', reportSha256),
    });
  };

  const result = acquireD07OneShotTerminalGitHubLatch(gh, 'REPORT_WRITTEN', reportSha256);

  assert.deepEqual(result, { state: 'REPORT_WRITTEN', reportSha256, created: true });
  assert.deepEqual(JSON.parse(request.at(-1).input), {
    name: d07OneShotTerminalLabelName(),
    color: '0e8a16',
    description: `D07-REPORT_WRITTEN:sha256=${reportSha256}`,
  });
});
