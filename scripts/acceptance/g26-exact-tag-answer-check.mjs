import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const G26_EXACT_TAG_ANSWER_CHECK_METHOD = 'g26-exact-public-tag-query-v1';

const TOOL_NAME = 'bangumi.query_subjects';
const EXACT_ARGUMENT_KEYS = [
  'categories',
  'explain',
  'from',
  'limit',
  'media',
  'ratingCount',
  'resultMode',
  'tags',
  'to',
];
const SORTED_ARGUMENT_KEYS = [...EXACT_ARGUMENT_KEYS].sort();
const SCOPE_LINE = /^(?:范围|说明)[:：]/u;
const ROW_SEPARATOR = '｜';
const MARKDOWN_LINE = /^\s*(?:#{1,6}\s|[-*+]\s|>\s|```)/u;

export function verifyG26ExactTagAnswer(
  answer,
  queryArguments,
  toolOutput,
  toolCalls,
  toolTextUtf8Bytes,
) {
  const normalizedArguments = unwrapArguments(queryArguments);
  const eventArguments =
    Array.isArray(toolCalls) && toolCalls.length === 1
      ? unwrapArguments(toolCalls[0]?.arguments)
      : null;
  const { structuredResult, textResult } = findDiscoveryResults(toolOutput);
  const result = structuredResult ?? textResult;
  const sourceItems = Array.isArray(result?.items) ? result.items : [];
  const normalizedRows = sourceItems.map(normalizeSourceRow);
  const validRows = normalizedRows.filter((row) => row.valid);
  const duplicateSourceRowsCount = validRows.length - new Set(validRows.map((row) => row.id)).size;
  const answerText = typeof answer === 'string' ? answer : '';
  const parsedAnswer = parseAnswer(answerText);
  const scopeText = parsedAnswer.scopeLines.join('\n');
  const queryArgumentsMatch = exactQueryArguments(normalizedArguments);
  const eventArgumentsMatch = exactQueryArguments(eventArguments);
  const exactSingleToolCall =
    Array.isArray(toolCalls) &&
    toolCalls.length === 1 &&
    toolCalls[0]?.name === TOOL_NAME &&
    toolCalls[0]?.state === 'DONE' &&
    eventArgumentsMatch;
  const resultReadbackAvailable = result !== null;
  const structuredContentReadbackAvailable = structuredResult !== null;
  const textProjectionConsistent = checkTextProjection(textResult, structuredResult);
  const textRowsReadbackComplete = checkCompleteTextRows(textResult);
  const resultRowsReadbackAvailable =
    structuredContentReadbackAvailable || textRowsReadbackComplete;
  const textBudgetVerified =
    Number.isInteger(toolTextUtf8Bytes) && toolTextUtf8Bytes > 0 && toolTextUtf8Bytes <= 3600;
  const sourceScopeVerified = checkPlanScope(result?.plan);
  const coverageConsistent = checkCoverage(result, sourceItems.length);
  const experimentalSourceWarningPresent = hasWarning(result, 'EXPERIMENTAL_SOURCE');
  const answerRowMatches = compareAnswerRows(parsedAnswer.rows, validRows, textResult);
  const scopeChecks = validateScopeDisclosure(scopeText, result, textResult);
  const markdownFormattingDetected =
    answerText.split(/\r?\n/u).some((line) => MARKDOWN_LINE.test(line)) ||
    answerText.includes('**') ||
    answerText.includes('`');
  const rowsReadbackValid =
    parsedAnswer.rows.length > 0 &&
    (structuredContentReadbackAvailable
      ? answerRowMatches.fullRowsMatch
      : textRowsReadbackComplete && answerRowMatches.textRowsMatch) &&
    parsedAnswer.unstructuredAnswerLinesCount === 0 &&
    answerRowMatches.duplicateAnswerRowsCount === 0;
  const requiredOmissionDisclosurePresent =
    !answerRowMatches.usesOmittedTextRows || scopeChecks.textOmissionDisclosurePresent;
  const requiredClippingDisclosurePresent =
    !answerRowMatches.usesClippedTextRows || scopeChecks.titleClippingDisclosurePresent;
  const unsupportedCompletenessClaim = hasUnqualifiedCompletenessClaim(scopeText);
  const answerChecks = {
    queryArgumentsMatch,
    exactSingleToolCall,
    resultReadbackAvailable,
    resultRowsReadbackAvailable,
    textProjectionConsistent,
    textBudgetVerified,
    sourceScopeVerified,
    coverageConsistent,
    experimentalSourceWarningPresent,
    exactTagDisclosurePresent: scopeChecks.exactTagDisclosurePresent,
    demographicLimitDisclosurePresent: scopeChecks.demographicLimitDisclosurePresent,
    experimentalSearchDisclosurePresent: scopeChecks.experimentalSearchDisclosurePresent,
    estimatedTotalDisclosurePresent: scopeChecks.estimatedTotalDisclosurePresent,
    dateScopeDisclosurePresent: scopeChecks.dateScopeDisclosurePresent,
    ratingCountDisclosurePresent: scopeChecks.ratingCountDisclosurePresent,
    tvDisclosurePresent: scopeChecks.tvDisclosurePresent,
    boundedCoverageDisclosurePresent: scopeChecks.boundedCoverageDisclosurePresent,
    coverageCountsDisclosurePresent: scopeChecks.coverageCountsDisclosurePresent,
    partialStateDisclosurePresent: scopeChecks.partialStateDisclosurePresent,
    textOmissionDisclosurePresent: scopeChecks.textOmissionDisclosurePresent,
    titleClippingDisclosurePresent: scopeChecks.titleClippingDisclosurePresent,
    noUnsupportedCompletenessClaim: !unsupportedCompletenessClaim,
    noMarkdownFormatting: !markdownFormattingDetected,
  };

  const passed =
    answerText.trim().length > 0 &&
    queryArgumentsMatch &&
    exactSingleToolCall &&
    resultReadbackAvailable &&
    resultRowsReadbackAvailable &&
    textProjectionConsistent &&
    textBudgetVerified &&
    sourceScopeVerified &&
    coverageConsistent &&
    experimentalSourceWarningPresent &&
    validRows.length > 0 &&
    normalizedRows.length === validRows.length &&
    duplicateSourceRowsCount === 0 &&
    parsedAnswer.scopeLines.length === 1 &&
    parsedAnswer.unstructuredAnswerLinesCount === 0 &&
    rowsReadbackValid &&
    answerRowMatches.missingRowsCount === 0 &&
    answerRowMatches.mismatchedRowsCount === 0 &&
    answerRowMatches.unmatchedRowsCount === 0 &&
    requiredOmissionDisclosurePresent &&
    requiredClippingDisclosurePresent &&
    scopeChecks.exactTagDisclosurePresent &&
    scopeChecks.demographicLimitDisclosurePresent &&
    scopeChecks.experimentalSearchDisclosurePresent &&
    scopeChecks.estimatedTotalDisclosurePresent &&
    scopeChecks.dateScopeDisclosurePresent &&
    scopeChecks.ratingCountDisclosurePresent &&
    scopeChecks.tvDisclosurePresent &&
    scopeChecks.boundedCoverageDisclosurePresent &&
    scopeChecks.coverageCountsDisclosurePresent &&
    scopeChecks.partialStateDisclosurePresent &&
    answerChecks.noUnsupportedCompletenessClaim &&
    answerChecks.noMarkdownFormatting;

  answerChecks.passed = passed;
  const coverage = result?.coverage ?? {};
  const projection = textResult?.textProjection ?? {};
  const resultCounters = {
    resultState: typeof result?.state === 'string' ? result.state : 'unavailable',
    coverageState: typeof coverage.state === 'string' ? coverage.state : 'unknown',
    totalKind: typeof coverage.totalKind === 'string' ? coverage.totalKind : 'unknown',
    scanned: Number.isInteger(coverage.scanned) ? coverage.scanned : null,
    matched: Number.isInteger(coverage.matched) ? coverage.matched : null,
    returned: Number.isInteger(coverage.returned) ? coverage.returned : null,
    pagesRequested: Number.isInteger(coverage.pagesRequested) ? coverage.pagesRequested : null,
    pagesScanned: Number.isInteger(coverage.pagesScanned) ? coverage.pagesScanned : null,
    upstreamExhausted:
      typeof coverage.upstreamExhausted === 'boolean' ? coverage.upstreamExhausted : null,
    budgetExceeded: typeof coverage.budgetExceeded === 'boolean' ? coverage.budgetExceeded : null,
    hydrationsAttempted: Number.isInteger(coverage.hydrationsAttempted)
      ? coverage.hydrationsAttempted
      : null,
    hydrationsSucceeded: Number.isInteger(coverage.hydrationsSucceeded)
      ? coverage.hydrationsSucceeded
      : null,
    hydrationsFailed: Number.isInteger(coverage.hydrationsFailed)
      ? coverage.hydrationsFailed
      : null,
    hydrationsUnresolved: Number.isInteger(coverage.hydrationsUnresolved)
      ? coverage.hydrationsUnresolved
      : null,
    hydrationBudgetExceeded:
      typeof coverage.hydrationBudgetExceeded === 'boolean'
        ? coverage.hydrationBudgetExceeded
        : null,
    outputCap: Number.isInteger(coverage.outputCap) ? coverage.outputCap : null,
    visibleSourceRows: validRows.length,
    invalidSourceRowsCount: normalizedRows.length - validRows.length,
    duplicateSourceRowsCount,
    textRowsIncluded: Number.isInteger(projection.rowsIncluded)
      ? projection.rowsIncluded
      : (textResult?.items.length ?? null),
    textRowsOmitted: Number.isInteger(projection.rowsOmitted) ? projection.rowsOmitted : 0,
    displayNamesClipped: Number.isInteger(projection.displayNamesClipped)
      ? projection.displayNamesClipped
      : 0,
    textUtf8Bytes: Number.isInteger(toolTextUtf8Bytes) ? toolTextUtf8Bytes : null,
    answerRowsParsed: parsedAnswer.rows.length,
    rowsMatched: answerRowMatches.rowsMatched,
    missingRowsCount: answerRowMatches.missingRowsCount,
    mismatchedRowsCount: answerRowMatches.mismatchedRowsCount,
    unmatchedRowsCount: answerRowMatches.unmatchedRowsCount,
    duplicateAnswerRowsCount: answerRowMatches.duplicateAnswerRowsCount,
    unstructuredAnswerLinesCount: parsedAnswer.unstructuredAnswerLinesCount,
  };
  const warningCodes = Array.isArray(result?.warnings)
    ? [
        ...new Set(
          result.warnings.map((item) => item?.code).filter((code) => typeof code === 'string'),
        ),
      ]
    : [];

  return {
    method: G26_EXACT_TAG_ANSWER_CHECK_METHOD,
    queryArgumentsMatch,
    exactSingleToolCall,
    resultReadbackAvailable,
    resultRowsReadbackAvailable,
    structuredContentReadbackAvailable,
    textProjectionConsistent,
    textBudgetVerified,
    toolTextUtf8Bytes: Number.isInteger(toolTextUtf8Bytes) ? toolTextUtf8Bytes : null,
    sourceScopeVerified,
    coverageConsistent,
    experimentalSourceWarningPresent,
    visibleSourceRows: validRows.length,
    invalidSourceRowsCount: normalizedRows.length - validRows.length,
    duplicateSourceRowsCount,
    answerRowsParsed: parsedAnswer.rows.length,
    answerRowsMatched: answerRowMatches.rowsMatched,
    missingRowsCount: answerRowMatches.missingRowsCount,
    mismatchedRowsCount: answerRowMatches.mismatchedRowsCount,
    unmatchedRowsCount: answerRowMatches.unmatchedRowsCount,
    duplicateAnswerRowsCount: answerRowMatches.duplicateAnswerRowsCount,
    unstructuredAnswerLinesCount: parsedAnswer.unstructuredAnswerLinesCount,
    answerUsesTextProjectionRows: answerRowMatches.textRowsMatch,
    answerUsesFullStructuredRows: answerRowMatches.fullRowsMatch,
    ...scopeChecks,
    unsupportedCompletenessClaim,
    markdownFormattingDetected,
    answerChecks,
    resultCounters,
    warningCodes,
    passed,
  };
}

function exactQueryArguments(value) {
  const args = unwrapArguments(value);
  if (!args || typeof args !== 'object' || Array.isArray(args)) return false;
  const keys = Object.keys(args).sort();
  if (keys.length !== EXACT_ARGUMENT_KEYS.length) return false;
  if (keys.some((key, index) => key !== SORTED_ARGUMENT_KEYS[index])) return false;
  return (
    args.media === 'anime' &&
    args.from === '2019-01-01' &&
    args.to === '2025-01-01' &&
    exactObject(args.ratingCount, { min: 10001 }) &&
    exactStringArray(args.tags, ['女性向']) &&
    args.categories === 'tv' &&
    args.resultMode === 'all' &&
    args.limit === 100 &&
    args.explain === 'full'
  );
}

function exactObject(value, expected) {
  return (
    Boolean(value) &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length === Object.keys(expected).length &&
    Object.entries(expected).every(([key, item]) => value[key] === item)
  );
}

function exactStringArray(value, expected) {
  return (
    Array.isArray(value) &&
    value.length === expected.length &&
    value.every((item, index) => item === expected[index])
  );
}

function checkPlanScope(plan) {
  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) return false;
  if (
    plan.source !== 'official_v0' ||
    plan.operation !== 'searchSubjects' ||
    plan.totalKind !== 'estimated'
  ) {
    return false;
  }
  const request = firstSearchRequest(plan);
  const filter = request?.filter;
  const expectedFilterKeys = ['airDate', 'ratingCount', 'tag', 'type'];
  const budget = plan.budget;
  const postFilters = Array.isArray(plan.postFilters) ? plan.postFilters : [];
  const tvFilter = postFilters.find((item) => item?.field === 'categories');
  return (
    Boolean(request) &&
    request.limit === 50 &&
    plan.resultMode === 'all' &&
    Object.keys(filter ?? {})
      .sort()
      .join('\u0000') === expectedFilterKeys.join('\u0000') &&
    Array.isArray(filter?.type) &&
    filter.type.length === 1 &&
    filter.type[0] === 2 &&
    exactStringArray(filter?.airDate, ['>=2019-01-01', '<2025-01-01']) &&
    exactStringArray(filter?.ratingCount, ['>=10001']) &&
    exactStringArray(filter?.tag, ['女性向']) &&
    filter.metaTags === undefined &&
    budget?.maxPages === 10 &&
    budget?.maxCandidates === 500 &&
    budget?.maxHydrations === 120 &&
    budget?.maxReturnedItems === 100 &&
    tvFilter?.classification === 'POST_FILTER' &&
    (tvFilter.value === 'tv' || exactStringArray(tvFilter.value, ['tv']))
  );
}

