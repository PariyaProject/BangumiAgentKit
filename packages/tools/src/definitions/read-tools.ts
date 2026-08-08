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

  const subjectService = new SubjectService(publicHttpClient);
  const episodeService = new EpisodeService(publicHttpClient);
  const characterService = new CharacterService(publicHttpClient);
  const personService = new PersonService(publicHttpClient);
  const userService = new UserService(publicHttpClient);
  const revisionService = new RevisionService(publicHttpClient);
  const indexService = new IndexReadService(publicHttpClient);
  const calendarService = new CalendarService(publicHttpClient);

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
        .default('exclude')
        .describe('NSFW 过滤: exclude(默认排除), include(包含), only(仅看)'),
      limit: z.number().int().min(1).max(50).optional().default(10),
      offset: z.number().int().min(0).optional().default(0),
    }),
    auth: 'none',
    scopes: [],
    risk: 'read',
    execute: async (input) => {
      const typeNum = input.type ? subjectTypeMap[input.type] : undefined;
      return await resolveSubject(subjectService, input.query, {
        type: typeNum,
        sort: input.sort,
        nsfw: input.nsfw,
        limit: input.limit,
        offset: input.offset,
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
    execute: async (input) => {
      return await subjectService.getSubjectById(input.subjectId);
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
    execute: async (input) => {
      return await subjectService.getSubjectRelations(input.subjectId);
    },
  });

  const getSubjectCastTool = defineTool({
    name: 'bangumi.get_subject_cast',
    description: '获取指定动画/作品的主要角色以及对应的声优 (CV) 人物列表。',
    input: z.object({
      subjectId: z.number().int().positive().describe('Bangumi 条目 ID'),
      limit: z.number().int().min(1).max(100).optional().default(30),
    }),
    auth: 'none',
    scopes: [],
    risk: 'read',
    execute: async (input) => {
      return await getSubjectCast(characterService, input.subjectId, { limit: input.limit });
    },
  });

  const getCalendar = defineTool({
    name: 'bangumi.get_calendar',
    description: '获取 Bangumi 每日放送（周一至周日）的新番动画计划与更新列表。',
    input: z.object({}),
    auth: 'none',
    scopes: [],
    risk: 'read',
    execute: async () => {
      return await calendarService.getCalendar();
    },
  });

  const getEpisodes = defineTool({
    name: 'bangumi.get_episodes',
    description: '获取一个条目的章节列表，自动分类正篇 (main) 与 SP/OP/ED。',
    input: z.object({
      subjectId: z.number().int().positive().describe('Bangumi 条目 ID'),
      type: z.number().int().optional().describe('0=正篇, 1=SP, 2=OP, 3=ED'),
      limit: z.number().int().min(1).max(200).optional().default(100),
      offset: z.number().int().min(0).optional().default(0),
    }),
    auth: 'none',
    scopes: [],
    risk: 'read',
    execute: async (input) => {
      return await episodeService.getEpisodes(input.subjectId, {
        type: input.type,
        limit: input.limit,
        offset: input.offset,
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
    description:
      '按角色名称搜索虚拟角色。返回精简候选列表。若已知角色 ID，请使用 bangumi.get_character。',
    input: z.object({
      query: z.string().describe('角色名称关键词 (如 "後藤ひとり")'),
      limit: z.number().int().min(1).max(50).optional().default(10),
      offset: z.number().int().min(0).optional().default(0),
    }),
    auth: 'none',
    scopes: [],
    risk: 'read',
    execute: async (input) => {
      return await characterService.searchCharacters(input.query, {
        limit: input.limit,
        offset: input.offset,
      });
    },
  });

  const getCharacter = defineTool({
    name: 'bangumi.get_character',
    description: '仅在已获得 Bangumi 角色 ID 时使用。获取单个角色的详细资料及其参演作品和声优。',
    input: z.object({
      characterId: z.number().int().positive().describe('角色 ID'),
    }),
    auth: 'none',
    scopes: [],
    risk: 'read',
    execute: async (input) => {
      const detail = await characterService.getCharacterById(input.characterId);
      const subjects = await characterService.getCharacterRelatedSubjects(input.characterId, 20);
      const persons = await characterService.getCharacterRelatedPersons(input.characterId, 20);
      return {
        character: detail,
        relatedSubjects: subjects,
        relatedPersons: persons,
      };
    },
  });

  const searchPersons = defineTool({
    name: 'bangumi.search_persons',
    description:
      '按人物姓名/声优/制作人员名称搜索现实人物。返回精简候选列表。若已知人物 ID，请使用 bangumi.get_person。',
    input: z.object({
      query: z.string().describe('人物/声优名称关键词 (如 "青山吉能")'),
      limit: z.number().int().min(1).max(50).optional().default(10),
      offset: z.number().int().min(0).optional().default(0),
    }),
    auth: 'none',
    scopes: [],
    risk: 'read',
    execute: async (input) => {
      return await personService.searchPersons(input.query, {
        limit: input.limit,
        offset: input.offset,
      });
    },
  });

  const getPerson = defineTool({
    name: 'bangumi.get_person',
    description:
      '仅在已获得 Bangumi 人物 ID 时使用。获取现实人物（声优/监督/画师等）的详细资料及参与的作品/角色列表。',
    input: z.object({
      personId: z.number().int().positive().describe('人物 ID'),
    }),
    auth: 'none',
    scopes: [],
    risk: 'read',
    execute: async (input) => {
      const person = await personService.getPersonById(input.personId);
      const subjects = await personService.getPersonRelatedSubjects(input.personId, 20);
      const characters = await personService.getPersonRelatedCharacters(input.personId, 20);
      return {
        person,
        relatedSubjects: subjects,
        relatedCharacters: characters,
      };
    },
  });

  const getUser = defineTool({
    name: 'bangumi.get_user',
    description:
      '获取某个 Bangumi 用户的公开主页基本资料。读取用户收藏列表请使用 bangumi.list_collections。',
    input: z.object({
      username: z.string().describe('Bangumi 用户名或用户 ID'),
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
    description: '获取当前绑定 Bangumi 账号的主页个人资料。',
    input: z.object({}),
    auth: 'required',
    scopes: [],
    risk: 'read',
    execute: async (_input, context, deps) => {
      let authedClient = (deps as any)?.executionSession?.client;
      if (!authedClient && clientProvider) {
        const authed = await clientProvider.requireAuthenticatedClient(context.principalId, []);
        authedClient = authed.client;
      }
      if (!authedClient) {
        throw new Error('AUTH_REQUIRED: Authentication is required to access personal profile.');
      }
      const uService = new UserService(authedClient);
      return await uService.getMyself();
    },
  });

  const listCollections = defineTool({
    name: 'bangumi.list_collections',
    description:
      '获取用户（或当前绑定账号）的条目收藏列表（想看/在看/看过/搁置/抛弃），包含语义状态标签与进度。',
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
      limit: z.number().int().min(1).max(50).optional().default(20),
      offset: z.number().int().min(0).optional().default(0),
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
      let activeService = userService;

      if (!targetUsername) {
        let authedClient = (deps as any)?.executionSession?.client;
        if (!authedClient && clientProvider) {
          const authed = await clientProvider.requireAuthenticatedClient(context.principalId, []);
          authedClient = authed.client;
        }
        if (!authedClient) {
          throw new Error(
            'AUTH_REQUIRED: Must provide username or bind a Bangumi account to list collections.',
          );
        }
        activeService = new UserService(authedClient);
        const me = await activeService.getMyself();
        targetUsername = me.username;
      }

      return await activeService.getUserCollections(targetUsername, {
        subjectType: input.subjectType,
        type: input.status,
        limit: input.limit,
        offset: input.offset,
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
      let activeService = userService;

      if (!targetUsername) {
        let authedClient = (deps as any)?.executionSession?.client;
        if (!authedClient && clientProvider) {
          const authed = await clientProvider.requireAuthenticatedClient(context.principalId, []);
          authedClient = authed.client;
        }
        if (!authedClient) {
          throw new Error(
            'AUTH_REQUIRED: Must provide username or bind a Bangumi account to get collection.',
          );
        }
        activeService = new UserService(authedClient);
        const me = await activeService.getMyself();
        targetUsername = me.username;
      }

      return await activeService.getUserSubjectCollection(targetUsername, input.subjectId);
    },
  });

  const listRevisions = defineTool({
    name: 'bangumi.list_revisions',
    description: '获取指定实体（条目、章节、角色、人物）的编辑修订历史列表。',
    input: z.object({
      entityType: z.enum(['subject', 'episode', 'character', 'person']).describe('实体类型'),
      entityId: z.number().int().positive().describe('实体 ID'),
      limit: z.number().int().min(1).max(50).optional().default(10),
      offset: z.number().int().min(0).optional().default(0),
    }),
    auth: 'none',
    scopes: [],
    risk: 'read',
    execute: async (input) => {
      return await revisionService.listRevisions(
        input.entityType as RevisionEntityType,
        input.entityId,
        {
          limit: input.limit,
          offset: input.offset,
        },
      );
    },
  });

  const getRevision = defineTool({
    name: 'bangumi.get_revision',
    description: '查看单条编辑修订记录的详细变更。',
    input: z.object({
      entityType: z
        .enum(['subject', 'episode', 'character', 'person'])
        .optional()
        .default('subject')
        .describe('实体类型'),
      revisionId: z.number().int().positive().optional().describe('修订 ID'),
      subjectId: z
        .number()
        .int()
        .positive()
        .optional()
        .describe('(Deprecated) 旧接口兼容: 条目 ID'),
    }),
    auth: 'none',
    scopes: [],
    risk: 'read',
    execute: async (input) => {
      if (input.revisionId) {
        return await revisionService.getRevision(
          input.entityType as RevisionEntityType,
          input.revisionId,
        );
      }
      if (input.subjectId) {
        return await revisionService.getSubjectRevisions(input.subjectId);
      }
      throw new Error('MISSING_PARAMETER: Either revisionId or subjectId must be provided.');
    },
  });

  const getIndex = defineTool({
    name: 'bangumi.get_index',
    description: '获取 Bangumi 目录（列表/榜单）详情及其包含的条目列表。',
    input: z.object({
      indexId: z.number().int().positive().describe('Bangumi 目录 ID'),
      subjectLimit: z.number().int().min(1).max(50).optional().default(20),
      subjectOffset: z.number().int().min(0).optional().default(0),
    }),
    auth: 'none',
    scopes: [],
    risk: 'read',
    execute: async (input) => {
      const detail = await indexService.getIndexById(input.indexId);
      const subjectsRes = await indexService.getIndexSubjects(input.indexId, {
        limit: input.subjectLimit,
        offset: input.subjectOffset,
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
    getCalendar,
    getEpisodes,
    getEpisode,
    searchCharacters,
    getCharacter,
    searchPersons,
    getPerson,
    getUser,
    getMyProfile,
    listCollections,
    getCollection,
    listRevisions,
    getRevision,
    getIndex,
  ];
}
