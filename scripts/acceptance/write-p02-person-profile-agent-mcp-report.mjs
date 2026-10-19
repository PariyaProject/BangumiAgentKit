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
  assertP02PersonProfileOfflineProfile,
  getP02PersonProfileOfflineSpec,
} from '../lib/p02-person-profile-offline-fixture.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
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
  'threeExpectedLocalResponses',
  'noAssetRequests',
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
const OFFLINE_FIXTURE_FIELDS = new Set([
  'profile',
  'requestCount',
  'personRequestCount',
  'subjectsRequestCount',
  'charactersRequestCount',
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

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const canonicalSha256 = (value) => sha256(canonicalAgentMcpProfileJson(value));

function exactKeys(value, fields) {
  return (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).sort().join('\0') === [...fields].sort().join('\0')
  );
}

function profileContext(profileId) {
  const profile = getAgentMcpProfileById(profileId);
  const spec = getP02PersonProfileOfflineSpec(profileId);
  return profile && spec && assertP02PersonProfileOfflineProfile(profile)
    ? { profile, spec }
    : null;
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

function expectedFixture(profileId) {
  const spec = getP02PersonProfileOfflineSpec(profileId);
  return {
    profile: spec?.networkMode,
    requestCount: 3,
    personRequestCount: 1,
    subjectsRequestCount: 1,
    charactersRequestCount: 1,
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

function catalogEvidenceMatches(report, profile) {
  try {
    const catalogBytes = readFileSync(path.join(ROOT, 'docs/tool-catalog.json'));
    const catalog = JSON.parse(catalogBytes.toString('utf8'));
    const tool = catalog.find((item) => item?.name === profile.toolName);
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

export function buildP02RunnerReceiptPayload(report, { eventStreamSha256, serverSummarySha256 }) {
  const spec = getP02PersonProfileOfflineSpec(report?.profileId);
  if (
    !report ||
    typeof report !== 'object' ||
    !spec ||
    !/^[0-9a-f]{64}$/u.test(eventStreamSha256 ?? '') ||
    !/^[0-9a-f]{64}$/u.test(serverSummarySha256 ?? '')
  ) {
    throw new TypeError('P02 runner receipt requires exact sanitized run inputs.');
  }
  const sanitizedReport = { ...report, runnerReceipt: null };
  return {
    schemaVersion: 1,
    kind: spec.receiptKind,
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
    throw new Error('P02 runner receipt requires a canonical Ed25519 SPKI public key.');
  }
  const signature = sign(null, Buffer.from(canonicalAgentMcpProfileJson(payload)), privateKey);
  return {
    schemaVersion: 1,
    kind: payload.kind,
    publicKeyBase64,
    publicKeySha256: sha256(publicKeyDer),
    payload,
    signature: signature.toString('base64'),
  };
}

export function validateP02ProfileReport(report, claim, reportBytes = null) {
  const context = profileContext(claim?.profileId);
  const profile = context?.profile;
  const spec = context?.spec;
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
    !isValidP06CiRunEvidence({ ciRunId: report?.ciRunId, ciChecks: report?.ciChecks }) ||
    !matchesClaim(report, claim)
  )
    return { passed: false, reason: 'P02_REPORT_CLAIM_INVALID' };

  const expectedPrivacyValue = expectedPrivacy();
  const expectedFixtureValue = expectedFixture(profile.id);
  const expectedBoundaryValue = expectedNetworkBoundary();
  const answerChecks = report.answerChecks;
  const receipt = report.runnerReceipt;
  const selectionEvidenceBytes = readFileSync(path.join(ROOT, spec.selectionEvidencePath));
  const valid =
    report.schemaVersion === 1 &&
    report.evidenceKind === profile.evidenceKind &&
    report.runNumber === 95 &&
    report.frontierId === 'P02' &&
    report.scenarioId === null &&
    report.epochId === profile.epochId &&
    report.profileId === profile.id &&
    report.profile === spec.reportProfile &&
    report.model === profile.model &&
    report.reasoningEffort === profile.reasoningEffort &&
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
    report.registrySha256 === agentMcpProfileRegistrySha256(profile.id) &&
    report.selectionEvidenceSha256 === sha256(selectionEvidenceBytes) &&
    catalogEvidenceMatches(report, profile) &&
    report.toolName === profile.toolName &&
    report.argumentProfile === profile.argumentProfile &&
    report.expectedArgumentsSha256 === agentMcpProfileArgumentsSha256(profile) &&
    report.networkMode === spec.networkMode &&
    canonicalAgentMcpProfileJson(report.serverToolNames) ===
      canonicalAgentMcpProfileJson([profile.toolName]) &&
    report.serverToolCount === 1 &&
    canonicalAgentMcpProfileJson(report.mcpServerNames) ===
      canonicalAgentMcpProfileJson([spec.serverId]) &&
    report.processExitCode === 0 &&
    report.resultStatus === 'SUCCESS' &&
    report.eventStreamParsed === true &&
    report.turnCompleted === true &&
    report.codexMcpToolEventCount === 1 &&
    report.codexErrorItemCount === 0 &&
    report.nonMcpToolEventCount === 0 &&
    Array.isArray(report.nonMcpToolTypes) &&
    report.nonMcpToolTypes.length === 0 &&
    report.shellToolCallCount === 0 &&
    report.allowedCallCount === 1 &&
    report.deniedCallCount === 0 &&
    report.answerCheckMethod === profile.answerCheckMethod &&
    report.answerSha256 === sha256(spec.acknowledgement) &&
    report.answerUtf8Bytes === Buffer.byteLength(spec.acknowledgement, 'utf8') &&
    exactKeys(report.offlineFixture, OFFLINE_FIXTURE_FIELDS) &&
    canonicalAgentMcpProfileJson(report.offlineFixture) ===
      canonicalAgentMcpProfileJson(expectedFixtureValue) &&
    exactKeys(report.networkBoundary, NETWORK_BOUNDARY_FIELDS) &&
    canonicalAgentMcpProfileJson(report.networkBoundary) ===
      canonicalAgentMcpProfileJson(expectedBoundaryValue) &&
    exactKeys(report.privacy, PRIVACY_FIELDS) &&
    canonicalAgentMcpProfileJson(report.privacy) ===
      canonicalAgentMcpProfileJson(expectedPrivacyValue) &&
    exactKeys(answerChecks, ANSWER_CHECK_FIELDS) &&
    Object.values(answerChecks).every((value) => value === true) &&
    exactKeys(receipt, RECEIPT_FIELDS) &&
    exactKeys(receipt.payload, RECEIPT_PAYLOAD_FIELDS);
  if (!valid) return { passed: false, reason: 'P02_REPORT_FIELDS_INVALID' };

  const claimPublicKey = Buffer.from(claim.runnerReceiptPublicKey ?? '', 'base64');
  let signatureValid = false;
  try {
    const publicKey = createPublicKey({ key: claimPublicKey, format: 'der', type: 'spki' });
    const payload = buildP02RunnerReceiptPayload(report, {
      eventStreamSha256: receipt.payload.eventStreamSha256,
      serverSummarySha256: receipt.payload.serverSummarySha256,
    });
    signatureValid =
      receipt.schemaVersion === 1 &&
      receipt.payload.schemaVersion === 1 &&
      receipt.kind === spec.receiptKind &&
      receipt.payload.kind === spec.receiptKind &&
      receipt.publicKeyBase64 === claim.runnerReceiptPublicKey &&
      receipt.publicKeySha256 === claim.runnerReceiptPublicKeySha256 &&
      publicKey.asymmetricKeyType === 'ed25519' &&
      sha256(claimPublicKey) === receipt.publicKeySha256 &&
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
  if (!signatureValid) return { passed: false, reason: 'P02_RUNNER_RECEIPT_INVALID' };
  if (reportBytes && reportBytes.length > 64 * 1024)
    return { passed: false, reason: 'P02_REPORT_TOO_LARGE' };
  return { passed: true, reportPath: profile.reportPath };
}

export function buildP02ProfileReport(
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
  const context = profileContext(claim?.profileId);
  const profile = context?.profile;
  const spec = context?.spec;
  if (
    !profile ||
    claim?.profileId !== profile.id ||
    claim.state !== 'CLAIMED' ||
    claim.retryAllowed !== false ||
    !isValidP06CiRunEvidence({ ciRunId: claim.ciRunId, ciChecks: claim.ciChecks }) ||
    !serverSummary ||
    !events ||
    !Array.isArray(completedMcpCalls) ||
    completedMcpCalls.length !== 1 ||
    completedMcpCalls[0]?.tool !== profile.toolName ||
    canonicalAgentMcpProfileJson(completedMcpCalls[0]?.arguments) !==
      canonicalAgentMcpProfileJson(profile.calls[0].arguments) ||
    events.processExitCode !== 0 ||
    events.eventStreamParsed !== true ||
    events.turnCompleted !== true ||
    events.codexMcpToolEventCount !== 1 ||
    events.codexErrorItemCount !== 0 ||
    events.nonMcpToolEventCount !== 0 ||
    events.shellToolCallCount !== 0 ||
    events.allowedCallCount !== 1 ||
    events.deniedCallCount !== 0 ||
    canonicalAgentMcpProfileJson(events.mcpServerNames) !==
      canonicalAgentMcpProfileJson([spec.serverId]) ||
    serverSummary.profileId !== profile.id ||
    serverSummary.serverProfile !== 'closed-profile-sequence-anonymous-offline-v1' ||
    serverSummary.networkMode !== spec.networkMode ||
    serverSummary.sourceRevision !== claim.sourceCandidateSha ||
    serverSummary.bundleSha256 !== claim.bundleSha256 ||
    serverSummary.toolName !== profile.toolName ||
    serverSummary.serverToolCount !== 1 ||
    canonicalAgentMcpProfileJson(serverSummary.serverToolNames) !==
      canonicalAgentMcpProfileJson([profile.toolName]) ||
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
    serverSummary.results[0]?.resultSummary?.personId !== profile.calls[0].arguments.personId ||
    !['partial', 'complete'].includes(serverSummary.results[0]?.resultSummary?.state) ||
    canonicalAgentMcpProfileJson(serverSummary.offlineFixture) !==
      canonicalAgentMcpProfileJson(expectedFixture(profile.id)) ||
    answer !== spec.acknowledgement ||
    typeof privateKey === 'undefined' ||
    !/^[0-9a-f]{64}$/u.test(eventStreamSha256 ?? '') ||
    !/^[0-9a-f]{64}$/u.test(serverSummarySha256 ?? '')
  )
    return { passed: false, reason: 'P02_RUNNER_GATE_INVALID' };

  const selectionEvidenceBytes = readFileSync(path.join(ROOT, spec.selectionEvidencePath));
  const report = {
    schemaVersion: 1,
    evidenceKind: profile.evidenceKind,
    runNumber: claim.runNumber,
    frontierId: profile.frontierId,
    scenarioId: null,
    epochId: profile.epochId,
    profileId: profile.id,
    profile: spec.reportProfile,
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
    selectionEvidenceSha256: sha256(selectionEvidenceBytes),
    toolName: profile.toolName,
    argumentProfile: profile.argumentProfile,
    expectedArgumentsSha256: claim.expectedArgumentsSha256,
    catalogSha256: serverSummary.catalogSha256,
    toolDescriptionSha256: serverSummary.toolDescriptionSha256,
    inputSchemaSha256: serverSummary.inputSchemaSha256,
    serverToolNames: serverSummary.serverToolNames,
    serverToolCount: serverSummary.serverToolCount,
    networkMode: spec.networkMode,
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
    answerChecks: {
      exactRegisteredProfile: true,
      oneAllowedMcpTool: true,
      fixedArguments: true,
      exactCandidateBundle: true,
      offlineFixtureOnly: true,
      threeExpectedLocalResponses: true,
      noAssetRequests: true,
      exactAcknowledgement: true,
      privacyPreserved: true,
    },
    offlineFixture: serverSummary.offlineFixture,
    networkBoundary: expectedNetworkBoundary(),
    privacy: expectedPrivacy(),
    runnerReceipt: null,
  };
  report.runnerReceipt = createRunnerReceipt(
    buildP02RunnerReceiptPayload(report, { eventStreamSha256, serverSummarySha256 }),
    { publicKeyBase64: claim.runnerReceiptPublicKey, privateKey },
  );
  const validation = validateP02ProfileReport(report, claim);
  return validation.passed ? { passed: true, report } : validation;
}

export function writeP02ProfileReport(input, options = {}) {
  const built = buildP02ProfileReport(input, options);
  if (!built.passed) return built;
  const spec = getP02PersonProfileOfflineSpec(built.report.profileId);
  if (!spec) return { passed: false, reason: 'P02_PROFILE_UNKNOWN' };
  const bytes = Buffer.from(`${JSON.stringify(built.report, null, 2)}\n`, 'utf8');
  if (bytes.length > 64 * 1024) return { passed: false, reason: 'P02_REPORT_TOO_LARGE' };
  let descriptor;
  try {
    descriptor = openSync(path.join(ROOT, spec.reportPath), 'wx', 0o600);
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
    return { passed: false, reason: 'P02_REPORT_ALREADY_EXISTS_OR_UNWRITABLE' };
  }
  return { passed: true, reportPath: spec.reportPath, reportSha256: sha256(bytes) };
}

export function validateP02SanitizedReportFile(claim, root = ROOT, reportPath = null) {
  const context = profileContext(claim?.profileId);
  if (!context) {
    return { passed: false, reason: 'P02_CLAIM_INVALID' };
  }
  const { profile } = context;
  const absolutePath = reportPath ?? path.join(root, profile.reportPath);
  try {
    const relativePath = path.resolve(absolutePath).replace(`${path.resolve(root)}${path.sep}`, '');
    const reportBytes = readFileSync(absolutePath);
    if (relativePath !== profile.reportPath)
      return { passed: false, reason: 'P02_REPORT_PATH_INVALID' };
    const report = JSON.parse(reportBytes.toString('utf8'));
    const validation = validateP02ProfileReport(report, claim, reportBytes);
    return validation.passed
      ? { ...validation, reportPath: relativePath, reportSha256: sha256(reportBytes), report }
      : validation;
  } catch {
    return { passed: false, reason: 'P02_REPORT_UNREADABLE' };
  }
}
