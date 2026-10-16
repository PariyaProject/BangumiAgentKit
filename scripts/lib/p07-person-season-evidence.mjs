export const P07_PROFILE_ID = 'p07-person-season-distribution-agent-mcp-v1';
export const P07_TOOL_NAME = 'bangumi.get_person_activity';
export const P07_ARGUMENT_PROFILE = 'fixed-p07-person-3474-staff-anime-36m-48r-16d-8rows-v1';
export const P07_EXPECTED_ARGUMENTS = Object.freeze({
  personId: 3474,
  kind: 'staff',
  media: 'anime',
  windowMonths: 36,
  maxRelations: 48,
  maxSubjectDetails: 16,
  maxRows: 8,
});
export const P07_ANSWER_CHECK_METHOD = 'p07-calendar-quarter-sample-v1';
export const P07_CANONICAL_CAVEAT =
  '仅描述本次返回的有限 anime staff 活动样本；分组依据官方 firstAirDate 的日历季度。人物关系源没有分页或完整性承诺，日期可能是播出或发售日期；这不代表完整职业生涯，也不包含作品标签分布。';

const ANSWER_KEYS = Object.freeze([
  'personId',
  'kind',
  'media',
  'state',
  'window',
  'datedRowsObserved',
  'quarterDistribution',
  'mostObservedQuarters',
  'maxQuarterCount',
  'coverage',
  'caveat',
]);
const WINDOW_KEYS = Object.freeze(['months', 'start', 'end', 'asOfSemantics']);
const COVERAGE_KEYS = Object.freeze([
  'relationRowsObserved',
  'relationRowsSelected',
  'relationRowsDroppedAtLimit',
  'sampled',
  'subjectDetailRequests',
  'subjectDetailsSucceeded',
  'subjectDetailsFailed',
  'subjectDetailIdsDroppedAtLimit',
  'rowsEligible',
  'rowsReturned',
  'missingDateRows',
  'invalidDateRows',
  'outputTruncated',
  'truncated',
  'retrievedAt',
]);

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function hasExactKeys(value, expected) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    canonicalJson(Object.keys(value).sort()) === canonicalJson([...expected].sort()),
  );
}

function nonnegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function coverageRequiresPartialState(coverage) {
  return (
    coverage.sampled ||
    coverage.truncated ||
    coverage.outputTruncated ||
    coverage.relationRowsDroppedAtLimit > 0 ||
    coverage.subjectDetailIdsDroppedAtLimit > 0 ||
    coverage.subjectDetailsFailed > 0 ||
    coverage.missingDateRows > 0 ||
    coverage.invalidDateRows > 0
  );
}

function validDateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function calendarQuarter(date) {
  const month = Number(date.slice(5, 7));
  return `${date.slice(0, 4)}-Q${Math.floor((month - 1) / 3) + 1}`;
}

function calendarWindowStart(end, months) {
  const year = Number(end.slice(0, 4));
  const monthIndex = year * 12 + Number(end.slice(5, 7)) - 1 - (months - 1);
  const startYear = Math.floor(monthIndex / 12);
  const startMonth = monthIndex - startYear * 12 + 1;
  return `${startYear}-${String(startMonth).padStart(2, '0')}-01`;
}

