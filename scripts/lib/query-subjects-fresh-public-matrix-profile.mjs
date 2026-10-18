import { createHash } from 'node:crypto';
import {
  agentMcpProfileArgumentsSha256,
  getAgentMcpProfileById,
  listAgentMcpProfiles,
} from './agent-mcp-profile-claims.mjs';
import { canonicalJson } from './codex-one-tool-evidence.mjs';

export const QUERY_SUBJECTS_FRESH_PUBLIC_PROFILE_ID = 'query-subjects-fresh-public-matrix-v1';
export const QUERY_SUBJECTS_FRESH_PUBLIC_EPOCH_ID =
  'run95-query-subjects-fresh-public-matrix-20261019';
export const QUERY_SUBJECTS_FRESH_PUBLIC_NETWORK_MODE =
  'run95-query-subjects-fresh-public-matrix-v1';
export const QUERY_SUBJECTS_FRESH_PUBLIC_SERVER_ID = 'bgk_query_subjects_fresh_public_matrix';
export const QUERY_SUBJECTS_FRESH_PUBLIC_MAX_REQUESTS = 8;
export const QUERY_SUBJECTS_FRESH_PUBLIC_ACKNOWLEDGEMENT = 'QUERY_SUBJECTS_PUBLIC_MATRIX_OK';

export const QUERY_SUBJECTS_FRESH_PUBLIC_EXPECTED_ARGUMENTS = Object.freeze({
  keyword: '进击的巨人',
  media: 'anime',
  resultMode: 'top',
  limit: 1,
  sort: 'relevance',
  explain: 'compact',
  nsfw: false,
});

const PROFILE_CALL = Object.freeze({
  toolName: 'bangumi.query_subjects',
  arguments: QUERY_SUBJECTS_FRESH_PUBLIC_EXPECTED_ARGUMENTS,
});
export const QUERY_SUBJECTS_FRESH_PUBLIC_EXPECTED_CALLS = Object.freeze([PROFILE_CALL]);

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

export function assertQuerySubjectsFreshPublicProfile(profile) {
  if (profile?.id !== QUERY_SUBJECTS_FRESH_PUBLIC_PROFILE_ID) return false;
  const registered = getAgentMcpProfileById(QUERY_SUBJECTS_FRESH_PUBLIC_PROFILE_ID);
  if (!registered || canonicalJson(profile) !== canonicalJson(registered)) {
    throw new Error('Fresh query_subjects requires its exact registered profile.');
  }
  const otherQueryProfiles = listAgentMcpProfiles().filter(
    (item) => item.id !== registered.id && item.toolName === PROFILE_CALL.toolName,
  );
  const duplicateInput = otherQueryProfiles.some((item) =>
    (item.calls ?? []).some(
      (call) =>
        call.toolName === PROFILE_CALL.toolName &&
        canonicalJson(call.arguments) === canonicalJson(PROFILE_CALL.arguments),
    ),
  );
  if (
    profile.frontierId !== 'G14' ||
    profile.epochId !== QUERY_SUBJECTS_FRESH_PUBLIC_EPOCH_ID ||
    profile.toolName !== PROFILE_CALL.toolName ||
    profile.argumentProfile !== 'fixed-run95-query-subjects-attack-on-titan-public-v1' ||
    profile.acceptanceScope !== 'agent-mcp-matrix-only' ||
    profile.networkMode !== QUERY_SUBJECTS_FRESH_PUBLIC_NETWORK_MODE ||
    profile.reportPath !== 'docs/live-probes/query-subjects-fresh-public-agent-mcp-run95.json' ||
    profile.selectionEvidencePath !==
      'docs/research/run95-query-subjects-fresh-public-matrix-contract-2026-10-19.md' ||
    profile.claimLabelName !== 'harness-r95-query-subjects-fresh-public-matrix-claimed' ||
    profile.evidenceKind !== 'codex_cli_query_subjects_fresh_public_agent_mcp_matrix' ||
    profile.answerCheckMethod !== 'query-subjects-exact-matrix-ack-v1' ||
    profile.model !== 'gpt-6-luna' ||
    profile.reasoningEffort !== 'max' ||
    profile.maxAnswerBytes !== 128 ||
    profile.maxRequests !== QUERY_SUBJECTS_FRESH_PUBLIC_MAX_REQUESTS ||
    profile.calls?.length !== 1 ||
    profile.calls[0]?.toolName !== PROFILE_CALL.toolName ||
    canonicalJson(profile.calls[0]?.arguments) !== canonicalJson(PROFILE_CALL.arguments) ||
    duplicateInput
  ) {
    throw new Error(
      'Fresh query_subjects public matrix profile does not match its fixed contract.',
    );
  }
  return true;
}

