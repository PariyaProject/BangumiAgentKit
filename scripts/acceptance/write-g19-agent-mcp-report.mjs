import { createHash } from 'node:crypto';
import { closeSync, existsSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  G19_ANSWER_CHECK_METHOD,
  G19_ARGUMENT_PROFILE,
  G19_COVERAGE_FIELDS,
  G19_EXPECTED_QUERY_ARGUMENTS,
  G19_ORIGIN_COVERAGE_FIELDS,
  verifyG19PersonOriginAnswer,
} from './g19-person-origin-answer-check.mjs';
import { canonicalG19ClaimPath } from './run-g19-codex-agent-mcp.mjs';
import {
  computeMcpBundleSha256,
  gitRepositoryText,
  readG26McpBundleAttestation,
} from '../lib/g26-mcp-bundle.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const RUN_NUMBER = 95;
const FRONTIER_ID = 'G19';
const EPOCH_ID = 'run95-g19-person-origin-agent-mcp-evidence';
const TOOL_NAME = 'bangumi.get_person_activity';
const SERVER_ID = 'bgk_g19_one_tool';
const MODEL = 'gpt-6-luna';
const REASONING_EFFORT = 'max';
const REPORT_PATH = path.join(ROOT, 'docs/live-probes/g19-person-origin-agent-mcp-run95.json');
const SERVER_PRIVACY = {
  authProfile: 'anonymous', oauthAttempted: false, accountDataRead: false, writesAttempted: false,
  qqPipelineTested: false, timClientTested: false, promptStored: false, answerStored: false,
  rawResultStored: false, artifactImageBytesStored: false, credentialsStored: false,
};
const REPORT_PRIVACY = { ...SERVER_PRIVACY, communityRead: false };
const REPORT_FIELDS = [
  'schemaVersion', 'evidenceKind', 'runNumber', 'frontierId', 'scenarioId', 'epochId', 'profile',
  'model', 'reasoningEffort', 'reviewerId', 'codexCliVersion', 'sourceRevision', 'baseSha', 'prNumber',
  'mcpBundleSha256', 'observedAt', 'toolName', 'argumentProfile', 'expectedArgumentsSha256',
  'catalogSha256', 'toolDescriptionSha256', 'inputSchemaSha256', 'serverToolNames', 'serverToolCount',
  'mcpServerNames', 'processExitCode', 'resultStatus', 'eventStreamParsed', 'codexMcpToolEventCount',
  'nonMcpToolEventCount', 'nonMcpToolTypes', 'shellToolCallCount', 'allowedCallCount', 'deniedCallCount',
  'answerCheckMethod', 'answerChecks', 'answerCounters', 'toolCalls', 'toolTextUtf8Bytes',
  'resultSummary', 'resultByteLength', 'resultSha256', 'answerUtf8Bytes', 'answerSha256',
  'sourceOperations', 'privacy',
];
const ANSWER_CHECK_FIELDS = [
  'exactQueryArguments', 'exactSingleToolCall', 'structuredResultReadback', 'targetIdentityAndScope',
  'calendarWindowValid', 'successfulOfficialSources', 'boundedCoverageConsistent', 'sourceRowsValid',
  'sourceRowsDistinct', 'answerShapeValid', 'answerIdentityAndStateMatch', 'answerWindowMatches',
  'answerSummaryMatches', 'answerCoverageMatches', 'answerRowsMatch', 'answerGroupsMatch',
  'adaptationNotInferred', 'caveatDisclosurePresent', 'plainJsonWithoutMarkdown',
  'boundedAnswerBytes', 'boundedMcpTextView',
];
const ANSWER_COUNTER_FIELDS = [
  'sourceRows', 'answerRows', 'rowsMatched', 'missingRows', 'extraRows',
  'coverageFieldsMatched', 'toolTextUtf8Bytes',
];
const RESULT_SUMMARY_FIELDS = [
  'personId', 'kind', 'media', 'state', 'window', 'summary', 'coverage',
  'rowCount', 'rowDigest', 'sourceOperations',
];
const FORBIDDEN_KEYS = new Set([
  'answer', 'rawAnswer', 'rawResult', 'toolOutput', 'prompt', 'rows', 'subjectId',
  'subjectName', 'subjectNameCn', 'title', 'relationId', 'characterName', 'rawRole', 'metaTags',
]);

