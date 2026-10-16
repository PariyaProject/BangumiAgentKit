import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync } from 'node:crypto';
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
  isReconciledPostPassCandidateRefresh,
  parseControlBlock,
  renderEpochBody,
  renderRunBody,
} from '../../scripts/lib/agent-harness-core.mjs';
import { canonicalHash, inspectFrontierLedger } from '../../scripts/lib/frontier-ledger.mjs';
import {
  G06_ARGUMENT_PROFILE,
  G06_EPOCH_ID,
  G06_EXPECTED_QUERY_ARGUMENTS,
  G06_TOOL_NAME,
  canonicalG06ArgumentsSha256,
} from '../../scripts/acceptance/g06-subject-cast-answer-check.mjs';
import {
  buildG06AgentMcpReport,
  writeG06AgentMcpReport,
} from '../../scripts/acceptance/write-g06-agent-mcp-report.mjs';
import { G06_PRIVACY } from '../../scripts/lib/g06-privacy-summary.mjs';
import {
  g06OneShotLatchLabelDescription,
  g06OneShotLatchLabelName,
  g06OneShotTerminalLabelDescription,
  g06OneShotTerminalLabelName,
} from '../../scripts/lib/g06-one-shot-claim.mjs';
import {
  createG06RunnerReceipt,
  createG06RunnerReceiptKeyPair,
} from '../../scripts/acceptance/g06-runner-receipt.mjs';
import { G04_EXPECTED_QUERY_ARGUMENTS } from '../../scripts/acceptance/g04-person-activity-answer-check.mjs';
import {
  D07_EXPECTED_YEARS,
  D07_QUERY_ARGUMENTS_BY_YEAR,
} from '../../scripts/acceptance/d07-current-rank-answer-check.mjs';
import {
  d07OneShotLatchLabelDescription,
  d07OneShotLatchLabelName,
  d07OneShotTerminalLabelName,
} from '../../scripts/lib/d07-one-shot-claim.mjs';
import { d07RunnerProcessTitle } from '../../scripts/lib/d07-runner-liveness.mjs';
import {
  generateG04RunnerReceiptKeyPair,
  g04RunnerPublicKeySha256,
} from '../../scripts/acceptance/g04-runner-receipt.mjs';
import {
  P01_ARGUMENT_PROFILE,
  P01_EXPECTED_QUERY_ARGUMENTS,
} from '../../scripts/acceptance/p01-person-position-answer-check.mjs';
import {
  P05_ARGUMENTS_SHA256,
  P05_ARGUMENT_PROFILE,
  P05_EPOCH_ID,
  P05_TOOL_NAME,
} from '../../scripts/acceptance/p05-person-media-public-probe.mjs';
import {
  R01_ARGUMENT_PROFILE,
  R01_EPOCH_ID,
  R01_EXPECTED_QUERY_ARGUMENTS,
} from '../../scripts/acceptance/run-r01-codex-agent-mcp.mjs';
import {
  r01OneShotLatchLabelDescription,
  r01OneShotLatchLabelName,
  r01OneShotTerminalLabelDescription,
  r01OneShotTerminalLabelName,
} from '../../scripts/lib/r01-one-shot-claim.mjs';
import {
  P05_ONE_SHOT_LATCH_LABEL_DESCRIPTION,
  P05_ONE_SHOT_LATCH_LABEL_NAME,
} from '../../scripts/lib/p05-one-shot-claim.mjs';
import { validateR01SanitizedReportFile } from '../../scripts/acceptance/write-r01-agent-mcp-report.mjs';
import {
  generateP01RunnerReceiptKeyPair,
  p01RunnerPublicKeySha256,
} from '../../scripts/acceptance/p01-runner-receipt.mjs';
import { makeP01Report } from './p01-report-fixture.mjs';
import { makeR05ProfileReportInput } from './fixtures/r05-profile-report-input.mjs';
import { writeR05SharedPersonOverlapReport } from '../../scripts/acceptance/write-r05-shared-person-overlap-report.mjs';
import { getAgentMcpProfileById } from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import {
  C01_SAFE_SCOPE_NOTE,
  projectC01ComparisonResult,
} from '../../scripts/lib/c01-rating-count-evidence.mjs';
import { writeC01ProfileReport } from '../../scripts/acceptance/write-c01-rating-count-report.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const mockBin = path.join(root, 'tests/harness/mock-harness-bin.mjs');
const sha = (digit) => digit.repeat(40);
const D07_EPOCH_ID = 'run95-d07-current-rank-by-release-year';
const C03_PROFILE = getAgentMcpProfileById('c03-voice-actor-comparison-v1');
const C02_PROFILE = getAgentMcpProfileById('c02-cardcaptor-tv-movie-v1');
const C01_PROFILE = getAgentMcpProfileById('c01-rating-count-gap-v1');
const P03_PROFILE = getAgentMcpProfileById('p03-person-name-cn-agent-mcp-v1');
const R05_PROFILE = getAgentMcpProfileById('r05-k-on-season-shared-person-v1');
const P06_PROFILE = getAgentMcpProfileById('p06-render-person-profile-offline-agent-mcp-v1');
const P02_PROFILE = getAgentMcpProfileById('p02-person-profile-offline-agent-mcp-v1');
const R04_PROFILE = getAgentMcpProfileById('r04-series-watch-order-offline-agent-mcp-v1');
const C04_PROFILE = getAgentMcpProfileById('c04-cohort-comparison-agent-mcp-matrix-v1');
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
  const { frontierLedger, harnessRoot = root, ...stateOverrides } = overrides;
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
      return spawnSync(
        process.execPath,
        [path.join(harnessRoot, 'scripts/agent-harness.mjs'), ...args],
        {
          cwd: harnessRoot,
          encoding: 'utf8',
          env: {
            ...process.env,
            PATH: `${binDirectory}:${process.env.PATH}`,
            HARNESS_MOCK_STATE: statePath,
            HARNESS_FRONTIER_LEDGER_PATH: frontierLedgerPath,
            HARNESS_G04_BUNDLE_SHA256: 'c'.repeat(64),
            ...envOverrides,
          },
        },
      );
    },
    readState() {
      return JSON.parse(fs.readFileSync(statePath, 'utf8'));
    },
    cleanup() {
      fs.rmSync(directory, { recursive: true, force: true });
    },
  };
}

function symlinkSource(source, target) {
  fs.symlinkSync(source, target, fs.statSync(source).isDirectory() ? 'dir' : 'file');
}

function mirrorDocsWithoutR05Report(source, target, relative = '') {
  const excludedReport = R05_PROFILE.reportPath.replace(/^docs\//u, '');
  fs.mkdirSync(target, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const childRelative = relative ? `${relative}/${entry.name}` : entry.name;
    if (childRelative === excludedReport) continue;
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    if (excludedReport.startsWith(`${childRelative}/`)) {
      mirrorDocsWithoutR05Report(sourcePath, targetPath, childRelative);
    } else {
      symlinkSource(sourcePath, targetPath);
    }
  }
}

function createIsolatedHarnessRoot() {
  const harnessRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'r05-harness-root-'));
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.name === '.git') continue;
    const sourcePath = path.join(root, entry.name);
    const targetPath = path.join(harnessRoot, entry.name);
    if (entry.name === 'docs') {
      mirrorDocsWithoutR05Report(sourcePath, targetPath);
    } else if (entry.name === 'scripts') {
      fs.mkdirSync(targetPath);
      for (const scriptEntry of fs.readdirSync(sourcePath, { withFileTypes: true })) {
        const scriptSource = path.join(sourcePath, scriptEntry.name);
        const scriptTarget = path.join(targetPath, scriptEntry.name);
        if (scriptEntry.name === 'agent-harness.mjs') {
          fs.copyFileSync(scriptSource, scriptTarget);
        } else if (scriptEntry.name === 'acceptance') {
          fs.mkdirSync(scriptTarget);
          for (const acceptanceEntry of fs.readdirSync(scriptSource, { withFileTypes: true })) {
            const acceptanceSource = path.join(scriptSource, acceptanceEntry.name);
            const acceptanceTarget = path.join(scriptTarget, acceptanceEntry.name);
            if (acceptanceEntry.name === 'write-r05-shared-person-overlap-report.mjs') {
              fs.copyFileSync(acceptanceSource, acceptanceTarget);
            } else {
              symlinkSource(acceptanceSource, acceptanceTarget);
            }
          }
        } else {
          symlinkSource(scriptSource, scriptTarget);
        }
      }
    } else {
      symlinkSource(sourcePath, targetPath);
    }
  }
  return harnessRoot;
}

