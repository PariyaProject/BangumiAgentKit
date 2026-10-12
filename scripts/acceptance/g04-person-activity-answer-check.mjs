import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';

export const G04_ANSWER_CHECK_METHOD = 'g04-bounded-person-activity-answer-v1';

export const G04_EXPECTED_QUERY_ARGUMENTS = Object.freeze({
  personId: 13684,
  kind: 'voice',
  media: 'tv',
  windowMonths: 12,
  maxRelations: 48,
  maxSubjectDetails: 16,
  maxRows: 8,
});

export const G04_REQUIRED_CAVEAT =
  '本次有界观察只表示当前官方关系和已成功读取作品详情的样本，不代表全部作品；时间按作品首播日期归入12个日历月，不是滚动365天。未返回作品不等于不存在，也不是实际配音时间或工作量；没有历史快照，不能说明历史趋势。';

const COVERAGE_FIELDS = [
  'relationRowsObserved',
  'relationRowsSelected',
  'relationRowsDroppedAtLimit',
  'subjectIdsObserved',
  'subjectIdsSelected',
  'subjectIdsDroppedAtRelationLimit',
  'subjectDetailIdsObserved',
  'subjectDetailRequests',
  'subjectDetailsSucceeded',
  'subjectDetailsFailed',
  'subjectDetailIdsDroppedAtLimit',
  'rowsEligible',
  'rowsReturned',
  'outputTruncated',
  'uniqueSubjects',
  'uniqueCharacters',
  'missingSubjectIdRows',
  'missingDateRows',
  'invalidDateRows',
  'outsideWindowRows',
  'mediaExcludedRows',
  'mediaUnknownRows',
  'maxRelations',
  'maxSubjectDetails',
  'maxRows',
  'responseLimitBytes',
  'truncated',
];
const ORIGIN_COVERAGE_FIELDS = [
  'explicitOriginalSubjects',
  'notObservedSubjects',
  'unknownSubjects',
  'subjectsObserved',
  'subjectsWithMetaTags',
  'subjectsPartial',
  'subjectsUnknown',
  'tagsObserved',
  'tagsValid',
  'tagsReturned',
  'tagsOmitted',
  'malformedTagValues',
  'textTruncatedTags',
  'truncatedSubjects',
  'truncated',
  'maxTagsPerSubject',
  'maxTagCharacters',
  'responseLimitBytes',
];
const ORIGIN_SUMMARY_FIELDS = [
  'explicitOriginalSubjects',
  'notObservedSubjects',
  'unknownSubjects',
];
const ORIGIN_OBSERVATION_FIELDS = ['state', 'metaTags', 'metaTagsCoverage'];
const ORIGIN_META_TAG_COVERAGE_FIELDS = [
  'state',
  'observed',
  'valid',
  'returned',
  'omitted',
  'malformed',
  'textTruncated',
  'truncated',
  'maxItems',
  'maxCharacters',
];
const ANSWER_KEYS = [
  'personId',
  'kind',
  'media',
  'window',
  'state',
  'observedUniqueWorks',
  'summary',
  'coverage',
  'rows',
  'caveat',
];
const ANSWER_COVERAGE_KEYS = new Set(COVERAGE_FIELDS);
const UNSUPPORTED_CLAIM_PATTERNS = [
  /(?:完整履历|全部作品|完整(?:作品)?总数|生涯总数|实际配音时间|实际工作量|工作时长|滚动\s*365\s*天|历史(?:总数|趋势|工作量))/u,
  /\b(?:complete|full|entire|all)\s+(?:(?:career|professional)\s+)?(?:career\s+)?(?:history|filmography|list|total|credits|works)\b/iu,
  /\b(?:career|professional|lifetime)\s+(?:history|filmography|list|total|count|credits|works)\b/iu,
  /\brolling\s*365[\s-]*days?\b/iu,
  /\b(?:actual|real)\s+(?:voice[- ]?acting|dubbing|workload|working\s+time|hours?)\b/iu,
  /\bworkload\b/iu,
  /\b(?:historical|lifetime)\s+(?:total|trend|workload)\b/iu,
];
const CLAIM_NEGATION_BEFORE =
  /(?:不是|并非|不代表|不等于|不能证明|不能说明|无法计算|未能证明|不会表示|不说明|不构成|不意味着|并不代表|没有历史快照)\s*$|\b(?:not|never|no|cannot|can't|does\s+not|doesn't|do\s+not|don't|did\s+not|didn't|is\s+not|isn't|are\s+not|aren't|was\s+not|wasn't|were\s+not|weren't|not\s+yet)\b(?:\s+(?:a|an|the|complete|full|entire|actual|rolling|lifetime|career|professional|historical|evidence|to|support|show|prove|establish)){0,4}\s*$/iu;
