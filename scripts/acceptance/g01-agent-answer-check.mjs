import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const G01_AGENT_ANSWER_CHECK_METHOD = 'ordered-source-row-identity-and-bounds-v3';
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
  /(?:全站.{0,8}(?:完整|全部|全量|所有)|(?:完整|全部|所有).{0,8}(?:全站|动画|番剧|作品|条目|符合条件)|所有.{0,8}(?:后宫|动画|番剧|作品|条目)|(?:后宫|动画|番剧|作品|条目).{0,8}(?:全部|所有|全量|完整)|完整(?:名单|列表|集合)|全量名单|无一遗漏|覆盖全部)/gu;
const ABSENCE_CLAIM =
  /(?:(?:没有|不存在|找不到|无)(?:其他|更多|其余|任何).{0,12}(?:(?:后宫|符合条件的?)(?:动画|番剧|作品|条目)|动画|番剧|作品|条目|符合条件)|(?:后宫)?(?:动画|番剧|作品|条目).{0,12}(?:没有|不存在|不再有)(?:其他|更多|其余|任何)|(?:后宫)?(?:动画|番剧|作品|条目).{0,8}(?:不存在|找不到|为零|全无)|(?:不存在|没有|找不到|全无)(?:任何|其他|更多|其余)?(?:后宫)?(?:动画|番剧|作品|条目)|(?:后宫)?(?:动画|番剧|作品|条目).{0,12}(?:只有|仅有)(?:以上|这些|上述|前述)?(?:\d+|[零〇一二两三四五六七八九十百千万]+)?(?:部|条|项|个)?|(?:只有|仅有)(?:以上|这些|上述|前述)(?:\d+|[零〇一二两三四五六七八九十百千万]+)?(?:部|条|项|个))/gu;
const CLAIM_NEGATION =
  /(?:不代表|并非|不是|不能(?:据此)?(?:证明|确认|说明|推断)?|无法(?:据此)?(?:证明|确认|说明|推断)?|不足以(?:证明|确认|说明)?|不等于|未能证明|尚不能)\s*$/u;
const SCOPE_CLAUSE_SEPARATOR = /[，,；;。！？!?\n]+|但是|然而|不过|但(?!是)/u;
const NEGATION_CUE =
  /(?:并非|并不是|不是|并不|不属于|不算|并没有|没有|不能|无法|未能|不|未|没|无|非)/u;
const NUMERIC_CLAIM_NEGATION_PREFIX =
  /(?:并非|并不是|不是|并不|不能|无法|未能|没有|并没有|不|未)(?:[^，,。;；！？!?]{0,14})$/u;
const NUMERIC_CLAIM_NEGATION_SUFFIX = /^(?:并非|不是|并不|不正确|错误|假)/u;
const EXPLICIT_RESULT_COUNT =
  /(?:返回|检索到|匹配到|找到|共计|合计|共(?:有|找到|检索到|返回)?|有)[：:]?\s*(\d+(?:\.\d+)?|[零〇一二两三四五六七八九十百千万]+)(?![\d.])\s*(部|条|项|个)?/gu;
const OMISSION_COUNT =
  /(?:另有|其余|省略|未展示|未显示|未展开|文本(?:中)?省略).{0,12}?(\d+(?:\.\d+)?|[零〇一二两三四五六七八九十百千万]+)(?![\d.])\s*(部|条|项|个)/gu;
const BOUNDED_COVERAGE =
  /(?:本次|当前查询|当前检索|这次搜索).{0,24}(?:返回|检索|查询|观察).{0,32}(?:范围|结果|样本|覆盖|有界|有限)|(?:本次|当前查询|当前检索).{0,32}(?:有限|有界|样本)|(?:属于|为|是)?当前(?:的)?有界结果/u;
const EXPERIMENTAL_SOURCE = /实验(?:性)?(?:搜索|接口|来源)/u;
const ESTIMATED_TOTAL =
  /(?:总数|总量|数量).{0,12}(?:估算|估计)|(?:估算|估计).{0,12}(?:总数|总量|数量)/u;
const NON_EXHAUSTIVE =
  /(?:不代表|不能(?:据此)?(?:证明|确认)|无法(?:据此)?(?:证明|确认)|不足以(?:证明|确认)|不等于).{0,12}(?:全站|完整|全部|全量)(?:名单|列表|集合|结果)?|(?:全站|完整|全部|全量)(?:名单|列表|集合|结果)?.{0,12}(?:不代表|不能(?:据此)?(?:证明|确认)|无法(?:据此)?(?:证明|确认)|不足以(?:证明|确认)|不等于)/u;
