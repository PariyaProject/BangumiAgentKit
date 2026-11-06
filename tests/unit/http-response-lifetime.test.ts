import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServer } from 'node:http';
import {
  NativeCollectionPageClient,
  NATIVE_COLLECTION_PAGE_MAX_BYTES,
} from '@bangumi-agent-kit/bangumi-openapi';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';

const methods = ['getPersonPage', 'getCharacterPage'] as const;
const outcomes = ['normal', 'reject', 'pending', 'throw'] as const;
const shortcuts: Array<Record<string, string>> = [
  { location: 'https://example.invalid/not-followed' },
  { 'content-type': 'image/png' },
];
afterEach(() => vi.useRealTimers());

function responseFixture(
  headers: Record<string, string>,
  status = 200,
  cleanup: (typeof outcomes)[number] = 'normal',
  streamed = false,
) {
  let cancelled = 0,
    calls = 0;
  let signal: AbortSignal | undefined;
  const http = new HttpClient({
    fetchFn: async (_input, init) => {
      calls++;
      signal = init?.signal ?? undefined;
      return new Response(
        new ReadableStream({
          start(controller) {
            if (streamed) controller.enqueue(new Uint8Array(NATIVE_COLLECTION_PAGE_MAX_BYTES + 1));
          },
          cancel() {
            cancelled++;
            if (cleanup === 'throw') throw Error('synthetic cleanup threw');
            if (cleanup === 'reject') return Promise.reject(Error('synthetic cleanup rejected'));
            if (cleanup === 'pending') return new Promise<void>(() => {});
            return undefined;
          },
        }),
        { status, headers },
      );
    },
  });
  return {
    client: new NativeCollectionPageClient(http),
    http,
    facts: () => ({ cancelled, calls, aborted: signal?.aborted }),
  };
}

