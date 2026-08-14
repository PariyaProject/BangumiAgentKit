export const SCHEMA = 'bangumi-harness/v3';
export const RUN_MARKER = 'bangumi-harness:v3:outer-run';
export const EPOCH_MARKER = 'bangumi-harness:v3:epoch';
export const DEFAULT_INTEGRATION = 'AUTO_MERGE_AFTER_PASS';
export const MAX_EPOCH_REVIEWS = 2;
export const MAX_OUTER_REVIEWS = 4;

export const LEGACY_RUNTIME_PATHS = [
  'docs/product/loop-status.md',
  'docs/product/cycles/',
  'docs/product/reviews/',
];

export class HarnessInvariantError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'HarnessInvariantError';
    this.code = code;
    this.details = details;
  }
}

function cloneState(value) {
  return structuredClone(value);
}

function requireText(value, code, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new HarnessInvariantError(code, `${field} must be a non-empty string`, { field });
  }
}

function assertLedger(ledger, label, hardMax) {
  for (const field of ['max', 'consumed', 'reserved']) {
    if (!Number.isInteger(ledger?.[field]) || ledger[field] < 0) {
      throw new HarnessInvariantError('INVALID_REVIEW_LEDGER', `${label}.${field} is invalid`);
    }
  }
  if (
    !Number.isInteger(ledger.max) ||
    ledger.max > hardMax ||
    ledger.reserved > 1 ||
    ledger.consumed + ledger.reserved > ledger.max
  ) {
    throw new HarnessInvariantError('INVALID_REVIEW_LEDGER', `${label} exceeds its hard ceiling`);
  }
}

export function createRunState({
  runId,
  profile = 'AUTONOMOUS_EVOLUTION',
  outerSolMax = 4,
  nextAction = 'SELECT_OR_RESUME_EPOCH',
}) {
  requireText(runId, 'INVALID_RUN', 'run_id');
  const outerSol = { max: outerSolMax, consumed: 0, reserved: 0 };
  assertLedger(outerSol, 'run.outer_sol', MAX_OUTER_REVIEWS);
  return {
    schema: SCHEMA,
    kind: 'outer-run',
    run_id: runId,
    profile,
    state: 'ACTIVE',
    outer_sol: outerSol,
    active_epoch_pr: null,
    pending_epoch: null,
    parked_epoch_prs: [],
    last_merged_epoch_pr: null,
    next_action: nextAction,
  };
}

export function createEpochState({
  epochId,
  baseSha,
  baseBranch = 'master',
  objective,
  questions = [],
  workPackages = [],
  nonScope = [],
  acceptanceCriteria = [],
  expectedReviews = 1,
  maxReviews = 2,
}) {
  requireText(epochId, 'INVALID_EPOCH', 'epoch_id');
  requireText(baseSha, 'INVALID_EPOCH', 'base_sha');
  requireText(objective, 'INVALID_EPOCH', 'objective');
  const review = {
    expected: expectedReviews,
    max: maxReviews,
    consumed: 0,
    reserved: 0,
    reviewer_id: null,
  };
  assertLedger(review, 'epoch.review', MAX_EPOCH_REVIEWS);
  if (!Number.isInteger(expectedReviews) || expectedReviews < 0 || expectedReviews > maxReviews) {
    throw new HarnessInvariantError(
      'INVALID_REVIEW_LEDGER',
      'epoch.review.expected must be within its hard ceiling',
    );
  }
  return {
    schema: SCHEMA,
    kind: 'epoch',
    epoch_id: epochId,
    state: 'SELECTED',
    base_sha: baseSha,
    base_branch: baseBranch,
    candidate_sha: null,
    reviewed_base_sha: null,
    review_pass_sha: null,
    ci: { sha: null, status: 'NOT_RUN', url: null },
    review,
    integration: DEFAULT_INTEGRATION,
    objective,
    questions,
    work_packages: workPackages,
    non_scope: nonScope,
    acceptance_criteria: acceptanceCriteria,
    validation: [],
    scope_closure: {
      why_not_review_earlier: '',
      why_not_extend_further: '',
      related_work_remaining: true,
    },
    adversarial_preflight: { completed: false, summary: '' },
    findings: [],
    review_history: [],
    corrective_closure: [],
    final_corrective_sha: null,
    final_corrective_base_sha: null,
    final_corrective_reason: null,
    branch: null,
    pr_number: null,
    next_action: 'IMPLEMENT_FIRST_WORK_PACKAGE',
  };
}

