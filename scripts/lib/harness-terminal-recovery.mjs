import { createHash, createPublicKey } from 'node:crypto';
import { HarnessInvariantError } from './agent-harness-core.mjs';
import { canonicalHash } from './frontier-ledger.mjs';
import { isValidP06CiRunEvidence } from './p06-ci-run-evidence.mjs';

// A reviewed legacy migration, not a generic override of PARKED_FOR_HUMAN.
export const LEGACY_R04_TERMINAL_RECOVERY = Object.freeze({
  run: 95,
  pr: 267,
  epochId: 'run95-r04-series-watch-order-offline-matrix-v3-20261023',
  profileId: 'r04-series-watch-order-offline-agent-mcp-v3',
  claimLabelName: 'harness-r95-r04-watch-order-offline-v3-claimed',
  sourceSha: 'a93e1e5c06954a1b195f6603f81d47498d7a6eda',
  parkedHeadSha: '5b0bcc646773cdab61228c1b0a9e052e3f05e539',
  parkReasonSha256: '7a236651920fc9bf1715d840ebd41bad1035ec2794c0747aeb8dea397e2b8370',
});

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const fail = (message) => {
  throw new HarnessInvariantError('TERMINAL_RECOVERY_INELIGIBLE', message);
};
const noReservation = (value) => (value?.reserved ?? 0) === 0;
const AMENDMENT =
  'Technical terminal recovery supersedes the report-only integration clause for this known no-report outcome: integrate only freshly reviewed implementation with its original immutable INCONCLUSIVE disposition. This grants no matrix/scenario credit, report acceptance or retry; all credit still requires its original validated report contract.';

