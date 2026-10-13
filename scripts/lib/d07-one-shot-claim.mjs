export class D07OneShotClaimError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'D07OneShotClaimError';
    this.code = code;
  }
}

export function d07OneShotLatchLabelName() {
  return 'harness-r95-d07-query-subjects-claimed';
}

const STATIC_LATCH_DESCRIPTION =
  'Run 95 D07 query_subjects one-shot; permanent; never remove or recreate.';
const CLAIM_ID_PATTERN = /^d07-run-95-pr-\d+-[0-9a-f]{12}-[0-9a-f]{12}$/u;

export function d07OneShotLatchLabelDescription(claimId = null) {
  if (claimId === null) return STATIC_LATCH_DESCRIPTION;
  if (typeof claimId !== 'string' || !CLAIM_ID_PATTERN.test(claimId)) {
    throw new D07OneShotClaimError('D07_ONESHOT_CLAIM_INVALID', 'Invalid D07 claim identity.');
  }
  return `D07-CLAIMED:${claimId}`;
}

export function d07OneShotTerminalLabelName() {
  return 'harness-r95-d07-query-subjects-terminal';
}

export function d07OneShotTerminalLabelDescription(resultState, reportSha256 = null) {
  if (resultState === 'INCONCLUSIVE' && reportSha256 === null) {
    return 'D07-INCONCLUSIVE:report=none';
  }
  if (resultState === 'INCONCLUSIVE' && /^[0-9a-f]{64}$/u.test(reportSha256 ?? '')) {
    return `D07-INCONCLUSIVE:report=${reportSha256}`;
  }
  if (resultState === 'REPORT_WRITTEN' && /^[0-9a-f]{64}$/u.test(reportSha256 ?? '')) {
    return `D07-REPORT_WRITTEN:sha256=${reportSha256}`;
  }
  throw new D07OneShotClaimError(
    'D07_ONESHOT_TERMINAL_INVALID',
    'A D07 terminal state must be INCONCLUSIVE or bind a valid report SHA-256.',
  );
}

function readLabel(gh, name, errorCode, message) {
  try {
    return JSON.parse(gh('api', `repos/{owner}/{repo}/labels/${encodeURIComponent(name)}`));
  } catch (error) {
    const detail = `${error?.message ?? ''} ${error?.stderr ?? ''}`;
    if (/\b404\b|Not Found/u.test(detail)) return null;
    throw new D07OneShotClaimError(errorCode, message);
  }
}

export function d07OneShotClaimIdFromLabel(label) {
  if (!label || label.name !== d07OneShotLatchLabelName()) return null;
  const match = /^D07-CLAIMED:(d07-run-95-pr-\d+-[0-9a-f]{12}-[0-9a-f]{12})$/u.exec(
    label.description ?? '',
  );
  return match?.[1] ?? null;
}

export function readD07OneShotGitHubLatch(gh) {
  const name = d07OneShotLatchLabelName();
  const label = readLabel(
    gh,
    name,
    'D07_ONESHOT_LATCH_UNCERTAIN',
    'Unable to verify the permanent repository-wide D07 latch; fail closed.',
  );
  if (!label) return null;
  if (
    label.name !== name ||
    (label.description !== STATIC_LATCH_DESCRIPTION && !d07OneShotClaimIdFromLabel(label))
  ) {
    throw new D07OneShotClaimError(
      'D07_ONESHOT_LATCH_MISSING_OR_CONFLICTING',
      'The permanent D07 latch is missing or has conflicting metadata; fail closed.',
    );
  }
  return label;
}

export function verifyD07OneShotGitHubLatch(gh, claimId = null) {
  const label = readD07OneShotGitHubLatch(gh);
  const description = claimId === null ? null : d07OneShotLatchLabelDescription(claimId);
  if (!label || (description !== null && label.description !== description)) {
    throw new D07OneShotClaimError(
      'D07_ONESHOT_LATCH_MISSING_OR_CONFLICTING',
      'The permanent D07 latch does not match the expected claim; fail closed.',
    );
  }
  return label;
}

export function acquireD07OneShotGitHubLatch(gh, claimId = null) {
  const name = d07OneShotLatchLabelName();
  const description = d07OneShotLatchLabelDescription(claimId);
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
      'D07_ONESHOT_LATCH_UNCERTAIN',
      'Unable to determine whether the global D07 one-shot latch was acquired; fail closed.',
    );
    if (existing?.name === name && existing?.description === description) {
      throw new D07OneShotClaimError(
        'D07_ONESHOT_ALREADY_CLAIMED',
        'The permanent repository-wide D07 one-shot latch already exists; refusing another call.',
      );
    }
    if (existing?.name === name && d07OneShotClaimIdFromLabel(existing)) {
      throw new D07OneShotClaimError(
        'D07_ONESHOT_ALREADY_CLAIMED',
        'A different D07 claim already owns the permanent repository-wide latch.',
      );
    }
    throw new D07OneShotClaimError(
      'D07_ONESHOT_LATCH_CONFLICT',
      'The repository-wide D07 latch exists with unexpected metadata; fail closed.',
    );
  }
  if (created?.name !== name || created?.description !== description) {
    throw new D07OneShotClaimError(
      'D07_ONESHOT_LATCH_UNCERTAIN',
      'GitHub did not confirm the expected permanent D07 latch; fail closed.',
    );
  }
  return true;
}

