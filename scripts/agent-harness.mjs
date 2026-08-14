#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  EPOCH_MARKER,
  RUN_MARKER,
  HarnessInvariantError,
  afterPassBaseAction,
  applyReviewResult,
  assertCandidateInvariant,
  assertMergeReadiness,
  assertNoLegacyRuntimeChanges,
  assertProductCommitHygiene,
  assertReviewReadiness,
  assertRunCanStartEpoch,
  completeMerge,
  createEpochState,
  createRunState,
  markReviewStarted,
  parseControlBlock,
  recordIntegrationBlocked,
  reconcileReviewReservation,
  resumeReviewLimitForFinalCorrective,
  renderEpochBody,
  renderRunBody,
  reserveReview,
  waitForSameReviewer,
} from './lib/agent-harness-core.mjs';

const root = path.resolve(import.meta.dirname, '..');
const mandatoryCiChecks = [
  'harness-control',
  'sqlite-default',
  'host-integration',
  'standalone-release-smoke',
  'postgres-compat',
  'provider-foundation',
  'discovery-foundation',
];

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: options.capture === false ? 'inherit' : ['pipe', 'pipe', 'pipe'],
    input: options.input,
    env: { ...process.env, ...options.env },
  }).trim();
}

function git(...args) {
  return run('git', args);
}

function gh(...args) {
  const last = args.at(-1);
  const options = last && typeof last === 'object' ? args.pop() : {};
  return run('gh', args, options);
}

function parseArgs(argv) {
  const [command = 'help', ...rest] = argv;
  const options = { _: [] };
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith('--')) {
      options._.push(token);
      continue;
    }
    const [rawKey, inlineValue] = token.slice(2).split('=', 2);
    if (inlineValue !== undefined) {
      options[rawKey] = inlineValue;
    } else if (rest[index + 1] && !rest[index + 1].startsWith('--')) {
      options[rawKey] = rest[index + 1];
      index += 1;
    } else {
      options[rawKey] = true;
    }
  }
  return { command, options };
}

function required(options, name) {
  const value = options[name];
  if (value === undefined || value === true || value === '') {
    throw new HarnessInvariantError('ARGUMENT_REQUIRED', `--${name} is required`);
  }
  return String(value);
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(root, filePath), 'utf8'));
}

function ensureCleanWorkingTree() {
  const status = git('status', '--porcelain');
  if (status) {
    throw new HarnessInvariantError(
      'UNSAFE_DIRTY_WORKTREE',
      'The Harness will not relocate or mutate unrelated dirty work',
      { status: status.split('\n') },
    );
  }
}

function ensureControlPlane() {
  try {
    run('gh', ['--version']);
    gh('auth', 'status');
    gh('repo', 'view', '--json', 'nameWithOwner');
  } catch (error) {
    throw new HarnessInvariantError(
      'CONTROL_PLANE_UNAVAILABLE',
      'GitHub CLI authentication/API access is required; no Git fallback is allowed',
      { cause: error instanceof Error ? error.message : String(error) },
    );
  }
}

function issueView(number) {
  return JSON.parse(gh('issue', 'view', String(number), '--json', 'number,title,body,state,url'));
}

function prView(number) {
  return JSON.parse(
    gh(
      'pr',
      'view',
      String(number),
      '--json',
      'number,title,body,state,url,isDraft,headRefName,headRefOid,baseRefName,mergeStateStatus,statusCheckRollup,mergeCommit',
    ),
  );
}

function issueState(number) {
  const view = issueView(number);
  return { view, state: parseControlBlock(view.body, RUN_MARKER) };
}

function epochState(number) {
  const view = prView(number);
  return { view, state: parseControlBlock(view.body, EPOCH_MARKER) };
}

function updateIssue(number, state) {
  const body = renderRunBody(state);
  gh('issue', 'edit', String(number), '--body-file', '-', { input: body });
  return body;
}

function updatePr(number, state) {
  const body = renderEpochBody(state);
  gh('pr', 'edit', String(number), '--body-file', '-', { input: body });
  return body;
}

function currentBranch() {
  return git('branch', '--show-current');
}

function currentHead() {
  return git('rev-parse', 'HEAD');
}

