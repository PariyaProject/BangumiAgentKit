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
import { isValidP06CiRunEvidence as isValidProfileCiRunEvidence } from '../lib/p06-ci-run-evidence.mjs';
import {
  assertC07RenderComparisonOfflineProfile,
  C07_RENDER_COMPARISON_OFFLINE_PROFILE_ID,
  C07_RENDER_COMPARISON_OFFLINE_V3_PROFILE_ID,
  getC07RenderComparisonOfflineConfig,
} from '../lib/c07-render-comparison-offline-profile.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
let CONFIG = getC07RenderComparisonOfflineConfig(C07_RENDER_COMPARISON_OFFLINE_PROFILE_ID);
let PROFILE = getAgentMcpProfileById(CONFIG.id);
let REPORT_RELATIVE_PATH = PROFILE?.reportPath;
let REPORT_PATH = path.join(ROOT, REPORT_RELATIVE_PATH ?? 'invalid-c07-report-path');
let RECEIPT_KIND = CONFIG.receiptKind;
let ACKNOWLEDGEMENT = CONFIG.acknowledgement;

export function configureC07RenderComparisonOfflineReportProfile(profileId) {
  const config = getC07RenderComparisonOfflineConfig(profileId);
  const profile = config ? getAgentMcpProfileById(profileId) : null;
  if (!config || !profile || !assertC07RenderComparisonOfflineProfile(profile)) {
    throw new Error('C07 report writer requires an exact registered offline matrix profile.');
  }
  CONFIG = config;
  PROFILE = profile;
  REPORT_RELATIVE_PATH = profile.reportPath;
  REPORT_PATH = path.join(ROOT, REPORT_RELATIVE_PATH);
  RECEIPT_KIND = config.receiptKind;
  ACKNOWLEDGEMENT = config.acknowledgement;
}
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
  'offlineFixture',
  'offlineAssetBoundary',
  'networkBoundary',
  'artifact',
  'privacy',
  'runnerReceipt',
]);
const V3_CODEX_ERROR_FIELDS = new Set([
  'blockedDisabledWebSearchErrorItemCount',
  'unexpectedCodexErrorItemCount',
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
  'toolName',
  'argumentProfile',
  'expectedArgumentsSha256',
  'selectionEvidenceSha256',
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
  'offlineAssetBoundarySha256',
  'artifactSha256',
  'answerSha256',
  'eventStreamSha256',
  'serverSummarySha256',
]);
const V3_RECEIPT_CODEX_ERROR_FIELDS = new Set([
  'blockedDisabledWebSearchErrorItemCount',
  'unexpectedCodexErrorItemCount',
]);
const ANSWER_CHECK_FIELDS = new Set([
  'exactRegisteredProfile',
  'oneAllowedMcpTool',
  'fixedArguments',
  'exactCandidateBundle',
  'offlineFixtureOnly',
  'twoExpectedLocalResponses',
  'noAssetUrls',
  'artifactReturned',
  'exactAcknowledgement',
  'privacyPreserved',
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
const ARTIFACT_FIELDS = new Set([
  'returned',
  'persisted',
  'mimeType',
  'width',
  'height',
  'byteLength',
  'sha256',
  'pngSignatureValid',
]);
const OFFLINE_FIXTURE_FIELDS = new Set([
  'profile',
  'requestCount',
  'searchRequestCount',
  'subjectDetailRequestCount',
  'duplicateRequestCount',
  'unexpectedRequestCount',
  'authorizationHeaderCount',
  'expectedOperationsComplete',
  'rawFixturePayloadStored',
]);
const OFFLINE_ASSET_FIELDS = new Set([
  'assetResolutionCallCount',
  'nonEmptyAssetUrlCount',
  'blockedAssetRequestCount',
]);

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function canonicalSha256(value) {
  return sha256(canonicalAgentMcpProfileJson(value));
}

function exactKeys(value, fields) {
  return (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).sort().join('\0') === [...fields].sort().join('\0')
  );
}

function expectedReportFields(profileId) {
  return profileId === C07_RENDER_COMPARISON_OFFLINE_V3_PROFILE_ID
    ? new Set([...REPORT_FIELDS, ...V3_CODEX_ERROR_FIELDS])
    : REPORT_FIELDS;
}

function expectedReceiptPayloadFields(profileId) {
  return profileId === C07_RENDER_COMPARISON_OFFLINE_V3_PROFILE_ID
    ? new Set([...RECEIPT_PAYLOAD_FIELDS, ...V3_RECEIPT_CODEX_ERROR_FIELDS])
    : RECEIPT_PAYLOAD_FIELDS;
}

function codexErrorSummaryIsValid(profileId, events) {
  if (profileId !== C07_RENDER_COMPARISON_OFFLINE_V3_PROFILE_ID) {
    return events?.codexErrorItemCount === 0;
  }
  const total = events?.codexErrorItemCount;
  const blocked = events?.blockedDisabledWebSearchErrorItemCount;
  const unexpected = events?.unexpectedCodexErrorItemCount;
  return (
    Number.isSafeInteger(total) &&
    total >= 0 &&
    total <= 3 &&
    Number.isSafeInteger(blocked) &&
    blocked === total &&
    unexpected === 0
  );
}

function catalogEvidenceMatches(report) {
  try {
    const catalogBytes = readFileSync(path.join(ROOT, 'docs/tool-catalog.json'));
    const catalog = JSON.parse(catalogBytes.toString('utf8'));
    const tool = catalog.find((item) => item?.name === PROFILE?.toolName);
    return (
      tool?.auth === 'none' &&
      tool?.risk === 'read' &&
      report.catalogSha256 === sha256(catalogBytes) &&
      report.toolDescriptionSha256 === sha256(tool.description) &&
      report.inputSchemaSha256 === sha256(canonicalAgentMcpProfileJson(tool.inputSchema))
    );
  } catch {
    return false;
  }
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

export function buildC07RenderComparisonOfflineRunnerReceiptPayload(
  report,
  { eventStreamSha256, serverSummarySha256 },
) {
  if (
    !report ||
    typeof report !== 'object' ||
    !/^[0-9a-f]{64}$/u.test(eventStreamSha256 ?? '') ||
    !/^[0-9a-f]{64}$/u.test(serverSummarySha256 ?? '')
  ) {
    throw new TypeError(
      'C07 render-comparison runner receipt requires exact sanitized run inputs.',
    );
  }
  const sanitizedReport = { ...report, runnerReceipt: null };
  const payload = {
    schemaVersion: 1,
    kind: RECEIPT_KIND,
    sanitizedReportSha256: sha256(canonicalAgentMcpProfileJson(sanitizedReport)),
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
    offlineAssetBoundarySha256: canonicalSha256(report.offlineAssetBoundary),
    artifactSha256: canonicalSha256(report.artifact),
    answerSha256: report.answerSha256,
    eventStreamSha256,
    serverSummarySha256,
  };
  if (report.profileId === C07_RENDER_COMPARISON_OFFLINE_V3_PROFILE_ID) {
    payload.blockedDisabledWebSearchErrorItemCount = report.blockedDisabledWebSearchErrorItemCount;
    payload.unexpectedCodexErrorItemCount = report.unexpectedCodexErrorItemCount;
  }
  return payload;
}

function createRunnerReceipt(payload, { publicKeyBase64, privateKey }) {
  const publicKeyDer = Buffer.from(publicKeyBase64 ?? '', 'base64');
  const publicKey = createPublicKey({ key: publicKeyDer, format: 'der', type: 'spki' });
  if (
    publicKey.asymmetricKeyType !== 'ed25519' ||
    publicKeyDer.toString('base64') !== publicKeyBase64
  ) {
    throw new Error(
      'C07 render-comparison runner receipt requires a canonical Ed25519 SPKI public key.',
    );
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

export function validateC07RenderComparisonOfflineProfileReport(report, claim, reportBytes = null) {
  const config = getC07RenderComparisonOfflineConfig(claim?.profileId);
  if (config && PROFILE?.id !== config.id) {
    configureC07RenderComparisonOfflineReportProfile(config.id);
  }
  const claimStateValid =
    (claim?.state === 'CLAIMED' && claim.reportWritten === false) ||
    (claim?.state === 'REPORT_WRITTEN' &&
      claim.reportWritten === true &&
      Buffer.isBuffer(reportBytes) &&
      claim.reportSha256 === sha256(reportBytes));
  if (
    !PROFILE ||
    !assertC07RenderComparisonOfflineProfile(PROFILE) ||
    !exactKeys(report, expectedReportFields(PROFILE?.id)) ||
    !claim ||
    claim.profileId !== PROFILE.id ||
    !claimStateValid ||
    claim.retryAllowed !== false ||
    !isValidProfileCiRunEvidence({ ciRunId: report.ciRunId, ciChecks: report.ciChecks }) ||
    !matchesClaim(report, claim)
  ) {
    return { passed: false, reason: 'C07_RENDER_COMPARISON_REPORT_CLAIM_INVALID' };
  }
  const profileRegistrySha256 = agentMcpProfileRegistrySha256(PROFILE.id);
  const expectedArgumentsSha256 = agentMcpProfileArgumentsSha256(PROFILE);
  const expectedPrivacy = {
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
  const expectedCohortCount = CONFIG.cohorts.length;
  const expectedFixture = {
    profile: CONFIG.networkMode,
    requestCount: expectedCohortCount * 2,
    searchRequestCount: expectedCohortCount,
    subjectDetailRequestCount: expectedCohortCount,
    duplicateRequestCount: 0,
    unexpectedRequestCount: 0,
    authorizationHeaderCount: 0,
    expectedOperationsComplete: true,
    rawFixturePayloadStored: false,
  };
  const expectedAssetBoundary = {
    assetResolutionCallCount: 0,
    nonEmptyAssetUrlCount: 0,
    blockedAssetRequestCount: 0,
  };
  const expectedNetworkBoundary = {
    liveBangumiApiRequestCount: 0,
    rendererAssetRequestCount: 0,
    fullCodexHarnessNetworkSandboxed: false,
  };
  const artifact = report.artifact;
  const answerChecks = report.answerChecks;
  const receipt = report.runnerReceipt;

  if (
    report.schemaVersion !== 1 ||
    report.evidenceKind !== PROFILE.evidenceKind ||
    report.runNumber !== 95 ||
    report.frontierId !== 'C07' ||
    report.scenarioId !== null ||
    report.epochId !== PROFILE.epochId ||
    report.profile !== 'codex-luna-max-offline-agent-mcp-matrix-v1' ||
    report.model !== PROFILE.model ||
    report.reasoningEffort !== PROFILE.reasoningEffort ||
    !/^gpt-6-luna-max-run95-pr\d+-round[1-9]\d*$/u.test(report.reviewerId ?? '') ||
    !/^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/u.test(report.codexCliVersion ?? '') ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(report.observedAt ?? '') ||
    report.registrySha256 !== profileRegistrySha256 ||
    !/^[0-9a-f]{64}$/u.test(report.selectionEvidenceSha256 ?? '') ||
    !catalogEvidenceMatches(report) ||
    report.toolName !== PROFILE.toolName ||
    report.argumentProfile !== PROFILE.argumentProfile ||
    report.expectedArgumentsSha256 !== expectedArgumentsSha256 ||
    report.networkMode !== CONFIG.networkMode ||
    report.serverToolNames?.length !== 1 ||
    report.serverToolNames[0] !== PROFILE.toolName ||
    report.serverToolCount !== 1 ||
    report.mcpServerNames?.length !== 1 ||
    report.mcpServerNames[0] !== 'bgk_c07_render_comparison' ||
    report.processExitCode !== 0 ||
    report.resultStatus !== 'SUCCESS' ||
    report.eventStreamParsed !== true ||
    report.turnCompleted !== true ||
    report.codexMcpToolEventCount !== 1 ||
    !codexErrorSummaryIsValid(PROFILE.id, report) ||
    report.nonMcpToolEventCount !== 0 ||
    !Array.isArray(report.nonMcpToolTypes) ||
    report.nonMcpToolTypes.length !== 0 ||
    report.shellToolCallCount !== 0 ||
    report.allowedCallCount !== 1 ||
    report.deniedCallCount !== 0 ||
    report.answerCheckMethod !== PROFILE.answerCheckMethod ||
    report.answerSha256 !== sha256(ACKNOWLEDGEMENT) ||
    report.answerUtf8Bytes !== Buffer.byteLength(ACKNOWLEDGEMENT, 'utf8') ||
    !exactKeys(report.offlineFixture, OFFLINE_FIXTURE_FIELDS) ||
    canonicalAgentMcpProfileJson(report.offlineFixture) !==
      canonicalAgentMcpProfileJson(expectedFixture) ||
    !exactKeys(report.offlineAssetBoundary, OFFLINE_ASSET_FIELDS) ||
    canonicalAgentMcpProfileJson(report.offlineAssetBoundary) !==
      canonicalAgentMcpProfileJson(expectedAssetBoundary) ||
    !exactKeys(report.networkBoundary, new Set(Object.keys(expectedNetworkBoundary))) ||
    canonicalAgentMcpProfileJson(report.networkBoundary) !==
      canonicalAgentMcpProfileJson(expectedNetworkBoundary) ||
    !exactKeys(artifact, ARTIFACT_FIELDS) ||
    artifact.returned !== true ||
    artifact.persisted !== false ||
    artifact.mimeType !== 'image/png' ||
    !Number.isInteger(artifact.width) ||
    artifact.width < 1 ||
    artifact.width > 3000 ||
    !Number.isInteger(artifact.height) ||
    artifact.height < 1 ||
    artifact.height > 5000 ||
    artifact.width * artifact.height > 10_000_000 ||
    !Number.isInteger(artifact.byteLength) ||
    artifact.byteLength < 1 ||
    artifact.byteLength > 5_000_000 ||
    !/^[0-9a-f]{64}$/u.test(artifact.sha256 ?? '') ||
    artifact.pngSignatureValid !== true ||
    !exactKeys(answerChecks, ANSWER_CHECK_FIELDS) ||
    Object.values(answerChecks).some((value) => value !== true) ||
    !exactKeys(report.privacy, PRIVACY_FIELDS) ||
    canonicalAgentMcpProfileJson(report.privacy) !==
      canonicalAgentMcpProfileJson(expectedPrivacy) ||
    !exactKeys(report.runnerReceipt, RECEIPT_FIELDS) ||
    !exactKeys(receipt.payload, expectedReceiptPayloadFields(PROFILE.id))
  ) {
    return { passed: false, reason: 'C07_RENDER_COMPARISON_REPORT_FIELDS_INVALID' };
  }

  const publicKeyBase64 = claim.runnerReceiptPublicKey;
  const publicKeySha256 = claim.runnerReceiptPublicKeySha256;
  let signatureValid = false;
  try {
    const publicKeyDer = Buffer.from(receipt.publicKeyBase64, 'base64');
    const publicKey = createPublicKey({ key: publicKeyDer, format: 'der', type: 'spki' });
    const payload = buildC07RenderComparisonOfflineRunnerReceiptPayload(report, {
      eventStreamSha256: receipt.payload.eventStreamSha256,
      serverSummarySha256: receipt.payload.serverSummarySha256,
    });
    signatureValid =
      receipt.schemaVersion === 1 &&
      receipt.kind === RECEIPT_KIND &&
      receipt.payload.schemaVersion === 1 &&
      receipt.payload.kind === RECEIPT_KIND &&
      receipt.publicKeyBase64 === publicKeyBase64 &&
      receipt.publicKeySha256 === publicKeySha256 &&
      publicKey.asymmetricKeyType === 'ed25519' &&
      sha256(publicKeyDer) === publicKeySha256 &&
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
  if (!signatureValid)
    return { passed: false, reason: 'C07_RENDER_COMPARISON_RUNNER_RECEIPT_INVALID' };

  if (reportBytes && reportBytes.length > 64 * 1024) {
    return { passed: false, reason: 'C07_RENDER_COMPARISON_REPORT_TOO_LARGE' };
  }
  return { passed: true, reportPath: REPORT_RELATIVE_PATH };
}

export function buildC07RenderComparisonOfflineProfileReport(
  {
    claim,
    serverSummary,
    events,
    completedMcpCalls,
    answer,
    codexCliVersion,
    eventStreamSha256,
    serverSummarySha256,
  },
  { privateKey } = {},
) {
  const config = getC07RenderComparisonOfflineConfig(claim?.profileId);
  if (config && PROFILE?.id !== config.id) {
    configureC07RenderComparisonOfflineReportProfile(config.id);
  }
  if (
    !PROFILE ||
    !assertC07RenderComparisonOfflineProfile(PROFILE) ||
    claim?.profileId !== PROFILE.id ||
    claim.state !== 'CLAIMED' ||
    claim.retryAllowed !== false ||
    !isValidProfileCiRunEvidence({ ciRunId: claim.ciRunId, ciChecks: claim.ciChecks }) ||
    !serverSummary ||
    !events ||
    !Array.isArray(completedMcpCalls) ||
    completedMcpCalls.length !== 1 ||
    completedMcpCalls[0]?.tool !== PROFILE.toolName ||
    canonicalAgentMcpProfileJson(completedMcpCalls[0]?.arguments) !==
      canonicalAgentMcpProfileJson(PROFILE.calls[0].arguments) ||
    events.processExitCode !== 0 ||
    events.eventStreamParsed !== true ||
    events.turnCompleted !== true ||
    events.codexMcpToolEventCount !== 1 ||
    events.mcpToolErrorResultCount !== 0 ||
    !codexErrorSummaryIsValid(PROFILE.id, events) ||
    events.nonMcpToolEventCount !== 0 ||
    events.shellToolCallCount !== 0 ||
    events.allowedCallCount !== 1 ||
    events.deniedCallCount !== 0 ||
    events.mcpServerNames?.length !== 1 ||
    events.mcpServerNames[0] !== 'bgk_c07_render_comparison' ||
    serverSummary.profileId !== PROFILE.id ||
    serverSummary.serverProfile !== 'closed-profile-sequence-anonymous-offline-v1' ||
    serverSummary.networkMode !== CONFIG.networkMode ||
    serverSummary.sourceRevision !== claim.sourceCandidateSha ||
    serverSummary.bundleSha256 !== claim.bundleSha256 ||
    serverSummary.toolName !== PROFILE.toolName ||
    serverSummary.serverToolCount !== 1 ||
    canonicalAgentMcpProfileJson(serverSummary.serverToolNames) !==
      canonicalAgentMcpProfileJson([PROFILE.toolName]) ||
    serverSummary.expectedCallCount !== 1 ||
    serverSummary.expectedArgumentsSha256 !== claim.expectedArgumentsSha256 ||
    serverSummary.argumentMatch !== true ||
    serverSummary.serverResultStatus !== 'SUCCESS' ||
    serverSummary.allowedCallCount !== 1 ||
    serverSummary.deniedCallCount !== 0 ||
    !Array.isArray(serverSummary.results) ||
    serverSummary.results.length !== 1 ||
    serverSummary.results[0]?.sequenceIndex !== 0 ||
    serverSummary.results[0]?.status !== 'SUCCESS' ||
    serverSummary.results[0]?.resultSummary?.resultState !== 'artifact_returned' ||
    !exactKeys(serverSummary.offlineFixture, OFFLINE_FIXTURE_FIELDS) ||
    !exactKeys(serverSummary.offlineAssetBoundary, OFFLINE_ASSET_FIELDS) ||
    answer !== ACKNOWLEDGEMENT ||
    typeof privateKey === 'undefined' ||
    !/^[0-9a-f]{64}$/u.test(eventStreamSha256 ?? '') ||
    !/^[0-9a-f]{64}$/u.test(serverSummarySha256 ?? '')
  ) {
    return { passed: false, reason: 'C07_RENDER_COMPARISON_RUNNER_GATE_INVALID' };
  }

  const resultSummary = serverSummary.results[0].resultSummary;
  const selectionEvidenceBytes = readFileSync(path.join(ROOT, PROFILE.selectionEvidencePath));
  const report = {
    schemaVersion: 1,
    evidenceKind: PROFILE.evidenceKind,
    runNumber: claim.runNumber,
    frontierId: PROFILE.frontierId,
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
    selectionEvidenceSha256: sha256(selectionEvidenceBytes),
    toolName: PROFILE.toolName,
    argumentProfile: PROFILE.argumentProfile,
    expectedArgumentsSha256: claim.expectedArgumentsSha256,
    catalogSha256: serverSummary.catalogSha256,
    toolDescriptionSha256: serverSummary.toolDescriptionSha256,
    inputSchemaSha256: serverSummary.inputSchemaSha256,
    serverToolNames: serverSummary.serverToolNames,
    serverToolCount: serverSummary.serverToolCount,
    networkMode: CONFIG.networkMode,
    mcpServerNames: events.mcpServerNames,
    processExitCode: events.processExitCode,
    resultStatus: serverSummary.serverResultStatus,
    eventStreamParsed: events.eventStreamParsed,
    turnCompleted: events.turnCompleted,
    codexMcpToolEventCount: events.codexMcpToolEventCount,
    codexErrorItemCount: events.codexErrorItemCount,
    ...(PROFILE.id === C07_RENDER_COMPARISON_OFFLINE_V3_PROFILE_ID
      ? {
          blockedDisabledWebSearchErrorItemCount: events.blockedDisabledWebSearchErrorItemCount,
          unexpectedCodexErrorItemCount: events.unexpectedCodexErrorItemCount,
        }
      : {}),
    nonMcpToolEventCount: events.nonMcpToolEventCount,
    nonMcpToolTypes: events.nonMcpToolTypes,
    shellToolCallCount: events.shellToolCallCount,
    allowedCallCount: serverSummary.allowedCallCount,
    deniedCallCount: serverSummary.deniedCallCount,
    answerCheckMethod: PROFILE.answerCheckMethod,
    answerSha256: sha256(answer),
    answerUtf8Bytes: Buffer.byteLength(answer, 'utf8'),
    answerChecks: {
      exactRegisteredProfile: true,
      oneAllowedMcpTool: true,
      fixedArguments: true,
      exactCandidateBundle: true,
      offlineFixtureOnly: true,
      twoExpectedLocalResponses: true,
      noAssetUrls: true,
      artifactReturned: true,
      exactAcknowledgement: true,
      privacyPreserved: true,
    },
    offlineFixture: serverSummary.offlineFixture,
    offlineAssetBoundary: serverSummary.offlineAssetBoundary,
    networkBoundary: {
      liveBangumiApiRequestCount: 0,
      rendererAssetRequestCount: 0,
      fullCodexHarnessNetworkSandboxed: false,
    },
    artifact: {
      returned: resultSummary.artifact?.returned,
      persisted: resultSummary.artifact?.persisted,
      mimeType: resultSummary.artifact?.mimeType,
      width: resultSummary.artifact?.width,
      height: resultSummary.artifact?.height,
      byteLength: resultSummary.artifact?.byteLength,
      sha256: resultSummary.artifact?.sha256,
      pngSignatureValid: resultSummary.artifact?.pngSignatureValid,
    },
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
      rawFixtureRowsStored: false,
      rawToolResultStored: false,
      artifactImageBytesStored: false,
      credentialsStored: false,
    },
    runnerReceipt: null,
  };
  report.runnerReceipt = createRunnerReceipt(
    buildC07RenderComparisonOfflineRunnerReceiptPayload(report, {
      eventStreamSha256,
      serverSummarySha256,
    }),
    { publicKeyBase64: claim.runnerReceiptPublicKey, privateKey },
  );
  const validation = validateC07RenderComparisonOfflineProfileReport(report, claim);
  if (!validation.passed) return validation;
  return { passed: true, report };
}

export function writeC07RenderComparisonOfflineProfileReport(input, options = {}) {
  const built = buildC07RenderComparisonOfflineProfileReport(input, options);
  if (!built.passed) return built;
  const report = built.report;
  const bytes = Buffer.from(`${JSON.stringify(report, null, 2)}\n`, 'utf8');
  if (bytes.length > 64 * 1024)
    return { passed: false, reason: 'C07_RENDER_COMPARISON_REPORT_TOO_LARGE' };
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
    return { passed: false, reason: 'C07_RENDER_COMPARISON_REPORT_ALREADY_EXISTS_OR_UNWRITABLE' };
  }
  return {
    passed: true,
    reportPath: REPORT_RELATIVE_PATH,
    reportSha256: sha256(bytes),
  };
}

export function validateC07RenderComparisonOfflineSanitizedReportFile(
  claim,
  root = ROOT,
  reportPath = null,
) {
  const config = getC07RenderComparisonOfflineConfig(claim?.profileId);
  if (config) configureC07RenderComparisonOfflineReportProfile(config.id);
  if (!PROFILE || !claim || claim.profileId !== PROFILE.id) {
    return { passed: false, reason: 'C07_RENDER_COMPARISON_CLAIM_INVALID' };
  }
  const absolutePath = reportPath ?? path.join(root, REPORT_RELATIVE_PATH);
  try {
    const relativePath = path.resolve(absolutePath).replace(`${path.resolve(root)}${path.sep}`, '');
    const reportBytes = readFileSync(absolutePath);
    if (relativePath !== REPORT_RELATIVE_PATH) {
      return { passed: false, reason: 'C07_RENDER_COMPARISON_REPORT_PATH_INVALID' };
    }
    const report = JSON.parse(reportBytes.toString('utf8'));
    const validation = validateC07RenderComparisonOfflineProfileReport(report, claim, reportBytes);
    return validation.passed
      ? { ...validation, reportPath: relativePath, reportSha256: sha256(reportBytes), report }
      : validation;
  } catch {
    return { passed: false, reason: 'C07_RENDER_COMPARISON_REPORT_UNREADABLE' };
  }
}
