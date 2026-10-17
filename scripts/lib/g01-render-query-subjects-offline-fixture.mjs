import {
  assertG01RenderQueryOfflineProfile,
  getG01RenderQueryOfflineProfileSpec,
} from './g01-render-query-subjects-offline-profile.mjs';
import {
  canonicalAgentMcpProfileJson,
  getAgentMcpProfileById,
} from './agent-mcp-profile-claims.mjs';

const ORIGIN = 'https://api.bgm.tv';
const SEARCH_PATH = '/v0/search/subjects';
const DEFAULT_PROFILE_ID = 'g01-render-query-subjects-offline-agent-mcp-v1';

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
  throw new Error('G01 render-query fixture received an invalid request URL.');
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

function syntheticSubject(subjectId) {
  return {
    id: subjectId,
    type: 2,
    name: `Run95 Synthetic Render Query Work ${subjectId}`,
    name_cn: `Run95 合成渲染查询作品 ${subjectId}`,
    date: '2025-10-01',
    platform: 'TV',
    summary: 'Synthetic offline fixture only; not a Bangumi record.',
    nsfw: false,
    locked: false,
    images: { common: '', large: '', medium: '', small: '' },
    tags: [],
    meta_tags: [],
    eps: 1,
    total_episodes: 1,
    rating: {
      score: 8,
      rank: subjectId,
      total: 1,
      count: Object.fromEntries(
        Array.from({ length: 10 }, (_, index) => [String(index + 1), index === 7 ? 1 : 0]),
      ),
    },
    collection: { wish: 0, collect: 1, doing: 0, on_hold: 0, dropped: 0 },
  };
}

export function createG01RenderQueryOfflineFetch(
  profile = getAgentMcpProfileById(DEFAULT_PROFILE_ID),
) {
  if (!assertG01RenderQueryOfflineProfile(profile)) {
    throw new Error('G01 render-query fixture requires a registered offline profile.');
  }
  const spec = getG01RenderQueryOfflineProfileSpec(profile);
  const expectedArguments = profile.calls[0].arguments;
  const detailPath = `/v0/subjects/${spec.syntheticSubjectId}`;
  const observedSearches = new Set();
  const observedDetails = new Set();
  const counters = {
    profile: spec.networkMode,
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
      return new Response('G01 render-query fixture denied an invalid URL.', { status: 599 });
    }
    const method = requestMethod(input, init);
    const headers = requestHeaders(input, init);
    if (headers.has('authorization')) counters.authorizationHeaderCount += 1;
    if (url.origin !== ORIGIN || url.username || url.password || url.hash) {
      counters.unexpectedRequestCount += 1;
      return new Response('G01 render-query fixture denied an unexpected origin.', { status: 599 });
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
        body?.keyword === expectedArguments.keyword &&
        body.sort === 'match' &&
        canonicalAgentMcpProfileJson(body.filter.type) === canonicalAgentMcpProfileJson([2]);
      const duplicate = valid && observedSearches.has(expectedArguments.keyword);
      if (!valid || duplicate) {
        if (duplicate) counters.duplicateRequestCount += 1;
        counters.unexpectedRequestCount += 1;
        return new Response('G01 render-query fixture denied an unexpected search.', {
          status: 599,
        });
      }
      observedSearches.add(expectedArguments.keyword);
      counters.searchRequestCount += 1;
      const subject = syntheticSubject(spec.syntheticSubjectId);
      delete subject.eps;
      delete subject.total_episodes;
      return response({ data: [subject], total: 1, limit: 20, offset: 0 });
    }

    if (method === 'GET' && url.pathname === detailPath && url.href === `${ORIGIN}${detailPath}`) {
      if (headers.has('authorization') || init?.body !== undefined) {
        counters.unexpectedRequestCount += 1;
        return new Response('G01 render-query fixture denied a detail request variant.', {
          status: 599,
        });
      }
      if (observedDetails.has(spec.syntheticSubjectId)) {
        counters.duplicateRequestCount += 1;
        counters.unexpectedRequestCount += 1;
        return new Response('G01 render-query fixture denied a duplicate detail request.', {
          status: 599,
        });
      }
      observedDetails.add(spec.syntheticSubjectId);
      counters.subjectDetailRequestCount += 1;
      return response(syntheticSubject(spec.syntheticSubjectId));
    }

    counters.unexpectedRequestCount += 1;
    return new Response('G01 render-query fixture denied an unexpected operation.', {
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

export function createG01RenderQueryOfflineAssetResolver() {
  const counters = {
    assetResolutionCallCount: 0,
    nonEmptyAssetUrlCount: 0,
    blockedAssetRequestCount: 0,
  };
  return {
    assetResolver: {
      async resolveAsset(url) {
        counters.assetResolutionCallCount += 1;
        if (typeof url === 'string' && url.length > 0) counters.nonEmptyAssetUrlCount += 1;
        counters.blockedAssetRequestCount += 1;
        throw new Error('G01 synthetic render-query profile denies all remote asset resolution.');
      },
    },
    snapshot() {
      return { ...counters };
    },
  };
}

export function assertG01RenderQueryOfflineFixtureProfile(profile) {
  if (!assertG01RenderQueryOfflineProfile(profile)) {
    throw new Error('G01 render-query offline fixture requires an exact registered profile.');
  }
  return true;
}
