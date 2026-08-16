import { describe, expect, it, vi } from 'vitest';
import { GeneratedBangumiOpenApiClient } from '@bangumi-agent-kit/bangumi-openapi';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { createReadTools, ToolRegistry, type ToolDefinition } from '@bangumi-agent-kit/tools';
import { MemoryStorage } from '@bangumi-agent-kit/db';

const context = {
  principalId: 'collection-reader',
  botInstanceId: 'bot',
  conversationId: 'conversation',
};

function findTool(httpClient: HttpClient, name: string): ToolDefinition {
  const tool = (createReadTools(httpClient) as unknown as ToolDefinition[]).find(
    (candidate) => candidate.name === name,
  );
  expect(tool).toBeDefined();
  return tool!;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('collection read parity tools', () => {
  it('reads account-bound episode collection state with official pagination and evidence', async () => {
    const requests: Array<{ url: URL; headers: Headers }> = [];
    const fetchFn: typeof fetch = async (input, init) => {
      requests.push({ url: new URL(String(input)), headers: new Headers(init?.headers) });
      return jsonResponse({
        total: 12,
        limit: 50,
        offset: 10,
        data: [
          {
            type: 2,
            updated_at: 1_723_600_000,
            episode: {
              id: 100,
              subject_id: 42,
              type: 0,
              name: 'Episode',
              name_cn: '第一集',
              sort: 1,
              ep: 1,
            },
          },
        ],
      });
    };
    const client = new GeneratedBangumiOpenApiClient(
      new HttpClient({ fetchFn, accessToken: 'bound-collection-token' }),
    );
    const tool = findTool(new HttpClient({ fetchFn }), 'bangumi.get_episode_collections');

    expect(tool.auth).toBe('required');
    expect(tool.scopes).toEqual(['read:collection']);
    expect(tool.input.safeParse({ subjectId: 42, episodeType: 6, limit: 200 }).success).toBe(true);
    expect(tool.input.safeParse({ subjectId: 42, episodeType: 7 }).success).toBe(false);
    expect(tool.input.safeParse({ subjectId: 42, limit: 201 }).success).toBe(false);
    expect(tool.input.safeParse({ subjectId: 42, offset: -1 }).success).toBe(false);

    const result = (await tool.execute(
      { subjectId: 42, episodeType: 0, limit: 50, offset: 10 },
      context,
      {
        executionSession: {
          account: { id: 'account-1', username: 'bound-user', nickname: 'Bound User' },
          client,
        },
      },
    )) as Record<string, any>;

    expect(result.items[0]).toMatchObject({
      type: 2,
      status: 'done',
      updatedAt: 1_723_600_000,
      episode: { id: 100, subjectId: 42, category: 'main', nameCn: '第一集' },
    });
    expect(result.coverage).toMatchObject({
      sourceTotal: 12,
      observed: 1,
      returned: 1,
      requestedLimit: 50,
      effectiveLimit: 50,
      upstreamLimit: 50,
      offset: 10,
      truncated: true,
    });
    expect(result.source).toMatchObject({
      source: 'official-v0',
      operation: 'GET /v0/users/-/collections/{subject_id}/episodes',
      authScope: 'account',
    });
    expect(requests).toHaveLength(1);
    expect(requests[0]!.url.pathname).toBe('/v0/users/-/collections/42/episodes');
    expect(Object.fromEntries(requests[0]!.url.searchParams)).toEqual({
      episode_type: '0',
      limit: '50',
      offset: '10',
    });
    expect(requests[0]!.headers.get('authorization')).toBe('Bearer bound-collection-token');
  });

  it('keeps public character/person collection reads bounded and preserves official fields', async () => {
    const requests: Array<{ url: URL; headers: Headers }> = [];
    const fetchFn: typeof fetch = async (input, init) => {
      const url = new URL(String(input));
      requests.push({ url, headers: new Headers(init?.headers) });
      if (url.pathname.endsWith('/characters')) {
        return jsonResponse({
          total: 2,
          limit: 0,
          offset: 0,
          data: [
            {
              id: 10,
              name: '角色甲',
              type: 1,
              images: { large: 'https://img/large', medium: 'https://img/medium' },
              created_at: '2026-08-01T00:00:00Z',
            },
            {
              id: 11,
              name: '角色乙',
              type: 2,
              created_at: '2026-08-02T00:00:00Z',
            },
          ],
        });
      }
      if (url.pathname.endsWith('/persons')) {
        return jsonResponse({
          total: 1,
          limit: 0,
          offset: 0,
          data: [
            {
              id: 20,
              name: '人物甲',
              type: 1,
              career: ['声优', 'artist'],
              images: { grid: 'https://img/grid' },
              created_at: '2026-08-03T00:00:00Z',
            },
          ],
        });
      }
      return jsonResponse({ error: 'not found' }, 404);
    };
    const client = new HttpClient({ fetchFn });
    const characterTool = findTool(client, 'bangumi.list_character_collections');
    const personTool = findTool(client, 'bangumi.list_person_collections');

    expect(characterTool.resolvePolicy?.({ username: 'public-user' }, context).auth).toBe('none');
    expect(characterTool.resolvePolicy?.({}, context).auth).toBe('required');
    expect(characterTool.input.safeParse({ username: '   ' }).success).toBe(false);
    expect(characterTool.input.safeParse({ username: 'public-user', maxItems: 51 }).success).toBe(
      false,
    );
    expect(personTool.input.safeParse({ username: 'public-user', maxItems: 0 }).success).toBe(
      false,
    );

    const characters = (await characterTool.execute(
      { username: 'public-user', maxItems: 1 },
      context,
    )) as Record<string, any>;
    const people = (await personTool.execute({ username: 'public-user' }, context)) as Record<
      string,
      any
    >;

    expect(characters.items).toHaveLength(1);
    expect(characters.items[0]).toMatchObject({
      id: 10,
      name: '角色甲',
      type: 1,
      images: { large: 'https://img/large' },
      createdAt: '2026-08-01T00:00:00Z',
    });
    expect(characters.coverage).toMatchObject({
      sourceTotal: 2,
      observed: 2,
      returned: 1,
      maxItems: 1,
      truncated: true,
    });
    expect(people.items[0]).toMatchObject({
      id: 20,
      name: '人物甲',
      career: ['声优', 'artist'],
      images: { grid: 'https://img/grid' },
      createdAt: '2026-08-03T00:00:00Z',
    });
    expect(people.coverage).toMatchObject({
      sourceTotal: 1,
      observed: 1,
      returned: 1,
      maxItems: 50,
      truncated: false,
    });
    expect(characters.source.authScope).toBe('public');
    expect(people.source.authScope).toBe('public');
    expect(requests.every((request) => !request.headers.has('authorization'))).toBe(true);
  });

  it('supports account-bound character reads and explicit not-found detail semantics', async () => {
    const requests: Array<{ url: URL; headers: Headers }> = [];
    const fetchFn: typeof fetch = async (input, init) => {
      const url = new URL(String(input));
      requests.push({ url, headers: new Headers(init?.headers) });
      if (url.pathname.endsWith('/characters/10')) {
        return jsonResponse({
          id: 10,
          name: '角色甲',
          type: 1,
          images: { small: 'https://img/small' },
          created_at: '2026-08-01T00:00:00Z',
        });
      }
      return jsonResponse({ error: 'not found' }, 404);
    };
    const accountClient = new GeneratedBangumiOpenApiClient(
      new HttpClient({ fetchFn, accessToken: 'account-token' }),
    );
    const characterTool = findTool(new HttpClient({ fetchFn }), 'bangumi.get_character_collection');
    const personTool = findTool(new HttpClient({ fetchFn }), 'bangumi.get_person_collection');

    const character = (await characterTool.execute({ characterId: 10 }, context, {
      executionSession: {
        account: { id: 'account-1', username: 'bound-user', nickname: 'Bound User' },
        client: accountClient,
      },
    })) as Record<string, any>;
    const missingPerson = (await personTool.execute(
      { personId: 99, username: 'public-user' },
      context,
    )) as Record<string, any>;

    expect(character).toMatchObject({
      found: true,
      item: { id: 10, name: '角色甲', createdAt: '2026-08-01T00:00:00Z' },
      source: { authScope: 'account' },
    });
    expect(missingPerson).toMatchObject({ found: false, source: { authScope: 'public' } });
    expect(requests[0]!.headers.get('authorization')).toBe('Bearer account-token');
    expect(requests[1]!.headers.has('authorization')).toBe(false);
  });

  it('rejects invalid collection inputs before network I/O and requires auth for omitted usernames', async () => {
    const fetchFn = vi.fn<typeof fetch>();
    const client = new HttpClient({ fetchFn });
    const characterTool = findTool(client, 'bangumi.list_character_collections');
    const episodeTool = findTool(client, 'bangumi.get_episode_collections');

    expect(characterTool.input.safeParse({ maxItems: 51 }).success).toBe(false);
    expect(characterTool.input.safeParse({ username: 'u', maxItems: 1.5 }).success).toBe(false);
    expect(episodeTool.input.safeParse({ subjectId: 0 }).success).toBe(false);
    expect(episodeTool.input.safeParse({ subjectId: 1, offset: 1_000_001 }).success).toBe(false);
    await expect(characterTool.execute({}, context)).rejects.toThrow('AUTH_REQUIRED');
    expect(fetchFn).not.toHaveBeenCalled();

    const registry = new ToolRegistry({
      storage: new MemoryStorage(),
      publicHttpClient: client,
    });
    await expect(
      registry.executeTool('bangumi.list_character_collections', { maxItems: 51 }, context),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    await expect(
      registry.executeTool('bangumi.get_episode_collections', { subjectId: 0 }, context),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