function remoteBaseSha(branch) {
  git('fetch', 'origin', branch);
  return git('rev-parse', `origin/${branch}`);
}

function isAncestor(ancestor, descendant) {
  try {
    git('merge-base', '--is-ancestor', ancestor, descendant);
    return true;
  } catch {
    return false;
  }
}

function remoteBranchExists(branch) {
  return git('ls-remote', '--heads', 'origin', `refs/heads/${branch}`) !== '';
}

function changedPaths(base, head = 'HEAD') {
  const committed = git('diff', '--name-only', `${base}...${head}`);
  const working = git('status', '--porcelain=v1')
    .split('\n')
    .filter(Boolean)
    .map((line) => line.slice(3));
  return [...new Set([...committed.split('\n').filter(Boolean), ...working])];
}

function commitSubjects(base, head = 'HEAD') {
  const output = git('log', '--format=%s', `${base}..${head}`);
  return output.split('\n').filter(Boolean);
}

function eventPrBody() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath || !fs.existsSync(eventPath)) return '';
  try {
    return JSON.parse(fs.readFileSync(eventPath, 'utf8')).pull_request?.body ?? '';
  } catch {
    return '';
  }
}

function isProductEpoch(options) {
  if (options['product-epoch'] === true || process.env.HARNESS_PR_KIND === 'product') return true;
  if (eventPrBody().includes(`<!-- ${EPOCH_MARKER}:start -->`)) return true;
  return /^codex\/epoch[-/]/u.test(currentBranch());
}

function mandatoryChecksSuccessful(checks) {
  if (!Array.isArray(checks)) return false;
  const states = new Map(
    checks.map((check) => [check.name ?? check.context, check.conclusion ?? check.state]),
  );
  return mandatoryCiChecks.every((name) => states.get(name) === 'SUCCESS');
}

function print(value) {
  process.stdout.write(`${typeof value === 'string' ? value : JSON.stringify(value, null, 2)}\n`);
}

function commandHelp() {
  print(`BangumiAgentKit Harness V3

Usage: pnpm harness <command> [options]

  status --run <issue> [--pr <number>]
  run:start --title <title> [--profile AUTONOMOUS_EVOLUTION] [--outer-sol-max 4]
  epoch:start --run <issue> --spec <json>
  epoch:open-pr --run <issue> --title <title>
  guard:legacy-paths [--base origin/master] [--product-epoch]
  candidate:check --pr <number> --evidence <json>
  review:reserve --run <issue> --pr <number>
  review:started --run <issue> --pr <number> --reviewer-id <id>
  review:reconcile --run <issue> --pr <number> [--definitely-not-started]
  review:wait --run <issue> --pr <number> --reviewer-id <id>
  review:result --run <issue> --pr <number> --verdict <verdict> [--findings <json>]
  epoch:park --run <issue> --pr <number> --state <state> --reason <text>
  epoch:resume-final-corrective --run <issue> --pr <number>
  epoch:merge --run <issue> --pr <number>
  run:stop --run <issue> --state <state> --next-action <text>

Complex Epoch selection and Candidate evidence are supplied as local JSON input;
the durable source becomes the edited GitHub Issue/PR body.`);
}

function commandStatus(options) {
  ensureControlPlane();
  const runNumber = required(options, 'run');
  const runResult = issueState(runNumber);
  const result = {
    git: { branch: currentBranch(), head: currentHead(), status: git('status', '--porcelain') },
    run: { number: runResult.view.number, url: runResult.view.url, state: runResult.state },
  };
  const prNumber = options.pr ?? runResult.state.active_epoch_pr;
  if (prNumber) {
    const epochResult = epochState(prNumber);
    result.epoch = {
      number: epochResult.view.number,
      url: epochResult.view.url,
      github_state: epochResult.view.state,
      state: epochResult.state,
      pr_head_sha: epochResult.view.headRefOid,
    };
  }
  print(result);
}

