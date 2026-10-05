import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const G01_AGENT_ANSWER_CHECK_METHOD = 'ordered-source-row-identity-and-bounds-v2';
export const G01_QUERY_ARGUMENTS = Object.freeze({
  media: 'anime',
  year: 2026,
  month: 7,
  concepts: ['后宫'],
  resultMode: 'all',
  limit: 100,
  explain: 'full',
});

const ROW_SEPARATOR = '｜';
const SCOPE_LINE = /^(?:范围|说明)[:：]/u;
const MARKDOWN_LINE = /^\s*(?:#{1,6}\s|[-*+]\s|>\s|\d+\.\s|```)/u;
const COMPLETENESS_CLAIM =
  /(?:全站.{0,8}(?:完整|全部|全量)|(?:完整|全部|所有).{0,8}(?:全站|动画|番剧|符合条件)|完整(?:名单|列表|集合)|全量名单|无一遗漏|覆盖全部)/gu;
const ABSENCE_CLAIM =
  /(?:(?:没有|不存在|找不到|无)(?:其他|更多|其余).{0,10}(?:动画|番剧|作品|条目|符合条件)|(?:动画|番剧|作品|条目).{0,10}(?:没有|不存在|不再有)其他)/gu;
const CLAIM_NEGATION =
  /(?:不代表|并非|不是|不能(?:据此)?(?:证明|确认|说明|推断)?|无法(?:据此)?(?:证明|确认|说明|推断)?|不足以(?:证明|确认|说明)?|不等于|未能证明|尚不能)\s*$/u;

export function verifyG01AgentAnswer(answer, queryArguments, toolOutput) {
  const normalizedArguments = unwrapArguments(queryArguments);
  const queryArgumentsMatch = exactQueryArguments(normalizedArguments);
  const result = findDiscoveryResult(toolOutput);
  const resultReadbackAvailable = Boolean(result);
  const rawItems = Array.isArray(result?.items) ? result.items : [];
  const sourceRows = rawItems.map(normalizeSourceRow);
  const invalidSourceRowsCount = sourceRows.filter((row) => !row.valid).length;
  const rows = sourceRows.filter((row) => row.valid);
  const sourceIds = rows.map((row) => row.id);
  const duplicateSourceRowsCount = sourceIds.length - new Set(sourceIds).size;
  const coverage = result?.coverage ?? result?.explanation?.coverage ?? {};
  const returnedRows = Number.isInteger(coverage.returned) ? coverage.returned : null;
  const sourceReturnedMatchesVisibleRows = returnedRows === rawItems.length;
  const projection = result?.projection ?? {};
  const textOmittedItems = Number.isInteger(projection.omittedItems)
    ? Math.max(0, projection.omittedItems)
    : 0;
  const projectionItemsIncluded = Number.isInteger(projection.itemsIncluded)
    ? projection.itemsIncluded
    : null;
  const projectionCountMatchesVisibleRows =
    projectionItemsIncluded === null || projectionItemsIncluded === rawItems.length;
  const totalKind =
    coverage.totalKind ?? result?.explanation?.totalKind ?? result?.plan?.totalKind ?? null;
  const experimentalSourceWarningPresent = hasWarningCode(result, 'EXPERIMENTAL_SOURCE');
  const resultState = typeof result?.state === 'string' ? result.state : null;
  const sourceOperationVerified = result?.plan?.operation === 'searchSubjects';
  const answerText = typeof answer === 'string' ? answer : '';

  const parsedAnswer = parseAnswer(answerText);
  const expectedById = new Map(rows.map((row) => [row.id, row]));
  const seenIds = new Set();
  let matchedRows = 0;
  let mismatchedRows = 0;
  let unmatchedRows = 0;
  let duplicateAnswerRows = 0;

  for (const row of parsedAnswer.rows) {
    if (seenIds.has(row.id)) duplicateAnswerRows += 1;
    seenIds.add(row.id);
    const expected = expectedById.get(row.id);
    if (!expected) {
      unmatchedRows += 1;
      continue;
    }
    if (row.title !== expected.title || row.date !== expected.date) {
      mismatchedRows += 1;
      continue;
    }
    matchedRows += 1;
  }

  const missingRows = rows.filter(
    (row) => !parsedAnswer.rows.some((answerRow) => answerRow.id === row.id),
  ).length;
  const rowOrderPreserved =
    parsedAnswer.rows.length === rows.length &&
    rows.every((row, index) => parsedAnswer.rows[index]?.id === row.id);
  const scopeText = parsedAnswer.scopeLines.join('\n');
  const exactTagScopeDisclosurePresent = /后宫.{0,8}标签|标签.{0,8}后宫/u.test(scopeText);
  const monthScopeDisclosurePresent = /2026\s*年\s*7\s*月|2026-07/u.test(scopeText);
  const animeScopeDisclosurePresent = /动画|番剧/u.test(scopeText);
  const explicitCountPatternMatched = hasCountDisclosure(scopeText, rows.length);
  const answerRowsAccountForVisibleResultCount =
    parsedAnswer.rows.length === rows.length &&
    matchedRows === rows.length &&
    missingRows === 0 &&
    mismatchedRows === 0 &&
    unmatchedRows === 0 &&
    duplicateAnswerRows === 0;
  const boundedCoverageDisclosurePresent =
    /(?:本次|当前查询|当前检索|这次搜索).{0,24}(?:返回|检索|查询|观察).{0,32}(?:范围|结果|样本|覆盖|有界|有限)|(?:本次|当前查询|当前检索).{0,32}(?:有限|有界|样本)/u.test(
      scopeText,
    );
  const experimentalSourceDisclosurePresent = /实验(?:性)?(?:搜索|接口|来源)/u.test(scopeText);
  const estimatedTotalDisclosurePresent =
    /(?:总数|总量|数量).{0,12}(?:估算|估计)|(?:估算|估计).{0,12}(?:总数|总量|数量)/u.test(
      scopeText,
    );
  const nonExhaustiveDisclosurePresent =
    /(?:不代表|不能(?:据此)?(?:证明|确认)|无法(?:据此)?(?:证明|确认)|不足以(?:证明|确认)|不等于).{0,12}(?:全站|完整|全部|全量)|(?:全站|完整|全部|全量).{0,12}(?:不代表|不能(?:据此)?(?:证明|确认)|无法(?:据此)?(?:证明|确认)|不足以(?:证明|确认)|不等于)/u.test(
      scopeText,
    );
  const omissionCountDisclosurePresent =
    textOmittedItems === 0 || hasOmissionCountDisclosure(scopeText, textOmittedItems);
  const omissionNotAbsenceDisclosurePresent =
    textOmittedItems === 0 || hasOmissionNotAbsenceDisclosure(scopeText);
  const unsupportedCompletenessClaim = hasUnqualifiedClaim(scopeText, COMPLETENESS_CLAIM);
  const unsupportedAbsenceClaim = hasUnqualifiedClaim(scopeText, ABSENCE_CLAIM);
  const markdownFormattingDetected =
    answerLines(answerText).some((line) => MARKDOWN_LINE.test(line)) ||
    answerText.includes('**') ||
    answerText.includes('`') ||
    /(^|\s)\|(?=\s|$)/u.test(answerText);

  const passed =
    answerText.trim().length > 0 &&
    queryArgumentsMatch &&
    resultReadbackAvailable &&
    sourceOperationVerified &&
    projectionCountMatchesVisibleRows &&
    (resultState === 'ok' || resultState === 'partial') &&
    rawItems.length > 0 &&
    invalidSourceRowsCount === 0 &&
    duplicateSourceRowsCount === 0 &&
    sourceReturnedMatchesVisibleRows &&
    returnedRows === rows.length &&
    totalKind === 'estimated' &&
    experimentalSourceWarningPresent &&
    parsedAnswer.scopeLines.length > 0 &&
    parsedAnswer.unstructuredAnswerLinesCount === 0 &&
    parsedAnswer.rows.length === rows.length &&
    matchedRows === rows.length &&
    mismatchedRows === 0 &&
    unmatchedRows === 0 &&
    duplicateAnswerRows === 0 &&
    missingRows === 0 &&
    rowOrderPreserved &&
    exactTagScopeDisclosurePresent &&
    monthScopeDisclosurePresent &&
    animeScopeDisclosurePresent &&
    answerRowsAccountForVisibleResultCount &&
    boundedCoverageDisclosurePresent &&
    experimentalSourceDisclosurePresent &&
    estimatedTotalDisclosurePresent &&
    nonExhaustiveDisclosurePresent &&
    omissionCountDisclosurePresent &&
    omissionNotAbsenceDisclosurePresent &&
    !unsupportedCompletenessClaim &&
    !unsupportedAbsenceClaim &&
    !markdownFormattingDetected;

  return {
    method: G01_AGENT_ANSWER_CHECK_METHOD,
    queryArgumentsMatch,
    resultReadbackAvailable,
    resultState,
    returnedRows: rawItems.length,
    invalidSourceRowsCount,
    duplicateSourceRowsCount,
    sourceReturnedMatchesVisibleRows,
    textOmittedItems,
    projectionItemsIncluded,
    projectionCountMatchesVisibleRows,
    totalKind,
    experimentalSourceWarningPresent,
    sourceOperationVerified,
    answerRowsParsed: parsedAnswer.rows.length,
    rowsMatched: matchedRows,
    missingRows,
    mismatchedRows,
    unmatchedRows,
    duplicateAnswerRows,
    unstructuredAnswerLinesCount: parsedAnswer.unstructuredAnswerLinesCount,
    rowOrderPreserved,
    exactTagScopeDisclosurePresent,
    monthScopeDisclosurePresent,
    animeScopeDisclosurePresent,
    explicitCountPatternMatched,
    answerRowsAccountForVisibleResultCount,
    boundedCoverageDisclosurePresent,
    experimentalSourceDisclosurePresent,
    estimatedTotalDisclosurePresent,
    nonExhaustiveDisclosurePresent,
    omissionCountDisclosurePresent,
    omissionNotAbsenceDisclosurePresent,
    unsupportedCompletenessClaim,
    unsupportedAbsenceClaim,
    markdownFormattingDetected,
    passed,
  };
}

function unwrapArguments(value) {
  let parsed = parseJson(value);
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const record = parsed;
    if ('Arguments' in record) parsed = parseJson(record.Arguments);
    else if ('arguments' in record) parsed = parseJson(record.arguments);
  }
  return parsed;
}

