import { describe, it, expect, vi } from 'vitest';
import {
  HttpClient,
  BangumiError,
  buildCacheKey,
  MemoryCache,
} from '../../packages/bangumi-transport/src/index.js';

describe('Phase 2: HTTP Transport Tests', () => {
  it('handles successful 200 response', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ id: 12345, name: 'Steins;Gate' }), { status: 200 }),
      );

    const client = new HttpClient();
    const result = await client.request<{ id: number; name: string }>({
      path: '/v0/subjects/12345',
      fetchFn: mockFetch as any,
    });

    expect(result.id).toBe(12345);
    expect(result.name).toBe('Steins;Gate');
  });

  it('handles HTTP 200 with empty response body without PARSER_ERROR', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(
        new Response('', { status: 200, headers: { 'Content-Type': 'application/json' } }),
      );

    const client = new HttpClient();
    const res = await client.request({
      path: '/v0/indices/123/subjects',
      fetchFn: mockFetch as any,
    });
    expect(res).toEqual({});
  });

  it('maps 400 to VALIDATION_ERROR', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ message: 'Invalid page parameter' }), { status: 400 }),
      );

    const client = new HttpClient();
    try {
      await client.request({ path: '/v0/subjects', fetchFn: mockFetch as any });
      expect.fail('Should have thrown BangumiError');
    } catch (err: any) {
      expect(err).toBeInstanceOf(BangumiError);
      expect(err.code).toBe('VALIDATION_ERROR');
      expect(err.retryable).toBe(false);
      expect(err.upstreamStatus).toBe(400);
    }
  });

  it('maps 401 to AUTH_REQUIRED with nextAction', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ message: 'Unauthorized' }), { status: 401 }),
      );

    const client = new HttpClient();
    try {
      await client.request({ path: '/v0/me', fetchFn: mockFetch as any });
      expect.fail('Should have thrown BangumiError');
    } catch (err: any) {
      expect(err).toBeInstanceOf(BangumiError);
      expect(err.code).toBe('AUTH_REQUIRED');
      expect(err.nextAction).toBe('调用 bangumi.auth_start');
    }
  });

  it('maps 403 to PERMISSION_DENIED', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response('Forbidden', { status: 403 }));

    const client = new HttpClient();
    try {
      await client.request({ path: '/v0/users/collections', fetchFn: mockFetch as any });
      expect.fail('Should have thrown BangumiError');
    } catch (err: any) {
      expect(err).toBeInstanceOf(BangumiError);
      expect(err.code).toBe('PERMISSION_DENIED');
      expect(err.retryable).toBe(false);
    }
  });

  it('maps 404 to NOT_FOUND', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response('Subject not found', { status: 404 }));

    const client = new HttpClient();
    try {
      await client.request({ path: '/v0/subjects/99999999', fetchFn: mockFetch as any });
      expect.fail('Should have thrown BangumiError');
    } catch (err: any) {
      expect(err).toBeInstanceOf(BangumiError);
      expect(err.code).toBe('NOT_FOUND');
    }
  });

  it('maps 429 to RATE_LIMITED (retryable)', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response('Rate Limited', { status: 429 }));

    const client = new HttpClient();
    try {
      await client.request({
        path: '/v0/search/subjects',
        fetchFn: mockFetch as any,
        retryOptions: { maxRetries: 0 },
      });
      expect.fail('Should have thrown BangumiError');
    } catch (err: any) {
      expect(err).toBeInstanceOf(BangumiError);
      expect(err.code).toBe('RATE_LIMITED');
      expect(err.retryable).toBe(true);
    }
  });

  it('maps 500/503 to UPSTREAM_UNAVAILABLE', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(new Response('Internal Server Error', { status: 500 }));

    const client = new HttpClient();
    try {
      await client.request({
        path: '/v0/subjects/1',
        fetchFn: mockFetch as any,
        retryOptions: { maxRetries: 0 },
      });
      expect.fail('Should have thrown BangumiError');
    } catch (err: any) {
      expect(err).toBeInstanceOf(BangumiError);
      expect(err.code).toBe('UPSTREAM_UNAVAILABLE');
      expect(err.retryable).toBe(true);
    }
  });

  it('maps invalid JSON to PARSER_ERROR', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(new Response('<html>Bad Gateway Page</html>', { status: 200 }));

    const client = new HttpClient();
    try {
      await client.request({ path: '/v0/subjects/1', fetchFn: mockFetch as any });
      expect.fail('Should have thrown BangumiError');
    } catch (err: any) {
      expect(err).toBeInstanceOf(BangumiError);
      expect(err.code).toBe('PARSER_ERROR');
      expect(err.retryable).toBe(false);
    }
  });

  it('retries read-only (GET) requests up to maxRetries on 500', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(new Response('Server Error', { status: 500 }))
      .mockResolvedValueOnce(new Response('Server Error', { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: 10 }), { status: 200 }));

    const client = new HttpClient();
    const res = await client.request<{ id: number }>({
      path: '/v0/subjects/10',
      fetchFn: mockFetch as any,
      retryOptions: { maxRetries: 2, initialDelayMs: 5 },
    });

    expect(res.id).toBe(10);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('cancels retry backoff without issuing another upstream request', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new TypeError('network down'));
    const controller = new AbortController();
    const client = new HttpClient();
    const request = client.request({
      path: '/v0/subjects/10',
      fetchFn: mockFetch as any,
      signal: controller.signal,
      retryOptions: { maxRetries: 2, initialDelayMs: 100 },
    });

    await vi.waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    controller.abort();

    await expect(request).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('does NOT retry write (POST/PATCH/DELETE) requests on error', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response('Server Error', { status: 500 }));

    const client = new HttpClient();
    try {
      await client.request({
        method: 'POST',
        path: '/v0/users/collections/1',
        body: { status: 'doing' },
        fetchFn: mockFetch as any,
        retryOptions: { maxRetries: 2, initialDelayMs: 5 },
      });
      expect.fail('Should have thrown error on first attempt');
    } catch (err: any) {
      expect(err).toBeInstanceOf(BangumiError);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    }
  });

  it('generates distinct cache keys based on accountId and auth state', () => {
    const key1 = buildCacheKey({
      operationId: 'getUserCollection',
      accountId: 'user_1',
      isAuthenticated: true,
    });

    const key2 = buildCacheKey({
      operationId: 'getUserCollection',
      accountId: 'user_2',
      isAuthenticated: true,
    });

    const keyAnon = buildCacheKey({
      operationId: 'getUserCollection',
      isAuthenticated: false,
    });

    expect(key1).not.toBe(key2);
    expect(key1).not.toBe(keyAnon);
  });

  it('MemoryCache sets, gets and respects TTL', async () => {
    const cache = new MemoryCache(2);
    cache.set('k1', 'val1', 1);
    expect(cache.get<string>('k1')).toBe('val1');

    cache.set('k2', 'val2', 1);
    cache.set('k3', 'val3', 1); // Evicts oldest (k1)
    expect(cache.get<string>('k1')).toBeUndefined();
    expect(cache.get<string>('k2')).toBe('val2');

    cache.clear();
    expect(cache.get<string>('k2')).toBeUndefined();
  });
});