function summarizeCoverage(coverage, rowsReturned) {
  if (!coverage || typeof coverage !== 'object' || Array.isArray(coverage)) return null;
  const value = {
    relationRowsObserved: coverage.relationRowsObserved,
    relationRowsSelected: coverage.relationRowsSelected,
    relationRowsDroppedAtLimit: coverage.relationRowsDroppedAtLimit,
    sampled: coverage.sampled,
    subjectDetailRequests: coverage.subjectDetailRequests,
    subjectDetailsSucceeded: coverage.subjectDetailsSucceeded,
    subjectDetailsFailed: coverage.subjectDetailsFailed,
    subjectDetailIdsDroppedAtLimit: coverage.subjectDetailIdsDroppedAtLimit,
    rowsEligible: coverage.rowsEligible,
    rowsReturned: coverage.rowsReturned,
    missingDateRows: coverage.missingDateRows,
    invalidDateRows: coverage.invalidDateRows,
    outputTruncated: coverage.outputTruncated,
    truncated: coverage.truncated,
    retrievedAt: coverage.retrievedAt,
  };
  if (
    !COVERAGE_KEYS.every((key) => Object.hasOwn(value, key)) ||
    !Object.values(value).length ||
    ![
      value.relationRowsObserved,
      value.relationRowsSelected,
      value.relationRowsDroppedAtLimit,
      value.subjectDetailRequests,
      value.subjectDetailsSucceeded,
      value.subjectDetailsFailed,
      value.subjectDetailIdsDroppedAtLimit,
      value.rowsEligible,
      value.rowsReturned,
      value.missingDateRows,
      value.invalidDateRows,
    ].every(nonnegativeInteger) ||
    typeof value.sampled !== 'boolean' ||
    typeof value.outputTruncated !== 'boolean' ||
    typeof value.truncated !== 'boolean' ||
    value.rowsReturned !== rowsReturned ||
    value.relationRowsObserved !== value.relationRowsSelected + value.relationRowsDroppedAtLimit ||
    value.subjectDetailsSucceeded + value.subjectDetailsFailed !== value.subjectDetailRequests ||
    value.sampled !==
      (value.relationRowsDroppedAtLimit > 0 || value.subjectDetailIdsDroppedAtLimit > 0) ||
    value.rowsEligible < value.rowsReturned ||
    value.outputTruncated !== value.rowsEligible > value.rowsReturned ||
    value.truncated !==
      (value.relationRowsDroppedAtLimit > 0 ||
        value.subjectDetailIdsDroppedAtLimit > 0 ||
        value.outputTruncated) ||
    value.relationRowsSelected > P07_EXPECTED_ARGUMENTS.maxRelations ||
    value.subjectDetailRequests > P07_EXPECTED_ARGUMENTS.maxSubjectDetails ||
    value.rowsReturned > P07_EXPECTED_ARGUMENTS.maxRows ||
    typeof value.retrievedAt !== 'string' ||
    Number.isNaN(Date.parse(value.retrievedAt))
  ) {
    return null;
  }
  return value;
}

export function summarizeP07PersonActivityToolResult(
  result,
  expectedArguments = P07_EXPECTED_ARGUMENTS,
) {
  if (
    canonicalJson(expectedArguments) !== canonicalJson(P07_EXPECTED_ARGUMENTS) ||
    !result ||
    typeof result !== 'object' ||
    Array.isArray(result) ||
    result.personId !== P07_EXPECTED_ARGUMENTS.personId ||
    result.kind !== P07_EXPECTED_ARGUMENTS.kind ||
    result.media !== P07_EXPECTED_ARGUMENTS.media ||
    !['complete', 'partial'].includes(result.state) ||
    !Array.isArray(result.rows)
  ) {
    return null;
  }
  const window = result.window;
  if (
    !window ||
    window.months !== P07_EXPECTED_ARGUMENTS.windowMonths ||
    !validDateOnly(window.start) ||
    !validDateOnly(window.end) ||
    window.start > window.end ||
    window.start !== calendarWindowStart(window.end, window.months) ||
    window.asOfSemantics !== 'calendar_months_ending_on_as_of_date'
  ) {
    return null;
  }

  const counts = new Map();
  let datedRowsObserved = 0;
  for (const row of result.rows) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
    if (
      !validDateOnly(row.firstAirDate) ||
      row.firstAirDate < window.start ||
      row.firstAirDate > window.end
    ) {
      return null;
    }
    datedRowsObserved += 1;
    const quarter = calendarQuarter(row.firstAirDate);
    counts.set(quarter, (counts.get(quarter) ?? 0) + 1);
  }
  const quarterDistribution = [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([quarter, count]) => ({ quarter, count }));
  const maxQuarterCount = Math.max(0, ...quarterDistribution.map((item) => item.count));
  const mostObservedQuarters = quarterDistribution
    .filter((item) => item.count === maxQuarterCount && maxQuarterCount > 0)
    .map((item) => item.quarter);
  const coverage = summarizeCoverage(result.coverage, result.rows.length);
  if (
    !coverage ||
    (result.state === 'complete' && coverageRequiresPartialState(coverage)) ||
    datedRowsObserved !== result.rows.length ||
    datedRowsObserved === 0 ||
    quarterDistribution.length === 0
  ) {
    return null;
  }

  return {
    personId: P07_EXPECTED_ARGUMENTS.personId,
    kind: P07_EXPECTED_ARGUMENTS.kind,
    media: P07_EXPECTED_ARGUMENTS.media,
    state: result.state,
    window: {
      months: window.months,
      start: window.start,
      end: window.end,
      asOfSemantics: window.asOfSemantics,
    },
    datedRowsObserved,
    quarterDistribution,
    mostObservedQuarters,
    maxQuarterCount,
    coverage,
    caveat: P07_CANONICAL_CAVEAT,
  };
}

