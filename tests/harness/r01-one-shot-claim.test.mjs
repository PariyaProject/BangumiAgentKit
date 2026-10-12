import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import test from 'node:test';
import {
  acquireR01OneShotGitHubLatch,
  claimR01OneShotAtomically,
  r01OneShotLatchLabelDescription,
  r01OneShotLatchLabelName,
} from '../../scripts/lib/r01-one-shot-claim.mjs';

const moduleUrl = pathToFileURL(
  path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../scripts/lib/r01-one-shot-claim.mjs',
  ),
).href;

const workerSource = `
const { parentPort, workerData } = require('node:worker_threads');
const state = new Int32Array(workerData.sharedState);
const waitForBothPreflights = () => {
  const ready = Atomics.add(state, 0, 1) + 1;
  if (ready === 2) Atomics.notify(state, 0, 2);
  else while (Atomics.load(state, 0) < 2) Atomics.wait(state, 0, 1);
};
(async () => {
  const { acquireR01OneShotGitHubLatch, claimR01OneShotAtomically } = await import(workerData.moduleUrl);
  const id = workerData.id;
  const claim = { claimId: 'claim-' + id, prNumber: id === 1 ? 143 : 145, candidate: 'candidate-' + id };
  const latchName = 'harness-r95-r01-subject-relations-claimed';
  const latchDescription = 'Run 95 R01 bangumi.get_subject_relations one-shot latch; permanent; never remove or recreate.';
  const fakeGh = (...args) => {
    const route = args[1];
    if (args[0] !== 'api') throw new Error('unexpected GitHub command');
    if (route === 'repos/{owner}/{repo}/labels' && args.includes('--method')) {
      const label = JSON.parse(args.at(-1).input);
      if (label.name !== latchName || label.description !== latchDescription) throw new Error('unexpected latch metadata');
      if (Atomics.compareExchange(state, 1, 0, id) !== 0) throw new Error('422 label exists');
      return JSON.stringify(label);
    }
    if (route === 'repos/{owner}/{repo}/labels/' + encodeURIComponent(latchName)) {
      if (Atomics.load(state, 1) === 0) throw new Error('404 label missing');
      return JSON.stringify({ name: latchName, description: latchDescription });
    }
    throw new Error('unexpected GitHub API route: ' + route);
  };
  let readinessCalls = 0;
  try {
    const accepted = claimR01OneShotAtomically({
      claim,
      assertReady() {
        readinessCalls += 1;
        if (readinessCalls === 1) waitForBothPreflights();
        else if (Atomics.load(state, 1) !== id || Atomics.load(state, 2) !== 0) throw new Error('only latch owner may persist');
      },
      acquireGlobalLatch: () => acquireR01OneShotGitHubLatch(fakeGh),
      persistClaim(value) {
        if (Atomics.load(state, 1) !== id || Atomics.load(state, 2) !== 0) throw new Error('non-owner attempted claim persistence');
        Atomics.store(state, 2, id);
      },
      readClaim() {
        const owner = Atomics.load(state, 2);
        return owner === 0 ? null : { claimId: 'claim-' + owner, prNumber: owner === 1 ? 143 : 145, candidate: 'candidate-' + owner };
      },
      verifyClaim(observed, expected) { return JSON.stringify(observed) === JSON.stringify(expected); },
    });
    if (accepted.claimId !== claim.claimId) throw new Error('readback changed the winning claim');
    Atomics.add(state, 3, 1); // Query authority is granted only after durable claim readback.
    parentPort.postMessage({ id, won: true, claimId: accepted.claimId });
  } catch (error) {
    parentPort.postMessage({ id, won: false, errorCode: error.code ?? 'UNCLASSIFIED' });
  }
})();
`;

function startClone(id, sharedState) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(workerSource, {
      eval: true,
      workerData: { id, sharedState, moduleUrl },
    });
    worker.once('message', resolve);
    worker.once('error', reject);
    worker.once('exit', (code) => {
      if (code !== 0) reject(new Error(`clone worker ${id} exited ${code}`));
    });
  });
}

test('independent clones and replacement PRs share one repository Run/tool latch', async () => {
  const sharedState = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT * 4);
  const state = new Int32Array(sharedState);
  const results = await Promise.all([startClone(1, sharedState), startClone(2, sharedState)]);
  assert.equal(results.filter((result) => result.won).length, 1, JSON.stringify(results));
  assert.equal(results.filter((result) => !result.won && result.errorCode === 'R01_ONESHOT_ALREADY_CLAIMED').length, 1);
  assert.equal(Atomics.load(state, 3), 1, 'only the durable claim readback winner receives query authority');
  assert.equal(Atomics.load(state, 2), results.find((result) => result.won).id);
});

test('the global label is permanent and duplicate, conflicting, or uncertain acquisition fails closed', () => {
  const labels = new Map();
  const fakeGh = (...args) => {
    const route = args[1];
    if (args[0] !== 'api') throw new Error('unexpected GitHub command');
    if (args.includes('--method') && args[args.indexOf('--method') + 1] === 'POST') {
      const label = JSON.parse(args.at(-1).input);
      if (labels.has(label.name)) throw new Error('422 label exists');
      labels.set(label.name, label);
      return JSON.stringify(label);
    }
    const name = decodeURIComponent(route.split('/').at(-1));
    const label = labels.get(name);
    if (!label) throw new Error('404 label missing');
    return JSON.stringify(label);
  };
  const name = r01OneShotLatchLabelName();
  assert.equal(
    r01OneShotLatchLabelDescription(),
    'Run 95 R01 bangumi.get_subject_relations one-shot latch; permanent; never remove or recreate.',
  );
  assert.equal(name, 'harness-r95-r01-subject-relations-claimed');
  assert.equal(acquireR01OneShotGitHubLatch(fakeGh), true);
  assert.throws(() => acquireR01OneShotGitHubLatch(fakeGh), (error) => error.code === 'R01_ONESHOT_ALREADY_CLAIMED');
  labels.set(name, { name, description: 'unexpected' });
  assert.throws(() => acquireR01OneShotGitHubLatch(fakeGh), (error) => error.code === 'R01_ONESHOT_LATCH_CONFLICT');
  assert.throws(
    () => acquireR01OneShotGitHubLatch(() => { throw new Error('network unavailable'); }),
    (error) => error.code === 'R01_ONESHOT_LATCH_UNCERTAIN',
  );
});

test('claim persistence failure or mismatched PR readback never grants query authority', () => {
  for (const mode of ['persistence-failure', 'readback-mismatch']) {
    let queryAuthority = 0;
    let persisted = null;
    const claim = { claimId: 'claim-1', prNumber: 143, candidate: 'candidate-1' };
    assert.throws(() => {
      const accepted = claimR01OneShotAtomically({
        claim,
        assertReady() {},
        acquireGlobalLatch: () => true,
        persistClaim(value) {
          if (mode === 'persistence-failure') throw new Error('PR update failed');
          persisted = value;
        },
        readClaim() {
          return mode === 'readback-mismatch' ? { ...persisted, claimId: 'other-claim' } : persisted;
        },
        verifyClaim(observed, expected) { return JSON.stringify(observed) === JSON.stringify(expected); },
      });
      queryAuthority += 1;
      return accepted;
    }, mode === 'persistence-failure' ? /PR update failed/u : (error) => error.code === 'R01_ONESHOT_CLAIM_READBACK_MISMATCH');
    assert.equal(queryAuthority, 0, `${mode} must not authorize the Product query`);
  }
});
