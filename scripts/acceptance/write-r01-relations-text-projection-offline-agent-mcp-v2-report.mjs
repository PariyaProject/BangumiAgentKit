import { Buffer } from 'node:buffer';
import { closeSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, createPublicKey, sign, verify } from 'node:crypto';
import { isValidP06CiRunEvidence } from '../lib/p06-ci-run-evidence.mjs';
import {
  agentMcpProfileArgumentsSha256,
  agentMcpProfileRegistrySha256,
  canonicalAgentMcpProfileJson,
  getAgentMcpProfileById,
} from '../lib/agent-mcp-profile-claims.mjs';
import { isG16LunaMaxReviewerId } from '../lib/g16-reviewer-id.mjs';
import { verifyR01TextProjectionAnswer } from './r01-relations-text-projection-answer-check.mjs';
import {
  assertR01RelationsTextProjectionOfflineProfile,
  R01_RELATIONS_TEXT_PROJECTION_OFFLINE_PROFILE_ID,
  R01_RELATIONS_TEXT_PROJECTION_OFFLINE_NETWORK_MODE,
} from '../lib/r01-relations-text-projection-offline-profile.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PROFILE = getAgentMcpProfileById(R01_RELATIONS_TEXT_PROJECTION_OFFLINE_PROFILE_ID);
const SERVER_ID = 'bgk_r01_relations';
const RECEIPT_KIND = 'r01-relations-text-projection-offline-agent-mcp-v2-runner-receipt-v1';
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const canonicalSha256 = (value) => sha256(canonicalAgentMcpProfileJson(value));
const same = (left, right) =>
  canonicalAgentMcpProfileJson(left) === canonicalAgentMcpProfileJson(right);

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
const ANSWER_CHECK_FIELDS = new Set([
  'exactArguments',
  'exactlyOneCompletedToolCall',
  'exactSyntheticSourceResult',
  'textProjectionConsistent',
  'textBudgetVerified',
  'exactAnswerShape',
  'answerMatchesSource',
]);
const RESULT_SUMMARY_FIELDS = new Set([
  'sourceRowsObserved',
  'sourceRowsReturned',
  'sourceSchemaDriftRows',
  'sourceTruncated',
  'textRowsIncluded',
  'textRowsOmitted',
  'textUtf8Bytes',
  'structuredContentAvailable',
  'textProjectionConsistent',
  'firstDisplayedRelationMatched',
]);
const OFFLINE_FIXTURE_FIELDS = new Set([
  'profile',
  'requestCount',
  'relationRequestCount',
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

function exactKeys(value, fields) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    canonicalAgentMcpProfileJson(Object.keys(value).sort()) ===
      canonicalAgentMcpProfileJson([...fields].sort()),
  );
}