describe('response ownership through terminal native page paths', () => {
  it.each(methods)(
    '%s disposes declared oversize for both success and upstream-error responses',
    async (method) => {
      for (const status of [200, 503])
        for (const cleanup of outcomes) {
          const f = responseFixture(
            { 'content-length': String(NATIVE_COLLECTION_PAGE_MAX_BYTES + 1) },
            status,
            cleanup,
          );
          await expect(f.client[method]('synthetic', { limit: 1 })).rejects.toMatchObject({
            code: 'RESPONSE_TOO_LARGE',
          });
          expect(f.facts(), `${status}/${cleanup}`).toEqual({
            cancelled: 1,
            calls: 1,
            aborted: true,
          });
        }
    },
  );

  it.each(methods)(
    '%s disposes incompatible Location and image shortcuts without changing parser classification',
    async (method) => {
      for (const headers of shortcuts) {
        const f = responseFixture(headers);
        await expect(f.client[method]('synthetic', { limit: 1 })).rejects.toMatchObject({
          code: 'PARSER_ERROR',
        });
        expect(f.facts()).toEqual({ cancelled: 1, calls: 1, aborted: true });
      }
    },
  );

  it.each(methods)(
    '%s preserves streamed cap failure even when cleanup rejects or never settles',
    async (method) => {
      vi.useFakeTimers();
      for (const cleanup of outcomes) {
        const f = responseFixture({}, 200, cleanup, true);
        const result = f.client[method]('synthetic', { limit: 1 }).catch((error) => error);
        await vi.advanceTimersByTimeAsync(10_001);
        expect(await result, cleanup).toMatchObject({ code: 'RESPONSE_TOO_LARGE' });
        expect(f.facts()).toEqual({ cancelled: 1, calls: 1, aborted: true });
        expect(vi.getTimerCount()).toBe(0);
      }
    },
  );

  it.each(methods)(
    '%s forwards caller cancellation to the fetch after headers, regardless of cleanup outcome',
    async (method) => {
      for (const cleanup of outcomes) {
        const caller = new AbortController();
        const f = responseFixture({}, 200, cleanup);
        const result = f.client[method]('synthetic', { limit: 1 }, { signal: caller.signal }).catch(
          (error) => error,
        );
        await vi.waitFor(() => expect(f.facts().calls).toBe(1));
        await Promise.resolve();
        caller.abort();
        expect(await result).toMatchObject({ code: 'NETWORK_ERROR', retryable: false });
        expect(f.facts()).toEqual({ cancelled: 1, calls: 1, aborted: true });
      }
    },
  );

  it('keeps raw transport Location and image return values while disposing unread bodies', async () => {
    for (const headers of shortcuts) {
      const f = responseFixture(headers);
      await expect(
        f.http.request({ path: '/synthetic', retryOptions: { maxRetries: 0 } }),
      ).resolves.toEqual({ location: headers.location ?? '' });
      expect(f.facts()).toEqual({ cancelled: 1, calls: 1, aborted: true });
    }
  });

  it.each(methods)(
    '%s preserves the known HTTP error when streamed cleanup fails or stalls',
    async (method) => {
      vi.useFakeTimers();
      for (const cleanup of outcomes) {
        const f = responseFixture({}, 503, cleanup, true);
        const result = f.client[method]('synthetic', { limit: 1 }).catch((error) => error);
        await vi.advanceTimersByTimeAsync(10_001);
        expect(await result).toMatchObject({ code: 'UPSTREAM_UNAVAILABLE', upstreamStatus: 503 });
        expect(f.facts()).toEqual({ cancelled: 1, calls: 1, aborted: true });
        expect(vi.getTimerCount()).toBe(0);
      }
    },
  );

  it('keeps caller cancellation classified as NETWORK_ERROR on a real body after headers', async () => {
    const server = createServer((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.write('{"partial":');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw Error('LOOPBACK_ADDRESS');
    let reading!: () => void;
    const readerReady = new Promise<void>((resolve) => {
      reading = resolve;
    });
    try {
      const http = new HttpClient({
        baseUrl: `http://127.0.0.1:${address.port}`,
        fetchFn: async (input, init) => {
          const response = await fetch(input, init);
          const body = response.body!;
          const getReader = body.getReader.bind(body);
          Object.defineProperty(body, 'getReader', {
            value: () => {
              const reader = getReader();
              reading();
              return reader;
            },
          });
          return response;
        },
      });
      const caller = new AbortController();
      const result = http
        .request({
          path: '/synthetic',
          maxResponseBytes: 1024,
          retryOptions: { maxRetries: 0 },
          signal: caller.signal,
        })
        .catch((error) => error);
      await readerReady;
      caller.abort();
      expect(await result).toMatchObject({ code: 'NETWORK_ERROR', retryable: false });
    } finally {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });

  it('closes a real loopback response after rejecting Content-Length without waiting for its body', async () => {
    let calls = 0;
    let closed!: () => void;
    const responseClosed = new Promise<void>((resolve) => {
      closed = resolve;
    });
    const server = createServer((_req, res) => {
      calls++;
      res.once('close', closed);
      res.writeHead(200, {
        'content-type': 'application/json',
        'content-length': String(NATIVE_COLLECTION_PAGE_MAX_BYTES + 1),
      });
      res.flushHeaders();
      res.write(' '); // The body remains open until the client disposes it.
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw Error('LOOPBACK_ADDRESS');
    let waitTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      const http = new HttpClient({ baseUrl: `http://127.0.0.1:${address.port}` });
      await expect(
        new NativeCollectionPageClient(http).getPersonPage('synthetic', { limit: 1 }),
      ).rejects.toMatchObject({ code: 'RESPONSE_TOO_LARGE' });
      const disposed = await Promise.race([
        responseClosed.then(() => true),
        new Promise<boolean>((resolve) => {
          waitTimer = setTimeout(() => resolve(false), 1000);
        }),
      ]);
      expect(disposed).toBe(true);
      expect(calls).toBe(1);
    } finally {
      clearTimeout(waitTimer);
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
});