const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const canonical = (value) => Array.isArray(value)
  ? value.map(canonical)
  : isRecord(value)
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]))
    : value;
const canonicalJson = (value) => JSON.stringify(canonical(value));
const sameJson = (left, right) => canonicalJson(left) === canonicalJson(right);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function gitText(root, ...args) { return gitRepositoryText(root, args); }

function readClaim(input, root) {
  const file = canonicalG19ClaimPath(root);
  if (!existsSync(file)) throw new Error('G19 create-once claim is absent.');
  const claim = JSON.parse(readFileSync(file, 'utf8'));
  if (claim?.schemaVersion !== 1 || claim.runNumber !== RUN_NUMBER || claim.frontierId !== FRONTIER_ID ||
      claim.epochId !== EPOCH_ID || claim.state !== 'CLAIMED' || claim.sourceRevision !== input.sourceRevision ||
      claim.baseSha !== input.baseSha || claim.prNumber !== input.prNumber || claim.reviewerId !== input.reviewerId ||
      claim.bundleSha256 !== input.bundleSha256 ||
      claim.expectedArgumentsSha256 !== sha256(canonicalJson(G19_EXPECTED_QUERY_ARGUMENTS))) {
    throw new Error('G19 report input does not match its local create-once claim.');
  }
}

function catalogHashes(root) {
  const bytes = readFileSync(path.join(root, 'docs/tool-catalog.json'));
  const catalog = JSON.parse(bytes.toString('utf8'));
  const tool = catalog.find((entry) => entry?.name === TOOL_NAME);
  if (!tool || tool.auth !== 'none' || tool.risk !== 'read') {
    throw new Error('G19 report requires a current anonymous read-only catalog entry.');
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
    'GET /v0/persons/{person_id}/characters',
    'GET /v0/subjects/{subject_id}',
  ]);
  if (!Array.isArray(value) || value.length !== expected.size) return null;
  const rows = value.filter((item) => expected.has(item?.operation));
  if (rows.length !== value.length || new Set(rows.map((item) => item.operation)).size !== expected.size ||
      rows.some((item) => ['attempted', 'succeeded', 'failed'].some((key) =>
        !Number.isSafeInteger(item[key]) || item[key] < 0) || item.succeeded + item.failed !== item.attempted)) return null;
  return rows.map(({ operation, attempted, succeeded, failed }) => ({ operation, attempted, succeeded, failed }))
    .sort((left, right) => left.operation.localeCompare(right.operation));
}

function exactKeys(value, keys) {
  return isRecord(value) && sameJson(Object.keys(value).sort(), [...keys].sort());
}

