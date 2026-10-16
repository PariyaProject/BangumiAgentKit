import { Buffer } from 'node:buffer';
import { createHash, createPublicKey, sign, verify } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  agentMcpProfileArgumentsSha256,
  agentMcpProfileRegistrySha256,
  canonicalAgentMcpProfileJson,
  getAgentMcpProfileById,
} from '../lib/agent-mcp-profile-claims.mjs';
import { buildG06PrivacySummary } from '../lib/g06-privacy-summary.mjs';
import {
  assertTitleQueryRenderPublicProfile,
  TITLE_QUERY_RENDER_MAX_REQUESTS,
  TITLE_QUERY_RENDER_NETWORK_MODE,
  TITLE_QUERY_RENDER_PROFILE_ID,
  TITLE_QUERY_RENDER_SERVER_ID,
  TITLE_QUERY_RENDER_TOOL_NAMES,
} from '../lib/title-query-render-agent-mcp-profile.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PROFILE = getAgentMcpProfileById(TITLE_QUERY_RENDER_PROFILE_ID);
const REPORT_RELATIVE_PATH = PROFILE?.reportPath;
const REPORT_PATH = path.join(ROOT, REPORT_RELATIVE_PATH);
const RECEIPT_KIND = 'title-query-render-agent-mcp-runner-receipt-v1';
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const canonicalHash = (value) => sha256(canonicalAgentMcpProfileJson(value));

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
  'toolNames',
  'argumentProfile',
  'expectedArgumentsSha256',
  'catalogSha256',
  'toolDescriptors',
  'serverToolNames',
  'serverToolCount',
  'serverInstanceId',
  'rendererAssetBoundary',
  'networkMode',
  'mcpServerNames',
  'processExitCode',
  'resultStatus',
  'codexRunCount',
  'eventStreamParsed',
  'turnCompleted',
  'codexMcpToolEventCount',
  'codexErrorItemCount',
  'nonMcpToolEventCount',
  'nonMcpToolTypes',
  'shellToolCallCount',
  'allowedCallCount',
  'deniedCallCount',
  'publicRequestScope',
  'answerCheckMethod',
  'answerSha256',
  'answerUtf8Bytes',
  'answerChecks',
  'resultSummaries',
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
  'reviewerId',
  'bundleSha256',
  'registrySha256',
  'toolNames',
  'argumentProfile',
  'expectedArgumentsSha256',
  'eventStreamSha256',
  'serverSummarySha256',
  'answerSha256',
  'resultSummariesSha256',
  'answerChecksSha256',
]);
const ANSWER_CHECK_FIELDS = new Set([
  'exactRegisteredSequence',
  'exactArguments',
  'boundedQueryObservation',
  'answerMatchesObservedResults',
  'nonExhaustiveDisclosed',
  'ephemeralPngArtifact',
  'anonymousPublicRequestBudget',
  'rendererAssetNetworkDisabled',
  'privacyPreserved',
  'matrixOnlyScope',
]);
const PRIVACY = Object.freeze(buildG06PrivacySummary());
const RENDERER_ASSET_BOUNDARY = Object.freeze({
  assetNetworkRequestCount: 0,
  remoteAssetResolutionDisabled: true,
});

function exactKeys(value, expected) {
  return Boolean(
    value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      Object.keys(value).length === expected.size &&
      Object.keys(value).every((key) => expected.has(key)),
  );
}

function safeCount(value, maximum = 1_000_000) {
  return Number.isSafeInteger(value) && value >= 0 && value <= maximum;
}

function validRequestScope(scope) {
  const fields = new Set([
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
  ]);
  return (
    exactKeys(scope, fields) &&
    safeCount(scope.requestCount, TITLE_QUERY_RENDER_MAX_REQUESTS) &&
    scope.allowedRequestCount === scope.requestCount &&
    scope.deniedRequestCount === 0 &&
    scope.credentialAttemptCount === 0 &&
    scope.unexpectedRouteCount === 0 &&
    scope.budgetExceeded === false &&
    scope.maxRequests === TITLE_QUERY_RENDER_MAX_REQUESTS &&
    scope.anonymousOnly === true &&
    scope.officialV0Only === true &&
    scope.redirectPolicy === 'error'
  );
}

