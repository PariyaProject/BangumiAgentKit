export class G16OneShotClaimError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'G16OneShotClaimError';
    this.code = code;
  }
}

export function g16OneShotLatchLabelName() {
  return 'harness-r95-g16-person-activity-claimed';
}

export function acquireG16OneShotGitHubLatch(gh) {
  if (typeof gh !== 'function') {
    throw new G16OneShotClaimError(
      'G16_ONESHOT_LATCH_INVALID',
      'A GitHub API adapter is required.',
    );
  }
  const name = g16OneShotLatchLabelName();
  const description =
    'Run 95 G16 bangumi.get_person_activity one-shot latch; permanent; never remove or recreate.';
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
      throw new G16OneShotClaimError(
        'G16_ONESHOT_LATCH_UNCERTAIN',
        'Unable to determine whether the global G16 one-shot latch was acquired; fail closed.',
      );
    }
    if (existing?.name === name && existing?.description === description) {
      throw new G16OneShotClaimError(
        'G16_ONESHOT_ALREADY_CLAIMED',
        'The repository-scoped G16 one-shot latch already exists; refusing another claim.',
      );
    }
    throw new G16OneShotClaimError(
      'G16_ONESHOT_LATCH_CONFLICT',
      'The repository-scoped G16 one-shot latch exists with unexpected metadata; fail closed.',
    );
  }
  if (created?.name !== name || created?.description !== description) {
    throw new G16OneShotClaimError(
      'G16_ONESHOT_LATCH_UNCERTAIN',
      'GitHub did not confirm the expected global G16 one-shot latch; fail closed.',
    );
  }
  return true;
}

export function claimG16OneShotAtomically({
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
    throw new G16OneShotClaimError(
      'G16_ONESHOT_LATCH_INVALID',
      'G16 claim acquisition requires readiness, atomic latch, persistence, and readback adapters.',
    );
  }
  assertReady();
  if (acquireGlobalLatch(claim) !== true) {
    throw new G16OneShotClaimError(
      'G16_ONESHOT_ALREADY_CLAIMED',
      'A concurrent G16 invocation already owns the repository-scoped one-shot latch.',
    );
  }
  assertReady();
  persistClaim(claim);
  const observed = readClaim();
  if (!verifyClaim(observed, claim)) {
    throw new G16OneShotClaimError(
      'G16_ONESHOT_CLAIM_READBACK_MISMATCH',
      'Durable G16 claim readback did not match the latched claim.',
    );
  }
  return observed;
}
