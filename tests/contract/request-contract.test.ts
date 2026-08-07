import { describe, it, expect, vi } from 'vitest';
import { GeneratedBangumiOpenApiClient, CalendarClient, OPERATION_REGISTRY } from '../../packages/bangumi-openapi/src/index.js';
import { HttpClient } from '../../packages/bangumi-transport/src/index.js';

describe('Phase 1: Request-Level Contract Tests', () => {
  it('correctly maps getSubjectById(123) to /v0/subjects/123', async () => {
    let capturedUrl = '';
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      capturedUrl = url;
      return new Response(JSON.stringify({ id: 123, name: 'Test Subject' }), { status: 200 });
    });

    const httpClient = new HttpClient({ fetchFn: mockFetch });
    const client = new GeneratedBangumiOpenApiClient(httpClient);

    await client.getSubjectById(123);
    expect(capturedUrl).toBe('https://api.bgm.tv/v0/subjects/123');
  });

  it('correctly maps getUserCollection("abc", 123) to /v0/users/abc/collections/123', async () => {
    let capturedUrl = '';
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      capturedUrl = url;
      return new Response(JSON.stringify({ subject_id: 123, type: 1 }), { status: 200 });
    });

    const httpClient = new HttpClient({ fetchFn: mockFetch });
    const client = new GeneratedBangumiOpenApiClient(httpClient);

    await client.getUserCollection('abc', 123);
    expect(capturedUrl).toBe('https://api.bgm.tv/v0/users/abc/collections/123');
  });

  it('correctly maps Character collect: POST /v0/characters/123/collect', async () => {
    let capturedUrl = '';
    let capturedMethod = '';
    const mockFetch = vi.fn().mockImplementation(async (url: string, init: any) => {
      capturedUrl = url;
      capturedMethod = init.method;
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    });

    const httpClient = new HttpClient({ fetchFn: mockFetch });
    const client = new GeneratedBangumiOpenApiClient(httpClient);

    await client.collectCharacterByCharacterIdAndUserId(123);
    expect(capturedMethod).toBe('POST');
    expect(capturedUrl).toBe('https://api.bgm.tv/v0/characters/123/collect');
  });

  it('correctly maps Person collect: POST /v0/persons/123/collect', async () => {
    let capturedUrl = '';
    let capturedMethod = '';
    const mockFetch = vi.fn().mockImplementation(async (url: string, init: any) => {
      capturedUrl = url;
      capturedMethod = init.method;
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    });

    const httpClient = new HttpClient({ fetchFn: mockFetch });
    const client = new GeneratedBangumiOpenApiClient(httpClient);

    await client.collectPersonByPersonIdAndUserId(123);
    expect(capturedMethod).toBe('POST');
    expect(capturedUrl).toBe('https://api.bgm.tv/v0/persons/123/collect');
  });

  it('correctly maps Index delete subject: DELETE /v0/indices/12/subjects/34', async () => {
    let capturedUrl = '';
    let capturedMethod = '';
    const mockFetch = vi.fn().mockImplementation(async (url: string, init: any) => {
      capturedUrl = url;
      capturedMethod = init.method;
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    });

    const httpClient = new HttpClient({ fetchFn: mockFetch });
    const client = new GeneratedBangumiOpenApiClient(httpClient);

    await client.delelteSubjectFromIndexByIndexIdAndSubjectID(12, 34);
    expect(capturedMethod).toBe('DELETE');
    expect(capturedUrl).toBe('https://api.bgm.tv/v0/indices/12/subjects/34');
  });

  it('encodes query parameters correctly', async () => {
    let capturedUrl = '';
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      capturedUrl = url;
      return new Response(JSON.stringify({ total: 0, limit: 10, offset: 0, data: [] }), { status: 200 });
    });

    const httpClient = new HttpClient({ fetchFn: mockFetch });
    const client = new GeneratedBangumiOpenApiClient(httpClient);

    await client.getSubjects({ limit: 10, offset: 20 });
    expect(capturedUrl).toBe('https://api.bgm.tv/v0/subjects?limit=10&offset=20');
  });

  it('handles HTTP 204 status without JSON parse error', async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));

    const httpClient = new HttpClient({ fetchFn: mockFetch });
    const client = new GeneratedBangumiOpenApiClient(httpClient);

    const res = await client.uncollectCharacterByCharacterIdAndUserId(123);
    expect(res).toEqual({});
  });

  it('handles 302 image endpoint response without JSON parse error', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: 'https://lain.bgm.tv/pic/cover/l/test.jpg' },
      })
    );

    const httpClient = new HttpClient({ fetchFn: mockFetch });
    const client = new GeneratedBangumiOpenApiClient(httpClient);

    const res = await client.getSubjectImageById(123);
    expect(res).toHaveProperty('location', 'https://lain.bgm.tv/pic/cover/l/test.jpg');
  });

  it('UNIVERSAL ASSERTION: all 56 operations execute cleanly without remaining path placeholders ({...})', async () => {
    const sampleArgsMap: Record<string, any[]> = {
      searchSubjects: [{ query: 'test' }, { keyword: 'test' }],
      searchCharacters: [{ query: 'test' }, { keyword: 'test' }],
      searchPersons: [{ query: 'test' }, { keyword: 'test' }],
      getSubjects: [{ limit: 10 }],
      getSubjectById: [123],
      getSubjectImageById: [123, { type: 'large' }],
      getRelatedPersonsBySubjectId: [123],
      getRelatedCharactersBySubjectId: [123],
      getRelatedSubjectsBySubjectId: [123],
      getEpisodes: [{ subject_id: 123 }],
      getEpisodeById: [456],
      getCharacterById: [789],
      getCharacterImageById: [789],
      getRelatedSubjectsByCharacterId: [789],
      getRelatedPersonsByCharacterId: [789],
      collectCharacterByCharacterIdAndUserId: [789],
      uncollectCharacterByCharacterIdAndUserId: [789],
      getPersonById: [101],
      getPersonImageById: [101],
      getRelatedSubjectsByPersonId: [101],
      getRelatedCharactersByPersonId: [101],
      collectPersonByPersonIdAndUserId: [101],
      uncollectPersonByPersonIdAndUserId: [101],
      getUserByName: ['abc'],
      getUserAvatarByName: ['abc'],
      getMyself: [],
      getUserCollectionsByUsername: ['abc'],
      getUserCollection: ['abc', 123],
      postUserCollection: [123, {}, { type: 1 }],
      patchUserCollection: [123, {}, { type: 1 }],
      getUserSubjectEpisodeCollection: [123],
      patchUserSubjectEpisodeCollection: [123, {}, { ep_id: [1] }],
      getUserEpisodeCollection: [456],
      putUserEpisodeCollection: [456, {}, { type: 1 }],
      getUserCharacterCollections: ['abc'],
      getUserCharacterCollection: ['abc', 789],
      getUserPersonCollections: ['abc'],
      getUserPersonCollection: ['abc', 101],
      getPersonRevisions: [{ limit: 10 }],
      getPersonRevisionByRevisionId: [111],
      getCharacterRevisions: [{ limit: 10 }],
      getCharacterRevisionByRevisionId: [222],
      getSubjectRevisions: [{ limit: 10 }],
      getSubjectRevisionByRevisionId: [333],
      getEpisodeRevisions: [{ limit: 10 }],
      getEpisodeRevisionByRevisionId: [444],
      newIndex: [{}, { title: 'my index' }],
      getIndexById: [555],
      editIndexById: [555, {}, { title: 'updated index' }],
      getIndexSubjectsByIndexId: [555],
      addSubjectToIndexByIndexId: [555, {}, { subject_id: 123 }],
      editIndexSubjectsByIndexIdAndSubjectID: [555, 123, {}, { sort: 1 }],
      delelteSubjectFromIndexByIndexIdAndSubjectID: [555, 123],
      collectIndexByIndexIdAndUserId: [555],
      uncollectIndexByIndexIdAndUserId: [555],
      getCalendar: [],
    };

    let lastCapturedUrl = '';
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      lastCapturedUrl = url;
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    const httpClient = new HttpClient({ fetchFn: mockFetch });
    const openApiClient = new GeneratedBangumiOpenApiClient(httpClient);
    const calendarClient = new CalendarClient(httpClient);

    const placeholderRegex = /\{[^}]+\}/;

    for (const [opId] of Object.entries(OPERATION_REGISTRY)) {
      const args = sampleArgsMap[opId] || [];
      lastCapturedUrl = '';

      if (opId === 'getCalendar') {
        await calendarClient.getCalendar();
      } else {
        const fn = (openApiClient as any)[opId];
        expect(typeof fn).toBe('function');
        await fn.apply(openApiClient, args);
      }

      expect(lastCapturedUrl).not.toBe('');
      expect(lastCapturedUrl).not.toMatch(placeholderRegex);
    }
  });
});
