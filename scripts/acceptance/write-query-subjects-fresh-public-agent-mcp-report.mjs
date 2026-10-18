import { createHash, createPublicKey, sign, verify } from 'node:crypto';
import { existsSync, openSync, closeSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  agentMcpProfileArgumentsSha256,
  agentMcpProfileRegistrySha256,
  canonicalAgentMcpProfileJson,
  getAgentMcpProfileById,
} from '../lib/agent-mcp-profile-claims.mjs';
import { canonicalJson } from '../lib/codex-one-tool-evidence.mjs';
import { isValidP06CiRunEvidence } from '../lib/p06-ci-run-evidence.mjs';
import {
  assertQuerySubjectsFreshPublicProfile,
  querySubjectsFreshPublicRequestScopeIsValid,
  QUERY_SUBJECTS_FRESH_PUBLIC_ACKNOWLEDGEMENT,
  QUERY_SUBJECTS_FRESH_PUBLIC_EPOCH_ID,
  QUERY_SUBJECTS_FRESH_PUBLIC_MAX_REQUESTS,
  QUERY_SUBJECTS_FRESH_PUBLIC_NETWORK_MODE,
  QUERY_SUBJECTS_FRESH_PUBLIC_PROFILE_ID,
  QUERY_SUBJECTS_FRESH_PUBLIC_SERVER_ID,
} from '../lib/query-subjects-fresh-public-matrix-profile.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PROFILE = getAgentMcpProfileById(QUERY_SUBJECTS_FRESH_PUBLIC_PROFILE_ID);
const REPORT_PATH = 'docs/live-probes/query-subjects-fresh-public-agent-mcp-run95.json';
const SELECTION_PATH =
  'docs/research/run95-query-subjects-fresh-public-matrix-contract-2026-10-19.md';
const TOOL_NAME = 'bangumi.query_subjects';
const REQUIRED_REPORT_KEYS = [
  'schemaVersion',
  'evidenceKind',
  'profileId',
  'acceptanceScope',
  'runNumber',
  'frontierId',
  'epochId',
  'model',
  'reasoningEffort',
  'claimId',
  'prNumber',
  'reviewerId',
  'toolName',
  'argumentProfile',
  'expectedArgumentsSha256',
  'registrySha256',
  'selectionEvidenceSha256',
  'sourceRevision',
  'baseSha',
  'ciSha',
  'ciStatus',
  'ciRunId',
  'ciChecks',
  'mcpBundleSha256',
  'catalogSha256',
  'toolDescriptionSha256',
  'inputSchemaSha256',
  'networkMode',
  'serverId',
  'serverToolNames',
  'serverToolCount',
  'mcpServerNames',
  'expectedCallCount',
  'argumentMatch',
  'processExitCode',
  'eventStreamSha256',
  'serverSummarySha256',
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
  'resultSummary',
  'publicRequestScope',
  'answerUtf8Bytes',
  'answerSha256',
  'answerAcknowledgementMatched',
  'privacy',
  'retryAllowed',
  'reportWritten',
  'observedAt',
  'codexCliVersion',
  'runnerReceipt',
];

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const isSha256 = (value) => typeof value === 'string' && /^[0-9a-f]{64}$/u.test(value);
const exactKeys = (value, keys) =>
  Boolean(value && typeof value === 'object' && !Array.isArray(value)) &&
  Object.keys(value).sort().join('\0') === [...keys].sort().join('\0');
const boundedCount = (value, maximum = 1_000_000) =>
  Number.isSafeInteger(value) && value >= 0 && value <= maximum;
const optionalBoundedCount = (value, maximum) => value === null || boundedCount(value, maximum);

function selectionEvidenceSha256(root = ROOT) {
  try {
    return sha256(readFileSync(path.join(root, SELECTION_PATH)));
  } catch {
    return null;
  }
}

function catalogEvidence(root = ROOT) {
  try {
    const bytes = readFileSync(path.join(root, 'docs/tool-catalog.json'));
    const catalog = JSON.parse(bytes.toString('utf8'));
    const tool = catalog.find((item) => item?.name === TOOL_NAME);
    if (!tool || tool.auth !== 'none' || tool.risk !== 'read') return null;
    return {
      catalogSha256: sha256(bytes),
      toolDescriptionSha256: sha256(tool.description ?? ''),
      inputSchemaSha256: sha256(canonicalJson(tool.inputSchema)),
    };
  } catch {
    return null;
  }
}