function validQuerySummary(summary) {
  const fields = new Set(['resultState', 'returnedItems', 'coverage', 'warningCodes']);
  const coverageFields = new Set([
    'state',
    'requested',
    'scanned',
    'matched',
    'returned',
    'pagesRequested',
    'pagesScanned',
    'upstreamExhausted',
    'budgetExceeded',
    'totalKind',
  ]);
  const coverage = summary?.coverage;
  return (
    exactKeys(summary, fields) &&
    ['ok', 'partial'].includes(summary.resultState) &&
    Number.isSafeInteger(summary.returnedItems) &&
    summary.returnedItems >= 0 &&
    summary.returnedItems <= 1 &&
    exactKeys(coverage, coverageFields) &&
    ['complete', 'partial', 'unavailable', 'not_computable', 'unknown'].includes(coverage.state) &&
    ['requested', 'scanned', 'matched', 'returned', 'pagesRequested', 'pagesScanned'].every(
      (field) => coverage[field] === null || safeCount(coverage[field]),
    ) &&
    ['upstreamExhausted', 'budgetExceeded'].every(
      (field) => coverage[field] === null || typeof coverage[field] === 'boolean',
    ) &&
    ['exact', 'estimated', 'unknown', 'unavailable'].includes(coverage.totalKind) &&
    Array.isArray(summary.warningCodes) &&
    summary.warningCodes.length <= 4 &&
    summary.warningCodes.every((code) =>
      ['EXPERIMENTAL_SOURCE', 'HYDRATION_FAILED', 'OUTPUT_TRUNCATED', 'OTHER'].includes(code),
    )
  );
}

function validArtifactSummary(summary) {
  const fields = new Set(['resultState', 'artifact']);
  const artifactFields = new Set([
    'returned',
    'persisted',
    'mimeType',
    'width',
    'height',
    'byteLength',
    'sha256',
    'pngSignatureValid',
  ]);
  const artifact = summary?.artifact;
  return (
    exactKeys(summary, fields) &&
    summary.resultState === 'artifact_returned' &&
    exactKeys(artifact, artifactFields) &&
    artifact.returned === true &&
    artifact.persisted === false &&
    artifact.mimeType === 'image/png' &&
    Number.isSafeInteger(artifact.width) &&
    artifact.width > 0 &&
    artifact.width <= 3000 &&
    Number.isSafeInteger(artifact.height) &&
    artifact.height > 0 &&
    artifact.height <= 5000 &&
    artifact.width * artifact.height <= 10_000_000 &&
    safeCount(artifact.byteLength, 5_000_000) &&
    artifact.byteLength > 0 &&
    /^[0-9a-f]{64}$/u.test(artifact.sha256 ?? '') &&
    artifact.pngSignatureValid === true
  );
}

function validResultSummaries(resultSummaries) {
  const rowFields = new Set(['toolName', 'summary']);
  return (
    Array.isArray(resultSummaries) &&
    resultSummaries.length === 2 &&
    resultSummaries.every((row, index) =>
      exactKeys(row, rowFields) &&
      row.toolName === TITLE_QUERY_RENDER_TOOL_NAMES[index] &&
      (index === 0 ? validQuerySummary(row.summary) : validArtifactSummary(row.summary)),
    )
  );
}

function catalogEvidenceMatches(report, root) {
  try {
    const catalogBytes = readFileSync(path.join(root, 'docs/tool-catalog.json'));
    const catalog = JSON.parse(catalogBytes.toString('utf8'));
    return (
      report.catalogSha256 === sha256(catalogBytes) &&
      Array.isArray(report.toolDescriptors) &&
      report.toolDescriptors.length === TITLE_QUERY_RENDER_TOOL_NAMES.length &&
      report.toolDescriptors.every((descriptor, index) => {
        const tool = catalog.find((item) => item?.name === TITLE_QUERY_RENDER_TOOL_NAMES[index]);
        return (
          tool?.auth === 'none' &&
          tool?.risk === 'read' &&
          descriptor.toolName === tool.name &&
          descriptor.descriptionSha256 === sha256(tool.description) &&
          descriptor.inputSchemaSha256 ===
            sha256(canonicalAgentMcpProfileJson(tool.inputSchema))
        );
      })
    );
  } catch {
    return false;
  }
}

