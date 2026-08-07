import { z } from 'zod';
import { defineTool } from '../define-tool.js';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
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
} from '@bangumi-agent-kit/bangumi-core';

export function createReadTools(httpClient: HttpClient) {
  const subjectService = new SubjectService(httpClient);
  const episodeService = new EpisodeService(httpClient);
  const characterService = new CharacterService(httpClient);
  const personService = new PersonService(httpClient);
  const userService = new UserService(httpClient);
  const revisionService = new RevisionService(httpClient);
  const indexService = new IndexReadService(httpClient);
  const calendarService = new CalendarService(httpClient);

  const searchSubjects = defineTool({
    name: 'bangumi.search_subjects',
    description: '搜索 Bangumi 条目（动画、书籍、音乐、游戏、三次元影视）。根据关键词返回候选列表。',
    input: z.object({
      query: z.string().describe('搜索关键词'),
      type: z.number().int().optional().describe('条目类型: 1=book, 2=anime, 3=music, 4=game, 6=real'),
      limit: z.number().int().min(1).max(50).optional().default(10),
      offset: z.number().int().min(0).optional().default(0),
    }),
    auth: 'none',
    scopes: [],
    risk: 'read',
    execute: async (input) => {
      const resolved = await resolveSubject(subjectService, input.query, input.type);
      if (resolved.status === 'exact' && resolved.exact) {
        return {
          status: 'exact',
          subject: resolved.exact,
        };
      }
      const rawRes = await subjectService.searchSubjects(input.query, {
        limit: input.limit,
        offset: input.offset,
        type: input.type,
      });
      return {
        status: rawRes.items.length === 1 ? 'exact' : 'disambiguation',
        total: rawRes.total,
        candidates: rawRes.items,
      };
    },
  });

  const getSubject = defineTool({
    name: 'bangumi.get_subject',
    description: '通过 Bangumi 条目 ID 获取条目的详细信息（评分、排名、分类、看过/在看/想看统计等）。',
    input: z.object({
      subjectId: z.number().int().positive().describe('Bangumi 条目 ID (例如 226998)'),
    }),
    auth: 'optional',
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
    }),
    auth: 'none',
    scopes: [],
    risk: 'read',
    execute: async (input) => {
      return await getSubjectCast(characterService, input.subjectId);
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
    description: '搜索 Bangumi 虚拟角色。',
    input: z.object({
      characterId: z.number().int().positive().describe('角色 ID'),
    }),
    auth: 'none',
    scopes: [],
    risk: 'read',
    execute: async (input) => {
      return await characterService.getCharacterById(input.characterId);
    },
  });

  const getCharacter = defineTool({
    name: 'bangumi.get_character',
    description: '获取单个角色的详细资料及其参演作品和声优。',
    input: z.object({
      characterId: z.number().int().positive().describe('角色 ID'),
    }),
    auth: 'none',
    scopes: [],
    risk: 'read',
    execute: async (input) => {
      const detail = await characterService.getCharacterById(input.characterId);
      const subjects = await characterService.getCharacterRelatedSubjects(input.characterId);
      const persons = await characterService.getCharacterRelatedPersons(input.characterId);
      return {
        character: detail,
        subjects,
        actors: persons,
      };
    },
  });

  const searchPersons = defineTool({
    name: 'bangumi.search_persons',
    description: '获取现实人物/声优/制作人员详情。',
    input: z.object({
      personId: z.number().int().positive().describe('人物 ID'),
    }),
    auth: 'none',
    scopes: [],
    risk: 'read',
    execute: async (input) => {
      return await personService.getPersonById(input.personId);
    },
  });

  const getPerson = defineTool({
    name: 'bangumi.get_person',
    description: '获取现实人物（声优/监督/画师等）的详细资料及参与的作品列表。',
    input: z.object({
      personId: z.number().int().positive().describe('人物 ID'),
    }),
    auth: 'none',
    scopes: [],
    risk: 'read',
    execute: async (input) => {
      const person = await personService.getPersonById(input.personId);
      const subjects = await personService.getPersonRelatedSubjects(input.personId);
      return {
        person,
        subjects,
      };
    },
  });

  const getUser = defineTool({
    name: 'bangumi.get_user',
    description: '获取某个 Bangumi 用户的公开主页资料与其公开收藏状态。',
    input: z.object({
      username: z.string().describe('Bangumi 用户名或用户 ID'),
    }),
    auth: 'none',
    scopes: [],
    risk: 'read',
    execute: async (input) => {
      const user = await userService.getUserByName(input.username);
      const collections = await userService.getUserCollections(input.username, { limit: 10 });
      return {
        user,
        recentCollections: collections.items,
      };
    },
  });

  const getRevision = defineTool({
    name: 'bangumi.get_revision',
    description: '查看指定条目的编辑修订历史记录。',
    input: z.object({
      subjectId: z.number().int().positive().describe('Bangumi 条目 ID'),
    }),
    auth: 'none',
    scopes: [],
    risk: 'read',
    execute: async (input) => {
      return await revisionService.getSubjectRevisions(input.subjectId);
    },
  });

  const getIndex = defineTool({
    name: 'bangumi.get_index',
    description: '获取 Bangumi 目录（列表/榜单）详情及其包含的条目。',
    input: z.object({
      indexId: z.number().int().positive().describe('Bangumi 目录 ID'),
    }),
    auth: 'none',
    scopes: [],
    risk: 'read',
    execute: async (input) => {
      const detail = await indexService.getIndexById(input.indexId);
      const subjects = await indexService.getIndexSubjects(input.indexId);
      return {
        index: detail,
        subjects: subjects.items,
      };
    },
  });

  const authStatus = defineTool({
    name: 'bangumi.auth_status',
    description: '检查当前对话平台用户是否已经绑定 Bangumi 账号。',
    input: z.object({}),
    auth: 'none',
    scopes: [],
    risk: 'read',
    execute: async (_input, context) => {
      const isBound = Boolean(context.accessToken);
      return {
        bound: isBound,
        principalId: context.principalId,
        message: isBound
          ? '已绑定 Bangumi 账号'
          : '当前未绑定 Bangumi 账号。如需使用个人收藏和进度更新功能，请调用 bangumi.auth_start',
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
    getRevision,
    getIndex,
    authStatus,
  ];
}
