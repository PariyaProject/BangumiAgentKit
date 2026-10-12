import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { spawnSync } from 'node:child_process';
import { closeSync, existsSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  G16_ANSWER_CHECK_METHOD,
  G16_ARGUMENT_PROFILE,
  G16_COVERAGE_FIELDS,
  G16_EXPECTED_QUERY_ARGUMENTS,
  verifyG16PersonActivityAnswer,
} from './g16-person-activity-answer-check.mjs';
import {
  assertG16CandidateReviewGate,
  canonicalG16ClaimPath,
} from './run-g16-codex-agent-mcp.mjs';
import {
  g16RunnerPublicKeySha256,
  g16RunnerReceiptPayloadFromReport,
  verifyG16RunnerReceipt,
} from './g16-agent-mcp-runner-receipt.mjs';
import {
  computeMcpBundleSha256,
  gitRepositoryText,
  readG26McpBundleAttestation,
  sanitizeGitRepositoryEnvironment,
} from '../lib/g26-mcp-bundle.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const RUN_NUMBER = 95;
const FRONTIER_ID = 'G16';
const EPOCH_ID = 'run95-g16-director-person-activity-agent-mcp';
const TOOL_NAME = 'bangumi.get_person_activity';
const SERVER_ID = 'bgk_g16_one_tool';
const MODEL = 'gpt-6-luna';
const REASONING_EFFORT = 'max';
const REPORT_PATH = path.join(ROOT, 'docs/live-probes/g16-director-person-activity-run95.json');
const SERVER_PRIVACY = {
  authProfile: 'anonymous', oauthAttempted: false, accountDataRead: false, writesAttempted: false,
  qqPipelineTested: false, timClientTested: false, promptStored: false, answerStored: false,
  rawResultStored: false, artifactImageBytesStored: false, credentialsStored: false,
};
const REPORT_PRIVACY = { ...SERVER_PRIVACY, communityRead: false };
const REPORT_FIELDS = [
  'schemaVersion', 'evidenceKind', 'runNumber', 'frontierId', 'scenarioId', 'epochId', 'profile',
  'model', 'reasoningEffort', 'reviewerId', 'codexCliVersion', 'sourceRevision', 'baseSha', 'prNumber',
  'claimId', 'mcpBundleSha256', 'runnerEventStreamSha256', 'runnerServerSummarySha256',
  'runnerReceipt', 'observedAt', 'toolName', 'argumentProfile', 'expectedArgumentsSha256',
  'catalogSha256', 'toolDescriptionSha256', 'inputSchemaSha256', 'serverToolNames', 'serverToolCount',
  'mcpServerNames', 'processExitCode', 'resultStatus', 'eventStreamParsed', 'codexMcpToolEventCount',
  'codexErrorItemCount',
  'nonMcpToolEventCount', 'nonMcpToolTypes', 'shellToolCallCount', 'allowedCallCount', 'deniedCallCount',
  'answerCheckMethod', 'answerChecks', 'answerCounters', 'toolCalls', 'toolTextUtf8Bytes',
  'resultSummary', 'resultByteLength', 'resultSha256', 'answerUtf8Bytes', 'answerSha256',
  'sourceOperations', 'privacy',
];
const RESULT_SUMMARY_FIELDS = [
  'personId', 'kind', 'staffRole', 'media', 'state', 'window', 'summary', 'coverage', 'rowCount',
  'rowDigest', 'sourceOperations',
];
const ANSWER_CHECK_FIELDS = [
  'exactQueryArguments', 'exactSingleToolCall', 'structuredResultReadback', 'targetIdentityAndScope',
  'calendarWindowValid', 'successfulOfficialSources', 'boundedCoverageConsistent', 'sourceRowsValid',
  'sourceRowsDistinct', 'answerShapeValid', 'answerIdentityAndStateMatch', 'observedCountMatches',
  'answerSummaryMatches', 'answerCoverageMatches', 'answerRowsMatch', 'caveatDisclosurePresent',
  'noUnsupportedPositiveClaim', 'plainJsonWithoutMarkdown', 'boundedAnswerBytes', 'boundedMcpTextView',
];
const ANSWER_COUNTER_FIELDS = [
  'sourceRows', 'answerRows', 'rowsMatched', 'missingRows', 'extraRows', 'coverageFieldsMatched', 'toolTextUtf8Bytes',
];
const FORBIDDEN_KEYS = new Set([
  'answer', 'rawAnswer', 'rawResult', 'toolOutput', 'prompt', 'rows', 'subjectId',
  'subjectName', 'subjectNameCn', 'title', 'relationId', 'characterName', 'rawRole',
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

function safeEnvironment(source = process.env, allowGitHub = false) {
  const environment = sanitizeGitRepositoryEnvironment(source);
  for (const key of Object.keys(environment)) {
    if (allowGitHub && (key === 'GH_TOKEN' || key === 'GITHUB_TOKEN')) continue;
    if (/(?:BANGUMI|BGM_|OAUTH|TOKEN|SECRET|CREDENTIAL|API[_-]?KEY)/iu.test(key)) delete environment[key];
  }
  return environment;
}

function gitText(root, ...args) { return gitRepositoryText(root, args); }

function readClaim(input, root) {
  const file = canonicalG16ClaimPath(root);
  if (!existsSync(file)) throw new Error('G16 create-once claim is absent.');
  const claim = JSON.parse(readFileSync(file, 'utf8'));
  if (claim?.schemaVersion !== 1 || claim.runNumber !== RUN_NUMBER || claim.frontierId !== FRONTIER_ID ||
      claim.epochId !== EPOCH_ID || claim.state !== 'CLAIMED' || claim.sourceRevision !== input.sourceRevision ||
      claim.baseSha !== input.baseSha || claim.prNumber !== input.prNumber || claim.reviewerId !== input.reviewerId ||
      claim.claimId !== input.claimId || claim.runnerReceiptPublicKey !== input.runnerReceiptPublicKey ||
      claim.runnerReceiptPublicKeySha256 !== g16RunnerPublicKeySha256(input.runnerReceiptPublicKey) ||
      claim.ciSha !== input.sourceRevision || claim.ciStatus !== 'SUCCESS' || claim.retryAllowed !== false ||
      claim.model !== MODEL || claim.reasoningEffort !== REASONING_EFFORT ||
      claim.bundleSha256 !== input.bundleSha256 ||
      claim.expectedArgumentsSha256 !== sha256(canonicalJson(G16_EXPECTED_QUERY_ARGUMENTS))) {
    throw new Error('G16 report input does not match its local create-once claim.');
  }
  return claim;
}

function catalogHashes(root) {
  const bytes = readFileSync(path.join(root, 'docs/tool-catalog.json'));
  const catalog = JSON.parse(bytes.toString('utf8'));
  const tool = catalog.find((entry) => entry?.name === TOOL_NAME);
  if (!tool || tool.auth !== 'none' || tool.risk !== 'read') {
    throw new Error('G16 report requires a current anonymous read-only catalog entry.');
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
  if (rows.length !== value.length || new Set(rows.map((item) => item.operation)).size !== expected.size ||
      rows.some((item) => ['attempted', 'succeeded', 'failed'].some((key) =>
        !Number.isSafeInteger(item[key]) || item[key] < 0) || item.succeeded + item.failed !== item.attempted)) return null;
  return rows.map(({ operation, attempted, succeeded, failed }) => ({ operation, attempted, succeeded, failed }))
    .sort((left, right) => left.operation.localeCompare(right.operation));
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
      !Number.isSafeInteger(input.toolTextUtf8Bytes) || input.toolTextUtf8Bytes <= 0 || input.toolTextUtf8Bytes > 3600 ||
      !sameJson(input.queryArguments, G16_EXPECTED_QUERY_ARGUMENTS)) {
    throw new Error('G16 input failed the exact one-tool, Luna Max, no-extra-activity, or privacy gate.');
  }
  if (!/^[0-9a-f]{40}$/u.test(input.sourceRevision ?? '') || !/^[0-9a-f]{40}$/u.test(input.baseSha ?? '') ||
      !/^[0-9a-f]{64}$/u.test(input.bundleSha256 ?? '') || !Number.isSafeInteger(input.prNumber) || input.prNumber < 1 ||
      !new RegExp(`^gpt-6-luna-max-run95-pr${input.prNumber}-round[1-9]\\d*$`, 'u').test(input.reviewerId ?? '') ||
      typeof input.claimId !== 'string' || !/^g16-run-95-pr-[0-9]+-[0-9a-f]{12}-[0-9]+$/u.test(input.claimId) ||
      typeof input.runnerReceiptPublicKey !== 'string' ||
      !/^[0-9a-f]{64}$/u.test(input.runnerEventStreamSha256 ?? '') ||
      !/^[0-9a-f]{64}$/u.test(input.runnerServerSummarySha256 ?? '') ||
      input.codexErrorItemCount !== 0) {
    throw new Error('G16 report requires an exact reviewed Candidate/Base/PR/reviewer identity.');
  }
  if (gitText(root, 'rev-parse', 'HEAD') !== input.sourceRevision || gitText(root, 'status', '--porcelain') !== '' ||
      computeMcpBundleSha256(root) !== input.bundleSha256 || readG26McpBundleAttestation(root) !== input.bundleSha256) {
    throw new Error('G16 report must bind to the unchanged clean Candidate and attested MCP bundle.');
  }
  readClaim(input, root);
}

function summaryHasForbiddenKey(value) {
  if (Array.isArray(value)) return value.some(summaryHasForbiddenKey);
  if (!isRecord(value)) return false;
  return Object.entries(value).some(([key, child]) => FORBIDDEN_KEYS.has(key) || summaryHasForbiddenKey(child));
}

function assertExactKeys(value, keys) {
  return isRecord(value) && sameJson(Object.keys(value).sort(), [...keys].sort());
}

function sanitizeResultSummary(value) {
  if (!assertExactKeys(value, RESULT_SUMMARY_FIELDS) || value.personId !== 6154 ||
      value.kind !== 'staff' || value.staffRole !== 'director' || value.media !== 'tv' ||
      !['complete', 'partial'].includes(value.state) || !Number.isSafeInteger(value.rowCount) ||
      value.rowCount < 0 || value.rowCount > G16_EXPECTED_QUERY_ARGUMENTS.maxRows ||
      typeof value.rowDigest !== 'string' || !/^[0-9a-f]{64}$/u.test(value.rowDigest) ||
      !assertExactKeys(value.window, ['months', 'start', 'end', 'monthKeys', 'asOfSemantics']) ||
      value.window.months !== 36 || value.window.asOfSemantics !== 'calendar_months_ending_on_as_of_date' ||
      typeof value.window.start !== 'string' || typeof value.window.end !== 'string' ||
      !Array.isArray(value.window.monthKeys) || value.window.monthKeys.length !== 36 ||
      !assertExactKeys(value.summary, ['creditRows', 'uniqueSubjects', 'uniqueCharacters']) ||
      Object.values(value.summary).some((item) => !Number.isSafeInteger(item) || item < 0) ||
      value.summary.uniqueSubjects > value.summary.creditRows || value.summary.uniqueCharacters !== 0 ||
      !assertExactKeys(value.coverage, G16_COVERAGE_FIELDS) ||
      Object.entries(value.coverage).some(([key, item]) =>
        key === 'outputTruncated' || key === 'truncated'
          ? typeof item !== 'boolean'
          : !Number.isSafeInteger(item) || item < 0)) {
    return null;
  }
  const sourceOperations = safeSourceOperations(value.sourceOperations);
  if (!sourceOperations) return null;
  return {
    personId: 6154,
    kind: 'staff',
    staffRole: 'director',
    media: 'tv',
    state: value.state,
    window: {
      months: 36,
      start: value.window.start,
      end: value.window.end,
      monthKeys: [...value.window.monthKeys],
      asOfSemantics: 'calendar_months_ending_on_as_of_date',
    },
    summary: {
      creditRows: value.summary.creditRows,
      uniqueSubjects: value.summary.uniqueSubjects,
      uniqueCharacters: 0,
    },
    coverage: Object.fromEntries(G16_COVERAGE_FIELDS.map((key) => [key, value.coverage[key]])),
    rowCount: value.rowCount,
    rowDigest: value.rowDigest,
    sourceOperations,
  };
}

export function buildG16SanitizedReport(input, answerResult, hashes, observedAt = new Date().toISOString()) {
  const safeSummary = sanitizeResultSummary(answerResult?.resultSummary);
  if (!isRecord(input) || input.model !== MODEL || input.reasoningEffort !== REASONING_EFFORT ||
      !/^[0-9a-f]{40}$/u.test(input.sourceRevision ?? '') || !/^[0-9a-f]{40}$/u.test(input.baseSha ?? '') ||
      !/^[0-9a-f]{64}$/u.test(input.bundleSha256 ?? '') || !Number.isSafeInteger(input.prNumber) ||
      !new RegExp(`^gpt-6-luna-max-run95-pr${input.prNumber}-round[1-9]\\d*$`, 'u').test(input.reviewerId ?? '') ||
      typeof input.claimId !== 'string' || !/^g16-run-95-pr-[0-9]+-[0-9a-f]{12}-[0-9]+$/u.test(input.claimId) ||
      !/^[0-9a-f]{64}$/u.test(input.runnerEventStreamSha256 ?? '') ||
      !/^[0-9a-f]{64}$/u.test(input.runnerServerSummarySha256 ?? '') ||
      input.codexErrorItemCount !== 0 || typeof input.runnerReceiptPublicKey !== 'string' ||
      !input.runnerReceipt || typeof input.runnerReceipt !== 'object' || Array.isArray(input.runnerReceipt) ||
      !/^\d+\.\d+\.\d+$/u.test(input.codexCliVersion ?? '') ||
      !Number.isSafeInteger(input.toolTextUtf8Bytes) || input.toolTextUtf8Bytes <= 0 || input.toolTextUtf8Bytes > 3600 ||
      !answerResult?.passed || !safeSummary || !isRecord(hashes) ||
      !assertExactKeys(hashes, ['catalogSha256', 'toolDescriptionSha256', 'inputSchemaSha256']) ||
      Object.values(hashes).some((hash) => typeof hash !== 'string' || !/^[0-9a-f]{64}$/u.test(hash)) ||
      !assertExactKeys(answerResult.answerChecks, ANSWER_CHECK_FIELDS) ||
      Object.values(answerResult.answerChecks).some((value) => value !== true) ||
      !assertExactKeys(answerResult.answerCounters, ANSWER_COUNTER_FIELDS) ||
      Object.values(answerResult.answerCounters).some((value) => !Number.isSafeInteger(value) || value < 0) ||
      answerResult.answerCounters.sourceRows !== safeSummary.rowCount ||
      answerResult.answerCounters.answerRows !== safeSummary.rowCount ||
      answerResult.answerCounters.rowsMatched !== safeSummary.rowCount ||
      answerResult.answerCounters.coverageFieldsMatched !== G16_COVERAGE_FIELDS.length ||
      answerResult.answerCounters.toolTextUtf8Bytes !== input.toolTextUtf8Bytes ||
      !Number.isSafeInteger(answerResult.resultByteLength) || answerResult.resultByteLength <= 0 ||
      !Number.isSafeInteger(answerResult.answerUtf8Bytes) || answerResult.answerUtf8Bytes <= 0 ||
      answerResult.answerUtf8Bytes > 16_384 ||
      typeof answerResult.resultSha256 !== 'string' || !/^[0-9a-f]{64}$/u.test(answerResult.resultSha256) ||
      typeof answerResult.answerSha256 !== 'string' || !/^[0-9a-f]{64}$/u.test(answerResult.answerSha256) ||
      summaryHasForbiddenKey(safeSummary)) {
    throw new Error('G16 sanitized report requires passing checks and a privacy-safe result summary.');
  }
  const report = {
    schemaVersion: 1,
    evidenceKind: 'codex_cli_g16_director_person_activity_agent_mcp',
    runNumber: RUN_NUMBER,
    frontierId: FRONTIER_ID,
    scenarioId: FRONTIER_ID,
    epochId: EPOCH_ID,
    profile: 'codex-luna-max-one-tool-v1',
    model: MODEL,
    reasoningEffort: REASONING_EFFORT,
    reviewerId: input.reviewerId,
    codexCliVersion: input.codexCliVersion,
    sourceRevision: input.sourceRevision,
    baseSha: input.baseSha,
    prNumber: input.prNumber,
    claimId: input.claimId,
    mcpBundleSha256: input.bundleSha256,
    runnerEventStreamSha256: input.runnerEventStreamSha256,
    runnerServerSummarySha256: input.runnerServerSummarySha256,
    runnerReceipt: input.runnerReceipt,
    observedAt,
    toolName: TOOL_NAME,
    argumentProfile: G16_ARGUMENT_PROFILE,
    expectedArgumentsSha256: sha256(canonicalJson(G16_EXPECTED_QUERY_ARGUMENTS)),
    ...hashes,
    serverToolNames: [TOOL_NAME],
    serverToolCount: 1,
    mcpServerNames: [SERVER_ID],
    processExitCode: 0,
    resultStatus: 'SUCCESS',
    eventStreamParsed: true,
    codexMcpToolEventCount: 1,
    codexErrorItemCount: 0,
    nonMcpToolEventCount: 0,
    nonMcpToolTypes: [],
    shellToolCallCount: 0,
    allowedCallCount: 1,
    deniedCallCount: 0,
    answerCheckMethod: G16_ANSWER_CHECK_METHOD,
    answerChecks: answerResult.answerChecks,
    answerCounters: answerResult.answerCounters,
    toolCalls: [{ name: TOOL_NAME, state: 'DONE' }],
    toolTextUtf8Bytes: input.toolTextUtf8Bytes,
    resultSummary: safeSummary,
    resultByteLength: answerResult.resultByteLength,
    resultSha256: answerResult.resultSha256,
    answerUtf8Bytes: answerResult.answerUtf8Bytes,
    answerSha256: answerResult.answerSha256,
    sourceOperations: safeSummary.sourceOperations,
    privacy: { ...REPORT_PRIVACY },
  };
  const payload = g16RunnerReceiptPayloadFromReport(report);
  if (!verifyG16RunnerReceipt(report.runnerReceipt, input.runnerReceiptPublicKey, payload)) {
    throw new Error('G16 runner receipt does not sign the exact sanitized Candidate evidence.');
  }
  if (!assertExactKeys(report, REPORT_FIELDS)) throw new Error('G16 report schema construction drifted.');
  return report;
}

export function validateG16SanitizedReportFile(disposition, root = ROOT, reportPath = REPORT_PATH) {
  try {
    const bytes = readFileSync(reportPath);
    const report = JSON.parse(bytes.toString('utf8'));
    if (!assertExactKeys(report, REPORT_FIELDS) ||
        !['CLAIMED', 'REPORT_WRITTEN'].includes(disposition?.state) || disposition.retryAllowed !== false ||
        report.claimId !== disposition.claimId || report.runNumber !== RUN_NUMBER ||
        report.frontierId !== FRONTIER_ID || report.epochId !== EPOCH_ID ||
        report.prNumber !== disposition.prNumber || report.sourceRevision !== disposition.sourceCandidateSha ||
        report.baseSha !== disposition.baseSha || report.reviewerId !== disposition.reviewerId ||
        report.mcpBundleSha256 !== disposition.bundleSha256 ||
        disposition.runnerReceiptPublicKey !== report.runnerReceipt?.publicKeyBase64 ||
        disposition.runnerReceiptPublicKeySha256 !== report.runnerReceipt?.publicKeySha256 ||
        (disposition.state === 'REPORT_WRITTEN' &&
          disposition.runnerReceiptSha256 !== sha256(canonicalJson(report.runnerReceipt))) ||
        g16RunnerPublicKeySha256(disposition.runnerReceiptPublicKey) !== disposition.runnerReceiptPublicKeySha256 ||
        !verifyG16RunnerReceipt(report.runnerReceipt, disposition.runnerReceiptPublicKey,
          g16RunnerReceiptPayloadFromReport(report)) ||
        summaryHasForbiddenKey(report)) {
      return { passed: false, reason: 'The G16 report or signed receipt does not match its durable one-shot claim.' };
    }
    const rebuilt = buildG16SanitizedReport({
      model: report.model,
      reasoningEffort: report.reasoningEffort,
      codexCliVersion: report.codexCliVersion,
      reviewerId: report.reviewerId,
      sourceRevision: report.sourceRevision,
      baseSha: report.baseSha,
      prNumber: report.prNumber,
      claimId: report.claimId,
      bundleSha256: report.mcpBundleSha256,
      runnerEventStreamSha256: report.runnerEventStreamSha256,
      runnerServerSummarySha256: report.runnerServerSummarySha256,
      runnerReceiptPublicKey: disposition.runnerReceiptPublicKey,
      codexErrorItemCount: report.codexErrorItemCount,
      toolTextUtf8Bytes: report.toolTextUtf8Bytes,
      runnerReceipt: report.runnerReceipt,
    }, {
      passed: true,
      answerChecks: report.answerChecks,
      answerCounters: report.answerCounters,
      resultSummary: report.resultSummary,
      resultByteLength: report.resultByteLength,
      resultSha256: report.resultSha256,
      answerUtf8Bytes: report.answerUtf8Bytes,
      answerSha256: report.answerSha256,
    }, {
      catalogSha256: report.catalogSha256,
      toolDescriptionSha256: report.toolDescriptionSha256,
      inputSchemaSha256: report.inputSchemaSha256,
    }, report.observedAt);
    if (!sameJson(report, rebuilt)) return { passed: false, reason: 'G16 report schema or sanitized fields changed.' };
    return {
      passed: true,
      report,
      reportPath: path.relative(root, reportPath).split(path.sep).join('/'),
      reportSha256: sha256(bytes),
    };
  } catch {
    return { passed: false, reason: 'G16 report could not be revalidated.' };
  }
}

function readHarnessStatus(root) {
  const result = spawnSync(process.execPath, [path.join(root, 'scripts/agent-harness.mjs'), 'status', '--run', String(RUN_NUMBER)], {
    cwd: root, env: safeEnvironment(process.env, true), encoding: 'utf8', maxBuffer: 2 * 1024 * 1024,
    timeout: 30_000, stdio: ['ignore', 'pipe', 'ignore'],
  });
  if (result.error || result.status !== 0) throw new Error('Unable to revalidate live Run 95 Harness state.');
  try { return JSON.parse(result.stdout ?? ''); } catch { throw new Error('Live Harness status was not valid JSON.'); }
}

function readOpenPr(prNumber, root) {
  const result = spawnSync('gh', ['pr', 'view', String(prNumber), '--json',
    'state,isDraft,baseRefName,headRefName,headRefOid,statusCheckRollup'], {
    cwd: root, env: safeEnvironment(process.env, true), encoding: 'utf8', maxBuffer: 64 * 1024,
    timeout: 30_000, stdio: ['ignore', 'pipe', 'ignore'],
  });
  if (result.error || result.status !== 0) throw new Error('Unable to revalidate the G16 Epoch PR.');
  try { return JSON.parse(result.stdout ?? ''); } catch { throw new Error('GitHub PR state was not valid JSON.'); }
}

function fetchCurrentMaster(root) {
  gitText(root, 'fetch', '--no-tags', 'origin', 'master');
  return gitText(root, 'rev-parse', 'origin/master');
}

export function buildG16AgentMcpReport(
  input,
  { root = ROOT, observedAt = new Date().toISOString(), liveStatus = null, pullRequest = null, currentBaseSha = null } = {},
) {
  validateInput(input, root);
  const answerResult = verifyG16PersonActivityAnswer(
    input.answer, input.queryArguments, input.toolOutput, input.toolCalls, input.toolTextUtf8Bytes,
  );
  if (!answerResult.passed || !answerResult.resultSummary ||
      !assertExactKeys(answerResult.answerChecks, ANSWER_CHECK_FIELDS) ||
      Object.values(answerResult.answerChecks).some((value) => value !== true)) {
    return { passed: false, answerChecks: answerResult.answerChecks, answerCounters: answerResult.answerCounters };
  }
  const baseSha = currentBaseSha ?? fetchCurrentMaster(root);
  const status = liveStatus ?? readHarnessStatus(root);
  const pr = pullRequest ?? readOpenPr(input.prNumber, root);
  const gate = assertG16CandidateReviewGate(status, pr, {
    sourceRevision: input.sourceRevision,
    currentBaseSha: baseSha,
    allowClaimedDisposition: true,
    expectedClaimId: input.claimId,
    runnerReceiptPublicKey: input.runnerReceiptPublicKey,
    bundleSha256: input.bundleSha256,
  });
  if (gate.prNumber !== input.prNumber || gate.baseSha !== input.baseSha || gate.reviewerId !== input.reviewerId) {
    throw new Error('G16 report Candidate, Base, PR, or Luna Max reviewer changed after the query.');
  }
  const sourceOperations = safeSourceOperations(answerResult.resultSummary.sourceOperations);
  if (!sourceOperations) throw new Error('G16 report contains unexpected official source operations.');
  const report = buildG16SanitizedReport(input, answerResult, catalogHashes(root), observedAt);
  return { passed: true, report, answerChecks: answerResult.answerChecks,
    answerCounters: answerResult.answerCounters, resultSummary: answerResult.resultSummary };
}

function writeReport(report) {
  if (existsSync(REPORT_PATH)) throw new Error('Canonical G16 report already exists; refusing to replace it.');
  let descriptor;
  try {
    descriptor = openSync(REPORT_PATH, 'wx', 0o600);
    writeFileSync(descriptor, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    closeSync(descriptor);
  } catch {
    if (descriptor !== undefined) { try { closeSync(descriptor); } catch { /* Keep create-new failure. */ } }
    throw new Error('Canonical G16 report already exists or cannot be safely created.');
  }
}

async function readInput() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function main() {
  try {
    const input = await readInput();
    const result = buildG16AgentMcpReport(input);
    if (!result.passed || !result.report) {
      process.stdout.write(`${JSON.stringify({ passed: false, answerChecks: result.answerChecks, answerCounters: result.answerCounters })}\n`);
      process.exitCode = 1;
      return;
    }
    const relative = path.relative(ROOT, REPORT_PATH).split(path.sep).join('/');
    if (relative !== 'docs/live-probes/g16-director-person-activity-run95.json') {
      throw new Error('G16 report path is fixed to the canonical acceptance artifact.');
    }
    writeReport(result.report);
    const reportSha256 = sha256(readFileSync(REPORT_PATH));
    process.stdout.write(`${JSON.stringify({ passed: true, answerChecks: result.answerChecks,
      answerCounters: result.answerCounters, resultSummary: result.resultSummary, reportSha256 })}\n`);
  } catch {
    process.stdout.write(`${JSON.stringify({ passed: false, state: 'INCONCLUSIVE' })}\n`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) void main();