export function validateTitleQueryRenderServerSummary(summary, sourceRevision, bundleSha256, root = ROOT) {
  if (
    !PROFILE ||
    !assertTitleQueryRenderPublicProfile(PROFILE) ||
    !summary ||
    summary.serverProfile !== 'closed-profile-sequence-anonymous-public-v1' ||
    summary.profileId !== PROFILE.id ||
    summary.argumentProfile !== PROFILE.argumentProfile ||
    summary.expectedCallCount !== PROFILE.calls.length ||
    summary.networkMode !== TITLE_QUERY_RENDER_NETWORK_MODE ||
    summary.sourceRevision !== sourceRevision ||
    summary.bundleSha256 !== bundleSha256 ||
    summary.toolName !== PROFILE.toolName ||
    canonicalAgentMcpProfileJson(summary.toolNames) !==
      canonicalAgentMcpProfileJson(TITLE_QUERY_RENDER_TOOL_NAMES) ||
    canonicalAgentMcpProfileJson(summary.serverToolNames) !==
      canonicalAgentMcpProfileJson(TITLE_QUERY_RENDER_TOOL_NAMES) ||
    summary.serverToolCount !== TITLE_QUERY_RENDER_TOOL_NAMES.length ||
    summary.expectedArgumentsSha256 !== agentMcpProfileArgumentsSha256(PROFILE) ||
    summary.serverResultStatus !== 'SUCCESS' ||
    summary.allowedCallCount !== PROFILE.calls.length ||
    summary.deniedCallCount !== 0 ||
    summary.argumentMatch !== true ||
    !Array.isArray(summary.results) ||
    summary.results.length !== PROFILE.calls.length ||
    !validRequestScope(summary.publicRequestScope) ||
    canonicalAgentMcpProfileJson(summary.rendererAssetBoundary) !==
      canonicalAgentMcpProfileJson(RENDERER_ASSET_BOUNDARY) ||
    canonicalAgentMcpProfileJson(summary.privacy) !== canonicalAgentMcpProfileJson(PRIVACY) ||
    !Array.isArray(summary.toolDescriptors) ||
    summary.toolDescriptors.length !== TITLE_QUERY_RENDER_TOOL_NAMES.length ||
    !/^[0-9a-f]{64}$/u.test(summary.catalogSha256 ?? '') ||
    !/^[0-9a-f-]{36}$/u.test(summary.serverInstanceId ?? '')
  ) {
    return false;
  }
  for (let index = 0; index < PROFILE.calls.length; index += 1) {
    const result = summary.results[index];
    const resultSummaryValid =
      index === 0 ? validQuerySummary(result?.resultSummary) : validArtifactSummary(result?.resultSummary);
    if (
      !result ||
      result.sequenceIndex !== index ||
      result.toolName !== PROFILE.calls[index].toolName ||
      result.status !== 'SUCCESS' ||
      !resultSummaryValid
    ) {
      return false;
    }
  }
  try {
    const catalogBytes = readFileSync(path.join(root, 'docs/tool-catalog.json'));
    const catalog = JSON.parse(catalogBytes.toString('utf8'));
    const descriptors = summary.toolDescriptors;
    return (
      summary.catalogSha256 === sha256(catalogBytes) &&
      descriptors.every((descriptor, index) => {
        const tool = catalog.find((entry) => entry?.name === TITLE_QUERY_RENDER_TOOL_NAMES[index]);
        return (
          exactKeys(descriptor, new Set(['toolName', 'descriptionSha256', 'inputSchemaSha256'])) &&
          tool?.auth === 'none' &&
          tool?.risk === 'read' &&
          descriptor.toolName === tool.name &&
          descriptor.descriptionSha256 === sha256(tool.description) &&
          descriptor.inputSchemaSha256 === sha256(canonicalAgentMcpProfileJson(tool.inputSchema))
        );
      })
    );
  } catch {
    return false;
  }
}