const NEGATED_NON_EXHAUSTIVE =
  /(?:全站|完整|全部|全量)(?:名单|列表|集合|结果)?(?:不|未|并非|不是)(?:完整|全部|全量|齐全)?|(?:不能|无法|不足以|不代表|不等于).{0,12}(?:全站|完整|全部|全量)(?:名单|列表|集合|结果)?(?:不|未|并非|不是)/u;
const OMISSION_NOT_ABSENCE =
  /(?:未显示|未展开|省略|未展示).{0,12}(?:不代表|不能说明|并不意味着).{0,12}(?:不存在|没有)|(?:不代表|不能说明|并不意味着).{0,12}(?:未显示|未展开|省略|未展示).{0,12}(?:不存在|没有)/u;

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
  const exactTagScopeDisclosurePresent = hasAffirmativePattern(
    scopeText,
    /后宫.{0,8}标签|标签.{0,8}后宫/u,
  );
  const monthScopeDisclosurePresent = hasAffirmativePattern(
    scopeText,
    /2026\s*年\s*7\s*月|2026-07/u,
  );
  const animeScopeDisclosurePresent = hasAffirmativePattern(scopeText, /动画|番剧/u);
  const countDisclosure = analyzeCountDisclosure(scopeText, rows.length);
  const explicitCountPatternMatched = countDisclosure.explicitCountPatternMatched;
  const answerRowsAccountForVisibleResultCount =
    parsedAnswer.rows.length === rows.length &&
    matchedRows === rows.length &&
    missingRows === 0 &&
    mismatchedRows === 0 &&
    unmatchedRows === 0 &&
    duplicateAnswerRows === 0;
  const boundedCoverageDisclosurePresent = hasAffirmativePattern(scopeText, BOUNDED_COVERAGE);
  const experimentalSourceDisclosurePresent = hasAffirmativePattern(scopeText, EXPERIMENTAL_SOURCE);
  const estimatedTotalDisclosurePresent = hasAffirmativePattern(scopeText, ESTIMATED_TOTAL);
  const nonExhaustiveDisclosurePresent = hasNonExhaustiveDisclosure(scopeText);
  const omissionCountDisclosurePresent = hasOmissionCountDisclosure(scopeText, textOmittedItems);
  const omissionNotAbsenceDisclosurePresent =
    textOmittedItems === 0 || OMISSION_NOT_ABSENCE.test(scopeText);
  const unsupportedCompletenessClaim = hasUnqualifiedClaim(scopeText, COMPLETENESS_CLAIM);
  const unsupportedAbsenceClaim = hasUnqualifiedClaim(scopeText, ABSENCE_CLAIM);
  const unsupportedScopeClausesCount = countUnsupportedScopeClauses(scopeText);
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
    countDisclosure.explicitCountStatementsConsistent &&
    boundedCoverageDisclosurePresent &&
    experimentalSourceDisclosurePresent &&
    estimatedTotalDisclosurePresent &&
    nonExhaustiveDisclosurePresent &&
    omissionCountDisclosurePresent &&
    omissionNotAbsenceDisclosurePresent &&
    unsupportedScopeClausesCount === 0 &&
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
    explicitCountStatementsConsistent: countDisclosure.explicitCountStatementsConsistent,
    answerRowsAccountForVisibleResultCount,
    boundedCoverageDisclosurePresent,
    experimentalSourceDisclosurePresent,
    estimatedTotalDisclosurePresent,
    nonExhaustiveDisclosurePresent,
    omissionCountDisclosurePresent,
    omissionNotAbsenceDisclosurePresent,
    unsupportedScopeClausesCount,
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

function analyzeCountDisclosure(scopeText, count) {
  EXPLICIT_RESULT_COUNT.lastIndex = 0;
  const statements = [...scopeText.matchAll(EXPLICIT_RESULT_COUNT)].map((match) => ({
    count: parseCount(match[1]),
    affirmative: isAffirmativeNumericDisclosure(scopeText, match),
  }));
  const explicitCountStatementsConsistent =
    Number.isInteger(count) &&
    count > 0 &&
    statements.every((statement) => statement.count === count && statement.affirmative);
  return {
    explicitCountPatternMatched: statements.length > 0 && explicitCountStatementsConsistent,
    explicitCountStatementsConsistent,
  };
}

