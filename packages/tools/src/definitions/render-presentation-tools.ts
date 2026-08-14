import { z } from 'zod';
import { defineTool } from '../define-tool.js';
import { BangumiError } from '@bangumi-agent-kit/bangumi-transport';
import { DiscoveryEngine } from '@bangumi-agent-kit/discovery';
import {
  SubjectService,
  SeriesService,
  UserService,
  CharacterService,
  CalendarService,
  CollectionIntelligenceService,
  CollectionBacklogService,
  CollectionScheduleService,
  PersonService,
  RevisionService,
  RevisionEntityType,
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
  buildRevisionTimelineViewModel,
  buildDiscoveryResultsViewModel,
  buildSeriesRelationsViewModel,
  buildSubjectOverviewViewModel,
  buildCollectionIntelligenceViewModel,
  buildCollectionBacklogViewModel,
  buildCollectionScheduleViewModel,
} from '@bangumi-agent-kit/renderer';
import { discoveryQueryInput } from './discovery-tools.js';
import { getSubjectOverview } from '../subject-overview.js';

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
      // Keep the legacy weekday number schema. The new caps are additive fields.
      weekday: z
        .number()
        .optional()
        .describe('兼容旧参数：1=周一、2=周二、3=周三、4=周四、5=周五、6=周六、7=周日'),
      maxPerDay: z.number().int().min(1).max(8).optional().describe('每天最多展示条数，默认 3'),
      maxTotal: z.number().int().min(1).max(56).optional().describe('最多展示总条数，默认 21'),
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

  const renderRevisionTimeline = defineTool({
    name: 'bangumi.render_revision_timeline',
    description:
      '生成官方修订历史摘要图片卡片 Artifact。结果是有界样本，不宣称完整生命周期历史；支持 subject、episode、character、person。',
    input: z.object({
      entityType: z
        .enum(['subject', 'episode', 'character', 'person'])
        .describe('实体类型：subject 条目、episode 章节、character 角色、person 人物'),
      entityId: z.number().int().positive().describe('实体 ID'),
      limit: z.number().int().min(1).max(20).optional().describe('最多展示修订条数，默认 10'),
      offset: z.number().int().min(0).max(1_000_000).optional().describe('官方分页偏移量，默认 0'),
    }),
    auth: 'none',
    scopes: [],
    risk: 'read',
    execute: async (input, _context, deps) => {
      const publicClient = deps?.publicHttpClient;
      if (!publicClient) {
        throw new BangumiError('INTERNAL_ERROR', 'HttpClient unavailable', false);
      }
      const revisionService = new RevisionService(publicClient);
      const revisionResult = await revisionService.getRevisionIntelligence(
        input.entityType as RevisionEntityType,
        input.entityId,
        { limit: input.limit, offset: input.offset },
      );
      return await executeRenderAndSave(buildRevisionTimelineViewModel(revisionResult));
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

  const renderSeriesWatchOrder = defineTool({
    name: 'bangumi.render_series_watch_order',
    description:
      '生成系列关系与有界观看顺序建议图片卡片 Artifact。卡片显示起点、确定性步骤、原始关系标签、方向路径、媒介排除、覆盖、冲突和限制；maxNodes 先按关系证据确定有界候选，再对选中的条目补充详情日期并排序；日期不会回溯改变已选上限。非动画证据不会消耗动画节点上限。',
    input: z.object({
      subjectId: z.number().int().positive().describe('Bangumi 起始条目 ID'),
      depth: z.number().int().min(0).max(2).optional().describe('关系遍历深度，0-2；默认 1'),
      maxNodes: z
        .number()
        .int()
        .min(1)
        .max(16)
        .optional()
        .describe('动画推荐/遍历节点上限，1-16；根条目和非动画证据不消耗此上限；默认 8'),
      media: z
        .enum(['anime', 'all'])
        .optional()
        .describe(
          'anime 的 related 只展示动画证据，但边证据/排除统计仍可保留观察到的非动画关系；all 额外展示最多 8 条非动画证据',
        ),
    }),
    auth: 'none',
    scopes: [],
    risk: 'read',
    execute: async (input, _context, deps) => {
      const publicClient = deps?.executionSession?.client || deps?.publicHttpClient;
      if (!publicClient) {
        throw new BangumiError('INTERNAL_ERROR', 'HttpClient unavailable', false);
      }
      const seriesService = new SeriesService(publicClient);
      const result = await seriesService.getSeriesWatchOrder(input.subjectId, {
        depth: input.depth,
        maxNodes: input.maxNodes,
        media: input.media,
      });
      return await executeRenderAndSave(buildSeriesRelationsViewModel(result));
    },
  });

  const renderQuerySubjects = defineTool({
    name: 'bangumi.render_query_subjects',
    description:
      '生成高级 Bangumi 条目发现结果图片卡片。复用 bangumi.query_subjects 的受控筛选、覆盖、计划、证据和限制；卡片不是完整数据库枚举的承诺。',
    input: discoveryQueryInput,
    auth: 'none',
    scopes: [],
    risk: 'read',
    execute: async (input, _context, deps) => {
      if (!deps?.providerRegistry) {
        throw new BangumiError('INTERNAL_ERROR', 'ProviderRegistry unavailable', false);
      }
      const query = input.explain === undefined ? { ...input, explain: 'compact' as const } : input;
      const result = await new DiscoveryEngine(deps.providerRegistry).query(query, {
        authScope: 'public',
      });
      return await executeRenderAndSave(buildDiscoveryResultsViewModel(result, query));
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

  const renderSubjectOverview = defineTool({
    name: 'bangumi.render_subject_overview',
    description:
      '生成指定条目的证据型智能概览图片卡片 Artifact。卡片组合基本信息、官方统计、角色/声优、制作人员、关联条目以及各区段覆盖和限制；不宣称完整关系或历史趋势。',
    input: z.object({
      subjectId: z.number().int().positive().describe('Bangumi 条目 ID'),
      maxCast: z.number().int().min(1).max(20).optional().describe('角色/声优读取上限，默认 8'),
      maxStaff: z.number().int().min(1).max(80).optional().describe('制作人员读取上限，默认 24'),
      maxRelations: z
        .number()
        .int()
        .min(1)
        .max(32)
        .optional()
        .describe('关联条目读取上限，默认 12'),
    }),
    auth: 'none',
    scopes: [],
    risk: 'read',
    execute: async (input, _context, deps) => {
      const client = deps?.executionSession?.client || deps?.publicHttpClient;
      if (!client) {
        throw new BangumiError('INTERNAL_ERROR', 'HttpClient unavailable', false);
      }
      const result = await getSubjectOverview(
        input.subjectId,
        {
          maxCast: input.maxCast ?? 8,
          maxStaff: input.maxStaff ?? 24,
          maxRelations: input.maxRelations ?? 12,
        },
        { client, providerRegistry: deps?.providerRegistry },
      );
      return await executeRenderAndSave(buildSubjectOverviewViewModel(result));
    },
  });

  const renderCollectionIntelligence = defineTool({
    name: 'bangumi.render_collection_intelligence',
    description:
      '生成当前绑定 Bangumi 账号有界收藏智能概览图片卡片 Artifact。卡片显示状态/backlog、评分、进度、标签和观察样本中的最近更新，并明确 sourceTotal、覆盖、partial/unavailable、公式和限制；不接受任意用户名，不显示评论，不宣称历史趋势或推荐。',
    input: z
      .object({
        maxItems: z
          .number()
          .int()
          .min(1)
          .max(200)
          .optional()
          .describe('最多扫描当前账号收藏条目数，默认 100'),
      })
      .strict(),
    auth: 'required',
    scopes: ['read:collection'],
    risk: 'read',
    execute: async (input, context, deps) => {
      let client = deps?.executionSession?.client;
      let username = deps?.executionSession?.account?.username;
      if (!client || !username) {
        if (!deps?.clientProvider) {
          throw new BangumiError(
            'AUTH_REQUIRED',
            'Must bind a Bangumi account to render collection intelligence',
            false,
          );
        }
        const authed = await deps.clientProvider.requireAuthenticatedClient(context.principalId, [
          'read:collection',
        ]);
        client = authed.client;
        username = authed.account.username;
      }
      if (!client || !username) {
        throw new BangumiError(
          'AUTH_REQUIRED',
          'Must bind a Bangumi account to render collection intelligence',
          false,
        );
      }
      const result = await new CollectionIntelligenceService(client).getCollectionIntelligence(
        username,
        { maxItems: input.maxItems },
      );
      return await executeRenderAndSave(buildCollectionIntelligenceViewModel(result));
    },
  });

  const renderCollectionBacklog = defineTool({
    name: 'bangumi.render_collection_backlog',
    description:
      '生成当前绑定 Bangumi 账号有界动画收藏 backlog 图片卡片 Artifact。卡片显示源顺序条目、正篇 episode progress、episode sourceTotal 分母、已知剩余集数、结构化完结状态、来源冲突与无法计算原因；明确账号范围、覆盖、auth/permission、partial/unavailable/not_computable、公式和限制。不接受任意用户名、不显示评论、不执行写入。',
    input: z
      .object({
        maxItems: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe('最多扫描当前账号动画收藏条目数，默认 50'),
        maxSubjects: z
          .number()
          .int()
          .min(1)
          .max(30)
          .optional()
          .describe('最多读取 episode collection 的条目数，默认 20'),
        maxEpisodesPerSubject: z
          .number()
          .int()
          .min(1)
          .max(1000)
          .optional()
          .describe('每个条目最多读取的正篇进度行数，默认 200'),
        statuses: z
          .array(z.enum(['wish', 'doing', 'done', 'on_hold', 'dropped']))
          .min(1)
          .max(5)
          .optional()
          .describe('收藏状态过滤，默认 wish/doing/on_hold；顺序保留源顺序，不代表优先级'),
      })
      .strict(),
    auth: 'required',
    scopes: ['read:collection'],
    risk: 'read',
    execute: async (input, context, deps) => {
      let client = deps?.executionSession?.client;
      let username = deps?.executionSession?.account?.username;
      if (!client || !username) {
        if (!deps?.clientProvider) {
          throw new BangumiError(
            'AUTH_REQUIRED',
            'Must bind a Bangumi account to render collection backlog',
            false,
          );
        }
        const authed = await deps.clientProvider.requireAuthenticatedClient(context.principalId, [
          'read:collection',
        ]);
        client = authed.client;
        username = authed.account.username;
      }
      if (!client || !username) {
        throw new BangumiError(
          'AUTH_REQUIRED',
          'Must bind a Bangumi account to render collection backlog',
          false,
        );
      }
      const result = await new CollectionBacklogService(client).getCollectionBacklog(username, {
        maxItems: input.maxItems,
        maxSubjects: input.maxSubjects,
        maxEpisodesPerSubject: input.maxEpisodesPerSubject,
        statuses: input.statuses,
      });
      return await executeRenderAndSave(buildCollectionBacklogViewModel(result));
    },
  });

  const renderCollectionSchedule = defineTool({
    name: 'bangumi.render_collection_schedule',
    description:
      '生成当前绑定 Bangumi 账号有界本周播出计划图片卡片 Artifact。卡片将官方七日 legacy 日历与当前账号动画收藏按 subject ID 对齐，显示星期、日期、收藏状态、收藏接口报告的进度以及未匹配/partial/unavailable/auth 状态；不接受任意用户名、不显示评论、不执行写入，不把日期当作具体时刻。',
    input: z
      .object({
        maxCollectionItems: z
          .number()
          .int()
          .min(1)
          .max(200)
          .optional()
          .describe('最多扫描当前账号动画收藏条目数，默认 100'),
        maxRows: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe('匹配和未匹配条目最多返回行数，默认 56'),
        statuses: z
          .array(z.enum(['wish', 'doing', 'done', 'on_hold', 'dropped']))
          .min(1)
          .max(5)
          .optional()
          .describe('收藏状态过滤，默认 wish/doing/on_hold'),
      })
      .strict(),
    auth: 'required',
    scopes: ['read:collection'],
    risk: 'read',
    execute: async (input, context, deps) => {
      let client = deps?.executionSession?.client;
      let username = deps?.executionSession?.account?.username;
      if (!client || !username) {
        if (!deps?.clientProvider) {
          throw new BangumiError(
            'AUTH_REQUIRED',
            '必须先绑定 Bangumi 账号才能渲染收藏播出计划。',
            false,
            401,
            '调用 bangumi.auth_start',
          );
        }
        const authed = await deps.clientProvider.requireAuthenticatedClient(context.principalId, [
          'read:collection',
        ]);
        client = authed.client;
        username = authed.account.username;
      }
      if (!client || !username) {
        throw new BangumiError(
          'AUTH_REQUIRED',
          '必须先绑定 Bangumi 账号才能渲染收藏播出计划。',
          false,
          401,
          '调用 bangumi.auth_start',
        );
      }
      const result = await new CollectionScheduleService(
        client,
        deps?.publicHttpClient,
      ).getCollectionSchedule(username, {
        maxCollectionItems: input.maxCollectionItems,
        maxRows: input.maxRows,
        statuses: input.statuses,
      });
      return await executeRenderAndSave(buildCollectionScheduleViewModel(result));
    },
  });

  return [
    renderSubjectCard,
    renderCastCard,
    renderCollectionProgress,
    renderCalendar,
    renderSearch,
    renderQuerySubjects,
    renderSeriesWatchOrder,
    renderPersonProfile,
    renderRevisionTimeline,
    renderSubjectOverview,
    renderCollectionIntelligence,
    renderCollectionBacklog,
    renderCollectionSchedule,
  ] as const;
}
