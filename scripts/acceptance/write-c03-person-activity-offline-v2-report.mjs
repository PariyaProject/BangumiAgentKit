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
  assertC03PersonActivityOfflineV2Profile,
  C03_PERSON_ACTIVITY_OFFLINE_V2_NETWORK_MODE,
  C03_PERSON_ACTIVITY_OFFLINE_V2_PROFILE_ID,
  C03_PERSON_ACTIVITY_TOOL_NAME,
  isC03PersonActivityOfflineV2Projection,
} from '../lib/c03-person-activity-offline-matrix-v2-profile.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PROFILE = getAgentMcpProfileById(C03_PERSON_ACTIVITY_OFFLINE_V2_PROFILE_ID);
const REPORT_RELATIVE_PATH = PROFILE?.reportPath;
const RECEIPT_KIND = 'c03-person-activity-offline-matrix-v2-runner-receipt-v1';
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
  'resultReadbackMatched',
  'answerEchoedToolResult',
  'outputSchemaApplied',
  'noScenarioCredit',
  'privacyPreserved',
]);
const OFFLINE_FIXTURE = Object.freeze({
  profile: C03_PERSON_ACTIVITY_OFFLINE_V2_NETWORK_MODE,
  requestCount: 3,
  personRequestCount: 1,
  characterRequestCount: 1,
  subjectDetailRequestCount: 1,
  unexpectedRequestCount: 0,
  authorizationHeaderCount: 0,
  expectedOperationsComplete: true,
  operations: ['person', 'characters', 'subject_detail'],
});
const NETWORK_BOUNDARY = Object.freeze({
  liveBangumiApiRequestCount: 0,
  unexpectedNetworkRequestCount: 0,
  rendererAssetRequestCount: 0,
  fullCodexHarnessNetworkSandboxed: false,
});
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
  rawFixtureRowsStored: false,
  rawToolResultStored: false,
  artifactImageBytesStored: false,
  credentialsStored: false,
});
const ANSWER_CHECKS = Object.freeze({
  exactRegisteredProfile: true,
  oneAllowedMcpTool: true,
  fixedArguments: true,
  exactCandidateBundle: true,
  offlineFixtureOnly: true,
  resultReadbackMatched: true,
  answerEchoedToolResult: true,
  outputSchemaApplied: true,
  noScenarioCredit: true,
  privacyPreserved: true,
});

function exactKeys(value, fields) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).sort().join('\0') === [...fields].sort().join('\0'),
  );
}

function catalogEvidence(root) {
  try {
    const bytes = readFileSync(path.join(root, 'docs/tool-catalog.json'));
    const catalog = JSON.parse(bytes.toString('utf8'));
    const tool = catalog.find((item) => item?.name === C03_PERSON_ACTIVITY_TOOL_NAME);
    if (!tool || tool.auth !== 'none' || tool.risk !== 'read') return null;
    return {
      catalogSha256: sha256(bytes),
      toolDescriptionSha256: sha256(tool.description),
      inputSchemaSha256: sha256(canonicalAgentMcpProfileJson(tool.inputSchema)),
    };
  } catch {
    return null;
  }
}

