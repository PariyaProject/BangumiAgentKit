import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';

export const G05_EXPECTED_QUERY_ARGUMENTS = Object.freeze({
  personId: 13684,
  kind: 'voice',
  media: 'tv',
  windowMonths: 6,
  maxRelations: 48,
  maxSubjectDetails: 12,
  maxRows: 20,
  comparePreviousWindow: true,
});

export const G05_ANSWER_CHECK_METHOD = 'g05-bounded-person-activity-comparison-v1';
export const G05_ARGUMENT_PROFILE = 'fixed-g05-person-13684-voice-tv-6m-48r-12d-20rows-compare-v1';

export const G05_COVERAGE_FIELDS = Object.freeze([
  'relationRowsObserved', 'relationRowsSelected', 'relationRowsDroppedAtLimit',
  'subjectIdsObserved', 'subjectIdsSelected', 'subjectIdsDroppedAtRelationLimit',
  'subjectDetailIdsObserved', 'subjectDetailRequests', 'subjectDetailsSucceeded',
  'subjectDetailsFailed', 'subjectDetailIdsDroppedAtLimit', 'rowsEligible',
  'rowsReturned', 'outputTruncated', 'uniqueSubjects', 'uniqueCharacters',
  'missingSubjectIdRows', 'missingDateRows', 'invalidDateRows', 'outsideWindowRows',
  'mediaExcludedRows', 'mediaUnknownRows', 'maxRelations', 'maxSubjectDetails',
  'maxRows', 'responseLimitBytes', 'truncated',
]);

const SUMMARY_COUNT_FIELDS = Object.freeze(['creditRows', 'uniqueSubjects', 'uniqueCharacters']);
const SOURCE_OPERATIONS = Object.freeze([
  'GET /v0/persons/{person_id}',
  'GET /v0/persons/{person_id}/characters',
  'GET /v0/subjects/{subject_id}',
]);
const ANSWER_KEYS = Object.freeze([
  'personId', 'kind', 'media', 'state', 'window', 'summary', 'coverage', 'rows', 'comparison', 'caveat',
]);
const UNSUPPORTED_POSITIVE_PATTERNS = [
  /(?:实际工作量|实际劳动时长|工作时长|完整职业生涯|完整履历|全部作品总数|生涯总数|历史工作量|历史趋势)/u,
  /\b(?:actual|real)\s+(?:workload|labor(?:\s+time)?|working\s+hours?)\b/iu,
  /\b(?:complete|full|entire|all)\s+(?:career|professional\s+career|filmography|works|history|total)\b/iu,
  /\b(?:historical|lifetime)\s+(?:workload|trend|total|career)\b/iu,
  /\bworkload\s+(?:increased|decreased|peaked|changed)\b/iu,
];

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (isRecord(value)) {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function canonicalJson(value) {
  return JSON.stringify(canonical(value));
}

function sameJson(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function parseObject(value) {
  if (isRecord(value)) return value;
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  try {
    const parsed = JSON.parse(value);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function findG05PersonActivity(value, seen = new Set(), depth = 0) {
  if (typeof value === 'string') {
    try { return findG05PersonActivity(JSON.parse(value), seen, depth + 1); } catch { return null; }
  }
  if (!isRecord(value) || depth > 12 || seen.has(value)) return null;
  seen.add(value);
  if (value.personId === G05_EXPECTED_QUERY_ARGUMENTS.personId &&
      value.kind === 'voice' && value.media === 'tv' &&
      isRecord(value.window) && value.window.months === 6 &&
      isRecord(value.comparison) && value.comparison.windowMonths === 6 &&
      isRecord(value.coverage) && isRecord(value.summary) && Array.isArray(value.rows)) return value;
  if (Array.isArray(value)) {
    for (const child of value.slice(0, 100)) {
      const found = findG05PersonActivity(child, seen, depth + 1);
      if (found) return found;
    }
    return null;
  }
  for (const key of ['structuredContent', 'data', 'result', 'output', 'content', 'text']) {
    if (!(key in value)) continue;
    const found = findG05PersonActivity(value[key], seen, depth + 1);
    if (found) return found;
  }
  return null;
}

function validIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function expectedWindowStart(end, months) {
  const date = new Date(`${end}T00:00:00.000Z`);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - months + 1, 1))
    .toISOString().slice(0, 10);
}

function expectedMonthKeys(end, months) {
  const date = new Date(`${end}T00:00:00.000Z`);
  return Array.from({ length: months }, (_, index) => {
    const month = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - months + 1 + index, 1));
    return month.toISOString().slice(0, 7);
  });
}

