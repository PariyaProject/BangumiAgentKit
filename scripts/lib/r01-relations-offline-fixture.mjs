import {
  R01_RELATIONS_OFFLINE_EXPECTED_ARGUMENTS,
  R01_RELATIONS_OFFLINE_NETWORK_MODE,
  R01_RELATIONS_OFFLINE_PROFILE_ID,
  assertR01RelationsOfflineProfile,
} from './r01-relations-offline-profile.mjs';

const ORIGIN = 'https://api.bgm.tv';
const PATH = `/v0/subjects/${R01_RELATIONS_OFFLINE_EXPECTED_ARGUMENTS.subjectId}/subjects`;

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
  throw new Error('R01 offline fixture received an invalid request URL.');
}

function requestMethod(input, init) {
  return String(init?.method ?? input?.method ?? 'GET').toUpperCase();
}

function requestHeaders(input, init) {
  return new Headers(init?.headers ?? input?.headers ?? {});
}

export function createR01RelationsOfflineFetch() {
  const observed = new Set();
  const counters = {
    profile: R01_RELATIONS_OFFLINE_NETWORK_MODE,
    requestCount: 0,
    relationRequestCount: 0,
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
      return new Response('R01 offline fixture denied an invalid URL.', { status: 599 });
    }
    const method = requestMethod(input, init);
    const headers = requestHeaders(input, init);
    if (headers.has('authorization')) counters.authorizationHeaderCount += 1;

    const valid =
      url.origin === ORIGIN &&
      !url.username &&
      !url.password &&
      url.pathname === PATH &&
      method === 'GET' &&
      url.href === `${ORIGIN}${PATH}` &&
      url.search === '' &&
      url.hash === '' &&
      init?.body === undefined &&
      !headers.has('authorization');
    if (!valid) {
      counters.unexpectedRequestCount += 1;
      return new Response('R01 offline fixture denied an unexpected request.', { status: 599 });
    }
    if (observed.has(PATH)) {
      counters.duplicateRequestCount += 1;
      counters.unexpectedRequestCount += 1;
      return new Response('R01 offline fixture denied a duplicate request.', { status: 599 });
    }

    observed.add(PATH);
    counters.relationRequestCount += 1;
    return response([
      {
        id: 990903,
        type: 2,
        name: 'Synthetic relation target 990903',
        name_cn: '合成关系目标 990903',
        relation: '改编',
      },
    ]);
  };

  return {
    fetchFn,
    snapshot() {
      counters.expectedOperationsComplete = observed.size === 1;
      return { ...counters };
    },
  };
}

export function assertR01RelationsOfflineFixture(profile) {
  if (profile?.id !== R01_RELATIONS_OFFLINE_PROFILE_ID) {
    throw new Error('R01 offline relation fixture requires its exact registered profile.');
  }
  return assertR01RelationsOfflineProfile(profile);
}