function g04LegacyReconciliationFixture({ dispositionOverrides = {} } = {}) {
  const run = createRunState({ runId: 'run-95-g04-legacy-claim' });
  run.state = 'EPOCH_ACTIVE';
  run.active_epoch_pr = 139;
  run.outer_sol.max = 139;
  run.outer_sol.consumed = 138;
  run.outer_sol.product.max = 138;
  run.outer_sol.product.consumed = 138;
  run.next_action = 'RESUME_PR_139';

  const currentCandidate = sha('b');
  const currentBase = sha('a');
  const currentBranch = 'codex/epoch-run95-g04-legacy-reconcile';
  const currentEpoch = createEpochState({
    epochId: 'run95-g04-person-activity-global-one-shot-latch',
    baseSha: currentBase,
    objective: 'Reconcile the already-spent Run 95 G04 query without retrying it.',
    questions: ['Can the terminal legacy claim be made global without another query?'],
    workPackages: ['Validate the old claim', 'Acquire the global no-retry latch'],
    nonScope: ['No additional G04 query'],
    acceptanceCriteria: ['No second G04 query is invoked.'],
  });
  currentEpoch.branch = currentBranch;
  currentEpoch.base_branch = 'master';
  currentEpoch.pr_number = 139;
  currentEpoch.state = 'REVIEW_PASSED';
  currentEpoch.candidate_sha = currentCandidate;
  currentEpoch.reviewed_base_sha = currentBase;
  currentEpoch.review_pass_sha = currentCandidate;
  currentEpoch.advances_frontier_ids = ['G04'];
  currentEpoch.ci = {
    sha: currentCandidate,
    status: 'SUCCESS',
    url: 'https://example.test/actions/139',
  };
  currentEpoch.scope_closure = {
    why_not_review_earlier: 'The legacy terminal claim must be reconciled first.',
    why_not_extend_further: 'A second G04 query is prohibited.',
    related_work_remaining: false,
  };
  currentEpoch.adversarial_preflight = {
    completed: true,
    summary: 'No query retry is permitted.',
  };
  currentEpoch.review_history = [
    {
      review_number: 1,
      reviewer_id: 'gpt-6-luna-max-run95-pr139-round1',
      candidate_sha: currentCandidate,
      reviewed_base_sha: currentBase,
      verdict: 'PASS',
    },
  ];

  const sourceCandidate = sha('d');
  const sourceBase = sha('c');
  const sourceBranch = 'codex/epoch-run95-g04-pr136';
  const sourceEpoch = createEpochState({
    epochId: 'run95-g04-person-activity-codex-current-evidence',
    baseSha: sourceBase,
    objective: 'Historical G04 claim source.',
    questions: ['Was the earlier one-shot terminal?'],
    workPackages: ['Preserve the claim'],
    nonScope: ['No retry'],
    acceptanceCriteria: ['The claim is INCONCLUSIVE.'],
  });
  sourceEpoch.branch = sourceBranch;
  sourceEpoch.base_branch = 'master';
  sourceEpoch.pr_number = 136;
  sourceEpoch.state = 'MERGED';
  sourceEpoch.candidate_sha = sourceCandidate;
  sourceEpoch.reviewed_base_sha = sourceBase;
  sourceEpoch.review_pass_sha = sourceCandidate;
  sourceEpoch.ci = {
    sha: sourceCandidate,
    status: 'SUCCESS',
    url: 'https://example.test/actions/136',
  };
  sourceEpoch.review_history = [
    {
      review_number: 7,
      reviewer_id: 'gpt-6-luna-max-run95-pr136-round1',
      candidate_sha: sourceCandidate,
      reviewed_base_sha: sourceBase,
      verdict: 'PASS',
    },
  ];
  const keyPair = generateG04RunnerReceiptKeyPair();
  const sourceDisposition = {
    claimId: `g04-run-95-pr-136-${sourceCandidate.slice(0, 12)}-123`,
    frontierId: 'G04',
    epochId: sourceEpoch.epoch_id,
    runNumber: 95,
    toolName: 'bangumi.get_person_activity',
    argumentProfile: 'fixed-g04-person-13684-voice-tv-12m-48r-16d-8rows-v1',
    expectedArgumentsSha256: canonicalHash(G04_EXPECTED_QUERY_ARGUMENTS),
    state: 'INCONCLUSIVE',
    sourceCandidateSha: sourceCandidate,
    baseSha: sourceBase,
    ciSha: sourceCandidate,
    ciStatus: 'SUCCESS',
    bundleSha256: 'f'.repeat(64),
    prNumber: 136,
    reviewerId: 'gpt-6-luna-max-run95-pr136-round1',
    model: 'gpt-6-luna',
    reasoningEffort: 'max',
    runnerReceiptPublicKey: keyPair.publicKeyBase64,
    runnerReceiptPublicKeySha256: g04RunnerPublicKeySha256(keyPair.publicKeyBase64),
    reportWritten: false,
    retryAllowed: false,
    claimedAt: '2026-10-12T07:16:01.157Z',
    finishedAt: '2026-10-12T07:16:54.835Z',
    ...dispositionOverrides,
  };
  sourceEpoch.adversarial_preflight = {
    completed: true,
    summary: 'The exact fixed-profile claim ended INCONCLUSIVE and cannot be retried.',
    g04_one_shot_disposition: sourceDisposition,
  };

  const successfulChecks = mandatoryChecks.map((name) => ({ name, conclusion: 'SUCCESS' }));
  const state = {
    runIssueNumber: 95,
    runBody: renderRunBody(run),
    runIssueState: 'OPEN',
    branch: currentBranch,
    baseBranch: 'master',
    featureBranch: currentBranch,
    baseSha: currentBase,
    featureHeadSha: currentCandidate,
    dirty: '',
    checks: successfulChecks,
    prs: {
      139: {
        body: renderEpochBody(currentEpoch),
        state: 'OPEN',
        draft: false,
        headRefName: currentBranch,
        headRefOid: currentCandidate,
        baseRefName: 'master',
        checks: successfulChecks,
      },
      136: {
        body: renderEpochBody(sourceEpoch),
        state: 'MERGED',
        draft: false,
        headRefName: sourceBranch,
        headRefOid: sourceCandidate,
        baseRefName: 'master',
        checks: successfulChecks,
      },
    },
  };
  return { ...state, currentEpoch, sourceEpoch, sourceDisposition };
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

function r04CandidateCheckEnvironment() {
  const { run, epoch } = controlFixture();
  const branch = 'codex/epoch-run95-r04-series-watch-order-offline-matrix-20261016';
  const ciRunId = '38825409269';
  run.active_epoch_pr = 42;
  epoch.epoch_id = R04_PROFILE.epochId;
  epoch.branch = branch;
  epoch.pr_number = 42;
  epoch.advances_frontier_ids = [];
  const checks = mandatoryChecks.map((name, index) => ({
    name,
    status: 'COMPLETED',
    conclusion: 'SUCCESS',
    detailsUrl:
      'https://github.com/PariyaProject/BangumiAgentKit/actions/runs/' +
      ciRunId +
      '/job/' +
      String(116731612067 + index),
  }));
  const environment = createMockEnvironment({
    runBody: renderRunBody(run),
    prBody: renderEpochBody(epoch),
    branch,
    featureBranch: branch,
    featureHeadSha: sha('b'),
    baseSha: sha('a'),
    draft: true,
    checks,
  });
  return {
    environment,
    ciRunUrl: 'https://github.com/PariyaProject/BangumiAgentKit/actions/runs/' + ciRunId,
  };
}

function reconciledPostPassRefreshFixture() {
  const { run, epoch } = controlFixture();
  epoch.state = 'REVIEW_RESERVATION_RECONCILED';
  epoch.candidate_sha = sha('b');
  epoch.ci = { sha: sha('b'), status: 'SUCCESS', url: 'https://example.test/ci' };
  epoch.review.consumed = 1;
  epoch.review.runtime = { state: 'COMPLETED', reason: null, allocation: 'NORMAL' };
  epoch.review_history = [
    {
      review_number: 1,
      reviewer_id: 'gpt-6-luna-max-test-reviewer',
      candidate_sha: sha('c'),
      reviewed_base_sha: sha('a'),
      verdict: 'PASS',
      findings: [],
    },
  ];
  epoch.candidate_refresh_history = [
    {
      review_number: 1,
      previous_candidate_sha: sha('c'),
      candidate_sha: sha('b'),
      reviewed_base_sha: sha('a'),
      reason: 'A required post-PASS evidence file was added.',
      at: '2026-10-14T00:00:00.000Z',
    },
  ];
  return { run, epoch };
}

function correctiveClosure(findingId = 'review-2-finding-1') {
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
  const run = createRunState({ runId: 'existing-run', outerSolMax: 4 });
  run.outer_sol.product.consumed = 3;
  run.outer_sol.consumed = 3;
  const environment = createMockEnvironment({
    runBody: renderRunBody(run),
    branch: 'master',
    runIssueTitle: '[Harness V3 Run] Existing run',
  });
  try {
    const result = environment.execute(['run:start', '--title', 'New invocation']);
    assert.equal(result.status, 0, result.stderr);
    const resumed = JSON.parse(result.stdout);
    assert.equal(resumed.state, 'RUN_RESUMED');
    assert.equal(resumed.budget_upgraded, true);
    assert.equal(resumed.run.outer_sol.product.max, 96);
    assert.equal(resumed.run.outer_sol.product.consumed, 3);
    assert.equal(resumed.run.outer_sol.max, 97);
    assert.equal(resumed.run.outer_sol.consumed, 3);
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

test('CLI run:budget-extend writes an auditable allowance without refunding consumption', () => {
  const run = createRunState({ runId: 'legacy-budget', outerSolMax: 4 });
  run.outer_sol.product.consumed = 3;
  run.outer_sol.consumed = 3;
  const environment = createMockEnvironment({ runBody: renderRunBody(run) });
  try {
    const result = environment.execute([
      'run:budget-extend',
      '--run',
      '1',
      '--product-add',
      '2',
      '--reason',
      'Continue the tracked long-goal run',
    ]);
    assert.equal(result.status, 0, result.stderr);
    const updated = parseControlBlock(environment.readState().runBody, RUN_MARKER);
    assert.equal(updated.outer_sol.product.max, 5);
    assert.equal(updated.outer_sol.product.consumed, 3);
    assert.equal(updated.outer_sol.max, 6);
    assert.equal(updated.outer_sol.consumed, 3);
    assert.equal(updated.outer_sol.product.budget_extension_history.at(-1).added, 2);
  } finally {
    environment.cleanup();
  }
});

test('CLI review:budget-extend updates only the active Epoch review ledger', () => {
  const environment = createMockEnvironment();
  try {
    const result = environment.execute([
      'review:budget-extend',
      '--run',
      '1',
      '--pr',
      '42',
      '--add',
      '4',
      '--reason',
      'Continue this coherent Epoch autonomously',
    ]);
    assert.equal(result.status, 0, result.stderr);
    const state = environment.readState();
    const run = parseControlBlock(state.runBody, RUN_MARKER);
    const epoch = parseControlBlock(state.prBody, EPOCH_MARKER);
    assert.equal(epoch.review.max, 6);
    assert.equal(epoch.review.consumed, 0);
    assert.equal(epoch.review.budget_extension_history.at(-1).added, 4);
    assert.equal(run.active_epoch_pr, 42);
  } finally {
    environment.cleanup();
  }
});

test('CLI review:budget-extend resumes actionable review-limit findings without refunding launches', () => {
  const { run, epoch } = controlFixture();
  epoch.state = 'FINAL_CORRECTIVE_REQUIRED';
  epoch.final_corrective_reason = 'REVIEW_LIMIT_FINDINGS';
  epoch.review.max = 6;
  epoch.review.consumed = 6;
  epoch.review.budget_extension_history = [
    {
      from_max: 2,
      to_max: 6,
      added: 4,
      reason: 'Prior authorized Luna Max continuation',
      at: '2026-10-11T00:00:00.000Z',
    },
  ];
  epoch.findings = [
    {
      id: 'P01-RESULT-CLAIM-001',
      severity: 'P1',
      title: 'Runner import bypass',
      summary: 'Caller can bypass durable Harness disposition.',
      recommendation: 'Keep execution private to the Harness command.',
    },
  ];
  epoch.candidate_sha = null;
  epoch.review_pass_sha = null;
  epoch.ci = { sha: null, status: 'NOT_RUN', url: null };
  const productConsumed = run.outer_sol.product.consumed;
  const environment = createMockEnvironment({
    runBody: renderRunBody(run),
    prBody: renderEpochBody(epoch),
    branch: epoch.branch,
    featureBranch: epoch.branch,
    featureHeadSha: sha('b'),
  });
  try {
    const result = environment.execute([
      'review:budget-extend',
      '--run',
      '1',
      '--pr',
      '42',
      '--add',
      '1',
      '--reason',
      'The final Luna Max review found an actionable P1; another exact-Candidate review adds useful evidence.',
    ]);
    assert.equal(result.status, 0, result.stderr);
    const state = environment.readState();
    const resumedRun = parseControlBlock(state.runBody, RUN_MARKER);
    const resumedEpoch = parseControlBlock(state.prBody, EPOCH_MARKER);
    assert.equal(resumedEpoch.state, 'CORRECTIVE_REQUIRED');
    assert.equal(resumedEpoch.final_corrective_reason, null);
    assert.equal(resumedEpoch.review.max, 7);
    assert.equal(resumedEpoch.review.consumed, 6);
    assert.equal(resumedEpoch.review.reserved, 0);
    assert.equal(resumedEpoch.findings[0].id, 'P01-RESULT-CLAIM-001');
    assert.equal(resumedEpoch.candidate_sha, null);
    assert.equal(resumedEpoch.ci.status, 'NOT_RUN');
    assert.equal(resumedRun.state, 'EPOCH_ACTIVE');
    assert.equal(resumedRun.active_epoch_pr, 42);
    assert.equal(resumedRun.outer_sol.product.consumed, productConsumed);
    assert.equal(resumedRun.next_action, 'RESUME_PR_42');
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
    const createdRun = parseControlBlock(state.runBody, RUN_MARKER);
    assert.equal(createdRun.outer_sol.product.max, 96);
    assert.equal(createdRun.outer_sol.closure.max, 1);
    assert.equal(createdRun.outer_sol.max, 97);
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
    assert.ok(
      state.calls.some(
        (call) =>
          call.tool === 'gh' &&
          call.args[0] === 'api' &&
          call.args[1] === 'repos/{owner}/{repo}/pulls/42' &&
          call.args.includes('PATCH'),
      ),
    );
  } finally {
    environment.cleanup();
  }
});

test('CLI Candidate gate requires exact Actions-run evidence for R04 profiles', () => {
  const { environment, ciRunUrl } = r04CandidateCheckEnvironment();
  try {
    const missingRunUrl = environment.execute([
      'candidate:check',
      '--pr',
      '42',
      '--evidence',
      candidateEvidence(environment),
    ]);
    assert.equal(missingRunUrl.status, 2);
    assert.match(missingRunUrl.stderr, /^CANDIDATE_EXACT_CI_RUN_EVIDENCE_REQUIRED:/u);
    assert.equal(
      parseControlBlock(environment.readState().prBody, EPOCH_MARKER).state,
      'IMPLEMENTING',
    );

    const exactRunUrl = environment.execute([
      'candidate:check',
      '--pr',
      '42',
      '--evidence',
      candidateEvidence(environment, { ci: { url: ciRunUrl } }),
    ]);
    assert.equal(exactRunUrl.status, 0, exactRunUrl.stderr);
    const epoch = parseControlBlock(environment.readState().prBody, EPOCH_MARKER);
    assert.equal(epoch.state, 'REVIEW_READY');
    assert.equal(epoch.ci.url, ciRunUrl);
  } finally {
    environment.cleanup();
  }
});

test('CLI PASS result refreshes a stale remote-tracking Candidate ref before validation', () => {
  const { run, epoch } = controlFixture();
  epoch.state = 'REVIEW_RUNNING';
  epoch.candidate_sha = sha('b');
  epoch.reviewed_base_sha = sha('a');
  epoch.ci = { sha: sha('b'), status: 'SUCCESS', url: 'https://example.test/ci' };
  epoch.review.consumed = 1;
  epoch.review.reviewer_id = 'luna-reviewer';
  epoch.review.runtime = { state: 'ACTIVE', reason: null, allocation: 'NORMAL' };
  run.outer_sol.consumed = 1;
  run.outer_sol.product.consumed = 1;
  const environment = createMockEnvironment({
    runBody: renderRunBody(run),
    prBody: renderEpochBody(epoch),
    featureHeadSha: sha('b'),
    remoteTrackingFeatureSha: sha('a'),
    draft: false,
  });
  try {
    const result = environment.execute([
      'review:result',
      '--run',
      '1',
      '--pr',
      '42',
      '--verdict',
      'PASS',
    ]);
    assert.equal(result.status, 0, result.stderr);
    const state = environment.readState();
    const stored = parseControlBlock(state.prBody, EPOCH_MARKER);
    assert.equal(stored.state, 'REVIEW_PASSED');
    assert.equal(stored.review_pass_sha, sha('b'));
    assert.equal(state.remoteTrackingFeatureSha, sha('b'));
    assert.ok(
      state.calls.some(
        (call) =>
          call.tool === 'git' &&
          call.args[0] === 'fetch' &&
          call.args.at(-1) === 'refs/heads/codex/epoch-cli:refs/remotes/origin/codex/epoch-cli',
      ),
    );
  } finally {
    environment.cleanup();
  }
});

function passedCandidateFixture() {
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
      reviewer_id: 'luna-max-d05',
      candidate_sha: sha('b'),
      reviewed_base_sha: sha('a'),
      verdict: 'PASS',
      findings: [],
    },
  ];
  run.outer_sol.consumed = 1;
  run.outer_sol.product.consumed = 1;
  return { run, epoch };
}

function run95P05ClaimFixture() {
  const { run, epoch } = passedCandidateFixture();
  const candidateSha = sha('b');
  const baseSha = sha('a');
  const reviewerId = 'gpt-6-luna-max-run95-pr166-round1';
  const branch = 'codex/epoch-run95-p05-person-media-distribution-public-probe-20261015';
  run.state = 'EPOCH_ACTIVE';
  run.profile = 'AUTONOMOUS_EVOLUTION';
  run.active_epoch_pr = 166;
  run.pending_epoch = null;
  run.next_action = 'RESUME_PR_166';
  epoch.epoch_id = P05_EPOCH_ID;
  epoch.pr_number = 166;
  epoch.branch = branch;
  epoch.base_branch = 'master';
  epoch.base_sha = baseSha;
  epoch.reviewed_base_sha = baseSha;
  epoch.candidate_sha = candidateSha;
  epoch.review_pass_sha = candidateSha;
  epoch.state = 'REVIEW_PASSED';
  epoch.advances_frontier_ids = ['P05'];
  epoch.ci = { sha: candidateSha, status: 'SUCCESS', url: 'https://example.test/ci' };
  epoch.review.reviewer_id = null;
  epoch.review.runtime = { state: 'COMPLETED', reason: null, allocation: 'NORMAL' };
  epoch.scope_closure = {
    why_not_review_earlier: 'The exact source, frontier, and runner gates are ready.',
    why_not_extend_further: 'Adjacent person questions require different sources and semantics.',
    related_work_remaining: false,
  };
  epoch.adversarial_preflight = {
    completed: true,
    summary: 'The fixed one-read profile and claim path are bounded.',
  };
  epoch.review_history = [
    {
      review_number: 1,
      reviewer_id: reviewerId,
      candidate_sha: candidateSha,
      reviewed_base_sha: baseSha,
      verdict: 'PASS',
      findings: [],
    },
  ];
  return { run, epoch, candidateSha, baseSha, reviewerId, branch };
}

function agentMcpProfileReviewReadyEnvironment(profile, overrides = {}) {
  const { run, epoch } = passedCandidateFixture();
  const branch = `codex/epoch-${profile.epochId}`;
  const reviewerId = 'gpt-6-luna-max-run95-pr42-round1';
  run.state = 'EPOCH_ACTIVE';
  run.profile = 'AUTONOMOUS_EVOLUTION';
  run.active_epoch_pr = 42;
  run.pending_epoch = null;
  epoch.epoch_id = profile.epochId;
  epoch.branch = branch;
  epoch.base_branch = 'master';
  epoch.pr_number = 42;
  epoch.base_sha = sha('a');
  epoch.candidate_sha = sha('b');
  epoch.reviewed_base_sha = sha('a');
  epoch.review_pass_sha = sha('b');
  epoch.state = 'REVIEW_PASSED';
  epoch.advances_frontier_ids = [profile.frontierId];
  epoch.ci = { sha: sha('b'), status: 'SUCCESS', url: 'https://example.test/ci' };
  epoch.scope_closure = {
    why_not_review_earlier: 'The registered profile and claim path form one coherent slice.',
    why_not_extend_further: 'Other scenarios need separate profiles and evidence.',
    related_work_remaining: false,
  };
  epoch.adversarial_preflight = {
    completed: true,
    summary: 'The exact registered profile was checked.',
  };
  epoch.review_history = [
    {
      review_number: 1,
      reviewer_id: reviewerId,
      candidate_sha: sha('b'),
      reviewed_base_sha: sha('a'),
      verdict: 'PASS',
      findings: [],
    },
  ];
  run.outer_sol.consumed = 1;
  run.outer_sol.product.consumed = 1;
  const ciRunId = '38806371672';
  const ciRunUrl = `https://github.com/PariyaProject/BangumiAgentKit/actions/runs/${ciRunId}`;
  const checks = [P06_PROFILE.id, P02_PROFILE.id, C04_PROFILE.id].includes(profile.id)
    ? mandatoryChecks.map((name, index) => ({
        name,
        status: 'COMPLETED',
        conclusion: 'SUCCESS',
        detailsUrl: `${ciRunUrl}/job/${116668186145 + index}`,
      }))
    : mandatoryChecks.map((name) => ({ name, conclusion: 'SUCCESS' }));
  if ([P06_PROFILE.id, P02_PROFILE.id, C04_PROFILE.id].includes(profile.id)) {
    epoch.ci.url = ciRunUrl;
  }
  const environment = createMockEnvironment({
    runIssueNumber: 95,
    runBody: renderRunBody(run),
    prBody: renderEpochBody(epoch),
    branch,
    featureBranch: branch,
    featureHeadSha: sha('b'),
    baseSha: sha('a'),
    draft: false,
    checks,
    ...overrides,
  });
  return { environment, reviewerId, branch, run, epoch };
}

function c03ReviewReadyEnvironment(overrides = {}) {
  return agentMcpProfileReviewReadyEnvironment(C03_PROFILE, overrides);
}

test('C03 Harness profile status, create-once claim, and terminal result are durable and fail closed', () => {
  const { environment, reviewerId } = c03ReviewReadyEnvironment();
  const keyPair = generateG04RunnerReceiptKeyPair();
  const runArgs = ['--run', '95', '--pr', '42', '--profile-id', C03_PROFILE.id];
  try {
    const initial = environment.execute(['epoch:agent-mcp-profile-status', ...runArgs]);
    assert.equal(initial.status, 0, initial.stderr);
    const initialState = JSON.parse(initial.stdout);
    assert.equal(initialState.state, 'UNCLAIMED');
    assert.equal(initialState.review_gate.eligible, true);
    assert.equal(initialState.tool_name, 'bangumi.get_person_activity');
    assert.equal(initialState.call_count, 2);

    const claimed = environment.execute([
      'epoch:agent-mcp-profile-claim',
      ...runArgs,
      '--bundle-sha256',
      'c'.repeat(64),
      '--reviewer-id',
      reviewerId,
      '--runner-public-key',
      keyPair.publicKeyBase64,
    ]);
    assert.equal(claimed.status, 0, claimed.stderr);
    const claimResult = JSON.parse(claimed.stdout);
    assert.equal(claimResult.state, 'AGENT_MCP_PROFILE_CLAIMED');
    assert.equal(claimResult.retryAllowed, false);
    const afterClaim = environment.execute(['epoch:agent-mcp-profile-status', ...runArgs]);
    assert.equal(afterClaim.status, 0, afterClaim.stderr);
    assert.equal(JSON.parse(afterClaim.stdout).state, 'CLAIMED');

    const duplicate = environment.execute([
      'epoch:agent-mcp-profile-claim',
      ...runArgs,
      '--bundle-sha256',
      'c'.repeat(64),
      '--reviewer-id',
      reviewerId,
      '--runner-public-key',
      keyPair.publicKeyBase64,
    ]);
    assert.equal(duplicate.status, 2);
    assert.match(duplicate.stderr, /^AGENT_MCP_PROFILE_CLAIM_GATE_FAILED:/u);

    const terminal = environment.execute([
      'epoch:agent-mcp-profile-result',
      ...runArgs,
      '--claim-id',
      claimResult.claimId,
      '--state',
      'INCONCLUSIVE',
    ]);
    assert.equal(terminal.status, 0, terminal.stderr);
    const terminalResult = JSON.parse(terminal.stdout);
    assert.equal(terminalResult.state, 'AGENT_MCP_PROFILE_RESULT_RECORDED');
    assert.equal(terminalResult.retryAllowed, false);

    const afterTerminal = environment.execute(['epoch:agent-mcp-profile-status', ...runArgs]);
    assert.equal(afterTerminal.status, 0, afterTerminal.stderr);
    assert.equal(JSON.parse(afterTerminal.stdout).state, 'INCONCLUSIVE');
    const stored = parseControlBlock(environment.readState().prBody, EPOCH_MARKER);
    const disposition = stored.adversarial_preflight.agent_mcp_profile_dispositions[C03_PROFILE.id];
    assert.equal(disposition.state, 'INCONCLUSIVE');
    assert.equal(disposition.retryAllowed, false);
    assert.equal(
      environment.readState().repositoryLabels['harness-r95-c03-activity-claimed'].name,
      'harness-r95-c03-activity-claimed',
    );
    assert.equal(
      environment.readState().repositoryLabels['harness-r95-c03-activity-terminal'].description,
      'Run95 C03 INCONCLUSIVE no-report',
    );
  } finally {
    environment.cleanup();
  }
});

test('C02 Harness claim rejects reviewer substitution before creating the permanent latch', () => {
  const { environment, epoch, reviewerId } =
    agentMcpProfileReviewReadyEnvironment(C02_PROFILE);
  const laterReviewerId = 'gpt-6-luna-max-run95-pr42-round2';
  epoch.review_history.push({
    ...epoch.review_history[0],
    review_number: 2,
    reviewer_id: laterReviewerId,
  });
  const state = environment.readState();
  state.prBody = renderEpochBody(epoch);
  fs.writeFileSync(environment.statePath, `${JSON.stringify(state, null, 2)}\n`);

  const keyPair = generateG04RunnerReceiptKeyPair();
  const runArgs = ['--run', '95', '--pr', '42', '--profile-id', C02_PROFILE.id];
  try {
    const rejected = environment.execute([
      'epoch:agent-mcp-profile-claim',
      ...runArgs,
      '--bundle-sha256',
      'c'.repeat(64),
      '--reviewer-id',
      laterReviewerId,
      '--runner-public-key',
      keyPair.publicKeyBase64,
    ]);
    assert.equal(rejected.status, 2);
    assert.match(rejected.stderr, /^AGENT_MCP_PROFILE_CLAIM_GATE_FAILED:/u);
    const stateAfter = environment.readState();
    assert.equal(
      Object.hasOwn(stateAfter.repositoryLabels ?? {}, C02_PROFILE.claimLabelName),
      false,
    );
    const stored = parseControlBlock(stateAfter.prBody, EPOCH_MARKER);
    assert.equal(
      stored.adversarial_preflight.agent_mcp_profile_dispositions?.[C02_PROFILE.id],
      undefined,
    );
    assert.equal(reviewerId, 'gpt-6-luna-max-run95-pr42-round1');
  } finally {
    environment.cleanup();
  }
});

test('P03 Harness profile status, create-once claim, and no-retry result use its immutable profile digest', () => {
  const { environment, reviewerId } = agentMcpProfileReviewReadyEnvironment(P03_PROFILE);
  const keyPair = generateG04RunnerReceiptKeyPair();
  const runArgs = ['--run', '95', '--pr', '42', '--profile-id', P03_PROFILE.id];
  try {
    const initial = environment.execute(['epoch:agent-mcp-profile-status', ...runArgs]);
    assert.equal(initial.status, 0, initial.stderr);
    const initialState = JSON.parse(initial.stdout);
    assert.equal(initialState.state, 'UNCLAIMED');
    assert.equal(initialState.frontier_id, 'P03');
    assert.equal(initialState.call_count, 1);
    assert.equal(initialState.review_gate.eligible, true);

    const claimed = environment.execute([
      'epoch:agent-mcp-profile-claim',
      ...runArgs,
      '--bundle-sha256',
      'c'.repeat(64),
      '--reviewer-id',
      reviewerId,
      '--runner-public-key',
      keyPair.publicKeyBase64,
    ]);
    assert.equal(claimed.status, 0, claimed.stderr);
    const claimResult = JSON.parse(claimed.stdout);
    assert.equal(claimResult.state, 'AGENT_MCP_PROFILE_CLAIMED');
    assert.equal(claimResult.retryAllowed, false);

    const terminal = environment.execute([
      'epoch:agent-mcp-profile-result',
      ...runArgs,
      '--claim-id',
      claimResult.claimId,
      '--state',
      'INCONCLUSIVE',
    ]);
    assert.equal(terminal.status, 0, terminal.stderr);
    assert.equal(JSON.parse(terminal.stdout).state, 'AGENT_MCP_PROFILE_RESULT_RECORDED');
    const status = environment.execute(['epoch:agent-mcp-profile-status', ...runArgs]);
    assert.equal(status.status, 0, status.stderr);
    assert.equal(JSON.parse(status.stdout).state, 'INCONCLUSIVE');
    assert.equal(JSON.parse(status.stdout).retry_allowed, false);
  } finally {
    environment.cleanup();
  }
});

test('P06 Harness profile claim persists the exact successful CI run and check identities', () => {
  const { environment, reviewerId } = agentMcpProfileReviewReadyEnvironment(P06_PROFILE);
  const keyPair = generateG04RunnerReceiptKeyPair();
  const runArgs = ['--run', '95', '--pr', '42', '--profile-id', P06_PROFILE.id];
  try {
    const claimed = environment.execute([
      'epoch:agent-mcp-profile-claim',
      ...runArgs,
      '--bundle-sha256',
      'c'.repeat(64),
      '--reviewer-id',
      reviewerId,
      '--runner-public-key',
      keyPair.publicKeyBase64,
    ]);
    assert.equal(claimed.status, 0, claimed.stderr);
    const claimResult = JSON.parse(claimed.stdout);
    assert.equal(claimResult.ciRunId, '38806371672');
    assert.deepEqual(
      claimResult.ciChecks.map(({ name, status, conclusion }) => ({ name, status, conclusion })),
      mandatoryChecks.map((name) => ({ name, status: 'COMPLETED', conclusion: 'SUCCESS' })),
    );

    const stored = parseControlBlock(environment.readState().prBody, EPOCH_MARKER);
    const disposition = stored.adversarial_preflight.agent_mcp_profile_dispositions[P06_PROFILE.id];
    assert.equal(disposition.ciRunId, '38806371672');
    assert.deepEqual(disposition.ciChecks, claimResult.ciChecks);
  } finally {
    environment.cleanup();
  }
});

test('P02 Harness profile claim persists the exact successful CI run and check identities', () => {
  const { environment, reviewerId } = agentMcpProfileReviewReadyEnvironment(P02_PROFILE);
  const keyPair = generateG04RunnerReceiptKeyPair();
  const runArgs = ['--run', '95', '--pr', '42', '--profile-id', P02_PROFILE.id];
  try {
    const claimed = environment.execute([
      'epoch:agent-mcp-profile-claim',
      ...runArgs,
      '--bundle-sha256',
      'c'.repeat(64),
      '--reviewer-id',
      reviewerId,
      '--runner-public-key',
      keyPair.publicKeyBase64,
    ]);
    assert.equal(claimed.status, 0, claimed.stderr);
    const claimResult = JSON.parse(claimed.stdout);
    assert.equal(claimResult.profileId, P02_PROFILE.id);
    assert.equal(claimResult.ciRunId, '38806371672');
    assert.deepEqual(
      claimResult.ciChecks.map(({ name, status, conclusion }) => ({ name, status, conclusion })),
      mandatoryChecks.map((name) => ({ name, status: 'COMPLETED', conclusion: 'SUCCESS' })),
    );
    const stored = parseControlBlock(environment.readState().prBody, EPOCH_MARKER);
    const disposition = stored.adversarial_preflight.agent_mcp_profile_dispositions[P02_PROFILE.id];
    assert.equal(disposition.ciRunId, '38806371672');
    assert.deepEqual(disposition.ciChecks, claimResult.ciChecks);
  } finally {
    environment.cleanup();
  }
});

test('C04 Harness claim persists exact CI identity required by its signed report', () => {
  const { environment, reviewerId } = agentMcpProfileReviewReadyEnvironment(C04_PROFILE);
  const keyPair = generateG04RunnerReceiptKeyPair();
  const runArgs = ['--run', '95', '--pr', '42', '--profile-id', C04_PROFILE.id];
  try {
    const status = environment.execute(['epoch:agent-mcp-profile-status', ...runArgs]);
    assert.equal(status.status, 0, status.stderr);
    assert.equal(JSON.parse(status.stdout).review_gate.eligible, true);

    const claimed = environment.execute([
      'epoch:agent-mcp-profile-claim',
      ...runArgs,
      '--bundle-sha256',
      'c'.repeat(64),
      '--reviewer-id',
      reviewerId,
      '--runner-public-key',
      keyPair.publicKeyBase64,
    ]);
    assert.equal(claimed.status, 0, claimed.stderr);
    const claimResult = JSON.parse(claimed.stdout);
    assert.equal(claimResult.profileId, C04_PROFILE.id);
    assert.equal(claimResult.ciRunId, '38806371672');
    assert.deepEqual(
      claimResult.ciChecks.map(({ name, status: checkStatus, conclusion }) => ({
        name,
        status: checkStatus,
        conclusion,
      })),
      mandatoryChecks.map((name) => ({
        name,
        status: 'COMPLETED',
        conclusion: 'SUCCESS',
      })),
    );

    const stored = parseControlBlock(environment.readState().prBody, EPOCH_MARKER);
    const disposition = stored.adversarial_preflight.agent_mcp_profile_dispositions[C04_PROFILE.id];
    assert.equal(disposition.ciRunId, claimResult.ciRunId);
    assert.deepEqual(disposition.ciChecks, claimResult.ciChecks);
    assert.equal(disposition.retryAllowed, false);
  } finally {
    environment.cleanup();
  }
});

test('P06 Harness claim rejects required checks attached to a different Actions run', () => {
  const ciRunId = '38806371672';
  const runUrl = `https://github.com/PariyaProject/BangumiAgentKit/actions/runs/${ciRunId}`;
  const mismatchedChecks = mandatoryChecks.map((name, index) => ({
    name,
    status: 'COMPLETED',
    conclusion: 'SUCCESS',
    detailsUrl: `${runUrl}/job/${116668186145 + index}`,
  }));
  mismatchedChecks[0].detailsUrl =
    'https://github.com/PariyaProject/BangumiAgentKit/actions/runs/99999999999/job/1';
  const { environment, reviewerId } = agentMcpProfileReviewReadyEnvironment(P06_PROFILE, {
    checks: mismatchedChecks,
  });
  const keyPair = generateG04RunnerReceiptKeyPair();
  try {
    const rejected = environment.execute([
      'epoch:agent-mcp-profile-claim',
      '--run',
      '95',
      '--pr',
      '42',
      '--profile-id',
      P06_PROFILE.id,
      '--bundle-sha256',
      'c'.repeat(64),
      '--reviewer-id',
      reviewerId,
      '--runner-public-key',
      keyPair.publicKeyBase64,
    ]);
    assert.equal(rejected.status, 2);
    assert.match(rejected.stderr, /^AGENT_MCP_PROFILE_CLAIM_GATE_FAILED:/u);
    const stored = parseControlBlock(environment.readState().prBody, EPOCH_MARKER);
    assert.equal(
      stored.adversarial_preflight.agent_mcp_profile_dispositions?.[P06_PROFILE.id],
      undefined,
    );
  } finally {
    environment.cleanup();
  }
});

test('R05 Harness profile uses its own permanent claim label and terminal no-retry disposition', () => {
  const { environment, reviewerId } = agentMcpProfileReviewReadyEnvironment(R05_PROFILE);
  const keyPair = generateG04RunnerReceiptKeyPair();
  const runArgs = ['--run', '95', '--pr', '42', '--profile-id', R05_PROFILE.id];
  try {
    const initial = environment.execute(['epoch:agent-mcp-profile-status', ...runArgs]);
    assert.equal(initial.status, 0, initial.stderr);
    const initialState = JSON.parse(initial.stdout);
    assert.equal(initialState.state, 'UNCLAIMED');
    assert.equal(initialState.frontier_id, 'R05');
    assert.equal(initialState.tool_name, 'bangumi.get_subject_overlap');
    assert.equal(initialState.call_count, 1);
    assert.equal(initialState.review_gate.eligible, true);

    const claimed = environment.execute([
      'epoch:agent-mcp-profile-claim',
      ...runArgs,
      '--bundle-sha256',
      'c'.repeat(64),
      '--reviewer-id',
      reviewerId,
      '--runner-public-key',
      keyPair.publicKeyBase64,
    ]);
    assert.equal(claimed.status, 0, claimed.stderr);
    const claimResult = JSON.parse(claimed.stdout);
    assert.equal(claimResult.state, 'AGENT_MCP_PROFILE_CLAIMED');
    assert.equal(claimResult.retryAllowed, false);

    const duplicate = environment.execute([
      'epoch:agent-mcp-profile-claim',
      ...runArgs,
      '--bundle-sha256',
      'c'.repeat(64),
      '--reviewer-id',
      reviewerId,
      '--runner-public-key',
      keyPair.publicKeyBase64,
    ]);
    assert.equal(duplicate.status, 2);

    const terminal = environment.execute([
      'epoch:agent-mcp-profile-result',
      ...runArgs,
      '--claim-id',
      claimResult.claimId,
      '--state',
      'INCONCLUSIVE',
    ]);
    assert.equal(terminal.status, 0, terminal.stderr);
    const status = environment.execute(['epoch:agent-mcp-profile-status', ...runArgs]);
    assert.equal(status.status, 0, status.stderr);
    assert.equal(JSON.parse(status.stdout).state, 'INCONCLUSIVE');
    assert.equal(JSON.parse(status.stdout).retry_allowed, false);
    assert.equal(
      environment.readState().repositoryLabels['harness-r95-r05-subject-overlap-claimed'].name,
      'harness-r95-r05-subject-overlap-claimed',
    );
  } finally {
    environment.cleanup();
  }
});

test('R05 Harness records a valid REPORT_WRITTEN report with its exact digest', () => {
  const harnessRoot = createIsolatedHarnessRoot();
  const { environment, reviewerId } = agentMcpProfileReviewReadyEnvironment(R05_PROFILE, {
    harnessRoot,
  });
  const runnerKeyPair = generateKeyPairSync('ed25519');
  const publicKeyDer = runnerKeyPair.publicKey.export({ type: 'spki', format: 'der' });
  const publicKeyBase64 = publicKeyDer.toString('base64');
  const runArgs = ['--run', '95', '--pr', '42', '--profile-id', R05_PROFILE.id];
  try {
    const claimed = environment.execute([
      'epoch:agent-mcp-profile-claim',
      ...runArgs,
      '--bundle-sha256',
      'c'.repeat(64),
      '--reviewer-id',
      reviewerId,
      '--runner-public-key',
      publicKeyBase64,
    ]);
    assert.equal(claimed.status, 0, claimed.stderr);
    const claimResult = JSON.parse(claimed.stdout);
    const claim = parseControlBlock(environment.readState().prBody, EPOCH_MARKER)
      .adversarial_preflight.agent_mcp_profile_dispositions[R05_PROFILE.id];

    const report = writeR05SharedPersonOverlapReport(
      makeR05ProfileReportInput(harnessRoot, claim),
      { privateKey: runnerKeyPair.privateKey },
    );
    assert.equal(report.passed, true, JSON.stringify(report));
    const mockState = environment.readState();
    mockState.dirty = `?? ${R05_PROFILE.reportPath}`;
    fs.writeFileSync(environment.statePath, `${JSON.stringify(mockState, null, 2)}\n`);

    const terminal = environment.execute([
      'epoch:agent-mcp-profile-result',
      ...runArgs,
      '--claim-id',
      claimResult.claimId,
      '--state',
      'REPORT_WRITTEN',
      '--report-sha256',
      report.reportSha256,
    ]);
    assert.equal(terminal.status, 0, terminal.stderr);
    assert.equal(JSON.parse(terminal.stdout).state, 'AGENT_MCP_PROFILE_RESULT_RECORDED');
    const status = environment.execute(['epoch:agent-mcp-profile-status', ...runArgs]);
    assert.equal(status.status, 0, status.stderr);
    assert.equal(JSON.parse(status.stdout).state, 'REPORT_WRITTEN');
    const disposition = parseControlBlock(environment.readState().prBody, EPOCH_MARKER)
      .adversarial_preflight.agent_mcp_profile_dispositions[R05_PROFILE.id];
    assert.equal(disposition.state, 'REPORT_WRITTEN');
    assert.equal(disposition.reportSha256, report.reportSha256);
    assert.equal(disposition.reportPath, R05_PROFILE.reportPath);
    assert.equal(disposition.reportWritten, true);
    assert.equal(disposition.retryAllowed, false);
  } finally {
    environment.cleanup();
    fs.rmSync(harnessRoot, { recursive: true, force: true });
  }
});

test('C01 Harness records a valid REPORT_WRITTEN report with its exact signed digest', () => {
  const harnessRoot = createIsolatedHarnessRoot();
  const { environment, reviewerId } = agentMcpProfileReviewReadyEnvironment(C01_PROFILE, {
    harnessRoot,
  });
  const runnerKeyPair = generateKeyPairSync('ed25519');
  const publicKeyBase64 = runnerKeyPair.publicKey
    .export({ type: 'spki', format: 'der' })
    .toString('base64');
  const runArgs = ['--run', '95', '--pr', '42', '--profile-id', C01_PROFILE.id];
  const comparisonResult = {
    subjectIds: [41529, 46729],
    state: 'partial',
    subjects: [
      {
        subjectId: 41529,
        state: 'complete',
        subject: { id: 41529, name: 'BTOOOM!', nameCn: '惊爆游戏' },
        stats: { ratingTotal: 1400 },
      },
      {
        subjectId: 46729,
        state: 'partial',
        subject: { id: 46729, name: 'Sample Work' },
        stats: { ratingTotal: 250 },
      },
    ],
    metrics: [{ key: 'ratingTotal', state: 'complete', values: [1400, 250], delta: -1150 }],
    formulaVersion: 'subject-comparison-v2',
    source: {
      official: {
        class: 'official-v0',
        operations: ['GET /v0/subjects/{subject_id}'],
        attemptedAt: '2026-10-15T12:00:00.000Z',
        retrievedAt: '2026-10-15T12:00:01.000Z',
      },
      derived: {
        class: 'derived-s7',
        operations: ['subject-comparison'],
        attemptedAt: '2026-10-15T12:00:01.000Z',
        retrievedAt: '2026-10-15T12:00:01.000Z',
      },
    },
    coverage: {
      requestedSubjects: 2,
      returnedSubjects: 2,
      subjectsComplete: 1,
      subjectsPartial: 1,
      limits: { maxSubjects: 2, maxCast: 1, maxStaff: 1, maxRelations: 1 },
    },
  };
  const answer = JSON.stringify({
    schemaVersion: 1,
    subjects: [
      { subjectId: 41529, name: '惊爆游戏', ratingTotal: 1400 },
      { subjectId: 46729, name: 'Sample Work', ratingTotal: 250 },
    ],
    ratingTotalDelta: -1150,
    thresholdAssessment: 'not_assessable_without_threshold',
    statisticalSignificance: 'not_established',
    scopeNote: C01_SAFE_SCOPE_NOTE,
  });
  try {
    const initial = environment.execute(['epoch:agent-mcp-profile-status', ...runArgs]);
    assert.equal(initial.status, 0, initial.stderr);
    assert.equal(JSON.parse(initial.stdout).state, 'UNCLAIMED');
    const claimed = environment.execute([
      'epoch:agent-mcp-profile-claim',
      ...runArgs,
      '--bundle-sha256',
      'c'.repeat(64),
      '--reviewer-id',
      reviewerId,
      '--runner-public-key',
      publicKeyBase64,
    ]);
    assert.equal(claimed.status, 0, claimed.stderr);
    const claimResult = JSON.parse(claimed.stdout);
    const claim = parseControlBlock(environment.readState().prBody, EPOCH_MARKER)
      .adversarial_preflight.agent_mcp_profile_dispositions[C01_PROFILE.id];
    const report = writeC01ProfileReport(
      {
        claim,
        source: projectC01ComparisonResult(comparisonResult),
        rawResult: comparisonResult,
        answer,
        codexCliVersion: '0.1.0',
        events: {
          processExitCode: 0,
          eventStreamParsed: true,
          turnCompleted: true,
          codexMcpToolEventCount: 1,
          codexErrorItemCount: 0,
          nonMcpToolEventCount: 0,
          nonMcpToolTypes: [],
          shellToolCallCount: 0,
          mcpServerNames: ['bgk_c01_one_tool'],
          allowedCallCount: 1,
          deniedCallCount: 0,
        },
        eventStreamSha256: 'd'.repeat(64),
        serverSummarySha256: 'e'.repeat(64),
      },
      { privateKey: runnerKeyPair.privateKey, root: harnessRoot },
    );
    assert.equal(report.passed, true, JSON.stringify(report));

    const mockState = environment.readState();
    mockState.dirty = `?? ${C01_PROFILE.reportPath}`;
    fs.writeFileSync(environment.statePath, `${JSON.stringify(mockState, null, 2)}\n`);
    const terminal = environment.execute([
      'epoch:agent-mcp-profile-result',
      ...runArgs,
      '--claim-id',
      claimResult.claimId,
      '--state',
      'REPORT_WRITTEN',
      '--report-sha256',
      report.reportSha256,
    ]);
    assert.equal(terminal.status, 0, terminal.stderr);
    assert.equal(JSON.parse(terminal.stdout).state, 'AGENT_MCP_PROFILE_RESULT_RECORDED');
    const status = environment.execute(['epoch:agent-mcp-profile-status', ...runArgs]);
    assert.equal(status.status, 0, status.stderr);
    assert.equal(JSON.parse(status.stdout).state, 'REPORT_WRITTEN');
    const disposition = parseControlBlock(environment.readState().prBody, EPOCH_MARKER)
      .adversarial_preflight.agent_mcp_profile_dispositions[C01_PROFILE.id];
    assert.equal(disposition.state, 'REPORT_WRITTEN');
    assert.equal(disposition.reportSha256, report.reportSha256);
    assert.equal(disposition.reportPath, C01_PROFILE.reportPath);
    assert.equal(disposition.reportWritten, true);
    assert.equal(disposition.retryAllowed, false);
  } finally {
    environment.cleanup();
    fs.rmSync(harnessRoot, { recursive: true, force: true });
  }
});

test('C01 Harness terminalizes an invalid retained report as INCONCLUSIVE with its exact digest', () => {
  const harnessRoot = createIsolatedHarnessRoot();
  const { environment, reviewerId } = agentMcpProfileReviewReadyEnvironment(C01_PROFILE, {
    harnessRoot,
  });
  const runnerKeyPair = generateKeyPairSync('ed25519');
  const publicKeyBase64 = runnerKeyPair.publicKey
    .export({ type: 'spki', format: 'der' })
    .toString('base64');
  const runArgs = ['--run', '95', '--pr', '42', '--profile-id', C01_PROFILE.id];
  try {
    const claimed = environment.execute([
      'epoch:agent-mcp-profile-claim',
      ...runArgs,
      '--bundle-sha256',
      'c'.repeat(64),
      '--reviewer-id',
      reviewerId,
      '--runner-public-key',
      publicKeyBase64,
    ]);
    assert.equal(claimed.status, 0, claimed.stderr);
    const claimResult = JSON.parse(claimed.stdout);
    const retainedReport = Buffer.from('{ invalid C01 report artifact }', 'utf8');
    const reportSha256 = createHash('sha256').update(retainedReport).digest('hex');
    const reportPath = path.join(harnessRoot, C01_PROFILE.reportPath);
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, retainedReport);
    const mockState = environment.readState();
    mockState.dirty = `?? ${C01_PROFILE.reportPath}`;
    fs.writeFileSync(environment.statePath, `${JSON.stringify(mockState, null, 2)}\n`);

    const terminal = environment.execute([
      'epoch:agent-mcp-profile-result',
      ...runArgs,
      '--claim-id',
      claimResult.claimId,
      '--state',
      'INCONCLUSIVE',
      '--report-sha256',
      reportSha256,
    ]);
    assert.equal(terminal.status, 0, terminal.stderr);
    const terminalResult = JSON.parse(terminal.stdout);
    assert.equal(terminalResult.state, 'AGENT_MCP_PROFILE_RESULT_RECORDED');
    assert.equal(terminalResult.resultState, 'INCONCLUSIVE');
    assert.equal(terminalResult.unacceptedReportSha256, reportSha256);
    const disposition = parseControlBlock(environment.readState().prBody, EPOCH_MARKER)
      .adversarial_preflight.agent_mcp_profile_dispositions[C01_PROFILE.id];
    assert.equal(disposition.state, 'INCONCLUSIVE');
    assert.equal(disposition.unacceptedReportSha256, reportSha256);
    assert.equal(disposition.retryAllowed, false);
  } finally {
    environment.cleanup();
    fs.rmSync(harnessRoot, { recursive: true, force: true });
  }
});