function validateInput(input, root) {
  if (!isRecord(input) || input.model !== MODEL || input.reasoningEffort !== REASONING_EFFORT ||
      typeof input.codexCliVersion !== 'string' || !/^\d+\.\d+\.\d+$/u.test(input.codexCliVersion) ||
      input.processExitCode !== 0 || input.resultStatus !== 'SUCCESS' || input.eventStreamParsed !== true ||
      !sameJson(input.serverToolNames, [TOOL_NAME]) || input.serverToolCount !== 1 ||
      input.codexMcpToolEventCount !== 1 || !sameJson(input.mcpServerNames, [SERVER_ID]) ||
      input.nonMcpToolEventCount !== 0 || !Array.isArray(input.nonMcpToolTypes) || input.nonMcpToolTypes.length !== 0 ||
      input.shellToolCallCount !== 0 || input.allowedCallCount !== 1 || input.deniedCallCount !== 0 ||
      !sameJson(input.privacy, SERVER_PRIVACY) || !Array.isArray(input.toolCalls) || input.toolCalls.length !== 1 ||
      input.toolCalls[0]?.name !== TOOL_NAME || input.toolCalls[0]?.state !== 'DONE' ||
      !sameJson(input.toolCalls[0]?.arguments, G19_EXPECTED_QUERY_ARGUMENTS) ||
      !Number.isSafeInteger(input.toolTextUtf8Bytes) || input.toolTextUtf8Bytes <= 0 || input.toolTextUtf8Bytes > 3_600 ||
      !sameJson(input.queryArguments, G19_EXPECTED_QUERY_ARGUMENTS)) {
    throw new Error('G19 input failed the exact one-tool, Luna Max, no-extra-activity, or privacy gate.');
  }
  if (!/^[0-9a-f]{40}$/u.test(input.sourceRevision ?? '') || !/^[0-9a-f]{40}$/u.test(input.baseSha ?? '') ||
      !/^[0-9a-f]{64}$/u.test(input.bundleSha256 ?? '') || !Number.isSafeInteger(input.prNumber) || input.prNumber < 1 ||
      !new RegExp(`^gpt-6-luna-max-run95-pr${input.prNumber}-round\\d+$`, 'u').test(input.reviewerId ?? '')) {
    throw new Error('G19 report requires an exact reviewed Candidate/Base/PR/reviewer identity.');
  }
  if (gitText(root, 'rev-parse', 'HEAD') !== input.sourceRevision || gitText(root, 'status', '--porcelain') !== '' ||
      computeMcpBundleSha256(root) !== input.bundleSha256 || readG26McpBundleAttestation(root) !== input.bundleSha256) {
    throw new Error('G19 report must bind to the unchanged clean Candidate and attested MCP bundle.');
  }
  readClaim(input, root);
}

function summaryContainsForbiddenKey(value) {
  if (Array.isArray(value)) return value.some(summaryContainsForbiddenKey);
  if (!isRecord(value)) return false;
  return Object.entries(value).some(([key, child]) => FORBIDDEN_KEYS.has(key) || summaryContainsForbiddenKey(child));
}

function sanitizedResultSummary(value) {
  if (!exactKeys(value, RESULT_SUMMARY_FIELDS) || value.personId !== 3474 || value.kind !== 'all' ||
      value.media !== 'anime' || !['complete', 'partial'].includes(value.state) ||
      !Number.isSafeInteger(value.rowCount) || value.rowCount < 0 || value.rowCount > G19_EXPECTED_QUERY_ARGUMENTS.maxRows ||
      typeof value.rowDigest !== 'string' || !/^[0-9a-f]{64}$/u.test(value.rowDigest) ||
      !exactKeys(value.window, ['months', 'start', 'end', 'monthKeys', 'asOfSemantics']) ||
      value.window.months !== 3 || value.window.asOfSemantics !== 'calendar_months_ending_on_as_of_date' ||
      !Array.isArray(value.window.monthKeys) || value.window.monthKeys.length !== 3 ||
      !exactKeys(value.summary, ['creditRows', 'uniqueSubjects', 'uniqueCharacters', 'origin']) ||
      ['creditRows', 'uniqueSubjects', 'uniqueCharacters'].some((key) =>
        !Number.isSafeInteger(value.summary[key]) || value.summary[key] < 0) ||
      !exactKeys(value.summary.origin, ['explicitOriginalSubjects', 'notObservedSubjects', 'unknownSubjects']) ||
      Object.values(value.summary.origin).some((item) => !Number.isSafeInteger(item) || item < 0) ||
      value.summary.uniqueSubjects !== Object.values(value.summary.origin).reduce((sum, item) => sum + item, 0) ||
      !exactKeys(value.coverage, G19_COVERAGE_FIELDS) ||
      !exactKeys(value.coverage.origin, G19_ORIGIN_COVERAGE_FIELDS) ||
      typeof value.coverage.truncated !== 'boolean' || typeof value.coverage.sampled !== 'boolean' ||
      typeof value.coverage.outputTruncated !== 'boolean' ||
      typeof value.coverage.origin.truncated !== 'boolean' ||
      G19_COVERAGE_FIELDS.filter((key) => !['origin', 'relationSelectionStrategy', 'sampled', 'outputTruncated', 'truncated'].includes(key))
        .some((key) => !Number.isSafeInteger(value.coverage[key]) || value.coverage[key] < 0) ||
      G19_ORIGIN_COVERAGE_FIELDS.filter((key) => key !== 'truncated')
        .some((key) => !Number.isSafeInteger(value.coverage.origin[key]) || value.coverage.origin[key] < 0) ||
      !['all', 'deterministic_even_spread'].includes(value.coverage.relationSelectionStrategy) ||
      !Number.isSafeInteger(value.coverage.rowsReturned) || value.coverage.rowsReturned !== value.rowCount ||
      !Number.isSafeInteger(value.coverage.rowsEligible) || value.coverage.rowsEligible < value.rowCount) return null;
  const sourceOperations = safeSourceOperations(value.sourceOperations);
  if (!sourceOperations) return null;
  const safe = {
    personId: 3474,
    kind: 'all',
    media: 'anime',
    state: value.state,
    window: {
      months: 3, start: value.window.start, end: value.window.end,
      monthKeys: [...value.window.monthKeys], asOfSemantics: value.window.asOfSemantics,
    },
    summary: {
      creditRows: value.summary.creditRows,
      uniqueSubjects: value.summary.uniqueSubjects,
      uniqueCharacters: value.summary.uniqueCharacters,
      origin: { ...value.summary.origin },
    },
    coverage: value.coverage,
    rowCount: value.rowCount,
    rowDigest: value.rowDigest,
    sourceOperations,
  };
  return summaryContainsForbiddenKey(safe) ? null : safe;
}

