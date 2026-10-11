import { createHash } from 'node:crypto';
import { closeSync, existsSync, lstatSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  P01_ANSWER_CHECK_METHOD,
  P01_ARGUMENT_PROFILE,
  P01_COVERAGE_FIELDS,
  P01_EXPECTED_QUERY_ARGUMENTS,
  verifyP01PersonPositionAnswer,
} from './p01-person-position-answer-check.mjs';
import { canonicalP01ClaimPath } from './run-p01-codex-agent-mcp.mjs';
import {
  computeMcpBundleSha256,
  gitRepositoryText,
  readG26McpBundleAttestation,
} from '../lib/g26-mcp-bundle.mjs';
import {
  buildP01RunnerReceiptPayload,
  p01RunnerPublicKeySha256,
  verifyP01RunnerReceipt,
} from './p01-runner-receipt.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const RUN_NUMBER = 95;
const FRONTIER_ID = 'P01';
const EPOCH_ID = 'run95-p01-person-role-agent-mcp';
const TOOL_NAME = 'bangumi.get_person_activity';
const SERVER_ID = 'bgk_p01_one_tool';
const MODEL = 'gpt-6-luna';
const REASONING_EFFORT = 'max';
const REPORT_PATH = path.join(ROOT, 'docs/live-probes/p01-person-position-agent-mcp-run95.json');
const REPORT_RELATIVE_PATH = 'docs/live-probes/p01-person-position-agent-mcp-run95.json';
const SERVER_PRIVACY = {
  authProfile: 'anonymous',
  oauthAttempted: false,
  accountDataRead: false,
  writesAttempted: false,
  qqPipelineTested: false,
  timClientTested: false,
  promptStored: false,
  answerStored: false,
  rawResultStored: false,
  artifactImageBytesStored: false,
  credentialsStored: false,
};
const REPORT_PRIVACY = { ...SERVER_PRIVACY, communityRead: false };
const RESULT_SUMMARY_FIELDS = [
  'personId',
  'kind',
  'media',
  'state',
  'window',
  'summary',
  'coverage',
  'rowCount',
  'roleLabelCount',
  'unknownRoleRows',
  'sourceRowDigest',
  'sourceOperations',
];
const SUMMARY_FIELDS = ['creditRows', 'uniqueSubjects', 'uniqueCharacters'];
const WINDOW_FIELDS = ['months', 'start', 'end', 'monthKeys', 'asOfSemantics'];
const CANDIDATE_GATE_FIELDS = [
  'candidateSha',
  'baseSha',
  'ciSha',
  'ciStatus',
  'reviewPassSha',
  'reviewVerdict',
  'reviewerId',
];
const REPORT_FIELDS = [
  'schemaVersion',
  'evidenceKind',
  'runNumber',
  'frontierId',
  'scenarioId',
  'epochId',
  'profile',
  'model',
  'reasoningEffort',
  'reviewerId',
  'claimId',
  'runnerReceipt',
  'codexCliVersion',
  'sourceRevision',
  'baseSha',
  'prNumber',
  'mcpBundleSha256',
  'observedAt',
  'candidateGate',
  'toolName',
  'argumentProfile',
  'expectedArgumentsSha256',
  'catalogSha256',
  'toolDescriptionSha256',
  'inputSchemaSha256',
  'serverToolNames',
  'serverToolCount',
  'mcpServerNames',
  'processExitCode',
  'resultStatus',
  'eventStreamParsed',
  'codexMcpToolEventCount',
  'nonMcpToolEventCount',
  'nonMcpToolTypes',
  'shellToolCallCount',
  'allowedCallCount',
  'deniedCallCount',
  'answerCheckMethod',
  'answerChecks',
  'answerCounters',
  'toolCalls',
  'toolTextUtf8Bytes',
  'resultSummary',
  'resultByteLength',
  'resultSha256',
  'answerUtf8Bytes',
  'answerSha256',
  'sourceOperations',
  'privacy',
];
const ANSWER_CHECK_FIELDS = [
  'exactQueryArguments',
  'exactSingleToolCall',
  'completeSourceReadback',
  'targetIdentityAndScope',
  'calendarWindowValid',
  'successfulOfficialSources',
  'boundedCoverageConsistent',
  'sourceRowsValid',
  'sourceRowsDistinct',
  'answerShapeValid',
  'answerIdentityAndStateMatch',
  'answerSummaryMatches',
  'answerRoleFrequencyMatches',
  'answerUnknownRoleRowsMatch',
  'answerCoverageMatches',
  'answerRowsMatch',
  'boundedSampleCaveatPresent',
  'noUnsupportedCareerClaim',
  'plainJsonWithoutMarkdown',
  'boundedAnswerBytes',
  'boundedMcpTextView',
];
const ANSWER_COUNTER_FIELDS = [
  'sourceRows',
  'answerRows',
  'rowsMatched',
  'sourceRoleLabels',
  'answerRoleLabels',
  'knownRoleRows',
  'unknownRoleRows',
  'coverageFieldsMatched',
  'toolTextUtf8Bytes',
];
const FORBIDDEN_KEYS = new Set([
  'answer',
  'rawAnswer',
  'rawResult',
  'toolOutput',
  'prompt',
  'rows',
  'subjectId',
  'subjectName',
  'subjectNameCn',
  'title',
  'relationId',
  'characterName',
  'rawRole',
  'metaTags',
]);