function firstSearchRequest(plan) {
  if (!Array.isArray(plan?.steps)) return undefined;
  const step = plan.steps.find((item) => item?.kind === 'search');
  return step && typeof step.request === 'object' && step.request !== null
    ? step.request
    : undefined;
}

function checkCoverage(result, sourceItemCount) {
  const coverage = result?.coverage;
  const plan = result?.plan;
  if (!coverage || typeof coverage !== 'object' || !plan) return false;
  return (
    ['ok', 'partial'].includes(result.state) &&
    ['complete', 'partial', 'unknown'].includes(coverage.state) &&
    Number.isInteger(coverage.scanned) &&
    Number.isInteger(coverage.matched) &&
    Number.isInteger(coverage.returned) &&
    Number.isInteger(coverage.pagesScanned) &&
    Number.isInteger(coverage.pagesRequested) &&
    Number.isInteger(coverage.hydrationsAttempted) &&
    Number.isInteger(coverage.hydrationsUnresolved) &&
    coverage.returned === sourceItemCount &&
    coverage.scanned >= 0 &&
    coverage.scanned <= 500 &&
    coverage.scanned >= sourceItemCount &&
    coverage.matched >= sourceItemCount &&
    coverage.pagesScanned >= 0 &&
    coverage.pagesScanned <= 10 &&
    coverage.pagesRequested >= 0 &&
    coverage.pagesScanned <= coverage.pagesRequested &&
    coverage.pagesRequested <= 10 &&
    coverage.hydrationsAttempted >= 0 &&
    coverage.hydrationsAttempted <= 120 &&
    coverage.hydrationsSucceeded <= coverage.hydrationsAttempted &&
    coverage.hydrationsFailed <= coverage.hydrationsAttempted &&
    coverage.hydrationsUnresolved <= coverage.hydrationsAttempted &&
    coverage.returned >= 0 &&
    coverage.returned <= 100 &&
    sourceItemCount <= 100 &&
    coverage.totalKind === 'estimated' &&
    plan.totalKind === 'estimated'
  );
}