export function isTitleQueryRenderAnswerValid(answer, resultSummaries) {
  if (typeof answer !== 'string' || Buffer.byteLength(answer, 'utf8') > PROFILE.maxAnswerBytes)
    return false;
  let parsed;
  try {
    parsed = JSON.parse(answer);
  } catch {
    return false;
  }
  const query = resultSummaries?.[0]?.summary;
  const artifact = resultSummaries?.[1]?.summary?.artifact;
  const fields = new Set([
    'queryState',
    'returnedItems',
    'rendered',
    'artifactMimeType',
    'artifactWidth',
    'artifactHeight',
    'notExhaustive',
  ]);
  return (
    exactKeys(parsed, fields) &&
    parsed.queryState === query?.resultState &&
    parsed.returnedItems === query?.returnedItems &&
    parsed.rendered === true &&
    parsed.artifactMimeType === artifact?.mimeType &&
    parsed.artifactWidth === artifact?.width &&
    parsed.artifactHeight === artifact?.height &&
    parsed.notExhaustive === true
  );
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
    report.toolNames?.[0] === claim.toolName &&
    report.argumentProfile === claim.argumentProfile &&
    report.expectedArgumentsSha256 === claim.expectedArgumentsSha256
  );
}

function buildReceiptPayload(report, { eventStreamSha256, serverSummarySha256 }) {
  if (
    !/^[0-9a-f]{64}$/u.test(eventStreamSha256 ?? '') ||
    !/^[0-9a-f]{64}$/u.test(serverSummarySha256 ?? '')
  ) {
    throw new TypeError('Title query/render receipt requires exact sanitized run inputs.');
  }
  return {
    schemaVersion: 1,
    kind: RECEIPT_KIND,
    sanitizedReportSha256: canonicalHash({ ...report, runnerReceipt: null }),
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
    toolNames: report.toolNames,
    argumentProfile: report.argumentProfile,
    expectedArgumentsSha256: report.expectedArgumentsSha256,
    eventStreamSha256,
    serverSummarySha256,
    answerSha256: report.answerSha256,
    resultSummariesSha256: canonicalHash(report.resultSummaries),
    answerChecksSha256: canonicalHash(report.answerChecks),
  };
}

