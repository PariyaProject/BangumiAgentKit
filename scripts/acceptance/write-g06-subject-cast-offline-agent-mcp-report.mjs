import { Buffer } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import { createHash, createPublicKey, sign, verify } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  agentMcpProfileArgumentsSha256,
  agentMcpProfileRegistrySha256,
  canonicalAgentMcpProfileJson,
  getAgentMcpProfileById,
} from '../lib/agent-mcp-profile-claims.mjs';
import { isValidP06CiRunEvidence } from '../lib/p06-ci-run-evidence.mjs';
import { sanitizeGitRepositoryEnvironment } from '../lib/g26-mcp-bundle.mjs';
import {
  assertG06SubjectCastOfflineProfile,
  getG06CastOfflineProfileSpec,
} from '../lib/g06-subject-cast-offline-profile.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const SERVER_ID = 'bgk_g06_cast_offline_profile';
const ACKNOWLEDGEMENT = 'G06_SYNTHETIC_CAST_MATRIX_EXECUTED';
const RECEIPT_KIND = 'g06-cast-offline-agent-mcp-runner-receipt-v1';
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
  'nonMcpToolEventCount',
  'nonMcpToolTypes',
  'shellToolCallCount',
  'allowedCallCount',
  'deniedCallCount',
  'answerCheckMethod',
  'answerSha256',
  'answerUtf8Bytes',
  'toolResultSummary',
  'answerChecks',
  'offlineFixture',
  'networkBoundary',
  'privacy',
  'runnerReceipt',
]);
const ANSWER_CHECK_FIELDS = new Set([
  'exactRegisteredProfile',
  'oneAllowedMcpTool',
  'fixedArguments',
  'exactCandidateBundle',
  'offlineFixtureOnly',
  'singleExpectedLocalResponse',
  'boundedResultSummary',
  'exactAcknowledgement',
  'noRealSourceClaim',
  'privacyPreserved',
]);
const TOOL_SUMMARY_FIELDS = new Set([
  'status',
  'subjectIdMatches',
  'rowsObserved',
  'rowsReturned',
  'multiRoleVoiceActorCount',
  'truncated',
  'schemaDriftRows',
  'invalidActorIdRows',
  'sourceStatus',
  'paginationAvailable',
  'totalCountAvailable',
]);
const OFFLINE_FIXTURE_FIELDS = new Set([
  'profile',
  'requestCount',
  'allowedRequestCount',
  'duplicateRequestCount',
  'unexpectedRequestCount',
  'authorizationHeaderCount',
  'queryParameterCount',
  'requestBodyCount',
  'rowsReturned',
  'expectedOperationComplete',
]);
const NETWORK_BOUNDARY_FIELDS = new Set([
  'liveBangumiApiRequestCount',
  'externalProductRequestCount',
  'rendererAssetRequestCount',
  'fullCodexHarnessNetworkSandboxed',
]);
const PRIVACY = Object.freeze({
  authProfile: 'anonymous',
  oauthAttempted: false,
  accountDataRead: false,
  writesAttempted: false,
  communityRead: false,
  qqPipelineTested: false,
  timClientTested: false,
  promptStored: false,
  answerStored: false,
  syntheticNamesOrIdsStored: false,
  rawFixtureRowsStored: false,
  rawToolResultStored: false,
  artifactImageBytesStored: false,
  credentialsStored: false,
});
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
  'reviewerId',
  'bundleSha256',
  'registrySha256',
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
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const isRecord = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));

function exactKeys(value, expected) {
  return (
    isRecord(value) &&
    Object.keys(value).length === expected.size &&
    [...expected].every((key) => Object.hasOwn(value, key))
  );
}

function profileFor(profileId) {
  const profile = getAgentMcpProfileById(profileId);
  if (!profile || !getG06CastOfflineProfileSpec(profile)) return null;
  try {
    return assertG06SubjectCastOfflineProfile(profile) ? profile : null;
  } catch {
    return null;
  }
}

function expectedOfflineFixture(profile) {
  return {
    profile: profile.networkMode,
    requestCount: 1,
    allowedRequestCount: 1,
    duplicateRequestCount: 0,
    unexpectedRequestCount: 0,
    authorizationHeaderCount: 0,
    queryParameterCount: 0,
    requestBodyCount: 0,
    rowsReturned: 2,
    expectedOperationComplete: true,
  };
}

