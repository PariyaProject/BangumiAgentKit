import { createHash } from 'node:crypto';
import { closeSync, lstatSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyR01DirectRelationsAnswer } from './r01-direct-relations-answer-check.mjs';
import {
  computeMcpBundleSha256,
  gitRepositoryText,
  readG26McpBundleAttestation,
} from '../lib/g26-mcp-bundle.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TOOL_NAME = 'bangumi.get_subject_relations';
const SERVER_ID = 'bgk_r01_one_tool';
const MODEL = 'gpt-6-luna';
const REASONING_EFFORT = 'max';
const ARGUMENT_PROFILE = 'fixed-r01-subject-41529-include-evidence-v1';
const EXPECTED_ARGUMENTS = { subjectId: 41529, includeEvidence: true };
const EXPECTED_ARGUMENTS_SHA256 = sha256(canonicalJson(EXPECTED_ARGUMENTS));
const REPORT_RELATIVE_PATH = 'docs/live-probes/pariya-agent-codex-luna-e2e-R01-relations.json';
const ANSWER_CHECK_FIELDS = [
  'queryArgumentsMatch',
  'exactSingleToolCall',
  'resultReadbackAvailable',
  'sourceScopeVerified',
  'coverageConsistent',
  'textProjectionConsistent',
  'textBudgetVerified',
  'finalScopeLineVerified',
  'sourceSubjectDisclosurePresent',
  'boundedSourceDisclosurePresent',
  'responseCountsDisclosurePresent',
  'projectionRowsOmittedDisclosurePresent',
  'omissionNotAbsenceDisclosurePresent',
  'reverseTransitiveDisclosurePresent',
  'nonCanonicalOrderDisclosurePresent',
  'schemaDriftDisclosurePresent',
  'noUnsupportedCompletenessClaim',
  'noUnsupportedCanonicalOrderClaim',
  'noUnsupportedAbsenceClaim',
  'noUnsupportedReverseClaim',
  'noMarkdownFormatting',
];
const ANSWER_COUNTER_FIELDS = [
  'visibleSourceRows',
  'invalidSourceRowsCount',
  'duplicateSourceRowsCount',
  'answerRowsParsed',
  'rowsMatched',
  'missingRowsCount',
  'mismatchedRowsCount',
  'unmatchedRowsCount',
  'duplicateAnswerRowsCount',
  'unstructuredAnswerLinesCount',
  'toolTextUtf8Bytes',
];

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).sort(([left], [right]) =>
      left < right ? -1 : left > right ? 1 : 0,
    );
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function readToolCatalog(root) {
  const bytes = readFileSync(path.join(root, 'docs/tool-catalog.json'));
  const catalog = JSON.parse(bytes.toString('utf8'));
  const tool = catalog.find((item) => item?.name === TOOL_NAME);
  if (!tool || tool.auth !== 'none' || tool.risk !== 'read') {
    throw new Error('Current catalog does not classify R01 as an anonymous read-only tool.');
  }
  return {
    catalogSha256: sha256(bytes),
    toolDescriptionSha256: sha256(tool.description),
    inputSchemaSha256: sha256(canonicalJson(tool.inputSchema)),
  };
}

function safeRelationResult(value, { requireTextProjection = false } = {}) {
  const pending = [{ value, depth: 0 }];
  const visited = new Set();
  let visitedCount = 0;
  while (pending.length > 0 && visitedCount < 1000) {
    const current = pending.pop();
    visitedCount += 1;
    let candidate = current.value;
    if (typeof candidate === 'string') {
      try {
        candidate = JSON.parse(candidate);
      } catch {
        continue;
      }
    }
    if (!candidate || typeof candidate !== 'object' || current.depth > 12 || visited.has(candidate))
      continue;
    visited.add(candidate);
    if (
      !Array.isArray(candidate) &&
      ['observed', 'partial'].includes(candidate.state) &&
      Number.isInteger(candidate.subjectId) &&
      candidate.source?.operation === 'GET /v0/subjects/{subject_id}/subjects' &&
      Array.isArray(candidate.items) &&
      Array.isArray(candidate.limitations) &&
      candidate.coverage &&
      typeof candidate.coverage === 'object' &&
      (!requireTextProjection || candidate.textProjection)
    )
      return candidate;
    if (Array.isArray(candidate)) {
      for (const item of candidate.slice(0, 100))
        pending.push({ value: item, depth: current.depth + 1 });
    } else {
      for (const key of [
        'content',
        'text',
        'data',
        'result',
        'output',
        'toolOutput',
        'structuredContent',
      ]) {
        if (key in candidate) pending.push({ value: candidate[key], depth: current.depth + 1 });
      }
    }
  }
  return null;
}

