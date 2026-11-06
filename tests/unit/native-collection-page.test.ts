import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  GeneratedBangumiOpenApiClient,
  NativeCollectionPageClient,
  NATIVE_COLLECTION_PAGE_MAX_BYTES,
  OPERATION_REGISTRY,
} from '@bangumi-agent-kit/bangumi-openapi';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { UserService } from '@bangumi-agent-kit/bangumi-core';

const row = { id: 20, name: '合成记录', type: 1, created_at: '2026-01-01T00:00:00Z' };
const page = (data: unknown[] = [row], limit = 1, offset = 0, total = 1) => ({
  data,
  limit,
  offset,
  total,
});
const methods = ['getPersonPage', 'getCharacterPage'] as const;
const serviceMethods = ['getUserPersonCollectionsPage', 'getUserCharacterCollectionsPage'] as const;

function fixture(body: unknown, status = 200) {
  const requests: Array<{ url: URL; token: string | null }> = [];
  const http = new HttpClient({
    accessToken: 'native-fake-access',
    fetchFn: async (input, init) => {
      requests.push({
        url: new URL(String(input)),
        token: new Headers(init?.headers).get('authorization'),
      });
      return Response.json(body, { status });
    },
  });
  return {
    requests,
    client: new NativeCollectionPageClient(http),
    service: new UserService(http),
    api: new GeneratedBangumiOpenApiClient(http),
  };
}

afterEach(() => vi.useRealTimers());

describe('source-owned native collection page boundary', () => {
  it('does not advertise source supplements as pinned raw operation IDs or query parameters', () => {
    for (const entity of ['Person', 'Character']) {
      expect(Object.hasOwn(OPERATION_REGISTRY, `getUser${entity}CollectionsPage`)).toBe(false);
      expect(OPERATION_REGISTRY[`getUser${entity}Collections`]?.queryParameters ?? []).toEqual([]);
    }
  });
  it.each(methods)('%s keeps exact target encoding, token and native query', async (method) => {
    const f = fixture(page([], 2, 7, 9));
    await f.client[method]('名字 /?#', { limit: 2, offset: 7 });
    expect(f.requests).toHaveLength(1);
    expect(f.requests[0]?.url.pathname).toBe(
      `/v0/users/${encodeURIComponent('名字 /?#')}/collections/-/${method === 'getPersonPage' ? 'persons' : 'characters'}`,
    );
    expect(Object.fromEntries(f.requests[0]!.url.searchParams)).toEqual({
      limit: '2',
      offset: '7',
    });
    expect(f.requests[0]?.token).toBe('Bearer native-fake-access');
  });

  it('preserves both pinned raw generated methods without native query injection', async () => {
    const f = fixture(page());
    await f.api.getUserPersonCollections('synthetic', { maxResponseBytes: 1024 });
    await f.api.getUserCharacterCollections('synthetic', { maxResponseBytes: 1024 });
    expect(f.requests.map((r) => r.url.search)).toEqual(['', '']);
  });

  it.each(['.', '..'])(
    'refuses URL-normalized dot target %s before leaving the fixed route',
    async (username) => {
      const f = fixture(page());
      await expect(f.client.getPersonPage(username, { limit: 1 })).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
      expect(f.requests).toEqual([]);
    },
  );

  it.each([
    { limit: 0 },
    { limit: -1 },
    { limit: 101 },
    { limit: 1.5 },
    { limit: NaN },
    { limit: Infinity },
    { limit: 1, offset: -1 },
    { limit: 1, offset: 1.5 },
    { limit: 1, offset: Infinity },
    { limit: 1, offset: Number.MAX_SAFE_INTEGER + 1 },
    { limit: 1, offset: null },
  ])('rejects invalid page input before I/O: %j', async (query) => {
    const f = fixture(page());
    await expect(f.client.getPersonPage('synthetic', query as never)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      retryable: false,
    });
    expect(f.requests).toEqual([]);
  });

  it.each([0, -1, NaN, Infinity, NATIVE_COLLECTION_PAGE_MAX_BYTES + 1])(
    'rejects unsafe byte cap %s before I/O',
    async (maxResponseBytes) => {
      const f = fixture(page());
      await expect(
        f.client.getPersonPage('synthetic', { limit: 1 }, { maxResponseBytes }),
      ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
      expect(f.requests).toEqual([]);
    },
  );

  it.each([
    null,
    [],
    {},
    page(null as never),
    { ...page(), limit: 30 },
    { ...page(), offset: 1 },
    { ...page(), total: -1 },
    { ...page(), total: 1.5 },
    { ...page(), total: Number.MAX_SAFE_INTEGER + 1 },
    page([row, { ...row, id: 21 }]),
  ])('rejects incompatible envelopes rather than slicing them into success: %j', async (body) => {
    const f = fixture(body);
    await expect(f.client.getPersonPage('synthetic', { limit: 1 })).rejects.toMatchObject({
      code: 'PARSER_ERROR',
      retryable: false,
    });
    expect(f.requests).toHaveLength(1);
  });

  it.each([400, 401, 429, 500, 503])(
    'preserves HTTP %s without a retry or fallback',
    async (status) => {
      const f = fixture({ error: 'synthetic failure' }, status);
      await expect(f.client.getPersonPage('synthetic', { limit: 1 })).rejects.toMatchObject({
        upstreamStatus: status,
      });
      expect(f.requests).toHaveLength(1);
    },
  );

  it('enforces the streamed body cap before JSON parsing', async () => {
    let cancelled = false;
    const http = new HttpClient({
      fetchFn: async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new Uint8Array(NATIVE_COLLECTION_PAGE_MAX_BYTES + 1));
            },
            cancel() {
              cancelled = true;
            },
          }),
        ),
    });
    await expect(
      new NativeCollectionPageClient(http).getPersonPage('synthetic', { limit: 1 }),
    ).rejects.toMatchObject({ code: 'RESPONSE_TOO_LARGE' });
    expect(cancelled).toBe(true);
  });

  it('refuses pre-cancelled reads without dispatching', async () => {
    const f = fixture(page());
    const abort = new AbortController();
    abort.abort();
    await expect(
      f.client.getPersonPage('synthetic', { limit: 1 }, { signal: abort.signal }),
    ).rejects.toMatchObject({ code: 'NETWORK_ERROR', retryable: false });
    expect(f.requests).toEqual([]);
  });

  it('enforces its total deadline while consuming a stalled response body', async () => {
    vi.useFakeTimers();
    let cancelled = false;
    const http = new HttpClient({
      fetchFn: async () => {
        return new Response(
          new ReadableStream({
            cancel() {
              cancelled = true;
            },
          }),
        );
      },
    });
    const request = vi.spyOn(http, 'request');
    const result = new NativeCollectionPageClient(http).getPersonPage('synthetic', { limit: 1 });
    const rejected = expect(result).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      retryable: false,
    });
    await vi.advanceTimersByTimeAsync(10_001);
    await rejected;
    expect(request.mock.calls[0]?.[0].signal?.aborted).toBe(true);
    expect(cancelled).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('propagates caller cancellation after headers and cancels the pending body', async () => {
    const caller = new AbortController();
    let cancelled = false;
    let calls = 0;
    let ready!: () => void;
    const headers = new Promise<void>((resolve) => {
      ready = resolve;
    });
    const http = new HttpClient({
      fetchFn: async () => {
        calls++;
        return new Response(
          new ReadableStream({
            start() {
              ready();
            },
            cancel() {
              cancelled = true;
            },
          }),
        );
      },
    });
    const result = new NativeCollectionPageClient(http).getCharacterPage(
      'synthetic',
      { limit: 1 },
      { signal: caller.signal },
    );
    const rejected = expect(result).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      retryable: false,
    });
    await headers;
    await Promise.resolve();
    caller.abort();
    await rejected;
    expect(cancelled).toBe(true);
    expect(calls).toBe(1);
  });

  it('accepts the source maximum independently of the smaller tool cap and releases its timer', async () => {
    vi.useFakeTimers();
    const f = fixture(page([], 100, 0, 0));
    await expect(f.client.getPersonPage('synthetic', { limit: 100 })).resolves.toMatchObject({
      limit: 100,
    });
    expect(vi.getTimerCount()).toBe(0);
    expect(f.requests).toHaveLength(1);
  });
});

