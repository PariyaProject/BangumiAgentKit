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
  assertRenderSubjectCardOfflineProfile,
  RENDER_SUBJECT_CARD_COMPACT_TYPOGRAPHY_V2_PROFILE_ID,
} from '../lib/render-subject-card-offline-profile.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PROFILE = getAgentMcpProfileById(RENDER_SUBJECT_CARD_COMPACT_TYPOGRAPHY_V2_PROFILE_ID);
const REPORT_PATH = PROFILE ? path.join(ROOT, PROFILE.reportPath) : null;
const SERVER_ID = 'bgk_render_subject_card_offline';
const ACKNOWLEDGEMENT = 'RENDER_SUBJECT_CARD_SYNTHETIC_ARTIFACT_READY';
const RECEIPT_KIND = 'render-subject-card-offline-agent-mcp-runner-receipt-v1';

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
  'toolName',
  'argumentProfile',
  'expectedArgumentsSha256',
  'selectionEvidenceSha256',
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
const ANSWER_CHECK_FIELDS = new Set([
  'exactRegisteredProfile',
  'oneAllowedMcpTool',
  'fixedArguments',
  'exactCandidateBundle',
  'offlineFixtureOnly',
  'noAuthorizationOrCollection',
  'noAssetResolution',
  'artifactReturned',
  'exactAcknowledgement',
  'privacyPreserved',
]);
const FIXTURE_FIELDS = new Set([
  'profile',
  'expectedOperation',
  'requestCount',
  'expectedRequestCount',
  'unexpectedRequestCount',
  'authorizationHeaderCount',
  'collectionRequestCount',
  'expectedOperationComplete',
  'rawFixturePayloadStored',
]);
const ASSET_FIELDS = new Set([
  'assetResolutionCallCount',
  'nonEmptyAssetUrlCount',
  'blockedAssetRequestCount',
  'localFallbackUsed',
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

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const canonicalSha256 = (value) => sha256(canonicalAgentMcpProfileJson(value));

function exactKeys(value, fields) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).sort().join('\0') === [...fields].sort().join('\0'),
  );
}

function getProfile(profileId = RENDER_SUBJECT_CARD_COMPACT_TYPOGRAPHY_V2_PROFILE_ID) {
  const profile = getAgentMcpProfileById(profileId);
  if (!profile || !assertRenderSubjectCardOfflineProfile(profile)) return null;
  return profile;
}

function matchesClaim(report, claim) {
  return Boolean(
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
    report.expectedArgumentsSha256 === claim.expectedArgumentsSha256,
  );
}

function catalogEvidenceMatches(report, profile) {
  try {
    const catalogBytes = readFileSync(path.join(ROOT, 'docs/tool-catalog.json'));
    const catalog = JSON.parse(catalogBytes.toString('utf8'));
    const tool = catalog.find((item) => item?.name === profile.toolName);
    return Boolean(
      tool?.auth === 'optional' &&
      tool?.risk === 'read' &&
      report.catalogSha256 === sha256(catalogBytes) &&
      report.toolDescriptionSha256 === sha256(tool.description) &&
      report.inputSchemaSha256 === sha256(canonicalAgentMcpProfileJson(tool.inputSchema)),
    );
  } catch {
    return false;
  }
}