function readCanonicalClaim(root, input) {
  const gitCommonDirectory = gitRepositoryText(root, ['rev-parse', '--git-common-dir']);
  const claimPath = path.join(
    path.resolve(root, gitCommonDirectory),
    'pariya-agent-state',
    'r01-run95-one-shot-claim.json',
  );
  let claim;
  try {
    claim = JSON.parse(readFileSync(claimPath, 'utf8'));
  } catch {
    throw new Error('R01 report requires the canonical one-shot claim.');
  }
  if (
    claim?.schemaVersion !== 1 ||
    claim.runNumber !== 95 ||
    claim.frontierId !== 'R01' ||
    claim.state !== 'CLAIMED' ||
    claim.sourceRevision !== input.sourceRevision ||
    claim.bundleSha256 !== input.bundleSha256 ||
    claim.expectedArgumentsSha256 !== EXPECTED_ARGUMENTS_SHA256 ||
    claim.claimId !== input.claimId ||
    claim.epochId !== input.epochId ||
    claim.prNumber !== input.prNumber ||
    claim.baseSha !== input.baseSha ||
    claim.reviewerId !== input.reviewerId
  )
    throw new Error('R01 report Candidate does not match the durable Harness one-shot claim.');
}

function assertSafeInvocation(input, root) {
  if (input.model !== MODEL || input.reasoningEffort !== REASONING_EFFORT) {
    throw new Error('R01 reports require GPT-6 Luna Max.');
  }
  if (
    typeof input.codexCliVersion !== 'string' ||
    !/^\d+\.\d+\.\d+$/u.test(input.codexCliVersion)
  ) {
    throw new Error('R01 report requires a recognized Codex CLI version.');
  }
  if (
    input.epochId !== 'run95-r01-subject-relations-agent-mcp' ||
    typeof input.claimId !== 'string' ||
    !/^r01-run-95-pr-\d+-[0-9a-f]{12}-\d+$/u.test(input.claimId) ||
    !Number.isSafeInteger(input.prNumber) ||
    input.prNumber < 1 ||
    !/^[0-9a-f]{40}$/u.test(input.baseSha ?? '') ||
    typeof input.reviewerId !== 'string' ||
    !/^gpt-6-luna-max-run95-pr\d+-round\d+$/u.test(input.reviewerId)
  ) {
    throw new Error('R01 report requires exact durable Harness claim provenance.');
  }
  if (
    input.processExitCode !== 0 ||
    input.resultStatus !== 'SUCCESS' ||
    input.eventStreamParsed !== true ||
    !Number.isSafeInteger(input.codexErrorItemCount) ||
    input.codexErrorItemCount !== 0 ||
    JSON.stringify(input.serverToolNames) !== JSON.stringify([TOOL_NAME]) ||
    input.serverToolCount !== 1 ||
    input.codexMcpToolEventCount !== 1 ||
    JSON.stringify(input.mcpServerNames) !== JSON.stringify([SERVER_ID]) ||
    input.nonMcpToolEventCount !== 0 ||
    input.shellToolCallCount !== 0 ||
    input.allowedCallCount !== 1 ||
    input.deniedCallCount !== 0
  )
    throw new Error('R01 probe did not complete exactly one isolated target MCP call.');

  const privacy = input.privacy;
  if (
    !privacy ||
    privacy.authProfile !== 'anonymous' ||
    privacy.oauthAttempted !== false ||
    privacy.accountDataRead !== false ||
    privacy.writesAttempted !== false ||
    privacy.qqPipelineTested !== false ||
    privacy.timClientTested !== false ||
    privacy.credentialsStored !== false ||
    privacy.promptStored !== false ||
    privacy.answerStored !== false ||
    privacy.rawResultStored !== false ||
    privacy.artifactImageBytesStored !== false
  )
    throw new Error('R01 requires a passive anonymous public read-only execution.');

  if (gitRepositoryText(root, ['status', '--porcelain'])) {
    throw new Error('R01 report must be bound to a clean exact Candidate revision.');
  }
  const sourceRevision = gitRepositoryText(root, ['rev-parse', 'HEAD']);
  if (!/^[0-9a-f]{40}$/u.test(input.sourceRevision) || input.sourceRevision !== sourceRevision) {
    throw new Error('R01 report Candidate does not match the current checkout.');
  }
  if (
    !/^[0-9a-f]{64}$/u.test(input.bundleSha256) ||
    input.bundleSha256 !== computeMcpBundleSha256(root) ||
    input.bundleSha256 !== readG26McpBundleAttestation(root)
  )
    throw new Error('R01 report does not match the exact executed MCP bundle.');
  readCanonicalClaim(root, input);
  return { sourceRevision, bundleSha256: input.bundleSha256 };
}

