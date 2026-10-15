import { Buffer } from 'node:buffer';
import { createHash, createPublicKey, sign, verify } from 'node:crypto';
import { closeSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  agentMcpProfileArgumentsSha256,
  agentMcpProfileRegistrySha256,
  canonicalAgentMcpProfileJson,
  getAgentMcpProfileById,
} from '../lib/agent-mcp-profile-claims.mjs';
import {
  buildC03ObservedComparison,
  isC03CalendarWindow,
  summarizeC03ActorResult,
  verifyC03Answer,
} from '../lib/c03-profile-evidence.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PROFILE = getAgentMcpProfileById('c03-voice-actor-comparison-v1');
const REPORT_RELATIVE_PATH = PROFILE.reportPath;
const REPORT_PATH = path.join(ROOT, REPORT_RELATIVE_PATH);
const RECEIPT_KIND = 'c03-agent-mcp-runner-receipt-v1';
const REPORT_FIELDS = new Set([
  'schemaVersion',
  'evidenceKind',
  'runNumber',
  'frontierId',
  'scenarioId',
  'epochId',
  'profileId',
  'profile',
  'model',
  'reasoningEffort',
  'reviewerId',
  'codexCliVersion',
  'sourceRevision',
  'baseSha',
  'ciSha',
  'ciStatus',
  'prNumber',
  'claimId',
  'mcpBundleSha256',
  'registrySha256',
  'toolName',
  'argumentProfile',
  'expectedArgumentsSha256',
  'catalogSha256',
  'toolDescriptionSha256',
  'inputSchemaSha256',
  'serverToolNames',
  'serverToolCount',
  'mcpServerNames',
  'processExitCode',
  'resultStatus',
  'eventStreamParsed',
  'turnCompleted',
  'codexMcpToolEventCount',
  'codexErrorItemCount',
  'nonMcpToolEventCount',
  'nonMcpToolTypes',
  'shellToolCallCount',
  'allowedCallCount',
  'deniedCallCount',
  'answerCheckMethod',
  'answerSha256',
  'answerUtf8Bytes',
  'answerChecks',
  'actors',
  'comparison',
  'privacy',
  'runnerReceipt',
]);
const RECEIPT_FIELDS = new Set([
  'schemaVersion',
  'kind',
  'publicKeyBase64',
  'publicKeySha256',
  'payload',
  'signature',
]);
const ANSWER_CHECK_FIELDS = new Set([
  'exactBoundedSubjectOverlap',
  'exactObservedMainRoleShares',
  'partialCoverageDisclosed',
  'omittedWorksNotClaimedAbsent',
  'noCareerCompletenessClaim',
]);
const ACTOR_FIELDS = new Set([
  'personId',
  'state',
  'window',
  'uniqueSubjects',
  'roleCounts',
  'observedRows',
  'coverage',
]);
const ACTOR_WINDOW_FIELDS = new Set(['months', 'start', 'end', 'asOfSemantics']);
const ACTOR_ROLE_COUNT_FIELDS = new Set(['main', 'support', 'unknown']);
const ACTOR_ROW_FIELDS = new Set(['subjectId', 'roleFamily']);
const ACTOR_COVERAGE_FIELDS = new Set([
  'relationRowsObserved',
  'relationRowsSelected',
  'relationRowsDroppedAtLimit',
  'subjectDetailsSucceeded',
  'subjectDetailsFailed',
  'rowsEligible',
  'rowsReturned',
  'outputTruncated',
  'unknownRoleRows',
  'truncated',
]);
const COMPARISON_FIELDS = new Set([
  'observedSubjectIds',
  'sharedSubjectIds',
  'observedCommonCount',
  'observedMainRoleShares',
  'coveragePartial',
]);
const ROLE_SHARE_FIELDS = new Set(['personId', 'numerator', 'denominator', 'ratio', 'state']);
const PRIVACY_FIELDS = new Set([
  'authProfile',
  'oauthAttempted',
  'accountDataRead',
  'writesAttempted',
  'communityRead',
  'qqPipelineTested',
  'timClientTested',
  'promptStored',
  'answerStored',
  'rawResultStored',
  'credentialsStored',
]);
const RECEIPT_PAYLOAD_FIELDS = new Set([
  'schemaVersion',
  'kind',
  'claimId',
  'profileId',
  'runNumber',
  'frontierId',
  'epochId',
  'prNumber',
  'sourceRevision',
  'baseSha',
  'ciSha',
  'ciStatus',
  'reviewerId',
  'bundleSha256',
  'registrySha256',
  'toolName',
  'argumentProfile',
  'expectedArgumentsSha256',
  'codexCliVersion',
  'processExitCode',
  'resultStatus',
  'eventStreamParsed',
  'turnCompleted',
  'codexMcpToolEventCount',
  'codexErrorItemCount',
  'nonMcpToolEventCount',
  'shellToolCallCount',
  'allowedCallCount',
  'deniedCallCount',
  'eventStreamSha256',
  'serverSummarySha256',
  'answerSha256',
  'answerChecksSha256',
  'actorsSha256',
  'comparisonSha256',
]);

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const canonicalSha256 = (value) => sha256(canonicalAgentMcpProfileJson(value));

