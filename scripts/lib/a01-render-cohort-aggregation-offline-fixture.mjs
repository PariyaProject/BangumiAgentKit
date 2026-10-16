export const A01_RENDER_COHORT_AGGREGATION_PROFILE_ID =
  'a01-render-cohort-aggregation-agent-mcp-offline-v1';
export const A01_RENDER_COHORT_AGGREGATION_NETWORK_MODE =
  'run95-a01-render-cohort-aggregation-offline-v1';
export const A01_RENDER_COHORT_AGGREGATION_TOOL = 'bangumi.render_subject_cohort_aggregation';

export const A01_RENDER_COHORT_AGGREGATION_EXPECTED_ARGUMENTS = Object.freeze({
  cohort: {
    label: 'Run95 synthetic aggregation sample',
    query: {
      keyword: 'run95 synthetic cohort aggregation',
      media: 'anime',
      resultMode: 'all',
      limit: 1,
    },
  },
  maxSubjects: 1,
});

const SYNTHETIC_SUBJECT = Object.freeze({
  id: 990103,
  name: 'Synthetic Aggregation Sample',
  name_cn: '合成聚合样本',
  score: 7.5,
  rank: 990103,
  date: '2024-04-01',
  platform: 'TV',
  summary: 'Synthetic local fixture; not a Bangumi record.',
  nsfw: false,
  locked: false,
  images: { common: '', large: '', medium: '', small: '' },
  tags: [],
  meta_tags: [],
  rating: {
    score: 7.5,
    rank: 990103,
    total: 10,
    count: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 1, 7: 2, 8: 4, 9: 2, 10: 1 },
  },
  collection: { wish: 3, collect: 50, doing: 2, on_hold: 1, dropped: 0 },
  eps: 12,
  total_episodes: 12,
});

export function assertA01RenderCohortAggregationOfflineProfile(profile) {
  if (
    profile?.id !== A01_RENDER_COHORT_AGGREGATION_PROFILE_ID ||
    profile?.networkMode !== A01_RENDER_COHORT_AGGREGATION_NETWORK_MODE ||
    profile?.toolName !== A01_RENDER_COHORT_AGGREGATION_TOOL ||
    profile?.acceptanceScope !== 'agent-mcp-matrix-only' ||
    profile?.calls?.length !== 1 ||
    profile.calls[0]?.toolName !== A01_RENDER_COHORT_AGGREGATION_TOOL ||
    JSON.stringify(profile.calls[0]?.arguments) !==
      JSON.stringify(A01_RENDER_COHORT_AGGREGATION_EXPECTED_ARGUMENTS)
  ) {
    throw new Error('A01 aggregation offline mode accepts only its exact matrix-only profile.');
  }
  return true;
}

function toUrl(input) {
  if (input instanceof URL) return input;
  if (typeof input === 'string') return new URL(input);
  if (input && typeof input.url === 'string') return new URL(input.url);
  throw new Error('A01 offline fixture received an invalid request URL.');
}

function parseBody(init) {
  if (typeof init?.body !== 'string') return null;
  try {
    const value = JSON.parse(init.body);
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

function jsonResponse(value) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function syntheticSearchSubject() {
  return {
    id: SYNTHETIC_SUBJECT.id,
    type: 2,
    name: SYNTHETIC_SUBJECT.name,
    name_cn: SYNTHETIC_SUBJECT.name_cn,
    date: SYNTHETIC_SUBJECT.date,
    platform: SYNTHETIC_SUBJECT.platform,
    summary: SYNTHETIC_SUBJECT.summary,
    nsfw: false,
    locked: false,
    images: { common: '', large: '', medium: '', small: '' },
    tags: [],
    meta_tags: [],
    eps: SYNTHETIC_SUBJECT.eps,
    total_episodes: SYNTHETIC_SUBJECT.total_episodes,
  };
}

export function createA01RenderCohortAggregationOfflineFetch() {
  const counters = {
    profile: A01_RENDER_COHORT_AGGREGATION_PROFILE_ID,
    requestCount: 0,
    searchRequestCount: 0,
    detailRequestCount: 0,
    unexpectedRequestCount: 0,
    authorizationHeaderCount: 0,
    expectedOperationsComplete: false,
  };
  let searchObserved = false;
  let detailObserved = false;

  const fetchFn = async (input, init = {}) => {
    counters.requestCount += 1;
    const url = toUrl(input);
    const method = String(init?.method ?? input?.method ?? 'GET').toUpperCase();
    const headers = new Headers(init?.headers ?? input?.headers ?? {});
    if (headers.has('authorization')) {
      counters.authorizationHeaderCount += 1;
      counters.unexpectedRequestCount += 1;
      return new Response('Offline fixture denied authenticated requests.', { status: 599 });
    }

    if (
      method === 'POST' &&
      url.origin === 'https://api.bgm.tv' &&
      url.pathname === '/v0/search/subjects' &&
      !searchObserved
    ) {
      const body = parseBody(init);
      const valid =
        url.search === '?limit=20&offset=0' &&
        JSON.stringify(Object.keys(body ?? {}).sort()) ===
          JSON.stringify(['filter', 'keyword', 'sort']) &&
        body?.keyword === A01_RENDER_COHORT_AGGREGATION_EXPECTED_ARGUMENTS.cohort.query.keyword &&
        body?.sort === 'match' &&
        JSON.stringify(Object.keys(body?.filter ?? {}).sort()) === JSON.stringify(['type']) &&
        JSON.stringify(body?.filter?.type) === JSON.stringify([2]);
      if (valid) {
        searchObserved = true;
        counters.searchRequestCount += 1;
        return jsonResponse({ data: [syntheticSearchSubject()], total: 1, limit: 20, offset: 0 });
      }
    }

    if (
      method === 'GET' &&
      url.origin === 'https://api.bgm.tv' &&
      url.pathname === `/v0/subjects/${SYNTHETIC_SUBJECT.id}` &&
      url.search === '' &&
      !detailObserved
    ) {
      detailObserved = true;
      counters.detailRequestCount += 1;
      return jsonResponse(SYNTHETIC_SUBJECT);
    }

    counters.unexpectedRequestCount += 1;
    return new Response('Offline fixture denied an unexpected operation.', { status: 599 });
  };

  return {
    fetchFn,
    snapshot() {
      counters.expectedOperationsComplete = searchObserved && detailObserved;
      return { ...counters };
    },
  };
}