function sourceProjection(report) {
  const copy = { ...report };
  delete copy.runnerReceipt;
  return copy;
}

function receiptPayload(report) {
  return {
    kind: 'query-subjects-fresh-public-agent-mcp-runner-receipt-v1',
    sanitizedReportSha256: sha256(canonicalAgentMcpProfileJson(sourceProjection(report))),
  };
}

function makeReceipt(report, { privateKey, publicKeyBase64 }) {
  const payload = canonicalAgentMcpProfileJson(receiptPayload(report));
  const signature = sign(null, Buffer.from(payload, 'utf8'), privateKey).toString('base64');
  const publicKeyBytes = Buffer.from(publicKeyBase64, 'base64');
  return {
    kind: 'query-subjects-fresh-public-agent-mcp-runner-receipt-v1',
    publicKeyBase64,
    publicKeySha256: sha256(publicKeyBytes),
    signature,
  };
}

function verifyReceipt(report, claim) {
  try {
    const receipt = report.runnerReceipt;
    const publicKeyBytes = Buffer.from(claim.runnerReceiptPublicKey ?? '', 'base64');
    if (
      receipt?.kind !== 'query-subjects-fresh-public-agent-mcp-runner-receipt-v1' ||
      receipt.publicKeyBase64 !== claim.runnerReceiptPublicKey ||
      receipt.publicKeySha256 !== claim.runnerReceiptPublicKeySha256 ||
      sha256(publicKeyBytes) !== claim.runnerReceiptPublicKeySha256 ||
      typeof receipt.signature !== 'string' ||
      !/^[A-Za-z0-9+/]+={0,2}$/u.test(receipt.signature)
    ) {
      return false;
    }
    const key = createPublicKey({ key: publicKeyBytes, type: 'spki', format: 'der' });
    return verify(
      null,
      Buffer.from(canonicalAgentMcpProfileJson(receiptPayload(report)), 'utf8'),
      key,
      Buffer.from(receipt.signature, 'base64'),
    );
  } catch {
    return false;
  }
}

export function validateQuerySubjectsFreshPublicServerSummary(
  summary,
  sourceRevision,
  bundleSha256,
) {
  const result = summary?.results?.[0]?.resultSummary;
  const requestScope = summary?.publicRequestScope;
  const catalog = catalogEvidence();
  const resultKeys = [
    'resultState',
    'returnedItems',
    'coverageState',
    'pagesRequested',
    'pagesScanned',
    'totalKind',
    'warningCount',
  ];
  const requestScopeKeys = [
    'requestCount',
    'allowedRequestCount',
    'deniedRequestCount',
    'credentialAttemptCount',
    'unexpectedRouteCount',
    'budgetExceeded',
    'maxRequests',
    'anonymousOnly',
    'officialV0Only',
    'redirectPolicy',
  ];
  return Boolean(
    assertQuerySubjectsFreshPublicProfile(PROFILE) &&
    summary?.serverProfile === 'closed-profile-sequence-anonymous-public-v1' &&
    summary?.profileId === PROFILE.id &&
    summary?.argumentProfile === PROFILE.argumentProfile &&
    summary?.networkMode === QUERY_SUBJECTS_FRESH_PUBLIC_NETWORK_MODE &&
    summary?.expectedArgumentsSha256 === agentMcpProfileArgumentsSha256(PROFILE) &&
    summary?.sourceRevision === sourceRevision &&
    summary?.bundleSha256 === bundleSha256 &&
    catalog !== null &&
    summary?.catalogSha256 === catalog.catalogSha256 &&
    summary?.toolDescriptionSha256 === catalog.toolDescriptionSha256 &&
    summary?.inputSchemaSha256 === catalog.inputSchemaSha256 &&
    summary?.toolName === TOOL_NAME &&
    summary?.serverToolCount === 1 &&
    canonicalAgentMcpProfileJson(summary.serverToolNames) ===
      canonicalAgentMcpProfileJson([TOOL_NAME]) &&
    summary?.expectedCallCount === 1 &&
    summary?.serverResultStatus === 'SUCCESS' &&
    summary?.allowedCallCount === 1 &&
    summary?.deniedCallCount === 0 &&
    summary?.argumentMatch === true &&
    Array.isArray(summary?.results) &&
    summary.results.length === 1 &&
    exactKeys(summary.results[0], ['sequenceIndex', 'status', 'resultSummary']) &&
    summary.results[0]?.sequenceIndex === 0 &&
    summary.results[0]?.status === 'SUCCESS' &&
    exactKeys(result, resultKeys) &&
    ['ok', 'partial'].includes(result?.resultState) &&
    boundedCount(result.returnedItems, 1) &&
    ['complete', 'partial', 'unavailable', 'not_computable', 'unknown'].includes(
      result.coverageState,
    ) &&
    optionalBoundedCount(result.pagesRequested, QUERY_SUBJECTS_FRESH_PUBLIC_MAX_REQUESTS) &&
    optionalBoundedCount(result.pagesScanned, QUERY_SUBJECTS_FRESH_PUBLIC_MAX_REQUESTS) &&
    ['exact', 'estimated', 'unknown', 'unavailable'].includes(result.totalKind) &&
    boundedCount(result.warningCount, 8) &&
    exactKeys(requestScope, requestScopeKeys) &&
    querySubjectsFreshPublicRequestScopeIsValid(requestScope),
  );
}