describe('native entity-page semantics', () => {
  it.each(serviceMethods)(
    '%s continues by the requested window despite hydration gaps',
    async (method) => {
      const f = fixture(page([], 2, 0, 5));
      const result = await f.service[method]('synthetic', { maxItems: 2 });
      expect(result).toMatchObject({
        total: 5,
        observed: 0,
        returned: 0,
        truncated: true,
        pagination: { hasMore: true, nextOffset: 2, empty: 'page_empty', stableSnapshot: false },
      });
      expect(f.requests).toHaveLength(1);
    },
  );

  it.each(serviceMethods)(
    '%s preserves empty collection semantics at a large offset without overflow',
    async (method) => {
      const f = fixture(page([], 50, Number.MAX_SAFE_INTEGER, 0));
      const result = await f.service[method]('synthetic', { offset: Number.MAX_SAFE_INTEGER });
      expect(result).toMatchObject({
        total: 0,
        truncated: false,
        pagination: { hasMore: false, empty: 'collection_empty', totalInconsistent: false },
      });
      expect(result.pagination.nextOffset).toBeUndefined();
    },
  );

  it.each(serviceMethods)(
    '%s does not invent continuation when count and list disagree',
    async (method) => {
      const f = fixture(page([row, { ...row, id: 21 }], 2, 0, 1));
      const result = await f.service[method]('synthetic', { maxItems: 2 });
      expect(result.total).toBeUndefined();
      expect(result).toMatchObject({
        observed: 2,
        returned: 2,
        truncated: true,
        pagination: { totalInconsistent: true, stableSnapshot: false },
      });
      expect(result.pagination.hasMore).toBeUndefined();
      expect(result.pagination.nextOffset).toBeUndefined();
    },
  );

  it.each(serviceMethods)(
    '%s counts invalid rows without turning them into candidates',
    async (method) => {
      const f = fixture(page([row, { ...row, id: Number.MAX_SAFE_INTEGER + 1 }], 2, 0, 2));
      const result = await f.service[method]('synthetic', { maxItems: 2 });
      expect(result).toMatchObject({
        items: [{ id: 20 }],
        observed: 2,
        returned: 1,
        invalidRows: 1,
        truncated: true,
      });
    },
  );

  it('retains unknown, explicit empty and raw career labels on the new page seam', async () => {
    const f = fixture(
      page(
        [row, { ...row, id: 21, career: [] }, { ...row, id: 22, career: ['future-role'] }],
        3,
        0,
        3,
      ),
    );
    const result = await f.service.getUserPersonCollectionsPage('synthetic', { maxItems: 3 });
    expect(result.items.map((x) => x.career)).toEqual([undefined, [], ['future-role']]);
    expect(JSON.parse(JSON.stringify(result.items[0]))).not.toHaveProperty('career');
  });
});