function expectedOfflineFixture() {
  return {
    profile: R01_RELATIONS_TEXT_PROJECTION_OFFLINE_NETWORK_MODE,
    requestCount: 1,
    relationRequestCount: 1,
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

function catalogEvidenceMatches(report, root = ROOT) {
  try {
    const bytes = readFileSync(path.join(root, 'docs/tool-catalog.json'));
    const catalog = JSON.parse(bytes.toString('utf8'));
    const tool = catalog.find((item) => item?.name === PROFILE?.toolName);
    return Boolean(
      tool &&
      tool.auth === 'none' &&
      tool.risk === 'read' &&
      report.catalogSha256 === sha256(bytes) &&
      report.toolDescriptionSha256 === sha256(tool.description) &&
      report.inputSchemaSha256 === sha256(canonicalAgentMcpProfileJson(tool.inputSchema)),
    );
  } catch {
    return false;
  }
}

function currentSelectionEvidenceSha256(root = ROOT) {
  try {
    return sha256(readFileSync(path.join(root, PROFILE.selectionEvidencePath)));
  } catch {
    return null;
  }
}

function sanitizedReport(report) {
  return { ...report, runnerReceipt: null };
}

export function buildR01TextProjectionRunnerReceiptPayload(
  report,
  { eventStreamSha256, serverSummarySha256 },
) {
  if (
    !exactKeys(report, REPORT_FIELDS) ||
    !/^[0-9a-f]{64}$/u.test(eventStreamSha256 ?? '') ||
    !/^[0-9a-f]{64}$/u.test(serverSummarySha256 ?? '')
  ) {
    throw new TypeError('R01 text projection receipt requires exact sanitized run inputs.');
  }
  return {
    schemaVersion: 1,
    kind: RECEIPT_KIND,
    sanitizedReportSha256: canonicalSha256(sanitizedReport(report)),
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

function verifyRunnerReceipt(report, claim) {
  try {
    const receipt = report.runnerReceipt;
    if (
      !exactKeys(receipt, RECEIPT_FIELDS) ||
      receipt.schemaVersion !== 1 ||
      receipt.kind !== RECEIPT_KIND ||
      receipt.publicKeyBase64 !== claim.runnerReceiptPublicKey ||
      receipt.payload?.claimId !== claim.claimId ||
      receipt.payload?.profileId !== PROFILE.id ||
      !exactKeys(receipt.payload, RECEIPT_PAYLOAD_FIELDS) ||
      !/^[0-9a-f]{64}$/u.test(receipt.publicKeySha256 ?? '') ||
      !/^[A-Za-z0-9+/]+={0,2}$/u.test(receipt.signature ?? '')
    ) {
      return false;
    }
    const publicKeyDer = Buffer.from(receipt.publicKeyBase64, 'base64');
    if (
      publicKeyDer.toString('base64') !== receipt.publicKeyBase64 ||
      sha256(publicKeyDer) !== receipt.publicKeySha256 ||
      sha256(publicKeyDer) !== claim.runnerReceiptPublicKeySha256
    ) {
      return false;
    }
    const publicKey = createPublicKey({ key: publicKeyDer, format: 'der', type: 'spki' });
    const expectedPayload = buildR01TextProjectionRunnerReceiptPayload(report, {
      eventStreamSha256: receipt.payload.eventStreamSha256,
      serverSummarySha256: receipt.payload.serverSummarySha256,
    });
    return (
      publicKey.asymmetricKeyType === 'ed25519' &&
      same(receipt.payload, expectedPayload) &&
      verify(
        null,
        Buffer.from(canonicalAgentMcpProfileJson(receipt.payload)),
        publicKey,
        Buffer.from(receipt.signature, 'base64'),
      )
    );
  } catch {
    return false;
  }
}

function claimMatchesReport(report, claim) {
  return Boolean(
    claim &&
    claim.frontierId === 'R01' &&
    claim.epochId === PROFILE.epochId &&
    claim.runNumber === 95 &&
    claim.retryAllowed === false &&
    report.profileId === PROFILE.id &&
    report.claimId === claim.claimId &&
    report.runNumber === 95 &&
    report.prNumber === claim.prNumber &&
    report.frontierId === 'R01' &&
    report.epochId === PROFILE.epochId &&
    report.acceptanceScope === 'agent-mcp-matrix-only' &&
    report.reviewerId === claim.reviewerId &&
    report.sourceRevision === claim.sourceCandidateSha &&
    report.baseSha === claim.baseSha &&
    report.ciSha === claim.ciSha &&
    report.ciStatus === 'SUCCESS' &&
    report.ciRunId === claim.ciRunId &&
    same(report.ciChecks, claim.ciChecks) &&
    report.mcpBundleSha256 === claim.bundleSha256 &&
    claim.registrySha256 === agentMcpProfileRegistrySha256(PROFILE.id) &&
    claim.expectedArgumentsSha256 === agentMcpProfileArgumentsSha256(PROFILE) &&
    claim.toolName === PROFILE.toolName &&
    claim.argumentProfile === PROFILE.argumentProfile &&
    report.registrySha256 === agentMcpProfileRegistrySha256(PROFILE.id) &&
    report.expectedArgumentsSha256 === agentMcpProfileArgumentsSha256(PROFILE) &&
    report.toolName === PROFILE.toolName &&
    report.argumentProfile === PROFILE.argumentProfile &&
    report.networkMode === PROFILE.networkMode &&
    report.model === PROFILE.model &&
    report.reasoningEffort === PROFILE.reasoningEffort &&
    report.profile === 'codex-luna-max-offline-agent-mcp-matrix-v2' &&
    typeof report.codexCliVersion === 'string' &&
    /^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/u.test(report.codexCliVersion) &&
    typeof report.observedAt === 'string' &&
    Number.isFinite(Date.parse(report.observedAt)) &&
    typeof report.answerSha256 === 'string' &&
    /^[0-9a-f]{64}$/u.test(report.answerSha256) &&
    Number.isSafeInteger(report.answerUtf8Bytes) &&
    report.answerUtf8Bytes > 0 &&
    report.answerUtf8Bytes <= PROFILE.maxAnswerBytes,
  );
}

function resultSummaryIsValid(summary) {
  return Boolean(
    exactKeys(summary, RESULT_SUMMARY_FIELDS) &&
    summary.sourceRowsObserved === 30 &&
    summary.sourceRowsReturned === 30 &&
    summary.sourceSchemaDriftRows === 0 &&
    summary.sourceTruncated === false &&
    Number.isSafeInteger(summary.textRowsIncluded) &&
    summary.textRowsIncluded >= 1 &&
    summary.textRowsIncluded < 30 &&
    summary.textRowsOmitted === 30 - summary.textRowsIncluded &&
    Number.isSafeInteger(summary.textUtf8Bytes) &&
    summary.textUtf8Bytes > 0 &&
    summary.textUtf8Bytes <= 3600 &&
    summary.structuredContentAvailable === true &&
    summary.textProjectionConsistent === true &&
    summary.firstDisplayedRelationMatched === true,
  );
}

export function validateR01TextProjectionProfileReport(
  report,
  claim,
  reportBytes = null,
  root = ROOT,
) {
  try {
    const bytes = reportBytes ?? Buffer.from(JSON.stringify(report, null, 2) + '\n', 'utf8');
    const claimStateValid =
      (claim?.state === 'CLAIMED' && claim.reportWritten === false) ||
      (claim?.state === 'REPORT_WRITTEN' &&
        claim.reportWritten === true &&
        Buffer.isBuffer(reportBytes) &&
        claim.reportSha256 === sha256(reportBytes));
    const answerChecks = report?.answerChecks;
    const valid = Boolean(
      exactKeys(report, REPORT_FIELDS) &&
      claimStateValid &&
      claim?.profileId === PROFILE.id &&
      claim.retryAllowed === false &&
      isValidP06CiRunEvidence({ ciRunId: claim.ciRunId, ciChecks: claim.ciChecks }) &&
      isG16LunaMaxReviewerId(claim.reviewerId, claim.prNumber) &&
      report.schemaVersion === 1 &&
      report.evidenceKind === PROFILE.evidenceKind &&
      report.scenarioId === null &&
      report.sourceRevision === report.ciSha &&
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
      same(report.serverToolNames, [PROFILE.toolName]) &&
      report.serverToolCount === 1 &&
      same(report.mcpServerNames, [SERVER_ID]) &&
      report.answerCheckMethod === PROFILE.answerCheckMethod &&
      exactKeys(answerChecks, ANSWER_CHECK_FIELDS) &&
      Object.values(answerChecks).every((value) => value === true) &&
      resultSummaryIsValid(report.resultSummary) &&
      exactKeys(report.offlineFixture, OFFLINE_FIXTURE_FIELDS) &&
      same(report.offlineFixture, expectedOfflineFixture()) &&
      exactKeys(report.networkBoundary, NETWORK_BOUNDARY_FIELDS) &&
      same(report.networkBoundary, expectedNetworkBoundary()) &&
      exactKeys(report.privacy, PRIVACY_FIELDS) &&
      same(report.privacy, expectedPrivacy()) &&
      catalogEvidenceMatches(report, root) &&
      currentSelectionEvidenceSha256(root) === report.selectionEvidenceSha256 &&
      claimMatchesReport(report, claim) &&
      verifyRunnerReceipt(report, claim) &&
      sha256(bytes) === sha256(JSON.stringify(report, null, 2) + '\n'),
    );
    if (!valid) return { passed: false, reason: 'R01_TEXT_PROJECTION_REPORT_INVALID' };
    return {
      passed: true,
      reportPath: PROFILE.reportPath,
      reportSha256: sha256(bytes),
      resultCounters: report.resultSummary,
    };
  } catch {
    return { passed: false, reason: 'R01_TEXT_PROJECTION_REPORT_INVALID' };
  }
}

function createRunnerReceipt(payload, { publicKeyBase64, privateKey }) {
  const publicKeyDer = Buffer.from(publicKeyBase64 ?? '', 'base64');
  const publicKey = createPublicKey({ key: publicKeyDer, format: 'der', type: 'spki' });
  if (
    publicKey.asymmetricKeyType !== 'ed25519' ||
    publicKeyDer.toString('base64') !== publicKeyBase64
  ) {
    throw new Error('R01 text projection receipt requires a canonical Ed25519 public key.');
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

export function buildR01TextProjectionProfileReport(
  {
    claim,
    serverSummary,
    events,
    answer,
    answerCheck,
    toolOutput,
    toolCalls,
    codexCliVersion,
    eventStreamSha256,
    serverSummarySha256,
  },
  { privateKey, root = ROOT, reportPath = null } = {},
) {
  const verifiedAnswer = verifyR01TextProjectionAnswer(
    answer,
    PROFILE?.calls?.[0]?.arguments,
    toolOutput,
    toolCalls,
  );
  if (
    !PROFILE ||
    !assertR01RelationsTextProjectionOfflineProfile(PROFILE) ||
    claim?.profileId !== PROFILE.id ||
    claim.state !== 'CLAIMED' ||
    claim.retryAllowed !== false ||
    !isValidP06CiRunEvidence({ ciRunId: claim.ciRunId, ciChecks: claim.ciChecks }) ||
    !isG16LunaMaxReviewerId(claim.reviewerId, claim.prNumber) ||
    !serverSummary ||
    !events ||
    !answerCheck?.passed ||
    !verifiedAnswer.passed ||
    !same(answerCheck.checks, verifiedAnswer.checks) ||
    !same(answerCheck.resultSummary, verifiedAnswer.resultSummary) ||
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
    !same(events.mcpServerNames, [SERVER_ID]) ||
    serverSummary.serverToolCount !== 1 ||
    !same(serverSummary.serverToolNames, [PROFILE.toolName]) ||
    serverSummary.allowedCallCount !== 1 ||
    serverSummary.deniedCallCount !== 0 ||
    serverSummary.results?.[0]?.status !== 'SUCCESS' ||
    !same(serverSummary.results[0].resultSummary, {
      state: 'observed',
      sourceRowsObserved: 30,
      sourceRowsReturned: 30,
      sourceSchemaDriftRows: 0,
      sourceTruncated: false,
      paginationAvailable: false,
      totalCountAvailable: false,
      completeness: 'not_provided_by_source',
    })
  ) {
    return { passed: false, reason: 'R01_TEXT_PROJECTION_RUNNER_GATE_INVALID' };
  }

  const selectionEvidence = readFileSync(path.join(root, PROFILE.selectionEvidencePath));
  const answerBytes = Buffer.byteLength(answer, 'utf8');
  const report = {
    schemaVersion: 1,
    evidenceKind: PROFILE.evidenceKind,
    runNumber: 95,
    frontierId: 'R01',
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
    selectionEvidenceSha256: sha256(selectionEvidence),
    toolName: PROFILE.toolName,
    argumentProfile: PROFILE.argumentProfile,
    expectedArgumentsSha256: agentMcpProfileArgumentsSha256(PROFILE),
    catalogSha256: serverSummary.catalogSha256,
    toolDescriptionSha256: serverSummary.toolDescriptionSha256,
    inputSchemaSha256: serverSummary.inputSchemaSha256,
    serverToolNames: serverSummary.serverToolNames,
    serverToolCount: serverSummary.serverToolCount,
    networkMode: PROFILE.networkMode,
    mcpServerNames: events.mcpServerNames,
    processExitCode: events.processExitCode,
    resultStatus: 'SUCCESS',
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
    answerSha256: sha256(answer),
    answerUtf8Bytes: answerBytes,
    answerChecks: verifiedAnswer.checks,
    resultSummary: verifiedAnswer.resultSummary,
    offlineFixture: serverSummary.offlineFixture,
    networkBoundary: expectedNetworkBoundary(),
    privacy: expectedPrivacy(),
    runnerReceipt: null,
  };
  const receiptPayload = buildR01TextProjectionRunnerReceiptPayload(report, {
    eventStreamSha256,
    serverSummarySha256,
  });
  report.runnerReceipt = createRunnerReceipt(receiptPayload, {
    publicKeyBase64: claim.runnerReceiptPublicKey,
    privateKey,
  });
  const validation = validateR01TextProjectionProfileReport(report, claim, null, root);
  if (!validation.passed) return validation;

  const target = reportPath ?? path.join(root, PROFILE.reportPath);
  try {
    const descriptor = openSync(target, 'wx', 0o600);
    try {
      writeFileSync(descriptor, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    } finally {
      closeSync(descriptor);
    }
    const reportBytes = readFileSync(target);
    const finalValidation = validateR01TextProjectionProfileReport(
      report,
      claim,
      reportBytes,
      root,
    );
    if (!finalValidation.passed) return finalValidation;
    return { passed: true, reportSha256: sha256(reportBytes), reportPath: PROFILE.reportPath };
  } catch {
    return { passed: false, reason: 'R01_TEXT_PROJECTION_REPORT_WRITE_FAILED' };
  }
}

export function validateR01RelationsTextProjectionOfflineSanitizedReportFile(
  claim,
  root = ROOT,
  reportPath = null,
) {
  try {
    const target = reportPath ?? path.join(root, PROFILE.reportPath);
    const bytes = readFileSync(target);
    const report = JSON.parse(bytes.toString('utf8'));
    const validation = validateR01TextProjectionProfileReport(report, claim, bytes, root);
    return validation.passed ? { ...validation, reportPath: PROFILE.reportPath } : validation;
  } catch {
    return { passed: false, reason: 'R01_TEXT_PROJECTION_REPORT_INVALID' };
  }
}