export function validateC03PersonActivityOfflineV2ServerSummary(
  summary,
  sourceRevision,
  bundleSha256,
  root = ROOT,
) {
  const result = summary?.results?.[0];
  const catalog = catalogEvidence(root);
  return Boolean(
    PROFILE &&
    assertC03PersonActivityOfflineV2Profile(PROFILE) &&
    catalog &&
    summary?.serverProfile === 'closed-profile-sequence-anonymous-offline-v1' &&
    summary.profileId === PROFILE.id &&
    summary.argumentProfile === PROFILE.argumentProfile &&
    summary.networkMode === C03_PERSON_ACTIVITY_OFFLINE_V2_NETWORK_MODE &&
    summary.expectedArgumentsSha256 === agentMcpProfileArgumentsSha256(PROFILE) &&
    summary.sourceRevision === sourceRevision &&
    summary.bundleSha256 === bundleSha256 &&
    summary.toolName === PROFILE.toolName &&
    summary.serverToolCount === 1 &&
    canonicalAgentMcpProfileJson(summary.serverToolNames) ===
      canonicalAgentMcpProfileJson([PROFILE.toolName]) &&
    summary.expectedCallCount === 1 &&
    summary.serverResultStatus === 'SUCCESS' &&
    summary.allowedCallCount === 1 &&
    summary.deniedCallCount === 0 &&
    Array.isArray(summary.results) &&
    summary.results.length === 1 &&
    result?.sequenceIndex === 0 &&
    result?.status === 'SUCCESS' &&
    isC03PersonActivityOfflineV2Projection(result.resultSummary) &&
    result.resultSummary.windowMonths === 12 &&
    exactKeys(summary.offlineFixture, new Set(Object.keys(OFFLINE_FIXTURE))) &&
    canonicalAgentMcpProfileJson(summary.offlineFixture) ===
      canonicalAgentMcpProfileJson(OFFLINE_FIXTURE) &&
    summary.catalogSha256 === catalog.catalogSha256 &&
    summary.toolDescriptionSha256 === catalog.toolDescriptionSha256 &&
    summary.inputSchemaSha256 === catalog.inputSchemaSha256,
  );
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

export function buildC03PersonActivityOfflineV2RunnerReceiptPayload(
  report,
  { eventStreamSha256, serverSummarySha256 },
) {
  if (
    !report ||
    typeof report !== 'object' ||
    !/^[0-9a-f]{64}$/u.test(eventStreamSha256 ?? '') ||
    !/^[0-9a-f]{64}$/u.test(serverSummarySha256 ?? '')
  ) {
    throw new TypeError('C03 v2 receipt requires exact sanitized execution inputs.');
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
    throw new Error('C03 v2 receipt requires a canonical Ed25519 public key.');
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

export function validateC03PersonActivityOfflineV2Report(
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
    !assertC03PersonActivityOfflineV2Profile(PROFILE) ||
    !exactKeys(report, REPORT_FIELDS) ||
    claim?.profileId !== PROFILE.id ||
    !claimStateValid ||
    claim.retryAllowed !== false ||
    !isValidP06CiRunEvidence({ ciRunId: report?.ciRunId, ciChecks: report?.ciChecks }) ||
    !matchesClaim(report, claim)
  ) {
    return { passed: false, reason: 'C03_ACTIVITY_V2_REPORT_CLAIM_INVALID' };
  }

  let selectionBytes;
  try {
    selectionBytes = readFileSync(path.join(root, PROFILE.selectionEvidencePath));
  } catch {
    return { passed: false, reason: 'C03_ACTIVITY_V2_SELECTION_EVIDENCE_MISSING' };
  }
  const catalog = catalogEvidence(root);
  const valid = Boolean(
    catalog &&
    report.evidenceKind === PROFILE.evidenceKind &&
    report.runNumber === 95 &&
    report.frontierId === 'C03' &&
    report.scenarioId === null &&
    report.epochId === PROFILE.epochId &&
    report.profileId === PROFILE.id &&
    report.profile === 'codex-luna-max-offline-agent-mcp-matrix-v2' &&
    report.model === 'gpt-6-luna' &&
    report.reasoningEffort === 'max' &&
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
    report.registrySha256 === agentMcpProfileRegistrySha256(PROFILE.id) &&
    report.selectionEvidenceSha256 === sha256(selectionBytes) &&
    report.toolName === PROFILE.toolName &&
    report.argumentProfile === PROFILE.argumentProfile &&
    report.expectedArgumentsSha256 === agentMcpProfileArgumentsSha256(PROFILE) &&
    report.catalogSha256 === catalog.catalogSha256 &&
    report.toolDescriptionSha256 === catalog.toolDescriptionSha256 &&
    report.inputSchemaSha256 === catalog.inputSchemaSha256 &&
    canonicalAgentMcpProfileJson(report.serverToolNames) ===
      canonicalAgentMcpProfileJson([PROFILE.toolName]) &&
    report.serverToolCount === 1 &&
    report.networkMode === C03_PERSON_ACTIVITY_OFFLINE_V2_NETWORK_MODE &&
    canonicalAgentMcpProfileJson(report.mcpServerNames) ===
      canonicalAgentMcpProfileJson(['bgk_c03_person_activity_offline_v2']) &&
    report.processExitCode === 0 &&
    report.resultStatus === 'SUCCESS' &&
    report.eventStreamParsed === true &&
    report.turnCompleted === true &&
    report.codexMcpToolEventCount === 1 &&
    report.codexErrorItemCount === 0 &&
    report.nonMcpToolEventCount === 0 &&
    canonicalAgentMcpProfileJson(report.nonMcpToolTypes) === '[]' &&
    report.shellToolCallCount === 0 &&
    report.allowedCallCount === 1 &&
    report.deniedCallCount === 0 &&
    report.answerCheckMethod === PROFILE.answerCheckMethod &&
    /^[0-9a-f]{64}$/u.test(report.answerSha256 ?? '') &&
    Number.isSafeInteger(report.answerUtf8Bytes) &&
    report.answerUtf8Bytes > 0 &&
    report.answerUtf8Bytes <= PROFILE.maxAnswerBytes &&
    isC03PersonActivityOfflineV2Projection(report.resultSummary) &&
    report.resultSummary.windowMonths === 12 &&
    exactKeys(report.offlineFixture, new Set(Object.keys(OFFLINE_FIXTURE))) &&
    canonicalAgentMcpProfileJson(report.offlineFixture) ===
      canonicalAgentMcpProfileJson(OFFLINE_FIXTURE) &&
    canonicalAgentMcpProfileJson(report.networkBoundary) ===
      canonicalAgentMcpProfileJson(NETWORK_BOUNDARY) &&
    canonicalAgentMcpProfileJson(report.privacy) === canonicalAgentMcpProfileJson(PRIVACY) &&
    exactKeys(report.answerChecks, ANSWER_CHECK_FIELDS) &&
    canonicalAgentMcpProfileJson(report.answerChecks) ===
      canonicalAgentMcpProfileJson(ANSWER_CHECKS) &&
    exactKeys(report.runnerReceipt, RECEIPT_FIELDS) &&
    exactKeys(report.runnerReceipt.payload, RECEIPT_PAYLOAD_FIELDS),
  );
  if (!valid) return { passed: false, reason: 'C03_ACTIVITY_V2_REPORT_FIELDS_INVALID' };

  let receiptValid = false;
  try {
    const receipt = report.runnerReceipt;
    const publicKeyDer = Buffer.from(receipt.publicKeyBase64, 'base64');
    const publicKey = createPublicKey({ key: publicKeyDer, format: 'der', type: 'spki' });
    const payload = buildC03PersonActivityOfflineV2RunnerReceiptPayload(report, {
      eventStreamSha256: receipt.payload.eventStreamSha256,
      serverSummarySha256: receipt.payload.serverSummarySha256,
    });
    receiptValid =
      receipt.schemaVersion === 1 &&
      receipt.kind === RECEIPT_KIND &&
      receipt.payload.schemaVersion === 1 &&
      receipt.payload.kind === RECEIPT_KIND &&
      receipt.publicKeyBase64 === claim.runnerReceiptPublicKey &&
      receipt.publicKeySha256 === claim.runnerReceiptPublicKeySha256 &&
      publicKey.asymmetricKeyType === 'ed25519' &&
      sha256(publicKeyDer) === receipt.publicKeySha256 &&
      canonicalAgentMcpProfileJson(payload) === canonicalAgentMcpProfileJson(receipt.payload) &&
      /^[0-9a-f]{64}$/u.test(receipt.payload.eventStreamSha256) &&
      /^[0-9a-f]{64}$/u.test(receipt.payload.serverSummarySha256) &&
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
  if (!receiptValid) return { passed: false, reason: 'C03_ACTIVITY_V2_RECEIPT_INVALID' };
  if (reportBytes && reportBytes.length > 64 * 1024) {
    return { passed: false, reason: 'C03_ACTIVITY_V2_REPORT_TOO_LARGE' };
  }
  return { passed: true, reportPath: REPORT_RELATIVE_PATH };
}

export function writeC03PersonActivityOfflineV2Report(
  { claim, serverSummary, events, answer, codexCliVersion, eventStreamSha256, serverSummarySha256 },
  { privateKey, root = ROOT } = {},
) {
  const catalog = catalogEvidence(root);
  let answerProjection;
  try {
    answerProjection = JSON.parse(answer);
  } catch {
    return { passed: false, reason: 'C03_ACTIVITY_V2_ANSWER_JSON_INVALID' };
  }
  if (
    !PROFILE ||
    !assertC03PersonActivityOfflineV2Profile(PROFILE) ||
    claim?.profileId !== PROFILE.id ||
    claim.state !== 'CLAIMED' ||
    claim.retryAllowed !== false ||
    !isValidP06CiRunEvidence({ ciRunId: claim.ciRunId, ciChecks: claim.ciChecks }) ||
    !validateC03PersonActivityOfflineV2ServerSummary(
      serverSummary,
      claim.sourceCandidateSha,
      claim.bundleSha256,
      root,
    ) ||
    !events ||
    events.processExitCode !== 0 ||
    events.eventStreamParsed !== true ||
    events.turnCompleted !== true ||
    events.codexMcpToolEventCount !== 1 ||
    events.codexErrorItemCount !== 0 ||
    events.nonMcpToolEventCount !== 0 ||
    events.shellToolCallCount !== 0 ||
    events.allowedCallCount !== 1 ||
    events.deniedCallCount !== 0 ||
    events.exactCall !== true ||
    events.exactToolEvent !== true ||
    events.resultReadbackMatched !== true ||
    events.answerEchoedToolResult !== true ||
    events.outputSchemaApplied !== true ||
    canonicalAgentMcpProfileJson(events.mcpServerNames) !==
      canonicalAgentMcpProfileJson(['bgk_c03_person_activity_offline_v2']) ||
    typeof answer !== 'string' ||
    Buffer.byteLength(answer, 'utf8') > PROFILE.maxAnswerBytes ||
    !isC03PersonActivityOfflineV2Projection(answerProjection) ||
    canonicalAgentMcpProfileJson(answerProjection) !==
      canonicalAgentMcpProfileJson(serverSummary.results[0].resultSummary)
  ) {
    return { passed: false, reason: 'C03_ACTIVITY_V2_RUNNER_GATE_INVALID' };
  }

  let selectionBytes;
  try {
    selectionBytes = readFileSync(path.join(root, PROFILE.selectionEvidencePath));
  } catch {
    return { passed: false, reason: 'C03_ACTIVITY_V2_SELECTION_EVIDENCE_MISSING' };
  }
  if (!catalog || !privateKey || typeof claim.runnerReceiptPublicKey !== 'string') {
    return { passed: false, reason: 'C03_ACTIVITY_V2_REPORT_INPUT_INVALID' };
  }
  let report;
  try {
    report = {
      schemaVersion: 1,
      evidenceKind: PROFILE.evidenceKind,
      runNumber: 95,
      frontierId: 'C03',
      scenarioId: null,
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
      registrySha256: agentMcpProfileRegistrySha256(PROFILE.id),
      selectionEvidenceSha256: sha256(selectionBytes),
      toolName: PROFILE.toolName,
      argumentProfile: PROFILE.argumentProfile,
      expectedArgumentsSha256: agentMcpProfileArgumentsSha256(PROFILE),
      ...catalog,
      serverToolNames: [PROFILE.toolName],
      serverToolCount: 1,
      networkMode: C03_PERSON_ACTIVITY_OFFLINE_V2_NETWORK_MODE,
      mcpServerNames: ['bgk_c03_person_activity_offline_v2'],
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
      answerCheckMethod: PROFILE.answerCheckMethod,
      answerSha256: sha256(answer),
      answerUtf8Bytes: Buffer.byteLength(answer, 'utf8'),
      answerChecks: ANSWER_CHECKS,
      resultSummary: serverSummary.results[0].resultSummary,
      offlineFixture: OFFLINE_FIXTURE,
      networkBoundary: NETWORK_BOUNDARY,
      privacy: PRIVACY,
      runnerReceipt: null,
    };
    report.runnerReceipt = createRunnerReceipt(
      buildC03PersonActivityOfflineV2RunnerReceiptPayload(report, {
        eventStreamSha256,
        serverSummarySha256,
      }),
      { publicKeyBase64: claim.runnerReceiptPublicKey, privateKey },
    );
  } catch {
    return { passed: false, reason: 'C03_ACTIVITY_V2_REPORT_BUILD_FAILED' };
  }
  const validation = validateC03PersonActivityOfflineV2Report(report, claim, null, root);
  if (!validation.passed) return validation;
  const bytes = Buffer.from(`${JSON.stringify(report, null, 2)}\n`, 'utf8');
  if (bytes.length > 64 * 1024)
    return { passed: false, reason: 'C03_ACTIVITY_V2_REPORT_TOO_LARGE' };
  const target = path.join(root, REPORT_RELATIVE_PATH);
  let descriptor;
  try {
    descriptor = openSync(target, 'wx', 0o600);
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
    return { passed: false, reason: 'C03_ACTIVITY_V2_REPORT_EXISTS_OR_UNWRITABLE' };
  }
  return {
    passed: true,
    reportPath: REPORT_RELATIVE_PATH,
    reportSha256: sha256(bytes),
    answerChecks: ANSWER_CHECKS,
  };
}

export function validateC03PersonActivityOfflineV2SanitizedReportFile(
  claim,
  root = ROOT,
  reportPath = null,
) {
  try {
    if (!PROFILE || !assertC03PersonActivityOfflineV2Profile(PROFILE)) {
      return { passed: false, reason: 'C03_ACTIVITY_V2_PROFILE_INVALID' };
    }
    const expectedPath = path.resolve(root, REPORT_RELATIVE_PATH);
    const target = path.resolve(reportPath ?? expectedPath);
    if (target !== expectedPath)
      return { passed: false, reason: 'C03_ACTIVITY_V2_REPORT_PATH_INVALID' };
    const bytes = readFileSync(target);
    const report = JSON.parse(bytes.toString('utf8'));
    const validation = validateC03PersonActivityOfflineV2Report(report, claim, bytes, root);
    return validation.passed
      ? { ...validation, report, reportPath: REPORT_RELATIVE_PATH, reportSha256: sha256(bytes) }
      : validation;
  } catch {
    return { passed: false, reason: 'C03_ACTIVITY_V2_REPORT_UNAVAILABLE' };
  }
}
