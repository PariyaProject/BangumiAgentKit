import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import catalog from '../../docs/tool-catalog.json';
import {
  CharacterService,
  CollectionDashboardService,
  EpisodeService,
  IndexReadService,
  PersonService,
  RevisionService,
  SubjectService,
  UserService,
} from '@bangumi-agent-kit/bangumi-core';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { MemoryStorage } from '@bangumi-agent-kit/db';
import {
  COMPACT_MCP_TOOL_NAMES,
  ToolRegistry,
  createReadTools,
  createRenderPresentationTools,
} from '@bangumi-agent-kit/tools';
import { createAuthTools } from '../../packages/tools/src/definitions/auth-tools.js';

const context = {
  principalId: 'catalog-test-principal',
  botInstanceId: 'catalog-test-bot',
  conversationId: 'catalog-test-conversation',
};

function toolMap<T extends { name: string }>(tools: readonly T[]): Map<string, T> {
  return new Map(tools.map((tool) => [tool.name, tool]));
}

function createArtifactStore() {
  return {
    saveArtifact: vi.fn(async () => ({ id: 'public-artifact', mimeType: 'image/png' as const })),
    saveArtifactForPrincipal: vi.fn(async (principalId: string) => ({
      id: `private-${principalId}`,
      mimeType: 'image/png' as const,
    })),
    getArtifactForPrincipal: vi.fn(async () => null),
    resolveFilePathForPrincipal: vi.fn(async () => null),
  };
}

function readTestSources(root: string): string {
  let source = '';
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      source += readTestSources(path);
    } else if (/\.(?:ts|tsx|js|mjs)$/u.test(entry.name)) {
      source += `\n${readFileSync(path, 'utf8')}`;
    }
  }
  return source;
}

function jsonSchemaOf(tool: { input: z.ZodType }): Record<string, unknown> {
  const schema = z.toJSONSchema(tool.input) as Record<string, unknown>;
  delete schema.$schema;
  return schema;
}

