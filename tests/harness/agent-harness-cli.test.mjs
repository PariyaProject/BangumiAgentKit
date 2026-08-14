import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import {
  EPOCH_MARKER,
  RUN_MARKER,
  createEpochState,
  createRunState,
  parseControlBlock,
  renderEpochBody,
  renderRunBody,
} from '../../scripts/lib/agent-harness-core.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const cli = path.join(root, 'scripts/agent-harness.mjs');
const mockBin = path.join(root, 'tests/harness/mock-harness-bin.mjs');
const sha = (digit) => digit.repeat(40);
const mandatoryChecks = [
  'harness-control',
  'sqlite-default',
  'host-integration',
  'standalone-release-smoke',
  'postgres-compat',
  'provider-foundation',
  'discovery-foundation',
];

function controlFixture() {
  const run = createRunState({ runId: 'run-cli' });
  run.state = 'EPOCH_ACTIVE';
  run.active_epoch_pr = 42;
  const epoch = createEpochState({
    epochId: 'epoch-cli',
    baseSha: sha('a'),
    objective: 'Exercise the real Harness CLI lifecycle',
    questions: ['Does the governed lifecycle work end to end?'],
    workPackages: ['control plane', 'integration'],
    nonScope: ['product behavior'],
    acceptanceCriteria: ['All invariants are executable.'],
  });
  epoch.branch = 'codex/epoch-cli';
  epoch.pr_number = 42;
  epoch.state = 'IMPLEMENTING';
  return { run, epoch };
}