export function isLegacyRuntimePath(filePath) {
  const normalized = filePath.replaceAll('\\', '/').replace(/^\.\//u, '');
  return LEGACY_RUNTIME_PATHS.some((entry) =>
    entry.endsWith('/') ? normalized.startsWith(entry) : normalized === entry,
  );
}

export function assertNoLegacyRuntimeChanges(paths) {
  const violations = [...new Set(paths.filter(isLegacyRuntimePath))].sort();
  if (violations.length > 0) {
    throw new HarnessInvariantError(
      'LEGACY_RUNTIME_PATH_CHANGED',
      'V3 Product Epochs must not modify legacy runtime-state paths',
      { violations },
    );
  }
  return true;
}

export function assertProductCommitHygiene(subjects) {
  const runtimeTransition =
    /(?:plan activation|validation complete|review readiness|ci green|candidate|review (?:authorization|start|wait|poll|verdict|result)|freeze|park(?:ed)?(?: state)?|merge state|cleanup state|outer ledger|review ledger|run state|epoch state)/iu;
  const durableEngineering =
    /^(?:feat|fix|test|refactor|perf|build)(?:\([^)]*\))?:\s+\S|^docs\((?:product|capability|api|renderer|standalone|agent-ux)\):\s+\S/u;
  const runtimeOnly = subjects.filter(
    (subject) => runtimeTransition.test(subject) || !durableEngineering.test(subject),
  );
  if (runtimeOnly.length > 0) {
    throw new HarnessInvariantError(
      'RUNTIME_ONLY_COMMIT_REJECTED',
      'Normal Product history must not contain runtime-state commits',
      { subjects: runtimeOnly },
    );
  }
  return true;
}

export function assertRunCanStartEpoch(run) {
  if (run?.state !== 'ACTIVE') {
    throw new HarnessInvariantError(
      'RUN_NOT_ACTIVE',
      `Run state ${run?.state ?? 'UNKNOWN'} cannot start another Epoch`,
    );
  }
  if (run.active_epoch_pr || run.pending_epoch) {
    throw new HarnessInvariantError('ACTIVE_EPOCH_EXISTS', 'Resume the existing Epoch first');
  }
  return true;
}

export function assertScopeClosure(scopeClosure) {
  requireText(
    scopeClosure?.why_not_review_earlier,
    'SCOPE_CLOSURE_INCOMPLETE',
    'why_not_review_earlier',
  );
  requireText(
    scopeClosure?.why_not_extend_further,
    'SCOPE_CLOSURE_INCOMPLETE',
    'why_not_extend_further',
  );
  if (scopeClosure.related_work_remaining !== false) {
    throw new HarnessInvariantError(
      'MICRO_EPOCH_SCOPE_OPEN',
      'Closely related high-value Work Packages remain; continue Luna engineering',
    );
  }
  return true;
}

export function assertAdversarialPreflight(preflight) {
  if (preflight?.completed !== true) {
    throw new HarnessInvariantError(
      'ADVERSARIAL_PREFLIGHT_INCOMPLETE',
      'The consolidated Luna falsification pass is incomplete',
    );
  }
  requireText(preflight.summary, 'ADVERSARIAL_PREFLIGHT_INCOMPLETE', 'preflight.summary');
  return true;
}

function requireTextArray(value, code, field) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new HarnessInvariantError(code, `${field} must be a non-empty array`, { field });
  }
  value.forEach((item, index) => requireText(item, code, `${field}[${index}]`));
}