function answerCheckSummary(answerChecks) {
  const summary = {
    queryArgumentsMatch: answerChecks.queryArgumentsMatch,
    exactSingleToolCall: answerChecks.exactSingleToolCall,
    resultReadbackAvailable: answerChecks.resultReadbackAvailable,
    sourceScopeVerified: answerChecks.sourceScopeVerified,
    coverageConsistent: answerChecks.coverageConsistent,
    textProjectionConsistent: answerChecks.textProjectionConsistent,
    textBudgetVerified: answerChecks.textBudgetVerified,
    finalScopeLineVerified: answerChecks.finalScopeLineVerified,
    sourceSubjectDisclosurePresent: answerChecks.sourceSubjectDisclosurePresent,
    boundedSourceDisclosurePresent: answerChecks.boundedSourceDisclosurePresent,
    responseCountsDisclosurePresent: answerChecks.responseCountsDisclosurePresent,
    projectionRowsOmittedDisclosurePresent: answerChecks.projectionRowsOmittedDisclosurePresent,
    omissionNotAbsenceDisclosurePresent: answerChecks.omissionNotAbsenceDisclosurePresent,
    reverseTransitiveDisclosurePresent: answerChecks.reverseTransitiveDisclosurePresent,
    nonCanonicalOrderDisclosurePresent: answerChecks.nonCanonicalOrderDisclosurePresent,
    schemaDriftDisclosurePresent: answerChecks.schemaDriftDisclosurePresent,
    noUnsupportedCompletenessClaim: !answerChecks.unsupportedCompletenessClaim,
    noUnsupportedCanonicalOrderClaim: !answerChecks.unsupportedCanonicalOrderClaim,
    noUnsupportedAbsenceClaim: !answerChecks.unsupportedAbsenceClaim,
    noUnsupportedReverseClaim: !answerChecks.unsupportedReverseClaim,
    noMarkdownFormatting: !answerChecks.markdownFormattingDetected,
  };
  if (
    Object.keys(summary).sort().join('\u0000') !== [...ANSWER_CHECK_FIELDS].sort().join('\u0000')
  ) {
    throw new Error('R01 answer check summary does not match the canonical acceptance schema.');
  }
  return summary;
}

function answerCounterSummary(answerChecks) {
  return Object.fromEntries(ANSWER_COUNTER_FIELDS.map((key) => [key, answerChecks[key]]));
}

