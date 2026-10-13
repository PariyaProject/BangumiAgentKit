import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  D07_EXPECTED_YEARS,
  D07_QUERY_ARGUMENTS_BY_YEAR,
  verifyD07CurrentRankAnswer,
} from './d07-current-rank-answer-check.mjs';
import { canonicalHash } from '../lib/frontier-ledger.mjs';
import { gitRepositoryText } from '../lib/g26-mcp-bundle.mjs';

const TARGET_TOOL = 'bangumi.query_subjects';
const SERVER_ID = 'bgk_d07_one_tool';
const MODEL = 'gpt-6-luna';
const REASONING_EFFORT = 'max';
const EPOCH_ID = 'run95-d07-current-rank-by-release-year';
const ARGUMENT_PROFILE = 'fixed-d07-current-rank-by-source-year-2016-2025-v1';
const ANSWER_PROFILE = 'd07-current-rank-by-source-year-v1';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const REPORT_RELATIVE_PATH =
  'docs/live-probes/d07-current-rank-by-release-year-agent-mcp-run95.json';
const REPORT_KEYS = [
  'schemaVersion',
  'evidenceKind',
  'runNumber',
  'scenarioId',
  'profile',
  'frontierId',
  'epochId',
  'sourceRevision',
  'baseSha',
  'prNumber',
  'claimId',
  'reviewerId',
  'mcpBundleSha256',
  'observedAt',
  'model',
  'reasoningEffort',
  'codexCliVersion',
  'toolName',
  'argumentProfile',
  'expectedArgumentsSha256',
  'catalogSha256',
  'toolDescriptionSha256',
  'inputSchemaSha256',
  'serverToolNames',
  'serverToolCount',
  'mcpServerNames',
  'expectedCallCount',
  'processExitCode',
  'eventStreamParsed',
  'eventStreamComplete',
  'turnCompleted',
  'codexMcpToolEventCount',
  'codexErrorItemCount',
  'nonMcpToolEventCount',
  'nonMcpToolTypes',
  'shellToolCallCount',
  'allowedCallCount',
  'deniedCallCount',
  'resultStatus',
  'answerCheckMethod',
  'answerChecks',
  'resultCounters',
  'resultSummaries',
  'retrievedAt',
  'privacy',
  'rawAnswerPersisted',
  'rawToolResultPersisted',
];
const ANSWER_CHECK_KEYS = [
  'validJsonAndBoundedSize',
  'answerSchema',
  'exactTenOrderedSourceCalls',
  'exactYearSequence',
  'rowsMatchSourceIdsRanksAndTitles',
  'currentSnapshotOnly',
  'historicalRankNotClaimed',
  'coverageLimitDisclosed',
  'allPassed',
];
const PRIVACY_KEYS = [
  'authProfile',
  'oauthAttempted',
  'accountDataRead',
  'writesAttempted',
  'communityRead',
  'qqPipelineTested',
  'timClientTested',
  'promptStored',
  'answerStored',
  'rawResultStored',
  'credentialsStored',
];

function isSha(value, length) {
  return typeof value === 'string' && new RegExp(`^[0-9a-f]{${length}}$`, 'u').test(value);
}

function exactKeys(value, expected) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).sort().join('\0') === [...expected].sort().join('\0'),
  );
}

function exactArguments(value, expected) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return (
    JSON.stringify(value, Object.keys(value).sort()) ===
    JSON.stringify(expected, Object.keys(expected).sort())
  );
}