function commandRunStart(options) {
  ensureControlPlane();
  ensureCleanWorkingTree();
  const branch = currentBranch();
  if (branch !== 'master') {
    throw new HarnessInvariantError('RUN_MUST_START_ON_MASTER', 'Outer runs start on master');
  }
  const local = currentHead();
  const remote = remoteBaseSha('master');
  if (local !== remote) {
    throw new HarnessInvariantError('MASTER_NOT_SYNCHRONIZED', 'master must equal origin/master', {
      local,
      remote,
    });
  }
  const title = required(options, 'title');
  const runId = options['run-id'] ?? `run-${new Date().toISOString().replaceAll(/[:.]/gu, '-')}`;
  const state = createRunState({
    runId,
    profile: options.profile ?? 'AUTONOMOUS_EVOLUTION',
    outerSolMax: Number(options['outer-sol-max'] ?? 4),
  });
  const url = gh('issue', 'create', '--title', `[Harness V3 Run] ${title}`, '--body-file', '-', {
    input: renderRunBody(state),
  });
  print({ state: 'RUN_STARTED', url, run: state });
}

function commandEpochStart(options) {
  ensureControlPlane();
  ensureCleanWorkingTree();
  const runNumber = required(options, 'run');
  const spec = readJsonFile(required(options, 'spec'));
  const runResult = issueState(runNumber);
  assertRunCanStartEpoch(runResult.state);
  const baseBranch = spec.base_branch ?? 'master';
  const baseSha = remoteBaseSha(baseBranch);
  if (currentBranch() !== baseBranch || currentHead() !== baseSha) {
    throw new HarnessInvariantError(
      'BASE_NOT_SYNCHRONIZED',
      `Epoch selection must start from synchronized ${baseBranch}`,
      { branch: currentBranch(), head: currentHead(), remote: baseSha },
    );
  }
  const epoch = createEpochState({
    epochId: spec.epoch_id,
    baseSha,
    baseBranch,
    objective: spec.objective,
    questions: spec.questions,
    workPackages: spec.work_packages,
    nonScope: spec.non_scope,
    acceptanceCriteria: spec.acceptance_criteria,
  });
  const nextRun = structuredClone(runResult.state);
  nextRun.pending_epoch = epoch;
  nextRun.state = 'EPOCH_SELECTED_AWAITING_FIRST_COMMIT';
  nextRun.next_action = `CREATE_BRANCH_codex/epoch-${epoch.epoch_id}`;
  updateIssue(runNumber, nextRun);
  print({ state: nextRun.state, epoch });
}

function commandEpochOpenPr(options) {
  ensureControlPlane();
  ensureCleanWorkingTree();
  const runNumber = required(options, 'run');
  const title = required(options, 'title');
  const runResult = issueState(runNumber);
  const epoch = runResult.state.pending_epoch;
  if (!epoch) throw new HarnessInvariantError('NO_PENDING_EPOCH', 'Select the Epoch first');
  const branch = currentBranch();
  if (!/^codex\/epoch[-/]/u.test(branch)) {
    throw new HarnessInvariantError(
      'INVALID_EPOCH_BRANCH',
      'V3 Product branches must use codex/epoch-... or codex/epoch/...',
    );
  }
  const commitCount = Number(git('rev-list', '--count', `${epoch.base_sha}..HEAD`));
  if (commitCount < 1) {
    throw new HarnessInvariantError(
      'MEANINGFUL_COMMIT_REQUIRED',
      'Open the Draft PR only after the first meaningful engineering commit',
    );
  }
  assertNoLegacyRuntimeChanges(changedPaths(epoch.base_sha));
  assertProductCommitHygiene(commitSubjects(epoch.base_sha));
  epoch.branch = branch;
  epoch.state = 'IMPLEMENTING';
  epoch.next_action = 'CONTINUE_WORK_PACKAGES';
  git('push', '--set-upstream', 'origin', branch);
  const url = gh(
    'pr',
    'create',
    '--draft',
    '--base',
    epoch.base_branch,
    '--head',
    branch,
    '--title',
    title,
    '--body-file',
    '-',
    { input: renderEpochBody(epoch) },
  );
  const pr = JSON.parse(gh('pr', 'view', url, '--json', 'number,body,url'));
  epoch.pr_number = pr.number;
  updatePr(pr.number, epoch);
  const nextRun = structuredClone(runResult.state);
  nextRun.pending_epoch = null;
  nextRun.active_epoch_pr = pr.number;
  nextRun.state = 'EPOCH_ACTIVE';
  nextRun.next_action = `RESUME_PR_${pr.number}`;
  updateIssue(runNumber, nextRun);
  print({ state: 'EPOCH_PR_OPEN', pr: pr.number, url });
}