function normalizeFindings(findings, reviewNumber) {
  if (!Array.isArray(findings)) {
    throw new HarnessInvariantError('INVALID_REVIEW_FINDINGS', 'findings must be an array');
  }
  const normalized = findings.map((finding, index) => {
    if (!finding || typeof finding !== 'object' || Array.isArray(finding)) {
      throw new HarnessInvariantError(
        'INVALID_REVIEW_FINDINGS',
        `findings[${index}] must be an object`,
      );
    }
    requireText(finding.summary, 'INVALID_REVIEW_FINDINGS', `findings[${index}].summary`);
    return {
      ...finding,
      id: finding.id || `sol-${reviewNumber}-finding-${index + 1}`,
    };
  });
  if (new Set(normalized.map((finding) => finding.id)).size !== normalized.length) {
    throw new HarnessInvariantError(
      'INVALID_REVIEW_FINDINGS',
      'Finding ids must be unique within one review result',
    );
  }
  return normalized;
}

export function assertCorrectiveClosure(epoch, closure = epoch?.corrective_closure) {
  const findings = epoch?.findings ?? [];
  if (findings.length === 0) return true;
  if (!Array.isArray(closure)) {
    throw new HarnessInvariantError(
      'CORRECTIVE_CLOSURE_INCOMPLETE',
      'Corrective closure must cover every active finding',
    );
  }
  const findingIds = new Set(findings.map((finding) => finding.id));
  if (findingIds.has(undefined) || findingIds.size !== findings.length) {
    throw new HarnessInvariantError(
      'CORRECTIVE_CLOSURE_INCOMPLETE',
      'Every active finding must have one stable unique id',
    );
  }
  const seen = new Set();
  for (const [index, item] of closure.entries()) {
    requireText(
      item?.finding_id,
      'CORRECTIVE_CLOSURE_INCOMPLETE',
      `corrective_closure[${index}].finding_id`,
    );
    if (!findingIds.has(item.finding_id) || seen.has(item.finding_id)) {
      throw new HarnessInvariantError(
        'CORRECTIVE_CLOSURE_INCOMPLETE',
        'Corrective closure must map exactly once to every active finding',
        { findingId: item.finding_id },
      );
    }
    seen.add(item.finding_id);
    for (const field of ['root_cause', 'equivalence_class', 'generalized_fix']) {
      requireText(
        item[field],
        'CORRECTIVE_CLOSURE_INCOMPLETE',
        `corrective_closure[${index}].${field}`,
      );
    }
    requireTextArray(
      item.regression_tests,
      'CORRECTIVE_CLOSURE_INCOMPLETE',
      `corrective_closure[${index}].regression_tests`,
    );
    requireTextArray(
      item.validation,
      'CORRECTIVE_CLOSURE_INCOMPLETE',
      `corrective_closure[${index}].validation`,
    );
  }
  if (seen.size !== findingIds.size) {
    throw new HarnessInvariantError(
      'CORRECTIVE_CLOSURE_INCOMPLETE',
      'Corrective closure must cover every active finding',
      { expected: [...findingIds], actual: [...seen] },
    );
  }
  return true;
}

export function assertCandidateInvariant({ candidateSha, branchHeadSha, prHeadSha }) {
  requireText(candidateSha, 'CANDIDATE_INVARIANT_FAILED', 'candidate_sha');
  if (candidateSha !== branchHeadSha || candidateSha !== prHeadSha) {
    throw new HarnessInvariantError(
      'CANDIDATE_INVARIANT_FAILED',
      'Candidate SHA must equal feature branch HEAD and PR head SHA',
      { candidateSha, branchHeadSha, prHeadSha },
    );
  }
  return true;
}

export function assertExactShaCi({ candidateSha, ciSha, ciStatus }) {
  if (candidateSha !== ciSha || ciStatus !== 'SUCCESS') {
    throw new HarnessInvariantError(
      'EXACT_SHA_CI_REQUIRED',
      'Mandatory remote CI must pass on the exact Candidate SHA',
      { candidateSha, ciSha, ciStatus },
    );
  }
  return true;
}

export function beforeReviewBaseAction({ recordedBaseSha, currentBaseSha }) {
  requireText(recordedBaseSha, 'INVALID_BASE', 'recordedBaseSha');
  requireText(currentBaseSha, 'INVALID_BASE', 'currentBaseSha');
  return recordedBaseSha === currentBaseSha
    ? { ready: true, action: 'CONTINUE_TO_REVIEW' }
    : {
        ready: false,
        action: 'SYNCHRONIZE_VALIDATE_NEW_CANDIDATE',
        code: 'BASE_DRIFT_BEFORE_REVIEW',
      };
}

