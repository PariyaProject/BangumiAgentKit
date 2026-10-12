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

export function r01OneShotTerminalLabelName() {
  return 'harness-r95-r01-subject-relations-terminal';
}

export function r01OneShotTerminalLabelDescription(resultState, reportSha256 = null) {
  let description;
  if (resultState === 'INCONCLUSIVE') {
    if (reportSha256 !== null && !/^[0-9a-f]{64}$/u.test(reportSha256)) {
      throw new R01OneShotClaimError(
        'R01_ONESHOT_TERMINAL_INVALID',
        'An observed R01 report needs a SHA-256 digest.',
      );
    }
    description = `R01-INCONCLUSIVE:report=${reportSha256 ?? 'none'}`;
  } else if (resultState === 'REPORT_WRITTEN') {
    if (!/^[0-9a-f]{64}$/u.test(reportSha256 ?? '')) {
      throw new R01OneShotClaimError(
        'R01_ONESHOT_TERMINAL_INVALID',
        'A written R01 report needs a SHA-256 digest.',
      );
    }
    description = `R01-REPORT_WRITTEN:sha256=${reportSha256}`;
  } else {
    throw new R01OneShotClaimError(
      'R01_ONESHOT_TERMINAL_INVALID',
      'Only terminal R01 one-shot states are supported.',
    );
  }
  if (description.length > 100) {
    throw new R01OneShotClaimError(
      'R01_ONESHOT_TERMINAL_INVALID',
      'The R01 terminal label description exceeds GitHub’s 100-character limit.',
    );
  }
  return description;
}

function labelApiRead(gh, name, errorCode, message) {
  try {
    return JSON.parse(gh('api', `repos/{owner}/{repo}/labels/${encodeURIComponent(name)}`));
  } catch (error) {
    const detail = `${error?.message ?? ''} ${error?.stderr ?? ''}`;
    if (/\b404\b|Not Found/u.test(detail)) return null;
    throw new R01OneShotClaimError(errorCode, message);
  }
}

export function verifyR01OneShotGitHubLatch(gh) {
  if (typeof gh !== 'function') {
    throw new R01OneShotClaimError(
      'R01_ONESHOT_LATCH_INVALID',
      'A GitHub API adapter is required.',
    );
  }
  const name = r01OneShotLatchLabelName();
  const label = labelApiRead(
    gh,
    name,
    'R01_ONESHOT_LATCH_UNCERTAIN',
    'Unable to verify the permanent repository-wide R01 latch; fail closed.',
  );
  if (!label) {
    throw new R01OneShotClaimError(
      'R01_ONESHOT_LATCH_MISSING',
      'The permanent repository-wide R01 latch is missing; fail closed.',
    );
  }
  if (label.name !== name || label.description !== r01OneShotLatchLabelDescription()) {
    throw new R01OneShotClaimError(
      'R01_ONESHOT_LATCH_CONFLICT',
      'The permanent repository-wide R01 latch has unexpected metadata; fail closed.',
    );
  }
  return true;
}

export function readR01OneShotTerminalGitHubLatch(gh) {
  if (typeof gh !== 'function') {
    throw new R01OneShotClaimError(
      'R01_ONESHOT_TERMINAL_INVALID',
      'A GitHub API adapter is required.',
    );
  }
  const name = r01OneShotTerminalLabelName();
  const label = labelApiRead(
    gh,
    name,
    'R01_ONESHOT_TERMINAL_UNCERTAIN',
    'Unable to read the permanent R01 terminal latch; fail closed.',
  );
  if (!label) return null;
  if (label.name !== name || typeof label.description !== 'string') {
    throw new R01OneShotClaimError(
      'R01_ONESHOT_TERMINAL_CONFLICT',
      'The permanent R01 terminal latch has unexpected metadata; fail closed.',
    );
  }
  const inconclusive = /^R01-INCONCLUSIVE:report=(none|[0-9a-f]{64})$/u.exec(label.description);
  if (inconclusive) {
    return {
      state: 'INCONCLUSIVE',
      reportSha256: inconclusive[1] === 'none' ? null : inconclusive[1],
    };
  }
  const reportWritten = /^R01-REPORT_WRITTEN:sha256=([0-9a-f]{64})$/u.exec(label.description);
  if (reportWritten) {
    return { state: 'REPORT_WRITTEN', reportSha256: reportWritten[1] };
  }
  throw new R01OneShotClaimError(
    'R01_ONESHOT_TERMINAL_CONFLICT',
    'The permanent R01 terminal latch does not contain a recognized immutable result.',
  );
}

export function acquireR01OneShotTerminalGitHubLatch(gh, resultState, reportSha256 = null) {
  if (typeof gh !== 'function') {
    throw new R01OneShotClaimError(
      'R01_ONESHOT_TERMINAL_INVALID',
      'A GitHub API adapter is required.',
    );
  }
  const name = r01OneShotTerminalLabelName();
  const description = r01OneShotTerminalLabelDescription(resultState, reportSha256);
  let created;
  try {
    created = JSON.parse(
      gh('api', 'repos/{owner}/{repo}/labels', '--method', 'POST', '--input', '-', {
        input: JSON.stringify({ name, color: '6e7781', description }),
      }),
    );
  } catch {
    const existing = readR01OneShotTerminalGitHubLatch(gh);
    if (
      existing?.state === resultState &&
      (resultState !== 'REPORT_WRITTEN' || existing.reportSha256 === reportSha256) &&
      (resultState !== 'INCONCLUSIVE' || existing.reportSha256 === reportSha256)
    ) {
      return { state: existing.state, reportSha256: existing.reportSha256, created: false };
    }
    if (existing) {
      throw new R01OneShotClaimError(
        'R01_ONESHOT_ALREADY_TERMINAL',
        'A different permanent R01 terminal result already won; it cannot be replaced.',
      );
    }
    throw new R01OneShotClaimError(
      'R01_ONESHOT_TERMINAL_UNCERTAIN',
      'Unable to determine whether the permanent R01 terminal result was acquired; fail closed.',
    );
  }
  if (created?.name !== name || created?.description !== description) {
    throw new R01OneShotClaimError(
      'R01_ONESHOT_TERMINAL_UNCERTAIN',
      'GitHub did not confirm the requested immutable R01 terminal result; fail closed.',
    );
  }
  const readback = readR01OneShotTerminalGitHubLatch(gh);
  if (readback?.state !== resultState || readback.reportSha256 !== reportSha256) {
    throw new R01OneShotClaimError(
      'R01_ONESHOT_TERMINAL_UNCERTAIN',
      'The permanent R01 terminal result readback did not match; fail closed.',
    );
  }
  return { ...readback, created: true };
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
      existing = JSON.parse(gh('api', `repos/{owner}/{repo}/labels/${encodeURIComponent(name)}`));
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
