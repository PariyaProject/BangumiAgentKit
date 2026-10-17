import {
  canonicalAgentMcpProfileJson,
  getAgentMcpProfileById,
} from './agent-mcp-profile-claims.mjs';

export const A01_RATING_DISPERSION_PROFILE_ID = 'a01-rating-dispersion-1998-spring-v1';
export const A01_RATING_DISPERSION_NETWORK_MODE = 'run95-a01-rating-dispersion-public-v1';
export const A01_RATING_DISPERSION_SERVER_ID = 'bgk_a01_rating_dispersion';
export const A01_RATING_DISPERSION_MAX_REQUESTS = 20;
export const A01_RATING_DISPERSION_MAX_SEARCH_OFFSET = 0;

export const A01_RATING_DISPERSION_PROFILE = getAgentMcpProfileById(
  A01_RATING_DISPERSION_PROFILE_ID,
);
const EXPECTED_CALLS = [
  {
    toolName: 'bangumi.compare_subject_cohorts',
    arguments: {
      cohorts: [
        {
          label: 'Run95 A01 Cardcaptor Sakura 1998-spring TV sample',
          query: {
            keyword: 'カードキャプターさくら',
            media: 'anime',
            categories: 'tv',
            season: '1998-spring',
            resultMode: 'all',
            nsfw: 'exclude',
            limit: 4,
            budget: {
              maxPages: 1,
              maxCandidates: 20,
              maxHydrations: 4,
              concurrency: 2,
              maxConceptProbes: 1,
              maxReturnedItems: 4,
            },
          },
        },
        {
          label: 'Run95 A01 1998-spring anime returned sample',
          query: {
            media: 'anime',
            season: '1998-spring',
            resultMode: 'all',
            nsfw: 'exclude',
            limit: 4,
            budget: {
              maxPages: 1,
              maxCandidates: 20,
              maxHydrations: 4,
              concurrency: 2,
              maxConceptProbes: 1,
              maxReturnedItems: 4,
            },
          },
        },
      ],
      maxSubjects: 4,
    },
  },
];

export function assertA01RatingDispersionProfile(profile = A01_RATING_DISPERSION_PROFILE) {
  return Boolean(
    profile &&
    profile.id === A01_RATING_DISPERSION_PROFILE_ID &&
    profile.frontierId === 'A01' &&
    profile.epochId === 'run95-a01-rating-dispersion-agent-mcp-1998-spring' &&
    profile.toolName === 'bangumi.compare_subject_cohorts' &&
    profile.argumentProfile === 'fixed-a01-rating-dispersion-cardcaptor-1998-spring-max4-v1' &&
    profile.claimLabelName === 'harness-r95-a01-rating-sd-1998-spring-claimed' &&
    profile.reportPath ===
      'docs/live-probes/a01-rating-dispersion-agent-mcp-1998-spring-run95.json' &&
    profile.selectionEvidencePath ===
      'docs/research/run95-a01-rating-dispersion-1998-spring-agent-mcp-contract.md' &&
    profile.evidenceKind === 'codex_cli_a01_rating_dispersion_agent_mcp_v1' &&
    profile.answerCheckMethod === 'a01-fixed-target-vs-seasonal-sample-rating-sd-v1' &&
    profile.acceptanceScope === 'agent-mcp-scenario-and-matrix' &&
    profile.networkMode === A01_RATING_DISPERSION_NETWORK_MODE &&
    profile.model === 'gpt-6-luna' &&
    profile.reasoningEffort === 'max' &&
    profile.maxAnswerBytes === 4096 &&
    canonicalAgentMcpProfileJson(profile.answerProfile) ===
      canonicalAgentMcpProfileJson({
        targetSubjectId: 1940,
        targetSeason: '1998-spring',
        targetDateRange: { from: '1998-04-01', to: '1998-07-01' },
        maxSubjects: 4,
      }) &&
    canonicalAgentMcpProfileJson(profile.calls) === canonicalAgentMcpProfileJson(EXPECTED_CALLS) &&
    canonicalAgentMcpProfileJson(profile.toolNames ?? [profile.toolName]) ===
      canonicalAgentMcpProfileJson(['bangumi.compare_subject_cohorts']),
  );
}