export function buildC03RunnerReceiptPayload(report, { eventStreamSha256, serverSummarySha256 }) {
  if (
    !report ||
    typeof report !== 'object' ||
    !/^[0-9a-f]{64}$/u.test(eventStreamSha256 ?? '') ||
    !/^[0-9a-f]{64}$/u.test(serverSummarySha256 ?? '')
  ) {
    throw new TypeError('C03 runner receipt requires the exact sanitized report inputs.');
  }
  return {
    schemaVersion: 1,
    kind: RECEIPT_KIND,
    claimId: report.claimId,
    profileId: report.profileId,
    runNumber: report.runNumber,
    frontierId: report.frontierId,
    epochId: report.epochId,
    prNumber: report.prNumber,
    sourceRevision: report.sourceRevision,
    baseSha: report.baseSha,
    ciSha: report.ciSha,
    ciStatus: report.ciStatus,
    reviewerId: report.reviewerId,
    bundleSha256: report.mcpBundleSha256,
    registrySha256: report.registrySha256,
    toolName: report.toolName,
    argumentProfile: report.argumentProfile,
    expectedArgumentsSha256: report.expectedArgumentsSha256,
    codexCliVersion: report.codexCliVersion,
    processExitCode: report.processExitCode,
    resultStatus: report.resultStatus,
    eventStreamParsed: report.eventStreamParsed,
    turnCompleted: report.turnCompleted,
    codexMcpToolEventCount: report.codexMcpToolEventCount,
    codexErrorItemCount: report.codexErrorItemCount,
    nonMcpToolEventCount: report.nonMcpToolEventCount,
    shellToolCallCount: report.shellToolCallCount,
    allowedCallCount: report.allowedCallCount,
    deniedCallCount: report.deniedCallCount,
    eventStreamSha256,
    serverSummarySha256,
    answerSha256: report.answerSha256,
    answerChecksSha256: canonicalSha256(report.answerChecks),
    actorsSha256: canonicalSha256(report.actors),
    comparisonSha256: canonicalSha256(report.comparison),
  };
}

export function createC03RunnerReceipt(payload, { publicKeyBase64, privateKey }) {
  const publicKeyDer = Buffer.from(publicKeyBase64 ?? '', 'base64');
  const publicKey = createPublicKey({ key: publicKeyDer, format: 'der', type: 'spki' });
  if (
    publicKey.asymmetricKeyType !== 'ed25519' ||
    publicKeyDer.toString('base64') !== publicKeyBase64
  ) {
    throw new Error('C03 runner receipt requires a canonical Ed25519 SPKI public key.');
  }
  const signature = sign(null, Buffer.from(canonicalAgentMcpProfileJson(payload)), privateKey);
  return {
    schemaVersion: 1,
    kind: RECEIPT_KIND,
    publicKeyBase64,
    publicKeySha256: sha256(publicKeyDer),
    payload,
    signature: signature.toString('base64'),
  };
}

