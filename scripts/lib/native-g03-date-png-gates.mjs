import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { G03_MODEL_PROFILE as P } from './native-g03-date-png-profile.mjs';
import {
  sanitizeGitRepositoryEnvironment,
  gitRepositoryText,
  computeMcpBundleSha256,
} from './g26-mcp-bundle.mjs';
import { deriveP06CiRunEvidence } from './p06-ci-run-evidence.mjs';
import {
  G03_MODEL_ROOT as ROOT,
  validG03ModelClaim,
} from '../acceptance/native-g03-date-png-report.mjs';

export function readG03ModelBundleAttestation(root = ROOT) {
  const value = JSON.parse(
    readFileSync(
      path.join(root, 'docs/product/native-g03-date-png-mcp-bundle-attestation.json'),
      'utf8',
    ),
  );
  if (
    Object.keys(value).sort().join(',') !== 'bundleSha256,kind,schemaVersion' ||
    value.schemaVersion !== 1 ||
    value.kind !== 'native-g03-date-png-mcp-runtime-bundle-attestation-v1' ||
    typeof value.bundleSha256 !== 'string' ||
    !/^[0-9a-f]{64}$/u.test(value.bundleSha256)
  )
    throw new Error('G03_MODEL_BUNDLE_ATTESTATION_INVALID');
  return value.bundleSha256;
}

export function g03ModelEnvironment(source = process.env, control = false) {
  const result = sanitizeGitRepositoryEnvironment(source);
  for (const key of Object.keys(result)) {
    if (control && ['GH_TOKEN', 'GITHUB_TOKEN'].includes(key)) continue;
    if (
      /BANGUMI|BGM_|OAUTH|TOKEN|SECRET|CREDENTIAL|API[_-]?KEY|BASE[_-]?URL|MODEL[_-]?(?:CATALOG|PROVIDER)|ANTHROPIC|GEMINI|GOOGLE|VERTEX|AZURE|MISTRAL|OLLAMA|LMSTUDIO|^NODE_OPTIONS$|^NODE_PATH$|^LD_PRELOAD$|^DYLD_/iu.test(
        key,
      )
    )
      delete result[key];
  }
  result.PARIYA_BANGUMI_AGENT_KIT_SOURCE = ROOT;
  result.RENDERER_TIMEOUT_MS = '8000';
  result.RENDERER_MAX_OUTPUT_BYTES = '5000000';
  result.RENDERER_MAX_CONCURRENCY = '1';
  return result;
}