const CLAIM_NEGATION_AFTER =
  /^\s*(?:(?:is|are|was|were)\s+)?(?:not\s+(?:supported|established|proven|evidenced)|unsupported|unproven|unknown|unavailable|不能证明|无法计算|未能证明|不说明|不构成|不意味着|没有依据)\b/iu;
const ENGLISH_NEGATION =
  /\b(?:not|never|no|cannot|can't|doesn't|don't|didn't|isn't|aren't|wasn't|weren't|does\s+not|do\s+not|did\s+not|is\s+not|are\s+not|was\s+not|were\s+not)\b/giu;

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonical(value[key])]),
    );
  }
  return value;
}

function sameJson(left, right) {
  return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
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

function findPersonActivity(value, seen = new Set(), depth = 0) {
  if (typeof value === 'string') {
    try {
      return findPersonActivity(JSON.parse(value), seen, depth + 1);
    } catch {
      return null;
    }
  }
  if (!isRecord(value) || depth > 12 || seen.has(value)) return null;
  seen.add(value);
  if (
    value.personId === G04_EXPECTED_QUERY_ARGUMENTS.personId &&
    value.kind === 'voice' &&
    value.media === 'tv' &&
    isRecord(value.window) &&
    isRecord(value.coverage) &&
    isRecord(value.summary) &&
    Array.isArray(value.rows)
  )
    return value;
  if (Array.isArray(value)) {
    for (const child of value.slice(0, 100)) {
      const found = findPersonActivity(child, seen, depth + 1);
      if (found) return found;
    }
    return null;
  }
  for (const key of ['structuredContent', 'data', 'result', 'output', 'content', 'text']) {
    if (!(key in value)) continue;
    const found = findPersonActivity(value[key], seen, depth + 1);
    if (found) return found;
  }
  return null;
}

function parseAnswer(answer) {
  return parseObject(answer);
}

function projectCoverage(coverage) {
  if (!isRecord(coverage)) return null;
  const output = {};
  for (const field of COVERAGE_FIELDS) {
    const value = coverage[field];
    if (field === 'outputTruncated' || field === 'truncated') {
      if (typeof value !== 'boolean') return null;
    } else if (!Number.isInteger(value) || value < 0) {
      return null;
    }
    output[field] = value;
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
    relationId: row.relationId ?? null,
    characterName: row.characterName ?? null,
    rawRole: row.rawRole ?? null,
    roleFamily: row.roleFamily,
  };
}

function validRow(row, window) {
  return (
    isRecord(row) &&
    Number.isInteger(row.subjectId) &&
    row.subjectId > 0 &&
    typeof (row.subjectNameCn || row.subjectName) === 'string' &&
    typeof row.firstAirDate === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/u.test(row.firstAirDate) &&
    row.firstAirDate >= window.start &&
    row.firstAirDate <= window.end &&
    row.month === row.firstAirDate.slice(0, 7) &&
    row.relationKind === 'voice' &&
    (row.relationId === undefined || (Number.isInteger(row.relationId) && row.relationId > 0)) &&
    (row.characterName === undefined || typeof row.characterName === 'string') &&
    (row.rawRole === undefined || typeof row.rawRole === 'string') &&
    ['main', 'support', 'unknown'].includes(row.roleFamily)
  );
}

function validCalendarWindow(window) {
  if (
    !isRecord(window) ||
    window.months !== 12 ||
    window.asOfSemantics !== 'calendar_months_ending_on_as_of_date' ||
    typeof window.start !== 'string' ||
    typeof window.end !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/u.test(window.start) ||
    !/^\d{4}-\d{2}-\d{2}$/u.test(window.end) ||
    !Array.isArray(window.monthKeys)
  )
    return false;
  const end = new Date(`${window.end}T00:00:00.000Z`);
  if (!Number.isFinite(end.getTime()) || end.toISOString().slice(0, 10) !== window.end)
    return false;
  const expectedStart = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 11, 1))
    .toISOString()
    .slice(0, 10);
  const expectedMonthKeys = Array.from({ length: 12 }, (_, index) => {
    const month = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - 11 + index, 1));
    return month.toISOString().slice(0, 7);
  });
  return window.start === expectedStart && sameJson(window.monthKeys, expectedMonthKeys);
}