export function buildR01AgentMcpReport(input, root = ROOT) {
  const { sourceRevision } = assertSafeInvocation(input, root);
  const answerChecks = verifyR01DirectRelationsAnswer(
    input.answer,
    input.queryArguments,
    input.toolOutput,
    input.toolCalls,
    input.toolTextUtf8Bytes,
  );
  if (answerChecks.passed !== true) return { passed: false, answerChecks };
  if (
    canonicalJson(input.queryArguments) !== canonicalJson(EXPECTED_ARGUMENTS) ||
    canonicalJson(input.toolCalls?.[0]?.arguments) !== canonicalJson(EXPECTED_ARGUMENTS)
  )
    throw new Error('R01 report writer refuses a query outside its fixed argument profile.');

  const sourceResult =
    safeRelationResult(input.toolOutput?.structuredContent) ?? safeRelationResult(input.toolOutput);
  const projectedResult =
    safeRelationResult(input.toolOutput?.content, { requireTextProjection: true }) ??
    safeRelationResult(
      input.toolOutput?.content?.map((item) => item?.text),
      { requireTextProjection: true },
    );
  const resultSummary = input.toolResultSummary;
  if (
    !sourceResult ||
    !projectedResult ||
    sourceResult.subjectId !== EXPECTED_ARGUMENTS.subjectId ||
    resultSummary?.toolName !== TOOL_NAME ||
    resultSummary?.resultState !== sourceResult.state ||
    !Number.isInteger(resultSummary?.resultByteLength) ||
    resultSummary.resultByteLength <= 0 ||
    !/^[0-9a-f]{64}$/u.test(resultSummary?.resultSha256 ?? '') ||
    !Array.isArray(resultSummary?.sourceOperations) ||
    resultSummary.sourceOperations.length !== 0 ||
    JSON.stringify(resultSummary.artifact) !== JSON.stringify({ returned: false, persisted: false })
  )
    throw new Error('R01 report source/result summary does not match the checked readback.');

  const textProjection = projectedResult.textProjection;
  const projectionCounterFields = [
    'rowsIncluded',
    'rowsOmitted',
    'displayNamesClipped',
    'relationLabelsClipped',
    'limitationsClipped',
    'imageFieldsOmitted',
  ];
  if (
    sourceResult.state !== (sourceResult.coverage.truncated ? 'partial' : 'observed') ||
    sourceResult.limitations.length === 0 ||
    sourceResult.source.api !== 'Bangumi official v0' ||
    sourceResult.source.direction !== 'source_subject_to_returned_target' ||
    sourceResult.source.scope !== 'visible_direct_rows_returned_for_source_subject' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(sourceResult.source.retrievedAt ?? '') ||
    sourceResult.coverage.rowsReturned !== sourceResult.items.length
  )
    throw new Error('R01 source coverage does not match the checked direct-row response.');
  const missingProjectionCounters = projectionCounterFields.filter(
    (key) => !Number.isInteger(textProjection[key]) || textProjection[key] < 0,
  );
  if (
    textProjection.fullStructuredContentAvailable !== true ||
    missingProjectionCounters.length > 0
  ) {
    throw new Error(
      `R01 MCP text projection is missing bounded counters: ${JSON.stringify({ fullStructuredContentAvailable: textProjection.fullStructuredContentAvailable, missing: missingProjectionCounters })}`,
    );
  }

  const rows = sourceResult.items.map((item) => {
    const name = typeof item.name === 'string' && item.name.trim() ? item.name : item.nameCn;
    if (
      !Number.isInteger(item.id) ||
      item.id <= 0 ||
      typeof name !== 'string' ||
      !name.trim() ||
      typeof item.relation !== 'string' ||
      !item.relation.trim() ||
      (typeof item.nameCn === 'string' && !item.nameCn.trim())
    )
      throw new Error('R01 report contains an invalid source row.');
    return {
      id: item.id,
      name,
      ...(typeof item.nameCn === 'string' ? { nameCn: item.nameCn } : {}),
      relation: item.relation,
    };
  });
  const visibleRowsSha256 = sha256(canonicalJson(rows));
  const scenario = {
    id: TOOL_NAME,
    passed: true,
    exactArgumentsMatched: true,
    oneToolAllowlistVerified: true,
    resultReadbackVerified: true,
    answerCheckPassed: true,
    answerChecks: answerCheckSummary(answerChecks),
    toolCalls: [{ name: TOOL_NAME, state: 'DONE' }],
    result: {
      toolName: TOOL_NAME,
      resultState: sourceResult.state,
      resultByteLength: resultSummary.resultByteLength,
      resultSha256: resultSummary.resultSha256,
      sourceOperations: [],
      artifact: { returned: false, persisted: false },
      sourceSubjectId: sourceResult.subjectId,
      source: {
        api: sourceResult.source.api,
        operation: sourceResult.source.operation,
        direction: sourceResult.source.direction,
        scope: sourceResult.source.scope,
        retrievedAt: sourceResult.source.retrievedAt,
      },
      coverage: {
        responseRowsObserved: sourceResult.coverage.responseRowsObserved,
        rowsReturned: sourceResult.coverage.rowsReturned,
        schemaDriftRows: sourceResult.coverage.schemaDriftRows,
        truncated: sourceResult.coverage.truncated,
        paginationAvailable: sourceResult.coverage.paginationAvailable,
        totalCountAvailable: sourceResult.coverage.totalCountAvailable,
        completeness: sourceResult.coverage.completeness,
      },
      limitationsCount: sourceResult.limitations.length,
      visibleRowCount: rows.length,
      visibleRowsSha256,
      textProjection: {
        textUtf8Bytes: projectedResult.textProjection.textUtf8Bytes,
        rowsIncluded: projectedResult.textProjection.rowsIncluded,
        rowsOmitted: projectedResult.textProjection.rowsOmitted,
        displayNamesClipped: projectedResult.textProjection.displayNamesClipped,
        relationLabelsClipped: projectedResult.textProjection.relationLabelsClipped,
        limitationsClipped: projectedResult.textProjection.limitationsClipped,
        imageFieldsOmitted: projectedResult.textProjection.imageFieldsOmitted,
        fullStructuredContentAvailable:
          projectedResult.textProjection.fullStructuredContentAvailable,
      },
      answerCounters: answerCounterSummary(answerChecks),
    },
  };
  const report = {
    schemaVersion: 1,
    evidenceKind: 'codex_cli_mcp_tool_use',
    runNumber: 95,
    frontierId: 'R01',
    epochId: input.epochId,
    reviewerId: input.reviewerId,
    baseSha: input.baseSha,
    prNumber: input.prNumber,
    claimId: input.claimId,
    mcpBundleSha256: input.bundleSha256,
    observedAt: new Date().toISOString(),
    sourceRevision,
    codexCliVersion: input.codexCliVersion,
    ...readToolCatalog(root),
    profile: 'codex-luna-max-one-tool-v1',
    model: MODEL,
    reasoningEffort: REASONING_EFFORT,
    toolName: TOOL_NAME,
    argumentProfile: ARGUMENT_PROFILE,
    expectedArgumentsSha256: EXPECTED_ARGUMENTS_SHA256,
    serverToolNames: [TOOL_NAME],
    serverToolCount: 1,
    processExitCode: 0,
    resultStatus: 'SUCCESS',
    resultCount: 1,
    eventStreamParsed: true,
    codexMcpToolEventCount: 1,
    codexErrorItemCount: input.codexErrorItemCount,
    nonMcpToolEventCount: 0,
    shellToolCallCount: 0,
    allowedCallCount: 1,
    deniedCallCount: 0,
    qqPipelineTested: false,
    timClientTested: false,
    privacy: {
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
    },
    scenarios: [scenario],
  };
  return { passed: true, report, resultCounters: scenario.result.answerCounters };
}