const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const canonical = (value) =>
  Array.isArray(value)
    ? value.map(canonical)
    : isRecord(value)
      ? Object.fromEntries(
          Object.keys(value)
            .sort()
            .map((key) => [key, canonical(value[key])]),
        )
      : value;
const canonicalJson = (value) => JSON.stringify(canonical(value));
const sameJson = (left, right) => canonicalJson(left) === canonicalJson(right);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function gitText(root, ...args) {
  return gitRepositoryText(root, args);
}

function exactKeys(value, keys) {
  return isRecord(value) && sameJson(Object.keys(value).sort(), [...keys].sort());
}

function readClaim(input, root) {
  const file = canonicalP01ClaimPath(root);
  if (!existsSync(file)) throw new Error('P01 create-once claim is absent.');
  const claim = JSON.parse(readFileSync(file, 'utf8'));
  if (
    claim?.schemaVersion !== 1 ||
    claim.runNumber !== RUN_NUMBER ||
    claim.frontierId !== FRONTIER_ID ||
    claim.epochId !== EPOCH_ID ||
    claim.state !== 'CLAIMED' ||
    claim.sourceRevision !== input.sourceRevision ||
    claim.baseSha !== input.baseSha ||
    claim.prNumber !== input.prNumber ||
    claim.reviewerId !== input.reviewerId ||
    claim.ciSha !== input.sourceRevision ||
    claim.ciStatus !== 'SUCCESS' ||
    claim.claimId !== input.claimId ||
    claim.runnerReceiptPublicKey !== input.runnerReceiptPublicKey ||
    claim.runnerReceiptPublicKeySha256 !== p01RunnerPublicKeySha256(input.runnerReceiptPublicKey) ||
    claim.model !== MODEL ||
    claim.reasoningEffort !== REASONING_EFFORT ||
    claim.toolName !== TOOL_NAME ||
    claim.argumentProfile !== P01_ARGUMENT_PROFILE ||
    claim.bundleSha256 !== input.bundleSha256 ||
    claim.expectedArgumentsSha256 !== sha256(canonicalJson(P01_EXPECTED_QUERY_ARGUMENTS))
  )
    throw new Error('P01 report input does not match its local create-once claim.');
  return claim;
}

export function p01CatalogHashes(root = ROOT) {
  const bytes = readFileSync(path.join(root, 'docs/tool-catalog.json'));
  const catalog = JSON.parse(bytes.toString('utf8'));
  const tool = catalog.find((entry) => entry?.name === TOOL_NAME);
  if (!tool || tool.auth !== 'none' || tool.risk !== 'read') {
    throw new Error('P01 report requires a current anonymous read-only catalog entry.');
  }
  return {
    catalogSha256: sha256(bytes),
    toolDescriptionSha256: sha256(tool.description),
    inputSchemaSha256: sha256(canonicalJson(tool.inputSchema)),
  };
}

function safeSourceOperations(value) {
  const expected = new Set([
    'GET /v0/persons/{person_id}',
    'GET /v0/persons/{person_id}/subjects',
    'GET /v0/subjects/{subject_id}',
  ]);
  if (!Array.isArray(value) || value.length !== expected.size) return null;
  const rows = value.filter((item) => expected.has(item?.operation));
  if (
    rows.length !== value.length ||
    new Set(rows.map((item) => item.operation)).size !== expected.size ||
    rows.some(
      (item) =>
        ['attempted', 'succeeded', 'failed'].some(
          (key) => !Number.isSafeInteger(item[key]) || item[key] < 0,
        ) || item.succeeded + item.failed !== item.attempted,
    )
  )
    return null;
  return rows
    .map(({ operation, attempted, succeeded, failed }) => ({
      operation,
      attempted,
      succeeded,
      failed,
    }))
    .sort((left, right) => left.operation.localeCompare(right.operation));
}

function summaryContainsForbiddenKey(value) {
  if (Array.isArray(value)) return value.some(summaryContainsForbiddenKey);
  if (!isRecord(value)) return false;
  return Object.entries(value).some(
    ([key, child]) => FORBIDDEN_KEYS.has(key) || summaryContainsForbiddenKey(child),
  );
}

function validDateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}