function hasOmissionCountDisclosure(scopeText, omittedItems) {
  OMISSION_COUNT.lastIndex = 0;
  const statements = [...scopeText.matchAll(OMISSION_COUNT)].map((match) => ({
    count: parseCount(match[1]),
    affirmative: isAffirmativeNumericDisclosure(scopeText, match),
  }));
  if (omittedItems === 0) return statements.length === 0;
  return (
    Number.isInteger(omittedItems) &&
    omittedItems > 0 &&
    statements.length > 0 &&
    statements.every((statement) => statement.count === omittedItems && statement.affirmative)
  );
}

function isAffirmativeNumericDisclosure(text, match) {
  const start = match.index ?? 0;
  const end = start + match[0].length;
  const before = text.slice(Math.max(0, start - 20), start);
  const after = text.slice(end, end + 20);
  return !NUMERIC_CLAIM_NEGATION_PREFIX.test(before) && !NUMERIC_CLAIM_NEGATION_SUFFIX.test(after);
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
  for (const sentence of scopeClauses(text)) {
    pattern.lastIndex = 0;
    for (const match of sentence.matchAll(pattern)) {
      const prefix = sentence.slice(Math.max(0, match.index - 28), match.index).trimEnd();
      if (!CLAIM_NEGATION.test(prefix)) return true;
    }
  }
  return false;
}

function hasNonExhaustiveDisclosure(text) {
  let affirmativeMatchFound = false;
  let negatedMatchFound = false;
  for (const clause of scopeClauses(text)) {
    if (!NON_EXHAUSTIVE.test(clause)) continue;
    if (NEGATED_NON_EXHAUSTIVE.test(clause)) negatedMatchFound = true;
    else affirmativeMatchFound = true;
  }
  return affirmativeMatchFound && !negatedMatchFound;
}

function hasAffirmativePattern(text, pattern) {
  const globalPattern = new RegExp(`${pattern.source}`, `${pattern.flags.replaceAll('g', '')}g`);
  let affirmativeMatchFound = false;
  let negatedMatchFound = false;
  for (const clause of scopeClauses(text)) {
    globalPattern.lastIndex = 0;
    for (const match of clause.matchAll(globalPattern)) {
      const start = match.index ?? 0;
      const end = start + match[0].length;
      const before = clause.slice(Math.max(0, start - 20), start);
      const after = clause.slice(end, end + 20);
      if (
        !NEGATION_CUE.test(`${before}${match[0]}`) &&
        !/(?:并非|不是|并不|不正确|不实|错误|假)/u.test(after)
      ) {
        affirmativeMatchFound = true;
      } else {
        negatedMatchFound = true;
      }
    }
  }
  return affirmativeMatchFound && !negatedMatchFound;
}

function countUnsupportedScopeClauses(scopeText) {
  const clauses = scopeClauses(scopeText);
  let unsupported = 0;
  for (const rawClause of clauses) {
    const clause = rawClause.replace(/^(?:范围|说明)[:：]\s*/u, '').trim();
    if (!clause) continue;
    if (!isSupportedScopeClause(clause)) unsupported += 1;
  }
  return unsupported;
}

function scopeClauses(text) {
  return text
    .split(SCOPE_CLAUSE_SEPARATOR)
    .map((clause) => clause.trim())
    .filter(Boolean);
}