function validSixMonthWindow(window) {
  return isRecord(window) && window.months === 6 &&
    window.asOfSemantics === 'calendar_months_ending_on_as_of_date' &&
    validIsoDate(window.start) && validIsoDate(window.end) &&
    window.start === expectedWindowStart(window.end, 6) &&
    Array.isArray(window.monthKeys) && sameJson(window.monthKeys, expectedMonthKeys(window.end, 6));
}

function dayBefore(value) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function projectWindow(window) {
  if (!validSixMonthWindow(window)) return null;
  return {
    months: window.months,
    start: window.start,
    end: window.end,
    monthKeys: [...window.monthKeys],
    asOfSemantics: window.asOfSemantics,
  };
}

function projectCoverage(value) {
  if (!isRecord(value)) return null;
  const coverage = {};
  for (const field of G05_COVERAGE_FIELDS) {
    const item = value[field];
    if (field === 'outputTruncated' || field === 'truncated') {
      if (typeof item !== 'boolean') return null;
    } else if (!Number.isSafeInteger(item) || item < 0) return null;
    coverage[field] = item;
  }
  return coverage;
}

function projectSummary(value, window) {
  if (!isRecord(value) || !Array.isArray(value.byMonth)) return null;
  const summary = {};
  for (const field of SUMMARY_COUNT_FIELDS) {
    if (!Number.isSafeInteger(value[field]) || value[field] < 0) return null;
    summary[field] = value[field];
  }
  const byMonth = [];
  const seen = new Set();
  for (const item of value.byMonth) {
    if (!isRecord(item) || typeof item.month !== 'string' ||
        !/^\d{4}-\d{2}$/u.test(item.month) || !window.monthKeys.includes(item.month) || seen.has(item.month)) return null;
    const projected = { month: item.month };
    for (const field of SUMMARY_COUNT_FIELDS) {
      if (!Number.isSafeInteger(item[field]) || item[field] < 0) return null;
      projected[field] = item[field];
    }
    seen.add(item.month);
    byMonth.push(projected);
  }
  if (seen.size !== window.monthKeys.length ||
      window.monthKeys.some((month) => !seen.has(month))) return null;
  byMonth.sort((a, b) => a.month.localeCompare(b.month));
  if (byMonth.reduce((total, item) => total + item.creditRows, 0) !== summary.creditRows) return null;
  summary.byMonth = byMonth;
  return summary;
}

function projectPeriod(value) {
  if (!isRecord(value) || !['complete', 'partial', 'unavailable', 'not_computable'].includes(value.state)) return null;
  const window = projectWindow(value.window);
  const coverage = projectCoverage(value.coverage);
  const summary = projectSummary(value.summary, window ?? { monthKeys: [] });
  if (!window || !coverage || !summary) return null;
  return { state: value.state, window, summary, coverage };
}

function projectDelta(value) {
  if (!isRecord(value) || !['complete', 'partial', 'unavailable', 'not_computable'].includes(value.state)) return null;
  const delta = { state: value.state };
  for (const field of SUMMARY_COUNT_FIELDS) {
    if (value[field] !== undefined) {
      if (!Number.isSafeInteger(value[field])) return null;
      delta[field] = value[field];
    }
  }
  if (Object.keys(delta).length !== 1 && Object.keys(delta).length !== SUMMARY_COUNT_FIELDS.length + 1) return null;
  return delta;
}

function comparisonState(recent, previous) {
  if (recent === 'unavailable' && previous === 'unavailable') return 'unavailable';
  if (recent === 'not_computable' && previous === 'not_computable') return 'not_computable';
  if (recent === 'complete' && previous === 'complete') return 'complete';
  return 'partial';
}

function hasObservedSummary(period) {
  return period.state === 'complete' || (period.state === 'partial' && period.coverage.rowsEligible > 0);
}

function expectedDelta(recent, previous) {
  const state = comparisonState(recent.state, previous.state);
  if (!hasObservedSummary(recent) || !hasObservedSummary(previous)) return { state };
  return {
    state,
    creditRows: recent.summary.creditRows - previous.summary.creditRows,
    uniqueSubjects: recent.summary.uniqueSubjects - previous.summary.uniqueSubjects,
    uniqueCharacters: recent.summary.uniqueCharacters - previous.summary.uniqueCharacters,
  };
}

