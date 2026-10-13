import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateSubjectCastAnswer } from './subject-cast-answer-check.mjs';

export const G06_SUBJECT_CAST_ANSWER_CHECK_METHOD = 'g06-candidate-cast-rows-and-coverage-v1';
export const G06_EXPECTED_QUERY_ARGUMENTS = { subjectId: 218707, limit: 100 };
export const G06_ARGUMENT_PROFILE = 'fixed-g06-subject-218707-cast-limit-100-v1';
export const G06_TOOL_NAME = 'bangumi.get_subject_cast';
export const G06_EPOCH_ID = 'run95-g06-subject-cast-current-source';
export const G06_REPORT_RELATIVE_PATH = 'docs/live-probes/g06-subject-cast-agent-mcp-run95.json';

const canonicalJson = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).sort(([left], [right]) =>
      left < right ? -1 : left > right ? 1 : 0,
    );
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
};

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const isRecord = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));

function contentText(toolOutput) {
  const content = Array.isArray(toolOutput?.content) ? toolOutput.content : [];
  return content
    .filter((item) => item?.type === 'text' && typeof item.text === 'string')
    .map((item) => item.text)
    .join('\n');
}

function parseTextProjection(text) {
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function sourceCoverage(source, textSource = null) {
  const coverage = isRecord(source?.coverage) ? source.coverage : {};
  const observed = Number.isInteger(source?.observed)
    ? source.observed
    : Number.isInteger(coverage.observed)
      ? coverage.observed
      : null;
  const returned = Number.isInteger(source?.returned)
    ? source.returned
    : Number.isInteger(coverage.returned)
      ? coverage.returned
      : null;
  const truncated =
    typeof source?.truncated === 'boolean'
      ? source.truncated
      : typeof coverage.truncated === 'boolean'
        ? coverage.truncated
        : null;
  const schemaDriftRows = Number.isInteger(source?.schemaDriftRows)
    ? source.schemaDriftRows
    : Number.isInteger(coverage.schemaDriftRows)
      ? coverage.schemaDriftRows
      : null;
  const invalidActorIdRows = Number.isInteger(source?.invalidActorIdRows)
    ? source.invalidActorIdRows
    : Number.isInteger(coverage.invalidActorIdRows)
      ? coverage.invalidActorIdRows
      : null;
  const projection = isRecord(source?.mcpTextProjection)
    ? source.mcpTextProjection
    : isRecord(textSource?.mcpTextProjection)
      ? textSource.mcpTextProjection
      : {};
  const rowsOmittedFromText = Number.isInteger(projection.castRowsOmittedFromText)
    ? projection.castRowsOmittedFromText
    : Number.isInteger(projection.rowsOmittedFromText)
      ? projection.rowsOmittedFromText
      : null;
  const actorRowsOmittedFromText = Number.isInteger(projection.actorRowsOmittedFromText)
    ? projection.actorRowsOmittedFromText
    : null;
  return {
    observed,
    returned,
    truncated,
    schemaDriftRows,
    invalidActorIdRows,
    rowsOmittedFromText,
    actorRowsOmittedFromText,
  };
}

function scopeDisclosures(answer, sourceSubjectId, counts) {
  const lines = typeof answer === 'string' ? answer.split(/\r?\n/u).map((line) => line.trim()) : [];
  const scopeLines = lines.filter((line) => /^范围[:：]/u.test(line));
  const finalScopeLine = scopeLines.length === 1 && lines.at(-1) === scopeLines[0];
  const scope = scopeLines[0] ?? '';
  const sourceId =
    Number.isInteger(sourceSubjectId) && sourceSubjectId > 0
      ? new RegExp(`来源条目\\s*${sourceSubjectId}(?!\\d)`, 'u').test(scope)
      : false;
  const observed = counts.observed;
  const returned = counts.returned;
  const observedCount =
    Number.isInteger(observed) && new RegExp(`观察到\\s*${observed}\\s*行`, 'u').test(scope);
  const returnedCount =
    Number.isInteger(returned) && new RegExp(`返回\\s*${returned}\\s*条`, 'u').test(scope);
  const endpointLimits =
    /(?:无分页(?:参数)?|没有分页(?:参数)?).{0,24}(?:无总数|总数(?:未知|不可用|不可得)|没有总数)|(?:无总数|总数(?:未知|不可用|不可得)|没有总数).{0,24}(?:无分页(?:参数)?|没有分页(?:参数)?)/u.test(
      scope,
    );
  const omissions = counts.rowsOmittedFromText;
  const textOmissions = Number.isInteger(omissions)
    ? omissions === 0 || new RegExp(`MCP文本视图省略\\s*${omissions}\\s*行`, 'u').test(scope)
    : false;
  const truncation =
    counts.truncated === true ? /(?:截断|覆盖不完整|本次响应有限)/u.test(scope) : true;
  const noCompletenessClaim = /(?:不保证完整|不能保证完整|不代表完整|非完整|不构成完整名单)/u.test(
    scope,
  );
  const omissionNotAbsence =
    /(?:未显示|未返回|未列出|遗漏).{0,16}(?:不代表|不能说明|不足以说明|并不意味着).{0,16}(?:不存在|没有)/u.test(
      scope,
    );
  const noUniversalTaxonomy =
    /(?:不能推断|不可推断|不推断|不代表).{0,24}(?:主角|配角|主要|次要|主配角|人气|重要性)/u.test(
      scope,
    );
  return {
    finalScopeLine,
    sourceSubjectDisclosure: sourceId,
    responseObservedCountDisclosure: observedCount,
    responseReturnedCountDisclosure: returnedCount,
    endpointPaginationAndTotalDisclosure: endpointLimits,
    textProjectionOmissionDisclosure: textOmissions,
    truncationDisclosure: truncation,
    noCompletenessClaimDisclosure: noCompletenessClaim,
    omissionNotAbsenceDisclosure: omissionNotAbsence,
    noUniversalRoleTaxonomyDisclosure: noUniversalTaxonomy,
  };
}

export function verifyG06SubjectCastObservation({
  queryArguments,
  toolOutput,
  toolCalls,
  answer,
  toolTextUtf8Bytes,
}) {
  const exactArguments =
    isRecord(queryArguments) &&
    canonicalJson(queryArguments) === canonicalJson(G06_EXPECTED_QUERY_ARGUMENTS);
  const exactSingleCall =
    Array.isArray(toolCalls) &&
    toolCalls.length === 1 &&
    toolCalls[0]?.name === G06_TOOL_NAME &&
    toolCalls[0]?.state === 'DONE' &&
    isRecord(toolCalls[0]?.arguments) &&
    canonicalJson(toolCalls[0].arguments) === canonicalJson(G06_EXPECTED_QUERY_ARGUMENTS);
  const text = contentText(toolOutput);
  const textProjection = parseTextProjection(text);
  const structured = isRecord(toolOutput?.structuredContent) ? toolOutput.structuredContent : null;
  const fullRowsAvailable = Array.isArray(structured?.cast);
  const source = fullRowsAvailable ? structured : textProjection;
  const rows = Array.isArray(source?.cast) ? source.cast : [];
  const sourceSubjectId = source?.subjectId;
  const counts = sourceCoverage(source, textProjection);
  const answerChecks = validateSubjectCastAnswer(answer, rows);
  const disclosures = scopeDisclosures(answer, sourceSubjectId, counts);
  const status = source?.status;
  const sourceStatusSuccess = status === 'ok';
  const resultNotError = toolOutput?.isError !== true;
  const contentAvailable = text.length > 0 && isRecord(textProjection);
  const byteCountValid =
    Number.isInteger(toolTextUtf8Bytes) && toolTextUtf8Bytes > 0 && toolTextUtf8Bytes <= 3600;
  const countsConsistent =
    Number.isInteger(counts.observed) &&
    counts.observed >= rows.length &&
    Number.isInteger(counts.returned) &&
    counts.returned >= rows.length &&
    (counts.rowsOmittedFromText === null || counts.rowsOmittedFromText >= 0) &&
    (counts.actorRowsOmittedFromText === null || counts.actorRowsOmittedFromText >= 0) &&
    (counts.schemaDriftRows === null || counts.schemaDriftRows >= 0) &&
    (counts.invalidActorIdRows === null || counts.invalidActorIdRows >= 0);
  const rowsReadbackAvailable = fullRowsAvailable || Array.isArray(textProjection?.cast);
  const checks = {
    exactArguments,
    exactSingleCall,
    sourceStatusSuccess,
    resultNotError,
    contentAvailable,
    rowsReadbackAvailable,
    boundedTextBytes: byteCountValid,
    sourceCountsConsistent: countsConsistent,
    exactVisibleCastRows: answerChecks.passed,
    ...disclosures,
  };
  const passed = Object.values(checks).every((value) => value === true) && rows.length > 0;
  return {
    method: G06_SUBJECT_CAST_ANSWER_CHECK_METHOD,
    passed,
    checks,
    counters: {
      sourceRowsObserved: counts.observed,
      sourceRowsReturned: counts.returned,
      rowsUsedForAnswerCheck: rows.length,
      structuredContentReadbackAvailable: fullRowsAvailable,
      rowsOmittedFromText: counts.rowsOmittedFromText,
      actorRowsOmittedFromText: counts.actorRowsOmittedFromText,
      sourceTruncated: counts.truncated,
      schemaDriftRows: counts.schemaDriftRows,
      invalidActorIdRows: counts.invalidActorIdRows,
      visibleCastRowsCount: answerChecks.visibleCastRowsCount,
      castRowsMatchedCount: answerChecks.castRowsMatchedCount,
      missingCastRowsCount: answerChecks.missingCastRowsCount,
      mismatchedCastRowsCount: answerChecks.mismatchedCastRowsCount,
      duplicateAnswerRowsCount: answerChecks.duplicateAnswerRowsCount,
      unmatchedAnswerRowsCount: answerChecks.unmatchedAnswerRowsCount,
      clippedCastRowsUnavailableCount: answerChecks.clippedCastRowsUnavailableCount,
      clippedActorNamesUnavailableCount: answerChecks.clippedActorNamesUnavailableCount,
      characterActorPairsMatchedCount: answerChecks.characterActorPairsMatchedCount,
      rawRelationLabelsMatchedCount: answerChecks.rawRelationLabelsMatchedCount,
      toolTextUtf8Bytes: Number.isInteger(toolTextUtf8Bytes) ? toolTextUtf8Bytes : null,
    },
  };
}

export function sha256Text(value) {
  return sha256(value);
}

export function canonicalG06ArgumentsSha256() {
  return sha256(canonicalJson(G06_EXPECTED_QUERY_ARGUMENTS));
}

export function summarizeG06ToolResult(toolOutput) {
  const structured = isRecord(toolOutput?.structuredContent) ? toolOutput.structuredContent : null;
  const projection = parseTextProjection(contentText(toolOutput));
  const source = structured ?? projection;
  const counts = sourceCoverage(source, projection);
  return {
    status: source?.status === 'ok' ? 'ok' : 'not_ok',
    subjectIdMatches: source?.subjectId === G06_EXPECTED_QUERY_ARGUMENTS.subjectId,
    rowsObserved: counts.observed,
    rowsReturned: counts.returned,
    rowsInReadback: Array.isArray(source?.cast) ? source.cast.length : 0,
    rowsOmittedFromText: counts.rowsOmittedFromText,
    actorRowsOmittedFromText: counts.actorRowsOmittedFromText,
    truncated: counts.truncated,
    schemaDriftRows: counts.schemaDriftRows,
    invalidActorIdRows: counts.invalidActorIdRows,
    resultSha256: sha256(JSON.stringify(toolOutput ?? null)),
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const output = verifyG06SubjectCastObservation(input);
  process.stdout.write(JSON.stringify(output));
}
