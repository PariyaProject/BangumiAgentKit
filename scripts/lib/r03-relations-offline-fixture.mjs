import {
  R03_RELATIONS_OFFLINE_NETWORK_MODE,
  R03_RELATIONS_OFFLINE_PROFILE_ID,
  assertR03RelationsOfflineProfile,
} from './r03-relations-offline-profile.mjs';

const ORIGIN = 'https://api.bgm.tv';
const ROUTES = Object.freeze({ direct: '/v0/subjects/991020/subjects' });
const EXPECTED_REQUEST_HEADERS = Object.freeze({
  accept: 'application/json',
  'user-agent': 'Kurarion/BangumiAgentKit/0.1.0 (https://github.com/PariyaProject/BangumiAgentKit)',
});

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
  throw new Error('R03 offline fixture received an invalid request URL.');
}

function requestMethod(input, init) {
  return String(init?.method ?? input?.method ?? 'GET').toUpperCase();
}

function requestHeaders(input, init) {
  return new Headers(init?.headers ?? input?.headers ?? {});
}

function hasExactExpectedHeaders(headers) {
  const entries = [...headers.entries()];
  return (
    entries.length === Object.keys(EXPECTED_REQUEST_HEADERS).length &&
    entries.every(([name, value]) => EXPECTED_REQUEST_HEADERS[name] === value)
  );
}

const syntheticDirectRelations = () => [
  {
    id: 991021,
    type: 2,
    name: 'Synthetic R03 matrix target 991021',
    name_cn: '合成 R03 矩阵目标 991021',
    relation: '续篇',
  },
];

export function createR03RelationsOfflineFetch() {
  const operations = new Map([
    [ROUTES.direct, { name: 'direct', respond: syntheticDirectRelations }],
  ]);
  const observed = new Set();
  const counters = {
    profile: R03_RELATIONS_OFFLINE_NETWORK_MODE,
    requestCount: 0,
    relationRequestCount: 0,
    rootRequestCount: 0,
    intermediateRequestCount: 0,
    duplicateRequestCount: 0,
    unexpectedRequestCount: 0,
    authorizationHeaderCount: 0,
    expectedOperationsComplete: false,
  };

  const fetchFn = async (input, init = {}) => {
    counters.requestCount += 1;
    let url;
    try {
      url = toUrl(input);
    } catch {
      counters.unexpectedRequestCount += 1;
      return new Response('R03 offline fixture denied an invalid request.', { status: 599 });
    }
    const method = requestMethod(input, init);
    const headers = requestHeaders(input, init);
    if (headers.has('authorization')) counters.authorizationHeaderCount += 1;
    const operation = operations.get(url.pathname);
    const valid =
      url.origin === ORIGIN &&
      !url.username &&
      !url.password &&
      method === 'GET' &&
      url.href === `${ORIGIN}${url.pathname}` &&
      url.search === '' &&
      url.hash === '' &&
      init?.body === undefined &&
      hasExactExpectedHeaders(headers) &&
      operation !== undefined;
    if (!valid) {
      counters.unexpectedRequestCount += 1;
      return new Response('R03 offline fixture denied an unexpected request.', { status: 599 });
    }
    if (observed.has(url.pathname)) {
      counters.duplicateRequestCount += 1;
      counters.unexpectedRequestCount += 1;
      return new Response('R03 offline fixture denied a duplicate request.', { status: 599 });
    }
    observed.add(url.pathname);
    counters.relationRequestCount += 1;
    counters.rootRequestCount += 1;
    return response(operation.respond());
  };

  return {
    fetchFn,
    snapshot() {
      counters.expectedOperationsComplete = observed.size === operations.size;
      return { ...counters };
    },
  };
}

export function assertR03RelationsOfflineFixture(profile) {
  if (profile?.id !== R03_RELATIONS_OFFLINE_PROFILE_ID) {
    throw new Error('R03 offline fixture requires its exact registered v2 profile.');
  }
  return assertR03RelationsOfflineProfile(profile);
}