export function afterPassBaseAction({ reviewedBaseSha, currentBaseSha, epochReview, outerReview }) {
  if (reviewedBaseSha === currentBaseSha) {
    return { ready: true, action: 'AUTO_MERGE' };
  }
  assertLedger(epochReview, 'epoch.review', MAX_EPOCH_REVIEWS);
  assertLedger(outerReview, 'run.outer_sol', MAX_OUTER_REVIEWS);
  const budgetRemains =
    epochReview.consumed + epochReview.reserved < epochReview.max &&
    outerReview.consumed + outerReview.reserved < outerReview.max;
  return budgetRemains
    ? {
        ready: false,
        action: 'SYNCHRONIZE_VALIDATE_NEW_CANDIDATE_AND_REVIEW',
        code: 'PASS_INVALIDATED_BASE_DRIFT',
      }
    : {
        ready: false,
        action: 'SYNCHRONIZE_VALIDATE_FINAL_CORRECTIVE',
        code: 'FINAL_CORRECTIVE_BASE_SYNC_REQUIRED',
      };
}

export function assertReviewReadiness({
  epoch,
  changedPaths,
  branchHeadSha,
  prHeadSha,
  currentBaseSha,
}) {
  assertNoLegacyRuntimeChanges(changedPaths);
  assertScopeClosure(epoch.scope_closure);
  assertAdversarialPreflight(epoch.adversarial_preflight);
  assertCorrectiveClosure(epoch);
  assertCandidateInvariant({
    candidateSha: epoch.candidate_sha,
    branchHeadSha,
    prHeadSha,
  });
  assertExactShaCi({
    candidateSha: epoch.candidate_sha,
    ciSha: epoch.ci?.sha,
    ciStatus: epoch.ci?.status,
  });
  const base = beforeReviewBaseAction({
    recordedBaseSha: epoch.base_sha,
    currentBaseSha,
  });
  if (!base.ready) {
    throw new HarnessInvariantError(base.code, 'Target base advanced before review', {
      recordedBaseSha: epoch.base_sha,
      currentBaseSha,
    });
  }
  return true;
}

export function reserveReview(run, epoch) {
  const nextRun = cloneState(run);
  const nextEpoch = cloneState(epoch);
  assertLedger(nextRun.outer_sol, 'run.outer_sol', MAX_OUTER_REVIEWS);
  assertLedger(nextEpoch.review, 'epoch.review', MAX_EPOCH_REVIEWS);
  if (nextRun.outer_sol.reserved || nextEpoch.review.reserved) {
    throw new HarnessInvariantError(
      'REVIEW_RESERVATION_EXISTS',
      'Reconcile the existing reservation before another launch',
    );
  }
  if (
    nextRun.outer_sol.consumed >= nextRun.outer_sol.max ||
    nextEpoch.review.consumed >= nextEpoch.review.max
  ) {
    throw new HarnessInvariantError('REVIEW_BUDGET_EXHAUSTED', 'No review launch remains');
  }
  if (nextEpoch.state !== 'REVIEW_READY') {
    throw new HarnessInvariantError(
      'REVIEW_NOT_READY',
      `Epoch state ${nextEpoch.state} cannot reserve a reviewer`,
    );
  }
  nextRun.outer_sol.reserved = 1;
  nextEpoch.review.reserved = 1;
  nextEpoch.state = 'REVIEW_RESERVED';
  nextEpoch.next_action = 'START_RESERVED_REVIEWER';
  return { run: nextRun, epoch: nextEpoch };
}

