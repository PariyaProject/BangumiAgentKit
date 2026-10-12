import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import fs from 'node:fs';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import test from 'node:test';
import {
  acquireG04OneShotGitHubLatch,
  claimG04OneShotAtomically,
  g04OneShotLatchLabelName,
} from '../../scripts/lib/g04-one-shot-claim.mjs';

const moduleUrl = pathToFileURL(
  path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../scripts/lib/g04-one-shot-claim.mjs',
  ),
).href;

const workerSource = `
const { parentPort, workerData } = require('node:worker_threads');
const fs = require('node:fs');
const state = new Int32Array(workerData.sharedState);
const waitForBothPreflights = () => {
  const ready = Atomics.add(state, 0, 1) + 1;
  if (ready === 2) Atomics.notify(state, 0, 2);
  else while (Atomics.load(state, 0) < 2) Atomics.wait(state, 0, 1);
};
(async () => {
  const { acquireG04OneShotGitHubLatch, claimG04OneShotAtomically } = await import(workerData.moduleUrl);
  const id = workerData.id;
  const claim = {
    claimId: 'claim-' + id,
    prNumber: id === 1 ? 137 : 138,
    candidate: 'exact-candidate',
    base: 'exact-base',
  };
  const latchName = 'harness-r95-g04-person-activity-claimed';
  const latchDescription = 'Run 95 G04 bangumi.get_person_activity one-shot latch; permanent; never remove or recreate.';
  const fakeGh = (...args) => {
    const route = args[1];
    if (args[0] !== 'api') throw new Error('unexpected GitHub command');
    if (route === 'repos/{owner}/{repo}/labels' && args.includes('--method')) {
      const label = JSON.parse(args.at(-1).input);
      const existingOwner = Atomics.compareExchange(state, 1, 0, id);
      if (existingOwner !== 0) throw new Error('422 Validation Failed: label already exists');
      if (label.name !== latchName || label.description !== latchDescription) {
        throw new Error('unexpected latch metadata');
      }
      return JSON.stringify(label);
    }
    if (route === 'repos/{owner}/{repo}/labels/' + encodeURIComponent(latchName)) {
      if (Atomics.load(state, 1) === 0) throw new Error('404 Not Found');
      return JSON.stringify({ name: latchName, description: latchDescription });
    }
    throw new Error('unexpected GitHub API route: ' + route);
  };
  let readinessCalls = 0;
  try {
    const accepted = claimG04OneShotAtomically({
      claim,
      assertReady() {
        readinessCalls += 1;
        if (readinessCalls === 1) {
          if (Atomics.load(state, 2) !== 0) throw new Error('preflight must begin from no claim');
          waitForBothPreflights();
        } else if (Atomics.load(state, 1) !== id || Atomics.load(state, 2) !== 0) {
          throw new Error('the latch owner must revalidate before persisting the claim');
        }
      },
      acquireGlobalLatch: () => acquireG04OneShotGitHubLatch(fakeGh),
      persistClaim(value) {
        if (Atomics.load(state, 1) !== id || Atomics.load(state, 2) !== 0) {
          throw new Error('only the global latch owner can persist the claim');
        }
        Atomics.store(state, 2, id);
      },
      readClaim() {
        const owner = Atomics.load(state, 2);
        return owner === 0 ? null : {
          claimId: 'claim-' + owner,
          prNumber: owner === 1 ? 137 : 138,
          candidate: 'exact-candidate',
          base: 'exact-base',
        };
      },
      verifyClaim(observed, expected) {
        return observed?.claimId === expected?.claimId && observed?.candidate === expected?.candidate &&
          observed?.base === expected?.base;
      },
    });
    if (accepted.claimId !== claim.claimId) throw new Error('winner claim id changed');
    fs.writeFileSync(workerData.localClaimPath, JSON.stringify(accepted), { flag: 'wx', mode: 0o600 });
    Atomics.add(state, 3, 1); // Query authority is granted only after the durable claim returns.
    Atomics.notify(state, 3, 2);
    Atomics.store(state, 4, id); // The terminal result remains bound to the winning claim.
    parentPort.postMessage({ id, won: true, claimId: accepted.claimId, localClaimCreated: true });
  } catch (error) {
    parentPort.postMessage({
      id,
      won: false,
      errorCode: error.code ?? 'UNCLASSIFIED',
      errorMessage: error.message,
      localClaimCreated: false,
    });
  }
})();
`;

function startClone(id, sharedState, localClaimPath) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(workerSource, {
      eval: true,
      workerData: { id, sharedState, localClaimPath, moduleUrl },
    });
    worker.once('message', resolve);
    worker.once('error', reject);
    worker.once('exit', (code) => {
      if (code !== 0) reject(new Error(`clone worker ${id} exited ${code}`));
    });
  });
}