export function buildQuerySubjectsFreshPublicProfileReport(
  {
    claim,
    gate,
    serverSummary,
    events,
    answer,
    codexCliVersion,
    eventStreamSha256,
    serverSummarySha256,
  },
  { privateKey, publicKeyBase64 },
) {
  const selectionSha256 = selectionEvidenceSha256();
  const catalog = catalogEvidence();
  const versionMatch = /^(\d+)\.(\d+)\.(\d+)$/u.exec(codexCliVersion ?? '');
  const versionParts = versionMatch?.slice(1).map(Number) ?? [];
  const supportedVersion =
    versionParts.length === 3 &&
    (versionParts[0] > 0 || versionParts[1] > 163 || versionParts[1] === 163);
  if (
    !claim ||
    !gate ||
    !isValidP06CiRunEvidence(gate) ||
    claim.ciRunId !== gate.ciRunId ||
    canonicalAgentMcpProfileJson(claim.ciChecks) !== canonicalAgentMcpProfileJson(gate.ciChecks) ||
    claim.sourceCandidateSha !== gate.candidateSha ||
    claim.baseSha !== gate.baseSha ||
    claim.ciSha !== gate.candidateSha ||
    claim.ciStatus !== 'SUCCESS' ||
    claim.reviewerId !== gate.reviewerId ||
    !isSha256(selectionSha256) ||
    !catalog ||
    !supportedVersion ||
    !validateQuerySubjectsFreshPublicServerSummary(
      serverSummary,
      gate.candidateSha,
      claim.bundleSha256,
    ) ||
    !isSha256(eventStreamSha256) ||
    !isSha256(serverSummarySha256) ||
    answer !== QUERY_SUBJECTS_FRESH_PUBLIC_ACKNOWLEDGEMENT
  ) {
    return { passed: false, reason: 'QUERY_SUBJECTS_FRESH_PUBLIC_REPORT_INPUT_INVALID' };
  }
  const now = new Date().toISOString();
  const resultSummary = serverSummary.results[0].resultSummary;
  const report = {
    schemaVersion: 1,
    evidenceKind: PROFILE.evidenceKind,
    profileId: PROFILE.id,
    acceptanceScope: PROFILE.acceptanceScope,
    runNumber: 95,
    frontierId: PROFILE.frontierId,
    epochId: PROFILE.epochId,
    model: PROFILE.model,
    reasoningEffort: PROFILE.reasoningEffort,
    claimId: claim.claimId,
    prNumber: gate.prNumber,
    reviewerId: gate.reviewerId,
    toolName: TOOL_NAME,
    argumentProfile: PROFILE.argumentProfile,
    expectedArgumentsSha256: agentMcpProfileArgumentsSha256(PROFILE),
    registrySha256: agentMcpProfileRegistrySha256(PROFILE.id),
    selectionEvidenceSha256: selectionEvidenceSha256(),
    sourceRevision: gate.candidateSha,
    baseSha: gate.baseSha,
    ciSha: claim.ciSha,
    ciStatus: claim.ciStatus,
    ciRunId: claim.ciRunId,
    ciChecks: gate.ciChecks,
    mcpBundleSha256: claim.bundleSha256,
    catalogSha256: catalog.catalogSha256,
    toolDescriptionSha256: catalog.toolDescriptionSha256,
    inputSchemaSha256: catalog.inputSchemaSha256,
    networkMode: QUERY_SUBJECTS_FRESH_PUBLIC_NETWORK_MODE,
    serverId: QUERY_SUBJECTS_FRESH_PUBLIC_SERVER_ID,
    serverToolNames: [TOOL_NAME],
    serverToolCount: 1,
    mcpServerNames: events.mcpServerNames,
    expectedCallCount: 1,
    argumentMatch: true,
    processExitCode: events.processExitCode,
    eventStreamSha256,
    serverSummarySha256,
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
    resultSummary,
    publicRequestScope: serverSummary.publicRequestScope,
    answerUtf8Bytes: Buffer.byteLength(answer, 'utf8'),
    answerSha256: sha256(answer),
    answerAcknowledgementMatched: true,
    privacy: {
      promptPersisted: false,
      answerPersisted: false,
      subjectNamesPersisted: false,
      subjectIdsPersisted: false,
      accountDataPersisted: false,
      credentialsPersisted: false,
      communityDataPersisted: false,
    },
    retryAllowed: false,
    reportWritten: true,
    observedAt: now,
    codexCliVersion,
    runnerReceipt: null,
  };
  report.runnerReceipt = makeReceipt(report, { privateKey, publicKeyBase64 });
  const reportBytes = Buffer.from(JSON.stringify(report, null, 2) + '\n', 'utf8');
  const reportSha256 = sha256(reportBytes);
  const validated = validateQuerySubjectsFreshPublicProfileReport(report, claim, reportBytes);
  if (!validated)
    return { passed: false, reason: 'QUERY_SUBJECTS_FRESH_PUBLIC_REPORT_SELF_CHECK_FAILED' };
  return { passed: true, report, reportBytes, reportSha256 };
}