export function markReviewStarted(run, epoch, reviewerId) {
  requireText(reviewerId, 'INVALID_REVIEWER', 'reviewer_id');
  const nextRun = cloneState(run);
  const nextEpoch = cloneState(epoch);
  assertLedger(nextRun.outer_sol, 'run.outer_sol', MAX_OUTER_REVIEWS);
  assertLedger(nextEpoch.review, 'epoch.review', MAX_EPOCH_REVIEWS);
  if (nextRun.outer_sol.reserved !== 1 || nextEpoch.review.reserved !== 1) {
    throw new HarnessInvariantError(
      'REVIEW_NOT_RESERVED',
      'Reserve both Epoch and outer slots before reviewer start',
    );
  }
  if (
    nextRun.outer_sol.reservation_id &&
    nextEpoch.review.reservation_id &&
    nextRun.outer_sol.reservation_id !== nextEpoch.review.reservation_id
  ) {
    throw new HarnessInvariantError(
      'REVIEW_RESERVATION_MISMATCH',
      'Epoch and outer reservation ids do not match',
    );
  }
  const previousReview = nextEpoch.review_history?.at(-1);
  if (
    nextEpoch.review.consumed > 0 &&
    previousReview?.reviewer_id &&
    previousReview.reviewer_id !== reviewerId
  ) {
    throw new HarnessInvariantError(
      'SAME_REVIEWER_REQUIRED',
      'Sol #2 must continue the same reviewer identity',
      { expected: previousReview.reviewer_id, actual: reviewerId },
    );
  }
  nextRun.outer_sol.reserved = 0;
  nextRun.outer_sol.consumed += 1;
  nextEpoch.review.reserved = 0;
  nextEpoch.review.consumed += 1;
  nextEpoch.review.reviewer_id = reviewerId;
  nextEpoch.reviewed_base_sha = nextEpoch.base_sha;
  nextEpoch.state = 'REVIEW_RUNNING';
  nextEpoch.next_action = 'WAIT_SAME_REVIEWER';
  return { run: nextRun, epoch: nextEpoch };
}

export function reconcileReviewReservation(run, epoch, launchDefinitelyDidNotOccur) {
  const nextRun = cloneState(run);
  const nextEpoch = cloneState(epoch);
  assertLedger(nextRun.outer_sol, 'run.outer_sol', MAX_OUTER_REVIEWS);
  assertLedger(nextEpoch.review, 'epoch.review', MAX_EPOCH_REVIEWS);
  if (nextRun.outer_sol.reserved !== 1 && nextEpoch.review.reserved !== 1) {
    throw new HarnessInvariantError('NO_REVIEW_RESERVATION', 'No reservation exists');
  }
  nextRun.outer_sol.reserved = 0;
  nextEpoch.review.reserved = 0;
  if (!launchDefinitelyDidNotOccur) {
    nextRun.outer_sol.consumed += 1;
    nextEpoch.review.consumed += 1;
  }
  nextEpoch.state = 'REVIEW_RESERVATION_RECONCILED';
  nextEpoch.next_action = 'REASSESS_REVIEW_BUDGET';
  return { run: nextRun, epoch: nextEpoch };
}

export function waitForSameReviewer(run, epoch, reviewerId) {
  if (epoch.state !== 'REVIEW_RUNNING' || epoch.review?.reviewer_id !== reviewerId) {
    throw new HarnessInvariantError(
      'REVIEWER_ID_MISMATCH',
      'Polling is allowed only for the currently running reviewer',
    );
  }
  return { run, epoch, durableWrite: false, gitMutations: 0, launches: 0 };
}

