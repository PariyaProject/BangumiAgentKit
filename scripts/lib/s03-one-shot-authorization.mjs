import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { closeSync, existsSync, openSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const CLAIM_BASENAME = 's03-run95-one-shot-claim.json';
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const canonicalJson = (value) =>
  Array.isArray(value)
    ? `[${value.map(canonicalJson).join(',')}]`
    : value && typeof value === 'object'
      ? `{${Object.keys(value)
          .sort()
          .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
          .join(',')}}`
      : JSON.stringify(value);

function assertClaimPath(claimPath) {
  if (
    typeof claimPath !== 'string' ||
    !path.isAbsolute(claimPath) ||
    path.basename(claimPath) !== CLAIM_BASENAME ||
    path.basename(path.dirname(claimPath)) !== 'pariya-agent-state' ||
    path.basename(path.dirname(path.dirname(claimPath))) !== '.git'
  ) {
    throw new Error(
      'S03 one-shot claim must use the canonical local .git/pariya-agent-state path.',
    );
  }
}

function readClaim(claimPath) {
  assertClaimPath(claimPath);
  try {
    return JSON.parse(readFileSync(claimPath, 'utf8'));
  } catch {
    throw new Error('S03 one-shot claim is missing or invalid.');
  }
}

function writeClaimAtomic(claimPath, claim) {
  const temporaryPath = `${claimPath}.${process.pid}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(claim, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
    flag: 'wx',
  });
  renameSync(temporaryPath, claimPath);
}

function assertToken(claim, authorizationToken) {
  if (
    typeof authorizationToken !== 'string' ||
    !/^[0-9a-f]{64}$/u.test(authorizationToken) ||
    claim?.authorizationTokenSha256 !== sha256(authorizationToken)
  ) {
    throw new Error('S03 one-shot authorization token does not match the canonical claim.');
  }
}

export function s03ServerSummarySha256(summary) {
  return sha256(canonicalJson(summary));
}

export function s03EventEvidenceSha256({
  eventsSummary,
  queryArguments,
  toolOutput,
  answer,
  toolTextUtf8Bytes,
}) {
  const eventEvidence = {
    eventStreamComplete: eventsSummary?.eventStreamComplete === true,
    codexMcpToolEventCount: eventsSummary?.codexMcpToolEventCount ?? null,
    mcpServerNames: eventsSummary?.mcpServerNames ?? [],
    nonMcpToolEventCount: eventsSummary?.nonMcpToolEventCount ?? null,
    shellToolCallCount: eventsSummary?.shellToolCallCount ?? null,
    toolCalls: eventsSummary?.toolCalls ?? [],
    queryArguments,
    toolOutput,
    answer,
    toolTextUtf8Bytes,
  };
  return sha256(canonicalJson(eventEvidence));
}

export function verifyS03ServerAuthorization(claimPath, authorizationToken, expected) {
  const claim = readClaim(claimPath);
  assertS03ServerClaimMatches(claim, authorizationToken, expected);
  if (claim.state !== 'CLAIMED') {
    throw new Error('S03 server authorization has already been consumed.');
  }
  return claim;
}

function assertS03ServerClaimMatches(
  claim,
  authorizationToken,
  { sourceRevision, bundleSha256, expectedArgumentsSha256, baseSha, reviewerId, summaryPathSha256 },
) {
  assertToken(claim, authorizationToken);
  if (
    claim.schemaVersion !== 1 ||
    claim.runNumber !== 95 ||
    claim.frontierId !== 'S03' ||
    claim.sourceRevision !== sourceRevision ||
    claim.bundleSha256 !== bundleSha256 ||
    claim.expectedArgumentsSha256 !== expectedArgumentsSha256 ||
    claim.baseSha !== baseSha ||
    claim.reviewerId !== reviewerId ||
    claim.summaryPathSha256 !== summaryPathSha256
  ) {
    throw new Error('S03 server authorization does not match the runner-created Candidate claim.');
  }
  return claim;
}

export function claimS03ServerCall(
  claimPath,
  authorizationToken,
  { sourceRevision, bundleSha256, expectedArgumentsSha256, baseSha, reviewerId, summaryPathSha256 },
) {
  const claim = assertS03ServerClaimMatches(readClaim(claimPath), authorizationToken, {
    sourceRevision,
    bundleSha256,
    expectedArgumentsSha256,
    baseSha,
    reviewerId,
    summaryPathSha256,
  });
  const lockPath = `${claimPath}.server-call-claimed`;
  if (existsSync(lockPath)) return false;
  if (claim.state !== 'CLAIMED') {
    throw new Error('S03 server authorization has already been consumed.');
  }
  let descriptor;
  try {
    descriptor = openSync(lockPath, 'wx', 0o600);
    writeFileSync(
      descriptor,
      `${JSON.stringify(
        { schemaVersion: 1, candidateSha: sourceRevision, claimedAt: new Date().toISOString() },
        null,
        2,
      )}\n`,
      'utf8',
    );
    closeSync(descriptor);
    descriptor = undefined;
  } catch (error) {
    if (descriptor !== undefined) {
      try {
        closeSync(descriptor);
      } catch {
        /* Preserve the create-once lock failure. */
      }
    }
    if (error?.code === 'EEXIST') return false;
    throw error;
  }

  writeClaimAtomic(claimPath, {
    ...claim,
    state: 'SERVER_CALL_STARTED',
    serverCallStartedAt: new Date().toISOString(),
  });
  return true;
}

export function captureS03ServerResult(claimPath, authorizationToken, serverSummary) {
  const claim = readClaim(claimPath);
  assertToken(claim, authorizationToken);
  if (claim.state !== 'SERVER_CALL_STARTED') {
    throw new Error('S03 server result requires the claimed one-shot server invocation.');
  }
  const next = {
    ...claim,
    state: 'SERVER_RESULT_CAPTURED',
    serverResultStatus: serverSummary?.serverResultStatus ?? 'ERROR',
    serverSummarySha256: s03ServerSummarySha256(serverSummary),
    serverResultCapturedAt: new Date().toISOString(),
  };
  writeClaimAtomic(claimPath, next);
  return next;
}

export function verifyS03ReportClaim(claimPath, authorizationToken) {
  const claim = readClaim(claimPath);
  assertToken(claim, authorizationToken);
  if (claim.state !== 'REPORT_READY' || typeof claim.reportAuthorizationProof !== 'string') {
    throw new Error('S03 report requires the runner-authorized REPORT_READY claim.');
  }
  const { reportAuthorizationProof, ...unsignedClaim } = claim;
  const expected = createHmac('sha256', authorizationToken)
    .update(canonicalJson(unsignedClaim))
    .digest();
  const actual = Buffer.from(reportAuthorizationProof, 'hex');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new Error('S03 runner report authorization proof is invalid.');
  }
  return claim;
}
