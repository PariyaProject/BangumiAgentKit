import { createHash, createPublicKey, sign, verify } from 'node:crypto';
import { closeSync, existsSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  agentMcpProfileArgumentsSha256,
  agentMcpProfileRegistrySha256,
  canonicalAgentMcpProfileJson,
  getAgentMcpProfileById,
} from '../lib/agent-mcp-profile-claims.mjs';
import {
  A01_AGGREGATE_COHORT_OFFLINE_PROFILE_ID,
  A01_AGGREGATE_COHORT_OFFLINE_PROFILE_IDS,
  A01_AGGREGATE_COHORT_TOOL,
  assertA01AggregateCohortOfflineProfile,
  getA01AggregateCohortOfflineProfileSpec,
} from '../lib/a01-aggregate-cohort-offline-matrix-profile.mjs';
import { buildG06PrivacySummary } from '../lib/g06-privacy-summary.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
let PROFILE = getAgentMcpProfileById(A01_AGGREGATE_COHORT_OFFLINE_PROFILE_ID);
if (!PROFILE) throw new Error('A01 aggregate matrix profile is not registered.');
let REPORT_PATH = path.join(ROOT, PROFILE.reportPath);
let SERVER_ID = 'bgk_a01_aggregate_cohort_offline_v1';
let EXPECTED_METRICS = getA01AggregateCohortOfflineProfileSpec(PROFILE).expectedMetrics;
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const canonical = (value) => canonicalAgentMcpProfileJson(value);

function selectA01AggregateProfile(profileId) {
  if (!A01_AGGREGATE_COHORT_OFFLINE_PROFILE_IDS.includes(profileId)) {
    throw new Error('Unknown A01 aggregate matrix report profile.');
  }
  PROFILE = getAgentMcpProfileById(profileId);
  const spec = getA01AggregateCohortOfflineProfileSpec(PROFILE);
  if (!PROFILE || !spec) throw new Error('A01 aggregate matrix report profile is not registered.');
  assertA01AggregateCohortOfflineProfile(PROFILE);
  REPORT_PATH = path.join(ROOT, PROFILE.reportPath);
  SERVER_ID = profileId === A01_AGGREGATE_COHORT_OFFLINE_PROFILE_ID
    ? 'bgk_a01_aggregate_cohort_offline'
    : 'bgk_a01_aggregate_cohort_offline_v2';
  EXPECTED_METRICS = spec.expectedMetrics;
}

function exactKeys(value, keys) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    canonical(Object.keys(value).sort()) === canonical([...keys].sort()),
  );
}

function expectedFixture() {
  return {
    profile: PROFILE.id,
    requestCount: 2,
    searchRequestCount: 1,
    detailRequestCount: 1,
    unexpectedRequestCount: 0,
    authorizationHeaderCount: 0,
    expectedOperationsComplete: true,
  };
}

function validProfileClaim(claim) {
  let publicKey = null;
  try {
    const bytes = Buffer.from(claim?.runnerReceiptPublicKey ?? '', 'base64');
    if (bytes.toString('base64') === claim.runnerReceiptPublicKey) {
      publicKey = createPublicKey({ key: bytes, format: 'der', type: 'spki' });
    }
  } catch {
    publicKey = null;
  }
  return Boolean(
    claim &&
    ['CLAIMED', 'REPORT_WRITTEN'].includes(claim.state) &&
    claim.runNumber === 95 &&
    claim.frontierId === PROFILE.frontierId &&
    claim.epochId === PROFILE.epochId &&
    claim.profileId === PROFILE.id &&
    claim.toolName === A01_AGGREGATE_COHORT_TOOL &&
    claim.argumentProfile === PROFILE.argumentProfile &&
    claim.retryAllowed === false &&
    ((claim.state === 'CLAIMED' && claim.reportWritten === false) ||
      (claim.state === 'REPORT_WRITTEN' && claim.reportWritten === true)) &&
    /^profile-run-95-pr-\d+-[0-9a-f]{12}-\d+$/u.test(claim.claimId ?? '') &&
    Number.isSafeInteger(claim.prNumber) &&
    claim.prNumber >= 1 &&
    /^[0-9a-f]{40}$/u.test(claim.sourceCandidateSha ?? '') &&
    /^[0-9a-f]{40}$/u.test(claim.baseSha ?? '') &&
    claim.ciSha === claim.sourceCandidateSha &&
    claim.ciStatus === 'SUCCESS' &&
    typeof claim.reviewerId === 'string' &&
    new RegExp(`^gpt-6-luna-max-run95-pr${claim.prNumber}-round[1-9]\\d*$`, 'u').test(
      claim.reviewerId,
    ) &&
    /^[0-9a-f]{64}$/u.test(claim.bundleSha256 ?? '') &&
    publicKey?.asymmetricKeyType === 'ed25519' &&
    /^[0-9a-f]{64}$/u.test(claim.runnerReceiptPublicKeySha256 ?? '') &&
    sha256(Buffer.from(claim.runnerReceiptPublicKey, 'base64')) ===
      claim.runnerReceiptPublicKeySha256 &&
    claim.expectedArgumentsSha256 === agentMcpProfileArgumentsSha256(PROFILE) &&
    claim.registrySha256 === agentMcpProfileRegistrySha256(PROFILE.id),
  );
}