function hasExactPagination(url) {
  const entries = [...url.searchParams.entries()];
  const limits = url.searchParams.getAll('limit');
  const offsets = url.searchParams.getAll('offset');
  if (entries.length !== 2 || limits.length !== 1 || offsets.length !== 1) return false;
  const limit = Number(limits[0]);
  const offset = Number(offsets[0]);
  return (
    Number.isSafeInteger(limit) &&
    limit === 20 &&
    Number.isSafeInteger(offset) &&
    offset >= 0 &&
    offset % limit === 0 &&
    offset / limit < QUERY_SUBJECTS_FRESH_PUBLIC_MAX_REQUESTS
  );
}

function bodyMatchesProfile(bodyValue) {
  if (typeof bodyValue !== 'string') return false;
  try {
    const body = JSON.parse(bodyValue);
    return (
      body &&
      typeof body === 'object' &&
      !Array.isArray(body) &&
      body.keyword === QUERY_SUBJECTS_FRESH_PUBLIC_EXPECTED_ARGUMENTS.keyword &&
      body.sort === 'match' &&
      body.filter?.type?.length === 1 &&
      body.filter.type[0] === 2 &&
      body.filter.nsfw === false &&
      Object.keys(body).every((key) => ['keyword', 'sort', 'filter'].includes(key)) &&
      Object.keys(body.filter).every((key) => ['type', 'nsfw'].includes(key))
    );
  } catch {
    return false;
  }
}

export function createQuerySubjectsFreshPublicFetch({
  fetchImpl = globalThis.fetch,
  maxRequests = QUERY_SUBJECTS_FRESH_PUBLIC_MAX_REQUESTS,
} = {}) {
  if (
    typeof fetchImpl !== 'function' ||
    !Number.isSafeInteger(maxRequests) ||
    maxRequests < 1 ||
    maxRequests > QUERY_SUBJECTS_FRESH_PUBLIC_MAX_REQUESTS
  ) {
    throw new TypeError(
      'Fresh query_subjects fetch requires native fetch and a request cap from 1 to 8.',
    );
  }
  const counters = {
    requestCount: 0,
    allowedRequestCount: 0,
    deniedRequestCount: 0,
    credentialAttemptCount: 0,
    unexpectedRouteCount: 0,
    budgetExceeded: false,
  };

  const fetchFn = async (input, init = {}) => {
    const requestObject = typeof Request !== 'undefined' && input instanceof Request;
    const rawUrl = requestObject ? input.url : String(input);
    const url = new URL(rawUrl);
    const method = String(init.method ?? (requestObject ? input.method : 'GET')).toUpperCase();
    const headers = new Headers(init.headers ?? (requestObject ? input.headers : undefined));
    const credentialsMode = init.credentials ?? (requestObject ? input.credentials : undefined);
    const credentialedMode = credentialsMode !== undefined && credentialsMode !== 'omit';
    const hasCredentials =
      [...headers.keys()].some((name) =>
        /(?:authorization|cookie|token|secret|credential|api[_-]?key)/iu.test(name),
      ) ||
      Boolean(url.username || url.password) ||
      credentialedMode;
    const allowedRoute =
      url.hash === '' &&
      url.origin === 'https://api.bgm.tv' &&
      url.pathname === '/v0/search/subjects' &&
      method === 'POST' &&
      hasExactPagination(url) &&
      bodyMatchesProfile(init.body);

    if (hasCredentials) counters.credentialAttemptCount += 1;
    if (!allowedRoute || hasCredentials) {
      counters.deniedRequestCount += 1;
      if (!allowedRoute) counters.unexpectedRouteCount += 1;
      throw new Error('Fresh query_subjects profile denied an unregistered anonymous v0 request.');
    }
    if (counters.requestCount >= maxRequests) {
      counters.deniedRequestCount += 1;
      counters.budgetExceeded = true;
      throw new Error('Fresh query_subjects profile request budget exceeded.');
    }

    counters.requestCount += 1;
    counters.allowedRequestCount += 1;
    return fetchImpl(input, {
      ...init,
      method,
      headers,
      credentials: 'omit',
      redirect: 'error',
    });
  };

  return {
    fetchFn,
    snapshot() {
      return {
        ...counters,
        maxRequests,
        anonymousOnly: counters.credentialAttemptCount === 0,
        officialV0Only: counters.unexpectedRouteCount === 0,
        redirectPolicy: 'error',
      };
    },
  };
}