function createMockEnvironment(overrides = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'bangumi-harness-cli-'));
  const binDirectory = path.join(directory, 'bin');
  fs.mkdirSync(binDirectory);
  for (const tool of ['git', 'gh']) {
    const wrapper = path.join(binDirectory, tool);
    fs.writeFileSync(wrapper, `#!/bin/sh\nexec "${process.execPath}" "${mockBin}" ${tool} "$@"\n`);
    fs.chmodSync(wrapper, 0o755);
  }
  const { run, epoch } = controlFixture();
  const statePath = path.join(directory, 'state.json');
  const state = {
    runBody: renderRunBody(run),
    prBody: renderEpochBody(epoch),
    prState: 'OPEN',
    draft: true,
    branch: epoch.branch,
    baseBranch: 'master',
    featureBranch: epoch.branch,
    baseSha: sha('a'),
    featureHeadSha: sha('b'),
    mergeSha: sha('c'),
    mergeAllowed: true,
    candidateIsAncestor: true,
    remoteFeatureExists: true,
    localFeatureExists: true,
    dirty: '',
    changedPaths: ['packages/bangumi-core/src/example.ts'],
    commitSubjects: ['feat(example): complete coherent capability'],
    checks: mandatoryChecks.map((name) => ({ name, conclusion: 'SUCCESS' })),
    calls: [],
    ...overrides,
  };
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
  return {
    directory,
    statePath,
    run,
    epoch,
    execute(args) {
      return spawnSync(process.execPath, [cli, ...args], {
        cwd: root,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${binDirectory}:${process.env.PATH}`,
          HARNESS_MOCK_STATE: statePath,
        },
      });
    },
    readState() {
      return JSON.parse(fs.readFileSync(statePath, 'utf8'));
    },
    cleanup() {
      fs.rmSync(directory, { recursive: true, force: true });
    },
  };
}

function candidateEvidence(environment) {
  const file = path.join(environment.directory, 'evidence.json');
  fs.writeFileSync(
    file,
    JSON.stringify({
      base_sha: sha('a'),
      candidate_sha: sha('b'),
      validation: ['focused and full validation passed'],
      scope_closure: {
        why_not_review_earlier: 'All closely related Work Packages are complete.',
        why_not_extend_further: 'Further work is a different product objective.',
        related_work_remaining: false,
      },
      adversarial_preflight: {
        completed: true,
        summary: 'Bounds, evidence, failures, contracts, and integration were challenged.',
      },
    }),
  );
  return file;
}

test('CLI Candidate gate makes the Draft PR ready and refreshes its human-readable body', () => {
  const environment = createMockEnvironment();
  try {
    const result = environment.execute([
      'candidate:check',
      '--pr',
      '42',
      '--evidence',
      candidateEvidence(environment),
    ]);
    assert.equal(result.status, 0, result.stderr);
    const state = environment.readState();
    assert.equal(state.draft, false);
    const epoch = parseControlBlock(state.prBody, EPOCH_MARKER);
    assert.equal(epoch.state, 'REVIEW_READY');
    assert.equal(epoch.candidate_sha, sha('b'));
    assert.match(state.prBody, /All closely related Work Packages are complete\./u);
    assert.ok(
      state.calls.some(
        (call) => call.tool === 'gh' && call.args[0] === 'pr' && call.args[1] === 'ready',
      ),
    );
  } finally {
    environment.cleanup();
  }
});

test('CLI Candidate gate rejects SKIPPED mandatory CI and does not ready the PR', () => {
  const checks = mandatoryChecks.map((name) => ({
    name,
    conclusion: name === 'sqlite-default' ? 'SKIPPED' : 'SUCCESS',
  }));
  const environment = createMockEnvironment({ checks });
  try {
    const result = environment.execute([
      'candidate:check',
      '--pr',
      '42',
      '--evidence',
      candidateEvidence(environment),
    ]);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /^EXACT_SHA_CI_REQUIRED:/u);
    assert.equal(environment.readState().draft, true);
  } finally {
    environment.cleanup();
  }
});

test('CLI review reservation rejects dirty post-Candidate work before any control write', () => {
  const { run, epoch } = controlFixture();
  epoch.state = 'REVIEW_READY';
  epoch.candidate_sha = sha('b');
  epoch.ci = { sha: sha('b'), status: 'SUCCESS', url: 'https://example.test/ci' };
  epoch.scope_closure = {
    why_not_review_earlier: 'Related work complete.',
    why_not_extend_further: 'Next work is independent.',
    related_work_remaining: false,
  };
  epoch.adversarial_preflight = { completed: true, summary: 'Adversarial pass complete.' };
  const environment = createMockEnvironment({
    runBody: renderRunBody(run),
    prBody: renderEpochBody(epoch),
    dirty: '?? uncommitted-implementation.ts',
  });
  try {
    const result = environment.execute(['review:reserve', '--run', '1', '--pr', '42']);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /^UNSAFE_DIRTY_WORKTREE:/u);
    assert.equal(
      environment.readState().calls.some((call) => call.tool === 'gh' && call.args[1] === 'edit'),
      false,
    );
  } finally {
    environment.cleanup();
  }
});

test('CLI refuses a new Epoch while the outer quality circuit breaker is active', () => {
  const { run } = controlFixture();
  run.state = 'QUALITY_CIRCUIT_BREAKER';
  run.active_epoch_pr = null;
  const environment = createMockEnvironment({
    runBody: renderRunBody(run),
    branch: 'master',
  });
  const spec = path.join(environment.directory, 'epoch.json');
  fs.writeFileSync(spec, JSON.stringify({ epoch_id: 'forbidden', objective: 'Must not start' }));
  try {
    const result = environment.execute(['epoch:start', '--run', '1', '--spec', spec]);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /^RUN_NOT_ACTIVE:/u);
  } finally {
    environment.cleanup();
  }
});

function mergeReadyEnvironment(overrides = {}) {
  const { run, epoch } = controlFixture();
  epoch.state = 'REVIEW_PASSED';
  epoch.candidate_sha = sha('b');
  epoch.reviewed_base_sha = sha('a');
  epoch.review_pass_sha = sha('b');
  epoch.ci = { sha: sha('b'), status: 'SUCCESS', url: 'https://example.test/ci' };
  epoch.review.consumed = 1;
  run.outer_sol.consumed = 1;
  return createMockEnvironment({
    runBody: renderRunBody(run),
    prBody: renderEpochBody(epoch),
    draft: false,
    ...overrides,
  });
}

test('CLI PASS path merges, verifies ancestry, cleans both branches, and synchronizes master', () => {
  const environment = mergeReadyEnvironment();
  try {
    const result = environment.execute(['epoch:merge', '--run', '1', '--pr', '42']);
    assert.equal(result.status, 0, result.stderr);
    const state = environment.readState();
    const epoch = parseControlBlock(state.prBody, EPOCH_MARKER);
    const run = parseControlBlock(state.runBody, RUN_MARKER);
    assert.equal(epoch.state, 'MERGED');
    assert.equal(run.state, 'ACTIVE');
    assert.equal(run.active_epoch_pr, null);
    assert.equal(state.branch, 'master');
    assert.equal(state.remoteFeatureExists, false);
    assert.equal(state.localFeatureExists, false);
  } finally {
    environment.cleanup();
  }
});

test('CLI merge permission failure records INTEGRATION_BLOCKED on the same PR and Run', () => {
  const environment = mergeReadyEnvironment({ mergeAllowed: false });
  try {
    const result = environment.execute(['epoch:merge', '--run', '1', '--pr', '42']);
    assert.equal(result.status, 2);
    const state = environment.readState();
    assert.equal(parseControlBlock(state.prBody, EPOCH_MARKER).state, 'INTEGRATION_BLOCKED');
    assert.equal(parseControlBlock(state.runBody, RUN_MARKER).state, 'INTEGRATION_BLOCKED');
    assert.equal(state.prState, 'OPEN');
  } finally {
    environment.cleanup();
  }
});

test('CLI base drift with exhausted review budget parks the PR and leaves the Run coherent', () => {
  const environment = mergeReadyEnvironment({ baseSha: sha('d') });
  const state = environment.readState();
  const epoch = parseControlBlock(state.prBody, EPOCH_MARKER);
  const run = parseControlBlock(state.runBody, RUN_MARKER);
  epoch.review.max = 1;
  run.outer_sol.max = 1;
  fs.writeFileSync(
    environment.statePath,
    `${JSON.stringify(
      {
        ...state,
        prBody: renderEpochBody(epoch),
        runBody: renderRunBody(run),
      },
      null,
      2,
    )}\n`,
  );
  try {
    const result = environment.execute(['epoch:merge', '--run', '1', '--pr', '42']);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /^PARKED_REVIEW_LIMIT:/u);
    const parked = environment.readState();
    const parkedEpoch = parseControlBlock(parked.prBody, EPOCH_MARKER);
    const activeRun = parseControlBlock(parked.runBody, RUN_MARKER);
    assert.equal(parkedEpoch.state, 'PARKED_REVIEW_LIMIT');
    assert.equal(activeRun.state, 'ACTIVE');
    assert.equal(activeRun.active_epoch_pr, null);
    assert.deepEqual(activeRun.parked_epoch_prs, [42]);
    assert.equal(
      parked.calls.some(
        (call) => call.tool === 'gh' && call.args[0] === 'pr' && call.args[1] === 'merge',
      ),
      false,
    );
  } finally {
    environment.cleanup();
  }
});

test('CLI post-merge ancestry failure records the merged PR and truthful blocker', () => {
  const environment = mergeReadyEnvironment({ candidateIsAncestor: false });
  try {
    const result = environment.execute(['epoch:merge', '--run', '1', '--pr', '42']);
    assert.equal(result.status, 2);
    const state = environment.readState();
    const epoch = parseControlBlock(state.prBody, EPOCH_MARKER);
    assert.equal(state.prState, 'MERGED');
    assert.equal(epoch.state, 'INTEGRATION_BLOCKED');
    assert.equal(epoch.github_pr_state, 'MERGED');
    assert.equal(epoch.merge_sha, sha('c'));
    assert.equal(parseControlBlock(state.runBody, RUN_MARKER).state, 'INTEGRATION_BLOCKED');
  } finally {
    environment.cleanup();
  }
});
