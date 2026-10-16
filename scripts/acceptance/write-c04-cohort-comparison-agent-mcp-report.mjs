import { Buffer } from 'node:buffer';
import { createHash, createPublicKey, sign, verify } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  agentMcpProfileArgumentsSha256,
  agentMcpProfileRegistrySha256,
  canonicalAgentMcpProfileJson,
  getAgentMcpProfileById,
} from '../lib/agent-mcp-profile-claims.mjs';
import { buildG06PrivacySummary } from '../lib/g06-privacy-summary.mjs';
import { isValidP06CiRunEvidence } from '../lib/p06-ci-run-evidence.mjs';
import {
  assertC04CohortComparisonPublicProfile,
  C04_COHORT_COMPARISON_ACKNOWLEDGEMENT,
  C04_COHORT_COMPARISON_MAX_REQUESTS,
  C04_COHORT_COMPARISON_MAX_REQUESTS_PER_RUN,
  C04_COHORT_COMPARISON_NETWORK_MODE,
  C04_COHORT_COMPARISON_PROFILE_ID,
  C04_COHORT_COMPARISON_SERVER_ID,
  C04_COHORT_COMPARISON_TOOL_NAMES,
} from '../lib/c04-cohort-comparison-public-profile.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PROFILE = getAgentMcpProfileById(C04_COHORT_COMPARISON_PROFILE_ID);
const RECEIPT_KIND = 'c04-cohort-comparison-agent-mcp-runner-receipt-v1';
const REPORT_RELATIVE_PATH = PROFILE?.reportPath;
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const canonicalSha256 = (value) => sha256(canonicalAgentMcpProfileJson(value));

const C04_STATES = new Set([
  'ok',
  'complete',
  'partial',
  'conflict',
  'unavailable',
  'not_computable',
  'not_found',
  'upstream_error',
  'unsupported',
  'stale',
  'auth_required',
  'permission_denied',
  'error',
]);
const C04_METRIC_KEYS = ['score', 'heat', 'episodesReported', 'ratingStandardDeviation'];
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
  rawResultStored: false,
  artifactImageBytesStored: false,
  credentialsStored: false,
});
const ANSWER_CHECKS = Object.freeze({
  exactRegisteredSequence: true,
  exactArguments: true,
  exactCandidateBundle: true,
  anonymousOfficialV0Only: true,
  requestBudgetSatisfied: true,
  exactAcknowledgement: true,
  privacyPreserved: true,
  matrixOnlyScope: true,
});
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
  'ciChecks',
  'reviewerId',
  'bundleSha256',
  'registrySha256',
  'toolNames',
  'argumentProfile',
  'expectedArgumentsSha256',
  'selectionEvidenceSha256',
  'codexCliVersion',
  'processExitCode',
  'resultStatus',
  'codexRunCount',
  'eventStreamParsed',
  'turnCompleted',
  'codexMcpToolEventCount',
  'codexErrorItemCount',
  'nonMcpToolEventCount',
  'shellToolCallCount',
  'allowedCallCount',
  'deniedCallCount',
  'requestCount',
  'answerSha256',
  'eventStreamSha256',
  'serverSummarySha256',
]);

function exactKeys(value, expected) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length === expected.size &&
    Object.keys(value).every((key) => expected.has(key)),
  );
}

function nonnegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function validMetricSummary(metric) {
  return (
    exactKeys(
      metric,
      new Set([
        'key',
        'state',
        'validCounts',
        'partialCounts',
        'missingCounts',
        'conflictCounts',
        'notComputableCounts',
      ]),
    ) &&
    C04_METRIC_KEYS.includes(metric.key) &&
    C04_STATES.has(metric.state) &&
    [
      'validCounts',
      'partialCounts',
      'missingCounts',
      'conflictCounts',
      'notComputableCounts',
    ].every(
      (field) =>
        Array.isArray(metric[field]) &&
        metric[field].length === 2 &&
        metric[field].every(nonnegativeInteger),
    )
  );
}

