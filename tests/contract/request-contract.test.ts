import { describe, it, expect, vi } from 'vitest';
import { GeneratedBangumiOpenApiClient, CalendarClient, OPERATION_REGISTRY } from '@bangumi-agent-kit/bangumi-openapi';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { createRawOperationTools } from '@bangumi-agent-kit/tools';
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
      expect(fixture, `Missing fixture for operation ${opId}`).toBeDefined();

      const clientFn = (openApiClient as any)[opId] || (calendarClient as any)[opId];
      expect(clientFn, `Client function "${opId}" not found on client`).toBeInstanceOf(Function);

      const args: any[] = [...fixture.pathArgs];
      const hasQueryMeta = Boolean(meta.queryParameters && meta.queryParameters.length > 0);
      const hasBodyMeta = Boolean(meta.requestBody);

      if (hasQueryMeta && hasBodyMeta) {
        args.push(fixture.queryFixture || {});
        args.push(fixture.bodyFixture || {});
      } else if (hasQueryMeta) {
        args.push(fixture.queryFixture || {});
      } else if (hasBodyMeta) {
        args.push(fixture.bodyFixture || {});
      }

      await clientFn.apply(opId in calendarClient ? calendarClient : openApiClient, args);

      expect(lastCapturedUrl).not.toMatch(placeholderRegex);
    }
  });

  it('raw operation call_operation executes with valid path parameters', async () => {
    let capturedUrl = '';
    let capturedMethod = '';
    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedMethod = init?.method || 'GET';
      return new Response(JSON.stringify({ id: 123, name: 'Spike' }), { status: 200 });
    });

    const httpClient = new HttpClient({ fetchFn: mockFetch });
    const rawTools = createRawOperationTools(httpClient);
    const callOp = rawTools.find((t) => t.name === 'bangumi.call_operation')!;

    const result = await callOp.execute(
      {
        operationId: 'getCharacterById',
        pathParams: { character_id: 123 },
      },
      { principalId: 'p', botInstanceId: 'b', conversationId: 'c' }
    );

    expect(capturedUrl).toContain('/v0/characters/123');
    expect(capturedMethod).toBe('GET');
    expect(result).toEqual({ id: 123, name: 'Spike' });
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
      { principalId: 'p', botInstanceId: 'b', conversationId: 'c' }
    );
    const url1 = capturedUrl;

    // Call 2: username first
    await callOp.execute(
      {
        operationId: 'getUserCollection',
        pathParams: { username: 'alice', subject_id: 123 },
      },
      { principalId: 'p', botInstanceId: 'b', conversationId: 'c' }
    );
    const url2 = capturedUrl;

    expect(url1).toBe(url2);
    expect(url1).toContain('/v0/users/alice/collections/123');
  });

  it('raw operation missing required path parameter throws MISSING_PATH_PARAMETER', async () => {
    const httpClient = new HttpClient();
    const rawTools = createRawOperationTools(httpClient);
    const callOp = rawTools.find((t) => t.name === 'bangumi.call_operation')!;

    await expect(
      callOp.execute(
        {
          operationId: 'getSubjectById',
          pathParams: {}, // Missing subject_id
        },
        { principalId: 'p', botInstanceId: 'b', conversationId: 'c' }
      )
    ).rejects.toThrow('MISSING_PATH_PARAMETER');
  });

  it('raw operation encodes path parameters with encodeURIComponent', async () => {
    let capturedUrl = '';
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      capturedUrl = url;
      return new Response(JSON.stringify({ id: 1 }), { status: 200 });
    });

    const httpClient = new HttpClient({ fetchFn: mockFetch });
    const rawTools = createRawOperationTools(httpClient);
    const callOp = rawTools.find((t) => t.name === 'bangumi.call_operation')!;

    await callOp.execute(
      {
        operationId: 'getUserByName',
        pathParams: { username: 'user name with spaces' },
      },
      { principalId: 'p', botInstanceId: 'b', conversationId: 'c' }
    );

    expect(capturedUrl).toContain('/v0/users/user%20name%20with%20spaces');
  });
});
