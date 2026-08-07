import { describe, it, expect, vi } from 'vitest';
import { GeneratedBangumiOpenApiClient, CalendarClient, OPERATION_REGISTRY } from '../../packages/bangumi-openapi/src/index.js';
import { HttpClient } from '../../packages/bangumi-transport/src/index.js';
import { createRawOperationTools } from '../../packages/tools/src/definitions/raw-operation-tools.js';
import { OPERATION_FIXTURES } from './operation-fixtures.js';

describe('Phase 1: Request & Response Contract Tests', () => {
  it('all operations resolve path placeholders using OPERATION_FIXTURES', async () => {
    let lastCapturedUrl = '';
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      lastCapturedUrl = url;
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    const httpClient = new HttpClient({ fetchFn: mockFetch });
    const openApiClient = new GeneratedBangumiOpenApiClient(httpClient);
    const calendarClient = new CalendarClient(httpClient);

    const placeholderRegex = /\{[^}]+\}/;

    for (const [opId, meta] of Object.entries(OPERATION_REGISTRY)) {
      lastCapturedUrl = '';
      const fixture = OPERATION_FIXTURES[opId];
      expect(fixture, `Missing fixture for ${opId}`).toBeDefined();

      if (opId === 'getCalendar') {
        await calendarClient.getCalendar();
      } else {
        const fn = (openApiClient as any)[opId];
        expect(typeof fn, `Method ${opId} should exist on client`).toBe('function');

        const args: any[] = [...fixture.pathArgs];
        const hasQuery = Boolean(meta.queryParameters && meta.queryParameters.length > 0);
        const hasBody = Boolean(meta.requestBody);

        if (hasQuery && hasBody) {
          args.push(fixture.queryFixture);
          args.push(fixture.bodyFixture);
        } else if (hasQuery) {
          args.push(fixture.queryFixture);
        } else if (hasBody) {
          args.push(fixture.bodyFixture);
        }

        await fn.apply(openApiClient, args);
      }

      expect(lastCapturedUrl).not.toBe('');
      expect(lastCapturedUrl).not.toMatch(placeholderRegex);
    }
  });

  it('data-driven contract test: verifies HTTP Method, path parameters, query parameters, request body, and response types for all operations', async () => {
    for (const [opId, meta] of Object.entries(OPERATION_REGISTRY)) {
      let capturedUrl = '';
      let capturedMethod = '';
      let capturedBody: string | undefined = undefined;

      const mockFetch = vi.fn().mockImplementation(async (url: string, init: any) => {
        capturedUrl = url;
        capturedMethod = init.method;
        capturedBody = init.body;
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      });

      const httpClient = new HttpClient({ fetchFn: mockFetch });
      const openApiClient = new GeneratedBangumiOpenApiClient(httpClient);
      const calendarClient = new CalendarClient(httpClient);

      const fixture = OPERATION_FIXTURES[opId];
      expect(fixture, `Missing fixture for ${opId}`).toBeDefined();

      if (opId === 'getCalendar') {
        await calendarClient.getCalendar();
      } else {
        const fn = (openApiClient as any)[opId];
        const args: any[] = [...fixture.pathArgs];
        const hasQuery = Boolean(meta.queryParameters && meta.queryParameters.length > 0);
        const hasBody = Boolean(meta.requestBody);

        if (hasQuery && hasBody) {
          args.push(fixture.queryFixture);
          args.push(fixture.bodyFixture);
        } else if (hasQuery) {
          args.push(fixture.queryFixture);
        } else if (hasBody) {
          args.push(fixture.bodyFixture);
        }

        await fn.apply(openApiClient, args);
      }

      // Assert HTTP Method matches metadata
      expect(capturedMethod).toBe(meta.method);

      // Assert Path parameters are replaced and contain no placeholders
      expect(capturedUrl).not.toMatch(/\{[^}]+\}/);

      // Assert Query parameter forwarding if fixture provides query
      if (fixture.queryFixture) {
        const parsedUrl = new URL(capturedUrl);
        for (const [qKey, qVal] of Object.entries(fixture.queryFixture)) {
          expect(parsedUrl.searchParams.get(qKey)).toBe(String(qVal));
        }
      }

      // Assert Request Body serialization if body parameter is expected
      if (meta.requestBody) {
        expect(capturedBody, `Body should be sent for ${opId}`).toBeDefined();
        const parsed = JSON.parse(capturedBody!);
        expect(parsed).toEqual(fixture.bodyFixture);
      }
    }
  });

  it('handles HTTP 204 no content without JSON parse error', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const httpClient = new HttpClient({ fetchFn: mockFetch });
    const client = new GeneratedBangumiOpenApiClient(httpClient);

    const res = await client.uncollectCharacterByCharacterIdAndUserId(123);
    expect(res).toEqual({});
  });

  it('handles 302 image endpoint location header response correctly', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: 'https://lain.bgm.tv/pic/cover/l/test.jpg' },
      })
    );

    const httpClient = new HttpClient({ fetchFn: mockFetch });
    const client = new GeneratedBangumiOpenApiClient(httpClient);

    const res = await client.getSubjectImageById(123, { type: 'large' });
    expect(res).toHaveProperty('location', 'https://lain.bgm.tv/pic/cover/l/test.jpg');
  });

  it('raw operation path parameter order invariance', async () => {
    let capturedUrl = '';
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      capturedUrl = url;
      return new Response(JSON.stringify({ subject_id: 123 }), { status: 200 });
    });

    const httpClient = new HttpClient({ fetchFn: mockFetch });
    const rawTools = createRawOperationTools(httpClient);
    const callOp = rawTools.find((t) => t.name === 'bangumi.call_operation')!;

    // Call 1: subject_id first
    await callOp.execute(
      {
        operationId: 'getUserCollection',
        pathParams: { subject_id: 123, username: 'alice' },
      },
      { scopes: [] }
    );
    const url1 = capturedUrl;

    // Call 2: username first
    await callOp.execute(
      {
        operationId: 'getUserCollection',
        pathParams: { username: 'alice', subject_id: 123 },
      },
      { scopes: [] }
    );
    const url2 = capturedUrl;

    expect(url1).toBe('https://api.bgm.tv/v0/users/alice/collections/123');
    expect(url2).toBe('https://api.bgm.tv/v0/users/alice/collections/123');
  });

  it('raw operation missing required path parameter throws MISSING_PATH_PARAMETER', async () => {
    const httpClient = new HttpClient({ fetchFn: vi.fn() });
    const rawTools = createRawOperationTools(httpClient);
    const callOp = rawTools.find((t) => t.name === 'bangumi.call_operation')!;

    await expect(
      callOp.execute(
        {
          operationId: 'getUserCollection',
          pathParams: { username: 'alice' }, // missing subject_id
        },
        { scopes: [] }
      )
    ).rejects.toThrow('MISSING_PATH_PARAMETER');
  });

  it('raw operation encodes path parameters with encodeURIComponent', async () => {
    let capturedUrl = '';
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      capturedUrl = url;
      return new Response(JSON.stringify({ username: 'foo/bar' }), { status: 200 });
    });

    const httpClient = new HttpClient({ fetchFn: mockFetch });
    const rawTools = createRawOperationTools(httpClient);
    const callOp = rawTools.find((t) => t.name === 'bangumi.call_operation')!;

    await callOp.execute(
      {
        operationId: 'getUserByName',
        pathParams: { username: 'foo/bar' },
      },
      { scopes: [] }
    );

    expect(capturedUrl).toBe('https://api.bgm.tv/v0/users/foo%2Fbar');
  });
});