export function applyReviewResult(run, epoch, { verdict, findings = [] }) {
  const nextRun = cloneState(run);
  const nextEpoch = cloneState(epoch);
  assertLedger(nextRun.outer_sol, 'run.outer_sol', MAX_OUTER_REVIEWS);
  assertLedger(nextEpoch.review, 'epoch.review', MAX_EPOCH_REVIEWS);
  if (nextEpoch.state !== 'REVIEW_RUNNING') {
    throw new HarnessInvariantError(
      'REVIEW_NOT_RUNNING',
      'No running reviewer can return a result',
    );
  }
  const reviewerId = nextEpoch.review.reviewer_id;
  const normalizedFindings = normalizeFindings(findings, nextEpoch.review.consumed);
  if (verdict === 'CORRECTIVE_REQUIRED' && normalizedFindings.length === 0) {
    throw new HarnessInvariantError(
      'INVALID_REVIEW_FINDINGS',
      'A corrective verdict must include at least one actionable finding',
    );
  }
  nextEpoch.review_history ??= [];
  nextEpoch.review_history.push({
    review_number: nextEpoch.review.consumed,
    reviewer_id: reviewerId,
    candidate_sha: nextEpoch.candidate_sha,
    reviewed_base_sha: nextEpoch.reviewed_base_sha,
    verdict,
    findings: normalizedFindings,
  });
  nextEpoch.review.reviewer_id = null;
  nextEpoch.findings = normalizedFindings;
  if (verdict === 'PASS') {
    nextEpoch.state = 'REVIEW_PASSED';
    nextEpoch.review_pass_sha = nextEpoch.candidate_sha;
    nextEpoch.next_action = 'AUTO_MERGE_AFTER_PASS';
  } else if (verdict === 'HUMAN_REVIEW_REQUIRED') {
    nextEpoch.state = 'PARKED_FOR_HUMAN';
    nextEpoch.next_action = 'AWAIT_HUMAN';
    nextRun.active_epoch_pr = null;
    if (!nextRun.parked_epoch_prs.includes(nextEpoch.pr_number)) {
      nextRun.parked_epoch_prs.push(nextEpoch.pr_number);
    }
    nextRun.next_action = 'SELECT_INDEPENDENT_SAFE_EPOCH_OR_STOP';
    nextRun.state = 'ACTIVE';
  } else if (verdict === 'CORRECTIVE_REQUIRED') {
    nextEpoch.candidate_sha = null;
    nextEpoch.review_pass_sha = null;
    nextEpoch.ci = { sha: null, status: 'NOT_RUN', url: null };
    nextEpoch.corrective_closure = [];
    nextEpoch.final_corrective_sha = null;
    nextEpoch.final_corrective_base_sha = null;
    nextEpoch.final_corrective_reason = null;
    if (nextEpoch.review.consumed >= nextEpoch.review.max) {
      nextEpoch.final_corrective_reason = 'REVIEW_LIMIT_FINDINGS';
      nextEpoch.state = 'FINAL_CORRECTIVE_REQUIRED';
      nextEpoch.next_action = 'LUNA_FIX_REVIEW_LIMIT_FINDINGS';
      nextRun.state = 'EPOCH_ACTIVE';
      nextRun.active_epoch_pr = nextEpoch.pr_number;
      nextRun.parked_epoch_prs = nextRun.parked_epoch_prs.filter(
        (number) => number !== nextEpoch.pr_number,
      );
      nextRun.next_action = `RESUME_PR_${nextEpoch.pr_number}_FINAL_CORRECTIVE`;
    } else {
      nextEpoch.state = 'CORRECTIVE_REQUIRED';
      nextEpoch.next_action = 'LUNA_FIX_ALL_P0_P1';
    }
  } else {
    throw new HarnessInvariantError('INVALID_REVIEW_VERDICT', `Unsupported verdict: ${verdict}`);
  }
  return { run: nextRun, epoch: nextEpoch };
}

