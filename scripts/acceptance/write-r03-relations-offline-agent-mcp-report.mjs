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
import { isValidP06CiRunEvidence } from '../lib/p06-ci-run-evidence.mjs';
import {
  assertR03RelationsOfflineProfile,
  R03_RELATIONS_OFFLINE_ACKNOWLEDGEMENT,
  R03_RELATIONS_OFFLINE_EXPECTED_RESULT_SUMMARIES,
  R03_RELATIONS_OFFLINE_NETWORK_MODE,
  R03_RELATIONS_OFFLINE_PROFILE_ID,
} from '../lib/r03-relations-offline-profile.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PROFILE = getAgentMcpProfileById(R03_RELATIONS_OFFLINE_PROFILE_ID);
const REPORT_RELATIVE_PATH = PROFILE?.reportPath;
const ACKNOWLEDGEMENT = R03_RELATIONS_OFFLINE_ACKNOWLEDGEMENT;
const SERVER_ID = 'bgk_r03_relations_v2';
const RECEIPT_KIND = 'r03-relations-offline-agent-mcp-runner-receipt-v2';
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const canonicalSha256 = (value) => sha256(canonicalAgentMcpProfileJson(value));

const REPORT_FIELDS = new Set([
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
  'observedAt',
  'sourceRevision',
  'baseSha',
  'ciSha',
  'ciStatus',
  'ciRunId',
  'ciChecks',
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
  'networkMode',
  'mcpServerNames',
  'processExitCode',
  'resultStatus',
  'eventStreamParsed',
  'turnCompleted',
  'codexMcpToolEventCount',
  'codexErrorItemCount',
  'blockedWebSearchErrorItemCount',
  'unexpectedCodexErrorItemCount',
  'nonMcpToolEventCount',
  'nonMcpToolTypes',
  'shellToolCallCount',
  'allowedCallCount',
  'deniedCallCount',
  'answerCheckMethod',
  'answerSha256',
  'answerUtf8Bytes',
  'answerChecks',
  'resultSummary',
  'offlineFixture',
  'networkBoundary',
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
const RECEIPT_PAYLOAD_FIELDS = new Set([
  'schemaVersion',
  'kind',
  'sanitizedReportSha256',
  'claimId',
  'profileId',
  'runNumber',
  'frontierId',
  'epochId',
  'acceptanceScope',
  'prNumber',
  'sourceRevision',
  'baseSha',
  'ciSha',
  'ciStatus',
  'ciRunId',
  'ciChecks',
  'reviewerId',
  'bundleSha256',
  'registrySha256',
  'selectionEvidenceSha256',
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
  'blockedWebSearchErrorItemCount',
  'unexpectedCodexErrorItemCount',
  'nonMcpToolEventCount',
  'shellToolCallCount',
  'allowedCallCount',
  'deniedCallCount',
  'offlineFixtureSha256',
  'networkBoundarySha256',
  'answerSha256',
  'eventStreamSha256',
  'serverSummarySha256',
]);
const OFFLINE_FIXTURE_FIELDS = new Set([
  'profile',
  'requestCount',
  'relationRequestCount',
  'rootRequestCount',
  'intermediateRequestCount',
  'duplicateRequestCount',
  'unexpectedRequestCount',
  'authorizationHeaderCount',
  'expectedOperationsComplete',
]);
const NETWORK_BOUNDARY_FIELDS = new Set([
  'liveBangumiApiRequestCount',
  'rendererAssetRequestCount',
  'fullCodexHarnessNetworkSandboxed',
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
  'rawFixtureRowsStored',
  'rawToolResultStored',
  'artifactImageBytesStored',
  'credentialsStored',
]);
const ANSWER_CHECK_FIELDS = new Set([
  'exactRegisteredProfile',
  'oneAllowedMcpTool',
  'fixedArguments',
  'exactCandidateBundle',
  'offlineFixtureOnly',
  'oneExpectedLocalResponse',
  'noAssetRequests',
  'exactAcknowledgement',
  'privacyPreserved',
]);

function exactKeys(value, fields) {
  return (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).sort().join('\0') === [...fields].sort().join('\0')
  );
}

function expectedFixture() {
  return {
    profile: R03_RELATIONS_OFFLINE_NETWORK_MODE,
    requestCount: 1,
    relationRequestCount: 1,
    rootRequestCount: 1,
    intermediateRequestCount: 0,
    duplicateRequestCount: 0,
    unexpectedRequestCount: 0,
    authorizationHeaderCount: 0,
    expectedOperationsComplete: true,
  };
}

function expectedNetworkBoundary() {
  return {
    liveBangumiApiRequestCount: 0,
    rendererAssetRequestCount: 0,
    fullCodexHarnessNetworkSandboxed: false,
  };
}

function expectedPrivacy() {
  return {
    authProfile: 'anonymous',
    oauthAttempted: false,
    accountDataRead: false,
    writesAttempted: false,
    communityRead: false,
    qqPipelineTested: false,
    timClientTested: false,
    promptStored: false,
    answerStored: false,
    rawFixtureRowsStored: false,
    rawToolResultStored: false,
    artifactImageBytesStored: false,
    credentialsStored: false,
  };
}

function expectedResultSummary() {
  return R03_RELATIONS_OFFLINE_EXPECTED_RESULT_SUMMARIES;
}

function expectedAnswerChecks() {
  return {
    exactRegisteredProfile: true,
    oneAllowedMcpTool: true,
    fixedArguments: true,
    exactCandidateBundle: true,
    offlineFixtureOnly: true,
    oneExpectedLocalResponse: true,
    noAssetRequests: true,
    exactAcknowledgement: true,
    privacyPreserved: true,
  };
}

function matchesClaim(report, claim) {
  return (
    report.claimId === claim.claimId &&
    report.profileId === claim.profileId &&
    report.runNumber === claim.runNumber &&
    report.prNumber === claim.prNumber &&
    report.epochId === claim.epochId &&
    report.frontierId === claim.frontierId &&
    report.sourceRevision === claim.sourceCandidateSha &&
    report.baseSha === claim.baseSha &&
    report.ciSha === claim.ciSha &&
    report.ciStatus === claim.ciStatus &&
    report.ciRunId === claim.ciRunId &&
    canonicalAgentMcpProfileJson(report.ciChecks) ===
      canonicalAgentMcpProfileJson(claim.ciChecks) &&
    report.reviewerId === claim.reviewerId &&
    report.mcpBundleSha256 === claim.bundleSha256 &&
    report.registrySha256 === claim.registrySha256 &&
    report.toolName === claim.toolName &&
    report.argumentProfile === claim.argumentProfile &&
    report.expectedArgumentsSha256 === claim.expectedArgumentsSha256
  );
}

export function buildR03RunnerReceiptPayload(report, { eventStreamSha256, serverSummarySha256 }) {
  if (
    !report ||
    typeof report !== 'object' ||
    !/^[0-9a-f]{64}$/u.test(eventStreamSha256 ?? '') ||
    !/^[0-9a-f]{64}$/u.test(serverSummarySha256 ?? '')
  )
    throw new TypeError('R03 runner receipt requires exact sanitized run inputs.');
  return {
    schemaVersion: 1,
    kind: RECEIPT_KIND,
    sanitizedReportSha256: sha256(canonicalAgentMcpProfileJson({ ...report, runnerReceipt: null })),
    claimId: report.claimId,
    profileId: report.profileId,
    runNumber: report.runNumber,
    frontierId: report.frontierId,
    epochId: report.epochId,
    acceptanceScope: report.acceptanceScope,
    prNumber: report.prNumber,
    sourceRevision: report.sourceRevision,
    baseSha: report.baseSha,
    ciSha: report.ciSha,
    ciStatus: report.ciStatus,
    ciRunId: report.ciRunId,
    ciChecks: report.ciChecks,
    reviewerId: report.reviewerId,
    bundleSha256: report.mcpBundleSha256,
    registrySha256: report.registrySha256,
    selectionEvidenceSha256: report.selectionEvidenceSha256,
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
    blockedWebSearchErrorItemCount: report.blockedWebSearchErrorItemCount,
    unexpectedCodexErrorItemCount: report.unexpectedCodexErrorItemCount,
    nonMcpToolEventCount: report.nonMcpToolEventCount,
    shellToolCallCount: report.shellToolCallCount,
    allowedCallCount: report.allowedCallCount,
    deniedCallCount: report.deniedCallCount,
    offlineFixtureSha256: canonicalSha256(report.offlineFixture),
    networkBoundarySha256: canonicalSha256(report.networkBoundary),
    answerSha256: report.answerSha256,
    eventStreamSha256,
    serverSummarySha256,
  };
}

function createRunnerReceipt(payload, { publicKeyBase64, privateKey }) {
  const publicKeyDer = Buffer.from(publicKeyBase64 ?? '', 'base64');
  const publicKey = createPublicKey({ key: publicKeyDer, format: 'der', type: 'spki' });
  if (
    publicKey.asymmetricKeyType !== 'ed25519' ||
    publicKeyDer.toString('base64') !== publicKeyBase64
  )
    throw new Error('R03 runner receipt requires a canonical Ed25519 SPKI public key.');
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

function catalogEvidenceMatches(report) {
  try {
    const bytes = readFileSync(path.join(ROOT, 'docs/tool-catalog.json'));
    const catalog = JSON.parse(bytes.toString('utf8'));
    const item = catalog.find((row) => row?.name === PROFILE?.toolName);
    return (
      item?.auth === 'none' &&
      item?.risk === 'read' &&
      report.catalogSha256 === sha256(bytes) &&
      report.toolDescriptionSha256 === sha256(item.description ?? '') &&
      report.inputSchemaSha256 === sha256(canonicalAgentMcpProfileJson(item.inputSchema))
    );
  } catch {
    return false;
  }
}

export function validateR03ProfileReport(report, claim, reportBytes = null) {
  const claimStateValid =
    (claim?.state === 'CLAIMED' && claim.reportWritten === false) ||
    (claim?.state === 'REPORT_WRITTEN' &&
      claim.reportWritten === true &&
      Buffer.isBuffer(reportBytes) &&
      claim.reportSha256 === sha256(reportBytes));
  if (
    !PROFILE ||
    !assertR03RelationsOfflineProfile(PROFILE) ||
    !exactKeys(report, REPORT_FIELDS) ||
    !claim ||
    claim.profileId !== PROFILE.id ||
    !claimStateValid ||
    claim.retryAllowed !== false ||
    !isValidP06CiRunEvidence({ ciRunId: report?.ciRunId, ciChecks: report?.ciChecks }) ||
    !matchesClaim(report, claim)
  )
    return { passed: false, reason: 'R03_REPORT_CLAIM_INVALID' };

  const selectionBytes = readFileSync(path.join(ROOT, PROFILE.selectionEvidencePath));
  const receipt = report.runnerReceipt;
  const valid =
    report.schemaVersion === 1 &&
    report.evidenceKind === PROFILE.evidenceKind &&
    report.runNumber === 95 &&
    report.frontierId === 'R03' &&
    report.scenarioId === null &&
    report.acceptanceScope === 'agent-mcp-matrix-only' &&
    report.epochId === PROFILE.epochId &&
    report.profileId === PROFILE.id &&
    report.profile === 'codex-luna-max-offline-agent-mcp-matrix-v2' &&
    report.model === PROFILE.model &&
    report.reasoningEffort === PROFILE.reasoningEffort &&
    new RegExp(`^gpt-6-luna-max-run95-pr${report.prNumber}-round[1-9]\\d*$`, 'u').test(
      report.reviewerId ?? '',
    ) &&
    /^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/u.test(report.codexCliVersion ?? '') &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(report.observedAt ?? '') &&
    /^[0-9a-f]{40}$/u.test(report.sourceRevision ?? '') &&
    /^[0-9a-f]{40}$/u.test(report.baseSha ?? '') &&
    report.ciSha === report.sourceRevision &&
    report.ciStatus === 'SUCCESS' &&
    /^[1-9]\d{3,}$/u.test(report.ciRunId ?? '') &&
    Number.isSafeInteger(report.prNumber) &&
    report.prNumber > 0 &&
    new RegExp(
      `^profile-run-95-pr-${report.prNumber}-${report.sourceRevision.slice(0, 12)}-\\d+$`,
      'u',
    ).test(report.claimId ?? '') &&
    /^[0-9a-f]{64}$/u.test(report.mcpBundleSha256 ?? '') &&
    report.registrySha256 === agentMcpProfileRegistrySha256(PROFILE.id) &&
    report.selectionEvidenceSha256 === sha256(selectionBytes) &&
    catalogEvidenceMatches(report) &&
    report.toolName === PROFILE.toolName &&
    report.argumentProfile === PROFILE.argumentProfile &&
    report.expectedArgumentsSha256 === agentMcpProfileArgumentsSha256(PROFILE) &&
    report.networkMode === R03_RELATIONS_OFFLINE_NETWORK_MODE &&
    canonicalAgentMcpProfileJson(report.serverToolNames) ===
      canonicalAgentMcpProfileJson([PROFILE.toolName]) &&
    report.serverToolCount === 1 &&
    canonicalAgentMcpProfileJson(report.mcpServerNames) ===
      canonicalAgentMcpProfileJson([SERVER_ID]) &&
    report.processExitCode === 0 &&
    report.resultStatus === 'SUCCESS' &&
    report.eventStreamParsed === true &&
    report.turnCompleted === true &&
    report.codexMcpToolEventCount === 1 &&
    Number.isSafeInteger(report.codexErrorItemCount) &&
    report.codexErrorItemCount >= 0 &&
    report.codexErrorItemCount <= 3 &&
    report.blockedWebSearchErrorItemCount === report.codexErrorItemCount &&
    report.unexpectedCodexErrorItemCount === 0 &&
    report.nonMcpToolEventCount === 0 &&
    Array.isArray(report.nonMcpToolTypes) &&
    report.nonMcpToolTypes.length === 0 &&
    report.shellToolCallCount === 0 &&
    report.allowedCallCount === 1 &&
    report.deniedCallCount === 0 &&
    report.answerCheckMethod === PROFILE.answerCheckMethod &&
    report.answerSha256 === sha256(ACKNOWLEDGEMENT) &&
    report.answerUtf8Bytes === Buffer.byteLength(ACKNOWLEDGEMENT, 'utf8') &&
    Array.isArray(report.resultSummary) &&
    report.resultSummary.length === 1 &&
    canonicalAgentMcpProfileJson(report.resultSummary) ===
      canonicalAgentMcpProfileJson(expectedResultSummary()) &&
    exactKeys(report.offlineFixture, OFFLINE_FIXTURE_FIELDS) &&
    canonicalAgentMcpProfileJson(report.offlineFixture) ===
      canonicalAgentMcpProfileJson(expectedFixture()) &&
    exactKeys(report.networkBoundary, NETWORK_BOUNDARY_FIELDS) &&
    canonicalAgentMcpProfileJson(report.networkBoundary) ===
      canonicalAgentMcpProfileJson(expectedNetworkBoundary()) &&
    exactKeys(report.privacy, PRIVACY_FIELDS) &&
    canonicalAgentMcpProfileJson(report.privacy) ===
      canonicalAgentMcpProfileJson(expectedPrivacy()) &&
    exactKeys(report.answerChecks, ANSWER_CHECK_FIELDS) &&
    canonicalAgentMcpProfileJson(report.answerChecks) ===
      canonicalAgentMcpProfileJson(expectedAnswerChecks()) &&
    exactKeys(receipt, RECEIPT_FIELDS) &&
    exactKeys(receipt.payload, RECEIPT_PAYLOAD_FIELDS);
  if (!valid) return { passed: false, reason: 'R03_REPORT_FIELDS_INVALID' };

  let signatureValid = false;
  try {
    const publicKeyDer = Buffer.from(claim.runnerReceiptPublicKey ?? '', 'base64');
    const publicKey = createPublicKey({ key: publicKeyDer, format: 'der', type: 'spki' });
    const payload = buildR03RunnerReceiptPayload(report, {
      eventStreamSha256: receipt.payload.eventStreamSha256,
      serverSummarySha256: receipt.payload.serverSummarySha256,
    });
    signatureValid =
      publicKey.asymmetricKeyType === 'ed25519' &&
      publicKeyDer.toString('base64') === claim.runnerReceiptPublicKey &&
      receipt.schemaVersion === 1 &&
      receipt.kind === RECEIPT_KIND &&
      receipt.payload.schemaVersion === 1 &&
      receipt.payload.kind === RECEIPT_KIND &&
      receipt.publicKeyBase64 === claim.runnerReceiptPublicKey &&
      receipt.publicKeySha256 === claim.runnerReceiptPublicKeySha256 &&
      sha256(publicKeyDer) === receipt.publicKeySha256 &&
      Buffer.from(receipt.signature, 'base64').toString('base64') === receipt.signature &&
      canonicalAgentMcpProfileJson(payload) === canonicalAgentMcpProfileJson(receipt.payload) &&
      verify(
        null,
        Buffer.from(canonicalAgentMcpProfileJson(receipt.payload)),
        publicKey,
        Buffer.from(receipt.signature, 'base64'),
      );
  } catch {
    signatureValid = false;
  }
  if (!signatureValid) return { passed: false, reason: 'R03_RUNNER_RECEIPT_INVALID' };
  if (reportBytes && reportBytes.length > 64 * 1024)
    return { passed: false, reason: 'R03_REPORT_TOO_LARGE' };
  return { passed: true, reportPath: REPORT_RELATIVE_PATH };
}

export function buildR03ProfileReport(
  { claim, serverSummary, events, answer, codexCliVersion, eventStreamSha256, serverSummarySha256 },
  { privateKey, root = ROOT, reportPath = null } = {},
) {
  if (
    !PROFILE ||
    !assertR03RelationsOfflineProfile(PROFILE) ||
    claim?.profileId !== PROFILE.id ||
    claim.state !== 'CLAIMED' ||
    claim.retryAllowed !== false ||
    !isValidP06CiRunEvidence({ ciRunId: claim.ciRunId, ciChecks: claim.ciChecks }) ||
    !serverSummary ||
    !events ||
    answer !== ACKNOWLEDGEMENT ||
    events.processExitCode !== 0 ||
    events.eventStreamParsed !== true ||
    events.turnCompleted !== true ||
    events.codexMcpToolEventCount !== 1 ||
    !Number.isSafeInteger(events.codexErrorItemCount) ||
    events.codexErrorItemCount < 0 ||
    events.codexErrorItemCount > 3 ||
    events.blockedWebSearchErrorItemCount !== events.codexErrorItemCount ||
    events.unexpectedCodexErrorItemCount !== 0 ||
    events.nonMcpToolEventCount !== 0 ||
    events.shellToolCallCount !== 0 ||
    events.exactCall !== true ||
    events.exactToolEvent !== true ||
    canonicalAgentMcpProfileJson(events.mcpServerNames) !==
      canonicalAgentMcpProfileJson([SERVER_ID]) ||
    serverSummary.serverToolCount !== 1 ||
    canonicalAgentMcpProfileJson(serverSummary.serverToolNames) !==
      canonicalAgentMcpProfileJson([PROFILE.toolName]) ||
    serverSummary.allowedCallCount !== 1 ||
    serverSummary.deniedCallCount !== 0 ||
    serverSummary.results?.length !== 1 ||
    serverSummary.results.some(
      (result, index) =>
        result?.sequenceIndex !== index ||
        result?.status !== 'SUCCESS' ||
        canonicalAgentMcpProfileJson(result?.resultSummary) !==
          canonicalAgentMcpProfileJson(expectedResultSummary()[index]),
    )
  )
    return { passed: false, reason: 'R03_RUNNER_GATE_INVALID' };

  const bytes = readFileSync(path.join(ROOT, PROFILE.selectionEvidencePath));
  const report = {
    schemaVersion: 1,
    evidenceKind: PROFILE.evidenceKind,
    runNumber: 95,
    frontierId: 'R03',
    scenarioId: null,
    acceptanceScope: 'agent-mcp-matrix-only',
    epochId: PROFILE.epochId,
    profileId: PROFILE.id,
    profile: 'codex-luna-max-offline-agent-mcp-matrix-v2',
    model: PROFILE.model,
    reasoningEffort: PROFILE.reasoningEffort,
    reviewerId: claim.reviewerId,
    codexCliVersion,
    observedAt: new Date().toISOString(),
    sourceRevision: claim.sourceCandidateSha,
    baseSha: claim.baseSha,
    ciSha: claim.ciSha,
    ciStatus: claim.ciStatus,
    ciRunId: claim.ciRunId,
    ciChecks: claim.ciChecks,
    prNumber: claim.prNumber,
    claimId: claim.claimId,
    mcpBundleSha256: claim.bundleSha256,
    registrySha256: claim.registrySha256,
    selectionEvidenceSha256: sha256(bytes),
    toolName: PROFILE.toolName,
    argumentProfile: PROFILE.argumentProfile,
    expectedArgumentsSha256: agentMcpProfileArgumentsSha256(PROFILE),
    catalogSha256: serverSummary.catalogSha256,
    toolDescriptionSha256: serverSummary.toolDescriptionSha256,
    inputSchemaSha256: serverSummary.inputSchemaSha256,
    serverToolNames: serverSummary.serverToolNames,
    serverToolCount: serverSummary.serverToolCount,
    networkMode: R03_RELATIONS_OFFLINE_NETWORK_MODE,
    mcpServerNames: events.mcpServerNames,
    processExitCode: events.processExitCode,
    resultStatus: events.processExitCode === 0 ? 'SUCCESS' : 'FAILED',
    eventStreamParsed: events.eventStreamParsed,
    turnCompleted: events.turnCompleted,
    codexMcpToolEventCount: events.codexMcpToolEventCount,
    codexErrorItemCount: events.codexErrorItemCount,
    blockedWebSearchErrorItemCount: events.blockedWebSearchErrorItemCount,
    unexpectedCodexErrorItemCount: events.unexpectedCodexErrorItemCount,
    nonMcpToolEventCount: events.nonMcpToolEventCount,
    nonMcpToolTypes: events.nonMcpToolTypes,
    shellToolCallCount: events.shellToolCallCount,
    allowedCallCount: serverSummary.allowedCallCount,
    deniedCallCount: serverSummary.deniedCallCount,
    answerCheckMethod: PROFILE.answerCheckMethod,
    answerSha256: sha256(ACKNOWLEDGEMENT),
    answerUtf8Bytes: Buffer.byteLength(ACKNOWLEDGEMENT, 'utf8'),
    answerChecks: expectedAnswerChecks(),
    resultSummary: serverSummary.results.map((item) => item.resultSummary),
    offlineFixture: serverSummary.offlineFixture,
    networkBoundary: expectedNetworkBoundary(),
    privacy: expectedPrivacy(),
    runnerReceipt: null,
  };
  const receiptPayload = buildR03RunnerReceiptPayload(report, {
    eventStreamSha256,
    serverSummarySha256,
  });
  report.runnerReceipt = createRunnerReceipt(receiptPayload, {
    publicKeyBase64: claim.runnerReceiptPublicKey,
    privateKey,
  });
  const validation = validateR03ProfileReport(report, claim);
  if (!validation.passed) return validation;
  const target = reportPath ?? path.join(root, REPORT_RELATIVE_PATH);
  try {
    const fd = openSync(target, 'wx', 0o600);
    try {
      writeFileSync(fd, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    } finally {
      closeSync(fd);
    }
    const reportBytes = readFileSync(target);
    const finalValidation = validateR03ProfileReport(report, claim, reportBytes);
    if (!finalValidation.passed) return finalValidation;
    return { passed: true, reportSha256: sha256(reportBytes), reportPath: REPORT_RELATIVE_PATH };
  } catch {
    return { passed: false, reason: 'R03_REPORT_WRITE_FAILED' };
  }
}

export function validateR03SanitizedReportFile(claim, root = ROOT, reportPath = null) {
  if (!PROFILE || !assertR03RelationsOfflineProfile(PROFILE))
    return { passed: false, reason: 'R03_PROFILE_INVALID' };
  const target = reportPath ?? path.join(root, REPORT_RELATIVE_PATH);
  try {
    if (path.resolve(target) !== path.resolve(root, REPORT_RELATIVE_PATH))
      return { passed: false, reason: 'R03_REPORT_PATH_INVALID' };
    const bytes = readFileSync(target);
    const report = JSON.parse(bytes.toString('utf8'));
    const validation = validateR03ProfileReport(report, claim, bytes);
    if (!validation.passed) return validation;
    return { passed: true, reportPath: REPORT_RELATIVE_PATH, reportSha256: sha256(bytes), report };
  } catch {
    return { passed: false, reason: 'R03_REPORT_UNAVAILABLE' };
  }
}

export const validateR03RelationsOfflineSanitizedReportFile = validateR03SanitizedReportFile;