export function buildRenderSubjectCardOfflineRunnerReceiptPayload(
  report,
  { eventStreamSha256, serverSummarySha256 },
) {
  if (
    !report ||
    typeof report !== 'object' ||
    !/^[0-9a-f]{64}$/u.test(eventStreamSha256 ?? '') ||
    !/^[0-9a-f]{64}$/u.test(serverSummarySha256 ?? '')
  ) {
    throw new TypeError('Render subject-card receipt requires exact sanitized run inputs.');
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
    toolName: report.toolName,
    argumentProfile: report.argumentProfile,
    expectedArgumentsSha256: report.expectedArgumentsSha256,
    selectionEvidenceSha256: report.selectionEvidenceSha256,
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
}

function createRunnerReceipt(payload, { publicKeyBase64, privateKey }) {
  const publicKeyDer = Buffer.from(publicKeyBase64 ?? '', 'base64');
  const publicKey = createPublicKey({ key: publicKeyDer, format: 'der', type: 'spki' });
  if (
    publicKey.asymmetricKeyType !== 'ed25519' ||
    publicKeyDer.toString('base64') !== publicKeyBase64
  ) {
    throw new Error('Render subject-card receipt requires canonical Ed25519 SPKI.');
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

export function validateRenderSubjectCardOfflineProfileReport(report, claim, reportBytes = null) {
  const profile = getProfile(claim?.profileId ?? report?.profileId);
  const claimStateValid =
    (claim?.state === 'CLAIMED' && claim.reportWritten === false) ||
    (claim?.state === 'REPORT_WRITTEN' &&
      claim.reportWritten === true &&
      Buffer.isBuffer(reportBytes) &&
      claim.reportSha256 === sha256(reportBytes));
  if (
    !profile ||
    !exactKeys(report, REPORT_FIELDS) ||
    !claim ||
    claim.profileId !== profile.id ||
    !claimStateValid ||
    claim.retryAllowed !== false ||
    !isValidP06CiRunEvidence({ ciRunId: report.ciRunId, ciChecks: report.ciChecks }) ||
    !matchesClaim(report, claim)
  )
    return { passed: false, reason: 'RENDER_SUBJECT_CARD_REPORT_CLAIM_INVALID' };

  const expectedFixture = {
    profile: profile.networkMode,
    expectedOperation: `GET /v0/subjects/${profile.calls[0].arguments.subjectId}`,
    requestCount: 1,
    expectedRequestCount: 1,
    unexpectedRequestCount: 0,
    authorizationHeaderCount: 0,
    collectionRequestCount: 0,
    expectedOperationComplete: true,
    rawFixturePayloadStored: false,
  };
  const expectedAssetBoundary = {
    assetResolutionCallCount: 0,
    nonEmptyAssetUrlCount: 0,
    blockedAssetRequestCount: 0,
    localFallbackUsed: true,
  };
  const expectedNetworkBoundary = {
    liveBangumiApiRequestCount: 0,
    rendererAssetRequestCount: 0,
    fullCodexHarnessNetworkSandboxed: false,
  };
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
  const artifact = report.artifact;
  const receipt = report.runnerReceipt;
  if (
    report.schemaVersion !== 1 ||
    report.evidenceKind !== profile.evidenceKind ||
    report.runNumber !== 95 ||
    report.frontierId !== 'OP-008' ||
    report.scenarioId !== null ||
    report.epochId !== profile.epochId ||
    report.profile !== 'codex-luna-max-offline-agent-mcp-matrix-v2' ||
    report.model !== 'gpt-6-luna' ||
    report.reasoningEffort !== 'max' ||
    !/^gpt-6-luna-max-run95-pr\d+-round[1-9]\d*$/u.test(report.reviewerId ?? '') ||
    !/^[0-9a-f]{40}$/u.test(report.sourceRevision ?? '') ||
    !/^[0-9a-f]{40}$/u.test(report.baseSha ?? '') ||
    !/^profile-run-95-pr-\d+-[0-9a-f]{12}-\d+$/u.test(report.claimId ?? '') ||
    !/^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/u.test(report.codexCliVersion ?? '') ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(report.observedAt ?? '') ||
    report.registrySha256 !== agentMcpProfileRegistrySha256(profile.id) ||
    report.expectedArgumentsSha256 !== agentMcpProfileArgumentsSha256(profile) ||
    !/^[0-9a-f]{64}$/u.test(report.selectionEvidenceSha256 ?? '') ||
    !catalogEvidenceMatches(report, profile) ||
    report.toolName !== profile.toolName ||
    report.argumentProfile !== profile.argumentProfile ||
    report.networkMode !== profile.networkMode ||
    canonicalAgentMcpProfileJson(report.serverToolNames) !==
      canonicalAgentMcpProfileJson([profile.toolName]) ||
    report.serverToolCount !== 1 ||
    canonicalAgentMcpProfileJson(report.mcpServerNames) !==
      canonicalAgentMcpProfileJson([SERVER_ID]) ||
    report.processExitCode !== 0 ||
    report.resultStatus !== 'SUCCESS' ||
    report.eventStreamParsed !== true ||
    report.turnCompleted !== true ||
    report.codexMcpToolEventCount !== 1 ||
    report.codexErrorItemCount !== 0 ||
    report.nonMcpToolEventCount !== 0 ||
    report.nonMcpToolTypes?.length !== 0 ||
    report.shellToolCallCount !== 0 ||
    report.allowedCallCount !== 1 ||
    report.deniedCallCount !== 0 ||
    report.answerCheckMethod !== profile.answerCheckMethod ||
    report.answerSha256 !== sha256(ACKNOWLEDGEMENT) ||
    report.answerUtf8Bytes !== Buffer.byteLength(ACKNOWLEDGEMENT, 'utf8') ||
    report.answerUtf8Bytes > profile.maxAnswerBytes ||
    !exactKeys(report.offlineFixture, FIXTURE_FIELDS) ||
    canonicalAgentMcpProfileJson(report.offlineFixture) !==
      canonicalAgentMcpProfileJson(expectedFixture) ||
    !exactKeys(report.offlineAssetBoundary, ASSET_FIELDS) ||
    canonicalAgentMcpProfileJson(report.offlineAssetBoundary) !==
      canonicalAgentMcpProfileJson(expectedAssetBoundary) ||
    !exactKeys(report.networkBoundary, new Set(Object.keys(expectedNetworkBoundary))) ||
    canonicalAgentMcpProfileJson(report.networkBoundary) !==
      canonicalAgentMcpProfileJson(expectedNetworkBoundary) ||
    !exactKeys(artifact, ARTIFACT_FIELDS) ||
    artifact.returned !== true ||
    artifact.persisted !== false ||
    artifact.mimeType !== 'image/png' ||
    artifact.width !== 720 ||
    !Number.isInteger(artifact.height) ||
    artifact.height < 1 ||
    artifact.height > 5000 ||
    !Number.isInteger(artifact.byteLength) ||
    artifact.byteLength < 1 ||
    artifact.byteLength > 5_000_000 ||
    !/^[0-9a-f]{64}$/u.test(artifact.sha256 ?? '') ||
    artifact.pngSignatureValid !== true ||
    !exactKeys(report.answerChecks, ANSWER_CHECK_FIELDS) ||
    Object.values(report.answerChecks).some((value) => value !== true) ||
    !exactKeys(report.privacy, PRIVACY_FIELDS) ||
    canonicalAgentMcpProfileJson(report.privacy) !==
      canonicalAgentMcpProfileJson(expectedPrivacy) ||
    !exactKeys(receipt, RECEIPT_FIELDS) ||
    !exactKeys(receipt.payload, RECEIPT_PAYLOAD_FIELDS)
  )
    return { passed: false, reason: 'RENDER_SUBJECT_CARD_REPORT_FIELDS_INVALID' };

  const publicKeyBase64 = claim.runnerReceiptPublicKey;
  let signatureValid = false;
  try {
    const publicKeyDer = Buffer.from(receipt.publicKeyBase64, 'base64');
    const publicKey = createPublicKey({ key: publicKeyDer, format: 'der', type: 'spki' });
    const payload = buildRenderSubjectCardOfflineRunnerReceiptPayload(report, {
      eventStreamSha256: receipt.payload.eventStreamSha256,
      serverSummarySha256: receipt.payload.serverSummarySha256,
    });
    signatureValid =
      receipt.schemaVersion === 1 &&
      receipt.kind === RECEIPT_KIND &&
      receipt.payload.schemaVersion === 1 &&
      receipt.payload.kind === RECEIPT_KIND &&
      receipt.publicKeyBase64 === publicKeyBase64 &&
      receipt.publicKeySha256 === claim.runnerReceiptPublicKeySha256 &&
      publicKey.asymmetricKeyType === 'ed25519' &&
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
  if (!signatureValid)
    return { passed: false, reason: 'RENDER_SUBJECT_CARD_RUNNER_RECEIPT_INVALID' };
  if (reportBytes && reportBytes.length > 64 * 1024) {
    return { passed: false, reason: 'RENDER_SUBJECT_CARD_REPORT_TOO_LARGE' };
  }
  return { passed: true, reportPath: profile.reportPath };
}

export function buildRenderSubjectCardOfflineProfileReport(
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
  const profile = getProfile(claim?.profileId);
  const fixture = serverSummary?.offlineFixture;
  const assetBoundary = serverSummary?.offlineAssetBoundary;
  const result = serverSummary?.results?.[0];
  const artifactSummary = result?.resultSummary?.artifact;
  const expectedArguments = profile.calls[0].arguments;
  const valid =
    profile &&
    claim?.state === 'CLAIMED' &&
    claim.retryAllowed === false &&
    isValidP06CiRunEvidence({ ciRunId: claim.ciRunId, ciChecks: claim.ciChecks }) &&
    serverSummary?.serverProfile === 'closed-profile-sequence-anonymous-offline-v1' &&
    serverSummary.profileId === profile.id &&
    serverSummary.argumentProfile === profile.argumentProfile &&
    serverSummary.networkMode === profile.networkMode &&
    serverSummary.sourceRevision === claim.sourceCandidateSha &&
    serverSummary.bundleSha256 === claim.bundleSha256 &&
    serverSummary.toolName === profile.toolName &&
    serverSummary.serverToolCount === 1 &&
    canonicalAgentMcpProfileJson(serverSummary.serverToolNames) ===
      canonicalAgentMcpProfileJson([profile.toolName]) &&
    serverSummary.expectedCallCount === 1 &&
    serverSummary.expectedArgumentsSha256 === claim.expectedArgumentsSha256 &&
    serverSummary.argumentMatch === true &&
    serverSummary.serverResultStatus === 'SUCCESS' &&
    serverSummary.allowedCallCount === 1 &&
    serverSummary.deniedCallCount === 0 &&
    result?.sequenceIndex === 0 &&
    result.status === 'SUCCESS' &&
    exactKeys(result.resultSummary, new Set(['resultState', 'artifact'])) &&
    result.resultSummary?.resultState === 'artifact_returned' &&
    exactKeys(
      artifactSummary,
      new Set([
        'returned',
        'persisted',
        'mimeType',
        'width',
        'height',
        'byteLength',
        'sha256',
        'pngSignatureValid',
        'decoded',
        'dimensionsMatch',
      ]),
    ) &&
    artifactSummary?.returned === true &&
    artifactSummary.persisted === false &&
    artifactSummary.mimeType === 'image/png' &&
    artifactSummary.width === 720 &&
    Number.isInteger(artifactSummary.height) &&
    artifactSummary.height > 0 &&
    Number.isInteger(artifactSummary.byteLength) &&
    artifactSummary.byteLength > 0 &&
    /^[0-9a-f]{64}$/u.test(artifactSummary.sha256 ?? '') &&
    artifactSummary.pngSignatureValid === true &&
    artifactSummary.decoded === true &&
    artifactSummary.dimensionsMatch === true &&
    canonicalAgentMcpProfileJson(fixture) ===
      canonicalAgentMcpProfileJson({
        profile: profile.networkMode,
        expectedOperation: `GET /v0/subjects/${profile.calls[0].arguments.subjectId}`,
        requestCount: 1,
        expectedRequestCount: 1,
        unexpectedRequestCount: 0,
        authorizationHeaderCount: 0,
        collectionRequestCount: 0,
        expectedOperationComplete: true,
        rawFixturePayloadStored: false,
      }) &&
    canonicalAgentMcpProfileJson(assetBoundary) ===
      canonicalAgentMcpProfileJson({
        assetResolutionCallCount: 0,
        nonEmptyAssetUrlCount: 0,
        blockedAssetRequestCount: 0,
        localFallbackUsed: true,
      }) &&
    Array.isArray(completedMcpCalls) &&
    completedMcpCalls.length === 1 &&
    completedMcpCalls[0]?.tool === profile.toolName &&
    canonicalAgentMcpProfileJson(completedMcpCalls[0]?.arguments) ===
      canonicalAgentMcpProfileJson(expectedArguments) &&
    events?.processExitCode === 0 &&
    events.eventStreamParsed === true &&
    events.turnCompleted === true &&
    events.codexMcpToolEventCount === 1 &&
    events.codexErrorItemCount === 0 &&
    events.nonMcpToolEventCount === 0 &&
    events.nonMcpToolTypes?.length === 0 &&
    events.shellToolCallCount === 0 &&
    canonicalAgentMcpProfileJson(events.mcpServerNames) ===
      canonicalAgentMcpProfileJson([SERVER_ID]) &&
    answer === ACKNOWLEDGEMENT &&
    typeof privateKey !== 'undefined' &&
    /^[0-9a-f]{64}$/u.test(eventStreamSha256 ?? '') &&
    /^[0-9a-f]{64}$/u.test(serverSummarySha256 ?? '');
  if (!valid) return { passed: false, reason: 'RENDER_SUBJECT_CARD_RUNNER_GATE_INVALID' };

  const selectionBytes = readFileSync(path.join(ROOT, profile.selectionEvidencePath));
  const catalogBytes = readFileSync(path.join(ROOT, 'docs/tool-catalog.json'));
  const catalog = JSON.parse(catalogBytes.toString('utf8'));
  const catalogTool = catalog.find((item) => item?.name === profile.toolName);
  const report = {
    schemaVersion: 1,
    evidenceKind: profile.evidenceKind,
    runNumber: claim.runNumber,
    frontierId: profile.frontierId,
    scenarioId: null,
    epochId: profile.epochId,
    profileId: profile.id,
    profile: 'codex-luna-max-offline-agent-mcp-matrix-v2',
    model: profile.model,
    reasoningEffort: profile.reasoningEffort,
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
    toolName: profile.toolName,
    argumentProfile: profile.argumentProfile,
    expectedArgumentsSha256: claim.expectedArgumentsSha256,
    selectionEvidenceSha256: sha256(selectionBytes),
    catalogSha256: sha256(catalogBytes),
    toolDescriptionSha256: sha256(catalogTool.description),
    inputSchemaSha256: sha256(canonicalAgentMcpProfileJson(catalogTool.inputSchema)),
    serverToolNames: serverSummary.serverToolNames,
    serverToolCount: serverSummary.serverToolCount,
    networkMode: profile.networkMode,
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
    answerCheckMethod: profile.answerCheckMethod,
    answerSha256: sha256(answer),
    answerUtf8Bytes: Buffer.byteLength(answer, 'utf8'),
    answerChecks: Object.fromEntries([...ANSWER_CHECK_FIELDS].map((key) => [key, true])),
    offlineFixture: fixture,
    offlineAssetBoundary: assetBoundary,
    networkBoundary: {
      liveBangumiApiRequestCount: 0,
      rendererAssetRequestCount: 0,
      fullCodexHarnessNetworkSandboxed: false,
    },
    artifact: Object.fromEntries([...ARTIFACT_FIELDS].map((key) => [key, artifactSummary[key]])),
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
    buildRenderSubjectCardOfflineRunnerReceiptPayload(report, {
      eventStreamSha256,
      serverSummarySha256,
    }),
    { publicKeyBase64: claim.runnerReceiptPublicKey, privateKey },
  );
  const validation = validateRenderSubjectCardOfflineProfileReport(report, claim);
  return validation.passed ? { passed: true, report } : validation;
}

export function writeRenderSubjectCardOfflineProfileReport(input, options = {}) {
  const built = buildRenderSubjectCardOfflineProfileReport(input, options);
  if (!built.passed || !PROFILE || !REPORT_PATH) return built;
  const bytes = Buffer.from(`${JSON.stringify(built.report, null, 2)}\n`, 'utf8');
  if (bytes.length > 64 * 1024)
    return { passed: false, reason: 'RENDER_SUBJECT_CARD_REPORT_TOO_LARGE' };
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
        /* Keep create-only refusal. */
      }
    }
    return { passed: false, reason: 'RENDER_SUBJECT_CARD_REPORT_ALREADY_EXISTS_OR_UNWRITABLE' };
  }
  return { passed: true, reportPath: PROFILE.reportPath, reportSha256: sha256(bytes) };
}

export function validateRenderSubjectCardOfflineSanitizedReportFile(
  claim,
  root = ROOT,
  reportPath = null,
) {
  const profile = getProfile(claim?.profileId);
  if (!profile || !claim) return { passed: false, reason: 'RENDER_SUBJECT_CARD_CLAIM_INVALID' };
  const rootPath = path.resolve(root);
  const absolutePath = path.resolve(reportPath ?? path.join(rootPath, profile.reportPath));
  try {
    const relativePath = path.relative(rootPath, absolutePath).split(path.sep).join('/');
    if (relativePath !== profile.reportPath || relativePath.startsWith('../')) {
      return { passed: false, reason: 'RENDER_SUBJECT_CARD_REPORT_PATH_INVALID' };
    }
    const reportBytes = readFileSync(absolutePath);
    const report = JSON.parse(reportBytes.toString('utf8'));
    const validation = validateRenderSubjectCardOfflineProfileReport(report, claim, reportBytes);
    return validation.passed
      ? { ...validation, reportPath: relativePath, reportSha256: sha256(reportBytes), report }
      : validation;
  } catch {
    return { passed: false, reason: 'RENDER_SUBJECT_CARD_REPORT_UNREADABLE' };
  }
}