/** Verify the live proof before preparing any control-plane transition. */
export function planLegacyTerminalRecovery(run, epoch, proof) {
  if (
    !run ||
    !epoch ||
    !proof ||
    typeof run !== 'object' ||
    typeof epoch !== 'object' ||
    typeof proof !== 'object' ||
    Array.isArray(run) ||
    Array.isArray(epoch) ||
    Array.isArray(proof)
  )
    fail('Recovery needs complete live control and proof objects.');
  const policy = LEGACY_R04_TERMINAL_RECOVERY;
  const intent = run.pending_terminal_recovery;
  const ledgers = [
    run.outer_sol,
    run.outer_sol?.product,
    run.outer_sol?.closure,
    run.outer_sol?.runtime_recovery,
    epoch.review,
    epoch.review?.runtime_recovery,
  ];
  if (
    ledgers.some(
      (ledger) =>
        !ledger ||
        !Number.isSafeInteger(ledger.max) ||
        !Number.isSafeInteger(ledger.consumed) ||
        !Number.isSafeInteger(ledger.reserved) ||
        ledger.max < 0 ||
        ledger.consumed < 0 ||
        ledger.reserved < 0 ||
        ledger.consumed + ledger.reserved > ledger.max,
    )
  )
    fail('Recovery cannot repair or reset an invalid review ledger.');
  if (
    run.outer_sol.product.consumed + run.outer_sol.closure.consumed !== run.outer_sol.consumed ||
    run.outer_sol.product.max + run.outer_sol.closure.max !== run.outer_sol.max ||
    run.outer_sol.product.reserved + run.outer_sol.closure.reserved !== run.outer_sol.reserved
  )
    fail('Recovery must preserve a valid paired outer ledger.');
  const history = Array.isArray(epoch.terminal_recovery_history)
    ? epoch.terminal_recovery_history.at(-1)
    : undefined;
  const paired =
    run.state === 'EPOCH_ACTIVE' &&
    run.active_epoch_pr === policy.pr &&
    history?.kind === 'LEGACY_R04_NO_REPORT' &&
    Array.isArray(run.terminal_recovery_history) &&
    run.terminal_recovery_history.at(-1)?.intent_id === history.intent_id;
  if (
    (!paired && !['ACTIVE', 'TERMINAL_RECOVERY_PENDING'].includes(run.state)) ||
    (!paired && (run.active_epoch_pr || run.pending_epoch)) ||
    (!paired && !run.parked_epoch_prs?.includes(policy.pr)) ||
    !noReservation(run.outer_sol) ||
    !noReservation(run.outer_sol?.product) ||
    !noReservation(run.outer_sol?.closure) ||
    !noReservation(run.outer_sol?.runtime_recovery) ||
    !noReservation(run.frontier_closure) ||
    run.frontier_closure?.reviewer_id ||
    !noReservation(epoch.review) ||
    !noReservation(epoch.review?.runtime_recovery) ||
    epoch.review?.reviewer_id ||
    epoch.review?.runtime?.state !== 'COMPLETED'
  )
    fail('A technical recovery requires the idle same Run and no active/reserved review.');

  const profile = proof.sourceProfile;
  const claims = epoch.adversarial_preflight?.agent_mcp_profile_dispositions;
  const claim = claims?.[policy.profileId];
  const reviews = epoch.review_history;
  const sourcePass = Array.isArray(reviews)
    ? reviews.find(
        (review) =>
          review.candidate_sha === policy.sourceSha &&
          review.reviewed_base_sha === claim?.baseSha &&
          review.reviewer_id === claim?.reviewerId &&
          review.verdict === 'PASS',
      )
    : undefined;
  const prepared = history?.kind === 'LEGACY_R04_NO_REPORT';
  const oldParkHash = prepared
    ? history.park_reason_sha256
    : sha256(typeof epoch.next_action === 'string' ? epoch.next_action : '');
  if (
    epoch.pr_number !== policy.pr ||
    epoch.epoch_id !== policy.epochId ||
    epoch.base_branch !== 'master' ||
    epoch.branch !== `codex/epoch-${policy.epochId}` ||
    (!prepared && epoch.state !== 'PARKED_FOR_HUMAN') ||
    (prepared && !paired && epoch.state !== 'CORRECTIVE_REQUIRED') ||
    oldParkHash !== policy.parkReasonSha256 ||
    !Array.isArray(reviews) ||
    reviews.length !== epoch.review.consumed ||
    reviews.some((review) => review.verdict === 'HUMAN_REVIEW_REQUIRED') ||
    !sourcePass ||
    !Array.isArray(epoch.findings) ||
    epoch.findings.length !== 0 ||
    !claims ||
    Object.keys(claims).length !== 1 ||
    !profile ||
    profile.id !== policy.profileId ||
    profile.epochId !== policy.epochId ||
    profile.frontierId !== 'R04' ||
    profile.toolName !== 'bangumi.get_series_watch_order' ||
    profile.claimLabelName !== policy.claimLabelName ||
    profile.model !== 'gpt-6-luna' ||
    profile.reasoningEffort !== 'max' ||
    claim?.state !== 'INCONCLUSIVE' ||
    claim.reportWritten !== false ||
    claim.retryAllowed !== false ||
    claim.profileId !== profile.id ||
    claim.epochId !== policy.epochId ||
    claim.runNumber !== policy.run ||
    claim.prNumber !== policy.pr ||
    claim.frontierId !== 'R04' ||
    claim.toolName !== profile.toolName ||
    claim.argumentProfile !== profile.argumentProfile ||
    proof.expectedClaimSha256 !== canonicalHash(claim) ||
    claim.sourceCandidateSha !== policy.sourceSha ||
    claim.ciSha !== policy.sourceSha ||
    !new RegExp(`^profile-run-95-pr-267-${policy.sourceSha.slice(0, 12)}-[0-9]+$`, 'u').test(
      claim.claimId ?? '',
    ) ||
    (!prepared &&
      (epoch.candidate_sha !== policy.sourceSha ||
        epoch.review_pass_sha !== policy.sourceSha ||
        epoch.base_sha !== claim.baseSha ||
        epoch.reviewed_base_sha !== claim.baseSha)) ||
    claim.ciStatus !== 'SUCCESS' ||
    !isValidP06CiRunEvidence(claim) ||
    typeof claim.reviewerId !== 'string' ||
    !claim.reviewerId.trim() ||
    claim.registrySha256 !== canonicalHash(profile) ||
    !Array.isArray(profile.calls) ||
    claim.expectedArgumentsSha256 !== canonicalHash(profile.calls.map((call) => call.arguments)) ||
    !Array.isArray(claim.expectedArguments) ||
    canonicalHash(claim.expectedArguments) !== claim.expectedArgumentsSha256 ||
    !/^[a-f0-9]{64}$/u.test(claim.bundleSha256 ?? '') ||
    claim.reportPath != null ||
    claim.reportSha256 != null ||
    claim.unacceptedReportSha256 != null
  )
    fail(
      'Only the pinned technical R04 no-report park with intact source PASS and claim is eligible.',
    );

  try {
    const key = Buffer.from(claim.runnerReceiptPublicKey, 'base64');
    if (
      key.toString('base64') !== claim.runnerReceiptPublicKey ||
      sha256(key) !== claim.runnerReceiptPublicKeySha256 ||
      createPublicKey({ key, format: 'der', type: 'spki' }).asymmetricKeyType !== 'ed25519'
    )
      throw new Error();
  } catch {
    fail('The original runner receipt key binding is invalid.');
  }

  const view = proof.pr;
  const claimLabel = (Array.isArray(proof.labels) ? proof.labels : []).find(
    (label) => label.name === profile.claimLabelName,
  );
  const terminalLabel = (Array.isArray(proof.labels) ? proof.labels : []).find(
    (label) => label.name === policy.claimLabelName.replace(/-claimed$/u, '-terminal'),
  );
  if (
    view?.number !== policy.pr ||
    view.state !== 'OPEN' ||
    view.headRefName !== epoch.branch ||
    view.baseRefName !== 'master' ||
    !/^[a-f0-9]{40}$/u.test(view.headRefOid ?? '') ||
    proof.headIncludesSource !== true ||
    proof.headIncludesParkedHead !== true ||
    proof.sourceIncludesBase !== true ||
    proof.reportExists !== false ||
    proof.sourceCi?.sha !== claim.ciSha ||
    proof.sourceCi.status !== 'SUCCESS' ||
    proof.sourceCi.runId !== claim.ciRunId ||
    !Array.isArray(proof.sourceCi.checks) ||
    canonicalHash(proof.sourceCi.checks) !== canonicalHash(claim.ciChecks) ||
    claimLabel?.description !==
      `Run 95 R04 profile ${policy.profileId}; permanent one-shot latch.` ||
    terminalLabel?.description !== 'Run95 R04 INCONCLUSIVE no-report'
  )
    fail('Live PR, source CI, ancestry, report absence and permanent latches must all match.');

  const claimHash = canonicalHash(claim);
  if (prepared && history.claim_sha256 !== claimHash) fail('The prepared original claim changed.');
  if (paired) return { state: 'TERMINAL_RECOVERY_ALREADY_RESUMED', intent_id: history.intent_id };
  if (
    intent &&
    (intent.kind !== 'LEGACY_R04_NO_REPORT' ||
      intent.pr !== policy.pr ||
      intent.claim_sha256 !== claimHash ||
      intent.pr_head_sha !== view.headRefOid ||
      intent.park_reason_sha256 !== policy.parkReasonSha256)
  ) {
    fail('The pending recovery belongs to different immutable inputs.');
  }
  if (run.state === 'TERMINAL_RECOVERY_PENDING' && !intent)
    fail('A pending recovery needs its exact intent.');

  const newIntent = intent
    ? structuredClone(intent)
    : {
        kind: 'LEGACY_R04_NO_REPORT',
        pr: policy.pr,
        claim_sha256: claimHash,
        pr_head_sha: view.headRefOid,
        park_reason_sha256: policy.parkReasonSha256,
        original_epoch_sha256: canonicalHash(epoch),
      };
  const identity = { ...newIntent };
  delete identity.prepared_epoch_sha256;
  const intentId = canonicalHash(identity);
  if (prepared && history.intent_id !== intentId)
    fail('The prepared Epoch does not match the Run intent.');
  if (!prepared && intent && intent.original_epoch_sha256 !== canonicalHash(epoch)) {
    fail('The parked Epoch changed after recovery preparation.');
  }
  const pendingRun = structuredClone(run);
  pendingRun.state = 'TERMINAL_RECOVERY_PENDING';
  pendingRun.pending_terminal_recovery = newIntent;
  pendingRun.next_action = `RESUME_TERMINAL_RECOVERY_PR_${policy.pr}`;

  const preparedEpoch = structuredClone(epoch);
  if (!prepared) {
    preparedEpoch.terminal_recovery_history ??= [];
    preparedEpoch.terminal_recovery_history.push({
      kind: newIntent.kind,
      intent_id: intentId,
      claim_sha256: claimHash,
      park_reason_sha256: policy.parkReasonSha256,
      previous_candidate_sha: epoch.candidate_sha,
      previous_review_pass_sha: epoch.review_pass_sha,
      scope_amendment: AMENDMENT,
    });
    preparedEpoch.acceptance_criteria = [...epoch.acceptance_criteria, AMENDMENT];
    preparedEpoch.state = 'CORRECTIVE_REQUIRED';
    preparedEpoch.candidate_sha = null;
    preparedEpoch.review_pass_sha = null;
    preparedEpoch.reviewed_base_sha = null;
    preparedEpoch.ci = { sha: null, status: 'NOT_RUN', url: null };
    preparedEpoch.scope_closure = {
      why_not_review_earlier:
        'Terminal recovery needs same-branch synchronization and fresh Candidate validation before another review.',
      why_not_extend_further:
        'Preserve the bounded implementation and historical no-report result; grant no credit or retry.',
      related_work_remaining: true,
    };
    preparedEpoch.adversarial_preflight.completed = false;
    preparedEpoch.next_action = 'SYNCHRONIZE_SAME_BRANCH_AND_ESTABLISH_FRESH_CANDIDATE_NO_RETRY';
  }
  const preparedHash = canonicalHash(preparedEpoch);
  if (intent && intent.prepared_epoch_sha256 !== preparedHash)
    fail('The prepared Epoch changed after recovery intent.');
  newIntent.prepared_epoch_sha256 = preparedHash;
  const completedRun = structuredClone(pendingRun);
  completedRun.state = 'EPOCH_ACTIVE';
  completedRun.active_epoch_pr = policy.pr;
  completedRun.parked_epoch_prs = completedRun.parked_epoch_prs.filter((pr) => pr !== policy.pr);
  delete completedRun.pending_terminal_recovery;
  completedRun.terminal_recovery_history ??= [];
  if (!completedRun.terminal_recovery_history.some((entry) => entry.intent_id === intentId)) {
    completedRun.terminal_recovery_history.push({
      pr: policy.pr,
      intent_id: intentId,
      claim_sha256: claimHash,
    });
  }
  completedRun.next_action = `RESUME_PR_${policy.pr}_FRESH_REVIEW_NO_RETRY`;
  return {
    state: 'TERMINAL_RECOVERY_PLAN_VALID',
    intent_id: intentId,
    pendingRun,
    preparedEpoch,
    completedRun,
  };
}