test('two independent PR checkouts share one Run/tool latch and cannot overwrite the winner', async () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'g04-claim-race-'));
  const cloneOne = path.join(temp, 'clone-one', '.git', 'pariya-agent-state');
  const cloneTwo = path.join(temp, 'clone-two', '.git', 'pariya-agent-state');
  fs.mkdirSync(cloneOne, { recursive: true });
  fs.mkdirSync(cloneTwo, { recursive: true });
  const sharedState = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * 5);
  const state = new Int32Array(sharedState);
  let results;
  try {
    results = await Promise.all([
      startClone(1, sharedState, path.join(cloneOne, 'g04-claim.json')),
      startClone(2, sharedState, path.join(cloneTwo, 'g04-claim.json')),
    ]);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
  const winners = results.filter((result) => result.won);
  const losers = results.filter((result) => !result.won);
  assert.equal(winners.length, 1, JSON.stringify(results));
  assert.equal(losers.length, 1, JSON.stringify(results));
  assert.equal(losers[0].errorCode, 'G04_ONESHOT_ALREADY_CLAIMED');
  assert.equal(results.filter((result) => result.localClaimCreated).length, 1);
  assert.equal(Atomics.load(state, 3), 1, 'exactly one invocation may receive query authority');
  assert.equal(Atomics.load(state, 2), winners[0].id, 'loser must not overwrite the winner claim');
  assert.equal(
    Atomics.load(state, 4),
    winners[0].id,
    'winner result must remain bound to its claim',
  );
});

test('GitHub repository label creation is create-once and duplicate/uncertain results fail closed', () => {
  const labels = new Map();
  const fakeGh = (...args) => {
    const route = args[1];
    if (args[0] !== 'api') throw new Error('unexpected GitHub command');
    if (args.includes('--method') && args[args.indexOf('--method') + 1] === 'POST') {
      const options = args.at(-1);
      const label = JSON.parse(options.input);
      if (labels.has(label.name)) throw new Error('422 Validation Failed');
      labels.set(label.name, label);
      return JSON.stringify(label);
    }
    const labelName = decodeURIComponent(route.split('/').at(-1));
    const existing = labels.get(labelName);
    if (!existing) throw new Error('404 Not Found');
    return JSON.stringify(existing);
  };
  const latchName = g04OneShotLatchLabelName();
  assert.equal(latchName, 'harness-r95-g04-person-activity-claimed');
  assert.equal(acquireG04OneShotGitHubLatch(fakeGh), true);
  assert.throws(
    () => acquireG04OneShotGitHubLatch(fakeGh),
    (error) => error.code === 'G04_ONESHOT_ALREADY_CLAIMED',
  );
  labels.set(latchName, { name: latchName, description: 'unexpected metadata' });
  assert.throws(
    () => acquireG04OneShotGitHubLatch(fakeGh),
    (error) => error.code === 'G04_ONESHOT_LATCH_CONFLICT',
  );
  assert.throws(
    () =>
      acquireG04OneShotGitHubLatch((...args) => {
        if (args.includes('--method')) throw new Error('network failure');
        throw new Error('network failure');
      }),
    (error) => error.code === 'G04_ONESHOT_LATCH_UNCERTAIN',
  );
});

test('the active Candidate gate is revalidated after the global latch and before persisting a claim', () => {
  let readinessCalls = 0;
  let persisted = 0;
  let read = 0;
  let queryAuthorized = false;
  assert.throws(() => {
    claimG04OneShotAtomically({
      claim: { claimId: 'candidate-bound-claim' },
      assertReady() {
        readinessCalls += 1;
        if (readinessCalls === 2) throw new Error('Candidate changed after latch acquisition');
      },
      acquireGlobalLatch: () => true,
      persistClaim() {
        persisted += 1;
      },
      readClaim() {
        read += 1;
        return null;
      },
      verifyClaim: () => false,
    });
    queryAuthorized = true;
  }, /Candidate changed after latch acquisition/u);
  assert.equal(readinessCalls, 2);
  assert.equal(persisted, 0);
  assert.equal(read, 0);
  assert.equal(queryAuthorized, false);
});

test('claim persistence failures and mismatched readback never grant query authority', () => {
  let queryAuthorized = false;
  let readCalls = 0;
  assert.throws(() => {
    claimG04OneShotAtomically({
      claim: { claimId: 'persist-failure' },
      assertReady() {},
      acquireGlobalLatch: () => true,
      persistClaim() {
        throw new Error('Harness PR persistence failed');
      },
      readClaim() {
        readCalls += 1;
        return null;
      },
      verifyClaim: () => false,
    });
    queryAuthorized = true;
  }, /Harness PR persistence failed/u);
  assert.equal(readCalls, 0);
  assert.equal(queryAuthorized, false);

  assert.throws(
    () => {
      claimG04OneShotAtomically({
        claim: { claimId: 'expected-claim' },
        assertReady() {},
        acquireGlobalLatch: () => true,
        persistClaim() {},
        readClaim: () => ({ claimId: 'other-claim' }),
        verifyClaim: (observed, expected) => observed?.claimId === expected?.claimId,
      });
      queryAuthorized = true;
    },
    (error) => error.code === 'G04_ONESHOT_CLAIM_READBACK_MISMATCH',
  );
  assert.equal(queryAuthorized, false);
});
