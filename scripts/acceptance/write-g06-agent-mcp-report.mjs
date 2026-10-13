import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  canonicalG06ArgumentsSha256,
  G06_ARGUMENT_PROFILE,
  G06_EPOCH_ID,
  G06_EXPECTED_QUERY_ARGUMENTS,
  G06_REPORT_RELATIVE_PATH,
  G06_SUBJECT_CAST_ANSWER_CHECK_METHOD,
  G06_TOOL_NAME,
  sha256Text,
  summarizeG06ToolResult,
  verifyG06SubjectCastObservation,
} from './g06-subject-cast-answer-check.mjs';

export const G06_REPORT_EVIDENCE_KIND = 'codex_cli_g06_subject_cast_agent_mcp';
export const G06_MODEL = 'gpt-6-luna';
export const G06_REASONING_EFFORT = 'max';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const REPORT_PATH = path.join(ROOT, G06_REPORT_RELATIVE_PATH);
const HEX_SHA256 = /^[0-9a-f]{64}$/u;
const HEX_SHA1 = /^[0-9a-f]{40}$/u;
const isRecord = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const sha256Bytes = (value) => createHash('sha256').update(value).digest('hex');

export const G06_REPORT_FIELDS = new Set([
  'schemaVersion',
  'evidenceKind',
  'runNumber',
  'frontierId',
  'scenarioId',
  'epochId',
  'claimId',
  'prNumber',
  'sourceRevision',
  'baseSha',
  'ciSha',
  'ciStatus',
  'reviewerId',
  'bundleSha256',
  'catalogSha256',
  'toolDescriptionSha256',
  'inputSchemaSha256',
  'observedAt',
  'toolName',
  'argumentProfile',
  'expectedArgumentsSha256',
  'model',
  'reasoningEffort',
  'codexCliVersion',
  'processExitCode',
  'eventStreamParsed',
  'codexMcpToolEventCount',
  'codexErrorItemCount',
  'mcpServerNames',
  'nonMcpToolEventCount',
  'nonMcpToolTypes',
  'shellToolCallCount',
  'allowedCallCount',
  'deniedCallCount',
  'answerCheckMethod',
  'answerChecks',
  'answerCounters',
  'toolResultSummary',
  'toolTextUtf8Bytes',
  'answerUtf8Bytes',
  'answerSha256',
  'privacy',
]);

export const G06_ANSWER_CHECKS = new Set([
  'exactArguments',
  'exactSingleCall',
  'sourceStatusSuccess',
  'resultNotError',
  'contentAvailable',
  'rowsReadbackAvailable',
  'boundedTextBytes',
  'sourceCountsConsistent',
  'exactVisibleCastRows',
  'finalScopeLine',
  'sourceSubjectDisclosure',
  'responseObservedCountDisclosure',
  'responseReturnedCountDisclosure',
  'endpointPaginationAndTotalDisclosure',
  'textProjectionOmissionDisclosure',
  'truncationDisclosure',
  'noCompletenessClaimDisclosure',
  'omissionNotAbsenceDisclosure',
  'noUniversalRoleTaxonomyDisclosure',
  'serverPrivacySafe',
  'boundedAnswerBytes',
  'runtimeCandidateMatches',
  'serverSummaryMatchesCandidate',
  'serverBundleMatchesCandidate',
  'serverArgumentsAuthorized',
  'serverOneAllowedCall',
  'serverNoDeniedCalls',
  'serverResultSuccess',
  'codexExitZero',
  'eventStreamComplete',
  'oneCodexMcpEvent',
  'exactCodexMcpTarget',
  'noCodexErrors',
  'noNonMcpTools',
  'noShellCalls',
]);

export const G06_ANSWER_COUNTERS = new Set([
  'sourceRowsObserved',
  'sourceRowsReturned',
  'rowsUsedForAnswerCheck',
  'structuredContentReadbackAvailable',
  'rowsOmittedFromText',
  'actorRowsOmittedFromText',
  'sourceTruncated',
  'schemaDriftRows',
  'invalidActorIdRows',
  'visibleCastRowsCount',
  'castRowsMatchedCount',
  'missingCastRowsCount',
  'mismatchedCastRowsCount',
  'duplicateAnswerRowsCount',
  'unmatchedAnswerRowsCount',
  'clippedCastRowsUnavailableCount',
  'clippedActorNamesUnavailableCount',
  'characterActorPairsMatchedCount',
  'rawRelationLabelsMatchedCount',
  'toolTextUtf8Bytes',
]);

