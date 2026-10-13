import { createHash } from 'node:crypto';

const CLAIM_LABEL = 'harness-r95-d02-search-subjects-claimed';
const TERMINAL_LABEL = 'harness-r95-d02-search-subjects-terminal';

export class D02OneShotClaimError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'D02OneShotClaimError';
    this.code = code;
  }
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).sort(([left], [right]) =>
      left < right ? -1 : left > right ? 1 : 0);
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function claimIdentity(claim) {
  if (
    claim?.runNumber !== 95 || claim.frontierId !== 'D02' ||
    claim.toolName !== 'bangumi.search_subjects' ||
    claim.argumentProfile !== 'fixed-d02-apocalypse-travel-keyword-anime-top8-v1' ||
    !/^[0-9a-f]{40}$/u.test(claim.candidateSha ?? '') ||
    !/^[0-9a-f]{40}$/u.test(claim.baseSha ?? '') ||
    !/^[0-9a-f]{64}$/u.test(claim.bundleSha256 ?? '') ||
    !/^[0-9a-f]{64}$/u.test(claim.expectedArgumentsSha256 ?? '') ||
    !Number.isSafeInteger(claim.prNumber) || claim.prNumber < 1 ||
    typeof claim.reviewerId !== 'string' ||
    claim.model !== 'gpt-6-luna' || claim.reasoningEffort !== 'max' ||
    claim.retryAllowed !== false
  ) {
    throw new D02OneShotClaimError(
      'D02_ONESHOT_CLAIM_INVALID',
      'D02 global claim metadata is incomplete or outside its fixed Luna Max profile.',
    );
  }
  return {
    runNumber: claim.runNumber,
    frontierId: claim.frontierId,
    toolName: claim.toolName,
    argumentProfile: claim.argumentProfile,
    candidateSha: claim.candidateSha,
    baseSha: claim.baseSha,
    bundleSha256: claim.bundleSha256,
    expectedArgumentsSha256: claim.expectedArgumentsSha256,
    prNumber: claim.prNumber,
    reviewerId: claim.reviewerId,
    model: claim.model,
    reasoningEffort: claim.reasoningEffort,
  };
}

export function d02OneShotClaimLabelName() {
  return CLAIM_LABEL;
}

export function d02OneShotClaimLabelDescription(claim) {
  return `D02 claim sha256=${sha256(canonicalJson(claimIdentity(claim)))}`;
}

export function d02OneShotTerminalLabelName() {
  return TERMINAL_LABEL;
}

export function d02OneShotTerminalLabelDescription(claim, state, reportSha256 = null) {
  const identitySha256 = sha256(canonicalJson(claimIdentity(claim)));
  if (state === 'INCONCLUSIVE' && reportSha256 === null) {
    return `D02:INCONCLUSIVE:${identitySha256}`;
  }
  if (state === 'REPORT_WRITTEN' && /^[0-9a-f]{64}$/u.test(reportSha256 ?? '')) {
    return `D02:REPORT_WRITTEN:${sha256(`${identitySha256}:${reportSha256}`)}`;
  }
  throw new D02OneShotClaimError(
    'D02_ONESHOT_TERMINAL_INVALID',
    'D02 terminal state must be INCONCLUSIVE or bind a report digest.',
  );
}

function readLabel(gh, name) {
  try {
    return JSON.parse(gh('api', `repos/{owner}/{repo}/labels/${encodeURIComponent(name)}`));
  } catch (error) {
    const detail = `${error?.message ?? ''} ${error?.stderr ?? ''}`;
    if (/\b404\b|Not Found/u.test(detail)) return null;
    throw new D02OneShotClaimError(
      'D02_ONESHOT_LATCH_UNCERTAIN',
      'Unable to verify the permanent D02 GitHub latch; fail closed.',
    );
  }
}

export function verifyD02OneShotGitHubLatch(gh, claim) {
  const name = d02OneShotClaimLabelName();
  const description = d02OneShotClaimLabelDescription(claim);
  const label = readLabel(gh, name);
  if (label?.name !== name || label?.description !== description) {
    throw new D02OneShotClaimError(
      'D02_ONESHOT_LATCH_MISSING_OR_CONFLICTING',
      'The permanent repository-wide D02 latch is missing or has conflicting metadata.',
    );
  }
  return label;
}

