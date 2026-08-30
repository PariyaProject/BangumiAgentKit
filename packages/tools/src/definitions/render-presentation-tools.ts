import { z } from 'zod';
import { defineTool } from '../define-tool.js';
import { BangumiError, HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { compareSubjectCohorts, DiscoveryEngine } from '@bangumi-agent-kit/discovery';
import {
  SubjectService,
  SeriesService,
  UserService,
  CharacterService,
  CharacterCreditIntegrityService,
  CHARACTER_CREDIT_INTEGRITY_DEFAULT_MAX_PERSONS,
  CHARACTER_CREDIT_INTEGRITY_DEFAULT_MAX_SUBJECTS,
  CHARACTER_CREDIT_INTEGRITY_MAX_PERSONS,
  CHARACTER_CREDIT_INTEGRITY_MAX_SUBJECTS,
  CalendarService,
  CollectionIntelligenceService,
  CollectionBacklogService,
  CollectionScheduleService,
  CollectionDashboardService,
  CollectionSeriesService,
  COLLECTION_SERIES_LIMITS,
  CollectionEntityConsistencyService,
  COLLECTION_ENTITY_CONSISTENCY_MAX_OUTPUT_ROWS,
  COLLECTION_ENTITY_CONSISTENCY_MAX_RELATIONS_PER_SUBJECT,
  COLLECTION_ENTITY_CONSISTENCY_MAX_SUBJECT_PAGES,
  COLLECTION_ENTITY_CONSISTENCY_MAX_SUBJECTS,
  PersonService,
  PersonActivityService,
  PersonCollaborationService,
  RevisionService,
  RevisionEntityType,
  EpisodeGuideService,
  EpisodeIntegrityService,
  SubjectIndexMembershipService,
  SUBJECT_INDEX_MEMBERSHIP_DEFAULT_MAX_PAGES,
  SUBJECT_INDEX_MEMBERSHIP_DEFAULT_MAX_ROWS,
  SUBJECT_INDEX_MEMBERSHIP_DEFAULT_PAGE_SIZE,
  SUBJECT_INDEX_MEMBERSHIP_DEFAULT_RESPONSE_BYTES,
  SUBJECT_INDEX_MEMBERSHIP_MAX_INDEX_ID,
  SUBJECT_INDEX_MEMBERSHIP_MAX_INDEX_IDS,
  SUBJECT_INDEX_MEMBERSHIP_MAX_PAGE_SIZE,
  SUBJECT_INDEX_MEMBERSHIP_MAX_PAGES,
  SUBJECT_INDEX_MEMBERSHIP_MAX_RESPONSE_BYTES,
  SUBJECT_INDEX_MEMBERSHIP_MAX_ROWS,
  SUBJECT_INDEX_MEMBERSHIP_MAX_SUBJECT_ID,
} from '@bangumi-agent-kit/bangumi-core';
import {
  RenderService,
  LocalArtifactStore,
  ArtifactStore,
  isPrincipalScopedArtifactStore,
  buildSubjectCardViewModel,
  buildCastCardViewModel,
  buildCharacterCreditIntegrityViewModel,
  buildCollectionProgressViewModel,
  buildCalendarIntelligenceViewModel,
  buildSearchListViewModel,
  buildPersonProfileViewModel,
  buildRevisionTimelineViewModel,
  buildSubjectLatestRevisionViewModel,
  buildDiscoveryResultsViewModel,
  buildSeriesRelationsViewModel,
  buildSubjectOverviewViewModel,
  buildSubjectComparisonViewModel,
  buildSubjectCohortComparisonViewModel,
  buildSubjectOverlapViewModel,
  buildSubjectStatsViewModel,
  buildSubjectIdentityViewModel,
  buildSubjectIndexMembershipViewModel,
  buildSubjectStatsHistoryViewModel,
  buildCollectionIntelligenceViewModel,
  buildCollectionBacklogViewModel,
  buildCollectionScheduleViewModel,
  buildCollectionDashboardViewModel,
  buildCollectionSeriesViewModel,
  buildCollectionEntityConsistencyViewModel,
  buildPersonActivityViewModel,
  buildPersonCollaborationViewModel,
  buildEpisodeGuideViewModel,
  buildEpisodeIntegrityViewModel,
} from '@bangumi-agent-kit/renderer';
import {
  discoveryQueryInput,
  subjectCohortAggregationInput,
  subjectCohortComparisonInput,
} from './discovery-tools.js';
import { getSubjectOverview } from '../subject-overview.js';
import { getSubjectComparison } from '../subject-comparison.js';
import { getSubjectOverlap } from '../subject-overlap.js';
import { getSubjectStatsIntelligence } from '../subject-stats-intelligence.js';
import { getSubjectIdentity } from '../subject-identity.js';
import {
  getSubjectStatsHistory,
  SUBJECT_STATS_HISTORY_SUBJECT_ID_MAX,
} from '../subject-stats-history.js';

let globalArtifactStore: ArtifactStore | null = null;
let globalRenderService: RenderService | null = null;

const PRIVATE_COLLECTION_RENDER_TEMPLATES = new Set([
  'collection-progress',
  'collection-intelligence',
  'collection-backlog',
  'collection-schedule',
  'collection-dashboard',
  'collection-series',
  'collection-entity-consistency',
]);

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

export function getPrivateArtifactPrincipal(
  template: unknown,
  privatePrincipalId?: string,
): string | undefined {
  const privatePrincipal =
    typeof privatePrincipalId === 'string' && privatePrincipalId.trim().length > 0
      ? privatePrincipalId
      : undefined;
  if (PRIVATE_COLLECTION_RENDER_TEMPLATES.has(String(template)) && !privatePrincipal) {
    throw new BangumiError(
      'AUTH_REQUIRED',
      '私有收藏卡片必须绑定明确的账号主体才能保存渲染 Artifact。',
      false,
      401,
      '使用当前账号上下文重试',
    );
  }
  return privatePrincipal;
}

export async function renderAndSaveArtifact(
  viewModel: any,
  renderService: Pick<RenderService, 'renderCard'>,
  artifactStore: ArtifactStore,
  privatePrincipalId?: string,
) {
  try {
    const privatePrincipal = getPrivateArtifactPrincipal(viewModel.template, privatePrincipalId);
    const renderResult = privatePrincipal
      ? await renderService.renderCard(viewModel, { cache: false })
      : await renderService.renderCard(viewModel);
    const artifactRef = privatePrincipal
      ? isPrincipalScopedArtifactStore(artifactStore)
        ? await artifactStore.saveArtifactForPrincipal(
            privatePrincipal,
            renderResult.buffer,
            'image/png',
            { width: renderResult.width, height: renderResult.height },
          )
        : (() => {
            throw new BangumiError(
              'RENDERER_UNAVAILABLE',
              '当前 ArtifactStore 未提供账号隔离的私有渲染存储。',
              false,
              503,
              '配置 PrincipalScopedArtifactStore',
            );
          })()
      : await artifactStore.saveArtifact(renderResult.buffer, 'image/png', {
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

export function createRenderPresentationTools(
  renderServiceOverride?: RenderService,
  artifactStoreOverride?: ArtifactStore,
) {
  const artifactStore = artifactStoreOverride || getArtifactStore();
  const renderService = renderServiceOverride || getRenderService();

  async function executeRenderAndSave(viewModel: any, privatePrincipalId?: string) {
    return renderAndSaveArtifact(viewModel, renderService, artifactStore, privatePrincipalId);
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

  const renderCharacterCreditIntegrity = defineTool({
    name: 'bangumi.render_character_credit_integrity',
    description:
      '生成一个已知 Bangumi 角色的官方 v0 作品/相关人物稳定 ID 完整性观察无图片卡片 Artifact。卡片展示 source operations、重复 ID、同名不同 ID 碰撞风险、字段冲突、partial/unavailable/not_found 状态与覆盖限制；不做名称合并、全局搜索、完整性推断或图片下载。',
    input: z
      .object({
        characterId: z.number().int().positive().describe('Bangumi 角色 ID'),
        maxSubjects: z
          .number()
          .int()
          .min(1)
          .max(CHARACTER_CREDIT_INTEGRITY_MAX_SUBJECTS)
          .optional()
          .describe(
            `最多返回出演作品稳定 ID，默认 ${CHARACTER_CREDIT_INTEGRITY_DEFAULT_MAX_SUBJECTS}`,
          ),
        maxPersons: z
          .number()
          .int()
          .min(1)
          .max(CHARACTER_CREDIT_INTEGRITY_MAX_PERSONS)
          .optional()
          .describe(
            `最多返回相关人物稳定 ID，默认 ${CHARACTER_CREDIT_INTEGRITY_DEFAULT_MAX_PERSONS}`,
          ),
      })
      .strict(),
    auth: 'none',
    scopes: [],
    risk: 'read',
    execute: async (input, _context, deps) => {
      const client = deps?.executionSession?.client || deps?.publicHttpClient;
      if (!client) {
        throw new BangumiError('INTERNAL_ERROR', 'HttpClient unavailable', false);
      }
      const result = await new CharacterCreditIntegrityService(client).getCharacterCreditIntegrity(
        input.characterId,
        { maxSubjects: input.maxSubjects, maxPersons: input.maxPersons },
      );
      return await executeRenderAndSave(buildCharacterCreditIntegrityViewModel(result));
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

      return await executeRenderAndSave(
        viewModel,
        _context.artifactPrincipalKey || _context.principalId,
      );
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

  const renderLatestSubjectRevision = defineTool({
    name: 'bangumi.render_latest_subject_revision',
    description:
      '生成指定条目的有界官方最新修订证据图片卡片 Artifact。只读取 official v0 limit=1、offset=0 的第一条修订及最多一条详情；卡片明确显示 summary/created_at/data 的源证据、覆盖和限制，不把 data 当作精确 before/after 差异。',
    input: z.object({
      subjectId: z.number().int().positive().describe('Bangumi 条目 ID'),
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
      const result = await revisionService.getLatestSubjectRevision(input.subjectId);
      return await executeRenderAndSave(buildSubjectLatestRevisionViewModel(result));
    },
  });

  const renderEpisodeGuide = defineTool({
    name: 'bangumi.render_episode_guide',
    description:
      '生成官方 v0 条目章节指南图片卡片 Artifact。卡片展示条目身份、章节类别、标题、播出日期、原始时长、讨论数、描述、观察/返回/总数、缺失字段、重复/截断、来源证据和 partial/unavailable/not_found 状态；不显示评论正文、不推断观看顺序或进度，渲染器不读取网络资产。',
    input: z
      .object({
        subjectId: z.number().int().positive().describe('Bangumi 条目 ID'),
        category: z
          .enum(['all', 'main', 'sp', 'op', 'ed', 'pv', 'mad', 'other'])
          .optional()
          .describe('章节类别，默认 all'),
        maxEpisodes: z
          .number()
          .int()
          .min(1)
          .max(200)
          .optional()
          .describe('最多读取章节数，默认 50'),
        includeDescriptions: z.boolean().optional().describe('是否保留章节描述，默认 true'),
      })
      .strict(),
    auth: 'none',
    scopes: [],
    risk: 'read',
    execute: async (input, _context, deps) => {
      const client = deps?.publicHttpClient;
      if (!client) {
        throw new BangumiError('INTERNAL_ERROR', 'HttpClient unavailable', false);
      }
      const result = await new EpisodeGuideService(client).getEpisodeGuide(input.subjectId, {
        category: input.category,
        maxEpisodes: input.maxEpisodes,
        includeDescriptions: input.includeDescriptions,
      });
      return await executeRenderAndSave(buildEpisodeGuideViewModel(result));
    },
  });

  const renderEpisodeIntegrity = defineTool({
    name: 'bangumi.render_episode_integrity',
    description:
      '生成官方 v0 章节完整性分析图片卡片 Artifact。卡片展示 eps/total_episodes 与观察/去重/正篇/特别篇/未知类别/已播/未来计数、合法 UTC as-of 日期、缺失/无效/逻辑日期冲突、覆盖状态、逐操作来源证据、公式和限制；省略明确日期时优先使用章节源成功获取时间，否则只标记评估日期；不读取网络图片资产，不推断观看进度、观看顺序、播出历史或社区信息。',
    input: z
      .object({
        subjectId: z.number().int().positive().describe('Bangumi 条目 ID'),
        category: z
          .enum(['all', 'main', 'sp', 'op', 'ed', 'pv', 'mad', 'other'])
          .optional()
          .describe('章节类别，默认 all；非 all 时总数比较会标记为不完整'),
        maxEpisodes: z
          .number()
          .int()
          .min(1)
          .max(200)
          .optional()
          .describe('最多读取章节数，默认 50'),
        includeDescriptions: z.boolean().optional().describe('是否保留章节描述，默认 false'),
        asOfDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/u)
          .optional()
          .describe('用于已播判断的明确 UTC 日历日期 YYYY-MM-DD'),
      })
      .strict(),
    auth: 'none',
    scopes: [],
    risk: 'read',
    execute: async (input, _context, deps) => {
      const client = deps?.publicHttpClient;
      if (!client) {
        throw new BangumiError('INTERNAL_ERROR', 'HttpClient unavailable', false);
      }
      const result = await new EpisodeIntegrityService(client).getEpisodeIntegrity(
        input.subjectId,
        {
          category: input.category,
          maxEpisodes: input.maxEpisodes,
          includeDescriptions: input.includeDescriptions,
          asOfDate: input.asOfDate,
        },
      );
      return await executeRenderAndSave(buildEpisodeIntegrityViewModel(result));
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

  const renderSubjectCohorts = defineTool({
    name: 'bangumi.render_subject_cohort_comparison',
    description:
      '生成一个或两个由现有 discovery 条件定义的 Bangumi 条目 cohort 观察图片卡片。卡片展示官方 v0 返回样本覆盖、平均评分、平均热度（收藏总数）、平均报告话数；两侧时才展示 B−A 差值，同时展示缺失/冲突、检索证据和有界限制。不生成推荐、质量、因果或历史趋势结论，渲染器不读取网络资产。',
    input: subjectCohortComparisonInput,
    auth: 'none',
    scopes: [],
    risk: 'read',
    execute: async (input, _context, deps) => {
      if (!deps?.providerRegistry) {
        throw new BangumiError('INTERNAL_ERROR', 'ProviderRegistry unavailable', false);
      }
      const result = await compareSubjectCohorts(
        input.cohorts,
        { maxSubjects: input.maxSubjects },
        deps.providerRegistry,
        { authScope: 'public' },
      );
      return await executeRenderAndSave(buildSubjectCohortComparisonViewModel(result));
    },
  });

  const renderSubjectCohortAggregation = defineTool({
    name: 'bangumi.render_subject_cohort_aggregation',
    description:
      '生成一个由现有 discovery 条件定义的 Bangumi 条目 cohort 聚合图片卡片。卡片展示官方 v0 返回样本覆盖、平均评分、平均热度（收藏总数）、平均报告话数、缺失/冲突、检索证据和有界限制；不生成推荐、质量、因果或历史趋势结论，渲染器不读取网络资产。',
    input: subjectCohortAggregationInput,
    auth: 'none',
    scopes: [],
    risk: 'read',
    execute: async (input, _context, deps) => {
      if (!deps?.providerRegistry) {
        throw new BangumiError('INTERNAL_ERROR', 'ProviderRegistry unavailable', false);
      }
      const result = await compareSubjectCohorts(
        [input.cohort],
        { maxSubjects: input.maxSubjects },
        deps.providerRegistry,
        { authScope: 'public' },
      );
      return await executeRenderAndSave(buildSubjectCohortComparisonViewModel(result));
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

  const renderPersonActivity = defineTool({
    name: 'bangumi.render_person_activity',
    description:
      '生成官方 v0 人物 activity 时间窗图片卡片 Artifact。卡片保持窗口、媒介/关系筛选、作品计数、月度分布、原始角色标签、缺日期/未知媒介/详情预算、确定性等距抽样、观察/选取/省略 ID 和来源限制可见；同时展示基于官方 subject.meta_tags 的明确原创、未观察到原创标签和来源未知分组，明确未观察到原创标签不等于改编。可选 comparePreviousWindow=true 展示最近与紧邻等长窗口的作品/角色差值和观察到的发布月份峰值，并保留每个窗口及指标的覆盖状态，不把不可用窗口当作零；不显示或推断历史快照、劳动时长或实际配音时间。',
    input: z
      .object({
        personId: z.number().int().positive().describe('Bangumi 人物 ID'),
        kind: z.enum(['voice', 'staff', 'all']).optional(),
        media: z.enum(['anime', 'tv', 'all']).optional(),
        windowMonths: z.union([z.literal(3), z.literal(6), z.literal(12)]).optional(),
        maxRelations: z.number().int().min(1).max(120).optional(),
        maxSubjectDetails: z.number().int().min(1).max(48).optional(),
        maxRows: z.number().int().min(1).max(60).optional(),
        comparePreviousWindow: z
          .boolean()
          .optional()
          .describe(
            '是否展示最近窗口与紧邻等长窗口的比较；会保留不可用/不可计算状态，不把它们当作零；默认 false，不使用历史快照',
          ),
      })
      .strict(),
    auth: 'none',
    scopes: [],
    risk: 'read',
    execute: async (input, _context, deps) => {
      if (!deps?.clientProvider) {
        throw new BangumiError('INTERNAL_ERROR', 'ClientProvider unavailable', false);
      }
      const client = await deps.clientProvider.getPublicClient();
      const result = await new PersonActivityService(client).getPersonActivity(input.personId, {
        kind: input.kind,
        media: input.media,
        windowMonths: input.windowMonths,
        maxRelations: input.maxRelations,
        maxSubjectDetails: input.maxSubjectDetails,
        maxRows: input.maxRows,
        comparePreviousWindow: input.comparePreviousWindow,
      });
      return await executeRenderAndSave(buildPersonActivityViewModel(result));
    },
  });

  const renderPersonCollaboration = defineTool({
    name: 'bangumi.render_person_collaboration',
    description:
      '生成官方 v0 人物合作关系图片卡片 Artifact。卡片展示按去重共同作品数排序的合作人物、共同作品、原始职位/角色标签、fan-out 覆盖、确定性边界、失败和声优合作方职位不可用限制；不把演员 career 推断为职位，不显示或推断完整行业网络、历史趋势、工作量或关系强度。',
    input: z
      .object({
        personId: z.number().int().positive().describe('Bangumi 人物 ID'),
        kind: z.enum(['voice', 'staff', 'all']).optional(),
        media: z.enum(['anime', 'all']).optional(),
        targetRole: z.string().trim().min(1).max(80).optional(),
        collaboratorRole: z.string().trim().min(1).max(80).optional(),
        maxRelations: z.number().int().min(1).max(120).optional(),
        maxSubjects: z.number().int().min(1).max(36).optional(),
        maxCollaborators: z.number().int().min(1).max(50).optional(),
        maxSharedSubjects: z.number().int().min(1).max(20).optional(),
      })
      .strict(),
    auth: 'none',
    scopes: [],
    risk: 'read',
    execute: async (input, _context, deps) => {
      if (!deps?.clientProvider) {
        throw new BangumiError('INTERNAL_ERROR', 'ClientProvider unavailable', false);
      }
      const client = await deps.clientProvider.getPublicClient();
      const result = await new PersonCollaborationService(client).getPersonCollaboration(
        input.personId,
        {
          kind: input.kind,
          media: input.media,
          targetRole: input.targetRole,
          collaboratorRole: input.collaboratorRole,
          maxRelations: input.maxRelations,
          maxSubjects: input.maxSubjects,
          maxCollaborators: input.maxCollaborators,
          maxSharedSubjects: input.maxSharedSubjects,
        },
      );
      return await executeRenderAndSave(buildPersonCollaborationViewModel(result));
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

  const renderSubjectComparison = defineTool({
    name: 'bangumi.render_subject_comparison',
    description:
      '生成两个已知 Bangumi 条目的证据型并列比较图片卡片 Artifact。卡片显示身份、日期、话数、官方评分/排名/评分人数/收藏总数、评分直方图样本/均值/总体标准差、收藏分布/观察完成率、共享声优/制作人员及其角色/原始职位标签、差值方向、各区段状态、公式/来源边界和未知值；差值、统计和共同人物不等于推荐、质量或胜负，渲染器不读取网络资产。',
    input: z
      .object({
        subjectIds: z
          .array(z.number().int().positive())
          .length(2)
          .refine((subjectIds) => subjectIds[0] !== subjectIds[1], {
            message: 'subjectIds 必须包含两个不同的条目 ID',
          })
          .describe('两个不同的 Bangumi 条目 ID，顺序决定差值方向'),
        maxCast: z
          .number()
          .int()
          .min(1)
          .max(20)
          .optional()
          .describe('每个条目的角色读取上限，默认 4'),
        maxStaff: z
          .number()
          .int()
          .min(1)
          .max(80)
          .optional()
          .describe('每个条目的职员读取上限，默认 12'),
        maxRelations: z
          .number()
          .int()
          .min(1)
          .max(32)
          .optional()
          .describe('每个条目的关联条目读取上限，默认 8'),
      })
      .strict(),
    auth: 'none',
    scopes: [],
    risk: 'read',
    execute: async (input, _context, deps) => {
      const client = deps?.executionSession?.client || deps?.publicHttpClient;
      if (!client) {
        throw new BangumiError('INTERNAL_ERROR', 'HttpClient unavailable', false);
      }
      const result = await getSubjectComparison(
        input.subjectIds,
        {
          maxCast: input.maxCast,
          maxStaff: input.maxStaff,
          maxRelations: input.maxRelations,
        },
        { client, providerRegistry: deps?.providerRegistry },
      );
      return await executeRenderAndSave(buildSubjectComparisonViewModel(result));
    },
  });

  const renderSubjectOverlap = defineTool({
    name: 'bangumi.render_subject_overlap',
    description:
      '生成调用方提供的 2–8 个已知 Bangumi 条目关系重合图片卡片 Artifact。卡片按官方 v0 有界角色声优/制作人员稳定人物 ID 交集排序条目对，展示主角/主役原始标签筛选、每侧关系证据、观察到的并集/交集与 Jaccard 比例、覆盖、来源、截断和限制；不发现全目录候选，不宣称完整演职员表、主要团队质量、历史连续合作或推荐结论，渲染器不读取网络资产。',
    input: z
      .object({
        subjectIds: z
          .array(z.number().int().positive())
          .min(2)
          .max(8)
          .refine((subjectIds) => new Set(subjectIds).size === subjectIds.length, {
            message: 'subjectIds 必须包含不同的条目 ID',
          })
          .describe('2–8 个不同的 Bangumi 条目 ID；输出按候选条目对排序'),
        kind: z.enum(['cast', 'staff', 'all']).optional(),
        castRole: z.enum(['all', 'main']).optional(),
        maxCast: z.number().int().min(1).max(80).optional(),
        maxStaff: z.number().int().min(1).max(80).optional(),
        maxPairs: z.number().int().min(1).max(28).optional(),
        maxPeople: z.number().int().min(1).max(24).optional(),
      })
      .strict(),
    auth: 'none',
    scopes: [],
    risk: 'read',
    execute: async (input, _context, deps) => {
      const client = deps?.executionSession?.client || deps?.publicHttpClient;
      if (!client) {
        throw new BangumiError('INTERNAL_ERROR', 'HttpClient unavailable', false);
      }
      const result = await getSubjectOverlap(
        input.subjectIds,
        {
          kind: input.kind,
          castRole: input.castRole,
          maxCast: input.maxCast,
          maxStaff: input.maxStaff,
          maxPairs: input.maxPairs,
          maxPeople: input.maxPeople,
        },
        { client },
      );
      return await executeRenderAndSave(buildSubjectOverlapViewModel(result));
    },
  });

  const renderSubjectStats = defineTool({
    name: 'bangumi.render_subject_stats_intelligence',
    description:
      '生成指定条目的证据型统计智能图片卡片 Artifact。卡片显示官方 v0 评分直方图、评分百分比/均值/总体标准差、收藏状态分布与完成率、公式版本、覆盖、冲突和不可计算原因；不读取图片资产，不计算历史趋势、社区统计、网站专有图表或推荐结论。',
    input: z.object({
      subjectId: z.number().int().positive().describe('Bangumi 条目 ID'),
    }),
    auth: 'none',
    scopes: [],
    risk: 'read',
    execute: async (input, _context, deps) => {
      const result = await getSubjectStatsIntelligence(input.subjectId, {
        providerRegistry: deps?.providerRegistry,
      });
      return await executeRenderAndSave(buildSubjectStatsViewModel(result));
    },
  });

  const renderSubjectIdentity = defineTool({
    name: 'bangumi.render_subject_identity',
    description:
      '生成指定条目的证据型身份与内容元数据图片卡片 Artifact。卡片展示官方名称、中文名、平台、媒介、书籍 series 标记、eps/totalEpisodes、有限标签、别名原始键与有界 infobox 覆盖；图片 URL 只显示为链接存在性，渲染器不读取网络图片资产，也不宣称 canonical identity、franchise 归属或完整历史。',
    input: z.object({
      subjectId: z.number().int().positive().describe('Bangumi 条目 ID'),
    }),
    auth: 'none',
    scopes: [],
    risk: 'read',
    execute: async (input, _context, deps) => {
      const result = await getSubjectIdentity(input.subjectId, {
        providerRegistry: deps?.providerRegistry,
      });
      return await executeRenderAndSave(buildSubjectIdentityViewModel(result));
    },
  });

  const renderSubjectIndexMembership = defineTool({
    name: 'bangumi.render_subject_index_membership',
    description:
      '生成已知条目在调用方提供目录中的有界归属观察图片卡片 Artifact。卡片只展示官方 v0 精确 subject ID 匹配、完整 supplied observed scope 内未匹配和 unknown 状态，以及分页/响应大小/失败 coverage；不发现所有推荐目录，不读取 HTML/Structured Web、评论或目录描述，不执行写入，卡片不下载图片资产。',
    input: z
      .object({
        subjectId: z
          .number()
          .int()
          .positive()
          .max(SUBJECT_INDEX_MEMBERSHIP_MAX_SUBJECT_ID)
          .describe(`Bangumi 条目 ID（最大 ${SUBJECT_INDEX_MEMBERSHIP_MAX_SUBJECT_ID}）`),
        indexIds: z
          .array(z.number().int().positive().max(SUBJECT_INDEX_MEMBERSHIP_MAX_INDEX_ID))
          .min(1)
          .max(SUBJECT_INDEX_MEMBERSHIP_MAX_INDEX_IDS)
          .refine((indexIds) => new Set(indexIds).size === indexIds.length, {
            message: 'indexIds 必须包含不同的目录 ID',
          })
          .meta({ uniqueItems: true })
          .describe(`1–${SUBJECT_INDEX_MEMBERSHIP_MAX_INDEX_IDS} 个不同的已知 Bangumi 目录 ID`),
        pageSize: z
          .number()
          .int()
          .min(1)
          .max(SUBJECT_INDEX_MEMBERSHIP_MAX_PAGE_SIZE)
          .optional()
          .describe(`每页最多读取条数，默认 ${SUBJECT_INDEX_MEMBERSHIP_DEFAULT_PAGE_SIZE}`),
        maxPages: z
          .number()
          .int()
          .min(1)
          .max(SUBJECT_INDEX_MEMBERSHIP_MAX_PAGES)
          .optional()
          .describe(`每个目录最多读取页数，默认 ${SUBJECT_INDEX_MEMBERSHIP_DEFAULT_MAX_PAGES}`),
        maxRows: z
          .number()
          .int()
          .min(1)
          .max(SUBJECT_INDEX_MEMBERSHIP_MAX_ROWS)
          .optional()
          .describe(`每个目录最多观察行数，默认 ${SUBJECT_INDEX_MEMBERSHIP_DEFAULT_MAX_ROWS}`),
        maxResponseBytes: z
          .number()
          .int()
          .min(65_536)
          .max(SUBJECT_INDEX_MEMBERSHIP_MAX_RESPONSE_BYTES)
          .optional()
          .describe('每个官方响应的最大 UTF-8 字节数'),
      })
      .strict(),
    auth: 'none',
    scopes: [],
    risk: 'read',
    execute: async (input, _context, deps) => {
      const client = deps?.publicHttpClient || new HttpClient();
      const result = await new SubjectIndexMembershipService(client).getSubjectIndexMembership(
        input.subjectId,
        input.indexIds,
        {
          pageSize: input.pageSize ?? SUBJECT_INDEX_MEMBERSHIP_DEFAULT_PAGE_SIZE,
          maxPages: input.maxPages ?? SUBJECT_INDEX_MEMBERSHIP_DEFAULT_MAX_PAGES,
          maxRows: input.maxRows ?? SUBJECT_INDEX_MEMBERSHIP_DEFAULT_MAX_ROWS,
          maxResponseBytes:
            input.maxResponseBytes ?? SUBJECT_INDEX_MEMBERSHIP_DEFAULT_RESPONSE_BYTES,
        },
      );
      return await executeRenderAndSave(buildSubjectIndexMembershipViewModel(result));
    },
  });

  const renderSubjectStatsHistory = defineTool({
    name: 'bangumi.render_subject_stats_history',
    description:
      '生成指定条目的本地官方 v0 统计观察历史图片卡片 Artifact。默认只读取既有观察，只有显式 recordCurrent=true 才追加当前只读快照；卡片显示观察时间、状态、有限保留、相邻差值、coverage、方法与限制，不宣称 Bangumi 事件历史、趋势、社区统计或推荐结论。',
    input: z
      .object({
        subjectId: z
          .number()
          .int()
          .positive()
          .max(SUBJECT_STATS_HISTORY_SUBJECT_ID_MAX)
          .describe(`Bangumi 条目 ID（最大 ${SUBJECT_STATS_HISTORY_SUBJECT_ID_MAX}）`),
        recordCurrent: z
          .boolean()
          .optional()
          .default(false)
          .describe('是否显式追加一次当前官方 v0 统计观察，默认 false'),
        maxObservations: z
          .number()
          .int()
          .min(1)
          .max(120)
          .optional()
          .default(24)
          .describe('最多保留并返回的观察点数，默认 24，最大 120'),
        retentionDays: z
          .number()
          .int()
          .min(1)
          .max(3650)
          .optional()
          .default(365)
          .describe('每个观察点的保留天数，默认 365，最大 3650'),
      })
      .strict(),
    auth: 'none',
    scopes: [],
    risk: 'read',
    execute: async (input, _context, deps) => {
      const result = await getSubjectStatsHistory(
        input.subjectId,
        {
          recordCurrent: input.recordCurrent,
          maxObservations: input.maxObservations,
          retentionDays: input.retentionDays,
        },
        { storage: deps?.storage, providerRegistry: deps?.providerRegistry },
      );
      return await executeRenderAndSave(buildSubjectStatsHistoryViewModel(result));
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
      return await executeRenderAndSave(
        buildCollectionIntelligenceViewModel(result),
        context.artifactPrincipalKey || context.principalId,
      );
    },
  });

  const renderCollectionBacklog = defineTool({
    name: 'bangumi.render_collection_backlog',
    description:
      '生成当前绑定 Bangumi 账号有界动画收藏 backlog 图片卡片 Artifact。卡片显示正篇 episode progress、episode sourceTotal 分母、已知剩余集数、已观察的未看/想看正篇预计分钟数、排序方式、结构化完结状态、官方七日 calendar schedule、evidence-completeness confidence、来源冲突与无法计算原因；未知时长置后并保留覆盖证据。confidence 不是概率或推荐，未观察不等于没有播出计划。明确账号范围、覆盖、auth/permission、partial/unavailable/not_computable、公式和限制。不接受任意用户名、不显示评论、不执行写入。',
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
        sortBy: z
          .enum(['source', 'estimated_minutes_asc', 'estimated_minutes_desc'])
          .optional()
          .describe('排序方式，默认 source；预计分钟数只覆盖已观察的未看/想看正篇，未知估算置后'),
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
      const result = await new CollectionBacklogService(
        client,
        deps?.publicHttpClient,
      ).getCollectionBacklog(username, {
        maxItems: input.maxItems,
        maxSubjects: input.maxSubjects,
        maxEpisodesPerSubject: input.maxEpisodesPerSubject,
        statuses: input.statuses,
        sortBy: input.sortBy,
        includeSchedule: true,
      });
      return await executeRenderAndSave(
        buildCollectionBacklogViewModel(result),
        context.artifactPrincipalKey || context.principalId,
      );
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
      return await executeRenderAndSave(
        buildCollectionScheduleViewModel(result),
        context.artifactPrincipalKey || context.principalId,
      );
    },
  });

  const renderCollectionDashboard = defineTool({
    name: 'bangumi.render_collection_dashboard',
    description:
      '生成当前绑定 Bangumi 账号的收藏 Dashboard 图片 Artifact：一张无图片资产的私有卡片，按同一有界组合结果展示收藏概览、backlog 和七日播出计划，并保留各区段 coverage、证据、partial/unavailable/auth/conflict 状态和有界限制；渲染器绕过共享缓存，Artifact 使用当前账号主体隔离；不接受任意用户名，不读取评论，不执行写入。',
    input: z
      .object({
        maxCollectionItems: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe('每个收藏区段最多扫描当前账号动画收藏条目数，默认 100'),
        maxSubjects: z
          .number()
          .int()
          .min(1)
          .max(30)
          .optional()
          .describe('backlog 最多读取条目数，默认 20'),
        maxEpisodesPerSubject: z
          .number()
          .int()
          .min(1)
          .max(1000)
          .optional()
          .describe('backlog 每个条目最多读取正篇进度行数，默认 200'),
        maxRows: z
          .number()
          .int()
          .min(1)
          .max(100)
          .optional()
          .describe('七日播出计划最多返回行数，默认 56'),
        maxDurationMs: z
          .number()
          .int()
          .min(1000)
          .max(120000)
          .optional()
          .describe('Dashboard 总读取时限（毫秒），默认 60000；超时区段保持 upstream_timeout'),
        statuses: z
          .array(z.enum(['wish', 'doing', 'done', 'on_hold', 'dropped']))
          .min(1)
          .max(5)
          .optional()
          .describe('backlog/七日播出计划共同的收藏状态过滤；不表示优先级'),
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
            '必须先绑定 Bangumi 账号才能渲染收藏 Dashboard。',
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
          '必须先绑定 Bangumi 账号才能渲染收藏 Dashboard。',
          false,
          401,
          '调用 bangumi.auth_start',
        );
      }
      const result = await new CollectionDashboardService(
        client,
        deps?.publicHttpClient,
      ).getCollectionDashboard(username, {
        maxCollectionItems: input.maxCollectionItems,
        maxSubjects: input.maxSubjects,
        maxEpisodesPerSubject: input.maxEpisodesPerSubject,
        maxRows: input.maxRows,
        maxDurationMs: input.maxDurationMs,
        statuses: input.statuses,
      });
      return await executeRenderAndSave(
        buildCollectionDashboardViewModel(result),
        context.artifactPrincipalKey || context.principalId,
      );
    },
  });

  const renderCollectionSeriesGroups = defineTool({
    name: 'bangumi.render_collection_series_groups',
    description:
      '生成当前绑定 Bangumi 账号收藏系列组的无图片资产私有卡片 Artifact。卡片展示基于官方 v0 直接动画关系的有界系列分组、原始关系标签、冲突、排除关系、coverage、partial/unavailable 状态和限制；不接受任意用户名、不显示评论、不执行写入，也不宣称 canonical watch order。',
    input: z
      .object({
        maxItems: z
          .number()
          .int()
          .min(1)
          .max(COLLECTION_SERIES_LIMITS.maxItems)
          .optional()
          .describe('最多扫描当前账号收藏条目数，默认 100'),
        maxRelationSubjects: z
          .number()
          .int()
          .min(1)
          .max(COLLECTION_SERIES_LIMITS.maxRelationSubjects)
          .optional()
          .describe('最多读取关系的动画收藏根条目数，默认 24'),
        maxRelationsPerSubject: z
          .number()
          .int()
          .min(1)
          .max(COLLECTION_SERIES_LIMITS.maxRelationsPerSubject)
          .optional()
          .describe('每个根条目最多保留的关系行数，默认 64'),
        maxGroups: z
          .number()
          .int()
          .min(1)
          .max(COLLECTION_SERIES_LIMITS.maxGroups)
          .optional()
          .describe('最多返回系列组数，默认 24'),
        maxEdges: z
          .number()
          .int()
          .min(1)
          .max(COLLECTION_SERIES_LIMITS.maxEdges)
          .optional()
          .describe('最多返回关系边数，默认 96'),
        statuses: z
          .array(z.enum(['wish', 'doing', 'done', 'on_hold', 'dropped']))
          .min(1)
          .max(5)
          .optional()
          .describe('收藏状态过滤；不表示优先级，默认包含全部五种已知状态'),
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
            '必须先绑定 Bangumi 账号才能渲染收藏系列组。',
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
          '必须先绑定 Bangumi 账号才能渲染收藏系列组。',
          false,
          401,
          '调用 bangumi.auth_start',
        );
      }
      const result = await new CollectionSeriesService(client).getCollectionSeriesGroups(username, {
        maxItems: input.maxItems,
        maxRelationSubjects: input.maxRelationSubjects,
        maxRelationsPerSubject: input.maxRelationsPerSubject,
        maxGroups: input.maxGroups,
        maxEdges: input.maxEdges,
        statuses: input.statuses,
      });
      return await executeRenderAndSave(
        buildCollectionSeriesViewModel(result),
        context.artifactPrincipalKey || context.principalId,
      );
    },
  });

  const renderCollectionEntityConsistency = defineTool({
    name: 'bangumi.render_collection_entity_consistency',
    description:
      '生成当前绑定 Bangumi 账号收藏角色/人物一致性观察的无图片资产私有卡片 Artifact。卡片展示官方 v0 稳定 ID 正向关联、selected-subject-roots 范围内未匹配项、character-actor 与直接人物关系的区别、分页/关系/输出 coverage、失败和限制；不接受任意用户名，不把未观察到解释为不存在，不读取评论，不执行写入，Artifact 使用当前账号主体隔离。',
    input: z
      .object({
        subjectType: z.enum(['book', 'anime', 'music', 'game', 'real']).optional(),
        status: z.enum(['wish', 'doing', 'done', 'on_hold', 'dropped']).optional(),
        maxSubjects: z
          .number()
          .int()
          .min(1)
          .max(COLLECTION_ENTITY_CONSISTENCY_MAX_SUBJECTS)
          .optional()
          .describe(`最多选取收藏作品根条目数，默认 ${COLLECTION_ENTITY_CONSISTENCY_MAX_SUBJECTS}`),
        maxSubjectPages: z
          .number()
          .int()
          .min(1)
          .max(COLLECTION_ENTITY_CONSISTENCY_MAX_SUBJECT_PAGES)
          .optional()
          .describe(
            `最多读取收藏作品页数，默认 ${COLLECTION_ENTITY_CONSISTENCY_MAX_SUBJECT_PAGES}`,
          ),
        maxRelationsPerSubject: z
          .number()
          .int()
          .min(1)
          .max(COLLECTION_ENTITY_CONSISTENCY_MAX_RELATIONS_PER_SUBJECT)
          .optional()
          .describe('每个作品最多保留角色关系和人物关系行数，默认 80'),
        maxOutputRows: z
          .number()
          .int()
          .min(1)
          .max(COLLECTION_ENTITY_CONSISTENCY_MAX_OUTPUT_ROWS)
          .optional()
          .describe(
            `正向关联和观察范围内未匹配项最多返回行数，默认 ${COLLECTION_ENTITY_CONSISTENCY_MAX_OUTPUT_ROWS}`,
          ),
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
            '必须先绑定 Bangumi 账号才能渲染收藏角色/人物一致性观察。',
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
          '必须先绑定 Bangumi 账号才能渲染收藏角色/人物一致性观察。',
          false,
          401,
          '调用 bangumi.auth_start',
        );
      }
      const result = await new CollectionEntityConsistencyService(
        client,
      ).getCollectionEntityConsistency(username, {
        subjectType: input.subjectType,
        status: input.status,
        maxSubjects: input.maxSubjects,
        maxSubjectPages: input.maxSubjectPages,
        maxRelationsPerSubject: input.maxRelationsPerSubject,
        maxOutputRows: input.maxOutputRows,
      });
      return await executeRenderAndSave(
        buildCollectionEntityConsistencyViewModel(result),
        context.artifactPrincipalKey || context.principalId,
      );
    },
  });

  return [
    renderSubjectCard,
    renderCastCard,
    renderCharacterCreditIntegrity,
    renderCollectionProgress,
    renderCalendar,
    renderSearch,
    renderQuerySubjects,
    renderSeriesWatchOrder,
    renderPersonProfile,
    renderRevisionTimeline,
    renderLatestSubjectRevision,
    renderEpisodeGuide,
    renderEpisodeIntegrity,
    renderSubjectOverview,
    renderSubjectComparison,
    renderSubjectCohorts,
    renderSubjectCohortAggregation,
    renderSubjectOverlap,
    renderSubjectStats,
    renderSubjectIdentity,
    renderSubjectStatsHistory,
    renderCollectionIntelligence,
    renderCollectionBacklog,
    renderCollectionSchedule,
    renderCollectionDashboard,
    renderCollectionSeriesGroups,
    renderPersonActivity,
    renderPersonCollaboration,
    renderCollectionEntityConsistency,
    renderSubjectIndexMembership,
  ] as const;
}
