import { canonicalHash, inspectFrontierClosure } from './frontier-ledger.mjs';

export const SCHEMA = 'bangumi-harness/v3';
export const RUN_MARKER = 'bangumi-harness:v3:outer-run';
export const EPOCH_MARKER = 'bangumi-harness:v3:epoch';
export const DEFAULT_INTEGRATION = 'AUTO_MERGE_AFTER_PASS';
export const MAX_EPOCH_REVIEWS = 2;
export const MAX_OUTER_REVIEWS = 4;
export const MAX_OUTER_PRODUCT_REVIEWS = 3;
export const MAX_OUTER_CLOSURE_REVIEWS = 1;
export const MAX_OUTER_RUNTIME_RECOVERIES = 1;
export const DISCOVERY_POLICY_VERSION = 'harness-v3.2-frontier-closure-v1';
export const DISCOVERY_REFRESH_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;
export const NO_OPPORTUNITY_STOP = 'STOPPED_TRUSTED_FRONTIER_EXHAUSTED';
export const DISCOVERY_LANES = [
  'recorded_product_opportunities',
  'capability_maturity_and_user_journeys',
  'agent_ux_and_discoverability',
  'renderer_and_standalone_experience',
  'correctness_evidence_and_resource_bounds',
  'architecture_maintenance_and_testability',
];

const DISCOVERY_REJECTION_DISPOSITIONS = new Set([
  'ALREADY_DELIVERED',
  'PROTECTED_BOUNDARY',
  'INSUFFICIENT_TRUSTWORTHY_DATA',
  'NOT_INDEPENDENT_OF_PARKED_WORK',
  'LOW_USER_OR_AGENT_VALUE',
]);

const DISCOVERY_FRONTIER_OUTCOMES = new Set(['IMPLEMENTATION_READY', 'RESEARCH_READY']);
const DISCOVERY_SALVAGE_OUTCOMES = new Set([...DISCOVERY_FRONTIER_OUTCOMES, 'NO_SAFE_VARIANT']);
const SOURCE_RESEARCH_STATES = new Set([
  'NOT_REQUIRED',
  'RESEARCH_REQUIRED',
  'CLOSED_NO_SAFE_SOURCE',
]);
const GENERIC_DISCOVERY_TEXT = [
  /^no changes\.?$/iu,
  /^inspected current .+ evidence and representative seams\.?$/iu,
  /^no independent safe high-value epoch remains in this lane\.?$/iu,
  /^current contracts, tests, and source availability were inspected\.?$/iu,
  /^would improve a real user or agent journey\.?$/iu,
  /^the current safe implementation space is already complete or protected\.?$/iu,
];

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

function requireSpecificDiscoveryText(value, field, minimumLength = 32) {
  requireText(value, 'DISCOVERY_EVIDENCE_REQUIRED', field);
  const normalized = value.trim();
  if (
    normalized.length < minimumLength ||
    GENERIC_DISCOVERY_TEXT.some((pattern) => pattern.test(normalized))
  ) {
    throw new HarnessInvariantError(
      'DISCOVERY_EVIDENCE_GENERIC',
      `${field} must contain concrete, non-template discovery evidence`,
      { field },
    );
  }
}

function requireTextList(value, code, field) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new HarnessInvariantError(code, `${field} must be a non-empty string array`, { field });
  }
  value.forEach((item, index) => requireText(item, code, `${field}[${index}]`));
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

function defaultRuntimeRecoveryLedger() {
  return { max: MAX_OUTER_RUNTIME_RECOVERIES, consumed: 0, reserved: 0 };
}

function assertRuntimeRecoveryLedger(ledger, label) {
  assertLedger(ledger ?? defaultRuntimeRecoveryLedger(), label, MAX_OUTER_RUNTIME_RECOVERIES);
}

function ensureRuntimeRecoveryLedger(owner) {
  owner.runtime_recovery ??= defaultRuntimeRecoveryLedger();
  assertRuntimeRecoveryLedger(owner.runtime_recovery, 'runtime_recovery');
  return owner.runtime_recovery;
}

function assertOuterLedger(ledger) {
  assertLedger(ledger, 'run.outer_sol', MAX_OUTER_REVIEWS);
  assertLedger(ledger?.product, 'run.outer_sol.product', MAX_OUTER_PRODUCT_REVIEWS);
  assertLedger(ledger?.closure, 'run.outer_sol.closure', MAX_OUTER_CLOSURE_REVIEWS);
  assertRuntimeRecoveryLedger(ledger?.runtime_recovery, 'run.outer_sol.runtime_recovery');
  if (
    ledger.product.consumed + ledger.closure.consumed !== ledger.consumed ||
    ledger.product.reserved + ledger.closure.reserved !== ledger.reserved
  ) {
    throw new HarnessInvariantError(
      'INVALID_REVIEW_LEDGER',
      'Outer total must equal Product plus frontier-closure review ledgers',
    );
  }
}