function windowIsConsistent(window, retrievedAt) {
  const start = validDateOnly(window.start);
  const end = validDateOnly(window.end);
  const retrieved = new Date(retrievedAt);
  if (!start || !end || !Number.isFinite(retrieved.getTime())) return false;
  const monthIndex = end.getUTCFullYear() * 12 + end.getUTCMonth() - 35;
  const startYear = Math.floor(monthIndex / 12);
  const startMonth = (monthIndex % 12) + 1;
  const expectedStart = `${startYear}-${String(startMonth).padStart(2, '0')}-01`;
  const expectedMonthKeys = Array.from({ length: 36 }, (_, index) => {
    const absoluteMonth = monthIndex + index;
    const year = Math.floor(absoluteMonth / 12);
    const month = (absoluteMonth % 12) + 1;
    return `${year}-${String(month).padStart(2, '0')}`;
  });
  const retrievedDay = Date.UTC(
    retrieved.getUTCFullYear(),
    retrieved.getUTCMonth(),
    retrieved.getUTCDate(),
  );
  const endDay = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  return (
    window.start === expectedStart &&
    window.monthKeys.every((month, index) => month === expectedMonthKeys[index]) &&
    Math.abs(retrievedDay - endDay) <= 86_400_000
  );
}

function coverageIsConsistent(summary, coverage) {
  const relationSampled = coverage.relationRowsDroppedAtLimit > 0;
  const outputTruncated = coverage.rowsEligible > coverage.rowsReturned;
  const truncated =
    relationSampled || coverage.subjectDetailIdsDroppedAtLimit > 0 || outputTruncated;
  const checks = {
    relationLimit: coverage.relationRowsSelected <= P01_EXPECTED_QUERY_ARGUMENTS.maxRelations,
    relationObserved:
      coverage.relationRowsObserved ===
      coverage.relationRowsSelected + coverage.relationRowsDroppedAtLimit,
    selection:
      coverage.relationSelectionStrategy ===
      (coverage.relationRowsDroppedAtLimit > 0 ? 'deterministic_even_spread' : 'all'),
    sampled: coverage.sampled === relationSampled,
    idsSelected: coverage.subjectIdsSelected <= coverage.subjectIdsObserved,
    idsObserved: coverage.subjectIdsObserved <= coverage.relationRowsObserved,
    idsDropped:
      coverage.subjectIdsDroppedAtRelationLimit ===
      coverage.subjectIdsObserved - coverage.subjectIdsSelected,
    detailIds: coverage.subjectDetailIdsObserved === coverage.subjectIdsSelected,
    detailLimit: coverage.subjectDetailRequests <= P01_EXPECTED_QUERY_ARGUMENTS.maxSubjectDetails,
    detailOutcome:
      coverage.subjectDetailsSucceeded + coverage.subjectDetailsFailed ===
      coverage.subjectDetailRequests,
    detailsDropped:
      coverage.subjectDetailIdsDroppedAtLimit ===
      coverage.subjectIdsSelected - coverage.subjectDetailRequests,
    rowsEligible: coverage.rowsEligible === summary.summary.creditRows,
    rowsReturned: coverage.rowsReturned === summary.rowCount,
    rowsLimit: coverage.rowsReturned <= P01_EXPECTED_QUERY_ARGUMENTS.maxRows,
    rowsEligibleEnough: coverage.rowsEligible >= coverage.rowsReturned,
    outputTruncated: coverage.outputTruncated === outputTruncated,
    uniqueSubjects: coverage.uniqueSubjects === summary.summary.uniqueSubjects,
    uniqueCharacters: coverage.uniqueCharacters === 0,
    responseLimit: coverage.responseLimitBytes === 1_048_576,
    truncated: coverage.truncated === truncated,
  };
  return Object.values(checks).every(Boolean);
}

