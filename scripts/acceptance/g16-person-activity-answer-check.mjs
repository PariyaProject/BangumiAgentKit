import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';

export const G16_ANSWER_CHECK_METHOD = 'g16-bounded-director-person-activity-answer-v1';
export const G16_ARGUMENT_PROFILE = 'fixed-g16-person-6154-director-tv-36m-48r-16d-20rows-v1';
export const G16_EXPECTED_QUERY_ARGUMENTS = Object.freeze({
  personId: 6154,
  kind: 'staff',
  staffRole: 'director',
  media: 'tv',
  windowMonths: 36,
  maxRelations: 48,
  maxSubjectDetails: 16,
  maxRows: 20,
});

export const G16_COVERAGE_FIELDS = Object.freeze([
  'relationRowsObserved', 'relationRowsSelected', 'relationRowsDroppedAtLimit',
  'subjectIdsObserved', 'subjectIdsSelected', 'subjectIdsDroppedAtRelationLimit',
  'subjectDetailIdsObserved', 'subjectDetailRequests', 'subjectDetailsSucceeded',
  'subjectDetailsFailed', 'subjectDetailIdsDroppedAtLimit', 'rowsEligible', 'rowsReturned',
  'outputTruncated', 'uniqueSubjects', 'uniqueCharacters', 'missingSubjectIdRows',
  'missingDateRows', 'invalidDateRows', 'outsideWindowRows', 'mediaExcludedRows',
  'mediaUnknownRows', 'staffRoleExcludedRows', 'staffRoleUnknownRows', 'maxRelations',
  'maxSubjectDetails', 'maxRows', 'responseLimitBytes', 'truncated',
]);
const COVERAGE_FIELDS = G16_COVERAGE_FIELDS;
const ANSWER_KEYS = [
  'personId', 'kind', 'staffRole', 'media', 'window', 'state', 'observedUniqueWorks',
  'summary', 'coverage', 'rows', 'caveat',
];
const SUMMARY_KEYS = ['creditRows', 'uniqueSubjects', 'uniqueCharacters'];
const DIRECTOR_LABELS = new Set([
  '导演', '監督', '总导演', '総監督', 'director', 'chief director', 'series director',
]);
const UNSUPPORTED_SCOPE = [
  /(?:完整导演履历|全部导演作品|所有导演作品|完整(?:导演)?作品总数|完整生涯|全部作品|所有作品)/u,
  /\b(?:complete|full|entire|all)\s+(?:(?:director|directing)\s+)?(?:career|filmography|list|total|credits|works)\b/iu,
  /\b(?:complete|full|entire)\s+(?:director\s+)?(?:career|filmography)\b/iu,
  /\b(?:lifetime|historical)\s+(?:director\s+)?(?:total|filmography|credits|works)\b/iu,
];
const APPROVED_CAVEAT_TEXTS = Object.freeze([
  '本次有界观察只表示当前官方关系和已成功读取作品详情的样本，不代表全部作品；按作品首播日期归入36个日历月，不是滚动三年。未返回作品不等于不存在；未知职位标签会保留为未知，不匹配职位不是不存在，也不是完整导演履历。没有历史快照。',
  'This is a bounded current-response observation; the window uses first_air_date and 36 calendar months, not a rolling three years; unreturned works do not prove absence; missing or nonmatching role labels do not prove there are no director works; this is not a complete director filmography; no historical snapshot exists.',
]);
const NEGATION_BEFORE = /(?:不是|并非|不代表|不等于|不能证明|不能说明|无法计算|未能证明|不会表示|不说明|不构成|不意味着|并不代表|没有历史快照)\s*$|\b(?:not|never|no|cannot|can't|does\s+not|doesn't|do\s+not|don't|is\s+not|isn't|not\s+yet)\b(?:\s+(?:a|an|the|complete|full|entire|actual|lifetime|historical|director|directing|career|filmography|evidence|to|support|show|prove|establish)){0,4}\s*$/iu;
const NEGATION_AFTER = /^\s*(?:(?:is|are|was|were)\s+)?(?:not\s+(?:supported|established|proven|evidenced)|unsupported|unproven|unknown|unavailable|不能证明|无法计算|未能证明|不说明|不构成|不意味着|没有依据)\b/iu;
const ENGLISH_NEGATION = /\b(?:not|never|no|cannot|can't|doesn't|don't|isn't|not\s+yet)\b/giu;

