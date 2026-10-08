import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const G20_DIRECT_RELATIONS_ANSWER_CHECK_METHOD = 'direct-relation-rows-and-source-scope-v1';

const TOOL_NAME = 'bangumi.get_subject_relations';
const FIXED_G20_SUBJECT_ID = 227245;
const ROW_SEPARATOR = '｜';
const SCOPE_LINE = /^范围[:：]/u;
const MARKDOWN_LINE = /^\s*(?:#{1,6}\s|[-*+]\s|>\s|```)/u;
const COMPLETENESS_CLAIM =
  /(?:完整(?:系列|关系|名单|列表|作品)|全系列|全量(?:关系|作品|条目)|所有作品|全部作品|没有遗漏)/gu;
const CANONICAL_ORDER_CLAIM =
  /(?:唯一正确(?:的)?顺序|唯一(?:官方)?(?:观看)?顺序|官方(?:观看)?顺序|canonical\s+order)/giu;
const ABSENCE_CLAIM =
  /(?:(?:没有|不存在|不再有|找不到)(?:任何|其他|更多|其余)?(?:关系|作品|条目|关联)|(?:关系|作品|条目).{0,8}(?:只有|仅有)(?:以上|这些|上述|前述)?(?:\d+|[零〇一二两三四五六七八九十百千万]+)?(?:条|项|个)?)/gu;
const REVERSE_CLAIM =
  /(?:(?:包括|包含|涵盖|也有|还有)(?:所有|完整|全部)?反向(?:关系|边)|(?:完整|所有|全量)?反向(?:关系|边))/gu;
const CLAIM_NEGATION =
  /(?:不代表|并非|并不是|不是|不等于|不构成|不能(?:据此)?(?:证明|确认|说明|称为|说|认定)?|无法(?:据此)?(?:证明|确认|说明|称为|说|认定)?|(?:未|没有|尚未)[^。！？\n]{0,24}(?:发布|提供|定义)[^。！？\n]{0,16}|未能证明|不足以(?:证明|确认)|不含|不包含|未覆盖|不提供)\s*$/u;
const CLAIM_CLAUSE_BOUNDARY =
  /(?:[，,；;。！？:：\n]+|但是|然而|不过|可是|但|而且|并且|且|but|however)/giu;

export function verifyG20DirectRelationsAnswer(
  answer,
  queryArguments,
  toolOutput,
  toolCalls,
  toolTextUtf8Bytes,
) {
  const normalizedArguments = unwrapArguments(queryArguments);
  const answerText = typeof answer === 'string' ? answer : '';
  const fullResult = findStructuredRelationsResult(toolOutput);
  const textResult = findTextProjectionResult(toolOutput);
  const result = fullResult ?? textResult;
  const sourceItems = Array.isArray(result?.items) ? result.items : [];
  const validRows = sourceItems.map(normalizeSourceRow).filter((row) => row.valid);
  const sourceIds = validRows.map((row) => row.id);
  const duplicateSourceRowsCount = sourceIds.length - new Set(sourceIds).size;
  const parsedAnswer = parseAnswer(answerText);
  const expectedById = new Map(validRows.map((row) => [row.id, row]));
  const seenIds = new Set();
  let rowsMatchedCount = 0;
  let mismatchedRowsCount = 0;
  let unmatchedRowsCount = 0;
  let duplicateAnswerRowsCount = 0;

  for (const row of parsedAnswer.rows) {
    if (seenIds.has(row.id)) duplicateAnswerRowsCount += 1;
    seenIds.add(row.id);
    const expected = expectedById.get(row.id);
    if (!expected) {
      unmatchedRowsCount += 1;
      continue;
    }
    if (row.relation !== expected.relation || !expected.names.includes(row.title)) {
      mismatchedRowsCount += 1;
      continue;
    }
    rowsMatchedCount += 1;
  }

  const missingRowsCount = validRows.filter(
    (row) => !parsedAnswer.rows.some((answerRow) => answerRow.id === row.id),
  ).length;
  const scopeText = parsedAnswer.scopeLines.join('\n');
  const finalScopeLineVerified =
    parsedAnswer.scopeLines.length === 1 && parsedAnswer.scopeLineIsFinal;
  const sourceSubjectDisclosurePresent = hasSourceSubjectDisclosure(scopeText, result?.subjectId);
  const queryArgumentsMatch =
    exactQueryArguments(normalizedArguments, FIXED_G20_SUBJECT_ID) &&
    result?.subjectId === FIXED_G20_SUBJECT_ID;
  const exactSingleToolCall =
    Array.isArray(toolCalls) &&
    toolCalls.length === 1 &&
    toolCalls[0]?.name === TOOL_NAME &&
    toolCalls[0]?.state === 'DONE' &&
    exactQueryArguments(toolCalls[0]?.arguments, FIXED_G20_SUBJECT_ID);
  const sourceScopeVerified =
    result?.source?.operation === 'GET /v0/subjects/{subject_id}/subjects' &&
    result?.source?.direction === 'source_subject_to_returned_target' &&
    result?.source?.scope === 'visible_direct_rows_returned_for_source_subject' &&
    Number.isInteger(result?.subjectId);
  const coverageConsistent =
    Number.isInteger(result?.coverage?.responseRowsObserved) &&
    Number.isInteger(result?.coverage?.rowsReturned) &&
    Number.isInteger(result?.coverage?.schemaDriftRows) &&
    result.coverage.rowsReturned === validRows.length &&
    result.coverage.responseRowsObserved ===
      result.coverage.rowsReturned + result.coverage.schemaDriftRows &&
    result.coverage.paginationAvailable === false &&
    result.coverage.totalCountAvailable === false &&
    result.coverage.completeness === 'not_provided_by_source';
  const boundedSourceDisclosurePresent = hasBoundedSourceDisclosure(scopeText);
  const responseCountsDisclosurePresent = hasResponseCountsDisclosure(
    scopeText,
    result?.coverage?.responseRowsObserved,
    result?.coverage?.rowsReturned,
  );
  const projectionRowsOmittedDisclosurePresent = hasRowsOmittedDisclosure(
    scopeText,
    textResult?.textProjection?.rowsOmitted,
  );
  const omissionNotAbsenceDisclosurePresent = hasOmissionNotAbsenceDisclosure(scopeText);
  const nonCanonicalOrderDisclosurePresent = hasNonCanonicalOrderDisclosure(scopeText);
  const schemaDriftDisclosurePresent =
    result?.coverage?.schemaDriftRows === 0 ||
    hasSchemaDriftDisclosure(scopeText, result?.coverage?.schemaDriftRows);
  const textProjectionConsistent = isTextProjectionConsistent(textResult, fullResult);
  const resultRowsReadbackAvailable = fullResult !== null || hasCompleteTextReadback(textResult);
  const textBudgetVerified =
    Number.isInteger(toolTextUtf8Bytes) && toolTextUtf8Bytes > 0 && toolTextUtf8Bytes <= 3600;
  const structuredContentReadbackAvailable = fullResult !== null;
  const unsupportedCompletenessClaim = hasUnqualifiedClaim(answerText, COMPLETENESS_CLAIM);
  const unsupportedCanonicalOrderClaim = hasUnqualifiedClaim(answerText, CANONICAL_ORDER_CLAIM);
  const unsupportedAbsenceClaim = hasUnqualifiedClaim(answerText, ABSENCE_CLAIM);
  const unsupportedReverseClaim = hasUnqualifiedClaim(answerText, REVERSE_CLAIM);
  const markdownFormattingDetected =
    answerText.split(/\r?\n/u).some((line) => MARKDOWN_LINE.test(line)) ||
    answerText.includes('**') ||
    answerText.includes('`');
  const sourceCoverage = result?.coverage;
  const textProjection = textResult?.textProjection;
  const passed =
    answerText.trim().length > 0 &&
    queryArgumentsMatch &&
    exactSingleToolCall &&
    result !== null &&
    sourceScopeVerified &&
    coverageConsistent &&
    textProjectionConsistent &&
    resultRowsReadbackAvailable &&
    textBudgetVerified &&
    validRows.length > 0 &&
    sourceItems.length === validRows.length &&
    duplicateSourceRowsCount === 0 &&
    finalScopeLineVerified &&
    sourceSubjectDisclosurePresent &&
    parsedAnswer.unstructuredAnswerLinesCount === 0 &&
    parsedAnswer.rows.length === validRows.length &&
    rowsMatchedCount === validRows.length &&
    missingRowsCount === 0 &&
    mismatchedRowsCount === 0 &&
    unmatchedRowsCount === 0 &&
    duplicateAnswerRowsCount === 0 &&
    boundedSourceDisclosurePresent &&
    responseCountsDisclosurePresent &&
    projectionRowsOmittedDisclosurePresent &&
    omissionNotAbsenceDisclosurePresent &&
    nonCanonicalOrderDisclosurePresent &&
    schemaDriftDisclosurePresent &&
    !unsupportedCompletenessClaim &&
    !unsupportedCanonicalOrderClaim &&
    !unsupportedAbsenceClaim &&
    !unsupportedReverseClaim &&
    !markdownFormattingDetected;

  return {
    method: G20_DIRECT_RELATIONS_ANSWER_CHECK_METHOD,
    queryArgumentsMatch,
    exactSingleToolCall,
    resultReadbackAvailable: result !== null && resultRowsReadbackAvailable,
    resultRowsReadbackAvailable,
    structuredContentReadbackAvailable,
    sourceScopeVerified,
    coverageConsistent,
    textProjectionConsistent,
    textBudgetVerified,
    toolTextUtf8Bytes: Number.isInteger(toolTextUtf8Bytes) ? toolTextUtf8Bytes : null,
    sourceResponseRowsObserved: Number.isInteger(sourceCoverage?.responseRowsObserved)
      ? sourceCoverage.responseRowsObserved
      : null,
    sourceRowsReturned: Number.isInteger(sourceCoverage?.rowsReturned)
      ? sourceCoverage.rowsReturned
      : null,
    sourceSchemaDriftRows: Number.isInteger(sourceCoverage?.schemaDriftRows)
      ? sourceCoverage.schemaDriftRows
      : null,
    sourceTruncated:
      typeof sourceCoverage?.truncated === 'boolean' ? sourceCoverage.truncated : null,
    sourcePaginationAvailable:
      typeof sourceCoverage?.paginationAvailable === 'boolean'
        ? sourceCoverage.paginationAvailable
        : null,
    sourceTotalCountAvailable:
      typeof sourceCoverage?.totalCountAvailable === 'boolean'
        ? sourceCoverage.totalCountAvailable
        : null,
    sourceCompleteness:
      typeof sourceCoverage?.completeness === 'string' ? sourceCoverage.completeness : null,
    mcpTextRowsOmitted: Number.isInteger(textProjection?.rowsOmitted)
      ? textProjection.rowsOmitted
      : null,
    mcpTextDisplayNamesClipped: Number.isInteger(textProjection?.displayNamesClipped)
      ? textProjection.displayNamesClipped
      : null,
    mcpTextRelationLabelsClipped: Number.isInteger(textProjection?.relationLabelsClipped)
      ? textProjection.relationLabelsClipped
      : null,
    mcpTextLimitationsClipped: Number.isInteger(textProjection?.limitationsClipped)
      ? textProjection.limitationsClipped
      : null,
    visibleSourceRows: validRows.length,
    invalidSourceRowsCount: sourceItems.length - validRows.length,
    duplicateSourceRowsCount,
    answerRowsParsed: parsedAnswer.rows.length,
    rowsMatched: rowsMatchedCount,
    missingRowsCount,
    mismatchedRowsCount,
    unmatchedRowsCount,
    duplicateAnswerRowsCount,
    unstructuredAnswerLinesCount: parsedAnswer.unstructuredAnswerLinesCount,
    finalScopeLineVerified,
    sourceSubjectDisclosurePresent,
    boundedSourceDisclosurePresent,
    responseCountsDisclosurePresent,
    projectionRowsOmittedDisclosurePresent,
    omissionNotAbsenceDisclosurePresent,
    nonCanonicalOrderDisclosurePresent,
    schemaDriftDisclosurePresent,
    unsupportedCompletenessClaim,
    unsupportedCanonicalOrderClaim,
    unsupportedAbsenceClaim,
    unsupportedReverseClaim,
    markdownFormattingDetected,
    passed,
  };
}

function exactQueryArguments(value, subjectId) {
  const argumentsObject = unwrapArguments(value);
  if (!argumentsObject || typeof argumentsObject !== 'object' || Array.isArray(argumentsObject))
    return false;
  return (
    subjectId === FIXED_G20_SUBJECT_ID &&
    Object.keys(argumentsObject).sort().join('\u0000') === 'includeEvidence\u0000subjectId' &&
    argumentsObject.subjectId === subjectId &&
    argumentsObject.includeEvidence === true
  );
}

function parseAnswer(answer) {
  const rows = [];
  const scopeLines = [];
  let unstructuredAnswerLinesCount = 0;
  let scopeLineIsFinal = false;
  for (const rawLine of answer.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (SCOPE_LINE.test(line)) {
      scopeLines.push(line.replace(SCOPE_LINE, '').trim());
      scopeLineIsFinal = true;
      continue;
    }
    scopeLineIsFinal = false;
    const columns = line.split(ROW_SEPARATOR).map((column) => column.trim());
    if (columns.length !== 3 || columns.some((column) => !column)) {
      unstructuredAnswerLinesCount += 1;
      continue;
    }
    const idMatch = /^(\d+)$/u.exec(columns[0]);
    if (!idMatch) {
      unstructuredAnswerLinesCount += 1;
      continue;
    }
    rows.push({ id: Number(idMatch[1]), title: columns[1], relation: columns[2] });
  }
  return { rows, scopeLines, scopeLineIsFinal, unstructuredAnswerLinesCount };
}

function normalizeSourceRow(item) {
  const names = [
    ...new Set(
      [item?.nameCn, item?.name].filter(
        (name) => typeof name === 'string' && name.trim().length > 0,
      ),
    ),
  ];
  const valid =
    item &&
    Number.isInteger(item.id) &&
    item.id > 0 &&
    typeof item.relation === 'string' &&
    item.relation.trim().length > 0 &&
    names.length > 0;
  return valid ? { valid: true, id: item.id, names, relation: item.relation } : { valid: false };
}

function hasBoundedSourceDisclosure(scopeText) {
  return (
    /(?:本次|当前|这一响应|来源条目)/u.test(scopeText) &&
    /官方\s*v0/iu.test(scopeText) &&
    /(?:直接关系|直接行)/u.test(scopeText) &&
    /(?:无分页|没有分页)/u.test(scopeText) &&
    /(?:无总数|没有总数|未提供总数)/u.test(scopeText) &&
    /(?:不能据此(?:认定|证明|确认)|不保证|不代表).{0,14}(?:完整|全集|全系列)/u.test(scopeText)
  );
}

function hasSourceSubjectDisclosure(scopeText, subjectId) {
  if (!Number.isInteger(subjectId) || subjectId <= 0) return false;
  return new RegExp(`来源条目\\s*${subjectId}(?!\\d)`, 'u').test(scopeText);
}

function hasResponseCountsDisclosure(scopeText, observedCount, returnedCount) {
  if (
    !Number.isInteger(observedCount) ||
    observedCount < 0 ||
    !Number.isInteger(returnedCount) ||
    returnedCount < 0
  ) {
    return false;
  }
  const observedPattern = new RegExp(`观察(?:到)?\\s*${observedCount}\\s*行`, 'u');
  const returnedPattern = new RegExp(`返回\\s*${returnedCount}\\s*条`, 'u');
  return observedPattern.test(scopeText) && returnedPattern.test(scopeText);
}

function hasRowsOmittedDisclosure(scopeText, rowsOmitted) {
  if (!Number.isInteger(rowsOmitted) || rowsOmitted < 0) return false;
  if (rowsOmitted === 0) return true;
  const omittedPattern = new RegExp(`MCP文本视图省略(?:了)?\\s*${rowsOmitted}\\s*行`, 'u');
  return omittedPattern.test(scopeText);
}

function hasOmissionNotAbsenceDisclosure(scopeText) {
  return /(?:未(?:返回|显示|列出|观察到).{0,12}(?:不代表|不等于|不足以|不能据此).{0,10}(?:不存在|没有)|未返回关系不等于不存在)/u.test(
    scopeText,
  );
}

function hasNonCanonicalOrderDisclosure(scopeText) {
  return /(?:(?:接口|关系|本次返回).{0,16}(?:顺序).{0,16}(?:不表示|不是|不等于|不代表).{0,12}(?:官方)?观看顺序|(?:没有|尚未|未).{0,16}(?:发布|提供|定义).{0,16}(?:唯一|统一|canonical).{0,12}(?:观看)?顺序|(?:不是|不代表|并非).{0,20}(?:Bangumi|官方|canonical).{0,12}(?:唯一|统一)?(?:观看)?顺序)/iu.test(
    scopeText,
  );
}

function hasSchemaDriftDisclosure(scopeText, count) {
  if (!Number.isInteger(count) || count <= 0) return false;
  const countPattern = new RegExp(
    `(?:解析|格式异常|schema.?drift)[^。！？\\n]{0,20}${count}\\s*(?:条|行)`,
    'iu',
  );
  return countPattern.test(scopeText);
}

function isTextProjectionConsistent(textResult, fullResult) {
  if (!textResult || !Array.isArray(textResult.items)) return false;
  const projection = textResult.textProjection;
  if (
    !projection ||
    projection.fullStructuredContentAvailable !== true ||
    projection.rowsIncluded !== textResult.items.length ||
    !Number.isInteger(projection.rowsOmitted)
  ) {
    return false;
  }
  if (!fullResult) {
    return (
      projection.rowsOmitted === textResult.coverage.rowsReturned - textResult.items.length &&
      projection.rowsOmitted >= 0
    );
  }
  if (projection.rowsOmitted !== fullResult.items.length - textResult.items.length) return false;
  const fullById = new Map(fullResult.items.map((item) => [item.id, normalizeSourceRow(item)]));
  return textResult.items.every((item) => {
    const source = fullById.get(item.id);
    return (
      source?.valid === true &&
      isProjectedSourceText(source.relation, item.relation) &&
      source.names.some(
        (name) =>
          isProjectedSourceText(name, item.name) ||
          (typeof item.nameCn === 'string' && isProjectedSourceText(name, item.nameCn)),
      )
    );
  });
}

function hasCompleteTextReadback(textResult) {
  const projection = textResult?.textProjection;
  return (
    Boolean(textResult) &&
    projection?.fullStructuredContentAvailable === true &&
    projection.rowsIncluded === textResult.items.length &&
    projection.rowsOmitted === 0 &&
    projection.displayNamesClipped === 0 &&
    projection.relationLabelsClipped === 0 &&
    projection.limitationsClipped === 0 &&
    textResult.coverage?.rowsReturned === textResult.items.length
  );
}

function isProjectedSourceText(source, projected) {
  if (typeof source !== 'string' || typeof projected !== 'string') return false;
  if (!projected.endsWith('…')) return source === projected;
  return source.startsWith(projected.slice(0, -1));
}

function hasUnqualifiedClaim(text, pattern) {
  for (const sentence of text.split(CLAIM_CLAUSE_BOUNDARY)) {
    pattern.lastIndex = 0;
    for (const match of sentence.matchAll(pattern)) {
      const prefix = sentence.slice(Math.max(0, match.index - 56), match.index).trimEnd();
      if (!CLAIM_NEGATION.test(prefix)) return true;
    }
  }
  return false;
}

function unwrapArguments(value) {
  let parsed = parseJson(value);
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    if ('Arguments' in parsed) parsed = parseJson(parsed.Arguments);
    else if ('arguments' in parsed) parsed = parseJson(parsed.arguments);
  }
  return parsed;
}