function validComparisonSummary(summary) {
  if (
    !exactKeys(
      summary,
      new Set(['resultState', 'cohortCount', 'cohorts', 'metricCount', 'metrics', 'coverage']),
    ) ||
    !C04_STATES.has(summary.resultState) ||
    summary.cohortCount !== 2 ||
    !Array.isArray(summary.cohorts) ||
    summary.cohorts.length !== 2 ||
    !Array.isArray(summary.metrics) ||
    summary.metricCount !== summary.metrics.length ||
    summary.metricCount !== C04_METRIC_KEYS.length ||
    summary.metrics.some((metric) => !validMetricSummary(metric)) ||
    new Set(summary.metrics.map((metric) => metric.key)).size !== C04_METRIC_KEYS.length
  ) {
    return false;
  }
  const cohortFields = new Set([
    'queryState',
    'detailHydrationsAttempted',
    'detailHydrationsSucceeded',
    'detailHydrationsFailed',
    'subjectCount',
  ]);
  if (
    summary.cohorts.some(
      (cohort) =>
        !exactKeys(cohort, cohortFields) ||
        !C04_STATES.has(cohort.queryState) ||
        !nonnegativeInteger(cohort.detailHydrationsAttempted) ||
        cohort.detailHydrationsAttempted > 1 ||
        !nonnegativeInteger(cohort.detailHydrationsSucceeded) ||
        cohort.detailHydrationsSucceeded > 1 ||
        !nonnegativeInteger(cohort.detailHydrationsFailed) ||
        cohort.detailHydrationsFailed > 1 ||
        !nonnegativeInteger(cohort.subjectCount) ||
        cohort.subjectCount > 1 ||
        cohort.detailHydrationsSucceeded + cohort.detailHydrationsFailed !==
          cohort.detailHydrationsAttempted,
    )
  ) {
    return false;
  }
  const metricCountFields = [
    'validCounts',
    'partialCounts',
    'missingCounts',
    'conflictCounts',
    'notComputableCounts',
  ];
  if (
    summary.metrics.some((metric) =>
      summary.cohorts.some((cohort, index) => {
        const counts = metricCountFields.map((field) => metric[field][index]);
        return (
          counts.some((count) => count > cohort.subjectCount) ||
          counts.reduce((total, count) => total + count, 0) !== cohort.subjectCount
        );
      }),
    )
  ) {
    return false;
  }
  const coverageFields = new Set([
    'maxSubjectsPerCohort',
    'totalSubjectsReturned',
    'cohortsComplete',
    'cohortsPartial',
    'detailHydrationsAttempted',
    'detailHydrationsSucceeded',
    'detailHydrationsFailed',
    'truncated',
  ]);
  const coverage = summary.coverage;
  const expectedTotalSubjects = summary.cohorts.reduce(
    (total, cohort) => total + cohort.subjectCount,
    0,
  );
  const expectedHydrationCounts = [
    'detailHydrationsAttempted',
    'detailHydrationsSucceeded',
    'detailHydrationsFailed',
  ].map((field) => summary.cohorts.reduce((total, cohort) => total + cohort[field], 0));
  return (
    exactKeys(coverage, coverageFields) &&
    coverage.maxSubjectsPerCohort === 1 &&
    nonnegativeInteger(coverage.totalSubjectsReturned) &&
    coverage.totalSubjectsReturned === expectedTotalSubjects &&
    coverage.totalSubjectsReturned <= 2 &&
    nonnegativeInteger(coverage.cohortsComplete) &&
    coverage.cohortsComplete <= 2 &&
    nonnegativeInteger(coverage.cohortsPartial) &&
    coverage.cohortsPartial <= 2 &&
    coverage.cohortsComplete + coverage.cohortsPartial === 2 &&
    nonnegativeInteger(coverage.detailHydrationsAttempted) &&
    nonnegativeInteger(coverage.detailHydrationsSucceeded) &&
    nonnegativeInteger(coverage.detailHydrationsFailed) &&
    coverage.detailHydrationsSucceeded + coverage.detailHydrationsFailed ===
      coverage.detailHydrationsAttempted &&
    coverage.detailHydrationsAttempted === expectedHydrationCounts[0] &&
    coverage.detailHydrationsSucceeded === expectedHydrationCounts[1] &&
    coverage.detailHydrationsFailed === expectedHydrationCounts[2] &&
    typeof coverage.truncated === 'boolean'
  );
}