export function summarizeQuerySubjectsFreshPublicResult(result) {
  const coverage = result?.coverage;
  const items = Array.isArray(result?.items) ? result.items : [];
  const warnings = Array.isArray(result?.warnings) ? result.warnings : [];
  return {
    resultState: ['ok', 'partial'].includes(result?.state) ? result.state : 'unknown',
    returnedItems: Math.min(items.length, 1),
    coverageState: ['complete', 'partial', 'unavailable', 'not_computable', 'unknown'].includes(
      coverage?.state,
    )
      ? coverage.state
      : 'unknown',
    pagesRequested:
      Number.isSafeInteger(coverage?.pagesRequested) && coverage.pagesRequested >= 0
        ? Math.min(coverage.pagesRequested, QUERY_SUBJECTS_FRESH_PUBLIC_MAX_REQUESTS)
        : null,
    pagesScanned:
      Number.isSafeInteger(coverage?.pagesScanned) && coverage.pagesScanned >= 0
        ? Math.min(coverage.pagesScanned, QUERY_SUBJECTS_FRESH_PUBLIC_MAX_REQUESTS)
        : null,
    totalKind: ['exact', 'estimated', 'unknown', 'unavailable'].includes(coverage?.totalKind)
      ? coverage.totalKind
      : 'unknown',
    warningCount: Math.min(warnings.length, 8),
  };
}

export function querySubjectsFreshPublicRequestScopeIsValid(scope) {
  return Boolean(
    scope &&
    Number.isSafeInteger(scope.requestCount) &&
    scope.requestCount >= 1 &&
    scope.requestCount <= QUERY_SUBJECTS_FRESH_PUBLIC_MAX_REQUESTS &&
    scope.allowedRequestCount === scope.requestCount &&
    scope.deniedRequestCount === 0 &&
    scope.credentialAttemptCount === 0 &&
    scope.unexpectedRouteCount === 0 &&
    scope.budgetExceeded === false &&
    scope.maxRequests === QUERY_SUBJECTS_FRESH_PUBLIC_MAX_REQUESTS &&
    scope.anonymousOnly === true &&
    scope.officialV0Only === true &&
    scope.redirectPolicy === 'error',
  );
}

export function querySubjectsFreshPublicExpectedArgumentsSha256() {
  const profile = getAgentMcpProfileById(QUERY_SUBJECTS_FRESH_PUBLIC_PROFILE_ID);
  if (!profile) throw new Error('Fresh query_subjects profile is not registered.');
  return agentMcpProfileArgumentsSha256(profile);
}

export function querySubjectsFreshPublicInputSha256() {
  return sha256(canonicalJson(PROFILE_CALL.arguments));
}