function hasWarning(result, code) {
  return (
    Array.isArray(result?.warnings) && result.warnings.some((warning) => warning?.code === code)
  );
}

function validateScopeDisclosure(scope, result, textResult) {
  const coverage = result?.coverage ?? {};
  const projection = textResult?.textProjection ?? {};
  const omitted = Number.isInteger(projection.rowsOmitted) ? projection.rowsOmitted : 0;
  const clippedNames = Number.isInteger(projection.displayNamesClipped)
    ? projection.displayNamesClipped
    : 0;
  const exactTagDisclosurePresent =
    /(?:精确|exact)/iu.test(scope) && /(?:tag|标签)/iu.test(scope) && scope.includes('女性向');
  const demographicLimitDisclosurePresent =
    /(?:不代表|不等于|并非|不是|无法证明|不能据此)/u.test(scope) &&
    /(?:完整|全部|全量)/u.test(scope) &&
    /(?:女性向|女性受众)/u.test(scope);
  const experimentalSearchDisclosurePresent =
    /实验性|experimental/iu.test(scope) && /搜索|search|api/iu.test(scope);
  const estimatedTotalDisclosurePresent =
    /估算|估计|estimated/iu.test(scope) && /总数|total/iu.test(scope);
  const dateScopeDisclosurePresent =
    scope.includes('2019') && scope.includes('2025') && /不含|之前|exclusive/iu.test(scope);
  const ratingCountDisclosurePresent = scope.includes('10001') || /超过\s*1\s*万/u.test(scope);
  const tvDisclosurePresent = /\bTV\b|电视/iu.test(scope);
  const boundedCoverageDisclosurePresent =
    /本次|当前/u.test(scope) && /有界|有限|覆盖|范围|扫描|观察/u.test(scope);
  const coverageCountsDisclosurePresent =
    hasMetric(scope, /(?:扫描|检索|scanned)/iu, coverage.scanned) &&
    hasMetric(scope, /(?:匹配|符合|matched)/iu, coverage.matched) &&
    hasMetric(scope, /(?:返回|returned)/iu, coverage.returned);
  const budgetOrUnresolved =
    coverage.budgetExceeded === true ||
    coverage.hydrationBudgetExceeded === true ||
    (Number.isInteger(coverage.hydrationsUnresolved) && coverage.hydrationsUnresolved > 0) ||
    (Number.isInteger(coverage.matched) &&
      Number.isInteger(coverage.returned) &&
      coverage.matched > coverage.returned);
  const partialRequired =
    result?.state === 'partial' || coverage.state === 'partial' || budgetOrUnresolved;
  const partialStateDisclosurePresent =
    !partialRequired || /部分|有限|受限|截断|预算|未判定|无法判定/u.test(scope);
  const textOmissionDisclosurePresent =
    omitted === 0 ||
    (hasMetric(scope, /(?:省略|未显示|未列出|omitted)/iu, omitted) &&
      /(?:不代表|不等于|不是|无法据此|不能据此)/u.test(scope));
  const titleClippingDisclosurePresent = clippedNames === 0 || /截断|缩略|显示不全/u.test(scope);
  return {
    exactTagDisclosurePresent,
    demographicLimitDisclosurePresent,
    experimentalSearchDisclosurePresent,
    estimatedTotalDisclosurePresent,
    dateScopeDisclosurePresent,
    ratingCountDisclosurePresent,
    tvDisclosurePresent,
    boundedCoverageDisclosurePresent,
    coverageCountsDisclosurePresent,
    partialStateDisclosurePresent,
    textOmissionDisclosurePresent,
    titleClippingDisclosurePresent,
    rowsOmitted: omitted,
    displayNamesClipped: clippedNames,
  };
}