function coverageIsConsistent(coverage, result, rows) {
  return (
    coverage.relationRowsSelected <= coverage.relationRowsObserved &&
    coverage.relationRowsDroppedAtLimit ===
      coverage.relationRowsObserved - coverage.relationRowsSelected &&
    coverage.relationRowsSelected <= G04_EXPECTED_QUERY_ARGUMENTS.maxRelations &&
    coverage.subjectIdsSelected <= coverage.subjectIdsObserved &&
    coverage.subjectIdsDroppedAtRelationLimit ===
      coverage.subjectIdsObserved - coverage.subjectIdsSelected &&
    coverage.subjectDetailIdsObserved === coverage.subjectIdsSelected &&
    coverage.subjectDetailRequests <= G04_EXPECTED_QUERY_ARGUMENTS.maxSubjectDetails &&
    coverage.subjectDetailsSucceeded + coverage.subjectDetailsFailed ===
      coverage.subjectDetailRequests &&
    coverage.subjectDetailIdsDroppedAtLimit ===
      Math.max(0, coverage.subjectIdsSelected - coverage.subjectDetailRequests) &&
    coverage.rowsEligible >= coverage.rowsReturned &&
    coverage.rowsReturned === rows.length &&
    coverage.rowsReturned <= G04_EXPECTED_QUERY_ARGUMENTS.maxRows &&
    coverage.outputTruncated === coverage.rowsEligible > coverage.rowsReturned &&
    coverage.uniqueSubjects === result.summary.uniqueSubjects &&
    coverage.uniqueCharacters === result.summary.uniqueCharacters &&
    coverage.maxRelations === G04_EXPECTED_QUERY_ARGUMENTS.maxRelations &&
    coverage.maxSubjectDetails === G04_EXPECTED_QUERY_ARGUMENTS.maxSubjectDetails &&
    coverage.maxRows === G04_EXPECTED_QUERY_ARGUMENTS.maxRows &&
    coverage.responseLimitBytes === 1_048_576 &&
    coverage.truncated ===
      (coverage.relationRowsDroppedAtLimit > 0 ||
        coverage.subjectDetailIdsDroppedAtLimit > 0 ||
        coverage.outputTruncated)
  );
}

function completeStateCoverageIsConsistent(result, coverage, rows) {
  if (result?.state !== 'complete') return true;
  const warnings = result?.warnings;
  return (
    completeOriginCoverageIsConsistent(result) &&
    Array.isArray(warnings) &&
    warnings.every(
      (warning) =>
        isRecord(warning) &&
        typeof warning.code === 'string' &&
        warning.code.trim().length > 0 &&
        warning.state === 'complete' &&
        typeof warning.message === 'string' &&
        warning.message.trim().length > 0,
    ) &&
    coverage.relationRowsDroppedAtLimit === 0 &&
    coverage.subjectIdsDroppedAtRelationLimit === 0 &&
    coverage.subjectDetailIdsDroppedAtLimit === 0 &&
    coverage.subjectDetailsFailed === 0 &&
    !coverage.outputTruncated &&
    !coverage.truncated &&
    coverage.missingSubjectIdRows === 0 &&
    coverage.missingDateRows === 0 &&
    coverage.invalidDateRows === 0 &&
    coverage.mediaUnknownRows === 0 &&
    !rows.some((row) => row?.roleFamily === 'unknown') &&
    result.coverage.origin.subjectsPartial === 0 &&
    result.coverage.origin.malformedTagValues === 0 &&
    result.coverage.origin.truncated === false
  );
}