function findStructuredRelationsResult(value) {
  const pending = [{ value, depth: 0 }];
  const visited = new Set();
  let visitedCount = 0;
  while (pending.length > 0 && visitedCount < 3000) {
    const current = pending.pop();
    visitedCount += 1;
    const candidate = parseJson(current.value);
    if (current.depth > 12 || !candidate || typeof candidate !== 'object') continue;
    if (visited.has(candidate)) continue;
    visited.add(candidate);
    if (Array.isArray(candidate)) {
      for (const item of candidate.slice(0, 100))
        pending.push({ value: item, depth: current.depth + 1 });
      continue;
    }
    if (isDirectRelationsResult(candidate.structuredContent)) return candidate.structuredContent;
    for (const key of ['structuredContent', 'data', 'result', 'content', 'output', 'toolOutput']) {
      if (key in candidate) pending.push({ value: candidate[key], depth: current.depth + 1 });
    }
  }
  return null;
}

function findTextProjectionResult(value) {
  const pending = [{ value, depth: 0 }];
  const visited = new Set();
  let visitedCount = 0;
  while (pending.length > 0 && visitedCount < 3000) {
    const current = pending.pop();
    visitedCount += 1;
    const candidate = parseJson(current.value);
    if (current.depth > 12 || !candidate || typeof candidate !== 'object') continue;
    if (visited.has(candidate)) continue;
    visited.add(candidate);
    if (Array.isArray(candidate)) {
      for (const item of candidate.slice(0, 100))
        pending.push({ value: item, depth: current.depth + 1 });
      continue;
    }
    if (isDirectRelationsResult(candidate) && candidate.textProjection) return candidate;
    for (const key of ['content', 'text', 'data', 'result', 'output', 'toolOutput']) {
      if (key in candidate) pending.push({ value: candidate[key], depth: current.depth + 1 });
    }
  }
  return null;
}

function isDirectRelationsResult(value) {
  return (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    ['observed', 'partial'].includes(value.state) &&
    Number.isInteger(value.subjectId) &&
    value.source?.operation === 'GET /v0/subjects/{subject_id}/subjects' &&
    Array.isArray(value.items) &&
    Array.isArray(value.limitations) &&
    value.coverage &&
    typeof value.coverage === 'object'
  );
}

function parseJson(value) {
  if (typeof value !== 'string') return value;
  const text = value.trim();
  if (!text.startsWith('{') && !text.startsWith('[')) return value;
  try {
    return JSON.parse(text);
  } catch {
    return value;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const check = verifyG20DirectRelationsAnswer(
    input.answer,
    input.queryArguments,
    input.toolOutput,
    input.toolCalls,
    input.toolTextUtf8Bytes,
  );
  process.stdout.write(JSON.stringify(check));
}