function createRunnerReceipt(report, hashes, { privateKey, publicKeyBase64 }) {
  const payload = buildReceiptPayload(report, hashes);
  const publicKeyDer = Buffer.from(publicKeyBase64, 'base64');
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

export function validateTitleQueryRenderProfileReport(report, claim, reportBytes = null, root = ROOT) {
  if (
    !PROFILE ||
    !assertTitleQueryRenderPublicProfile(PROFILE) ||
    !report ||
    typeof report !== 'object' ||
    Array.isArray(report) ||
    !exactKeys(report, REPORT_FIELDS)
  ) {
    return { passed: false, reason: 'TITLE_QUERY_RENDER_REPORT_FIELDS_INVALID' };
  }
  const receipt = report.runnerReceipt;
  const answerChecks = report.answerChecks;
  const selectionPath = path.join(root, PROFILE.selectionEvidencePath);
  let selectionBytes;
  try {
    selectionBytes = readFileSync(selectionPath);
  } catch {
    return { passed: false, reason: 'TITLE_QUERY_RENDER_SELECTION_EVIDENCE_MISSING' };
  }
  const valid =
    matchesClaim(report, claim) &&
    report.schemaVersion === 1 &&
    report.evidenceKind === PROFILE.evidenceKind &&
    report.runNumber === 95 &&
    report.frontierId === 'G01' &&
    report.scenarioId === null &&
    report.epochId === PROFILE.epochId &&
    report.profileId === PROFILE.id &&
    report.profile === 'codex-luna-max-anonymous-title-query-render-agent-mcp-v1' &&
    report.model === 'gpt-6-luna' &&
    report.reasoningEffort === 'max' &&
    /^gpt-6-luna-max-run95-pr\d+-round\d+$/u.test(report.reviewerId ?? '') &&
    /^\d+\.\d+\.\d+$/u.test(report.codexCliVersion ?? '') &&
    Number.isFinite(Date.parse(report.observedAt ?? '')) &&
    /^[0-9a-f]{40}$/u.test(report.sourceRevision ?? '') &&
    /^[0-9a-f]{40}$/u.test(report.baseSha ?? '') &&
    report.ciSha === report.sourceRevision &&
    report.ciStatus === 'SUCCESS' &&
    Number.isSafeInteger(report.prNumber) &&
    report.prNumber > 0 &&
    new RegExp(`^profile-run-95-pr-${report.prNumber}-${report.sourceRevision.slice(0, 12)}-\\d+$`, 'u').test(
      report.claimId ?? '',
    ) &&
    /^[0-9a-f]{64}$/u.test(report.mcpBundleSha256 ?? '') &&
    report.registrySha256 === agentMcpProfileRegistrySha256(PROFILE.id) &&
    report.selectionEvidenceSha256 === sha256(selectionBytes) &&
    canonicalAgentMcpProfileJson(report.toolNames) ===
      canonicalAgentMcpProfileJson(TITLE_QUERY_RENDER_TOOL_NAMES) &&
    report.argumentProfile === PROFILE.argumentProfile &&
    report.expectedArgumentsSha256 === agentMcpProfileArgumentsSha256(PROFILE) &&
    report.networkMode === TITLE_QUERY_RENDER_NETWORK_MODE &&
    catalogEvidenceMatches(report, root) &&
    /^[0-9a-f]{64}$/u.test(report.catalogSha256 ?? '') &&
    Array.isArray(report.toolDescriptors) &&
    report.toolDescriptors.length === 2 &&
    report.toolDescriptors.every(
      (item, index) =>
        exactKeys(
          item,
          new Set(['toolName', 'descriptionSha256', 'inputSchemaSha256']),
        ) &&
        item.toolName === TITLE_QUERY_RENDER_TOOL_NAMES[index] &&
        /^[0-9a-f]{64}$/u.test(item.descriptionSha256 ?? '') &&
        /^[0-9a-f]{64}$/u.test(item.inputSchemaSha256 ?? ''),
    ) &&
    canonicalAgentMcpProfileJson(report.serverToolNames) ===
      canonicalAgentMcpProfileJson(TITLE_QUERY_RENDER_TOOL_NAMES) &&
    report.serverToolCount === 2 &&
    /^[0-9a-f-]{36}$/u.test(report.serverInstanceId ?? '') &&
    canonicalAgentMcpProfileJson(report.rendererAssetBoundary) ===
      canonicalAgentMcpProfileJson(RENDERER_ASSET_BOUNDARY) &&
    canonicalAgentMcpProfileJson(report.mcpServerNames) ===
      canonicalAgentMcpProfileJson([TITLE_QUERY_RENDER_SERVER_ID]) &&
    report.processExitCode === 0 &&
    report.resultStatus === 'SUCCESS' &&
    report.codexRunCount === 1 &&
    report.eventStreamParsed === true &&
    report.turnCompleted === true &&
    report.codexMcpToolEventCount === 2 &&
    report.codexErrorItemCount === 0 &&
    report.nonMcpToolEventCount === 0 &&
    canonicalAgentMcpProfileJson(report.nonMcpToolTypes) === '[]' &&
    report.shellToolCallCount === 0 &&
    report.allowedCallCount === 2 &&
    report.deniedCallCount === 0 &&
    validRequestScope(report.publicRequestScope) &&
    report.answerCheckMethod === PROFILE.answerCheckMethod &&
    /^[0-9a-f]{64}$/u.test(report.answerSha256 ?? '') &&
    safeCount(report.answerUtf8Bytes, PROFILE.maxAnswerBytes) &&
    report.answerUtf8Bytes > 0 &&
    exactKeys(answerChecks, ANSWER_CHECK_FIELDS) &&
    Object.values(answerChecks).every((value) => value === true) &&
    validResultSummaries(report.resultSummaries) &&
    canonicalAgentMcpProfileJson(report.privacy) === canonicalAgentMcpProfileJson(PRIVACY) &&
    exactKeys(receipt, RECEIPT_FIELDS) &&
    exactKeys(receipt.payload, RECEIPT_PAYLOAD_FIELDS);
  if (!valid) return { passed: false, reason: 'TITLE_QUERY_RENDER_REPORT_VALUES_INVALID' };

  let signatureValid = false;
  try {
    const publicKeyDer = Buffer.from(claim.runnerReceiptPublicKey ?? '', 'base64');
    const publicKey = createPublicKey({ key: publicKeyDer, format: 'der', type: 'spki' });
    const payload = buildReceiptPayload(report, {
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
      receipt.publicKeySha256 === sha256(publicKeyDer) &&
      Buffer.from(receipt.signature, 'base64').toString('base64') === receipt.signature &&
      canonicalAgentMcpProfileJson(payload) ===
        canonicalAgentMcpProfileJson(receipt.payload) &&
      verify(
        null,
        Buffer.from(canonicalAgentMcpProfileJson(receipt.payload)),
        publicKey,
        Buffer.from(receipt.signature, 'base64'),
      );
  } catch {
    signatureValid = false;
  }
  if (!signatureValid) return { passed: false, reason: 'TITLE_QUERY_RENDER_RECEIPT_INVALID' };
  if (reportBytes && reportBytes.length > 64 * 1024)
    return { passed: false, reason: 'TITLE_QUERY_RENDER_REPORT_TOO_LARGE' };
  return { passed: true, reportPath: REPORT_RELATIVE_PATH };
}

export function buildTitleQueryRenderProfileReport(
  { claim, serverSummary, events, answer, codexCliVersion, eventStreamSha256, serverSummarySha256 },
  { privateKey, root = ROOT } = {},
) {
  if (
    !PROFILE ||
    !assertTitleQueryRenderPublicProfile(PROFILE) ||
    !serverSummary ||
    !validateTitleQueryRenderServerSummary(
      serverSummary,
      claim?.sourceCandidateSha,
      claim?.bundleSha256,
      root,
    ) ||
    !events ||
    events.codexRunCount !== 1 ||
    events.processExitCode !== 0 ||
    events.eventStreamParsed !== true ||
    events.turnCompleted !== true ||
    events.codexMcpToolEventCount !== 2 ||
    events.codexErrorItemCount !== 0 ||
    events.nonMcpToolEventCount !== 0 ||
    events.shellToolCallCount !== 0 ||
    events.exactCallSequence !== true ||
    events.exactToolEvents !== true ||
    events.answerValid !== true ||
    !validResultSummaries(serverSummary.results?.map((result) => ({
      toolName: result?.toolName,
      summary: result?.resultSummary,
    }))) ||
    !isTitleQueryRenderAnswerValid(answer, serverSummary.results.map((result) => ({
      toolName: result.toolName,
      summary: result.resultSummary,
    })))
  ) {
    return { passed: false, reason: 'TITLE_QUERY_RENDER_RUNNER_GATE_INVALID' };
  }
  let selectionBytes;
  try {
    selectionBytes = readFileSync(path.join(root, PROFILE.selectionEvidencePath));
  } catch {
    return { passed: false, reason: 'TITLE_QUERY_RENDER_SELECTION_EVIDENCE_MISSING' };
  }
  const resultSummaries = serverSummary.results.map((result) => ({
    toolName: result.toolName,
    summary: result.resultSummary,
  }));
  const answerChecks = {
    exactRegisteredSequence: true,
    exactArguments: true,
    boundedQueryObservation: true,
    answerMatchesObservedResults: isTitleQueryRenderAnswerValid(answer, resultSummaries),
    nonExhaustiveDisclosed: JSON.parse(answer).notExhaustive === true,
    ephemeralPngArtifact: validArtifactSummary(resultSummaries[1].summary),
    anonymousPublicRequestBudget: validRequestScope(serverSummary.publicRequestScope),
    rendererAssetNetworkDisabled:
      canonicalAgentMcpProfileJson(serverSummary.rendererAssetBoundary) ===
      canonicalAgentMcpProfileJson(RENDERER_ASSET_BOUNDARY),
    privacyPreserved: true,
    matrixOnlyScope: PROFILE.acceptanceScope === 'agent-mcp-matrix-only',
  };
  if (Object.values(answerChecks).some((value) => value !== true))
    return { passed: false, reason: 'TITLE_QUERY_RENDER_ANSWER_CHECKS_INVALID' };
  const report = {
    schemaVersion: 1,
    evidenceKind: PROFILE.evidenceKind,
    runNumber: 95,
    frontierId: PROFILE.frontierId,
    scenarioId: null,
    epochId: PROFILE.epochId,
    profileId: PROFILE.id,
    profile: 'codex-luna-max-anonymous-title-query-render-agent-mcp-v1',
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
    toolNames: [...TITLE_QUERY_RENDER_TOOL_NAMES],
    argumentProfile: PROFILE.argumentProfile,
    expectedArgumentsSha256: agentMcpProfileArgumentsSha256(PROFILE),
    catalogSha256: serverSummary.catalogSha256,
    toolDescriptors: serverSummary.toolDescriptors,
    serverToolNames: serverSummary.serverToolNames,
    serverToolCount: serverSummary.serverToolCount,
    serverInstanceId: serverSummary.serverInstanceId,
    rendererAssetBoundary: serverSummary.rendererAssetBoundary,
    networkMode: TITLE_QUERY_RENDER_NETWORK_MODE,
    mcpServerNames: events.mcpServerNames,
    processExitCode: events.processExitCode,
    resultStatus: 'SUCCESS',
    codexRunCount: 1,
    eventStreamParsed: events.eventStreamParsed,
    turnCompleted: events.turnCompleted,
    codexMcpToolEventCount: events.codexMcpToolEventCount,
    codexErrorItemCount: events.codexErrorItemCount,
    nonMcpToolEventCount: events.nonMcpToolEventCount,
    nonMcpToolTypes: events.nonMcpToolTypes,
    shellToolCallCount: events.shellToolCallCount,
    allowedCallCount: serverSummary.allowedCallCount,
    deniedCallCount: serverSummary.deniedCallCount,
    publicRequestScope: serverSummary.publicRequestScope,
    answerCheckMethod: PROFILE.answerCheckMethod,
    answerSha256: sha256(answer),
    answerUtf8Bytes: Buffer.byteLength(answer, 'utf8'),
    answerChecks,
    resultSummaries,
    privacy: { ...PRIVACY },
    runnerReceipt: null,
  };
  report.runnerReceipt = createRunnerReceipt(
    report,
    { eventStreamSha256, serverSummarySha256 },
    { privateKey, publicKeyBase64: claim.runnerReceiptPublicKey },
  );
  const validation = validateTitleQueryRenderProfileReport(report, claim, null, root);
  return validation.passed ? { passed: true, report } : validation;
}

export function validateTitleQueryRenderSanitizedReportFile(claim, root = ROOT, reportPath = null) {
  const target = reportPath ?? path.join(root, REPORT_RELATIVE_PATH);
  try {
    if (path.resolve(target) !== path.resolve(root, REPORT_RELATIVE_PATH))
      return { passed: false, reason: 'TITLE_QUERY_RENDER_REPORT_PATH_INVALID' };
    const bytes = readFileSync(target);
    const report = JSON.parse(bytes.toString('utf8'));
    const validation = validateTitleQueryRenderProfileReport(report, claim, bytes, root);
    if (!validation.passed) return validation;
    return {
      passed: true,
      reportPath: REPORT_RELATIVE_PATH,
      reportSha256: sha256(bytes),
      report,
    };
  } catch {
    return { passed: false, reason: 'TITLE_QUERY_RENDER_REPORT_UNAVAILABLE' };
  }
}

export function writeTitleQueryRenderProfileReport(report) {
  writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
  return REPORT_PATH;
}