test('C03 profile claim and terminal state cannot be cleared during Candidate refresh', () => {
  const { run, epoch } = passedCandidateFixture();
  const disposition = {
    claimId: 'profile-run-95-pr-42-bbbbbbbbbbbb-1700000000000',
    profileId: C03_PROFILE.id,
    state: 'INCONCLUSIVE',
    retryAllowed: false,
  };
  epoch.adversarial_preflight.agent_mcp_profile_dispositions = {
    [C03_PROFILE.id]: structuredClone(disposition),
  };
  const environment = createMockEnvironment({
    runBody: renderRunBody(run),
    prBody: renderEpochBody(epoch),
    featureHeadSha: sha('d'),
    draft: false,
  });
  try {
    const result = environment.execute([
      'candidate:check',
      '--pr',
      '42',
      '--evidence',
      candidateEvidence(environment, {
        candidate_sha: sha('d'),
        candidate_refresh_reason: 'Attempt to clear the terminal C03 profile claim.',
      }),
    ]);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /^AGENT_MCP_PROFILE_DISPOSITION_IMMUTABLE:/u);
    const stored = parseControlBlock(environment.readState().prBody, EPOCH_MARKER);
    assert.deepEqual(
      stored.adversarial_preflight.agent_mcp_profile_dispositions[C03_PROFILE.id],
      disposition,
    );
  } finally {
    environment.cleanup();
  }
});

function c03ReportWrittenDisposition() {
  return {
    claimId: 'profile-run-95-pr-42-bbbbbbbbbbbb-1700000000000',
    profileId: C03_PROFILE.id,
    state: 'REPORT_WRITTEN',
    sourceCandidateSha: sha('b'),
    bundleSha256: 'c'.repeat(64),
    reportPath: C03_PROFILE.reportPath,
    reportSha256: 'd'.repeat(64),
    reportWritten: true,
    retryAllowed: false,
  };
}

function c03ReportRefreshEnvironment(disposition, overrides = {}, epochOverrides = {}) {
  const { run, epoch } = passedCandidateFixture();
  Object.assign(epoch, epochOverrides);
  epoch.adversarial_preflight = {
    completed: true,
    summary: 'Preserve the exact C03 report claim through an evidence-only refresh.',
    agent_mcp_profile_dispositions: { [C03_PROFILE.id]: structuredClone(disposition) },
  };
  const refreshPaths = [
    C03_PROFILE.reportPath,
    'docs/BANGUMI_TOOL_ACCEPTANCE_TASKS.md',
    'docs/product/frontier-ledger.json',
  ];
  const environment = createMockEnvironment({
    runBody: renderRunBody(run),
    prBody: renderEpochBody(epoch),
    featureHeadSha: sha('e'),
    candidateRefreshRange: `${sha('b')}...${sha('e')}`,
    candidateRefreshPaths: refreshPaths,
    draft: false,
    ...overrides,
  });
  return { environment, run, epoch };
}

test('C03 report Candidate refresh accepts only the report and bounded acceptance evidence', () => {
  const disposition = c03ReportWrittenDisposition();
  const { environment } = c03ReportRefreshEnvironment(disposition);
  try {
    const result = environment.execute([
      'candidate:check',
      '--pr',
      '42',
      '--evidence',
      candidateEvidence(environment, {
        candidate_sha: sha('e'),
        candidate_refresh_reason: 'Commit the C03 report and update its acceptance evidence.',
        adversarial_preflight: {
          completed: true,
          summary: 'Preserve the exact C03 report claim through an evidence-only refresh.',
          agent_mcp_profile_dispositions: { [C03_PROFILE.id]: disposition },
        },
      }),
    ]);
    assert.equal(result.status, 0, result.stderr);
    const stored = parseControlBlock(environment.readState().prBody, EPOCH_MARKER);
    assert.equal(stored.state, 'REVIEW_READY');
    assert.equal(stored.candidate_sha, sha('e'));
    assert.deepEqual(
      stored.adversarial_preflight.agent_mcp_profile_dispositions[C03_PROFILE.id],
      disposition,
    );
  } finally {
    environment.cleanup();
  }
});

test('C03 report Candidate refresh rejects a runtime or unrelated path change', () => {
  const { environment } = c03ReportRefreshEnvironment(
    c03ReportWrittenDisposition(),
    {
      candidateRefreshPaths: [
        C03_PROFILE.reportPath,
        'docs/product/frontier-ledger.json',
        'apps/mcp/codex-one-tool-mcp-server.mjs',
      ],
    },
    {
      state: 'CORRECTIVE_REQUIRED',
      candidate_sha: sha('d'),
      review_pass_sha: null,
    },
  );
  try {
    const result = environment.execute([
      'candidate:check',
      '--pr',
      '42',
      '--evidence',
      candidateEvidence(environment, {
        candidate_sha: sha('e'),
        candidate_refresh_reason: 'Attempt a runtime code change after the C03 report.',
        adversarial_preflight: {
          completed: true,
          summary: 'Preserve the exact C03 report claim through an evidence-only refresh.',
          agent_mcp_profile_dispositions: {
            [C03_PROFILE.id]: c03ReportWrittenDisposition(),
          },
        },
      }),
    ]);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /^AGENT_MCP_PROFILE_REFRESH_SCOPE_INVALID:/u);
    assert.equal(
      parseControlBlock(environment.readState().prBody, EPOCH_MARKER).candidate_sha,
      sha('d'),
    );
  } finally {
    environment.cleanup();
  }
});

test('C03 report Candidate refresh rejects an MCP bundle change', () => {
  const disposition = c03ReportWrittenDisposition();
  const { environment } = c03ReportRefreshEnvironment(disposition);
  try {
    const result = environment.execute(
      [
        'candidate:check',
        '--pr',
        '42',
        '--evidence',
        candidateEvidence(environment, {
          candidate_sha: sha('e'),
          candidate_refresh_reason: 'Attempt an MCP bundle change after the C03 report.',
          adversarial_preflight: {
            completed: true,
            summary: 'Preserve the exact C03 report claim through an evidence-only refresh.',
            agent_mcp_profile_dispositions: { [C03_PROFILE.id]: disposition },
          },
        }),
      ],
      { HARNESS_G04_BUNDLE_SHA256: 'f'.repeat(64) },
    );
    assert.equal(result.status, 2);
    assert.match(result.stderr, /^AGENT_MCP_PROFILE_REFRESH_SCOPE_INVALID:/u);
    assert.equal(
      parseControlBlock(environment.readState().prBody, EPOCH_MARKER).candidate_sha,
      sha('b'),
    );
  } finally {
    environment.cleanup();
  }
});

test('C03 terminal result fails closed when the permanent claim latch is missing', () => {
  const { environment, reviewerId } = c03ReviewReadyEnvironment();
  const keyPair = generateG04RunnerReceiptKeyPair();
  const runArgs = ['--run', '95', '--pr', '42', '--profile-id', C03_PROFILE.id];
  try {
    const claimed = environment.execute([
      'epoch:agent-mcp-profile-claim',
      ...runArgs,
      '--bundle-sha256',
      'c'.repeat(64),
      '--reviewer-id',
      reviewerId,
      '--runner-public-key',
      keyPair.publicKeyBase64,
    ]);
    assert.equal(claimed.status, 0, claimed.stderr);
    const claimId = JSON.parse(claimed.stdout).claimId;
    const state = environment.readState();
    delete state.repositoryLabels['harness-r95-c03-activity-claimed'];
    fs.writeFileSync(environment.statePath, `${JSON.stringify(state, null, 2)}\n`);

    const terminal = environment.execute([
      'epoch:agent-mcp-profile-result',
      ...runArgs,
      '--claim-id',
      claimId,
      '--state',
      'INCONCLUSIVE',
    ]);
    assert.equal(terminal.status, 2);
    assert.match(terminal.stderr, /^AGENT_MCP_PROFILE_CLAIM_LATCH_MISMATCH:/u);
    const finalState = environment.readState();
    assert.equal(finalState.repositoryLabels['harness-r95-c03-activity-terminal'], undefined);
    const stored = parseControlBlock(finalState.prBody, EPOCH_MARKER);
    assert.equal(
      stored.adversarial_preflight.agent_mcp_profile_dispositions[C03_PROFILE.id].state,
      'CLAIMED',
    );
  } finally {
    environment.cleanup();
  }
});