export function projectC03ProfileActors(serverSummary) {
  if (
    !Array.isArray(serverSummary?.results) ||
    serverSummary.results.length !== PROFILE.calls.length
  ) {
    throw new TypeError('C03 actor projection requires the exact registered result pair.');
  }
  return serverSummary.results.map((item, index) =>
    summarizeC03ActorResult(item?.resultSummary, PROFILE.calls[index].arguments),
  );
}

export function writeC03ProfileReport(input, { privateKey } = {}) {
  const { claim, serverSummary, completedMcpCalls, events } = input ?? {};
  if (
    !PROFILE ||
    !claim ||
    claim.profileId !== PROFILE.id ||
    claim.state !== 'CLAIMED' ||
    claim.retryAllowed !== false ||
    !serverSummary ||
    !Array.isArray(completedMcpCalls) ||
    completedMcpCalls.length !== PROFILE.calls.length ||
    !events ||
    events.processExitCode !== 0 ||
    events.eventStreamParsed !== true ||
    events.turnCompleted !== true ||
    events.codexMcpToolEventCount !== PROFILE.calls.length ||
    events.codexErrorItemCount !== 0 ||
    events.nonMcpToolEventCount !== 0 ||
    events.shellToolCallCount !== 0 ||
    events.allowedCallCount !== PROFILE.calls.length ||
    events.deniedCallCount !== 0 ||
    events.mcpServerNames?.length !== 1 ||
    events.mcpServerNames[0] !== 'bgk_c03_profile' ||
    serverSummary.profileId !== PROFILE.id ||
    serverSummary.serverProfile !== 'closed-profile-sequence-anonymous-public-v1' ||
    serverSummary.toolName !== PROFILE.toolName ||
    serverSummary.expectedArgumentsSha256 !== claim.expectedArgumentsSha256 ||
    serverSummary.serverResultStatus !== 'SUCCESS' ||
    serverSummary.allowedCallCount !== PROFILE.calls.length ||
    serverSummary.deniedCallCount !== 0 ||
    !Array.isArray(serverSummary.results) ||
    serverSummary.results.length !== PROFILE.calls.length
  )
    return { passed: false, reason: 'C03_RUNNER_GATE_INVALID' };

  for (let index = 0; index < PROFILE.calls.length; index += 1) {
    const expected = PROFILE.calls[index];
    const call = completedMcpCalls[index];
    const serverResult = serverSummary.results[index];
    if (
      call?.tool !== expected.toolName ||
      canonicalAgentMcpProfileJson(call?.arguments) !==
        canonicalAgentMcpProfileJson(expected.arguments) ||
      serverResult?.sequenceIndex !== index ||
      serverResult.status !== 'SUCCESS' ||
      serverResult.resultSummary?.personId !== expected.arguments.personId
    )
      return { passed: false, reason: `C03_CALL_${index}_MISMATCH` };
  }

  const actors = projectC03ProfileActors(serverSummary);
  const answerResult = verifyC03Answer(input.answer, actors);
  if (!answerResult.passed) return { passed: false, reason: answerResult.reason };
  const answerBytes = Buffer.byteLength(input.answer, 'utf8');
  const report = {
    schemaVersion: 1,
    evidenceKind: PROFILE.evidenceKind,
    runNumber: claim.runNumber,
    frontierId: PROFILE.frontierId,
    scenarioId: 'C03',
    epochId: PROFILE.epochId,
    profileId: PROFILE.id,
    profile: 'codex-luna-max-agent-mcp-profile-v1',
    model: PROFILE.model,
    reasoningEffort: PROFILE.reasoningEffort,
    reviewerId: claim.reviewerId,
    codexCliVersion: input.codexCliVersion,
    sourceRevision: claim.sourceCandidateSha,
    baseSha: claim.baseSha,
    ciSha: claim.ciSha,
    ciStatus: claim.ciStatus,
    prNumber: claim.prNumber,
    claimId: claim.claimId,
    mcpBundleSha256: claim.bundleSha256,
    registrySha256: claim.registrySha256,
    toolName: PROFILE.toolName,
    argumentProfile: PROFILE.argumentProfile,
    expectedArgumentsSha256: claim.expectedArgumentsSha256,
    catalogSha256: serverSummary.catalogSha256,
    toolDescriptionSha256: serverSummary.toolDescriptionSha256,
    inputSchemaSha256: serverSummary.inputSchemaSha256,
    serverToolNames: serverSummary.serverToolNames,
    serverToolCount: serverSummary.serverToolCount,
    mcpServerNames: events.mcpServerNames,
    processExitCode: events.processExitCode,
    resultStatus: serverSummary.serverResultStatus,
    eventStreamParsed: events.eventStreamParsed,
    turnCompleted: events.turnCompleted,
    codexMcpToolEventCount: events.codexMcpToolEventCount,
    codexErrorItemCount: events.codexErrorItemCount,
    nonMcpToolEventCount: events.nonMcpToolEventCount,
    nonMcpToolTypes: events.nonMcpToolTypes,
    shellToolCallCount: events.shellToolCallCount,
    allowedCallCount: serverSummary.allowedCallCount,
    deniedCallCount: serverSummary.deniedCallCount,
    answerCheckMethod: PROFILE.answerCheckMethod,
    answerSha256: sha256(input.answer),
    answerUtf8Bytes: answerBytes,
    answerChecks: answerResult.checks,
    actors,
    comparison: answerResult.comparison,
    privacy: {
      authProfile: false,
      oauthAttempted: false,
      accountDataRead: false,
      writesAttempted: false,
      communityRead: false,
      qqPipelineTested: false,
      timClientTested: false,
      promptStored: false,
      answerStored: false,
      rawResultStored: false,
      credentialsStored: false,
    },
  };
  const receiptPayload = buildC03RunnerReceiptPayload(report, {
    eventStreamSha256: input.eventStreamSha256,
    serverSummarySha256: input.serverSummarySha256,
  });
  const publicKeyBase64 = claim.runnerReceiptPublicKey;
  if (!privateKey || typeof publicKeyBase64 !== 'string') {
    return { passed: false, reason: 'C03_RUNNER_KEY_MISMATCH' };
  }
  report.runnerReceipt = createC03RunnerReceipt(receiptPayload, { publicKeyBase64, privateKey });
  const validation = validateC03ProfileReport(report, claim);
  if (!validation.passed) return { passed: false, reason: validation.reason };
  const bytes = Buffer.from(`${JSON.stringify(report, null, 2)}\n`, 'utf8');
  if (bytes.length > 64 * 1024) return { passed: false, reason: 'C03_REPORT_TOO_LARGE' };
  let descriptor;
  try {
    descriptor = openSync(REPORT_PATH, 'wx', 0o600);
    writeFileSync(descriptor, bytes);
    closeSync(descriptor);
  } catch {
    if (descriptor !== undefined) {
      try {
        closeSync(descriptor);
      } catch {
        /* Preserve the create-only refusal. */
      }
    }
    return { passed: false, reason: 'C03_REPORT_ALREADY_EXISTS_OR_UNWRITABLE' };
  }
  return {
    passed: true,
    reportPath: REPORT_RELATIVE_PATH,
    reportSha256: sha256(bytes),
    answerChecks: answerResult.checks,
    comparison: answerResult.comparison,
  };
}

