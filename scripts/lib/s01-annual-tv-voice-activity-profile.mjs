import { canonicalJson } from './codex-one-tool-evidence.mjs';

export const S01_PROFILE_ID = 's01-annual-tv-voice-agent-mcp-v1';
export const S01_NETWORK_MODE = 'run95-s01-current-source-annual-tv-agent-mcp-v1';
export const S01_ARGUMENT_PROFILE = 'fixed-s01-voice-tv-36m-48r-16d-8rows-v1';
export const S01_EPOCH_ID = 'run95-s01-current-source-annual-tv-agent-mcp-20261021';
export const S01_TOOL_NAME = 'bangumi.get_person_activity';
export const S01_SERVER_ID = 'bgk_s01_annual_tv_voice';
export const S01_ANSWER_CHECK_METHOD = 's01-yearly-unique-subjects-and-coverage-v1';
export const S01_MAX_RESPONSE_BYTES = 1024 * 1024;
export const S01_MAX_RELATION_IDS = 10_000;
export const S01_EXPECTED_ARGUMENTS = Object.freeze({
  personId: 5745,
  kind: 'voice',
  media: 'tv',
  windowMonths: 36,
  maxRelations: 48,
  maxSubjectDetails: 16,
  maxRows: 8,
});
export const S01_CANONICAL_CAVEAT =
  '统计的是 Bangumi 当前人物、角色与作品关系及有界作品详情中可观察到的记录，按作品首播日期归年；“部”按去重作品数计算，配音关系行数和去重角色数另列。这不是实际配音年份，也不是完整职业生涯总数。若覆盖状态为 partial，各年数字均为本次样本观察值，0 不代表当年没有作品。';
export const S01_ANSWER_CHECK_FIELDS = Object.freeze([
  'answerIsJson',
  'exactKeys',
  'annualCountsMatch',
  'yearRangesMatch',
  'coverageMatches',
  'coverageStateMatches',
  'caveatExact',
  'boundedUtf8',
  'rawIdentityAndTitlesAbsent',
]);

const ALLOWED_HEADERS = Object.freeze({
  accept: 'application/json',
  'user-agent':
    'Kurarion/BangumiAgentKit/0.1.0 (https://github.com/PariyaProject/BangumiAgentKit)',
});
const SUMMARY_KEYS = Object.freeze([
  'state',
  'window',
  'annualObservedCounts',
  'creditRows',
  'uniqueCharacters',
  'coverage',
  'caveat',
]);
const WINDOW_KEYS = Object.freeze(['months', 'start', 'end', 'asOfSemantics']);
const YEAR_KEYS = Object.freeze([
  'year',
  'start',
  'end',
  'creditRows',
  'uniqueSubjects',
  'uniqueCharacters',
]);
const COVERAGE_KEYS = Object.freeze([
  'relationRowsObserved',
  'relationRowsSelected',
  'relationRowsDroppedAtLimit',
  'sampled',
  'observedWorks',
  'selectedWorks',
  'worksDroppedAtRelationLimit',
  'worksEligibleForDetails',
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
  'maxRelations',
  'maxSubjectDetails',
  'maxRows',
  'truncated',
  'retrievedAt',
]);
const COVERAGE_COUNTERS = Object.freeze(COVERAGE_KEYS.filter((key) =>
  [
    'relationRowsObserved',
    'relationRowsSelected',
    'relationRowsDroppedAtLimit',
    'observedWorks',
    'selectedWorks',
    'worksDroppedAtRelationLimit',
    'worksEligibleForDetails',
    'subjectDetailRequests',
    'subjectDetailsSucceeded',
    'subjectDetailsFailed',
    'subjectDetailIdsDroppedAtLimit',
    'rowsEligible',
    'rowsReturned',
    'uniqueSubjects',
    'uniqueCharacters',
    'missingSubjectIdRows',
    'missingDateRows',
    'invalidDateRows',
    'maxRelations',
    'maxSubjectDetails',
    'maxRows',
  ].includes(key),
));
const PUBLIC_SCOPE_KEYS = Object.freeze([
  'requestCount',
  'allowedRequestCount',
  'deniedRequestCount',
  'personDetailRequestCount',
  'characterRelationRequestCount',
  'subjectDetailRequestCount',
  'duplicateSubjectDetailCount',
  'credentialHeaderCount',
  'credentialModeCount',
  'forbiddenHeaderCount',
  'authorizationHeaderCount',
  'writeAttemptCount',
  'unexpectedRouteCount',
  'sequenceMismatchCount',
  'responseValidationFailureCount',
  'redirectResponseCount',
  'maxRequests',
  'maxSubjectDetails',
  'requestsWithinLimit',
  'anonymousOnly',
  'officialV0Only',
  'redirectPolicy',
]);

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