function validMetricSummary(metric, expected) {
  return Boolean(
    exactKeys(metric, [
      'key',
      'state',
      'averages',
      'partialAverages',
      'validCounts',
      'partialCounts',
      'missingCounts',
      'conflictCounts',
      'notComputableCounts',
    ]) &&
    metric.key === expected.key &&
    metric.state === 'complete' &&
    Array.isArray(metric.averages) &&
    metric.averages.length === 1 &&
    typeof metric.averages[0] === 'number' &&
    Math.abs(metric.averages[0] - expected.value) < 1e-10 &&
    metric.partialAverages.length === 0 &&
    [
      'validCounts',
      'partialCounts',
      'missingCounts',
      'conflictCounts',
      'notComputableCounts',
    ].every((key) => Array.isArray(metric[key]) && metric[key].length === 1) &&
    metric.validCounts?.[0] === 1 &&
    metric.partialCounts?.[0] === 0 &&
    metric.missingCounts?.[0] === 0 &&
    metric.conflictCounts?.[0] === 0 &&
    metric.notComputableCounts?.[0] === 0,
  );
}

function validResultSummary(summary) {
  return Boolean(
    exactKeys(summary, [
      'resultState',
      'cohortCount',
      'cohorts',
      'metricCount',
      'metrics',
      'coverage',
    ]) &&
    summary.resultState === 'complete' &&
    summary.cohortCount === 1 &&
    Array.isArray(summary.cohorts) &&
    summary.cohorts.length === 1 &&
    exactKeys(summary.cohorts[0], [
      'queryState',
      'subjectCount',
      'detailHydrationsAttempted',
      'detailHydrationsSucceeded',
      'detailHydrationsFailed',
    ]) &&
    summary.cohorts[0].queryState === 'ok' &&
    summary.cohorts[0].subjectCount === 1 &&
    summary.cohorts[0].detailHydrationsAttempted === 1 &&
    summary.cohorts[0].detailHydrationsSucceeded === 1 &&
    summary.cohorts[0].detailHydrationsFailed === 0 &&
    summary.metricCount === EXPECTED_METRICS.length &&
    Array.isArray(summary.metrics) &&
    summary.metrics.length === EXPECTED_METRICS.length &&
    summary.metrics.every((metric, index) => validMetricSummary(metric, EXPECTED_METRICS[index])) &&
    exactKeys(summary.coverage, [
      'maxSubjectsPerCohort',
      'totalSubjectsReturned',
      'cohortsComplete',
      'cohortsPartial',
      'detailHydrationsAttempted',
      'detailHydrationsSucceeded',
      'detailHydrationsFailed',
      'truncated',
    ]) &&
    summary.coverage.maxSubjectsPerCohort === 1 &&
    summary.coverage.totalSubjectsReturned === 1 &&
    summary.coverage.cohortsComplete === 1 &&
    summary.coverage.cohortsPartial === 0 &&
    summary.coverage.detailHydrationsAttempted === 1 &&
    summary.coverage.detailHydrationsSucceeded === 1 &&
    summary.coverage.detailHydrationsFailed === 0 &&
    summary.coverage.truncated === false,
  );
}

