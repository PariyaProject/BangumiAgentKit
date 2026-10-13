export class G06OneShotClaimError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'G06OneShotClaimError';
    this.code = code;
  }
}

export function g06OneShotLatchLabelName() {
  return 'harness-r95-g06-subject-cast-claimed';
}

export function g06OneShotLatchLabelDescription() {
  return 'Run 95 G06 bangumi.get_subject_cast one-shot latch; permanent; never remove or recreate.';
}

export function g06OneShotTerminalLabelName() {
  return 'harness-r95-g06-subject-cast-terminal';
}

export function g06OneShotTerminalLabelDescription(resultState, reportSha256 = null) {
  if (resultState === 'INCONCLUSIVE') {
    if (reportSha256 !== null) {
      throw new G06OneShotClaimError(
        'G06_ONESHOT_TERMINAL_INVALID',
        'An inconclusive G06 attempt cannot bind an accepted report.',
      );
    }
    return 'G06-INCONCLUSIVE:report=none';
  }
  if (resultState === 'REPORT_WRITTEN' && /^[0-9a-f]{64}$/u.test(reportSha256 ?? '')) {
    return `G06-REPORT_WRITTEN:sha256=${reportSha256}`;
  }
  throw new G06OneShotClaimError(
    'G06_ONESHOT_TERMINAL_INVALID',
    'A G06 terminal state must be INCONCLUSIVE or bind a valid REPORT_WRITTEN digest.',
  );
}

function readLabel(gh, name, uncertainCode, message) {
  try {
    return JSON.parse(gh('api', `repos/{owner}/{repo}/labels/${encodeURIComponent(name)}`));
  } catch (error) {
    const detail = `${error?.message ?? ''} ${error?.stderr ?? ''}`;
    if (/\b404\b|Not Found/u.test(detail)) return null;
    throw new G06OneShotClaimError(uncertainCode, message);
  }
}

export function verifyG06OneShotGitHubLatch(gh) {
  const name = g06OneShotLatchLabelName();
  const label = readLabel(
    gh,
    name,
    'G06_ONESHOT_LATCH_UNCERTAIN',
    'Unable to verify the permanent repository-wide G06 latch; fail closed.',
  );
  if (label?.name !== name || label?.description !== g06OneShotLatchLabelDescription()) {
    throw new G06OneShotClaimError(
      'G06_ONESHOT_LATCH_MISSING_OR_CONFLICTING',
      'The permanent G06 latch is missing or has conflicting metadata; fail closed.',
    );
  }
  return label;
}

export function acquireG06OneShotGitHubLatch(gh) {
  const name = g06OneShotLatchLabelName();
  const description = g06OneShotLatchLabelDescription();
  let created;
  try {
    created = JSON.parse(
      gh('api', 'repos/{owner}/{repo}/labels', '--method', 'POST', '--input', '-', {
        input: JSON.stringify({ name, color: 'b60205', description }),
      }),
    );
  } catch {
    const existing = readLabel(
      gh,
      name,
      'G06_ONESHOT_LATCH_UNCERTAIN',
      'Unable to determine whether the global G06 one-shot latch was acquired; fail closed.',
    );
    if (existing?.name === name && existing?.description === description) {
      throw new G06OneShotClaimError(
        'G06_ONESHOT_ALREADY_CLAIMED',
        'The permanent repository-wide G06 one-shot latch already exists; refusing another call.',
      );
    }
    throw new G06OneShotClaimError(
      'G06_ONESHOT_LATCH_CONFLICT',
      'The repository-wide G06 latch exists with unexpected metadata; fail closed.',
    );
  }
  if (created?.name !== name || created?.description !== description) {
    throw new G06OneShotClaimError(
      'G06_ONESHOT_LATCH_UNCERTAIN',
      'GitHub did not confirm the expected permanent G06 latch; fail closed.',
    );
  }
  return true;
}

export function readG06OneShotTerminalGitHubLatch(gh) {
  const name = g06OneShotTerminalLabelName();
  const label = readLabel(
    gh,
    name,
    'G06_ONESHOT_TERMINAL_UNCERTAIN',
    'Unable to verify the permanent G06 terminal result; fail closed.',
  );
  if (!label) return null;
  if (
    label.name !== name ||
    !/^G06-(?:INCONCLUSIVE:report=none|REPORT_WRITTEN:sha256=[0-9a-f]{64})$/u.test(
      label.description ?? '',
    )
  ) {
    throw new G06OneShotClaimError(
      'G06_ONESHOT_TERMINAL_CONFLICT',
      'The permanent G06 terminal label has unexpected metadata; fail closed.',
    );
  }
  return label;
}

export function acquireG06OneShotTerminalGitHubLatch(gh, resultState, reportSha256 = null) {
  const name = g06OneShotTerminalLabelName();
  const description = g06OneShotTerminalLabelDescription(resultState, reportSha256);
  let created;
  try {
    created = JSON.parse(
      gh('api', 'repos/{owner}/{repo}/labels', '--method', 'POST', '--input', '-', {
        input: JSON.stringify({ name, color: '0e8a16', description }),
      }),
    );
  } catch {
    const existing = readLabel(
      gh,
      name,
      'G06_ONESHOT_TERMINAL_UNCERTAIN',
      'Unable to determine whether the G06 terminal latch was created; fail closed.',
    );
    if (existing?.name === name && existing?.description === description) return existing;
    throw new G06OneShotClaimError(
      'G06_ONESHOT_TERMINAL_CONFLICT',
      'A different permanent G06 terminal result already exists; fail closed.',
    );
  }
  if (created?.name !== name || created?.description !== description) {
    throw new G06OneShotClaimError(
      'G06_ONESHOT_TERMINAL_UNCERTAIN',
      'GitHub did not confirm the expected G06 terminal latch; fail closed.',
    );
  }
  return created;
}

export function claimG06OneShotAtomically({
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
    throw new G06OneShotClaimError(
      'G06_ONESHOT_LATCH_INVALID',
      'G06 claim acquisition requires readiness, atomic latch, persistence, and readback adapters.',
    );
  }
  assertReady();
  if (acquireGlobalLatch(claim) !== true) {
    throw new G06OneShotClaimError(
      'G06_ONESHOT_ALREADY_CLAIMED',
      'A concurrent G06 invocation already owns the permanent repository-wide latch.',
    );
  }
  assertReady();
  persistClaim(claim);
  const observed = readClaim();
  if (!verifyClaim(observed, claim)) {
    throw new G06OneShotClaimError(
      'G06_ONESHOT_CLAIM_READBACK_MISMATCH',
      'Durable G06 claim readback did not match the latched claim.',
    );
  }
  return observed;
}