function reportableRunnerShape(input, claim) {
  const events = input?.codexEvents;
  const server = input?.serverSummary;
  const expectedCalls = D07_EXPECTED_YEARS.map((year) => D07_QUERY_ARGUMENTS_BY_YEAR[year]);
  const eventCalls = Array.isArray(events?.toolCalls) ? events.toolCalls : [];
  const serverCalls = Array.isArray(server?.callSummaries) ? server.callSummaries : [];
  const observedAt = Date.parse(input?.observedAt ?? '');
  return (
    claim?.runNumber === 95 &&
    claim?.frontierId === 'D07' &&
    claim?.epochId === EPOCH_ID &&
    claim?.toolName === TARGET_TOOL &&
    claim?.argumentProfile === ARGUMENT_PROFILE &&
    claim?.expectedArgumentsSha256 === canonicalHash(D07_QUERY_ARGUMENTS_BY_YEAR) &&
    claim?.expectedCallCount === D07_EXPECTED_YEARS.length &&
    claim?.state === 'CLAIMED' &&
    claim?.retryAllowed === false &&
    claim?.model === MODEL &&
    claim?.reasoningEffort === REASONING_EFFORT &&
    Number.isSafeInteger(claim?.prNumber) &&
    isSha(claim?.sourceCandidateSha, 40) &&
    isSha(claim?.baseSha, 40) &&
    isSha(claim?.bundleSha256, 64) &&
    input?.sourceRevision === claim.sourceCandidateSha &&
    input?.baseSha === claim.baseSha &&
    input?.prNumber === claim.prNumber &&
    input?.claimId === claim.claimId &&
    input?.bundleSha256 === claim.bundleSha256 &&
    isSha(input?.catalogSha256, 64) &&
    isSha(input?.toolDescriptionSha256, 64) &&
    isSha(input?.inputSchemaSha256, 64) &&
    input?.processExitCode === 0 &&
    input?.codexCliVersion &&
    /^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/u.test(input.codexCliVersion) &&
    Number.isFinite(observedAt) &&
    server?.sourceRevision === claim.sourceCandidateSha &&
    server?.bundleSha256 === claim.bundleSha256 &&
    server?.serverToolNames?.length === 1 &&
    server.serverToolNames[0] === TARGET_TOOL &&
    server?.serverToolCount === 1 &&
    server?.expectedArgumentsSha256 === claim.expectedArgumentsSha256 &&
    server?.expectedCallCount === D07_EXPECTED_YEARS.length &&
    server?.allowedCallCount === D07_EXPECTED_YEARS.length &&
    server?.deniedCallCount === 0 &&
    server?.sequence?.allowedCalls === D07_EXPECTED_YEARS.length &&
    server?.sequence?.deniedCalls === 0 &&
    server?.sequence?.nextIndex === D07_EXPECTED_YEARS.length &&
    server?.sequence?.terminal === false &&
    serverCalls.length === D07_EXPECTED_YEARS.length &&
    server?.activeYear == null &&
    exactKeys(server?.privacy, PRIVACY_KEYS) &&
    server.privacy.authProfile === 'anonymous' &&
    Object.entries(server.privacy)
      .filter(([key]) => key !== 'authProfile')
      .every(([, value]) => value === false) &&
    events?.eventStreamParsed === true &&
    input?.model === MODEL &&
    input?.reasoningEffort === REASONING_EFFORT &&
    events?.eventStreamComplete === true &&
    events?.turnCompleted === true &&
    events?.turnFailed === false &&
    events?.unexpectedEventTypes === 0 &&
    events?.codexMcpToolEventCount === D07_EXPECTED_YEARS.length &&
    events?.codexErrorItemCount === 0 &&
    events?.mcpServerNames?.length === D07_EXPECTED_YEARS.length &&
    events.mcpServerNames.every((name) => name === SERVER_ID) &&
    events?.nonMcpToolEventCount === 0 &&
    events?.nonMcpToolTypes?.length === 0 &&
    events?.shellToolCallCount === 0 &&
    eventCalls.length === D07_EXPECTED_YEARS.length &&
    eventCalls.every(
      (call, index) =>
        call?.name === TARGET_TOOL &&
        call?.state === 'DONE' &&
        exactArguments(call.arguments, expectedCalls[index]) &&
        serverCalls[index]?.year === D07_EXPECTED_YEARS[index],
    )
  );
}