test('CLI directs a passed G06 review to reconcile its one-shot before merge', () => {
  const { run, epoch } = controlFixture();
  run.profile = 'AUTONOMOUS_EVOLUTION';
  run.active_epoch_pr = 170;
  run.pending_epoch = null;
  epoch.epoch_id = G06_EPOCH_ID;
  epoch.pr_number = 170;
  epoch.branch = 'codex/epoch-run95-g06-review-order';
  epoch.base_branch = 'master';
  epoch.base_sha = sha('a');
  epoch.candidate_sha = sha('b');
  epoch.reviewed_base_sha = sha('a');
  epoch.ci = { sha: sha('b'), status: 'SUCCESS', url: 'https://example.test/ci' };
  epoch.state = 'REVIEW_RUNNING';
  epoch.review.consumed = 1;
  epoch.review.reviewer_id = 'gpt-6-luna-max-run95-pr170-round1';
  epoch.review.runtime = { state: 'ACTIVE', reason: null, allocation: 'NORMAL' };
  epoch.advances_frontier_ids = ['G06'];
  epoch.scope_closure = {
    why_not_review_earlier: 'The G06 merge ordering is the active safety gap.',
    why_not_extend_further: 'Other frontiers remain separate.',
    related_work_remaining: false,
  };
  epoch.adversarial_preflight = {
    completed: true,
    summary: 'The review and one-shot gates were adversarially checked.',
  };
  run.outer_sol.consumed = 1;
  run.outer_sol.product.consumed = 1;
  const environment = createMockEnvironment({
    runIssueNumber: 95,
    runBody: renderRunBody(run),
    prBody: renderEpochBody(epoch),
    branch: epoch.branch,
    featureBranch: epoch.branch,
    featureHeadSha: epoch.candidate_sha,
    baseSha: epoch.base_sha,
    draft: false,
  });
  try {
    const result = environment.execute([
      'review:result',
      '--run',
      '95',
      '--pr',
      '170',
      '--verdict',
      'PASS',
    ]);
    assert.equal(result.status, 0, result.stderr);
    const state = environment.readState();
    assert.equal(
      parseControlBlock(state.prBody, EPOCH_MARKER).next_action,
      'RUN_G06_ONE_SHOT_AND_RECONCILE_BEFORE_MERGE',
    );
    assert.equal(
      parseControlBlock(state.runBody, RUN_MARKER).next_action,
      'RUN_G06_ONE_SHOT_BEFORE_MERGE',
    );
  } finally {
    environment.cleanup();
  }
});

function run95R01ClaimFixture({ claimState = 'CLAIMED', reconciliation } = {}) {
  const { run, epoch } = passedCandidateFixture();
  const candidateSha = sha('b');
  const baseSha = sha('a');
  const reviewerId = 'gpt-6-luna-max-run95-pr147-round1';
  const claimId = `r01-run-95-pr-147-${candidateSha.slice(0, 12)}-test`;
  run.profile = 'AUTONOMOUS_EVOLUTION';
  run.active_epoch_pr = 147;
  run.pending_epoch = null;
  run.next_action = 'RESUME_PR_147';
  epoch.epoch_id = R01_EPOCH_ID;
  epoch.pr_number = 147;
  epoch.branch = 'codex/epoch-run95-r01-subject-relations-agent-mcp-followup';
  epoch.base_branch = 'master';
  epoch.base_sha = baseSha;
  epoch.candidate_sha = candidateSha;
  epoch.reviewed_base_sha = baseSha;
  epoch.review_pass_sha = candidateSha;
  epoch.state = 'REVIEW_PASSED';
  epoch.advances_frontier_ids = ['R01'];
  epoch.ci = { sha: candidateSha, status: 'SUCCESS', url: 'https://example.test/ci' };
  epoch.scope_closure = {
    why_not_review_earlier: 'The R01 one-shot attempt is the current bounded work package.',
    why_not_extend_further: 'Other frontiers remain separate.',
    related_work_remaining: false,
  };
  epoch.adversarial_preflight = {
    completed: true,
    summary: 'Exact R01 source, answer, and one-shot gates are covered.',
    r01_one_shot_disposition: {
      claimId,
      frontierId: 'R01',
      epochId: R01_EPOCH_ID,
      runNumber: 95,
      toolName: 'bangumi.get_subject_relations',
      argumentProfile: R01_ARGUMENT_PROFILE,
      expectedArgumentsSha256: canonicalHash(R01_EXPECTED_QUERY_ARGUMENTS),
      state: claimState,
      sourceCandidateSha: candidateSha,
      baseSha,
      ciSha: candidateSha,
      ciStatus: 'SUCCESS',
      bundleSha256: 'c'.repeat(64),
      prNumber: 147,
      reviewerId,
      model: 'gpt-6-luna',
      reasoningEffort: 'max',
      reportWritten: claimState === 'REPORT_WRITTEN',
      retryAllowed: false,
      claimedAt: '2026-10-13T00:00:00.000Z',
      ...(claimState === 'REPORT_WRITTEN'
        ? {
            reportPath: 'docs/live-probes/pariya-agent-codex-luna-e2e-R01-relations.json',
            reportSha256: 'd'.repeat(64),
          }
        : {}),
      ...(reconciliation ? { reconciliation } : {}),
    },
  };
  epoch.review_history = [
    {
      review_number: 1,
      reviewer_id: reviewerId,
      candidate_sha: candidateSha,
      reviewed_base_sha: baseSha,
      verdict: 'PASS',
      findings: [],
    },
  ];
  run.outer_sol.consumed = 1;
  run.outer_sol.product.consumed = 1;
  return { run, epoch };
}

function r01HarnessEnvironment(run, epoch, overrides = {}) {
  return createMockEnvironment({
    runIssueNumber: 95,
    runIssueTitle: 'Run 95 R01 reconciliation fixture',
    runBody: renderRunBody(run),
    prBody: renderEpochBody(epoch),
    branch: epoch.branch,
    featureBranch: epoch.branch,
    featureHeadSha: epoch.candidate_sha,
    baseSha: epoch.base_sha,
    draft: false,
    repositoryLabels: {
      [r01OneShotLatchLabelName()]: {
        name: r01OneShotLatchLabelName(),
        color: 'b60205',
        description: r01OneShotLatchLabelDescription(),
      },
    },
    ...overrides,
  });
}

function run95G06ClaimFixture({
  claimState = 'CLAIMED',
  receiptPublicKey = createG06RunnerReceiptKeyPair().receiptPublicKey,
} = {}) {
  const { run, epoch } = passedCandidateFixture();
  const candidateSha = sha('b');
  const baseSha = sha('a');
  const reviewerId = 'gpt-6-luna-max-run95-pr170-round1';
  const claimId = `g06-run-95-pr-170-${candidateSha.slice(0, 12)}-test`;
  run.profile = 'AUTONOMOUS_EVOLUTION';
  run.active_epoch_pr = 170;
  run.pending_epoch = null;
  run.next_action = 'RESUME_PR_170';
  epoch.epoch_id = G06_EPOCH_ID;
  epoch.pr_number = 170;
  epoch.branch = 'codex/epoch-run95-g06-subject-cast-current-source';
  epoch.base_branch = 'master';
  epoch.base_sha = baseSha;
  epoch.candidate_sha = candidateSha;
  epoch.reviewed_base_sha = baseSha;
  epoch.review_pass_sha = candidateSha;
  epoch.state = 'REVIEW_PASSED';
  epoch.advances_frontier_ids = ['G06'];
  epoch.ci = { sha: candidateSha, status: 'SUCCESS', url: 'https://example.test/ci' };
  epoch.scope_closure = {
    why_not_review_earlier: 'The bounded G06 cast observation is the current work package.',
    why_not_extend_further: 'Full cast coverage is outside the one-response source contract.',
    related_work_remaining: false,
  };
  epoch.adversarial_preflight = {
    completed: true,
    summary: 'G06 fixed-source answer and privacy boundaries are covered.',
    g06_one_shot_disposition: {
      claimId,
      frontierId: 'G06',
      epochId: G06_EPOCH_ID,
      runNumber: 95,
      toolName: G06_TOOL_NAME,
      argumentProfile: G06_ARGUMENT_PROFILE,
      expectedArgumentsSha256: canonicalHash(G06_EXPECTED_QUERY_ARGUMENTS),
      state: claimState,
      sourceCandidateSha: candidateSha,
      baseSha,
      ciSha: candidateSha,
      ciStatus: 'SUCCESS',
      bundleSha256: 'c'.repeat(64),
      prNumber: 170,
      reviewerId,
      receiptPublicKey,
      model: 'gpt-6-luna',
      reasoningEffort: 'max',
      reportWritten: claimState === 'REPORT_WRITTEN',
      retryAllowed: false,
      claimedAt: '2026-10-13T00:00:00.000Z',
    },
  };
  epoch.review_history = [
    {
      review_number: 1,
      reviewer_id: reviewerId,
      candidate_sha: candidateSha,
      reviewed_base_sha: baseSha,
      verdict: 'PASS',
      findings: [],
    },
  ];
  run.outer_sol.consumed = 1;
  run.outer_sol.product.consumed = 1;
  return { run, epoch };
}

function writeValidG06Report(reportRoot, disposition, keyPair) {
  const sourceRevision = disposition.sourceCandidateSha;
  const baseSha = disposition.baseSha;
  const bundleSha256 = disposition.bundleSha256;
  const answer = [
    '主角｜合成角色｜合成声优',
    '范围：来源条目 218707；观察到 1 行，返回 1 条；没有分页参数，也没有总数；本次有限返回不保证完整；未返回或遗漏不代表不存在；不能推断主角、配角或重要性分类。',
  ].join('\n');
  const castRow = {
    character: { id: 1, name: '合成角色' },
    relation: '主角',
    actors: [{ id: 2, name: '合成声优' }],
    actorCount: 1,
    actorsOmittedFromText: 0,
  };
  const projection = {
    status: 'ok',
    subjectId: 218707,
    observed: 1,
    returned: 1,
    truncated: false,
    schemaDriftRows: 0,
    invalidActorIdRows: 0,
    mcpTextProjection: { castRowsOmittedFromText: 0, actorRowsOmittedFromText: 0 },
    cast: [castRow],
  };
  const toolOutput = {
    content: [{ type: 'text', text: JSON.stringify(projection) }],
    structuredContent: projection,
    isError: false,
  };
  const toolCalls = [
    {
      name: G06_TOOL_NAME,
      state: 'DONE',
      arguments: G06_EXPECTED_QUERY_ARGUMENTS,
      result: toolOutput,
    },
  ];
  const serverSummary = {
    sourceRevision,
    bundleSha256,
    catalogSha256: '1'.repeat(64),
    toolDescriptionSha256: '2'.repeat(64),
    inputSchemaSha256: '3'.repeat(64),
    argumentMatch: true,
    expectedArgumentsSha256: canonicalG06ArgumentsSha256(),
    allowedCallCount: 1,
    deniedCallCount: 0,
    serverResultStatus: 'SUCCESS',
    privacy: { ...G06_PRIVACY },
  };
  const input = {
    claimId: disposition.claimId,
    prNumber: disposition.prNumber,
    sourceRevision,
    baseSha,
    reviewerId: disposition.reviewerId,
    bundleSha256,
    observedAt: '2026-10-13T03:00:00.000Z',
    model: 'gpt-6-luna',
    reasoningEffort: 'max',
    codexCliVersion: 'test-fixture',
    processExitCode: 0,
    eventStreamParsed: true,
    codexMcpToolEventCount: 1,
    codexErrorItemCount: 0,
    mcpServerNames: ['bgk_g06_one_tool'],
    nonMcpToolEventCount: 0,
    nonMcpToolTypes: [],
    shellToolCallCount: 0,
    runtimeCandidateMatches: true,
    serverSummaryMatchesCandidate: true,
    serverPrivacyMatchesCandidate: true,
    serverSummary,
    toolCalls,
    answer,
    toolTextUtf8Bytes: Buffer.byteLength(toolOutput.content[0].text, 'utf8'),
  };
  const built = buildG06AgentMcpReport(input);
  assert.equal(built.passed, true);
  const runnerReceipt = createG06RunnerReceipt(built.report, keyPair.privateKey);
  const reportPath = path.join(
    reportRoot,
    'docs/live-probes/g06-subject-cast-agent-mcp-run95.json',
  );
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  const report = writeG06AgentMcpReport(
    {
      ...input,
      runnerReceipt,
      receiptPublicKey: keyPair.receiptPublicKey,
    },
    reportPath,
  );
  assert.equal(report.passed, true);
  return report;
}

function g06HarnessEnvironment(run, epoch, overrides = {}) {
  const labelName = g06OneShotLatchLabelName();
  return createMockEnvironment({
    runIssueNumber: 95,
    runIssueTitle: 'Run 95 G06 reconciliation fixture',
    runBody: renderRunBody(run),
    prBody: renderEpochBody(epoch),
    branch: epoch.branch,
    featureBranch: epoch.branch,
    featureHeadSha: epoch.candidate_sha,
    baseSha: epoch.base_sha,
    draft: false,
    repositoryLabels: {
      [labelName]: {
        name: labelName,
        color: 'b60205',
        description: g06OneShotLatchLabelDescription(
          epoch.adversarial_preflight.g06_one_shot_disposition.receiptPublicKey,
        ),
      },
    },
    ...overrides,
  });
}

function run95D07ClaimFixture({ runnerPid = 999999 } = {}) {
  const { run, epoch } = passedCandidateFixture();
  const candidateSha = sha('b');
  const baseSha = sha('a');
  const reviewerId = 'gpt-6-luna-max-run95-pr158-round1';
  const claimId = `d07-run-95-pr-158-${candidateSha.slice(0, 12)}-${'c'.repeat(12)}`;
  run.profile = 'AUTONOMOUS_EVOLUTION';
  run.active_epoch_pr = 158;
  run.pending_epoch = null;
  epoch.epoch_id = D07_EPOCH_ID;
  epoch.pr_number = 158;
  epoch.branch = 'codex/epoch-run95-d07-current-rank-by-release-year';
  epoch.base_branch = 'master';
  epoch.base_sha = baseSha;
  epoch.candidate_sha = candidateSha;
  epoch.reviewed_base_sha = baseSha;
  epoch.review_pass_sha = candidateSha;
  epoch.state = 'REVIEW_PASSED';
  epoch.advances_frontier_ids = ['D07'];
  epoch.ci = { sha: candidateSha, status: 'SUCCESS', url: 'https://example.test/ci' };
  epoch.scope_closure = {
    why_not_review_earlier: 'The bounded D07 call is controlled by a permanent one-shot latch.',
    why_not_extend_further: 'Historical rank snapshots remain outside the current-source contract.',
    related_work_remaining: false,
  };
  epoch.adversarial_preflight = {
    completed: true,
    summary: 'The exact D07 call order, claim and privacy constraints were reviewed.',
    d07_one_shot_disposition: {
      claimId,
      frontierId: 'D07',
      epochId: D07_EPOCH_ID,
      runNumber: 95,
      prNumber: 158,
      toolName: 'bangumi.query_subjects',
      argumentProfile: 'fixed-d07-current-rank-by-source-year-2016-2025-v1',
      expectedArgumentsSha256: canonicalHash(D07_QUERY_ARGUMENTS_BY_YEAR),
      expectedCallCount: D07_EXPECTED_YEARS.length,
      sourceCandidateSha: candidateSha,
      baseSha,
      ciSha: candidateSha,
      ciStatus: 'SUCCESS',
      bundleSha256: 'c'.repeat(64),
      reviewerId,
      model: 'gpt-6-luna',
      reasoningEffort: 'max',
      state: 'CLAIMED',
      reportWritten: false,
      reportSha256: null,
      retryAllowed: false,
      runnerPid,
      claimedAt: '2026-10-13T12:00:00.000Z',
    },
  };
  epoch.review_history = [
    {
      review_number: 1,
      reviewer_id: reviewerId,
      candidate_sha: candidateSha,
      reviewed_base_sha: baseSha,
      verdict: 'PASS',
      findings: [],
    },
  ];
  return { run, epoch, claimId };
}

function d07HarnessEnvironment(run, epoch, overrides = {}) {
  const { d07ClaimId, ...stateOverrides } = overrides;
  const labelName = d07OneShotLatchLabelName();
  return createMockEnvironment({
    runIssueNumber: 95,
    runIssueTitle: 'Run 95 D07 reconciliation fixture',
    runBody: renderRunBody(run),
    prBody: renderEpochBody(epoch),
    branch: epoch.branch,
    featureBranch: epoch.branch,
    featureHeadSha: epoch.candidate_sha,
    baseSha: epoch.base_sha,
    draft: false,
    repositoryLabels: {
      [labelName]: {
        name: labelName,
        color: 'b60205',
        description: d07OneShotLatchLabelDescription(
          d07ClaimId ?? epoch.adversarial_preflight.d07_one_shot_disposition.claimId,
        ),
      },
    },
    ...stateOverrides,
  });
}

function writeD07LocalClaimJournal(environment, claim) {
  fs.writeFileSync(
    path.join(environment.directory, 'd07-run95-one-shot-claim.json'),
    `${JSON.stringify(claim, null, 2)}\n`,
    { mode: 0o600 },
  );
}

test('CLI reconciles an abandoned D07 claim to terminal INCONCLUSIVE without retrying', () => {
  const { run, epoch, claimId } = run95D07ClaimFixture();
  const environment = d07HarnessEnvironment(run, epoch, { d07ClaimId: claimId });
  try {
    const result = environment.execute([
      'epoch:d07-one-shot-reconcile',
      '--run',
      '95',
      '--pr',
      '158',
    ]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /D07_ONE_SHOT_RECONCILED/u);
    const state = environment.readState();
    const stored = parseControlBlock(state.prBody, EPOCH_MARKER).adversarial_preflight
      .d07_one_shot_disposition;
    assert.equal(stored.claimId, claimId);
    assert.equal(stored.state, 'INCONCLUSIVE');
    assert.equal(stored.reportWritten, false);
    assert.equal(stored.retryAllowed, false);
    assert.equal(stored.terminalLabel, 'INCONCLUSIVE');
    assert.equal(
      state.repositoryLabels[d07OneShotTerminalLabelName()].description,
      'D07-INCONCLUSIVE:report=none',
    );
    assert.equal(
      state.calls.some((call) => call.tool === 'codex'),
      false,
      'reconciliation must never invoke Codex or the MCP query',
    );
  } finally {
    environment.cleanup();
  }
});

test('CLI refuses to reconcile a D07 claim while its claim-specific runner is active', () => {
  const { run, epoch } = run95D07ClaimFixture({ runnerPid: process.pid });
  const environment = d07HarnessEnvironment(run, epoch);
  const originalTitle = process.title;
  try {
    process.title = d07RunnerProcessTitle(
      epoch.adversarial_preflight.d07_one_shot_disposition.claimId,
    );
    const result = environment.execute([
      'epoch:d07-one-shot-reconcile',
      '--run',
      '95',
      '--pr',
      '158',
    ]);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /^D07_ONESHOT_RUNNER_ACTIVE:/u);
    assert.equal(
      Object.hasOwn(environment.readState().repositoryLabels, d07OneShotTerminalLabelName()),
      false,
    );
  } finally {
    process.title = originalTitle;
    environment.cleanup();
  }
});

test('CLI restores an orphan D07 global latch from its matching local claim journal', () => {
  const { run, epoch, claimId } = run95D07ClaimFixture();
  const claim = epoch.adversarial_preflight.d07_one_shot_disposition;
  delete epoch.adversarial_preflight.d07_one_shot_disposition;
  const environment = d07HarnessEnvironment(run, epoch, { d07ClaimId: claimId });
  writeD07LocalClaimJournal(environment, claim);
  try {
    const result = environment.execute([
      'epoch:d07-one-shot-reconcile',
      '--run',
      '95',
      '--pr',
      '158',
    ]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /D07_ONE_SHOT_RECONCILED/u);
    const stored = parseControlBlock(environment.readState().prBody, EPOCH_MARKER)
      .adversarial_preflight.d07_one_shot_disposition;
    assert.equal(stored.claimId, claimId);
    assert.equal(stored.state, 'INCONCLUSIVE');
    assert.equal(stored.retryAllowed, false);
    assert.equal(
      fs.existsSync(path.join(environment.directory, 'd07-run95-one-shot-claim.json')),
      false,
    );
  } finally {
    environment.cleanup();
  }
});

test('CLI terminalizes an uncertain local D07 claim without ever authorizing a retry', () => {
  const { run, epoch, claimId } = run95D07ClaimFixture();
  const claim = epoch.adversarial_preflight.d07_one_shot_disposition;
  delete epoch.adversarial_preflight.d07_one_shot_disposition;
  const environment = d07HarnessEnvironment(run, epoch, {
    repositoryLabels: {},
    d07ClaimId: claimId,
  });
  writeD07LocalClaimJournal(environment, claim);
  try {
    const result = environment.execute([
      'epoch:d07-one-shot-reconcile',
      '--run',
      '95',
      '--pr',
      '158',
    ]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /D07_ONE_SHOT_RECONCILED/u);
    assert.equal(
      fs.existsSync(path.join(environment.directory, 'd07-run95-one-shot-claim.json')),
      false,
    );
    assert.equal(
      environment.readState().repositoryLabels[d07OneShotLatchLabelName()].description,
      d07OneShotLatchLabelDescription(claimId),
    );
    const stored = parseControlBlock(environment.readState().prBody, EPOCH_MARKER)
      .adversarial_preflight.d07_one_shot_disposition;
    assert.equal(stored.state, 'INCONCLUSIVE');
    assert.equal(stored.retryAllowed, false);
    assert.equal(
      environment.readState().calls.some((call) => call.tool === 'codex'),
      false,
    );
    assert.equal(claimId, claim.claimId);
  } finally {
    environment.cleanup();
  }
});

