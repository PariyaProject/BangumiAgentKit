export const A01_AGGREGATE_COHORT_OFFLINE_PROFILE_ID =
  'a01-aggregate-cohort-offline-agent-mcp-matrix-v1';
export const A01_AGGREGATE_COHORT_OFFLINE_EPOCH_ID =
  'run95-a01-aggregate-cohort-matrix-followup-20261018';
export const A01_AGGREGATE_COHORT_OFFLINE_NETWORK_MODE =
  'run95-a01-aggregate-cohort-offline-matrix-v1';
export const A01_AGGREGATE_COHORT_TOOL = 'bangumi.aggregate_subject_cohort';

export const A01_AGGREGATE_COHORT_EXPECTED_ARGUMENTS = Object.freeze({
  cohort: {
    label: 'Synthetic aggregate matrix sample',
    query: {
      keyword: 'synthetic aggregate cohort run95 2026-10-18',
      media: 'anime',
      resultMode: 'all',
      limit: 1,
    },
  },
  maxSubjects: 1,
});

const SYNTHETIC_SUBJECT = Object.freeze({
  id: 990184,
  type: 2,
  name: 'Synthetic Aggregate Matrix Subject',
  name_cn: '合成聚合矩阵条目',
  score: 7,
  rank: 990184,
  date: '2024-04-01',
  platform: 'TV',
  summary: 'Synthetic local fixture; not a Bangumi record.',
  nsfw: false,
  locked: false,
  images: { common: '', large: '', medium: '', small: '' },
  tags: [],
  meta_tags: [],
  rating: {
    score: 7,
    rank: 990184,
    total: 10,
    count: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 5, 7: 0, 8: 5, 9: 0, 10: 0 },
  },
  collection: { wish: 3, collect: 50, doing: 2, on_hold: 1, dropped: 0 },
  eps: 12,
  total_episodes: 12,
});

export function assertA01AggregateCohortOfflineProfile(profile) {
  const call = profile?.calls?.[0];
  if (
    profile?.id !== A01_AGGREGATE_COHORT_OFFLINE_PROFILE_ID ||
    profile?.epochId !== A01_AGGREGATE_COHORT_OFFLINE_EPOCH_ID ||
    profile?.frontierId !== 'A01' ||
    profile?.networkMode !== A01_AGGREGATE_COHORT_OFFLINE_NETWORK_MODE ||
    profile?.toolName !== A01_AGGREGATE_COHORT_TOOL ||
    profile?.acceptanceScope !== 'agent-mcp-matrix-only' ||
    profile?.calls?.length !== 1 ||
    call?.toolName !== A01_AGGREGATE_COHORT_TOOL ||
    JSON.stringify(call?.arguments) !== JSON.stringify(A01_AGGREGATE_COHORT_EXPECTED_ARGUMENTS)
  ) {
    throw new Error('A01 aggregate offline mode accepts only its exact matrix-only profile.');
  }
  return true;
}

function toUrl(input) {
  if (input instanceof URL) return input;
  if (typeof input === 'string') return new URL(input);
  if (input && typeof input.url === 'string') return new URL(input.url);
  throw new Error('A01 aggregate offline fixture received an invalid request URL.');
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

export function createA01AggregateCohortOfflineFetch() {
  const counters = {
    profile: A01_AGGREGATE_COHORT_OFFLINE_PROFILE_ID,
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
    if (url.username || url.password) {
      counters.unexpectedRequestCount += 1;
      return new Response('Offline fixture denied credentialed request URLs.', { status: 599 });
    }
    if (headers.has('authorization')) {
      counters.authorizationHeaderCount += 1;
      counters.unexpectedRequestCount += 1;
      return new Response('Offline fixture denied authenticated requests.', { status: 599 });
    }
    if (headers.has('proxy-authorization') || headers.has('cookie') || headers.has('x-api-key')) {
      counters.unexpectedRequestCount += 1;
      return new Response('Offline fixture denied credential-bearing headers.', { status: 599 });
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
        body?.keyword === A01_AGGREGATE_COHORT_EXPECTED_ARGUMENTS.cohort.query.keyword &&
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
      searchObserved &&
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
