import { Buffer } from 'node:buffer';
import { createHash, createPublicKey, sign, verify } from 'node:crypto';
import { closeSync, openSync, readFileSync, writeFileSync, lstatSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  agentMcpProfileArgumentsSha256,
  agentMcpProfileRegistrySha256,
  canonicalAgentMcpProfileJson,
  getAgentMcpProfileById,
} from '../lib/agent-mcp-profile-claims.mjs';
import {
  expectedR02PositiveDirectRelationsRequestScope,
  R02_POSITIVE_DIRECT_RELATIONS_ACKNOWLEDGEMENT,
  R02_POSITIVE_DIRECT_RELATIONS_EXPECTED_RESULT_SUMMARIES,
  R02_POSITIVE_DIRECT_RELATIONS_NETWORK_MODE,
  R02_POSITIVE_DIRECT_RELATIONS_PROFILE_ID,
  R02_POSITIVE_DIRECT_RELATIONS_SERVER_ID,
  r02PositiveDirectRelationsRequestScopeIsValid,
} from '../lib/r02-positive-direct-relations-profile.mjs';
import { canonicalJson } from '../lib/codex-one-tool-evidence.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PROFILE = getAgentMcpProfileById(R02_POSITIVE_DIRECT_RELATIONS_PROFILE_ID);
const REPORT_RELATIVE_PATH = PROFILE?.reportPath;
const RECEIPT_KIND = 'r02-positive-direct-relations-agent-mcp-runner-receipt-v1';
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const canonicalSha256 = (value) => sha256(canonicalAgentMcpProfileJson(value));
const ANSWER_SHA256 = sha256(R02_POSITIVE_DIRECT_RELATIONS_ACKNOWLEDGEMENT);
const EXPECTED_NETWORK_BOUNDARY = Object.freeze({
  liveBangumiApiRequestCount: 3,
  rendererAssetRequestCount: 0,
  fullCodexHarnessNetworkSandboxed: false,
});
const EXPECTED_PRIVACY = Object.freeze({
  authProfile: 'anonymous',
  oauthAttempted: false,
  accountDataRead: false,
  writesAttempted: false,
  communityRead: false,
  qqPipelineTested: false,
  timClientTested: false,
  promptStored: false,
  answerStored: false,
  rawRelationRowsStored: false,
  rawToolResultStored: false,
  artifactImageBytesStored: false,
  credentialsStored: false,
});
const EXPECTED_ANSWER_CHECKS = Object.freeze({
  exactRegisteredProfile: true,
  orderedThreeCalls: true,
  exactCandidateBundle: true,
  exactAnonymousRequestScope: true,
  positiveRowsMatchSourceContract: true,
  boundedClaimsOnly: true,
  exactAcknowledgement: true,
  privacyPreserved: true,
});
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
  'publicRequestScope',
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
  'publicRequestScopeSha256',
  'resultSummarySha256',
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
    Object.keys(value).sort().join('\0') === [...fields].sort().join('\0'),
  );
}

function sha256Field(value) {
  return typeof value === 'string' && /^[0-9a-f]{64}$/u.test(value);
}

function same(left, right) {
  return canonicalAgentMcpProfileJson(left) === canonicalAgentMcpProfileJson(right);
}

function selectionEvidenceSha256() {
  return sha256(readFileSync(path.join(ROOT, PROFILE.selectionEvidencePath)));
}

function catalogEvidence() {
  const bytes = readFileSync(path.join(ROOT, 'docs/tool-catalog.json'));
  const catalog = JSON.parse(bytes.toString('utf8'));
  const tool = catalog.find((item) => item?.name === PROFILE.toolName);
  if (!tool || tool.auth !== 'none' || tool.risk !== 'read') {
    throw new Error('R02 requires the current anonymous read-only tool catalog entry.');
  }
  return {
    catalogSha256: sha256(bytes),
    toolDescriptionSha256: sha256(tool.description ?? ''),
    inputSchemaSha256: sha256(canonicalJson(tool.inputSchema)),
  };
}

