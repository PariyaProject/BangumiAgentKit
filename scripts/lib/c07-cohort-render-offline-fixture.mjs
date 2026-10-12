export const C07_COHORT_RENDER_OFFLINE_FIXTURE_PROFILE = 'run95-c07-cohort-render-v1';

export const C07_COHORT_RENDER_EXPECTED_ARGUMENTS = Object.freeze({
  cohorts: [
    {
      label: '合成样本 A',
      query: {
        keyword: 'run95 synthetic cohort a',
        media: 'anime',
        resultMode: 'all',
        limit: 1,
      },
    },
    {
      label: '合成样本 B',
      query: {
        keyword: 'run95 synthetic cohort b',
        media: 'anime',
        resultMode: 'all',
        limit: 1,
      },
    },
  ],
  maxSubjects: 1,
});

export function assertC07CohortRenderOfflineProfile({ networkMode, toolName, expectedArguments }) {
  if (networkMode === undefined) return false;
  if (
    networkMode !== C07_COHORT_RENDER_OFFLINE_FIXTURE_PROFILE ||
    toolName !== 'bangumi.render_subject_cohort_comparison' ||
    JSON.stringify(expectedArguments) !== JSON.stringify(C07_COHORT_RENDER_EXPECTED_ARGUMENTS)
  ) {
    throw new Error('The offline cohort fixture only accepts its exact renderer profile.');
  }
  return true;
}

const SUBJECTS = new Map([
  [
    'run95 synthetic cohort a',
    {
      id: 990101,
      name: 'Synthetic Cohort A',
      name_cn: '合成样本 A',
      score: 5,
      rank: 990101,
      countBucket: 5,
      collection: { wish: 5, collect: 70, doing: 3, on_hold: 2, dropped: 1 },
      eps: 12,
    },
  ],
  [
    'run95 synthetic cohort b',
    {
      id: 990102,
      name: 'Synthetic Cohort B',
      name_cn: '合成样本 B',
      score: 8,
      rank: 990102,
      countBucket: 8,
      collection: { wish: 2, collect: 8, doing: 1, on_hold: 1, dropped: 0 },
      eps: 1,
    },
  ],
]);

function jsonResponse(value) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function toUrl(input) {
  if (input instanceof URL) return input;
  if (typeof input === 'string') return new URL(input);
  if (input && typeof input.url === 'string') return new URL(input.url);
  throw new Error('Offline fixture received an invalid request URL.');
}

function requestMethod(input, init) {
  return String(init?.method ?? input?.method ?? 'GET').toUpperCase();
}

function requestHeaders(input, init) {
  return new Headers(init?.headers ?? input?.headers ?? {});
}

function searchSubject(subject) {
  const ratingCount = Object.fromEntries(
    Array.from({ length: 10 }, (_, index) => [
      String(index + 1),
      index + 1 === subject.countBucket ? 10 : 0,
    ]),
  );
  return {
    id: subject.id,
    type: 2,
    name: subject.name,
    name_cn: subject.name_cn,
    date: '2024-04-01',
    platform: 'TV',
    summary: 'Synthetic local fixture; not a Bangumi record.',
    nsfw: false,
    locked: false,
    images: { common: '', large: '', medium: '', small: '' },
    tags: [],
    meta_tags: [],
    rating: {
      score: subject.score,
      rank: subject.rank,
      total: 10,
      count: ratingCount,
    },
    collection: { ...subject.collection },
    eps: subject.eps,
    total_episodes: subject.eps,
  };
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

export function createC07CohortRenderOfflineFixtureFetch() {
  const observedSearches = new Set();
  const observedDetails = new Set();
  const counters = {
    profile: C07_COHORT_RENDER_OFFLINE_FIXTURE_PROFILE,
    requestCount: 0,
    searchRequestCount: 0,
    detailRequestCount: 0,
    unexpectedRequestCount: 0,
    authorizationHeaderCount: 0,
    expectedOperationsComplete: false,
  };

  const fetchFn = async (input, init = {}) => {
    counters.requestCount += 1;
    const url = toUrl(input);
    const method = requestMethod(input, init);
    const headers = requestHeaders(input, init);
    if (headers.has('authorization')) {
      counters.authorizationHeaderCount += 1;
      counters.unexpectedRequestCount += 1;
      return new Response('Offline fixture denied authenticated requests.', { status: 599 });
    }

    if (method === 'POST' && url.pathname === '/v0/search/subjects') {
      const body = parseBody(init);
      const keyword = body?.keyword;
      const subject = typeof keyword === 'string' ? SUBJECTS.get(keyword) : undefined;
      const valid =
        subject !== undefined &&
        !observedSearches.has(keyword) &&
        url.searchParams.get('limit') === '20' &&
        url.searchParams.get('offset') === '0' &&
        body.sort === 'match' &&
        JSON.stringify(body.filter?.type) === JSON.stringify([2]);
      if (!valid) {
        counters.unexpectedRequestCount += 1;
        return new Response('Offline fixture denied an unexpected search request.', {
          status: 599,
        });
      }
      observedSearches.add(keyword);
      counters.searchRequestCount += 1;
      return jsonResponse({ data: [searchSubject(subject)], total: 1, limit: 20, offset: 0 });
    }

    const detailMatch = /^\/v0\/subjects\/(990101|990102)$/u.exec(url.pathname);
    if (method === 'GET' && detailMatch && url.search === '') {
      const subject = [...SUBJECTS.values()].find((item) => item.id === Number(detailMatch[1]));
      if (!subject || observedDetails.has(subject.id)) {
        counters.unexpectedRequestCount += 1;
        return new Response('Offline fixture denied an unexpected detail request.', {
          status: 599,
        });
      }
      observedDetails.add(subject.id);
      counters.detailRequestCount += 1;
      return jsonResponse(searchSubject(subject));
    }

    counters.unexpectedRequestCount += 1;
    return new Response('Offline fixture denied an unexpected operation.', { status: 599 });
  };

  return {
    fetchFn,
    snapshot() {
      counters.expectedOperationsComplete =
        observedSearches.size === 2 && observedDetails.size === 2;
      return { ...counters };
    },
  };
}