function commandGuard(options) {
  if (!isProductEpoch(options)) {
    print({ state: 'NOT_A_V3_PRODUCT_EPOCH', checked: false });
    return;
  }
  const base = options.base ?? process.env.HARNESS_BASE_REF ?? 'origin/master';
  const head = process.env.HARNESS_HEAD_REF ?? 'HEAD';
  assertNoLegacyRuntimeChanges(changedPaths(base, head));
  assertProductCommitHygiene(commitSubjects(base, head));
  print({ state: 'LEGACY_RUNTIME_PATH_GUARD_PASS', base, head });
}

function commandCandidateCheck(options) {
  ensureControlPlane();
  ensureCleanWorkingTree();
  const prNumber = required(options, 'pr');
  const evidence = readJsonFile(required(options, 'evidence'));
  const epochResult = epochState(prNumber);
  const epoch = structuredClone(epochResult.state);
  if (
    ![
      'IMPLEMENTING',
      'REVIEW_READY',
      'CORRECTIVE_REQUIRED',
      'PASS_INVALIDATED_BASE_DRIFT',
      'FINAL_CORRECTIVE_REQUIRED',
    ].includes(epoch.state)
  ) {
    throw new HarnessInvariantError(
      'INVALID_CANDIDATE_STATE',
      `Epoch state ${epoch.state} cannot establish a Candidate`,
    );
  }
  const finalCorrective = epoch.state === 'FINAL_CORRECTIVE_REQUIRED';
  git('fetch', 'origin', epoch.base_branch, epoch.branch);
  const head = currentHead();
  if (currentBranch() !== epoch.branch) {
    throw new HarnessInvariantError('WRONG_EPOCH_BRANCH', `Checkout ${epoch.branch} first`);
  }
  const baseSha = git('rev-parse', `origin/${epoch.base_branch}`);
  if (evidence.base_sha !== baseSha || evidence.candidate_sha !== head) {
    throw new HarnessInvariantError(
      'FRESH_CANDIDATE_EVIDENCE_REQUIRED',
      'Evidence must name the current target base and exact branch HEAD Candidate',
      {
        evidenceBaseSha: evidence.base_sha,
        currentBaseSha: baseSha,
        evidenceCandidateSha: evidence.candidate_sha,
        currentHeadSha: head,
      },
    );
  }
  epoch.candidate_sha = head;
  epoch.validation = evidence.validation ?? epoch.validation;
  epoch.scope_closure = evidence.scope_closure;
  epoch.adversarial_preflight = evidence.adversarial_preflight;
  epoch.corrective_closure = evidence.corrective_closure ?? [];
  const checksOk = mandatoryChecksSuccessful(epochResult.view.statusCheckRollup);
  epoch.ci = {
    sha: epochResult.view.headRefOid,
    status: checksOk ? 'SUCCESS' : 'FAILED_OR_PENDING',
    url: evidence.ci?.url ?? epochResult.view.url,
  };
  if (epoch.base_sha !== baseSha) {
    if (!isAncestor(baseSha, head)) {
      throw new HarnessInvariantError(
        'BASE_DRIFT_BEFORE_REVIEW',
        'Synchronize the current target base, validate, and establish a new Candidate',
        { recordedBaseSha: epoch.base_sha, currentBaseSha: baseSha },
      );
    }
    epoch.base_sha = baseSha;
  }
  assertProductCommitHygiene(commitSubjects(epoch.base_sha));
  assertReviewReadiness({
    epoch,
    changedPaths: changedPaths(epoch.base_sha),
    branchHeadSha: head,
    prHeadSha: epochResult.view.headRefOid,
    currentBaseSha: baseSha,
  });
  if (finalCorrective) {
    epoch.state = 'FINAL_CORRECTIVE_READY';
    epoch.final_corrective_sha = head;
    epoch.final_corrective_base_sha = baseSha;
    epoch.next_action = 'AUTO_MERGE_AFTER_FINAL_CORRECTIVE';
  } else {
    epoch.state = 'REVIEW_READY';
    epoch.next_action = `RESERVE_SOL_${epoch.review.consumed + 1}`;
  }
  if (epochResult.view.isDraft) gh('pr', 'ready', String(prNumber));
  updatePr(prNumber, epoch);
  print({ state: epoch.state, candidate_sha: head, base_sha: baseSha });
}

