import {
  assertR01RelationsTextProjectionOfflineProfile,
  R01_RELATIONS_TEXT_PROJECTION_OFFLINE_NETWORK_MODE,
  R01_RELATIONS_TEXT_PROJECTION_OFFLINE_PROFILE_ID,
  R01_RELATIONS_TEXT_PROJECTION_OFFLINE_SUBJECT_ID,
  r01RelationsTextProjectionSyntheticRows,
} from './r01-relations-text-projection-offline-profile.mjs';

const ORIGIN = 'https://api.bgm.tv';
const PATH = `/v0/subjects/${R01_RELATIONS_TEXT_PROJECTION_OFFLINE_SUBJECT_ID}/subjects`;

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
  throw new Error('R01 text projection fixture received an invalid request URL.');
}

function requestMethod(input, init) {
  return String(init?.method ?? input?.method ?? 'GET').toUpperCase();
}

function requestHeaders(input, init) {
  return new Headers(init?.headers ?? input?.headers ?? {});
}

function hasRequestBody(input, init) {
  const inputBody = input !== null && typeof input === 'object' ? input.body : undefined;
  const initBody = init !== null && typeof init === 'object' ? init.body : undefined;
  return (
    (inputBody !== undefined && inputBody !== null) ||
    (initBody !== undefined && initBody !== null)
  );
}

export function createR01RelationsTextProjectionOfflineFetch() {
  const observed = new Set();
  const counters = {
    profile: R01_RELATIONS_TEXT_PROJECTION_OFFLINE_NETWORK_MODE,
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
      return new Response('R01 text projection fixture denied an invalid request.', {
        status: 599,
      });
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
      !hasRequestBody(input, init) &&
      !headers.has('authorization');
    if (!valid) {
      counters.unexpectedRequestCount += 1;
      return new Response('R01 text projection fixture denied an unexpected request.', {
        status: 599,
      });
    }
    if (observed.has(PATH)) {
      counters.duplicateRequestCount += 1;
      counters.unexpectedRequestCount += 1;
      return new Response('R01 text projection fixture denied a duplicate request.', {
        status: 599,
      });
    }

    observed.add(PATH);
    counters.relationRequestCount += 1;
    return response(r01RelationsTextProjectionSyntheticRows());
  };

  return {
    fetchFn,
    snapshot() {
      counters.expectedOperationsComplete = observed.size === 1;
      return { ...counters };
    },
  };
}

export function assertR01RelationsTextProjectionOfflineFixture(profile) {
  if (profile?.id !== R01_RELATIONS_TEXT_PROJECTION_OFFLINE_PROFILE_ID) {
    throw new Error('R01 text projection fixture requires its exact registered profile.');
  }
  assertR01RelationsTextProjectionOfflineProfile(profile);
  return true;
}
