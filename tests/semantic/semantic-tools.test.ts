import { describe, it, expect, vi } from 'vitest';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import {
  createReadTools,
  createWriteTools,
  ToolRegistry,
  ToolContext,
  ToolExecutionDependencies,
  createRuntimeDependencies,
} from '@bangumi-agent-kit/tools';
import { MemoryStorage } from '@bangumi-agent-kit/db';
import { TokenBroker, encryptToken } from '@bangumi-agent-kit/auth';
import {
  getCollectionStatusLabel,
  mapCollectionStatus,
  CharacterService,
} from '@bangumi-agent-kit/bangumi-core';
import { z } from 'zod';

interface TestToolResult {
  status: string;
  exact: { id: number; name: string; name_cn: string };
  candidates: Array<{ id: number; name: string; name_cn: string; type: number; summary: string }>;
  subject: { id: number; name: string; name_cn: string };
  cast: Array<{
    id: number;
    name: string;
    relation: string;
    actors: Array<{ id: number; name: string }>;
  }>;
  items: Array<{ id: number; name: string; comment: string; statusLabel: string }>;
  count: number;
  total: number;
  operations: Array<{ operationId: string }>;
  operationId: string;
  method: string;
  [key: string]: unknown;
}

async function executeTestTool<TOutput = TestToolResult>(
  tool: {
    execute: (
      input: never,
      context: ToolContext,
      deps?: ToolExecutionDependencies,
    ) => Promise<unknown>;
  },
  input: unknown,
  context: ToolContext,
  deps?: ToolExecutionDependencies,
): Promise<TOutput> {
  return (await tool.execute(input as never, context, deps)) as TOutput;
}