export function g03ModelHarness(args, { control = true } = {}) {
  if (process.env.HARNESS_MOCK_STATE) throw new Error('G03_MODEL_MOCK_CONTROL_FORBIDDEN');
  try {
    const output = execFileSync(process.execPath, [ROOT + '/scripts/agent-harness.mjs', ...args], {
      cwd: ROOT,
      env: g03ModelEnvironment(process.env, control),
      timeout: 30000,
      maxBuffer: 4 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return JSON.parse(output.toString('utf8'));
  } catch (error) {
    const safe = new Error('G03_MODEL_CONTROL_QUERY_FAILED');
    safe.controlCode =
      /^([A-Z][A-Z0-9_]{3,80}):/u.exec(error?.stderr?.toString() ?? '')?.[1] ?? null;
    throw safe;
  }
}

export function readG03ModelStatus(prNumber, options) {
  return g03ModelHarness(
    [
      'epoch:agent-mcp-profile-status',
      '--run',
      '95',
      '--pr',
      String(prNumber),
      '--profile-id',
      P.id,
    ],
    options,
  );
}

export function assertG03ModelReviewGate(
  status,
  { sourceRevision, bundleSha256, expectedClaim = null, reportOnly = false, root = ROOT } = {},
) {
  const run = status?.run?.state,
    view = status?.epoch,
    epoch = view?.state;
  const review = epoch?.review_history?.at(-1);
  // Harness status exposes immutable state and independent live head/base in
  // epoch; CI check identity is checked separately against GitHub below.
  const checks = epoch?.ci;
  if (
    run?.state !== 'EPOCH_ACTIVE' ||
    run.active_epoch_pr !== view?.number ||
    run.pending_epoch != null ||
    epoch?.state !== 'REVIEW_PASSED' ||
    epoch.epoch_id !== P.epochId ||
    epoch.pr_number !== view?.number ||
    epoch.base_branch !== 'master' ||
    epoch.candidate_sha !== sourceRevision ||
    epoch.review_pass_sha !== sourceRevision ||
    epoch.reviewed_base_sha !== epoch.base_sha ||
    checks?.sha !== sourceRevision ||
    checks.status !== 'SUCCESS' ||
    epoch.scope_closure?.related_work_remaining !== false ||
    epoch.adversarial_preflight?.completed !== true ||
    !epoch.advances_frontier_ids?.includes(P.frontierId) ||
    review?.verdict !== 'PASS' ||
    review.candidate_sha !== sourceRevision ||
    review.reviewed_base_sha !== epoch.base_sha ||
    typeof review.reviewer_id !== 'string' ||
    !review.reviewer_id.trim() ||
    view.pr_head_sha !== sourceRevision ||
    view.pr_base_ref_name !== 'master' ||
    view.pr_base_sha !== epoch.base_sha ||
    view.pr_is_draft !== false ||
    view.github_state !== 'OPEN'
  )
    throw new Error('G03_MODEL_REVIEW_GATE_FAILED');
  const git = (...args) => gitRepositoryText(root, args);
  const dirty = git('status', '--porcelain', '--untracked-files=all');
  if (
    git('rev-parse', 'HEAD') !== sourceRevision ||
    git('branch', '--show-current') !== epoch.branch ||
    git('rev-parse', 'origin/master') !== epoch.base_sha ||
    !(dirty === '' || (reportOnly && dirty === `?? ${P.reportPath}`)) ||
    computeMcpBundleSha256(root) !== bundleSha256 ||
    readG03ModelBundleAttestation(root) !== bundleSha256
  )
    throw new Error('G03_MODEL_SOURCE_GATE_FAILED');
  const live = JSON.parse(
    execFileSync(
      'gh',
      [
        'pr',
        'view',
        String(view.number),
        '--json',
        'state,isDraft,headRefName,headRefOid,baseRefName,baseRefOid,statusCheckRollup',
      ],
      {
        cwd: root,
        env: g03ModelEnvironment(process.env, true),
        timeout: 30000,
        maxBuffer: 256 * 1024,
        stdio: ['ignore', 'pipe', 'ignore'],
      },
    ),
  );
  const ci = deriveP06CiRunEvidence(checks.url, live.statusCheckRollup);
  if (
    live.state !== 'OPEN' ||
    live.isDraft ||
    live.headRefOid !== sourceRevision ||
    live.headRefName !== epoch.branch ||
    live.baseRefName !== 'master' ||
    live.baseRefOid !== epoch.base_sha ||
    !ci
  )
    throw new Error('G03_MODEL_LIVE_CI_GATE_FAILED');
  if (
    expectedClaim &&
    (!validG03ModelClaim(expectedClaim) ||
      expectedClaim.sourceCandidateSha !== sourceRevision ||
      expectedClaim.baseSha !== epoch.base_sha ||
      expectedClaim.bundleSha256 !== bundleSha256 ||
      expectedClaim.reviewerId !== review.reviewer_id ||
      expectedClaim.ciRunId !== ci.ciRunId ||
      !isDeepStrictEqual(expectedClaim.ciChecks, ci.ciChecks))
  )
    throw new Error('G03_MODEL_CLAIM_GATE_FAILED');
  // Avoid any inferred meaning from a reviewer's name or a run-level summary.
  return {
    prNumber: view.number,
    reviewerId: review.reviewer_id,
    sourceRevision,
    baseSha: epoch.base_sha,
    bundleSha256,
    ...ci,
  };
}

export function assertG03ModelClaimReadback(status, expectedClaim) {
  if (
    status?.state !== 'CLAIMED' ||
    status.issue_state !== 'EPOCH_ACTIVE' ||
    status.run !== 95 ||
    status.pr !== expectedClaim.prNumber ||
    status.profile_id !== P.id ||
    status.epoch_id !== P.epochId ||
    status.claim_label_present !== true ||
    status.terminal_label_present !== false ||
    !validG03ModelClaim(status.disposition) ||
    status.disposition.state !== 'CLAIMED' ||
    status.disposition.retryAllowed !== false ||
    !isDeepStrictEqual(status.disposition, expectedClaim)
  )
    throw new Error('G03_MODEL_CLAIM_READBACK_FAILED');
}