test('CLI reconciles a durable CLAIMED R01 attempt without invoking Codex or authorizing retry', () => {
  const { run, epoch } = run95R01ClaimFixture();
  const environment = r01HarnessEnvironment(run, epoch);
  try {
    const result = environment.execute([
      'epoch:r01-one-shot-reconcile',
      '--run',
      '95',
      '--pr',
      '147',
    ]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /R01_ONE_SHOT_RECONCILED/u);
    const stored = parseControlBlock(environment.readState().prBody, EPOCH_MARKER)
      .adversarial_preflight.r01_one_shot_disposition;
    assert.equal(stored.state, 'INCONCLUSIVE');
    assert.equal(stored.reportWritten, false);
    assert.equal(stored.retryAllowed, false);
    assert.deepEqual(stored.reconciliation, {
      method: 'harness-r01-read-only-reconcile-v1',
      reportValidation: 'ABSENT',
      reconciledAt: stored.reconciliation.reconciledAt,
    });
    const state = environment.readState();
    assert.equal(
      state.repositoryLabels[r01OneShotTerminalLabelName()].description,
      r01OneShotTerminalLabelDescription('INCONCLUSIVE'),
    );
    assert.ok(
      state.calls.some(
        (call) =>
          call.tool === 'gh' &&
          call.args[0] === 'api' &&
          call.args[1] ===
            `repos/{owner}/{repo}/labels/${encodeURIComponent(r01OneShotLatchLabelName())}`,
      ),
      'reconciliation must read back the original create-once latch',
    );
    assert.ok(
      !state.calls.some(
        (call) => call.tool === 'codex' || call.args.some((arg) => String(arg).includes('codex')),
      ),
      'reconciliation must never invoke the model runner',
    );
  } finally {
    environment.cleanup();
  }
});

test('CLI reconciliation fails closed when the permanent R01 claim latch is missing', () => {
  const { run, epoch } = run95R01ClaimFixture();
  const environment = r01HarnessEnvironment(run, epoch, { repositoryLabels: {} });
  try {
    const result = environment.execute([
      'epoch:r01-one-shot-reconcile',
      '--run',
      '95',
      '--pr',
      '147',
    ]);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /^R01_ONESHOT_LATCH_MISSING:/u);
    const stored = parseControlBlock(environment.readState().prBody, EPOCH_MARKER)
      .adversarial_preflight.r01_one_shot_disposition;
    assert.equal(stored.state, 'CLAIMED');
    assert.equal(
      environment.readState().repositoryLabels[r01OneShotTerminalLabelName()],
      undefined,
    );
  } finally {
    environment.cleanup();
  }
});

test('CLI reconciles a durable G06 claim to terminal INCONCLUSIVE without invoking a query', () => {
  const { run, epoch } = run95G06ClaimFixture();
  const environment = g06HarnessEnvironment(run, epoch);
  try {
    const result = environment.execute([
      'epoch:g06-one-shot-reconcile',
      '--run',
      '95',
      '--pr',
      '170',
    ]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /G06_ONE_SHOT_RECONCILED/u);
    const stored = parseControlBlock(environment.readState().prBody, EPOCH_MARKER)
      .adversarial_preflight.g06_one_shot_disposition;
    assert.equal(stored.state, 'INCONCLUSIVE');
    assert.equal(stored.reportWritten, false);
    assert.equal(stored.retryAllowed, false);
    assert.deepEqual(stored.reconciliation, {
      terminalLatch: 'INCONCLUSIVE',
      reportValidation: 'ABSENT',
      reconciledAt: stored.reconciliation.reconciledAt,
    });
    assert.equal(
      parseControlBlock(environment.readState().prBody, EPOCH_MARKER).next_action,
      'AUTO_MERGE_AFTER_G06_RECONCILIATION',
    );
    assert.equal(
      parseControlBlock(environment.readState().runBody, RUN_MARKER).next_action,
      'MERGE_AFTER_G06_RECONCILIATION',
    );
    assert.equal(
      environment.readState().repositoryLabels[g06OneShotTerminalLabelName()].description,
      g06OneShotTerminalLabelDescription('INCONCLUSIVE'),
    );
    assert.equal(
      environment.readState().calls.some((call) => call.tool === 'codex'),
      false,
      'one-shot reconciliation must not run Codex',
    );
  } finally {
    environment.cleanup();
  }
});

test('CLI reconciliation re-reads an existing G06 INCONCLUSIVE latch with complete report metadata', () => {
  const { run, epoch } = run95G06ClaimFixture({ claimState: 'INCONCLUSIVE' });
  const disposition = epoch.adversarial_preflight.g06_one_shot_disposition;
  const environment = g06HarnessEnvironment(run, epoch, {
    repositoryLabels: {
      [g06OneShotLatchLabelName()]: {
        name: g06OneShotLatchLabelName(),
        color: 'b60205',
        description: g06OneShotLatchLabelDescription(disposition.receiptPublicKey),
      },
      [g06OneShotTerminalLabelName()]: {
        name: g06OneShotTerminalLabelName(),
        color: '6e7781',
        description: g06OneShotTerminalLabelDescription('INCONCLUSIVE'),
      },
    },
  });
  try {
    const result = environment.execute([
      'epoch:g06-one-shot-reconcile',
      '--run',
      '95',
      '--pr',
      '170',
    ]);
    assert.equal(result.status, 0, result.stderr);
    const stored = parseControlBlock(environment.readState().prBody, EPOCH_MARKER)
      .adversarial_preflight.g06_one_shot_disposition;
    assert.deepEqual(stored.reconciliation, {
      terminalLatch: 'INCONCLUSIVE',
      reportValidation: 'ABSENT',
      reconciledAt: stored.reconciliation.reconciledAt,
    });
    assert.equal(
      parseControlBlock(environment.readState().runBody, RUN_MARKER).next_action,
      'MERGE_AFTER_G06_RECONCILIATION',
    );
    assert.equal(
      environment.readState().calls.some((call) => call.tool === 'codex'),
      false,
      'reconciliation must not invoke Codex',
    );
  } finally {
    environment.cleanup();
  }
});

test('CLI reconciles and merges an exact validated G06 report as the sole untracked file', () => {
  const keyPair = createG06RunnerReceiptKeyPair();
  const { run, epoch } = run95G06ClaimFixture({
    receiptPublicKey: keyPair.receiptPublicKey,
  });
  const disposition = epoch.adversarial_preflight.g06_one_shot_disposition;
  const environment = g06HarnessEnvironment(run, epoch, {
    dirty: '?? docs/live-probes/g06-subject-cast-agent-mcp-run95.json',
  });
  const reportRoot = path.join(environment.directory, 'g06-report-root');
  try {
    const report = writeValidG06Report(reportRoot, disposition, keyPair);
    disposition.state = 'REPORT_WRITTEN';
    disposition.reportWritten = true;
    disposition.reportPath = 'docs/live-probes/g06-subject-cast-agent-mcp-run95.json';
    disposition.reportSha256 = report.reportSha256;
    const state = environment.readState();
    state.prBody = renderEpochBody(epoch);
    state.repositoryLabels = {
      [g06OneShotLatchLabelName()]: {
        name: g06OneShotLatchLabelName(),
        color: 'b60205',
        description: g06OneShotLatchLabelDescription(disposition.receiptPublicKey),
      },
      [g06OneShotTerminalLabelName()]: {
        name: g06OneShotTerminalLabelName(),
        color: '6e7781',
        description: g06OneShotTerminalLabelDescription('REPORT_WRITTEN', report.reportSha256),
      },
    };
    fs.writeFileSync(environment.statePath, `${JSON.stringify(state, null, 2)}\n`);

    const reportRootEnv = { HARNESS_G06_REPORT_ROOT: reportRoot };
    const reconciled = environment.execute(
      ['epoch:g06-one-shot-reconcile', '--run', '95', '--pr', '170'],
      reportRootEnv,
    );
    assert.equal(reconciled.status, 0, reconciled.stderr);
    const reconciledDisposition = parseControlBlock(environment.readState().prBody, EPOCH_MARKER)
      .adversarial_preflight.g06_one_shot_disposition;
    assert.equal(reconciledDisposition.reconciliation.reportValidation, 'VALID');
    assert.equal(reconciledDisposition.reconciliation.observedReportSha256, report.reportSha256);

    const unrelatedDirtyState = environment.readState();
    unrelatedDirtyState.dirty += '\n?? docs/live-probes/unrelated.json';
    fs.writeFileSync(environment.statePath, `${JSON.stringify(unrelatedDirtyState, null, 2)}\n`);
    const rejected = environment.execute(
      ['epoch:merge', '--run', '95', '--pr', '170'],
      reportRootEnv,
    );
    assert.equal(rejected.status, 2);
    assert.match(rejected.stderr, /^UNSAFE_DIRTY_WORKTREE:/u);
    assert.equal(environment.readState().prState, 'OPEN');

    const reportOnlyState = environment.readState();
    reportOnlyState.dirty = '?? docs/live-probes/g06-subject-cast-agent-mcp-run95.json';
    fs.writeFileSync(environment.statePath, `${JSON.stringify(reportOnlyState, null, 2)}\n`);
    const merged = environment.execute(
      ['epoch:merge', '--run', '95', '--pr', '170'],
      reportRootEnv,
    );
    assert.equal(merged.status, 0, merged.stderr);
    assert.equal(parseControlBlock(environment.readState().prBody, EPOCH_MARKER).state, 'MERGED');
  } finally {
    environment.cleanup();
  }
});

test('CLI refuses to merge a G06 Epoch before terminal one-shot reconciliation', () => {
  const { run, epoch } = run95G06ClaimFixture();
  const environment = g06HarnessEnvironment(run, epoch);
  try {
    const result = environment.execute(['epoch:merge', '--run', '95', '--pr', '170']);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /^G06_ONESHOT_RECONCILIATION_REQUIRED:/u);
    const state = environment.readState();
    assert.equal(state.prState, 'OPEN');
    assert.equal(
      state.calls.some(
        (call) => call.tool === 'gh' && call.args[0] === 'pr' && call.args[1] === 'merge',
      ),
      false,
    );
  } finally {
    environment.cleanup();
  }
});

test('CLI only merges G06 after the terminal latch and reconciliation marker agree', () => {
  const { run, epoch } = run95G06ClaimFixture({ claimState: 'INCONCLUSIVE' });
  const disposition = epoch.adversarial_preflight.g06_one_shot_disposition;
  disposition.reconciliation = {
    terminalLatch: 'INCONCLUSIVE',
    reportValidation: 'ABSENT',
    reconciledAt: '2026-10-13T00:00:01.000Z',
  };
  const claimName = g06OneShotLatchLabelName();
  const terminalName = g06OneShotTerminalLabelName();
  const environment = g06HarnessEnvironment(run, epoch, {
    repositoryLabels: {
      [claimName]: {
        name: claimName,
        color: 'b60205',
        description: g06OneShotLatchLabelDescription(disposition.receiptPublicKey),
      },
      [terminalName]: {
        name: terminalName,
        color: '6e7781',
        description: g06OneShotTerminalLabelDescription('INCONCLUSIVE'),
      },
    },
  });
  try {
    const result = environment.execute(['epoch:merge', '--run', '95', '--pr', '170']);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(parseControlBlock(environment.readState().prBody, EPOCH_MARKER).state, 'MERGED');
  } finally {
    environment.cleanup();
  }
});

test('CLI rejects a self-asserted G06 report without a validated sanitized artifact', () => {
  const { run, epoch } = run95G06ClaimFixture({ claimState: 'REPORT_WRITTEN' });
  const disposition = epoch.adversarial_preflight.g06_one_shot_disposition;
  disposition.reportSha256 = 'd'.repeat(64);
  disposition.reconciliation = {
    terminalLatch: 'REPORT_WRITTEN',
    reportValidation: 'VALID',
    observedReportSha256: disposition.reportSha256,
    reconciledAt: '2026-10-13T00:00:01.000Z',
  };
  const claimName = g06OneShotLatchLabelName();
  const terminalName = g06OneShotTerminalLabelName();
  const environment = g06HarnessEnvironment(run, epoch, {
    repositoryLabels: {
      [claimName]: {
        name: claimName,
        color: 'b60205',
        description: g06OneShotLatchLabelDescription(disposition.receiptPublicKey),
      },
      [terminalName]: {
        name: terminalName,
        color: '6e7781',
        description: g06OneShotTerminalLabelDescription('REPORT_WRITTEN', disposition.reportSha256),
      },
    },
  });
  try {
    const result = environment.execute(['epoch:merge', '--run', '95', '--pr', '170']);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /^G06_ONESHOT_REPORT_INVALID:/u);
    assert.equal(environment.readState().prState, 'OPEN');
  } finally {
    environment.cleanup();
  }
});

test('CLI G06 reconciliation fails closed when the permanent global claim latch is missing', () => {
  const { run, epoch } = run95G06ClaimFixture();
  const environment = g06HarnessEnvironment(run, epoch, { repositoryLabels: {} });
  try {
    const result = environment.execute([
      'epoch:g06-one-shot-reconcile',
      '--run',
      '95',
      '--pr',
      '170',
    ]);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /^G06_ONESHOT_LATCH_MISSING_OR_CONFLICTING:/u);
    const stored = parseControlBlock(environment.readState().prBody, EPOCH_MARKER)
      .adversarial_preflight.g06_one_shot_disposition;
    assert.equal(stored.state, 'CLAIMED');
    assert.equal(
      environment.readState().repositoryLabels[g06OneShotTerminalLabelName()],
      undefined,
    );
  } finally {
    environment.cleanup();
  }
});

test('CLI recovers a lost PR-body write from the immutable terminal latch without changing its result', () => {
  const { run, epoch } = run95R01ClaimFixture();
  const environment = r01HarnessEnvironment(run, epoch, {
    repositoryLabels: {
      [r01OneShotLatchLabelName()]: {
        name: r01OneShotLatchLabelName(),
        color: 'b60205',
        description: r01OneShotLatchLabelDescription(),
      },
      [r01OneShotTerminalLabelName()]: {
        name: r01OneShotTerminalLabelName(),
        color: '6e7781',
        description: r01OneShotTerminalLabelDescription('INCONCLUSIVE'),
      },
    },
  });
  try {
    const result = environment.execute([
      'epoch:r01-one-shot-reconcile',
      '--run',
      '95',
      '--pr',
      '147',
    ]);
    assert.equal(result.status, 0, result.stderr);
    const stored = parseControlBlock(environment.readState().prBody, EPOCH_MARKER)
      .adversarial_preflight.r01_one_shot_disposition;
    assert.equal(stored.state, 'INCONCLUSIVE');
    assert.equal(stored.retryAllowed, false);
    assert.equal(
      environment.readState().repositoryLabels[r01OneShotTerminalLabelName()].description,
      r01OneShotTerminalLabelDescription('INCONCLUSIVE'),
    );
  } finally {
    environment.cleanup();
  }
});

test('CLI reconciles an already-written sanitized R01 report by exact claim and digest', () => {
  const { run, epoch } = run95R01ClaimFixture();
  const environment = r01HarnessEnvironment(run, epoch);
  const reportPath = path.join(environment.directory, 'r01-sanitized-report.json');
  const disposition = epoch.adversarial_preflight.r01_one_shot_disposition;
  const serialized = `${JSON.stringify(
    {
      runNumber: 95,
      frontierId: 'R01',
      epochId: R01_EPOCH_ID,
      claimId: disposition.claimId,
      prNumber: 147,
      sourceRevision: disposition.sourceCandidateSha,
      baseSha: disposition.baseSha,
      reviewerId: disposition.reviewerId,
      mcpBundleSha256: disposition.bundleSha256,
      model: 'gpt-6-luna',
      reasoningEffort: 'max',
      codexErrorItemCount: 0,
      eventStreamParsed: true,
      resultStatus: 'SUCCESS',
    },
    null,
    2,
  )}\n`;
  fs.writeFileSync(reportPath, serialized, { mode: 0o600 });
  try {
    const priorMockState = process.env.HARNESS_MOCK_STATE;
    const priorReportPath = process.env.HARNESS_R01_REPORT_PATH;
    process.env.HARNESS_MOCK_STATE = 'report-validator-fixture';
    process.env.HARNESS_R01_REPORT_PATH = reportPath;
    let validation;
    try {
      validation = validateR01SanitizedReportFile(disposition, process.cwd());
    } finally {
      if (priorMockState === undefined) delete process.env.HARNESS_MOCK_STATE;
      else process.env.HARNESS_MOCK_STATE = priorMockState;
      if (priorReportPath === undefined) delete process.env.HARNESS_R01_REPORT_PATH;
      else process.env.HARNESS_R01_REPORT_PATH = priorReportPath;
    }
    assert.equal(validation.passed, true, validation.reason);
    const result = environment.execute(
      ['epoch:r01-one-shot-reconcile', '--run', '95', '--pr', '147'],
      { HARNESS_R01_REPORT_PATH: reportPath },
    );
    assert.equal(result.status, 0, result.stderr);
    const stored = parseControlBlock(environment.readState().prBody, EPOCH_MARKER)
      .adversarial_preflight.r01_one_shot_disposition;
    const digest = createHash('sha256').update(serialized).digest('hex');
    assert.equal(stored.state, 'REPORT_WRITTEN', JSON.stringify(stored));
    assert.equal(stored.reportWritten, true);
    assert.equal(stored.retryAllowed, false);
    assert.equal(
      stored.reportPath,
      'docs/live-probes/pariya-agent-codex-luna-e2e-R01-relations.json',
    );
    assert.equal(stored.reportSha256, digest);
    assert.equal(stored.reconciliation.reportValidation, 'VALID');
    assert.equal(
      environment.readState().repositoryLabels[r01OneShotTerminalLabelName()].description,
      r01OneShotTerminalLabelDescription('REPORT_WRITTEN', digest),
    );
  } finally {
    environment.cleanup();
  }
});

test('CLI terminalizes an invalid claim-bound R01 report as unaccepted and non-retryable', () => {
  const { run, epoch } = run95R01ClaimFixture();
  const environment = r01HarnessEnvironment(run, epoch);
  const reportPath = path.join(environment.directory, 'r01-invalid-report.json');
  const disposition = epoch.adversarial_preflight.r01_one_shot_disposition;
  const serialized = `${JSON.stringify(
    {
      runNumber: 95,
      frontierId: 'R01',
      epochId: R01_EPOCH_ID,
      claimId: disposition.claimId,
      prNumber: 147,
      sourceRevision: disposition.sourceCandidateSha,
      baseSha: disposition.baseSha,
      reviewerId: disposition.reviewerId,
      mcpBundleSha256: disposition.bundleSha256,
      model: 'gpt-6-luna',
      reasoningEffort: 'max',
      codexErrorItemCount: 1,
      eventStreamParsed: true,
      resultStatus: 'SUCCESS',
    },
    null,
    2,
  )}\n`;
  fs.writeFileSync(reportPath, serialized, { mode: 0o600 });
  try {
    const result = environment.execute(
      ['epoch:r01-one-shot-reconcile', '--run', '95', '--pr', '147'],
      { HARNESS_R01_REPORT_PATH: reportPath },
    );
    assert.equal(result.status, 0, result.stderr);
    const stored = parseControlBlock(environment.readState().prBody, EPOCH_MARKER)
      .adversarial_preflight.r01_one_shot_disposition;
    const digest = createHash('sha256').update(serialized).digest('hex');
    assert.equal(stored.state, 'INCONCLUSIVE');
    assert.equal(stored.reportWritten, false);
    assert.equal(stored.retryAllowed, false);
    assert.equal(stored.reconciliation.reportValidation, 'INVALID');
    assert.equal(stored.reconciliation.observedReportSha256, digest);
    assert.equal(
      environment.readState().repositoryLabels[r01OneShotTerminalLabelName()].description,
      r01OneShotTerminalLabelDescription('INCONCLUSIVE', digest),
    );
  } finally {
    environment.cleanup();
  }
});

test('CLI P05 claim is repository-global and read back from the active PR before query authority', () => {
  const { run, epoch, candidateSha, baseSha, reviewerId, branch } = run95P05ClaimFixture();
  const common = {
    runIssueNumber: 95,
    runIssueTitle: 'Run 95 P05 claim fixture',
    runBody: renderRunBody(run),
    prBody: renderEpochBody(epoch),
    branch,
    featureBranch: branch,
    featureHeadSha: candidateSha,
    baseSha,
    prState: 'OPEN',
    draft: false,
    checks: mandatoryChecks.map((name) => ({
      name,
      status: 'COMPLETED',
      conclusion: 'SUCCESS',
    })),
  };
  const firstClone = createMockEnvironment(common);
  const claimArgs = [
    'epoch:p05-one-shot-claim',
    '--run',
    '95',
    '--pr',
    '166',
    '--candidate',
    candidateSha,
    '--base',
    baseSha,
    '--reviewer-id',
    reviewerId,
  ];
  try {
    const acquired = firstClone.execute(claimArgs);
    assert.equal(acquired.status, 0, acquired.stderr);
    const acquiredResult = JSON.parse(acquired.stdout);
    assert.equal(acquiredResult.state, 'P05_ONE_SHOT_CLAIMED');
    assert.equal(acquiredResult.globalLatch, P05_ONE_SHOT_LATCH_LABEL_NAME);
    assert.equal(acquiredResult.expectedArgumentsSha256, P05_ARGUMENTS_SHA256);

    const firstState = firstClone.readState();
    const disposition = parseControlBlock(firstState.prBody, EPOCH_MARKER).adversarial_preflight
      .p05_one_shot_disposition;
    assert.equal(disposition.claimId, acquiredResult.claimId);
    assert.equal(disposition.frontierId, 'P05');
    assert.equal(disposition.epochId, P05_EPOCH_ID);
    assert.equal(disposition.state, 'CLAIMED');
    assert.equal(disposition.sourceCandidateSha, candidateSha);
    assert.equal(disposition.baseSha, baseSha);
    assert.equal(disposition.reviewerId, reviewerId);
    assert.equal(disposition.retryAllowed, false);
    assert.deepEqual(disposition.globalLatch, {
      name: P05_ONE_SHOT_LATCH_LABEL_NAME,
      description: P05_ONE_SHOT_LATCH_LABEL_DESCRIPTION,
    });
    assert.deepEqual(firstState.repositoryLabels[P05_ONE_SHOT_LATCH_LABEL_NAME], {
      name: P05_ONE_SHOT_LATCH_LABEL_NAME,
      color: 'b60205',
      description: P05_ONE_SHOT_LATCH_LABEL_DESCRIPTION,
    });

    const terminal = firstClone.execute([
      'epoch:p05-one-shot-result',
      '--run',
      '95',
      '--pr',
      '166',
      '--claim-id',
      acquiredResult.claimId,
      '--state',
      'INCONCLUSIVE',
    ]);
    assert.equal(terminal.status, 0, terminal.stderr);
    const terminalDisposition = parseControlBlock(firstClone.readState().prBody, EPOCH_MARKER)
      .adversarial_preflight.p05_one_shot_disposition;
    assert.equal(terminalDisposition.state, 'INCONCLUSIVE');
    assert.equal(terminalDisposition.reportWritten, false);
    assert.equal(terminalDisposition.retryAllowed, false);

    const staleSecondClone = createMockEnvironment({
      ...common,
      repositoryLabels: firstClone.readState().repositoryLabels,
    });
    try {
      const refused = staleSecondClone.execute(claimArgs);
      assert.equal(refused.status, 2);
      assert.match(refused.stderr, /^P05_ONESHOT_ALREADY_CLAIMED:/u);
      const secondState = staleSecondClone.readState();
      assert.equal(
        parseControlBlock(secondState.prBody, EPOCH_MARKER).adversarial_preflight
          .p05_one_shot_disposition,
        undefined,
        'a clone that loses the global latch must not write a PR claim',
      );
      assert.equal(
        secondState.calls.some(
          ({ args }) => args[0] === 'api' && args[1] === 'repos/{owner}/{repo}/pulls/166',
        ),
        false,
        'a clone that loses the global latch must not patch the active PR',
      );
    } finally {
      staleSecondClone.cleanup();
    }
  } finally {
    firstClone.cleanup();
  }
});

