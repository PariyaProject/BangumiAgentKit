export const A01_AGGREGATE_COHORT_OFFLINE_PROFILE_ID =
  'a01-aggregate-cohort-offline-agent-mcp-matrix-v1';
export const A01_AGGREGATE_COHORT_OFFLINE_EPOCH_ID =
  'run95-a01-aggregate-cohort-matrix-followup-20261018';
export const A01_AGGREGATE_COHORT_OFFLINE_NETWORK_MODE =
  'run95-a01-aggregate-cohort-offline-matrix-v1';
export const A01_AGGREGATE_COHORT_OFFLINE_V2_PROFILE_ID =
  'a01-aggregate-cohort-offline-agent-mcp-matrix-v2';
export const A01_AGGREGATE_COHORT_OFFLINE_V2_EPOCH_ID =
  'run95-a01-aggregate-cohort-offline-matrix-v2-20261019';
export const A01_AGGREGATE_COHORT_OFFLINE_V2_NETWORK_MODE =
  'run95-a01-aggregate-cohort-offline-matrix-v2';
export const A01_AGGREGATE_COHORT_OFFLINE_V3_PROFILE_ID =
  'a01-aggregate-cohort-offline-agent-mcp-matrix-v3';
export const A01_AGGREGATE_COHORT_OFFLINE_V3_EPOCH_ID =
  'run95-a01-aggregate-cohort-offline-matrix-v3-20261022';
// V3 uses the existing v2 offline transport; only its claim and synthetic fixture are new.
export const A01_AGGREGATE_COHORT_OFFLINE_V3_NETWORK_MODE =
  A01_AGGREGATE_COHORT_OFFLINE_V2_NETWORK_MODE;
export const A01_AGGREGATE_COHORT_TOOL = 'bangumi.aggregate_subject_cohort';
export const A01_AGGREGATE_COHORT_OFFLINE_PROFILE_IDS = Object.freeze([
  A01_AGGREGATE_COHORT_OFFLINE_PROFILE_ID,
  A01_AGGREGATE_COHORT_OFFLINE_V2_PROFILE_ID,
  A01_AGGREGATE_COHORT_OFFLINE_V3_PROFILE_ID,
]);

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

export const A01_AGGREGATE_COHORT_OFFLINE_V2_EXPECTED_ARGUMENTS = Object.freeze({
  cohort: {
    label: 'Synthetic aggregate matrix v2 sample',
    query: {
      keyword: 'run95 fresh synthetic aggregation matrix v2 2026-10-19',
      media: 'anime',
      resultMode: 'all',
      limit: 1,
    },
  },
  maxSubjects: 1,
});

export const A01_AGGREGATE_COHORT_OFFLINE_V3_EXPECTED_ARGUMENTS = Object.freeze({
  cohort: {
    label: 'Synthetic aggregate matrix v3 sample',
    query: {
      keyword: 'run95 fresh synthetic aggregate profile v3 2026-10-22',
      media: 'anime',
      resultMode: 'all',
      limit: 1,
    },
  },
  maxSubjects: 1,
});

const PROFILE_SPECS = new Map([
  [
    A01_AGGREGATE_COHORT_OFFLINE_PROFILE_ID,
    {
      epochId: A01_AGGREGATE_COHORT_OFFLINE_EPOCH_ID,
      networkMode: A01_AGGREGATE_COHORT_OFFLINE_NETWORK_MODE,
      arguments: A01_AGGREGATE_COHORT_EXPECTED_ARGUMENTS,
      subject: {
        id: 990184,
        name: 'Synthetic Aggregate Matrix Subject',
        nameCn: '合成聚合矩阵条目',
        score: 7,
        rank: 990184,
        date: '2024-04-01',
        platform: 'TV',
        summary: 'Synthetic local fixture; not a Bangumi record.',
        episodeCount: 12,
        totalEpisodes: 12,
        collection: { wish: 3, collect: 50, doing: 2, on_hold: 1, dropped: 0 },
        rating: {
          score: 7,
          rank: 990184,
          total: 10,
          count: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 5, 7: 0, 8: 5, 9: 0, 10: 0 },
        },
      },
      expectedMetrics: [
        { key: 'score', value: 7 },
        { key: 'heat', value: 56 },
        { key: 'episodesReported', value: 12 },
        { key: 'ratingStandardDeviation', value: 1 },
      ],
    },
  ],
  [
    A01_AGGREGATE_COHORT_OFFLINE_V2_PROFILE_ID,
    {
      epochId: A01_AGGREGATE_COHORT_OFFLINE_V2_EPOCH_ID,
      networkMode: A01_AGGREGATE_COHORT_OFFLINE_V2_NETWORK_MODE,
      arguments: A01_AGGREGATE_COHORT_OFFLINE_V2_EXPECTED_ARGUMENTS,
      subject: {
        id: 991219,
        name: 'Synthetic Aggregate Matrix V2 Subject',
        nameCn: '合成聚合矩阵二版条目',
        score: 6.5,
        rank: 991219,
        date: '2025-01-01',
        platform: 'TV',
        summary: 'Fresh synthetic v2 fixture; not a Bangumi record.',
        episodeCount: 10,
        totalEpisodes: 12,
        collection: { wish: 4, collect: 61, doing: 3, on_hold: 2, dropped: 1 },
        rating: {
          score: 6.5,
          rank: 991219,
          total: 10,
          count: { 1: 0, 2: 0, 3: 0, 4: 5, 5: 0, 6: 0, 7: 0, 8: 5, 9: 0, 10: 0 },
        },
      },
      expectedMetrics: [
        { key: 'score', value: 6.5 },
        { key: 'heat', value: 71 },
        { key: 'episodesReported', value: 10 },
        { key: 'ratingStandardDeviation', value: 2 },
      ],
    },
  ],
  [
    A01_AGGREGATE_COHORT_OFFLINE_V3_PROFILE_ID,
    {
      epochId: A01_AGGREGATE_COHORT_OFFLINE_V3_EPOCH_ID,
      networkMode: A01_AGGREGATE_COHORT_OFFLINE_V3_NETWORK_MODE,
      arguments: A01_AGGREGATE_COHORT_OFFLINE_V3_EXPECTED_ARGUMENTS,
      subject: {
        id: 991220,
        name: 'Synthetic Aggregate Matrix V3 Subject',
        nameCn: '合成聚合矩阵三版条目',
        score: 7,
        rank: 991220,
        date: '2025-04-01',
        platform: 'TV',
        summary: 'Fresh synthetic v3 fixture; not a Bangumi record.',
        episodeCount: 12,
        totalEpisodes: 12,
        collection: { wish: 5, collect: 80, doing: 4, on_hold: 1, dropped: 0 },
        rating: {
          score: 7,
          rank: 991220,
          total: 10,
          count: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 5, 7: 0, 8: 5, 9: 0, 10: 0 },
        },
      },
      expectedMetrics: [
        { key: 'score', value: 7 },
        { key: 'heat', value: 90 },
        { key: 'episodesReported', value: 12 },
        { key: 'ratingStandardDeviation', value: 1 },
      ],
    },
  ],
]);