export function buildG19SanitizedReport(input, answerResult, hashes, observedAt = new Date().toISOString()) {
  const resultSummary = sanitizedResultSummary(answerResult?.resultSummary);
  if (!isRecord(input) || input.model !== MODEL || input.reasoningEffort !== REASONING_EFFORT ||
      !/^[0-9a-f]{40}$/u.test(input.sourceRevision ?? '') || !/^[0-9a-f]{40}$/u.test(input.baseSha ?? '') ||
      !/^[0-9a-f]{64}$/u.test(input.bundleSha256 ?? '') || !Number.isSafeInteger(input.prNumber) ||
      !new RegExp(`^gpt-6-luna-max-run95-pr${input.prNumber}-round\\d+$`, 'u').test(input.reviewerId ?? '') ||
      !/^\d+\.\d+\.\d+$/u.test(input.codexCliVersion ?? '') ||
      !Number.isSafeInteger(input.toolTextUtf8Bytes) || input.toolTextUtf8Bytes <= 0 || input.toolTextUtf8Bytes > 3_600 ||
      answerResult?.passed !== true || !resultSummary || !isRecord(hashes) ||
      !exactKeys(hashes, ['catalogSha256', 'toolDescriptionSha256', 'inputSchemaSha256']) ||
      Object.values(hashes).some((hash) => typeof hash !== 'string' || !/^[0-9a-f]{64}$/u.test(hash)) ||
      !exactKeys(answerResult.answerChecks, ANSWER_CHECK_FIELDS) ||
      Object.values(answerResult.answerChecks).some((value) => value !== true) ||
      !exactKeys(answerResult.answerCounters, ANSWER_COUNTER_FIELDS) ||
      Object.values(answerResult.answerCounters).some((value) => !Number.isSafeInteger(value) || value < 0) ||
      answerResult.answerCounters.sourceRows !== resultSummary.rowCount ||
      answerResult.answerCounters.answerRows !== resultSummary.rowCount ||
      answerResult.answerCounters.rowsMatched !== resultSummary.rowCount ||
      answerResult.answerCounters.coverageFieldsMatched < 1 ||
      answerResult.answerCounters.toolTextUtf8Bytes !== input.toolTextUtf8Bytes ||
      !Number.isSafeInteger(answerResult.resultByteLength) || answerResult.resultByteLength <= 0 ||
      !Number.isSafeInteger(answerResult.answerUtf8Bytes) || answerResult.answerUtf8Bytes <= 0 ||
      answerResult.answerUtf8Bytes > 16_384 ||
      typeof answerResult.resultSha256 !== 'string' || !/^[0-9a-f]{64}$/u.test(answerResult.resultSha256) ||
      typeof answerResult.answerSha256 !== 'string' || !/^[0-9a-f]{64}$/u.test(answerResult.answerSha256)) {
    return { passed: false, reason: 'G19 answer, source, or report fields failed sanitized-evidence validation.' };
  }
  const safeSourceOps = safeSourceOperations(input.serverResultSummary?.sourceOperations);
  if (input.serverResultSummary?.toolName !== TOOL_NAME ||
      input.serverResultSummary?.resultState !== resultSummary.state ||
      !safeSourceOps || !sameJson(safeSourceOps, resultSummary.sourceOperations) ||
      input.serverResultSummary?.resultSha256 !== answerResult.resultSha256 ||
      input.serverResultSummary?.resultByteLength !== answerResult.resultByteLength) {
    return { passed: false, reason: 'G19 source summary does not match the exact MCP result projection.' };
  }
  const now = new Date(observedAt);
  if (!Number.isFinite(now.getTime())) return { passed: false, reason: 'G19 observation time is invalid.' };
  const report = {
    schemaVersion: 1,
    evidenceKind: 'codex_g19_person_origin_agent_mcp',
    runNumber: RUN_NUMBER,
    frontierId: FRONTIER_ID,
    scenarioId: 'G19',
    epochId: EPOCH_ID,
    profile: G19_ARGUMENT_PROFILE,
    model: MODEL,
    reasoningEffort: REASONING_EFFORT,
    reviewerId: input.reviewerId,
    codexCliVersion: input.codexCliVersion,
    sourceRevision: input.sourceRevision,
    baseSha: input.baseSha,
    prNumber: input.prNumber,
    mcpBundleSha256: input.bundleSha256,
    observedAt: now.toISOString(),
    toolName: TOOL_NAME,
    argumentProfile: G19_ARGUMENT_PROFILE,
    expectedArgumentsSha256: sha256(canonicalJson(G19_EXPECTED_QUERY_ARGUMENTS)),
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
    answerCheckMethod: G19_ANSWER_CHECK_METHOD,
    answerChecks: { ...answerResult.answerChecks },
    answerCounters: { ...answerResult.answerCounters },
    toolCalls: [{ name: TOOL_NAME, state: 'DONE', argumentsSha256: sha256(canonicalJson(G19_EXPECTED_QUERY_ARGUMENTS)) }],
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
    return { passed: false, reason: 'G19 report contains an unexpected or raw-output field.' };
  }
  return { passed: true, report };
}