export function validateP07PersonSeasonSummary(summary) {
  const summaryKeys = [...ANSWER_KEYS];
  const checkedCoverage = summarizeCoverage(summary?.coverage, summary?.coverage?.rowsReturned);
  if (
    !hasExactKeys(summary, summaryKeys) ||
    summary.personId !== P07_EXPECTED_ARGUMENTS.personId ||
    summary.kind !== P07_EXPECTED_ARGUMENTS.kind ||
    summary.media !== P07_EXPECTED_ARGUMENTS.media ||
    !['complete', 'partial'].includes(summary.state) ||
    !hasExactKeys(summary.window, WINDOW_KEYS) ||
    summary.window.months !== P07_EXPECTED_ARGUMENTS.windowMonths ||
    !validDateOnly(summary.window.start) ||
    !validDateOnly(summary.window.end) ||
    summary.window.start > summary.window.end ||
    summary.window.start !== calendarWindowStart(summary.window.end, summary.window.months) ||
    summary.window.asOfSemantics !== 'calendar_months_ending_on_as_of_date' ||
    !nonnegativeInteger(summary.datedRowsObserved) ||
    summary.datedRowsObserved === 0 ||
    !Array.isArray(summary.quarterDistribution) ||
    summary.quarterDistribution.length === 0 ||
    !Array.isArray(summary.mostObservedQuarters) ||
    !nonnegativeInteger(summary.maxQuarterCount) ||
    summary.maxQuarterCount === 0 ||
    !hasExactKeys(summary.coverage, COVERAGE_KEYS) ||
    !checkedCoverage ||
    (summary.state === 'complete' && coverageRequiresPartialState(checkedCoverage)) ||
    canonicalJson(summary.coverage) !== canonicalJson(checkedCoverage) ||
    summary.coverage.rowsReturned !== summary.datedRowsObserved ||
    summary.caveat !== P07_CANONICAL_CAVEAT
  ) {
    return false;
  }
  let total = 0;
  let previousQuarter = '';
  const counts = [];
  for (const item of summary.quarterDistribution) {
    if (
      !hasExactKeys(item, ['quarter', 'count']) ||
      typeof item.quarter !== 'string' ||
      !/^\d{4}-Q[1-4]$/u.test(item.quarter) ||
      item.quarter <= previousQuarter ||
      !Number.isSafeInteger(item.count) ||
      item.count <= 0
    ) {
      return false;
    }
    previousQuarter = item.quarter;
    total += item.count;
    counts.push(item.count);
  }
  const maxCount = Math.max(...counts);
  const topQuarters = summary.quarterDistribution
    .filter((item) => item.count === maxCount)
    .map((item) => item.quarter);
  return (
    total === summary.datedRowsObserved &&
    maxCount === summary.maxQuarterCount &&
    canonicalJson(topQuarters) === canonicalJson(summary.mostObservedQuarters)
  );
}

