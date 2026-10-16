import { canonicalJson } from './codex-one-tool-evidence.mjs';

export const R02_POSITIVE_DIRECT_RELATIONS_PROFILE_ID =
  'r02-positive-direct-relations-agent-mcp-v1';
export const R02_POSITIVE_DIRECT_RELATIONS_NETWORK_MODE =
  'run95-r02-positive-direct-relations-public-v1';
export const R02_POSITIVE_DIRECT_RELATIONS_ARGUMENT_PROFILE =
  'fixed-r02-positive-direct-relations-4923-315-1428-v1';
export const R02_POSITIVE_DIRECT_RELATIONS_SERVER_ID = 'bgk_r02_direct_relations';
export const R02_POSITIVE_DIRECT_RELATIONS_ACKNOWLEDGEMENT = 'R02_POSITIVE_DIRECT_RELATIONS_READ';
export const R02_POSITIVE_DIRECT_RELATIONS_EXPECTED_CALLS = Object.freeze(
  [4923, 315, 1428].map((subjectId) =>
    Object.freeze({
      toolName: 'bangumi.get_subject_relations',
      arguments: Object.freeze({ subjectId, includeEvidence: true }),
    }),
  ),
);
export const R02_POSITIVE_DIRECT_RELATIONS_SUBJECT_IDS = Object.freeze([4923, 315, 1428]);
export const R02_POSITIVE_DIRECT_RELATIONS_MAX_REQUESTS = 3;
export const R02_POSITIVE_DIRECT_RELATIONS_EXPECTED_RESULT_SUMMARIES = Object.freeze([
  Object.freeze({
    state: 'observed',
    subjectId: 4923,
    sourceDirection: 'source_subject_to_returned_target',
    responseRowsObserved: 53,
    rowsReturned: 53,
    schemaDriftRows: 0,
    truncated: false,
    paginationAvailable: false,
    totalCountAvailable: false,
    completeness: 'not_provided_by_source',
    directRelations: Object.freeze([
      Object.freeze({ sourceSubjectId: 4923, targetSubjectId: 315, relationLabel: '动画' }),
      Object.freeze({ sourceSubjectId: 4923, targetSubjectId: 1428, relationLabel: '动画' }),
    ]),
  }),
  Object.freeze({
    state: 'observed',
    subjectId: 315,
    sourceDirection: 'source_subject_to_returned_target',
    responseRowsObserved: 33,
    rowsReturned: 33,
    schemaDriftRows: 0,
    truncated: false,
    paginationAvailable: false,
    totalCountAvailable: false,
    completeness: 'not_provided_by_source',
    directRelations: Object.freeze([
      Object.freeze({ sourceSubjectId: 315, targetSubjectId: 1935, relationLabel: '续集' }),
    ]),
  }),
  Object.freeze({
    state: 'observed',
    subjectId: 1428,
    sourceDirection: 'source_subject_to_returned_target',
    responseRowsObserved: 41,
    rowsReturned: 41,
    schemaDriftRows: 0,
    truncated: false,
    paginationAvailable: false,
    totalCountAvailable: false,
    completeness: 'not_provided_by_source',
    directRelations: Object.freeze([
      Object.freeze({ sourceSubjectId: 1428, targetSubjectId: 10799, relationLabel: '衍生' }),
    ]),
  }),
]);

const EXPECTED_POSITIVE_ROWS = Object.freeze({
  4923: Object.freeze([
    Object.freeze({ sourceSubjectId: 4923, targetSubjectId: 315, relationLabel: '动画' }),
    Object.freeze({ sourceSubjectId: 4923, targetSubjectId: 1428, relationLabel: '动画' }),
  ]),
  315: Object.freeze([
    Object.freeze({ sourceSubjectId: 315, targetSubjectId: 1935, relationLabel: '续集' }),
  ]),
  1428: Object.freeze([
    Object.freeze({ sourceSubjectId: 1428, targetSubjectId: 10799, relationLabel: '衍生' }),
  ]),
});

