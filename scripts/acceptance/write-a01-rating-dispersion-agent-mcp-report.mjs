import { Buffer } from 'node:buffer';
import { createHash, createPublicKey, sign, verify } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  A01_RATING_DISPERSION_ANSWER_CHECK_FIELDS,
  verifyA01RatingDispersionAnswer,
} from './a01-agent-answer-check.mjs';
import {
  agentMcpProfileArgumentsSha256,
  agentMcpProfileRegistrySha256,
  canonicalAgentMcpProfileJson,
  getAgentMcpProfileById,
} from '../lib/agent-mcp-profile-claims.mjs';
import { buildG06PrivacySummary } from '../lib/g06-privacy-summary.mjs';
import { isValidP06CiRunEvidence } from '../lib/p06-ci-run-evidence.mjs';
import {
  A01_RATING_DISPERSION_MAX_REQUESTS,
  A01_RATING_DISPERSION_NETWORK_MODE,
  A01_RATING_DISPERSION_PROFILE_ID,
  A01_RATING_DISPERSION_SERVER_ID,
  assertA01RatingDispersionProfile,
} from '../lib/a01-rating-dispersion-profile.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PROFILE = getAgentMcpProfileById(A01_RATING_DISPERSION_PROFILE_ID);
export const A01_RATING_DISPERSION_REPORT_RELATIVE_PATH = PROFILE?.reportPath;
const RECEIPT_KIND = 'a01-rating-dispersion-agent-mcp-runner-receipt-v1';
const HEX_SHA256 = /^[0-9a-f]{64}$/u;
const HEX_SHA1 = /^[0-9a-f]{40}$/u;
const RESULT_STATES = new Set([
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
  'unknown',
]);
const ANSWER_CHECKS = Object.freeze([
  ...A01_RATING_DISPERSION_ANSWER_CHECK_FIELDS,
  'exactCandidateBundle',
  'serverSummaryMatchesCandidate',
  'serverAuthorizedOneCall',
  'serverResultSuccess',
  'anonymousOfficialV0Only',
  'requestBudgetSatisfied',
  'oneCodexMcpCall',
  'noExtraTools',
  'privacyPreserved',
]);
const PRIVACY = Object.freeze(buildG06PrivacySummary());
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
  'resultSummary',
  'privacy',
  'runnerReceipt',
]);
const REQUEST_SCOPE_FIELDS = new Set([
  'requestCount',
  'allowedRequestCount',
  'deniedRequestCount',
  'searchRequestCount',
  'detailRequestCount',
  'credentialAttemptCount',
  'unexpectedRouteCount',
  'budgetExceeded',
  'maxRequests',
  'anonymousOnly',
  'officialV0Only',
  'searchPagination',
  'redirectPolicy',
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
  'requestScopeSha256',
  'answerSha256',
  'resultSummarySha256',
  'eventStreamSha256',
  'serverSummarySha256',
]);

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const canonicalSha256 = (value) => sha256(canonicalAgentMcpProfileJson(value));

function exactKeys(value, expected) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length === expected.size &&
    Object.keys(value).every((key) => expected.has(key)),
  );
}

function integer(value, maximum = 1_000_000) {
  return Number.isSafeInteger(value) && value >= 0 && value <= maximum;
}

function optionalFinite(value) {
  return value === null || (typeof value === 'number' && Number.isFinite(value));
}