test('CLI refuses P05 integration until the global one-shot claim has a terminal result', () => {
  const { run, epoch, candidateSha, baseSha, branch } = run95P05ClaimFixture();
  const environment = createMockEnvironment({
    runIssueNumber: 95,
    runIssueTitle: 'Run 95 P05 merge-gate fixture',
    runBody: renderRunBody(run),
    prBody: renderEpochBody(epoch),
    branch,
    featureBranch: branch,
    featureHeadSha: candidateSha,
    baseSha,
    prState: 'OPEN',
    draft: false,
  });
  try {
    const result = environment.execute(['epoch:merge', '--run', '95', '--pr', '166']);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /^P05_ONESHOT_RECONCILIATION_REQUIRED:/u);
    assert.equal(environment.readState().prState, 'OPEN');
    assert.equal(
      environment.readState().calls.some(({ args }) => args[0] === 'pr' && args[1] === 'merge'),
      false,
    );
  } finally {
    environment.cleanup();
  }
});

test('CLI merges P05 only after terminal claim and repository latch agree', () => {
  const { run, epoch, candidateSha, baseSha, reviewerId, branch } = run95P05ClaimFixture();
  const claimId = 'p05-run-95-pr-166-bbbbbbbbbbbb-terminal';
  epoch.adversarial_preflight.p05_one_shot_disposition = {
    schemaVersion: 1,
    claimId,
    frontierId: 'P05',
    epochId: P05_EPOCH_ID,
    runNumber: 95,
    toolName: P05_TOOL_NAME,
    argumentProfile: P05_ARGUMENT_PROFILE,
    expectedArgumentsSha256: P05_ARGUMENTS_SHA256,
    state: 'INCONCLUSIVE',
    resultState: 'INCONCLUSIVE',
    sourceCandidateSha: candidateSha,
    baseSha,
    ciSha: candidateSha,
    ciStatus: 'SUCCESS',
    prNumber: 166,
    reviewerId,
    globalLatch: {
      name: P05_ONE_SHOT_LATCH_LABEL_NAME,
      description: P05_ONE_SHOT_LATCH_LABEL_DESCRIPTION,
    },
    reportWritten: false,
    retryAllowed: false,
    finishedAt: '2026-10-15T00:00:00.000Z',
  };
  const environment = createMockEnvironment({
    runIssueNumber: 95,
    runIssueTitle: 'Run 95 P05 merge-gate fixture',
    runBody: renderRunBody(run),
    prBody: renderEpochBody(epoch),
    branch,
    featureBranch: branch,
    featureHeadSha: candidateSha,
    baseSha,
    prState: 'OPEN',
    draft: false,
    repositoryLabels: {
      [P05_ONE_SHOT_LATCH_LABEL_NAME]: {
        name: P05_ONE_SHOT_LATCH_LABEL_NAME,
        color: 'b60205',
        description: P05_ONE_SHOT_LATCH_LABEL_DESCRIPTION,
      },
    },
  });
  try {
    const result = environment.execute(['epoch:merge', '--run', '95', '--pr', '166']);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(parseControlBlock(environment.readState().prBody, EPOCH_MARKER).state, 'MERGED');
  } finally {
    environment.cleanup();
  }
});

test('CLI G19 one-shot claim and terminal result persist in the durable Epoch control body', () => {
  const { run, epoch } = passedCandidateFixture();
  const reviewerId = 'gpt-6-luna-max-run95-pr42-round1';
  run.state = 'EPOCH_ACTIVE';
  run.profile = 'AUTONOMOUS_EVOLUTION';
  run.active_epoch_pr = 42;
  run.pending_epoch = null;
  epoch.epoch_id = 'run95-g19-person-origin-agent-mcp-evidence';
  epoch.pr_number = 42;
  epoch.branch = 'codex/epoch-cli';
  epoch.base_branch = 'master';
  epoch.base_sha = sha('a');
  epoch.candidate_sha = sha('b');
  epoch.reviewed_base_sha = sha('a');
  epoch.review_pass_sha = sha('b');
  epoch.advances_frontier_ids = ['G19'];
  epoch.ci = { sha: sha('b'), status: 'SUCCESS', url: 'https://example.test/ci' };
  epoch.scope_closure = {
    why_not_review_earlier: 'The one-shot gates are complete.',
    why_not_extend_further: 'The bounded read is the only query in this Epoch.',
    related_work_remaining: false,
  };
  epoch.adversarial_preflight = {
    completed: true,
    summary: 'Exact one-tool read-only preflight passed.',
  };
  epoch.review_history = [
    {
      review_number: 1,
      reviewer_id: reviewerId,
      candidate_sha: sha('b'),
      reviewed_base_sha: sha('a'),
      verdict: 'PASS',
      findings: [],
    },
  ];
  const environment = createMockEnvironment({
    runBody: renderRunBody(run),
    prBody: renderEpochBody(epoch),
    branch: epoch.branch,
    featureBranch: epoch.branch,
    featureHeadSha: sha('b'),
    baseSha: sha('a'),
    draft: false,
  });
  const claimArgs = [
    'epoch:g19-one-shot-claim',
    '--run',
    '1',
    '--pr',
    '42',
    '--candidate',
    sha('b'),
    '--base',
    sha('a'),
    '--reviewer-id',
    reviewerId,
  ];
  try {
    const before = parseControlBlock(environment.readState().runBody, RUN_MARKER).outer_sol.product
      .consumed;
    const claimed = environment.execute(claimArgs);
    assert.equal(claimed.status, 0, claimed.stderr);
    const claim = JSON.parse(claimed.stdout);
    assert.equal(claim.state, 'G19_ONE_SHOT_CLAIMED');
    let stored = parseControlBlock(environment.readState().prBody, EPOCH_MARKER);
    assert.equal(stored.adversarial_preflight.g19_one_shot_disposition.state, 'CLAIMED');

    const duplicateClaim = environment.execute(claimArgs);
    assert.equal(duplicateClaim.status, 2);
    assert.match(duplicateClaim.stderr, /^G19_ONESHOT_ALREADY_CLAIMED:/u);

    const resultArgs = [
      'epoch:g19-one-shot-result',
      '--run',
      '1',
      '--pr',
      '42',
      '--claim-id',
      claim.claimId,
      '--state',
      'INCONCLUSIVE',
    ];
    const finished = environment.execute(resultArgs);
    assert.equal(finished.status, 0, finished.stderr);
    stored = parseControlBlock(environment.readState().prBody, EPOCH_MARKER);
    assert.deepEqual(
      {
        state: stored.adversarial_preflight.g19_one_shot_disposition.state,
        reportWritten: stored.adversarial_preflight.g19_one_shot_disposition.reportWritten,
        retryAllowed: stored.adversarial_preflight.g19_one_shot_disposition.retryAllowed,
      },
      { state: 'INCONCLUSIVE', reportWritten: false, retryAllowed: false },
    );

    const retry = environment.execute(claimArgs);
    assert.equal(retry.status, 2);
    assert.match(retry.stderr, /^G19_ONESHOT_ALREADY_CLAIMED:/u);
    const idempotentFinish = environment.execute(resultArgs);
    assert.equal(idempotentFinish.status, 0, idempotentFinish.stderr);
    assert.match(idempotentFinish.stdout, /G19_ONE_SHOT_RESULT_ALREADY_RECORDED/u);
    const after = parseControlBlock(environment.readState().runBody, RUN_MARKER).outer_sol.product
      .consumed;
    assert.equal(after, before, 'one-shot state persistence must not spend Product budget');
  } finally {
    environment.cleanup();
  }
});

test('CLI keeps one-shot claim and result mutations private to Harness-owned runners', () => {
  const environment = createMockEnvironment();
  const before = environment.readState();
  try {
    const privateCommands = [
      ['epoch:g04-one-shot-claim', '--run', '95', '--pr', '136'],
      [
        'epoch:g04-one-shot-result',
        '--run',
        '95',
        '--pr',
        '136',
        '--claim-id',
        'caller-forged',
        '--state',
        'REPORT_WRITTEN',
      ],
      ['epoch:g16-one-shot-claim', '--run', '95', '--pr', '136'],
      [
        'epoch:g16-one-shot-result',
        '--run',
        '95',
        '--pr',
        '136',
        '--claim-id',
        'caller-forged',
        '--state',
        'REPORT_WRITTEN',
      ],
    ];
    for (const args of privateCommands) {
      const result = environment.execute(args);
      assert.equal(result.status, 2, result.stderr);
      assert.match(result.stderr, /^UNKNOWN_COMMAND: Unknown command:/u);
      assert.deepEqual(
        environment.readState(),
        before,
        'private one-shot mutations must not change durable Harness state',
      );
    }
  } finally {
    environment.cleanup();
  }
});

test('CLI globally reconciles a prior G04 terminal claim without invoking Codex or retrying', () => {
  const environment = createMockEnvironment(g04LegacyReconciliationFixture());
  const args = [
    'epoch:g04-legacy-claim-reconcile',
    '--run',
    '95',
    '--pr',
    '139',
    '--source-pr',
    '136',
  ];
  try {
    const result = environment.execute(args);
    assert.equal(result.status, 0, result.stderr);
    const output = JSON.parse(result.stdout);
    assert.deepEqual(
      {
        state: output.state,
        source_pr: output.source_pr,
        active_pr: output.active_pr,
        query_invoked: output.query_invoked,
        report_written: output.report_written,
        retry_allowed: output.retry_allowed,
      },
      {
        state: 'G04_LEGACY_CLAIM_RECONCILED',
        source_pr: 136,
        active_pr: 139,
        query_invoked: false,
        report_written: false,
        retry_allowed: false,
      },
    );
    let stored = environment.readState();
    const epoch = parseControlBlock(stored.prs['139'].body, EPOCH_MARKER);
    const run = parseControlBlock(stored.runBody, RUN_MARKER);
    const reconciliation = epoch.adversarial_preflight.g04_legacy_claim_reconciliation;
    assert.deepEqual(
      {
        state: reconciliation.state,
        sourceClaimState: reconciliation.sourceClaim.state,
        sourceClaimPr: reconciliation.sourceClaim.prNumber,
        currentCandidate: reconciliation.reconciledAgainst.candidateSha,
        queryInvoked: reconciliation.queryInvoked,
        reportWritten: reconciliation.reportWritten,
        retryAllowed: reconciliation.retryAllowed,
      },
      {
        state: 'LEGACY_TERMINAL_RECONCILED',
        sourceClaimState: 'INCONCLUSIVE',
        sourceClaimPr: 136,
        currentCandidate: sha('b'),
        queryInvoked: false,
        reportWritten: false,
        retryAllowed: false,
      },
    );
    assert.deepEqual(run.g04_one_shot_legacy_reconciliation, reconciliation);
    const latch = stored.repositoryLabels?.['harness-r95-g04-person-activity-claimed'];
    assert.equal(latch?.description, reconciliation.globalLatch.description);
    assert.equal(
      stored.calls.filter(
        (call) =>
          call.tool === 'gh' &&
          call.args.includes('repos/{owner}/{repo}/labels') &&
          call.args.includes('--method'),
      ).length,
      1,
      'the repo-wide create-only latch is acquired once',
    );
    assert.equal(
      stored.calls.some((call) => call.tool === 'codex'),
      false,
      'legacy reconciliation never invokes the query runner',
    );

    const repeated = environment.execute(args);
    assert.equal(repeated.status, 0, repeated.stderr);
    assert.match(repeated.stdout, /G04_LEGACY_RECONCILIATION_ALREADY_RECORDED/u);
    stored = environment.readState();
    assert.equal(
      stored.calls.filter(
        (call) =>
          call.tool === 'gh' &&
          call.args.includes('repos/{owner}/{repo}/labels') &&
          call.args.includes('--method'),
      ).length,
      1,
      'idempotent reconciliation does not recreate the permanent latch',
    );
  } finally {
    environment.cleanup();
  }
});

test('CLI rejects a nonterminal or retryable legacy G04 source before creating any latch', () => {
  const environment = createMockEnvironment(
    g04LegacyReconciliationFixture({ dispositionOverrides: { retryAllowed: true } }),
  );
  try {
    const before = environment.readState();
    const result = environment.execute([
      'epoch:g04-legacy-claim-reconcile',
      '--run',
      '95',
      '--pr',
      '139',
      '--source-pr',
      '136',
    ]);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /^G04_LEGACY_CLAIM_INVALID:/u);
    const after = environment.readState();
    assert.deepEqual(after.repositoryLabels ?? {}, {});
    assert.equal(after.prs['139'].body, before.prs['139'].body);
    assert.equal(after.runBody, before.runBody);
  } finally {
    environment.cleanup();
  }
});

test('CLI rejects a wrong-run G16 one-shot before touching Harness state', () => {
  const environment = createMockEnvironment();
  const before = environment.readState();
  try {
    const result = environment.execute(['epoch:g16-one-shot-run', '--run', '1']);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /^G16_ONESHOT_RUN_INVALID:/u);
    const after = environment.readState();
    assert.equal(after.runBody, before.runBody);
    assert.equal(after.prBody, before.prBody);
    assert.equal(
      parseControlBlock(after.runBody, RUN_MARKER).outer_sol.product.consumed,
      parseControlBlock(before.runBody, RUN_MARKER).outer_sol.product.consumed,
    );
  } finally {
    environment.cleanup();
  }
});

test('CLI rejects caller-key P01 claims and fabricated all-true REPORT_WRITTEN evidence', () => {
  const { run, epoch } = passedCandidateFixture();
  const reviewerId = 'gpt-6-luna-max-run95-pr42-round1';
  run.state = 'EPOCH_ACTIVE';
  run.profile = 'AUTONOMOUS_EVOLUTION';
  run.active_epoch_pr = 42;
  run.pending_epoch = null;
  epoch.epoch_id = 'run95-p01-person-role-agent-mcp';
  epoch.pr_number = 42;
  epoch.branch = 'codex/epoch-cli';
  epoch.base_branch = 'master';
  epoch.base_sha = sha('a');
  epoch.candidate_sha = sha('b');
  epoch.reviewed_base_sha = sha('a');
  epoch.review_pass_sha = sha('b');
  epoch.advances_frontier_ids = ['P01'];
  epoch.ci = { sha: sha('b'), status: 'SUCCESS', url: 'https://example.test/ci' };
  epoch.scope_closure = {
    why_not_review_earlier: 'The P01 exact Candidate gates are complete.',
    why_not_extend_further: 'The bounded public role sample is one-shot.',
    related_work_remaining: false,
  };
  epoch.adversarial_preflight = {
    completed: true,
    summary: 'P01 exact one-tool preflight passed.',
  };
  epoch.review_history = [
    {
      review_number: 1,
      reviewer_id: reviewerId,
      candidate_sha: sha('b'),
      reviewed_base_sha: sha('a'),
      verdict: 'PASS',
      findings: [],
    },
  ];
  const environment = createMockEnvironment({
    runBody: renderRunBody(run),
    prBody: renderEpochBody(epoch),
    branch: epoch.branch,
    featureBranch: epoch.branch,
    featureHeadSha: sha('b'),
    baseSha: sha('a'),
    draft: false,
  });
  const runnerReceiptKeyPair = generateP01RunnerReceiptKeyPair();
  const callerClaimArgs = [
    'epoch:p01-one-shot-claim',
    '--run',
    '95',
    '--pr',
    '42',
    '--candidate',
    sha('b'),
    '--base',
    sha('a'),
    '--bundle-sha256',
    'c'.repeat(64),
    '--model',
    'gpt-6-luna',
    '--reasoning-effort',
    'max',
    '--reviewer-id',
    reviewerId,
    '--runner-receipt-public-key',
    runnerReceiptKeyPair.publicKeyBase64,
  ];
  try {
    const before = parseControlBlock(environment.readState().runBody, RUN_MARKER).outer_sol.product
      .consumed;
    const wrongRun = environment.execute(['epoch:p01-one-shot-run', '--run', '1']);
    assert.equal(wrongRun.status, 2);
    assert.match(wrongRun.stderr, /^P01_ONESHOT_RUN_INVALID:/u);
    const callerClaim = environment.execute(callerClaimArgs);
    assert.notEqual(
      callerClaim.status,
      0,
      'the public CLI must not accept caller-selected claim keys',
    );
    assert.equal(
      Object.hasOwn(
        parseControlBlock(environment.readState().prBody, EPOCH_MARKER).adversarial_preflight,
        'p01_one_shot_disposition',
      ),
      false,
    );
    const fabricatedClaimId = `p01-run-95-pr-42-${sha('b').slice(0, 12)}-123`;
    const fabricated = makeP01Report({
      claimId: fabricatedClaimId,
      runnerReceiptKeyPair,
      prNumber: 42,
      reviewerId,
    });
    assert.ok(Object.values(fabricated.answerChecks).every((check) => check === true));
    const reportPath = path.join(environment.directory, 'caller-fabricated-p01-report.json');
    fs.writeFileSync(reportPath, `${JSON.stringify(fabricated)}\n`);
    const result = environment.execute(
      [
        'epoch:p01-one-shot-result',
        '--run',
        '95',
        '--pr',
        '42',
        '--claim-id',
        fabricatedClaimId,
        '--state',
        'REPORT_WRITTEN',
      ],
      { HARNESS_P01_REPORT_PATH: reportPath },
    );
    assert.equal(result.status, 2);
    assert.match(result.stderr, /^P01_ONESHOT_CLAIM_MISMATCH:/u);
    assert.equal(
      Object.hasOwn(
        parseControlBlock(environment.readState().prBody, EPOCH_MARKER).adversarial_preflight,
        'p01_one_shot_disposition',
      ),
      false,
      'caller-controlled receipt keys cannot create a durable Harness trust anchor',
    );
    const after = parseControlBlock(environment.readState().runBody, RUN_MARKER).outer_sol.product
      .consumed;
    assert.equal(after, before, 'one-shot state persistence must not spend Product budget');
  } finally {
    environment.cleanup();
  }
});

