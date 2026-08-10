import { z } from 'zod';
import { defineTool } from '../define-tool.js';
import { BangumiError } from '@bangumi-agent-kit/bangumi-transport';
import {
  SubjectService,
  UserService,
  CharacterService,
  CalendarService,
  PersonService,
} from '@bangumi-agent-kit/bangumi-core';
import {
  RenderService,
  LocalArtifactStore,
  ArtifactStore,
  buildSubjectCardViewModel,
  buildCastCardViewModel,
  buildCollectionProgressViewModel,
  buildCalendarIntelligenceViewModel,
  buildSearchListViewModel,
  buildPersonProfileViewModel,
} from '@bangumi-agent-kit/renderer';

let globalArtifactStore: ArtifactStore | null = null;
let globalRenderService: RenderService | null = null;

function getArtifactStore(): ArtifactStore {
  if (!globalArtifactStore) {
    globalArtifactStore = new LocalArtifactStore();
  }
  return globalArtifactStore;
}

function getRenderService(): RenderService {
  if (!globalRenderService) {
    globalRenderService = new RenderService();
  }
  return globalRenderService;
}

export function createRenderPresentationTools(
  renderServiceOverride?: RenderService,
  artifactStoreOverride?: ArtifactStore,
) {
  const artifactStore = artifactStoreOverride || getArtifactStore();
  const renderService = renderServiceOverride || getRenderService();

  async function executeRenderAndSave(viewModel: any) {
    try {
      const renderResult = await renderService.renderCard(viewModel);
      const artifactRef = await artifactStore.saveArtifact(renderResult.buffer, 'image/png', {
        width: renderResult.width,
        height: renderResult.height,
      });
      return { artifact: artifactRef };
    } catch (err: any) {
      if (
        err?.code === 'RENDERER_UNAVAILABLE' ||
        err?.message?.includes("Executable doesn't exist") ||
        err?.message?.includes('playwright')
      ) {
        throw new BangumiError(
          'RENDERER_UNAVAILABLE',
          'Chromium / Renderer runtime unavailable. Run `pnpm renderer:install` to enable image cards.',
          false,
          503,
          '运行 pnpm renderer:install',
        );
      }
      throw err;
    }
  }

  const renderSubjectCard = defineTool({
    name: 'bangumi.render_subject_card',
    description:
      '生成指定 Subject 条目的渲染图片卡片 Artifact。返回 ArtifactRef (包含 ID 和尺寸，不写死本地绝对路径)。',
    input: z.object({
      subjectId: z.number().describe('Subject 条目 ID'),
      includeCollection: z.boolean().optional().describe('是否包含用户的收藏与评分状态'),
    }),
    auth: 'optional',
    scopes: [],
    risk: 'read',
    execute: async (input, _context, deps) => {
      const clientProvider = deps?.clientProvider;
      if (!clientProvider) {
        throw new BangumiError('INTERNAL_ERROR', 'ClientProvider unavailable', false);
      }

      const client = await clientProvider.getOptionalAuthenticatedClient(_context?.principalId);
      const subjectService = new SubjectService(client);
      const subjectData = await subjectService.getSubjectById(input.subjectId);

      let collectionData: any = undefined;
      if (input.includeCollection && _context?.principalId) {
        try {
          const userService = new UserService(client);
          const userCol = await userService.getUserSubjectCollection('me', input.subjectId);
          if (userCol.found && userCol.collection) {
            collectionData = {
              status: userCol.collection.status,
              statusLabel: userCol.collection.statusLabel,
              rating: userCol.collection.rating,
              comment: userCol.collection.comment,
            };
          }
        } catch {
          // collection optional
        }
      }

      const viewModel = buildSubjectCardViewModel(subjectData, {
        collection: collectionData,
      });

      return await executeRenderAndSave(viewModel);
    },
  });

  const renderCastCard = defineTool({
    name: 'bangumi.render_cast_card',
    description: '生成指定 Subject 的角色与声优 (Cast) 图片卡片 Artifact。',
    input: z.object({
      subjectId: z.number().describe('Subject 条目 ID'),
    }),
    auth: 'optional',
    scopes: [],
    risk: 'read',
    execute: async (input, _context, deps) => {
      const clientProvider = deps?.clientProvider;
      if (!clientProvider) {
        throw new BangumiError('INTERNAL_ERROR', 'ClientProvider unavailable', false);
      }

      const client = await clientProvider.getOptionalAuthenticatedClient(_context?.principalId);
      const subjectService = new SubjectService(client);
      const characterService = new CharacterService(client);

      const subjectData = await subjectService.getSubjectById(input.subjectId);
      const castItems = await characterService.getSubjectCharacters(input.subjectId);

      const viewModel = buildCastCardViewModel(
        { id: subjectData.id, name: subjectData.name, nameCn: subjectData.nameCn },
        castItems as any,
      );
      return await executeRenderAndSave(viewModel);
    },
  });

  const renderCollectionProgress = defineTool({
    name: 'bangumi.render_collection_progress',
    description: '生成用户对指定 Subject 的追番/追剧进度与评分卡片 Artifact。',
    input: z.object({
      subjectId: z.number().describe('Subject 条目 ID'),
    }),
    auth: 'required',
    scopes: ['read:collection'],
    risk: 'read',
    execute: async (input, _context, deps) => {
      const clientProvider = deps?.clientProvider;
      if (!clientProvider) {
        throw new BangumiError('INTERNAL_ERROR', 'ClientProvider unavailable', false);
      }

      const { client } = await clientProvider.requireAuthenticatedClient(_context?.principalId, [
        'read:collection',
      ]);
      const subjectService = new SubjectService(client);
      const userService = new UserService(client);

      const subjectData = await subjectService.getSubjectById(input.subjectId);
      const userCol = await userService.getUserSubjectCollection('me', input.subjectId);

      if (!userCol.found || !userCol.collection) {
        throw new BangumiError(
          'NOT_FOUND',
          `未找到用户对条目 ${input.subjectId} 的收藏记录`,
          false,
          404,
        );
      }

      const col = userCol.collection;
      const viewModel = buildCollectionProgressViewModel(
        {
          id: subjectData.id,
          name: subjectData.name,
          nameCn: subjectData.nameCn,
          image: subjectData.images?.common || subjectData.images?.medium,
        },
        {
          status: col.status,
          statusLabel: col.statusLabel,
          watchedEpisodes: col.epStatus || 0,
          totalEpisodes: subjectData.totalEpisodes || subjectData.eps || 0,
          rating: col.rating,
          comment: col.comment,
        },
      );

      return await executeRenderAndSave(viewModel);
    },
  });

  const renderCalendar = defineTool({
    name: 'bangumi.render_calendar',
    description: '生成 Bangumi 每日放送/追番日历卡片 Artifact。',
    input: z.object({
      weekday: z.number().int().min(1).max(7).optional().describe('限定特定星期 (1-7)'),
      maxPerDay: z.number().int().min(1).max(8).optional().describe('每天最多展示条数，默认 8'),
      maxTotal: z.number().int().min(1).max(56).optional().describe('最多展示总条数，默认 56'),
    }),
    auth: 'none',
    scopes: [],
    risk: 'read',
    execute: async (input, _context, deps) => {
      const publicHttpClient = deps?.publicHttpClient;
      if (!publicHttpClient) {
        throw new BangumiError('INTERNAL_ERROR', 'HttpClient unavailable', false);
      }

      const calendarService = new CalendarService(publicHttpClient);

      const calendarResult = await calendarService.getCalendarIntelligence(input);
      const viewModel = buildCalendarIntelligenceViewModel(calendarResult);
      return await executeRenderAndSave(viewModel);
    },
  });

  const renderSearch = defineTool({
    name: 'bangumi.render_search',
    description: '生成 Bangumi 搜索结果列表图片卡片 Artifact。',
    input: z.object({
      query: z.string().describe('搜索关键词'),
      subjectType: z
        .number()
        .optional()
        .describe('条目类型: 1-Book, 2-Anime, 3-Music, 4-Game, 6-Real'),
      limit: z.number().optional().describe('最多渲染条目数 (默认 10)'),
    }),
    auth: 'none',
    scopes: [],
    risk: 'read',
    execute: async (input, _context, deps) => {
      const clientProvider = deps?.clientProvider;
      if (!clientProvider) {
        throw new BangumiError('INTERNAL_ERROR', 'ClientProvider unavailable', false);
      }

      const client = await clientProvider.getPublicClient();
      const subjectService = new SubjectService(client);
      const searchRes = await subjectService.searchSubjects(input.query, {
        type: input.subjectType,
        limit: input.limit || 10,
      });

      const viewModel = buildSearchListViewModel(
        {
          query: input.query,
          total: searchRes.total,
          items: searchRes.items as any,
        },
        input.query,
        input.limit || 10,
      );

      return await executeRenderAndSave(viewModel);
    },
  });

  const renderPersonProfile = defineTool({
    name: 'bangumi.render_person_profile',
    description: '生成现实人物/声优/制作人员履历与关系分布图片卡片 Artifact。',
    input: z.object({
      personId: z.number().int().positive().describe('Bangumi 人物 ID'),
      maxSubjects: z.number().int().min(1).max(500).optional().describe('作品关系读取上限'),
      maxCharacters: z.number().int().min(1).max(500).optional().describe('角色关系读取上限'),
      maxCredits: z.number().int().min(1).max(20).optional().describe('每类关系最多展示条数'),
    }),
    auth: 'none',
    scopes: [],
    risk: 'read',
    execute: async (input, _context, deps) => {
      const clientProvider = deps?.clientProvider;
      if (!clientProvider) {
        throw new BangumiError('INTERNAL_ERROR', 'ClientProvider unavailable', false);
      }

      const client = await clientProvider.getPublicClient();
      const personService = new PersonService(client);
      const profile = await personService.getPersonProfile(input.personId, {
        maxSubjects: input.maxSubjects ?? 500,
        maxCharacters: input.maxCharacters ?? 500,
      });
      const viewModel = buildPersonProfileViewModel(profile, {
        retrievedAt: new Date().toISOString(),
        maxSubjectCredits: input.maxCredits ?? 8,
        maxCharacterCredits: input.maxCredits ?? 8,
      });
      return await executeRenderAndSave(viewModel);
    },
  });

  return [
    renderSubjectCard,
    renderCastCard,
    renderCollectionProgress,
    renderCalendar,
    renderSearch,
    renderPersonProfile,
  ] as const;
}
