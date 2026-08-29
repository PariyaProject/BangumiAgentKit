import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import {
  DISCOVERY_LANES,
  DISCOVERY_POLICY_VERSION,
  EPOCH_MARKER,
  NO_OPPORTUNITY_STOP,
  RUN_MARKER,
  createEpochState,
  createRunState,
  parseControlBlock,
  renderEpochBody,
  renderRunBody,
} from '../../scripts/lib/agent-harness-core.mjs';
import { canonicalHash, inspectFrontierLedger } from '../../scripts/lib/frontier-ledger.mjs';

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
  const { frontierLedger, ...stateOverrides } = overrides;
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
    ...stateOverrides,
  };
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
  const frontierLedgerPath = path.join(directory, 'frontier-ledger.json');
  fs.writeFileSync(
    frontierLedgerPath,
    `${JSON.stringify(
      frontierLedger ??
        JSON.parse(fs.readFileSync(path.join(root, 'docs/product/frontier-ledger.json'), 'utf8')),
      null,
      2,
    )}\n`,
  );
  return {
    directory,
    statePath,
    run,
    epoch,
    execute(args, envOverrides = {}) {
      return spawnSync(process.execPath, [cli, ...args], {
        cwd: root,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${binDirectory}:${process.env.PATH}`,
          HARNESS_MOCK_STATE: statePath,
          HARNESS_FRONTIER_LEDGER_PATH: frontierLedgerPath,
          ...envOverrides,
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

function candidateEvidence(environment, overrides = {}) {
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
      ...overrides,
    }),
  );
  return file;
}

function correctiveClosure(findingId = 'sol-2-finding-1') {
  return [
    {
      finding_id: findingId,
      root_cause: 'Falsy metadata handling collapsed valid zero and unknown values.',
      equivalence_class: 'All absent, invalid, contradictory, and zero pagination metadata.',
      generalized_fix: 'Normalize once and preserve the complete metadata state space.',
      regression_tests: ['missing and invalid totals', 'zero-offset repeated page'],
      validation: ['focused tests passed', 'mandatory suite passed'],
    },
  ];
}

function makeDiscoveryEvidence(overrides = {}) {
  const laneAssessments = Object.fromEntries(
    DISCOVERY_LANES.map((lane) => [
      lane,
      {
        observation: `Audit ${lane}: compared named catalog entries, implementation seams, and current coverage contracts at the audited SHA.`,
        conclusion: `Lane ${lane} has no unassessed actionable frontier after the recorded candidate analysis.`,
      },
    ]),
  );
  const candidates = DISCOVERY_LANES.slice(0, 3).map((lane, index) => ({
    id: `candidate-${index + 1}`,
    lane,
    user_question: `Can the product improve the concrete journey ${index + 1}?`,
    source_evidence: `Named source contract ${index + 1} was inspected at the audited SHA.`,
    value_hypothesis: `The candidate could improve a concrete user or Agent journey ${index + 1}.`,
    source_and_coverage_limits:
      'The current source reports a bounded observation and cannot support unobserved negative claims.',
    delta_since_previous_audit:
      'The V3.2 scope-salvage analysis is new and was not present in the previous audit.',
    disposition: index === 0 ? 'ALREADY_DELIVERED' : 'PROTECTED_BOUNDARY',
    reason: 'The narrowed candidate was evaluated against current source and product contracts.',
    scope_salvage: {
      narrowed_user_question: `What bounded evidence can answer journey ${index + 1} without a completeness claim?`,
      output_semantics: 'Return only source-observed facts with explicit partial state.',
      coverage_and_negative_claim_limits:
        'Expose observed, returned, and truncated; never interpret an absent match as nonexistence.',
      resource_bounds: 'At most 3 pages, 100 observed rows, 12 hydrations, and concurrency 2.',
      outcome: 'NO_SAFE_VARIANT',
      rationale: 'After narrowing, the remaining result would duplicate an existing capability.',
    },
    source_contract_research: {
      status: 'NOT_REQUIRED',
      next_step: 'No source-contract research remains for this delivered or protected candidate.',
      closure_evidence: ['Existing capability/source contract and regression evidence inspected.'],
    },
  }));
  return {
    policy_version: DISCOVERY_POLICY_VERSION,
    audited_sha: sha('a'),
    audited_at: '2026-08-10T00:00:00.000Z',
    discovery_delta:
      'Applied the V3.2 scope-salvage and source-frontier policy to every candidate.',
    lane_assessments: laneAssessments,
    candidate_assessments: candidates,
    ...overrides,
  };
}

function makeClosedFrontierLedger() {
  const ledger = JSON.parse(
    fs.readFileSync(path.join(root, 'docs/product/frontier-ledger.json'), 'utf8'),
  );
  for (const record of ledger.records) {
    if (record.status === 'DELIVERED') continue;
    record.status = 'CLOSED_LOW_VALUE';
    record.closure_reason =
      'A complete bounded scope-salvage audit found no independent incremental user value at this policy version.';
    delete record.boundary_id;
    delete record.research_closure;
  }
  return ledger;
}

function bindFrontierEvidence(evidence, ledger) {
  const inspected = inspectFrontierLedger(ledger, {
    pathExists: (relativePath) => fs.existsSync(path.join(root, relativePath)),
  });
  assert.equal(inspected.ok, true, JSON.stringify(inspected.issues));
  evidence.ledger_hash = inspected.hash;
  evidence.frontier_assessments = ledger.records.map((record) => ({
    id: record.id,
    status: record.status,
    conclusion: `${record.id}: for “${record.user_question}”, ${
      record.closure_reason ??
      'The canonical delivered evidence directly proves this bounded frontier is implemented.'
    }`,
    delta_since_previous_audit: `${record.id}: the V3.2 audit now binds “${record.user_question}” to exact ledger and repository evidence.`,
    evidence_refs: record.source_refs,
  }));
  evidence.assessed_frontier_ids = ledger.records.map((record) => record.id);
  evidence.frontier_inventory = inspected.counts;
  return { evidence, inspected };
}

function trustedTerminalRunBody(ledger, evidence = makeDiscoveryEvidence()) {
  const bound = bindFrontierEvidence(evidence, ledger);
  const run = createRunState({ runId: 'terminal-discovery-run' });
  run.state = NO_OPPORTUNITY_STOP;
  run.discovery_exhaustion = bound.evidence;
  run.frontier_closure = {
    state: 'PASS',
    base_sha: bound.evidence.audited_sha,
    ledger_hash: bound.inspected.hash,
    evidence_hash: canonicalHash(bound.evidence),
    reviewer_id: 'sol-frontier-closure',
    verdict: 'PASS',
    findings: [],
  };
  run.outer_sol.consumed = 1;
  run.outer_sol.closure.consumed = 1;
  run.next_action = 'Recheck only after the frontier changes or refresh is due.';
  return renderRunBody(run);
}

function authorizeFrontierStop(run, ledger, evidence) {
  const bound = bindFrontierEvidence(evidence, ledger);
  run.frontier_closure = {
    state: 'PASS',
    base_sha: evidence.audited_sha,
    ledger_hash: bound.inspected.hash,
    evidence_hash: canonicalHash(evidence),
    reviewer_id: 'sol-frontier-closure',
    verdict: 'PASS',
    findings: [],
  };
  run.outer_sol.consumed = 1;
  run.outer_sol.closure.consumed = 1;
  return evidence;
}

function discoveryEvidence(environment, overrides = {}) {
  const file = path.join(environment.directory, 'discovery-evidence.json');
  fs.writeFileSync(file, JSON.stringify(makeDiscoveryEvidence(overrides)));
  return file;
}

function terminalRunBody(evidence = makeDiscoveryEvidence()) {
  const run = createRunState({ runId: 'terminal-discovery-run' });
  run.state = NO_OPPORTUNITY_STOP;
  run.discovery_exhaustion = evidence;
  run.next_action = 'Recheck only after the frontier changes or refresh is due.';
  return renderRunBody(run);
}

test('CLI run:start resumes the one open nonterminal Outer Run without creating another Issue', () => {
  const run = createRunState({ runId: 'existing-run' });
  const environment = createMockEnvironment({
    runBody: renderRunBody(run),
    branch: 'master',
    runIssueTitle: '[Harness V3 Run] Existing run',
  });
  try {
    const result = environment.execute(['run:start', '--title', 'New invocation']);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).state, 'RUN_RESUMED');
    assert.equal(
      environment
        .readState()
        .calls.some(
          (call) => call.tool === 'gh' && call.args[0] === 'issue' && call.args[1] === 'create',
        ),
      false,
    );
  } finally {
    environment.cleanup();
  }
});

test('CLI run:start closes stale terminal Runs and normalizes the new Issue title', () => {
  const run = createRunState({ runId: 'terminal-run' });
  run.state = NO_OPPORTUNITY_STOP;
  const environment = createMockEnvironment({
    runBody: renderRunBody(run),
    branch: 'master',
    runIssueTitle: '[Harness V3 Run] Old run',
  });
  try {
    const result = environment.execute([
      'run:start',
      '--title',
      '[Harness V3 Run] Autonomous evolution',
    ]);
    assert.equal(result.status, 0, result.stderr);
    const state = environment.readState();
    assert.equal(JSON.parse(result.stdout).state, 'RUN_STARTED');
    assert.equal(state.runIssueTitle, '[Harness V3 Run] Autonomous evolution');
    assert.ok(
      state.calls.some(
        (call) => call.tool === 'gh' && call.args[0] === 'issue' && call.args[1] === 'close',
      ),
    );
  } finally {
    environment.cleanup();
  }
});

test('CLI discovery:check reports the active control plane without creating a Run', () => {
  const environment = createMockEnvironment({ branch: 'master', openPrs: [] });
  try {
    const result = environment.execute(['discovery:check', '--now', '2026-08-12T00:00:00.000Z']);
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.state, 'RESUME_ACTIVE_RUN');
    assert.equal(output.control_plane, 'ACTIVE');
    assert.equal(
      environment
        .readState()
        .calls.some(
          (call) => call.tool === 'gh' && call.args[0] === 'issue' && call.args[1] === 'create',
        ),
      false,
    );
  } finally {
    environment.cleanup();
  }
});

test('CLI discovery:check resumes an open Epoch PR even when no Run Issue is open', () => {
  const { epoch } = controlFixture();
  const environment = createMockEnvironment({
    branch: 'master',
    runIssueState: 'CLOSED',
    openPrs: [{ number: 42, body: renderEpochBody(epoch) }],
  });
  try {
    const result = environment.execute(['discovery:check', '--now', '2026-08-12T00:00:00.000Z']);
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.state, 'RESUME_ACTIVE_RUN');
    assert.deepEqual(output.open_epoch_prs, [42]);
  } finally {
    environment.cleanup();
  }
});

test('CLI discovery:check returns unchanged idle exhaustion on the same SHA within seven days', () => {
  const frontierLedger = makeClosedFrontierLedger();
  const environment = createMockEnvironment({
    branch: 'master',
    runBody: trustedTerminalRunBody(frontierLedger),
    frontierLedger,
    runIssueState: 'CLOSED',
    runIssueClosedAt: '2026-08-10T00:05:00.000Z',
    openPrs: [],
  });
  try {
    const result = environment.execute(['discovery:check', '--now', '2026-08-12T00:00:00.000Z']);
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.state, 'UNCHANGED_EXHAUSTION');
    assert.equal(output.control_plane, 'IDLE');
    assert.equal(output.issue_created, false);
    const goal = environment.execute([
      'goal:check',
      '--discovery-state',
      'UNCHANGED_EXHAUSTION',
      '--now',
      '2026-08-12T00:00:00.000Z',
    ]);
    assert.equal(goal.status, 0, goal.stderr);
    assert.equal(JSON.parse(goal.stdout).state, 'GOAL_STOP_ALLOWED');
    assert.equal(
      environment
        .readState()
        .calls.some(
          (call) => call.tool === 'gh' && call.args[0] === 'issue' && call.args[1] === 'create',
        ),
      false,
    );
  } finally {
    environment.cleanup();
  }
});

test('CLI discovery:check requires discovery after master changes', () => {
  const frontierLedger = makeClosedFrontierLedger();
  const environment = createMockEnvironment({
    branch: 'master',
    baseSha: sha('d'),
    runBody: trustedTerminalRunBody(frontierLedger),
    frontierLedger,
    runIssueState: 'CLOSED',
    openPrs: [],
  });
  try {
    const result = environment.execute(['discovery:check', '--now', '2026-08-12T00:00:00.000Z']);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).state, 'DISCOVERY_REQUIRED_MASTER_CHANGED');
  } finally {
    environment.cleanup();
  }
});

test('CLI discovery:check refreshes a current-policy audit after seven days', () => {
  const frontierLedger = makeClosedFrontierLedger();
  const environment = createMockEnvironment({
    branch: 'master',
    runBody: trustedTerminalRunBody(frontierLedger),
    frontierLedger,
    runIssueState: 'CLOSED',
    openPrs: [],
  });
  try {
    const result = environment.execute(['discovery:check', '--now', '2026-08-17T00:00:00.000Z']);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).state, 'DISCOVERY_REFRESH_DUE');
  } finally {
    environment.cleanup();
  }
});

test('CLI discovery:check sends legacy policy evidence and actionable frontiers to research', () => {
  const legacy = createMockEnvironment({
    branch: 'master',
    runBody: terminalRunBody({ ...makeDiscoveryEvidence(), policy_version: 'harness-v3.0' }),
    runIssueState: 'CLOSED',
    openPrs: [],
  });
  try {
    const result = legacy.execute(['discovery:check', '--now', '2026-08-12T00:00:00.000Z']);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).state, 'FRONTIER_RESEARCH_REQUIRED');
  } finally {
    legacy.cleanup();
  }

  const actionableEvidence = makeDiscoveryEvidence();
  actionableEvidence.candidate_assessments[0].scope_salvage.outcome = 'RESEARCH_READY';
  actionableEvidence.candidate_assessments[0].source_contract_research = {
    status: 'RESEARCH_REQUIRED',
    next_step: 'Validate a capability-specific allowlisted public source contract.',
    closure_evidence: [],
  };
  const actionable = createMockEnvironment({
    branch: 'master',
    runBody: terminalRunBody(actionableEvidence),
    runIssueState: 'CLOSED',
    openPrs: [],
  });
  try {
    const result = actionable.execute(['discovery:check', '--now', '2026-08-12T00:00:00.000Z']);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).state, 'FRONTIER_RESEARCH_REQUIRED');
  } finally {
    actionable.cleanup();
  }

  const incompleteEvidence = makeDiscoveryEvidence();
  delete incompleteEvidence.candidate_assessments[0].scope_salvage;
  const incompleteLedger = makeClosedFrontierLedger();
  bindFrontierEvidence(incompleteEvidence, incompleteLedger);
  const incomplete = createMockEnvironment({
    branch: 'master',
    runBody: terminalRunBody(incompleteEvidence),
    runIssueState: 'CLOSED',
    openPrs: [],
    frontierLedger: incompleteLedger,
  });
  try {
    const result = incomplete.execute(['discovery:check', '--now', '2026-08-12T00:00:00.000Z']);
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.state, 'FRONTIER_RESEARCH_REQUIRED');
    assert.equal(output.reason, 'CURRENT_POLICY_AUDIT_INVALID');
  } finally {
    incomplete.cleanup();
  }
});

test('CLI discovery:check treats no prior control plane as an idle research frontier', () => {
  const environment = createMockEnvironment({
    branch: 'master',
    runIssueState: 'CLOSED',
    closedIssues: [],
    openPrs: [],
  });
  try {
    const result = environment.execute(['discovery:check', '--now', '2026-08-12T00:00:00.000Z']);
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.equal(output.state, 'FRONTIER_RESEARCH_REQUIRED');
    assert.equal(output.control_plane, 'IDLE');
  } finally {
    environment.cleanup();
  }
});

test('CLI trusted exhaustion requires deep current-base evidence and closes the Run', () => {
  const run = createRunState({ runId: 'discovery-run' });
  const frontierLedger = makeClosedFrontierLedger();
  const evidence = authorizeFrontierStop(run, frontierLedger, makeDiscoveryEvidence());
  const environment = createMockEnvironment({
    runBody: renderRunBody(run),
    branch: 'master',
    frontierLedger,
  });
  try {
    const missing = environment.execute([
      'run:stop',
      '--run',
      '1',
      '--state',
      NO_OPPORTUNITY_STOP,
      '--next-action',
      'No safe work remains',
    ]);
    assert.equal(missing.status, 2);
    assert.match(missing.stderr, /^ARGUMENT_REQUIRED:/u);
    assert.notEqual(environment.readState().runIssueState, 'CLOSED');

    const stopped = environment.execute([
      'run:stop',
      '--run',
      '1',
      '--state',
      NO_OPPORTUNITY_STOP,
      '--next-action',
      'Evidence-backed safe backlog exhaustion',
      '--evidence',
      discoveryEvidence(environment, evidence),
    ]);
    assert.equal(stopped.status, 0, stopped.stderr);
    const state = environment.readState();
    assert.equal(state.runIssueState, 'CLOSED');
    assert.equal(
      parseControlBlock(state.runBody, RUN_MARKER).discovery_exhaustion.audited_sha,
      sha('a'),
    );
  } finally {
    environment.cleanup();
  }
});

test('CLI performs one exact-hash frontier review before trusted exhaustion', () => {
  const run = createRunState({ runId: 'frontier-review-run' });
  const frontierLedger = makeClosedFrontierLedger();
  const evidence = bindFrontierEvidence(makeDiscoveryEvidence(), frontierLedger).evidence;
  const environment = createMockEnvironment({
    runBody: renderRunBody(run),
    branch: 'master',
    frontierLedger,
  });
  try {
    const evidencePath = discoveryEvidence(environment, evidence);
    const reserved = environment.execute([
      'frontier:review-reserve',
      '--run',
      '1',
      '--evidence',
      evidencePath,
    ]);
    assert.equal(reserved.status, 0, reserved.stderr);
    assert.equal(JSON.parse(reserved.stdout).state, 'FRONTIER_REVIEW_REQUIRED');

    const started = environment.execute([
      'frontier:review-started',
      '--run',
      '1',
      '--reviewer-id',
      'sol-frontier-closure',
    ]);
    assert.equal(started.status, 0, started.stderr);

    const storedBeforeVerdict = parseControlBlock(environment.readState().runBody, RUN_MARKER);
    assert.equal(storedBeforeVerdict.frontier_closure.evidence.encoding, 'gzip+base64');
    const reconstructed = environment.execute(['frontier:review-context', '--run', '1']);
    assert.equal(reconstructed.status, 0, reconstructed.stderr);
    assert.deepEqual(JSON.parse(reconstructed.stdout), evidence);

    const passed = environment.execute([
      'frontier:review-result',
      '--run',
      '1',
      '--verdict',
      'PASS',
    ]);
    assert.equal(passed.status, 0, passed.stderr);

    const stopped = environment.execute([
      'run:stop',
      '--run',
      '1',
      '--state',
      NO_OPPORTUNITY_STOP,
      '--next-action',
      'Reuse only while all exact closure inputs remain unchanged.',
      '--evidence',
      evidencePath,
    ]);
    assert.equal(stopped.status, 0, stopped.stderr);
    const finalRun = parseControlBlock(environment.readState().runBody, RUN_MARKER);
    assert.equal(finalRun.state, NO_OPPORTUNITY_STOP);
    assert.equal(finalRun.frontier_closure.verdict, 'PASS');
    assert.equal(finalRun.outer_sol.closure.consumed, 1);
    assert.equal(finalRun.outer_sol.product.consumed, 0);
  } finally {
    environment.cleanup();
  }
});

test('CLI frontier runtime resumes the same id and replacement preserves closure evidence', () => {
  const run = createRunState({ runId: 'frontier-runtime-run' });
  const frontierLedger = makeClosedFrontierLedger();
  const evidence = bindFrontierEvidence(makeDiscoveryEvidence(), frontierLedger).evidence;
  const environment = createMockEnvironment({
    runBody: renderRunBody(run),
    branch: 'master',
    frontierLedger,
  });
  try {
    const evidencePath = discoveryEvidence(environment, evidence);
    assert.equal(
      environment.execute(['frontier:review-reserve', '--run', '1', '--evidence', evidencePath])
        .status,
      0,
    );
    assert.equal(
      environment.execute([
        'frontier:review-started',
        '--run',
        '1',
        '--reviewer-id',
        'sol-frontier-lost',
      ]).status,
      0,
    );

    const unobserved = environment.execute([
      'frontier:review-wait',
      '--run',
      '1',
      '--reviewer-id',
      'sol-frontier-lost',
    ]);
    assert.equal(unobserved.status, 2);
    assert.match(unobserved.stderr, /^REVIEW_RUNTIME_OBSERVATION_REQUIRED:/u);

    const interrupted = environment.execute([
      'frontier:review-runtime',
      '--run',
      '1',
      '--reviewer-id',
      'sol-frontier-lost',
      '--runtime-state',
      'INTERRUPTED',
      '--reason',
      'CAPACITY_PAUSE',
    ]);
    assert.equal(interrupted.status, 0, interrupted.stderr);
    const resumed = environment.execute([
      'frontier:review-runtime',
      '--run',
      '1',
      '--reviewer-id',
      'sol-frontier-lost',
      '--runtime-state',
      'ACTIVE',
    ]);
    assert.equal(resumed.status, 0, resumed.stderr);

    const unavailable = environment.execute([
      'frontier:review-runtime',
      '--run',
      '1',
      '--reviewer-id',
      'sol-frontier-lost',
      '--runtime-state',
      'UNAVAILABLE',
      '--reason',
      'TASK_NOT_FOUND',
    ]);
    assert.equal(unavailable.status, 0, unavailable.stderr);
    const reserved = environment.execute([
      'frontier:review-reserve',
      '--run',
      '1',
      '--runtime-recovery',
    ]);
    assert.equal(reserved.status, 0, reserved.stderr);
    const started = environment.execute([
      'frontier:review-started',
      '--run',
      '1',
      '--reviewer-id',
      'sol-frontier-replacement',
      '--runtime-recovery',
    ]);
    assert.equal(started.status, 0, started.stderr);

    const stored = parseControlBlock(environment.readState().runBody, RUN_MARKER);
    assert.equal(stored.outer_sol.closure.consumed, 1);
    assert.equal(stored.outer_sol.runtime_recovery.consumed, 1);
    assert.equal(stored.frontier_closure.reviewer_id, 'sol-frontier-replacement');
    assert.equal(stored.frontier_closure.runtime.replaces_reviewer_id, 'sol-frontier-lost');
    assert.equal(stored.frontier_closure.evidence.encoding, 'gzip+base64');
    const reconstructed = environment.execute(['frontier:review-context', '--run', '1']);
    assert.equal(reconstructed.status, 0, reconstructed.stderr);
    assert.deepEqual(JSON.parse(reconstructed.stdout), evidence);
  } finally {
    environment.cleanup();
  }
});

test('CLI refuses silently truncated frontier closure control state', () => {
  const run = createRunState({ runId: 'frontier-large-body-run' });
  const frontierLedger = makeClosedFrontierLedger();
  const evidence = bindFrontierEvidence(
    makeDiscoveryEvidence({
      serialization_probe: Array.from({ length: 5_000 }, (_, index) =>
        canonicalHash({ index, salt: `control-body-${index}` }),
      ),
    }),
    frontierLedger,
  ).evidence;
  const environment = createMockEnvironment({
    runBody: renderRunBody(run),
    branch: 'master',
    frontierLedger,
  });
  try {
    const result = environment.execute([
      'frontier:review-reserve',
      '--run',
      '1',
      '--evidence',
      discoveryEvidence(environment, evidence),
    ]);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /^CONTROL_BODY_TOO_LARGE:/u);
    const stored = parseControlBlock(environment.readState().runBody, RUN_MARKER);
    assert.equal(stored.frontier_closure.state, 'NOT_READY');
  } finally {
    environment.cleanup();
  }
});

test('CLI trusted exhaustion rejects generic discovery templates and duplicate candidates', () => {
  const run = createRunState({ runId: 'generic-discovery-run' });
  const frontierLedger = makeClosedFrontierLedger();
  const environment = createMockEnvironment({
    branch: 'master',
    runBody: renderRunBody(run),
    frontierLedger,
  });
  try {
    const generic = makeDiscoveryEvidence({ discovery_delta: 'No changes.' });
    for (const lane of DISCOVERY_LANES) {
      generic.lane_assessments[lane] = {
        observation: `Inspected current ${lane} evidence and representative seams.`,
        conclusion: 'No independent safe high-value Epoch remains in this lane.',
      };
    }
    bindFrontierEvidence(generic, frontierLedger);
    const genericResult = environment.execute([
      'run:stop',
      '--run',
      '1',
      '--state',
      NO_OPPORTUNITY_STOP,
      '--next-action',
      'Generic stop must fail',
      '--evidence',
      discoveryEvidence(environment, generic),
    ]);
    assert.equal(genericResult.status, 2);
    assert.match(genericResult.stderr, /^DISCOVERY_EVIDENCE_GENERIC:/u);

    const duplicate = makeDiscoveryEvidence();
    duplicate.candidate_assessments[1].id = duplicate.candidate_assessments[0].id;
    bindFrontierEvidence(duplicate, frontierLedger);
    const duplicateResult = environment.execute([
      'run:stop',
      '--run',
      '1',
      '--state',
      NO_OPPORTUNITY_STOP,
      '--next-action',
      'Duplicate stop must fail',
      '--evidence',
      discoveryEvidence(environment, duplicate),
    ]);
    assert.equal(duplicateResult.status, 2);
    assert.match(duplicateResult.stderr, /^DISCOVERY_EVIDENCE_REQUIRED:/u);
  } finally {
    environment.cleanup();
  }
});

test('CLI trusted exhaustion rejects implementation-ready and research-ready scope salvage', () => {
  for (const outcome of ['IMPLEMENTATION_READY', 'RESEARCH_READY']) {
    const run = createRunState({ runId: `actionable-${outcome}` });
    const frontierLedger = makeClosedFrontierLedger();
    const environment = createMockEnvironment({
      branch: 'master',
      runBody: renderRunBody(run),
      frontierLedger,
    });
    try {
      const evidence = makeDiscoveryEvidence();
      evidence.candidate_assessments[0].scope_salvage.outcome = outcome;
      if (outcome === 'RESEARCH_READY') {
        evidence.candidate_assessments[0].source_contract_research = {
          status: 'RESEARCH_REQUIRED',
          next_step: 'Validate an allowlisted read-only source contract.',
          closure_evidence: [],
        };
      }
      bindFrontierEvidence(evidence, frontierLedger);
      const result = environment.execute([
        'run:stop',
        '--run',
        '1',
        '--state',
        NO_OPPORTUNITY_STOP,
        '--next-action',
        'Actionable frontier must not stop',
        '--evidence',
        discoveryEvidence(environment, evidence),
      ]);
      assert.equal(result.status, 2);
      assert.match(result.stderr, /^DISCOVERY_HAS_ACTIONABLE_CANDIDATE:/u);
    } finally {
      environment.cleanup();
    }
  }
});

test('CLI trusted exhaustion requires closed research for insufficient source data', () => {
  const run = createRunState({ runId: 'source-research-run' });
  const frontierLedger = makeClosedFrontierLedger();
  const environment = createMockEnvironment({
    branch: 'master',
    runBody: renderRunBody(run),
    frontierLedger,
  });
  try {
    const evidence = makeDiscoveryEvidence();
    evidence.candidate_assessments[0].disposition = 'INSUFFICIENT_TRUSTWORTHY_DATA';
    evidence.candidate_assessments[0].source_contract_research = {
      status: 'NOT_REQUIRED',
      next_step: 'No concrete source-contract research step was performed for this candidate.',
      closure_evidence: ['No concrete source-contract closure evidence exists.'],
    };
    bindFrontierEvidence(evidence, frontierLedger);
    const result = environment.execute([
      'run:stop',
      '--run',
      '1',
      '--state',
      NO_OPPORTUNITY_STOP,
      '--next-action',
      'Unresearched source gap must not stop',
      '--evidence',
      discoveryEvidence(environment, evidence),
    ]);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /^DISCOVERY_SOURCE_RESEARCH_REQUIRED:/u);
  } finally {
    environment.cleanup();
  }
});

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

test('CLI product guard uses the actual PR head when GitHub checks out a merge ref', () => {
  const environment = createMockEnvironment();
  const prHeadSha = sha('d');
  try {
    const result = environment.execute(
      ['guard:legacy-paths', '--base', 'origin/master', '--product-epoch'],
      { HARNESS_HEAD_REF: prHeadSha },
    );
    assert.equal(result.status, 0, result.stderr);
    const calls = environment.readState().calls.filter((call) => call.tool === 'git');
    assert.ok(
      calls.some(
        (call) => call.args[0] === 'diff' && call.args.at(-1) === `origin/master...${prHeadSha}`,
      ),
    );
    assert.ok(
      calls.some(
        (call) => call.args[0] === 'log' && call.args.at(-1) === `origin/master..${prHeadSha}`,
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

test('CLI Product runtime observation is explicit and same-id resume spends no budget', () => {
  const { run, epoch } = controlFixture();
  epoch.state = 'REVIEW_RUNNING';
  epoch.candidate_sha = sha('b');
  epoch.reviewed_base_sha = sha('a');
  epoch.ci = { sha: sha('b'), status: 'SUCCESS', url: 'https://example.test/ci' };
  epoch.scope_closure = {
    why_not_review_earlier: 'All related Work Packages are complete.',
    why_not_extend_further: 'Further work is an independent objective.',
    related_work_remaining: false,
  };
  epoch.adversarial_preflight = { completed: true, summary: 'Preflight complete.' };
  epoch.review.consumed = 1;
  epoch.review.reviewer_id = 'sol-product';
  epoch.review.runtime = { state: 'ACTIVE', reason: null, allocation: 'NORMAL' };
  run.outer_sol.consumed = 1;
  run.outer_sol.product.consumed = 1;
  const environment = createMockEnvironment({
    runBody: renderRunBody(run),
    prBody: renderEpochBody(epoch),
    draft: false,
  });
  try {
    const unobserved = environment.execute([
      'review:wait',
      '--run',
      '1',
      '--pr',
      '42',
      '--reviewer-id',
      'sol-product',
    ]);
    assert.equal(unobserved.status, 2);
    assert.match(unobserved.stderr, /^REVIEW_RUNTIME_OBSERVATION_REQUIRED:/u);

    const interrupted = environment.execute([
      'review:runtime',
      '--run',
      '1',
      '--pr',
      '42',
      '--reviewer-id',
      'sol-product',
      '--runtime-state',
      'INTERRUPTED',
      '--reason',
      'CAPACITY_PAUSE',
    ]);
    assert.equal(interrupted.status, 0, interrupted.stderr);
    let stored = parseControlBlock(environment.readState().prBody, EPOCH_MARKER);
    assert.equal(stored.state, 'REVIEW_INTERRUPTED_RESUMABLE');

    const resumed = environment.execute([
      'review:runtime',
      '--run',
      '1',
      '--pr',
      '42',
      '--reviewer-id',
      'sol-product',
      '--runtime-state',
      'ACTIVE',
    ]);
    assert.equal(resumed.status, 0, resumed.stderr);
    stored = parseControlBlock(environment.readState().prBody, EPOCH_MARKER);
    const storedRun = parseControlBlock(environment.readState().runBody, RUN_MARKER);
    assert.equal(stored.state, 'REVIEW_RUNNING');
    assert.equal(stored.review.consumed, 1);
    assert.equal(storedRun.outer_sol.product.consumed, 1);
    assert.equal(stored.candidate_sha, sha('b'));
    assert.equal(stored.ci.sha, sha('b'));
  } finally {
    environment.cleanup();
  }
});

test('CLI Product runtime replacement uses the paired shared recovery ledger', () => {
  const { run, epoch } = controlFixture();
  epoch.state = 'REVIEW_RUNNING';
  epoch.candidate_sha = sha('b');
  epoch.reviewed_base_sha = sha('a');
  epoch.ci = { sha: sha('b'), status: 'SUCCESS', url: 'https://example.test/ci' };
  epoch.scope_closure = {
    why_not_review_earlier: 'All related Work Packages are complete.',
    why_not_extend_further: 'Further work is an independent objective.',
    related_work_remaining: false,
  };
  epoch.adversarial_preflight = { completed: true, summary: 'Preflight complete.' };
  epoch.review.consumed = 1;
  epoch.review.reviewer_id = 'sol-lost';
  epoch.review.runtime = { state: 'ACTIVE', reason: null, allocation: 'NORMAL' };
  run.outer_sol.consumed = 1;
  run.outer_sol.product.consumed = 1;
  const environment = createMockEnvironment({
    runBody: renderRunBody(run),
    prBody: renderEpochBody(epoch),
    draft: false,
  });
  try {
    const unavailable = environment.execute([
      'review:runtime',
      '--run',
      '1',
      '--pr',
      '42',
      '--reviewer-id',
      'sol-lost',
      '--runtime-state',
      'UNAVAILABLE',
      '--reason',
      'TASK_NOT_FOUND',
    ]);
    assert.equal(unavailable.status, 0, unavailable.stderr);
    const reserved = environment.execute([
      'review:reserve',
      '--run',
      '1',
      '--pr',
      '42',
      '--runtime-recovery',
    ]);
    assert.equal(reserved.status, 0, reserved.stderr);
    const started = environment.execute([
      'review:started',
      '--run',
      '1',
      '--pr',
      '42',
      '--reviewer-id',
      'sol-replacement',
      '--runtime-recovery',
    ]);
    assert.equal(started.status, 0, started.stderr);
    const stored = parseControlBlock(environment.readState().prBody, EPOCH_MARKER);
    const storedRun = parseControlBlock(environment.readState().runBody, RUN_MARKER);
    assert.equal(stored.review.runtime_recovery.consumed, 1);
    assert.equal(storedRun.outer_sol.runtime_recovery.consumed, 1);
    assert.equal(stored.review.consumed, 1);
    assert.equal(storedRun.outer_sol.product.consumed, 1);
    assert.equal(stored.review.runtime.replaces_reviewer_id, 'sol-lost');
  } finally {
    environment.cleanup();
  }
});

test('CLI Goal gate rejects an active Epoch and permits a true terminal Run', () => {
  const { run, epoch } = controlFixture();
  const environment = createMockEnvironment({
    runBody: renderRunBody(run),
    prBody: renderEpochBody(epoch),
  });
  try {
    const active = environment.execute(['goal:check', '--run', '1', '--pr', '42']);
    assert.equal(active.status, 2);
    assert.match(active.stderr, /^GOAL_CONTINUATION_REQUIRED:/u);

    run.state = 'STOPPED_RUN_BUDGET_EXHAUSTED_RESUMABLE';
    run.active_epoch_pr = null;
    environment.readState();
    const state = environment.readState();
    state.runBody = renderRunBody(run);
    fs.writeFileSync(environment.statePath, `${JSON.stringify(state, null, 2)}\n`);
    const stopped = environment.execute(['goal:check', '--run', '1']);
    assert.equal(stopped.status, 0, stopped.stderr);
    assert.equal(JSON.parse(stopped.stdout).state, 'GOAL_STOP_ALLOWED');

    const stoppedState = environment.readState();
    stoppedState.branch = 'master';
    fs.writeFileSync(environment.statePath, `${JSON.stringify(stoppedState, null, 2)}\n`);
    const unchanged = environment.execute([
      'goal:check',
      '--discovery-state',
      'UNCHANGED_EXHAUSTION',
    ]);
    assert.equal(unchanged.status, 2);
    assert.match(unchanged.stderr, /^GOAL_CONTINUATION_REQUIRED:/u);
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
  epoch.review_history = [
    {
      review_number: 1,
      reviewer_id: 'sol-1',
      candidate_sha: sha('b'),
      reviewed_base_sha: sha('a'),
      verdict: 'PASS',
      findings: [],
    },
  ];
  run.outer_sol.consumed = 1;
  run.outer_sol.product.consumed = 1;
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

test('CLI base drift with exhausted review budget returns to Luna final validation', () => {
  const environment = mergeReadyEnvironment({ baseSha: sha('d') });
  const state = environment.readState();
  const epoch = parseControlBlock(state.prBody, EPOCH_MARKER);
  const run = parseControlBlock(state.runBody, RUN_MARKER);
  epoch.review.max = 1;
  run.outer_sol.product.max = 1;
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
    assert.match(result.stderr, /^FINAL_CORRECTIVE_BASE_SYNC_REQUIRED:/u);
    const corrective = environment.readState();
    const correctiveEpoch = parseControlBlock(corrective.prBody, EPOCH_MARKER);
    const activeRun = parseControlBlock(corrective.runBody, RUN_MARKER);
    assert.equal(correctiveEpoch.state, 'FINAL_CORRECTIVE_REQUIRED');
    assert.equal(correctiveEpoch.final_corrective_reason, 'BASE_DRIFT_AFTER_PASS');
    assert.equal(correctiveEpoch.findings[0].id, 'base-drift-after-pass');
    assert.equal(activeRun.state, 'EPOCH_ACTIVE');
    assert.equal(activeRun.active_epoch_pr, 42);
    assert.deepEqual(activeRun.parked_epoch_prs, []);
    assert.equal(
      corrective.calls.some(
        (call) => call.tool === 'gh' && call.args[0] === 'pr' && call.args[1] === 'merge',
      ),
      false,
    );

    fs.writeFileSync(
      environment.statePath,
      `${JSON.stringify({ ...corrective, featureHeadSha: sha('e') }, null, 2)}\n`,
    );
    const ready = environment.execute([
      'candidate:check',
      '--pr',
      '42',
      '--evidence',
      candidateEvidence(environment, {
        base_sha: sha('d'),
        candidate_sha: sha('e'),
        corrective_closure: correctiveClosure('base-drift-after-pass'),
      }),
    ]);
    assert.equal(ready.status, 0, ready.stderr);
    assert.equal(
      parseControlBlock(environment.readState().prBody, EPOCH_MARKER).state,
      'FINAL_CORRECTIVE_READY',
    );

    const merged = environment.execute(['epoch:merge', '--run', '1', '--pr', '42']);
    assert.equal(merged.status, 0, merged.stderr);
    assert.equal(parseControlBlock(environment.readState().prBody, EPOCH_MARKER).state, 'MERGED');
  } finally {
    environment.cleanup();
  }
});

test('CLI final corrective gate requires closure evidence then auto-merges without Sol #3', () => {
  const { run, epoch } = controlFixture();
  epoch.state = 'FINAL_CORRECTIVE_REQUIRED';
  epoch.review.consumed = 2;
  epoch.final_corrective_reason = 'REVIEW_LIMIT_FINDINGS';
  epoch.findings = [
    { id: 'sol-2-finding-1', priority: 'P1', summary: 'Preserve metadata truthfulness' },
  ];
  epoch.review_history = [
    {
      review_number: 2,
      reviewer_id: 'sol-1',
      candidate_sha: sha('d'),
      reviewed_base_sha: sha('a'),
      verdict: 'CORRECTIVE_REQUIRED',
      findings: epoch.findings,
    },
  ];
  epoch.candidate_sha = null;
  epoch.ci = { sha: null, status: 'NOT_RUN', url: null };
  const environment = createMockEnvironment({
    runBody: renderRunBody(run),
    prBody: renderEpochBody(epoch),
    draft: false,
  });
  try {
    const missingClosure = environment.execute([
      'candidate:check',
      '--pr',
      '42',
      '--evidence',
      candidateEvidence(environment),
    ]);
    assert.equal(missingClosure.status, 2);
    assert.match(missingClosure.stderr, /^CORRECTIVE_CLOSURE_INCOMPLETE:/u);

    const ready = environment.execute([
      'candidate:check',
      '--pr',
      '42',
      '--evidence',
      candidateEvidence(environment, { corrective_closure: correctiveClosure() }),
    ]);
    assert.equal(ready.status, 0, ready.stderr);
    let state = environment.readState();
    let finalEpoch = parseControlBlock(state.prBody, EPOCH_MARKER);
    assert.equal(finalEpoch.state, 'FINAL_CORRECTIVE_READY');
    assert.equal(finalEpoch.final_corrective_sha, sha('b'));
    assert.equal(finalEpoch.next_action, 'AUTO_MERGE_AFTER_FINAL_CORRECTIVE');

    const merged = environment.execute(['epoch:merge', '--run', '1', '--pr', '42']);
    assert.equal(merged.status, 0, merged.stderr);
    state = environment.readState();
    finalEpoch = parseControlBlock(state.prBody, EPOCH_MARKER);
    assert.equal(finalEpoch.state, 'MERGED');
    assert.equal(parseControlBlock(state.runBody, RUN_MARKER).next_action, 'DISCOVER_NEXT_EPOCH');
    assert.equal(
      state.calls.some(
        (call) => call.tool === 'gh' && call.args[0] === 'pr' && call.args[1] === 'merge',
      ),
      true,
    );
  } finally {
    environment.cleanup();
  }
});

test('CLI final corrective base drift returns to Luna sync instead of parking for a human', () => {
  const { run, epoch } = controlFixture();
  epoch.state = 'FINAL_CORRECTIVE_READY';
  epoch.review.consumed = 2;
  epoch.final_corrective_reason = 'REVIEW_LIMIT_FINDINGS';
  epoch.findings = [
    { id: 'sol-2-finding-1', priority: 'P1', summary: 'Preserve metadata truthfulness' },
  ];
  epoch.review_history = [
    {
      review_number: 2,
      reviewer_id: 'sol-1',
      candidate_sha: sha('d'),
      reviewed_base_sha: sha('a'),
      verdict: 'CORRECTIVE_REQUIRED',
      findings: epoch.findings,
    },
  ];
  epoch.corrective_closure = correctiveClosure();
  epoch.candidate_sha = sha('b');
  epoch.final_corrective_sha = sha('b');
  epoch.final_corrective_base_sha = sha('a');
  epoch.ci = { sha: sha('b'), status: 'SUCCESS', url: 'https://example.test/ci-final' };
  const environment = createMockEnvironment({
    runBody: renderRunBody(run),
    prBody: renderEpochBody(epoch),
    baseSha: sha('d'),
    draft: false,
  });
  try {
    const result = environment.execute(['epoch:merge', '--run', '1', '--pr', '42']);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /^FINAL_CORRECTIVE_BASE_DRIFT:/u);
    const state = environment.readState();
    const driftedEpoch = parseControlBlock(state.prBody, EPOCH_MARKER);
    const activeRun = parseControlBlock(state.runBody, RUN_MARKER);
    assert.equal(driftedEpoch.state, 'FINAL_CORRECTIVE_REQUIRED');
    assert.equal(driftedEpoch.candidate_sha, null);
    assert.equal(activeRun.state, 'EPOCH_ACTIVE');
    assert.equal(activeRun.active_epoch_pr, 42);
    assert.equal(state.prState, 'OPEN');
  } finally {
    environment.cleanup();
  }
});

test('CLI resumes a legacy review-limit PR into Luna final corrective on the same branch', () => {
  const { run, epoch } = controlFixture();
  run.state = 'QUALITY_CIRCUIT_BREAKER';
  run.active_epoch_pr = null;
  run.parked_epoch_prs = [42];
  epoch.state = 'PARKED_REVIEW_LIMIT';
  epoch.review.consumed = 2;
  epoch.findings = [{ priority: 'P1', summary: 'Legacy unresolved finding' }];
  const environment = createMockEnvironment({
    runBody: renderRunBody(run),
    prBody: renderEpochBody(epoch),
  });
  try {
    const result = environment.execute([
      'epoch:resume-final-corrective',
      '--run',
      '1',
      '--pr',
      '42',
    ]);
    assert.equal(result.status, 0, result.stderr);
    const state = environment.readState();
    assert.equal(parseControlBlock(state.prBody, EPOCH_MARKER).state, 'FINAL_CORRECTIVE_REQUIRED');
    assert.equal(parseControlBlock(state.runBody, RUN_MARKER).active_epoch_pr, 42);
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
