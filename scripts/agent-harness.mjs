#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  DISCOVERY_POLICY_VERSION,
  EPOCH_MARKER,
  RUN_MARKER,
  HarnessInvariantError,
  NO_OPPORTUNITY_STOP,
  afterPassBaseAction,
  applyFrontierReviewResult,
  applyReviewResult,
  assertCandidateInvariant,
  assertDiscoveryExhaustionEvidence,
  assertMergeReadiness,
  assertNoLegacyRuntimeChanges,
  assertProductCommitHygiene,
  assertReviewReadiness,
  assertRunCanStartEpoch,
  assertTrustedFrontierStop,
  classifyDiscoveryCheck,
  completeMerge,
  createEpochState,
  createRunState,
  isTerminalRunState,
  markReviewStarted,
  markFrontierReviewStarted,
  parseControlBlock,
  recordIntegrationBlocked,
  reconcileFrontierReviewReservation,
  reconcileReviewReservation,
  resumeDiscoveryAfterFrontierRejection,
  resumeReviewLimitForFinalCorrective,
  renderEpochBody,
  renderRunBody,
  reserveReview,
  reserveFrontierReview,
  waitForFrontierReviewer,
  waitForSameReviewer,
} from './lib/agent-harness-core.mjs';
import { canonicalHash, inspectFrontierLedger } from './lib/frontier-ledger.mjs';

const root = path.resolve(import.meta.dirname, '..');
const frontierLedgerPath =
  process.env.HARNESS_MOCK_STATE && process.env.HARNESS_FRONTIER_LEDGER_PATH
    ? path.resolve(process.env.HARNESS_FRONTIER_LEDGER_PATH)
    : path.join(root, 'docs/product/frontier-ledger.json');
const scenarioCatalogPath = path.join(root, 'docs/research/user-scenario-catalog.md');
const opportunityLogPath = path.join(root, 'docs/product/opportunity-log.md');
const toolCatalogPath = path.join(root, 'docs/tool-catalog.json');
const expectedOpportunityIds = Array.from(
  { length: 12 },
  (_, index) => `OP-${String(index + 1).padStart(3, '0')}`,
);
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

function expectedCatalogQuestions() {
  const questions = {};
  for (const line of fs.readFileSync(scenarioCatalogPath, 'utf8').split('\n')) {
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());
    const id = cells[0];
    if (!/^(?:G\d{2}|[DCPSTMALUR]\d{2})$/u.test(id ?? '')) continue;
    questions[id] = id.startsWith('G') ? cells[2] : cells[1];
  }
  for (const match of fs
    .readFileSync(opportunityLogPath, 'utf8')
    .matchAll(/^## (OP-\d{3}) (.+)$/gmu)) {
    questions[match[1]] =
      `Can BangumiAgentKit deliver the bounded user value described by ${match[2]}?`;
  }
  return questions;
}

function frontierContext() {
  if (!fs.existsSync(frontierLedgerPath)) {
    return {
      ok: false,
      issues: [{ code: 'FRONTIER_LEDGER_REQUIRED', message: 'Canonical ledger is missing' }],
      actionable_ids: [],
    };
  }
  const ledger = readJsonFile(frontierLedgerPath);
  const expectedQuestions = expectedCatalogQuestions();
  const scenarioIds = Object.keys(expectedQuestions).filter((id) => !id.startsWith('OP-'));
  const pathExists = (relativePath) => fs.existsSync(path.join(root, relativePath));
  const knownCapabilities = readJsonFile(toolCatalogPath).map((tool) => tool.name);
  return {
    ...inspectFrontierLedger(ledger, {
      pathExists,
      expectedScenarioIds: scenarioIds,
      expectedOpportunityIds,
      expectedQuestions,
      knownCapabilities,
      expectedPolicyVersion: DISCOVERY_POLICY_VERSION,
    }),
    ledger,
    pathExists,
    expectedScenarioIds: scenarioIds,
    expectedOpportunityIds,
    expectedQuestions,
    knownCapabilities,
  };
}

function requireValidFrontier() {
  const frontier = frontierContext();
  if (!frontier.ok) {
    const [first] = frontier.issues;
    throw new HarnessInvariantError(first.code, first.message, first.details);
  }
  return frontier;
}

