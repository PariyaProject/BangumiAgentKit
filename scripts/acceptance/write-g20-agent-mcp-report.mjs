import { createHash } from 'node:crypto';
import { closeSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyG20DirectRelationsAnswer } from './g20-direct-relations-answer-check.mjs';
import {
  computeMcpBundleSha256,
  gitRepositoryText,
  readG26McpBundleAttestation,
} from '../lib/g26-mcp-bundle.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const TOOL_NAME = 'bangumi.get_subject_relations';
const SERVER_ID = 'bgk_g20_one_tool';
const MODEL = 'gpt-6-luna';
const REASONING_EFFORT = 'max';
const ARGUMENT_PROFILE = 'fixed-g20-subject-227245-include-evidence-v1';
const EXPECTED_ARGUMENTS = { subjectId: 227245, includeEvidence: true };
const EXPECTED_ARGUMENTS_SHA256 = sha256(canonicalJson(EXPECTED_ARGUMENTS));
const REPORT_RELATIVE_PATH = 'docs/live-probes/pariya-agent-codex-luna-e2e-G20-relations.json';
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
    throw new Error('Current catalog does not classify G20 as an anonymous read-only tool.');
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

function readCanonicalClaim(root, sourceRevision, bundleSha256) {
  const gitCommonDirectory = gitRepositoryText(root, ['rev-parse', '--git-common-dir']);
  const claimPath = path.join(
    path.resolve(root, gitCommonDirectory),
    'pariya-agent-state',
    'g20-run95-one-shot-claim.json',
  );
  let claim;
  try {
    claim = JSON.parse(readFileSync(claimPath, 'utf8'));
  } catch {
    throw new Error('G20 report requires the canonical one-shot claim.');
  }
  if (
    claim?.schemaVersion !== 1 ||
    claim.runNumber !== 95 ||
    claim.frontierId !== 'G20' ||
    claim.state !== 'CLAIMED' ||
    claim.sourceRevision !== sourceRevision ||
    claim.bundleSha256 !== bundleSha256 ||
    claim.expectedArgumentsSha256 !== EXPECTED_ARGUMENTS_SHA256
  )
    throw new Error('G20 report Candidate does not match the active one-shot claim.');
}

function assertSafeInvocation(input, root) {
  if (input.model !== MODEL || input.reasoningEffort !== REASONING_EFFORT) {
    throw new Error('G20 reports require GPT-6 Luna Max.');
  }
  if (
    typeof input.codexCliVersion !== 'string' ||
    !/^\d+\.\d+\.\d+$/u.test(input.codexCliVersion)
  ) {
    throw new Error('G20 report requires a recognized Codex CLI version.');
  }
  if (
    input.processExitCode !== 0 ||
    input.resultStatus !== 'SUCCESS' ||
    input.eventStreamParsed !== true ||
    JSON.stringify(input.serverToolNames) !== JSON.stringify([TOOL_NAME]) ||
    input.serverToolCount !== 1 ||
    input.codexMcpToolEventCount !== 1 ||
    JSON.stringify(input.mcpServerNames) !== JSON.stringify([SERVER_ID]) ||
    input.nonMcpToolEventCount !== 0 ||
    input.shellToolCallCount !== 0 ||
    input.allowedCallCount !== 1 ||
    input.deniedCallCount !== 0
  )
    throw new Error('G20 probe did not complete exactly one isolated target MCP call.');

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
    throw new Error('G20 requires a passive anonymous public read-only execution.');

  if (gitRepositoryText(root, ['status', '--porcelain'])) {
    throw new Error('G20 report must be bound to a clean exact Candidate revision.');
  }
  const sourceRevision = gitRepositoryText(root, ['rev-parse', 'HEAD']);
  if (!/^[0-9a-f]{40}$/u.test(input.sourceRevision) || input.sourceRevision !== sourceRevision) {
    throw new Error('G20 report Candidate does not match the current checkout.');
  }
  if (
    !/^[0-9a-f]{64}$/u.test(input.bundleSha256) ||
    input.bundleSha256 !== computeMcpBundleSha256(root) ||
    input.bundleSha256 !== readG26McpBundleAttestation(root)
  )
    throw new Error('G20 report does not match the exact executed MCP bundle.');
  readCanonicalClaim(root, sourceRevision, input.bundleSha256);
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
    throw new Error('G20 answer check summary does not match the canonical acceptance schema.');
  }
  return summary;
}

function answerCounterSummary(answerChecks) {
  return Object.fromEntries(ANSWER_COUNTER_FIELDS.map((key) => [key, answerChecks[key]]));
}

export function buildG20AgentMcpReport(input, root = ROOT) {
  const { sourceRevision } = assertSafeInvocation(input, root);
  const answerChecks = verifyG20DirectRelationsAnswer(
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
    throw new Error('G20 report writer refuses a query outside its fixed argument profile.');

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
    throw new Error('G20 report source/result summary does not match the checked readback.');

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
    throw new Error('G20 source coverage does not match the checked direct-row response.');
  const missingProjectionCounters = projectionCounterFields.filter(
    (key) => !Number.isInteger(textProjection[key]) || textProjection[key] < 0,
  );
  if (
    textProjection.fullStructuredContentAvailable !== true ||
    missingProjectionCounters.length > 0
  ) {
    throw new Error(
      `G20 MCP text projection is missing bounded counters: ${JSON.stringify({ fullStructuredContentAvailable: textProjection.fullStructuredContentAvailable, missing: missingProjectionCounters })}`,
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
      throw new Error('G20 report contains an invalid source row.');
    return {
      id: item.id,
      name,
      ...(typeof item.nameCn === 'string' ? { nameCn: item.nameCn } : {}),
      relation: item.relation,
    };
  });
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
      visibleRows: rows,
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

export function writeG20AgentMcpReport(input, root = ROOT) {
  const built = buildG20AgentMcpReport(input, root);
  if (!built.passed) return { passed: false, answerChecks: built.answerChecks };
  const reportPath = path.join(root, REPORT_RELATIVE_PATH);
  mkdirSync(path.dirname(reportPath), { recursive: true });
  let descriptor;
  try {
    descriptor = openSync(reportPath, 'wx', 0o600);
  } catch {
    throw new Error(
      'A G20 report already exists; the one-shot query must not be repeated or overwritten.',
    );
  }
  try {
    writeFileSync(descriptor, `${JSON.stringify(built.report, null, 2)}\n`, 'utf8');
  } finally {
    closeSync(descriptor);
  }
  return {
    passed: true,
    reportPath,
    sourceRevision: built.report.sourceRevision,
    resultCounters: built.resultCounters,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const input = JSON.parse(readFileSync(0, 'utf8'));
    const result = writeG20AgentMcpReport(input);
    process.stdout.write(`${JSON.stringify(result)}\n`);
    if (!result.passed) process.exitCode = 1;
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : 'G20 evidence report was not written.'}\n`,
    );
    process.exitCode = 1;
  }
}