function completeOriginCoverageIsConsistent(result) {
  const origin = result?.coverage?.origin;
  const summaryOrigin = result?.summary?.origin;
  if (
    !isRecord(origin) ||
    !sameJson(Object.keys(origin).sort(), [...ORIGIN_COVERAGE_FIELDS].sort()) ||
    !isRecord(summaryOrigin) ||
    !sameJson(Object.keys(summaryOrigin).sort(), [...ORIGIN_SUMMARY_FIELDS].sort())
  ) {
    return false;
  }

  const expected = deriveCompleteOriginEvidence(result.rows);
  return Boolean(
    expected &&
    origin.subjectsObserved === result.summary.uniqueSubjects &&
    sameJson(summaryOrigin, expected.summary) &&
    sameJson(origin, expected.coverage),
  );
}

function isValidMetaTagsCoverage(value, hasMetaTags) {
  if (
    !isRecord(value) ||
    !ORIGIN_META_TAG_COVERAGE_FIELDS.every((field) => Object.hasOwn(value, field)) ||
    Object.keys(value).some((field) => !ORIGIN_META_TAG_COVERAGE_FIELDS.includes(field)) ||
    !['complete', 'partial', 'unknown'].includes(value.state) ||
    typeof value.truncated !== 'boolean'
  ) {
    return false;
  }

  const countFields = ['observed', 'valid', 'returned', 'omitted', 'malformed', 'textTruncated'];
  if (
    countFields.some((field) => !Number.isSafeInteger(value[field]) || value[field] < 0) ||
    value.maxItems !== 32 ||
    value.maxCharacters !== 96
  ) {
    return false;
  }

  const malformedNonArrayField =
    !hasMetaTags &&
    value.state === 'unknown' &&
    value.observed === 0 &&
    value.valid === 0 &&
    value.returned === 0 &&
    value.omitted === 0 &&
    value.malformed === 1 &&
    value.textTruncated === 0;

  return (
    (value.valid + value.malformed === value.observed || malformedNonArrayField) &&
    value.returned + value.omitted === value.valid &&
    value.returned <= value.maxItems &&
    value.textTruncated <= value.returned &&
    value.truncated === (value.omitted > 0 || value.textTruncated > 0)
  );
}

function isValidOriginObservation(value) {
  if (
    !isRecord(value) ||
    Object.keys(value).some((field) => !ORIGIN_OBSERVATION_FIELDS.includes(field)) ||
    !['explicit_original', 'not_observed', 'unknown'].includes(value.state) ||
    !Object.hasOwn(value, 'metaTagsCoverage') ||
    (Object.hasOwn(value, 'metaTags') &&
      (!Array.isArray(value.metaTags) || value.metaTags.some((tag) => typeof tag !== 'string'))) ||
    !isValidMetaTagsCoverage(value.metaTagsCoverage, Object.hasOwn(value, 'metaTags'))
  ) {
    return false;
  }

  const tagsCoverage = value.metaTagsCoverage;
  if (!Array.isArray(value.metaTags)) {
    return (
      tagsCoverage.state === 'unknown' &&
      tagsCoverage.observed === 0 &&
      tagsCoverage.valid === 0 &&
      tagsCoverage.returned === 0 &&
      tagsCoverage.omitted === 0 &&
      tagsCoverage.malformed <= 1 &&
      tagsCoverage.textTruncated === 0 &&
      value.state === 'unknown'
    );
  }

  if (
    value.metaTags.length !== tagsCoverage.returned ||
    value.metaTags.some((tag) => Array.from(tag).length > tagsCoverage.maxCharacters)
  ) {
    return false;
  }

  const expectedCoverageState =
    tagsCoverage.malformed > 0
      ? tagsCoverage.valid > 0
        ? 'partial'
        : 'unknown'
      : tagsCoverage.omitted > 0 || tagsCoverage.textTruncated > 0
        ? 'partial'
        : 'complete';
  if (tagsCoverage.state !== expectedCoverageState) return false;

  const expectedState =
    tagsCoverage.state !== 'unknown' && value.metaTags.includes('原创')
      ? 'explicit_original'
      : tagsCoverage.state === 'complete'
        ? 'not_observed'
        : 'unknown';
  return value.state === expectedState;
}