function sanitizedResultSummary(value) {
  if (
    !exactKeys(value, RESULT_SUMMARY_FIELDS) ||
    value.personId !== P01_EXPECTED_QUERY_ARGUMENTS.personId ||
    value.kind !== 'staff' ||
    value.media !== 'anime' ||
    !['complete', 'partial'].includes(value.state) ||
    !Number.isSafeInteger(value.rowCount) ||
    value.rowCount < 0 ||
    value.rowCount > P01_EXPECTED_QUERY_ARGUMENTS.maxRows ||
    !Number.isSafeInteger(value.roleLabelCount) ||
    value.roleLabelCount < 0 ||
    value.roleLabelCount > value.rowCount ||
    !Number.isSafeInteger(value.unknownRoleRows) ||
    value.unknownRoleRows < 0 ||
    value.unknownRoleRows > value.rowCount ||
    typeof value.sourceRowDigest !== 'string' ||
    !/^[0-9a-f]{64}$/u.test(value.sourceRowDigest) ||
    !exactKeys(value.window, WINDOW_FIELDS) ||
    value.window.months !== 36 ||
    value.window.asOfSemantics !== 'calendar_months_ending_on_as_of_date' ||
    !Array.isArray(value.window.monthKeys) ||
    value.window.monthKeys.length !== 36 ||
    !exactKeys(value.summary, SUMMARY_FIELDS) ||
    Object.values(value.summary).some((item) => !Number.isSafeInteger(item) || item < 0) ||
    value.summary.uniqueCharacters !== 0 ||
    value.summary.uniqueSubjects > value.summary.creditRows ||
    !exactKeys(value.coverage, P01_COVERAGE_FIELDS) ||
    P01_COVERAGE_FIELDS.filter(
      (key) =>
        ![
          'outputTruncated',
          'sampled',
          'truncated',
          'relationSelectionStrategy',
          'retrievedAt',
        ].includes(key),
    ).some((key) => !Number.isSafeInteger(value.coverage[key]) || value.coverage[key] < 0) ||
    ['outputTruncated', 'sampled', 'truncated'].some(
      (key) => typeof value.coverage[key] !== 'boolean',
    ) ||
    !['all', 'deterministic_even_spread'].includes(value.coverage.relationSelectionStrategy) ||
    typeof value.coverage.retrievedAt !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value.coverage.retrievedAt) ||
    !Number.isFinite(Date.parse(value.coverage.retrievedAt)) ||
    value.coverage.rowsReturned !== value.rowCount ||
    value.coverage.rowsEligible < value.rowCount ||
    value.coverage.maxRelations !== P01_EXPECTED_QUERY_ARGUMENTS.maxRelations ||
    value.coverage.maxSubjectDetails !== P01_EXPECTED_QUERY_ARGUMENTS.maxSubjectDetails ||
    value.coverage.maxRows !== P01_EXPECTED_QUERY_ARGUMENTS.maxRows
  )
    return null;
  const coverage = value.coverage;
  if (
    !windowIsConsistent(value.window, coverage.retrievedAt) ||
    !coverageIsConsistent(value, coverage) ||
    value.roleLabelCount + value.unknownRoleRows > value.rowCount
  )
    return null;
  const sourceIsIncomplete =
    value.unknownRoleRows > 0 ||
    coverage.truncated ||
    coverage.subjectDetailsFailed > 0 ||
    coverage.missingSubjectIdRows > 0 ||
    coverage.missingDateRows > 0 ||
    coverage.invalidDateRows > 0 ||
    coverage.mediaUnknownRows > 0 ||
    coverage.staffRoleUnknownRows > 0;
  if (sourceIsIncomplete && value.state !== 'partial') return null;
  const sourceOperations = safeSourceOperations(value.sourceOperations);
  if (!sourceOperations) return null;
  const operationsByName = new Map(sourceOperations.map((item) => [item.operation, item]));
  if (
    ['GET /v0/persons/{person_id}', 'GET /v0/persons/{person_id}/subjects'].some(
      (operation) =>
        !sameJson(operationsByName.get(operation), {
          operation,
          attempted: 1,
          succeeded: 1,
          failed: 0,
        }),
    ) ||
    !sameJson(operationsByName.get('GET /v0/subjects/{subject_id}'), {
      operation: 'GET /v0/subjects/{subject_id}',
      attempted: coverage.subjectDetailRequests,
      succeeded: coverage.subjectDetailsSucceeded,
      failed: coverage.subjectDetailsFailed,
    })
  )
    return null;
  const safe = {
    personId: P01_EXPECTED_QUERY_ARGUMENTS.personId,
    kind: 'staff',
    media: 'anime',
    state: value.state,
    window: { ...value.window, monthKeys: [...value.window.monthKeys] },
    summary: { ...value.summary },
    coverage: { ...value.coverage },
    rowCount: value.rowCount,
    roleLabelCount: value.roleLabelCount,
    unknownRoleRows: value.unknownRoleRows,
    sourceRowDigest: value.sourceRowDigest,
    sourceOperations,
  };
  return summaryContainsForbiddenKey(safe) ? null : safe;
}

