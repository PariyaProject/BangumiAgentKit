import { describe, it, expect, vi } from 'vitest';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import {
  createReadTools,
  createWriteTools,
  ToolRegistry,
  ToolContext,
  ToolDefinition,
  defineTool,
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

async function executeTestTool<TSchema extends z.ZodType, TResult = TestToolResult>(
  tool: ToolDefinition<TSchema>,
  input: z.infer<TSchema>,
  context: ToolContext,
  deps?: ToolExecutionDependencies,
): Promise<TResult> {
  return (await tool.execute(input, context, deps)) as TResult;
}

function getReadToolMap(httpClient?: HttpClient) {
  const [
    searchTool,
    getSubjectTool,
    getSubjectRelationsTool,
    castTool,
    getSubjectStaffTool,
    getCalendarTool,
    getEpTool,
    getEpisodeTool,
    searchCharTool,
    getCharTool,
    searchPersonTool,
    getPersonTool,
    getPersonProfileTool,
    getUserTool,
    getMyProfileTool,
    listColTool,
    getCollectionTool,
    listRevisionsTool,
    getRevisionTool,
    getIndexTool,
    getSubjectStatsTool,
  ] = createReadTools(httpClient);
  return {
    searchTool,
    getSubjectTool,
    getSubjectRelationsTool,
    castTool,
    getSubjectStaffTool,
    getCalendarTool,
    getEpTool,
    getEpisodeTool,
    searchCharTool,
    getCharTool,
    searchPersonTool,
    getPersonTool,
    getPersonProfileTool,
    getUserTool,
    getMyProfileTool,
    listColTool,
    getCollectionTool,
    listRevisionsTool,
    getRevisionTool,
    getIndexTool,
    getSubjectStatsTool,
  };
}

function getWriteToolMap(deps?: Parameters<typeof createWriteTools>[0]) {
  const [
    updateCollectionTool,
    progressTool,
    manageCharColTool,
    managePersonColTool,
    manageIndexTool,
  ] = createWriteTools(deps);
  return {
    updateCollectionTool,
    progressTool,
    manageCharColTool,
    managePersonColTool,
    manageIndexTool,
  };
}

describe('Semantic Tools Contract Tests (S01 - S25)', () => {
  const context = { principalId: 'user-s', botInstanceId: 'bot-s', conversationId: 'c-s' };

  it('S00: static input type checking regression tests', () => {
    const getEpisodesTool = defineTool({
      name: 'bangumi.get_episodes',
      description: 'test',
      input: z.object({
        subjectId: z.number().int().positive(),
        category: z.enum(['main', 'sp', 'op', 'ed', 'pv', 'mad', 'other']).optional(),
        limit: z.number().int().min(1).max(200).optional(),
        offset: z.number().int().min(0).optional(),
      }),
      auth: 'none',
      scopes: [],
      risk: 'read',
      execute: async () => ({}),
    });

    // @ts-expect-error - subjectId must be a number, not a string
    executeTestTool(getEpisodesTool, { subjectId: 'wrong-string' }, context);

    // @ts-expect-error - category must be 'main' | 'sp' | 'op' | 'ed' | ..., not 'invalid-category'
    executeTestTool(getEpisodesTool, { subjectId: 1, category: 'invalid-category' }, context);
  });

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
    const { searchTool } = getReadToolMap(httpClient);

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
    const { searchTool } = getReadToolMap(httpClient);

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
    const { searchTool } = getReadToolMap(httpClient);

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
    const { searchTool } = getReadToolMap(httpClient);

    const res = await executeTestTool(searchTool, { query: 'nonexistent_keyword_xyz' }, context);
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
    const { searchTool } = getReadToolMap(httpClient);

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
    const { searchCharTool } = getReadToolMap(httpClient);

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
    const { searchPersonTool } = getReadToolMap(httpClient);

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
    const { getCharTool } = getReadToolMap(httpClient);

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
    const { getPersonTool } = getReadToolMap(httpClient);

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
    const { castTool } = getReadToolMap(httpClient);

    const res = await executeTestTool(castTool, { subjectId: 100 }, context);
    expect(callCount).toBe(1);
    expect(capturedUrls[0]).toContain('/v0/subjects/100/characters');
    expect(res.status).toBe('ok');
    expect(res.cast).toHaveLength(1);
    expect(res.cast[0]!.relation).toBe('主角');
    expect(res.cast[0]!.actors[0]!.name).toBe('声优A');
  });

  it('PR-7D: get_person_profile aggregates official person relationships with explicit coverage', async () => {
    const capturedUrls: string[] = [];
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      capturedUrls.push(url);
      if (url.endsWith('/persons/20')) {
        return new Response(
          JSON.stringify({
            id: 20,
            name: 'Yoshino',
            type: 1,
            career: ['seiyu'],
            images: {},
            summary: 'A bounded profile fixture.',
            gender: '女性',
            blood_type: 1,
            birth_year: 1995,
            birth_mon: 12,
            birth_day: 2,
            infobox: [{ key: '别名', value: [{ v: 'Yoshi' }] }],
          }),
          { status: 200 },
        );
      }
      if (url.endsWith('/persons/20/subjects')) {
        return new Response(
          JSON.stringify([
            { id: 100, type: 2, name: '作品A', name_cn: '作品甲', staff: '艺术家', eps: '' },
            { id: 101, type: 3, name: '作品B', name_cn: '', staff: '艺术家', eps: '' },
          ]),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify([
          {
            id: 1000,
            name: '角色A',
            type: 1,
            subject_id: 100,
            subject_type: 2,
            subject_name: '作品A',
            subject_name_cn: '作品甲',
            staff: '主角',
          },
          {
            id: 1001,
            name: '角色B',
            type: 1,
            subject_id: 101,
            subject_type: 3,
            subject_name: '作品B',
            staff: '配角',
          },
        ]),
        { status: 200 },
      );
    });
    const httpClient = new HttpClient({ fetchFn: mockFetch });
    const { getPersonProfileTool } = getReadToolMap(httpClient);

    const res = await executeTestTool(
      getPersonProfileTool,
      { personId: 20, includeCredits: false, maxSubjects: 1, maxCharacters: 2 },
      context,
    );
    const profile = res as any;

    expect(capturedUrls).toHaveLength(3);
    expect(capturedUrls).toEqual(
      expect.arrayContaining([
        expect.stringContaining('/v0/persons/20'),
        expect.stringContaining('/v0/persons/20/subjects'),
        expect.stringContaining('/v0/persons/20/characters'),
      ]),
    );
    expect(profile.person.name).toBe('Yoshino');
    expect(profile.state).toBe('partial');
    expect(profile.person).toMatchObject({ typeLabel: '个人', aliases: ['Yoshi'] });
    expect(profile.credits).toBeUndefined();
    expect(profile.summary).toMatchObject({
      subjectCredits: 1,
      uniqueSubjects: 1,
      characterCredits: 2,
      uniqueCharacters: 2,
      characterSubjects: 2,
    });
    expect(profile.coverage.state).toBe('partial');
    expect(profile.coverage.subjects).toMatchObject({ observed: 2, returned: 1, truncated: true });
    expect(profile.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ operation: 'GET /v0/persons/{person_id}/subjects' }),
        expect.objectContaining({ source: 'derived-s7', formulaVersion: 'person-activity-v1' }),
      ]),
    );
    expect(profile.notComputable).toContain('voice_actor_workload_window');
    expect(profile.capabilityStates.recent_activity).toBe('not_computable');
    expect(profile.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'NOT_COMPUTABLE' })]),
    );
  });

  it('PR-7D: get_subject_staff preserves raw relation labels and groups them', async () => {
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/persons')) {
        const staff = Array.from({ length: 157 }, (_, index) => ({
          id: index + 1,
          name: index === 136 ? '导演A' : `制作人员${index + 1}`,
          type: 1,
          career: index === 136 ? ['director'] : ['producer'],
          relation: index === 136 ? '导演' : '制作',
          eps: '',
        }));
        return new Response(JSON.stringify(staff), { status: 200 });
      }
      return new Response(
        JSON.stringify([
          {
            id: 101,
            name: '角色A',
            type: 1,
            summary: '',
            relation: '主角',
            actors: [{ id: 3, name: '声优C', type: 1, career: ['seiyu'] }],
          },
        ]),
        { status: 200 },
      );
    });
    const httpClient = new HttpClient({ fetchFn: mockFetch });
    const { getSubjectStaffTool } = getReadToolMap(httpClient);

    const res = await executeTestTool(getSubjectStaffTool, { subjectId: 226998 }, context);
    const staff = res as any;

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(staff.state).toBe('complete');
    expect(staff.productionStaff).toHaveLength(157);
    expect(staff.productionStaff[136]).toMatchObject({ relation: '导演' });
    expect(staff.cast[0].actors[0]).toMatchObject({ name: '声优C' });
    expect(staff.productionStaff.some((item: { relation: string }) => item.relation === 'CV')).toBe(
      false,
    );
    expect(staff.groups).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ relation: '导演', count: 1, memberIds: [137] }),
        expect.objectContaining({ relation: '制作', count: 156 }),
      ]),
    );
    expect(staff.coverage.state).toBe('complete');
    expect(staff.coverage.cast).toMatchObject({ observed: 1, returned: 1, truncated: false });
  });

  it('PR-7D: get_subject_staff reports independent source caps and machine-readable partial state', async () => {
    let cappedSource: 'productionStaff' | 'cast' = 'productionStaff';
    const mockFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.includes('/persons')) {
        const count = cappedSource === 'productionStaff' ? 201 : 1;
        return new Response(
          JSON.stringify(
            Array.from({ length: count }, (_, index) => ({
              id: index + 1,
              name: `制作人员${index + 1}`,
              type: 1,
              relation: '制作',
              eps: '',
            })),
          ),
          { status: 200 },
        );
      }
      const count = cappedSource === 'cast' ? 201 : 1;
      return new Response(
        JSON.stringify(
          Array.from({ length: count }, (_, index) => ({
            id: index + 1000,
            name: `角色${index + 1}`,
            type: 1,
            relation: '主角',
            actors: [],
          })),
        ),
        { status: 200 },
      );
    });
    const { getSubjectStaffTool } = getReadToolMap(new HttpClient({ fetchFn: mockFetch }));

    const productionPartial = (await executeTestTool(
      getSubjectStaffTool,
      { subjectId: 226998 },
      context,
    )) as any;
    expect(productionPartial.state).toBe('partial');
    expect(productionPartial.coverage.productionStaff).toMatchObject({
      observed: 201,
      returned: 200,
      truncated: true,
    });
    expect(productionPartial.coverage.cast).toMatchObject({
      observed: 1,
      returned: 1,
      truncated: false,
    });
    expect(productionPartial.capabilityStates.productionStaff).toBe('partial');
    expect(productionPartial.capabilityStates.cast).toBe('complete');

    cappedSource = 'cast';
    const castPartial = (await executeTestTool(
      getSubjectStaffTool,
      { subjectId: 226998, limit: 200 },
      context,
    )) as any;
    expect(castPartial.state).toBe('partial');
    expect(castPartial.coverage.productionStaff).toMatchObject({
      observed: 1,
      returned: 1,
      truncated: false,
    });
    expect(castPartial.coverage.cast).toMatchObject({
      observed: 201,
      returned: 200,
      truncated: true,
    });
    expect(castPartial.capabilityStates.productionStaff).toBe('complete');
    expect(castPartial.capabilityStates.cast).toBe('partial');
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });

  it('PR-7D: ToolRegistry uses injected transport and preserves machine-readable upstream failures', async () => {
    const secretKey = 'test-secret-key-123456789012345678901234';
    const injectedFetch = vi.fn().mockImplementation(async (url: string) => {
      if (url.endsWith('/persons/20')) {
        return new Response(
          JSON.stringify({
            id: 20,
            name: 'Injected',
            type: 1,
            career: ['seiyu'],
            gender: '女性',
            blood_type: 1,
            birth_year: 1995,
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify([]), { status: 200 });
    });
    const injectedClient = new HttpClient({ fetchFn: injectedFetch });
    const storage = new MemoryStorage();
    const registry = new ToolRegistry(
      createRuntimeDependencies({ storage, secretKey, publicHttpClient: injectedClient }),
    );
    const globalFetch = vi.fn().mockRejectedValue(new Error('GLOBAL_FETCH_USED'));
    vi.stubGlobal('fetch', globalFetch);

    try {
      const profile = (await registry.executeTool(
        'bangumi.get_person_profile',
        { personId: 20, includeCredits: false, maxSubjects: 1, maxCharacters: 1 },
        context,
      )) as { state: string };
      expect(profile.state).toBe('complete');
      expect(injectedFetch).toHaveBeenCalledTimes(3);
      expect(globalFetch).not.toHaveBeenCalled();

      const staff = (await registry.executeTool(
        'bangumi.get_subject_staff',
        { subjectId: 226998 },
        context,
      )) as { state: string };
      expect(staff.state).toBe('complete');
      expect(injectedFetch).toHaveBeenCalledTimes(5);
      expect(globalFetch).not.toHaveBeenCalled();

      await expect(
        registry.executeTool(
          'bangumi.get_person_profile',
          { personId: 20, maxSubjects: 501 },
          context,
        ),
      ).rejects.toThrow('VALIDATION_ERROR');
      await expect(
        registry.executeTool('bangumi.get_person_profile', { personId: 0 }, context),
      ).rejects.toThrow('VALIDATION_ERROR');
      await expect(
        registry.executeTool(
          'bangumi.get_subject_staff',
          { subjectId: 226998, limit: 201 },
          context,
        ),
      ).rejects.toThrow('VALIDATION_ERROR');
      await expect(
        registry.executeTool('bangumi.get_subject_staff', { subjectId: 0 }, context),
      ).rejects.toThrow('VALIDATION_ERROR');
    } finally {
      vi.unstubAllGlobals();
      await registry.close();
    }

    for (const [status, code] of [
      [404, 'NOT_FOUND'],
      [429, 'RATE_LIMITED'],
      [503, 'UPSTREAM_UNAVAILABLE'],
    ] as const) {
      const errorClient = new HttpClient({
        fetchFn: vi.fn().mockResolvedValue(new Response('upstream failure', { status })),
      });
      const errorRegistry = new ToolRegistry(
        createRuntimeDependencies({
          storage: new MemoryStorage(),
          secretKey,
          publicHttpClient: errorClient,
        }),
      );
      await expect(
        errorRegistry.executeTool('bangumi.get_person_profile', { personId: 20 }, context),
      ).rejects.toMatchObject({ code });
      await errorRegistry.close();
    }

    for (const failedSource of ['persons', 'characters'] as const) {
      for (const [status, code] of [
        [404, 'NOT_FOUND'],
        [429, 'RATE_LIMITED'],
        [503, 'UPSTREAM_UNAVAILABLE'],
      ] as const) {
        const errorClient = new HttpClient({
          fetchFn: vi.fn().mockImplementation(async (url: string) => {
            const failed = url.includes(`/subjects/226998/${failedSource}`);
            return failed
              ? new Response('upstream failure', { status })
              : new Response(JSON.stringify([]), { status: 200 });
          }),
        });
        const errorRegistry = new ToolRegistry(
          createRuntimeDependencies({
            storage: new MemoryStorage(),
            secretKey,
            publicHttpClient: errorClient,
          }),
        );
        await expect(
          errorRegistry.executeTool('bangumi.get_subject_staff', { subjectId: 226998 }, context),
        ).rejects.toMatchObject({ code });
        await errorRegistry.close();
      }
    }
  }, 30000);

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
    const { progressTool } = getWriteToolMap(broker);

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
    const { getEpTool } = getReadToolMap(httpClient);

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
    const { progressTool } = getWriteToolMap(broker);

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
    const registry = new ToolRegistry({ storage: new MemoryStorage() });
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
    const { listColTool } = getReadToolMap(httpClient);

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
    const { getUserTool } = getReadToolMap(httpClient);

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
    const { searchCharTool } = getReadToolMap(httpClient);

    const res = await executeTestTool(searchCharTool, { query: 'Bocchi' }, context);
    expect(res.candidates[0]!.summary).toBeUndefined();
  });

  it('S25: all curated tools expose required metadata', async () => {
    const registry = new ToolRegistry({ storage: new MemoryStorage() });
    const tools = registry.getTools();

    expect(tools.length).toBeGreaterThanOrEqual(18);
    for (const tool of tools) {
      expect(tool.name).toBeDefined();
      expect(tool.description).toBeDefined();
      expect(tool.input).toBeDefined();
    }
  });

  it('Tool Catalog Regression: optional params not marked as required in JSON schema', () => {
    const { searchTool, castTool } = getReadToolMap();
    const searchSchema = z.toJSONSchema(searchTool.input) as { required?: string[] };
    expect(searchSchema.required).toBeDefined();
    expect(searchSchema.required).not.toContain('limit');
    expect(searchSchema.required).not.toContain('offset');
    expect(searchSchema.required).not.toContain('nsfw');

    const castSchema = z.toJSONSchema(castTool.input) as { required?: string[] };
    expect(castSchema.required).toEqual(['subjectId']);
  });
});