function hasMetric(text, labelPattern, value) {
  if (!Number.isInteger(value)) return false;
  const escaped = String(value).replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
  return new RegExp(
    `${labelPattern.source}\\s*[:：=]?\\s*${escaped}(?!\\d)`,
    labelPattern.flags,
  ).test(text);
}

function compareAnswerRows(answerRows, sourceRows, textResult) {
  const duplicateAnswerRowsCount =
    answerRows.length - new Set(answerRows.map((row) => row.id)).size;
  const fullMatch = matchRows(answerRows, sourceRows);
  const projection = textResult?.textProjection;
  const textRows = Array.isArray(textResult?.items)
    ? textResult.items.map(normalizeSourceRow).filter((row) => row.valid)
    : [];
  const textMatch = matchRows(answerRows, textRows);
  const rowsMatched =
    fullMatch.rowsMatched > textMatch.rowsMatched ? fullMatch.rowsMatched : textMatch.rowsMatched;
  const chosen = fullMatch.matchesAll
    ? fullMatch
    : projection && textMatch.matchesAll
      ? textMatch
      : fullMatch;
  return {
    rowsMatched,
    missingRowsCount: chosen.missingRowsCount,
    mismatchedRowsCount: chosen.mismatchedRowsCount,
    unmatchedRowsCount: chosen.unmatchedRowsCount,
    duplicateAnswerRowsCount,
    fullRowsMatch: fullMatch.matchesAll,
    textRowsMatch: textResult !== null && textMatch.matchesAll,
    usesOmittedTextRows:
      Boolean(projection) &&
      textMatch.matchesAll &&
      Number.isInteger(projection.rowsOmitted) &&
      projection.rowsOmitted > 0,
    usesClippedTextRows:
      Boolean(projection) &&
      textMatch.matchesAll &&
      Number.isInteger(projection.displayNamesClipped) &&
      projection.displayNamesClipped > 0,
  };
}

