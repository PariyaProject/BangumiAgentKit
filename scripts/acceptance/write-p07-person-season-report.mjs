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
  P07_ANSWER_CHECK_FIELDS,
  P07_PROFILE_ID,
  validateP07McpTextProjection,
  validateP07PersonSeasonSummary,
  verifyP07PersonSeasonAnswer,
} from '../lib/p07-person-season-evidence.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PROFILE = getAgentMcpProfileById(P07_PROFILE_ID);
const REPORT_RELATIVE_PATH = PROFILE.reportPath;
const SERVER_ID = 'bgk_p07_person_season';
const RECEIPT_KIND = 'p07-person-season-agent-mcp-runner-receipt-v1';
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
  'mcpTextProjectionValid',
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
  'answerSha256',
  'answerUtf8Bytes',
  'answerChecks',
  'resultSummary',
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
  'mcpTextProjectionValid',
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
  'resultSummarySha256',
]);
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

export function buildP07RunnerReceiptPayload(report, { eventStreamSha256, serverSummarySha256 }) {
  if (
    !report ||
    typeof report !== 'object' ||
    !/^[0-9a-f]{64}$/u.test(eventStreamSha256 ?? '') ||
    !/^[0-9a-f]{64}$/u.test(serverSummarySha256 ?? '')
  )
    throw new TypeError('P07 runner receipt requires exact sanitized report inputs.');
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
    mcpTextProjectionValid: report.mcpTextProjectionValid,
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
    resultSummarySha256: canonicalSha256(report.resultSummary),
  };
}