function commandReviewReserve(options) {
  ensureControlPlane();
  ensureCleanWorkingTree();
  const runNumber = required(options, 'run');
  const prNumber = required(options, 'pr');
  const runResult = issueState(runNumber);
  const epochResult = epochState(prNumber);
  if (currentBranch() !== epochResult.state.branch) {
    throw new HarnessInvariantError(
      'WRONG_EPOCH_BRANCH',
      `Checkout ${epochResult.state.branch} before review reservation`,
    );
  }
  assertProductCommitHygiene(commitSubjects(epochResult.state.base_sha));
  assertReviewReadiness({
    epoch: epochResult.state,
    changedPaths: changedPaths(epochResult.state.base_sha),
    branchHeadSha: currentHead(),
    prHeadSha: epochResult.view.headRefOid,
    currentBaseSha: remoteBaseSha(epochResult.state.base_branch),
  });
  const reserved = reserveReview(runResult.state, epochResult.state);
  const reservationId = `review-${Date.now()}`;
  reserved.run.outer_sol.reservation_id = reservationId;
  reserved.epoch.review.reservation_id = reservationId;
  updatePr(prNumber, reserved.epoch);
  updateIssue(runNumber, reserved.run);
  print({ state: 'REVIEW_RESERVED', reservation_id: reservationId });
}

function commandReviewStarted(options) {
  ensureControlPlane();
  const runNumber = required(options, 'run');
  const prNumber = required(options, 'pr');
  const reviewerId = required(options, 'reviewer-id');
  const runResult = issueState(runNumber);
  const epochResult = epochState(prNumber);
  const started = markReviewStarted(runResult.state, epochResult.state, reviewerId);
  delete started.run.outer_sol.reservation_id;
  delete started.epoch.review.reservation_id;
  updatePr(prNumber, started.epoch);
  updateIssue(runNumber, started.run);
  print({ state: 'REVIEW_RUNNING', reviewer_id: reviewerId });
}

function commandReviewReconcile(options) {
  ensureControlPlane();
  const runNumber = required(options, 'run');
  const prNumber = required(options, 'pr');
  const runResult = issueState(runNumber);
  const epochResult = epochState(prNumber);
  const reconciled = reconcileReviewReservation(
    runResult.state,
    epochResult.state,
    options['definitely-not-started'] === true,
  );
  delete reconciled.run.outer_sol.reservation_id;
  delete reconciled.epoch.review.reservation_id;
  updatePr(prNumber, reconciled.epoch);
  updateIssue(runNumber, reconciled.run);
  print({
    state: 'REVIEW_RESERVATION_RECONCILED',
    counted_as_consumed: options['definitely-not-started'] !== true,
  });
}

function commandReviewWait(options) {
  ensureControlPlane();
  const runNumber = required(options, 'run');
  const prNumber = required(options, 'pr');
  const reviewerId = required(options, 'reviewer-id');
  const runResult = issueState(runNumber);
  const epochResult = epochState(prNumber);
  const result = waitForSameReviewer(runResult.state, epochResult.state, reviewerId);
  print({
    state: 'WAIT_TIMEOUT_REVIEWER_STILL_RUNNING',
    reviewer_id: reviewerId,
    durable_write: result.durableWrite,
    git_mutations: result.gitMutations,
    launches: result.launches,
  });
}