function validateInput(input, root) {
  if (
    !isRecord(input) ||
    input.model !== MODEL ||
    input.reasoningEffort !== REASONING_EFFORT ||
    typeof input.codexCliVersion !== 'string' ||
    !/^\d+\.\d+\.\d+$/u.test(input.codexCliVersion) ||
    input.processExitCode !== 0 ||
    input.resultStatus !== 'SUCCESS' ||
    input.eventStreamParsed !== true ||
    !sameJson(input.serverToolNames, [TOOL_NAME]) ||
    input.serverToolCount !== 1 ||
    input.codexMcpToolEventCount !== 1 ||
    !sameJson(input.mcpServerNames, [SERVER_ID]) ||
    input.nonMcpToolEventCount !== 0 ||
    !Array.isArray(input.nonMcpToolTypes) ||
    input.nonMcpToolTypes.length !== 0 ||
    input.shellToolCallCount !== 0 ||
    input.allowedCallCount !== 1 ||
    input.deniedCallCount !== 0 ||
    !sameJson(input.privacy, SERVER_PRIVACY) ||
    !Array.isArray(input.toolCalls) ||
    input.toolCalls.length !== 1 ||
    input.toolCalls[0]?.name !== TOOL_NAME ||
    input.toolCalls[0]?.state !== 'DONE' ||
    !sameJson(input.toolCalls[0]?.arguments, P01_EXPECTED_QUERY_ARGUMENTS) ||
    !Number.isSafeInteger(input.toolTextUtf8Bytes) ||
    input.toolTextUtf8Bytes <= 0 ||
    input.toolTextUtf8Bytes > 3600 ||
    !sameJson(input.queryArguments, P01_EXPECTED_QUERY_ARGUMENTS)
  )
    throw new Error(
      'P01 input failed the exact one-tool, Luna Max, no-extra-activity, or privacy gate.',
    );
  if (
    !/^[0-9a-f]{40}$/u.test(input.sourceRevision ?? '') ||
    !/^[0-9a-f]{40}$/u.test(input.baseSha ?? '') ||
    !/^[0-9a-f]{64}$/u.test(input.bundleSha256 ?? '') ||
    !Number.isSafeInteger(input.prNumber) ||
    input.prNumber < 1 ||
    !new RegExp(`^gpt-6-luna-max-run95-pr${input.prNumber}-round\\d+$`, 'u').test(
      input.reviewerId ?? '',
    )
  )
    throw new Error('P01 report requires an exact reviewed Candidate/Base/PR/reviewer identity.');
  if (
    gitText(root, 'rev-parse', 'HEAD') !== input.sourceRevision ||
    gitText(root, 'status', '--porcelain') !== '' ||
    computeMcpBundleSha256(root) !== input.bundleSha256 ||
    readG26McpBundleAttestation(root) !== input.bundleSha256
  )
    throw new Error(
      'P01 report must bind to the unchanged clean Candidate and attested MCP bundle.',
    );
  return readClaim(input, root);
}

