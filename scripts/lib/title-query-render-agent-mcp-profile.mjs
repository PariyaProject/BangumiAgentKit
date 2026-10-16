import { canonicalJson } from './codex-one-tool-evidence.mjs';

export const TITLE_QUERY_RENDER_PROFILE_ID = 'query-render-title-agent-mcp-v1';
export const TITLE_QUERY_RENDER_EPOCH_ID = 'run95-title-query-render-agent-mcp-matrix-20261017';
export const TITLE_QUERY_RENDER_NETWORK_MODE = 'run95-title-query-render-matrix-public-v1';
export const TITLE_QUERY_RENDER_SERVER_ID = 'bgk_title_query_render';
export const TITLE_QUERY_RENDER_MAX_REQUESTS = 8;
export const TITLE_QUERY_RENDER_TOOL_NAMES = Object.freeze([
  'bangumi.query_subjects',
  'bangumi.render_query_subjects',
]);

const expectedArguments = Object.freeze({
  keyword: '葬送的芙莉莲',
  media: 'anime',
  resultMode: 'all',
  limit: 1,
  sort: 'relevance',
  explain: 'compact',
  nsfw: false,
});

export const TITLE_QUERY_RENDER_CALLS = Object.freeze(
  TITLE_QUERY_RENDER_TOOL_NAMES.map((toolName) =>
    Object.freeze({ toolName, arguments: expectedArguments }),
  ),
);

export function assertTitleQueryRenderPublicProfile(profile) {
  return Boolean(
    profile &&
      profile.id === TITLE_QUERY_RENDER_PROFILE_ID &&
      profile.frontierId === 'G01' &&
      profile.epochId === TITLE_QUERY_RENDER_EPOCH_ID &&
      profile.acceptanceScope === 'agent-mcp-matrix-only' &&
      profile.toolName === TITLE_QUERY_RENDER_TOOL_NAMES[0] &&
      canonicalJson(profile.toolNames) === canonicalJson(TITLE_QUERY_RENDER_TOOL_NAMES) &&
      profile.networkMode === TITLE_QUERY_RENDER_NETWORK_MODE &&
      profile.model === 'gpt-6-luna' &&
      profile.reasoningEffort === 'max' &&
      canonicalJson(profile.calls) === canonicalJson(TITLE_QUERY_RENDER_CALLS),
  );
}

function hasBoundedSearchPagination(url, maxRequests) {
  const entries = [...url.searchParams.entries()];
  const limits = url.searchParams.getAll('limit');
  const offsets = url.searchParams.getAll('offset');
  if (entries.length !== 2 || limits.length !== 1 || offsets.length !== 1) return false;
  if (!/^[1-9]\d*$/u.test(limits[0] ?? '') || !/^(0|[1-9]\d*)$/u.test(offsets[0] ?? '')) {
    return false;
  }

  const limit = Number(limits[0]);
  const offset = Number(offsets[0]);
  // The registered limit=1 query compiles to 20-row official search pages.
  // Keep pagination within the profile's aggregate request cap.
  return (
    limit === 20 &&
    Number.isSafeInteger(offset) &&
    offset % limit === 0 &&
    offset / limit < maxRequests
  );
}

export function createTitleQueryRenderPublicFetch({
  fetchImpl = globalThis.fetch,
  maxRequests = TITLE_QUERY_RENDER_MAX_REQUESTS,
} = {}) {
  if (
    typeof fetchImpl !== 'function' ||
    !Number.isSafeInteger(maxRequests) ||
    maxRequests < 1 ||
    maxRequests > TITLE_QUERY_RENDER_MAX_REQUESTS
  ) {
    throw new TypeError('Title query/render fetch requires native fetch and a request cap from 1 to 8.');
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
      ) || Boolean(url.username || url.password) || credentialedMode;
    const allowedRoute =
      url.hash === '' &&
      ((method === 'POST' &&
        url.pathname === '/v0/search/subjects' &&
        hasBoundedSearchPagination(url, maxRequests)) ||
        (method === 'GET' &&
          url.search === '' &&
          /^\/v0\/subjects\/[1-9]\d*$/u.test(url.pathname)));

    if (hasCredentials) counters.credentialAttemptCount += 1;
    if (url.origin !== 'https://api.bgm.tv' || !allowedRoute || hasCredentials) {
      counters.deniedRequestCount += 1;
      if (url.origin !== 'https://api.bgm.tv' || !allowedRoute)
        counters.unexpectedRouteCount += 1;
      throw new Error('Title query/render profile denied an unregistered anonymous v0 request.');
    }
    if (counters.requestCount >= maxRequests) {
      counters.deniedRequestCount += 1;
      counters.budgetExceeded = true;
      throw new Error('Title query/render profile request budget exceeded.');
    }

    counters.requestCount += 1;
    counters.allowedRequestCount += 1;
    return fetchImpl(input, { ...init, method, headers, credentials: 'omit', redirect: 'error' });
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