export function resumeReviewLimitForFinalCorrective(run, epoch) {
  const nextRun = cloneState(run);
  const nextEpoch = cloneState(epoch);
  assertLedger(nextRun.outer_sol, 'run.outer_sol', MAX_OUTER_REVIEWS);
  assertLedger(nextEpoch.review, 'epoch.review', MAX_EPOCH_REVIEWS);
  if (
    nextEpoch.state !== 'PARKED_REVIEW_LIMIT' ||
    nextEpoch.review.consumed < nextEpoch.review.max
  ) {
    throw new HarnessInvariantError(
      'REVIEW_LIMIT_RESUME_NOT_APPLICABLE',
      'Only an exhausted legacy PARKED_REVIEW_LIMIT Epoch can enter final corrective',
    );
  }
  const legacyCandidateSha = nextEpoch.candidate_sha;
  nextEpoch.findings = normalizeFindings(nextEpoch.findings ?? [], nextEpoch.review.consumed);
  if (nextEpoch.findings.length === 0) {
    throw new HarnessInvariantError(
      'REVIEW_LIMIT_RESUME_NOT_APPLICABLE',
      'A legacy review-limit Epoch must contain unresolved findings',
    );
  }
  nextEpoch.review_history ??= [];
  if (nextEpoch.review_history.at(-1)?.verdict !== 'CORRECTIVE_REQUIRED') {
    nextEpoch.review_history.push({
      review_number: nextEpoch.review.consumed,
      reviewer_id: null,
      candidate_sha: legacyCandidateSha,
      reviewed_base_sha: nextEpoch.reviewed_base_sha,
      verdict: 'CORRECTIVE_REQUIRED',
      findings: cloneState(nextEpoch.findings),
      migrated_from_legacy_review_limit: true,
    });
  }
  nextEpoch.corrective_closure = [];
  nextEpoch.candidate_sha = null;
  nextEpoch.review_pass_sha = null;
  nextEpoch.ci = { sha: null, status: 'NOT_RUN', url: null };
  nextEpoch.final_corrective_sha = null;
  nextEpoch.final_corrective_base_sha = null;
  nextEpoch.final_corrective_reason = 'REVIEW_LIMIT_FINDINGS';
  nextEpoch.state = 'FINAL_CORRECTIVE_REQUIRED';
  nextEpoch.next_action = 'LUNA_FIX_REVIEW_LIMIT_FINDINGS';
  nextRun.state = 'EPOCH_ACTIVE';
  nextRun.active_epoch_pr = nextEpoch.pr_number;
  nextRun.pending_epoch = null;
  nextRun.parked_epoch_prs = nextRun.parked_epoch_prs.filter(
    (number) => number !== nextEpoch.pr_number,
  );
  nextRun.next_action = `RESUME_PR_${nextEpoch.pr_number}_FINAL_CORRECTIVE`;
  return { run: nextRun, epoch: nextEpoch };
}

export function assertMergeReadiness({ epoch, branchHeadSha, prHeadSha, currentBaseSha }) {
  const latestReview = epoch.review_history?.at(-1);
  const passAuthority =
    epoch.state === 'REVIEW_PASSED' && epoch.review_pass_sha === epoch.candidate_sha;
  const finalCorrectiveAuthority =
    epoch.state === 'FINAL_CORRECTIVE_READY' &&
    epoch.review?.consumed >= epoch.review?.max &&
    ((epoch.final_corrective_reason === 'REVIEW_LIMIT_FINDINGS' &&
      latestReview?.verdict === 'CORRECTIVE_REQUIRED') ||
      (epoch.final_corrective_reason === 'BASE_DRIFT_AFTER_PASS' &&
        latestReview?.verdict === 'PASS')) &&
    latestReview?.review_number === epoch.review?.consumed &&
    epoch.final_corrective_sha === epoch.candidate_sha;
  if (!passAuthority && !finalCorrectiveAuthority) {
    throw new HarnessInvariantError(
      'REVIEW_PASS_REQUIRED',
      'The exact Candidate needs a PASS or exhausted-budget final-corrective authority',
    );
  }
  if (finalCorrectiveAuthority) assertCorrectiveClosure(epoch);
  assertCandidateInvariant({
    candidateSha: epoch.candidate_sha,
    branchHeadSha,
    prHeadSha,
  });
  assertExactShaCi({
    candidateSha: epoch.candidate_sha,
    ciSha: epoch.ci?.sha,
    ciStatus: epoch.ci?.status,
  });
  const authorizedBaseSha = passAuthority
    ? epoch.reviewed_base_sha
    : epoch.final_corrective_base_sha;
  if (authorizedBaseSha !== currentBaseSha) {
    throw new HarnessInvariantError(
      finalCorrectiveAuthority ? 'FINAL_CORRECTIVE_BASE_DRIFT' : 'PASS_INVALIDATED_BASE_DRIFT',
      'Target base advanced after integration authority was recorded',
      {
        authorizedBaseSha,
        currentBaseSha,
      },
    );
  }
  return true;
}