function expectedAnswer(summary) {
  return {
    resultState: summary.resultState,
    queryState: summary.cohorts[0].queryState,
    subjectCount: summary.cohorts[0].subjectCount,
    metrics: summary.metrics.map((metric) => ({
      key: metric.key,
      state: metric.state,
      average: metric.averages[0],
      validCount: metric.validCounts[0],
    })),
    coverage: {
      detailHydrationsAttempted: summary.coverage.detailHydrationsAttempted,
      detailHydrationsSucceeded: summary.coverage.detailHydrationsSucceeded,
      detailHydrationsFailed: summary.coverage.detailHydrationsFailed,
      truncated: summary.coverage.truncated,
    },
  };
}

function parseAnswer(answer) {
  if (typeof answer !== 'string' || Buffer.byteLength(answer, 'utf8') > PROFILE.maxAnswerBytes) {
    return null;
  }
  try {
    const value = JSON.parse(answer);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

export function validateA01AggregateCohortProfileRun(input) {
  try {
    selectA01AggregateProfile(input?.claim?.profileId);
  } catch {
    return { passed: false, reason: 'A01_AGGREGATE_MATRIX_CLAIM_INVALID', answerChecks: null };
  }
  if (!validProfileClaim(input?.claim)) {
    return { passed: false, reason: 'A01_AGGREGATE_MATRIX_CLAIM_INVALID', answerChecks: null };
  }
  const claim = input.claim;
  const summary = input.serverSummary;
  const events = input.events;
  const call = input.completedMcpCalls?.[0];
  const resultSummary = summary?.results?.[0]?.resultSummary;
  const parsedAnswer = parseAnswer(input.answer);
  const answerChecks = {
    fixedArguments:
      canonical(call?.arguments) === canonical(PROFILE.calls[0].arguments),
    singleToolInvocation:
      events?.codexMcpToolEventCount === 1 &&
      events?.completedMcpCalls?.length === 1 &&
      events?.toolCalls?.length === 1 &&
      events?.toolCalls?.[0]?.name === A01_AGGREGATE_COHORT_TOOL &&
      events?.toolCalls?.[0]?.state === 'DONE' &&
      canonical(events?.mcpServerNames) === canonical([SERVER_ID]),
    structuredResultReadback:
      validResultSummary(resultSummary) &&
      canonical(call?.result?.structuredContent) === canonical(resultSummary) &&
      call?.result?.isError !== true,
    exactMetricAndCoverageAnswer:
      parsedAnswer !== null && canonical(parsedAnswer) === canonical(expectedAnswer(resultSummary)),
    offlineFixtureBounded: canonical(summary?.offlineFixture) === canonical(expectedFixture()),
  };
  const serverSummaryValid = Boolean(
    exactKeys(summary, [
      'schemaVersion',
      'serverProfile',
      'profileId',
      'argumentProfile',
      'expectedCallCount',
      'networkMode',
      'sourceRevision',
      'bundleSha256',
      'catalogSha256',
      'toolName',
      'toolDescriptionSha256',
      'inputSchemaSha256',
      'serverToolNames',
      'serverToolCount',
      'expectedArgumentsSha256',
      'serverResultStatus',
      'allowedCallCount',
      'deniedCallCount',
      'argumentMatch',
      'results',
      'offlineFixture',
      'privacy',
      'serverInstanceId',
    ]) &&
    summary.schemaVersion === 1 &&
    summary.serverProfile === 'closed-profile-sequence-anonymous-offline-v1' &&
    summary.profileId === PROFILE.id &&
    summary.argumentProfile === PROFILE.argumentProfile &&
    summary.expectedCallCount === 1 &&
    summary.networkMode === PROFILE.networkMode &&
    summary.sourceRevision === claim.sourceCandidateSha &&
    summary.bundleSha256 === claim.bundleSha256 &&
    summary.toolName === A01_AGGREGATE_COHORT_TOOL &&
    canonical(summary.serverToolNames) === canonical([A01_AGGREGATE_COHORT_TOOL]) &&
    summary.serverToolCount === 1 &&
    summary.expectedArgumentsSha256 === claim.expectedArgumentsSha256 &&
    summary.serverResultStatus === 'SUCCESS' &&
    summary.allowedCallCount === 1 &&
    summary.deniedCallCount === 0 &&
    summary.argumentMatch === true &&
    Array.isArray(summary.results) &&
    summary.results.length === 1 &&
    summary.results[0]?.sequenceIndex === 0 &&
    summary.results[0]?.status === 'SUCCESS' &&
    canonical(summary.privacy) === canonical(buildG06PrivacySummary()) &&
    /^[0-9a-f]{64}$/u.test(summary.catalogSha256 ?? '') &&
    /^[0-9a-f]{64}$/u.test(summary.toolDescriptionSha256 ?? '') &&
    /^[0-9a-f]{64}$/u.test(summary.inputSchemaSha256 ?? '') &&
    typeof summary.serverInstanceId === 'string' &&
    /^[0-9a-f-]{36}$/u.test(summary.serverInstanceId),
  );
  const eventStreamValid = Boolean(
    input.processSpawned === true &&
    input.processTimedOut === false &&
    input.processExitCode === 0 &&
    input.eventStreamParsed === true &&
    events?.eventStreamComplete === true &&
    events?.codexErrorItemCount === 0 &&
    events?.nonMcpToolEventCount === 0 &&
    events?.shellToolCallCount === 0 &&
    canonical(events?.mcpServerNames) === canonical([SERVER_ID]) &&
    events?.completedMcpCalls?.length === 1 &&
    events?.toolCalls?.length === 1,
  );
  const passed = Boolean(
    serverSummaryValid &&
    eventStreamValid &&
    Object.values(answerChecks).every(Boolean) &&
    Number.isSafeInteger(input.stdoutBytes) &&
    input.stdoutBytes >= 0 &&
    input.stdoutBytes <= 8 * 1024 * 1024 &&
    Number.isSafeInteger(input.stderrBytes) &&
    input.stderrBytes >= 0 &&
    input.stderrBytes <= 8 * 1024 * 1024 &&
    typeof input.codexCliVersion === 'string' &&
    input.codexCliVersion.length <= 128 &&
    /^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/u.test(input.codexCliVersion),
  );
  return {
    passed,
    reason: passed ? null : 'A01_AGGREGATE_MATRIX_AGENT_MCP_ASSERTION_FAILED',
    answerChecks,
    resultSummary: validResultSummary(resultSummary) ? resultSummary : null,
    serverSummaryValid,
    eventStreamValid,
  };
}

function reportProjection(input, validation) {
  const claim = input.claim;
  const summary = input.serverSummary;
  const projection = {
    schemaVersion: 1,
    evidenceKind: PROFILE.evidenceKind,
    profile: 'codex-luna-max-one-tool-v1',
    model: PROFILE.model,
    reasoningEffort: PROFILE.reasoningEffort,
    codexCliVersion: input.codexCliVersion,
    runNumber: 95,
    frontierId: PROFILE.frontierId,
    epochId: PROFILE.epochId,
    profileId: PROFILE.id,
    scenarioId: null,
    acceptanceScope: PROFILE.acceptanceScope,
    claimId: claim.claimId,
    prNumber: claim.prNumber,
    reviewerId: claim.reviewerId,
    toolName: A01_AGGREGATE_COHORT_TOOL,
    argumentProfile: PROFILE.argumentProfile,
    expectedArgumentsSha256: claim.expectedArgumentsSha256,
    registrySha256: claim.registrySha256,
    selectionEvidenceSha256: sha256(readFileSync(path.join(ROOT, PROFILE.selectionEvidencePath))),
    sourceRevision: claim.sourceCandidateSha,
    baseSha: claim.baseSha,
    ciSha: claim.ciSha,
    ciStatus: claim.ciStatus,
    mcpBundleSha256: claim.bundleSha256,
    catalogSha256: summary.catalogSha256,
    toolDescriptionSha256: summary.toolDescriptionSha256,
    inputSchemaSha256: summary.inputSchemaSha256,
    networkMode: PROFILE.networkMode,
    serverId: SERVER_ID,
    serverToolNames: [A01_AGGREGATE_COHORT_TOOL],
    serverToolCount: 1,
    processExitCode: input.processExitCode,
    processSpawned: input.processSpawned,
    processTimedOut: input.processTimedOut,
    stdoutBytes: input.stdoutBytes,
    stderrBytes: input.stderrBytes,
    resultStatus: 'SUCCESS',
    resultCount: 1,
    eventStreamParsed: true,
    turnCompleted: true,
    codexMcpToolEventCount: 1,
    codexErrorItemCount: 0,
    nonMcpToolEventCount: 0,
    shellToolCallCount: 0,
    allowedCallCount: 1,
    deniedCallCount: 0,
    accountBindingCount: 0,
    externalNetworkRequestCount: 0,
    writeActionReached: false,
    qqPipelineTested: false,
    timClientTested: false,
    offlineFixture: expectedFixture(),
    resultSummary: validation.resultSummary,
    observedAt: new Date().toISOString(),
    answerSha256: sha256(input.answer),
    answerUtf8Bytes: Buffer.byteLength(input.answer, 'utf8'),
    answerChecks: validation.answerChecks,
    privacy: buildG06PrivacySummary(),
    retryAllowed: false,
    reportWritten: true,
  };
  return projection;
}

export function buildA01AggregateCohortProfileReport(input, { privateKey }) {
  try {
    selectA01AggregateProfile(input?.claim?.profileId);
  } catch {
    return { passed: false, reason: 'A01_AGGREGATE_MATRIX_REPORT_INPUT_INVALID' };
  }
  const validation = validateA01AggregateCohortProfileRun(input);
  if (!privateKey || !validation.passed) {
    return {
      passed: false,
      reason: validation.reason ?? 'A01_AGGREGATE_MATRIX_REPORT_INPUT_INVALID',
    };
  }
  const projection = reportProjection(input, validation);
  const signature = sign(null, Buffer.from(canonical(projection), 'utf8'), privateKey).toString(
    'base64',
  );
  const report = {
    ...projection,
    runnerReceipt: {
      kind: 'a01-aggregate-cohort-offline-agent-mcp-runner-receipt-v1',
      publicKeyBase64: input.claim.runnerReceiptPublicKey,
      publicKeySha256: input.claim.runnerReceiptPublicKeySha256,
      signature,
    },
  };
  const reportBytes = Buffer.from(`${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return { passed: true, report, reportBytes, reportSha256: sha256(reportBytes) };
}

export function verifyA01AggregateCohortProfileReport(report, publicKey) {
  try {
    const signatureText = report?.runnerReceipt?.signature;
    if (typeof signatureText !== 'string') return false;
    const signature = Buffer.from(signatureText, 'base64');
    if (
      !/^[A-Za-z0-9+/]+={0,2}$/u.test(signatureText) ||
      signature.toString('base64') !== signatureText
    ) {
      return false;
    }
    const projection = { ...report };
    delete projection.runnerReceipt;
    return verify(null, Buffer.from(canonical(projection), 'utf8'), publicKey, signature);
  } catch {
    return false;
  }
}

const REPORT_FIELDS = [
  'schemaVersion',
  'evidenceKind',
  'profile',
  'model',
  'reasoningEffort',
  'codexCliVersion',
  'runNumber',
  'frontierId',
  'epochId',
  'profileId',
  'scenarioId',
  'acceptanceScope',
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
  'mcpBundleSha256',
  'catalogSha256',
  'toolDescriptionSha256',
  'inputSchemaSha256',
  'networkMode',
  'serverId',
  'serverToolNames',
  'serverToolCount',
  'processExitCode',
  'processSpawned',
  'processTimedOut',
  'stdoutBytes',
  'stderrBytes',
  'resultStatus',
  'resultCount',
  'eventStreamParsed',
  'turnCompleted',
  'codexMcpToolEventCount',
  'codexErrorItemCount',
  'nonMcpToolEventCount',
  'shellToolCallCount',
  'allowedCallCount',
  'deniedCallCount',
  'accountBindingCount',
  'externalNetworkRequestCount',
  'writeActionReached',
  'qqPipelineTested',
  'timClientTested',
  'offlineFixture',
  'resultSummary',
  'observedAt',
  'answerSha256',
  'answerUtf8Bytes',
  'answerChecks',
  'privacy',
  'retryAllowed',
  'reportWritten',
  'runnerReceipt',
];

export function validateA01AggregateCohortProfileReport(report, claim, reportBytes = null) {
  try {
    selectA01AggregateProfile(claim?.profileId);
  } catch {
    return { passed: false, reason: 'A01_AGGREGATE_MATRIX_REPORT_CLAIM_INVALID' };
  }
  if (!validProfileClaim(claim) || !exactKeys(report, REPORT_FIELDS)) {
    return { passed: false, reason: 'A01_AGGREGATE_MATRIX_REPORT_CLAIM_INVALID' };
  }
  if (reportBytes !== null) {
    try {
      const parsedBytes = JSON.parse(Buffer.from(reportBytes).toString('utf8'));
      if (canonical(parsedBytes) !== canonical(report)) {
        return { passed: false, reason: 'A01_AGGREGATE_MATRIX_REPORT_BYTES_MISMATCH' };
      }
    } catch {
      return { passed: false, reason: 'A01_AGGREGATE_MATRIX_REPORT_BYTES_INVALID' };
    }
  }
  const receipt = report.runnerReceipt;
  const publicKeyBytes = Buffer.from(claim.runnerReceiptPublicKey, 'base64');
  let publicKey = null;
  try {
    publicKey = createPublicKey({ key: publicKeyBytes, format: 'der', type: 'spki' });
  } catch {
    publicKey = null;
  }
  const expectedBindings = {
    schemaVersion: 1,
    evidenceKind: PROFILE.evidenceKind,
    profile: 'codex-luna-max-one-tool-v1',
    model: 'gpt-6-luna',
    reasoningEffort: 'max',
    runNumber: 95,
    frontierId: PROFILE.frontierId,
    epochId: PROFILE.epochId,
    profileId: PROFILE.id,
    scenarioId: null,
    acceptanceScope: 'agent-mcp-matrix-only',
    claimId: claim.claimId,
    prNumber: claim.prNumber,
    reviewerId: claim.reviewerId,
    toolName: A01_AGGREGATE_COHORT_TOOL,
    argumentProfile: PROFILE.argumentProfile,
    expectedArgumentsSha256: claim.expectedArgumentsSha256,
    registrySha256: claim.registrySha256,
    sourceRevision: claim.sourceCandidateSha,
    baseSha: claim.baseSha,
    ciSha: claim.ciSha,
    ciStatus: 'SUCCESS',
    mcpBundleSha256: claim.bundleSha256,
    networkMode: PROFILE.networkMode,
    serverId: SERVER_ID,
    serverToolNames: [A01_AGGREGATE_COHORT_TOOL],
    serverToolCount: 1,
    processExitCode: 0,
    processSpawned: true,
    processTimedOut: false,
    resultStatus: 'SUCCESS',
    resultCount: 1,
    eventStreamParsed: true,
    turnCompleted: true,
    codexMcpToolEventCount: 1,
    codexErrorItemCount: 0,
    nonMcpToolEventCount: 0,
    shellToolCallCount: 0,
    allowedCallCount: 1,
    deniedCallCount: 0,
    accountBindingCount: 0,
    externalNetworkRequestCount: 0,
    writeActionReached: false,
    qqPipelineTested: false,
    timClientTested: false,
    offlineFixture: expectedFixture(),
    privacy: buildG06PrivacySummary(),
    retryAllowed: false,
    reportWritten: true,
  };
  const bindingsMatch = Object.entries(expectedBindings).every(
    ([key, value]) => canonical(report[key]) === canonical(value),
  );
  const answerChecksValid =
    exactKeys(report.answerChecks, [
      'fixedArguments',
      'singleToolInvocation',
      'structuredResultReadback',
      'exactMetricAndCoverageAnswer',
      'offlineFixtureBounded',
    ]) && Object.values(report.answerChecks).every((value) => value === true);
  let selectionEvidenceMatches = false;
  try {
    selectionEvidenceMatches =
      report.selectionEvidenceSha256 ===
      sha256(readFileSync(path.join(ROOT, PROFILE.selectionEvidencePath)));
  } catch {
    selectionEvidenceMatches = false;
  }
  const receiptValid = Boolean(
    exactKeys(receipt, ['kind', 'publicKeyBase64', 'publicKeySha256', 'signature']) &&
    receipt.kind === 'a01-aggregate-cohort-offline-agent-mcp-runner-receipt-v1' &&
    receipt.publicKeyBase64 === claim.runnerReceiptPublicKey &&
    receipt.publicKeySha256 === claim.runnerReceiptPublicKeySha256 &&
    sha256(publicKeyBytes) === claim.runnerReceiptPublicKeySha256 &&
    verifyA01AggregateCohortProfileReport(report, publicKey),
  );
  const reportMatches = Boolean(
    bindingsMatch &&
    selectionEvidenceMatches &&
    validResultSummary(report.resultSummary) &&
    exactKeys(report.answerChecks, [
      'fixedArguments',
      'singleToolInvocation',
      'structuredResultReadback',
      'exactMetricAndCoverageAnswer',
      'offlineFixtureBounded',
    ]) &&
    answerChecksValid &&
    Number.isSafeInteger(report.stdoutBytes) &&
    report.stdoutBytes >= 0 &&
    report.stdoutBytes <= 8 * 1024 * 1024 &&
    Number.isSafeInteger(report.stderrBytes) &&
    report.stderrBytes >= 0 &&
    report.stderrBytes <= 8 * 1024 * 1024 &&
    Number.isSafeInteger(report.answerUtf8Bytes) &&
    report.answerUtf8Bytes >= 0 &&
    report.answerUtf8Bytes <= PROFILE.maxAnswerBytes &&
    /^[0-9a-f]{64}$/u.test(report.answerSha256 ?? '') &&
    typeof report.codexCliVersion === 'string' &&
    report.codexCliVersion.length <= 128 &&
    /^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/u.test(report.codexCliVersion) &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(report.observedAt ?? '') &&
    /^[0-9a-f]{64}$/u.test(report.catalogSha256 ?? '') &&
    /^[0-9a-f]{64}$/u.test(report.toolDescriptionSha256 ?? '') &&
    /^[0-9a-f]{64}$/u.test(report.inputSchemaSha256 ?? '') &&
    receiptValid,
  );
  if (!reportMatches) return { passed: false, reason: 'A01_AGGREGATE_MATRIX_REPORT_INVALID' };
  const bytes = reportBytes ?? Buffer.from(`${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return { passed: true, reportSha256: sha256(bytes) };
}

export function validateA01AggregateCohortProfileReportFile(claim, root, reportPath) {
  try {
    selectA01AggregateProfile(claim?.profileId);
    const expectedPath = path.join(path.resolve(root), PROFILE.reportPath);
    if (path.resolve(reportPath) !== expectedPath) {
      return { passed: false, reason: 'A01_AGGREGATE_MATRIX_REPORT_PATH_INVALID' };
    }
    const bytes = readFileSync(expectedPath);
    if (bytes.length > 64 * 1024) {
      return { passed: false, reason: 'A01_AGGREGATE_MATRIX_REPORT_TOO_LARGE' };
    }
    const report = JSON.parse(bytes.toString('utf8'));
    const validation = validateA01AggregateCohortProfileReport(report, claim, bytes);
    return validation.passed ? { ...validation, reportPath: PROFILE.reportPath } : validation;
  } catch {
    return { passed: false, reason: 'A01_AGGREGATE_MATRIX_REPORT_UNAVAILABLE' };
  }
}

export function writeA01AggregateCohortProfileReport(report, { reportPath = null } = {}) {
  selectA01AggregateProfile(report?.profileId);
  const outputPath = path.resolve(reportPath ?? REPORT_PATH);
  if (outputPath !== REPORT_PATH || existsSync(outputPath)) {
    throw new Error('A01 aggregate matrix report path is fixed and create-once.');
  }
  let descriptor;
  try {
    descriptor = openSync(outputPath, 'wx', 0o644);
    writeFileSync(descriptor, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    closeSync(descriptor);
  } catch {
    if (descriptor !== undefined) {
      try {
        closeSync(descriptor);
      } catch {
        /* Preserve create-new failure. */
      }
    }
    throw new Error('A01 aggregate matrix report already exists or cannot be safely written.');
  }
  return sha256(readFileSync(outputPath));
}