function writeReport(report) {
  if (existsSync(REPORT_PATH)) throw new Error('G19 sanitized report already exists; refusing overwrite.');
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  let descriptor;
  try {
    descriptor = openSync(REPORT_PATH, 'wx', 0o600);
    writeFileSync(descriptor, serialized, 'utf8');
    closeSync(descriptor);
  } catch (error) {
    if (descriptor !== undefined) { try { closeSync(descriptor); } catch { /* Preserve the write failure. */ } }
    throw error;
  }
}

export function acceptG19AgentMcpEvidence(input, root = ROOT, observedAt = new Date().toISOString()) {
  validateInput(input, root);
  const answerResult = verifyG19PersonOriginAnswer(
    input.answer, input.queryArguments, input.toolOutput, input.toolCalls, input.toolTextUtf8Bytes,
  );
  const result = buildG19SanitizedReport(input, answerResult, catalogHashes(root), observedAt);
  if (!result.passed) return result;
  try {
    writeReport(result.report);
    return {
      passed: true,
      reportPath: 'docs/live-probes/g19-person-origin-agent-mcp-run95.json',
      answerChecks: answerResult.answerChecks,
      answerCounters: answerResult.answerCounters,
      resultSummary: answerResult.resultSummary,
    };
  } catch {
    return { passed: false, reason: 'Unable to write the G19 sanitized report without overwriting existing evidence.' };
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => { input += chunk; });
  process.stdin.on('end', () => {
    try {
      const parsed = JSON.parse(input);
      const result = acceptG19AgentMcpEvidence(parsed);
      process.stdout.write(`${JSON.stringify(result)}\n`);
      process.exitCode = result.passed ? 0 : 1;
    } catch {
      process.stdout.write(`${JSON.stringify({ passed: false, reason: 'G19 sanitized-evidence validation failed.' })}\n`);
      process.exitCode = 1;
    }
  });
}
