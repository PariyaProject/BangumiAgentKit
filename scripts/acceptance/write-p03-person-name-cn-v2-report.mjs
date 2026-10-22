import { Buffer } from 'node:buffer';
import { createHash, createPublicKey, sign, verify } from 'node:crypto';
import { closeSync, openSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  agentMcpProfileArgumentsSha256,
  agentMcpProfileRegistrySha256,
  canonicalAgentMcpProfileJson,
  getAgentMcpProfileById,
} from '../lib/agent-mcp-profile-claims.mjs';
import {
  P03_ANSWER_CHECK_FIELDS,
  P03_V2_PROFILE_ID,
  validateP03McpTextProjection,
  validateP03ResultSummary,
  verifyP03Answer,
} from '../lib/p03-person-name-cn-evidence.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PROFILE = getAgentMcpProfileById(P03_V2_PROFILE_ID);
const REPORT_PATH = PROFILE?.reportPath;
const DEFAULT_REPORT_FILE_OPERATIONS = Object.freeze({
  closeSync,
  openSync,
  unlinkSync,
  writeFileSync,
});
const SERVER_ID = 'bgk_p03_name_cn';
const RECEIPT_KIND = 'p03-person-name-cn-agent-mcp-runner-receipt-v2';
const PRIVACY_FIELDS = [
  'authProfile',
  'oauthAttempted',
  'accountDataRead',
  'writesAttempted',
  'communityRead',
  'qqPipelineTested',
  'timClientTested',
  'promptStored',
  'answerStored',
  'rawSourceRowsStored',
  'rawToolResultStored',
  'eventStreamStored',
  'credentialsStored',
];
const COUNTER_FIELDS = [
  'subjectsObserved',
  'subjectsReturned',
  'subjectsTruncated',
  'returnedCreditRowsObserved',
  'positiveNameCnRowsObserved',
  'emptyNameCnRowsObserved',
  'unavailableNameCnRowsObserved',
  'nameCnRowsOmittedFromText',
];
const REPORT_FIELDS = [
  'schemaVersion',
  'evidenceKind',
  'runNumber',
  'frontierId',
  'scenarioId',
  'acceptanceScope',
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
  'selectionEvidenceSha256',
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
  'mcpTextProjectionValid',
  'structuredContentReadbackAvailable',
  'answerSha256',
  'answerUtf8Bytes',
  'answerChecks',
  'resultCounters',
  'sourceCompletenessDocumented',
  'privacy',
  'runnerReceipt',
];
const RECEIPT_FIELDS = [
  'schemaVersion',
  'kind',
  'publicKeyBase64',
  'publicKeySha256',
  'payload',
  'signature',
];
const RECEIPT_PAYLOAD_FIELDS = [
  'schemaVersion',
  'kind',
  'sanitizedReportSha256',
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
  'mcpTextProjectionValid',
  'structuredContentReadbackAvailable',
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
  'resultCountersSha256',
];
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const canonicalSha256 = (value) => sha256(canonicalAgentMcpProfileJson(value));

function exactKeys(value, expected) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    canonicalAgentMcpProfileJson(Object.keys(value).sort()) ===
      canonicalAgentMcpProfileJson([...expected].sort()),
  );
}

function coreReport(report) {
  const core = { ...report };
  delete core.runnerReceipt;
  return core;
}

function currentSelectionEvidenceSha256() {
  try {
    return sha256(readFileSync(path.join(ROOT, PROFILE.selectionEvidencePath)));
  } catch {
    return null;
  }
}