function exactQueryArguments(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const actual = value;
  const expectedKeys = Object.keys(G01_QUERY_ARGUMENTS).sort();
  if (Object.keys(actual).sort().join('\u0000') !== expectedKeys.join('\u0000')) return false;
  return (
    actual.media === G01_QUERY_ARGUMENTS.media &&
    actual.year === G01_QUERY_ARGUMENTS.year &&
    actual.month === G01_QUERY_ARGUMENTS.month &&
    Array.isArray(actual.concepts) &&
    actual.concepts.length === 1 &&
    actual.concepts[0] === '后宫' &&
    actual.resultMode === G01_QUERY_ARGUMENTS.resultMode &&
    actual.limit === G01_QUERY_ARGUMENTS.limit &&
    actual.explain === G01_QUERY_ARGUMENTS.explain
  );
}

function findDiscoveryResult(value) {
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
    if (
      Array.isArray(candidate.items) &&
      (candidate.coverage || candidate.state || candidate.explanation || candidate.plan)
    ) {
      return candidate;
    }
    for (const key of ['structuredContent', 'data', 'result', 'content', 'text', 'output']) {
      if (key in candidate) pending.push({ value: candidate[key], depth: current.depth + 1 });
    }
  }
  return null;
}

function normalizeSourceRow(item) {
  const title = [item?.displayName, item?.nameCn, item?.name_cn, item?.name].find(
    (value) => typeof value === 'string' && value.trim(),
  );
  const date = [item?.date, item?.airDate, item?.air_date].find(
    (value) => typeof value === 'string' && value.trim(),
  );
  return {
    id: Number.isInteger(item?.id) && item.id > 0 ? item.id : null,
    title: typeof title === 'string' ? title.trim() : null,
    date: typeof date === 'string' ? date.trim() : null,
    valid:
      Number.isInteger(item?.id) &&
      item.id > 0 &&
      typeof title === 'string' &&
      typeof date === 'string' &&
      /^2026-07-\d{2}$/u.test(date.trim()) &&
      (item?.media === undefined || item.media === 'anime'),
  };
}

