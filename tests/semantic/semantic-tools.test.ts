import { describe, it, expect, vi } from 'vitest';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { createReadTools, createWriteTools, ToolRegistry } from '@bangumi-agent-kit/tools';
import { MemoryStorage } from '@bangumi-agent-kit/db';
import { TokenBroker, encryptToken } from '@bangumi-agent-kit/auth';
import { getCollectionStatusLabel, mapCollectionStatus } from '@bangumi-agent-kit/bangumi-core';

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

    const res: any = await (searchTool.execute as any)({ query: '少女终末旅行' }, context);
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

    const res: any = await (searchTool.execute as any)({ query: '少女終末旅行' }, context);
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

    const res: any = await (searchTool.execute as any)({ query: 'SAME NAME' }, context);
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

    const res: any = await (searchTool.execute as any)(
      { query: 'nonexistent_keyword_xyz' },
      context,
    );
    expect(res.status).toBe('not_found');
    expect(res.candidates).toHaveLength(0);
  });

  it('S05: numeric subject ID -> exact detail', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ id: 226998, name: '少女終末旅行', type: 2 }), {
          status: 200,
        }),
      );
    const httpClient = new HttpClient({ fetchFn: mockFetch });
    const tools = createReadTools(httpClient);
    const searchTool = tools.find((t) => t.name === 'bangumi.search_subjects')!;

    const res: any = await (searchTool.execute as any)({ query: '226998' }, context);
    expect(res.status).toBe('exact');
    expect(res.exact?.id).toBe(226998);
  });

  it('S06: search character by name -> POST search/characters', async () => {
    let capturedUrl = '';
    let capturedMethod = '';
    let capturedBody: any;

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

    const res: any = await (searchCharTool.execute as any)({ query: '後藤ひとり' }, context);
    expect(capturedUrl).toContain('/v0/search/characters');
    expect(capturedMethod).toBe('POST');
    expect(capturedBody).toEqual({ keyword: '後藤ひとり' });
    expect(res.candidates[0].name).toBe('後藤ひとり');
  });

  it('S07: search person by name -> POST search/persons', async () => {
    let capturedUrl = '';
    let capturedMethod = '';
    let capturedBody: any;

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

    const res: any = await (searchPersonTool.execute as any)({ query: '青山吉能' }, context);
    expect(capturedUrl).toContain('/v0/search/persons');
    expect(capturedMethod).toBe('POST');
    expect(capturedBody).toEqual({ keyword: '青山吉能' });
    expect(res.candidates[0].name).toBe('青山吉能');
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

    const res: any = await (getCharTool.execute as any)({ characterId: 10 }, context);
    expect(capturedUrls[0]).toContain('/v0/characters/10');
    expect(res.character.id).toBe(10);
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

    const res: any = await (getPersonTool.execute as any)({ personId: 20 }, context);
    expect(capturedUrls[0]).toContain('/v0/persons/20');
    expect(res.person.id).toBe(20);
  });

  it('S10: subject cast partial person lookup failure -> partial + warning', async () => {
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/characters')) {
        return new Response(
          JSON.stringify([
            { id: 101, name: 'Char A' },
            { id: 102, name: 'Char B' },
          ]),
          { status: 200 },
        );
      }
      if (url.includes('/101/persons')) {
        return new Response(JSON.stringify([{ id: 1, name: 'Actor A', role_name: 'CV' }]), {
          status: 200,
        });
      }
      // Fail 102 person lookup with 500
      return new Response(JSON.stringify({ message: 'Internal error' }), { status: 500 });
    });
    const httpClient = new HttpClient({ fetchFn: mockFetch });
    const tools = createReadTools(httpClient);
    const castTool = tools.find((t) => t.name === 'bangumi.get_subject_cast')!;

    const res: any = await (castTool.execute as any)({ subjectId: 100 }, context);
    expect(res.status).toBe('partial');
    expect(res.warnings).toBeDefined();
    expect(res.warnings.length).toBeGreaterThan(0);
    expect(res.cast).toHaveLength(2);
  });

  it('S11, S12, S13: episode through 12 excludes SP, OP, ED', async () => {
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/episodes')) {
        return new Response(
          JSON.stringify({
            total: 15,
            limit: 100,
            offset: 0,
            data: [
              { id: 1, type: 0, sort: 1, ep: 1, name: 'Ep 1' },
              { id: 2, type: 0, sort: 2, ep: 2, name: 'Ep 2' },
              { id: 101, type: 1, sort: 1, ep: 1, name: 'SP 1' }, // SP
              { id: 102, type: 2, sort: 1, ep: 1, name: 'OP 1' }, // OP
              { id: 103, type: 3, sort: 1, ep: 1, name: 'ED 1' }, // ED
              { id: 3, type: 0, sort: 3, ep: 3, name: 'Ep 3' },
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

    const res: any = await (progressTool.execute as any)(
      {
        subjectId: 100,
        target: { kind: 'through', episodeNumber: 3, category: 'main' },
        status: 'watched',
      },
      { ...context, principalId: principal.id },
    );

    expect(res.resolvedEpisodeIds).toEqual([1, 2, 3]); // SP(101), OP(102), ED(103) strictly excluded!
  });

  it('S14: target episode missing -> warning generated', async () => {
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

    const res: any = await (progressTool.execute as any)(
      {
        subjectId: 100,
        target: { kind: 'through', episodeNumber: 12 }, // only 1~2 exist
      },
      { ...context, principalId: principal.id },
    );

    expect(res.warning).toContain('target episode 12 was not found');
    expect(res.resolvedEpisodeIds).toEqual([1, 2]);
  });

  it('S15: >20 through progress -> confirmation required', async () => {
    const writeTools = createWriteTools();
    const progressTool = writeTools.find((t) => t.name === 'bangumi.update_episode_progress')!;

    const policy = (progressTool.resolvePolicy as any)?.(
      {
        subjectId: 100,
        target: { kind: 'through', episodeNumber: 25 },
      },
      context,
    );

    expect(policy?.requiresConfirmation).toBe(true);
    expect(policy?.summary).toContain('将把条目 100 的正篇观看进度更新至第 25 集');
  });

  it('S16 - S19: collection status labels per subject type', () => {
    expect(getCollectionStatusLabel('anime', 'done')).toBe('看过');
    expect(getCollectionStatusLabel('book', 'done')).toBe('读过');
    expect(getCollectionStatusLabel('music', 'done')).toBe('听过');
    expect(getCollectionStatusLabel('game', 'done')).toBe('玩过');
  });

  it('S20: unknown collection status -> never silently doing', () => {
    expect(mapCollectionStatus(999)).toBe('unknown');
    expect(mapCollectionStatus('invalid')).toBe('unknown');
  });

  it('S21: list own collections unbound -> AUTH_REQUIRED', async () => {
    const httpClient = new HttpClient();
    const tools = createReadTools(httpClient);
    const listColTool = tools.find((t) => t.name === 'bangumi.list_collections')!;

    await expect((listColTool.execute as any)({}, context)).rejects.toThrow('AUTH_REQUIRED');
  });

  it('S22: list public username collections -> no auth required', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValue(
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

    const res: any = await (listColTool.execute as any)({ username: 'spike' }, context);
    expect(res.items[0].statusLabel).toBe('看过');
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

    const res: any = await (getUserTool.execute as any)({ username: 'spike' }, context);
    expect(apiCallCount).toBe(1);
    expect(res.username).toBe('spike');
    expect(res.recentCollections).toBeUndefined(); // Collections removed from get_user
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

    const res: any = await (searchCharTool.execute as any)({ query: 'Bocchi' }, context);
    expect(res.candidates[0].summary).toBeUndefined(); // Summary excluded from candidates
  });

  it('S25: all semantic tools produce documented result shape', async () => {
    const registry = new ToolRegistry();
    const tools = registry.getTools();

    expect(tools.length).toBeGreaterThanOrEqual(18);
    for (const tool of tools) {
      expect(tool.name).toBeDefined();
      expect(tool.description).toBeDefined();
      expect(tool.input).toBeDefined();
    }
  });
});