export function acquireD02OneShotGitHubLatch(gh, claim) {
  const name = d02OneShotClaimLabelName();
  const description = d02OneShotClaimLabelDescription(claim);
  let created;
  try {
    created = JSON.parse(gh(
      'api',
      'repos/{owner}/{repo}/labels',
      '--method',
      'POST',
      '--input',
      '-',
      { input: JSON.stringify({ name, color: 'b60205', description }) },
    ));
  } catch {
    const existing = readLabel(gh, name);
    if (existing?.name === name && existing?.description === description) {
      throw new D02OneShotClaimError(
        'D02_ONESHOT_ALREADY_CLAIMED',
        'The permanent repository-wide D02 latch already exists; refusing another call.',
      );
    }
    throw new D02OneShotClaimError(
      'D02_ONESHOT_LATCH_CONFLICT',
      'The repository-wide D02 latch exists with unexpected metadata; fail closed.',
    );
  }
  if (created?.name !== name || created?.description !== description) {
    throw new D02OneShotClaimError(
      'D02_ONESHOT_LATCH_UNCERTAIN',
      'GitHub did not confirm the expected permanent D02 latch; fail closed.',
    );
  }
  return true;
}

export function readD02OneShotTerminalGitHubLatch(gh) {
  const name = d02OneShotTerminalLabelName();
  const label = readLabel(gh, name);
  if (!label) return null;
  if (
    label.name !== name ||
    !/^D02:(?:INCONCLUSIVE|REPORT_WRITTEN):[0-9a-f]{64}$/u.test(label.description ?? '')
  ) {
    throw new D02OneShotClaimError(
      'D02_ONESHOT_TERMINAL_CONFLICT',
      'The permanent D02 terminal label has unexpected metadata.',
    );
  }
  return label;
}

export function acquireD02OneShotTerminalGitHubLatch(gh, claim, state, reportSha256 = null) {
  const name = d02OneShotTerminalLabelName();
  const description = d02OneShotTerminalLabelDescription(claim, state, reportSha256);
  let created;
  try {
    created = JSON.parse(gh(
      'api',
      'repos/{owner}/{repo}/labels',
      '--method',
      'POST',
      '--input',
      '-',
      { input: JSON.stringify({ name, color: '0e8a16', description }) },
    ));
  } catch {
    const existing = readLabel(gh, name);
    if (existing?.name === name && existing?.description === description) return existing;
    throw new D02OneShotClaimError(
      'D02_ONESHOT_TERMINAL_CONFLICT',
      'A different permanent D02 terminal result already exists; fail closed.',
    );
  }
  if (created?.name !== name || created?.description !== description) {
    throw new D02OneShotClaimError(
      'D02_ONESHOT_TERMINAL_UNCERTAIN',
      'GitHub did not confirm the expected permanent D02 terminal result.',
    );
  }
  return created;
}

export function verifyD02OneShotTerminalLabel(label, claim, state, reportSha256 = null) {
  return label?.name === d02OneShotTerminalLabelName() &&
    label.description === d02OneShotTerminalLabelDescription(claim, state, reportSha256);
}

export function claimD02OneShotAtomically({
  claim,
  assertReady,
  acquireGlobalLatch,
  persistClaim,
  readClaim,
}) {
  if (
    !claim || typeof assertReady !== 'function' ||
    typeof acquireGlobalLatch !== 'function' ||
    typeof persistClaim !== 'function' || typeof readClaim !== 'function'
  ) {
    throw new D02OneShotClaimError(
      'D02_ONESHOT_LATCH_INVALID',
      'D02 claim acquisition requires readiness, a create-only latch, durable persistence, and readback.',
    );
  }
  d02OneShotClaimLabelDescription(claim);
  assertReady();
  if (acquireGlobalLatch(claim) !== true) {
    throw new D02OneShotClaimError(
      'D02_ONESHOT_ALREADY_CLAIMED',
      'A concurrent D02 invocation already owns the permanent repository-wide latch.',
    );
  }
  persistClaim(claim);
  const observed = readClaim();
  if (canonicalJson(observed) !== canonicalJson(claim)) {
    throw new D02OneShotClaimError(
      'D02_ONESHOT_CLAIM_READBACK_MISMATCH',
      'Durable D02 claim readback did not match the newly acquired latch.',
    );
  }
  return observed;
}
