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
  assertG01QuerySubjectsOfflineProfile,
  G01_QUERY_SUBJECTS_OFFLINE_ACKNOWLEDGEMENT,
  G01_QUERY_SUBJECTS_OFFLINE_ANSWER_CHECK_METHOD,
  G01_QUERY_SUBJECTS_OFFLINE_NETWORK_MODE,
  G01_QUERY_SUBJECTS_OFFLINE_SERVER_ID,
} from '../lib/g01-query-subjects-offline-matrix-profile.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PROFILE = getAgentMcpProfileById('g01-query-subjects-offline-agent-mcp-matrix-v1');
const REPORT_RELATIVE_PATH = PROFILE?.reportPath;
const RECEIPT_KIND = 'g01-query-subjects-offline-matrix-runner-receipt-v1';
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const canonicalSha256 = (value) => sha256(canonicalAgentMcpProfileJson(value));

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
  'nonMcpToolEventCount',
  'shellToolCallCount',
  'allowedCallCount',
  'deniedCallCount',
  'networkMode',
  'offlineFixtureSha256',
  'resultSummarySha256',
  'networkBoundarySha256',
  'answerSha256',
  'eventStreamSha256',
  'serverSummarySha256',
]);
const ANSWER_CHECK_FIELDS = new Set([
  'exactRegisteredProfile',
  'oneAllowedMcpTool',
  'fixedArguments',
  'exactCandidateBundle',
  'offlineFixtureOnly',
  'singleExpectedSearchResponse',
  'noScenarioCredit',
  'exactAcknowledgement',
  'privacyPreserved',
]);
const OFFLINE_FIXTURE_FIELDS = new Set([
  'profile',
  'requestCount',
  'searchRequestCount',
  'duplicateRequestCount',
  'unexpectedRequestCount',
  'rejectedHeaderCount',
  'expectedOperationsComplete',
  'rawFixturePayloadStored',
]);
const RESULT_SUMMARY_FIELDS = new Set([
  'resultState',
  'returnedItems',
  'coverageState',
  'requested',
  'returned',
  'pagesScanned',
  'totalKind',
  'warningCount',
]);
const NETWORK_BOUNDARY_FIELDS = new Set([
  'liveBangumiApiRequestCount',
  'unexpectedNetworkRequestCount',
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

function exactKeys(value, fields) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).sort().join('\0') === [...fields].sort().join('\0'),
  );
}

function expectedFixture() {
  return {
    profile: G01_QUERY_SUBJECTS_OFFLINE_NETWORK_MODE,
    requestCount: 1,
    searchRequestCount: 1,
    duplicateRequestCount: 0,
    unexpectedRequestCount: 0,
    rejectedHeaderCount: 0,
    expectedOperationsComplete: true,
    rawFixturePayloadStored: false,
  };
}

