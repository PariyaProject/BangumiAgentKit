export class G04OneShotClaimError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'G04OneShotClaimError';
    this.code = code;
  }
}

export function g04OneShotLatchLabelName() {
  return 'harness-r95-g04-person-activity-claimed';
}

export function g04OneShotLatchLabelDescription() {
  return 'Run 95 G04 bangumi.get_person_activity one-shot latch; permanent; never remove or recreate.';
}

export function acquireG04OneShotGitHubLatch(gh) {
  if (typeof gh !== 'function') {
    throw new G04OneShotClaimError(
      'G04_ONESHOT_LATCH_INVALID',
      'A GitHub API adapter is required.',
    );
  }
  const name = g04OneShotLatchLabelName();
  const description = g04OneShotLatchLabelDescription();
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
      existing = JSON.parse(gh('api', 'repos/{owner}/{repo}/labels/' + encodeURIComponent(name)));
    } catch {
      throw new G04OneShotClaimError(
        'G04_ONESHOT_LATCH_UNCERTAIN',
        'Unable to determine whether the global G04 one-shot latch was acquired; fail closed.',
      );
    }
    if (existing?.name === name && existing?.description === description) {
      throw new G04OneShotClaimError(
        'G04_ONESHOT_ALREADY_CLAIMED',
        'The repository-scoped G04 one-shot latch already exists; refusing another claim.',
      );
    }
    throw new G04OneShotClaimError(
      'G04_ONESHOT_LATCH_CONFLICT',
      'The repository-scoped G04 one-shot latch exists with unexpected metadata; fail closed.',
    );
  }
  if (created?.name !== name || created?.description !== description) {
    throw new G04OneShotClaimError(
      'G04_ONESHOT_LATCH_UNCERTAIN',
      'GitHub did not confirm the expected global G04 one-shot latch; fail closed.',
    );
  }
  return true;
}

export function claimG04OneShotAtomically({
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
    throw new G04OneShotClaimError(
      'G04_ONESHOT_LATCH_INVALID',
      'G04 claim acquisition requires readiness, atomic latch, persistence, and readback adapters.',
    );
  }
  assertReady();
  if (acquireGlobalLatch(claim) !== true) {
    throw new G04OneShotClaimError(
      'G04_ONESHOT_ALREADY_CLAIMED',
      'A concurrent G04 invocation already owns the repository-scoped one-shot latch.',
    );
  }
  assertReady();
  persistClaim(claim);
  const observed = readClaim();
  if (!verifyClaim(observed, claim)) {
    throw new G04OneShotClaimError(
      'G04_ONESHOT_CLAIM_READBACK_MISMATCH',
      'Durable G04 claim readback did not match the latched claim.',
    );
  }
  return observed;
}
