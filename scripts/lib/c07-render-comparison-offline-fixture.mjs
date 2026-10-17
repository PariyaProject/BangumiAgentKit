import {
  C07_RENDER_COMPARISON_OFFLINE_EXPECTED_ARGUMENTS,
  C07_RENDER_COMPARISON_OFFLINE_NETWORK_MODE,
  C07_RENDER_COMPARISON_OFFLINE_SYNTHETIC_KEYWORD,
  C07_RENDER_COMPARISON_OFFLINE_SYNTHETIC_SUBJECT_ID,
  assertC07RenderComparisonOfflineProfile,
} from './c07-render-comparison-offline-profile.mjs';

const ORIGIN = 'https://api.bgm.tv';
const SEARCH_PATH = '/v0/search/subjects';
const DETAIL_PATH = `/v0/subjects/${C07_RENDER_COMPARISON_OFFLINE_SYNTHETIC_SUBJECT_ID}`;

function response(value) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function toUrl(input) {
  if (input instanceof URL) return input;
  if (typeof input === 'string') return new URL(input);
  if (input && typeof input.url === 'string') return new URL(input.url);
  throw new Error('C07 render-comparison fixture received an invalid request URL.');
}

function requestMethod(input, init) {
  return String(init?.method ?? input?.method ?? 'GET').toUpperCase();
}

function requestHeaders(input, init) {
  return new Headers(init?.headers ?? input?.headers ?? {});
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

function syntheticSubject() {
  return {
    id: C07_RENDER_COMPARISON_OFFLINE_SYNTHETIC_SUBJECT_ID,
    type: 2,
    name: 'Synthetic Cohort C Work 990301',
    name_cn: '合成样本 C 作品 990301',
    date: '2024-04-01',
    platform: 'TV',
    summary: 'Synthetic offline fixture only; not a Bangumi record.',
    nsfw: false,
    locked: false,
    images: { common: '', large: '', medium: '', small: '' },
    tags: [],
    meta_tags: [],
    rating: {
      score: 7,
      rank: C07_RENDER_COMPARISON_OFFLINE_SYNTHETIC_SUBJECT_ID,
      total: 10,
      count: Object.fromEntries(
        Array.from({ length: 10 }, (_, index) => [String(index + 1), index === 6 ? 10 : 0]),
      ),
    },
    collection: { wish: 1, collect: 2, doing: 0, on_hold: 0, dropped: 0 },
    eps: 1,
    total_episodes: 1,
  };
}

export function createC07RenderComparisonOfflineFetch() {
  const observedSearches = new Set();
  const observedDetails = new Set();
  const counters = {
    profile: C07_RENDER_COMPARISON_OFFLINE_NETWORK_MODE,
    requestCount: 0,
    searchRequestCount: 0,
    subjectDetailRequestCount: 0,
    duplicateRequestCount: 0,
    unexpectedRequestCount: 0,
    authorizationHeaderCount: 0,
    expectedOperationsComplete: false,
    rawFixturePayloadStored: false,
  };

  const fetchFn = async (input, init = {}) => {
    counters.requestCount += 1;
    let url;
    try {
      url = toUrl(input);
    } catch {
      counters.unexpectedRequestCount += 1;
      return new Response('C07 render-comparison fixture denied an invalid URL.', { status: 599 });
    }
    const method = requestMethod(input, init);
    const headers = requestHeaders(input, init);
    if (headers.has('authorization')) counters.authorizationHeaderCount += 1;
    if (url.origin !== ORIGIN || url.username || url.password || url.hash) {
      counters.unexpectedRequestCount += 1;
      return new Response('C07 render-comparison fixture denied an unexpected origin.', {
        status: 599,
      });
    }

    if (method === 'POST' && url.pathname === SEARCH_PATH) {
      const body = parseBody(init);
      const valid =
        url.href === `${ORIGIN}${SEARCH_PATH}?limit=20&offset=0` &&
        !headers.has('authorization') &&
        Object.keys(body ?? {})
          .sort()
          .join(',') === 'filter,keyword,sort' &&
        Object.keys(body?.filter ?? {})
          .sort()
          .join(',') === 'type' &&
        body?.keyword === C07_RENDER_COMPARISON_OFFLINE_SYNTHETIC_KEYWORD &&
        body.sort === 'match' &&
        JSON.stringify(body.filter.type) === JSON.stringify([2]);
      const duplicate =
        valid && observedSearches.has(C07_RENDER_COMPARISON_OFFLINE_SYNTHETIC_KEYWORD);
      if (!valid || duplicate) {
        if (duplicate) counters.duplicateRequestCount += 1;
        counters.unexpectedRequestCount += 1;
        return new Response('C07 render-comparison fixture denied an unexpected search.', {
          status: 599,
        });
      }
      observedSearches.add(C07_RENDER_COMPARISON_OFFLINE_SYNTHETIC_KEYWORD);
      counters.searchRequestCount += 1;
      return response({
        data: [syntheticSubject()],
        total: 1,
        limit: 20,
        offset: 0,
      });
    }

    if (
      method === 'GET' &&
      url.pathname === DETAIL_PATH &&
      url.href === `${ORIGIN}${DETAIL_PATH}`
    ) {
      if (headers.has('authorization') || init?.body !== undefined) {
        counters.unexpectedRequestCount += 1;
        return new Response('C07 render-comparison fixture denied a detail request variant.', {
          status: 599,
        });
      }
      if (observedDetails.has(C07_RENDER_COMPARISON_OFFLINE_SYNTHETIC_SUBJECT_ID)) {
        counters.duplicateRequestCount += 1;
        counters.unexpectedRequestCount += 1;
        return new Response('C07 render-comparison fixture denied a duplicate detail request.', {
          status: 599,
        });
      }
      observedDetails.add(C07_RENDER_COMPARISON_OFFLINE_SYNTHETIC_SUBJECT_ID);
      counters.subjectDetailRequestCount += 1;
      return response(syntheticSubject());
    }

    counters.unexpectedRequestCount += 1;
    return new Response('C07 render-comparison fixture denied an unexpected operation.', {
      status: 599,
    });
  };

  return {
    fetchFn,
    snapshot() {
      counters.expectedOperationsComplete =
        observedSearches.size === 1 && observedDetails.size === 1;
      return { ...counters };
    },
  };
}

export function createC07RenderComparisonOfflineAssetGuard() {
  const counters = {
    assetResolutionCallCount: 0,
    nonEmptyAssetUrlCount: 0,
    blockedAssetRequestCount: 0,
  };
  const assetResolver = {
    async resolveAsset(url) {
      counters.assetResolutionCallCount += 1;
      if (typeof url === 'string' && url.length > 0) counters.nonEmptyAssetUrlCount += 1;
      counters.blockedAssetRequestCount += 1;
      throw new Error(
        'C07 render-comparison offline profile denies all renderer asset resolution.',
      );
    },
  };
  return {
    assetResolver,
    snapshot() {
      return { ...counters };
    },
  };
}

export function assertC07RenderComparisonOfflineFixtureProfile(profile) {
  if (!assertC07RenderComparisonOfflineProfile(profile)) {
    throw new Error('C07 render-comparison fixture requires its exact registered profile.');
  }
  if (
    canonicalArguments(profile.calls[0].arguments) !==
    canonicalArguments(C07_RENDER_COMPARISON_OFFLINE_EXPECTED_ARGUMENTS)
  ) {
    throw new Error('C07 render-comparison fixture arguments do not match its exact profile.');
  }
  return true;
}

function canonicalArguments(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalArguments).join(',')}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalArguments(value[key])}`)
    .join(',')}}`;
}