function validArtifactSummary(summary) {
  if (
    !exactKeys(summary, new Set(['resultState', 'artifact'])) ||
    summary.resultState !== 'artifact_returned' ||
    !exactKeys(
      summary.artifact,
      new Set([
        'returned',
        'persisted',
        'mimeType',
        'width',
        'height',
        'byteLength',
        'sha256',
        'pngSignatureValid',
      ]),
    )
  ) {
    return false;
  }
  const artifact = summary.artifact;
  return (
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
    Number.isSafeInteger(artifact.byteLength) &&
    artifact.byteLength > 0 &&
    artifact.byteLength <= 5_000_000 &&
    /^[0-9a-f]{64}$/u.test(artifact.sha256 ?? '') &&
    artifact.pngSignatureValid === true
  );
}

function validRequestScope(scope, maxRequests = C04_COHORT_COMPARISON_MAX_REQUESTS) {
  return (
    exactKeys(
      scope,
      new Set([
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
      ]),
    ) &&
    nonnegativeInteger(scope.requestCount) &&
    scope.requestCount <= maxRequests &&
    scope.allowedRequestCount === scope.requestCount &&
    scope.deniedRequestCount === 0 &&
    scope.credentialAttemptCount === 0 &&
    scope.unexpectedRouteCount === 0 &&
    scope.budgetExceeded === false &&
    scope.maxRequests === maxRequests &&
    scope.anonymousOnly === true &&
    scope.officialV0Only === true &&
    scope.redirectPolicy === 'error'
  );
}

export function validateC04ServerSummary(summary, sourceRevision, bundleSha256, callIndex) {
  const call = PROFILE?.calls[callIndex];
  const expectedToolName = call?.toolName;
  if (
    !PROFILE ||
    !assertC04CohortComparisonPublicProfile(PROFILE) ||
    !Number.isSafeInteger(callIndex) ||
    callIndex < 0 ||
    callIndex >= PROFILE.calls.length ||
    !summary ||
    summary.serverProfile !== 'closed-profile-sequence-anonymous-public-v1' ||
    summary.profileId !== PROFILE.id ||
    summary.argumentProfile !== PROFILE.argumentProfile ||
    summary.expectedCallCount !== 1 ||
    summary.profileCallIndex !== callIndex ||
    summary.networkMode !== C04_COHORT_COMPARISON_NETWORK_MODE ||
    summary.sourceRevision !== sourceRevision ||
    summary.bundleSha256 !== bundleSha256 ||
    summary.toolName !== expectedToolName ||
    canonicalAgentMcpProfileJson(summary.toolNames) !==
      canonicalAgentMcpProfileJson([expectedToolName]) ||
    canonicalAgentMcpProfileJson(summary.serverToolNames) !==
      canonicalAgentMcpProfileJson([expectedToolName]) ||
    summary.serverToolCount !== 1 ||
    summary.expectedArgumentsSha256 !== agentMcpProfileArgumentsSha256(PROFILE) ||
    summary.serverResultStatus !== 'SUCCESS' ||
    summary.allowedCallCount !== 1 ||
    summary.deniedCallCount !== 0 ||
    summary.argumentMatch !== true ||
    !Array.isArray(summary.results) ||
    summary.results.length !== 1 ||
    !validRequestScope(summary.publicRequestScope, C04_COHORT_COMPARISON_MAX_REQUESTS_PER_RUN) ||
    canonicalAgentMcpProfileJson(summary.privacy) !==
      canonicalAgentMcpProfileJson(buildG06PrivacySummary())
  ) {
    return false;
  }
  const result = summary.results[0];
  if (
    !exactKeys(result, new Set(['sequenceIndex', 'toolName', 'status', 'resultSummary'])) ||
    result.sequenceIndex !== 0 ||
    result.toolName !== expectedToolName ||
    result.status !== 'SUCCESS' ||
    !(callIndex === 0
      ? validComparisonSummary(result.resultSummary)
      : validArtifactSummary(result.resultSummary))
  ) {
    return false;
  }
  const descriptors = summary.toolDescriptors;
  return (
    Array.isArray(descriptors) &&
    descriptors.length === 1 &&
    descriptors.every(
      (item) =>
        exactKeys(item, new Set(['toolName', 'descriptionSha256', 'inputSchemaSha256'])) &&
        item.toolName === expectedToolName &&
        /^[0-9a-f]{64}$/u.test(item.descriptionSha256 ?? '') &&
        /^[0-9a-f]{64}$/u.test(item.inputSchemaSha256 ?? ''),
    ) &&
    summary.toolDescriptionSha256 === descriptors[0].descriptionSha256 &&
    summary.inputSchemaSha256 === descriptors[0].inputSchemaSha256 &&
    /^[0-9a-f]{64}$/u.test(summary.catalogSha256 ?? '') &&
    typeof summary.serverInstanceId === 'string' &&
    /^[0-9a-f-]{36}$/u.test(summary.serverInstanceId)
  );
}