export function createRunState({
  runId,
  profile = 'AUTONOMOUS_EVOLUTION',
  outerSolMax = 4,
  nextAction = 'SELECT_OR_RESUME_EPOCH',
}) {
  requireText(runId, 'INVALID_RUN', 'run_id');
  const outerSol = {
    max: outerSolMax,
    consumed: 0,
    reserved: 0,
    product: { max: Math.min(outerSolMax, MAX_OUTER_PRODUCT_REVIEWS), consumed: 0, reserved: 0 },
    closure: {
      max: outerSolMax === MAX_OUTER_REVIEWS ? MAX_OUTER_CLOSURE_REVIEWS : 0,
      consumed: 0,
      reserved: 0,
    },
    runtime_recovery: defaultRuntimeRecoveryLedger(),
  };
  assertOuterLedger(outerSol);
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
    discovery_exhaustion: null,
    frontier_closure: {
      state: 'NOT_READY',
      base_sha: null,
      ledger_hash: null,
      evidence_hash: null,
      reviewer_id: null,
      verdict: null,
      findings: [],
      evidence: null,
      runtime: { state: 'NOT_STARTED', reason: null, allocation: null },
      runtime_history: [],
    },
    discovery_policy_version: DISCOVERY_POLICY_VERSION,
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
  advancesFrontierIds = [],
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
    runtime: { state: 'NOT_STARTED', reason: null, allocation: null },
    runtime_history: [],
    runtime_recovery: defaultRuntimeRecoveryLedger(),
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
    advances_frontier_ids: advancesFrontierIds,
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

export function isTerminalRunState(state) {
  return (
    typeof state === 'string' &&
    (state.startsWith('STOPPED_') ||
      ['COMPLETED', 'MERGED_GOAL_COMPLETE', 'QUALITY_CIRCUIT_BREAKER'].includes(state))
  );
}

export function assertGoalStopAllowed({ run, epoch, discoveryState } = {}) {
  if (discoveryState === 'UNCHANGED_EXHAUSTION' && !run) return true;
  if (!run || !isTerminalRunState(run.state)) {
    throw new HarnessInvariantError(
      'GOAL_CONTINUATION_REQUIRED',
      'A nonterminal Outer Run cannot be reported as Goal complete',
      { run_state: run?.state ?? null, epoch_state: epoch?.state ?? null },
    );
  }
  if (run.active_epoch_pr || run.pending_epoch) {
    throw new HarnessInvariantError(
      'GOAL_CONTINUATION_REQUIRED',
      'A terminal Goal cannot abandon an active or pending Epoch',
      {
        run_state: run.state,
        active_epoch_pr: run.active_epoch_pr ?? null,
        pending_epoch: run.pending_epoch ?? null,
      },
    );
  }
  if (epoch && epoch.state !== 'MERGED') {
    throw new HarnessInvariantError(
      'GOAL_CONTINUATION_REQUIRED',
      'A nonterminal Epoch cannot be reported as Goal complete',
      { run_state: run.state, epoch_state: epoch.state },
    );
  }
  return true;
}

export function assertDiscoveryExhaustionEvidence(
  evidence,
  currentBaseSha,
  {
    ledger,
    pathExists = () => true,
    expectedScenarioIds = [],
    expectedOpportunityIds = [],
    expectedQuestions = {},
    knownCapabilities = [],
  } = {},
) {
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) {
    throw new HarnessInvariantError(
      'DISCOVERY_EVIDENCE_REQUIRED',
      'Trusted frontier exhaustion requires structured discovery evidence',
    );
  }
  if (!ledger) {
    throw new HarnessInvariantError(
      'FRONTIER_LEDGER_REQUIRED',
      'Trusted frontier exhaustion requires the canonical frontier ledger',
    );
  }
  const frontier = inspectFrontierClosure({
    ledger,
    evidence,
    currentBaseSha,
    policyVersion: DISCOVERY_POLICY_VERSION,
    pathExists,
    expectedScenarioIds,
    expectedOpportunityIds,
    expectedQuestions,
    knownCapabilities,
  });
  if (!frontier.ok) {
    const [first] = frontier.issues;
    throw new HarnessInvariantError(first.code, first.message, first.details);
  }
  if (evidence.policy_version !== DISCOVERY_POLICY_VERSION) {
    throw new HarnessInvariantError(
      'DISCOVERY_POLICY_STALE',
      'Discovery evidence must use the current frontier policy',
      { expected: DISCOVERY_POLICY_VERSION, actual: evidence.policy_version },
    );
  }
  requireText(evidence.audited_sha, 'DISCOVERY_EVIDENCE_REQUIRED', 'audited_sha');
  if (evidence.audited_sha !== currentBaseSha) {
    throw new HarnessInvariantError(
      'DISCOVERY_EVIDENCE_STALE',
      'Discovery evidence must cover the current synchronized target base',
      { auditedSha: evidence.audited_sha, currentBaseSha },
    );
  }
  const auditedAt = Date.parse(evidence.audited_at);
  if (!Number.isFinite(auditedAt)) {
    throw new HarnessInvariantError(
      'DISCOVERY_EVIDENCE_REQUIRED',
      'audited_at must be a valid ISO timestamp',
    );
  }
  requireSpecificDiscoveryText(evidence.discovery_delta, 'discovery_delta', 48);
  const lanes = evidence.lane_assessments;
  if (!lanes || typeof lanes !== 'object' || Array.isArray(lanes)) {
    throw new HarnessInvariantError(
      'DISCOVERY_EVIDENCE_REQUIRED',
      'lane_assessments must cover every governed discovery lane',
    );
  }
  const laneObservations = new Set();
  const laneConclusions = new Set();
  for (const lane of DISCOVERY_LANES) {
    const assessment = lanes[lane];
    requireSpecificDiscoveryText(assessment?.observation, `lane_assessments.${lane}.observation`);
    requireSpecificDiscoveryText(assessment?.conclusion, `lane_assessments.${lane}.conclusion`);
    laneObservations.add(assessment.observation.trim());
    laneConclusions.add(assessment.conclusion.trim());
  }
  if (
    laneObservations.size !== DISCOVERY_LANES.length ||
    laneConclusions.size !== DISCOVERY_LANES.length
  ) {
    throw new HarnessInvariantError(
      'DISCOVERY_EVIDENCE_GENERIC',
      'Each discovery lane needs distinct evidence and a distinct conclusion',
    );
  }
  if (!Array.isArray(evidence.candidate_assessments) || evidence.candidate_assessments.length < 3) {
    throw new HarnessInvariantError(
      'DISCOVERY_EVIDENCE_REQUIRED',
      'Assess at least three concrete candidates before declaring the safe backlog exhausted',
    );
  }
  const candidateIds = new Set();
  evidence.candidate_assessments.forEach((candidate, index) => {
    for (const field of [
      'id',
      'user_question',
      'source_evidence',
      'value_hypothesis',
      'source_and_coverage_limits',
      'delta_since_previous_audit',
      'reason',
    ]) {
      requireSpecificDiscoveryText(
        candidate?.[field],
        `candidate_assessments[${index}].${field}`,
        field === 'id' ? 3 : 32,
      );
    }
    if (candidateIds.has(candidate.id)) {
      throw new HarnessInvariantError(
        'DISCOVERY_EVIDENCE_REQUIRED',
        'Candidate ids must be unique across one discovery audit',
        { id: candidate.id },
      );
    }
    candidateIds.add(candidate.id);
    if (!DISCOVERY_LANES.includes(candidate.lane)) {
      throw new HarnessInvariantError(
        'DISCOVERY_EVIDENCE_REQUIRED',
        `candidate_assessments[${index}].lane is not governed`,
      );
    }
    if (!DISCOVERY_REJECTION_DISPOSITIONS.has(candidate.disposition)) {
      throw new HarnessInvariantError(
        'DISCOVERY_EVIDENCE_REQUIRED',
        `candidate_assessments[${index}].disposition is invalid`,
      );
    }
    const salvage = candidate.scope_salvage;
    for (const field of [
      'narrowed_user_question',
      'output_semantics',
      'coverage_and_negative_claim_limits',
      'resource_bounds',
      'rationale',
    ]) {
      requireSpecificDiscoveryText(
        salvage?.[field],
        `candidate_assessments[${index}].scope_salvage.${field}`,
      );
    }
    if (!DISCOVERY_SALVAGE_OUTCOMES.has(salvage?.outcome)) {
      throw new HarnessInvariantError(
        'DISCOVERY_EVIDENCE_REQUIRED',
        `candidate_assessments[${index}].scope_salvage.outcome is invalid`,
      );
    }
    const research = candidate.source_contract_research;
    if (!SOURCE_RESEARCH_STATES.has(research?.status)) {
      throw new HarnessInvariantError(
        'DISCOVERY_EVIDENCE_REQUIRED',
        `candidate_assessments[${index}].source_contract_research.status is invalid`,
      );
    }
    requireSpecificDiscoveryText(
      research.next_step,
      `candidate_assessments[${index}].source_contract_research.next_step`,
    );
    if (DISCOVERY_FRONTIER_OUTCOMES.has(salvage.outcome)) {
      if (salvage.outcome === 'RESEARCH_READY' && research.status !== 'RESEARCH_REQUIRED') {
        throw new HarnessInvariantError(
          'DISCOVERY_EVIDENCE_REQUIRED',
          'RESEARCH_READY requires a RESEARCH_REQUIRED source-contract state',
          { id: candidate.id },
        );
      }
      throw new HarnessInvariantError(
        'DISCOVERY_HAS_ACTIONABLE_CANDIDATE',
        'A safe narrowed or research-ready candidate must become the next frontier',
        { id: candidate.id, outcome: salvage.outcome },
      );
    }
    requireTextList(
      research.closure_evidence,
      'DISCOVERY_EVIDENCE_REQUIRED',
      `candidate_assessments[${index}].source_contract_research.closure_evidence`,
    );
    if (research.status === 'RESEARCH_REQUIRED') {
      throw new HarnessInvariantError(
        'DISCOVERY_HAS_ACTIONABLE_CANDIDATE',
        'Open source-contract research must become the next frontier',
        { id: candidate.id },
      );
    }
    if (
      candidate.disposition === 'INSUFFICIENT_TRUSTWORTHY_DATA' &&
      research.status !== 'CLOSED_NO_SAFE_SOURCE'
    ) {
      throw new HarnessInvariantError(
        'DISCOVERY_SOURCE_RESEARCH_REQUIRED',
        'Insufficient source data requires research or concrete closure evidence',
        { id: candidate.id },
      );
    }
  });
  return true;
}