function expectedPeak(recent, previous) {
  const state = comparisonState(recent.state, previous.state);
  if (state === 'unavailable' || state === 'not_computable') return { metric: 'uniqueSubjects', state, months: [] };
  const months = [
    ...recent.summary.byMonth.map((item) => ({ period: 'recent', ...item })),
    ...previous.summary.byMonth.map((item) => ({ period: 'previous', ...item })),
  ];
  const maximum = Math.max(0, ...months.map((item) => item.uniqueSubjects));
  if (maximum === 0) {
    return { metric: 'uniqueSubjects', state: state === 'complete' ? 'not_computable' : state, months: [] };
  }
  return { metric: 'uniqueSubjects', state, months: months.filter((item) => item.uniqueSubjects === maximum) };
}

function projectComparison(value) {
  if (!isRecord(value) || value.windowMonths !== 6) return null;
  const recent = projectPeriod(value.recent);
  const previous = projectPeriod(value.previous);
  const delta = projectDelta(value.delta);
  if (!recent || !previous || !delta) return null;
  const peak = isRecord(value.peak) && value.peak.metric === 'uniqueSubjects' &&
    ['complete', 'partial', 'unavailable', 'not_computable'].includes(value.peak.state) &&
    Array.isArray(value.peak.months) ? value.peak : null;
  if (!peak) return null;
  const projectedPeakMonths = [];
  for (const item of peak.months) {
    if (!isRecord(item) || !['recent', 'previous'].includes(item.period) ||
        typeof item.month !== 'string' || !/^\d{4}-\d{2}$/u.test(item.month) ||
        !Number.isSafeInteger(item.creditRows) || item.creditRows < 0 ||
        !Number.isSafeInteger(item.uniqueSubjects) || item.uniqueSubjects < 0 ||
        !Number.isSafeInteger(item.uniqueCharacters) || item.uniqueCharacters < 0) return null;
    projectedPeakMonths.push({
      period: item.period, month: item.month, creditRows: item.creditRows,
      uniqueSubjects: item.uniqueSubjects, uniqueCharacters: item.uniqueCharacters,
    });
  }
  const result = {
    state: value.state,
    windowMonths: 6,
    recent,
    previous,
    delta,
    peak: { metric: 'uniqueSubjects', state: peak.state, months: projectedPeakMonths },
  };
  if (result.state !== comparisonState(recent.state, previous.state) ||
      !sameJson(delta, expectedDelta(recent, previous)) ||
      !sameJson(result.peak, expectedPeak(recent, previous)) ||
      recent.window.end < recent.window.start || previous.window.end < previous.window.start ||
      previous.window.end !== dayBefore(recent.window.start)) return null;
  return result;
}

function projectRow(row) {
  return {
    subjectId: row.subjectId,
    title: row.subjectNameCn || row.subjectName,
    firstAirDate: row.firstAirDate,
    month: row.month,
    relationId: row.relationId ?? null,
    characterName: row.characterName ?? null,
    rawRole: row.rawRole ?? null,
    roleFamily: row.roleFamily,
  };
}

function validRow(row, window) {
  const title = row?.subjectNameCn || row?.subjectName;
  return isRecord(row) && Number.isSafeInteger(row.subjectId) && row.subjectId > 0 &&
    typeof title === 'string' && title.length > 0 && validIsoDate(row.firstAirDate) &&
    row.firstAirDate >= window.start && row.firstAirDate <= window.end &&
    row.month === row.firstAirDate.slice(0, 7) && row.relationKind === 'voice' &&
    (row.relationId === undefined || (Number.isSafeInteger(row.relationId) && row.relationId > 0)) &&
    (row.characterName === undefined || typeof row.characterName === 'string') &&
    (row.rawRole === undefined || typeof row.rawRole === 'string') &&
    ['main', 'support', 'unknown'].includes(row.roleFamily);
}