function matchRows(answerRows, sourceRows) {
  let rowsMatched = 0;
  let mismatchedRowsCount = 0;
  let unmatchedRowsCount = 0;
  for (const answerRow of answerRows) {
    const source = sourceRows.find((row) => row.id === answerRow.id);
    if (!source) {
      unmatchedRowsCount += 1;
      continue;
    }
    if (
      !source.names.some((name) => sameOrProjectedText(name, answerRow.name)) ||
      source.date !== answerRow.date ||
      source.ratingCount !== answerRow.ratingCount
    ) {
      mismatchedRowsCount += 1;
      continue;
    }
    rowsMatched += 1;
  }
  const missingRowsCount = sourceRows.filter(
    (source) => !answerRows.some((row) => row.id === source.id),
  ).length;
  return {
    rowsMatched,
    missingRowsCount,
    mismatchedRowsCount,
    unmatchedRowsCount,
    matchesAll:
      sourceRows.length > 0 &&
      answerRows.length === sourceRows.length &&
      rowsMatched === sourceRows.length &&
      missingRowsCount === 0 &&
      mismatchedRowsCount === 0 &&
      unmatchedRowsCount === 0,
  };
}

function checkTextProjection(textResult, structuredResult) {
  if (!textResult) return false;
  const projection = textResult.textProjection;
  if (!projection) {
    if (
      !Array.isArray(textResult.items) ||
      textResult.coverage?.returned !== textResult.items.length ||
      (structuredResult && textResult.items.length !== structuredResult.items.length)
    ) {
      return false;
    }
    return !structuredResult || sameJsonValue(textResult, structuredResult);
  }
  if (
    typeof projection.fullStructuredContentAvailable !== 'boolean' ||
    projection.rowsIncluded !== textResult.items.length ||
    !Number.isInteger(projection.rowsOmitted) ||
    projection.rowsOmitted < 0
  ) {
    return false;
  }
  if (!structuredResult) {
    return (
      projection.rowsOmitted === 0 && textResult.coverage?.returned === textResult.items.length
    );
  }
  if (projection.fullStructuredContentAvailable !== true) return false;
  if (projection.rowsOmitted !== structuredResult.items.length - textResult.items.length)
    return false;
  const sourceById = new Map(structuredResult.items.map((item) => [item.id, item]));
  return textResult.items.every((item) => {
    const source = sourceById.get(item.id);
    return (
      Boolean(source) &&
      ['name', 'nameCn', 'displayName'].every(
        (key) => item[key] === undefined || sameOrProjectedText(source[key], item[key]),
      ) &&
      (item.media === undefined || item.media === source.media) &&
      (item.category === undefined || item.category === source.category) &&
      (item.date === undefined || item.date === source.date) &&
      (item.ratingCount === undefined || item.ratingCount === source.ratingCount) &&
      ['tags', 'metaTags'].every(
        (key) =>
          !Array.isArray(item[key]) ||
          (Array.isArray(source[key]) && item[key].every((tag) => source[key].includes(tag))),
      )
    );
  });
}