function expectedNetworkBoundary() {
  return {
    liveBangumiApiRequestCount: 0,
    externalProductRequestCount: 0,
    rendererAssetRequestCount: 0,
    fullCodexHarnessNetworkSandboxed: false,
  };
}

function matchesClaim(report, claim) {
  const profile = profileFor(claim?.profileId);
  return (
    profile !== null &&
    claim?.profileId === report.profileId &&
    claim?.retryAllowed === false &&
    ((claim.state === 'CLAIMED' && claim.reportWritten === false && !claim.reportSha256) ||
      (claim.state === 'REPORT_WRITTEN' &&
        claim.reportWritten === true &&
        typeof claim.reportSha256 === 'string')) &&
    report.claimId === claim.claimId &&
    report.profileId === claim.profileId &&
    report.frontierId === claim.frontierId &&
    report.epochId === claim.epochId &&
    report.runNumber === claim.runNumber &&
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
    report.expectedArgumentsSha256 === claim.expectedArgumentsSha256
  );
}

function receiptPayload(report, { eventStreamSha256, serverSummarySha256 }) {
  const sanitizedReport = { ...report };
  delete sanitizedReport.runnerReceipt;
  return {
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
    reviewerId: report.reviewerId,
    bundleSha256: report.mcpBundleSha256,
    registrySha256: report.registrySha256,
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
    offlineFixtureSha256: sha256(canonicalAgentMcpProfileJson(report.offlineFixture)),
    networkBoundarySha256: sha256(canonicalAgentMcpProfileJson(report.networkBoundary)),
    answerSha256: report.answerSha256,
    eventStreamSha256,
    serverSummarySha256,
  };
}

