import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';

export const G19_ANSWER_CHECK_METHOD = 'g19-bounded-person-origin-answer-v1';
export const G19_ARGUMENT_PROFILE = 'fixed-g19-person-3474-all-anime-3m-48r-16d-8rows-v1';
export const G19_EXPECTED_QUERY_ARGUMENTS = Object.freeze({
  personId: 3474,
  kind: 'all',
  media: 'anime',
  windowMonths: 3,
  maxRelations: 48,
  maxSubjectDetails: 16,
  maxRows: 8,
});

export const G19_COVERAGE_FIELDS = Object.freeze([
  'relationRowsObserved', 'relationRowsSelected', 'relationRowsDroppedAtLimit',
  'relationSelectionStrategy', 'sampled', 'subjectIdsObserved', 'subjectIdsSelected',
  'subjectIdsDroppedAtRelationLimit', 'subjectDetailIdsObserved', 'subjectDetailRequests',
  'subjectDetailsSucceeded', 'subjectDetailsFailed', 'subjectDetailIdsDroppedAtLimit',
  'rowsEligible', 'rowsReturned', 'outputTruncated', 'uniqueSubjects', 'uniqueCharacters',
  'missingSubjectIdRows', 'missingDateRows', 'invalidDateRows', 'outsideWindowRows',
  'mediaExcludedRows', 'mediaUnknownRows', 'staffRoleExcludedRows', 'staffRoleUnknownRows',
  'maxRelations', 'maxSubjectDetails', 'maxRows', 'detailConcurrency', 'responseLimitBytes',
  'truncated', 'origin',
]);
export const G19_ORIGIN_COVERAGE_FIELDS = Object.freeze([
  'explicitOriginalSubjects', 'notObservedSubjects', 'unknownSubjects', 'subjectsObserved',
  'subjectsWithMetaTags', 'subjectsPartial', 'subjectsUnknown', 'tagsObserved', 'tagsValid',
  'tagsReturned', 'tagsOmitted', 'malformedTagValues', 'textTruncatedTags', 'truncatedSubjects',
  'truncated', 'maxTagsPerSubject', 'maxTagCharacters', 'responseLimitBytes',
]);

const ANSWER_KEYS = [
  'personId', 'kind', 'media', 'window', 'state', 'summary', 'coverage', 'rows',
  'groupsScope', 'explicitOriginalSubjectIds', 'notObservedSubjectIds', 'unknownSubjectIds',
  'adaptationStatus', 'caveat',
];
const SUMMARY_KEYS = ['creditRows', 'uniqueSubjects', 'uniqueCharacters', 'origin'];
const ORIGIN_SUMMARY_KEYS = ['explicitOriginalSubjects', 'notObservedSubjects', 'unknownSubjects'];
const WINDOW_KEYS = ['months', 'start', 'end', 'monthKeys', 'asOfSemantics'];
const ORIGIN_TAG_COVERAGE_KEYS = [
  'state', 'observed', 'valid', 'returned', 'omitted', 'malformed', 'textTruncated', 'truncated',
  'maxItems', 'maxCharacters',
];
const APPROVED_CAVEAT = '本次仅观察当前官方关系与最近3个日历月内有界返回的作品；未返回作品不等于不存在。仅 subject.meta_tags 含精确“原创”才标记明确原创；not_observed 和 unknown 均不表示改编。其他标签不构成改编证据；当前来源、关系/详情/输出上限不支持完整改编分类、完整履历或历史快照。';

const isRecord = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const canonical = (value) => Array.isArray(value)
  ? value.map(canonical)
  : isRecord(value)
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]))
    : value;