function combinedRequestScope(scopes) {
  if (
    !Array.isArray(scopes) ||
    scopes.length !== PROFILE.calls.length ||
    scopes.some((scope) => !validRequestScope(scope, C04_COHORT_COMPARISON_MAX_REQUESTS_PER_RUN))
  ) {
    return null;
  }
  const sum = (field) => scopes.reduce((total, scope) => total + scope[field], 0);
  return {
    requestCount: sum('requestCount'),
    allowedRequestCount: sum('allowedRequestCount'),
    deniedRequestCount: sum('deniedRequestCount'),
    credentialAttemptCount: sum('credentialAttemptCount'),
    unexpectedRouteCount: sum('unexpectedRouteCount'),
    budgetExceeded: scopes.some((scope) => scope.budgetExceeded),
    maxRequests: C04_COHORT_COMPARISON_MAX_REQUESTS,
    anonymousOnly: scopes.every((scope) => scope.anonymousOnly),
    officialV0Only: scopes.every((scope) => scope.officialV0Only),
    redirectPolicy: 'error',
  };
}

function combineC04ServerSummaries(serverSummaries, sourceRevision, bundleSha256) {
  if (
    !Array.isArray(serverSummaries) ||
    serverSummaries.length !== PROFILE.calls.length ||
    !serverSummaries.every((summary, index) =>
      validateC04ServerSummary(summary, sourceRevision, bundleSha256, index),
    ) ||
    serverSummaries[0].serverInstanceId === serverSummaries[1].serverInstanceId ||
    serverSummaries.some((summary) => summary.catalogSha256 !== serverSummaries[0].catalogSha256) ||
    serverSummaries.some(
      (summary) =>
        canonicalAgentMcpProfileJson(summary.privacy) !==
        canonicalAgentMcpProfileJson(serverSummaries[0].privacy),
    )
  ) {
    return null;
  }
  const publicRequestScope = combinedRequestScope(
    serverSummaries.map((summary) => summary.publicRequestScope),
  );
  if (!validRequestScope(publicRequestScope)) return null;
  return {
    catalogSha256: serverSummaries[0].catalogSha256,
    toolDescriptors: serverSummaries.flatMap((summary) => summary.toolDescriptors),
    serverToolNames: serverSummaries.flatMap((summary) => summary.serverToolNames),
    serverToolCount: serverSummaries.reduce((total, summary) => total + summary.serverToolCount, 0),
    allowedCallCount: serverSummaries.reduce(
      (total, summary) => total + summary.allowedCallCount,
      0,
    ),
    deniedCallCount: serverSummaries.reduce((total, summary) => total + summary.deniedCallCount, 0),
    publicRequestScope,
    results: serverSummaries.map((summary, index) => ({
      sequenceIndex: index,
      toolName: PROFILE.calls[index].toolName,
      status: 'SUCCESS',
      resultSummary: summary.results[0].resultSummary,
    })),
    privacy: serverSummaries[0].privacy,
  };
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

export function buildC04RunnerReceiptPayload(report, { eventStreamSha256, serverSummarySha256 }) {
  if (
    !report ||
    typeof report !== 'object' ||
    !/^[0-9a-f]{64}$/u.test(eventStreamSha256 ?? '') ||
    !/^[0-9a-f]{64}$/u.test(serverSummarySha256 ?? '')
  ) {
    throw new TypeError('C04 runner receipt requires exact sanitized run inputs.');
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
    toolNames: report.toolNames,
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
    requestCount: report.publicRequestScope.requestCount,
    answerSha256: report.answerSha256,
    codexRunCount: report.codexRunCount,
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
    throw new TypeError('C04 runner receipt requires a canonical Ed25519 SPKI public key.');
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

function catalogEvidenceMatches(report, root = ROOT) {
  try {
    const bytes = readFileSync(path.join(root, 'docs/tool-catalog.json'));
    const catalog = JSON.parse(bytes.toString('utf8'));
    const descriptors = report.toolDescriptors;
    return (
      report.catalogSha256 === sha256(bytes) &&
      descriptors.length === C04_COHORT_COMPARISON_TOOL_NAMES.length &&
      descriptors.every((descriptor, index) => {
        const item = catalog.find((row) => row?.name === C04_COHORT_COMPARISON_TOOL_NAMES[index]);
        return (
          item?.auth === 'none' &&
          item?.risk === 'read' &&
          descriptor.toolName === item.name &&
          descriptor.descriptionSha256 === sha256(item.description ?? '') &&
          descriptor.inputSchemaSha256 === canonicalSha256(item.inputSchema)
        );
      })
    );
  } catch {
    return false;
  }
}

function validateResultSummaries(resultSummaries) {
  return (
    Array.isArray(resultSummaries) &&
    resultSummaries.length === PROFILE.calls.length &&
    resultSummaries.every((item, index) => {
      if (
        !exactKeys(item, new Set(['toolName', 'summary'])) ||
        item.toolName !== PROFILE.calls[index].toolName
      ) {
        return false;
      }
      return index === 0
        ? validComparisonSummary(item.summary)
        : validArtifactSummary(item.summary);
    })
  );
}

export function validateC04ProfileReport(report, claim, reportBytes = null, root = ROOT) {
  const claimStateValid =
    (claim?.state === 'CLAIMED' && claim.reportWritten === false) ||
    (claim?.state === 'REPORT_WRITTEN' &&
      claim.reportWritten === true &&
      Buffer.isBuffer(reportBytes) &&
      claim.reportSha256 === sha256(reportBytes));
  if (
    !PROFILE ||
    !assertC04CohortComparisonPublicProfile(PROFILE) ||
    !exactKeys(report, REPORT_FIELDS) ||
    !claim ||
    claim.profileId !== PROFILE.id ||
    !claimStateValid ||
    claim.retryAllowed !== false ||
    !isValidP06CiRunEvidence({ ciRunId: report?.ciRunId, ciChecks: report?.ciChecks }) ||
    !matchesClaim(report, claim)
  ) {
    return { passed: false, reason: 'C04_REPORT_CLAIM_INVALID' };
  }
  let selectionBytes;
  try {
    selectionBytes = readFileSync(path.join(root, PROFILE.selectionEvidencePath));
  } catch {
    return { passed: false, reason: 'C04_SELECTION_EVIDENCE_MISSING' };
  }
  const receipt = report.runnerReceipt;
  const valid =
    report.schemaVersion === 1 &&
    report.evidenceKind === PROFILE.evidenceKind &&
    report.runNumber === 95 &&
    report.frontierId === PROFILE.frontierId &&
    report.scenarioId === null &&
    report.epochId === PROFILE.epochId &&
    report.profileId === PROFILE.id &&
    report.profile === 'codex-luna-max-two-tool-public-agent-mcp-matrix-v1' &&
    report.model === PROFILE.model &&
    report.reasoningEffort === PROFILE.reasoningEffort &&
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
    report.registrySha256 === agentMcpProfileRegistrySha256(PROFILE.id) &&
    report.selectionEvidenceSha256 === sha256(selectionBytes) &&
    canonicalAgentMcpProfileJson(report.toolNames) ===
      canonicalAgentMcpProfileJson(C04_COHORT_COMPARISON_TOOL_NAMES) &&
    report.argumentProfile === PROFILE.argumentProfile &&
    report.expectedArgumentsSha256 === agentMcpProfileArgumentsSha256(PROFILE) &&
    report.networkMode === C04_COHORT_COMPARISON_NETWORK_MODE &&
    catalogEvidenceMatches(report, root) &&
    canonicalAgentMcpProfileJson(report.serverToolNames) ===
      canonicalAgentMcpProfileJson(C04_COHORT_COMPARISON_TOOL_NAMES) &&
    report.serverToolCount === C04_COHORT_COMPARISON_TOOL_NAMES.length &&
    canonicalAgentMcpProfileJson(report.mcpServerNames) ===
      canonicalAgentMcpProfileJson([
        C04_COHORT_COMPARISON_SERVER_ID,
        C04_COHORT_COMPARISON_SERVER_ID,
      ]) &&
    report.processExitCode === 0 &&
    report.resultStatus === 'SUCCESS' &&
    report.codexRunCount === PROFILE.calls.length &&
    report.eventStreamParsed === true &&
    report.turnCompleted === true &&
    report.codexMcpToolEventCount === PROFILE.calls.length &&
    report.codexErrorItemCount === 0 &&
    report.nonMcpToolEventCount === 0 &&
    Array.isArray(report.nonMcpToolTypes) &&
    report.nonMcpToolTypes.length === 0 &&
    report.shellToolCallCount === 0 &&
    report.allowedCallCount === PROFILE.calls.length &&
    report.deniedCallCount === 0 &&
    validRequestScope(report.publicRequestScope) &&
    report.answerCheckMethod === PROFILE.answerCheckMethod &&
    report.answerSha256 === sha256(C04_COHORT_COMPARISON_ACKNOWLEDGEMENT) &&
    report.answerUtf8Bytes === Buffer.byteLength(C04_COHORT_COMPARISON_ACKNOWLEDGEMENT, 'utf8') &&
    canonicalAgentMcpProfileJson(report.answerChecks) ===
      canonicalAgentMcpProfileJson(ANSWER_CHECKS) &&
    validateResultSummaries(report.resultSummaries) &&
    canonicalAgentMcpProfileJson(report.privacy) === canonicalAgentMcpProfileJson(PRIVACY) &&
    exactKeys(receipt, RECEIPT_FIELDS) &&
    exactKeys(receipt.payload, RECEIPT_PAYLOAD_FIELDS);
  if (!valid) return { passed: false, reason: 'C04_REPORT_FIELDS_INVALID' };

  let signatureValid = false;
  try {
    const publicKeyDer = Buffer.from(claim.runnerReceiptPublicKey ?? '', 'base64');
    const publicKey = createPublicKey({ key: publicKeyDer, format: 'der', type: 'spki' });
    const payload = buildC04RunnerReceiptPayload(report, {
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
      receipt.publicKeySha256 === claim.runnerReceiptPublicKeySha256 &&
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
  if (!signatureValid) return { passed: false, reason: 'C04_RUNNER_RECEIPT_INVALID' };
  if (reportBytes && reportBytes.length > 64 * 1024)
    return { passed: false, reason: 'C04_REPORT_TOO_LARGE' };
  return { passed: true, reportPath: REPORT_RELATIVE_PATH };
}

export function buildC04ProfileReport(
  {
    claim,
    serverSummaries,
    events,
    answer,
    codexCliVersion,
    eventStreamSha256,
    serverSummarySha256,
  },
  { privateKey, root = ROOT } = {},
) {
  const serverSummary = combineC04ServerSummaries(
    serverSummaries,
    claim?.sourceCandidateSha,
    claim?.bundleSha256,
  );
  if (
    !PROFILE ||
    !assertC04CohortComparisonPublicProfile(PROFILE) ||
    !serverSummary ||
    !events ||
    events.codexRunCount !== PROFILE.calls.length ||
    events.allRunAnswersExact !== true ||
    answer !== C04_COHORT_COMPARISON_ACKNOWLEDGEMENT ||
    events.processExitCode !== 0 ||
    events.eventStreamParsed !== true ||
    events.turnCompleted !== true ||
    events.codexMcpToolEventCount !== PROFILE.calls.length ||
    events.codexErrorItemCount !== 0 ||
    events.nonMcpToolEventCount !== 0 ||
    events.shellToolCallCount !== 0 ||
    events.exactCallSequence !== true ||
    events.exactToolEvents !== true ||
    canonicalAgentMcpProfileJson(events.mcpServerNames) !==
      canonicalAgentMcpProfileJson([
        C04_COHORT_COMPARISON_SERVER_ID,
        C04_COHORT_COMPARISON_SERVER_ID,
      ])
  ) {
    return { passed: false, reason: 'C04_RUNNER_GATE_INVALID' };
  }
  let selectionBytes;
  try {
    selectionBytes = readFileSync(path.join(root, PROFILE.selectionEvidencePath));
  } catch {
    return { passed: false, reason: 'C04_SELECTION_EVIDENCE_MISSING' };
  }
  const report = {
    schemaVersion: 1,
    evidenceKind: PROFILE.evidenceKind,
    runNumber: 95,
    frontierId: PROFILE.frontierId,
    scenarioId: null,
    epochId: PROFILE.epochId,
    profileId: PROFILE.id,
    profile: 'codex-luna-max-two-tool-public-agent-mcp-matrix-v1',
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
    toolNames: [...C04_COHORT_COMPARISON_TOOL_NAMES],
    argumentProfile: PROFILE.argumentProfile,
    expectedArgumentsSha256: agentMcpProfileArgumentsSha256(PROFILE),
    catalogSha256: serverSummary.catalogSha256,
    toolDescriptors: serverSummary.toolDescriptors,
    serverToolNames: serverSummary.serverToolNames,
    serverToolCount: serverSummary.serverToolCount,
    networkMode: C04_COHORT_COMPARISON_NETWORK_MODE,
    mcpServerNames: events.mcpServerNames,
    processExitCode: events.processExitCode,
    resultStatus: 'SUCCESS',
    codexRunCount: events.codexRunCount,
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
    answerSha256: sha256(C04_COHORT_COMPARISON_ACKNOWLEDGEMENT),
    answerUtf8Bytes: Buffer.byteLength(C04_COHORT_COMPARISON_ACKNOWLEDGEMENT, 'utf8'),
    answerChecks: { ...ANSWER_CHECKS },
    resultSummaries: serverSummary.results.map((result) => ({
      toolName: result.toolName,
      summary: result.resultSummary,
    })),
    privacy: buildG06PrivacySummary(),
    runnerReceipt: null,
  };
  const receiptPayload = buildC04RunnerReceiptPayload(report, {
    eventStreamSha256,
    serverSummarySha256,
  });
  report.runnerReceipt = createRunnerReceipt(receiptPayload, {
    publicKeyBase64: claim.runnerReceiptPublicKey,
    privateKey,
  });
  const validation = validateC04ProfileReport(report, claim, null, root);
  return validation.passed ? { passed: true, report } : validation;
}

export function validateC04SanitizedReportFile(claim, root = ROOT, reportPath = null) {
  const target = reportPath ?? path.join(root, REPORT_RELATIVE_PATH);
  try {
    if (path.resolve(target) !== path.resolve(root, REPORT_RELATIVE_PATH))
      return { passed: false, reason: 'C04_REPORT_PATH_INVALID' };
    const bytes = readFileSync(target);
    const report = JSON.parse(bytes.toString('utf8'));
    const validation = validateC04ProfileReport(report, claim, bytes, root);
    if (!validation.passed) return validation;
    return {
      passed: true,
      reportPath: REPORT_RELATIVE_PATH,
      reportSha256: sha256(bytes),
      report,
    };
  } catch {
    return { passed: false, reason: 'C04_REPORT_UNAVAILABLE' };
  }
}