function commandReviewResult(options) {
  ensureControlPlane();
  const runNumber = required(options, 'run');
  const prNumber = required(options, 'pr');
  const verdict = required(options, 'verdict');
  const findings = options.findings ? readJsonFile(options.findings) : [];
  const runResult = issueState(runNumber);
  const epochResult = epochState(prNumber);
  if (verdict === 'PASS') {
    git('fetch', 'origin', epochResult.state.branch);
    assertCandidateInvariant({
      candidateSha: epochResult.state.candidate_sha,
      branchHeadSha: git('rev-parse', `origin/${epochResult.state.branch}`),
      prHeadSha: epochResult.view.headRefOid,
    });
  }
  const result = applyReviewResult(runResult.state, epochResult.state, { verdict, findings });
  updatePr(prNumber, result.epoch);
  updateIssue(runNumber, result.run);
  print({ state: result.epoch.state, outer_state: result.run.state });
}

function commandEpochPark(options) {
  ensureControlPlane();
  const runNumber = required(options, 'run');
  const prNumber = required(options, 'pr');
  const state = required(options, 'state');
  const reason = required(options, 'reason');
  if (!['PARKED_FOR_HUMAN', 'INTEGRATION_BLOCKED'].includes(state)) {
    throw new HarnessInvariantError('INVALID_PARK_STATE', `Unsupported park state: ${state}`);
  }
  const runResult = issueState(runNumber);
  const epochResult = epochState(prNumber);
  const epoch = structuredClone(epochResult.state);
  const runState = structuredClone(runResult.state);
  epoch.state = state;
  epoch.next_action = reason;
  runState.active_epoch_pr = null;
  if (!runState.parked_epoch_prs.includes(Number(prNumber))) {
    runState.parked_epoch_prs.push(Number(prNumber));
  }
  if (state === 'PARKED_FOR_HUMAN') {
    runState.state = 'ACTIVE';
    runState.next_action = 'SELECT_INDEPENDENT_SAFE_EPOCH_OR_STOP';
  } else {
    runState.state = 'INTEGRATION_BLOCKED';
    runState.next_action = `RESUME_PR_${prNumber}`;
  }
  updatePr(prNumber, epoch);
  updateIssue(runNumber, runState);
  print({ state, same_pr: Number(prNumber), branch: epoch.branch });
}

function commandEpochResumeFinalCorrective(options) {
  ensureControlPlane();
  ensureCleanWorkingTree();
  const runNumber = required(options, 'run');
  const prNumber = required(options, 'pr');
  const runResult = issueState(runNumber);
  const epochResult = epochState(prNumber);
  if (currentBranch() !== epochResult.state.branch) {
    throw new HarnessInvariantError(
      'WRONG_EPOCH_BRANCH',
      `Checkout ${epochResult.state.branch} before resuming final corrective`,
    );
  }
  const resumed = resumeReviewLimitForFinalCorrective(runResult.state, epochResult.state);
  updatePr(prNumber, resumed.epoch);
  updateIssue(runNumber, resumed.run);
  print({
    state: resumed.epoch.state,
    same_pr: Number(prNumber),
    branch: resumed.epoch.branch,
    sol_launches_remaining: 0,
  });
}