function createRunnerReceipt(payload, { publicKeyBase64, privateKey }) {
  const publicKeyDer = Buffer.from(publicKeyBase64, 'base64');
  const publicKey = createPublicKey({ key: publicKeyDer, format: 'der', type: 'spki' });
  if (
    publicKey.asymmetricKeyType !== 'ed25519' ||
    publicKeyDer.toString('base64') !== publicKeyBase64
  ) {
    throw new TypeError('G06 offline receipt requires a canonical Ed25519 SPKI public key.');
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

function verifyRunnerReceipt(report, claim) {
  const receipt = report.runnerReceipt;
  if (
    !exactKeys(receipt, RECEIPT_FIELDS) ||
    !exactKeys(receipt.payload, RECEIPT_PAYLOAD_FIELDS) ||
    receipt.schemaVersion !== 1 ||
    receipt.kind !== RECEIPT_KIND ||
    receipt.publicKeyBase64 !== claim?.runnerReceiptPublicKey
  ) {
    return false;
  }
  const claimKeyBytes = Buffer.from(claim.runnerReceiptPublicKey ?? '', 'base64');
  if (
    claimKeyBytes.toString('base64') !== claim.runnerReceiptPublicKey ||
    sha256(claimKeyBytes) !== receipt.publicKeySha256 ||
    receipt.publicKeySha256 !== claim.runnerReceiptPublicKeySha256
  ) {
    return false;
  }
  if (Buffer.from(receipt.signature ?? '', 'base64').toString('base64') !== receipt.signature) {
    return false;
  }
  try {
    const publicKey = createPublicKey({ key: claimKeyBytes, format: 'der', type: 'spki' });
    return (
      publicKey.asymmetricKeyType === 'ed25519' &&
      canonicalAgentMcpProfileJson(receipt.payload) ===
        canonicalAgentMcpProfileJson(
          receiptPayload(report, {
            eventStreamSha256: receipt.payload.eventStreamSha256,
            serverSummarySha256: receipt.payload.serverSummarySha256,
          }),
        ) &&
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

function catalogEvidence(report, profile, root = ROOT) {
  try {
    if (!/^[0-9a-f]{40}$/u.test(report?.sourceRevision ?? '')) return false;
    const currentBytes = readFileSync(path.join(root, 'docs/tool-catalog.json'));
    const sourceBytes = execFileSync(
      'git',
      ['show', `${report.sourceRevision}:docs/tool-catalog.json`],
      { cwd: root, env: sanitizeGitRepositoryEnvironment() },
    );
    const currentCatalog = JSON.parse(currentBytes.toString('utf8'));
    const sourceCatalog = JSON.parse(sourceBytes.toString('utf8'));
    const tool = currentCatalog.find((item) => item?.name === profile?.toolName);
    const sourceTool = sourceCatalog.find((item) => item?.name === profile?.toolName);
    return Boolean(
      tool &&
      sourceTool &&
      canonicalAgentMcpProfileJson(sourceTool) === canonicalAgentMcpProfileJson(tool) &&
      tool.auth === 'none' &&
      tool.risk === 'read' &&
      report.catalogSha256 === sha256(sourceBytes) &&
      report.toolDescriptionSha256 === sha256(tool.description) &&
      report.inputSchemaSha256 === sha256(canonicalAgentMcpProfileJson(tool.inputSchema)),
    );
  } catch {
    return false;
  }
}

export function validateG06SubjectCastOfflineReport(
  report,
  claim,
  reportBytes = null,
  root = ROOT,
) {
  const profile = profileFor(claim?.profileId);
  const profileSpec = getG06CastOfflineProfileSpec(profile);
  if (
    !profile ||
    !profileSpec ||
    !exactKeys(report, REPORT_FIELDS) ||
    !claim ||
    !matchesClaim(report, claim) ||
    !isValidP06CiRunEvidence({ ciRunId: report.ciRunId, ciChecks: report.ciChecks })
  ) {
    return { passed: false, reason: 'G06_CAST_OFFLINE_CLAIM_INVALID' };
  }
  if (
    claim.state === 'REPORT_WRITTEN' &&
    reportBytes &&
    sha256(reportBytes) !== claim.reportSha256
  ) {
    return { passed: false, reason: 'G06_CAST_OFFLINE_REPORT_DIGEST_MISMATCH' };
  }
  let selectionBytes;
  try {
    selectionBytes = readFileSync(path.join(root, profile.selectionEvidencePath));
  } catch {
    return { passed: false, reason: 'G06_CAST_OFFLINE_SELECTION_MISSING' };
  }
  const expectedFixture = expectedOfflineFixture(profile);
  const expectedBoundary = expectedNetworkBoundary();
  const expectedSummary = {
    status: 'ok',
    subjectIdMatches: true,
    rowsObserved: 2,
    rowsReturned: 2,
    multiRoleVoiceActorCount: 1,
    truncated: false,
    schemaDriftRows: 0,
    invalidActorIdRows: 0,
    sourceStatus: 'observed',
    paginationAvailable: false,
    totalCountAvailable: false,
  };
  const expectedChecks = Object.fromEntries([...ANSWER_CHECK_FIELDS].map((key) => [key, true]));
  const expectedPrivacy = { ...PRIVACY };
  const valid =
    report.schemaVersion === 1 &&
    report.evidenceKind === profile.evidenceKind &&
    report.runNumber === 95 &&
    report.frontierId === 'G06' &&
    report.scenarioId === null &&
    report.acceptanceScope === 'agent-mcp-matrix-only' &&
    report.epochId === profile.epochId &&
    report.profileId === profile.id &&
    report.profile === profileSpec.reportProfile &&
    report.model === 'gpt-6-luna' &&
    report.reasoningEffort === 'max' &&
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
    /^profile-run-95-pr-\d+-[0-9a-f]{12}-\d+$/u.test(report.claimId ?? '') &&
    /^[0-9a-f]{64}$/u.test(report.mcpBundleSha256 ?? '') &&
    report.registrySha256 === agentMcpProfileRegistrySha256(profile.id) &&
    report.selectionEvidenceSha256 === sha256(selectionBytes) &&
    report.toolName === profile.toolName &&
    report.argumentProfile === profile.argumentProfile &&
    report.expectedArgumentsSha256 === agentMcpProfileArgumentsSha256(profile) &&
    report.networkMode === profile.networkMode &&
    canonicalAgentMcpProfileJson(report.serverToolNames) ===
      canonicalAgentMcpProfileJson([profile.toolName]) &&
    report.serverToolCount === 1 &&
    canonicalAgentMcpProfileJson(report.mcpServerNames) ===
      canonicalAgentMcpProfileJson([SERVER_ID]) &&
    report.processExitCode === 0 &&
    report.resultStatus === 'SUCCESS' &&
    report.eventStreamParsed === true &&
    report.turnCompleted === true &&
    report.codexMcpToolEventCount === 1 &&
    (profile.id === 'g06-cast-offline-agent-mcp-matrix-v1'
      ? report.codexErrorItemCount === 0
      : Number.isSafeInteger(report.codexErrorItemCount) &&
        report.codexErrorItemCount >= 0 &&
        report.codexErrorItemCount <= 10_000_000) &&
    report.nonMcpToolEventCount === 0 &&
    Array.isArray(report.nonMcpToolTypes) &&
    report.nonMcpToolTypes.length === 0 &&
    report.shellToolCallCount === 0 &&
    report.allowedCallCount === 1 &&
    report.deniedCallCount === 0 &&
    report.answerCheckMethod === profile.answerCheckMethod &&
    report.answerSha256 === sha256(ACKNOWLEDGEMENT) &&
    report.answerUtf8Bytes === Buffer.byteLength(ACKNOWLEDGEMENT, 'utf8') &&
    exactKeys(report.toolResultSummary, TOOL_SUMMARY_FIELDS) &&
    canonicalAgentMcpProfileJson(report.toolResultSummary) ===
      canonicalAgentMcpProfileJson(expectedSummary) &&
    exactKeys(report.answerChecks, ANSWER_CHECK_FIELDS) &&
    canonicalAgentMcpProfileJson(report.answerChecks) ===
      canonicalAgentMcpProfileJson(expectedChecks) &&
    exactKeys(report.offlineFixture, OFFLINE_FIXTURE_FIELDS) &&
    canonicalAgentMcpProfileJson(report.offlineFixture) ===
      canonicalAgentMcpProfileJson(expectedFixture) &&
    exactKeys(report.networkBoundary, NETWORK_BOUNDARY_FIELDS) &&
    canonicalAgentMcpProfileJson(report.networkBoundary) ===
      canonicalAgentMcpProfileJson(expectedBoundary) &&
    exactKeys(report.privacy, new Set(Object.keys(PRIVACY))) &&
    canonicalAgentMcpProfileJson(report.privacy) ===
      canonicalAgentMcpProfileJson(expectedPrivacy) &&
    catalogEvidence(report, profile, root) &&
    verifyRunnerReceipt(report, claim) &&
    !Object.hasOwn(report, 'answer') &&
    !Object.hasOwn(report, 'toolOutput') &&
    !Object.hasOwn(report, 'rawRows') &&
    !Object.hasOwn(report, 'rawResult');
  if (!valid) return { passed: false, reason: 'G06_CAST_OFFLINE_REPORT_FIELDS_INVALID' };

  if (reportBytes && reportBytes.length > 64 * 1024) {
    return { passed: false, reason: 'G06_CAST_OFFLINE_REPORT_TOO_LARGE' };
  }
  return { passed: true };
}

export function validateG06SubjectCastOfflineSanitizedReportFile(
  claim,
  root = ROOT,
  reportPath = undefined,
) {
  try {
    const profile = profileFor(claim?.profileId);
    if (!profile) return { passed: false, reason: 'G06_CAST_OFFLINE_PROFILE_INVALID' };
    const expectedReportPath = path.join(root, profile.reportPath);
    const targetReportPath = reportPath ?? expectedReportPath;
    const bytes = readFileSync(targetReportPath);
    const report = JSON.parse(bytes.toString('utf8'));
    const validation = validateG06SubjectCastOfflineReport(report, claim, bytes, root);
    const reportSha256 = sha256(bytes);
    if (!validation.passed || path.resolve(targetReportPath) !== path.resolve(expectedReportPath)) {
      return { passed: false, reason: validation.reason ?? 'G06_CAST_OFFLINE_REPORT_PATH_INVALID' };
    }
    if (claim.reportWritten === true && claim.reportSha256 !== reportSha256) {
      return { passed: false, reason: 'G06_CAST_OFFLINE_REPORT_DIGEST_MISMATCH' };
    }
    return { passed: true, reportPath: profile.reportPath, reportSha256, report };
  } catch {
    return { passed: false, reason: 'G06_CAST_OFFLINE_REPORT_UNAVAILABLE' };
  }
}

export function writeG06SubjectCastOfflineReport(
  input,
  { privateKey, publicKeyBase64, reportPath = undefined, root = ROOT } = {},
) {
  const profile = profileFor(input?.claim?.profileId);
  const profileSpec = getG06CastOfflineProfileSpec(profile);
  const targetReportPath = reportPath ?? (profile ? path.join(root, profile.reportPath) : null);
  if (
    !profile || !profileSpec || !input?.claim || !targetReportPath ||
    !/^[0-9a-f]{40}$/u.test(input.claim.sourceCandidateSha ?? '')
  ) {
    return { passed: false, reason: 'G06_CAST_OFFLINE_PROFILE_INVALID' };
  }
  const selectionBytes = readFileSync(path.join(root, profile.selectionEvidencePath));
  const summary = input.serverSummary;
  let catalogBytes;
  let catalog;
  try {
    catalogBytes = execFileSync(
      'git',
      ['show', `${input.claim.sourceCandidateSha}:docs/tool-catalog.json`],
      { cwd: root, env: sanitizeGitRepositoryEnvironment() },
    );
    catalog = JSON.parse(catalogBytes.toString('utf8'));
  } catch {
    return { passed: false, reason: 'G06_CAST_OFFLINE_SOURCE_CATALOG_INVALID' };
  }
  const tool = catalog.find((item) => item?.name === profile.toolName);
  if (!tool || !summary || !tool.inputSchema) {
    return { passed: false, reason: 'G06_CAST_OFFLINE_SUMMARY_INVALID' };
  }
  const baseReport = {
    schemaVersion: 1,
    evidenceKind: profile.evidenceKind,
    runNumber: 95,
    frontierId: 'G06',
    scenarioId: null,
    acceptanceScope: 'agent-mcp-matrix-only',
    epochId: profile.epochId,
    profileId: profile.id,
    profile: profileSpec.reportProfile,
    model: profile.model,
    reasoningEffort: profile.reasoningEffort,
    reviewerId: input.claim.reviewerId,
    codexCliVersion: input.codexCliVersion,
    observedAt: input.observedAt,
    sourceRevision: input.claim.sourceCandidateSha,
    baseSha: input.claim.baseSha,
    ciSha: input.claim.ciSha,
    ciStatus: input.claim.ciStatus,
    ciRunId: input.claim.ciRunId,
    ciChecks: input.claim.ciChecks,
    prNumber: input.claim.prNumber,
    claimId: input.claim.claimId,
    mcpBundleSha256: input.claim.bundleSha256,
    registrySha256: input.claim.registrySha256,
    selectionEvidenceSha256: sha256(selectionBytes),
    toolName: profile.toolName,
    argumentProfile: profile.argumentProfile,
    expectedArgumentsSha256: input.claim.expectedArgumentsSha256,
    catalogSha256: sha256(catalogBytes),
    toolDescriptionSha256: sha256(tool.description),
    inputSchemaSha256: sha256(canonicalAgentMcpProfileJson(tool.inputSchema)),
    serverToolNames: summary.serverToolNames,
    serverToolCount: summary.serverToolCount,
    networkMode: profile.networkMode,
    mcpServerNames: input.events.mcpServerNames,
    processExitCode: input.events.processExitCode,
    resultStatus: summary.serverResultStatus,
    eventStreamParsed: input.events.eventStreamParsed,
    turnCompleted: input.events.turnCompleted,
    codexMcpToolEventCount: input.events.codexMcpToolEventCount,
    codexErrorItemCount: input.events.codexErrorItemCount,
    nonMcpToolEventCount: input.events.nonMcpToolEventCount,
    nonMcpToolTypes: input.events.nonMcpToolTypes,
    shellToolCallCount: input.events.shellToolCallCount,
    allowedCallCount: summary.allowedCallCount,
    deniedCallCount: summary.deniedCallCount,
    answerCheckMethod: profile.answerCheckMethod,
    answerSha256: sha256(ACKNOWLEDGEMENT),
    answerUtf8Bytes: Buffer.byteLength(ACKNOWLEDGEMENT, 'utf8'),
    toolResultSummary: summary.results?.[0]?.resultSummary,
    answerChecks: input.answerChecks,
    offlineFixture: summary.offlineFixture,
    networkBoundary: expectedNetworkBoundary(),
    privacy: { ...PRIVACY },
  };
  const receipt = createRunnerReceipt(
    receiptPayload(baseReport, {
      eventStreamSha256: input.eventStreamSha256,
      serverSummarySha256: input.serverSummarySha256,
    }),
    { publicKeyBase64, privateKey },
  );
  const report = { ...baseReport, runnerReceipt: receipt };
  const validation = validateG06SubjectCastOfflineReport(report, input.claim, null, root);
  if (!validation.passed) return validation;
  const bytes = Buffer.from(`${JSON.stringify(report, null, 2)}\n`, 'utf8');
  mkdirSync(path.dirname(targetReportPath), { recursive: true, mode: 0o700 });
  writeFileSync(targetReportPath, bytes, { flag: 'wx', mode: 0o600 });
  return {
    passed: true,
    reportPath: path.relative(root, targetReportPath),
    reportSha256: sha256(bytes),
  };
}
