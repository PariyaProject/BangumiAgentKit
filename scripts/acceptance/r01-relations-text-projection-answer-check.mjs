import { Buffer } from 'node:buffer';
import { canonicalAgentMcpProfileJson } from '../lib/agent-mcp-profile-claims.mjs';
import {
  R01_RELATIONS_TEXT_PROJECTION_OFFLINE_EXPECTED_ARGUMENTS,
  R01_RELATIONS_TEXT_PROJECTION_OFFLINE_ROW_COUNT,
  r01RelationsTextProjectionSyntheticRows,
} from '../lib/r01-relations-text-projection-offline-profile.mjs';

const TOOL_NAME = 'bangumi.get_subject_relations';
const TEXT_LIMIT_BYTES = 3600;
const ANSWER_FIELDS = [
  'sourceRowsObserved',
  'sourceRowsReturned',
  'sourceTruncated',
  'textRowsIncluded',
  'textRowsOmitted',
  'structuredContentAvailable',
  'firstDisplayedRelation',
  'scope',
];
const REQUIRED_SCOPE =
  '本次文本投影省略的关系仍在structuredContent；官方端点没有分页或总数，因此不代表完整关系图，也不证明未返回关系不存在。';

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value, keys) {
  return (
    isRecord(value) &&
    canonicalAgentMcpProfileJson(Object.keys(value).sort()) ===
      canonicalAgentMcpProfileJson([...keys].sort())
  );
}