function deriveCompleteOriginEvidence(rows) {
  const bySubject = new Map();
  for (const row of rows) {
    if (!isRecord(row) || !isValidOriginObservation(row.origin)) return null;
    const existing = bySubject.get(row.subjectId);
    if (existing === undefined) {
      bySubject.set(row.subjectId, row.origin);
    } else if (!sameJson(existing, row.origin)) {
      // One detail projection supplies every credit row for a subject. Conflicting
      // copies cannot be conservatively reduced without losing coverage evidence.
      return null;
    }
  }

  const summary = {
    explicitOriginalSubjects: 0,
    notObservedSubjects: 0,
    unknownSubjects: 0,
  };
  const coverage = {
    ...summary,
    subjectsObserved: bySubject.size,
    subjectsWithMetaTags: 0,
    subjectsPartial: 0,
    subjectsUnknown: 0,
    tagsObserved: 0,
    tagsValid: 0,
    tagsReturned: 0,
    tagsOmitted: 0,
    malformedTagValues: 0,
    textTruncatedTags: 0,
    truncatedSubjects: 0,
    truncated: false,
    maxTagsPerSubject: 32,
    maxTagCharacters: 96,
    responseLimitBytes: 1_048_576,
  };

  for (const observation of bySubject.values()) {
    if (observation.state === 'explicit_original') summary.explicitOriginalSubjects += 1;
    else if (observation.state === 'not_observed') summary.notObservedSubjects += 1;
    else summary.unknownSubjects += 1;

    const tagsCoverage = observation.metaTagsCoverage;

    if (tagsCoverage.state === 'unknown') coverage.subjectsUnknown += 1;
    else {
      coverage.subjectsWithMetaTags += 1;
      if (tagsCoverage.state === 'partial') coverage.subjectsPartial += 1;
    }
    coverage.tagsObserved += tagsCoverage.observed;
    coverage.tagsValid += tagsCoverage.valid;
    coverage.tagsReturned += tagsCoverage.returned;
    coverage.tagsOmitted += tagsCoverage.omitted;
    coverage.malformedTagValues += tagsCoverage.malformed;
    coverage.textTruncatedTags += tagsCoverage.textTruncated;
    if (tagsCoverage.truncated) coverage.truncatedSubjects += 1;
  }

  coverage.explicitOriginalSubjects = summary.explicitOriginalSubjects;
  coverage.notObservedSubjects = summary.notObservedSubjects;
  coverage.unknownSubjects = summary.unknownSubjects;
  coverage.truncated =
    coverage.tagsOmitted > 0 || coverage.textTruncatedTags > 0 || coverage.truncatedSubjects > 0;
  return { summary, coverage };
}

function sourceOperationsAreConsistent(result, coverage) {
  if (!Array.isArray(result.sourceOperations) || result.sourceOperations.length !== 3) return false;
  const byPath = new Map(result.sourceOperations.map((entry) => [entry.operation, entry]));
  if (byPath.size !== 3) return false;
  const person = byPath.get('GET /v0/persons/{person_id}');
  const relations = byPath.get('GET /v0/persons/{person_id}/characters');
  const details = byPath.get('GET /v0/subjects/{subject_id}');
  return (
    byPath.size === 3 &&
    person?.attempted === 1 &&
    person.succeeded === 1 &&
    person.failed === 0 &&
    relations?.attempted === 1 &&
    relations.succeeded === 1 &&
    relations.failed === 0 &&
    details?.attempted === coverage.subjectDetailRequests &&
    details.succeeded === coverage.subjectDetailsSucceeded &&
    details.failed === coverage.subjectDetailsFailed
  );
}