function commandEpochMerge(options) {
  ensureControlPlane();
  ensureCleanWorkingTree();
  const runNumber = required(options, 'run');
  const prNumber = required(options, 'pr');
  const runResult = issueState(runNumber);
  const epochResult = epochState(prNumber);
  const epoch = epochResult.state;
  if (!['REVIEW_PASSED', 'FINAL_CORRECTIVE_READY'].includes(epoch.state)) {
    throw new HarnessInvariantError(
      'INTEGRATION_AUTHORITY_REQUIRED',
      `Epoch state ${epoch.state} cannot enter automatic integration`,
    );
  }
  if (runResult.state.active_epoch_pr !== Number(prNumber)) {
    throw new HarnessInvariantError(
      'ACTIVE_EPOCH_MISMATCH',
      'The Run Issue does not identify this PR as its active Epoch',
    );
  }
  if (currentBranch() !== epoch.branch) {
    throw new HarnessInvariantError('WRONG_EPOCH_BRANCH', `Checkout ${epoch.branch} first`);
  }
  git('fetch', 'origin', epoch.base_branch, epoch.branch);
  const currentBaseSha = git('rev-parse', `origin/${epoch.base_branch}`);
  if (
    epoch.state === 'FINAL_CORRECTIVE_READY' &&
    epoch.final_corrective_base_sha !== currentBaseSha
  ) {
    const driftedEpoch = structuredClone(epoch);
    const driftedRun = structuredClone(runResult.state);
    driftedEpoch.state = 'FINAL_CORRECTIVE_REQUIRED';
    driftedEpoch.candidate_sha = null;
    driftedEpoch.review_pass_sha = null;
    driftedEpoch.ci = { sha: null, status: 'NOT_RUN', url: null };
    driftedEpoch.corrective_closure = [];
    driftedEpoch.final_corrective_sha = null;
    driftedEpoch.final_corrective_base_sha = null;
    driftedEpoch.next_action = 'SYNCHRONIZE_BASE_REVALIDATE_FINAL_CORRECTIVE';
    driftedRun.state = 'EPOCH_ACTIVE';
    driftedRun.active_epoch_pr = Number(prNumber);
    driftedRun.parked_epoch_prs = driftedRun.parked_epoch_prs.filter(
      (number) => number !== Number(prNumber),
    );
    driftedRun.next_action = `RESUME_PR_${prNumber}_FINAL_CORRECTIVE`;
    updatePr(prNumber, driftedEpoch);
    updateIssue(runNumber, driftedRun);
    throw new HarnessInvariantError(
      'FINAL_CORRECTIVE_BASE_DRIFT',
      'Synchronize the changed base, rerun closure validation, and establish a new exact Candidate',
      { finalCorrectiveBaseSha: epoch.final_corrective_base_sha, currentBaseSha },
    );
  }
  const finalCorrective = epoch.state === 'FINAL_CORRECTIVE_READY';
  if (!finalCorrective) {
    const baseAction = afterPassBaseAction({
      reviewedBaseSha: epoch.reviewed_base_sha,
      currentBaseSha,
      epochReview: epoch.review,
      outerReview: runResult.state.outer_sol,
    });
    if (!baseAction.ready) {
      const driftedEpoch = structuredClone(epoch);
      const driftedRun = structuredClone(runResult.state);
      driftedEpoch.candidate_sha = null;
      driftedEpoch.review_pass_sha = null;
      driftedEpoch.ci = { sha: null, status: 'NOT_RUN', url: null };
      if (baseAction.action === 'SYNCHRONIZE_VALIDATE_FINAL_CORRECTIVE') {
        driftedEpoch.state = 'FINAL_CORRECTIVE_REQUIRED';
        driftedEpoch.findings = [
          {
            id: 'base-drift-after-pass',
            priority: 'P1',
            summary:
              'Revalidate the passed Candidate after synchronizing the advanced target base.',
            acceptance:
              'Synchronize the base safely, resolve the full integration class, rerun relevant regression and mandatory validation, and establish exact-SHA CI.',
          },
        ];
        driftedEpoch.corrective_closure = [];
        driftedEpoch.final_corrective_sha = null;
        driftedEpoch.final_corrective_base_sha = null;
        driftedEpoch.final_corrective_reason = 'BASE_DRIFT_AFTER_PASS';
        driftedEpoch.next_action = 'SYNCHRONIZE_BASE_REVALIDATE_FINAL_CORRECTIVE';
        driftedRun.state = 'EPOCH_ACTIVE';
        driftedRun.active_epoch_pr = Number(prNumber);
        driftedRun.next_action = `RESUME_PR_${prNumber}_FINAL_CORRECTIVE`;
      } else {
        driftedEpoch.state = 'PASS_INVALIDATED_BASE_DRIFT';
        driftedEpoch.next_action = 'SYNCHRONIZE_VALIDATE_NEW_CANDIDATE_AND_REVIEW';
      }
      updatePr(prNumber, driftedEpoch);
      updateIssue(runNumber, driftedRun);
      throw new HarnessInvariantError(
        baseAction.code,
        'The reviewed base advanced; establish separately validated integration authority',
        { reviewedBaseSha: epoch.reviewed_base_sha, currentBaseSha },
      );
    }
  }
  assertMergeReadiness({
    epoch,
    branchHeadSha: currentHead(),
    prHeadSha: epochResult.view.headRefOid,
    currentBaseSha,
  });
  try {
    gh('pr', 'merge', String(prNumber), '--merge');
  } catch (error) {
    const blocked = recordIntegrationBlocked(
      runResult.state,
      epoch,
      error instanceof Error ? error.message : String(error),
    );
    updatePr(prNumber, blocked.epoch);
    updateIssue(runNumber, blocked.run);
    throw new HarnessInvariantError(
      'INTEGRATION_BLOCKED',
      'GitHub did not merge the PR; the same PR remains authoritative',
    );
  }
  const mergedPr = prView(prNumber);
  if (mergedPr.state !== 'MERGED' || !mergedPr.mergeCommit?.oid) {
    throw new HarnessInvariantError('INTEGRATION_BLOCKED', 'GitHub did not report MERGED');
  }
  let result;
  try {
    git('switch', epoch.base_branch);
    git('pull', '--ff-only', 'origin', epoch.base_branch);
    const ancestor = isAncestor(epoch.candidate_sha, `origin/${epoch.base_branch}`);
    if (!ancestor) {
      throw new HarnessInvariantError(
        'MERGE_VERIFICATION_FAILED',
        'The merged target does not contain the reviewed Candidate',
      );
    }
    result = completeMerge(runResult.state, epoch, {
      mergeSha: mergedPr.mergeCommit.oid,
      candidateIsAncestor: true,
    });
    if (remoteBranchExists(epoch.branch)) git('push', 'origin', '--delete', epoch.branch);
    if (git('branch', '--list', epoch.branch)) git('branch', '-d', epoch.branch);
    git('fetch', 'origin', '--prune');
  } catch (error) {
    const blocked = recordIntegrationBlocked(
      runResult.state,
      epoch,
      `PR MERGED as ${mergedPr.mergeCommit.oid}, but post-merge verification/cleanup failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    blocked.epoch.merge_sha = mergedPr.mergeCommit.oid;
    blocked.epoch.github_pr_state = 'MERGED';
    updatePr(prNumber, blocked.epoch);
    updateIssue(runNumber, blocked.run);
    throw new HarnessInvariantError(
      'INTEGRATION_BLOCKED',
      'The PR merged, but verification or cleanup failed; control state records the blocker',
    );
  }
  updatePr(prNumber, result.epoch);
  updateIssue(runNumber, result.run);
  print({
    state: 'MERGED',
    merge_sha: mergedPr.mergeCommit.oid,
    candidate_sha: epoch.candidate_sha,
    branch_cleaned: epoch.branch,
  });
}

function commandRunStop(options) {
  ensureControlPlane();
  const runNumber = required(options, 'run');
  const state = required(options, 'state');
  const nextAction = required(options, 'next-action');
  const runResult = issueState(runNumber);
  const next = structuredClone(runResult.state);
  next.state = state;
  next.next_action = nextAction;
  updateIssue(runNumber, next);
  print({ state, next_action: nextAction });
}

const commands = {
  help: commandHelp,
  status: commandStatus,
  'run:start': commandRunStart,
  'epoch:start': commandEpochStart,
  'epoch:open-pr': commandEpochOpenPr,
  'guard:legacy-paths': commandGuard,
  'candidate:check': commandCandidateCheck,
  'review:reserve': commandReviewReserve,
  'review:started': commandReviewStarted,
  'review:reconcile': commandReviewReconcile,
  'review:wait': commandReviewWait,
  'review:result': commandReviewResult,
  'epoch:park': commandEpochPark,
  'epoch:resume-final-corrective': commandEpochResumeFinalCorrective,
  'epoch:merge': commandEpochMerge,
  'run:stop': commandRunStop,
};

function main() {
  const { command, options } = parseArgs(process.argv.slice(2));
  const handler = commands[command];
  if (!handler) throw new HarnessInvariantError('UNKNOWN_COMMAND', `Unknown command: ${command}`);
  handler(options);
}

try {
  main();
} catch (error) {
  if (error instanceof HarnessInvariantError) {
    process.stderr.write(`${error.code}: ${error.message}\n`);
    if (Object.keys(error.details).length) {
      process.stderr.write(`${JSON.stringify(error.details, null, 2)}\n`);
    }
    process.exitCode = 2;
  } else {
    process.stderr.write(
      `HARNESS_ERROR: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}