function expectedYearRanges(start, end) {
  const first = Number(start.slice(0, 4));
  const last = Number(end.slice(0, 4));
  return Array.from({ length: last - first + 1 }, (_, index) => {
    const year = first + index;
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year}-12-31`;
    return {
      year,
      start: start > yearStart ? start : yearStart,
      end: end < yearEnd ? end : yearEnd,
    };
  });
}

function expectedWindowStart(end, months) {
  const monthIndex =
    Number(end.slice(0, 4)) * 12 + Number(end.slice(5, 7)) - 1 - (months - 1);
  const year = Math.floor(monthIndex / 12);
  const month = (monthIndex % 12) + 1;
  return `${year}-${String(month).padStart(2, '0')}-01`;
}

function summarizeCoverage(coverage, rowsReturned) {
  if (!coverage || typeof coverage !== 'object' || Array.isArray(coverage)) return null;
  const sourceField = {
    observedWorks: 'subjectIdsObserved',
    selectedWorks: 'subjectIdsSelected',
    worksDroppedAtRelationLimit: 'subjectIdsDroppedAtRelationLimit',
    worksEligibleForDetails: 'subjectDetailIdsObserved',
  };
  const value = Object.fromEntries(
    COVERAGE_KEYS.map((key) => [key, coverage[sourceField[key] ?? key]]),
  );
  if (
    !COVERAGE_KEYS.every((key) => Object.hasOwn(value, key)) ||
    !COVERAGE_COUNTERS.every((key) => nonnegativeInteger(value[key])) ||
    typeof value.sampled !== 'boolean' ||
    typeof value.outputTruncated !== 'boolean' ||
    typeof value.truncated !== 'boolean' ||
    value.rowsReturned !== rowsReturned ||
    value.relationRowsObserved !== value.relationRowsSelected + value.relationRowsDroppedAtLimit ||
    value.subjectDetailsSucceeded + value.subjectDetailsFailed !== value.subjectDetailRequests ||
    value.sampled !==
      (value.relationRowsDroppedAtLimit > 0 || value.subjectDetailIdsDroppedAtLimit > 0) ||
    value.outputTruncated !== (value.rowsEligible > value.rowsReturned) ||
    value.truncated !==
      (value.relationRowsDroppedAtLimit > 0 ||
        value.subjectDetailIdsDroppedAtLimit > 0 ||
        value.outputTruncated) ||
    value.maxRelations !== S01_EXPECTED_ARGUMENTS.maxRelations ||
    value.maxSubjectDetails !== S01_EXPECTED_ARGUMENTS.maxSubjectDetails ||
    value.maxRows !== S01_EXPECTED_ARGUMENTS.maxRows ||
    value.relationRowsSelected > S01_EXPECTED_ARGUMENTS.maxRelations ||
    value.subjectDetailRequests > S01_EXPECTED_ARGUMENTS.maxSubjectDetails ||
    value.rowsReturned > S01_EXPECTED_ARGUMENTS.maxRows ||
    value.rowsEligible < value.rowsReturned ||
    value.uniqueSubjects < 0 ||
    value.uniqueCharacters < 0 ||
    typeof value.retrievedAt !== 'string' ||
    Number.isNaN(Date.parse(value.retrievedAt))
  ) {
    return null;
  }
  return value;
}

export function assertS01AnnualTvVoiceProfile(profile) {
  return Boolean(
    profile &&
      typeof profile === 'object' &&
      profile.id === S01_PROFILE_ID &&
      profile.frontierId === 'S01' &&
      profile.epochId === S01_EPOCH_ID &&
      profile.toolName === S01_TOOL_NAME &&
      profile.argumentProfile === S01_ARGUMENT_PROFILE &&
      profile.networkMode === S01_NETWORK_MODE &&
      profile.acceptanceScope === 'agent-mcp-matrix-only' &&
      profile.model === 'gpt-6-luna' &&
      profile.reasoningEffort === 'max' &&
      Array.isArray(profile.calls) &&
      profile.calls.length === 1 &&
      exactKeys(profile.calls[0], ['toolName', 'arguments']) &&
      profile.calls[0].toolName === S01_TOOL_NAME &&
      canonicalJson(profile.calls[0].arguments) === canonicalJson(S01_EXPECTED_ARGUMENTS),
  );
}

export function summarizeS01AnnualTvVoiceResult(result, expectedArguments = S01_EXPECTED_ARGUMENTS) {
  if (
    canonicalJson(expectedArguments) !== canonicalJson(S01_EXPECTED_ARGUMENTS) ||
    !result ||
    typeof result !== 'object' ||
    Array.isArray(result) ||
    result.personId !== S01_EXPECTED_ARGUMENTS.personId ||
    result.kind !== 'voice' ||
    result.media !== 'tv' ||
    !['complete', 'partial'].includes(result.state) ||
    !Array.isArray(result.rows) ||
    !result.summary ||
    typeof result.summary !== 'object'
  ) {
    return null;
  }
  const window = result.window;
  if (
    !window ||
    window.months !== S01_EXPECTED_ARGUMENTS.windowMonths ||
    !validDateOnly(window.start) ||
    !validDateOnly(window.end) ||
    window.start > window.end ||
    window.start !== expectedWindowStart(window.end, window.months) ||
    window.asOfSemantics !== 'calendar_months_ending_on_as_of_date'
  ) {
    return null;
  }
  const expectedYears = expectedYearRanges(window.start, window.end);
  const byYear = result.summary.byYear;
  if (!Array.isArray(byYear) || byYear.length !== expectedYears.length) return null;
  const annualObservedCounts = [];
  for (let index = 0; index < expectedYears.length; index += 1) {
    const expected = expectedYears[index];
    const actual = byYear[index];
    if (
      !exactKeys(actual, YEAR_KEYS) ||
      actual.year !== expected.year ||
      actual.start !== expected.start ||
      actual.end !== expected.end ||
      !nonnegativeInteger(actual.creditRows) ||
      !nonnegativeInteger(actual.uniqueSubjects) ||
      !nonnegativeInteger(actual.uniqueCharacters) ||
      actual.uniqueSubjects > actual.creditRows ||
      actual.uniqueCharacters > actual.creditRows
    ) {
      return null;
    }
    annualObservedCounts.push({
      year: actual.year,
      start: actual.start,
      end: actual.end,
      creditRows: actual.creditRows,
      uniqueSubjects: actual.uniqueSubjects,
      uniqueCharacters: actual.uniqueCharacters,
    });
  }
  const creditRows = result.summary.creditRows;
  const uniqueSubjects = result.summary.uniqueSubjects;
  const uniqueCharacters = result.summary.uniqueCharacters;
  if (
    !nonnegativeInteger(creditRows) ||
    !nonnegativeInteger(uniqueSubjects) ||
    !nonnegativeInteger(uniqueCharacters) ||
    annualObservedCounts.reduce((sum, item) => sum + item.creditRows, 0) !== creditRows ||
    annualObservedCounts.reduce((sum, item) => sum + item.uniqueSubjects, 0) !== uniqueSubjects
  ) {
    return null;
  }
  const coverage = summarizeCoverage(result.coverage, result.rows.length);
  if (
    !coverage ||
    coverage.rowsEligible !== creditRows ||
    coverage.uniqueSubjects !== uniqueSubjects ||
    coverage.uniqueCharacters !== uniqueCharacters ||
    result.rows.length > S01_EXPECTED_ARGUMENTS.maxRows ||
    (result.state === 'complete' &&
      (coverage.sampled ||
        coverage.outputTruncated ||
        coverage.subjectDetailsFailed > 0 ||
        coverage.missingSubjectIdRows > 0 ||
        coverage.missingDateRows > 0 ||
        coverage.invalidDateRows > 0))
  ) {
    return null;
  }
  const summary = {
    state: result.state,
    window: {
      months: window.months,
      start: window.start,
      end: window.end,
      asOfSemantics: window.asOfSemantics,
    },
    annualObservedCounts,
    creditRows,
    uniqueCharacters,
    coverage,
    caveat: S01_CANONICAL_CAVEAT,
  };
  return validateS01AnnualTvVoiceSummary(summary) ? summary : null;
}

export function validateS01AnnualTvVoiceSummary(summary) {
  if (
    !exactKeys(summary, SUMMARY_KEYS) ||
    !['complete', 'partial'].includes(summary.state) ||
    summary.caveat !== S01_CANONICAL_CAVEAT ||
    !summary.window ||
    !exactKeys(summary.window, WINDOW_KEYS) ||
    summary.window.months !== S01_EXPECTED_ARGUMENTS.windowMonths ||
    !validDateOnly(summary.window.start) ||
    !validDateOnly(summary.window.end) ||
    summary.window.start > summary.window.end ||
    summary.window.start !== expectedWindowStart(summary.window.end, summary.window.months) ||
    summary.window.asOfSemantics !== 'calendar_months_ending_on_as_of_date' ||
    !Array.isArray(summary.annualObservedCounts) ||
    !nonnegativeInteger(summary.creditRows) ||
    !nonnegativeInteger(summary.uniqueCharacters) ||
    summary.uniqueCharacters > summary.creditRows ||
    !summary.coverage ||
    !exactKeys(summary.coverage, COVERAGE_KEYS)
  ) {
    return false;
  }
  const expectedYears = expectedYearRanges(summary.window.start, summary.window.end);
  if (summary.annualObservedCounts.length !== expectedYears.length) return false;
  for (let index = 0; index < expectedYears.length; index += 1) {
    const expected = expectedYears[index];
    const actual = summary.annualObservedCounts[index];
    if (
      !exactKeys(actual, YEAR_KEYS) ||
      actual.year !== expected.year ||
      actual.start !== expected.start ||
      actual.end !== expected.end ||
      !nonnegativeInteger(actual.creditRows) ||
      !nonnegativeInteger(actual.uniqueSubjects) ||
      !nonnegativeInteger(actual.uniqueCharacters) ||
      actual.uniqueSubjects > actual.creditRows ||
      actual.uniqueCharacters > actual.creditRows
    ) {
      return false;
    }
  }
  const coverage = summary.coverage;
  if (
    !COVERAGE_COUNTERS.every((key) => nonnegativeInteger(coverage[key])) ||
    typeof coverage.sampled !== 'boolean' ||
    typeof coverage.outputTruncated !== 'boolean' ||
    typeof coverage.truncated !== 'boolean' ||
    coverage.rowsEligible !== summary.creditRows ||
    coverage.rowsReturned > S01_EXPECTED_ARGUMENTS.maxRows ||
    coverage.rowsEligible < coverage.rowsReturned ||
    coverage.relationRowsObserved !==
      coverage.relationRowsSelected + coverage.relationRowsDroppedAtLimit ||
    coverage.subjectDetailsSucceeded + coverage.subjectDetailsFailed !==
      coverage.subjectDetailRequests ||
    coverage.sampled !==
      (coverage.relationRowsDroppedAtLimit > 0 || coverage.subjectDetailIdsDroppedAtLimit > 0) ||
    coverage.outputTruncated !== (coverage.rowsEligible > coverage.rowsReturned) ||
    coverage.truncated !==
      (coverage.relationRowsDroppedAtLimit > 0 ||
        coverage.subjectDetailIdsDroppedAtLimit > 0 ||
        coverage.outputTruncated) ||
    coverage.maxRelations !== S01_EXPECTED_ARGUMENTS.maxRelations ||
    coverage.maxSubjectDetails !== S01_EXPECTED_ARGUMENTS.maxSubjectDetails ||
    coverage.maxRows !== S01_EXPECTED_ARGUMENTS.maxRows ||
    coverage.relationRowsSelected > S01_EXPECTED_ARGUMENTS.maxRelations ||
    coverage.subjectDetailRequests > S01_EXPECTED_ARGUMENTS.maxSubjectDetails ||
    typeof coverage.retrievedAt !== 'string' ||
    Number.isNaN(Date.parse(coverage.retrievedAt)) ||
    summary.annualObservedCounts.reduce((sum, item) => sum + item.creditRows, 0) !==
      summary.creditRows ||
    summary.annualObservedCounts.reduce((sum, item) => sum + item.uniqueSubjects, 0) !==
      coverage.uniqueSubjects ||
    coverage.uniqueCharacters !== summary.uniqueCharacters
  ) {
    return false;
  }
  if (
    summary.state === 'complete' &&
    (coverage.sampled ||
      coverage.outputTruncated ||
      coverage.subjectDetailsFailed > 0 ||
      coverage.missingSubjectIdRows > 0 ||
      coverage.missingDateRows > 0 ||
      coverage.invalidDateRows > 0)
  ) {
    return false;
  }
  return true;
}

export function validateS01McpTextProjection(text, expectedSummary) {
  if (typeof text !== 'string' || Buffer.byteLength(text, 'utf8') > 4096) return false;
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    return false;
  }
  const passed = (
    exactKeys(parsed, SUMMARY_KEYS) &&
    canonicalJson(parsed) === canonicalJson(expectedSummary) &&
    typeof parsed.caveat === 'string' &&
    parsed.caveat === S01_CANONICAL_CAVEAT
  );
  return { passed, projection: passed ? parsed : null };
}

export function verifyS01AnnualTvVoiceAnswer(answer, expectedSummary, maxBytes = 4096) {
  const checks = {
    answerIsJson: false,
    exactKeys: false,
    annualCountsMatch: false,
    yearRangesMatch: false,
    coverageMatches: false,
    coverageStateMatches: false,
    caveatExact: false,
    boundedUtf8: false,
    rawIdentityAndTitlesAbsent: false,
  };
  if (typeof answer !== 'string' || !expectedSummary) {
    return { passed: false, answerChecks: checks, valid: false, checks };
  }
  checks.boundedUtf8 = Buffer.byteLength(answer, 'utf8') <= maxBytes;
  let parsed;
  try {
    parsed = JSON.parse(answer);
    checks.answerIsJson = true;
  } catch {
    return { passed: false, answerChecks: checks, valid: false, checks };
  }
  checks.exactKeys = exactKeys(parsed, SUMMARY_KEYS);
  if (checks.exactKeys) {
    checks.annualCountsMatch =
      canonicalJson(parsed.annualObservedCounts) === canonicalJson(expectedSummary.annualObservedCounts) &&
      parsed.creditRows === expectedSummary.creditRows &&
      parsed.uniqueCharacters === expectedSummary.uniqueCharacters;
    checks.yearRangesMatch =
      canonicalJson(parsed.window) === canonicalJson(expectedSummary.window) &&
      parsed.annualObservedCounts.every((item) => exactKeys(item, YEAR_KEYS));
    checks.coverageMatches = canonicalJson(parsed.coverage) === canonicalJson(expectedSummary.coverage);
    checks.coverageStateMatches = parsed.state === expectedSummary.state;
    checks.caveatExact = parsed.caveat === S01_CANONICAL_CAVEAT;
    checks.rawIdentityAndTitlesAbsent =
      canonicalJson(parsed).includes('personId') === false &&
      canonicalJson(parsed).includes('subjectId') === false &&
      canonicalJson(parsed).includes('title') === false &&
      canonicalJson(parsed).includes('5745') === false;
  }
  const valid = Object.values(checks).every(Boolean);
  return { passed: valid, answerChecks: checks, valid, checks };
}

function requestDetails(input, init) {
  const isRequest = typeof Request !== 'undefined' && input instanceof Request;
  const url = new URL(isRequest ? input.url : String(input));
  const method = String(init?.method ?? (isRequest ? input.method : 'GET')).toUpperCase();
  const headers = new Headers(init?.headers ?? (isRequest ? input.headers : undefined));
  const body = init?.body ?? (isRequest ? input.body : undefined);
  const credentials = init?.credentials ?? (isRequest ? input.credentials : 'omit');
  return { url, method, headers, body, credentials };
}

async function boundedCloneBytes(response) {
  const contentLength = response.headers.get('content-length');
  if (contentLength && /^\d+$/u.test(contentLength) && Number(contentLength) > S01_MAX_RESPONSE_BYTES) {
    throw new Error('S01 public profile response exceeded its byte bound.');
  }
  if (!response.body) return Buffer.alloc(0);
  const reader = response.clone().body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > S01_MAX_RESPONSE_BYTES) {
      void reader.cancel().catch(() => {});
      throw new Error('S01 public profile response exceeded its byte bound.');
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, size);
}

export function expectedS01PublicRequestScope(scope) {
  if (!exactKeys(scope, PUBLIC_SCOPE_KEYS)) return false;
  const detailCount = scope.subjectDetailRequestCount;
  const requestCount = 2 + detailCount;
  return (
    Number.isSafeInteger(detailCount) &&
    detailCount >= 0 &&
    detailCount <= S01_EXPECTED_ARGUMENTS.maxSubjectDetails &&
    scope.requestCount === requestCount &&
    scope.allowedRequestCount === requestCount &&
    scope.deniedRequestCount === 0 &&
    scope.personDetailRequestCount === 1 &&
    scope.characterRelationRequestCount === 1 &&
    scope.duplicateSubjectDetailCount === 0 &&
    scope.credentialHeaderCount === 0 &&
    scope.credentialModeCount === 0 &&
    scope.forbiddenHeaderCount === 0 &&
    scope.authorizationHeaderCount === 0 &&
    scope.writeAttemptCount === 0 &&
    scope.unexpectedRouteCount === 0 &&
    scope.sequenceMismatchCount === 0 &&
    scope.responseValidationFailureCount === 0 &&
    scope.redirectResponseCount === 0 &&
    scope.maxRequests === 2 + S01_EXPECTED_ARGUMENTS.maxSubjectDetails &&
    scope.maxSubjectDetails === S01_EXPECTED_ARGUMENTS.maxSubjectDetails &&
    scope.requestsWithinLimit === true &&
    scope.anonymousOnly === true &&
    scope.officialV0Only === true &&
    scope.redirectPolicy === 'error'
  );
}

export function createS01AnnualTvPublicFetch({ fetchImpl = globalThis.fetch } = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('S01 requires native fetch.');
  const counters = {
    requestCount: 0,
    allowedRequestCount: 0,
    deniedRequestCount: 0,
    personDetailRequestCount: 0,
    characterRelationRequestCount: 0,
    subjectDetailRequestCount: 0,
    duplicateSubjectDetailCount: 0,
    credentialHeaderCount: 0,
    credentialModeCount: 0,
    forbiddenHeaderCount: 0,
    authorizationHeaderCount: 0,
    writeAttemptCount: 0,
    unexpectedRouteCount: 0,
    sequenceMismatchCount: 0,
    responseValidationFailureCount: 0,
    redirectResponseCount: 0,
  };
  const allowedSubjectIds = new Set();
  const requestedSubjectIds = new Set();
  let personRouteObserved = false;
  let relationRouteObserved = false;

  const fetchFn = async (input, init = {}) => {
    counters.requestCount += 1;
    let request;
    try {
      request = requestDetails(input, init);
    } catch {
      counters.deniedRequestCount += 1;
      counters.unexpectedRouteCount += 1;
      throw new Error('S01 public profile denied an invalid URL.');
    }
    const { url, method, headers, body, credentials } = request;
    const headerEntries = [...headers.entries()];
    const forbiddenHeaders = headerEntries.filter(
      ([name, value]) => !Object.hasOwn(ALLOWED_HEADERS, name) || ALLOWED_HEADERS[name] !== value,
    );
    const hasUrlCredential = Boolean(url.username || url.password);
    const hasCredentialHeader = headerEntries.some(([name]) =>
      /(?:authorization|cookie|credential|auth|token|session|api[-_]?key|secret)/iu.test(name),
    );
    const hasCredential =
      hasUrlCredential || hasCredentialHeader || credentials !== 'omit' || forbiddenHeaders.length > 0;
    if (hasUrlCredential || hasCredentialHeader) counters.credentialHeaderCount += 1;
    if (credentials !== 'omit') counters.credentialModeCount += 1;
    counters.forbiddenHeaderCount += forbiddenHeaders.length;
    if (headers.has('authorization') || headers.has('proxy-authorization') || hasUrlCredential) {
      counters.authorizationHeaderCount += 1;
    }
    if (method !== 'GET') counters.writeAttemptCount += 1;

    const baseRoute =
      url.origin === 'https://api.bgm.tv' &&
      url.href === `https://api.bgm.tv${url.pathname}` &&
      !url.search &&
      !url.hash &&
      !url.username &&
      !url.password;
    let route = 'invalid';
    if (baseRoute && url.pathname === `/v0/persons/${S01_EXPECTED_ARGUMENTS.personId}`) {
      route = 'person';
    } else if (
      baseRoute &&
      url.pathname === `/v0/persons/${S01_EXPECTED_ARGUMENTS.personId}/characters`
    ) {
      route = 'characters';
    } else if (baseRoute) {
      const match = /^\/v0\/subjects\/(\d+)$/u.exec(url.pathname);
      const subjectId = match ? Number(match[1]) : null;
      if (Number.isSafeInteger(subjectId) && allowedSubjectIds.has(subjectId)) route = 'subject';
    }
    const routeOrderValid =
      (route === 'person' && !personRouteObserved && counters.personDetailRequestCount === 0) ||
      (route === 'characters' && personRouteObserved && !relationRouteObserved) ||
      (route === 'subject' && personRouteObserved && relationRouteObserved);
    if (
      route === 'invalid' ||
      !routeOrderValid ||
      method !== 'GET' ||
      (body !== null && body !== undefined) ||
      hasCredential
    ) {
      counters.deniedRequestCount += 1;
      if (route === 'invalid') counters.unexpectedRouteCount += 1;
      else counters.sequenceMismatchCount += 1;
      throw new Error('S01 public profile denied an unregistered anonymous v0 request.');
    }
    if (counters.requestCount > 2 + S01_EXPECTED_ARGUMENTS.maxSubjectDetails) {
      counters.deniedRequestCount += 1;
      counters.sequenceMismatchCount += 1;
      throw new Error('S01 public profile request limit exceeded.');
    }
    if (route === 'person') {
      personRouteObserved = true;
      counters.personDetailRequestCount += 1;
    } else if (route === 'characters') {
      relationRouteObserved = true;
      counters.characterRelationRequestCount += 1;
    } else {
      const subjectId = Number(/^\/v0\/subjects\/(\d+)$/u.exec(url.pathname)?.[1]);
      if (requestedSubjectIds.has(subjectId)) {
        counters.deniedRequestCount += 1;
        counters.duplicateSubjectDetailCount += 1;
        throw new Error('S01 public profile denied a duplicate subject-detail request.');
      }
      requestedSubjectIds.add(subjectId);
      counters.subjectDetailRequestCount += 1;
    }
    counters.allowedRequestCount += 1;
    const response = await fetchImpl(input, {
      ...init,
      method,
      headers,
      credentials: 'omit',
      redirect: 'error',
    });
    if (response.status >= 300 && response.status < 400) {
      counters.redirectResponseCount += 1;
      throw new Error('S01 public profile rejected a redirect response.');
    }
    try {
      const bytes = await boundedCloneBytes(response);
      if (route === 'characters' && response.ok) {
        const rows = JSON.parse(bytes.toString('utf8'));
        if (!Array.isArray(rows) || rows.length > S01_MAX_RELATION_IDS) {
          throw new Error('S01 relation response did not match its bounded official shape.');
        }
        for (const row of rows) {
          if (Number.isSafeInteger(row?.subject_id) && row.subject_id > 0) {
            allowedSubjectIds.add(row.subject_id);
          }
        }
      }
    } catch (error) {
      counters.responseValidationFailureCount += 1;
      throw error;
    }
    return response;
  };

  return {
    fetchFn,
    snapshot() {
      const requestCount = counters.requestCount;
      return {
        ...counters,
        maxRequests: 2 + S01_EXPECTED_ARGUMENTS.maxSubjectDetails,
        maxSubjectDetails: S01_EXPECTED_ARGUMENTS.maxSubjectDetails,
        requestsWithinLimit: requestCount <= 2 + S01_EXPECTED_ARGUMENTS.maxSubjectDetails,
        anonymousOnly:
          counters.credentialHeaderCount === 0 &&
          counters.credentialModeCount === 0 &&
          counters.forbiddenHeaderCount === 0 &&
          counters.authorizationHeaderCount === 0,
        officialV0Only: counters.unexpectedRouteCount === 0,
        redirectPolicy: 'error',
      };
    },
  };
}