export function getA01AggregateCohortOfflineProfileSpec(profileOrId) {
  const id = typeof profileOrId === 'string' ? profileOrId : profileOrId?.id;
  const spec = PROFILE_SPECS.get(id);
  return spec ? { id, ...spec } : null;
}

export function assertA01AggregateCohortOfflineProfile(profile) {
  const spec = getA01AggregateCohortOfflineProfileSpec(profile);
  const call = profile?.calls?.[0];
  if (
    !spec ||
    profile?.epochId !== spec.epochId ||
    profile?.frontierId !== 'A01' ||
    profile?.networkMode !== spec.networkMode ||
    profile?.toolName !== A01_AGGREGATE_COHORT_TOOL ||
    profile?.acceptanceScope !== 'agent-mcp-matrix-only' ||
    profile?.calls?.length !== 1 ||
    call?.toolName !== A01_AGGREGATE_COHORT_TOOL ||
    JSON.stringify(call?.arguments) !== JSON.stringify(spec.arguments)
  ) {
    throw new Error(
      'A01 aggregate offline mode accepts only a registered exact matrix-only profile.',
    );
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

function toBangumiSubject(subject) {
  return {
    id: subject.id,
    type: 2,
    name: subject.name,
    name_cn: subject.nameCn,
    score: subject.score,
    rank: subject.rank,
    date: subject.date,
    platform: subject.platform,
    summary: subject.summary,
    nsfw: false,
    locked: false,
    images: { common: '', large: '', medium: '', small: '' },
    tags: [],
    meta_tags: [],
    rating: subject.rating,
    collection: subject.collection,
    eps: subject.episodeCount,
    total_episodes: subject.totalEpisodes,
  };
}

function syntheticSearchSubject(subject) {
  return {
    id: subject.id,
    type: 2,
    name: subject.name,
    name_cn: subject.nameCn,
    date: subject.date,
    platform: subject.platform,
    summary: subject.summary,
    nsfw: false,
    locked: false,
    images: { common: '', large: '', medium: '', small: '' },
    tags: [],
    meta_tags: [],
    eps: subject.episodeCount,
    total_episodes: subject.totalEpisodes,
  };
}

export function createA01AggregateCohortOfflineFetch(
  profile = A01_AGGREGATE_COHORT_OFFLINE_PROFILE_ID,
) {
  const spec = getA01AggregateCohortOfflineProfileSpec(profile);
  if (!spec) throw new Error('Unknown A01 aggregate offline fixture profile.');
  const syntheticSubject = toBangumiSubject(spec.subject);
  const counters = {
    profile: spec.id,
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
        body?.keyword === spec.arguments.cohort.query.keyword &&
        body?.sort === 'match' &&
        JSON.stringify(Object.keys(body?.filter ?? {}).sort()) === JSON.stringify(['type']) &&
        JSON.stringify(body?.filter?.type) === JSON.stringify([2]);
      if (valid) {
        searchObserved = true;
        counters.searchRequestCount += 1;
        return jsonResponse({
          data: [syntheticSearchSubject(spec.subject)],
          total: 1,
          limit: 20,
          offset: 0,
        });
      }
    }

    if (
      method === 'GET' &&
      url.origin === 'https://api.bgm.tv' &&
      url.pathname === `/v0/subjects/${spec.subject.id}` &&
      url.search === '' &&
      searchObserved &&
      !detailObserved
    ) {
      detailObserved = true;
      counters.detailRequestCount += 1;
      return jsonResponse(syntheticSubject);
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
