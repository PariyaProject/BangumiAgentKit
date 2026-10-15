import { PublicRequestBudget } from './fresh-public-request-budget.js';

const PUBLIC_API_ORIGIN = 'https://api.bgm.tv';
const PUBLIC_SEARCH_PATH = '/v0/search/subjects';
const POST_REDIRECT_STATUSES = new Set([307, 308]);
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const MAX_API_REDIRECTS = 20;
const MAX_SEARCH_BODY_BYTES = 64 * 1024;
const CREDENTIAL_HEADERS = [
  'authorization',
  'proxy-authorization',
  'cookie',
  'cookie2',
  'x-auth-token',
  'x-access-token',
  'x-user-token',
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Count public API attempts while permitting only Bangumi's anonymous read-only search POST. */
export function createBudgetedPublicSearchFetchV2(
  budget: PublicRequestBudget,
  fetchImpl: typeof fetch = fetch,
): typeof fetch {
  return (async (
    input: Parameters<typeof fetch>[0],
    init?: Parameters<typeof fetch>[1],
  ): Promise<Response> => {
    const request = new Request(input, init);
    const initialUrl = new URL(request.url);
    if (initialUrl.protocol !== 'https:' || initialUrl.origin !== PUBLIC_API_ORIGIN) {
      throw new Error('The fixed public probe only permits HTTPS requests to api.bgm.tv.');
    }
    if (
      request.credentials === 'include' ||
      CREDENTIAL_HEADERS.some((name) => request.headers.has(name))
    ) {
      throw new Error('The fixed public probe does not permit credentials.');
    }

    let body: string | undefined;
    if (request.method === 'POST') {
      if (
        initialUrl.pathname !== PUBLIC_SEARCH_PATH ||
        request.headers.get('content-type')?.split(';', 1)[0]?.trim().toLowerCase() !==
          'application/json'
      ) {
        throw new Error('The only permitted public POST is JSON to /v0/search/subjects.');
      }
      body = await request.clone().text();
      if (Buffer.byteLength(body, 'utf8') > MAX_SEARCH_BODY_BYTES) {
        throw new Error('The fixed public search body exceeds its byte limit.');
      }
      try {
        if (!isRecord(JSON.parse(body))) throw new Error('not an object');
      } catch {
        throw new Error('The fixed public search body must be a JSON object.');
      }
    } else if (request.method !== 'GET' && request.method !== 'HEAD') {
      throw new Error('The fixed public probe only permits GET, HEAD, or the exact search POST.');
    }

    let currentUrl = initialUrl;
    for (let redirectCount = 0; ; redirectCount += 1) {
      if (
        currentUrl.protocol !== 'https:' ||
        currentUrl.origin !== PUBLIC_API_ORIGIN ||
        (request.method === 'POST' && currentUrl.pathname !== PUBLIC_SEARCH_PATH)
      ) {
        throw new Error(
          'The fixed public probe refused an API redirect outside its allowed route.',
        );
      }

      budget.reserve('bangumiApi');
      const response = await fetchImpl(currentUrl, {
        method: request.method,
        headers: request.headers,
        credentials: 'omit',
        ...(body === undefined ? {} : { body }),
        signal: request.signal,
        redirect: 'manual',
      });
      const location = response.headers.get('location');
      if (!REDIRECT_STATUSES.has(response.status) || !location) return response;

      const nextUrl = new URL(location, currentUrl);
      if (redirectCount >= MAX_API_REDIRECTS) {
        await response.body?.cancel();
        throw new Error(`Public API redirect limit (${MAX_API_REDIRECTS}) exceeded.`);
      }
      if (
        nextUrl.protocol !== 'https:' ||
        nextUrl.origin !== PUBLIC_API_ORIGIN ||
        (request.method === 'POST' &&
          (!POST_REDIRECT_STATUSES.has(response.status) || nextUrl.pathname !== PUBLIC_SEARCH_PATH))
      ) {
        await response.body?.cancel();
        throw new Error('The fixed public probe refused an unsupported API redirect.');
      }

      await response.body?.cancel();
      currentUrl = nextUrl;
    }
  }) as typeof fetch;
}