function coverageIsConsistent(coverage, summary, rowCount) {
  return coverage.relationRowsSelected <= coverage.relationRowsObserved &&
    coverage.relationRowsDroppedAtLimit === coverage.relationRowsObserved - coverage.relationRowsSelected &&
    coverage.relationRowsSelected <= G05_EXPECTED_QUERY_ARGUMENTS.maxRelations &&
    coverage.subjectIdsObserved <= coverage.relationRowsObserved &&
    coverage.subjectIdsSelected <= coverage.relationRowsSelected &&
    coverage.subjectIdsSelected <= coverage.subjectIdsObserved &&
    coverage.subjectIdsDroppedAtRelationLimit === coverage.subjectIdsObserved - coverage.subjectIdsSelected &&
    coverage.subjectDetailIdsObserved === coverage.subjectIdsSelected &&
    coverage.subjectDetailRequests <= coverage.subjectIdsSelected &&
    coverage.subjectDetailRequests <= G05_EXPECTED_QUERY_ARGUMENTS.maxSubjectDetails &&
    coverage.subjectDetailsSucceeded + coverage.subjectDetailsFailed === coverage.subjectDetailRequests &&
    coverage.subjectDetailIdsDroppedAtLimit === Math.max(0, coverage.subjectIdsSelected - coverage.subjectDetailRequests) &&
    coverage.rowsEligible >= coverage.rowsReturned && coverage.rowsEligible <= coverage.relationRowsSelected &&
    coverage.rowsReturned <= G05_EXPECTED_QUERY_ARGUMENTS.maxRows &&
    coverage.rowsReturned === rowCount && coverage.outputTruncated === (coverage.rowsEligible > coverage.rowsReturned) &&
    coverage.uniqueSubjects === summary.uniqueSubjects && coverage.uniqueCharacters === summary.uniqueCharacters &&
    summary.creditRows === coverage.rowsEligible && summary.uniqueSubjects <= summary.creditRows &&
    summary.uniqueCharacters <= summary.creditRows &&
    coverage.maxRelations === G05_EXPECTED_QUERY_ARGUMENTS.maxRelations &&
    coverage.maxSubjectDetails === G05_EXPECTED_QUERY_ARGUMENTS.maxSubjectDetails &&
    coverage.maxRows === G05_EXPECTED_QUERY_ARGUMENTS.maxRows &&
    coverage.responseLimitBytes === 1_048_576 &&
    coverage.truncated === (coverage.relationRowsDroppedAtLimit > 0 ||
      coverage.subjectDetailIdsDroppedAtLimit > 0 || coverage.outputTruncated);
}

function projectOperations(value) {
  if (!Array.isArray(value) || value.length !== SOURCE_OPERATIONS.length) return null;
  const output = {};
  for (const row of value) {
    if (!isRecord(row) || !SOURCE_OPERATIONS.includes(row.operation) ||
        !Number.isSafeInteger(row.attempted) || row.attempted < 0 ||
        !Number.isSafeInteger(row.succeeded) || row.succeeded < 0 ||
        !Number.isSafeInteger(row.failed) || row.failed < 0 ||
        row.succeeded + row.failed !== row.attempted || Object.hasOwn(output, row.operation)) return null;
    output[row.operation] = { attempted: row.attempted, succeeded: row.succeeded, failed: row.failed };
  }
  if (Object.keys(output).length !== SOURCE_OPERATIONS.length) return null;
  return Object.fromEntries(SOURCE_OPERATIONS.map((name) => [name, output[name]]));
}

function operationsMatchCoverage(operations, coverage) {
  const person = operations?.[SOURCE_OPERATIONS[0]];
  const relations = operations?.[SOURCE_OPERATIONS[1]];
  const details = operations?.[SOURCE_OPERATIONS[2]];
  return person?.attempted === 1 && person.succeeded === 1 && person.failed === 0 &&
    relations?.attempted === 1 && relations.succeeded === 1 && relations.failed === 0 &&
    details?.attempted === coverage.subjectDetailRequests &&
    details.succeeded === coverage.subjectDetailsSucceeded && details.failed === coverage.subjectDetailsFailed;
}