function hasUnsupportedPositiveClaim(value) {
  if (typeof value === 'string') {
    return value.split(/[。！？!?；;\n]/u).some((clause) =>
      UNSUPPORTED_CLAIM_PATTERNS.some((pattern) => {
        for (const match of clause.matchAll(new RegExp(pattern.source, `${pattern.flags}g`))) {
          const start = match.index ?? 0;
          const end = start + match[0].length;
          const before = clause.slice(Math.max(0, start - 48), start);
          const after = clause.slice(end, end + 48);
          const locallyNegated =
            CLAIM_NEGATION_BEFORE.test(before) || CLAIM_NEGATION_AFTER.test(after);
          const doubleNegated = [...before.matchAll(ENGLISH_NEGATION)].length > 1;
          if (!locallyNegated || doubleNegated) return true;
        }
        return false;
      }),
    );
  }
  if (Array.isArray(value)) return value.some(hasUnsupportedPositiveClaim);
  if (isRecord(value)) return Object.values(value).some(hasUnsupportedPositiveClaim);
  return false;
}

function answerRowMatches(answerRow, resultRow, window) {
  if (!isRecord(answerRow)) return false;
  const expected = rowProjection(resultRow);
  const allowedKeys = new Set(Object.keys(expected));
  return (
    Object.keys(answerRow).every((key) => allowedKeys.has(key)) &&
    sameJson(answerRow, expected) &&
    validRow(resultRow, window)
  );
}

export function summarizeG04PersonActivityResult(result) {
  const coverage = projectCoverage(result?.coverage);
  const window = projectWindow(result?.window);
  if (!coverage || !window || !isRecord(result?.summary) || !Array.isArray(result?.rows))
    return null;
  return {
    personId: result.personId,
    kind: result.kind,
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
  };
}