function matchesClaim(report, claim) {
  return (
    report.claimId === claim.claimId &&
    report.profileId === claim.profileId &&
    report.runNumber === claim.runNumber &&
    report.frontierId === claim.frontierId &&
    report.epochId === claim.epochId &&
    report.prNumber === claim.prNumber &&
    report.sourceRevision === claim.sourceCandidateSha &&
    report.baseSha === claim.baseSha &&
    report.ciSha === claim.ciSha &&
    report.ciStatus === claim.ciStatus &&
    report.reviewerId === claim.reviewerId &&
    report.mcpBundleSha256 === claim.bundleSha256 &&
    report.registrySha256 === claim.registrySha256 &&
    report.toolName === claim.toolName &&
    report.argumentProfile === claim.argumentProfile &&
    report.expectedArgumentsSha256 === claim.expectedArgumentsSha256
  );
}

export function validateC03ProfileReport(report, claim, reportBytes = null) {
  const failures = [];
  const fail = (reason) => failures.push(reason);
  if (
    !PROFILE ||
    !report ||
    typeof report !== 'object' ||
    Array.isArray(report) ||
    Object.keys(report).sort().join('\0') !== [...REPORT_FIELDS].sort().join('\0')
  ) {
    return { passed: false, reason: 'C03_REPORT_FIELDS_INVALID' };
  }
  const answerResult = verifyC03AnswerFromReport(report);
  if (!answerResult) fail('C03_ANSWER_CHECKS_INVALID');
  if (!matchesClaim(report, claim)) fail('C03_REPORT_CLAIM_MISMATCH');
  if (
    report.schemaVersion !== 1 ||
    report.evidenceKind !== PROFILE.evidenceKind ||
    report.scenarioId !== 'C03' ||
    report.profileId !== PROFILE.id ||
    report.profile !== 'codex-luna-max-agent-mcp-profile-v1' ||
    report.model !== PROFILE.model ||
    report.reasoningEffort !== PROFILE.reasoningEffort ||
    !/^gpt-6-luna-max-run95-pr\d+-round\d+$/u.test(report.reviewerId ?? '') ||
    !/^\d+\.\d+\.\d+$/u.test(report.codexCliVersion ?? '') ||
    !/^[0-9a-f]{40}$/u.test(report.sourceRevision ?? '') ||
    !/^[0-9a-f]{40}$/u.test(report.baseSha ?? '') ||
    report.ciSha !== report.sourceRevision ||
    report.ciStatus !== 'SUCCESS' ||
    !Number.isSafeInteger(report.prNumber) ||
    report.prNumber < 1 ||
    !/^profile-run-95-pr-\d+-[0-9a-f]{12}-\d+$/u.test(report.claimId ?? '') ||
    !/^[0-9a-f]{64}$/u.test(report.mcpBundleSha256 ?? '') ||
    report.registrySha256 !== agentMcpProfileRegistrySha256() ||
    report.toolName !== PROFILE.toolName ||
    report.argumentProfile !== PROFILE.argumentProfile ||
    report.expectedArgumentsSha256 !== agentMcpProfileArgumentsSha256(PROFILE) ||
    !/^[0-9a-f]{64}$/u.test(report.catalogSha256 ?? '') ||
    !/^[0-9a-f]{64}$/u.test(report.toolDescriptionSha256 ?? '') ||
    !/^[0-9a-f]{64}$/u.test(report.inputSchemaSha256 ?? '') ||
    JSON.stringify(report.serverToolNames) !== JSON.stringify([PROFILE.toolName]) ||
    report.serverToolCount !== 1 ||
    JSON.stringify(report.mcpServerNames) !== JSON.stringify(['bgk_c03_profile']) ||
    report.processExitCode !== 0 ||
    report.resultStatus !== 'SUCCESS' ||
    report.eventStreamParsed !== true ||
    report.turnCompleted !== true ||
    report.codexMcpToolEventCount !== PROFILE.calls.length ||
    report.codexErrorItemCount !== 0 ||
    report.nonMcpToolEventCount !== 0 ||
    JSON.stringify(report.nonMcpToolTypes) !== '[]' ||
    report.shellToolCallCount !== 0 ||
    report.allowedCallCount !== PROFILE.calls.length ||
    report.deniedCallCount !== 0 ||
    report.answerCheckMethod !== PROFILE.answerCheckMethod ||
    !/^[0-9a-f]{64}$/u.test(report.answerSha256 ?? '') ||
    !Number.isSafeInteger(report.answerUtf8Bytes) ||
    report.answerUtf8Bytes < 1 ||
    report.answerUtf8Bytes > PROFILE.maxAnswerBytes
  )
    fail('C03_REPORT_GATE_FIELDS_INVALID');

  if (!Array.isArray(report.actors) || report.actors.length !== PROFILE.calls.length) {
    fail('C03_ACTOR_COUNT_INVALID');
  } else {
    for (let index = 0; index < PROFILE.calls.length; index += 1) {
      const actor = report.actors[index];
      const expected = PROFILE.calls[index].arguments;
      if (
        !actor ||
        Object.keys(actor).sort().join('\0') !== [...ACTOR_FIELDS].sort().join('\0') ||
        actor?.personId !== expected.personId ||
        !['complete', 'partial', 'unavailable', 'not_computable', 'unknown'].includes(
          actor?.state,
        ) ||
        !actor.window ||
        Object.keys(actor.window).sort().join('\0') !==
          [...ACTOR_WINDOW_FIELDS].sort().join('\0') ||
        !isC03CalendarWindow(actor?.window, expected.windowMonths) ||
        actor?.window?.asOfSemantics !== 'calendar_months_ending_on_as_of_date' ||
        !actor.roleCounts ||
        Object.keys(actor.roleCounts).sort().join('\0') !==
          [...ACTOR_ROLE_COUNT_FIELDS].sort().join('\0') ||
        !Array.isArray(actor?.observedRows) ||
        actor.observedRows.length > expected.maxRows ||
        actor.observedRows.some(
          (row) =>
            !row ||
            Object.keys(row).sort().join('\0') !== [...ACTOR_ROW_FIELDS].sort().join('\0') ||
            !Number.isSafeInteger(row?.subjectId) ||
            row.subjectId < 1 ||
            !['main', 'support', 'unknown'].includes(row?.roleFamily),
        ) ||
        !Number.isSafeInteger(actor?.uniqueSubjects) ||
        actor.uniqueSubjects < 0 ||
        !actor.roleCounts ||
        ['main', 'support', 'unknown'].some(
          (role) =>
            !Number.isSafeInteger(actor.roleCounts[role]) ||
            actor.roleCounts[role] < 0 ||
            actor.roleCounts[role] > actor.uniqueSubjects,
        ) ||
        !actor.coverage ||
        Object.keys(actor.coverage).sort().join('\0') !==
          [...ACTOR_COVERAGE_FIELDS].sort().join('\0') ||
        [
          'relationRowsObserved',
          'relationRowsSelected',
          'relationRowsDroppedAtLimit',
          'subjectDetailsSucceeded',
          'subjectDetailsFailed',
          'rowsEligible',
          'rowsReturned',
          'unknownRoleRows',
        ].some(
          (field) =>
            actor.coverage[field] !== null &&
            (!Number.isSafeInteger(actor.coverage[field]) || actor.coverage[field] < 0),
        ) ||
        ['outputTruncated', 'truncated'].some(
          (field) => actor.coverage[field] !== null && typeof actor.coverage[field] !== 'boolean',
        )
      )
        fail(`C03_ACTOR_${index}_INVALID`);
    }
  }
  if (
    !report.comparison ||
    Object.keys(report.comparison).sort().join('\0') !== [...COMPARISON_FIELDS].sort().join('\0') ||
    !Array.isArray(report.comparison.observedSubjectIds) ||
    !Array.isArray(report.comparison.sharedSubjectIds) ||
    !Array.isArray(report.comparison.observedMainRoleShares) ||
    report.comparison.observedMainRoleShares.some(
      (share) =>
        !share || Object.keys(share).sort().join('\0') !== [...ROLE_SHARE_FIELDS].sort().join('\0'),
    )
  ) {
    fail('C03_COMPARISON_FIELDS_INVALID');
  }
  if (Array.isArray(report.actors) && report.actors.length === PROFILE.calls.length) {
    try {
      const expectedComparison = buildC03ObservedComparison(report.actors);
      if (
        canonicalAgentMcpProfileJson(expectedComparison) !==
        canonicalAgentMcpProfileJson(report.comparison)
      )
        fail('C03_COMPARISON_MISMATCH');
    } catch {
      fail('C03_COMPARISON_INVALID');
    }
  }
  if (
    !report.privacy ||
    Object.keys(report.privacy).sort().join('\0') !== [...PRIVACY_FIELDS].sort().join('\0') ||
    [...PRIVACY_FIELDS].some(
      (field) => !Object.hasOwn(report.privacy, field) || report.privacy[field] !== false,
    )
  ) {
    fail('C03_PRIVACY_FIELDS_INVALID');
  }
  const receipt = report.runnerReceipt;
  if (
    !receipt ||
    Object.keys(receipt).sort().join('\0') !== [...RECEIPT_FIELDS].sort().join('\0') ||
    receipt.schemaVersion !== 1 ||
    receipt.kind !== RECEIPT_KIND ||
    receipt.publicKeyBase64 !== claim?.runnerReceiptPublicKey ||
    receipt.publicKeySha256 !== claim?.runnerReceiptPublicKeySha256 ||
    !/^[A-Za-z0-9+/]{40,100}={0,2}$/u.test(receipt.signature ?? '') ||
    !receipt.payload ||
    Object.keys(receipt.payload).sort().join('\0') !== [...RECEIPT_PAYLOAD_FIELDS].sort().join('\0')
  ) {
    fail('C03_RECEIPT_FIELDS_INVALID');
  } else {
    try {
      const publicKeyDer = Buffer.from(receipt.publicKeyBase64, 'base64');
      const publicKey = createPublicKey({ key: publicKeyDer, format: 'der', type: 'spki' });
      const payload = buildC03RunnerReceiptPayload(report, {
        eventStreamSha256: receipt.payload.eventStreamSha256,
        serverSummarySha256: receipt.payload.serverSummarySha256,
      });
      if (
        publicKey.asymmetricKeyType !== 'ed25519' ||
        publicKeyDer.toString('base64') !== receipt.publicKeyBase64 ||
        sha256(publicKeyDer) !== receipt.publicKeySha256 ||
        canonicalAgentMcpProfileJson(payload) !== canonicalAgentMcpProfileJson(receipt.payload) ||
        !verify(
          null,
          Buffer.from(canonicalAgentMcpProfileJson(receipt.payload)),
          publicKey,
          Buffer.from(receipt.signature, 'base64'),
        )
      )
        fail('C03_RECEIPT_SIGNATURE_INVALID');
    } catch {
      fail('C03_RECEIPT_SIGNATURE_INVALID');
    }
  }
  if (reportBytes && !Buffer.isBuffer(reportBytes)) fail('C03_REPORT_BYTES_INVALID');
  if (reportBytes && Buffer.byteLength(reportBytes) > 64 * 1024) fail('C03_REPORT_TOO_LARGE');
  return failures.length === 0
    ? { passed: true, reportSha256: reportBytes ? sha256(reportBytes) : null }
    : { passed: false, reason: failures[0], failures };
}