export function buildP01SanitizedReport(
  input,
  answerResult,
  hashes,
  observedAt = new Date().toISOString(),
) {
  const resultSummary = sanitizedResultSummary(answerResult?.resultSummary);
  if (!resultSummary) {
    return { passed: false, reason: 'P01 result summary failed coverage and source validation.' };
  }
  if (
    !isRecord(input) ||
    input.model !== MODEL ||
    input.reasoningEffort !== REASONING_EFFORT ||
    !/^[0-9a-f]{40}$/u.test(input.sourceRevision ?? '') ||
    !/^[0-9a-f]{40}$/u.test(input.baseSha ?? '') ||
    !/^[0-9a-f]{64}$/u.test(input.bundleSha256 ?? '') ||
    !Number.isSafeInteger(input.prNumber) ||
    !new RegExp(`^gpt-6-luna-max-run95-pr${input.prNumber}-round\\d+$`, 'u').test(
      input.reviewerId ?? '',
    ) ||
    typeof input.claimId !== 'string' ||
    !new RegExp(
      `^p01-run-${RUN_NUMBER}-pr-${input.prNumber}-${input.sourceRevision.slice(0, 12)}-\\d+$`,
      'u',
    ).test(input.claimId) ||
    !/^\d+\.\d+\.\d+$/u.test(input.codexCliVersion ?? '') ||
    !Number.isSafeInteger(input.toolTextUtf8Bytes) ||
    input.toolTextUtf8Bytes <= 0 ||
    input.toolTextUtf8Bytes > 3600 ||
    answerResult?.passed !== true ||
    !isRecord(hashes) ||
    !exactKeys(hashes, ['catalogSha256', 'toolDescriptionSha256', 'inputSchemaSha256']) ||
    Object.values(hashes).some(
      (hash) => typeof hash !== 'string' || !/^[0-9a-f]{64}$/u.test(hash),
    ) ||
    !exactKeys(input.candidateGate, CANDIDATE_GATE_FIELDS) ||
    input.candidateGate.candidateSha !== input.sourceRevision ||
    input.candidateGate.baseSha !== input.baseSha ||
    input.candidateGate.ciSha !== input.sourceRevision ||
    input.candidateGate.ciStatus !== 'SUCCESS' ||
    input.candidateGate.reviewPassSha !== input.sourceRevision ||
    input.candidateGate.reviewVerdict !== 'PASS' ||
    input.candidateGate.reviewerId !== input.reviewerId ||
    !exactKeys(answerResult.answerChecks, ANSWER_CHECK_FIELDS) ||
    Object.values(answerResult.answerChecks).some((value) => value !== true) ||
    !exactKeys(answerResult.answerCounters, ANSWER_COUNTER_FIELDS) ||
    Object.values(answerResult.answerCounters).some(
      (value) => !Number.isSafeInteger(value) || value < 0,
    ) ||
    answerResult.answerCounters.sourceRows !== resultSummary.rowCount ||
    answerResult.answerCounters.answerRows !== resultSummary.rowCount ||
    answerResult.answerCounters.rowsMatched !== resultSummary.rowCount ||
    answerResult.answerCounters.sourceRoleLabels !== resultSummary.roleLabelCount ||
    answerResult.answerCounters.answerRoleLabels !== resultSummary.roleLabelCount ||
    answerResult.answerCounters.knownRoleRows + answerResult.answerCounters.unknownRoleRows !==
      answerResult.answerCounters.sourceRows ||
    answerResult.answerCounters.unknownRoleRows !== resultSummary.unknownRoleRows ||
    answerResult.answerCounters.coverageFieldsMatched !== P01_COVERAGE_FIELDS.length ||
    answerResult.answerCounters.toolTextUtf8Bytes !== input.toolTextUtf8Bytes ||
    !Number.isSafeInteger(answerResult.resultByteLength) ||
    answerResult.resultByteLength <= 0 ||
    !Number.isSafeInteger(answerResult.answerUtf8Bytes) ||
    answerResult.answerUtf8Bytes <= 0 ||
    answerResult.answerUtf8Bytes > 16_384 ||
    typeof answerResult.resultSha256 !== 'string' ||
    !/^[0-9a-f]{64}$/u.test(answerResult.resultSha256) ||
    typeof answerResult.answerSha256 !== 'string' ||
    !/^[0-9a-f]{64}$/u.test(answerResult.answerSha256)
  )
    return {
      passed: false,
      reason: 'P01 answer, source, or report fields failed sanitized-evidence validation.',
    };
  let expectedReceiptPayload;
  try {
    if (
      !isRecord(input.runnerReceipt) ||
      input.runnerReceipt.publicKeyBase64 !== input.runnerReceiptPublicKey ||
      input.runnerReceipt.publicKeySha256 !==
        p01RunnerPublicKeySha256(input.runnerReceiptPublicKey) ||
      !/^[0-9a-f]{64}$/u.test(input.runnerEventStreamSha256 ?? '') ||
      !/^[0-9a-f]{64}$/u.test(input.runnerServerSummarySha256 ?? '')
    ) {
      throw new Error('Runner receipt keys or event digests are invalid.');
    }
    expectedReceiptPayload = buildP01RunnerReceiptPayload(input, answerResult);
  } catch {
    return { passed: false, reason: 'P01 signed runner receipt is missing or malformed.' };
  }
  if (
    !verifyP01RunnerReceipt(
      input.runnerReceipt,
      input.runnerReceiptPublicKey,
      expectedReceiptPayload,
    )
  ) {
    return {
      passed: false,
      reason: 'P01 signed runner receipt does not attest the exact successful one-tool answer.',
    };
  }
  const sourceOperations = safeSourceOperations(input.serverResultSummary?.sourceOperations);
  if (
    input.serverResultSummary?.toolName !== TOOL_NAME ||
    input.serverResultSummary?.resultState !== resultSummary.state ||
    !sourceOperations ||
    !sameJson(sourceOperations, resultSummary.sourceOperations) ||
    input.serverResultSummary?.resultSha256 !== answerResult.resultSha256 ||
    input.serverResultSummary?.resultByteLength !== answerResult.resultByteLength
  )
    return {
      passed: false,
      reason: 'P01 source summary does not match the exact MCP result projection.',
    };
  const now = new Date(observedAt);
  if (!Number.isFinite(now.getTime()))
    return { passed: false, reason: 'P01 observation time is invalid.' };
  const report = {
    schemaVersion: 1,
    evidenceKind: 'codex_p01_person_position_agent_mcp',
    runNumber: RUN_NUMBER,
    frontierId: FRONTIER_ID,
    scenarioId: 'P01',
    epochId: EPOCH_ID,
    profile: P01_ARGUMENT_PROFILE,
    model: MODEL,
    reasoningEffort: REASONING_EFFORT,
    reviewerId: input.reviewerId,
    claimId: input.claimId,
    runnerReceipt: structuredClone(input.runnerReceipt),
    codexCliVersion: input.codexCliVersion,
    sourceRevision: input.sourceRevision,
    baseSha: input.baseSha,
    prNumber: input.prNumber,
    mcpBundleSha256: input.bundleSha256,
    observedAt: now.toISOString(),
    candidateGate: { ...input.candidateGate },
    toolName: TOOL_NAME,
    argumentProfile: P01_ARGUMENT_PROFILE,
    expectedArgumentsSha256: sha256(canonicalJson(P01_EXPECTED_QUERY_ARGUMENTS)),
    ...hashes,
    serverToolNames: [TOOL_NAME],
    serverToolCount: 1,
    mcpServerNames: [SERVER_ID],
    processExitCode: 0,
    resultStatus: 'SUCCESS',
    eventStreamParsed: true,
    codexMcpToolEventCount: 1,
    nonMcpToolEventCount: 0,
    nonMcpToolTypes: [],
    shellToolCallCount: 0,
    allowedCallCount: 1,
    deniedCallCount: 0,
    answerCheckMethod: P01_ANSWER_CHECK_METHOD,
    answerChecks: { ...answerResult.answerChecks },
    answerCounters: { ...answerResult.answerCounters },
    toolCalls: [
      {
        name: TOOL_NAME,
        state: 'DONE',
        argumentsSha256: sha256(canonicalJson(P01_EXPECTED_QUERY_ARGUMENTS)),
      },
    ],
    toolTextUtf8Bytes: input.toolTextUtf8Bytes,
    resultSummary,
    resultByteLength: answerResult.resultByteLength,
    resultSha256: answerResult.resultSha256,
    answerUtf8Bytes: answerResult.answerUtf8Bytes,
    answerSha256: answerResult.answerSha256,
    sourceOperations: resultSummary.sourceOperations,
    privacy: { ...REPORT_PRIVACY },
  };
  if (!exactKeys(report, REPORT_FIELDS) || summaryContainsForbiddenKey(report)) {
    return { passed: false, reason: 'P01 report contains an unexpected or raw-output field.' };
  }
  return { passed: true, report };
}