export function writeR01AgentMcpReport(input, root = ROOT) {
  const built = buildR01AgentMcpReport(input, root);
  if (!built.passed) return { passed: false, answerChecks: built.answerChecks };
  const reportPath = path.join(root, REPORT_RELATIVE_PATH);
  mkdirSync(path.dirname(reportPath), { recursive: true });
  let descriptor;
  try {
    descriptor = openSync(reportPath, 'wx', 0o600);
  } catch {
    throw new Error(
      'A R01 report already exists; the one-shot query must not be repeated or overwritten.',
    );
  }
  const serialized = `${JSON.stringify(built.report, null, 2)}\n`;
  try {
    writeFileSync(descriptor, serialized, 'utf8');
  } finally {
    closeSync(descriptor);
  }
  return {
    passed: true,
    reportPath,
    sourceRevision: built.report.sourceRevision,
    reportSha256: sha256(serialized),
    resultCounters: built.resultCounters,
  };
}

export function validateR01SanitizedReportFile(disposition, root = ROOT) {
  const reportPath = path.join(root, REPORT_RELATIVE_PATH);
  try {
    const stat = lstatSync(reportPath);
    if (!stat.isFile() || stat.isSymbolicLink())
      return { passed: false, reason: 'R01 report must be a regular non-symlink file.' };
    const bytes = readFileSync(reportPath);
    const report = JSON.parse(bytes.toString('utf8'));
    const reportSha256 = sha256(bytes);
    if (
      report?.runNumber !== 95 ||
      report?.frontierId !== 'R01' ||
      report?.epochId !== 'run95-r01-subject-relations-agent-mcp' ||
      report?.claimId !== disposition?.claimId ||
      report?.prNumber !== disposition?.prNumber ||
      report?.sourceRevision !== disposition?.sourceCandidateSha ||
      report?.baseSha !== disposition?.baseSha ||
      report?.reviewerId !== disposition?.reviewerId ||
      report?.mcpBundleSha256 !== disposition?.bundleSha256 ||
      report?.model !== MODEL ||
      report?.reasoningEffort !== REASONING_EFFORT ||
      report?.codexErrorItemCount !== 0 ||
      report?.eventStreamParsed !== true ||
      report?.resultStatus !== 'SUCCESS'
    )
      return { passed: false, reason: 'R01 report does not match its durable Harness claim.' };
    return { passed: true, reportPath: REPORT_RELATIVE_PATH, reportSha256, report };
  } catch {
    return { passed: false, reason: 'R01 report is missing or invalid.' };
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const input = JSON.parse(readFileSync(0, 'utf8'));
    const result = writeR01AgentMcpReport(input);
    process.stdout.write(`${JSON.stringify(result)}\n`);
    if (!result.passed) process.exitCode = 1;
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : 'R01 evidence report was not written.'}\n`,
    );
    process.exitCode = 1;
  }
}