function parseAnswer(answer) {
  const rows = [];
  const scopeLines = [];
  let unstructuredAnswerLinesCount = 0;
  if (typeof answer !== 'string') return { rows, scopeLines, unstructuredAnswerLinesCount: 1 };
  for (const rawLine of answerLines(answer)) {
    const line = rawLine.trim();
    if (!line) continue;
    if (SCOPE_LINE.test(line)) {
      scopeLines.push(line);
      continue;
    }
    const idSeparator = line.lastIndexOf(ROW_SEPARATOR);
    const titleSeparator = line.lastIndexOf(ROW_SEPARATOR, idSeparator - 1);
    if (titleSeparator < 0 || idSeparator <= titleSeparator) {
      unstructuredAnswerLinesCount += 1;
      continue;
    }
    const title = line.slice(0, titleSeparator).trim();
    const dateField = line.slice(titleSeparator + 1, idSeparator).trim();
    const idField = line.slice(idSeparator + 1).trim();
    const dateMatch = /^首播日期[:：]\s*(\d{4}-\d{2}-\d{2})$/u.exec(dateField);
    const idMatch = /^Bangumi ID[:：]\s*(\d+)$/u.exec(idField);
    if (!title || !dateMatch || !idMatch) {
      unstructuredAnswerLinesCount += 1;
      continue;
    }
    rows.push({ title, date: dateMatch[1], id: Number(idMatch[1]) });
  }
  return { rows, scopeLines, unstructuredAnswerLinesCount };
}