function sameJsonValue(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function canonicalJson(value) {
  if (value === undefined) return 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .filter((key) => value[key] !== undefined)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function normalizeSourceRow(item) {
  const names = [
    ...new Set(
      [item?.displayName, item?.nameCn, item?.name].filter(
        (name) => typeof name === 'string' && name.trim().length > 0,
      ),
    ),
  ];
  const valid =
    item &&
    Number.isSafeInteger(item.id) &&
    names.length > 0 &&
    item.media === 'anime' &&
    item.category === 'tv' &&
    typeof item.date === 'string' &&
    item.date >= '2019-01-01' &&
    item.date < '2025-01-01' &&
    Number.isInteger(item.ratingCount) &&
    item.ratingCount >= 10001 &&
    Array.isArray(item.tags) &&
    item.tags.includes('女性向');
  return valid
    ? {
        valid: true,
        id: item.id,
        names,
        date: item.date,
        ratingCount: item.ratingCount,
      }
    : { valid: false };
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
    const idMatch = /^(\d+)$/u.exec(columns[0]);
    const count = Number(columns[3].replaceAll(',', ''));
    if (!idMatch || !Number.isSafeInteger(count)) {
      unstructuredAnswerLinesCount += 1;
      continue;
    }
    rows.push({ id: Number(idMatch[1]), name: columns[1], date: columns[2], ratingCount: count });
  }
  return { rows, scopeLines, unstructuredAnswerLinesCount };
}

function sameOrProjectedText(source, projected) {
  if (typeof source !== 'string' || typeof projected !== 'string') return false;
  if (source === projected) return true;
  return (
    typeof projected === 'string' &&
    projected.endsWith('…') &&
    source.startsWith(projected.slice(0, -1))
  );
}

function hasUnqualifiedCompletenessClaim(scope) {
  const claims = [
    /(?:完整|全部|全量|全体|所有)(?:的)?(?:女性向|女性受众|女性观众)?(?:作品|动画|番剧|清单|名单|目录|列表|结果集?|分类体系|分类|标签体系|类型体系|受众定义)/gu,
    /(?:女性向|女性受众|女性观众)(?:作品|动画|番剧|标签|分类)?(?:的)?(?:完整|全部|全量|全体)(?:女性向|女性受众)?(?:作品|动画|番剧|清单|名单|目录|列表|结果集?|分类体系|分类|标签体系|类型体系|受众定义)?/gu,
    /(?:女性向|女性受众|女性观众)(?:作品|动画|番剧)?(?:的)?(?:分类体系|分类|标签体系|类型体系|定义)(?:是|为|已经|已)?(?:完整|全部|全量|全体)/gu,
    /(?:complete|comprehensive|exhaustive|full)\s+(?:(?:female[- ]audience|women[- ]oriented|female-oriented)\s+)?(?:taxonomy|classification(?:\s+system)?|list|catalog|directory|set|results|works|anime)\b/giu,
    /(?:female[- ]audience|women[- ]oriented|female-oriented)\s+(?:taxonomy|classification(?:\s+system)?)(?:\s+(?:is|are))?\s+(?:complete|comprehensive|exhaustive|full)\b/giu,
    /(?:all|every|entire)\s+(?:(?:female[- ]audience|women[- ]oriented|female-oriented)\s+)?(?:taxonomy|classification(?:\s+system)?|list|catalog|directory|results|works|anime)\b/giu,
  ];
  const clauses = scope.split(
    /[。！？；;，,、：:—–\n]+|并且|而且|同时|此外|另外|以及|且|但|而是|然而|不过|只是|可是|所以|因此|\b(?:and|also|but|however|yet|whereas|while)\b/iu,
  );
  const negation =
    /(?:不代表|不等于|并非|不是|无法证明|无法确认|不能据此|不构成|不定义|does not(?!\s+(?:only|merely|just|simply))(?:\s+(?:mean|prove|represent|establish|define))?|is not(?!\s+(?:only|merely|just|simply))\b|not(?!\s+(?:only|merely|just|simply))\b|cannot(?:\s+(?:prove|define))?)/iu;
  for (const clause of clauses) {
    const claimSpans = [];
    for (const claim of claims) {
      const matcher = new RegExp(claim.source, claim.flags);
      let match;
      while ((match = matcher.exec(clause)) !== null) {
        claimSpans.push({ start: match.index, end: match.index + match[0].length });
        if (match[0].length === 0) matcher.lastIndex += 1;
      }
    }
    claimSpans.sort((left, right) => left.start - right.start || right.end - left.end);
    const claimsInClause = [];
    for (const span of claimSpans) {
      const previous = claimsInClause.at(-1);
      if (previous && span.start <= previous.end) previous.end = Math.max(previous.end, span.end);
      else claimsInClause.push({ ...span });
    }
    const negations = [...clause.matchAll(new RegExp(negation.source, 'giu'))];
    let consumedThrough = 0;
    for (const claim of claimsInClause) {
      const inScope = negations.filter(
        (match) =>
          match.index !== undefined && match.index >= consumedThrough && match.index < claim.start,
      );
      if (inScope.length === 0) return true;
      const lastNegation = inScope.at(-1);
      consumedThrough = lastNegation.index + lastNegation[0].length;
    }
  }
  return false;
}

function checkCompleteTextRows(textResult) {
  if (!textResult || !Array.isArray(textResult.items)) return false;
  const projection = textResult.textProjection;
  if (projection === undefined) {
    return (
      Number.isInteger(textResult.coverage?.returned) &&
      textResult.coverage.returned === textResult.items.length
    );
  }
  return (
    Number.isInteger(projection.rowsIncluded) &&
    projection.rowsIncluded === textResult.items.length &&
    projection.rowsOmitted === 0 &&
    textResult.coverage?.returned === textResult.items.length
  );
}

function findDiscoveryResults(value) {
  const pending = [{ value, key: undefined, depth: 0 }];
  const visited = new Set();
  let structuredResult = null;
  let textResult = null;
  let visitedCount = 0;
  while (pending.length > 0 && visitedCount < 4000) {
    const current = pending.pop();
    visitedCount += 1;
    const candidate = parseJson(current.value);
    if (current.depth > 12 || !candidate || typeof candidate !== 'object') continue;
    if (visited.has(candidate)) continue;
    visited.add(candidate);
    if (Array.isArray(candidate)) {
      for (const item of candidate.slice(0, 200)) {
        pending.push({ value: item, key: undefined, depth: current.depth + 1 });
      }
      continue;
    }
    if (isDiscoveryResult(candidate)) {
      if (current.key === 'structuredContent') structuredResult = candidate;
      else if (!textResult || candidate.textProjection) textResult = candidate;
    }
    for (const key of [
      'structuredContent',
      'content',
      'text',
      'data',
      'result',
      'output',
      'toolOutput',
    ]) {
      if (key in candidate) {
        pending.push({ value: candidate[key], key, depth: current.depth + 1 });
      }
    }
  }
  return { structuredResult, textResult };
}

function isDiscoveryResult(value) {
  return (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    ['ok', 'partial'].includes(value.state) &&
    Array.isArray(value.items) &&
    Number.isInteger(value.coverage?.returned) &&
    value.plan?.source === 'official_v0' &&
    typeof value.plan?.operation === 'string'
  );
}

function unwrapArguments(value) {
  let parsed = parseJson(value);
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    if ('Arguments' in parsed) parsed = parseJson(parsed.Arguments);
    else if ('arguments' in parsed) parsed = parseJson(parsed.arguments);
  }
  return parsed;
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
  const check = verifyG26ExactTagAnswer(
    input.answer,
    input.queryArguments,
    input.toolOutput,
    input.toolCalls,
    input.toolTextUtf8Bytes,
  );
  process.stdout.write(JSON.stringify(check));
}