/** Build a report-safe object. The raw answer and tool results are never copied. */
export function buildD07SanitizedReport(input, claim) {
  const shapePassed = reportableRunnerShape(input, claim);
  const answerToolCalls = shapePassed
    ? D07_EXPECTED_YEARS.map((year, index) => ({
        arguments: D07_QUERY_ARGUMENTS_BY_YEAR[year],
        result: input.serverSummary.callSummaries[index],
      }))
    : [];
  const answerResult = shapePassed
    ? verifyD07CurrentRankAnswer(input.answer, answerToolCalls)
    : { passed: false, answerChecks: {}, resultCounters: null };
  if (!shapePassed || !answerResult.passed) {
    return {
      passed: false,
      state: 'INCONCLUSIVE',
      answerChecks: {
        reportableRunShape: shapePassed,
        ...(answerResult.answerChecks ?? {}),
      },
      resultCounters: answerResult.resultCounters ?? null,
    };
  }

  const report = {
    schemaVersion: 1,
    evidenceKind: 'codex_cli_d07_current_rank_agent_mcp',
    runNumber: 95,
    scenarioId: 'D07',
    profile: 'run95-d07-current-rank-by-release-year-agent-mcp-v1',
    frontierId: 'D07',
    epochId: EPOCH_ID,
    sourceRevision: claim.sourceCandidateSha,
    baseSha: claim.baseSha,
    prNumber: claim.prNumber,
    claimId: claim.claimId,
    reviewerId: claim.reviewerId,
    mcpBundleSha256: claim.bundleSha256,
    observedAt: input.observedAt,
    model: MODEL,
    reasoningEffort: REASONING_EFFORT,
    codexCliVersion: input.codexCliVersion,
    toolName: TARGET_TOOL,
    argumentProfile: ARGUMENT_PROFILE,
    expectedArgumentsSha256: claim.expectedArgumentsSha256,
    catalogSha256: input.catalogSha256,
    toolDescriptionSha256: input.toolDescriptionSha256,
    inputSchemaSha256: input.inputSchemaSha256,
    serverToolNames: [TARGET_TOOL],
    serverToolCount: 1,
    mcpServerNames: [SERVER_ID],
    expectedCallCount: D07_EXPECTED_YEARS.length,
    processExitCode: 0,
    eventStreamParsed: true,
    eventStreamComplete: true,
    turnCompleted: true,
    codexMcpToolEventCount: D07_EXPECTED_YEARS.length,
    codexErrorItemCount: 0,
    nonMcpToolEventCount: 0,
    nonMcpToolTypes: [],
    shellToolCallCount: 0,
    allowedCallCount: D07_EXPECTED_YEARS.length,
    deniedCallCount: 0,
    resultStatus: 'SUCCESS',
    answerCheckMethod: ANSWER_PROFILE,
    answerChecks: { ...answerResult.answerChecks, allPassed: true },
    resultCounters: answerResult.resultCounters,
    resultSummaries: answerResult.resultSummaries,
    retrievedAt: answerResult.retrievedAt,
    privacy: {
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
      credentialsStored: false,
    },
    rawAnswerPersisted: false,
    rawToolResultPersisted: false,
  };
  return { passed: true, report };
}

/** Validate the persisted report shape against its immutable Harness claim. */
export function validateD07SanitizedReport(report, claim) {
  const years = D07_EXPECTED_YEARS;
  const checks = {
    exactSchema: exactKeys(report, REPORT_KEYS),
    claimBinding:
      report?.schemaVersion === 1 &&
      report?.evidenceKind === 'codex_cli_d07_current_rank_agent_mcp' &&
      report?.runNumber === 95 &&
      report?.scenarioId === 'D07' &&
      report?.profile === 'run95-d07-current-rank-by-release-year-agent-mcp-v1' &&
      report?.frontierId === 'D07' &&
      report?.epochId === EPOCH_ID &&
      report?.sourceRevision === claim?.sourceCandidateSha &&
      report?.baseSha === claim?.baseSha &&
      report?.prNumber === claim?.prNumber &&
      report?.claimId === claim?.claimId &&
      report?.reviewerId === claim?.reviewerId &&
      report?.mcpBundleSha256 === claim?.bundleSha256 &&
      report?.expectedArgumentsSha256 === claim?.expectedArgumentsSha256 &&
      report?.model === MODEL &&
      report?.reasoningEffort === REASONING_EFFORT &&
      report?.toolName === TARGET_TOOL &&
      report?.argumentProfile === ARGUMENT_PROFILE,
    hashFields: [
      report?.sourceRevision,
      report?.baseSha,
      report?.mcpBundleSha256,
      report?.expectedArgumentsSha256,
      report?.catalogSha256,
      report?.toolDescriptionSha256,
      report?.inputSchemaSha256,
    ].every((value, index) => isSha(value, index < 2 ? 40 : 64)),
    boundedExecution:
      Number.isFinite(Date.parse(report?.observedAt ?? '')) &&
      typeof report?.codexCliVersion === 'string' &&
      /^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/u.test(report.codexCliVersion) &&
      report?.serverToolCount === 1 &&
      JSON.stringify(report?.serverToolNames) === JSON.stringify([TARGET_TOOL]) &&
      JSON.stringify(report?.mcpServerNames) === JSON.stringify([SERVER_ID]) &&
      report?.expectedCallCount === years.length &&
      report?.processExitCode === 0 &&
      report?.eventStreamParsed === true &&
      report?.eventStreamComplete === true &&
      report?.turnCompleted === true &&
      report?.codexMcpToolEventCount === years.length &&
      report?.codexErrorItemCount === 0 &&
      report?.nonMcpToolEventCount === 0 &&
      Array.isArray(report?.nonMcpToolTypes) &&
      report.nonMcpToolTypes.length === 0 &&
      report?.shellToolCallCount === 0 &&
      report?.allowedCallCount === years.length &&
      report?.deniedCallCount === 0 &&
      report?.resultStatus === 'SUCCESS' &&
      report?.answerCheckMethod === ANSWER_PROFILE &&
      report?.rawAnswerPersisted === false &&
      report?.rawToolResultPersisted === false,
    answerChecks:
      exactKeys(report?.answerChecks, ANSWER_CHECK_KEYS) &&
      Object.values(report.answerChecks).every((value) => value === true),
    resultCounters:
      exactKeys(report?.resultCounters, [
        'expectedYears',
        'observedCalls',
        'yearsWithOneObservedRank',
        'rankMinimum',
        'rankMaximum',
      ]) &&
      report.resultCounters.expectedYears === years.length &&
      report.resultCounters.observedCalls === years.length &&
      report.resultCounters.yearsWithOneObservedRank === years.length &&
      Number.isSafeInteger(report.resultCounters.rankMinimum) &&
      report.resultCounters.rankMinimum > 0 &&
      Number.isSafeInteger(report.resultCounters.rankMaximum) &&
      report.resultCounters.rankMaximum >= report.resultCounters.rankMinimum,
    resultSummaries:
      Array.isArray(report?.resultSummaries) &&
      report.resultSummaries.length === years.length &&
      report.resultSummaries.every(
        (row, index) =>
          exactKeys(row, ['year', 'subjectId', 'rank', 'titleSha256']) &&
          row.year === years[index] &&
          Number.isSafeInteger(row.subjectId) &&
          row.subjectId > 0 &&
          Number.isSafeInteger(row.rank) &&
          row.rank > 0 &&
          isSha(row.titleSha256, 64),
      ),
    retrievedAt:
      exactKeys(report?.retrievedAt, ['first', 'last']) &&
      Number.isFinite(Date.parse(report.retrievedAt.first)) &&
      Number.isFinite(Date.parse(report.retrievedAt.last)),
    privacy:
      exactKeys(report?.privacy, PRIVACY_KEYS) &&
      report.privacy.authProfile === 'anonymous' &&
      Object.entries(report.privacy)
        .filter(([key]) => key !== 'authProfile')
        .every(([, value]) => value === false),
  };
  return { passed: Object.values(checks).every(Boolean), checks };
}