const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const canonical = (value) => Array.isArray(value)
  ? value.map(canonical)
  : isRecord(value)
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]))
    : value;
const canonicalJson = (value) => JSON.stringify(canonical(value));
const sameJson = (left, right) => canonicalJson(left) === canonicalJson(right);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function parseObject(value) {
  if (isRecord(value)) return value;
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const parsed = JSON.parse(value);
    return isRecord(parsed) ? parsed : null;
  } catch { return null; }
}

function findG16Activity(value, seen = new Set(), depth = 0) {
  if (typeof value === 'string') {
    try { return findG16Activity(JSON.parse(value), seen, depth + 1); } catch { return null; }
  }
  if (!isRecord(value) || depth > 12 || seen.has(value)) return null;
  seen.add(value);
  if (value.personId === G16_EXPECTED_QUERY_ARGUMENTS.personId && value.kind === 'staff' &&
      value.staffRole === 'director' && value.media === 'tv' && isRecord(value.window) &&
      isRecord(value.coverage) && isRecord(value.summary) && Array.isArray(value.rows)) return value;
  if (Array.isArray(value)) {
    for (const child of value.slice(0, 100)) {
      const found = findG16Activity(child, seen, depth + 1);
      if (found) return found;
    }
    return null;
  }
  for (const key of ['structuredContent', 'data', 'result', 'output', 'content', 'text']) {
    if (key in value) {
      const found = findG16Activity(value[key], seen, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

function projectCoverage(coverage) {
  if (!isRecord(coverage)) return null;
  const output = {};
  for (const key of COVERAGE_FIELDS) {
    const value = coverage[key];
    if (key === 'outputTruncated' || key === 'truncated') {
      if (typeof value !== 'boolean') return null;
    } else if (!Number.isSafeInteger(value) || value < 0) return null;
    output[key] = value;
  }
  return output;
}

function projectWindow(window) {
  if (!isRecord(window)) return null;
  return {
    months: window.months,
    start: window.start,
    end: window.end,
    monthKeys: window.monthKeys,
    asOfSemantics: window.asOfSemantics,
  };
}

function rowProjection(row) {
  return {
    subjectId: row.subjectId,
    title: row.subjectNameCn || row.subjectName,
    firstAirDate: row.firstAirDate,
    month: row.month,
    relationId: row.relationId,
    rawRole: row.rawRole,
    roleFamily: row.roleFamily,
  };
}

function hasExactDirectorLabel(rawRole) {
  if (typeof rawRole !== 'string' || !rawRole.trim()) return false;
  return rawRole.split(/[、,，/|+&;；]+/u)
    .map((label) => label.trim().toLowerCase())
    .some((label) => DIRECTOR_LABELS.has(label));
}

function validDateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validCalendarWindow(window, observedAt) {
  if (!isRecord(window) || window.months !== 36 ||
      window.asOfSemantics !== 'calendar_months_ending_on_as_of_date' ||
      !validDateOnly(window.start) || !validDateOnly(window.end) || !Array.isArray(window.monthKeys)) return false;
  const end = new Date(`${window.end}T00:00:00.000Z`);
  const startMonthIndex = end.getUTCFullYear() * 12 + end.getUTCMonth() - 35;
  const [startYear, startMonthZeroBased] = [Math.floor(startMonthIndex / 12), ((startMonthIndex % 12) + 12) % 12];
  const expectedStart = `${startYear}-${String(startMonthZeroBased + 1).padStart(2, '0')}-01`;
  const expectedMonthKeys = Array.from({ length: 36 }, (_, index) => {
    const monthIndex = startMonthIndex + index;
    const year = Math.floor(monthIndex / 12);
    const month = ((monthIndex % 12) + 12) % 12 + 1;
    return `${year}-${String(month).padStart(2, '0')}`;
  });
  if (window.start !== expectedStart || !sameJson(window.monthKeys, expectedMonthKeys)) return false;
  const retrieved = Date.parse(observedAt ?? '');
  const endTime = Date.parse(`${window.end}T00:00:00.000Z`);
  if (!Number.isFinite(retrieved)) return false;
  const retrievedDate = new Date(retrieved).toISOString().slice(0, 10);
  const retrievedDay = Date.parse(`${retrievedDate}T00:00:00.000Z`);
  return Math.abs(retrievedDay - endTime) <= 86_400_000;
}

function validRow(row, window) {
  return isRecord(row) && Number.isSafeInteger(row.subjectId) && row.subjectId > 0 &&
    typeof (row.subjectNameCn || row.subjectName) === 'string' &&
    validDateOnly(row.firstAirDate) && row.firstAirDate >= window.start && row.firstAirDate <= window.end &&
    row.month === row.firstAirDate.slice(0, 7) && row.relationKind === 'staff' &&
    row.subjectType === 'anime' && typeof row.platform === 'string' &&
    /\btv\b|television|电视/iu.test(row.platform) &&
    Number.isSafeInteger(row.relationId) && row.relationId === row.subjectId &&
    hasExactDirectorLabel(row.rawRole) && row.roleFamily === 'staff' && row.characterName === undefined;
}

function coverageIsConsistent(coverage, result, rows) {
  const matched = coverage.relationRowsSelected + coverage.relationRowsDroppedAtLimit;
  return coverage.relationRowsSelected <= coverage.maxRelations &&
    coverage.relationRowsObserved === matched + coverage.staffRoleExcludedRows &&
    coverage.staffRoleUnknownRows <= coverage.staffRoleExcludedRows &&
    coverage.subjectIdsSelected <= coverage.subjectIdsObserved &&
    coverage.subjectIdsObserved <= matched &&
    coverage.subjectIdsDroppedAtRelationLimit === coverage.subjectIdsObserved - coverage.subjectIdsSelected &&
    coverage.subjectDetailIdsObserved === coverage.subjectIdsSelected &&
    coverage.subjectDetailRequests <= coverage.maxSubjectDetails &&
    coverage.subjectDetailsSucceeded + coverage.subjectDetailsFailed === coverage.subjectDetailRequests &&
    coverage.subjectDetailIdsDroppedAtLimit === Math.max(0, coverage.subjectIdsSelected - coverage.subjectDetailRequests) &&
    coverage.rowsEligible === result.summary.creditRows &&
    coverage.rowsReturned === rows.length && coverage.rowsReturned <= coverage.maxRows &&
    coverage.rowsEligible >= coverage.rowsReturned &&
    coverage.outputTruncated === (coverage.rowsEligible > coverage.rowsReturned) &&
    coverage.uniqueSubjects === result.summary.uniqueSubjects &&
    coverage.uniqueCharacters === result.summary.uniqueCharacters &&
    coverage.maxRelations === G16_EXPECTED_QUERY_ARGUMENTS.maxRelations &&
    coverage.maxSubjectDetails === G16_EXPECTED_QUERY_ARGUMENTS.maxSubjectDetails &&
    coverage.maxRows === G16_EXPECTED_QUERY_ARGUMENTS.maxRows &&
    coverage.responseLimitBytes === 1_048_576 &&
    coverage.truncated === (coverage.relationRowsDroppedAtLimit > 0 ||
      coverage.subjectDetailIdsDroppedAtLimit > 0 || coverage.outputTruncated);
}

function sourceOperationsAreConsistent(result, coverage) {
  if (!Array.isArray(result.sourceOperations) || result.sourceOperations.length !== 3) return false;
  const byPath = new Map(result.sourceOperations.map((entry) => [entry.operation, entry]));
  const expected = new Set([
    'GET /v0/persons/{person_id}',
    'GET /v0/persons/{person_id}/subjects',
    'GET /v0/subjects/{subject_id}',
  ]);
  if (byPath.size !== 3 || [...byPath.keys()].some((key) => !expected.has(key))) return false;
  const person = byPath.get('GET /v0/persons/{person_id}');
  const relations = byPath.get('GET /v0/persons/{person_id}/subjects');
  const details = byPath.get('GET /v0/subjects/{subject_id}');
  return [person, relations].every((entry) => entry?.attempted === 1 && entry.succeeded === 1 && entry.failed === 0) &&
    details?.attempted === coverage.subjectDetailRequests &&
    details.succeeded === coverage.subjectDetailsSucceeded && details.failed === coverage.subjectDetailsFailed;
}

function hasUnsupportedPositiveClaim(caveat) {
  if (typeof caveat !== 'string') return true;
  return caveat.split(/[。！？!?；;\n]/u).some((clause) => UNSUPPORTED_SCOPE.some((pattern) => {
    for (const match of clause.matchAll(new RegExp(pattern.source, `${pattern.flags}g`))) {
      const start = match.index ?? 0;
      const end = start + match[0].length;
      const before = clause.slice(Math.max(0, start - 48), start);
      const after = clause.slice(end, end + 48);
      const localNegation = NEGATION_BEFORE.test(before) || NEGATION_AFTER.test(after);
      if (!localNegation || [...before.matchAll(ENGLISH_NEGATION)].length > 1) return true;
    }
    return false;
  }));
}

function answerRowMatches(answerRow, resultRow, window) {
  if (!isRecord(answerRow)) return false;
  const expected = rowProjection(resultRow);
  return Object.keys(answerRow).every((key) => Object.hasOwn(expected, key)) &&
    sameJson(answerRow, expected) && validRow(resultRow, window);
}

export function summarizeG16PersonActivityResult(result) {
  const coverage = projectCoverage(result?.coverage);
  const window = projectWindow(result?.window);
  if (!coverage || !window || !isRecord(result?.summary) || !Array.isArray(result?.rows)) return null;
  const sourceOperations = Array.isArray(result.sourceOperations)
    ? result.sourceOperations.map(({ operation, attempted, succeeded, failed }) => ({ operation, attempted, succeeded, failed }))
    : null;
  return {
    personId: result.personId,
    kind: result.kind,
    staffRole: result.staffRole,
    media: result.media,
    state: result.state,
    window,
    summary: {
      creditRows: result.summary.creditRows,
      uniqueSubjects: result.summary.uniqueSubjects,
      uniqueCharacters: result.summary.uniqueCharacters,
    },
    coverage,
    rowCount: result.rows.length,
    rowDigest: sha256(JSON.stringify(result.rows.map(rowProjection))),
    sourceOperations,
  };
}

export function verifyG16PersonActivityAnswer(answer, queryArguments, toolOutput, toolCalls, toolTextUtf8Bytes) {
  const parsed = parseObject(answer);
  const structuredResult = isRecord(toolOutput?.structuredContent)
    ? findG16Activity(toolOutput.structuredContent)
    : null;
  const result = structuredResult ?? findG16Activity(toolOutput);
  const coverage = projectCoverage(result?.coverage);
  const window = projectWindow(result?.window);
  const rows = Array.isArray(result?.rows) ? result.rows : [];
  const exactSingleToolCall = Array.isArray(toolCalls) && toolCalls.length === 1 &&
    toolCalls[0]?.name === 'bangumi.get_person_activity' && toolCalls[0]?.state === 'DONE' &&
    sameJson(toolCalls[0]?.arguments, G16_EXPECTED_QUERY_ARGUMENTS);
  const sourceRowsValid = rows.length <= G16_EXPECTED_QUERY_ARGUMENTS.maxRows &&
    rows.every((row) => validRow(row, result?.window));
  const sourceRowsDistinct = new Set(rows.map((row) => `${row.subjectId}:${row.relationId}`)).size === rows.length;
  const summaryValid = isRecord(result?.summary) &&
    SUMMARY_KEYS.every((key) => Number.isSafeInteger(result.summary[key]) && result.summary[key] >= 0) &&
    result.summary.creditRows === coverage?.rowsEligible &&
    result.summary.uniqueSubjects <= result.summary.creditRows &&
    result.summary.uniqueCharacters === 0;
  const stateValid = ['complete', 'partial'].includes(result?.state);
  const answerRows = Array.isArray(parsed?.rows) ? parsed.rows : [];
  const expectedRows = rows.map(rowProjection);
  const caveat = parsed?.caveat;
  const caveatValid = typeof caveat === 'string' && APPROVED_CAVEAT_TEXTS.includes(caveat.trim());
  const expectedSummary = result?.summary ? {
    creditRows: result.summary.creditRows,
    uniqueSubjects: result.summary.uniqueSubjects,
    uniqueCharacters: result.summary.uniqueCharacters,
  } : null;
  const checks = {
    exactQueryArguments: sameJson(queryArguments, G16_EXPECTED_QUERY_ARGUMENTS),
    exactSingleToolCall,
    structuredResultReadback: Boolean(structuredResult),
    targetIdentityAndScope: result?.personId === G16_EXPECTED_QUERY_ARGUMENTS.personId &&
      result.kind === 'staff' && result.staffRole === 'director' && result.media === 'tv',
    calendarWindowValid: Boolean(result?.window && validCalendarWindow(result.window, result?.coverage?.retrievedAt)) &&
      isRecord(parsed?.window) && sameJson(parsed.window, window),
    successfulOfficialSources: stateValid && Boolean(coverage) && sourceOperationsAreConsistent(result, coverage),
    boundedCoverageConsistent: Boolean(coverage && summaryValid && coverageIsConsistent(coverage, result, rows)),
    sourceRowsValid,
    sourceRowsDistinct,
    answerShapeValid: isRecord(parsed) && Object.keys(parsed).length === ANSWER_KEYS.length &&
      ANSWER_KEYS.every((key) => Object.hasOwn(parsed, key)),
    answerIdentityAndStateMatch: parsed?.personId === result?.personId && parsed?.kind === result?.kind &&
      parsed?.staffRole === result?.staffRole && parsed?.media === result?.media && parsed?.state === result?.state,
    observedCountMatches: parsed?.observedUniqueWorks === result?.summary?.uniqueSubjects,
    answerSummaryMatches: sameJson(parsed?.summary, expectedSummary),
    answerCoverageMatches: Boolean(coverage && isRecord(parsed?.coverage) &&
      Object.keys(parsed.coverage).length === COVERAGE_FIELDS.length &&
      Object.keys(parsed.coverage).every((key) => COVERAGE_FIELDS.includes(key)) && sameJson(parsed.coverage, coverage)),
    answerRowsMatch: answerRows.length === expectedRows.length &&
      expectedRows.every((expected, index) => answerRowMatches(answerRows[index], rows[index], result.window)),
    caveatDisclosurePresent: caveatValid,
    noUnsupportedPositiveClaim: !hasUnsupportedPositiveClaim(caveat),
    plainJsonWithoutMarkdown: typeof answer === 'string' && parsed !== null &&
      !/^\s*```/u.test(answer) && !/^\s*#/mu.test(answer),
    boundedAnswerBytes: typeof answer === 'string' && Buffer.byteLength(answer, 'utf8') <= 16_384,
    boundedMcpTextView: Number.isSafeInteger(toolTextUtf8Bytes) && toolTextUtf8Bytes > 0 && toolTextUtf8Bytes <= 3600,
  };
  const passed = Object.values(checks).every(Boolean);
  const answerCounters = {
    sourceRows: rows.length,
    answerRows: answerRows.length,
    rowsMatched: expectedRows.filter((expected, index) => answerRowMatches(answerRows[index], rows[index], result?.window)).length,
    missingRows: Math.max(0, rows.length - answerRows.length),
    extraRows: Math.max(0, answerRows.length - rows.length),
    coverageFieldsMatched: coverage ? Object.keys(coverage).length : 0,
    toolTextUtf8Bytes: Number.isSafeInteger(toolTextUtf8Bytes) ? toolTextUtf8Bytes : 0,
  };
  const serializedResult = result ? JSON.stringify(result) : '';
  return {
    passed,
    answerChecks: checks,
    answerCounters,
    resultSummary: result ? summarizeG16PersonActivityResult(result) : null,
    resultSha256: result ? sha256(serializedResult) : null,
    resultByteLength: result ? Buffer.byteLength(serializedResult, 'utf8') : 0,
    answerSha256: typeof answer === 'string' ? sha256(answer) : null,
    answerUtf8Bytes: typeof answer === 'string' ? Buffer.byteLength(answer, 'utf8') : 0,
  };
}