function verifyC03AnswerFromReport(report) {
  const checks = report?.answerChecks;
  return (
    checks &&
    Object.keys(checks).sort().join('\0') === [...ANSWER_CHECK_FIELDS].sort().join('\0') &&
    [...ANSWER_CHECK_FIELDS].every((field) => checks[field] === true)
  );
}

export function validateC03SanitizedReportFile(claim, root = ROOT, reportPath = null) {
  try {
    const profile = getAgentMcpProfileById(claim?.profileId);
    const expectedPath = path.resolve(root, profile?.reportPath ?? '');
    const absolutePath = path.resolve(reportPath ?? expectedPath);
    if (!profile || absolutePath !== expectedPath) {
      return { passed: false, reason: 'C03_REPORT_PATH_INVALID' };
    }
    const reportBytes = readFileSync(absolutePath);
    let report;
    try {
      report = JSON.parse(reportBytes.toString('utf8'));
    } catch {
      return { passed: false, reason: 'C03_REPORT_JSON_INVALID' };
    }
    const validation = validateC03ProfileReport(report, claim, reportBytes);
    return validation.passed
      ? { ...validation, report, reportPath: profile.reportPath }
      : validation;
  } catch {
    return { passed: false, reason: 'C03_REPORT_UNAVAILABLE' };
  }
}