export const G06_TOOL_RESULT_SUMMARY_FIELDS = new Set([
  'status',
  'subjectIdMatches',
  'rowsObserved',
  'rowsReturned',
  'rowsInReadback',
  'rowsOmittedFromText',
  'actorRowsOmittedFromText',
  'truncated',
  'schemaDriftRows',
  'invalidActorIdRows',
  'resultSha256',
]);

export const G06_PRIVACY = Object.freeze({
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
export const G06_PRIVACY_FIELDS = new Set(Object.keys(G06_PRIVACY));

export function g06ServerPrivacyMatches(summary) {
  return (
    exactKeys(summary?.privacy, G06_PRIVACY_FIELDS) &&
    Object.entries(G06_PRIVACY).every(([key, value]) => summary.privacy[key] === value)
  );
}

function exactKeys(value, expected) {
  return (
    isRecord(value) &&
    Object.keys(value).length === expected.size &&
    [...expected].every((key) => Object.hasOwn(value, key))
  );
}

function baseObservationChecks(input, observation) {
  const summary = input.serverSummary;
  const call = Array.isArray(input.toolCalls) ? input.toolCalls[0] : null;
  return {
    ...observation.checks,
    serverPrivacySafe: input.serverPrivacyMatchesCandidate === true,
    boundedAnswerBytes:
      typeof input.answer === 'string' &&
      input.answer.trim().length > 0 &&
      Buffer.byteLength(input.answer, 'utf8') <= 3600,
    runtimeCandidateMatches: input.runtimeCandidateMatches === true,
    serverSummaryMatchesCandidate:
      input.serverSummaryMatchesCandidate === true &&
      summary?.sourceRevision === input.sourceRevision,
    serverBundleMatchesCandidate: summary?.bundleSha256 === input.bundleSha256,
    serverArgumentsAuthorized:
      summary?.argumentMatch === true &&
      summary?.expectedArgumentsSha256 === canonicalG06ArgumentsSha256() &&
      call?.arguments &&
      JSON.stringify(call.arguments) === JSON.stringify(G06_EXPECTED_QUERY_ARGUMENTS),
    serverOneAllowedCall: summary?.allowedCallCount === 1,
    serverNoDeniedCalls: summary?.deniedCallCount === 0,
    serverResultSuccess: summary?.serverResultStatus === 'SUCCESS',
    codexExitZero: input.processExitCode === 0,
    eventStreamComplete: input.eventStreamParsed === true,
    oneCodexMcpEvent: input.codexMcpToolEventCount === 1,
    exactCodexMcpTarget:
      input.mcpServerNames?.length === 1 &&
      input.mcpServerNames[0] === 'bgk_g06_one_tool' &&
      input.toolCalls?.length === 1 &&
      input.toolCalls[0]?.name === G06_TOOL_NAME &&
      input.toolCalls[0]?.state === 'DONE',
    noCodexErrors: input.codexErrorItemCount === 0,
    noNonMcpTools:
      input.nonMcpToolEventCount === 0 &&
      Array.isArray(input.nonMcpToolTypes) &&
      input.nonMcpToolTypes.length === 0,
    noShellCalls: input.shellToolCallCount === 0,
  };
}

function summarizeValidation(input) {
  const observation = verifyG06SubjectCastObservation({
    queryArguments: input.toolCalls?.[0]?.arguments,
    toolOutput: input.toolCalls?.[0]?.result,
    toolCalls: input.toolCalls,
    answer: input.answer,
    toolTextUtf8Bytes: input.toolTextUtf8Bytes,
  });
  const checks = baseObservationChecks(input, observation);
  const passed = observation.passed && Object.values(checks).every((value) => value === true);
  const answerBytes = Buffer.byteLength(input.answer ?? '', 'utf8');
  const toolOutput = input.toolCalls?.[0]?.result;
  return {
    passed,
    report: {
      schemaVersion: 1,
      evidenceKind: G06_REPORT_EVIDENCE_KIND,
      runNumber: 95,
      frontierId: 'G06',
      scenarioId: 'G06',
      epochId: G06_EPOCH_ID,
      claimId: input.claimId,
      prNumber: input.prNumber,
      sourceRevision: input.sourceRevision,
      baseSha: input.baseSha,
      ciSha: input.sourceRevision,
      ciStatus: 'SUCCESS',
      reviewerId: input.reviewerId,
      bundleSha256: input.bundleSha256,
      catalogSha256: input.serverSummary?.catalogSha256,
      toolDescriptionSha256: input.serverSummary?.toolDescriptionSha256,
      inputSchemaSha256: input.serverSummary?.inputSchemaSha256,
      observedAt: input.observedAt,
      toolName: G06_TOOL_NAME,
      argumentProfile: G06_ARGUMENT_PROFILE,
      expectedArgumentsSha256: canonicalG06ArgumentsSha256(),
      model: input.model,
      reasoningEffort: input.reasoningEffort,
      codexCliVersion: input.codexCliVersion,
      processExitCode: input.processExitCode,
      eventStreamParsed: input.eventStreamParsed,
      codexMcpToolEventCount: input.codexMcpToolEventCount,
      codexErrorItemCount: input.codexErrorItemCount,
      mcpServerNames: input.mcpServerNames,
      nonMcpToolEventCount: input.nonMcpToolEventCount,
      nonMcpToolTypes: input.nonMcpToolTypes,
      shellToolCallCount: input.shellToolCallCount,
      allowedCallCount: input.serverSummary?.allowedCallCount,
      deniedCallCount: input.serverSummary?.deniedCallCount,
      answerCheckMethod: G06_SUBJECT_CAST_ANSWER_CHECK_METHOD,
      answerChecks: checks,
      answerCounters: observation.counters,
      toolResultSummary: summarizeG06ToolResult(toolOutput),
      toolTextUtf8Bytes: input.toolTextUtf8Bytes,
      answerUtf8Bytes: answerBytes,
      answerSha256: typeof input.answer === 'string' ? sha256Text(input.answer) : null,
      privacy: { ...G06_PRIVACY },
    },
  };
}

export function buildG06AgentMcpReport(input) {
  const { passed, report } = summarizeValidation(input);
  return { passed, report };
}

export function writeG06AgentMcpReport(input, reportPath = REPORT_PATH) {
  const built = buildG06AgentMcpReport(input);
  if (!built.passed) {
    return { passed: false, reason: 'G06 answer/source/runtime checks did not all pass.' };
  }
  const report = built.report;
  const bytes = Buffer.from(`${JSON.stringify(report, null, 2)}\n`, 'utf8');
  mkdirSync(path.dirname(reportPath), { recursive: true, mode: 0o700 });
  writeFileSync(reportPath, bytes, { flag: 'wx', mode: 0o600 });
  return {
    passed: true,
    reportPath: path.relative(ROOT, reportPath),
    reportSha256: sha256Bytes(bytes),
    answerChecks: report.answerChecks,
    answerCounters: report.answerCounters,
  };
}

export function validateG06SanitizedReportFile(
  disposition,
  root = ROOT,
  reportPath = path.join(root, G06_REPORT_RELATIVE_PATH),
) {
  try {
    const bytes = readFileSync(reportPath);
    const report = JSON.parse(bytes.toString('utf8'));
    const reportSha256 = sha256Bytes(bytes);
    const passed =
      exactKeys(report, G06_REPORT_FIELDS) &&
      report.schemaVersion === 1 &&
      report.evidenceKind === G06_REPORT_EVIDENCE_KIND &&
      report.runNumber === 95 &&
      report.frontierId === 'G06' &&
      report.scenarioId === 'G06' &&
      report.epochId === G06_EPOCH_ID &&
      report.claimId === disposition?.claimId &&
      report.prNumber === disposition?.prNumber &&
      report.sourceRevision === disposition?.sourceCandidateSha &&
      report.baseSha === disposition?.baseSha &&
      report.ciSha === disposition?.sourceCandidateSha &&
      report.ciStatus === 'SUCCESS' &&
      report.reviewerId === disposition?.reviewerId &&
      report.bundleSha256 === disposition?.bundleSha256 &&
      report.toolName === G06_TOOL_NAME &&
      report.argumentProfile === G06_ARGUMENT_PROFILE &&
      report.expectedArgumentsSha256 === canonicalG06ArgumentsSha256() &&
      report.model === G06_MODEL &&
      report.reasoningEffort === G06_REASONING_EFFORT &&
      report.answerCheckMethod === G06_SUBJECT_CAST_ANSWER_CHECK_METHOD &&
      report.answerChecks &&
      exactKeys(report.answerChecks, G06_ANSWER_CHECKS) &&
      Object.values(report.answerChecks).every((value) => value === true) &&
      report.answerCounters &&
      exactKeys(report.answerCounters, G06_ANSWER_COUNTERS) &&
      Object.values(report.answerCounters).every(
        (value) => typeof value === 'number' || typeof value === 'boolean' || value === null,
      ) &&
      report.answerCounters.castRowsMatchedCount === report.answerCounters.visibleCastRowsCount &&
      report.answerCounters.missingCastRowsCount === 0 &&
      report.answerCounters.mismatchedCastRowsCount === 0 &&
      report.answerCounters.duplicateAnswerRowsCount === 0 &&
      report.answerCounters.unmatchedAnswerRowsCount === 0 &&
      HEX_SHA256.test(report.catalogSha256 ?? '') &&
      HEX_SHA256.test(report.toolDescriptionSha256 ?? '') &&
      HEX_SHA256.test(report.inputSchemaSha256 ?? '') &&
      HEX_SHA256.test(report.answerSha256 ?? '') &&
      HEX_SHA256.test(report.toolResultSummary?.resultSha256 ?? '') &&
      report.toolResultSummary?.subjectIdMatches === true &&
      report.toolResultSummary?.status === 'ok' &&
      exactKeys(report.toolResultSummary, G06_TOOL_RESULT_SUMMARY_FIELDS) &&
      exactKeys(report.privacy, G06_PRIVACY_FIELDS) &&
      HEX_SHA1.test(report.sourceRevision ?? '') &&
      HEX_SHA1.test(report.baseSha ?? '') &&
      typeof report.observedAt === 'string' &&
      !Number.isNaN(Date.parse(report.observedAt)) &&
      report.processExitCode === 0 &&
      report.eventStreamParsed === true &&
      Number.isInteger(report.answerUtf8Bytes) &&
      report.answerUtf8Bytes > 0 &&
      report.answerUtf8Bytes <= 3600 &&
      report.codexMcpToolEventCount === 1 &&
      report.codexErrorItemCount === 0 &&
      report.mcpServerNames.length === 1 &&
      report.mcpServerNames[0] === 'bgk_g06_one_tool' &&
      report.nonMcpToolEventCount === 0 &&
      report.nonMcpToolTypes.length === 0 &&
      report.shellToolCallCount === 0 &&
      report.allowedCallCount === 1 &&
      report.deniedCallCount === 0 &&
      report.privacy?.authProfile === 'anonymous' &&
      Object.entries(G06_PRIVACY).every(([key, value]) => report.privacy?.[key] === value) &&
      report.passed !== false &&
      !Object.hasOwn(report, 'answer') &&
      !Object.hasOwn(report, 'toolOutput') &&
      !Object.hasOwn(report, 'rawRows') &&
      !Object.hasOwn(report, 'rawResult') &&
      reportSha256 === disposition?.reportSha256 &&
      path.resolve(reportPath) === path.resolve(root, G06_REPORT_RELATIVE_PATH);
    return {
      passed,
      report,
      reportPath: G06_REPORT_RELATIVE_PATH,
      reportSha256,
      ...(passed ? {} : { reason: 'G06 report schema or claim binding is invalid.' }),
    };
  } catch {
    return {
      passed: false,
      report: null,
      reportPath: G06_REPORT_RELATIVE_PATH,
      reportSha256: null,
      reason: 'G06 sanitized report is missing or unreadable.',
    };
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const result = writeG06AgentMcpReport(input);
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (!result.passed) process.exitCode = 1;
}