function expectedNetworkBoundary() {
  return {
    liveBangumiApiRequestCount: 0,
    unexpectedNetworkRequestCount: 0,
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

function expectedAnswerChecks() {
  return {
    exactRegisteredProfile: true,
    oneAllowedMcpTool: true,
    fixedArguments: true,
    exactCandidateBundle: true,
    offlineFixtureOnly: true,
    singleExpectedSearchResponse: true,
    noScenarioCredit: true,
    exactAcknowledgement: true,
    privacyPreserved: true,
  };
}

function resultSummaryIsValid(summary) {
  return Boolean(
    exactKeys(summary, RESULT_SUMMARY_FIELDS) &&
    summary.resultState === 'ok' &&
    summary.returnedItems === 1 &&
    ['complete', 'partial', 'unavailable', 'not_computable', 'unknown'].includes(
      summary.coverageState,
    ) &&
    summary.requested === 1 &&
    summary.returned === 1 &&
    summary.pagesScanned === 1 &&
    ['exact', 'estimated', 'unknown', 'unavailable'].includes(summary.totalKind) &&
    Number.isSafeInteger(summary.warningCount) &&
    summary.warningCount >= 0 &&
    summary.warningCount <= 8,
  );
}

function catalogEvidenceMatches(report, root = ROOT) {
  try {
    const bytes = readFileSync(path.join(root, 'docs/tool-catalog.json'));
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

function matchesClaim(report, claim) {
  return Boolean(
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
    report.expectedArgumentsSha256 === claim.expectedArgumentsSha256,
  );
}

export function validateG01QuerySubjectsOfflineServerSummary(
  summary,
  sourceRevision,
  bundleSha256,
) {
  return Boolean(
    summary &&
    summary.serverProfile === 'closed-profile-sequence-anonymous-offline-v1' &&
    summary.profileId === PROFILE?.id &&
    summary.argumentProfile === PROFILE?.argumentProfile &&
    summary.networkMode === G01_QUERY_SUBJECTS_OFFLINE_NETWORK_MODE &&
    summary.expectedArgumentsSha256 === agentMcpProfileArgumentsSha256(PROFILE) &&
    summary.sourceRevision === sourceRevision &&
    summary.bundleSha256 === bundleSha256 &&
    summary.toolName === PROFILE?.toolName &&
    summary.serverToolCount === 1 &&
    canonicalAgentMcpProfileJson(summary.serverToolNames) ===
      canonicalAgentMcpProfileJson([PROFILE?.toolName]) &&
    summary.expectedCallCount === 1 &&
    summary.serverResultStatus === 'SUCCESS' &&
    summary.allowedCallCount === 1 &&
    summary.deniedCallCount === 0 &&
    Array.isArray(summary.results) &&
    summary.results.length === 1 &&
    summary.results[0]?.sequenceIndex === 0 &&
    summary.results[0]?.status === 'SUCCESS' &&
    resultSummaryIsValid(summary.results[0]?.resultSummary) &&
    exactKeys(summary.offlineFixture, OFFLINE_FIXTURE_FIELDS) &&
    canonicalAgentMcpProfileJson(summary.offlineFixture) ===
      canonicalAgentMcpProfileJson(expectedFixture()),
  );
}

export function buildG01QuerySubjectsOfflineRunnerReceiptPayload(
  report,
  { eventStreamSha256, serverSummarySha256 },
) {
  if (
    !report ||
    typeof report !== 'object' ||
    !/^[0-9a-f]{64}$/u.test(eventStreamSha256 ?? '') ||
    !/^[0-9a-f]{64}$/u.test(serverSummarySha256 ?? '')
  ) {
    throw new TypeError('G01 query-subjects runner receipt requires exact sanitized run inputs.');
  }
  return {
    schemaVersion: 1,
    kind: RECEIPT_KIND,
    sanitizedReportSha256: sha256(canonicalAgentMcpProfileJson({ ...report, runnerReceipt: null })),
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
    nonMcpToolEventCount: report.nonMcpToolEventCount,
    shellToolCallCount: report.shellToolCallCount,
    allowedCallCount: report.allowedCallCount,
    deniedCallCount: report.deniedCallCount,
    networkMode: report.networkMode,
    offlineFixtureSha256: canonicalSha256(report.offlineFixture),
    resultSummarySha256: canonicalSha256(report.resultSummary),
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
  ) {
    throw new Error('G01 query-subjects receipt requires a canonical Ed25519 SPKI public key.');
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

export function validateG01QuerySubjectsOfflineProfileReport(
  report,
  claim,
  reportBytes = null,
  root = ROOT,
) {
  const claimStateValid =
    (claim?.state === 'CLAIMED' && claim.reportWritten === false) ||
    (claim?.state === 'REPORT_WRITTEN' &&
      claim.reportWritten === true &&
      Buffer.isBuffer(reportBytes) &&
      claim.reportSha256 === sha256(reportBytes));
  if (
    !PROFILE ||
    !assertG01QuerySubjectsOfflineProfile(PROFILE) ||
    !exactKeys(report, REPORT_FIELDS) ||
    !claim ||
    claim.profileId !== PROFILE.id ||
    !claimStateValid ||
    claim.retryAllowed !== false ||
    !isValidP06CiRunEvidence({ ciRunId: report?.ciRunId, ciChecks: report?.ciChecks }) ||
    !matchesClaim(report, claim)
  ) {
    return { passed: false, reason: 'G01_QUERY_SUBJECTS_REPORT_CLAIM_INVALID' };
  }
  let selectionBytes;
  try {
    selectionBytes = readFileSync(path.join(root, PROFILE.selectionEvidencePath));
  } catch {
    return { passed: false, reason: 'G01_QUERY_SUBJECTS_SELECTION_EVIDENCE_MISSING' };
  }
  const expected = {
    schemaVersion: 1,
    evidenceKind: PROFILE.evidenceKind,
    runNumber: 95,
    frontierId: 'G01',
    scenarioId: null,
    epochId: PROFILE.epochId,
    profileId: PROFILE.id,
    profile: 'codex-luna-max-offline-agent-mcp-matrix-v1',
    model: PROFILE.model,
    reasoningEffort: PROFILE.reasoningEffort,
    registrySha256: agentMcpProfileRegistrySha256(PROFILE.id),
    selectionEvidenceSha256: sha256(selectionBytes),
    toolName: PROFILE.toolName,
    argumentProfile: PROFILE.argumentProfile,
    expectedArgumentsSha256: agentMcpProfileArgumentsSha256(PROFILE),
    networkMode: G01_QUERY_SUBJECTS_OFFLINE_NETWORK_MODE,
    serverToolNames: [PROFILE.toolName],
    serverToolCount: 1,
    mcpServerNames: [G01_QUERY_SUBJECTS_OFFLINE_SERVER_ID],
    processExitCode: 0,
    resultStatus: 'SUCCESS',
    eventStreamParsed: true,
    turnCompleted: true,
    codexMcpToolEventCount: 1,
    codexErrorItemCount: 0,
    nonMcpToolEventCount: 0,
    nonMcpToolTypes: [],
    shellToolCallCount: 0,
    allowedCallCount: 1,
    deniedCallCount: 0,
    answerCheckMethod: G01_QUERY_SUBJECTS_OFFLINE_ANSWER_CHECK_METHOD,
    answerSha256: sha256(G01_QUERY_SUBJECTS_OFFLINE_ACKNOWLEDGEMENT),
    answerUtf8Bytes: Buffer.byteLength(G01_QUERY_SUBJECTS_OFFLINE_ACKNOWLEDGEMENT, 'utf8'),
  };
  const valid =
    report.evidenceKind === expected.evidenceKind &&
    report.runNumber === expected.runNumber &&
    report.frontierId === expected.frontierId &&
    report.scenarioId === expected.scenarioId &&
    report.epochId === expected.epochId &&
    report.profileId === expected.profileId &&
    report.profile === expected.profile &&
    report.model === expected.model &&
    report.reasoningEffort === expected.reasoningEffort &&
    /^gpt-6-luna-max-run95-pr\d+-round[1-9]\d*$/u.test(report.reviewerId ?? '') &&
    /^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/u.test(report.codexCliVersion ?? '') &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(report.observedAt ?? '') &&
    /^[0-9a-f]{40}$/u.test(report.sourceRevision ?? '') &&
    /^[0-9a-f]{40}$/u.test(report.baseSha ?? '') &&
    report.ciSha === report.sourceRevision &&
    report.ciStatus === 'SUCCESS' &&
    Number.isSafeInteger(report.prNumber) &&
    report.prNumber > 0 &&
    new RegExp(
      `^profile-run-95-pr-${report.prNumber}-${report.sourceRevision.slice(0, 12)}-\\d+$`,
      'u',
    ).test(report.claimId ?? '') &&
    /^[0-9a-f]{64}$/u.test(report.mcpBundleSha256 ?? '') &&
    report.registrySha256 === expected.registrySha256 &&
    report.selectionEvidenceSha256 === expected.selectionEvidenceSha256 &&
    report.toolName === expected.toolName &&
    report.argumentProfile === expected.argumentProfile &&
    report.expectedArgumentsSha256 === expected.expectedArgumentsSha256 &&
    report.networkMode === expected.networkMode &&
    canonicalAgentMcpProfileJson(report.serverToolNames) ===
      canonicalAgentMcpProfileJson(expected.serverToolNames) &&
    report.serverToolCount === expected.serverToolCount &&
    canonicalAgentMcpProfileJson(report.mcpServerNames) ===
      canonicalAgentMcpProfileJson(expected.mcpServerNames) &&
    report.processExitCode === expected.processExitCode &&
    report.resultStatus === expected.resultStatus &&
    report.eventStreamParsed === expected.eventStreamParsed &&
    report.turnCompleted === expected.turnCompleted &&
    report.codexMcpToolEventCount === expected.codexMcpToolEventCount &&
    report.codexErrorItemCount === expected.codexErrorItemCount &&
    report.nonMcpToolEventCount === expected.nonMcpToolEventCount &&
    canonicalAgentMcpProfileJson(report.nonMcpToolTypes) ===
      canonicalAgentMcpProfileJson(expected.nonMcpToolTypes) &&
    report.shellToolCallCount === expected.shellToolCallCount &&
    report.allowedCallCount === expected.allowedCallCount &&
    report.deniedCallCount === expected.deniedCallCount &&
    report.answerCheckMethod === expected.answerCheckMethod &&
    report.answerSha256 === expected.answerSha256 &&
    report.answerUtf8Bytes === expected.answerUtf8Bytes &&
    catalogEvidenceMatches(report, root) &&
    resultSummaryIsValid(report.resultSummary) &&
    exactKeys(report.offlineFixture, OFFLINE_FIXTURE_FIELDS) &&
    canonicalAgentMcpProfileJson(report.offlineFixture) ===
      canonicalAgentMcpProfileJson(expectedFixture()) &&
    exactKeys(report.networkBoundary, NETWORK_BOUNDARY_FIELDS) &&
    canonicalAgentMcpProfileJson(report.networkBoundary) ===
      canonicalAgentMcpProfileJson(expectedNetworkBoundary()) &&
    exactKeys(report.answerChecks, ANSWER_CHECK_FIELDS) &&
    canonicalAgentMcpProfileJson(report.answerChecks) ===
      canonicalAgentMcpProfileJson(expectedAnswerChecks()) &&
    exactKeys(report.privacy, PRIVACY_FIELDS) &&
    canonicalAgentMcpProfileJson(report.privacy) ===
      canonicalAgentMcpProfileJson(expectedPrivacy()) &&
    exactKeys(report.runnerReceipt, RECEIPT_FIELDS) &&
    exactKeys(report.runnerReceipt.payload, RECEIPT_PAYLOAD_FIELDS);
  if (!valid) return { passed: false, reason: 'G01_QUERY_SUBJECTS_REPORT_FIELDS_INVALID' };

  let receiptValid = false;
  try {
    const receipt = report.runnerReceipt;
    const publicKeyDer = Buffer.from(receipt.publicKeyBase64, 'base64');
    const publicKey = createPublicKey({ key: publicKeyDer, format: 'der', type: 'spki' });
    const payload = buildG01QuerySubjectsOfflineRunnerReceiptPayload(report, {
      eventStreamSha256: receipt.payload.eventStreamSha256,
      serverSummarySha256: receipt.payload.serverSummarySha256,
    });
    receiptValid =
      receipt.kind === RECEIPT_KIND &&
      receipt.schemaVersion === 1 &&
      receipt.payload.kind === RECEIPT_KIND &&
      receipt.payload.schemaVersion === 1 &&
      receipt.publicKeyBase64 === claim.runnerReceiptPublicKey &&
      receipt.publicKeySha256 === claim.runnerReceiptPublicKeySha256 &&
      publicKey.asymmetricKeyType === 'ed25519' &&
      sha256(publicKeyDer) === receipt.publicKeySha256 &&
      canonicalAgentMcpProfileJson(payload) === canonicalAgentMcpProfileJson(receipt.payload) &&
      Buffer.from(receipt.signature, 'base64').toString('base64') === receipt.signature &&
      verify(
        null,
        Buffer.from(canonicalAgentMcpProfileJson(receipt.payload)),
        publicKey,
        Buffer.from(receipt.signature, 'base64'),
      );
  } catch {
    receiptValid = false;
  }
  if (!receiptValid) return { passed: false, reason: 'G01_QUERY_SUBJECTS_RECEIPT_INVALID' };
  if (reportBytes && reportBytes.length > 64 * 1024) {
    return { passed: false, reason: 'G01_QUERY_SUBJECTS_REPORT_TOO_LARGE' };
  }
  return { passed: true, reportPath: REPORT_RELATIVE_PATH };
}

export function buildG01QuerySubjectsOfflineProfileReport(
  { claim, serverSummary, events, answer, codexCliVersion, eventStreamSha256, serverSummarySha256 },
  { privateKey, root = ROOT, reportPath = null } = {},
) {
  if (
    !PROFILE ||
    !assertG01QuerySubjectsOfflineProfile(PROFILE) ||
    claim?.profileId !== PROFILE.id ||
    claim.state !== 'CLAIMED' ||
    claim.retryAllowed !== false ||
    !isValidP06CiRunEvidence({ ciRunId: claim.ciRunId, ciChecks: claim.ciChecks }) ||
    !validateG01QuerySubjectsOfflineServerSummary(
      serverSummary,
      claim.sourceCandidateSha,
      claim.bundleSha256,
    ) ||
    answer !== G01_QUERY_SUBJECTS_OFFLINE_ACKNOWLEDGEMENT ||
    events?.processExitCode !== 0 ||
    events?.eventStreamParsed !== true ||
    events?.turnCompleted !== true ||
    events?.codexMcpToolEventCount !== 1 ||
    events?.codexErrorItemCount !== 0 ||
    events?.nonMcpToolEventCount !== 0 ||
    events?.shellToolCallCount !== 0 ||
    events?.exactCall !== true ||
    events?.exactToolEvent !== true ||
    canonicalAgentMcpProfileJson(events?.mcpServerNames) !==
      canonicalAgentMcpProfileJson([G01_QUERY_SUBJECTS_OFFLINE_SERVER_ID])
  ) {
    return { passed: false, reason: 'G01_QUERY_SUBJECTS_RUNNER_GATE_INVALID' };
  }

  let selectionBytes;
  try {
    selectionBytes = readFileSync(path.join(root, PROFILE.selectionEvidencePath));
  } catch {
    return { passed: false, reason: 'G01_QUERY_SUBJECTS_SELECTION_EVIDENCE_MISSING' };
  }
  const report = {
    schemaVersion: 1,
    evidenceKind: PROFILE.evidenceKind,
    runNumber: 95,
    frontierId: 'G01',
    scenarioId: null,
    epochId: PROFILE.epochId,
    profileId: PROFILE.id,
    profile: 'codex-luna-max-offline-agent-mcp-matrix-v1',
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
    selectionEvidenceSha256: sha256(selectionBytes),
    toolName: PROFILE.toolName,
    argumentProfile: PROFILE.argumentProfile,
    expectedArgumentsSha256: agentMcpProfileArgumentsSha256(PROFILE),
    catalogSha256: serverSummary.catalogSha256,
    toolDescriptionSha256: serverSummary.toolDescriptionSha256,
    inputSchemaSha256: serverSummary.inputSchemaSha256,
    serverToolNames: serverSummary.serverToolNames,
    serverToolCount: serverSummary.serverToolCount,
    networkMode: G01_QUERY_SUBJECTS_OFFLINE_NETWORK_MODE,
    mcpServerNames: events.mcpServerNames,
    processExitCode: events.processExitCode,
    resultStatus: 'SUCCESS',
    eventStreamParsed: events.eventStreamParsed,
    turnCompleted: events.turnCompleted,
    codexMcpToolEventCount: events.codexMcpToolEventCount,
    codexErrorItemCount: events.codexErrorItemCount,
    nonMcpToolEventCount: events.nonMcpToolEventCount,
    nonMcpToolTypes: events.nonMcpToolTypes,
    shellToolCallCount: events.shellToolCallCount,
    allowedCallCount: serverSummary.allowedCallCount,
    deniedCallCount: serverSummary.deniedCallCount,
    answerCheckMethod: G01_QUERY_SUBJECTS_OFFLINE_ANSWER_CHECK_METHOD,
    answerSha256: sha256(G01_QUERY_SUBJECTS_OFFLINE_ACKNOWLEDGEMENT),
    answerUtf8Bytes: Buffer.byteLength(G01_QUERY_SUBJECTS_OFFLINE_ACKNOWLEDGEMENT, 'utf8'),
    answerChecks: expectedAnswerChecks(),
    resultSummary: serverSummary.results[0].resultSummary,
    offlineFixture: serverSummary.offlineFixture,
    networkBoundary: expectedNetworkBoundary(),
    privacy: expectedPrivacy(),
    runnerReceipt: null,
  };
  report.runnerReceipt = createRunnerReceipt(
    buildG01QuerySubjectsOfflineRunnerReceiptPayload(report, {
      eventStreamSha256,
      serverSummarySha256,
    }),
    { publicKeyBase64: claim.runnerReceiptPublicKey, privateKey },
  );
  const validation = validateG01QuerySubjectsOfflineProfileReport(report, claim, null, root);
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
    const finalValidation = validateG01QuerySubjectsOfflineProfileReport(
      report,
      claim,
      reportBytes,
      root,
    );
    if (!finalValidation.passed) return finalValidation;
    return { passed: true, reportSha256: sha256(reportBytes), reportPath: REPORT_RELATIVE_PATH };
  } catch {
    return { passed: false, reason: 'G01_QUERY_SUBJECTS_REPORT_WRITE_FAILED' };
  }
}

export function validateG01QuerySubjectsOfflineSanitizedReportFile(
  claim,
  root = ROOT,
  reportPath = null,
) {
  if (!PROFILE || !assertG01QuerySubjectsOfflineProfile(PROFILE)) {
    return { passed: false, reason: 'G01_QUERY_SUBJECTS_PROFILE_INVALID' };
  }
  const target = reportPath ?? path.join(root, REPORT_RELATIVE_PATH);
  try {
    if (path.resolve(target) !== path.resolve(root, REPORT_RELATIVE_PATH)) {
      return { passed: false, reason: 'G01_QUERY_SUBJECTS_REPORT_PATH_INVALID' };
    }
    const bytes = readFileSync(target);
    const report = JSON.parse(bytes.toString('utf8'));
    const validation = validateG01QuerySubjectsOfflineProfileReport(report, claim, bytes, root);
    if (!validation.passed) return validation;
    return { passed: true, reportPath: REPORT_RELATIVE_PATH, reportSha256: sha256(bytes), report };
  } catch {
    return { passed: false, reason: 'G01_QUERY_SUBJECTS_REPORT_UNAVAILABLE' };
  }
}