function isSupportedScopeClause(clause) {
  const scopePrefix = String.raw`(?:(?:本次|当前)?(?:查询|检索)?范围(?:是|为)?[:：]?\s*)?`;
  const monthAnime = String.raw`(?:限定为|限于|仅限)?\s*2026\s*年\s*7\s*月(?:的)?(?:动画|番剧)(?:结果)?`;
  const exactTag = String.raw`(?:(?:按照|按|使用|基于|根据)\s*)?(?:Bangumi\s*(?:的)?\s*)?(?:精确|准确)?[“「『"']?后宫[”」』"']?标签(?:进行)?(?:查询|检索|筛选)?`;
  const dateScope = new RegExp(`^${scopePrefix}${monthAnime}$`, 'iu');
  const exactTagScope = new RegExp(`^${scopePrefix}${exactTag}$`, 'iu');
  const combinedScope = new RegExp(
    `^${scopePrefix}(?:${monthAnime}\\s*${exactTag}|${exactTag}\\s*${monthAnime})$`,
    'iu',
  );
  const resultIntro = /^(?:(?:本次|当前查询)?)(?:查询)?结果如下$/u;
  const omissionCountClause =
    /^(?:(?:工具)?文本|结果)?(?:另有|其余|省略|未展示|未显示|未展开|文本(?:中)?省略).{0,12}?(?:\d+(?:\.\d+)?|[零〇一二两三四五六七八九十百千万]+)\s*(?:部|条|项|个)(?:未展示|未显示|未展开|省略)?$/u;
  const resultCountClause =
    /^(?:(?:本次|当前|这次)(?:查询|检索|搜索)?\s*)?(?:(?:结果|查询结果|检索结果)\s*)?(?:返回|检索到|匹配到|找到|共计|合计|共(?:有|找到|检索到|返回)?|有)\s*(?:\d+(?:\.\d+)?|[零〇一二两三四五六七八九十百千万]+)\s*(?:部|条|项|个)?$/u;
  const boundedCoverageClause =
    /^(?:(?:本次|当前查询|当前检索|这次搜索)(?:查询|检索|搜索)?(?:仅)?(?:代表|属于|为|是)?(?:当前)?(?:有界|有限)(?:的)?(?:返回|结果|样本|范围)?|(?:属于|为|是)?当前(?:的)?有界结果)$/u;
  const experimentalSourceClause =
    /^(?:(?:官方(?:的)?|Bangumi(?:官方)?(?:的)?|当前)?(?:搜索|接口|来源)(?:来源)?(?:是|为|属于)?实验(?:性)?(?:搜索|接口|来源)|实验(?:性)?(?:搜索|接口|来源))$/iu;
  const estimatedTotalClause =
    /^(?:(?:总数|总量|数量)(?:是|为|属于)?(?:估算|估计)(?:值|数)?|(?:估算|估计)(?:的)?(?:总数|总量|数量))$/u;
  const nonExhaustiveClause =
    /^(?:(?:不代表|不能(?:据此)?(?:证明|确认|说明|推断)?|无法(?:据此)?(?:证明|确认|说明|推断)?|不足以(?:证明|确认|说明)?|不等于).{0,12}(?:全站|完整|全部|全量)(?:名单|列表|集合|结果)?|(?:全站|完整|全部|全量)(?:名单|列表|集合|结果)?.{0,12}(?:不代表|不能(?:据此)?(?:证明|确认|说明|推断)?|无法(?:据此)?(?:证明|确认|说明|推断)?|不足以(?:证明|确认|说明)?|不等于))$/u;
  const omissionNotAbsenceClause =
    /^(?:(?:未显示|未展开|省略|未展示).{0,12}(?:不代表|不能说明|并不意味着).{0,12}(?:不存在|没有)|(?:不代表|不能说明|并不意味着).{0,12}(?:未显示|未展开|省略|未展示).{0,12}(?:不存在|没有))$/u;
  const supportedPatterns = [
    dateScope,
    combinedScope,
    exactTagScope,
    resultIntro,
    omissionCountClause,
    resultCountClause,
    boundedCoverageClause,
    experimentalSourceClause,
    estimatedTotalClause,
    nonExhaustiveClause,
    omissionNotAbsenceClause,
  ];
  if (supportedPatterns.some((pattern) => pattern.test(clause))) return true;
  return false;
}

function parseCount(value) {
  if (typeof value !== 'string') return null;
  if (/^\d+$/u.test(value)) return Number(value);
  if (!/^[零〇一二两三四五六七八九十百千万]+$/u.test(value)) return null;
  return parseChineseCount(value);
}

function parseChineseCount(value) {
  const digitValues = new Map([
    ['零', 0],
    ['〇', 0],
    ['一', 1],
    ['二', 2],
    ['两', 2],
    ['三', 3],
    ['四', 4],
    ['五', 5],
    ['六', 6],
    ['七', 7],
    ['八', 8],
    ['九', 9],
  ]);
  const unitValues = new Map([
    ['十', 10],
    ['百', 100],
    ['千', 1000],
    ['万', 10000],
  ]);
  let total = 0;
  let section = 0;
  let digit = 0;
  for (const character of value) {
    if (digitValues.has(character)) {
      digit = digitValues.get(character);
      continue;
    }
    const unit = unitValues.get(character);
    if (unit === undefined) return null;
    if (unit === 10000) {
      section += digit;
      total += (section || 1) * unit;
      section = 0;
      digit = 0;
      continue;
    }
    section += (digit || (unit === 10 ? 1 : 0)) * unit;
    digit = 0;
  }
  return total + section + digit;
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