export function classifyDiscoveryCheck({
  openRunNumbers = [],
  openEpochPrNumbers = [],
  latestRunState,
  currentBaseSha,
  frontier,
  now = Date.now(),
}) {
  if (openRunNumbers.length > 0 || openEpochPrNumbers.length > 0) {
    return {
      state: 'RESUME_ACTIVE_RUN',
      control_plane: 'ACTIVE',
      open_run_issues: openRunNumbers,
      open_epoch_prs: openEpochPrNumbers,
    };
  }
  if (!frontier?.ok) {
    return {
      state: 'FRONTIER_LEDGER_REQUIRED',
      control_plane: 'IDLE',
      reason: frontier?.issues?.[0]?.code ?? 'FRONTIER_LEDGER_MISSING',
    };
  }
  const evidence = latestRunState?.discovery_exhaustion;
  const closure = latestRunState?.frontier_closure;
  if (!evidence || evidence.policy_version !== DISCOVERY_POLICY_VERSION) {
    return {
      state: 'FRONTIER_RESEARCH_REQUIRED',
      control_plane: 'IDLE',
      reason: evidence ? 'DISCOVERY_POLICY_CHANGED' : 'NO_CURRENT_FRONTIER_AUDIT',
    };
  }
  if (evidence.audited_sha !== currentBaseSha) {
    return {
      state: 'DISCOVERY_REQUIRED_MASTER_CHANGED',
      control_plane: 'IDLE',
      audited_sha: evidence.audited_sha,
      current_sha: currentBaseSha,
    };
  }
  if (frontier.actionable_ids.length > 0) {
    return {
      state: 'FRONTIER_RESEARCH_REQUIRED',
      control_plane: 'IDLE',
      reason: 'ACTIONABLE_FRONTIER_RECORDED',
      candidates: frontier.actionable_ids,
    };
  }
  try {
    assertDiscoveryExhaustionEvidence(evidence, currentBaseSha, {
      ledger: frontier.ledger,
      pathExists: frontier.pathExists,
      expectedScenarioIds: frontier.expectedScenarioIds,
      expectedOpportunityIds: frontier.expectedOpportunityIds,
      expectedQuestions: frontier.expectedQuestions,
      knownCapabilities: frontier.knownCapabilities,
    });
  } catch (error) {
    if (!(error instanceof HarnessInvariantError)) throw error;
    return {
      state: 'FRONTIER_RESEARCH_REQUIRED',
      control_plane: 'IDLE',
      reason:
        error.code === 'DISCOVERY_HAS_ACTIONABLE_CANDIDATE'
          ? 'ACTIONABLE_FRONTIER_RECORDED'
          : 'CURRENT_POLICY_AUDIT_INVALID',
      evidence_error: error.code,
    };
  }
  const evidenceHash = canonicalHash(evidence);
  if (
    closure?.state !== 'PASS' ||
    closure.verdict !== 'PASS' ||
    closure.base_sha !== currentBaseSha ||
    closure.ledger_hash !== frontier.hash ||
    closure.evidence_hash !== evidenceHash
  ) {
    return {
      state: 'FRONTIER_REVIEW_REQUIRED',
      control_plane: 'IDLE',
      reason: 'TRUSTED_CLOSURE_REVIEW_MISSING_OR_STALE',
    };
  }
  const auditedAt = Date.parse(evidence.audited_at);
  if (!Number.isFinite(auditedAt)) {
    return {
      state: 'FRONTIER_RESEARCH_REQUIRED',
      control_plane: 'IDLE',
      reason: 'AUDIT_TIMESTAMP_MISSING_OR_INVALID',
    };
  }
  if (now - auditedAt >= DISCOVERY_REFRESH_INTERVAL_MS) {
    return {
      state: 'DISCOVERY_REFRESH_DUE',
      control_plane: 'IDLE',
      audited_at: evidence.audited_at,
      refresh_interval_days: 7,
    };
  }
  return {
    state: 'UNCHANGED_EXHAUSTION',
    control_plane: 'IDLE',
    audited_sha: evidence.audited_sha,
    audited_at: evidence.audited_at,
    policy_version: evidence.policy_version,
    ledger_hash: frontier.hash,
    closure_review: 'PASS',
    issue_created: false,
  };
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
  assertOuterLedger(outerReview);
  const budgetRemains =
    epochReview.consumed + epochReview.reserved < epochReview.max &&
    outerReview.product.consumed + outerReview.product.reserved < outerReview.product.max;
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

export function reserveReview(run, epoch, { runtimeRecovery = false } = {}) {
  const nextRun = cloneState(run);
  const nextEpoch = cloneState(epoch);
  assertOuterLedger(nextRun.outer_sol);
  assertLedger(nextEpoch.review, 'epoch.review', MAX_EPOCH_REVIEWS);
  const outerRecovery = ensureRuntimeRecoveryLedger(nextRun.outer_sol);
  const epochRecovery = ensureRuntimeRecoveryLedger(nextEpoch.review);
  if (
    nextRun.outer_sol.reserved ||
    nextRun.outer_sol.product.reserved ||
    nextEpoch.review.reserved ||
    outerRecovery.reserved ||
    epochRecovery.reserved
  ) {
    throw new HarnessInvariantError(
      'REVIEW_RESERVATION_EXISTS',
      'Reconcile the existing reservation before another launch',
    );
  }
  if (runtimeRecovery) {
    if (
      nextEpoch.state !== 'REVIEW_RUNTIME_RECOVERY_REQUIRED' ||
      nextEpoch.review.runtime?.replacement_allocation !== 'RECOVERY'
    ) {
      throw new HarnessInvariantError(
        'REVIEW_RUNTIME_RECOVERY_NOT_READY',
        'A runtime recovery reviewer requires confirmed unavailable runtime state',
      );
    }
    if (
      outerRecovery.consumed >= outerRecovery.max ||
      epochRecovery.consumed >= epochRecovery.max
    ) {
      throw new HarnessInvariantError(
        'REVIEW_RUNTIME_RECOVERY_EXHAUSTED',
        'The shared runtime recovery context is already consumed',
      );
    }
    outerRecovery.reserved = 1;
    epochRecovery.reserved = 1;
    nextEpoch.state = 'REVIEW_RUNTIME_RECOVERY_RESERVED';
    nextEpoch.next_action = 'START_RESERVED_RUNTIME_RECOVERY_REVIEWER';
    return { run: nextRun, epoch: nextEpoch };
  }
  if (
    nextRun.outer_sol.product.consumed >= nextRun.outer_sol.product.max ||
    nextEpoch.review.consumed >= nextEpoch.review.max
  ) {
    throw new HarnessInvariantError('REVIEW_BUDGET_EXHAUSTED', 'No review launch remains');
  }
  const normalReplacement =
    nextEpoch.state === 'REVIEW_RUNTIME_RECOVERY_REQUIRED' &&
    nextEpoch.review.runtime?.replacement_allocation === 'NORMAL';
  if (nextEpoch.state !== 'REVIEW_READY' && !normalReplacement) {
    throw new HarnessInvariantError(
      'REVIEW_NOT_READY',
      `Epoch state ${nextEpoch.state} cannot reserve a reviewer`,
    );
  }
  nextRun.outer_sol.reserved = 1;
  nextRun.outer_sol.product.reserved = 1;
  nextEpoch.review.reserved = 1;
  nextEpoch.state = 'REVIEW_RESERVED';
  nextEpoch.next_action = 'START_RESERVED_REVIEWER';
  return { run: nextRun, epoch: nextEpoch };
}

export function markReviewStarted(run, epoch, reviewerId, { runtimeRecovery = false } = {}) {
  requireText(reviewerId, 'INVALID_REVIEWER', 'reviewer_id');
  const nextRun = cloneState(run);
  const nextEpoch = cloneState(epoch);
  assertOuterLedger(nextRun.outer_sol);
  assertLedger(nextEpoch.review, 'epoch.review', MAX_EPOCH_REVIEWS);
  const outerRecovery = ensureRuntimeRecoveryLedger(nextRun.outer_sol);
  const epochRecovery = ensureRuntimeRecoveryLedger(nextEpoch.review);
  if (runtimeRecovery) {
    if (
      nextEpoch.state !== 'REVIEW_RUNTIME_RECOVERY_RESERVED' ||
      outerRecovery.reserved !== 1 ||
      epochRecovery.reserved !== 1
    ) {
      throw new HarnessInvariantError(
        'REVIEW_RUNTIME_RECOVERY_NOT_RESERVED',
        'Reserve the paired runtime recovery ledgers before replacement start',
      );
    }
    const lostReviewerId = nextEpoch.review.runtime?.lost_reviewer_id;
    if (!lostReviewerId || reviewerId === lostReviewerId) {
      throw new HarnessInvariantError(
        'REVIEW_RUNTIME_REPLACEMENT_INVALID',
        'A runtime replacement must name a new reviewer context',
      );
    }
    outerRecovery.reserved = 0;
    outerRecovery.consumed += 1;
    epochRecovery.reserved = 0;
    epochRecovery.consumed += 1;
    nextEpoch.review.reviewer_id = reviewerId;
    nextEpoch.review.runtime = {
      state: 'ACTIVE',
      reason: null,
      allocation: 'RECOVERY',
      replaces_reviewer_id: lostReviewerId,
    };
    nextEpoch.reviewed_base_sha = nextEpoch.base_sha;
    nextEpoch.state = 'REVIEW_RUNNING';
    nextEpoch.next_action = 'WAIT_SAME_REVIEWER';
    return { run: nextRun, epoch: nextEpoch };
  }
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
  const replacementAuthorized = Boolean(nextEpoch.review.runtime?.lost_reviewer_id);
  if (
    nextEpoch.review.consumed > 0 &&
    previousReview?.reviewer_id &&
    previousReview.reviewer_id !== reviewerId &&
    !replacementAuthorized
  ) {
    throw new HarnessInvariantError(
      'SAME_REVIEWER_REQUIRED',
      'Sol #2 must continue the same reviewer identity',
      { expected: previousReview.reviewer_id, actual: reviewerId },
    );
  }
  nextRun.outer_sol.reserved = 0;
  nextRun.outer_sol.consumed += 1;
  nextRun.outer_sol.product.reserved = 0;
  nextRun.outer_sol.product.consumed += 1;
  nextEpoch.review.reserved = 0;
  nextEpoch.review.consumed += 1;
  nextEpoch.review.reviewer_id = reviewerId;
  nextEpoch.review.runtime = {
    state: 'ACTIVE',
    reason: null,
    allocation: 'NORMAL',
    replaces_reviewer_id: nextEpoch.review.runtime?.lost_reviewer_id ?? null,
  };
  nextEpoch.review.runtime_history ??= [];
  ensureRuntimeRecoveryLedger(nextRun.outer_sol);
  ensureRuntimeRecoveryLedger(nextEpoch.review);
  nextEpoch.reviewed_base_sha = nextEpoch.base_sha;
  nextEpoch.state = 'REVIEW_RUNNING';
  nextEpoch.next_action = 'WAIT_SAME_REVIEWER';
  return { run: nextRun, epoch: nextEpoch };
}

export function reconcileReviewReservation(
  run,
  epoch,
  launchDefinitelyDidNotOccur,
  { runtimeRecovery = false } = {},
) {
  const nextRun = cloneState(run);
  const nextEpoch = cloneState(epoch);
  assertOuterLedger(nextRun.outer_sol);
  assertLedger(nextEpoch.review, 'epoch.review', MAX_EPOCH_REVIEWS);
  const outerRecovery = ensureRuntimeRecoveryLedger(nextRun.outer_sol);
  const epochRecovery = ensureRuntimeRecoveryLedger(nextEpoch.review);
  if (runtimeRecovery) {
    if (outerRecovery.reserved !== 1 && epochRecovery.reserved !== 1) {
      throw new HarnessInvariantError(
        'NO_REVIEW_RESERVATION',
        'No runtime recovery reservation exists',
      );
    }
    outerRecovery.reserved = 0;
    epochRecovery.reserved = 0;
    if (!launchDefinitelyDidNotOccur) {
      outerRecovery.consumed = Math.max(outerRecovery.consumed, 1);
      epochRecovery.consumed = Math.max(epochRecovery.consumed, 1);
    }
    const normalAvailable =
      nextRun.outer_sol.product.consumed < nextRun.outer_sol.product.max &&
      nextEpoch.review.consumed < nextEpoch.review.max;
    const canRetryRecovery = launchDefinitelyDidNotOccur && outerRecovery.consumed === 0;
    nextEpoch.review.runtime = {
      ...(nextEpoch.review.runtime ?? {}),
      state: canRetryRecovery || normalAvailable ? 'RECOVERY_REQUIRED' : 'BLOCKED',
      allocation: null,
      replacement_allocation: canRetryRecovery ? 'RECOVERY' : normalAvailable ? 'NORMAL' : null,
    };
    nextEpoch.state =
      canRetryRecovery || normalAvailable
        ? 'REVIEW_RUNTIME_RECOVERY_REQUIRED'
        : 'REVIEW_RUNTIME_BLOCKED';
    nextEpoch.next_action = canRetryRecovery
      ? 'RESERVE_RUNTIME_RECOVERY_REVIEWER'
      : normalAvailable
        ? 'RESERVE_NORMAL_REPLACEMENT_REVIEWER'
        : 'AWAIT_REVIEWER_RUNTIME_OR_NEW_AUTHORIZATION';
    return { run: nextRun, epoch: nextEpoch };
  }
  if (nextRun.outer_sol.reserved !== 1 && nextEpoch.review.reserved !== 1) {
    throw new HarnessInvariantError('NO_REVIEW_RESERVATION', 'No reservation exists');
  }
  nextRun.outer_sol.reserved = 0;
  nextRun.outer_sol.product.reserved = 0;
  nextEpoch.review.reserved = 0;
  if (!launchDefinitelyDidNotOccur) {
    nextRun.outer_sol.consumed += 1;
    nextRun.outer_sol.product.consumed += 1;
    nextEpoch.review.consumed += 1;
  }
  nextEpoch.state = 'REVIEW_RESERVATION_RECONCILED';
  nextEpoch.next_action = 'REASSESS_REVIEW_BUDGET';
  return { run: nextRun, epoch: nextEpoch };
}

export function waitForSameReviewer(run, epoch, reviewerId, runtimeState, reason) {
  if (epoch.review?.reviewer_id !== reviewerId) {
    throw new HarnessInvariantError(
      'REVIEWER_ID_MISMATCH',
      'Runtime observation is allowed only for the recorded reviewer',
    );
  }
  if (!runtimeState) {
    throw new HarnessInvariantError(
      'REVIEW_RUNTIME_OBSERVATION_REQUIRED',
      'Stored control-plane state cannot prove that the reviewer runtime is active',
    );
  }
  if (runtimeState === 'ACTIVE') {
    if (epoch.state === 'REVIEW_RUNNING') {
      return { run, epoch, durableWrite: false, gitMutations: 0, launches: 0 };
    }
    if (epoch.state !== 'REVIEW_INTERRUPTED_RESUMABLE') {
      throw new HarnessInvariantError(
        'REVIEW_RUNTIME_STATE_INVALID',
        `Epoch state ${epoch.state} cannot resume the recorded reviewer`,
      );
    }
    const nextRun = cloneState(run);
    const nextEpoch = cloneState(epoch);
    nextEpoch.review.runtime = {
      ...(nextEpoch.review.runtime ?? {}),
      state: 'ACTIVE',
      reason: null,
    };
    nextEpoch.state = 'REVIEW_RUNNING';
    nextEpoch.next_action = 'WAIT_SAME_REVIEWER';
    nextRun.next_action = `RESUME_PR_${nextEpoch.pr_number}`;
    return {
      run: nextRun,
      epoch: nextEpoch,
      durableWrite: true,
      gitMutations: 0,
      launches: 0,
    };
  }
  if (runtimeState === 'INTERRUPTED') {
    if (!['REVIEW_RUNNING', 'REVIEW_INTERRUPTED_RESUMABLE'].includes(epoch.state)) {
      throw new HarnessInvariantError(
        'REVIEW_RUNTIME_STATE_INVALID',
        `Epoch state ${epoch.state} cannot record an interrupted reviewer`,
      );
    }
    requireText(reason, 'REVIEW_RUNTIME_REASON_REQUIRED', 'reason');
    const nextRun = cloneState(run);
    const nextEpoch = cloneState(epoch);
    nextEpoch.review.runtime = {
      ...(nextEpoch.review.runtime ?? {}),
      state: 'INTERRUPTED_RESUMABLE',
      reason,
    };
    nextEpoch.state = 'REVIEW_INTERRUPTED_RESUMABLE';
    nextEpoch.next_action = 'RESUME_SAME_REVIEWER';
    nextRun.next_action = `RESUME_PR_${nextEpoch.pr_number}_SAME_REVIEWER`;
    return {
      run: nextRun,
      epoch: nextEpoch,
      durableWrite: true,
      gitMutations: 0,
      launches: 0,
    };
  }
  if (runtimeState === 'UNAVAILABLE') {
    if (!['REVIEW_RUNNING', 'REVIEW_INTERRUPTED_RESUMABLE'].includes(epoch.state)) {
      throw new HarnessInvariantError(
        'REVIEW_RUNTIME_STATE_INVALID',
        `Epoch state ${epoch.state} cannot lose a reviewer runtime`,
      );
    }
    requireText(reason, 'REVIEW_RUNTIME_REASON_REQUIRED', 'reason');
    const nextRun = cloneState(run);
    const nextEpoch = cloneState(epoch);
    const outerRecovery = ensureRuntimeRecoveryLedger(nextRun.outer_sol);
    const epochRecovery = ensureRuntimeRecoveryLedger(nextEpoch.review);
    const lostAllocation = nextEpoch.review.runtime?.allocation ?? 'NORMAL';
    nextEpoch.review.runtime_history ??= [];
    nextEpoch.review.runtime_history.push({
      reviewer_id: reviewerId,
      allocation: lostAllocation,
      outcome: 'UNAVAILABLE',
      reason,
    });
    const recoveryAvailable =
      outerRecovery.consumed + outerRecovery.reserved < outerRecovery.max &&
      epochRecovery.consumed + epochRecovery.reserved < epochRecovery.max;
    const normalAvailable =
      nextRun.outer_sol.product.consumed + nextRun.outer_sol.product.reserved <
        nextRun.outer_sol.product.max &&
      nextEpoch.review.consumed + nextEpoch.review.reserved < nextEpoch.review.max;
    const replacementAllocation = recoveryAvailable
      ? 'RECOVERY'
      : normalAvailable
        ? 'NORMAL'
        : null;
    nextEpoch.review.reviewer_id = null;
    nextEpoch.review.runtime = {
      state: replacementAllocation ? 'RECOVERY_REQUIRED' : 'BLOCKED',
      reason,
      allocation: null,
      lost_reviewer_id: reviewerId,
      replacement_allocation: replacementAllocation,
    };
    if (replacementAllocation) {
      nextEpoch.state = 'REVIEW_RUNTIME_RECOVERY_REQUIRED';
      nextEpoch.next_action =
        replacementAllocation === 'RECOVERY'
          ? 'RESERVE_RUNTIME_RECOVERY_REVIEWER'
          : 'RESERVE_NORMAL_REPLACEMENT_REVIEWER';
      nextRun.next_action = `RESUME_PR_${nextEpoch.pr_number}_REVIEW_RUNTIME_RECOVERY`;
    } else {
      nextEpoch.state = 'REVIEW_RUNTIME_BLOCKED';
      nextEpoch.next_action = 'AWAIT_REVIEWER_RUNTIME_OR_NEW_AUTHORIZATION';
      nextRun.next_action = `RESUME_PR_${nextEpoch.pr_number}_REVIEW_RUNTIME_BLOCKED`;
    }
    return {
      run: nextRun,
      epoch: nextEpoch,
      durableWrite: true,
      gitMutations: 0,
      launches: 0,
    };
  }
  throw new HarnessInvariantError(
    'REVIEW_RUNTIME_STATE_INVALID',
    `Unsupported reviewer runtime state: ${runtimeState}`,
  );
}

export function reserveFrontierReview(
  run,
  { baseSha, ledgerHash, evidenceHash, runtimeRecovery = false },
) {
  if (runtimeRecovery) {
    const nextRun = cloneState(run);
    assertOuterLedger(nextRun.outer_sol);
    const recovery = ensureRuntimeRecoveryLedger(nextRun.outer_sol);
    if (
      nextRun.state !== 'FRONTIER_REVIEW_RUNTIME_RECOVERY_REQUIRED' ||
      nextRun.frontier_closure?.state !== 'RUNTIME_RECOVERY_REQUIRED'
    ) {
      throw new HarnessInvariantError(
        'FRONTIER_REVIEW_RUNTIME_RECOVERY_NOT_READY',
        'Frontier runtime recovery requires a confirmed unavailable reviewer',
      );
    }
    if (recovery.consumed >= recovery.max || recovery.reserved) {
      throw new HarnessInvariantError(
        'REVIEW_RUNTIME_RECOVERY_EXHAUSTED',
        'The shared runtime recovery context is already consumed or reserved',
      );
    }
    recovery.reserved = 1;
    nextRun.frontier_closure.state = 'RUNTIME_RECOVERY_RESERVED';
    nextRun.state = 'FRONTIER_REVIEW_RUNTIME_RECOVERY_RESERVED';
    nextRun.next_action = 'START_RESERVED_FRONTIER_RUNTIME_RECOVERY';
    return nextRun;
  }
  requireText(baseSha, 'FRONTIER_REVIEW_INVALID', 'base_sha');
  requireText(ledgerHash, 'FRONTIER_REVIEW_INVALID', 'ledger_hash');
  requireText(evidenceHash, 'FRONTIER_REVIEW_INVALID', 'evidence_hash');
  const nextRun = cloneState(run);
  assertOuterLedger(nextRun.outer_sol);
  if (nextRun.active_epoch_pr || nextRun.pending_epoch) {
    throw new HarnessInvariantError(
      'ACTIVE_EPOCH_EXISTS',
      'Frontier closure review cannot overlap a Product Epoch',
    );
  }
  if (nextRun.frontier_closure?.state === 'REJECTED') {
    throw new HarnessInvariantError(
      'FRONTIER_REVIEW_REJECTED',
      'A rejected closure review must return to Luna discovery; no second closure launch is allowed',
    );
  }
  if (
    nextRun.outer_sol.reserved ||
    nextRun.outer_sol.closure.reserved ||
    nextRun.outer_sol.closure.consumed >= nextRun.outer_sol.closure.max
  ) {
    throw new HarnessInvariantError(
      'FRONTIER_REVIEW_BUDGET_EXHAUSTED',
      'The single reserved frontier-closure review is unavailable',
    );
  }
  nextRun.outer_sol.reserved = 1;
  nextRun.outer_sol.closure.reserved = 1;
  nextRun.frontier_closure = {
    state: 'RESERVED',
    base_sha: baseSha,
    ledger_hash: ledgerHash,
    evidence_hash: evidenceHash,
    reviewer_id: null,
    verdict: null,
    findings: [],
    evidence: null,
    runtime: { state: 'NOT_STARTED', reason: null, allocation: null },
    runtime_history: [],
  };
  nextRun.state = 'FRONTIER_REVIEW_REQUIRED';
  nextRun.next_action = 'START_RESERVED_FRONTIER_REVIEW';
  return nextRun;
}

export function markFrontierReviewStarted(run, reviewerId, { runtimeRecovery = false } = {}) {
  requireText(reviewerId, 'INVALID_REVIEWER', 'reviewer_id');
  const nextRun = cloneState(run);
  assertOuterLedger(nextRun.outer_sol);
  const recovery = ensureRuntimeRecoveryLedger(nextRun.outer_sol);
  if (runtimeRecovery) {
    if (
      nextRun.state !== 'FRONTIER_REVIEW_RUNTIME_RECOVERY_RESERVED' ||
      nextRun.frontier_closure?.state !== 'RUNTIME_RECOVERY_RESERVED' ||
      recovery.reserved !== 1
    ) {
      throw new HarnessInvariantError(
        'FRONTIER_REVIEW_RUNTIME_RECOVERY_NOT_RESERVED',
        'Reserve the shared runtime recovery context before replacement start',
      );
    }
    const lostReviewerId = nextRun.frontier_closure.runtime?.lost_reviewer_id;
    if (!lostReviewerId || reviewerId === lostReviewerId) {
      throw new HarnessInvariantError(
        'REVIEW_RUNTIME_REPLACEMENT_INVALID',
        'A frontier runtime replacement must name a new reviewer context',
      );
    }
    recovery.reserved = 0;
    recovery.consumed += 1;
    nextRun.frontier_closure.state = 'RUNNING';
    nextRun.frontier_closure.reviewer_id = reviewerId;
    nextRun.frontier_closure.runtime = {
      state: 'ACTIVE',
      reason: null,
      allocation: 'RECOVERY',
      replaces_reviewer_id: lostReviewerId,
    };
    nextRun.state = 'FRONTIER_REVIEW_RUNNING';
    nextRun.next_action = 'WAIT_FRONTIER_REVIEWER';
    return nextRun;
  }
  if (
    nextRun.frontier_closure?.state !== 'RESERVED' ||
    nextRun.outer_sol.reserved !== 1 ||
    nextRun.outer_sol.closure.reserved !== 1
  ) {
    throw new HarnessInvariantError(
      'FRONTIER_REVIEW_NOT_RESERVED',
      'Reserve the exact frontier closure before starting its reviewer',
    );
  }
  nextRun.outer_sol.reserved = 0;
  nextRun.outer_sol.consumed += 1;
  nextRun.outer_sol.closure.reserved = 0;
  nextRun.outer_sol.closure.consumed += 1;
  nextRun.frontier_closure.state = 'RUNNING';
  nextRun.frontier_closure.reviewer_id = reviewerId;
  nextRun.frontier_closure.runtime = {
    state: 'ACTIVE',
    reason: null,
    allocation: 'NORMAL',
  };
  nextRun.frontier_closure.runtime_history ??= [];
  nextRun.state = 'FRONTIER_REVIEW_RUNNING';
  nextRun.next_action = 'WAIT_FRONTIER_REVIEWER';
  return nextRun;
}

export function reconcileFrontierReviewReservation(
  run,
  launchDefinitelyDidNotOccur,
  { runtimeRecovery = false } = {},
) {
  const nextRun = cloneState(run);
  assertOuterLedger(nextRun.outer_sol);
  const recovery = ensureRuntimeRecoveryLedger(nextRun.outer_sol);
  if (runtimeRecovery) {
    if (
      nextRun.frontier_closure?.state !== 'RUNTIME_RECOVERY_RESERVED' ||
      recovery.reserved !== 1
    ) {
      throw new HarnessInvariantError(
        'NO_FRONTIER_REVIEW_RESERVATION',
        'No frontier runtime recovery reservation exists',
      );
    }
    recovery.reserved = 0;
    if (launchDefinitelyDidNotOccur) {
      nextRun.frontier_closure.state = 'RUNTIME_RECOVERY_REQUIRED';
      nextRun.state = 'FRONTIER_REVIEW_RUNTIME_RECOVERY_REQUIRED';
      nextRun.next_action = 'RESERVE_FRONTIER_RUNTIME_RECOVERY';
    } else {
      recovery.consumed = Math.max(recovery.consumed, 1);
      nextRun.frontier_closure.state = 'RUNTIME_BLOCKED';
      nextRun.frontier_closure.runtime = {
        ...(nextRun.frontier_closure.runtime ?? {}),
        state: 'BLOCKED',
        reason: 'RECOVERY_LAUNCH_UNCERTAIN',
      };
      nextRun.state = 'FRONTIER_REVIEW_RUNTIME_BLOCKED';
      nextRun.next_action = 'STOP_WITHOUT_TRUSTED_FRONTIER_EXHAUSTION';
    }
    return nextRun;
  }
  if (
    nextRun.frontier_closure?.state !== 'RESERVED' ||
    nextRun.outer_sol.reserved !== 1 ||
    nextRun.outer_sol.closure.reserved !== 1
  ) {
    throw new HarnessInvariantError(
      'NO_FRONTIER_REVIEW_RESERVATION',
      'No frontier review reservation exists',
    );
  }
  nextRun.outer_sol.reserved = 0;
  nextRun.outer_sol.closure.reserved = 0;
  if (launchDefinitelyDidNotOccur) {
    nextRun.frontier_closure.state = 'NOT_READY';
    nextRun.frontier_closure.reviewer_id = null;
    nextRun.state = 'ACTIVE';
    nextRun.next_action = 'REASSESS_FRONTIER_REVIEW_READINESS';
  } else {
    nextRun.outer_sol.consumed += 1;
    nextRun.outer_sol.closure.consumed += 1;
    nextRun.frontier_closure.state = 'REJECTED';
    nextRun.frontier_closure.verdict = 'RUNTIME_UNCERTAIN';
    nextRun.frontier_closure.findings = [
      {
        id: 'frontier-review-runtime-uncertain',
        summary: 'Runtime truth cannot prove the reserved closure reviewer did not launch.',
      },
    ];
    nextRun.state = 'FRONTIER_REVIEW_REJECTED';
    nextRun.next_action = 'LUNA_RESUME_DISCOVERY_WITHOUT_SECOND_CLOSURE_REVIEW';
  }
  return nextRun;
}

export function waitForFrontierReviewer(run, reviewerId, runtimeState, reason) {
  if (run.frontier_closure?.reviewer_id !== reviewerId) {
    throw new HarnessInvariantError(
      'REVIEWER_ID_MISMATCH',
      'Runtime observation is allowed only for the recorded frontier reviewer',
    );
  }
  if (!runtimeState) {
    throw new HarnessInvariantError(
      'REVIEW_RUNTIME_OBSERVATION_REQUIRED',
      'Stored control-plane state cannot prove that the frontier reviewer is active',
    );
  }
  if (runtimeState === 'ACTIVE') {
    if (run.state === 'FRONTIER_REVIEW_RUNNING' && run.frontier_closure?.state === 'RUNNING') {
      return { run, durableWrite: false, gitMutations: 0, launches: 0 };
    }
    if (
      run.state !== 'FRONTIER_REVIEW_INTERRUPTED_RESUMABLE' ||
      run.frontier_closure?.state !== 'INTERRUPTED_RESUMABLE'
    ) {
      throw new HarnessInvariantError(
        'REVIEW_RUNTIME_STATE_INVALID',
        `Run state ${run.state} cannot resume the frontier reviewer`,
      );
    }
    const nextRun = cloneState(run);
    nextRun.frontier_closure.state = 'RUNNING';
    nextRun.frontier_closure.runtime = {
      ...(nextRun.frontier_closure.runtime ?? {}),
      state: 'ACTIVE',
      reason: null,
    };
    nextRun.state = 'FRONTIER_REVIEW_RUNNING';
    nextRun.next_action = 'WAIT_FRONTIER_REVIEWER';
    return { run: nextRun, durableWrite: true, gitMutations: 0, launches: 0 };
  }
  if (runtimeState === 'INTERRUPTED') {
    if (!['FRONTIER_REVIEW_RUNNING', 'FRONTIER_REVIEW_INTERRUPTED_RESUMABLE'].includes(run.state)) {
      throw new HarnessInvariantError(
        'REVIEW_RUNTIME_STATE_INVALID',
        `Run state ${run.state} cannot record an interrupted frontier reviewer`,
      );
    }
    requireText(reason, 'REVIEW_RUNTIME_REASON_REQUIRED', 'reason');
    const nextRun = cloneState(run);
    nextRun.frontier_closure.state = 'INTERRUPTED_RESUMABLE';
    nextRun.frontier_closure.runtime = {
      ...(nextRun.frontier_closure.runtime ?? {}),
      state: 'INTERRUPTED_RESUMABLE',
      reason,
    };
    nextRun.state = 'FRONTIER_REVIEW_INTERRUPTED_RESUMABLE';
    nextRun.next_action = 'RESUME_SAME_FRONTIER_REVIEWER';
    return { run: nextRun, durableWrite: true, gitMutations: 0, launches: 0 };
  }
  if (runtimeState === 'UNAVAILABLE') {
    if (!['FRONTIER_REVIEW_RUNNING', 'FRONTIER_REVIEW_INTERRUPTED_RESUMABLE'].includes(run.state)) {
      throw new HarnessInvariantError(
        'REVIEW_RUNTIME_STATE_INVALID',
        `Run state ${run.state} cannot lose the frontier reviewer runtime`,
      );
    }
    requireText(reason, 'REVIEW_RUNTIME_REASON_REQUIRED', 'reason');
    const nextRun = cloneState(run);
    const recovery = ensureRuntimeRecoveryLedger(nextRun.outer_sol);
    const lostAllocation = nextRun.frontier_closure.runtime?.allocation ?? 'NORMAL';
    nextRun.frontier_closure.runtime_history ??= [];
    nextRun.frontier_closure.runtime_history.push({
      reviewer_id: reviewerId,
      allocation: lostAllocation,
      outcome: 'UNAVAILABLE',
      reason,
    });
    const recoveryAvailable = recovery.consumed + recovery.reserved < recovery.max;
    nextRun.frontier_closure.reviewer_id = null;
    nextRun.frontier_closure.runtime = {
      state: recoveryAvailable ? 'RECOVERY_REQUIRED' : 'BLOCKED',
      reason,
      allocation: null,
      lost_reviewer_id: reviewerId,
      replacement_allocation: recoveryAvailable ? 'RECOVERY' : null,
    };
    if (recoveryAvailable) {
      nextRun.frontier_closure.state = 'RUNTIME_RECOVERY_REQUIRED';
      nextRun.state = 'FRONTIER_REVIEW_RUNTIME_RECOVERY_REQUIRED';
      nextRun.next_action = 'RESERVE_FRONTIER_RUNTIME_RECOVERY';
    } else {
      nextRun.frontier_closure.state = 'RUNTIME_BLOCKED';
      nextRun.state = 'FRONTIER_REVIEW_RUNTIME_BLOCKED';
      nextRun.next_action = 'AWAIT_FRONTIER_REVIEWER_RUNTIME_OR_NEW_AUTHORIZATION';
    }
    return { run: nextRun, durableWrite: true, gitMutations: 0, launches: 0 };
  }
  throw new HarnessInvariantError(
    'REVIEW_RUNTIME_STATE_INVALID',
    `Unsupported frontier reviewer runtime state: ${runtimeState}`,
  );
}

export function applyFrontierReviewResult(run, { verdict, findings = [] }) {
  const nextRun = cloneState(run);
  assertOuterLedger(nextRun.outer_sol);
  if (
    nextRun.state !== 'FRONTIER_REVIEW_RUNNING' ||
    nextRun.frontier_closure?.state !== 'RUNNING'
  ) {
    throw new HarnessInvariantError(
      'FRONTIER_REVIEW_NOT_RUNNING',
      'No running frontier reviewer can return a result',
    );
  }
  if (!['PASS', 'DISCOVERY_REQUIRED'].includes(verdict)) {
    throw new HarnessInvariantError(
      'INVALID_FRONTIER_REVIEW_VERDICT',
      `Unsupported frontier verdict: ${verdict}`,
    );
  }
  if (verdict === 'DISCOVERY_REQUIRED' && (!Array.isArray(findings) || findings.length === 0)) {
    throw new HarnessInvariantError(
      'INVALID_REVIEW_FINDINGS',
      'DISCOVERY_REQUIRED must identify at least one missing or contradictory frontier',
    );
  }
  nextRun.frontier_closure.verdict = verdict;
  nextRun.frontier_closure.findings = cloneState(findings);
  nextRun.frontier_closure.runtime_history ??= [];
  nextRun.frontier_closure.runtime_history.push({
    reviewer_id: nextRun.frontier_closure.reviewer_id,
    allocation: nextRun.frontier_closure.runtime?.allocation ?? 'NORMAL',
    replaces_reviewer_id: nextRun.frontier_closure.runtime?.replaces_reviewer_id ?? null,
    outcome: 'VERDICT',
    verdict,
  });
  nextRun.frontier_closure.reviewer_id = null;
  nextRun.frontier_closure.runtime = {
    state: 'COMPLETED',
    reason: null,
    allocation: null,
  };
  if (verdict === 'PASS') {
    nextRun.frontier_closure.state = 'PASS';
    nextRun.state = 'ACTIVE';
    nextRun.next_action = 'STOP_TRUSTED_FRONTIER_EXHAUSTED';
  } else {
    nextRun.frontier_closure.state = 'REJECTED';
    nextRun.state = 'FRONTIER_REVIEW_REJECTED';
    nextRun.next_action = 'LUNA_RESUME_DISCOVERY_WITHOUT_SECOND_CLOSURE_REVIEW';
  }
  return nextRun;
}

export function resumeDiscoveryAfterFrontierRejection(run) {
  const nextRun = cloneState(run);
  assertOuterLedger(nextRun.outer_sol);
  if (
    nextRun.state !== 'FRONTIER_REVIEW_REJECTED' ||
    nextRun.frontier_closure?.state !== 'REJECTED'
  ) {
    throw new HarnessInvariantError(
      'FRONTIER_REVIEW_NOT_REJECTED',
      'Only a rejected frontier closure can resume Luna discovery',
    );
  }
  nextRun.state = 'ACTIVE';
  nextRun.next_action = 'LUNA_DISCOVER_OR_SELECT_ACTIONABLE_FRONTIER';
  return nextRun;
}

export function assertTrustedFrontierStop(run, { baseSha, ledgerHash, evidenceHash }) {
  const closure = run?.frontier_closure;
  if (
    closure?.state !== 'PASS' ||
    closure.verdict !== 'PASS' ||
    closure.base_sha !== baseSha ||
    closure.ledger_hash !== ledgerHash ||
    closure.evidence_hash !== evidenceHash
  ) {
    throw new HarnessInvariantError(
      'FRONTIER_REVIEW_REQUIRED',
      'Trusted frontier exhaustion requires one PASS bound to the exact master, ledger, and evidence',
      {
        expected: { base_sha: baseSha, ledger_hash: ledgerHash, evidence_hash: evidenceHash },
        actual: closure ?? null,
      },
    );
  }
  return true;
}

export function applyReviewResult(run, epoch, { verdict, findings = [] }) {
  const nextRun = cloneState(run);
  const nextEpoch = cloneState(epoch);
  assertOuterLedger(nextRun.outer_sol);
  assertLedger(nextEpoch.review, 'epoch.review', MAX_EPOCH_REVIEWS);
  if (nextEpoch.state !== 'REVIEW_RUNNING') {
    throw new HarnessInvariantError(
      'REVIEW_NOT_RUNNING',
      'No running reviewer can return a result',
    );
  }
  const reviewerId = nextEpoch.review.reviewer_id;
  const runtimeAllocation = nextEpoch.review.runtime?.allocation ?? 'NORMAL';
  const replacesReviewerId = nextEpoch.review.runtime?.replaces_reviewer_id ?? null;
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
    runtime_allocation: runtimeAllocation,
    replaces_reviewer_id: replacesReviewerId,
  });
  nextEpoch.review.reviewer_id = null;
  nextEpoch.review.runtime = { state: 'COMPLETED', reason: null, allocation: null };
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
    if (
      nextEpoch.review.consumed >= nextEpoch.review.max ||
      nextRun.outer_sol.product.consumed >= nextRun.outer_sol.product.max
    ) {
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
  assertOuterLedger(nextRun.outer_sol);
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

function assertIntegrationAuthority(epoch, outerSol) {
  const latestReview = epoch.review_history?.at(-1);
  const passAuthority =
    epoch.state === 'REVIEW_PASSED' && epoch.review_pass_sha === epoch.candidate_sha;
  const reviewBudgetExhausted = epoch.review?.consumed >= epoch.review?.max;
  const outerProductBudgetExhausted = outerSol?.product?.consumed >= outerSol?.product?.max;
  const finalCorrectiveAuthority =
    epoch.state === 'FINAL_CORRECTIVE_READY' &&
    (reviewBudgetExhausted || outerProductBudgetExhausted) &&
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
  return { passAuthority, finalCorrectiveAuthority };
}

export function restoreIntegrationAuthority(epoch, outerSol) {
  if (epoch.state !== 'INTEGRATION_BLOCKED') {
    throw new HarnessInvariantError(
      'INTEGRATION_RESUME_NOT_APPLICABLE',
      'Only an INTEGRATION_BLOCKED Epoch can resume automatic integration',
    );
  }
  for (const state of ['FINAL_CORRECTIVE_READY', 'REVIEW_PASSED']) {
    const restored = cloneState(epoch);
    restored.state = state;
    try {
      assertIntegrationAuthority(restored, outerSol);
      restored.next_action = 'REVALIDATE_AND_RETRY_AUTOMATIC_INTEGRATION';
      return restored;
    } catch (error) {
      if (!(error instanceof HarnessInvariantError) || error.code !== 'REVIEW_PASS_REQUIRED') {
        throw error;
      }
    }
  }
  throw new HarnessInvariantError(
    'INTEGRATION_AUTHORITY_REQUIRED',
    'The blocked Epoch no longer contains reconstructable PASS or final-corrective authority',
  );
}

export function assertMergeReadiness({
  epoch,
  outerSol,
  branchHeadSha,
  prHeadSha,
  currentBaseSha,
}) {
  const { passAuthority, finalCorrectiveAuthority } = assertIntegrationAuthority(epoch, outerSol);
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
  // Keep the canonical machine state compact so complete frontier evidence fits
  // GitHub's control-body limit without lossy summaries or silent truncation.
  return `<!-- ${marker}:start -->\n\`\`\`json\n${JSON.stringify(state)}\n\`\`\`\n<!-- ${marker}:end -->`;
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
  if (marker === RUN_MARKER && state.outer_sol) {
    state.outer_sol.runtime_recovery ??= defaultRuntimeRecoveryLedger();
    if (state.frontier_closure) {
      state.frontier_closure.evidence ??= null;
      state.frontier_closure.runtime ??= {
        state: state.frontier_closure.reviewer_id ? 'OBSERVATION_REQUIRED' : 'NOT_STARTED',
        reason: null,
        allocation: state.frontier_closure.reviewer_id ? 'NORMAL' : null,
      };
      state.frontier_closure.runtime_history ??= [];
    }
  }
  if (marker === EPOCH_MARKER && state.review) {
    state.review.runtime_recovery ??= defaultRuntimeRecoveryLedger();
    state.review.runtime ??= {
      state: state.review.reviewer_id ? 'OBSERVATION_REQUIRED' : 'NOT_STARTED',
      reason: null,
      allocation: state.review.reviewer_id ? 'NORMAL' : null,
    };
    state.review.runtime_history ??= [];
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
  return items.length
    ? items
        .map((item) => {
          if (typeof item === 'string') return `- ${item}`;
          if (item && typeof item === 'object') {
            const summary = Object.entries(item)
              .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
              .join('; ');
            return `- ${summary}`;
          }
          return `- ${String(item)}`;
        })
        .join('\n')
    : '- None recorded';
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