test('CLI P01 REPORT_WRITTEN requires a matching validated sanitized report', () => {
  const { run, epoch } = passedCandidateFixture();
  const reviewerId = 'gpt-6-luna-max-run95-pr42-round1';
  run.state = 'EPOCH_ACTIVE';
  run.profile = 'AUTONOMOUS_EVOLUTION';
  run.active_epoch_pr = 42;
  run.pending_epoch = null;
  epoch.epoch_id = 'run95-p01-person-role-agent-mcp';
  epoch.pr_number = 42;
  epoch.branch = 'codex/epoch-cli';
  epoch.base_branch = 'master';
  epoch.base_sha = sha('a');
  epoch.candidate_sha = sha('b');
  epoch.reviewed_base_sha = sha('a');
  epoch.review_pass_sha = sha('b');
  epoch.advances_frontier_ids = ['P01'];
  epoch.ci = { sha: sha('b'), status: 'SUCCESS', url: 'https://example.test/ci' };
  epoch.scope_closure = {
    why_not_review_earlier: 'The P01 exact Candidate gates are complete.',
    why_not_extend_further: 'The bounded public role sample is one-shot.',
    related_work_remaining: false,
  };
  const runnerReceiptKeyPair = generateP01RunnerReceiptKeyPair();
  const claimId = `p01-run-95-pr-42-${sha('b').slice(0, 12)}-123`;
  epoch.adversarial_preflight = {
    completed: true,
    summary: 'P01 exact one-tool preflight passed.',
    p01_one_shot_disposition: {
      claimId,
      frontierId: 'P01',
      epochId: 'run95-p01-person-role-agent-mcp',
      runNumber: 95,
      toolName: 'bangumi.get_person_activity',
      argumentProfile: P01_ARGUMENT_PROFILE,
      expectedArgumentsSha256: canonicalHash(P01_EXPECTED_QUERY_ARGUMENTS),
      state: 'CLAIMED',
      sourceCandidateSha: sha('b'),
      baseSha: sha('a'),
      ciSha: sha('b'),
      ciStatus: 'SUCCESS',
      bundleSha256: 'c'.repeat(64),
      prNumber: 42,
      reviewerId,
      model: 'gpt-6-luna',
      reasoningEffort: 'max',
      runnerReceiptPublicKey: runnerReceiptKeyPair.publicKeyBase64,
      runnerReceiptPublicKeySha256: p01RunnerPublicKeySha256(runnerReceiptKeyPair.publicKeyBase64),
      reportWritten: false,
      retryAllowed: false,
      claimedAt: '2026-10-11T08:00:00.000Z',
    },
  };
  epoch.review_history = [
    {
      review_number: 1,
      reviewer_id: reviewerId,
      candidate_sha: sha('b'),
      reviewed_base_sha: sha('a'),
      verdict: 'PASS',
      findings: [],
    },
  ];
  const environment = createMockEnvironment({
    runBody: renderRunBody(run),
    prBody: renderEpochBody(epoch),
    branch: epoch.branch,
    featureBranch: epoch.branch,
    featureHeadSha: sha('b'),
    baseSha: sha('a'),
    draft: false,
  });
  const reportPath = path.join(environment.directory, 'p01-report.json');
  try {
    const claim = { claimId };
    const resultArgs = [
      'epoch:p01-one-shot-result',
      '--run',
      '95',
      '--pr',
      '42',
      '--claim-id',
      claim.claimId,
      '--state',
      'REPORT_WRITTEN',
    ];
    const resultEnv = { HARNESS_P01_REPORT_PATH: reportPath };
    const claimedState = environment.readState();
    const driftedState = structuredClone(claimedState);
    const driftedEpoch = parseControlBlock(driftedState.prBody, EPOCH_MARKER);
    driftedEpoch.candidate_sha = sha('d');
    driftedState.prBody = renderEpochBody(driftedEpoch);
    fs.writeFileSync(environment.statePath, `${JSON.stringify(driftedState, null, 2)}\n`);
    const staleCandidate = environment.execute(resultArgs, resultEnv);
    assert.equal(staleCandidate.status, 2);
    assert.match(staleCandidate.stderr, /^P01_ONESHOT_REPORT_STALE:/u);
    fs.writeFileSync(environment.statePath, `${JSON.stringify(claimedState, null, 2)}\n`);

    const missing = environment.execute(resultArgs, resultEnv);
    assert.equal(missing.status, 2);
    assert.match(missing.stderr, /^P01_ONESHOT_REPORT_INVALID:/u);

    const fabricated = makeP01Report({
      claimId: claim.claimId,
      runnerReceiptKeyPair,
      prNumber: 42,
      reviewerId,
    });
    delete fabricated.runnerReceipt;
    fs.writeFileSync(reportPath, `${JSON.stringify(fabricated, null, 2)}\n`);
    const fabricatedAllTrue = environment.execute(resultArgs, resultEnv);
    assert.equal(fabricatedAllTrue.status, 2);
    assert.match(fabricatedAllTrue.stderr, /^P01_ONESHOT_REPORT_INVALID:/u);
    assert.equal(
      parseControlBlock(environment.readState().prBody, EPOCH_MARKER).adversarial_preflight
        .p01_one_shot_disposition.state,
      'CLAIMED',
      'self-asserted all-true answer fields without a runner receipt must not terminalize the claim',
    );

    fs.writeFileSync(reportPath, '{ invalid json');
    const malformed = environment.execute(resultArgs, resultEnv);
    assert.equal(malformed.status, 2);
    assert.match(malformed.stderr, /^P01_ONESHOT_REPORT_INVALID:/u);

    const mismatched = makeP01Report({
      baseSha: sha('f'),
      claimId: claim.claimId,
      runnerReceiptKeyPair,
      prNumber: 42,
      reviewerId,
    });
    fs.writeFileSync(reportPath, `${JSON.stringify(mismatched, null, 2)}\n`);
    const wrongBase = environment.execute(resultArgs, resultEnv);
    assert.equal(wrongBase.status, 2);
    assert.match(wrongBase.stderr, /^P01_ONESHOT_REPORT_INVALID:/u);

    const failedCheck = makeP01Report({
      claimId: claim.claimId,
      runnerReceiptKeyPair,
      prNumber: 42,
      reviewerId,
    });
    failedCheck.answerChecks.answerRowsMatch = false;
    fs.writeFileSync(reportPath, `${JSON.stringify(failedCheck, null, 2)}\n`);
    const invalidChecks = environment.execute(resultArgs, resultEnv);
    assert.equal(invalidChecks.status, 2);
    assert.match(invalidChecks.stderr, /^P01_ONESHOT_REPORT_INVALID:/u);
    assert.equal(
      parseControlBlock(environment.readState().prBody, EPOCH_MARKER).adversarial_preflight
        .p01_one_shot_disposition.state,
      'CLAIMED',
      'invalid report attempts must not make the durable one-shot terminal',
    );

    const report = makeP01Report({
      claimId: claim.claimId,
      runnerReceiptKeyPair,
      prNumber: 42,
      reviewerId,
    });
    const serialized = `${JSON.stringify(report, null, 2)}\n`;
    fs.writeFileSync(reportPath, serialized);
    const finished = environment.execute(resultArgs, resultEnv);
    assert.equal(finished.status, 0, finished.stderr);
    let stored = parseControlBlock(environment.readState().prBody, EPOCH_MARKER)
      .adversarial_preflight.p01_one_shot_disposition;
    assert.deepEqual(
      {
        state: stored.state,
        reportWritten: stored.reportWritten,
        retryAllowed: stored.retryAllowed,
        reportPath: stored.reportPath,
        reportSha256: stored.reportSha256,
      },
      {
        state: 'REPORT_WRITTEN',
        reportWritten: true,
        retryAllowed: false,
        reportPath: 'docs/live-probes/p01-person-position-agent-mcp-run95.json',
        reportSha256: createHash('sha256').update(serialized).digest('hex'),
      },
    );

    const idempotent = environment.execute(resultArgs, resultEnv);
    assert.equal(idempotent.status, 0, idempotent.stderr);
    assert.match(idempotent.stdout, /P01_ONE_SHOT_RESULT_ALREADY_RECORDED/u);

    report.answerChecks.answerRowsMatch = false;
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    const tampered = environment.execute(resultArgs, resultEnv);
    assert.equal(tampered.status, 2);
    assert.match(tampered.stderr, /^P01_ONESHOT_REPORT_INVALID:/u);
    stored = parseControlBlock(environment.readState().prBody, EPOCH_MARKER).adversarial_preflight
      .p01_one_shot_disposition;
    assert.equal(stored.state, 'REPORT_WRITTEN');
    assert.equal(stored.reportSha256, createHash('sha256').update(serialized).digest('hex'));
  } finally {
    environment.cleanup();
  }
});

test('CLI Candidate gate revokes prior PASS authority for an audited post-PASS evidence commit', () => {
  const { run, epoch } = passedCandidateFixture();
  const environment = createMockEnvironment({
    runBody: renderRunBody(run),
    prBody: renderEpochBody(epoch),
    featureHeadSha: sha('d'),
    draft: false,
  });
  try {
    const result = environment.execute([
      'candidate:check',
      '--pr',
      '42',
      '--evidence',
      candidateEvidence(environment, {
        candidate_sha: sha('d'),
        candidate_refresh_reason:
          'Attach the sanitized one-shot result and update its frontier evidence.',
      }),
    ]);
    assert.equal(result.status, 0, result.stderr);
    const stored = parseControlBlock(environment.readState().prBody, EPOCH_MARKER);
    assert.equal(stored.state, 'REVIEW_READY');
    assert.equal(stored.candidate_sha, sha('d'));
    assert.equal(stored.review_pass_sha, null);
    assert.equal(stored.reviewed_base_sha, null);
    assert.equal(stored.ci.sha, sha('d'));
    assert.equal(stored.review.consumed, 1);
    assert.equal(stored.review_history[0].candidate_sha, sha('b'));
    assert.equal(stored.candidate_refresh_history.length, 1);
    assert.deepEqual(
      {
        review_number: stored.candidate_refresh_history[0].review_number,
        previous_candidate_sha: stored.candidate_refresh_history[0].previous_candidate_sha,
        candidate_sha: stored.candidate_refresh_history[0].candidate_sha,
        reviewed_base_sha: stored.candidate_refresh_history[0].reviewed_base_sha,
        reason: stored.candidate_refresh_history[0].reason,
      },
      {
        review_number: 1,
        previous_candidate_sha: sha('b'),
        candidate_sha: sha('d'),
        reviewed_base_sha: sha('a'),
        reason: 'Attach the sanitized one-shot result and update its frontier evidence.',
      },
    );
    assert.equal(typeof stored.candidate_refresh_history[0].at, 'string');

    const reserved = environment.execute(['review:reserve', '--run', '1', '--pr', '42']);
    assert.equal(reserved.status, 0, reserved.stderr);
    const next = parseControlBlock(environment.readState().prBody, EPOCH_MARKER);
    assert.equal(next.state, 'REVIEW_RESERVED');
    assert.equal(next.review.consumed, 1);
    assert.equal(next.review.reserved, 1);
  } finally {
    environment.cleanup();
  }
});

test('CLI Candidate refresh cannot clear the durable G19 one-shot disposition', () => {
  const { run, epoch } = passedCandidateFixture();
  epoch.adversarial_preflight.g19_one_shot_disposition = {
    frontierId: 'G19',
    state: 'INCONCLUSIVE',
    sourceCandidateSha: sha('b'),
    reportWritten: false,
    retryAllowed: false,
  };
  const environment = createMockEnvironment({
    runBody: renderRunBody(run),
    prBody: renderEpochBody(epoch),
    featureHeadSha: sha('d'),
    draft: false,
  });
  try {
    const result = environment.execute([
      'candidate:check',
      '--pr',
      '42',
      '--evidence',
      candidateEvidence(environment, {
        candidate_sha: sha('d'),
        candidate_refresh_reason: 'Preserve the G19 consumed one-shot disposition.',
      }),
    ]);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /^G19_ONESHOT_DISPOSITION_IMMUTABLE:/u);
    const stored = parseControlBlock(environment.readState().prBody, EPOCH_MARKER);
    assert.equal(stored.state, 'REVIEW_PASSED');
    assert.deepEqual(stored.adversarial_preflight.g19_one_shot_disposition, {
      frontierId: 'G19',
      state: 'INCONCLUSIVE',
      sourceCandidateSha: sha('b'),
      reportWritten: false,
      retryAllowed: false,
    });
  } finally {
    environment.cleanup();
  }
});

test('CLI Candidate refresh cannot clear or replace a durable P05 one-shot claim', () => {
  const { run, epoch, branch } = run95P05ClaimFixture();
  const disposition = {
    claimId: 'p05-run-95-pr-166-bbbbbbbbbbbb-test',
    frontierId: 'P05',
    epochId: P05_EPOCH_ID,
    state: 'INCONCLUSIVE',
    reportWritten: false,
    retryAllowed: false,
  };
  epoch.adversarial_preflight.p05_one_shot_disposition = disposition;
  const environment = createMockEnvironment({
    runIssueNumber: 95,
    runBody: renderRunBody(run),
    prBody: renderEpochBody(epoch),
    branch,
    featureBranch: branch,
    featureHeadSha: sha('d'),
    baseSha: sha('a'),
    draft: false,
  });
  try {
    const result = environment.execute([
      'candidate:check',
      '--run',
      '95',
      '--pr',
      '166',
      '--evidence',
      candidateEvidence(environment, {
        candidate_sha: sha('d'),
        candidate_refresh_reason: 'Preserve the P05 one-shot disposition.',
      }),
    ]);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /^P05_ONESHOT_DISPOSITION_IMMUTABLE:/u);
    const stored = parseControlBlock(environment.readState().prBody, EPOCH_MARKER);
    assert.equal(stored.state, 'REVIEW_PASSED');
    assert.deepEqual(stored.adversarial_preflight.p05_one_shot_disposition, disposition);
  } finally {
    environment.cleanup();
  }
});

test('CLI Candidate refresh cannot clear or replace the durable P01 one-shot disposition', () => {
  const { run, epoch } = passedCandidateFixture();
  const disposition = {
    claimId: 'p01-claim',
    frontierId: 'P01',
    epochId: 'run95-p01-person-role-agent-mcp',
    runNumber: 95,
    toolName: 'bangumi.get_person_activity',
    argumentProfile: 'fixed-p01-person-1040-staff-anime-36m-48r-16d-8rows-v1',
    expectedArgumentsSha256: 'a'.repeat(64),
    state: 'INCONCLUSIVE',
    sourceCandidateSha: sha('b'),
    baseSha: sha('a'),
    ciSha: sha('b'),
    ciStatus: 'SUCCESS',
    prNumber: 42,
    reviewerId: 'gpt-6-luna-max-run95-pr42-round1',
    model: 'gpt-6-luna',
    reasoningEffort: 'max',
    reportWritten: false,
    retryAllowed: false,
  };
  epoch.adversarial_preflight.p01_one_shot_disposition = structuredClone(disposition);
  const environment = createMockEnvironment({
    runBody: renderRunBody(run),
    prBody: renderEpochBody(epoch),
    featureHeadSha: sha('d'),
    draft: false,
  });
  try {
    const result = environment.execute([
      'candidate:check',
      '--pr',
      '42',
      '--evidence',
      candidateEvidence(environment, {
        candidate_sha: sha('d'),
        candidate_refresh_reason: 'Preserve the P01 consumed one-shot disposition.',
      }),
    ]);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /^P01_ONESHOT_DISPOSITION_IMMUTABLE:/u);
    const stored = parseControlBlock(environment.readState().prBody, EPOCH_MARKER);
    assert.equal(stored.state, 'REVIEW_PASSED');
    assert.deepEqual(stored.adversarial_preflight.p01_one_shot_disposition, disposition);
  } finally {
    environment.cleanup();
  }
});

test('CLI Candidate refresh cannot clear or replace the durable G16 one-shot disposition', () => {
  const { run, epoch } = passedCandidateFixture();
  const disposition = {
    claimId: 'g16-claim',
    frontierId: 'G16',
    epochId: 'run95-g16-director-person-activity-agent-mcp',
    runNumber: 95,
    toolName: 'bangumi.get_person_activity',
    state: 'REPORT_WRITTEN',
    sourceCandidateSha: sha('b'),
    baseSha: sha('a'),
    ciSha: sha('b'),
    ciStatus: 'SUCCESS',
    prNumber: 42,
    reviewerId: 'run95-g16-review1-gpt-6-luna-max-98df510',
    bundleSha256: 'a'.repeat(64),
    model: 'gpt-6-luna',
    reasoningEffort: 'max',
    reportWritten: true,
    reportPath: 'docs/live-probes/g16-report.json',
    reportSha256: 'b'.repeat(64),
    retryAllowed: false,
  };
  epoch.adversarial_preflight.g16_one_shot_disposition = structuredClone(disposition);
  const environment = createMockEnvironment({
    runBody: renderRunBody(run),
    prBody: renderEpochBody(epoch),
    featureHeadSha: sha('d'),
    draft: false,
  });
  try {
    const evidenceOverrides = [
      {
        candidate_refresh_reason: 'Attempt to delete the consumed G16 disposition.',
      },
      {
        candidate_refresh_reason: 'Attempt to replace the consumed G16 disposition.',
        adversarial_preflight: {
          completed: true,
          summary: 'Attempted disposition replacement.',
          g16_one_shot_disposition: { ...disposition, reportSha256: 'c'.repeat(64) },
        },
      },
    ];
    for (const overrides of evidenceOverrides) {
      const result = environment.execute([
        'candidate:check',
        '--pr',
        '42',
        '--evidence',
        candidateEvidence(environment, { candidate_sha: sha('d'), ...overrides }),
      ]);
      assert.equal(result.status, 2);
      assert.match(result.stderr, /^G16_ONESHOT_DISPOSITION_IMMUTABLE:/u);
      const stored = parseControlBlock(environment.readState().prBody, EPOCH_MARKER);
      assert.equal(stored.state, 'REVIEW_PASSED');
      assert.deepEqual(stored.adversarial_preflight.g16_one_shot_disposition, disposition);
    }
  } finally {
    environment.cleanup();
  }
});

test('CLI Candidate refresh preserves the durable R01 one-shot disposition exactly', () => {
  const { run, epoch } = passedCandidateFixture();
  const disposition = {
    claimId: 'r01-run-95-pr-42-bbbbbbbbbbbb-test',
    frontierId: 'R01',
    epochId: R01_EPOCH_ID,
    runNumber: 95,
    toolName: 'bangumi.get_subject_relations',
    argumentProfile: R01_ARGUMENT_PROFILE,
    expectedArgumentsSha256: canonicalHash(R01_EXPECTED_QUERY_ARGUMENTS),
    state: 'INCONCLUSIVE',
    sourceCandidateSha: sha('b'),
    baseSha: sha('a'),
    ciSha: sha('b'),
    ciStatus: 'SUCCESS',
    bundleSha256: 'c'.repeat(64),
    prNumber: 42,
    reviewerId: 'gpt-6-luna-max-run95-pr42-round1',
    model: 'gpt-6-luna',
    reasoningEffort: 'max',
    reportWritten: false,
    retryAllowed: false,
  };
  epoch.adversarial_preflight.r01_one_shot_disposition = structuredClone(disposition);
  const environment = createMockEnvironment({
    runBody: renderRunBody(run),
    prBody: renderEpochBody(epoch),
    featureHeadSha: sha('d'),
    draft: false,
  });
  try {
    const invalidEvidence = [
      { candidate_refresh_reason: 'Attempt to remove the R01 one-shot result.' },
      {
        candidate_refresh_reason: 'Attempt to replace the R01 one-shot result.',
        adversarial_preflight: {
          completed: true,
          summary: 'Attempted R01 result replacement.',
          r01_one_shot_disposition: {
            ...disposition,
            state: 'REPORT_WRITTEN',
            reportWritten: true,
          },
        },
      },
    ];
    for (const overrides of invalidEvidence) {
      const result = environment.execute([
        'candidate:check',
        '--pr',
        '42',
        '--evidence',
        candidateEvidence(environment, { candidate_sha: sha('d'), ...overrides }),
      ]);
      assert.equal(result.status, 2);
      assert.match(result.stderr, /^R01_ONESHOT_DISPOSITION_IMMUTABLE:/u);
      const stored = parseControlBlock(environment.readState().prBody, EPOCH_MARKER);
      assert.equal(stored.state, 'REVIEW_PASSED');
      assert.deepEqual(stored.adversarial_preflight.r01_one_shot_disposition, disposition);
    }

    const accepted = environment.execute([
      'candidate:check',
      '--pr',
      '42',
      '--evidence',
      candidateEvidence(environment, {
        candidate_sha: sha('d'),
        candidate_refresh_reason:
          'Preserve the durable R01 no-retry result while refreshing evidence.',
        adversarial_preflight: {
          completed: true,
          summary: 'Preserve all durable R01 one-shot evidence.',
          r01_one_shot_disposition: disposition,
        },
      }),
    ]);
    assert.equal(accepted.status, 0, accepted.stderr);
    const refreshed = parseControlBlock(environment.readState().prBody, EPOCH_MARKER);
    assert.equal(refreshed.state, 'REVIEW_READY');
    assert.deepEqual(refreshed.adversarial_preflight.r01_one_shot_disposition, disposition);
  } finally {
    environment.cleanup();
  }
});

test('CLI Candidate refresh cannot clear or replace the durable G06 one-shot disposition', () => {
  const { run, epoch } = passedCandidateFixture();
  const disposition = {
    claimId: `g06-run-95-pr-42-${sha('b').slice(0, 12)}-test`,
    frontierId: 'G06',
    epochId: G06_EPOCH_ID,
    runNumber: 95,
    toolName: G06_TOOL_NAME,
    argumentProfile: G06_ARGUMENT_PROFILE,
    expectedArgumentsSha256: canonicalHash(G06_EXPECTED_QUERY_ARGUMENTS),
    state: 'INCONCLUSIVE',
    sourceCandidateSha: sha('b'),
    baseSha: sha('a'),
    ciSha: sha('b'),
    ciStatus: 'SUCCESS',
    bundleSha256: 'c'.repeat(64),
    prNumber: 42,
    reviewerId: 'gpt-6-luna-max-run95-pr42-round1',
    model: 'gpt-6-luna',
    reasoningEffort: 'max',
    reportWritten: false,
    retryAllowed: false,
  };
  epoch.adversarial_preflight.g06_one_shot_disposition = structuredClone(disposition);
  const environment = createMockEnvironment({
    runBody: renderRunBody(run),
    prBody: renderEpochBody(epoch),
    featureHeadSha: sha('d'),
    draft: false,
  });
  try {
    const invalid = [
      { candidate_refresh_reason: 'Attempt to remove the G06 terminal disposition.' },
      {
        candidate_refresh_reason: 'Attempt to replace the G06 terminal disposition.',
        adversarial_preflight: {
          completed: true,
          summary: 'Attempted G06 result replacement.',
          g06_one_shot_disposition: {
            ...disposition,
            state: 'REPORT_WRITTEN',
            reportWritten: true,
          },
        },
      },
    ];
    for (const overrides of invalid) {
      const result = environment.execute([
        'candidate:check',
        '--pr',
        '42',
        '--evidence',
        candidateEvidence(environment, { candidate_sha: sha('d'), ...overrides }),
      ]);
      assert.equal(result.status, 2);
      assert.match(result.stderr, /^G06_ONESHOT_DISPOSITION_IMMUTABLE:/u);
      const stored = parseControlBlock(environment.readState().prBody, EPOCH_MARKER);
      assert.deepEqual(stored.adversarial_preflight.g06_one_shot_disposition, disposition);
    }
  } finally {
    environment.cleanup();
  }
});

test('CLI Candidate refresh cannot introduce an R01 claim through Candidate evidence', () => {
  const { run, epoch } = passedCandidateFixture();
  const environment = createMockEnvironment({
    runBody: renderRunBody(run),
    prBody: renderEpochBody(epoch),
    featureHeadSha: sha('d'),
    draft: false,
  });
  try {
    const result = environment.execute([
      'candidate:check',
      '--pr',
      '42',
      '--evidence',
      candidateEvidence(environment, {
        candidate_sha: sha('d'),
        candidate_refresh_reason: 'Candidate evidence cannot create a one-shot claim.',
        adversarial_preflight: {
          completed: true,
          summary: 'Attempt to inject a forged terminal R01 disposition.',
          r01_one_shot_disposition: {
            claimId: 'forged',
            frontierId: 'R01',
            state: 'INCONCLUSIVE',
            retryAllowed: false,
          },
        },
      }),
    ]);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /^R01_ONESHOT_DISPOSITION_IMMUTABLE:/u);
    const stored = parseControlBlock(environment.readState().prBody, EPOCH_MARKER);
    assert.equal(stored.state, 'REVIEW_PASSED');
    assert.equal(stored.adversarial_preflight.r01_one_shot_disposition, undefined);
  } finally {
    environment.cleanup();
  }
});