export function validateA01RatingDispersionRequestScope(
  scope,
  maxRequests = A01_RATING_DISPERSION_MAX_REQUESTS,
) {
  const profileArguments = PROFILE.calls[0].arguments;
  // Search POSTs are not retried and redirects fail closed, so this fixed one-page profile
  // makes exactly one physical search request per cohort. Detail GETs may include retries.
  return (
    exactKeys(scope, REQUEST_SCOPE_FIELDS) &&
    integer(scope.requestCount, maxRequests) &&
    integer(scope.allowedRequestCount, maxRequests) &&
    integer(scope.deniedRequestCount, maxRequests) &&
    integer(scope.searchRequestCount, maxRequests) &&
    integer(scope.detailRequestCount, maxRequests) &&
    integer(scope.credentialAttemptCount, maxRequests) &&
    integer(scope.unexpectedRouteCount, maxRequests) &&
    scope.requestCount === scope.allowedRequestCount &&
    scope.requestCount === scope.searchRequestCount + scope.detailRequestCount &&
    scope.searchRequestCount === profileArguments.cohorts.length &&
    scope.detailRequestCount <= maxRequests - profileArguments.cohorts.length &&
    scope.deniedRequestCount === 0 &&
    scope.credentialAttemptCount === 0 &&
    scope.unexpectedRouteCount === 0 &&
    scope.budgetExceeded === false &&
    scope.maxRequests === maxRequests &&
    scope.anonymousOnly === true &&
    scope.officialV0Only === true &&
    scope.searchPagination === 'limit-20-offset-0-only' &&
    scope.redirectPolicy === 'error'
  );
}

function validCountRecord(record, subjectCount) {
  const fields = new Set([
    'available',
    'partial',
    'missing',
    'conflict',
    'notComputable',
    'unknown',
  ]);
  return (
    exactKeys(record, fields) &&
    Object.values(record).every((value) => integer(value, 4)) &&
    Object.values(record).reduce((sum, value) => sum + value, 0) === subjectCount
  );
}