export function validateQuerySubjectsFreshPublicProfileReport(report, claim, reportBytes = null) {
  if (!exactKeys(report, REQUIRED_REPORT_KEYS)) return false;
  const currentCatalog = catalogEvidence();
  const resultKeys = [
    'resultState',
    'returnedItems',
    'coverageState',
    'pagesRequested',
    'pagesScanned',
    'totalKind',
    'warningCount',
  ];
  const requestScopeKeys = [
    'requestCount',
    'allowedRequestCount',
    'deniedRequestCount',
    'credentialAttemptCount',
    'unexpectedRouteCount',
    'budgetExceeded',
    'maxRequests',
    'anonymousOnly',
    'officialV0Only',
    'redirectPolicy',
  ];
  const cliVersionMatch = /^(\d+)\.(\d+)\.(\d+)$/u.exec(report.codexCliVersion ?? '');
  const cliVersionParts = cliVersionMatch?.slice(1).map(Number) ?? [];
  const supportedCliVersion =
    cliVersionParts.length === 3 &&
    (cliVersionParts[0] > 0 || cliVersionParts[1] > 163 || cliVersionParts[1] === 163);
  if (
    report.schemaVersion !== 1 ||
    report.evidenceKind !== PROFILE.evidenceKind ||
    report.profileId !== PROFILE.id ||
    report.profileId !== claim?.profileId ||
    report.acceptanceScope !== 'agent-mcp-matrix-only' ||
    report.runNumber !== 95 ||
    report.runNumber !== claim?.runNumber ||
    report.frontierId !== 'G14' ||
    report.frontierId !== claim?.frontierId ||
    report.epochId !== QUERY_SUBJECTS_FRESH_PUBLIC_EPOCH_ID ||
    report.epochId !== claim?.epochId ||
    report.model !== PROFILE.model ||
    report.reasoningEffort !== PROFILE.reasoningEffort ||
    report.toolName !== TOOL_NAME ||
    report.toolName !== claim?.toolName ||
    report.argumentProfile !== PROFILE.argumentProfile ||
    report.argumentProfile !== claim?.argumentProfile ||
    canonicalAgentMcpProfileJson(claim?.expectedArguments) !==
      canonicalAgentMcpProfileJson(PROFILE.calls.map((call) => call.arguments)) ||
    report.acceptanceScope !== PROFILE.acceptanceScope ||
    report.sourceRevision !== claim?.sourceCandidateSha ||
    !/^[0-9a-f]{40}$/u.test(report.sourceRevision ?? '') ||
    report.baseSha !== claim?.baseSha ||
    !/^[0-9a-f]{40}$/u.test(report.baseSha ?? '') ||
    report.ciSha !== claim?.ciSha ||
    report.ciSha !== report.sourceRevision ||
    report.ciStatus !== 'SUCCESS' ||
    report.ciStatus !== claim?.ciStatus ||
    report.mcpBundleSha256 !== claim?.bundleSha256 ||
    report.claimId !== claim?.claimId ||
    report.prNumber !== claim?.prNumber ||
    report.reviewerId !== claim?.reviewerId ||
    report.ciRunId !== claim?.ciRunId ||
    !isValidP06CiRunEvidence({ ciRunId: report.ciRunId, ciChecks: report.ciChecks }) ||
    report.ciRunId !== claim?.ciRunId ||
    canonicalAgentMcpProfileJson(report.ciChecks) !==
      canonicalAgentMcpProfileJson(claim?.ciChecks) ||
    report.expectedArgumentsSha256 !== agentMcpProfileArgumentsSha256(PROFILE) ||
    report.expectedArgumentsSha256 !== claim?.expectedArgumentsSha256 ||
    report.registrySha256 !== agentMcpProfileRegistrySha256(PROFILE.id) ||
    report.registrySha256 !== claim?.registrySha256 ||
    !isSha256(report.selectionEvidenceSha256) ||
    report.selectionEvidenceSha256 !== selectionEvidenceSha256() ||
    !currentCatalog ||
    report.catalogSha256 !== currentCatalog.catalogSha256 ||
    report.toolDescriptionSha256 !== currentCatalog.toolDescriptionSha256 ||
    report.inputSchemaSha256 !== currentCatalog.inputSchemaSha256 ||
    report.networkMode !== QUERY_SUBJECTS_FRESH_PUBLIC_NETWORK_MODE ||
    report.serverId !== QUERY_SUBJECTS_FRESH_PUBLIC_SERVER_ID ||
    canonicalAgentMcpProfileJson(report.serverToolNames) !==
      canonicalAgentMcpProfileJson([TOOL_NAME]) ||
    report.serverToolCount !== 1 ||
    canonicalAgentMcpProfileJson(report.mcpServerNames) !==
      canonicalAgentMcpProfileJson([QUERY_SUBJECTS_FRESH_PUBLIC_SERVER_ID]) ||
    report.expectedCallCount !== 1 ||
    report.argumentMatch !== true ||
    report.processExitCode !== 0 ||
    !isSha256(report.eventStreamSha256) ||
    !isSha256(report.serverSummarySha256) ||
    report.eventStreamParsed !== true ||
    report.turnCompleted !== true ||
    report.codexMcpToolEventCount !== 1 ||
    report.codexErrorItemCount !== 0 ||
    report.blockedWebSearchErrorItemCount !== 0 ||
    report.unexpectedCodexErrorItemCount !== 0 ||
    report.nonMcpToolEventCount !== 0 ||
    canonicalAgentMcpProfileJson(report.nonMcpToolTypes) !== canonicalAgentMcpProfileJson([]) ||
    report.shellToolCallCount !== 0 ||
    report.allowedCallCount !== 1 ||
    report.deniedCallCount !== 0 ||
    report.answerAcknowledgementMatched !== true ||
    report.answerUtf8Bytes !==
      Buffer.byteLength(QUERY_SUBJECTS_FRESH_PUBLIC_ACKNOWLEDGEMENT, 'utf8') ||
    report.answerSha256 !== sha256(QUERY_SUBJECTS_FRESH_PUBLIC_ACKNOWLEDGEMENT) ||
    report.retryAllowed !== false ||
    report.reportWritten !== true ||
    !Number.isFinite(Date.parse(report.observedAt)) ||
    !supportedCliVersion ||
    !verifyReceipt(report, claim)
  ) {
    return false;
  }
  const expectedPrivacy = {
    promptPersisted: false,
    answerPersisted: false,
    subjectNamesPersisted: false,
    subjectIdsPersisted: false,
    accountDataPersisted: false,
    credentialsPersisted: false,
    communityDataPersisted: false,
  };
  if (
    canonicalAgentMcpProfileJson(report.privacy) !== canonicalAgentMcpProfileJson(expectedPrivacy)
  ) {
    return false;
  }
  if (
    !exactKeys(report.resultSummary, resultKeys) ||
    !['ok', 'partial'].includes(report.resultSummary.resultState) ||
    !boundedCount(report.resultSummary.returnedItems, 1) ||
    !['complete', 'partial', 'unavailable', 'not_computable', 'unknown'].includes(
      report.resultSummary.coverageState,
    ) ||
    !optionalBoundedCount(
      report.resultSummary.pagesRequested,
      QUERY_SUBJECTS_FRESH_PUBLIC_MAX_REQUESTS,
    ) ||
    !optionalBoundedCount(
      report.resultSummary.pagesScanned,
      QUERY_SUBJECTS_FRESH_PUBLIC_MAX_REQUESTS,
    ) ||
    !['exact', 'estimated', 'unknown', 'unavailable'].includes(report.resultSummary.totalKind) ||
    !boundedCount(report.resultSummary.warningCount, 8) ||
    !exactKeys(report.publicRequestScope, requestScopeKeys) ||
    !querySubjectsFreshPublicRequestScopeIsValid(report.publicRequestScope)
  ) {
    return false;
  }
  if (
    reportBytes &&
    sha256(reportBytes) !== sha256(Buffer.from(JSON.stringify(report, null, 2) + '\n'))
  ) {
    return false;
  }
  return true;
}

