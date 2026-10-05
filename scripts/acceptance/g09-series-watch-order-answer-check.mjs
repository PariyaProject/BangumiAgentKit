import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const G09_SERIES_WATCH_ORDER_ANSWER_CHECK_METHOD =
  'ordered-series-watch-order-rows-and-bounds-v1';

const EXPECTED_ARGUMENTS = Object.freeze({
  subjectId: 218707,
  depth: 2,
  maxNodes: 8,
  media: 'anime',
});
const ROW_SEPARATOR = '｜';
const SCOPE_LINE = /^(?:范围|说明)[:：]/u;
const MARKDOWN_LINE = /^\s*(?:#{1,6}\s|[-*+]\s|>\s|```)/u;
const COMPLETENESS_CLAIM =
  /(?:完整(?:系列|观看顺序|顺序|名单|列表)|全系列|全量(?:关系|作品|顺序)|所有作品|全部作品|没有遗漏|没有其他作品|不存在其他作品)/gu;
const CANONICAL_CLAIM =
  /(?:唯一正确(?:的)?顺序|唯一(?:官方)?(?:观看)?顺序|唯一顺序|官方(?:观看)?顺序|canonical\s+order)/giu;
const ABSENCE_CLAIM =
  /(?:(?:没有|不存在|不再有|找不到)(?:其他|更多|其余|任何)?(?:系列|动画|作品|条目)|(?:系列|动画|作品|条目).{0,8}(?:只有|仅有)(?:以上|这些|上述|前述)?(?:\d+|[零〇一二两三四五六七八九十百千万]+)?(?:部|条|项|个)?)/gu;
const CLAIM_NEGATION =
  /(?:不代表|并非|并不是|不是|不等于|不构成|不能(?:据此)?(?:证明|确认|说明|称为|说)?|无法(?:据此)?(?:证明|确认|说明|称为|说)?|(?:未|没有|尚未)[^。！？\n]{0,24}(?:发布|提供|定义)[^。！？\n]{0,16}|未能证明|不足以(?:证明|确认))\s*$/u;

export function verifyG09SeriesWatchOrderAnswer(
  answer,
  queryArguments,
  toolOutput,
  toolCalls,
  toolTextUtf8Bytes,
) {
  const normalizedArguments = unwrapArguments(queryArguments);
  const answerText = typeof answer === 'string' ? answer : '';
  const queryArgumentsMatch = exactQueryArguments(normalizedArguments);
  const result = findSeriesWatchOrderResult(toolOutput);
  const sourceRows = Array.isArray(result?.watchOrder)
    ? result.watchOrder.map(normalizeSourceRow)
    : [];
  const validSourceRows = sourceRows.filter((row) => row.valid);
  const sourceIds = validSourceRows.map((row) => row.id);
  const duplicateSourceRowsCount = sourceIds.length - new Set(sourceIds).size;
  const parsedAnswer = parseAnswer(answerText);
  const expectedById = new Map(validSourceRows.map((row) => [row.id, row]));
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
    if (
      row.position !== expected.position ||
      row.relation !== expected.relation ||
      !expected.names.includes(row.title)
    ) {
      mismatchedRowsCount += 1;
      continue;
    }
    rowsMatchedCount += 1;
  }

  const missingRowsCount = validSourceRows.filter(
    (row) => !parsedAnswer.rows.some((answerRow) => answerRow.id === row.id),
  ).length;
  const rowOrderPreserved =
    parsedAnswer.rows.length === validSourceRows.length &&
    validSourceRows.every((row, index) => parsedAnswer.rows[index]?.id === row.id);
  const scopeText = parsedAnswer.scopeLines.join('\n');
  const boundedCoverageDisclosurePresent = hasBoundedCoverageDisclosure(
    scopeText,
    result?.coverage,
  );
  const nonCanonicalOrderDisclosurePresent = hasNonCanonicalDisclosure(scopeText);
  const nonAnimeExclusionsDisclosurePresent = hasNonAnimeDisclosure(
    scopeText,
    result?.coverage?.nonAnimeRowsObserved,
  );
  const omissionCountFields = [
    'watchOrderRowsOmittedFromText',
    'relatedRowsOmittedFromText',
    'edgeRowsOmittedFromText',
    'exclusionSamplesOmittedFromText',
    'sourceOperationsOmittedFromText',
  ];
  const omittedTextRowsCount = omissionCountFields.reduce((total, field) => {
    const count = result?.mcpTextProjection?.[field];
    return total + (Number.isInteger(count) ? Math.max(0, count) : 0);
  }, 0);
  const textDetailsTruncated =
    omittedTextRowsCount > 0 ||
    result?.coverage?.truncated === true ||
    result?.mcpTextProjection?.displayNamesTruncated > 0 ||
    result?.mcpTextProjection?.relationLabelsTruncated > 0;
  const omissionNotAbsenceDisclosurePresent =
    !textDetailsTruncated ||
    /(?:未显示|未列出|省略|遗漏).{0,16}(?:不代表|不能说明|并不意味着|不足以说明)/u.test(scopeText);
  const unsupportedCompletenessClaim = hasUnqualifiedClaim(scopeText, COMPLETENESS_CLAIM);
  const unsupportedCanonicalOrderClaim = hasUnqualifiedClaim(scopeText, CANONICAL_CLAIM);
  const unsupportedAbsenceClaim = hasUnqualifiedClaim(scopeText, ABSENCE_CLAIM);
  const markdownFormattingDetected =
    answerText.split(/\r?\n/u).some((line) => MARKDOWN_LINE.test(line)) ||
    answerText.includes('**') ||
    answerText.includes('`') ||
    /(^|\s)\|(?=\s|$)/u.test(answerText);
  const exactSingleToolCall =
    Array.isArray(toolCalls) &&
    toolCalls.length === 1 &&
    toolCalls[0]?.name === 'bangumi.get_series_watch_order' &&
    toolCalls[0]?.state === 'DONE';
  const rootIsFirst = Boolean(
    result?.root?.id === EXPECTED_ARGUMENTS.subjectId &&
    result?.watchOrder?.[0]?.id === EXPECTED_ARGUMENTS.subjectId &&
    result.watchOrder[0]?.position === 1 &&
    result.watchOrder[0]?.placement === 'root',
  );
  const textBudgetVerified =
    Number.isInteger(toolTextUtf8Bytes) &&
    toolTextUtf8Bytes > 0 &&
    toolTextUtf8Bytes <= result?.mcpTextProjection?.maxUtf8Bytes &&
    result?.mcpTextProjection?.maxUtf8Bytes === 3600;
  const exactG09Scope =
    result?.subjectId === EXPECTED_ARGUMENTS.subjectId &&
    result?.coverage?.depth === EXPECTED_ARGUMENTS.depth &&
    result?.coverage?.maxNodes === EXPECTED_ARGUMENTS.maxNodes &&
    result?.coverage?.media === EXPECTED_ARGUMENTS.media;
  const sourceNamesAndLabelsComplete =
    result?.mcpTextProjection?.displayNamesTruncated === 0 &&
    result?.mcpTextProjection?.relationLabelsTruncated === 0;
  const structuredContentContractPresent =
    result?.mcpTextProjection?.structuredContentHasFullResult === true;
  const sourceReturnedMatchesVisibleRows =
    Number.isInteger(result?.mcpTextProjection?.watchOrderRowsReturned) &&
    result.mcpTextProjection.watchOrderRowsReturned === validSourceRows.length &&
    result?.mcpTextProjection?.watchOrderRowsIncluded === validSourceRows.length;
  const passed =
    answerText.trim().length > 0 &&
    queryArgumentsMatch &&
    exactSingleToolCall &&
    result !== null &&
    exactG09Scope &&
    rootIsFirst &&
    textBudgetVerified &&
    structuredContentContractPresent &&
    sourceNamesAndLabelsComplete &&
    sourceReturnedMatchesVisibleRows &&
    validSourceRows.length > 0 &&
    duplicateSourceRowsCount === 0 &&
    parsedAnswer.scopeLines.length > 0 &&
    parsedAnswer.unstructuredAnswerLinesCount === 0 &&
    parsedAnswer.rows.length === validSourceRows.length &&
    rowsMatchedCount === validSourceRows.length &&
    missingRowsCount === 0 &&
    mismatchedRowsCount === 0 &&
    unmatchedRowsCount === 0 &&
    duplicateAnswerRowsCount === 0 &&
    rowOrderPreserved &&
    boundedCoverageDisclosurePresent &&
    nonCanonicalOrderDisclosurePresent &&
    nonAnimeExclusionsDisclosurePresent &&
    omissionNotAbsenceDisclosurePresent &&
    !unsupportedCompletenessClaim &&
    !unsupportedCanonicalOrderClaim &&
    !unsupportedAbsenceClaim &&
    !markdownFormattingDetected;

  return {
    method: G09_SERIES_WATCH_ORDER_ANSWER_CHECK_METHOD,
    queryArgumentsMatch,
    exactSingleToolCall,
    resultReadbackAvailable: result !== null,
    exactG09Scope,
    rootIsFirst,
    textBudgetVerified,
    toolTextUtf8Bytes: Number.isInteger(toolTextUtf8Bytes) ? toolTextUtf8Bytes : null,
    structuredContentContractPresent,
    sourceNamesAndLabelsComplete,
    sourceReturnedMatchesVisibleRows,
    omittedTextRowsCount,
    visibleWatchOrderRows: validSourceRows.length,
    invalidSourceRowsCount: sourceRows.length - validSourceRows.length,
    duplicateSourceRowsCount,
    answerRowsParsed: parsedAnswer.rows.length,
    rowsMatched: rowsMatchedCount,
    missingRowsCount,
    mismatchedRowsCount,
    unmatchedRowsCount,
    duplicateAnswerRowsCount,
    unstructuredAnswerLinesCount: parsedAnswer.unstructuredAnswerLinesCount,
    rowOrderPreserved,
    boundedCoverageDisclosurePresent,
    nonCanonicalOrderDisclosurePresent,
    nonAnimeExclusionsDisclosurePresent,
    omissionNotAbsenceDisclosurePresent,
    unsupportedCompletenessClaim,
    unsupportedCanonicalOrderClaim,
    unsupportedAbsenceClaim,
    markdownFormattingDetected,
    passed,
  };
}

