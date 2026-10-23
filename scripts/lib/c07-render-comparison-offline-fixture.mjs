import {
  C07_RENDER_COMPARISON_OFFLINE_PROFILE_ID,
  assertC07RenderComparisonOfflineProfile,
  getC07RenderComparisonOfflineConfig,
} from './c07-render-comparison-offline-profile.mjs';

const ORIGIN = 'https://api.bgm.tv';
const SEARCH_PATH = '/v0/search/subjects';
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

function hasRequestBody(input, init) {
  const requestBody = typeof Request !== 'undefined' && input instanceof Request && input.body !== null;
  return requestBody || (init?.body !== undefined && init.body !== null);
}

function syntheticSubject(config, cohort = config.cohorts[0]) {
  const subjectId = cohort.subjectId;
  const score = cohort.score ?? 7;
  const lowerScore = Math.max(1, Math.min(10, Math.floor(score)));
  const upperScore = Math.max(1, Math.min(10, Math.ceil(score)));
  const upperScoreCount = Math.round((score - Math.floor(score)) * 10);
  const lowerScoreCount = 10 - upperScoreCount;
  return {
    id: subjectId,
    type: 2,
    name: cohort.subjectName ?? `Synthetic Cohort ${cohort.cohortLabel.at(-1)} Work ${subjectId}`,
    name_cn: cohort.subjectNameCn ?? `${cohort.cohortLabel} 作品 ${subjectId}`,
    date: '2024-04-01',
    platform: 'TV',
    summary: 'Synthetic offline fixture only; not a Bangumi record.',
    nsfw: false,
    locked: false,
    images: { common: '', large: '', medium: '', small: '' },
    tags: [],
    meta_tags: [],
    rating: {
      score,
      rank: cohort.rank ?? subjectId,
      total: 10,
      count: Object.fromEntries(Array.from({ length: 10 }, (_, index) => {
        const rating = index + 1;
        const count =
          lowerScore === upperScore
            ? rating === lowerScore ? 10 : 0
            : rating === lowerScore
              ? lowerScoreCount
              : rating === upperScore
                ? upperScoreCount
                : 0;
        return [String(rating), count];
      })),
    },
    collection: cohort.collection ?? { wish: 1, collect: 2, doing: 0, on_hold: 0, dropped: 0 },
    eps: cohort.eps ?? 1,
    total_episodes: cohort.totalEpisodes ?? 1,
  };
}

export function createC07RenderComparisonOfflineFetch(
  profile = C07_RENDER_COMPARISON_OFFLINE_PROFILE_ID,
) {
  const profileId = typeof profile === 'string' ? profile : profile?.id;
  const config = getC07RenderComparisonOfflineConfig(profileId);
  if (!config) throw new Error('C07 render-comparison fixture received an unknown profile.');
  const cohorts = config.cohorts;
  const cohortByKeyword = new Map(cohorts.map((cohort) => [cohort.keyword, cohort]));
  const cohortBySubjectId = new Map(cohorts.map((cohort) => [cohort.subjectId, cohort]));
  const observedSearches = new Set();
  const observedDetails = new Set();
  const counters = {
    profile: config.networkMode,
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
      const cohort = cohortByKeyword.get(body?.keyword);
      const valid =
        url.href === `${ORIGIN}${SEARCH_PATH}?limit=20&offset=0` &&
        !headers.has('authorization') &&
        Object.keys(body ?? {})
          .sort()
          .join(',') === 'filter,keyword,sort' &&
        Object.keys(body?.filter ?? {})
          .sort()
          .join(',') === 'type' &&
        cohort !== undefined &&
        body.sort === 'match' &&
        JSON.stringify(body.filter.type) === JSON.stringify([2]);
      const duplicate = valid && observedSearches.has(cohort.keyword);
      if (!valid || duplicate) {
        if (duplicate) counters.duplicateRequestCount += 1;
        counters.unexpectedRequestCount += 1;
        return new Response('C07 render-comparison fixture denied an unexpected search.', {
          status: 599,
        });
      }
      observedSearches.add(cohort.keyword);
      counters.searchRequestCount += 1;
      return response({
        data: [syntheticSubject(config, cohort)],
        total: 1,
        limit: 20,
        offset: 0,
      });
    }

    const subjectIdMatch = /^\/v0\/subjects\/(\d+)$/u.exec(url.pathname);
    const subjectId = subjectIdMatch ? Number(subjectIdMatch[1]) : null;
    const cohort = subjectId === null ? undefined : cohortBySubjectId.get(subjectId);
    const detailPath = cohort ? `/v0/subjects/${cohort.subjectId}` : null;
    if (
      method === 'GET' &&
      cohort &&
      detailPath &&
      url.pathname === detailPath &&
      url.href === `${ORIGIN}${detailPath}`
    ) {
      if (headers.has('authorization') || hasRequestBody(input, init)) {
        counters.unexpectedRequestCount += 1;
        return new Response('C07 render-comparison fixture denied a detail request variant.', {
          status: 599,
        });
      }
      if (!observedSearches.has(cohort.keyword) || observedDetails.has(cohort.subjectId)) {
        counters.duplicateRequestCount += 1;
        counters.unexpectedRequestCount += 1;
        return new Response('C07 render-comparison fixture denied a duplicate detail request.', {
          status: 599,
        });
      }
      observedDetails.add(cohort.subjectId);
      counters.subjectDetailRequestCount += 1;
      return response(syntheticSubject(config, cohort));
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
        observedSearches.size === cohorts.length &&
        observedDetails.size === cohorts.length &&
        counters.duplicateRequestCount === 0 &&
        counters.unexpectedRequestCount === 0 &&
        counters.authorizationHeaderCount === 0;
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
    canonicalArguments(getC07RenderComparisonOfflineConfig(profile.id).expectedArguments)
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