function answerLines(answer) {
  return typeof answer === 'string' ? answer.split(/\r?\n/u) : [];
}

function hasCountDisclosure(scopeText, count) {
  if (!Number.isInteger(count) || count <= 0) return false;
  const number = String(count);
  const countPattern = new RegExp(
    `(?:返回|检索到|匹配到|找到|共计|合计|共(?:有|找到|检索到)?)[：:]?\\s*${number}\\s*(?:部|条|项|个)?`,
    'u',
  );
  return countPattern.test(scopeText);
}

function hasOmissionCountDisclosure(scopeText, omittedItems) {
  const number = String(omittedItems);
  const pattern = new RegExp(
    `(?:另有|其余|省略|未展示|未显示|未展开|文本(?:中)?省略).{0,12}${number}\\s*(?:部|条|项|个)`,
    'u',
  );
  return pattern.test(scopeText);
}

function hasOmissionNotAbsenceDisclosure(scopeText) {
  return /(?:未显示|未展开|省略|未展示).{0,12}(?:不代表|不能说明|并不意味着).{0,12}(?:不存在|没有)|(?:不代表|不能说明|并不意味着).{0,12}(?:未显示|未展开|省略|未展示).{0,12}(?:不存在|没有)/u.test(
    scopeText,
  );
}

function hasWarningCode(value, expectedCode) {
  const pending = [value];
  let visited = 0;
  while (pending.length > 0 && visited < 3000) {
    const current = parseJson(pending.pop());
    visited += 1;
    if (!current || typeof current !== 'object') continue;
    if (Array.isArray(current)) {
      pending.push(...current.slice(0, 100));
      continue;
    }
    if (current.code === expectedCode) return true;
    pending.push(...Object.values(current).slice(0, 100));
  }
  return false;
}

function hasUnqualifiedClaim(text, pattern) {
  for (const sentence of text.split(/(?<=[。！？\n])/u)) {
    pattern.lastIndex = 0;
    for (const match of sentence.matchAll(pattern)) {
      const prefix = sentence.slice(Math.max(0, match.index - 28), match.index).trimEnd();
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
  const check = verifyG01AgentAnswer(input.answer, input.queryArguments, input.toolOutput);
  process.stdout.write(JSON.stringify(check));
}