export function assertR02PositiveDirectRelationsProfile(profile) {
  if (profile?.id !== R02_POSITIVE_DIRECT_RELATIONS_PROFILE_ID) return false;
  const calls = profile.calls;
  if (
    profile.frontierId !== 'R02' ||
    profile.epochId !== 'run95-r02-positive-direct-relations-agent-mcp-20261016' ||
    profile.toolName !== 'bangumi.get_subject_relations' ||
    profile.argumentProfile !== R02_POSITIVE_DIRECT_RELATIONS_ARGUMENT_PROFILE ||
    profile.acceptanceScope !== 'agent-mcp-matrix-only' ||
    profile.networkMode !== R02_POSITIVE_DIRECT_RELATIONS_NETWORK_MODE ||
    profile.model !== 'gpt-6-luna' ||
    profile.reasoningEffort !== 'max' ||
    canonicalJson(calls) !== canonicalJson(R02_POSITIVE_DIRECT_RELATIONS_EXPECTED_CALLS)
  ) {
    throw new Error('R02 public relation profile does not match its immutable contract.');
  }
  return true;
}

export function summarizeR02PositiveDirectRelationsToolResult(result, expectedArguments) {
  const call = R02_POSITIVE_DIRECT_RELATIONS_EXPECTED_CALLS.find(
    (item) => canonicalJson(item.arguments) === canonicalJson(expectedArguments),
  );
  if (!call || result?.subjectId !== expectedArguments.subjectId) return null;
  const coverage = result.coverage;
  const rows = Array.isArray(result.items) ? result.items : null;
  const expectedRows = EXPECTED_POSITIVE_ROWS[expectedArguments.subjectId];
  if (
    !coverage ||
    !rows ||
    result.state !== 'observed' ||
    result.source?.direction !== 'source_subject_to_returned_target' ||
    result.source?.operation !== 'GET /v0/subjects/{subject_id}/subjects' ||
    coverage.truncated !== false ||
    coverage.paginationAvailable !== false ||
    coverage.totalCountAvailable !== false ||
    coverage.completeness !== 'not_provided_by_source' ||
    !Number.isSafeInteger(coverage.responseRowsObserved) ||
    coverage.responseRowsObserved < rows.length ||
    coverage.rowsReturned !== rows.length ||
    !Number.isSafeInteger(coverage.schemaDriftRows) ||
    coverage.schemaDriftRows < 0
  ) {
    return null;
  }
  const observedRows = rows
    .filter((row) => expectedRows.some((expected) => expected.targetSubjectId === row?.id))
    .map((row) => ({
      sourceSubjectId: expectedArguments.subjectId,
      targetSubjectId: row.id,
      relationLabel: typeof row.relation === 'string' ? row.relation : null,
    }))
    .sort((left, right) => left.targetSubjectId - right.targetSubjectId);
  const sortedExpectedRows = [...expectedRows].sort(
    (left, right) => left.targetSubjectId - right.targetSubjectId,
  );
  if (canonicalJson(observedRows) !== canonicalJson(sortedExpectedRows)) return null;
  return {
    state: 'observed',
    subjectId: expectedArguments.subjectId,
    sourceDirection: 'source_subject_to_returned_target',
    responseRowsObserved: coverage.responseRowsObserved,
    rowsReturned: coverage.rowsReturned,
    schemaDriftRows: coverage.schemaDriftRows,
    truncated: false,
    paginationAvailable: false,
    totalCountAvailable: false,
    completeness: 'not_provided_by_source',
    directRelations: observedRows,
  };
}

export function expectedR02PositiveDirectRelationsRequestScope() {
  return {
    requestCount: 3,
    allowedRequestCount: 3,
    deniedRequestCount: 0,
    credentialHeaderCount: 0,
    authorizationHeaderCount: 0,
    writeAttemptCount: 0,
    unexpectedRouteCount: 0,
    sequenceMismatchCount: 0,
    subjectIds: [...R02_POSITIVE_DIRECT_RELATIONS_SUBJECT_IDS],
    maxRequests: R02_POSITIVE_DIRECT_RELATIONS_MAX_REQUESTS,
    requestsComplete: true,
    anonymousOnly: true,
    officialV0Only: true,
    redirectPolicy: 'error',
  };
}

export function r02PositiveDirectRelationsRequestScopeIsValid(scope) {
  return canonicalJson(scope) === canonicalJson(expectedR02PositiveDirectRelationsRequestScope());
}

