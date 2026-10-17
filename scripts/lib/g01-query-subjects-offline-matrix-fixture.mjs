import { canonicalAgentMcpProfileJson } from './agent-mcp-profile-claims.mjs';
import {
  G01_QUERY_SUBJECTS_OFFLINE_EXPECTED_ARGUMENTS,
  G01_QUERY_SUBJECTS_OFFLINE_NETWORK_MODE,
  G01_QUERY_SUBJECTS_OFFLINE_SYNTHETIC_KEYWORD,
  G01_QUERY_SUBJECTS_OFFLINE_SYNTHETIC_SUBJECT_ID,
  assertG01QuerySubjectsOfflineProfile,
} from './g01-query-subjects-offline-matrix-profile.mjs';

const API_ORIGIN = 'https://api.bgm.tv';
const SEARCH_PATH = '/v0/search/subjects';
const SEARCH_URL = `${API_ORIGIN}${SEARCH_PATH}?limit=20&offset=0`;
const SAFE_REQUEST_HEADERS = new Map([
  ['accept', 'application/json'],
  ['content-type', 'application/json'],
  [
    'user-agent',
    'Kurarion/BangumiAgentKit/0.1.0 (https://github.com/PariyaProject/BangumiAgentKit)',
  ],
]);

function response(value) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function requestUrl(input) {
  if (input instanceof URL) return input;
  if (typeof input === 'string') return new URL(input);
  if (input && typeof input.url === 'string') return new URL(input.url);
  throw new Error('G01 query-subjects offline fixture received an invalid request URL.');
}

function requestMethod(input, init) {
  return String(init?.method ?? input?.method ?? 'GET').toUpperCase();
}

function requestHeaders(input, init) {
  return new Headers(init?.headers ?? input?.headers ?? {});
}

function requestCredentials(input, init) {
  return init?.credentials ?? input?.credentials;
}

function parseBody(init) {
  if (typeof init?.body !== 'string') return null;
  try {
    const parsed = JSON.parse(init.body);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function syntheticSubject() {
  return {
    id: G01_QUERY_SUBJECTS_OFFLINE_SYNTHETIC_SUBJECT_ID,
    type: 2,
    name: 'Run95 Synthetic Query Subject 990930',
    name_cn: 'Run95 合成查询条目 990930',
    date: '2025-10-01',
    platform: 'TV',
    summary: 'Synthetic local fixture only; not a Bangumi record.',
    nsfw: false,
    locked: false,
    images: { common: '', large: '', medium: '', small: '' },
    tags: [],
    meta_tags: [],
    eps: 1,
    total_episodes: 1,
    rating: {
      score: 8,
      rank: G01_QUERY_SUBJECTS_OFFLINE_SYNTHETIC_SUBJECT_ID,
      total: 1,
      count: Object.fromEntries(
        Array.from({ length: 10 }, (_, index) => [String(index + 1), index === 7 ? 1 : 0]),
      ),
    },
    collection: { wish: 0, collect: 1, doing: 0, on_hold: 0, dropped: 0 },
  };
}

export function createG01QuerySubjectsOfflineFetch() {
  const observedSearches = new Set();
  const counters = {
    profile: G01_QUERY_SUBJECTS_OFFLINE_NETWORK_MODE,
    requestCount: 0,
    searchRequestCount: 0,
    duplicateRequestCount: 0,
    unexpectedRequestCount: 0,
    rejectedHeaderCount: 0,
    expectedOperationsComplete: false,
    rawFixturePayloadStored: false,
  };

  const fetchFn = async (input, init = {}) => {
    counters.requestCount += 1;
    let url;
    try {
      url = requestUrl(input);
    } catch {
      counters.unexpectedRequestCount += 1;
      return new Response('G01 query-subjects fixture denied an invalid URL.', { status: 599 });
    }
    const method = requestMethod(input, init);
    const headers = requestHeaders(input, init);
    const credentials = requestCredentials(input, init);
    const rejectedHeaderCount = [...headers].filter(
      ([name, value]) => SAFE_REQUEST_HEADERS.get(name) !== value,
    ).length;
    counters.rejectedHeaderCount += rejectedHeaderCount;
    if (url.origin !== API_ORIGIN || url.username || url.password || url.hash) {
      counters.unexpectedRequestCount += 1;
      return new Response('G01 query-subjects fixture denied an unexpected origin.', {
        status: 599,
      });
    }

    const body = parseBody(init);
    const validSearch =
      method === 'POST' &&
      url.href === SEARCH_URL &&
      rejectedHeaderCount === 0 &&
      (credentials === undefined || credentials === 'omit') &&
      canonicalAgentMcpProfileJson(body) ===
        canonicalAgentMcpProfileJson({
          keyword: G01_QUERY_SUBJECTS_OFFLINE_SYNTHETIC_KEYWORD,
          sort: 'match',
          filter: { type: [2], nsfw: false },
        });
    if (validSearch) {
      if (observedSearches.has(G01_QUERY_SUBJECTS_OFFLINE_SYNTHETIC_KEYWORD)) {
        counters.duplicateRequestCount += 1;
        counters.unexpectedRequestCount += 1;
        return new Response('G01 query-subjects fixture denied a duplicate search.', {
          status: 599,
        });
      }
      observedSearches.add(G01_QUERY_SUBJECTS_OFFLINE_SYNTHETIC_KEYWORD);
      counters.searchRequestCount += 1;
      return response({
        data: [syntheticSubject()],
        total: 1,
        limit: 20,
        offset: 0,
      });
    }

    counters.unexpectedRequestCount += 1;
    if (rejectedHeaderCount > 0 || (credentials !== undefined && credentials !== 'omit')) {
      return new Response('G01 query-subjects fixture denied credentials or request headers.', {
        status: 599,
      });
    }
    return new Response('G01 query-subjects fixture denied an unexpected operation.', {
      status: 599,
    });
  };

  return {
    fetchFn,
    snapshot() {
      counters.expectedOperationsComplete =
        observedSearches.size === 1 &&
        counters.searchRequestCount === 1 &&
        counters.duplicateRequestCount === 0 &&
        counters.unexpectedRequestCount === 0;
      return { ...counters };
    },
  };
}

export function assertG01QuerySubjectsOfflineFixtureProfile(profile) {
  if (!assertG01QuerySubjectsOfflineProfile(profile)) {
    throw new Error('G01 query-subjects fixture requires its exact registered profile.');
  }
  if (
    canonicalAgentMcpProfileJson(profile.calls[0]?.arguments) !==
    canonicalAgentMcpProfileJson(G01_QUERY_SUBJECTS_OFFLINE_EXPECTED_ARGUMENTS)
  ) {
    throw new Error('G01 query-subjects fixture arguments do not match its exact profile.');
  }
  return true;
}
