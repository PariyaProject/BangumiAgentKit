export const S05_PROFILE_ID = 's05-bounded-non-tv-voice-agent-mcp-v1';
export const S05_TOOL_NAME = 'bangumi.get_person_activity';
export const S05_ARGUMENT_PROFILE = 'fixed-s05-person-3474-voice-anime-6m-48r-16d-8rows-v1';
export const S05_EXPECTED_ARGUMENTS = Object.freeze({
  personId: 3474,
  kind: 'voice',
  media: 'anime',
  windowMonths: 6,
  maxRelations: 48,
  maxSubjectDetails: 16,
  maxRows: 8,
});
export const S05_ANSWER_CHECK_METHOD = 's05-positive-non-tv-observation-v1';
export const S05_CANONICAL_CAVEAT =
  '仅表示本次官方人物关系与有界作品详情样本中观察到的动画声优记录；六个日历月按作品首播或发售日期筛选，不是实际配音日期。平台分类依据官方自由文本的保守规则，未知值不归类。关系端点没有分页、总数或完整性承诺，因此样本中未观察到 TV 记录不证明没有 TV 工作，也不能证明完整职业生涯只参与非 TV。';

const SUMMARY_KEYS = Object.freeze([
  'state',
  'window',
  'activityRowsReturned',
  'uniqueSubjectsObserved',
  'platformCounts',
  'nonTvObservationDates',
  'sourceCompleteness',
  'coverage',
  'conclusion',
  'exclusivityConclusion',
  'careerCompletenessConclusion',
  'caveat',
]);
const WINDOW_KEYS = Object.freeze(['months', 'start', 'end', 'asOfSemantics']);
const PLATFORM_COUNT_KEYS = Object.freeze(['tv', 'nonTv', 'unknown']);
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
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function exactKeys(value, expected) {
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

function validDateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function calendarWindowStart(end, months) {
  const monthIndex = Number(end.slice(0, 4)) * 12 + Number(end.slice(5, 7)) - 1 - (months - 1);
  const startYear = Math.floor(monthIndex / 12);
  const startMonth = monthIndex - startYear * 12 + 1;
  return `${startYear}-${String(startMonth).padStart(2, '0')}-01`;
}

function platformClass(platform) {
  if (typeof platform !== 'string' || !platform.trim()) return 'unknown';
  const normalized = platform.trim().toLowerCase();
  if (/\btv\b|television|电视/u.test(normalized)) return 'tv';
  if (/movie|剧场|ova|web|网络|music|音乐/u.test(normalized)) return 'nonTv';
  return 'unknown';
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

function summarizeCoverage(coverage, rowsReturned) {
  if (!coverage || typeof coverage !== 'object' || Array.isArray(coverage)) return null;
  const value = Object.fromEntries(COVERAGE_KEYS.map((key) => [key, coverage[key]]));
  if (
    !COVERAGE_KEYS.every((key) => Object.hasOwn(value, key)) ||
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
    value.relationRowsSelected > S05_EXPECTED_ARGUMENTS.maxRelations ||
    value.subjectDetailRequests > S05_EXPECTED_ARGUMENTS.maxSubjectDetails ||
    value.rowsReturned > S05_EXPECTED_ARGUMENTS.maxRows ||
    typeof value.retrievedAt !== 'string' ||
    Number.isNaN(Date.parse(value.retrievedAt))
  ) {
    return null;
  }
  return value;
}

function summarizeRows(rows, window) {
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > S05_EXPECTED_ARGUMENTS.maxRows)
    return null;
  const subjects = new Map();
  for (const row of rows) {
    if (
      !row ||
      typeof row !== 'object' ||
      Array.isArray(row) ||
      !Number.isSafeInteger(row.subjectId) ||
      row.subjectId < 1 ||
      row.subjectType !== 'anime' ||
      row.relationKind !== 'voice' ||
      !validDateOnly(row.firstAirDate) ||
      row.firstAirDate < window.start ||
      row.firstAirDate > window.end
    ) {
      return null;
    }
    const current = {
      firstAirDate: row.firstAirDate,
      platformClass: platformClass(row.platform),
    };
    const previous = subjects.get(row.subjectId);
    if (previous && canonicalJson(previous) !== canonicalJson(current)) return null;
    subjects.set(row.subjectId, current);
  }
  const platformCounts = { tv: 0, nonTv: 0, unknown: 0 };
  const nonTvObservationDates = [];
  for (const subject of subjects.values()) {
    platformCounts[subject.platformClass] += 1;
    if (subject.platformClass === 'nonTv') nonTvObservationDates.push(subject.firstAirDate);
  }
  nonTvObservationDates.sort();
  return { platformCounts, nonTvObservationDates, uniqueSubjectsObserved: subjects.size };
}

export function summarizeS05PersonActivityToolResult(
  result,
  expectedArguments = S05_EXPECTED_ARGUMENTS,
) {
  if (
    canonicalJson(expectedArguments) !== canonicalJson(S05_EXPECTED_ARGUMENTS) ||
    !result ||
    typeof result !== 'object' ||
    Array.isArray(result) ||
    result.personId !== S05_EXPECTED_ARGUMENTS.personId ||
    result.kind !== S05_EXPECTED_ARGUMENTS.kind ||
    result.media !== S05_EXPECTED_ARGUMENTS.media ||
    !['complete', 'partial'].includes(result.state) ||
    !Array.isArray(result.rows)
  ) {
    return null;
  }
  const window = result.window;
  if (
    !window ||
    window.months !== S05_EXPECTED_ARGUMENTS.windowMonths ||
    !validDateOnly(window.start) ||
    !validDateOnly(window.end) ||
    window.start > window.end ||
    window.start !== calendarWindowStart(window.end, window.months) ||
    window.asOfSemantics !== 'calendar_months_ending_on_as_of_date'
  ) {
    return null;
  }
  const rowSummary = summarizeRows(result.rows, window);
  const coverage = summarizeCoverage(result.coverage, result.rows.length);
  if (
    !rowSummary ||
    !coverage ||
    (result.state === 'complete' && coverageRequiresPartialState(coverage)) ||
    rowSummary.platformCounts.nonTv === 0
  ) {
    return null;
  }
  return {
    state:
      result.state === 'partial' || rowSummary.platformCounts.unknown > 0 ? 'partial' : 'complete',
    window: {
      months: window.months,
      start: window.start,
      end: window.end,
      asOfSemantics: window.asOfSemantics,
    },
    activityRowsReturned: result.rows.length,
    uniqueSubjectsObserved: rowSummary.uniqueSubjectsObserved,
    platformCounts: rowSummary.platformCounts,
    nonTvObservationDates: rowSummary.nonTvObservationDates,
    sourceCompleteness: 'undocumented',
    coverage,
    conclusion: 'positive_non_tv_observation_in_bounded_sample',
    exclusivityConclusion: 'not_established',
    careerCompletenessConclusion: 'not_established',
    caveat: S05_CANONICAL_CAVEAT,
  };
}

export function validateS05PersonActivitySummary(summary) {
  if (
    !exactKeys(summary, SUMMARY_KEYS) ||
    !['complete', 'partial'].includes(summary.state) ||
    !exactKeys(summary.window, WINDOW_KEYS) ||
    summary.window.months !== S05_EXPECTED_ARGUMENTS.windowMonths ||
    !validDateOnly(summary.window.start) ||
    !validDateOnly(summary.window.end) ||
    summary.window.start > summary.window.end ||
    summary.window.start !== calendarWindowStart(summary.window.end, summary.window.months) ||
    summary.window.asOfSemantics !== 'calendar_months_ending_on_as_of_date' ||
    !nonnegativeInteger(summary.activityRowsReturned) ||
    summary.activityRowsReturned < 1 ||
    summary.activityRowsReturned > S05_EXPECTED_ARGUMENTS.maxRows ||
    !nonnegativeInteger(summary.uniqueSubjectsObserved) ||
    summary.uniqueSubjectsObserved < 1 ||
    summary.uniqueSubjectsObserved > summary.activityRowsReturned ||
    !exactKeys(summary.platformCounts, PLATFORM_COUNT_KEYS) ||
    !Object.values(summary.platformCounts).every(nonnegativeInteger) ||
    summary.platformCounts.tv + summary.platformCounts.nonTv + summary.platformCounts.unknown !==
      summary.uniqueSubjectsObserved ||
    summary.platformCounts.nonTv < 1 ||
    (summary.state === 'complete' && summary.platformCounts.unknown > 0) ||
    !Array.isArray(summary.nonTvObservationDates) ||
    summary.nonTvObservationDates.length !== summary.platformCounts.nonTv ||
    !summary.nonTvObservationDates.every(
      (date) => validDateOnly(date) && date >= summary.window.start && date <= summary.window.end,
    ) ||
    [...summary.nonTvObservationDates]
      .sort()
      .some((date, index) => date !== summary.nonTvObservationDates[index]) ||
    summary.sourceCompleteness !== 'undocumented' ||
    !exactKeys(summary.coverage, COVERAGE_KEYS) ||
    summarizeCoverage(summary.coverage, summary.activityRowsReturned) === null ||
    (summary.state === 'complete' && coverageRequiresPartialState(summary.coverage)) ||
    summary.conclusion !== 'positive_non_tv_observation_in_bounded_sample' ||
    summary.exclusivityConclusion !== 'not_established' ||
    summary.careerCompletenessConclusion !== 'not_established' ||
    summary.caveat !== S05_CANONICAL_CAVEAT
  ) {
    return false;
  }
  return true;
}

export function verifyS05PersonActivityAnswer(answer, resultSummary) {
  let parsed = answer;
  if (typeof answer === 'string') {
    try {
      parsed = JSON.parse(answer);
    } catch {
      parsed = null;
    }
  }
  const validJsonShape = exactKeys(parsed, SUMMARY_KEYS);
  const validSourceSummary = validateS05PersonActivitySummary(resultSummary);
  const exactBoundedObservation =
    validJsonShape && validSourceSummary && canonicalJson(parsed) === canonicalJson(resultSummary);
  const answerChecks = {
    validJsonShape,
    validSourceSummary,
    exactBoundedObservation,
    positiveNonTvEvidence: validSourceSummary && resultSummary.platformCounts.nonTv > 0,
    noExclusivityClaim: validJsonShape && parsed.exclusivityConclusion === 'not_established',
    noCareerCompletenessClaim:
      validJsonShape && parsed.careerCompletenessConclusion === 'not_established',
    exactWindowAndCoverage:
      validJsonShape &&
      validSourceSummary &&
      canonicalJson(parsed.window) === canonicalJson(resultSummary.window) &&
      canonicalJson(parsed.coverage) === canonicalJson(resultSummary.coverage),
    fixedCaveat: validJsonShape && parsed.caveat === S05_CANONICAL_CAVEAT,
    noIdentityOrRawRows:
      validJsonShape &&
      !Object.hasOwn(parsed, 'personId') &&
      !Object.hasOwn(parsed, 'subjectId') &&
      !Object.hasOwn(parsed, 'subjectName') &&
      !Object.hasOwn(parsed, 'rows'),
  };
  return {
    passed: Object.values(answerChecks).every((value) => value === true),
    answerChecks,
    parsed: validJsonShape ? parsed : null,
  };
}

export function validateS05McpTextProjection(text, resultSummary) {
  let projection;
  try {
    projection = JSON.parse(text);
  } catch {
    projection = null;
  }
  const passed =
    validateS05PersonActivitySummary(resultSummary) &&
    exactKeys(projection, SUMMARY_KEYS) &&
    canonicalJson(projection) === canonicalJson(resultSummary);
  return { passed, projection: passed ? projection : null };
}

export const S05_ANSWER_CHECK_FIELDS = Object.freeze([
  'validJsonShape',
  'validSourceSummary',
  'exactBoundedObservation',
  'positiveNonTvEvidence',
  'noExclusivityClaim',
  'noCareerCompletenessClaim',
  'exactWindowAndCoverage',
  'fixedCaveat',
  'noIdentityOrRawRows',
]);