export function completeMerge(run, epoch, { mergeSha, candidateIsAncestor }) {
  requireText(mergeSha, 'MERGE_VERIFICATION_FAILED', 'merge_sha');
  if (!candidateIsAncestor) {
    throw new HarnessInvariantError(
      'MERGE_VERIFICATION_FAILED',
      'The Candidate is not an ancestor of the merged target base',
    );
  }
  const nextRun = cloneState(run);
  const nextEpoch = cloneState(epoch);
  nextEpoch.state = 'MERGED';
  nextEpoch.merge_sha = mergeSha;
  nextEpoch.next_action = 'BRANCH_CLEANED';
  nextRun.active_epoch_pr = null;
  nextRun.last_merged_epoch_pr = nextEpoch.pr_number;
  nextRun.state = nextRun.profile === 'AUTONOMOUS_EVOLUTION' ? 'ACTIVE' : 'COMPLETED';
  nextRun.next_action =
    nextRun.profile === 'AUTONOMOUS_EVOLUTION' ? 'DISCOVER_NEXT_EPOCH' : 'STOP_SUCCESS';
  return { run: nextRun, epoch: nextEpoch };
}

export function recordIntegrationBlocked(run, epoch, reason) {
  requireText(reason, 'INTEGRATION_BLOCKED', 'reason');
  const nextRun = cloneState(run);
  const nextEpoch = cloneState(epoch);
  nextEpoch.state = 'INTEGRATION_BLOCKED';
  nextEpoch.next_action = reason;
  nextRun.state = 'INTEGRATION_BLOCKED';
  nextRun.next_action = `RESUME_PR_${nextEpoch.pr_number}`;
  return { run: nextRun, epoch: nextEpoch };
}

export function renderControlBlock(marker, state) {
  return `<!-- ${marker}:start -->\n\`\`\`json\n${JSON.stringify(state, null, 2)}\n\`\`\`\n<!-- ${marker}:end -->`;
}

export function parseControlBlock(body, marker) {
  const start = `<!-- ${marker}:start -->`;
  const end = `<!-- ${marker}:end -->`;
  const startIndex = body.indexOf(start);
  const endIndex = body.indexOf(end);
  if (startIndex < 0 || endIndex < 0 || endIndex <= startIndex) {
    throw new HarnessInvariantError('CONTROL_BLOCK_MISSING', `Missing ${marker} control block`);
  }
  const content = body.slice(startIndex + start.length, endIndex).trim();
  const json = content.replace(/^```json\s*/u, '').replace(/\s*```$/u, '');
  const state = JSON.parse(json);
  if (state.schema !== SCHEMA) {
    throw new HarnessInvariantError('CONTROL_SCHEMA_MISMATCH', `Expected ${SCHEMA}`);
  }
  return state;
}

export function replaceControlBlock(body, marker, state) {
  const start = `<!-- ${marker}:start -->`;
  const end = `<!-- ${marker}:end -->`;
  const startIndex = body.indexOf(start);
  const endIndex = body.indexOf(end);
  if (startIndex < 0 || endIndex < 0 || endIndex <= startIndex) {
    throw new HarnessInvariantError('CONTROL_BLOCK_MISSING', `Missing ${marker} control block`);
  }
  return `${body.slice(0, startIndex)}${renderControlBlock(marker, state)}${body.slice(
    endIndex + end.length,
  )}`;
}

export function renderRunBody(state) {
  return `${renderControlBlock(RUN_MARKER, state)}\n\n## Outer Run\n\nRuntime state is edited in place. Polling creates no comments or body updates.`;
}

function list(items) {
  return items.length ? items.map((item) => `- ${item}`).join('\n') : '- None recorded';
}

export function renderEpochBody(state) {
  return `${renderControlBlock(EPOCH_MARKER, state)}

## Product Objective

${state.objective}

## Representative User Questions

${list(state.questions)}

## Included Work Packages

${list(state.work_packages)}

## Explicit Non-Scope

${list(state.non_scope)}

## Acceptance Criteria

${list(state.acceptance_criteria)}

## Validation

${list(state.validation)}

## Why Not Review Earlier?

${state.scope_closure.why_not_review_earlier || 'Not complete.'}

## Why Not Extend Further?

${state.scope_closure.why_not_extend_further || 'Not complete.'}`;
}