function reportClaimMatches(report, claim) {
  return (
    claim &&
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

export function buildP03V2RunnerReceiptPayload(report, { eventStreamSha256, serverSummarySha256 }) {
  if (
    !exactKeys(
      coreReport(report),
      REPORT_FIELDS.filter((field) => field !== 'runnerReceipt'),
    ) ||
    !/^[0-9a-f]{64}$/u.test(eventStreamSha256 ?? '') ||
    !/^[0-9a-f]{64}$/u.test(serverSummarySha256 ?? '')
  ) {
    throw new TypeError('P03 v2 receipt requires exact sanitized report inputs.');
  }
  return {
    schemaVersion: 1,
    kind: RECEIPT_KIND,
    sanitizedReportSha256: canonicalSha256(coreReport(report)),
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
    mcpTextProjectionValid: report.mcpTextProjectionValid,
    structuredContentReadbackAvailable: report.structuredContentReadbackAvailable,
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
    resultCountersSha256: canonicalSha256(report.resultCounters),
  };
}

function createReceipt(payload, { publicKeyBase64, privateKey }) {
  const publicKeyDer = Buffer.from(publicKeyBase64 ?? '', 'base64');
  const publicKey = createPublicKey({ key: publicKeyDer, format: 'der', type: 'spki' });
  if (
    publicKey.asymmetricKeyType !== 'ed25519' ||
    publicKeyDer.toString('base64') !== publicKeyBase64
  ) {
    throw new Error('P03 v2 receipt requires a canonical Ed25519 SPKI key.');
  }
  return {
    schemaVersion: 1,
    kind: RECEIPT_KIND,
    publicKeyBase64,
    publicKeySha256: sha256(publicKeyDer),
    payload,
    signature: sign(null, Buffer.from(canonicalAgentMcpProfileJson(payload)), privateKey).toString(
      'base64',
    ),
  };
}

export function validateP03V2ProfileReport(report, claim, reportBytes = null) {
  if (!PROFILE || !exactKeys(report, REPORT_FIELDS)) {
    return { passed: false, reason: 'P03_V2_REPORT_FIELDS_INVALID' };
  }
  const checks = {
    claim: reportClaimMatches(report, claim),
    identity:
      report.schemaVersion === 1 &&
      report.evidenceKind === PROFILE.evidenceKind &&
      report.runNumber === 95 &&
      report.frontierId === 'P03' &&
      report.scenarioId === null &&
      report.acceptanceScope === 'agent-mcp-matrix-only' &&
      report.epochId === PROFILE.epochId &&
      report.profileId === PROFILE.id &&
      report.profile === 'codex-luna-max-agent-mcp-matrix-v2' &&
      report.model === PROFILE.model &&
      report.reasoningEffort === PROFILE.reasoningEffort &&
      /^gpt-6-luna-max-run95-pr\d+-round\d+$/u.test(report.reviewerId ?? '') &&
      /^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/u.test(report.codexCliVersion ?? '') &&
      /^[0-9a-f]{40}$/u.test(report.sourceRevision ?? '') &&
      /^[0-9a-f]{40}$/u.test(report.baseSha ?? '') &&
      report.ciSha === report.sourceRevision &&
      report.ciStatus === 'SUCCESS' &&
      Number.isSafeInteger(report.prNumber) &&
      report.prNumber > 0 &&
      /^profile-run-95-pr-\d+-[0-9a-f]{12}-\d+$/u.test(report.claimId ?? ''),
    binding:
      /^[0-9a-f]{64}$/u.test(report.mcpBundleSha256 ?? '') &&
      report.registrySha256 === agentMcpProfileRegistrySha256(PROFILE.id) &&
      report.selectionEvidenceSha256 === currentSelectionEvidenceSha256() &&
      report.toolName === PROFILE.toolName &&
      report.argumentProfile === PROFILE.argumentProfile &&
      report.expectedArgumentsSha256 === agentMcpProfileArgumentsSha256(PROFILE),
    catalog:
      /^[0-9a-f]{64}$/u.test(report.catalogSha256 ?? '') &&
      /^[0-9a-f]{64}$/u.test(report.toolDescriptionSha256 ?? '') &&
      /^[0-9a-f]{64}$/u.test(report.inputSchemaSha256 ?? ''),
    tool:
      canonicalAgentMcpProfileJson(report.serverToolNames) ===
        canonicalAgentMcpProfileJson([PROFILE.toolName]) &&
      report.serverToolCount === 1 &&
      canonicalAgentMcpProfileJson(report.mcpServerNames) ===
        canonicalAgentMcpProfileJson([SERVER_ID]),
    runtime:
      report.processExitCode === 0 &&
      report.resultStatus === 'SUCCESS' &&
      report.eventStreamParsed === true &&
      report.turnCompleted === true &&
      report.codexMcpToolEventCount === 1 &&
      report.codexErrorItemCount === 0 &&
      report.nonMcpToolEventCount === 0 &&
      canonicalAgentMcpProfileJson(report.nonMcpToolTypes) === '[]' &&
      report.shellToolCallCount === 0 &&
      report.allowedCallCount === 1 &&
      report.deniedCallCount === 0,
    answer:
      report.answerCheckMethod === PROFILE.answerCheckMethod &&
      report.mcpTextProjectionValid === true &&
      report.structuredContentReadbackAvailable === false &&
      /^[0-9a-f]{64}$/u.test(report.answerSha256 ?? '') &&
      Number.isSafeInteger(report.answerUtf8Bytes) &&
      report.answerUtf8Bytes > 0 &&
      report.answerUtf8Bytes <= PROFILE.maxAnswerBytes &&
      exactKeys(report.answerChecks, P03_ANSWER_CHECK_FIELDS) &&
      P03_ANSWER_CHECK_FIELDS.every((field) => report.answerChecks[field] === true),
    counters:
      exactKeys(report.resultCounters, COUNTER_FIELDS) &&
      COUNTER_FIELDS.every((field) =>
        field === 'subjectsTruncated'
          ? typeof report.resultCounters[field] === 'boolean'
          : Number.isSafeInteger(report.resultCounters[field]) && report.resultCounters[field] >= 0,
      ) &&
      report.resultCounters.subjectsObserved >= report.resultCounters.subjectsReturned &&
      report.resultCounters.subjectsTruncated ===
        report.resultCounters.subjectsObserved > report.resultCounters.subjectsReturned &&
      report.resultCounters.subjectsReturned === report.resultCounters.returnedCreditRowsObserved &&
      report.resultCounters.returnedCreditRowsObserved ===
        report.resultCounters.positiveNameCnRowsObserved +
          report.resultCounters.emptyNameCnRowsObserved +
          report.resultCounters.unavailableNameCnRowsObserved &&
      report.sourceCompletenessDocumented === false,
    privacy:
      exactKeys(report.privacy, PRIVACY_FIELDS) &&
      report.privacy.authProfile === 'anonymous' &&
      PRIVACY_FIELDS.filter((field) => field !== 'authProfile').every(
        (field) => report.privacy[field] === false,
      ),
  };
  if (reportBytes && (!Buffer.isBuffer(reportBytes) || reportBytes.length > 64 * 1024)) {
    checks.bytes = false;
  }
  if (Object.values(checks).some((passed) => !passed)) {
    const reason = Object.entries(checks).find(([, passed]) => !passed)?.[0] ?? 'unknown';
    return { passed: false, reason: `P03_V2_REPORT_${reason.toUpperCase()}_INVALID`, checks };
  }

  const receipt = report.runnerReceipt;
  if (
    !exactKeys(receipt, RECEIPT_FIELDS) ||
    receipt.schemaVersion !== 1 ||
    receipt.kind !== RECEIPT_KIND ||
    receipt.publicKeyBase64 !== claim?.runnerReceiptPublicKey ||
    receipt.publicKeySha256 !== claim?.runnerReceiptPublicKeySha256 ||
    !exactKeys(receipt.payload, RECEIPT_PAYLOAD_FIELDS) ||
    !/^[A-Za-z0-9+/]{40,100}={0,2}$/u.test(receipt.signature ?? '')
  ) {
    return { passed: false, reason: 'P03_V2_RECEIPT_FIELDS_INVALID' };
  }
  try {
    const publicKeyDer = Buffer.from(receipt.publicKeyBase64, 'base64');
    const publicKey = createPublicKey({ key: publicKeyDer, format: 'der', type: 'spki' });
    const payload = buildP03V2RunnerReceiptPayload(report, {
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
    ) {
      return { passed: false, reason: 'P03_V2_RECEIPT_SIGNATURE_INVALID' };
    }
  } catch {
    return { passed: false, reason: 'P03_V2_RECEIPT_SIGNATURE_INVALID' };
  }
  return { passed: true, reportSha256: reportBytes ? sha256(reportBytes) : null };
}

export function validateP03V2SanitizedReportFile(claim, root = ROOT, reportPath = null) {
  try {
    const expectedPath = path.resolve(root, PROFILE.reportPath);
    const absolutePath = path.resolve(reportPath ?? expectedPath);
    if (absolutePath !== expectedPath) {
      return { passed: false, reason: 'P03_V2_REPORT_PATH_INVALID' };
    }
    const reportBytes = readFileSync(absolutePath);
    let report;
    try {
      report = JSON.parse(reportBytes.toString('utf8'));
    } catch {
      return { passed: false, reason: 'P03_V2_REPORT_JSON_INVALID' };
    }
    const validation = validateP03V2ProfileReport(report, claim, reportBytes);
    return validation.passed
      ? { ...validation, report, reportPath: PROFILE.reportPath }
      : validation;
  } catch {
    return { passed: false, reason: 'P03_V2_REPORT_UNAVAILABLE' };
  }
}

export function writeP03V2PersonNameCnReport(
  input,
  { privateKey, fileOperations = DEFAULT_REPORT_FILE_OPERATIONS } = {},
) {
  const { claim, serverSummary, completedMcpCalls, answer, codexCliVersion, events } = input ?? {};
  const reportRoot = input?.root ?? ROOT;
  const reportPath = path.join(reportRoot, REPORT_PATH);
  const resultSummary = serverSummary?.results?.[0]?.resultSummary;
  const call = completedMcpCalls?.[0];
  const text = call?.result?.content?.find((item) => item?.type === 'text')?.text;
  const result = resultSummary;
  if (
    !PROFILE ||
    claim?.profileId !== PROFILE.id ||
    claim?.state !== 'CLAIMED' ||
    claim?.retryAllowed !== false ||
    !serverSummary ||
    !Array.isArray(completedMcpCalls) ||
    completedMcpCalls.length !== 1 ||
    !events ||
    events.processExitCode !== 0 ||
    events.eventStreamParsed !== true ||
    events.turnCompleted !== true ||
    events.mcpTextProjectionValid !== true ||
    events.structuredContentReadbackAvailable !== false ||
    events.codexMcpToolEventCount !== 1 ||
    events.codexErrorItemCount !== 0 ||
    events.nonMcpToolEventCount !== 0 ||
    events.shellToolCallCount !== 0 ||
    events.allowedCallCount !== 1 ||
    events.deniedCallCount !== 0 ||
    canonicalAgentMcpProfileJson(events.mcpServerNames) !==
      canonicalAgentMcpProfileJson([SERVER_ID]) ||
    serverSummary.profileId !== PROFILE.id ||
    serverSummary.serverProfile !== 'closed-profile-sequence-anonymous-public-v1' ||
    serverSummary.sourceRevision !== claim.sourceCandidateSha ||
    serverSummary.bundleSha256 !== claim.bundleSha256 ||
    serverSummary.argumentProfile !== PROFILE.argumentProfile ||
    serverSummary.toolName !== PROFILE.toolName ||
    serverSummary.expectedArgumentsSha256 !== claim.expectedArgumentsSha256 ||
    canonicalAgentMcpProfileJson(serverSummary.serverToolNames) !==
      canonicalAgentMcpProfileJson([PROFILE.toolName]) ||
    serverSummary.serverToolCount !== 1 ||
    serverSummary.expectedCallCount !== 1 ||
    serverSummary.serverResultStatus !== 'SUCCESS' ||
    serverSummary.allowedCallCount !== 1 ||
    serverSummary.deniedCallCount !== 0 ||
    !Array.isArray(serverSummary.results) ||
    serverSummary.results.length !== 1 ||
    serverSummary.results[0]?.sequenceIndex !== 0 ||
    serverSummary.results[0]?.status !== 'SUCCESS' ||
    call?.tool !== PROFILE.toolName ||
    canonicalAgentMcpProfileJson(call?.arguments) !==
      canonicalAgentMcpProfileJson(PROFILE.calls[0].arguments) ||
    call?.result?.structuredContent !== undefined ||
    !validateP03ResultSummary(result, PROFILE.calls[0].arguments, PROFILE.id) ||
    !validateP03McpTextProjection(text, result, PROFILE.id).passed
  ) {
    return { passed: false, reason: 'P03_V2_RUNNER_GATE_INVALID' };
  }
  const answerResult = verifyP03Answer(answer, result);
  if (!answerResult.passed) {
    return {
      passed: false,
      reason: 'P03_V2_ANSWER_CHECKS_FAILED',
      answerChecks: answerResult.answerChecks,
    };
  }
  const counts = result.nameCnSourceCounts;
  const report = {
    schemaVersion: 1,
    evidenceKind: PROFILE.evidenceKind,
    runNumber: claim.runNumber,
    frontierId: PROFILE.frontierId,
    scenarioId: null,
    acceptanceScope: PROFILE.acceptanceScope,
    epochId: PROFILE.epochId,
    profileId: PROFILE.id,
    profile: 'codex-luna-max-agent-mcp-matrix-v2',
    model: PROFILE.model,
    reasoningEffort: PROFILE.reasoningEffort,
    reviewerId: claim.reviewerId,
    codexCliVersion,
    sourceRevision: claim.sourceCandidateSha,
    baseSha: claim.baseSha,
    ciSha: claim.ciSha,
    ciStatus: claim.ciStatus,
    prNumber: claim.prNumber,
    claimId: claim.claimId,
    mcpBundleSha256: claim.bundleSha256,
    registrySha256: claim.registrySha256,
    selectionEvidenceSha256: currentSelectionEvidenceSha256(),
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
    mcpTextProjectionValid: true,
    structuredContentReadbackAvailable: false,
    answerSha256: sha256(answer),
    answerUtf8Bytes: Buffer.byteLength(answer, 'utf8'),
    answerChecks: answerResult.answerChecks,
    resultCounters: {
      subjectsObserved: result.coverage.subjectsObserved,
      subjectsReturned: result.coverage.subjectsReturned,
      subjectsTruncated: result.coverage.subjectsTruncated,
      returnedCreditRowsObserved: result.returnedCreditRowsObserved,
      positiveNameCnRowsObserved: result.positiveNameCnRowsObserved,
      emptyNameCnRowsObserved: counts.empty,
      unavailableNameCnRowsObserved: counts.unavailable,
      nameCnRowsOmittedFromText: result.nameCnRowsOmittedFromText,
    },
    sourceCompletenessDocumented: false,
    privacy: {
      authProfile: 'anonymous',
      oauthAttempted: false,
      accountDataRead: false,
      writesAttempted: false,
      communityRead: false,
      qqPipelineTested: false,
      timClientTested: false,
      promptStored: false,
      answerStored: false,
      rawSourceRowsStored: false,
      rawToolResultStored: false,
      eventStreamStored: false,
      credentialsStored: false,
    },
  };
  if (!privateKey || typeof claim.runnerReceiptPublicKey !== 'string') {
    return { passed: false, reason: 'P03_V2_RUNNER_KEY_MISMATCH' };
  }
  report.runnerReceipt = createReceipt(buildP03V2RunnerReceiptPayload(report, input), {
    publicKeyBase64: claim.runnerReceiptPublicKey,
    privateKey,
  });
  const validation = validateP03V2ProfileReport(report, claim);
  if (!validation.passed) {
    return { passed: false, reason: validation.reason, checks: validation.checks };
  }
  const bytes = Buffer.from(`${JSON.stringify(report, null, 2)}\n`, 'utf8');
  if (bytes.length > 64 * 1024) return { passed: false, reason: 'P03_V2_REPORT_TOO_LARGE' };
  let descriptor;
  let createdReportPath = false;
  try {
    descriptor = fileOperations.openSync(reportPath, 'wx', 0o600);
    createdReportPath = true;
    fileOperations.writeFileSync(descriptor, bytes);
    fileOperations.closeSync(descriptor);
    descriptor = undefined;
  } catch {
    if (descriptor !== undefined) {
      try {
        fileOperations.closeSync(descriptor);
      } catch {
        /* Preserve create-only refusal. */
      }
    }
    if (createdReportPath) {
      try {
        fileOperations.unlinkSync(reportPath);
      } catch {
        /* Do not remove a pre-existing report after create-only refusal. */
      }
    }
    return { passed: false, reason: 'P03_V2_REPORT_ALREADY_EXISTS_OR_UNWRITABLE' };
  }
  return {
    passed: true,
    reportPath: REPORT_PATH,
    absoluteReportPath: reportPath,
    reportSha256: sha256(bytes),
    answerChecks: answerResult.answerChecks,
    resultCounters: report.resultCounters,
  };
}