function urlAndRequest(input, init) {
  const isRequest = typeof Request !== 'undefined' && input instanceof Request;
  const url = new URL(isRequest ? input.url : String(input));
  const method = String(init?.method ?? (isRequest ? input.method : 'GET')).toUpperCase();
  const headers = new Headers(init?.headers ?? (isRequest ? input.headers : undefined));
  const body = init?.body ?? (isRequest ? input.body : undefined);
  return { url, method, headers, body };
}

export function createR02PositiveDirectRelationsPublicFetch({ fetchImpl = globalThis.fetch } = {}) {
  if (typeof fetchImpl !== 'function') throw new TypeError('R02 requires native fetch.');
  const counters = {
    requestCount: 0,
    allowedRequestCount: 0,
    deniedRequestCount: 0,
    credentialHeaderCount: 0,
    authorizationHeaderCount: 0,
    writeAttemptCount: 0,
    unexpectedRouteCount: 0,
    sequenceMismatchCount: 0,
    subjectIds: [],
  };
  const fetchFn = async (input, init = {}) => {
    counters.requestCount += 1;
    let request;
    try {
      request = urlAndRequest(input, init);
    } catch {
      counters.deniedRequestCount += 1;
      counters.unexpectedRouteCount += 1;
      throw new Error('R02 public profile denied an invalid URL.');
    }
    const { url, method, headers, body } = request;
    const hasCredential =
      Boolean(url.username || url.password) ||
      [...headers.keys()].some((name) =>
        /(?:authorization|cookie|credential|token|api[-_]?key)/iu.test(name),
      );
    if (hasCredential) {
      counters.credentialHeaderCount += 1;
      if (
        headers.has('authorization') ||
        headers.has('proxy-authorization') ||
        Boolean(url.username || url.password)
      ) {
        counters.authorizationHeaderCount += 1;
      }
    }
    if (method !== 'GET') counters.writeAttemptCount += 1;
    const expectedSubjectId =
      R02_POSITIVE_DIRECT_RELATIONS_SUBJECT_IDS[counters.allowedRequestCount];
    const pathMatches =
      expectedSubjectId !== undefined &&
      url.origin === 'https://api.bgm.tv' &&
      url.pathname === `/v0/subjects/${expectedSubjectId}/subjects` &&
      url.href === `https://api.bgm.tv/v0/subjects/${expectedSubjectId}/subjects` &&
      !url.search &&
      !url.hash &&
      !url.username &&
      !url.password;
    if (
      !pathMatches ||
      method !== 'GET' ||
      (body !== null && body !== undefined) ||
      hasCredential
    ) {
      counters.deniedRequestCount += 1;
      if (!pathMatches) counters.unexpectedRouteCount += 1;
      if (pathMatches && expectedSubjectId !== undefined) counters.sequenceMismatchCount += 1;
      throw new Error('R02 public profile denied an unregistered anonymous v0 request.');
    }
    if (counters.requestCount > R02_POSITIVE_DIRECT_RELATIONS_MAX_REQUESTS) {
      counters.deniedRequestCount += 1;
      counters.sequenceMismatchCount += 1;
      throw new Error('R02 public profile request limit exceeded.');
    }
    counters.allowedRequestCount += 1;
    counters.subjectIds.push(expectedSubjectId);
    const response = await fetchImpl(input, { ...init, method, headers, redirect: 'error' });
    if (response.status >= 300 && response.status < 400) {
      throw new Error('R02 public profile rejected a redirect response.');
    }
    return response;
  };
  return {
    fetchFn,
    snapshot() {
      const scope = {
        ...counters,
        subjectIds: [...counters.subjectIds],
        maxRequests: R02_POSITIVE_DIRECT_RELATIONS_MAX_REQUESTS,
        requestsComplete:
          counters.requestCount === 3 &&
          counters.allowedRequestCount === 3 &&
          counters.deniedRequestCount === 0 &&
          canonicalJson(counters.subjectIds) ===
            canonicalJson(R02_POSITIVE_DIRECT_RELATIONS_SUBJECT_IDS),
        anonymousOnly: counters.credentialHeaderCount === 0,
        officialV0Only: counters.unexpectedRouteCount === 0,
        redirectPolicy: 'error',
      };
      return scope;
    },
  };
}