describe('Semantic Tools Contract Tests (S01 - S25)', () => {
  const context = { principalId: 'user-s', botInstanceId: 'bot-s', conversationId: 'c-s' };

  it('S01: search subject exact Chinese name', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          total: 1,
          limit: 10,
          offset: 0,
          data: [{ id: 226998, name: '少女終末旅行', name_cn: '少女终末旅行', type: 2 }],
        }),
        { status: 200 },
      ),
    );
    const httpClient = new HttpClient({ fetchFn: mockFetch });
    const tools = createReadTools(httpClient);
    const searchTool = tools.find((t) => t.name === 'bangumi.search_subjects')!;

    const res = await executeTestTool(searchTool, { query: '少女终末旅行' }, context);
    expect(res.status).toBe('exact');
    expect(res.exact?.id).toBe(226998);
  });

  it('S02: search subject exact Japanese name', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          total: 1,
          limit: 10,
          offset: 0,
          data: [{ id: 226998, name: '少女終末旅行', name_cn: '少女终末旅行', type: 2 }],
        }),
        { status: 200 },
      ),
    );
    const httpClient = new HttpClient({ fetchFn: mockFetch });
    const tools = createReadTools(httpClient);
    const searchTool = tools.find((t) => t.name === 'bangumi.search_subjects')!;

    const res = await executeTestTool(searchTool, { query: '少女終末旅行' }, context);
    expect(res.status).toBe('exact');
    expect(res.exact?.id).toBe(226998);
  });

  it('S03: multiple exact same-name results -> disambiguation', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          total: 2,
          limit: 10,
          offset: 0,
          data: [
            { id: 101, name: 'SAME NAME', name_cn: '同名作品', type: 2 },
            { id: 102, name: 'SAME NAME', name_cn: '同名作品', type: 1 },
          ],
        }),
        { status: 200 },
      ),
    );
    const httpClient = new HttpClient({ fetchFn: mockFetch });
    const tools = createReadTools(httpClient);
    const searchTool = tools.find((t) => t.name === 'bangumi.search_subjects')!;

    const res = await executeTestTool(searchTool, { query: 'SAME NAME' }, context);
    expect(res.status).toBe('disambiguation');
    expect(res.candidates).toHaveLength(2);
  });

  it('S04: no subject -> not_found', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ total: 0, limit: 10, offset: 0, data: [] }), { status: 200 }),
      );
    const httpClient = new HttpClient({ fetchFn: mockFetch });
    const tools = createReadTools(httpClient);
    const searchTool = tools.find((t) => t.name === 'bangumi.search_subjects')!;

    const res = await executeTestTool(
      searchTool,
      { query: 'nonexistent_keyword_xyz' },
      context,
    );
    expect(res.status).toBe('not_found');
    expect(res.candidates).toHaveLength(0);
  });

  it('S05: numeric subject ID -> exact detail', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: 226998, name: '少女終末旅行', type: 2 }), {
        status: 200,
      }),
    );
    const httpClient = new HttpClient({ fetchFn: mockFetch });
    const tools = createReadTools(httpClient);
    const searchTool = tools.find((t) => t.name === 'bangumi.search_subjects')!;

    const res = await executeTestTool(searchTool, { query: '226998' }, context);
    expect(res.status).toBe('exact');
    expect(res.exact?.id).toBe(226998);
  });

  it('S06: search character by name -> POST search/characters', async () => {
    let capturedUrl = '';
    let capturedMethod = '';
    let capturedBody: Record<string, unknown> | undefined;

    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedMethod = init?.method || 'GET';
      capturedBody = init?.body ? JSON.parse(init.body as string) : undefined;
      return new Response(
        JSON.stringify({
          total: 1,
          limit: 10,
          offset: 0,
          data: [{ id: 1, name: '後藤ひとり', type: 1 }],
        }),
        { status: 200 },
      );
    });
    const httpClient = new HttpClient({ fetchFn: mockFetch });
    const tools = createReadTools(httpClient);
    const searchCharTool = tools.find((t) => t.name === 'bangumi.search_characters')!;

    const res = await executeTestTool(searchCharTool, { query: '後藤ひとり' }, context);
    expect(capturedUrl).toContain('/v0/search/characters');
    expect(capturedMethod).toBe('POST');
    expect(capturedBody).toEqual({ keyword: '後藤ひとり' });
    expect(res.candidates[0]!.name).toBe('後藤ひとり');
  });

  it('S07: search person by name -> POST search/persons', async () => {
    let capturedUrl = '';
    let capturedMethod = '';
    let capturedBody: Record<string, unknown> | undefined;

    const mockFetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      capturedUrl = url;
      capturedMethod = init?.method || 'GET';
      capturedBody = init?.body ? JSON.parse(init.body as string) : undefined;
      return new Response(
        JSON.stringify({
          total: 1,
          limit: 10,
          offset: 0,
          data: [{ id: 20, name: '青山吉能', career: ['seiyu'] }],
        }),
        { status: 200 },
      );
    });
    const httpClient = new HttpClient({ fetchFn: mockFetch });
    const tools = createReadTools(httpClient);
    const searchPersonTool = tools.find((t) => t.name === 'bangumi.search_persons')!;

    const res = await executeTestTool(searchPersonTool, { query: '青山吉能' }, context);
    expect(capturedUrl).toContain('/v0/search/persons');
    expect(capturedMethod).toBe('POST');
    expect(capturedBody).toEqual({ keyword: '青山吉能' });
    expect(res.candidates[0]!.name).toBe('青山吉能');
  });

  it('S08: get_character by ID -> detail endpoint', async () => {
    const capturedUrls: string[] = [];
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      capturedUrls.push(url);
      if (url.endsWith('/characters/10')) {
        return new Response(JSON.stringify({ id: 10, name: 'Bocchi' }), { status: 200 });
      }
      return new Response(JSON.stringify([]), { status: 200 });
    });
    const httpClient = new HttpClient({ fetchFn: mockFetch });
    const tools = createReadTools(httpClient);
    const getCharTool = tools.find((t) => t.name === 'bangumi.get_character')!;

    const res = await executeTestTool(getCharTool, { characterId: 10 }, context);
    expect(capturedUrls[0]).toContain('/v0/characters/10');
    expect(res.id).toBe(10);
  });

  it('S09: get_person by ID -> detail endpoint', async () => {
    const capturedUrls: string[] = [];
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      capturedUrls.push(url);
      if (url.endsWith('/persons/20')) {
        return new Response(JSON.stringify({ id: 20, name: 'Yoshino' }), { status: 200 });
      }
      return new Response(JSON.stringify([]), { status: 200 });
    });
    const httpClient = new HttpClient({ fetchFn: mockFetch });
    const tools = createReadTools(httpClient);
    const getPersonTool = tools.find((t) => t.name === 'bangumi.get_person')!;

    const res = await executeTestTool(getPersonTool, { personId: 20 }, context);
    expect(capturedUrls[0]).toContain('/v0/persons/20');
    expect(res.id).toBe(20);
  });

  it('S10: get_subject_cast produces 1 HTTP request and maps official RelatedCharacter actors', async () => {
    let callCount = 0;
    const capturedUrls: string[] = [];
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      callCount++;
      capturedUrls.push(url);
      return new Response(
        JSON.stringify([
          {
            id: 101,
            name: '角色A',
            type: 1,
            summary: '',
            relation: '主角',
            actors: [
              {
                id: 1001,
                name: '声优A',
                type: 1,
                career: ['seiyu'],
              },
            ],
          },
        ]),
        { status: 200 },
      );
    });

    const httpClient = new HttpClient({ fetchFn: mockFetch });
    const tools = createReadTools(httpClient);
    const castTool = tools.find((t) => t.name === 'bangumi.get_subject_cast')!;

    const res = await executeTestTool(castTool, { subjectId: 100 }, context);
    expect(callCount).toBe(1);
    expect(capturedUrls[0]).toContain('/v0/subjects/100/characters');
    expect(res.status).toBe('ok');
    expect(res.cast).toHaveLength(1);
    expect(res.cast[0]!.relation).toBe('主角');
    expect(res.cast[0]!.actors[0]!.name).toBe('声优A');
  });

  it('S10 regression: CharacterPerson numeric type does not leak into roleName string', async () => {
    const mockFetch = vi.fn().mockImplementation(async () => {
      return new Response(
        JSON.stringify([
          {
            id: 1001,
            name: '声优A',
            type: 1,
            subject_id: 100,
            subject_type: 2,
            subject_name: 'anime',
            subject_name_cn: '动画',
            staff: 'CV',
          },
        ]),
        { status: 200 },
      );
    });
    const httpClient = new HttpClient({ fetchFn: mockFetch });
    const characterService = new CharacterService(httpClient);

    const persons = await characterService.getCharacterRelatedPersons(101);
    expect(persons[0]?.type).toBe(1);
    expect(persons[0]?.subjectId).toBe(100);
    expect(persons[0]?.staff).toBe('CV');
  });

  it('S11, S12, S13: episode through 12 excludes SP, OP, ED', async () => {
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/episodes')) {
        return new Response(
          JSON.stringify({
            total: 15,
            limit: 100,
            offset: 0,
            data: Array.from({ length: 12 }, (_, i) => ({
              id: i + 1,
              type: 0,
              sort: i + 1,
              ep: i + 1,
              name: `Ep ${i + 1}`,
            })).concat([
              { id: 101, type: 1, sort: 1, ep: 1, name: 'SP 1' },
              { id: 102, type: 2, sort: 1, ep: 1, name: 'OP 1' },
              { id: 103, type: 3, sort: 1, ep: 1, name: 'ED 1' },
            ]),
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      return new Response(JSON.stringify({ message: 'ok' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });

    const storage = new MemoryStorage();
    const secretKey = 'test-secret-key-123456789012345678901234';
    const principal = await storage.findOrCreatePrincipal({
      provider: 'test',
      botInstanceId: 'bot-s',
      externalUserId: 'usr-s',
    });
    const account = await storage.upsertBangumiAccount({
      id: 'acc-s',
      bangumiUserId: 1,
      username: 'u',
      nickname: 'N',
    });
    await storage.replaceActiveBinding(principal.id, account.id);
    await storage.upsertCredential({
      id: 'c-s',
      bangumiAccountId: account.id,
      encryptedAccessToken: encryptToken('token', secretKey, 'v1'),
      expiresAt: new Date(Date.now() + 3600000),
      requestedCapabilities: ['write:collection'],
      reportedScopes: ['write:collection'],
      scopeEvidence: 'reported',
      keyVersion: 'v1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const httpClient = new HttpClient({ fetchFn: mockFetch });
    const broker = new TokenBroker(storage, { secretKey }, httpClient);
    const writeTools = createWriteTools(broker);
    const progressTool = writeTools.find((t) => t.name === 'bangumi.update_episode_progress')!;

    const res = await executeTestTool(
      progressTool,
      {
        subjectId: 100,
        target: { kind: 'through', episodeNumber: 12, category: 'main' },
        status: 'watched',
      },
      { ...context, principalId: principal.id },
    );

    expect(res.status).toBe('complete');
    expect(res.targetReached).toBe(true);
    expect(res.resolvedEpisodeIds).toHaveLength(12);
    expect(res.resolvedEpisodeIds).not.toContain(101);
  });

  it('get_episodes category enum correctly maps category string to type integer', async () => {
    const capturedUrls: string[] = [];
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      capturedUrls.push(url);
      return new Response(
        JSON.stringify({ total: 1, limit: 10, offset: 0, data: [{ id: 1, type: 0 }] }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    });
    const httpClient = new HttpClient({ fetchFn: mockFetch });
    const tools = createReadTools(httpClient);
    const getEpTool = tools.find((t) => t.name === 'bangumi.get_episodes')!;

    await executeTestTool(getEpTool, { subjectId: 100, category: 'main' }, context);
    expect(capturedUrls[0]).toContain('type=0');

    await executeTestTool(getEpTool, { subjectId: 100, category: 'pv' }, context);
    expect(capturedUrls[1]).toContain('type=4');

    await executeTestTool(getEpTool, { subjectId: 100, category: 'mad' }, context);
    expect(capturedUrls[2]).toContain('type=5');

    await executeTestTool(getEpTool, { subjectId: 100, category: 'other' }, context);
    expect(capturedUrls[3]).toContain('type=6');
  });

  it('S14: target episode missing -> partial result and warning', async () => {
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/episodes')) {
        return new Response(
          JSON.stringify({
            total: 2,
            limit: 100,
            offset: 0,
            data: [
              { id: 1, type: 0, sort: 1, ep: 1 },
              { id: 2, type: 0, sort: 2, ep: 2 },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      return new Response(JSON.stringify({ message: 'ok' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });
    const storage = new MemoryStorage();
    const secretKey = 'test-secret-key-123456789012345678901234';
    const principal = await storage.findOrCreatePrincipal({
      provider: 'test',
      botInstanceId: 'b',
      externalUserId: 'u',
    });
    const account = await storage.upsertBangumiAccount({
      id: 'acc',
      bangumiUserId: 1,
      username: 'u',
      nickname: 'N',
    });
    await storage.replaceActiveBinding(principal.id, account.id);
    await storage.upsertCredential({
      id: 'c',
      bangumiAccountId: account.id,
      encryptedAccessToken: encryptToken('token', secretKey, 'v1'),
      expiresAt: new Date(Date.now() + 3600000),
      requestedCapabilities: ['write:collection'],
      reportedScopes: ['write:collection'],
      scopeEvidence: 'reported',
      keyVersion: 'v1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const httpClient = new HttpClient({ fetchFn: mockFetch });
    const broker = new TokenBroker(storage, { secretKey }, httpClient);
    const writeTools = createWriteTools(broker);
    const progressTool = writeTools.find((t) => t.name === 'bangumi.update_episode_progress')!;

    const res = await executeTestTool(
      progressTool,
      {
        subjectId: 100,
        target: { kind: 'through', episodeNumber: 12 },
      },
      { ...context, principalId: principal.id },
    );

    expect(res.status).toBe('partial');
    expect(res.targetReached).toBe(false);
    expect(res.warning).toContain('target episode 12 was not found');
    expect(res.resolvedEpisodeIds).toEqual([1, 2]);
  });

  it('S15: >20 through progress -> confirmation required via ToolRegistry', async () => {
    const storage = new MemoryStorage();
    const secretKey = 'test-secret-key-123456789012345678901234';
    const principal = await storage.findOrCreatePrincipal({
      provider: 'test',
      botInstanceId: 'bot-s',
      externalUserId: 'usr-s15',
    });
    const account = await storage.upsertBangumiAccount({
      id: 'acc-s15',
      bangumiUserId: 15,
      username: 'u15',
      nickname: 'N15',
    });
    await storage.replaceActiveBinding(principal.id, account.id);
    await storage.upsertCredential({
      id: 'c-s15',
      bangumiAccountId: account.id,
      encryptedAccessToken: encryptToken('token', secretKey, 'v1'),
      expiresAt: new Date(Date.now() + 3600000),
      requestedCapabilities: ['write:collection'],
      reportedScopes: ['write:collection'],
      scopeEvidence: 'reported',
      keyVersion: 'v1',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const deps = createRuntimeDependencies({ storage, secretKey });
    const registry = new ToolRegistry(deps);

    await expect(
      registry.executeTool(
        'bangumi.update_episode_progress',
        {
          subjectId: 100,
          target: { kind: 'through', episodeNumber: 25 },
        },
        { ...context, principalId: principal.id },
      ),
    ).rejects.toThrow('CONFIRMATION_REQUIRED');
  });

  it('S16 - S19: collection status labels per subject type', () => {
    expect(getCollectionStatusLabel('anime', 'done')).toBe('看过');
    expect(getCollectionStatusLabel('book', 'done')).toBe('读过');
    expect(getCollectionStatusLabel('music', 'done')).toBe('听过');
    expect(getCollectionStatusLabel('game', 'done')).toBe('玩过');
    expect(getCollectionStatusLabel('other', 'done')).toBe('已完成');
  });

  it('S20: unknown collection status -> never silently doing', () => {
    expect(mapCollectionStatus(999)).toBe('unknown');
    expect(mapCollectionStatus('invalid')).toBe('unknown');
  });

  it('S21: list own collections unbound -> AUTH_REQUIRED via ToolRegistry', async () => {
    const registry = new ToolRegistry();
    await expect(registry.executeTool('bangumi.list_collections', {}, context)).rejects.toThrow(
      'AUTH_REQUIRED',
    );
  });

  it('S22: list public username collections -> no auth required', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          total: 1,
          data: [{ subject_id: 1, type: 2, subject: { name: 'Anime 1', type: 2 } }],
        }),
        { status: 200 },
      ),
    );
    const httpClient = new HttpClient({ fetchFn: mockFetch });
    const tools = createReadTools(httpClient);
    const listColTool = tools.find((t) => t.name === 'bangumi.list_collections')!;

    const res = await executeTestTool(listColTool, { username: 'spike' }, context);
    expect(res.items[0]!.statusLabel).toBe('看过');
  });

  it('S23: get_user -> only one user API request', async () => {
    let apiCallCount = 0;
    const mockFetch = vi.fn().mockImplementation(async () => {
      apiCallCount++;
      return new Response(JSON.stringify({ id: 1, username: 'spike', nickname: 'Spike' }), {
        status: 200,
      });
    });
    const httpClient = new HttpClient({ fetchFn: mockFetch });
    const tools = createReadTools(httpClient);
    const getUserTool = tools.find((t) => t.name === 'bangumi.get_user')!;

    const res = await executeTestTool(getUserTool, { username: 'spike' }, context);
    expect(apiCallCount).toBe(1);
    expect(res.username).toBe('spike');
  });

  it('S24: large search response -> candidate projection only', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          total: 1,
          data: [{ id: 1, name: 'Anime', summary: 'Giant 100KB summary text here...' }],
        }),
        { status: 200 },
      ),
    );
    const httpClient = new HttpClient({ fetchFn: mockFetch });
    const tools = createReadTools(httpClient);
    const searchCharTool = tools.find((t) => t.name === 'bangumi.search_characters')!;

    const res = await executeTestTool(searchCharTool, { query: 'Bocchi' }, context);
    expect(res.candidates[0]!.summary).toBeUndefined();
  });

  it('S25: all curated tools expose required metadata', async () => {
    const registry = new ToolRegistry();
    const tools = registry.getTools();

    expect(tools.length).toBeGreaterThanOrEqual(18);
    for (const tool of tools) {
      expect(tool.name).toBeDefined();
      expect(tool.description).toBeDefined();
      expect(tool.input).toBeDefined();
    }
  });

  it('Tool Catalog Regression: optional params not marked as required in JSON schema', () => {
    const tools = createReadTools();
    const searchTool = tools.find((t) => t.name === 'bangumi.search_subjects')!;
    const searchSchema = z.toJSONSchema(searchTool.input) as { required?: string[] };
    expect(searchSchema.required).toBeDefined();
    expect(searchSchema.required).not.toContain('limit');
    expect(searchSchema.required).not.toContain('offset');
    expect(searchSchema.required).not.toContain('nsfw');

    const castTool = tools.find((t) => t.name === 'bangumi.get_subject_cast')!;
    const castSchema = z.toJSONSchema(castTool.input) as { required?: string[] };
    expect(castSchema.required).toEqual(['subjectId']);
  });
});