export function writeD07AgentMcpReport(input, claim, root = ROOT) {
  const built = buildD07SanitizedReport(input, claim);
  if (!built.passed) {
    return { passed: false, state: 'INCONCLUSIVE', answerChecks: built.answerChecks };
  }
  const validated = validateD07SanitizedReport(built.report, claim);
  if (!validated.passed) {
    return { passed: false, state: 'INCONCLUSIVE', validationChecks: validated.checks };
  }
  const reportPath = path.join(root, REPORT_RELATIVE_PATH);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  const gitCommonDirectory = path.resolve(
    root,
    gitRepositoryText(root, ['rev-parse', '--git-common-dir']),
  );
  const localStageDirectory = path.join(gitCommonDirectory, 'pariya-agent-state');
  fs.mkdirSync(localStageDirectory, { recursive: true, mode: 0o700 });
  const stagePath = path.join(localStageDirectory, `d07-report-stage-${claim.claimId}.json`);
  let descriptor;
  try {
    descriptor = fs.openSync(stagePath, 'wx', 0o600);
  } catch {
    throw new Error('A D07 report stage already exists; the one-shot must not be repeated.');
  }
  try {
    fs.writeFileSync(descriptor, `${JSON.stringify(built.report, null, 2)}\n`, 'utf8');
    fs.fsyncSync(descriptor);
  } finally {
    fs.closeSync(descriptor);
  }
  try {
    fs.linkSync(stagePath, reportPath);
  } catch {
    throw new Error(
      'A D07 report already exists; the one-shot query must not be repeated or overwritten.',
    );
  } finally {
    fs.rmSync(stagePath, { force: true });
  }
  const reportSha256 = createHash('sha256').update(fs.readFileSync(reportPath)).digest('hex');
  return { passed: true, reportPath, reportSha256, resultCounters: built.report.resultCounters };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const payload = JSON.parse(fs.readFileSync(0, 'utf8'));
    const result = writeD07AgentMcpReport(payload?.input, payload?.claim);
    process.stdout.write(`${JSON.stringify(result)}\n`);
    if (!result.passed) process.exitCode = 1;
  } catch {
    process.stderr.write('D07 sanitized evidence report was not written.\n');
    process.exitCode = 1;
  }
}