function matchesClaim(report, claim) {
  return Boolean(
    report.claimId === claim.claimId &&
    report.profileId === claim.profileId &&
    report.runNumber === claim.runNumber &&
    report.prNumber === claim.prNumber &&
    report.epochId === claim.epochId &&
    report.frontierId === claim.frontierId &&
    report.acceptanceScope === claim.acceptanceScope &&
    report.sourceRevision === claim.sourceCandidateSha &&
    report.baseSha === claim.baseSha &&
    report.ciSha === claim.ciSha &&
    report.ciStatus === claim.ciStatus &&
    report.ciRunId === claim.ciRunId &&
    same(report.ciChecks, claim.ciChecks) &&
    report.reviewerId === claim.reviewerId &&
    report.mcpBundleSha256 === claim.bundleSha256 &&
    report.registrySha256 === claim.registrySha256 &&
    report.toolName === claim.toolName &&
    report.argumentProfile === claim.argumentProfile &&
    report.expectedArgumentsSha256 === claim.expectedArgumentsSha256,
  );
}

export function buildR02RunnerReceiptPayload(report, { eventStreamSha256, serverSummarySha256 }) {
  if (!sha256Field(eventStreamSha256) || !sha256Field(serverSummarySha256)) {
    throw new TypeError('R02 runner receipt requires exact sanitized run-input hashes.');
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
    acceptanceScope: report.acceptanceScope,
    prNumber: report.prNumber,
    sourceRevision: report.sourceRevision,
    baseSha: report.baseSha,
    ciSha: report.ciSha,
    ciStatus: report.ciStatus,
    ciRunId: report.ciRunId,
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
    publicRequestScopeSha256: canonicalSha256(report.publicRequestScope),
    resultSummarySha256: canonicalSha256(report.resultSummary),
    networkBoundarySha256: canonicalSha256(report.networkBoundary),
    answerSha256: report.answerSha256,
    eventStreamSha256,
    serverSummarySha256,
  };
}