function validResultSummary(summary) {
  const fields = new Set([
    'resultState',
    'cohortCount',
    'fixedTargetIdentityMatched',
    'cohorts',
    'ratingStandardDeviation',
    'coverage',
  ]);
  const cohortFields = new Set([
    'queryState',
    'subjectCount',
    'queryHydrationsAttempted',
    'ratingStandardDeviationCounts',
    'detailHydrationsAttempted',
    'detailHydrationsSucceeded',
    'detailHydrationsFailed',
  ]);
  const metricFields = new Set([
    'state',
    'formulaId',
    'formulaVersion',
    'averages',
    'partialAverages',
    'validCounts',
    'partialCounts',
    'missingCounts',
    'conflictCounts',
    'notComputableCounts',
  ]);
  const coverageFields = new Set([
    'maxSubjectsPerCohort',
    'totalSubjectsReturned',
    'cohortsComplete',
    'cohortsPartial',
    'detailHydrationsAttempted',
    'detailHydrationsSucceeded',
    'detailHydrationsFailed',
    'truncated',
    'overlapCount',
  ]);
  if (
    !exactKeys(summary, fields) ||
    !RESULT_STATES.has(summary.resultState) ||
    summary.cohortCount !== 2 ||
    summary.fixedTargetIdentityMatched !== true ||
    !Array.isArray(summary.cohorts) ||
    summary.cohorts.length !== 2 ||
    !exactKeys(summary.ratingStandardDeviation, metricFields) ||
    !exactKeys(summary.coverage, coverageFields)
  )
    return false;

  const subjectsValid = summary.cohorts.every((cohort, index) => {
    if (
      !exactKeys(cohort, cohortFields) ||
      !RESULT_STATES.has(cohort.queryState) ||
      !integer(cohort.subjectCount, 4) ||
      !integer(
        cohort.queryHydrationsAttempted,
        PROFILE.calls[0].arguments.cohorts[index].query.budget.maxHydrations,
      ) ||
      !validCountRecord(cohort.ratingStandardDeviationCounts, cohort.subjectCount) ||
      !integer(cohort.detailHydrationsAttempted, cohort.subjectCount) ||
      !integer(cohort.detailHydrationsSucceeded, 4) ||
      !integer(cohort.detailHydrationsFailed, 4) ||
      cohort.queryHydrationsAttempted + cohort.detailHydrationsAttempted >
        PROFILE.calls[0].arguments.cohorts[index].query.budget.maxHydrations ||
      cohort.detailHydrationsSucceeded + cohort.detailHydrationsFailed !==
        cohort.detailHydrationsAttempted
    )
      return false;
    return true;
  });
  const metric = summary.ratingStandardDeviation;
  const metricArrays = [
    'averages',
    'partialAverages',
    'validCounts',
    'partialCounts',
    'missingCounts',
    'conflictCounts',
    'notComputableCounts',
  ];
  const metricValid =
    RESULT_STATES.has(metric.state) &&
    metric.formulaId === 'bangumi.rating.population_sd.v1' &&
    metric.formulaVersion === 1 &&
    metricArrays.every((field) => Array.isArray(metric[field]) && metric[field].length === 2) &&
    ['averages', 'partialAverages'].every((field) => metric[field].every(optionalFinite)) &&
    [
      'validCounts',
      'partialCounts',
      'missingCounts',
      'conflictCounts',
      'notComputableCounts',
    ].every((field) => metric[field].every((value) => integer(value, 4)));
  const metricCountsMatch =
    metricValid &&
    summary.cohorts.every((cohort, index) => {
      const counts = cohort.ratingStandardDeviationCounts;
      return (
        metric.validCounts[index] === counts.available &&
        metric.partialCounts[index] === counts.partial &&
        metric.missingCounts[index] === counts.missing &&
        metric.conflictCounts[index] === counts.conflict &&
        metric.notComputableCounts[index] === counts.notComputable
      );
    });
  const averagesMatchState =
    metricValid &&
    (metric.state === 'complete'
      ? metric.averages.every(
          (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0,
        )
      : metric.averages.every((value) => value === null) &&
        metric.partialAverages.every((value, index) => {
          const count =
            summary.cohorts[index].ratingStandardDeviationCounts.available +
            summary.cohorts[index].ratingStandardDeviationCounts.partial;
          return count === 0
            ? value === null
            : typeof value === 'number' && Number.isFinite(value) && value >= 0;
        }));
  const coverage = summary.coverage;
  const overlapValid =
    integer(coverage.overlapCount, 4) &&
    coverage.overlapCount <=
      Math.min(summary.cohorts[0].subjectCount, summary.cohorts[1].subjectCount);
  const totalSubjects = summary.cohorts.reduce((sum, cohort) => sum + cohort.subjectCount, 0);
  const attempts = summary.cohorts.reduce(
    (sum, cohort) => sum + cohort.detailHydrationsAttempted,
    0,
  );
  const succeeded = summary.cohorts.reduce(
    (sum, cohort) => sum + cohort.detailHydrationsSucceeded,
    0,
  );
  const failed = summary.cohorts.reduce((sum, cohort) => sum + cohort.detailHydrationsFailed, 0);
  return (
    subjectsValid &&
    metricCountsMatch &&
    averagesMatchState &&
    overlapValid &&
    integer(coverage.maxSubjectsPerCohort, 4) &&
    coverage.maxSubjectsPerCohort === 4 &&
    coverage.totalSubjectsReturned === totalSubjects &&
    integer(coverage.cohortsComplete, 2) &&
    integer(coverage.cohortsPartial, 2) &&
    coverage.cohortsComplete + coverage.cohortsPartial <= 2 &&
    coverage.detailHydrationsAttempted === attempts &&
    coverage.detailHydrationsSucceeded === succeeded &&
    coverage.detailHydrationsFailed === failed &&
    coverage.detailHydrationsSucceeded + coverage.detailHydrationsFailed ===
      coverage.detailHydrationsAttempted &&
    typeof coverage.truncated === 'boolean'
  );
}

export function validateA01RatingDispersionServerSummary(
  summary,
  sourceRevision,
  bundleSha256,
  root = ROOT,
) {
  if (
    !PROFILE ||
    !assertA01RatingDispersionProfile(PROFILE) ||
    !summary ||
    summary.serverProfile !== 'closed-profile-sequence-anonymous-public-v1' ||
    summary.profileId !== PROFILE.id ||
    summary.argumentProfile !== PROFILE.argumentProfile ||
    summary.expectedCallCount !== 1 ||
    summary.profileCallIndex !== undefined ||
    summary.networkMode !== A01_RATING_DISPERSION_NETWORK_MODE ||
    summary.sourceRevision !== sourceRevision ||
    summary.bundleSha256 !== bundleSha256 ||
    summary.toolName !== PROFILE.toolName ||
    canonicalAgentMcpProfileJson(summary.serverToolNames) !==
      canonicalAgentMcpProfileJson([PROFILE.toolName]) ||
    summary.serverToolCount !== 1 ||
    summary.expectedArgumentsSha256 !== agentMcpProfileArgumentsSha256(PROFILE) ||
    summary.serverResultStatus !== 'SUCCESS' ||
    summary.allowedCallCount !== 1 ||
    summary.deniedCallCount !== 0 ||
    summary.argumentMatch !== true ||
    !Array.isArray(summary.results) ||
    summary.results.length !== 1 ||
    !validateA01RatingDispersionRequestScope(summary.publicRequestScope) ||
    canonicalAgentMcpProfileJson(summary.privacy) !== canonicalAgentMcpProfileJson(PRIVACY)
  )
    return false;
  const result = summary.results[0];
  if (
    !exactKeys(result, new Set(['sequenceIndex', 'toolName', 'status', 'resultSummary'])) ||
    result.sequenceIndex !== 0 ||
    result.toolName !== PROFILE.toolName ||
    result.status !== 'SUCCESS' ||
    !validResultSummary(result.resultSummary)
  )
    return false;
  const catalogEvidence = catalogEvidenceForSummary(summary, root);
  return catalogEvidence;
}

function catalogEvidenceForSummary(summary, root) {
  try {
    const catalogBytes = readFileSync(path.join(root, 'docs/tool-catalog.json'));
    const catalog = JSON.parse(catalogBytes.toString('utf8'));
    const tool = catalog.find((item) => item?.name === PROFILE.toolName);
    return Boolean(
      tool &&
      tool.auth === 'none' &&
      tool.risk === 'read' &&
      sha256(catalogBytes) === summary.catalogSha256 &&
      sha256(tool.description ?? '') === summary.toolDescriptionSha256 &&
      canonicalSha256(tool.inputSchema) === summary.inputSchemaSha256 &&
      /^[0-9a-f-]{36}$/u.test(summary.serverInstanceId ?? ''),
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
    report.expectedArgumentsSha256 === claim.expectedArgumentsSha256
  );
}

export function buildA01RatingDispersionRunnerReceiptPayload(
  report,
  { eventStreamSha256, serverSummarySha256 },
) {
  if (
    !report ||
    !HEX_SHA256.test(eventStreamSha256 ?? '') ||
    !HEX_SHA256.test(serverSummarySha256 ?? '')
  ) {
    throw new TypeError('A01 runner receipt requires exact sanitized run inputs.');
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
    requestScopeSha256: canonicalSha256(report.publicRequestScope),
    answerSha256: report.answerSha256,
    resultSummarySha256: canonicalSha256(report.resultSummary),
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
    throw new TypeError('A01 runner receipt requires a canonical Ed25519 SPKI public key.');
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

function catalogEvidenceMatches(report, root) {
  try {
    const bytes = readFileSync(path.join(root, 'docs/tool-catalog.json'));
    const catalog = JSON.parse(bytes.toString('utf8'));
    const item = catalog.find((row) => row?.name === PROFILE.toolName);
    const descriptor = report.toolDescriptors[0];
    return Boolean(
      sha256(bytes) === report.catalogSha256 &&
      item?.auth === 'none' &&
      item?.risk === 'read' &&
      descriptor.toolName === PROFILE.toolName &&
      descriptor.descriptionSha256 === sha256(item.description ?? '') &&
      descriptor.inputSchemaSha256 === canonicalSha256(item.inputSchema),
    );
  } catch {
    return false;
  }
}

export function validateA01RatingDispersionProfileReport(
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
    !assertA01RatingDispersionProfile(PROFILE) ||
    !exactKeys(report, REPORT_FIELDS) ||
    !claim ||
    claim.profileId !== PROFILE.id ||
    !claimStateValid ||
    claim.retryAllowed !== false ||
    !isValidP06CiRunEvidence({ ciRunId: report?.ciRunId, ciChecks: report?.ciChecks }) ||
    !matchesClaim(report, claim)
  )
    return { passed: false, reason: 'A01_RATING_REPORT_CLAIM_INVALID' };
  let selectionBytes;
  try {
    selectionBytes = readFileSync(path.join(root, PROFILE.selectionEvidencePath));
  } catch {
    return { passed: false, reason: 'A01_RATING_SELECTION_EVIDENCE_MISSING' };
  }
  const receipt = report.runnerReceipt;
  const answerChecksValid =
    exactKeys(report.answerChecks, new Set(ANSWER_CHECKS)) &&
    Object.values(report.answerChecks).every((value) => value === true);
  const valid =
    report.schemaVersion === 1 &&
    report.evidenceKind === PROFILE.evidenceKind &&
    report.runNumber === 95 &&
    report.frontierId === 'A01' &&
    report.scenarioId === 'A01' &&
    report.acceptanceScope === PROFILE.acceptanceScope &&
    report.epochId === PROFILE.epochId &&
    report.profileId === PROFILE.id &&
    report.profile === 'codex-luna-max-one-tool-anonymous-public-agent-mcp-v1' &&
    report.model === PROFILE.model &&
    report.reasoningEffort === PROFILE.reasoningEffort &&
    new RegExp(`^gpt-6-luna-max-run95-pr${report.prNumber}-round[1-9]\\d*$`, 'u').test(
      report.reviewerId ?? '',
    ) &&
    /^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/u.test(report.codexCliVersion ?? '') &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(report.observedAt ?? '') &&
    HEX_SHA1.test(report.sourceRevision ?? '') &&
    HEX_SHA1.test(report.baseSha ?? '') &&
    report.ciSha === report.sourceRevision &&
    report.ciStatus === 'SUCCESS' &&
    /^[1-9]\d{3,}$/u.test(report.ciRunId ?? '') &&
    Number.isSafeInteger(report.prNumber) &&
    report.prNumber > 0 &&
    typeof report.claimId === 'string' &&
    report.claimId.length >= 12 &&
    HEX_SHA256.test(report.mcpBundleSha256 ?? '') &&
    report.registrySha256 === agentMcpProfileRegistrySha256(PROFILE.id) &&
    report.selectionEvidenceSha256 === sha256(selectionBytes) &&
    canonicalAgentMcpProfileJson(report.toolNames) ===
      canonicalAgentMcpProfileJson([PROFILE.toolName]) &&
    report.toolName === PROFILE.toolName &&
    report.argumentProfile === PROFILE.argumentProfile &&
    report.expectedArgumentsSha256 === agentMcpProfileArgumentsSha256(PROFILE) &&
    report.networkMode === A01_RATING_DISPERSION_NETWORK_MODE &&
    catalogEvidenceMatches(report, root) &&
    canonicalAgentMcpProfileJson(report.serverToolNames) ===
      canonicalAgentMcpProfileJson([PROFILE.toolName]) &&
    report.serverToolCount === 1 &&
    canonicalAgentMcpProfileJson(report.mcpServerNames) ===
      canonicalAgentMcpProfileJson([A01_RATING_DISPERSION_SERVER_ID]) &&
    report.processExitCode === 0 &&
    report.resultStatus === 'SUCCESS' &&
    report.codexRunCount === 1 &&
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
    validateA01RatingDispersionRequestScope(report.publicRequestScope) &&
    report.answerCheckMethod === PROFILE.answerCheckMethod &&
    HEX_SHA256.test(report.answerSha256 ?? '') &&
    Number.isSafeInteger(report.answerUtf8Bytes) &&
    report.answerUtf8Bytes > 0 &&
    report.answerUtf8Bytes <= PROFILE.maxAnswerBytes &&
    answerChecksValid &&
    validResultSummary(report.resultSummary) &&
    canonicalAgentMcpProfileJson(report.privacy) === canonicalAgentMcpProfileJson(PRIVACY) &&
    exactKeys(receipt, RECEIPT_FIELDS) &&
    exactKeys(receipt.payload, RECEIPT_PAYLOAD_FIELDS);
  if (!valid) return { passed: false, reason: 'A01_RATING_REPORT_FIELDS_INVALID' };

  let signatureValid = false;
  try {
    const publicKeyDer = Buffer.from(claim.runnerReceiptPublicKey ?? '', 'base64');
    const publicKey = createPublicKey({ key: publicKeyDer, format: 'der', type: 'spki' });
    const payload = buildA01RatingDispersionRunnerReceiptPayload(report, {
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
  if (!signatureValid) return { passed: false, reason: 'A01_RATING_RUNNER_RECEIPT_INVALID' };
  if (reportBytes && reportBytes.length > 64 * 1024)
    return { passed: false, reason: 'A01_RATING_REPORT_TOO_LARGE' };
  return { passed: true, reportPath: A01_RATING_DISPERSION_REPORT_RELATIVE_PATH };
}

export function buildA01RatingDispersionProfileReport(
  {
    claim,
    serverSummary,
    events,
    answer,
    rawResult,
    codexCliVersion,
    eventStreamSha256,
    serverSummarySha256,
  },
  { privateKey, root = ROOT } = {},
) {
  const verification = verifyA01RatingDispersionAnswer({
    answer,
    queryArguments: PROFILE?.calls[0]?.arguments,
    toolResult: { structuredContent: rawResult },
  });
  if (
    !PROFILE ||
    !assertA01RatingDispersionProfile(PROFILE) ||
    !validateA01RatingDispersionServerSummary(
      serverSummary,
      claim?.sourceCandidateSha,
      claim?.bundleSha256,
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
    events.exactArguments !== true ||
    events.exactToolEvent !== true ||
    events.exactServerName !== true ||
    events.exactCandidateBundle !== true ||
    events.answer === undefined ||
    events.answer !== answer ||
    !verification.passed ||
    !HEX_SHA256.test(eventStreamSha256 ?? '') ||
    !HEX_SHA256.test(serverSummarySha256 ?? '')
  )
    return {
      passed: false,
      reason: 'A01_RATING_RUNNER_GATE_INVALID',
      answerChecks: verification.checks,
    };

  let selectionBytes;
  try {
    selectionBytes = readFileSync(path.join(root, PROFILE.selectionEvidencePath));
  } catch {
    return { passed: false, reason: 'A01_RATING_SELECTION_EVIDENCE_MISSING' };
  }
  const publicRequestScope = serverSummary.publicRequestScope;
  const answerChecks = Object.fromEntries([
    ...A01_RATING_DISPERSION_ANSWER_CHECK_FIELDS.map((key) => [
      key,
      verification.checks[key] === true,
    ]),
    ['exactCandidateBundle', events.exactCandidateBundle],
    [
      'serverSummaryMatchesCandidate',
      validateA01RatingDispersionServerSummary(
        serverSummary,
        claim.sourceCandidateSha,
        claim.bundleSha256,
        root,
      ),
    ],
    [
      'serverAuthorizedOneCall',
      serverSummary.allowedCallCount === 1 && serverSummary.deniedCallCount === 0,
    ],
    ['serverResultSuccess', serverSummary.serverResultStatus === 'SUCCESS'],
    [
      'anonymousOfficialV0Only',
      publicRequestScope.anonymousOnly && publicRequestScope.officialV0Only,
    ],
    ['requestBudgetSatisfied', validateA01RatingDispersionRequestScope(publicRequestScope)],
    ['oneCodexMcpCall', events.codexMcpToolEventCount === 1 && events.turnCompleted === true],
    ['noExtraTools', events.nonMcpToolEventCount === 0 && events.shellToolCallCount === 0],
    [
      'privacyPreserved',
      canonicalAgentMcpProfileJson(serverSummary.privacy) === canonicalAgentMcpProfileJson(PRIVACY),
    ],
  ]);
  let descriptors;
  try {
    const catalog = JSON.parse(readFileSync(path.join(root, 'docs/tool-catalog.json'), 'utf8'));
    const item = catalog.find((row) => row?.name === PROFILE.toolName);
    descriptors = [
      {
        toolName: PROFILE.toolName,
        descriptionSha256: sha256(item.description ?? ''),
        inputSchemaSha256: canonicalSha256(item.inputSchema),
      },
    ];
  } catch {
    return { passed: false, reason: 'A01_RATING_CATALOG_UNAVAILABLE' };
  }
  const report = {
    schemaVersion: 1,
    evidenceKind: PROFILE.evidenceKind,
    runNumber: 95,
    frontierId: 'A01',
    scenarioId: 'A01',
    acceptanceScope: PROFILE.acceptanceScope,
    epochId: PROFILE.epochId,
    profileId: PROFILE.id,
    profile: 'codex-luna-max-one-tool-anonymous-public-agent-mcp-v1',
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
    toolName: PROFILE.toolName,
    toolNames: [PROFILE.toolName],
    argumentProfile: PROFILE.argumentProfile,
    expectedArgumentsSha256: agentMcpProfileArgumentsSha256(PROFILE),
    catalogSha256: serverSummary.catalogSha256,
    toolDescriptors: descriptors,
    serverToolNames: serverSummary.serverToolNames,
    serverToolCount: serverSummary.serverToolCount,
    networkMode: A01_RATING_DISPERSION_NETWORK_MODE,
    mcpServerNames: [A01_RATING_DISPERSION_SERVER_ID],
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
    publicRequestScope,
    answerCheckMethod: PROFILE.answerCheckMethod,
    answerSha256: sha256(answer),
    answerUtf8Bytes: Buffer.byteLength(answer, 'utf8'),
    answerChecks,
    resultSummary: serverSummary.results[0].resultSummary,
    privacy: PRIVACY,
    runnerReceipt: null,
  };
  report.runnerReceipt = createRunnerReceipt(
    buildA01RatingDispersionRunnerReceiptPayload(report, {
      eventStreamSha256,
      serverSummarySha256,
    }),
    { publicKeyBase64: claim.runnerReceiptPublicKey, privateKey },
  );
  const validation = validateA01RatingDispersionProfileReport(report, claim, null, root);
  return validation.passed ? { passed: true, report } : validation;
}

export function writeA01RatingDispersionProfileReport(input, options = {}) {
  const built = buildA01RatingDispersionProfileReport(input, options);
  if (!built.passed) return built;
  const root = options.root ?? ROOT;
  const target = path.join(root, A01_RATING_DISPERSION_REPORT_RELATIVE_PATH);
  if (existsSync(target)) return { passed: false, reason: 'A01_RATING_REPORT_ALREADY_EXISTS' };
  const bytes = Buffer.from(`${JSON.stringify(built.report, null, 2)}\n`, 'utf8');
  const validation = validateA01RatingDispersionProfileReport(
    built.report,
    input.claim,
    bytes,
    root,
  );
  if (!validation.passed) return validation;
  try {
    writeFileSync(target, bytes, { flag: 'wx', mode: 0o600 });
  } catch {
    return { passed: false, reason: 'A01_RATING_REPORT_WRITE_FAILED' };
  }
  return {
    passed: true,
    reportPath: A01_RATING_DISPERSION_REPORT_RELATIVE_PATH,
    reportSha256: sha256(bytes),
    report: built.report,
  };
}

export function validateA01RatingDispersionSanitizedReportFile(
  claim,
  root = ROOT,
  reportPath = null,
) {
  const target = reportPath ?? path.join(root, A01_RATING_DISPERSION_REPORT_RELATIVE_PATH);
  try {
    if (path.resolve(target) !== path.resolve(root, A01_RATING_DISPERSION_REPORT_RELATIVE_PATH)) {
      return { passed: false, reason: 'A01_RATING_REPORT_PATH_INVALID' };
    }
    const bytes = readFileSync(target);
    const report = JSON.parse(bytes.toString('utf8'));
    const validation = validateA01RatingDispersionProfileReport(report, claim, bytes, root);
    if (!validation.passed) return validation;
    return {
      passed: true,
      reportPath: A01_RATING_DISPERSION_REPORT_RELATIVE_PATH,
      reportSha256: sha256(bytes),
      report,
    };
  } catch {
    return { passed: false, reason: 'A01_RATING_REPORT_UNAVAILABLE' };
  }
}
