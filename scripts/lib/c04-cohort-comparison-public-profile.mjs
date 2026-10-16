import { canonicalJson } from './codex-one-tool-evidence.mjs';

export const C04_COHORT_COMPARISON_PROFILE_ID = 'c04-cohort-comparison-agent-mcp-matrix-v1';
export const C04_COHORT_COMPARISON_ACKNOWLEDGEMENT = 'C04_COHORT_TOOLS_READ_ONLY_MATRIX_ONLY';
export const C04_COHORT_COMPARISON_NETWORK_MODE = 'run95-c04-cohort-comparison-matrix-public-v1';
export const C04_COHORT_COMPARISON_SERVER_ID = 'bgk_c04_cohort_comparison';
export const C04_COHORT_COMPARISON_MAX_REQUESTS = 32;
export const C04_COHORT_COMPARISON_MAX_REQUESTS_PER_RUN = 16;
export const C04_COHORT_COMPARISON_TOOL_NAMES = Object.freeze([
  'bangumi.compare_subject_cohorts',
  'bangumi.render_subject_cohort_comparison',
]);

const expectedArguments = Object.freeze({
  cohorts: Object.freeze([
    Object.freeze({
      label: 'Run95 C04 2025 winter original anime sample',
      query: Object.freeze({
        media: 'anime',
        season: '2025-winter',
        metaTags: Object.freeze(['原创']),
        resultMode: 'all',
      }),
    }),
    Object.freeze({
      label: 'Run95 C04 2025 spring original anime sample',
      query: Object.freeze({
        media: 'anime',
        season: '2025-spring',
        metaTags: Object.freeze(['原创']),
        resultMode: 'all',
      }),
    }),
  ]),
  maxSubjects: 1,
});

export const C04_COHORT_COMPARISON_CALLS = Object.freeze(
  C04_COHORT_COMPARISON_TOOL_NAMES.map((toolName) =>
    Object.freeze({ toolName, arguments: expectedArguments }),
  ),
);

export function assertC04CohortComparisonPublicProfile(profile) {
  return Boolean(
    profile &&
    profile.id === C04_COHORT_COMPARISON_PROFILE_ID &&
    profile.frontierId === 'A01' &&
    profile.acceptanceScope === 'agent-mcp-matrix-only' &&
    profile.toolName === C04_COHORT_COMPARISON_TOOL_NAMES[0] &&
    canonicalJson(profile.toolNames) === canonicalJson(C04_COHORT_COMPARISON_TOOL_NAMES) &&
    profile.networkMode === C04_COHORT_COMPARISON_NETWORK_MODE &&
    canonicalJson(profile.calls) === canonicalJson(C04_COHORT_COMPARISON_CALLS),
  );
}

export function createC04CohortComparisonPublicFetch({
  fetchImpl = globalThis.fetch,
  maxRequests = C04_COHORT_COMPARISON_MAX_REQUESTS_PER_RUN,
} = {}) {
  if (
    typeof fetchImpl !== 'function' ||
    !Number.isSafeInteger(maxRequests) ||
    maxRequests < 1 ||
    maxRequests > C04_COHORT_COMPARISON_MAX_REQUESTS_PER_RUN
  ) {
    throw new TypeError('C04 public fetch requires native fetch and a request cap from 1 to 16.');
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
    const hasCredentials =
      headers.has('authorization') ||
      headers.has('cookie') ||
      headers.has('proxy-authorization') ||
      headers.has('x-api-key') ||
      Boolean(url.username || url.password);
    const allowedRoute =
      url.search === '' &&
      url.hash === '' &&
      ((method === 'POST' && url.pathname === '/v0/search/subjects') ||
        (method === 'GET' && /^\/v0\/subjects\/[1-9]\d*$/u.test(url.pathname)));

    if (hasCredentials) counters.credentialAttemptCount += 1;
    if (url.origin !== 'https://api.bgm.tv' || !allowedRoute || hasCredentials) {
      counters.deniedRequestCount += 1;
      if (url.origin !== 'https://api.bgm.tv' || !allowedRoute) counters.unexpectedRouteCount += 1;
      throw new Error('C04 public profile denied an unregistered anonymous v0 request.');
    }
    if (counters.requestCount >= maxRequests) {
      counters.deniedRequestCount += 1;
      counters.budgetExceeded = true;
      throw new Error('C04 public profile request budget exceeded.');
    }

    counters.requestCount += 1;
    counters.allowedRequestCount += 1;
    return fetchImpl(input, { ...init, method, headers, redirect: 'error' });
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