function commandHelp() {
  print(`BangumiAgentKit Harness V3

Usage: pnpm harness <command> [options]

  status --run <issue> [--pr <number>]
  frontier:check
  frontier:status
  discovery:check [--now <ISO timestamp>]
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
  frontier:review-reserve --run <issue> --evidence <json>
  frontier:review-started --run <issue> --reviewer-id <id>
  frontier:review-reconcile --run <issue> [--definitely-not-started]
  frontier:review-wait --run <issue> --reviewer-id <id>
  frontier:review-result --run <issue> --verdict <PASS|DISCOVERY_REQUIRED> [--findings <json>]
  frontier:resume-discovery --run <issue>
  epoch:park --run <issue> --pr <number> --state <state> --reason <text>
  epoch:resume-final-corrective --run <issue> --pr <number>
  epoch:merge --run <issue> --pr <number>
  run:stop --run <issue> --state <state> --next-action <text> [--evidence <json>]

Complex Epoch selection and Candidate evidence are supplied as local JSON input;
the durable source becomes the edited GitHub Issue/PR body.`);
}

function commandFrontierCheck() {
  const frontier = requireValidFrontier();
  print({
    state: 'FRONTIER_LEDGER_VALID',
    schema: frontier.ledger.schema,
    version: frontier.ledger.version,
    policy_version: frontier.ledger.policy_version,
    ledger_hash: frontier.hash,
    counts: frontier.counts,
    actionable_count: frontier.actionable_ids.length,
  });
}