function unsupportedPositive(value) {
  const clauses = value.split(/[。！？!?；;\n]/u);
  return clauses.some((clause) => UNSUPPORTED_POSITIVE_PATTERNS.some((pattern) => {
    for (const match of clause.matchAll(new RegExp(pattern.source, `${pattern.flags}g`))) {
      const start = match.index ?? 0;
      const end = start + match[0].length;
      const before = clause.slice(Math.max(0, start - 48), start);
      const after = clause.slice(end, end + 48);
      const negatedBefore = /(?:不是|并非|不代表|不等于|不能证明|不能说明|无法计算|未能证明|不构成|不意味着|无证据|\b(?:not|never|no|cannot|can't|does not|doesn't|do not|don't|not yet)\b(?:\s+(?:a|an|the|actual|complete|full|entire|career|historical|evidence|to|support|show|prove|establish)){0,4})\s*$/iu.test(before);
      const negatedAfter = /^\s*(?:(?:is|are|was|were)\s+)?(?:not\s+(?:supported|established|proven|evidenced)|unsupported|unproven|不能证明|无法计算|不代表|不构成|不意味着)\b/iu.test(after);
      if (!negatedBefore && !negatedAfter) return true;
    }
    return false;
  }));
}

function caveatIsValid(value) {
  if (typeof value !== 'string') return false;
  return (value.includes('本次有界观察') || value.includes('bounded current-response observation')) &&
    (value.includes('首播日期') || value.includes('first_air_date')) &&
    (value.includes('六个日历月') || value.includes('6个日历月') || value.includes('six calendar months')) &&
    (value.includes('不是实际工作量') || value.includes('not actual workload')) &&
    (value.includes('没有历史快照') || value.includes('no historical snapshot')) &&
    (value.includes('不代表完整职业生涯') || value.includes('not a complete career total'));
}

function sourceOperationsAreConsistent(result, comparison) {
  const sourceOperations = result?.comparison?.sourceOperations;
  if (!isRecord(sourceOperations)) return null;
  const recent = projectOperations(sourceOperations.recent);
  const previous = projectOperations(sourceOperations.previous);
  if (!recent || !previous || !operationsMatchCoverage(recent, comparison.recent.coverage) ||
      !operationsMatchCoverage(previous, comparison.previous.coverage)) return null;
  return { recent, previous };
}

export function summarizeG05PersonActivityResult(result) {
  const window = projectWindow(result?.window);
  const coverage = projectCoverage(result?.coverage);
  const summary = projectSummary(result?.summary, window ?? { monthKeys: [] });
  const comparison = projectComparison(result?.comparison);
  const operations = comparison ? sourceOperationsAreConsistent(result, comparison) : null;
  if (!window || !coverage || !summary || !comparison || !operations ||
      !sameJson(window, comparison.recent.window) || !sameJson(coverage, comparison.recent.coverage) ||
      !sameJson(summary, comparison.recent.summary)) return null;
  return {
    personId: G05_EXPECTED_QUERY_ARGUMENTS.personId,
    kind: 'voice',
    media: 'tv',
    state: result.state,
    comparisonState: comparison.state,
    window,
    recent: comparison.recent,
    previous: comparison.previous,
    delta: comparison.delta,
    peak: comparison.peak,
    rowCount: Array.isArray(result.rows) ? result.rows.length : null,
    rowDigest: Array.isArray(result.rows) ? sha256(canonicalJson(result.rows.map(projectRow))) : null,
    sourceOperations: operations,
  };
}

export function verifyG05PersonActivityComparisonAnswer(
  answer, queryArguments, toolOutput, toolCalls, toolTextUtf8Bytes,
) {
  const parsed = parseObject(answer);
  const structuredResult = isRecord(toolOutput?.structuredContent)
    ? findG05PersonActivity(toolOutput.structuredContent) : null;
  const result = structuredResult ?? findG05PersonActivity(toolOutput);
  const window = projectWindow(result?.window);
  const coverage = projectCoverage(result?.coverage);
  const summary = projectSummary(result?.summary, window ?? { monthKeys: [] });
  const comparison = projectComparison(result?.comparison);
  const operations = comparison ? sourceOperationsAreConsistent(result, comparison) : null;
  const rows = Array.isArray(result?.rows) ? result.rows : [];
  const argumentsMatch = sameJson(queryArguments, G05_EXPECTED_QUERY_ARGUMENTS);
  const singleCall = Array.isArray(toolCalls) && toolCalls.length === 1 &&
    toolCalls[0]?.name === 'bangumi.get_person_activity' && toolCalls[0]?.state === 'DONE' &&
    sameJson(toolCalls[0]?.arguments, G05_EXPECTED_QUERY_ARGUMENTS);
  const rowsValid = Boolean(window) && rows.length <= G05_EXPECTED_QUERY_ARGUMENTS.maxRows &&
    rows.every((row) => validRow(row, window));
  const rowKeys = rows.map((row) => `${row.subjectId}:${row.relationId ?? ''}`);
  const rowsDistinct = new Set(rowKeys).size === rowKeys.length;
  const recentRowsConsistent = Boolean(coverage && summary &&
    coverageIsConsistent(coverage, summary, rows.length));
  const previousRowsConsistent = Boolean(comparison && coverageIsConsistent(
    comparison.previous.coverage,
    comparison.previous.summary,
    comparison.previous.coverage.rowsReturned,
  ));
  const comparisonConsistent = Boolean(comparison && operations &&
    sameJson(window, comparison.recent.window) && sameJson(coverage, comparison.recent.coverage) &&
    sameJson(summary, comparison.recent.summary));
  const exactShape = isRecord(parsed) && Object.keys(parsed).length === ANSWER_KEYS.length &&
    ANSWER_KEYS.every((key) => Object.hasOwn(parsed, key));
  const rowProjection = rows.map(projectRow);
  const answerCaveat = parsed?.caveat;
  const answerStrings = exactShape ? JSON.stringify({
    personId: parsed.personId, kind: parsed.kind, media: parsed.media, state: parsed.state,
    window: parsed.window, summary: parsed.summary, coverage: parsed.coverage,
    rows: parsed.rows, comparison: parsed.comparison,
  }) : '';
  const checks = {
    exactQueryArguments: argumentsMatch,
    exactSingleToolCall: singleCall,
    structuredResultReadback: Boolean(structuredResult),
    targetIdentityAndScope: result?.personId === G05_EXPECTED_QUERY_ARGUMENTS.personId &&
      result?.kind === 'voice' && result?.media === 'tv' &&
      ['complete', 'partial', 'unavailable', 'not_computable'].includes(result?.state) &&
      result?.state === comparison?.state,
    sixMonthWindowsContiguous: Boolean(window && comparison && validSixMonthWindow(window) &&
      validSixMonthWindow(comparison.previous.window) &&
      comparison.previous.window.end === dayBefore(window.start)),
    successfulOfficialSources: Boolean(operations),
    boundedCoverageConsistent: recentRowsConsistent && previousRowsConsistent,
    sourceRowsValid: rowsValid,
    sourceRowsDistinct: rowsDistinct,
    comparisonInternallyConsistent: comparisonConsistent,
    answerShapeValid: exactShape,
    answerIdentityAndStateMatch: exactShape && parsed.personId === result?.personId &&
      parsed.kind === result?.kind && parsed.media === result?.media && parsed.state === result?.state,
    answerWindowsAndSummariesMatch: exactShape && Boolean(window && summary && comparison) &&
      sameJson(parsed.window, window) && sameJson(parsed.summary, summary) &&
      sameJson(parsed.coverage, coverage),
    answerRowsMatch: exactShape && sameJson(parsed.rows, rowProjection),
    answerComparisonMatches: exactShape && sameJson(parsed.comparison, comparison),
    caveatDisclosurePresent: caveatIsValid(answerCaveat),
    noUnsupportedPositiveClaim: !unsupportedPositive(
      answerStrings + (typeof answerCaveat === 'string' ? `。${answerCaveat}` : ''),
    ),
    plainJsonWithoutMarkdown: typeof answer === 'string' && answer.trimStart().startsWith('{') &&
      !/^\s*```/u.test(answer),
    boundedAnswerBytes: typeof answer === 'string' && Buffer.byteLength(answer, 'utf8') <= 16 * 1024,
    boundedMcpTextView: Number.isSafeInteger(toolTextUtf8Bytes) && toolTextUtf8Bytes > 0 && toolTextUtf8Bytes <= 3600,
  };
  const resultSummary = result && summarizeG05PersonActivityResult(result);
  const resultJson = structuredResult ? canonicalJson(structuredResult) : '';
  const answerText = typeof answer === 'string' ? answer : '';
  const answerCounters = {
    sourceRows: rows.length,
    answerRows: Array.isArray(parsed?.rows) ? parsed.rows.length : 0,
    rowsMatched: rowsValid && Array.isArray(parsed?.rows) && sameJson(parsed.rows, rowProjection) ? rows.length : 0,
    missingRows: Array.isArray(parsed?.rows) ? Math.max(0, rows.length - parsed.rows.length) : rows.length,
    extraRows: Array.isArray(parsed?.rows) ? Math.max(0, parsed.rows.length - rows.length) : 0,
    coverageFieldsMatched: coverage ? G05_COVERAGE_FIELDS.length : 0,
    toolTextUtf8Bytes: Number.isSafeInteger(toolTextUtf8Bytes) ? toolTextUtf8Bytes : 0,
  };
  return {
    passed: Object.values(checks).every(Boolean),
    answerChecks: checks,
    answerCounters,
    resultSummary,
    resultByteLength: Buffer.byteLength(resultJson, 'utf8'),
    resultSha256: sha256(resultJson),
    answerUtf8Bytes: Buffer.byteLength(answerText, 'utf8'),
    answerSha256: sha256(answerText),
  };
}
