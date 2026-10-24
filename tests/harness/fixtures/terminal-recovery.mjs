import { createHash, generateKeyPairSync } from 'node:crypto';
import {
  createRunState,
  createEpochState,
  extendEpochReviewBudget,
} from '../../../scripts/lib/agent-harness-core.mjs';
import { canonicalHash } from '../../../scripts/lib/frontier-ledger.mjs';
import { LEGACY_R04_TERMINAL_RECOVERY as policy } from '../../../scripts/lib/harness-terminal-recovery.mjs';

// Synthetic observations for a specifically named legacy migration. This fixture
// is never read by production code and is not a runtime/control-plane fallback.
export function terminalRecoveryFixture() {
  const run = createRunState({ runId: 'synthetic-terminal-recovery' });
  run.parked_epoch_prs = [policy.pr];
  run.outer_sol.product.consumed = 2;
  run.outer_sol.consumed = 2;
  let epoch = createEpochState({
    epochId: policy.epochId,
    baseSha: 'b'.repeat(40),
    objective: 'Synthetic terminal lifecycle migration',
    questions: ['Preserve the original claim?'],
    workPackages: ['Synthetic fixture proof'],
    nonScope: ['No queries or private actions'],
    acceptanceCriteria: ['No report means no matrix credit.'],
  });
  epoch = extendEpochReviewBudget(epoch, {
    additional: 4,
    reason: 'Synthetic six-slot allowance',
    at: '2026-10-24T00:00:00Z',
  });
  const profile = {
    id: policy.profileId,
    epochId: policy.epochId,
    frontierId: 'R04',
    toolName: 'bangumi.get_series_watch_order',
    model: 'gpt-6-luna',
    reasoningEffort: 'max',
    argumentProfile: 'synthetic-frozen-r04-arguments',
    claimLabelName: policy.claimLabelName,
    reportPath: 'docs/live-probes/synthetic-terminal-recovery.json',
    calls: [{ arguments: { subjectId: 991404, depth: 1, maxNodes: 2, media: 'anime' } }],
  };
  const checks = [
    'harness-control',
    'sqlite-default',
    'host-integration',
    'standalone-release-smoke',
    'postgres-compat',
    'provider-foundation',
    'discovery-foundation',
  ].map((name) => ({ name, status: 'COMPLETED', conclusion: 'SUCCESS' }));
  const publicKey = generateKeyPairSync('ed25519').publicKey.export({
    type: 'spki',
    format: 'der',
  });
  const claim = {
    schemaVersion: 1,
    claimId: `profile-run-95-pr-267-${policy.sourceSha.slice(0, 12)}-12345`,
    state: 'INCONCLUSIVE',
    profileId: profile.id,
    epochId: profile.epochId,
    frontierId: 'R04',
    runNumber: 95,
    prNumber: 267,
    toolName: profile.toolName,
    argumentProfile: profile.argumentProfile,
    expectedArguments: profile.calls.map((call) => call.arguments),
    expectedArgumentsSha256: canonicalHash(profile.calls.map((call) => call.arguments)),
    registrySha256: canonicalHash(profile),
    sourceCandidateSha: policy.sourceSha,
    baseSha: epoch.base_sha,
    ciSha: policy.sourceSha,
    ciStatus: 'SUCCESS',
    ciRunId: '12345',
    ciChecks: checks,
    reviewerId: 'opaque://historical-reviewer',
    bundleSha256: 'c'.repeat(64),
    runnerReceiptPublicKey: publicKey.toString('base64'),
    runnerReceiptPublicKeySha256: createHash('sha256').update(publicKey).digest('hex'),
    reportWritten: false,
    retryAllowed: false,
    finishedAt: '2026-10-23T00:00:00Z',
  };
  Object.assign(epoch, {
    pr_number: 267,
    branch: `codex/epoch-${policy.epochId}`,
    candidate_sha: policy.sourceSha,
    review_pass_sha: policy.sourceSha,
    reviewed_base_sha: claim.baseSha,
    state: 'PARKED_FOR_HUMAN',
    findings: [],
    adversarial_preflight: {
      completed: true,
      agent_mcp_profile_dispositions: { [profile.id]: claim },
    },
    review_history: [
      {
        candidate_sha: 'd'.repeat(40),
        reviewed_base_sha: claim.baseSha,
        reviewer_id: claim.reviewerId,
        verdict: 'PASS',
      },
      {
        candidate_sha: policy.sourceSha,
        reviewed_base_sha: claim.baseSha,
        reviewer_id: claim.reviewerId,
        verdict: 'PASS',
      },
    ],
    next_action:
      'The R04 v3 one-shot is terminal INCONCLUSIVE with no report and retryAllowed=false; no matrix credit exists. Exact-Candidate refresh to PR head 5b0bcc64 was rejected because the durable disposition is immutable, while the reviewed Candidate remains a93e1e5c. Preserve this same PR and branch for human disposition; do not merge, replay the claim, or create a replacement. Continue independent safe Run 95 discovery.',
  });
  epoch.review.consumed = 2;
  epoch.review.runtime = { state: 'COMPLETED', reason: null, allocation: null };
  const proof = {
    expectedClaimSha256: canonicalHash(claim),
    sourceProfile: profile,
    pr: {
      number: 267,
      state: 'OPEN',
      headRefName: epoch.branch,
      headRefOid: policy.parkedHeadSha,
      baseRefName: 'master',
    },
    headIncludesSource: true,
    headIncludesParkedHead: true,
    sourceIncludesBase: true,
    reportExists: false,
    sourceCi: { sha: policy.sourceSha, runId: claim.ciRunId, status: 'SUCCESS', checks },
    labels: [
      {
        name: policy.claimLabelName,
        description: `Run 95 R04 profile ${policy.profileId}; permanent one-shot latch.`,
      },
      {
        name: policy.claimLabelName.replace(/-claimed$/u, '-terminal'),
        description: 'Run95 R04 INCONCLUSIVE no-report',
      },
    ],
  };
  return { run, epoch, proof, claim };
}