export function validateP01SanitizedReport(report, expected, root = ROOT) {
  let expectedRunnerReceiptPublicKeySha256;
  try {
    expectedRunnerReceiptPublicKeySha256 = p01RunnerPublicKeySha256(
      expected?.runnerReceiptPublicKey,
    );
  } catch {
    expectedRunnerReceiptPublicKeySha256 = null;
  }
  if (
    !isRecord(expected) ||
    typeof expected.claimId !== 'string' ||
    expected.runNumber !== RUN_NUMBER ||
    expected.frontierId !== FRONTIER_ID ||
    expected.epochId !== EPOCH_ID ||
    expected.toolName !== TOOL_NAME ||
    expected.argumentProfile !== P01_ARGUMENT_PROFILE ||
    expected.model !== MODEL ||
    expected.reasoningEffort !== REASONING_EFFORT ||
    !/^[0-9a-f]{40}$/u.test(expected.sourceCandidateSha ?? '') ||
    !/^[0-9a-f]{40}$/u.test(expected.baseSha ?? '') ||
    expected.ciSha !== expected.sourceCandidateSha ||
    expected.ciStatus !== 'SUCCESS' ||
    !/^[0-9a-f]{64}$/u.test(expected.bundleSha256 ?? '') ||
    !Number.isSafeInteger(expected.prNumber) ||
    typeof expected.reviewerId !== 'string' ||
    !/^[A-Za-z0-9+/]+={0,2}$/u.test(expected.runnerReceiptPublicKey ?? '') ||
    expected.runnerReceiptPublicKeySha256 !== expectedRunnerReceiptPublicKeySha256 ||
    !/^[0-9a-f]{64}$/u.test(expected.expectedArgumentsSha256 ?? '')
  ) {
    return { passed: false, reason: 'P01 active Harness claim is malformed.' };
  }
  if (
    !isRecord(report) ||
    report.claimId !== expected.claimId ||
    report.runNumber !== expected.runNumber ||
    report.frontierId !== expected.frontierId ||
    report.epochId !== expected.epochId ||
    report.toolName !== expected.toolName ||
    report.argumentProfile !== expected.argumentProfile ||
    report.model !== expected.model ||
    report.reasoningEffort !== expected.reasoningEffort ||
    report.sourceRevision !== expected.sourceCandidateSha ||
    report.baseSha !== expected.baseSha ||
    report.prNumber !== expected.prNumber ||
    report.mcpBundleSha256 !== expected.bundleSha256 ||
    report.reviewerId !== expected.reviewerId ||
    report.runnerReceipt?.publicKeyBase64 !== expected.runnerReceiptPublicKey ||
    report.runnerReceipt?.publicKeySha256 !== expected.runnerReceiptPublicKeySha256 ||
    report.expectedArgumentsSha256 !== expected.expectedArgumentsSha256
  ) {
    return {
      passed: false,
      reason: 'P01 sanitized report does not match the active Harness claim.',
    };
  }

  let hashes;
  try {
    hashes = p01CatalogHashes(root);
  } catch {
    return { passed: false, reason: 'P01 current catalog binding could not be verified.' };
  }
  const input = {
    model: report.model,
    reasoningEffort: report.reasoningEffort,
    sourceRevision: report.sourceRevision,
    baseSha: report.baseSha,
    bundleSha256: report.mcpBundleSha256,
    prNumber: report.prNumber,
    reviewerId: report.reviewerId,
    claimId: report.claimId,
    runnerReceiptPublicKey: expected.runnerReceiptPublicKey,
    runnerReceipt: report.runnerReceipt,
    runnerEventStreamSha256: report.runnerReceipt?.payload?.eventStreamSha256,
    runnerServerSummarySha256: report.runnerReceipt?.payload?.serverSummarySha256,
    codexCliVersion: report.codexCliVersion,
    processExitCode: report.processExitCode,
    resultStatus: report.resultStatus,
    eventStreamParsed: report.eventStreamParsed,
    serverToolNames: report.serverToolNames,
    serverToolCount: report.serverToolCount,
    codexMcpToolEventCount: report.codexMcpToolEventCount,
    mcpServerNames: report.mcpServerNames,
    nonMcpToolEventCount: report.nonMcpToolEventCount,
    nonMcpToolTypes: report.nonMcpToolTypes,
    shellToolCallCount: report.shellToolCallCount,
    allowedCallCount: report.allowedCallCount,
    deniedCallCount: report.deniedCallCount,
    queryArguments: P01_EXPECTED_QUERY_ARGUMENTS,
    candidateGate: report.candidateGate,
    toolTextUtf8Bytes: report.toolTextUtf8Bytes,
    serverResultSummary: {
      toolName: report.toolName,
      resultState: report.resultSummary?.state,
      sourceOperations: report.sourceOperations,
      resultSha256: report.resultSha256,
      resultByteLength: report.resultByteLength,
    },
  };
  const answerResult = {
    passed: true,
    answerChecks: report.answerChecks,
    answerCounters: report.answerCounters,
    resultSummary: report.resultSummary,
    resultByteLength: report.resultByteLength,
    resultSha256: report.resultSha256,
    answerUtf8Bytes: report.answerUtf8Bytes,
    answerSha256: report.answerSha256,
  };
  const rebuilt = buildP01SanitizedReport(input, answerResult, hashes, report.observedAt);
  if (!rebuilt.passed || !sameJson(rebuilt.report, report)) {
    return {
      passed: false,
      reason: rebuilt.passed
        ? 'P01 sanitized report differs from the validated report contract.'
        : rebuilt.reason,
    };
  }
  return { passed: true };
}