test('CLI Candidate refresh cannot clear or replace a G04 legacy no-retry reconciliation', () => {
  const { run, epoch } = passedCandidateFixture();
  const reconciliation = {
    schemaVersion: 1,
    state: 'LEGACY_TERMINAL_RECONCILED',
    runNumber: 95,
    frontierId: 'G04',
    sourceClaim: {
      claimId: 'g04-run-95-pr-136-aaaaaaaaaaaa-123',
      state: 'INCONCLUSIVE',
      retryAllowed: false,
    },
    reconciledAgainst: { prNumber: 139, candidateSha: sha('b') },
    queryInvoked: false,
    reportWritten: false,
    retryAllowed: false,
    globalLatch: {
      name: 'harness-r95-g04-person-activity-claimed',
      description:
        'Run 95 G04 bangumi.get_person_activity one-shot latch; permanent; never remove or recreate.',
    },
    reconciledAt: '2026-10-12T11:00:00.000Z',
  };
  epoch.adversarial_preflight.g04_legacy_claim_reconciliation = structuredClone(reconciliation);
  const environment = createMockEnvironment({
    runBody: renderRunBody(run),
    prBody: renderEpochBody(epoch),
    featureHeadSha: sha('d'),
    draft: false,
  });
  try {
    const evidenceOverrides = [
      { candidate_refresh_reason: 'Preserve the G04 terminal no-retry reconciliation.' },
      {
        candidate_refresh_reason: 'Attempt to replace the G04 terminal reconciliation.',
        adversarial_preflight: {
          completed: true,
          summary: 'Attempted G04 reconciliation replacement.',
          g04_legacy_claim_reconciliation: {
            ...reconciliation,
            sourceClaim: { ...reconciliation.sourceClaim, claimId: 'forged' },
          },
        },
      },
    ];
    for (const overrides of evidenceOverrides) {
      const result = environment.execute([
        'candidate:check',
        '--pr',
        '42',
        '--evidence',
        candidateEvidence(environment, { candidate_sha: sha('d'), ...overrides }),
      ]);
      assert.equal(result.status, 2);
      assert.match(result.stderr, /^G04_LEGACY_RECONCILIATION_IMMUTABLE:/u);
      const stored = parseControlBlock(environment.readState().prBody, EPOCH_MARKER);
      assert.equal(stored.state, 'REVIEW_PASSED');
      assert.deepEqual(
        stored.adversarial_preflight.g04_legacy_claim_reconciliation,
        reconciliation,
      );
    }
  } finally {
    environment.cleanup();
  }
});

test('CLI Candidate gate rejects an unchanged or unaudited post-PASS refresh', () => {
  const unchangedFixture = passedCandidateFixture();
  const unchangedEnvironment = createMockEnvironment({
    runBody: renderRunBody(unchangedFixture.run),
    prBody: renderEpochBody(unchangedFixture.epoch),
  });
  try {
    const unchanged = unchangedEnvironment.execute([
      'candidate:check',
      '--pr',
      '42',
      '--evidence',
      candidateEvidence(unchangedEnvironment, {
        candidate_refresh_reason: 'Attempt an unchanged candidate refresh.',
      }),
    ]);
    assert.equal(unchanged.status, 2);
    assert.match(unchanged.stderr, /^PASSED_CANDIDATE_UNCHANGED:/u);
    const stored = parseControlBlock(unchangedEnvironment.readState().prBody, EPOCH_MARKER);
    assert.equal(stored.state, 'REVIEW_PASSED');
    assert.equal(stored.candidate_sha, sha('b'));
  } finally {
    unchangedEnvironment.cleanup();
  }

  const unauditedFixture = passedCandidateFixture();
  const unauditedEnvironment = createMockEnvironment({
    runBody: renderRunBody(unauditedFixture.run),
    prBody: renderEpochBody(unauditedFixture.epoch),
    featureHeadSha: sha('d'),
    draft: false,
  });
  try {
    const noReason = unauditedEnvironment.execute([
      'candidate:check',
      '--pr',
      '42',
      '--evidence',
      candidateEvidence(unauditedEnvironment, { candidate_sha: sha('d') }),
    ]);
    assert.equal(noReason.status, 2);
    assert.match(noReason.stderr, /^CANDIDATE_REFRESH_REASON_REQUIRED:/u);
    const stored = parseControlBlock(unauditedEnvironment.readState().prBody, EPOCH_MARKER);
    assert.equal(stored.state, 'REVIEW_PASSED');
    assert.equal(stored.candidate_sha, sha('b'));
  } finally {
    unauditedEnvironment.cleanup();
  }
});

test('CLI Candidate gate rejects post-PASS Base drift and a rewritten-away passed Candidate', () => {
  const driftFixture = passedCandidateFixture();
  const driftEnvironment = createMockEnvironment({
    runBody: renderRunBody(driftFixture.run),
    prBody: renderEpochBody(driftFixture.epoch),
    baseSha: sha('d'),
    featureHeadSha: sha('e'),
    draft: false,
  });
  try {
    const drift = driftEnvironment.execute([
      'candidate:check',
      '--pr',
      '42',
      '--evidence',
      candidateEvidence(driftEnvironment, {
        base_sha: sha('d'),
        candidate_sha: sha('e'),
        candidate_refresh_reason: 'Attach the required post-PASS evidence artifact.',
      }),
    ]);
    assert.equal(drift.status, 2);
    assert.match(drift.stderr, /^PASS_INVALIDATED_BASE_DRIFT:/u);
    assert.equal(
      parseControlBlock(driftEnvironment.readState().prBody, EPOCH_MARKER).state,
      'REVIEW_PASSED',
    );
  } finally {
    driftEnvironment.cleanup();
  }

  const rewrittenFixture = passedCandidateFixture();
  const rewrittenEnvironment = createMockEnvironment({
    runBody: renderRunBody(rewrittenFixture.run),
    prBody: renderEpochBody(rewrittenFixture.epoch),
    featureHeadSha: sha('e'),
    candidateIsAncestor: false,
    draft: false,
  });
  try {
    const rewritten = rewrittenEnvironment.execute([
      'candidate:check',
      '--pr',
      '42',
      '--evidence',
      candidateEvidence(rewrittenEnvironment, {
        candidate_sha: sha('e'),
        candidate_refresh_reason: 'Attach the required post-PASS evidence artifact.',
      }),
    ]);
    assert.equal(rewritten.status, 2);
    assert.match(rewritten.stderr, /^PASSED_CANDIDATE_NOT_ANCESTOR:/u);
    assert.equal(
      parseControlBlock(rewrittenEnvironment.readState().prBody, EPOCH_MARKER).state,
      'REVIEW_PASSED',
    );
  } finally {
    rewrittenEnvironment.cleanup();
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

test('CLI a definitely unstarted reviewer releases the reservation and restores readiness', () => {
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
  });
  try {
    const reserved = environment.execute(['review:reserve', '--run', '1', '--pr', '42']);
    assert.equal(reserved.status, 0, reserved.stderr);

    const reconciled = environment.execute([
      'review:reconcile',
      '--run',
      '1',
      '--pr',
      '42',
      '--definitely-not-started',
    ]);
    assert.equal(reconciled.status, 0, reconciled.stderr);
    let stored = parseControlBlock(environment.readState().prBody, EPOCH_MARKER);
    let storedRun = parseControlBlock(environment.readState().runBody, RUN_MARKER);
    assert.equal(stored.state, 'REVIEW_READY');
    assert.equal(stored.review.consumed, 0);
    assert.equal(stored.review.reserved, 0);
    assert.equal(storedRun.outer_sol.product.consumed, 0);
    assert.equal(storedRun.outer_sol.reserved, 0);

    const retried = environment.execute(['review:reserve', '--run', '1', '--pr', '42']);
    assert.equal(retried.status, 0, retried.stderr);
    const started = environment.execute([
      'review:started',
      '--run',
      '1',
      '--pr',
      '42',
      '--reviewer-id',
      'sol-product',
    ]);
    assert.equal(started.status, 0, started.stderr);
    stored = parseControlBlock(environment.readState().prBody, EPOCH_MARKER);
    storedRun = parseControlBlock(environment.readState().runBody, RUN_MARKER);
    assert.equal(stored.state, 'REVIEW_RUNNING');
    assert.equal(stored.review.consumed, 1);
    assert.equal(storedRun.outer_sol.product.consumed, 1);
  } finally {
    environment.cleanup();
  }
});

test('CLI Candidate gate can revalidate a legacy reconciled no-start state', () => {
  const { run, epoch } = controlFixture();
  epoch.state = 'REVIEW_RESERVATION_RECONCILED';
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
  });
  try {
    const result = environment.execute([
      'candidate:check',
      '--pr',
      '42',
      '--evidence',
      candidateEvidence(environment),
    ]);
    assert.equal(result.status, 0, result.stderr);
    const stored = parseControlBlock(environment.readState().prBody, EPOCH_MARKER);
    assert.equal(stored.state, 'REVIEW_READY');
    assert.equal(stored.review.consumed, 0);
    assert.equal(stored.candidate_sha, sha('b'));
  } finally {
    environment.cleanup();
  }

  const consumed = controlFixture();
  consumed.epoch.state = 'REVIEW_RESERVATION_RECONCILED';
  consumed.epoch.review.consumed = 1;
  consumed.epoch.candidate_sha = sha('b');
  consumed.epoch.ci = { sha: sha('b'), status: 'SUCCESS', url: 'https://example.test/ci' };
  consumed.epoch.scope_closure = {
    why_not_review_earlier: 'Related work complete.',
    why_not_extend_further: 'Next work is independent.',
    related_work_remaining: false,
  };
  consumed.epoch.adversarial_preflight = { completed: true, summary: 'Adversarial pass complete.' };
  const consumedEnvironment = createMockEnvironment({
    runBody: renderRunBody(consumed.run),
    prBody: renderEpochBody(consumed.epoch),
  });
  try {
    const result = consumedEnvironment.execute([
      'candidate:check',
      '--pr',
      '42',
      '--run',
      '95',
      '--evidence',
      candidateEvidence(consumedEnvironment),
    ]);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /^INVALID_CANDIDATE_STATE:/u);
  } finally {
    consumedEnvironment.cleanup();
  }
});

test('CLI Candidate gate reassesses an exact post-PASS refresh without resetting review history', () => {
  const { run, epoch } = reconciledPostPassRefreshFixture();
  const originalHistory = structuredClone(epoch.review_history);
  const environment = createMockEnvironment({
    runBody: renderRunBody(run),
    prBody: renderEpochBody(epoch),
  });
  try {
    const result = environment.execute([
      'candidate:check',
      '--pr',
      '42',
      '--run',
      '95',
      '--evidence',
      candidateEvidence(environment, {
        review_reassessment_reason:
          'The completed PASS is linked to this exact post-PASS Candidate refresh; all consumed rounds have verdict records and no paired review reservation remains.',
      }),
    ]);
    assert.equal(result.status, 0, result.stderr);
    const stored = parseControlBlock(environment.readState().prBody, EPOCH_MARKER);
    assert.equal(stored.state, 'REVIEW_READY');
    assert.equal(stored.next_action, 'RESERVE_REVIEWER_2');
    assert.equal(stored.review.consumed, 1);
    assert.equal(stored.review.reserved, 0);
    assert.deepEqual(stored.review_history, originalHistory);
    assert.equal(stored.review_reassessment_history.length, 1);
    assert.equal(stored.review_reassessment_history[0].from_state, 'REVIEW_RESERVATION_RECONCILED');
    assert.equal(stored.review_reassessment_history[0].previous_candidate_sha, sha('b'));
    assert.equal(stored.review_reassessment_history[0].candidate_sha, sha('b'));
    assert.equal(stored.review_reassessment_history[0].preserved_review_count, 1);
    assert.match(stored.review_reassessment_history[0].review_history_sha, /^[a-f0-9]{64}$/u);
  } finally {
    environment.cleanup();
  }
});

test('post-PASS reassessment requires matched review history and no active reservation', () => {
  const { run, epoch } = reconciledPostPassRefreshFixture();
  assert.equal(isReconciledPostPassCandidateRefresh(run, epoch), true);

  const closureReserved = structuredClone(run);
  closureReserved.outer_sol.closure.reserved = 1;
  assert.equal(isReconciledPostPassCandidateRefresh(closureReserved, epoch), false);

  const productReserved = structuredClone(run);
  productReserved.outer_sol.product.reserved = 1;
  assert.equal(isReconciledPostPassCandidateRefresh(productReserved, epoch), false);

  const epochReserved = structuredClone(epoch);
  epochReserved.review.reserved = 1;
  assert.equal(isReconciledPostPassCandidateRefresh(run, epochReserved), false);

  const reviewerActive = structuredClone(epoch);
  reviewerActive.review.reviewer_id = 'gpt-6-luna-max-test-reviewer';
  assert.equal(isReconciledPostPassCandidateRefresh(run, reviewerActive), false);

  const reviewerInterrupted = structuredClone(epoch);
  reviewerInterrupted.review.runtime.state = 'INTERRUPTED_RESUMABLE';
  assert.equal(isReconciledPostPassCandidateRefresh(run, reviewerInterrupted), false);

  const unmatchedConsumedRound = structuredClone(epoch);
  unmatchedConsumedRound.review.consumed = 2;
  assert.equal(isReconciledPostPassCandidateRefresh(run, unmatchedConsumedRound), false);

  const brokenRefreshLink = structuredClone(epoch);
  brokenRefreshLink.candidate_refresh_history[0].previous_candidate_sha = sha('d');
  assert.equal(isReconciledPostPassCandidateRefresh(run, brokenRefreshLink), false);
});

test('CLI Candidate gate rejects a reconciled refresh with an unmatched consumed review slot', () => {
  const { run, epoch } = controlFixture();
  epoch.state = 'REVIEW_RESERVATION_RECONCILED';
  epoch.candidate_sha = sha('b');
  epoch.ci = { sha: sha('b'), status: 'SUCCESS', url: 'https://example.test/ci' };
  epoch.review.consumed = 2;
  epoch.review.runtime = { state: 'COMPLETED', reason: null, allocation: 'NORMAL' };
  epoch.review_history = [
    {
      review_number: 1,
      reviewer_id: 'gpt-6-luna-max-test-reviewer',
      candidate_sha: sha('c'),
      reviewed_base_sha: sha('a'),
      verdict: 'PASS',
      findings: [],
    },
  ];
  epoch.candidate_refresh_history = [
    {
      review_number: 2,
      previous_candidate_sha: sha('c'),
      candidate_sha: sha('b'),
      reviewed_base_sha: sha('a'),
      reason: 'A required post-PASS evidence file was added.',
      at: '2026-10-14T00:00:00.000Z',
    },
  ];
  const environment = createMockEnvironment({
    runBody: renderRunBody(run),
    prBody: renderEpochBody(epoch),
  });
  try {
    const result = environment.execute([
      'candidate:check',
      '--pr',
      '42',
      '--run',
      '95',
      '--evidence',
      candidateEvidence(environment, {
        review_reassessment_reason:
          'An audit reason is present, but a consumed slot has no recorded verdict history.',
      }),
    ]);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /^INVALID_CANDIDATE_STATE:/u);
    const stored = parseControlBlock(environment.readState().prBody, EPOCH_MARKER);
    assert.equal(stored.state, 'REVIEW_RESERVATION_RECONCILED');
    assert.equal(stored.review.consumed, 2);
    assert.equal(stored.review_reassessment_history.length, 0);
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

test('CLI retries an unchanged blocked integration through the full Harness gate', () => {
  const environment = mergeReadyEnvironment({ mergeAllowed: false });
  try {
    const blocked = environment.execute(['epoch:merge', '--run', '1', '--pr', '42']);
    assert.equal(blocked.status, 2);

    const state = environment.readState();
    fs.writeFileSync(
      environment.statePath,
      `${JSON.stringify({ ...state, mergeAllowed: true }, null, 2)}\n`,
    );

    const resumed = environment.execute(['epoch:resume-integration', '--run', '1', '--pr', '42']);
    assert.equal(resumed.status, 0, resumed.stderr);

    const completed = environment.readState();
    const epoch = parseControlBlock(completed.prBody, EPOCH_MARKER);
    const run = parseControlBlock(completed.runBody, RUN_MARKER);
    assert.equal(epoch.state, 'MERGED');
    assert.equal(run.state, 'ACTIVE');
    assert.equal(run.active_epoch_pr, null);
    assert.equal(epoch.review.consumed, 1);
    assert.equal(run.outer_sol.product.consumed, 1);
    assert.equal(completed.branch, 'master');
  } finally {
    environment.cleanup();
  }
});

test('CLI blocked-integration resume honors base drift instead of reusing old PASS', () => {
  const environment = mergeReadyEnvironment({ mergeAllowed: false });
  try {
    const blocked = environment.execute(['epoch:merge', '--run', '1', '--pr', '42']);
    assert.equal(blocked.status, 2);

    const state = environment.readState();
    fs.writeFileSync(
      environment.statePath,
      `${JSON.stringify({ ...state, mergeAllowed: true, baseSha: sha('d') }, null, 2)}\n`,
    );

    const resumed = environment.execute(['epoch:resume-integration', '--run', '1', '--pr', '42']);
    assert.equal(resumed.status, 2);
    assert.match(resumed.stderr, /^PASS_INVALIDATED_BASE_DRIFT:/u);

    const drifted = environment.readState();
    const epoch = parseControlBlock(drifted.prBody, EPOCH_MARKER);
    const run = parseControlBlock(drifted.runBody, RUN_MARKER);
    assert.equal(epoch.state, 'PASS_INVALIDATED_BASE_DRIFT');
    assert.equal(epoch.candidate_sha, null);
    assert.equal(run.state, 'EPOCH_ACTIVE');
    assert.equal(run.active_epoch_pr, 42);
    assert.equal(
      drifted.calls.filter(
        (call) => call.tool === 'gh' && call.args[0] === 'pr' && call.args[1] === 'merge',
      ).length,
      1,
    );
  } finally {
    environment.cleanup();
  }
});

test('CLI blocked-integration resume rejects Candidate drift', () => {
  const environment = mergeReadyEnvironment({ mergeAllowed: false });
  try {
    const blocked = environment.execute(['epoch:merge', '--run', '1', '--pr', '42']);
    assert.equal(blocked.status, 2);

    const state = environment.readState();
    fs.writeFileSync(
      environment.statePath,
      `${JSON.stringify({ ...state, mergeAllowed: true, featureHeadSha: sha('d') }, null, 2)}\n`,
    );

    const resumed = environment.execute(['epoch:resume-integration', '--run', '1', '--pr', '42']);
    assert.equal(resumed.status, 2);
    assert.match(resumed.stderr, /^CANDIDATE_INVARIANT_FAILED:/u);
    assert.equal(environment.readState().prState, 'OPEN');
  } finally {
    environment.cleanup();
  }
});

test('CLI blocked-integration resume requires live mandatory exact-SHA CI success', () => {
  const environment = mergeReadyEnvironment({ mergeAllowed: false });
  try {
    const blocked = environment.execute(['epoch:merge', '--run', '1', '--pr', '42']);
    assert.equal(blocked.status, 2);

    const state = environment.readState();
    fs.writeFileSync(
      environment.statePath,
      `${JSON.stringify(
        {
          ...state,
          mergeAllowed: true,
          checks: state.checks.map((check) =>
            check.name === 'harness-control' ? { ...check, conclusion: 'FAILURE' } : check,
          ),
        },
        null,
        2,
      )}\n`,
    );

    const resumed = environment.execute(['epoch:resume-integration', '--run', '1', '--pr', '42']);
    assert.equal(resumed.status, 2);
    assert.match(resumed.stderr, /^EXACT_SHA_CI_REQUIRED:/u);
    assert.equal(environment.readState().prState, 'OPEN');
  } finally {
    environment.cleanup();
  }
});

test('CLI reconciles a merge accepted by GitHub when the merge response was lost', () => {
  const environment = mergeReadyEnvironment({ mergeResponseLostAfterSuccess: true });
  try {
    const interrupted = environment.execute(['epoch:merge', '--run', '1', '--pr', '42']);
    assert.equal(interrupted.status, 2);
    let state = environment.readState();
    assert.equal(state.prState, 'MERGED');
    assert.equal(parseControlBlock(state.prBody, EPOCH_MARKER).state, 'INTEGRATION_BLOCKED');

    const resumed = environment.execute(['epoch:resume-integration', '--run', '1', '--pr', '42']);
    assert.equal(resumed.status, 0, resumed.stderr);

    state = environment.readState();
    const epoch = parseControlBlock(state.prBody, EPOCH_MARKER);
    const run = parseControlBlock(state.runBody, RUN_MARKER);
    assert.equal(epoch.state, 'MERGED');
    assert.equal(epoch.merge_sha, sha('c'));
    assert.equal(run.last_merged_epoch_pr, 42);
    assert.equal(run.active_epoch_pr, null);
    assert.equal(state.branch, 'master');
    assert.equal(
      state.calls.filter(
        (call) => call.tool === 'gh' && call.args[0] === 'pr' && call.args[1] === 'merge',
      ).length,
      1,
    );
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
  run.outer_sol.max = run.outer_sol.product.max + run.outer_sol.closure.max;
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

test('CLI final corrective gate requires closure evidence then auto-merges without another review', () => {
  const { run, epoch } = controlFixture();
  epoch.state = 'FINAL_CORRECTIVE_REQUIRED';
  epoch.review.consumed = 2;
  epoch.final_corrective_reason = 'REVIEW_LIMIT_FINDINGS';
  epoch.findings = [
    { id: 'review-2-finding-1', priority: 'P1', summary: 'Preserve metadata truthfulness' },
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

test('CLI resumes blocked final-corrective integration without another review', () => {
  const { run, epoch } = controlFixture();
  epoch.state = 'FINAL_CORRECTIVE_READY';
  epoch.review.consumed = 2;
  epoch.final_corrective_reason = 'REVIEW_LIMIT_FINDINGS';
  epoch.findings = [
    { id: 'review-2-finding-1', priority: 'P1', summary: 'Preserve metadata truthfulness' },
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
  run.outer_sol.consumed = 2;
  run.outer_sol.product.consumed = 2;
  const environment = createMockEnvironment({
    runBody: renderRunBody(run),
    prBody: renderEpochBody(epoch),
    draft: false,
    mergeAllowed: false,
  });
  try {
    const blocked = environment.execute(['epoch:merge', '--run', '1', '--pr', '42']);
    assert.equal(blocked.status, 2);

    const state = environment.readState();
    fs.writeFileSync(
      environment.statePath,
      `${JSON.stringify({ ...state, mergeAllowed: true }, null, 2)}\n`,
    );
    const resumed = environment.execute(['epoch:resume-integration', '--run', '1', '--pr', '42']);
    assert.equal(resumed.status, 0, resumed.stderr);

    const completed = environment.readState();
    const mergedEpoch = parseControlBlock(completed.prBody, EPOCH_MARKER);
    const completedRun = parseControlBlock(completed.runBody, RUN_MARKER);
    assert.equal(mergedEpoch.state, 'MERGED');
    assert.equal(mergedEpoch.review.consumed, 2);
    assert.equal(completedRun.outer_sol.product.consumed, 2);
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
    { id: 'review-2-finding-1', priority: 'P1', summary: 'Preserve metadata truthfulness' },
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