function commandFrontierStatus() {
  const frontier = requireValidFrontier();
  print({
    state: frontier.actionable_ids.length
      ? 'FRONTIER_RESEARCH_REQUIRED'
      : 'FRONTIER_REVIEW_REQUIRED',
    ledger_hash: frontier.hash,
    counts: frontier.counts,
    next_candidates: frontier.records
      .filter((record) => frontier.actionable_ids.includes(record.id))
      .slice(0, 20)
      .map(({ id, status, lane, user_question, next_action }) => ({
        id,
        status,
        lane,
        user_question,
        next_action,
      })),
  });
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

function commandDiscoveryCheck(options) {
  ensureControlPlane();
  ensureCleanWorkingTree();
  if (currentBranch() !== 'master') {
    throw new HarnessInvariantError(
      'DISCOVERY_CHECK_MUST_RUN_ON_MASTER',
      'Discovery check runs only from master',
    );
  }
  const currentBaseSha = remoteBaseSha('master');
  if (currentHead() !== currentBaseSha) {
    throw new HarnessInvariantError(
      'MASTER_NOT_SYNCHRONIZED',
      'Discovery check requires master to equal origin/master',
    );
  }
  const openRuns = JSON.parse(
    gh(
      'issue',
      'list',
      '--state',
      'open',
      '--limit',
      '100',
      '--json',
      'number,title,body,state,url,createdAt,updatedAt,closedAt',
    ),
  ).filter((issue) => issue.body?.includes(`<!-- ${RUN_MARKER}:start -->`));
  const openEpochPrs = JSON.parse(
    gh(
      'pr',
      'list',
      '--state',
      'open',
      '--limit',
      '100',
      '--json',
      'number,title,body,state,url,createdAt,updatedAt',
    ),
  ).filter((pr) => pr.body?.includes(`<!-- ${EPOCH_MARKER}:start -->`));
  let latestClosedRun;
  if (openRuns.length === 0 && openEpochPrs.length === 0) {
    const closedRuns = JSON.parse(
      gh(
        'issue',
        'list',
        '--state',
        'closed',
        '--limit',
        '100',
        '--json',
        'number,title,body,state,url,createdAt,updatedAt,closedAt',
      ),
    )
      .filter((issue) => issue.body?.includes(`<!-- ${RUN_MARKER}:start -->`))
      .sort((left, right) =>
        String(right.closedAt ?? right.updatedAt).localeCompare(
          String(left.closedAt ?? left.updatedAt),
        ),
      );
    latestClosedRun = closedRuns[0];
  }
  const rawNow = options.now ?? process.env.HARNESS_NOW;
  const now = rawNow ? Date.parse(String(rawNow)) : Date.now();
  if (!Number.isFinite(now)) {
    throw new HarnessInvariantError('INVALID_TIMESTAMP', '--now must be a valid ISO timestamp');
  }
  const frontier = frontierContext();
  const result = classifyDiscoveryCheck({
    openRunNumbers: openRuns.map((issue) => issue.number),
    openEpochPrNumbers: openEpochPrs.map((pr) => pr.number),
    latestRunState: latestClosedRun
      ? parseControlBlock(latestClosedRun.body, RUN_MARKER)
      : undefined,
    currentBaseSha,
    frontier,
    now,
  });
  print({
    ...result,
    latest_closed_run_issue: latestClosedRun?.number ?? null,
    current_sha: currentBaseSha,
    ledger_hash: frontier.hash ?? null,
  });
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
  const openRuns = JSON.parse(
    gh(
      'issue',
      'list',
      '--state',
      'open',
      '--limit',
      '100',
      '--json',
      'number,title,body,state,url',
    ),
  )
    .filter((issue) => issue.body?.includes(`<!-- ${RUN_MARKER}:start -->`))
    .map((issue) => ({ ...issue, run: parseControlBlock(issue.body, RUN_MARKER) }));
  const terminalRuns = openRuns.filter((issue) => isTerminalRunState(issue.run.state));
  const resumableRuns = openRuns.filter((issue) => !isTerminalRunState(issue.run.state));
  if (resumableRuns.length > 1) {
    throw new HarnessInvariantError(
      'MULTIPLE_OPEN_OUTER_RUNS',
      'More than one resumable Outer Run exists; do not guess which control plane is authoritative',
      { issues: resumableRuns.map((issue) => issue.number) },
    );
  }
  if (resumableRuns.length === 1) {
    for (const issue of terminalRuns) {
      gh('issue', 'close', String(issue.number), '--reason', 'completed');
    }
    const existing = resumableRuns[0];
    print({ state: 'RUN_RESUMED', url: existing.url, issue: existing.number, run: existing.run });
    return;
  }
  const title = required(options, 'title').replace(/^(?:\[Harness V3 Run\]\s*)+/u, '');
  for (const issue of terminalRuns) {
    gh('issue', 'close', String(issue.number), '--reason', 'completed');
  }
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
  const frontier = requireValidFrontier();
  const frontierIds = spec.advances_frontier_ids;
  if (!Array.isArray(frontierIds) || frontierIds.length === 0) {
    throw new HarnessInvariantError(
      'EPOCH_FRONTIER_REQUIRED',
      'A Product Epoch must advance at least one canonical frontier id',
    );
  }
  if (new Set(frontierIds).size !== frontierIds.length) {
    throw new HarnessInvariantError(
      'EPOCH_FRONTIER_INVALID',
      'advances_frontier_ids must not contain duplicates',
    );
  }
  const frontierById = new Map(frontier.records.map((record) => [record.id, record]));
  for (const id of frontierIds) {
    if (!frontier.actionable_ids.includes(id)) {
      throw new HarnessInvariantError(
        'EPOCH_FRONTIER_INVALID',
        `Epoch frontier ${id} is missing or already closed`,
      );
    }
  }
  if (!Array.isArray(spec.non_scope) || spec.non_scope.length === 0) {
    throw new HarnessInvariantError(
      'EPOCH_NON_SCOPE_UNMAPPED',
      'A Product Epoch must record at least one explicit mapped non-scope item',
    );
  }
  for (const [index, item] of spec.non_scope.entries()) {
    const mapping = item?.mapping;
    const valid =
      typeof item?.description === 'string' &&
      ((mapping?.kind === 'frontier' && frontierById.has(mapping.id)) ||
        (mapping?.kind === 'boundary' &&
          frontier.ledger.protected_boundaries.some((boundary) => boundary.id === mapping.id)) ||
        (mapping?.kind === 'non_product' && typeof mapping.reason === 'string'));
    if (!valid) {
      throw new HarnessInvariantError(
        'EPOCH_NON_SCOPE_UNMAPPED',
        `non_scope[${index}] must map to a frontier, Charter boundary, or non-product reason`,
      );
    }
  }
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
    advancesFrontierIds: frontierIds,
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
  const candidatePaths = changedPaths(epoch.base_sha);
  if (
    (epoch.advances_frontier_ids?.length ?? 0) > 0 &&
    !candidatePaths.includes('docs/product/frontier-ledger.json')
  ) {
    throw new HarnessInvariantError(
      'FRONTIER_LEDGER_UPDATE_REQUIRED',
      'A Product Epoch must update the canonical records it advances',
    );
  }
  if ((epoch.advances_frontier_ids?.length ?? 0) > 0) {
    const baseLedger = JSON.parse(
      git('show', `${epoch.base_sha}:docs/product/frontier-ledger.json`),
    );
    const currentLedger = requireValidFrontier().ledger;
    const baseById = new Map(baseLedger.records.map((record) => [record.id, record]));
    const currentById = new Map(currentLedger.records.map((record) => [record.id, record]));
    const unchanged = epoch.advances_frontier_ids.filter(
      (id) => canonicalHash(baseById.get(id)) === canonicalHash(currentById.get(id)),
    );
    if (unchanged.length > 0) {
      throw new HarnessInvariantError(
        'FRONTIER_RECORD_NOT_ADVANCED',
        'Every declared frontier id must receive a material ledger update',
        { unchanged },
      );
    }
  }
  if (
    candidatePaths.includes('docs/product/frontier-ledger.json') &&
    !candidatePaths.some((file) => /^(?:apps|packages|tests)\//u.test(file))
  ) {
    throw new HarnessInvariantError(
      'FRONTIER_STATUS_ONLY_CHANGE',
      'Frontier ledger transitions require durable implementation or test evidence',
    );
  }
  assertProductCommitHygiene(commitSubjects(epoch.base_sha));
  assertReviewReadiness({
    epoch,
    changedPaths: candidatePaths,
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

function commandFrontierReviewReserve(options) {
  ensureControlPlane();
  ensureCleanWorkingTree();
  const runNumber = required(options, 'run');
  const evidence = readJsonFile(required(options, 'evidence'));
  const runResult = issueState(runNumber);
  if (currentBranch() !== 'master') {
    throw new HarnessInvariantError(
      'FRONTIER_REVIEW_MUST_RUN_ON_MASTER',
      'Frontier closure review must start from synchronized master',
    );
  }
  const baseSha = remoteBaseSha('master');
  if (currentHead() !== baseSha) {
    throw new HarnessInvariantError('MASTER_NOT_SYNCHRONIZED', 'master must equal origin/master');
  }
  const frontier = requireValidFrontier();
  assertDiscoveryExhaustionEvidence(evidence, baseSha, frontier);
  let next;
  try {
    next = reserveFrontierReview(runResult.state, {
      baseSha,
      ledgerHash: frontier.hash,
      evidenceHash: canonicalHash(evidence),
    });
  } catch (error) {
    if (
      !(error instanceof HarnessInvariantError) ||
      !['FRONTIER_REVIEW_BUDGET_EXHAUSTED', 'FRONTIER_REVIEW_REJECTED'].includes(error.code)
    ) {
      throw error;
    }
    next = structuredClone(runResult.state);
    next.state = 'STOPPED_RUN_BUDGET_EXHAUSTED_RESUMABLE';
    next.next_action = 'START_NEW_OUTER_RUN_TO_CONTINUE_FRONTIER_DISCOVERY';
    updateIssue(runNumber, next);
    gh('issue', 'close', String(runNumber), '--reason', 'completed');
    print({ state: next.state, issue_state: 'CLOSED' });
    return;
  }
  updateIssue(runNumber, next);
  print({
    state: 'FRONTIER_REVIEW_REQUIRED',
    base_sha: baseSha,
    ledger_hash: frontier.hash,
    evidence_hash: canonicalHash(evidence),
  });
}

function commandFrontierReviewReconcile(options) {
  ensureControlPlane();
  const runNumber = required(options, 'run');
  const runResult = issueState(runNumber);
  const next = reconcileFrontierReviewReservation(
    runResult.state,
    options['definitely-not-started'] === true,
  );
  updateIssue(runNumber, next);
  print({
    state: next.state,
    counted_as_consumed: options['definitely-not-started'] !== true,
  });
}

function commandFrontierReviewStarted(options) {
  ensureControlPlane();
  const runNumber = required(options, 'run');
  const reviewerId = required(options, 'reviewer-id');
  const runResult = issueState(runNumber);
  const next = markFrontierReviewStarted(runResult.state, reviewerId);
  updateIssue(runNumber, next);
  print({ state: 'FRONTIER_REVIEW_RUNNING', reviewer_id: reviewerId });
}

function commandFrontierReviewWait(options) {
  ensureControlPlane();
  const runNumber = required(options, 'run');
  const reviewerId = required(options, 'reviewer-id');
  const runResult = issueState(runNumber);
  const result = waitForFrontierReviewer(runResult.state, reviewerId);
  print({
    state: 'WAIT_TIMEOUT_FRONTIER_REVIEWER_STILL_RUNNING',
    reviewer_id: reviewerId,
    durable_write: result.durableWrite,
    git_mutations: result.gitMutations,
    launches: result.launches,
  });
}

function commandFrontierReviewResult(options) {
  ensureControlPlane();
  const runNumber = required(options, 'run');
  const verdict = required(options, 'verdict');
  const findings = options.findings ? readJsonFile(options.findings) : [];
  const runResult = issueState(runNumber);
  const next = applyFrontierReviewResult(runResult.state, { verdict, findings });
  updateIssue(runNumber, next);
  print({ state: next.state, verdict });
}

function commandFrontierResumeDiscovery(options) {
  ensureControlPlane();
  const runNumber = required(options, 'run');
  const runResult = issueState(runNumber);
  const next = resumeDiscoveryAfterFrontierRejection(runResult.state);
  updateIssue(runNumber, next);
  print({ state: next.state, closure_state: next.frontier_closure.state });
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
    outerSol: runResult.state.outer_sol,
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
  if (state === NO_OPPORTUNITY_STOP) {
    if (next.active_epoch_pr || next.pending_epoch) {
      throw new HarnessInvariantError(
        'ACTIVE_EPOCH_EXISTS',
        'Trusted frontier exhaustion cannot abandon an active or pending Epoch',
      );
    }
    ensureCleanWorkingTree();
    if (currentBranch() !== 'master') {
      throw new HarnessInvariantError(
        'DISCOVERY_MUST_FINISH_ON_MASTER',
        'No-opportunity discovery must finish on synchronized master',
      );
    }
    const currentBaseSha = remoteBaseSha('master');
    if (currentHead() !== currentBaseSha) {
      throw new HarnessInvariantError(
        'MASTER_NOT_SYNCHRONIZED',
        'No-opportunity discovery evidence must cover synchronized master',
      );
    }
    const evidence = readJsonFile(required(options, 'evidence'));
    const frontier = requireValidFrontier();
    assertDiscoveryExhaustionEvidence(evidence, currentBaseSha, frontier);
    const evidenceHash = canonicalHash(evidence);
    assertTrustedFrontierStop(next, {
      baseSha: currentBaseSha,
      ledgerHash: frontier.hash,
      evidenceHash,
    });
    next.discovery_exhaustion = evidence;
  }
  next.state = state;
  next.next_action = nextAction;
  updateIssue(runNumber, next);
  gh('issue', 'close', String(runNumber), '--reason', 'completed');
  print({ state, next_action: nextAction, issue_state: 'CLOSED' });
}

const commands = {
  help: commandHelp,
  status: commandStatus,
  'frontier:check': commandFrontierCheck,
  'frontier:status': commandFrontierStatus,
  'discovery:check': commandDiscoveryCheck,
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
  'frontier:review-reserve': commandFrontierReviewReserve,
  'frontier:review-started': commandFrontierReviewStarted,
  'frontier:review-reconcile': commandFrontierReviewReconcile,
  'frontier:review-wait': commandFrontierReviewWait,
  'frontier:review-result': commandFrontierReviewResult,
  'frontier:resume-discovery': commandFrontierResumeDiscovery,
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