const canonicalJson = (value) => JSON.stringify(canonical(value));
const sameJson = (left, right) => canonicalJson(left) === canonicalJson(right);
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function parseAnswer(value) {
  if (typeof value !== 'string' || Buffer.byteLength(value, 'utf8') > 16_384 || /^\s*```/u.test(value)) return null;
  try {
    const parsed = JSON.parse(value);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function findG19Activity(value, seen = new Set(), depth = 0) {
  if (typeof value === 'string') {
    try { return findG19Activity(JSON.parse(value), seen, depth + 1); } catch { return null; }
  }
  if (depth > 12 || !value || typeof value !== 'object' || seen.has(value)) return null;
  seen.add(value);
  if (Array.isArray(value)) {
    for (const child of value.slice(0, 100)) {
      const found = findG19Activity(child, seen, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (!isRecord(value)) return null;
  if (value.personId === G19_EXPECTED_QUERY_ARGUMENTS.personId && value.kind === 'all' &&
      value.media === 'anime' && isRecord(value.window) && isRecord(value.coverage) &&
      isRecord(value.summary) && Array.isArray(value.rows)) return value;
  for (const key of ['structuredContent', 'data', 'result', 'output', 'content', 'text']) {
    if (key in value) {
      const found = findG19Activity(value[key], seen, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

function nonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function validDateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function projectTagCoverage(value) {
  if (!isRecord(value) || !['complete', 'partial', 'unknown'].includes(value.state)) return null;
  const result = {};
  for (const key of ORIGIN_TAG_COVERAGE_KEYS) {
    if (key === 'state') result[key] = value[key];
    else if (key === 'truncated') {
      if (typeof value[key] !== 'boolean') return null;
      result[key] = value[key];
    } else if (key === 'maxItems' || key === 'maxCharacters') {
      if (value[key] !== undefined) {
        if (!nonNegativeInteger(value[key])) return null;
        result[key] = value[key];
      }
    } else {
      if (!nonNegativeInteger(value[key])) return null;
      result[key] = value[key];
    }
  }
  if (result.valid + result.malformed !== result.observed ||
      result.returned + result.omitted !== result.valid || result.textTruncated > result.returned ||
      result.truncated !== (result.omitted > 0 || result.textTruncated > 0) ||
      result.state === 'complete' && (result.omitted > 0 || result.malformed > 0 || result.textTruncated > 0)) return null;
  return result;
}

function projectOrigin(origin) {
  if (!isRecord(origin) || !['explicit_original', 'not_observed', 'unknown'].includes(origin.state)) return null;
  const result = { state: origin.state };
  if (origin.metaTags !== undefined) {
    if (!Array.isArray(origin.metaTags) || origin.metaTags.length > 32 ||
        origin.metaTags.some((tag) => typeof tag !== 'string' || tag.length > 96)) return null;
    result.metaTags = [...origin.metaTags];
  }
  if (origin.metaTagsCoverage !== undefined) {
    const coverage = projectTagCoverage(origin.metaTagsCoverage);
    if (!coverage) return null;
    result.metaTagsCoverage = coverage;
  }
  const tags = result.metaTags;
  const hasOriginal = Array.isArray(tags) && tags.includes('原创');
  const reliable = result.metaTagsCoverage?.state !== 'unknown';
  if (result.state === 'explicit_original' && (!hasOriginal || !reliable)) return null;
  if (result.state === 'not_observed' &&
      (!Array.isArray(tags) || hasOriginal || (result.metaTagsCoverage && result.metaTagsCoverage.state !== 'complete'))) return null;
  if (result.state === 'unknown' &&
      (hasOriginal && reliable || Array.isArray(tags) && !hasOriginal &&
        (!result.metaTagsCoverage || result.metaTagsCoverage.state === 'complete') ||
        tags === undefined && result.metaTagsCoverage?.state === 'complete')) return null;
  return result;
}

function projectRow(row, window) {
  if (!isRecord(row) || !Number.isSafeInteger(row.subjectId) || row.subjectId < 1 ||
      typeof (row.subjectNameCn || row.subjectName) !== 'string' ||
      !validDateOnly(row.firstAirDate) ||
      row.subjectType !== 'anime' ||
      row.firstAirDate < window.start || row.firstAirDate > window.end ||
      row.month !== row.firstAirDate.slice(0, 7) || !['voice', 'staff'].includes(row.relationKind) ||
      !['main', 'support', 'staff', 'unknown'].includes(row.roleFamily) ||
      row.relationId !== undefined && (!Number.isSafeInteger(row.relationId) || row.relationId < 1) ||
      row.rawRole !== undefined && typeof row.rawRole !== 'string') return null;
  const origin = projectOrigin(row.origin);
  if (!origin) return null;
  return {
    subjectId: row.subjectId,
    title: row.subjectNameCn || row.subjectName,
    firstAirDate: row.firstAirDate,
    month: row.month,
    relationKind: row.relationKind,
    ...(row.relationId === undefined ? {} : { relationId: row.relationId }),
    ...(row.rawRole === undefined ? {} : { rawRole: row.rawRole }),
    roleFamily: row.roleFamily,
    origin,
  };
}

function projectWindow(value, retrievedAt) {
  if (!isRecord(value) || !sameJson(Object.keys(value).sort(), [...WINDOW_KEYS].sort()) ||
      value.months !== G19_EXPECTED_QUERY_ARGUMENTS.windowMonths ||
      value.asOfSemantics !== 'calendar_months_ending_on_as_of_date' ||
      !/^\d{4}-\d{2}-\d{2}$/u.test(value.start ?? '') ||
      !/^\d{4}-\d{2}-\d{2}$/u.test(value.end ?? '') || !Array.isArray(value.monthKeys) ||
      value.monthKeys.length !== value.months) return null;
  const months = value.monthKeys;
  if (months.some((month, index) => !/^\d{4}-(?:0[1-9]|1[0-2])$/u.test(month) ||
      index > 0 && month !== nextMonth(months[index - 1]))) return null;
  if (value.start.slice(0, 7) !== months[0] || value.start.slice(8) !== '01' ||
      value.end.slice(0, 7) !== months.at(-1) || value.start > value.end) return null;
  if (!Number.isFinite(Date.parse(`${value.start}T00:00:00.000Z`)) ||
      !Number.isFinite(Date.parse(`${value.end}T00:00:00.000Z`)) ||
      new Date(`${value.end}T00:00:00.000Z`).toISOString().slice(0, 10) !== value.end) return null;
  const observed = new Date(retrievedAt);
  const end = Date.parse(`${value.end}T00:00:00.000Z`);
  if (!Number.isFinite(observed.getTime()) || !Number.isFinite(end) || Math.abs(observed.getTime() - end) > 86_400_000) return null;
  return { months: value.months, start: value.start, end: value.end, monthKeys: [...months], asOfSemantics: value.asOfSemantics };
}

function nextMonth(value) {
  const [year, month] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 7);
}

function projectOriginCoverage(value) {
  if (!isRecord(value)) return null;
  const result = {};
  for (const key of G19_ORIGIN_COVERAGE_FIELDS) {
    if (key === 'truncated') {
      if (typeof value[key] !== 'boolean') return null;
      result[key] = value[key];
    } else {
      if (!nonNegativeInteger(value[key])) return null;
      result[key] = value[key];
    }
  }
  return result;
}

function projectCoverage(value) {
  if (!isRecord(value)) return null;
  const result = {};
  for (const key of G19_COVERAGE_FIELDS) {
    const item = value[key];
    if (key === 'origin') {
      const origin = projectOriginCoverage(item);
      if (!origin) return null;
      result[key] = origin;
    } else if (key === 'relationSelectionStrategy') {
      if (!['all', 'deterministic_even_spread'].includes(item)) return null;
      result[key] = item;
    } else if (key === 'sampled' || key === 'outputTruncated' || key === 'truncated') {
      if (typeof item !== 'boolean') return null;
      result[key] = item;
    } else {
      if (!nonNegativeInteger(item)) return null;
      result[key] = item;
    }
  }
  return result;
}

function projectSummary(value) {
  if (!isRecord(value) || !sameJson(Object.keys(value).sort(), [...SUMMARY_KEYS].sort()) ||
      !nonNegativeInteger(value.creditRows) || !nonNegativeInteger(value.uniqueSubjects) ||
      !nonNegativeInteger(value.uniqueCharacters) || !isRecord(value.origin) ||
      !sameJson(Object.keys(value.origin).sort(), [...ORIGIN_SUMMARY_KEYS].sort()) ||
      Object.values(value.origin).some((item) => !nonNegativeInteger(item))) return null;
  return {
    creditRows: value.creditRows,
    uniqueSubjects: value.uniqueSubjects,
    uniqueCharacters: value.uniqueCharacters,
    origin: {
      explicitOriginalSubjects: value.origin.explicitOriginalSubjects,
      notObservedSubjects: value.origin.notObservedSubjects,
      unknownSubjects: value.origin.unknownSubjects,
    },
  };
}

function coverageConsistent(result, coverage, summary, rows) {
  const origin = coverage.origin;
  const originSummary = summary.origin;
  const relationObserved = coverage.relationRowsSelected + coverage.relationRowsDroppedAtLimit;
  const originTotal = origin.explicitOriginalSubjects + origin.notObservedSubjects + origin.unknownSubjects;
  const rowOrigins = new Map();
  for (const row of rows) {
    const prior = rowOrigins.get(row.subjectId);
    rowOrigins.set(row.subjectId, prior && prior !== row.origin.state ? 'unknown' : row.origin.state);
  }
  const visibleCounts = { explicit_original: 0, not_observed: 0, unknown: 0 };
  for (const state of rowOrigins.values()) visibleCounts[state] += 1;
  return coverage.relationRowsSelected <= coverage.maxRelations &&
    coverage.relationRowsObserved === relationObserved &&
    coverage.relationSelectionStrategy === (coverage.relationRowsDroppedAtLimit > 0 ? 'deterministic_even_spread' : 'all') &&
    coverage.sampled === (coverage.relationRowsDroppedAtLimit > 0) &&
    coverage.subjectIdsSelected <= coverage.subjectIdsObserved &&
    coverage.subjectIdsObserved <= coverage.relationRowsObserved &&
    coverage.subjectIdsDroppedAtRelationLimit === coverage.subjectIdsObserved - coverage.subjectIdsSelected &&
    coverage.subjectDetailIdsObserved === coverage.subjectIdsSelected &&
    coverage.subjectDetailRequests <= coverage.maxSubjectDetails &&
    coverage.subjectDetailsSucceeded + coverage.subjectDetailsFailed === coverage.subjectDetailRequests &&
    coverage.subjectDetailIdsDroppedAtLimit === Math.max(0, coverage.subjectIdsSelected - coverage.subjectDetailRequests) &&
    coverage.rowsEligible === summary.creditRows && coverage.rowsReturned === rows.length &&
    coverage.rowsReturned <= coverage.maxRows && coverage.rowsEligible >= coverage.rowsReturned &&
    coverage.outputTruncated === (coverage.rowsEligible > coverage.rowsReturned) &&
    summary.uniqueSubjects <= summary.creditRows && summary.uniqueCharacters <= summary.creditRows &&
    coverage.uniqueSubjects === summary.uniqueSubjects && coverage.uniqueCharacters === summary.uniqueCharacters &&
    coverage.maxRelations === G19_EXPECTED_QUERY_ARGUMENTS.maxRelations &&
    coverage.maxSubjectDetails === G19_EXPECTED_QUERY_ARGUMENTS.maxSubjectDetails &&
    coverage.maxRows === G19_EXPECTED_QUERY_ARGUMENTS.maxRows && coverage.responseLimitBytes === 1_048_576 &&
    coverage.truncated === (coverage.relationRowsDroppedAtLimit > 0 ||
      coverage.subjectDetailIdsDroppedAtLimit > 0 || coverage.outputTruncated) &&
    originTotal === origin.subjectsObserved && origin.subjectsObserved === originSummary.explicitOriginalSubjects +
      originSummary.notObservedSubjects + originSummary.unknownSubjects &&
    origin.subjectsWithMetaTags + origin.subjectsUnknown === origin.subjectsObserved &&
    origin.subjectsPartial <= origin.subjectsWithMetaTags &&
    origin.tagsValid + origin.malformedTagValues === origin.tagsObserved &&
    origin.tagsReturned + origin.tagsOmitted === origin.tagsValid &&
    origin.textTruncatedTags <= origin.tagsReturned && origin.truncatedSubjects <= origin.subjectsObserved &&
    origin.truncated === (origin.tagsOmitted > 0 || origin.textTruncatedTags > 0 || origin.truncatedSubjects > 0) &&
    origin.maxTagsPerSubject === 32 && origin.maxTagCharacters === 96 &&
    origin.responseLimitBytes === 1_048_576 &&
    origin.subjectsObserved === summary.uniqueSubjects &&
    sameJson(originSummary, summary.origin) && visibleCounts.explicit_original <= originSummary.explicitOriginalSubjects &&
    visibleCounts.not_observed <= originSummary.notObservedSubjects && visibleCounts.unknown <= originSummary.unknownSubjects &&
    (!coverage.outputTruncated || origin.subjectsObserved >= rowOrigins.size) &&
    (!coverage.outputTruncated ? rowOrigins.size === origin.subjectsObserved &&
      visibleCounts.explicit_original === originSummary.explicitOriginalSubjects &&
      visibleCounts.not_observed === originSummary.notObservedSubjects &&
      visibleCounts.unknown === originSummary.unknownSubjects : true) &&
    result.personId === G19_EXPECTED_QUERY_ARGUMENTS.personId;
}

function activityStateMatchesOriginCoverage(result, coverage) {
  const origin = coverage?.origin;
  const originCoverageIsPartial = Boolean(origin && (
    origin.subjectsPartial > 0 || origin.malformedTagValues > 0 || origin.truncated
  ));
  return !originCoverageIsPartial || result?.state === 'partial';
}

function answerRowMatches(answerRow, sourceRow) {
  return isRecord(answerRow) && sameJson(answerRow, sourceRow);
}

function expectedGroups(rows) {
  const bySubject = new Map();
  for (const row of rows) {
    const old = bySubject.get(row.subjectId);
    bySubject.set(row.subjectId, old && old !== row.origin.state ? 'unknown' : row.origin.state);
  }
  const ids = (state) => [...bySubject.entries()].filter(([, item]) => item === state).map(([id]) => id).sort((a, b) => a - b);
  return {
    explicitOriginalSubjectIds: ids('explicit_original'),
    notObservedSubjectIds: ids('not_observed'),
    unknownSubjectIds: ids('unknown'),
  };
}

function officialSourcesValid(result, coverage) {
  if (!Array.isArray(result.sourceOperations)) return false;
  const byOperation = new Map(result.sourceOperations.map((item) => [item?.operation, item]));
  const person = byOperation.get('GET /v0/persons/{person_id}');
  const subjects = byOperation.get('GET /v0/persons/{person_id}/subjects');
  const characters = byOperation.get('GET /v0/persons/{person_id}/characters');
  const details = byOperation.get('GET /v0/subjects/{subject_id}');
  return byOperation.size === 4 && [person, subjects, characters].every((item) =>
    item?.attempted === 1 && item.succeeded === 1 && item.failed === 0) &&
    details?.attempted === coverage.subjectDetailRequests &&
    details.succeeded === coverage.subjectDetailsSucceeded && details.failed === coverage.subjectDetailsFailed;
}

function fullTextResultReadbackMatches(toolOutput, result, toolTextUtf8Bytes) {
  const content = toolOutput?.content;
  if (!Array.isArray(content) || content.length !== 1 || content[0]?.type !== 'text' ||
      typeof content[0].text !== 'string' || !Number.isSafeInteger(toolTextUtf8Bytes) ||
      toolTextUtf8Bytes <= 0 || toolTextUtf8Bytes > 3_600) return false;
  try {
    const fromText = findG19Activity(JSON.parse(content[0].text));
    return Boolean(fromText && sameJson(fromText, result));
  } catch {
    return false;
  }
}

export function summarizeG19PersonActivityResult(result) {
  const window = projectWindow(result?.window, result?.coverage?.retrievedAt);
  const coverage = projectCoverage(result?.coverage);
  const summary = projectSummary(result?.summary);
  const rows = Array.isArray(result?.rows) && window ? result.rows.map((row) => projectRow(row, window)) : null;
  if (!window || !coverage || !summary || !rows || rows.some((row) => !row)) return null;
  const rowDigest = sha256(canonicalJson(rows.map((row) => ({
    subjectId: row.subjectId, relationKind: row.relationKind, originState: row.origin.state,
  }))));
  return {
    personId: result.personId,
    kind: result.kind,
    media: result.media,
    state: result.state,
    window,
    summary,
    coverage,
    rowCount: rows.length,
    rowDigest,
    sourceOperations: result.sourceOperations.map(({ operation, attempted, succeeded, failed }) => ({
      operation, attempted, succeeded, failed,
    })).sort((left, right) => left.operation.localeCompare(right.operation)),
  };
}

export function verifyG19PersonOriginAnswer(answer, queryArguments, toolOutput, toolCalls, toolTextUtf8Bytes) {
  const parsed = parseAnswer(answer);
  const structured = isRecord(toolOutput?.structuredContent)
    ? findG19Activity(toolOutput.structuredContent)
    : null;
  const result = structured ?? findG19Activity(toolOutput);
  const fullTextReadback = !structured && fullTextResultReadbackMatches(toolOutput, result, toolTextUtf8Bytes);
  const window = projectWindow(result?.window, result?.coverage?.retrievedAt);
  const coverage = projectCoverage(result?.coverage);
  const summary = projectSummary(result?.summary);
  const rows = Array.isArray(result?.rows) && window ? result.rows.map((row) => projectRow(row, window)) : [];
  const expectedSummary = summary;
  const expectedGroupsValue = expectedGroups(rows.filter(Boolean));
  const exactSingleToolCall = Array.isArray(toolCalls) && toolCalls.length === 1 &&
    toolCalls[0]?.name === 'bangumi.get_person_activity' && toolCalls[0]?.state === 'DONE' &&
    sameJson(toolCalls[0]?.arguments, G19_EXPECTED_QUERY_ARGUMENTS);
  const stateValid = ['complete', 'partial'].includes(result?.state);
  const sourceRowsValid = rows.length === (Array.isArray(result?.rows) ? result.rows.length : -1) &&
    rows.length <= G19_EXPECTED_QUERY_ARGUMENTS.maxRows && rows.every(Boolean);
  const sourceRowsDistinct = new Set(rows.filter(Boolean).map((row) =>
    `${row.subjectId}:${row.relationKind}:${row.relationId ?? 'none'}`)).size === rows.length;
  const checks = {
    exactQueryArguments: sameJson(queryArguments, G19_EXPECTED_QUERY_ARGUMENTS),
    exactSingleToolCall,
    structuredResultReadback: Boolean(structured || fullTextReadback),
    targetIdentityAndScope: result?.personId === G19_EXPECTED_QUERY_ARGUMENTS.personId &&
      result.kind === 'all' && result.media === 'anime',
    calendarWindowValid: Boolean(window && result?.coverage?.retrievedAt),
    successfulOfficialSources: stateValid && Boolean(coverage && summary && officialSourcesValid(result, coverage)),
    boundedCoverageConsistent: Boolean(coverage && summary && sourceRowsValid &&
      coverageConsistent(result, coverage, summary, rows.filter(Boolean)) &&
      activityStateMatchesOriginCoverage(result, coverage)),
    sourceRowsValid,
    sourceRowsDistinct,
    answerShapeValid: isRecord(parsed) && sameJson(Object.keys(parsed).sort(), [...ANSWER_KEYS].sort()),
    answerIdentityAndStateMatch: parsed?.personId === result?.personId && parsed?.kind === result?.kind &&
      parsed?.media === result?.media && parsed?.state === result?.state,
    answerWindowMatches: Boolean(window && sameJson(parsed?.window, window)),
    answerSummaryMatches: Boolean(summary && sameJson(parsed?.summary, expectedSummary)),
    answerCoverageMatches: Boolean(coverage && sameJson(parsed?.coverage, coverage)),
    answerRowsMatch: Boolean(parsed && Array.isArray(parsed.rows) && parsed.rows.length === rows.length &&
      rows.every((row, index) => row && answerRowMatches(parsed.rows[index], row))),
    answerGroupsMatch: Boolean(parsed && parsed.groupsScope === 'returned_rows_only' &&
      sameJson({
        explicitOriginalSubjectIds: parsed.explicitOriginalSubjectIds,
        notObservedSubjectIds: parsed.notObservedSubjectIds,
        unknownSubjectIds: parsed.unknownSubjectIds,
      }, expectedGroupsValue)),
    adaptationNotInferred: parsed?.adaptationStatus === 'not_supported_by_observed_source',
    caveatDisclosurePresent: parsed?.caveat === APPROVED_CAVEAT,
    plainJsonWithoutMarkdown: typeof answer === 'string' && parsed !== null &&
      !/^\s*#/mu.test(answer),
    boundedAnswerBytes: typeof answer === 'string' && Buffer.byteLength(answer, 'utf8') <= 16_384,
    boundedMcpTextView: Number.isSafeInteger(toolTextUtf8Bytes) && toolTextUtf8Bytes > 0 && toolTextUtf8Bytes <= 3_600,
  };
  const passed = Object.values(checks).every(Boolean);
  const answerRows = Array.isArray(parsed?.rows) ? parsed.rows : [];
  const resultSummary = result ? summarizeG19PersonActivityResult(result) : null;
  const serializedResult = result ? JSON.stringify(result) : '';
  return {
    passed,
    answerChecks: checks,
    answerCounters: {
      sourceRows: rows.filter(Boolean).length,
      answerRows: answerRows.length,
      rowsMatched: rows.filter((row, index) => row && answerRowMatches(answerRows[index], row)).length,
      missingRows: Math.max(0, rows.filter(Boolean).length - answerRows.length),
      extraRows: Math.max(0, answerRows.length - rows.filter(Boolean).length),
      coverageFieldsMatched: coverage ? G19_COVERAGE_FIELDS.length + G19_ORIGIN_COVERAGE_FIELDS.length : 0,
      toolTextUtf8Bytes: Number.isSafeInteger(toolTextUtf8Bytes) ? toolTextUtf8Bytes : 0,
    },
    resultSummary,
    resultByteLength: result ? Buffer.byteLength(serializedResult, 'utf8') : 0,
    resultSha256: result ? sha256(serializedResult) : null,
    answerUtf8Bytes: typeof answer === 'string' ? Buffer.byteLength(answer, 'utf8') : 0,
    answerSha256: typeof answer === 'string' ? sha256(answer) : null,
  };
}

export { APPROVED_CAVEAT as G19_APPROVED_CAVEAT };