export function verifyP07PersonSeasonAnswer(answer, resultSummary) {
  let parsed = answer;
  if (typeof answer === 'string') {
    try {
      parsed = JSON.parse(answer);
    } catch {
      parsed = null;
    }
  }
  const validJsonShape = hasExactKeys(parsed, ANSWER_KEYS);
  const resultSummaryValid = validateP07PersonSeasonSummary(resultSummary);
  const answerWindowValid = hasExactKeys(parsed?.window, WINDOW_KEYS);
  const answerCoverageValid = hasExactKeys(parsed?.coverage, COVERAGE_KEYS);
  const answerChecks = {
    validJsonShape,
    validSourceSummary: resultSummaryValid,
    exactFixedProfile:
      validJsonShape &&
      parsed.personId === P07_EXPECTED_ARGUMENTS.personId &&
      parsed.kind === P07_EXPECTED_ARGUMENTS.kind &&
      parsed.media === P07_EXPECTED_ARGUMENTS.media,
    exactWindow:
      validJsonShape &&
      answerWindowValid &&
      resultSummaryValid &&
      canonicalJson(parsed.window) === canonicalJson(resultSummary?.window),
    exactReturnedState: validJsonShape && parsed.state === resultSummary?.state,
    exactQuarterDistribution:
      validJsonShape &&
      resultSummaryValid &&
      canonicalJson(parsed.quarterDistribution) ===
        canonicalJson(resultSummary?.quarterDistribution) &&
      parsed.datedRowsObserved === resultSummary?.datedRowsObserved &&
      canonicalJson(parsed.mostObservedQuarters) ===
        canonicalJson(resultSummary?.mostObservedQuarters) &&
      parsed.maxQuarterCount === resultSummary?.maxQuarterCount,
    exactCoverage:
      validJsonShape &&
      answerCoverageValid &&
      resultSummaryValid &&
      canonicalJson(parsed.coverage) === canonicalJson(resultSummary?.coverage),
    boundedSampleCaveat: validJsonShape && parsed.caveat === P07_CANONICAL_CAVEAT,
    noTagOrCareerCompletenessClaim:
      validJsonShape &&
      !Object.hasOwn(parsed, 'tags') &&
      !Object.hasOwn(parsed, 'completeCareer') &&
      !Object.hasOwn(parsed, 'allWorks'),
  };
  const passed = Object.values(answerChecks).every((value) => value === true);
  return { passed, answerChecks, parsed: validJsonShape ? parsed : null };
}

export function validateP07McpTextProjection(text, resultSummary) {
  let projection;
  try {
    projection = JSON.parse(text);
  } catch {
    projection = null;
  }
  const passed = Boolean(
    projection &&
    hasExactKeys(projection, ANSWER_KEYS) &&
    validateP07PersonSeasonSummary(resultSummary) &&
    projection.personId === resultSummary?.personId &&
    projection.kind === resultSummary?.kind &&
    projection.media === resultSummary?.media &&
    projection.state === resultSummary?.state &&
    canonicalJson(projection.window) === canonicalJson(resultSummary?.window) &&
    canonicalJson(projection.coverage) === canonicalJson(resultSummary?.coverage) &&
    projection.datedRowsObserved === resultSummary?.datedRowsObserved &&
    canonicalJson(projection.quarterDistribution) ===
      canonicalJson(resultSummary?.quarterDistribution) &&
    canonicalJson(projection.mostObservedQuarters) ===
      canonicalJson(resultSummary?.mostObservedQuarters) &&
    projection.maxQuarterCount === resultSummary?.maxQuarterCount &&
    projection.caveat === P07_CANONICAL_CAVEAT,
  );
  return { passed, projection: passed ? projection : null };
}

export const P07_ANSWER_CHECK_FIELDS = Object.freeze([
  'validJsonShape',
  'validSourceSummary',
  'exactFixedProfile',
  'exactWindow',
  'exactReturnedState',
  'exactQuarterDistribution',
  'exactCoverage',
  'boundedSampleCaveat',
  'noTagOrCareerCompletenessClaim',
]);