function unwrapArguments(value) {
  let parsed = parseJson(value);
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    if ('Arguments' in parsed) parsed = parseJson(parsed.Arguments);
    else if ('arguments' in parsed) parsed = parseJson(parsed.arguments);
  }
  return parsed;
}

function exactQueryArguments(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return (
    Object.keys(value).sort().join('\u0000') ===
      Object.keys(EXPECTED_ARGUMENTS).sort().join('\u0000') &&
    value.subjectId === EXPECTED_ARGUMENTS.subjectId &&
    value.depth === EXPECTED_ARGUMENTS.depth &&
    value.maxNodes === EXPECTED_ARGUMENTS.maxNodes &&
    value.media === EXPECTED_ARGUMENTS.media
  );
}

function findSeriesWatchOrderResult(value) {
  const pending = [{ value, depth: 0 }];
  let visited = 0;
  while (pending.length > 0 && visited < 3000) {
    const current = pending.pop();
    visited += 1;
    const candidate = parseJson(current.value);
    if (current.depth > 12 || !candidate || typeof candidate !== 'object') continue;
    if (Array.isArray(candidate)) {
      for (const item of candidate.slice(0, 100)) {
        pending.push({ value: item, depth: current.depth + 1 });
      }
      continue;
    }
    if (Array.isArray(candidate.watchOrder) && candidate.coverage && candidate.mcpTextProjection) {
      return candidate;
    }
    for (const key of [
      'structuredContent',
      'data',
      'result',
      'content',
      'text',
      'output',
      'toolOutput',
    ]) {
      if (key in candidate) pending.push({ value: candidate[key], depth: current.depth + 1 });
    }
  }
  return null;
}