export function readD07OneShotTerminalGitHubLatch(gh) {
  const name = d07OneShotTerminalLabelName();
  const label = readLabel(
    gh,
    name,
    'D07_ONESHOT_TERMINAL_UNCERTAIN',
    'Unable to read the permanent D07 terminal result; fail closed.',
  );
  if (!label) return null;
  if (label.name !== name || typeof label.description !== 'string') {
    throw new D07OneShotClaimError(
      'D07_ONESHOT_TERMINAL_CONFLICT',
      'The permanent D07 terminal label has unexpected metadata; fail closed.',
    );
  }
  const noReport = /^D07-INCONCLUSIVE:report=none$/u.test(label.description);
  const inconclusiveReport = /^D07-INCONCLUSIVE:report=([0-9a-f]{64})$/u.exec(label.description);
  const written = /^D07-REPORT_WRITTEN:sha256=([0-9a-f]{64})$/u.exec(label.description);
  if (noReport) return { state: 'INCONCLUSIVE', reportSha256: null };
  if (inconclusiveReport) return { state: 'INCONCLUSIVE', reportSha256: inconclusiveReport[1] };
  if (written) return { state: 'REPORT_WRITTEN', reportSha256: written[1] };
  throw new D07OneShotClaimError(
    'D07_ONESHOT_TERMINAL_CONFLICT',
    'The permanent D07 terminal latch does not contain a recognized immutable result.',
  );
}

export function acquireD07OneShotTerminalGitHubLatch(gh, resultState, reportSha256 = null) {
  const name = d07OneShotTerminalLabelName();
  const description = d07OneShotTerminalLabelDescription(resultState, reportSha256);
  let created;
  try {
    created = JSON.parse(
      gh('api', 'repos/{owner}/{repo}/labels', '--method', 'POST', '--input', '-', {
        input: JSON.stringify({ name, color: '0e8a16', description }),
      }),
    );
  } catch {
    const existing = readD07OneShotTerminalGitHubLatch(gh);
    if (existing?.state === resultState && existing.reportSha256 === reportSha256) {
      return { ...existing, created: false };
    }
    throw new D07OneShotClaimError(
      'D07_ONESHOT_ALREADY_TERMINAL',
      'A different permanent D07 terminal result already won; it cannot be replaced.',
    );
  }
  if (created?.name !== name || created?.description !== description) {
    throw new D07OneShotClaimError(
      'D07_ONESHOT_TERMINAL_UNCERTAIN',
      'GitHub did not confirm the expected D07 terminal latch; fail closed.',
    );
  }
  return { state: resultState, reportSha256, created: true };
}

export function claimD07OneShotAtomically({
  claim,
  assertReady,
  persistLocalClaim = null,
  acquireGlobalLatch,
  persistClaim,
  readClaim,
  verifyClaim,
}) {
  if (
    claim?.runNumber !== 95 ||
    claim?.frontierId !== 'D07' ||
    claim?.toolName !== 'bangumi.query_subjects' ||
    typeof claim?.claimId !== 'string' ||
    !CLAIM_ID_PATTERN.test(claim.claimId) ||
    claim?.state !== 'CLAIMED' ||
    claim?.retryAllowed !== false ||
    typeof assertReady !== 'function' ||
    typeof acquireGlobalLatch !== 'function' ||
    typeof persistClaim !== 'function' ||
    typeof readClaim !== 'function' ||
    typeof verifyClaim !== 'function'
  ) {
    throw new D07OneShotClaimError(
      'D07_ONESHOT_CLAIM_INVALID',
      'A D07 claim requires the exact Run, frontier, tool, no-retry state, and readback adapters.',
    );
  }
  assertReady();
  if (persistLocalClaim !== null) {
    if (typeof persistLocalClaim !== 'function') {
      throw new D07OneShotClaimError(
        'D07_ONESHOT_CLAIM_INVALID',
        'The local D07 recovery journal writer must be a function.',
      );
    }
    persistLocalClaim(claim);
    assertReady();
  }
  if (acquireGlobalLatch(claim) !== true) {
    throw new D07OneShotClaimError(
      'D07_ONESHOT_ALREADY_CLAIMED',
      'A concurrent D07 invocation already owns the permanent repository-wide latch.',
    );
  }
  assertReady();
  persistClaim(claim);
  const observed = readClaim();
  if (!verifyClaim(observed, claim)) {
    throw new D07OneShotClaimError(
      'D07_ONESHOT_CLAIM_READBACK_MISMATCH',
      'Durable D07 claim readback did not match the latched claim.',
    );
  }
  return observed;
}