function createReceipt(payload, { publicKeyBase64, privateKey }) {
  const publicKeyDer = Buffer.from(publicKeyBase64 ?? '', 'base64');
  const publicKey = createPublicKey({ key: publicKeyDer, format: 'der', type: 'spki' });
  if (
    publicKey.asymmetricKeyType !== 'ed25519' ||
    publicKeyDer.toString('base64') !== publicKeyBase64
  ) {
    throw new Error('P07 receipt requires a canonical Ed25519 SPKI public key.');
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

export function validateP07ProfileReport(report, claim, reportBytes = null) {
  if (!PROFILE || !exactKeys(report, REPORT_FIELDS))
    return { passed: false, reason: 'P07_REPORT_FIELDS_INVALID' };
  const failures = [];
  if (!matchesClaim(report, claim)) failures.push('P07_REPORT_CLAIM_MISMATCH');
  const reportGateChecks = [
    [
      'identity',
      report.schemaVersion === 1 &&
        report.evidenceKind === PROFILE.evidenceKind &&
        report.runNumber === 95 &&
        report.frontierId === 'P07' &&
        report.scenarioId === 'P07' &&
        report.epochId === PROFILE.epochId &&
        report.profileId === PROFILE.id &&
        report.profile === 'codex-luna-max-agent-mcp-profile-v1' &&
        report.model === PROFILE.model &&
        report.reasoningEffort === PROFILE.reasoningEffort &&
        /^gpt-6-luna-max-run95-pr\d+-round\d+$/u.test(report.reviewerId ?? '') &&
        /^\d+\.\d+\.\d+$/u.test(report.codexCliVersion ?? '') &&
        /^[0-9a-f]{40}$/u.test(report.sourceRevision ?? '') &&
        /^[0-9a-f]{40}$/u.test(report.baseSha ?? '') &&
        report.ciSha === report.sourceRevision &&
        report.ciStatus === 'SUCCESS' &&
        Number.isSafeInteger(report.prNumber) &&
        report.prNumber > 0 &&
        /^profile-run-95-pr-\d+-[0-9a-f]{12}-\d+$/u.test(report.claimId ?? ''),
    ],
    [
      'profile_binding',
      /^[0-9a-f]{64}$/u.test(report.mcpBundleSha256 ?? '') &&
        report.registrySha256 === agentMcpProfileRegistrySha256(PROFILE.id) &&
        report.toolName === PROFILE.toolName &&
        report.argumentProfile === PROFILE.argumentProfile &&
        report.expectedArgumentsSha256 === agentMcpProfileArgumentsSha256(PROFILE),
    ],
    [
      'catalog_binding',
      /^[0-9a-f]{64}$/u.test(report.catalogSha256 ?? '') &&
        /^[0-9a-f]{64}$/u.test(report.toolDescriptionSha256 ?? '') &&
        /^[0-9a-f]{64}$/u.test(report.inputSchemaSha256 ?? ''),
    ],
    [
      'single_tool',
      canonicalAgentMcpProfileJson(report.serverToolNames) ===
        canonicalAgentMcpProfileJson([PROFILE.toolName]) &&
        report.serverToolCount === 1 &&
        canonicalAgentMcpProfileJson(report.mcpServerNames) ===
          canonicalAgentMcpProfileJson([SERVER_ID]),
    ],
    [
      'runtime',
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
    ],
    [
      'answer',
      report.answerCheckMethod === PROFILE.answerCheckMethod &&
        /^[0-9a-f]{64}$/u.test(report.answerSha256 ?? '') &&
        Number.isSafeInteger(report.answerUtf8Bytes) &&
        report.answerUtf8Bytes > 0 &&
        report.answerUtf8Bytes <= PROFILE.maxAnswerBytes &&
        exactKeys(report.answerChecks, P07_ANSWER_CHECK_FIELDS) &&
        P07_ANSWER_CHECK_FIELDS.every((field) => report.answerChecks[field] === true),
    ],
    [
      'result_summary',
      validateP07PersonSeasonSummary(report.resultSummary, PROFILE.calls[0].arguments),
    ],
    [
      'privacy',
      exactKeys(report.privacy, PRIVACY_FIELDS) &&
        [...PRIVACY_FIELDS].every((field) => report.privacy[field] === false),
    ],
  ];
  for (const [field, passed] of reportGateChecks) {
    if (!passed) failures.push(`P07_REPORT_${field.toUpperCase()}_INVALID`);
  }
  const receipt = report.runnerReceipt;
  if (
    !exactKeys(receipt, RECEIPT_FIELDS) ||
    receipt.schemaVersion !== 1 ||
    receipt.kind !== RECEIPT_KIND ||
    receipt.publicKeyBase64 !== claim?.runnerReceiptPublicKey ||
    receipt.publicKeySha256 !== claim?.runnerReceiptPublicKeySha256 ||
    !receipt.payload ||
    !exactKeys(receipt.payload, RECEIPT_PAYLOAD_FIELDS) ||
    !/^[A-Za-z0-9+/]{40,100}={0,2}$/u.test(receipt.signature ?? '')
  )
    failures.push('P07_RECEIPT_FIELDS_INVALID');
  else {
    try {
      const publicKeyDer = Buffer.from(receipt.publicKeyBase64, 'base64');
      const publicKey = createPublicKey({ key: publicKeyDer, format: 'der', type: 'spki' });
      const payload = buildP07RunnerReceiptPayload(report, {
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
        failures.push('P07_RECEIPT_SIGNATURE_INVALID');
    } catch {
      failures.push('P07_RECEIPT_SIGNATURE_INVALID');
    }
  }
  if (reportBytes && (!Buffer.isBuffer(reportBytes) || reportBytes.length > 64 * 1024)) {
    failures.push('P07_REPORT_BYTES_INVALID');
  }
  return failures.length === 0
    ? { passed: true, reportSha256: reportBytes ? sha256(reportBytes) : null }
    : { passed: false, reason: failures[0], failures };
}

export function validateP07SanitizedReportFile(claim, root = ROOT, reportPath = null) {
  try {
    const expectedPath = path.resolve(root, PROFILE.reportPath);
    const absolutePath = path.resolve(reportPath ?? expectedPath);
    if (absolutePath !== expectedPath) return { passed: false, reason: 'P07_REPORT_PATH_INVALID' };
    const reportBytes = readFileSync(absolutePath);
    let report;
    try {
      report = JSON.parse(reportBytes.toString('utf8'));
    } catch {
      return { passed: false, reason: 'P07_REPORT_JSON_INVALID' };
    }
    const validation = validateP07ProfileReport(report, claim, reportBytes);
    return validation.passed
      ? { ...validation, report, reportPath: PROFILE.reportPath }
      : validation;
  } catch {
    return { passed: false, reason: 'P07_REPORT_UNAVAILABLE' };
  }
}

export function writeP07PersonSeasonReport(input, { privateKey } = {}) {
  const { claim, serverSummary, completedMcpCalls, answer, codexCliVersion, events } = input ?? {};
  const reportRoot = input?.root ?? ROOT;
  const reportPath = path.join(reportRoot, REPORT_RELATIVE_PATH);
  const result = serverSummary?.results?.[0]?.resultSummary;
  const call = completedMcpCalls?.[0];
  if (
    !PROFILE ||
    !claim ||
    claim.profileId !== PROFILE.id ||
    claim.state !== 'CLAIMED' ||
    claim.retryAllowed !== false ||
    !serverSummary ||
    !Array.isArray(completedMcpCalls) ||
    completedMcpCalls.length !== 1 ||
    !events ||
    events.processExitCode !== 0 ||
    events.eventStreamParsed !== true ||
    events.turnCompleted !== true ||
    events.mcpTextProjectionValid !== true ||
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
    !call?.result?.structuredContent ||
    !validateP07PersonSeasonSummary(result, PROFILE.calls[0].arguments) ||
    !validateP07McpTextProjection(
      call.result.content?.find((item) => item?.type === 'text')?.text,
      result,
    ).passed
  )
    return { passed: false, reason: 'P07_RUNNER_GATE_INVALID' };

  if (
    canonicalAgentMcpProfileJson(call.result.structuredContent) !==
    canonicalAgentMcpProfileJson(result)
  ) {
    return { passed: false, reason: 'P07_SERVER_SUMMARY_MISMATCH' };
  }
  const answerResult = verifyP07PersonSeasonAnswer(answer, result);
  if (!answerResult.passed)
    return {
      passed: false,
      reason: 'P07_ANSWER_CHECKS_FAILED',
      answerChecks: answerResult.answerChecks,
    };
  const report = {
    schemaVersion: 1,
    evidenceKind: PROFILE.evidenceKind,
    runNumber: claim.runNumber,
    frontierId: PROFILE.frontierId,
    scenarioId: 'P07',
    epochId: PROFILE.epochId,
    profileId: PROFILE.id,
    profile: 'codex-luna-max-agent-mcp-profile-v1',
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
    mcpTextProjectionValid: events.mcpTextProjectionValid,
    answerSha256: sha256(answer),
    answerUtf8Bytes: Buffer.byteLength(answer, 'utf8'),
    answerChecks: answerResult.answerChecks,
    resultSummary: result,
    privacy: Object.fromEntries([...PRIVACY_FIELDS].map((field) => [field, false])),
  };
  if (!privateKey || typeof claim.runnerReceiptPublicKey !== 'string')
    return { passed: false, reason: 'P07_RUNNER_KEY_MISMATCH' };
  report.runnerReceipt = createReceipt(buildP07RunnerReceiptPayload(report, input), {
    publicKeyBase64: claim.runnerReceiptPublicKey,
    privateKey,
  });
  const validation = validateP07ProfileReport(report, claim);
  if (!validation.passed)
    return { passed: false, reason: validation.reason, failures: validation.failures };
  const bytes = Buffer.from(`${JSON.stringify(report, null, 2)}\n`, 'utf8');
  if (bytes.length > 64 * 1024) return { passed: false, reason: 'P07_REPORT_TOO_LARGE' };
  let descriptor;
  try {
    descriptor = openSync(reportPath, 'wx', 0o600);
    writeFileSync(descriptor, bytes);
    closeSync(descriptor);
  } catch {
    if (descriptor !== undefined) {
      try {
        closeSync(descriptor);
      } catch {
        /* Preserve create-only refusal. */
      }
    }
    return { passed: false, reason: 'P07_REPORT_ALREADY_EXISTS_OR_UNWRITABLE' };
  }
  return {
    passed: true,
    reportPath: REPORT_RELATIVE_PATH,
    absoluteReportPath: reportPath,
    reportSha256: sha256(bytes),
    answerChecks: answerResult.answerChecks,
    resultSummary: result,
  };
}