function normalizeSourceRow(item) {
  const valid =
    item &&
    Number.isInteger(item.id) &&
    Number.isInteger(item.position) &&
    typeof item.placement === 'string' &&
    typeof item.name === 'string' &&
    typeof item.nameCn === 'string' &&
    Array.isArray(item.relationLabels) &&
    item.relationLabels.every((label) => typeof label === 'string');
  if (!valid) return { valid: false };
  return {
    valid: true,
    id: item.id,
    position: item.position,
    relation: item.placement === 'root' ? '起点' : item.relationLabels.join('、'),
    names: [...new Set([item.nameCn, item.name].filter(Boolean))],
  };
}

function parseAnswer(answer) {
  const rows = [];
  const scopeLines = [];
  let unstructuredAnswerLinesCount = 0;
  for (const rawLine of answer.split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (SCOPE_LINE.test(line)) {
      scopeLines.push(line.replace(SCOPE_LINE, '').trim());
      continue;
    }
    const columns = line.split(ROW_SEPARATOR).map((column) => column.trim());
    if (columns.length !== 4 || columns.some((column) => !column)) {
      unstructuredAnswerLinesCount += 1;
      continue;
    }
    const positionMatch = /^(?:第\s*)?(\d+)(?:\s*步)?$/u.exec(columns[0]);
    const idMatch = /^(\d+)$/u.exec(columns[1]);
    if (!positionMatch || !idMatch) {
      unstructuredAnswerLinesCount += 1;
      continue;
    }
    rows.push({
      position: Number(positionMatch[1]),
      id: Number(idMatch[1]),
      relation: columns[2],
      title: columns[3],
    });
  }
  return { rows, scopeLines, unstructuredAnswerLinesCount };
}