export function verifyG04PersonActivityAnswer(
  answer,
  queryArguments,
  toolOutput,
  toolCalls,
  toolTextUtf8Bytes,
) {
  const parsed = parseAnswer(answer);
  const structuredResult = isRecord(toolOutput?.structuredContent)
    ? findPersonActivity(toolOutput.structuredContent)
    : null;
  const result = structuredResult ?? findPersonActivity(toolOutput);
  const coverage = projectCoverage(result?.coverage);
  const window = projectWindow(result?.window);
  const rows = Array.isArray(result?.rows) ? result.rows : [];
  const exactSingleToolCall =
    Array.isArray(toolCalls) &&
    toolCalls.length === 1 &&
    toolCalls[0]?.name === 'bangumi.get_person_activity' &&
    toolCalls[0]?.state === 'DONE' &&
    sameJson(toolCalls[0]?.arguments, G04_EXPECTED_QUERY_ARGUMENTS);
  const rowValidity =
    rows.length <= G04_EXPECTED_QUERY_ARGUMENTS.maxRows &&
    rows.every((row) => validRow(row, result?.window));
  const distinctRows =
    new Set(rows.map((row) => `${row.subjectId}:${row.relationId ?? ''}`)).size === rows.length;
  const summaryValid =
    isRecord(result?.summary) &&
    Number.isInteger(result.summary.creditRows) &&
    result.summary.creditRows >= 0 &&
    Number.isInteger(result.summary.uniqueSubjects) &&
    result.summary.uniqueSubjects >= 0 &&
    Number.isInteger(result.summary.uniqueCharacters) &&
    result.summary.uniqueCharacters >= 0 &&
    result.summary.creditRows === coverage?.rowsEligible &&
    result.summary.uniqueSubjects <= result.summary.creditRows &&
    result.summary.uniqueCharacters <= result.summary.creditRows;
  const stateValid = ['complete', 'partial'].includes(result?.state);
  const caveat = parsed?.caveat;
  const caveatValid = caveat === G04_REQUIRED_CAVEAT;
  const expectedCoverage = coverage;
  const expectedRows = rows.map(rowProjection);
  const answerRows = Array.isArray(parsed?.rows) ? parsed.rows : [];
  const checks = {
    exactQueryArguments: sameJson(queryArguments, G04_EXPECTED_QUERY_ARGUMENTS),
    exactSingleToolCall,
    structuredResultReadback: Boolean(structuredResult),
    targetIdentityAndScope:
      result?.personId === G04_EXPECTED_QUERY_ARGUMENTS.personId &&
      result.kind === 'voice' &&
      result.media === 'tv',
    calendarWindowValid:
      validCalendarWindow(result?.window) &&
      isRecord(parsed?.window) &&
      sameJson(parsed.window, window),
    successfulOfficialSources: stateValid && sourceOperationsAreConsistent(result, coverage ?? {}),
    boundedCoverageConsistent: Boolean(
      coverage &&
      summaryValid &&
      coverageIsConsistent(coverage, result, rows) &&
      completeStateCoverageIsConsistent(result, coverage, rows),
    ),
    sourceRowsValid: rowValidity,
    sourceRowsDistinct: distinctRows,
    answerShapeValid:
      isRecord(parsed) &&
      Object.keys(parsed).length === ANSWER_KEYS.length &&
      ANSWER_KEYS.every((key) => Object.hasOwn(parsed, key)),
    answerIdentityAndStateMatch:
      parsed?.personId === result?.personId &&
      parsed?.kind === result?.kind &&
      parsed?.media === result?.media &&
      parsed?.state === result?.state,
    observedCountMatches: parsed?.observedUniqueWorks === result?.summary?.uniqueSubjects,
    answerSummaryMatches: sameJson(parsed?.summary, {
      creditRows: result?.summary?.creditRows,
      uniqueSubjects: result?.summary?.uniqueSubjects,
      uniqueCharacters: result?.summary?.uniqueCharacters,
    }),
    answerCoverageMatches: Boolean(
      expectedCoverage &&
      isRecord(parsed?.coverage) &&
      Object.keys(parsed.coverage).length === ANSWER_COVERAGE_KEYS.size &&
      Object.keys(parsed.coverage).every((key) => ANSWER_COVERAGE_KEYS.has(key)) &&
      sameJson(parsed.coverage, expectedCoverage),
    ),
    answerRowsMatch:
      answerRows.length === expectedRows.length &&
      expectedRows.every((expected, index) =>
        answerRowMatches(answerRows[index], rows[index], result.window),
      ),
    caveatDisclosurePresent: caveatValid,
    noUnsupportedPositiveClaim: !hasUnsupportedPositiveClaim(parsed),
    plainJsonWithoutMarkdown:
      typeof answer === 'string' &&
      parsed !== null &&
      !/^\s*```/u.test(answer) &&
      !/^\s*#/mu.test(answer),
    boundedAnswerBytes: typeof answer === 'string' && Buffer.byteLength(answer, 'utf8') <= 16_384,
    boundedMcpTextView:
      Number.isInteger(toolTextUtf8Bytes) && toolTextUtf8Bytes > 0 && toolTextUtf8Bytes <= 3600,
  };
  const passed = Object.values(checks).every(Boolean);
  const answerCounters = {
    sourceRows: rows.length,
    answerRows: answerRows.length,
    rowsMatched: expectedRows.filter((expected, index) =>
      answerRowMatches(answerRows[index], rows[index], result?.window),
    ).length,
    missingRows: Math.max(0, rows.length - answerRows.length),
    extraRows: Math.max(0, answerRows.length - rows.length),
    coverageFieldsMatched: expectedCoverage ? Object.keys(expectedCoverage).length : 0,
    toolTextUtf8Bytes: Number.isInteger(toolTextUtf8Bytes) ? toolTextUtf8Bytes : 0,
  };
  return {
    passed,
    answerChecks: checks,
    answerCounters,
    resultSummary: result ? summarizeG04PersonActivityResult(result) : null,
    resultSha256: result ? sha256(JSON.stringify(result)) : null,
    resultByteLength: result ? Buffer.byteLength(JSON.stringify(result), 'utf8') : 0,
    answerSha256: typeof answer === 'string' ? sha256(answer) : null,
    answerUtf8Bytes: typeof answer === 'string' ? Buffer.byteLength(answer, 'utf8') : 0,
  };
}