export function validateP01SanitizedReportFile(expected, root = ROOT, reportPath = REPORT_PATH) {
  try {
    const stat = lstatSync(reportPath);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      return { passed: false, reason: 'P01 sanitized report must be a regular file.' };
    }
    const bytes = readFileSync(reportPath);
    const serialized = bytes.toString('utf8');
    const report = JSON.parse(serialized);
    if (serialized !== `${JSON.stringify(report, null, 2)}\n`) {
      return { passed: false, reason: 'P01 sanitized report is not canonical JSON.' };
    }
    if (path.resolve(reportPath) === path.resolve(REPORT_PATH)) {
      const status = gitText(root, 'status', '--porcelain');
      if (
        gitText(root, 'rev-parse', 'HEAD') !== expected.sourceCandidateSha ||
        (status !== '' && status !== `?? ${REPORT_RELATIVE_PATH}`) ||
        computeMcpBundleSha256(root) !== expected.bundleSha256 ||
        readG26McpBundleAttestation(root) !== expected.bundleSha256
      ) {
        return {
          passed: false,
          reason: 'P01 live Candidate, worktree, or MCP bundle no longer matches the active claim.',
        };
      }
    }
    const validation = validateP01SanitizedReport(report, expected, root);
    if (!validation.passed) return validation;
    return {
      passed: true,
      reportPath: REPORT_RELATIVE_PATH,
      reportSha256: sha256(bytes),
    };
  } catch {
    return {
      passed: false,
      reason: 'P01 sanitized report is absent, unreadable, or invalid JSON.',
    };
  }
}

function writeReport(report) {
  if (existsSync(REPORT_PATH))
    throw new Error('P01 sanitized report already exists; refusing overwrite.');
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  let descriptor;
  try {
    descriptor = openSync(REPORT_PATH, 'wx', 0o600);
    writeFileSync(descriptor, serialized, 'utf8');
    closeSync(descriptor);
  } catch (error) {
    if (descriptor !== undefined) {
      try {
        closeSync(descriptor);
      } catch {
        /* Preserve the write failure. */
      }
    }
    throw error;
  }
}

export function acceptP01AgentMcpEvidence(
  input,
  root = ROOT,
  observedAt = new Date().toISOString(),
) {
  const claim = validateInput(input, root);
  const answerResult = verifyP01PersonPositionAnswer(
    input.answer,
    input.queryArguments,
    input.toolOutput,
    input.toolCalls,
    input.toolTextUtf8Bytes,
  );
  const result = buildP01SanitizedReport(
    { ...input, claimId: claim.claimId },
    answerResult,
    p01CatalogHashes(root),
    observedAt,
  );
  if (!result.passed) return result;
  try {
    writeReport(result.report);
    return {
      passed: true,
      reportPath: REPORT_RELATIVE_PATH,
      answerChecks: answerResult.answerChecks,
      answerCounters: answerResult.answerCounters,
      resultSummary: answerResult.resultSummary,
    };
  } catch {
    return {
      passed: false,
      reason: 'Unable to write the P01 sanitized report without overwriting existing evidence.',
    };
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let input = '';
  process.stdin.setEncoding('utf8');
  for await (const chunk of process.stdin) input += chunk;
  try {
    const result = acceptP01AgentMcpEvidence(JSON.parse(input));
    if (result.passed) process.stdout.write(`${JSON.stringify(result)}\n`);
    else process.exitCode = 1;
  } catch {
    process.exitCode = 1;
  }
}
