export class R01OneShotClaimError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'R01OneShotClaimError';
    this.code = code;
  }
}

export function r01OneShotLatchLabelName() {
  return 'harness-r95-r01-subject-relations-claimed';
}

export function r01OneShotLatchLabelDescription() {
  return 'Run 95 R01 bangumi.get_subject_relations one-shot latch; permanent; never remove or recreate.';
}

export function acquireR01OneShotGitHubLatch(gh) {
  if (typeof gh !== 'function') {
    throw new R01OneShotClaimError(
      'R01_ONESHOT_LATCH_INVALID',
      'A GitHub API adapter is required.',
    );
  }
  const name = r01OneShotLatchLabelName();
  const description = r01OneShotLatchLabelDescription();
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
      existing = JSON.parse(
        gh('api', `repos/{owner}/{repo}/labels/${encodeURIComponent(name)}`),
      );
    } catch {
      throw new R01OneShotClaimError(
        'R01_ONESHOT_LATCH_UNCERTAIN',
        'Unable to determine whether the global R01 one-shot latch was acquired; fail closed.',
      );
    }
    if (existing?.name === name && existing?.description === description) {
      throw new R01OneShotClaimError(
        'R01_ONESHOT_ALREADY_CLAIMED',
        'The repository-scoped R01 one-shot latch already exists; refusing another claim.',
      );
    }
    throw new R01OneShotClaimError(
      'R01_ONESHOT_LATCH_CONFLICT',
      'The repository-scoped R01 one-shot latch exists with unexpected metadata; fail closed.',
    );
  }
  if (created?.name !== name || created?.description !== description) {
    throw new R01OneShotClaimError(
      'R01_ONESHOT_LATCH_UNCERTAIN',
      'GitHub did not confirm the expected global R01 one-shot latch; fail closed.',
    );
  }
  return true;
}

export function claimR01OneShotAtomically({
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
    throw new R01OneShotClaimError(
      'R01_ONESHOT_LATCH_INVALID',
      'R01 claim acquisition requires readiness, atomic latch, persistence, and readback adapters.',
    );
  }
  assertReady();
  if (acquireGlobalLatch(claim) !== true) {
    throw new R01OneShotClaimError(
      'R01_ONESHOT_ALREADY_CLAIMED',
      'A concurrent R01 invocation already owns the repository-scoped one-shot latch.',
    );
  }
  assertReady();
  persistClaim(claim);
  const observed = readClaim();
  if (!verifyClaim(observed, claim)) {
    throw new R01OneShotClaimError(
      'R01_ONESHOT_CLAIM_READBACK_MISMATCH',
      'Durable R01 claim readback did not match the latched claim.',
    );
  }
  return observed;
}