function hasBoundedCoverageDisclosure(scopeText, coverage) {
  if (!coverage || typeof scopeText !== 'string') return false;
  const bounded = /(?:本次|当前|有限|有界|范围内|样本)/u.test(scopeText);
  const depth = new RegExp(`(?:深度\\s*${coverage.depth}|depth\\s*${coverage.depth})`, 'iu');
  const nodes = new RegExp(
    `(?:最多|上限|maxNodes\\s*)\\s*${coverage.maxNodes}\\s*(?:个)?(?:动画)?节点?`,
    'iu',
  );
  const nodesFallback = new RegExp(`maxNodes\\s*[:=]?\\s*${coverage.maxNodes}`, 'iu');
  return (
    bounded && depth.test(scopeText) && (nodes.test(scopeText) || nodesFallback.test(scopeText))
  );
}

function hasNonCanonicalDisclosure(scopeText) {
  return /(?:(?:没有|尚未|未).{0,16}(?:发布|提供|定义).{0,20}(?:唯一|统一|canonical).{0,12}(?:观看)?顺序|(?:不是|并非|不代表).{0,20}(?:Bangumi|官方).{0,12}(?:唯一|统一|canonical).{0,12}(?:观看)?顺序|仅为.{0,12}(?:有限)?(?:建议|推荐))/iu.test(
    scopeText,
  );
}

function hasNonAnimeDisclosure(scopeText, observedCount) {
  if (!Number.isInteger(observedCount) || observedCount <= 0) return true;
  return (
    scopeText.includes('非动画') &&
    /(?:排除|剔除|未纳入)/u.test(scopeText) &&
    new RegExp(`(?:${observedCount}\\s*条?非动画|非动画.{0,12}${observedCount}\\s*条?)`, 'u').test(
      scopeText,
    )
  );
}

function hasUnqualifiedClaim(text, pattern) {
  for (const sentence of text.split(/(?<=[。！？\n])/u)) {
    pattern.lastIndex = 0;
    for (const match of sentence.matchAll(pattern)) {
      const prefix = sentence.slice(Math.max(0, match.index - 48), match.index).trimEnd();
      if (!CLAIM_NEGATION.test(prefix)) return true;
    }
  }
  return false;
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
  const check = verifyG09SeriesWatchOrderAnswer(
    input.answer,
    input.queryArguments,
    input.toolOutput,
    input.toolCalls,
    input.toolTextUtf8Bytes,
  );
  process.stdout.write(JSON.stringify(check));
}