function isCanonicalSearchQuery(url) {
  const entries = [...url.searchParams.entries()];
  const limitValues = url.searchParams.getAll('limit');
  const offsetValues = url.searchParams.getAll('offset');
  return (
    entries.length === 2 &&
    limitValues.length === 1 &&
    limitValues[0] === '20' &&
    offsetValues.length === 1 &&
    offsetValues[0] === String(A01_RATING_DISPERSION_MAX_SEARCH_OFFSET) &&
    entries.every(([key]) => key === 'limit' || key === 'offset')
  );
}

export function createA01RatingDispersionPublicFetch({
  fetchImpl = globalThis.fetch,
  maxRequests = A01_RATING_DISPERSION_MAX_REQUESTS,
} = {}) {
  if (
    typeof fetchImpl !== 'function' ||
    !Number.isSafeInteger(maxRequests) ||
    maxRequests < 1 ||
    maxRequests > A01_RATING_DISPERSION_MAX_REQUESTS
  ) {
    throw new TypeError(
      'A01 rating-dispersion fetch requires native fetch and a request cap from 1 to 20.',
    );
  }

  const counters = {
    requestCount: 0,
    allowedRequestCount: 0,
    deniedRequestCount: 0,
    searchRequestCount: 0,
    detailRequestCount: 0,
    credentialAttemptCount: 0,
    unexpectedRouteCount: 0,
    budgetExceeded: false,
  };

  const fetchFn = async (input, init = {}) => {
    const requestObject = typeof Request !== 'undefined' && input instanceof Request;
    const rawUrl = requestObject ? input.url : String(input);
    let url;
    try {
      url = new URL(rawUrl);
    } catch {
      counters.deniedRequestCount += 1;
      counters.unexpectedRouteCount += 1;
      throw new Error('A01 rating-dispersion profile denied an invalid URL.');
    }
    const method = String(init.method ?? (requestObject ? input.method : 'GET')).toUpperCase();
    const headers = new Headers(init.headers ?? (requestObject ? input.headers : undefined));
    const hasCredentials =
      [...headers.keys()].some((name) =>
        /authorization|cookie|token|secret|credential|api[-_]?key/iu.test(name),
      ) ||
      [...url.searchParams.keys()].some((name) =>
        /authorization|cookie|token|secret|credential|api[-_]?key/iu.test(name),
      ) ||
      Boolean(url.username || url.password);
    const searchRoute =
      method === 'POST' && url.pathname === '/v0/search/subjects' && isCanonicalSearchQuery(url);
    const detailRoute =
      method === 'GET' &&
      url.search === '' &&
      url.hash === '' &&
      /^\/v0\/subjects\/[1-9]\d*$/u.test(url.pathname);
    const allowedRoute =
      url.protocol === 'https:' &&
      url.origin === 'https://api.bgm.tv' &&
      url.hash === '' &&
      (searchRoute || detailRoute);

    if (hasCredentials) counters.credentialAttemptCount += 1;
    if (!allowedRoute || hasCredentials) {
      counters.deniedRequestCount += 1;
      if (!allowedRoute) counters.unexpectedRouteCount += 1;
      throw new Error('A01 rating-dispersion profile denied an unregistered anonymous v0 request.');
    }
    if (counters.requestCount >= maxRequests) {
      counters.deniedRequestCount += 1;
      counters.budgetExceeded = true;
      throw new Error('A01 rating-dispersion profile request budget exceeded.');
    }

    counters.requestCount += 1;
    counters.allowedRequestCount += 1;
    if (searchRoute) counters.searchRequestCount += 1;
    else counters.detailRequestCount += 1;
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
        searchPagination: 'limit-20-offset-0-only',
        redirectPolicy: 'error',
      };
    },
  };
}
