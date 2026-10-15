export const P05_ONE_SHOT_LATCH_LABEL_NAME = 'harness-r95-p05-person-media-claimed';
export const P05_ONE_SHOT_LATCH_LABEL_DESCRIPTION =
  'Run 95 P05 bangumi.get_person_profile one-shot latch; permanent; never remove or recreate.';
export const P05_ONE_SHOT_REPORT_PATH =
  'docs/live-probes/p05-person-media-public-probe-run95.json';

export class P05OneShotClaimError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'P05OneShotClaimError';
    this.code = code;
  }
}

export function acquireP05OneShotGitHubLatch(gh) {
  if (typeof gh !== 'function') {
    throw new P05OneShotClaimError('P05_ONESHOT_LATCH_INVALID', 'A GitHub API adapter is required.');
  }
  const name = P05_ONE_SHOT_LATCH_LABEL_NAME;
  const description = P05_ONE_SHOT_LATCH_LABEL_DESCRIPTION;
  let created;
  try {
    created = JSON.parse(
      gh('api', 'repos/{owner}/{repo}/labels', '--method', 'POST', '--input', '-', {
        input: JSON.stringify({ name, color: 'b60205', description }),
      }),
    );
  } catch {
    let existing;
    try {
      existing = JSON.parse(gh('api', `repos/{owner}/{repo}/labels/${encodeURIComponent(name)}`));
    } catch {
      throw new P05OneShotClaimError(
        'P05_ONESHOT_LATCH_UNCERTAIN',
        'Unable to determine whether the repository-wide P05 latch was acquired; fail closed.',
      );
    }
    if (existing?.name === name && existing?.description === description) {
      throw new P05OneShotClaimError(
        'P05_ONESHOT_ALREADY_CLAIMED',
        'The permanent repository-wide P05 latch already exists; refusing another read.',
      );
    }
    throw new P05OneShotClaimError(
      'P05_ONESHOT_LATCH_CONFLICT',
      'The repository-wide P05 latch exists with unexpected metadata; fail closed.',
    );
  }
  if (created?.name !== name || created?.description !== description) {
    throw new P05OneShotClaimError(
      'P05_ONESHOT_LATCH_UNCERTAIN',
      'GitHub did not confirm the exact repository-wide P05 latch; fail closed.',
    );
  }
  return true;
}

export function verifyP05OneShotGitHubLatch(gh) {
  if (typeof gh !== 'function') {
    throw new P05OneShotClaimError('P05_ONESHOT_LATCH_INVALID', 'A GitHub API adapter is required.');
  }
  let label;
  try {
    label = JSON.parse(
      gh(
        'api',
        `repos/{owner}/{repo}/labels/${encodeURIComponent(P05_ONE_SHOT_LATCH_LABEL_NAME)}`,
      ),
    );
  } catch {
    throw new P05OneShotClaimError(
      'P05_ONESHOT_LATCH_UNCERTAIN',
      'Unable to verify the permanent repository-wide P05 latch; fail closed.',
    );
  }
  if (
    label?.name !== P05_ONE_SHOT_LATCH_LABEL_NAME ||
    label?.description !== P05_ONE_SHOT_LATCH_LABEL_DESCRIPTION
  ) {
    throw new P05OneShotClaimError(
      'P05_ONESHOT_LATCH_CONFLICT',
      'The permanent repository-wide P05 latch has unexpected metadata; fail closed.',
    );
  }
  return true;
}

export function claimP05OneShotAtomically({
  claim,
  assertReady,
  acquireGlobalLatch,
  persistClaim,
  readClaim,
  verifyClaim,
}) {
  if (
    !claim ||
    typeof assertReady !== 'function' ||
    typeof acquireGlobalLatch !== 'function' ||
    typeof persistClaim !== 'function' ||
    typeof readClaim !== 'function' ||
    typeof verifyClaim !== 'function'
  ) {
    throw new P05OneShotClaimError(
      'P05_ONESHOT_CLAIM_INVALID',
      'P05 claim acquisition requires readiness, global latch, persistence, and readback adapters.',
    );
  }
  assertReady();
  if (acquireGlobalLatch(claim) !== true) {
    throw new P05OneShotClaimError(
      'P05_ONESHOT_ALREADY_CLAIMED',
      'A concurrent P05 invocation already owns the permanent repository-wide latch.',
    );
  }
  assertReady();
  persistClaim(claim);
  const observed = readClaim();
  if (!verifyClaim(observed, claim)) {
    throw new P05OneShotClaimError(
      'P05_ONESHOT_CLAIM_READBACK_MISMATCH',
      'The active PR claim readback did not match the exact latched P05 claim.',
    );
  }
  return observed;
}