function parseJson(value) {
  if (typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function same(left, right) {
  return canonicalAgentMcpProfileJson(left) === canonicalAgentMcpProfileJson(right);
}

function sourceResultIsValid(result) {
  const expectedRows = r01RelationsTextProjectionSyntheticRows().map(
    ({ id, name, name_cn, relation }) => ({ id, type: 'anime', name, nameCn: name_cn, relation }),
  );
  const coverage = result?.coverage;
  return Boolean(
    isRecord(result) &&
    result.state === 'observed' &&
    result.subjectId === R01_RELATIONS_TEXT_PROJECTION_OFFLINE_EXPECTED_ARGUMENTS.subjectId &&
    result.source?.api === 'Bangumi official v0' &&
    result.source?.operation === 'GET /v0/subjects/{subject_id}/subjects' &&
    result.source?.direction === 'source_subject_to_returned_target' &&
    result.source?.scope === 'visible_direct_rows_returned_for_source_subject' &&
    isRecord(coverage) &&
    coverage.responseRowsObserved === R01_RELATIONS_TEXT_PROJECTION_OFFLINE_ROW_COUNT &&
    coverage.rowsReturned === R01_RELATIONS_TEXT_PROJECTION_OFFLINE_ROW_COUNT &&
    coverage.schemaDriftRows === 0 &&
    coverage.truncated === false &&
    coverage.paginationAvailable === false &&
    coverage.totalCountAvailable === false &&
    coverage.completeness === 'not_provided_by_source' &&
    Array.isArray(result.items) &&
    same(result.items, expectedRows) &&
    Array.isArray(result.limitations) &&
    result.limitations.length > 0,
  );
}

function textProjectionIsConsistent(textResult, structuredResult) {
  const projection = textResult?.textProjection;
  if (
    !isRecord(textResult) ||
    !isRecord(projection) ||
    projection.fullStructuredContentAvailable !== true ||
    !Number.isSafeInteger(projection.rowsIncluded) ||
    projection.rowsIncluded < 1 ||
    projection.rowsIncluded >= R01_RELATIONS_TEXT_PROJECTION_OFFLINE_ROW_COUNT ||
    projection.rowsIncluded !== textResult.items?.length ||
    projection.rowsOmitted !==
      R01_RELATIONS_TEXT_PROJECTION_OFFLINE_ROW_COUNT - projection.rowsIncluded ||
    !Number.isSafeInteger(projection.rowsOmitted) ||
    projection.rowsOmitted < 1 ||
    !same(textResult.coverage, structuredResult.coverage) ||
    !same(textResult.source, structuredResult.source) ||
    !Array.isArray(textResult.items)
  ) {
    return false;
  }
  for (let index = 0; index < textResult.items.length; index += 1) {
    const projected = textResult.items[index];
    const source = structuredResult.items[index];
    if (
      !isRecord(projected) ||
      !isRecord(source) ||
      projected.id !== source.id ||
      projected.type !== source.type ||
      projected.name !== source.name ||
      projected.nameCn !== source.nameCn ||
      projected.relation !== source.relation
    ) {
      return false;
    }
  }
  return true;
}

function findText(toolOutput) {
  const content = Array.isArray(toolOutput?.content) ? toolOutput.content : [];
  const textItems = content.filter(
    (item) => item?.type === 'text' && typeof item.text === 'string',
  );
  if (textItems.length !== 1) return null;
  return { text: textItems[0].text, parsed: parseJson(textItems[0].text) };
}

export function verifyR01TextProjectionAnswer(answer, queryArguments, toolOutput, toolCalls) {
  const parsed = parseJson(answer);
  const structured = toolOutput?.structuredContent;
  const text = findText(toolOutput);
  const projection = text?.parsed?.textProjection;
  const queryArgumentsMatch = same(
    queryArguments,
    R01_RELATIONS_TEXT_PROJECTION_OFFLINE_EXPECTED_ARGUMENTS,
  );
  const exactToolCall =
    Array.isArray(toolCalls) &&
    toolCalls.length === 1 &&
    toolCalls[0]?.name === TOOL_NAME &&
    toolCalls[0]?.state === 'DONE' &&
    same(toolCalls[0]?.arguments, R01_RELATIONS_TEXT_PROJECTION_OFFLINE_EXPECTED_ARGUMENTS);
  const sourceReadback = sourceResultIsValid(structured);
  const textProjectionConsistent =
    sourceReadback && textProjectionIsConsistent(text?.parsed, structured);
  const textBudgetVerified = Boolean(
    text?.text &&
    Buffer.byteLength(text.text, 'utf8') > 0 &&
    Buffer.byteLength(text.text, 'utf8') <= TEXT_LIMIT_BYTES,
  );
  const answerShape = exactKeys(parsed, ANSWER_FIELDS);
  const answerMatches = Boolean(
    answerShape &&
    parsed.sourceRowsObserved === R01_RELATIONS_TEXT_PROJECTION_OFFLINE_ROW_COUNT &&
    parsed.sourceRowsReturned === R01_RELATIONS_TEXT_PROJECTION_OFFLINE_ROW_COUNT &&
    parsed.sourceTruncated === false &&
    parsed.textRowsIncluded === projection?.rowsIncluded &&
    parsed.textRowsOmitted === projection?.rowsOmitted &&
    parsed.structuredContentAvailable === true &&
    parsed.firstDisplayedRelation === structured?.items?.[0]?.relation &&
    parsed.scope === REQUIRED_SCOPE,
  );
  const checks = {
    exactArguments: queryArgumentsMatch,
    exactlyOneCompletedToolCall: exactToolCall,
    exactSyntheticSourceResult: sourceReadback,
    textProjectionConsistent,
    textBudgetVerified,
    exactAnswerShape: answerShape,
    answerMatchesSource: answerMatches,
  };
  const projectionCount = Number.isSafeInteger(projection?.rowsIncluded)
    ? projection.rowsIncluded
    : null;
  return {
    passed: Object.values(checks).every(Boolean),
    checks,
    resultSummary: {
      sourceRowsObserved: sourceReadback ? structured.coverage.responseRowsObserved : null,
      sourceRowsReturned: sourceReadback ? structured.coverage.rowsReturned : null,
      sourceSchemaDriftRows: sourceReadback ? structured.coverage.schemaDriftRows : null,
      sourceTruncated: sourceReadback ? structured.coverage.truncated : null,
      textRowsIncluded: projectionCount,
      textRowsOmitted: Number.isSafeInteger(projection?.rowsOmitted)
        ? projection.rowsOmitted
        : null,
      textUtf8Bytes: text?.text ? Buffer.byteLength(text.text, 'utf8') : null,
      structuredContentAvailable: isRecord(structured),
      textProjectionConsistent,
      firstDisplayedRelationMatched: answerMatches,
    },
  };
}
