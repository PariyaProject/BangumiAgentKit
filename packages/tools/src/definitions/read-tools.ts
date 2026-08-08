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
        .describe('NSFW 过滤: exclude(默认排除), include(包含), only(仅看)'),
      limit: z.number().int().min(1).max(50).optional().describe('分页参数 limit'),
      offset: z.number().int().min(0).optional().describe('分页参数 offset'),
    }),
    auth: 'optional',
    scopes: [],
    risk: 'read',
    execute: async (input, context, deps) => {
      const activeClient = (deps as any)?.executionSession?.client || publicHttpClient;
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
      const activeClient = (deps as any)?.executionSession?.client || publicHttpClient;
      const activeService = new SubjectService(activeClient);
      return await activeService.getSubjectById(input.subjectId);
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
      const activeClient = (deps as any)?.executionSession?.client || publicHttpClient;
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
      const activeClient = (deps as any)?.executionSession?.client || publicHttpClient;
      const activeService = new CharacterService(activeClient);
      return await getSubjectCast(activeService, input.subjectId, {
        limit: input.limit ?? 30,
      });
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
      const sessionClient = (deps as any)?.executionSession?.client;
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
      let authedClient = (deps as any)?.executionSession?.client;
      const sessionUsername = (deps as any)?.executionSession?.account?.username;

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
      let authedClient = (deps as any)?.executionSession?.client;
      const sessionUsername = (deps as any)?.executionSession?.account?.username;

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
    description: '获取指定实体（条目、章节、角色、人物）的编辑修订历史列表。',
    input: z.object({
      entityType: z.enum(['subject', 'episode', 'character', 'person']).describe('实体类型'),
      entityId: z.number().int().positive().describe('实体 ID'),
      limit: z.number().int().min(1).max(50).optional().describe('分页参数 limit'),
      offset: z.number().int().min(0).optional().describe('分页参数 offset'),
    }),
    auth: 'none',
    scopes: [],
    risk: 'read',
    execute: async (input) => {
      return await revisionService.listRevisions(
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
    execute: async (input) => {
      return await revisionService.getRevision(
        input.entityType as RevisionEntityType,
        input.revisionId,
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