export function writeQuerySubjectsFreshPublicProfileReport(reportBytes, root = ROOT) {
  if (!Buffer.isBuffer(reportBytes) || reportBytes.length > 32_768) {
    throw new Error('Fresh query_subjects report must be a bounded Buffer.');
  }
  const filePath = path.join(root, REPORT_PATH);
  if (existsSync(filePath)) throw new Error('Fresh query_subjects report is create-once.');
  const fd = openSync(filePath, 'wx', 0o600);
  try {
    writeFileSync(fd, reportBytes);
  } finally {
    closeSync(fd);
  }
  return sha256(reportBytes);
}

export function validateQuerySubjectsFreshPublicSanitizedReportFile(
  claim,
  root = ROOT,
  reportPath = null,
) {
  try {
    const expected = path.join(root, REPORT_PATH);
    if (reportPath && path.resolve(reportPath) !== path.resolve(expected)) {
      return { passed: false, reason: 'QUERY_SUBJECTS_FRESH_PUBLIC_REPORT_PATH_INVALID' };
    }
    if (!existsSync(expected))
      return { passed: false, reason: 'QUERY_SUBJECTS_FRESH_PUBLIC_REPORT_MISSING' };
    const reportBytes = readFileSync(expected);
    if (reportBytes.length > 32_768)
      return { passed: false, reason: 'QUERY_SUBJECTS_FRESH_PUBLIC_REPORT_TOO_LARGE' };
    const report = JSON.parse(reportBytes.toString('utf8'));
    const valid = validateQuerySubjectsFreshPublicProfileReport(report, claim, reportBytes);
    return valid
      ? { passed: true, reportSha256: sha256(reportBytes), report }
      : { passed: false, reason: 'QUERY_SUBJECTS_FRESH_PUBLIC_REPORT_INVALID' };
  } catch {
    return { passed: false, reason: 'QUERY_SUBJECTS_FRESH_PUBLIC_REPORT_READ_FAILED' };
  }
}