function createReceipt(payload, { publicKeyBase64, privateKey }) {
  const publicKeyDer = Buffer.from(publicKeyBase64, 'base64');
  const publicKey = createPublicKey({ key: publicKeyDer, format: 'der', type: 'spki' });
  if (
    publicKey.asymmetricKeyType !== 'ed25519' ||
    publicKeyDer.toString('base64') !== publicKeyBase64
  ) {
    throw new Error('R02 runner receipt requires a canonical Ed25519 public key.');
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

function validCodexCliVersion(value) {
  const match = /^(\d+)\.(\d+)\.(\d+)$/u.exec(value ?? '');
  if (!match) return false;
  const [major, minor, patch] = match.slice(1).map(Number);
  return major > 0 || minor > 163 || (minor === 163 && patch >= 0);
}

function receiptMatchesReport(report, claim) {
  const receipt = report.runnerReceipt;
  if (
    !exactKeys(receipt, RECEIPT_FIELDS) ||
    receipt.schemaVersion !== 1 ||
    receipt.kind !== RECEIPT_KIND
  ) {
    return false;
  }
  if (
    receipt.publicKeyBase64 !== claim.runnerReceiptPublicKey ||
    !sha256Field(receipt.publicKeySha256) ||
    !exactKeys(receipt.payload, RECEIPT_PAYLOAD_FIELDS) ||
    receipt.payload.schemaVersion !== 1 ||
    receipt.payload.kind !== RECEIPT_KIND ||
    receipt.publicKeySha256 !== sha256(Buffer.from(receipt.publicKeyBase64, 'base64')) ||
    !sha256Field(receipt.payload.eventStreamSha256) ||
    !sha256Field(receipt.payload.serverSummarySha256) ||
    receipt.payload.sanitizedReportSha256 !==
      sha256(canonicalAgentMcpProfileJson({ ...report, runnerReceipt: null }))
  ) {
    return false;
  }
  const payload = receipt.payload;
  const expected = {
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
    publicRequestScopeSha256: canonicalSha256(report.publicRequestScope),
    resultSummarySha256: canonicalSha256(report.resultSummary),
    networkBoundarySha256: canonicalSha256(report.networkBoundary),
    answerSha256: report.answerSha256,
  };
  if (Object.entries(expected).some(([key, value]) => payload[key] !== value)) return false;
  try {
    const publicKey = createPublicKey({
      key: Buffer.from(receipt.publicKeyBase64, 'base64'),
      format: 'der',
      type: 'spki',
    });
    return (
      publicKey.asymmetricKeyType === 'ed25519' &&
      verify(
        null,
        Buffer.from(canonicalAgentMcpProfileJson(payload)),
        publicKey,
        Buffer.from(receipt.signature, 'base64'),
      )
    );
  } catch {
    return false;
  }
}

export function validateR02ProfileReport(report, claim, reportBytes = null) {
  try {
    const catalog = catalogEvidence();
    const expected = {
      schemaVersion: 1,
      evidenceKind: PROFILE.evidenceKind,
      runNumber: 95,
      frontierId: 'R02',
      scenarioId: null,
      acceptanceScope: 'agent-mcp-matrix-only',
      epochId: PROFILE.epochId,
      profileId: PROFILE.id,
      profile: 'codex-luna-max-public-agent-mcp-matrix-v1',
      model: 'gpt-6-luna',
      reasoningEffort: 'max',
      reviewerId: claim.reviewerId,
      sourceRevision: claim.sourceCandidateSha,
      baseSha: claim.baseSha,
      ciSha: claim.ciSha,
      ciStatus: 'SUCCESS',
      ciRunId: String(claim.ciRunId ?? ''),
      ciChecks: claim.ciChecks,
      prNumber: claim.prNumber,
      claimId: claim.claimId,
      mcpBundleSha256: claim.bundleSha256,
      registrySha256: agentMcpProfileRegistrySha256(PROFILE.id),
      selectionEvidenceSha256: selectionEvidenceSha256(),
      toolName: PROFILE.toolName,
      argumentProfile: PROFILE.argumentProfile,
      expectedArgumentsSha256: agentMcpProfileArgumentsSha256(PROFILE),
      ...catalog,
      serverToolNames: [PROFILE.toolName],
      serverToolCount: 1,
      networkMode: R02_POSITIVE_DIRECT_RELATIONS_NETWORK_MODE,
      mcpServerNames: [R02_POSITIVE_DIRECT_RELATIONS_SERVER_ID],
      processExitCode: 0,
      resultStatus: 'SUCCESS',
      eventStreamParsed: true,
      turnCompleted: true,
      codexMcpToolEventCount: 3,
      unexpectedCodexErrorItemCount: 0,
      nonMcpToolEventCount: 0,
      nonMcpToolTypes: [],
      shellToolCallCount: 0,
      allowedCallCount: 3,
      deniedCallCount: 0,
      answerCheckMethod: PROFILE.answerCheckMethod,
      answerSha256: ANSWER_SHA256,
      answerUtf8Bytes: Buffer.byteLength(R02_POSITIVE_DIRECT_RELATIONS_ACKNOWLEDGEMENT, 'utf8'),
      answerChecks: EXPECTED_ANSWER_CHECKS,
      resultSummary: R02_POSITIVE_DIRECT_RELATIONS_EXPECTED_RESULT_SUMMARIES,
      publicRequestScope: expectedR02PositiveDirectRelationsRequestScope(),
      networkBoundary: EXPECTED_NETWORK_BOUNDARY,
      privacy: EXPECTED_PRIVACY,
    };
    if (
      !exactKeys(report, REPORT_FIELDS) ||
      !PROFILE ||
      !matchesClaim(report, claim) ||
      Object.entries(expected).some(([key, value]) => !same(report[key], value)) ||
      !validCodexCliVersion(report.codexCliVersion) ||
      !sha256Field(report.catalogSha256) ||
      !sha256Field(report.toolDescriptionSha256) ||
      !sha256Field(report.inputSchemaSha256) ||
      !Number.isFinite(Date.parse(report.observedAt)) ||
      !Number.isSafeInteger(report.codexErrorItemCount) ||
      report.codexErrorItemCount < 0 ||
      report.codexErrorItemCount > 3 ||
      report.blockedWebSearchErrorItemCount !== report.codexErrorItemCount ||
      !same(report.publicRequestScope, expectedR02PositiveDirectRelationsRequestScope()) ||
      !r02PositiveDirectRelationsRequestScopeIsValid(report.publicRequestScope) ||
      !receiptMatchesReport(report, claim)
    ) {
      return { passed: false, reason: 'R02_REPORT_ASSERTION_FAILED' };
    }
    const bytes = reportBytes ?? Buffer.from(`${JSON.stringify(report, null, 2)}\n`, 'utf8');
    return {
      passed: true,
      reportSha256: sha256(bytes),
      reportPath: REPORT_RELATIVE_PATH,
    };
  } catch (error) {
    return { passed: false, reason: error instanceof Error ? error.message : 'R02_REPORT_INVALID' };
  }
}

export function buildR02ProfileReport(
  { claim, serverSummary, events, answer, codexCliVersion, eventStreamSha256, serverSummarySha256 },
  { privateKey, publicKeyBase64 },
) {
  try {
    if (
      serverSummary?.profileId !== PROFILE.id ||
      serverSummary?.serverResultStatus !== 'SUCCESS' ||
      serverSummary?.allowedCallCount !== 3 ||
      serverSummary?.deniedCallCount !== 0 ||
      serverSummary?.expectedCallCount !== 3 ||
      !Array.isArray(serverSummary?.results) ||
      !same(
        serverSummary.results.map((item) => item?.resultSummary),
        R02_POSITIVE_DIRECT_RELATIONS_EXPECTED_RESULT_SUMMARIES,
      ) ||
      !r02PositiveDirectRelationsRequestScopeIsValid(serverSummary.publicRequestScope) ||
      answer !== R02_POSITIVE_DIRECT_RELATIONS_ACKNOWLEDGEMENT ||
      events?.processExitCode !== 0 ||
      events?.eventStreamParsed !== true ||
      events?.turnCompleted !== true ||
      events?.codexMcpToolEventCount !== 3 ||
      events?.unexpectedCodexErrorItemCount !== 0 ||
      events?.blockedWebSearchErrorItemCount !== events?.codexErrorItemCount ||
      events?.codexErrorItemCount > 3 ||
      events?.nonMcpToolEventCount !== 0 ||
      events?.shellToolCallCount !== 0 ||
      !same(events?.mcpServerNames, [R02_POSITIVE_DIRECT_RELATIONS_SERVER_ID]) ||
      events?.allowedCallCount !== 3 ||
      events?.deniedCallCount !== 0 ||
      !sha256Field(eventStreamSha256) ||
      !sha256Field(serverSummarySha256)
    ) {
      return { passed: false, reason: 'R02_RUN_EVIDENCE_INVALID' };
    }
    const catalog = catalogEvidence();
    const report = {
      schemaVersion: 1,
      evidenceKind: PROFILE.evidenceKind,
      runNumber: 95,
      frontierId: 'R02',
      scenarioId: null,
      acceptanceScope: 'agent-mcp-matrix-only',
      epochId: PROFILE.epochId,
      profileId: PROFILE.id,
      profile: 'codex-luna-max-public-agent-mcp-matrix-v1',
      model: 'gpt-6-luna',
      reasoningEffort: 'max',
      reviewerId: claim.reviewerId,
      codexCliVersion,
      observedAt: new Date().toISOString(),
      sourceRevision: claim.sourceCandidateSha,
      baseSha: claim.baseSha,
      ciSha: claim.ciSha,
      ciStatus: claim.ciStatus,
      ciRunId: String(claim.ciRunId),
      ciChecks: claim.ciChecks,
      prNumber: claim.prNumber,
      claimId: claim.claimId,
      mcpBundleSha256: claim.bundleSha256,
      registrySha256: agentMcpProfileRegistrySha256(PROFILE.id),
      selectionEvidenceSha256: selectionEvidenceSha256(),
      toolName: PROFILE.toolName,
      argumentProfile: PROFILE.argumentProfile,
      expectedArgumentsSha256: agentMcpProfileArgumentsSha256(PROFILE),
      ...catalog,
      serverToolNames: [PROFILE.toolName],
      serverToolCount: 1,
      networkMode: R02_POSITIVE_DIRECT_RELATIONS_NETWORK_MODE,
      mcpServerNames: [R02_POSITIVE_DIRECT_RELATIONS_SERVER_ID],
      processExitCode: events.processExitCode,
      resultStatus: 'SUCCESS',
      eventStreamParsed: events.eventStreamParsed,
      turnCompleted: events.turnCompleted,
      codexMcpToolEventCount: events.codexMcpToolEventCount,
      codexErrorItemCount: events.codexErrorItemCount,
      blockedWebSearchErrorItemCount: events.blockedWebSearchErrorItemCount,
      unexpectedCodexErrorItemCount: events.unexpectedCodexErrorItemCount,
      nonMcpToolEventCount: events.nonMcpToolEventCount,
      nonMcpToolTypes: [],
      shellToolCallCount: events.shellToolCallCount,
      allowedCallCount: events.allowedCallCount,
      deniedCallCount: events.deniedCallCount,
      answerCheckMethod: PROFILE.answerCheckMethod,
      answerSha256: ANSWER_SHA256,
      answerUtf8Bytes: Buffer.byteLength(answer, 'utf8'),
      answerChecks: EXPECTED_ANSWER_CHECKS,
      resultSummary: serverSummary.results.map((item) => item.resultSummary),
      publicRequestScope: serverSummary.publicRequestScope,
      networkBoundary: EXPECTED_NETWORK_BOUNDARY,
      privacy: EXPECTED_PRIVACY,
      runnerReceipt: null,
    };
    const payload = buildR02RunnerReceiptPayload(report, {
      eventStreamSha256,
      serverSummarySha256,
    });
    report.runnerReceipt = createReceipt(payload, { publicKeyBase64, privateKey });
    const bytes = Buffer.from(`${JSON.stringify(report, null, 2)}\n`, 'utf8');
    const validation = validateR02ProfileReport(report, claim, bytes);
    return validation.passed
      ? { passed: true, report, reportBytes: bytes, reportSha256: validation.reportSha256 }
      : validation;
  } catch (error) {
    return {
      passed: false,
      reason: error instanceof Error ? error.message : 'R02_REPORT_BUILD_FAILED',
    };
  }
}

export function writeR02ProfileReport(reportBytes, root = ROOT, reportPath = REPORT_RELATIVE_PATH) {
  if (!Buffer.isBuffer(reportBytes) || reportBytes.length < 2 || reportBytes.length > 64 * 1024) {
    throw new TypeError('R02 report must be a bounded JSON buffer.');
  }
  const absoluteRoot = path.resolve(root);
  const target = path.resolve(absoluteRoot, reportPath);
  if (!target.startsWith(`${absoluteRoot}${path.sep}`))
    throw new Error('R02 report path escaped root.');
  const descriptor = openSync(target, 'wx', 0o600);
  try {
    writeFileSync(descriptor, reportBytes);
  } finally {
    closeSync(descriptor);
  }
  return target;
}

export function validateR02SanitizedReportFile(claim, root = ROOT, reportPath = null) {
  const relativePath = reportPath ? path.relative(root, reportPath) : REPORT_RELATIVE_PATH;
  if (relativePath !== REPORT_RELATIVE_PATH) {
    return { passed: false, reason: 'R02_REPORT_PATH_MISMATCH' };
  }
  const target = path.join(root, relativePath);
  try {
    const stat = lstatSync(target);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 64 * 1024) {
      return { passed: false, reason: 'R02_REPORT_FILE_INVALID' };
    }
    const reportBytes = readFileSync(target);
    const report = JSON.parse(reportBytes.toString('utf8'));
    return validateR02ProfileReport(report, claim, reportBytes);
  } catch {
    return { passed: false, reason: 'R02_REPORT_FILE_UNAVAILABLE' };
  }
}