describe('complete Bangumi tool surface', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps the generated 96-tool catalog in exact registry parity', () => {
    const registry = new ToolRegistry(
      { storage: new MemoryStorage(), publicHttpClient: new HttpClient() },
      { mode: 'full' },
    );
    const catalogNames = catalog.map((tool) => tool.name).sort();
    const registryTools = registry.getTools();

    expect(registryTools).toHaveLength(catalog.length);
    expect(registryTools.map((tool) => tool.name).sort()).toEqual(catalogNames);
    for (const entry of catalog) {
      const tool = registry.getTool(entry.name);
      expect(tool, entry.name).toBeDefined();
      expect(tool).toMatchObject({
        auth: entry.auth,
        risk: entry.risk,
        scopes: entry.scopes,
        description: entry.description,
      });
      expect(typeof tool!.execute, entry.name).toBe('function');
      expect(jsonSchemaOf(tool!), entry.name).toEqual(entry.inputSchema);
    }
    expect([...COMPACT_MCP_TOOL_NAMES]).toEqual([
      'bangumi.search_subjects',
      'bangumi.get_subject',
      'bangumi.get_subject_cast',
      'bangumi.query_subjects',
    ]);
  });

  it('keeps a direct test-source reference for every catalog tool', () => {
    const source = readTestSources(join(process.cwd(), 'tests'));
    const missing = catalog
      .map((tool) => tool.name)
      .filter((name) => !source.includes(`'${name}'`) && !source.includes(`"${name}"`));
    expect(missing).toEqual([]);
  });

  it('executes the previously uncovered read and account-removal entry points', async () => {
    const publicClient = new HttpClient({ fetchFn: vi.fn() });
    vi.spyOn(SubjectService.prototype, 'getSubjectRelations').mockResolvedValue([
      {
        id: 2,
        type: 'anime',
        name: '续集',
        nameCn: '续集',
        relation: '续集',
      },
    ] as any);
    vi.spyOn(EpisodeService.prototype, 'getEpisodeById').mockResolvedValue({
      id: 4,
      name: '第 1 话',
      nameCn: '第 1 话',
      ep: 1,
    } as any);
    vi.spyOn(CharacterService.prototype, 'getCharacterById').mockResolvedValue({
      id: 2,
      name: '角色',
      nameCn: '角色',
      summary: '简介',
    } as any);
    vi.spyOn(CharacterService.prototype, 'getCharacterRelatedSubjects').mockResolvedValue([]);
    vi.spyOn(CharacterService.prototype, 'getCharacterRelatedPersons').mockResolvedValue([]);
    vi.spyOn(PersonService.prototype, 'getPersonById').mockResolvedValue({
      id: 3,
      name: '人物',
      nameCn: '人物',
      career: ['声优'],
    } as any);
    vi.spyOn(PersonService.prototype, 'getPersonRelatedSubjects').mockResolvedValue([]);
    vi.spyOn(PersonService.prototype, 'getPersonRelatedCharacters').mockResolvedValue([]);
    vi.spyOn(IndexReadService.prototype, 'getIndexById').mockResolvedValue({
      id: 3,
      title: '目录',
      desc: '测试目录',
      total: 1,
      collects: 2,
      comments: 3,
      createdAt: '2026-01-01',
    });
    vi.spyOn(IndexReadService.prototype, 'getIndexSubjects').mockResolvedValue({
      total: 1,
      limit: 20,
      offset: 0,
      items: [{ id: 1, name: '作品', nameCn: '作品', order: 0 }],
    });
    vi.spyOn(UserService.prototype, 'getUserByName').mockResolvedValue({
      id: 10,
      username: 'alice',
      nickname: 'Alice',
      sign: 'hello',
    });
    vi.spyOn(UserService.prototype, 'getMyself').mockResolvedValue({
      id: 10,
      username: 'alice',
      nickname: 'Alice',
    });
    vi.spyOn(UserService.prototype, 'getUserSubjectCollection').mockResolvedValue({
      found: true,
      collection: { status: 'wish', statusLabel: '想看', rating: 8, epStatus: 0 },
    } as any);
    vi.spyOn(RevisionService.prototype, 'listRevisions').mockResolvedValue({
      total: 1,
      limit: 10,
      offset: 0,
      items: [{ id: 9, type: 1, summary: '更新', createdAt: '2026-01-01' }],
    } as any);
    vi.spyOn(RevisionService.prototype, 'getRevision').mockResolvedValue({
      id: 9,
      type: 1,
      summary: '更新',
      createdAt: '2026-01-01',
      data: { fixture: true },
    } as any);

    const reads = toolMap(createReadTools(publicClient));
    await expect(
      (reads.get('bangumi.get_subject_relations')!.execute as any)({ subjectId: 1 }, context, {
        publicHttpClient: publicClient,
      }),
    ).resolves.toMatchObject([{ id: 2, relation: '续集' }]);
    await expect(
      (reads.get('bangumi.get_episode')!.execute as any)({ episodeId: 4 }, context, {
        publicHttpClient: publicClient,
      }),
    ).resolves.toMatchObject({ id: 4, ep: 1 });
    await expect(
      (reads.get('bangumi.get_character')!.execute as any)({ characterId: 2 }, context, {
        publicHttpClient: publicClient,
      }),
    ).resolves.toMatchObject({ id: 2, relatedSubjects: [], relatedPersons: [] });
    await expect(
      (reads.get('bangumi.get_person')!.execute as any)({ personId: 3 }, context, {
        publicHttpClient: publicClient,
      }),
    ).resolves.toMatchObject({ id: 3, relatedSubjects: [], relatedCharacters: [] });
    await expect(
      (reads.get('bangumi.get_index')!.execute as any)({ indexId: 3 }, context, {
        publicHttpClient: publicClient,
      }),
    ).resolves.toMatchObject({ index: { id: 3 }, subjects: [{ id: 1 }] });
    await expect(
      (reads.get('bangumi.get_user')!.execute as any)({ username: 'alice' }, context, {
        publicHttpClient: publicClient,
      }),
    ).resolves.toMatchObject({ username: 'alice' });
    await expect(
      (reads.get('bangumi.get_collection')!.execute as any)(
        { subjectId: 1, username: 'alice' },
        context,
        {
          publicHttpClient: publicClient,
        },
      ),
    ).resolves.toMatchObject({ found: true, collection: { status: 'wish' } });
    await expect(
      (reads.get('bangumi.get_my_profile')!.execute as any)({}, context, {
        executionSession: { client: publicClient as any },
      }),
    ).resolves.toMatchObject({ id: 10, nickname: 'Alice' });
    await expect(
      (reads.get('bangumi.list_revisions')!.execute as any)(
        { entityType: 'subject', entityId: 1 },
        context,
        { publicHttpClient: publicClient },
      ),
    ).resolves.toMatchObject({ total: 1, items: [{ id: 9 }] });
    await expect(
      (reads.get('bangumi.get_revision')!.execute as any)(
        { entityType: 'subject', revisionId: 9 },
        context,
        { publicHttpClient: publicClient },
      ),
    ).resolves.toMatchObject({ id: 9, summary: '更新' });

    const removeAccount = vi.fn(async () => undefined);
    const auth = toolMap(
      createAuthTools({ removeAccount } as any, { createAuthorizationUrl: vi.fn() } as any),
    );
    await expect(
      (auth.get('bangumi.auth_remove_account')!.execute as any)(
        { accountId: 'account-1' },
        context,
      ),
    ).resolves.toEqual({ success: true, message: 'Bangumi 账号 account-1 已解绑' });
    expect(removeAccount).toHaveBeenCalledWith(context.principalId, 'account-1');
  });

  it('executes the previously uncovered render entry points and preserves private scope', async () => {
    const publicClient = new HttpClient({ fetchFn: vi.fn() });
    vi.spyOn(SubjectService.prototype, 'getSubjectById').mockResolvedValue({
      id: 1,
      name: 'Fixture',
      nameCn: '测试作品',
      type: 'anime',
      images: { common: 'https://example.invalid/cover.jpg' },
      totalEpisodes: 12,
    } as any);
    vi.spyOn(CharacterService.prototype, 'getSubjectCharacters').mockResolvedValue([
      {
        character: { id: 2, name: '角色', type: 1, images: {} },
        relation: '主角',
        actors: [{ id: 3, name: '声优', type: 1 }],
      },
    ] as any);
    vi.spyOn(UserService.prototype, 'getUserSubjectCollection').mockResolvedValue({
      found: true,
      collection: {
        status: 'wish',
        statusLabel: '想看',
        rating: 8,
        comment: '测试',
        epStatus: 3,
      },
    } as any);
    vi.spyOn(SubjectService.prototype, 'searchSubjects').mockResolvedValue({
      total: 1,
      limit: 10,
      offset: 0,
      items: [
        {
          id: 1,
          name: 'Fixture',
          nameCn: '测试作品',
          type: 'anime',
          date: '2026-01-01',
          score: 8,
          rank: 1,
          images: {},
        },
      ],
    } as any);
    vi.spyOn(CollectionDashboardService.prototype, 'getCollectionDashboard').mockResolvedValue({
      state: 'complete',
      data: {
        sections: {
          intelligence: { state: 'complete' },
          backlog: { state: 'complete' },
          schedule: { state: 'complete' },
        },
      },
      coverage: {},
      source: {
        class: 'composite',
        operations: [],
        authScope: 'account',
        attemptedAt: '2026-01-01',
      },
      evidence: [],
      warnings: [],
      limitations: [],
    } as any);

    const renderCard = vi.fn(async () => ({
      buffer: Buffer.from('png'),
      width: 640,
      height: 320,
      template: 'fixture',
      templateVersion: 1,
      cacheKey: 'fixture',
      warnings: [],
    }));
    const artifactStore = createArtifactStore();
    const renderTools = toolMap(
      createRenderPresentationTools({ renderCard } as any, artifactStore as any),
    );
    const clientProvider = {
      getPublicClient: async () => publicClient,
      getOptionalAuthenticatedClient: async () => publicClient,
      requireAuthenticatedClient: async () => ({
        client: publicClient,
        account: { id: 'account-1', username: 'alice', nickname: 'Alice' },
      }),
    };

    await expect(
      (renderTools.get('bangumi.render_cast_card')!.execute as any)({ subjectId: 1 }, context, {
        clientProvider,
      } as any),
    ).resolves.toMatchObject({ artifact: { id: 'public-artifact' } });
    await expect(
      (renderTools.get('bangumi.render_search')!.execute as any)({ query: 'Fixture' }, context, {
        clientProvider,
      } as any),
    ).resolves.toMatchObject({ artifact: { id: 'public-artifact' } });
    await expect(
      (renderTools.get('bangumi.render_collection_progress')!.execute as any)(
        { subjectId: 1 },
        { ...context, artifactPrincipalKey: 'principal-a' },
        { clientProvider } as any,
      ),
    ).resolves.toMatchObject({ artifact: { id: 'private-principal-a' } });
    await expect(
      (renderTools.get('bangumi.render_collection_dashboard')!.execute as any)(
        {},
        { ...context, artifactPrincipalKey: 'principal-a' },
        { clientProvider, publicHttpClient: publicClient } as any,
      ),
    ).resolves.toMatchObject({ artifact: { id: 'private-principal-a' } });

    expect(renderCard).toHaveBeenCalledWith(expect.objectContaining({ template: 'cast-card' }));
    expect(renderCard).toHaveBeenCalledWith(expect.objectContaining({ template: 'search-list' }));
    expect(renderCard).toHaveBeenCalledWith(
      expect.objectContaining({ template: 'collection-progress' }),
      { cache: false },
    );
    expect(renderCard).toHaveBeenCalledWith(
      expect.objectContaining({ template: 'collection-dashboard' }),
      { cache: false },
    );
    expect(artifactStore.saveArtifactForPrincipal).toHaveBeenCalledTimes(2);
  });
});
