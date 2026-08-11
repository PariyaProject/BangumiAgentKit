import { z } from 'zod';
import { defineTool, ResolvedToolPolicy } from '../define-tool.js';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { BangumiClientProvider } from '@bangumi-agent-kit/auth';
import {
  SubjectService,
  EpisodeService,
  CharacterService,
  PersonService,
  UserService,
  RevisionService,
  IndexReadService,
  CalendarService,
  resolveSubject,
  getSubjectCast,
  groupSubjectStaff,
  RevisionEntityType,
} from '@bangumi-agent-kit/bangumi-core';

export function createReadTools(clientProviderOrHttpClient?: BangumiClientProvider | HttpClient) {
  let publicHttpClient: HttpClient;
  let clientProvider: BangumiClientProvider | undefined;

  if (clientProviderOrHttpClient && 'requireAuthenticatedClient' in clientProviderOrHttpClient) {
    clientProvider = clientProviderOrHttpClient;
    publicHttpClient = new HttpClient();
  } else {
    publicHttpClient = (clientProviderOrHttpClient as HttpClient) || new HttpClient();
  }

  const episodeService = new EpisodeService(publicHttpClient);
  const characterService = new CharacterService(publicHttpClient);
  const personService = new PersonService(publicHttpClient);
  const userService = new UserService(publicHttpClient);
  const indexService = new IndexReadService(publicHttpClient);

  const subjectTypeMap: Record<string, number> = {
    book: 1,
    anime: 2,
    music: 3,
    game: 4,
    real: 6,
  };

  const searchSubjects = defineTool({
    name: 'bangumi.search_subjects',
    description:
      '搜索 Bangumi 条目（动画、书籍、音乐、游戏、三次元影视）。根据关键词返回精简候选列表。若已知条目 ID，请使用 bangumi.get_subject。',
    input: z.object({
      query: z.string().describe('搜索关键词 (支持中文、日文、英文或 ID)'),
      type: z
        .enum(['book', 'anime', 'music', 'game', 'real'])
        .optional()
        .describe('条目类别: book, anime, music, game, real'),
      sort: z
        .enum(['match', 'heat', 'rank', 'score'])
        .optional()
        .describe('排序依据: match(匹配度), heat(热度), rank(排名), score(评分)'),
      nsfw: z
        .enum(['exclude', 'include', 'only'])
        .optional()
        .describe('NSFW 过滤: exclude(默认排除), include(包含), only(仅看)'),
      limit: z.number().int().min(1).max(50).optional().describe('分页参数 limit'),
      offset: z.number().int().min(0).optional().describe('分页参数 offset'),
    }),
    auth: 'optional',
    scopes: [],
    risk: 'read',
    execute: async (input, context, deps) => {
      const activeClient = deps?.executionSession?.client || publicHttpClient;
      const activeService = new SubjectService(activeClient);
      const typeNum = input.type ? subjectTypeMap[input.type] : undefined;
      return await resolveSubject(activeService, input.query, {
        type: typeNum,
        sort: input.sort,
        nsfw: input.nsfw ?? 'exclude',
        limit: input.limit ?? 10,
        offset: input.offset ?? 0,
      });
    },
  });

  const getSubject = defineTool({
    name: 'bangumi.get_subject',
    description:
      '仅在已知 Bangumi 条目 ID 时使用。获取条目的详细信息（评分、排名、分类、看/读/听/玩统计等）。',
    input: z.object({
      subjectId: z.number().int().positive().describe('Bangumi 条目 ID (例如 226998)'),
    }),
    auth: 'none',
    scopes: [],
    risk: 'read',
    execute: async (input, context, deps) => {
      const activeClient = deps?.executionSession?.client || publicHttpClient;
      const activeService = new SubjectService(activeClient);
      return await activeService.getSubjectById(input.subjectId);
    },
  });

  const getSubjectStats = defineTool({
    name: 'bangumi.get_subject_stats',
    description: '获取条目的评分直方图、评分人数、排名和收藏分布，并保留字段级来源证据。',
    input: z.object({
      subjectId: z.number().int().positive().describe('Bangumi 条目 ID'),
    }),
    auth: 'none',
    scopes: [],
    risk: 'read',
    execute: async (input, _context, deps) => {
      if (!deps?.providerRegistry) {
        throw new Error('ProviderRegistry is required to run get_subject_stats tool');
      }
      return await deps.providerRegistry.getSubjectStats(input.subjectId, {
        authScope: deps.executionSession?.account ? 'account' : 'public',
      });
    },
  });

  const getSubjectRelations = defineTool({
    name: 'bangumi.get_subject_relations',
    description: '获取与指定 Bangumi 条目关联的其他作品（前传、续集、衍生作、原著书籍、游戏等）。',
    input: z.object({
      subjectId: z.number().int().positive().describe('Bangumi 条目 ID'),
    }),
    auth: 'none',
    scopes: [],
    risk: 'read',
    execute: async (input, context, deps) => {
      const activeClient = deps?.executionSession?.client || publicHttpClient;
      const activeService = new SubjectService(activeClient);
      return await activeService.getSubjectRelations(input.subjectId);
    },
  });

  const getSubjectCastTool = defineTool({
    name: 'bangumi.get_subject_cast',
    description:
      '获取作品中的角色关系，以及 Bangumi 返回的演员/声优人物列表。动画中 actors 通常对应声优，三次元作品中可能对应演员。',
    input: z.object({
      subjectId: z.number().int().positive().describe('Bangumi 条目 ID'),
      limit: z.number().int().min(1).max(100).optional().describe('显示条数上限'),
    }),
    auth: 'none',
    scopes: [],
    risk: 'read',
    execute: async (input, context, deps) => {
      const activeClient = deps?.executionSession?.client || publicHttpClient;
      const activeService = new CharacterService(activeClient);
      return await getSubjectCast(activeService, input.subjectId, {
        limit: input.limit ?? 30,
      });
    },
  });

  const getSubjectStaff = defineTool({
    name: 'bangumi.get_subject_staff',
    description:
      '获取作品的制作人员与角色声优关系，并明确分为 productionStaff 与 cast；制作人员按 Bangumi 返回的原始职位标签分组。适合回答“谁负责导演、脚本、音乐或配音”；不会猜测未提供的职位语义。',
    input: z.object({
      subjectId: z.number().int().positive().describe('Bangumi 条目 ID'),
      limit: z
        .number()
        .int()
        .min(1)
        .max(200)
        .optional()
        .describe('productionStaff 与 cast 各自的显示条数上限；默认 200'),
    }),
    auth: 'none',
    scopes: [],
    risk: 'read',
    execute: async (input, _context, deps) => {
      const activeClient = deps?.executionSession?.client || publicHttpClient;
      const activePersonService = new PersonService(activeClient);
      const activeCharacterService = new CharacterService(activeClient);
      const limit = input.limit ?? 200;
      const [collection, castResult] = await Promise.all([
        activePersonService.getSubjectStaff(input.subjectId, limit),
        getSubjectCast(activeCharacterService, input.subjectId, { limit }),
      ]);
      const retrievedAt = new Date().toISOString();
      const partial = collection.truncated || castResult.truncated;
      return {
        state: partial ? 'partial' : 'complete',
        subjectId: input.subjectId,
        productionStaff: collection.items,
        cast: castResult.cast,
        groups: groupSubjectStaff(collection.items),
        coverage: {
          state: partial ? 'partial' : 'complete',
          retrievedAt,
          productionStaff: {
            observed: collection.observed,
            returned: collection.returned,
            truncated: collection.truncated,
          },
          cast: {
            observed: castResult.observed,
            returned: castResult.returned,
            truncated: castResult.truncated,
          },
          limit,
        },
        evidence: [
          {
            source: 'official-v0',
            operation: 'GET /v0/subjects/{subject_id}/persons',
            retrievedAt,
          },
          {
            source: 'official-v0',
            operation: 'GET /v0/subjects/{subject_id}/characters',
            retrievedAt,
          },
          {
            source: 'derived-s7',
            formulaVersion: 'subject-staff-grouping-v1',
            description: '按原始 relation 标签分组；空标签归入未知。',
            retrievedAt,
          },
        ],
        warnings: partial
          ? [
              {
                code: 'OUTPUT_TRUNCATED',
                state: 'partial',
                message: '制作人员或角色声优关系达到显示上限。',
              },
            ]
          : [],
        capabilityStates: {
          productionStaff: collection.truncated ? 'partial' : 'complete',
          cast: castResult.truncated ? 'partial' : 'complete',
          recent_activity: 'not_computable',
          workload_trend: 'not_computable',
          historical_growth: 'not_computable',
        },
      };
    },
  });

  const getCalendar = defineTool({
    name: 'bangumi.get_calendar',
    description: '获取 Bangumi 每日放送（周一至周日）的新番动画计划与更新列表。',
    input: z.object({}),
    auth: 'none',
    scopes: [],
    risk: 'read',
    execute: async (_input, _context, deps) => {
      const activeService = new CalendarService(deps?.publicHttpClient || publicHttpClient);
      return await activeService.getCalendar();
    },
  });

  const getCalendarIntelligence = defineTool({
    name: 'bangumi.get_calendar_intelligence',
    description:
      '获取带播出日期、评分、类型、排名、来源证据与覆盖状态的有界 Bangumi 日历摘要。weekday 使用 1=周一至 7=周日；官方源不提供具体时区或播出时刻。适合回答“本周哪些作品什么时候播”；不把源顺序当作推荐，也不读取个人收藏状态。',
    input: z.object({
      weekday: z
        .number()
        .int()
        .min(1)
        .max(7)
        .optional()
        .describe('限定星期：1=周一、2=周二、3=周三、4=周四、5=周五、6=周六、7=周日；不传返回整周'),
      maxPerDay: z.number().int().min(1).max(8).optional().describe('每天最多返回条数，默认 3'),
      maxTotal: z.number().int().min(1).max(56).optional().describe('最多返回总条数，默认 21'),
    }),
    auth: 'none',
    scopes: [],
    risk: 'read',
    execute: async (input, _context, deps) => {
      const activeService = new CalendarService(deps?.publicHttpClient || publicHttpClient);
      return await activeService.getCalendarIntelligence(input);
    },
  });

  const categoryTypeMap: Record<string, number> = {
    main: 0,
    sp: 1,
    op: 2,
    ed: 3,
    pv: 4,
    mad: 5,
    other: 6,
  };

  const getEpisodes = defineTool({
    name: 'bangumi.get_episodes',
    description: '获取一个条目的章节列表，自动分类正篇 (main) 与 SP/OP/ED/PV/MAD/其他。',
    input: z.object({
      subjectId: z.number().int().positive().describe('Bangumi 条目 ID'),
      category: z
        .enum(['main', 'sp', 'op', 'ed', 'pv', 'mad', 'other'])
        .optional()
        .describe('章节分类: main(正篇), sp(SP), op(OP), ed(ED), pv(PV), mad(MAD), other(其他)'),
      limit: z.number().int().min(1).max(200).optional().describe('分页参数 limit'),
      offset: z.number().int().min(0).optional().describe('分页参数 offset'),
    }),
    auth: 'none',
    scopes: [],
    risk: 'read',
    execute: async (input) => {
      const typeNum = input.category
        ? (categoryTypeMap[input.category] as 0 | 1 | 2 | 3 | 4 | 5 | 6)
        : undefined;
      return await episodeService.getEpisodes(input.subjectId, {
        type: typeNum,
        limit: input.limit ?? 100,
        offset: input.offset ?? 0,
      });
    },
  });

  const getEpisode = defineTool({
    name: 'bangumi.get_episode',
    description: '获取单个章节的详细信息。',
    input: z.object({
      episodeId: z.number().int().positive().describe('Bangumi 章节 ID'),
    }),
    auth: 'none',
    scopes: [],
    risk: 'read',
    execute: async (input) => {
      return await episodeService.getEpisodeById(input.episodeId);
    },
  });

  const searchCharacters = defineTool({
    name: 'bangumi.search_characters',
    description: '搜索 Bangumi 虚拟角色。若已知角色 ID，请使用 bangumi.get_character。',
    input: z.object({
      query: z.string().describe('搜索关键词'),
      limit: z.number().int().min(1).max(50).optional().describe('分页参数 limit'),
      offset: z.number().int().min(0).optional().describe('分页参数 offset'),
    }),
    auth: 'none',
    scopes: [],
    risk: 'read',
    execute: async (input) => {
      return await characterService.searchCharacters(input.query, {
        limit: input.limit ?? 10,
        offset: input.offset ?? 0,
      });
    },
  });

  const getCharacter = defineTool({
    name: 'bangumi.get_character',
    description: '获取指定虚拟角色的详细信息（简介、相关条目、声优等）。',
    input: z.object({
      characterId: z.number().int().positive().describe('Bangumi 角色 ID'),
    }),
    auth: 'none',
    scopes: [],
    risk: 'read',
    execute: async (input) => {
      const detail = await characterService.getCharacterById(input.characterId);
      const subjects = await characterService.getCharacterRelatedSubjects(input.characterId);
      const persons = await characterService.getCharacterRelatedPersons(input.characterId);
      return {
        ...detail,
        relatedSubjects: subjects,
        relatedPersons: persons,
      };
    },
  });

  const searchPersons = defineTool({
    name: 'bangumi.search_persons',
    description: '搜索 Bangumi 现实人物/声优/制作人员/公司/团体。',
    input: z.object({
      query: z.string().describe('搜索关键词'),
      limit: z.number().int().min(1).max(50).optional().describe('分页参数 limit'),
      offset: z.number().int().min(0).optional().describe('分页参数 offset'),
    }),
    auth: 'none',
    scopes: [],
    risk: 'read',
    execute: async (input) => {
      return await personService.searchPersons(input.query, {
        limit: input.limit ?? 10,
        offset: input.offset ?? 0,
      });
    },
  });

  const getPerson = defineTool({
    name: 'bangumi.get_person',
    description: '获取现实人物/声优的详细信息及其参与的作品、饰演的角色。',
    input: z.object({
      personId: z.number().int().positive().describe('Bangumi 人物 ID'),
    }),
    auth: 'none',
    scopes: [],
    risk: 'read',
    execute: async (input) => {
      const detail = await personService.getPersonById(input.personId);
      const subjects = await personService.getPersonRelatedSubjects(input.personId);
      const characters = await personService.getPersonRelatedCharacters(input.personId);
      return {
        ...detail,
        relatedSubjects: subjects,
        relatedCharacters: characters,
      };
    },
  });

  const getPersonProfile = defineTool({
    name: 'bangumi.get_person_profile',
    description:
      '生成一个现实人物/声优/制作人员的结构化履历摘要：身份、媒介分布、原始职位/角色标签、去重作品/角色计数和受限关系明细。用于 Agent 一次回答“这个人参与过什么”；时间窗口、最近活动、工作量趋势和合作次数需要额外数据，本工具不会猜测。',
    input: z.object({
      personId: z.number().int().positive().describe('Bangumi 人物 ID'),
      includeCredits: z.boolean().optional().describe('是否返回受限的作品/角色关系明细；默认 true'),
      maxSubjects: z.number().int().min(1).max(500).optional().describe('作品关系最多返回条数'),
      maxCharacters: z.number().int().min(1).max(500).optional().describe('角色关系最多返回条数'),
    }),
    auth: 'none',
    scopes: [],
    risk: 'read',
    execute: async (input, _context, deps) => {
      const activeClient = deps?.executionSession?.client || publicHttpClient;
      const activePersonService = new PersonService(activeClient);
      const profile = await activePersonService.getPersonProfile(input.personId, {
        maxSubjects: input.maxSubjects ?? 500,
        maxCharacters: input.maxCharacters ?? 500,
      });
      const retrievedAt = new Date().toISOString();
      const identityMissingFields = [
        profile.person.gender ? undefined : 'person.gender',
        profile.person.birthYear === undefined ? 'person.birth_year' : undefined,
        profile.person.bloodType === undefined ? 'person.blood_type' : undefined,
      ].filter((field): field is string => field !== undefined);
      const relationPartial = profile.subjects.truncated || profile.characters.truncated;
      const partial = relationPartial || identityMissingFields.length > 0;
      const notComputable = [
        'recent_activity',
        'voice_actor_workload_window',
        'historical_growth',
        'collaboration_count',
      ];
      return {
        state: partial ? 'partial' : 'complete',
        person: profile.person,
        summary: profile.summary,
        credits:
          input.includeCredits === false
            ? undefined
            : {
                subjects: profile.subjects.items,
                characters: profile.characters.items,
              },
        coverage: {
          state: partial ? 'partial' : 'complete',
          retrievedAt,
          identity: {
            state: identityMissingFields.length > 0 ? 'partial' : 'complete',
            missingFields: identityMissingFields,
          },
          subjects: {
            observed: profile.subjects.observed,
            returned: profile.subjects.returned,
            truncated: profile.subjects.truncated,
          },
          characters: {
            observed: profile.characters.observed,
            returned: profile.characters.returned,
            truncated: profile.characters.truncated,
          },
          missingFields: [
            'person-related-subject.date',
            'person-related-subject.score',
            'person-related-character.airDate',
            ...identityMissingFields,
          ],
        },
        evidence: [
          { source: 'official-v0', operation: 'GET /v0/persons/{person_id}', retrievedAt },
          {
            source: 'official-v0',
            operation: 'GET /v0/persons/{person_id}/subjects',
            retrievedAt,
          },
          {
            source: 'official-v0',
            operation: 'GET /v0/persons/{person_id}/characters',
            retrievedAt,
          },
          {
            source: 'derived-s7',
            formulaVersion: 'person-activity-v1',
            description: '作品/角色按稳定 ID 去重；媒介和职位分布按官方关系行确定性计数。',
            retrievedAt,
          },
        ],
        limitations: [
          '人物关系接口不提供作品日期，不能从本结果计算最近作品或 3/6/12 个月工作量。',
          '本仓库没有兼容历史快照，不能计算增长、趋势或前后窗口比较。',
          '合作人数和共同作品需要额外的 subject→persons 图遍历，本工具不伪造该统计。',
        ],
        notComputable,
        warnings: [
          ...(identityMissingFields.length > 0
            ? [
                {
                  code: 'MISSING_IDENTITY_FIELDS',
                  state: 'partial',
                  fields: identityMissingFields,
                  message: '人物资料中的部分身份字段由官方源缺失。',
                },
              ]
            : []),
          {
            code: 'NOT_COMPUTABLE',
            state: 'not_computable',
            fields: notComputable,
            message: '当前官方关系源没有日期或历史快照，不能计算时间窗口、趋势或合作人数。',
          },
        ],
        capabilityStates: {
          profile: partial ? 'partial' : 'complete',
          recent_activity: 'not_computable',
          voice_actor_workload_window: 'not_computable',
          historical_growth: 'not_computable',
          collaboration_count: 'not_computable',
        },
      };
    },
  });

  const getUser = defineTool({
    name: 'bangumi.get_user',
    description: '获取 Bangumi 用户公开个人主页信息（昵称、签名、头像等）。',
    input: z.object({
      username: z.string().describe('Bangumi 用户名或 UID'),
    }),
    auth: 'none',
    scopes: [],
    risk: 'read',
    execute: async (input) => {
      return await userService.getUserByName(input.username);
    },
  });

  const getMyProfile = defineTool({
    name: 'bangumi.get_my_profile',
    description: '获取当前绑定的 Bangumi 账号个人信息。',
    input: z.object({}),
    auth: 'required',
    scopes: [],
    risk: 'read',
    execute: async (input, context, deps) => {
      const sessionClient = deps?.executionSession?.client;
      if (sessionClient) {
        return await new UserService(sessionClient).getMyself();
      }
      if (!clientProvider) {
        throw new Error('BangumiClientProvider is required to run get_my_profile tool');
      }
      const authed = await clientProvider.requireAuthenticatedClient(context.principalId, []);
      const service = new UserService(authed.client);
      return await service.getMyself();
    },
  });

  const listCollections = defineTool({
    name: 'bangumi.list_collections',
    description: '获取指定用户（或当前绑定账号）的收藏列表。',
    input: z.object({
      username: z.string().optional().describe('Bangumi 用户名。若不传，则查询当前绑定账号'),
      subjectType: z
        .enum(['book', 'anime', 'music', 'game', 'real'])
        .optional()
        .describe('条目类型过滤'),
      status: z
        .enum(['wish', 'doing', 'done', 'on_hold', 'dropped'])
        .optional()
        .describe(
          '收藏状态过滤: wish(想看/想读), doing(在看/在读), done(看过/读过), on_hold(搁置), dropped(抛弃)',
        ),
      limit: z.number().int().min(1).max(50).optional().describe('分页参数 limit'),
      offset: z.number().int().min(0).optional().describe('分页参数 offset'),
    }),
    auth: 'optional',
    scopes: [],
    risk: 'read',
    resolvePolicy: (input): ResolvedToolPolicy => {
      const isPublic = Boolean(input.username && input.username.trim());
      return {
        auth: isPublic ? 'none' : 'required',
        requiredCapabilities: [],
        risk: 'read',
      };
    },
    execute: async (input, context, deps) => {
      let targetUsername = input.username?.trim();
      let authedClient = deps?.executionSession?.client;
      const sessionUsername = deps?.executionSession?.account?.username;

      if (!targetUsername) {
        if (sessionUsername) {
          targetUsername = sessionUsername;
        } else {
          if (!authedClient && clientProvider) {
            const authed = await clientProvider.requireAuthenticatedClient(context.principalId, []);
            authedClient = authed.client;
          }
          if (!authedClient) {
            throw new Error(
              'AUTH_REQUIRED: Must provide username or bind a Bangumi account to list collections.',
            );
          }
          const authedService = new UserService(authedClient);
          const me = await authedService.getMyself();
          targetUsername = me.username;
        }
      }

      if (!targetUsername) {
        throw new Error(
          'AUTH_REQUIRED: Must provide username or bind a Bangumi account to list collections.',
        );
      }

      const activeService = authedClient ? new UserService(authedClient) : userService;
      return await activeService.getUserCollections(targetUsername, {
        subjectType: input.subjectType,
        type: input.status,
        limit: input.limit ?? 20,
        offset: input.offset ?? 0,
      });
    },
  });

  const getCollection = defineTool({
    name: 'bangumi.get_collection',
    description: '获取用户（或当前绑定账号）对某个特定条目的收藏状态。若未收藏返回 found: false。',
    input: z.object({
      subjectId: z.number().int().positive().describe('Bangumi 条目 ID'),
      username: z.string().optional().describe('Bangumi 用户名。若不传，则查询当前绑定账号'),
    }),
    auth: 'optional',
    scopes: [],
    risk: 'read',
    resolvePolicy: (input): ResolvedToolPolicy => {
      const isPublic = Boolean(input.username && input.username.trim());
      return {
        auth: isPublic ? 'none' : 'required',
        requiredCapabilities: [],
        risk: 'read',
      };
    },
    execute: async (input, context, deps) => {
      let targetUsername = input.username?.trim();
      let authedClient = deps?.executionSession?.client;
      const sessionUsername = deps?.executionSession?.account?.username;

      if (!targetUsername) {
        if (sessionUsername) {
          targetUsername = sessionUsername;
        } else {
          if (!authedClient && clientProvider) {
            const authed = await clientProvider.requireAuthenticatedClient(context.principalId, []);
            authedClient = authed.client;
          }
          if (!authedClient) {
            throw new Error(
              'AUTH_REQUIRED: Must provide username or bind a Bangumi account to get collection.',
            );
          }
          const authedService = new UserService(authedClient);
          const me = await authedService.getMyself();
          targetUsername = me.username;
        }
      }

      if (!targetUsername) {
        throw new Error(
          'AUTH_REQUIRED: Must provide username or bind a Bangumi account to get collection.',
        );
      }

      const activeService = authedClient ? new UserService(authedClient) : userService;
      return await activeService.getUserSubjectCollection(targetUsername, input.subjectId);
    },
  });

  const listRevisions = defineTool({
    name: 'bangumi.list_revisions',
    description: '获取指定实体（条目、章节、角色、人物）的原始编辑修订历史列表。',
    input: z.object({
      entityType: z.enum(['subject', 'episode', 'character', 'person']).describe('实体类型'),
      entityId: z.number().int().positive().describe('实体 ID'),
      limit: z.number().int().min(1).max(50).optional().describe('分页参数 limit'),
      offset: z.number().int().min(0).optional().describe('分页参数 offset'),
    }),
    auth: 'none',
    scopes: [],
    risk: 'read',
    execute: async (input, _context, deps) => {
      const activeService = new RevisionService(deps?.publicHttpClient || publicHttpClient);
      return await activeService.listRevisions(
        input.entityType as RevisionEntityType,
        input.entityId,
        {
          limit: input.limit ?? 10,
          offset: input.offset ?? 0,
        },
      );
    },
  });

  const getRevision = defineTool({
    name: 'bangumi.get_revision',
    description: '查看单条编辑修订记录的详细变更。',
    input: z.object({
      entityType: z.enum(['subject', 'episode', 'character', 'person']).describe('实体类型'),
      revisionId: z.number().int().positive().describe('修订 ID'),
    }),
    auth: 'none',
    scopes: [],
    risk: 'read',
    execute: async (input, _context, deps) => {
      const activeService = new RevisionService(deps?.publicHttpClient || publicHttpClient);
      return await activeService.getRevision(
        input.entityType as RevisionEntityType,
        input.revisionId,
      );
    },
  });

  const getRevisionIntelligence = defineTool({
    name: 'bangumi.get_revision_intelligence',
    description:
      '获取指定条目、章节、角色或人物的有界官方修订摘要。返回 observed/returned/total 覆盖、创建时间、修订摘要、来源证据与 partial/unavailable 状态；limit 最大 20。createdAt 是官方修订源时间，不是播出时间，也不证明连续采集或完整生命周期历史；本工具不计算历史增长趋势。需要原始分页请使用 bangumi.list_revisions，需要单条变更详情请使用 bangumi.get_revision。',
    input: z.object({
      entityType: z
        .enum(['subject', 'episode', 'character', 'person'])
        .describe('实体类型：subject 条目、episode 章节、character 角色、person 人物'),
      entityId: z.number().int().positive().describe('实体 ID'),
      limit: z.number().int().min(1).max(20).optional().describe('最多返回修订条数，默认 10'),
      offset: z
        .number()
        .int()
        .min(0)
        .max(1_000_000)
        .optional()
        .describe('官方分页偏移量，默认 0；不代表已读取全部历史'),
    }),
    auth: 'none',
    scopes: [],
    risk: 'read',
    execute: async (input, _context, deps) => {
      const activeService = new RevisionService(deps?.publicHttpClient || publicHttpClient);
      return await activeService.getRevisionIntelligence(
        input.entityType as RevisionEntityType,
        input.entityId,
        { limit: input.limit, offset: input.offset },
      );
    },
  });

  const getIndex = defineTool({
    name: 'bangumi.get_index',
    description: '获取 Bangumi 目录（列表/榜单）详情及其包含的条目列表。',
    input: z.object({
      indexId: z.number().int().positive().describe('Bangumi 目录 ID'),
      subjectLimit: z.number().int().min(1).max(50).optional().describe('条目数量上限'),
      subjectOffset: z.number().int().min(0).optional().describe('条目偏移量'),
    }),
    auth: 'none',
    scopes: [],
    risk: 'read',
    execute: async (input) => {
      const detail = await indexService.getIndexById(input.indexId);
      const subjectsRes = await indexService.getIndexSubjects(input.indexId, {
        limit: input.subjectLimit ?? 20,
        offset: input.subjectOffset ?? 0,
      });
      return {
        index: detail,
        subjects: subjectsRes.items,
        pagination: {
          total: subjectsRes.total,
          limit: subjectsRes.limit,
          offset: subjectsRes.offset,
        },
      };
    },
  });

  return [
    searchSubjects,
    getSubject,
    getSubjectRelations,
    getSubjectCastTool,
    getSubjectStaff,
    getCalendar,
    getEpisodes,
    getEpisode,
    searchCharacters,
    getCharacter,
    searchPersons,
    getPerson,
    getPersonProfile,
    getUser,
    getMyProfile,
    listCollections,
    getCollection,
    listRevisions,
    getRevision,
    getIndex,
    getSubjectStats,
    getCalendarIntelligence,
    getRevisionIntelligence,
  ] as const;
}
