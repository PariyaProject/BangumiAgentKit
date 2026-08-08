import { z } from 'zod';
import { defineTool, ResolvedToolPolicy } from '../define-tool.js';
import {
  BangumiClientProvider,
  DefaultBangumiClientProvider,
  TokenBroker,
} from '@bangumi-agent-kit/auth';
import {
  CollectionService,
  EpisodeService,
  IndexWriteService,
  UserService,
} from '@bangumi-agent-kit/bangumi-core';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { Storage, MemoryStorage } from '@bangumi-agent-kit/db';

export function createWriteTools(
  clientProviderOrHttpClient?: BangumiClientProvider | HttpClient,
  db?: Storage,
) {
  let provider: BangumiClientProvider;
  let publicHttpClient: HttpClient;

  if (clientProviderOrHttpClient && 'requireAuthenticatedClient' in clientProviderOrHttpClient) {
    provider = clientProviderOrHttpClient;
    publicHttpClient = new HttpClient();
  } else {
    publicHttpClient = (clientProviderOrHttpClient as HttpClient) || new HttpClient();
    const storage = db || new MemoryStorage();
    const broker = new TokenBroker(
      storage,
      { secretKey: 'test-secret-key-123456789' },
      publicHttpClient,
    );
    provider = new DefaultBangumiClientProvider(broker);
  }

  const updateCollection = defineTool({
    name: 'bangumi.update_collection',
    description:
      '更新当前绑定 Bangumi 账号对某个条目的收藏状态（在看/看过/想看等）、评分（1-10）、标签或评价。',
    input: z.object({
      subjectId: z.number().int().positive().describe('Bangumi 条目 ID'),
      status: z
        .enum(['wish', 'doing', 'done', 'on_hold', 'dropped'])
        .optional()
        .describe('收藏状态'),
      rating: z.number().int().min(1).max(10).optional().describe('评分 (1-10)'),
      tags: z.array(z.string()).optional().describe('标签列表'),
      comment: z.string().max(1000).optional().describe('评价文字'),
    }),
    auth: 'required',
    scopes: ['write:collection'],
    risk: 'write',
    execute: async (input, context, deps?: Record<string, unknown>) => {
      const activeProvider: BangumiClientProvider =
        (deps?.clientProvider as BangumiClientProvider) || provider;
      const client =
        (deps?.executionSession as any)?.client ||
        (await activeProvider.requireAuthenticatedClient(context.principalId, ['write:collection']))
          .client;
      const collectionService = new CollectionService(client);
      const userService = new UserService(client);
      const username = (deps?.executionSession as any)?.account?.username;

      return await collectionService.updateCollection(input, username, (un, sid) =>
        userService.getUserSubjectCollection(un, sid),
      );
    },
  });

  const updateEpisodeProgress = defineTool({
    name: 'bangumi.update_episode_progress',
    description:
      '更新单个、批量或通过 "看到第 N 集" 模式更新章节进度。超过 20 集的大批量变更将自动要求二次确认。',
    input: z.object({
      subjectId: z.number().int().positive().describe('Bangumi 条目 ID'),
      target: z
        .discriminatedUnion('kind', [
          z.object({
            kind: z.literal('ids'),
            episodeIds: z.array(z.number().int().min(1)).min(1).describe('具体章节 ID 列表'),
          }),
          z.object({
            kind: z.literal('through'),
            episodeNumber: z
              .number()
              .int()
              .min(1)
              .describe('更新至第 N 集 (如 12 表示从第 1 集看到第 12 集)'),
            category: z
              .enum(['main', 'sp', 'op', 'ed'])
              .optional()
              .describe('章节分类，默认 main (正篇)'),
          }),
        ])
        .optional()
        .describe('语义化更新目标 (推荐)'),
      episodeIds: z
        .array(z.number().int().min(1))
        .optional()
        .describe('(Deprecated) 兼容旧参数: 章节 ID 列表'),
      status: z
        .enum(['wish', 'watched', 'dropped'])
        .optional()
        .describe('更新动作: watched(看过,默认), wish(想看), dropped(抛弃)'),
      type: z
        .number()
        .int()
        .optional()
        .describe('(Deprecated) 兼容旧 API 数字: 2=看过, 1=想看, 3=抛弃'),
    }),
    auth: 'required',
    scopes: ['write:collection'],
    risk: 'write',
    resolvePolicy: (input): ResolvedToolPolicy => {
      let isBulk = false;
      let count = 0;
      let summaryStr = `更新条目 ${input.subjectId} 的章节进度`;

      if (input.target?.kind === 'through') {
        const epNum = input.target.episodeNumber;
        isBulk = epNum > 20;
        count = epNum;
        const catMap: Record<string, string> = { main: '正篇', sp: 'SP', op: 'OP', ed: 'ED' };
        const catLabel = catMap[input.target.category || 'main'] || '正篇';
        summaryStr = `将把条目 ${input.subjectId} 的 ${catLabel} 观看进度更新至第 ${epNum} 集`;
      } else {
        const ids = input.target?.kind === 'ids' ? input.target.episodeIds : input.episodeIds || [];
        count = ids.length;
        isBulk = count > 20;
        summaryStr = `更新条目 ${input.subjectId} 的 ${count} 个章节进度`;
      }

      return {
        auth: 'required',
        requiredCapabilities: ['write:collection'],
        risk: 'write',
        requiresConfirmation: isBulk,
        affectedCount: count,
        actionType: 'updateEpisodeProgress',
        summary: summaryStr,
      };
    },
    execute: async (input, context, deps?: Record<string, unknown>) => {
      const activeProvider: BangumiClientProvider =
        (deps?.clientProvider as BangumiClientProvider) || provider;
      const client =
        (deps?.executionSession as any)?.client ||
        (await activeProvider.requireAuthenticatedClient(context.principalId, ['write:collection']))
          .client;
      const collectionService = new CollectionService(client);

      let typeNum = 2;
      if (input.status) {
        if (input.status === 'wish') typeNum = 1;
        else if (input.status === 'watched') typeNum = 2;
        else if (input.status === 'dropped') typeNum = 3;
      } else if (input.type !== undefined) {
        typeNum = input.type;
      }

      const epService = new EpisodeService(client);

      if (input.target?.kind === 'through') {
        const resolution = await epService.resolveThroughEpisodes(
          input.subjectId,
          input.target.episodeNumber,
          input.target.category || 'main',
        );

        if (resolution.resolvedEpisodeIds.length > 0) {
          await collectionService.updateEpisodeProgress(
            input.subjectId,
            resolution.resolvedEpisodeIds,
            typeNum,
          );
        }

        const targetReached = resolution.resolvedEpisodeNumbers.includes(
          input.target.episodeNumber,
        );
        const maxResolved =
          resolution.resolvedEpisodeNumbers.length > 0
            ? Math.max(...resolution.resolvedEpisodeNumbers)
            : 0;

        return {
          success: true,
          status: targetReached ? 'complete' : 'partial',
          targetReached,
          requestedEpisodeNumber: input.target.episodeNumber,
          resolvedThroughEpisodeNumber: maxResolved,
          subjectId: input.subjectId,
          resolvedEpisodeIds: resolution.resolvedEpisodeIds,
          resolvedEpisodeNumbers: resolution.resolvedEpisodeNumbers,
          count: resolution.count,
          warning: resolution.warning,
        };
      }

      const episodeIds = input.target?.kind === 'ids' ? input.target.episodeIds : input.episodeIds;
      if (!episodeIds || episodeIds.length === 0) {
        throw new Error('MISSING_PARAMETER: Must specify either target or episodeIds parameter.');
      }

      const res = await collectionService.updateEpisodeProgress(
        input.subjectId,
        episodeIds,
        typeNum,
      );
      return {
        success: true,
        subjectId: input.subjectId,
        resolvedEpisodeIds: res.updatedEpisodes,
        count: res.count,
      };
    },
  });

  const manageCharacterCollection = defineTool({
    name: 'bangumi.manage_character_collection',
    description: '收藏或取消收藏指定的虚拟角色。取消收藏属于破坏性操作，需要二次确认。',
    input: z.object({
      characterId: z.number().int().positive().describe('角色 ID'),
      action: z.enum(['collect', 'uncollect']).describe('操作动作'),
    }),
    auth: 'required',
    scopes: ['write:collection'],
    risk: 'write',
    resolvePolicy: (input): ResolvedToolPolicy => {
      const risk = input.action === 'uncollect' ? 'destructive' : 'write';
      return {
        auth: 'required',
        requiredCapabilities: ['write:collection'],
        risk,
        actionType: 'manageCharacterCollection',
        summary: `${input.action === 'uncollect' ? '取消收藏' : '收藏'}角色 ${input.characterId}`,
      };
    },
    execute: async (input, context, deps?: Record<string, unknown>) => {
      const activeProvider: BangumiClientProvider =
        (deps?.clientProvider as BangumiClientProvider) || provider;
      const client =
        (deps?.executionSession as any)?.client ||
        (await activeProvider.requireAuthenticatedClient(context.principalId, ['write:collection']))
          .client;
      const collectionService = new CollectionService(client);

      if (input.action === 'collect') {
        await collectionService.collectCharacter(input.characterId);
      } else {
        await collectionService.uncollectCharacter(input.characterId);
      }

      return { success: true, action: input.action, characterId: input.characterId };
    },
  });

  const managePersonCollection = defineTool({
    name: 'bangumi.manage_person_collection',
    description: '收藏或取消收藏指定的现实人物/声优。取消收藏属于破坏性操作，需要二次确认。',
    input: z.object({
      personId: z.number().int().positive().describe('人物 ID'),
      action: z.enum(['collect', 'uncollect']).describe('操作动作'),
    }),
    auth: 'required',
    scopes: ['write:collection'],
    risk: 'write',
    resolvePolicy: (input): ResolvedToolPolicy => {
      const risk = input.action === 'uncollect' ? 'destructive' : 'write';
      return {
        auth: 'required',
        requiredCapabilities: ['write:collection'],
        risk,
        actionType: 'managePersonCollection',
        summary: `${input.action === 'uncollect' ? '取消收藏' : '收藏'}现实人物 ${input.personId}`,
      };
    },
    execute: async (input, context, deps?: Record<string, unknown>) => {
      const activeProvider: BangumiClientProvider =
        (deps?.clientProvider as BangumiClientProvider) || provider;
      const client =
        (deps?.executionSession as any)?.client ||
        (await activeProvider.requireAuthenticatedClient(context.principalId, ['write:collection']))
          .client;
      const collectionService = new CollectionService(client);

      if (input.action === 'collect') {
        await collectionService.collectPerson(input.personId);
      } else {
        await collectionService.uncollectPerson(input.personId);
      }

      return { success: true, action: input.action, personId: input.personId };
    },
  });

  const manageIndex = defineTool({
    name: 'bangumi.manage_index',
    description: '创建、编辑或为目录添加/移除条目。删除目录或移除条目需要二次确认。',
    input: z.discriminatedUnion('action', [
      z.object({
        action: z.literal('create'),
        title: z.string().min(1).max(100).describe('目录标题'),
        description: z.string().max(1000).optional().describe('目录简介'),
      }),
      z.object({
        action: z.literal('edit'),
        indexId: z.number().int().positive().describe('目录 ID'),
        title: z.string().min(1).max(100).optional().describe('新标题'),
        description: z.string().max(1000).optional().describe('新简介'),
      }),
      z.object({
        action: z.literal('add_subject'),
        indexId: z.number().int().positive().describe('目录 ID'),
        subjectId: z.number().int().positive().describe('条目 ID'),
        comment: z.string().max(500).optional().describe('评价/点评'),
      }),
      z.object({
        action: z.literal('remove_subject'),
        indexId: z.number().int().positive().describe('目录 ID'),
        subjectId: z.number().int().positive().describe('条目 ID'),
      }),
    ]),
    auth: 'required',
    scopes: ['write:index'],
    risk: 'write',
    resolvePolicy: (input): ResolvedToolPolicy => {
      const risk = input.action === 'remove_subject' ? 'destructive' : 'write';
      let summary = '';
      if (input.action === 'create') summary = `创建目录 "${input.title}"`;
      else if (input.action === 'edit') summary = `编辑目录 ${input.indexId}`;
      else if (input.action === 'add_subject')
        summary = `为目录 ${input.indexId} 添加条目 ${input.subjectId}`;
      else if (input.action === 'remove_subject')
        summary = `从目录 ${input.indexId} 移除条目 ${input.subjectId}`;

      return {
        auth: 'required',
        requiredCapabilities: ['write:index'],
        risk,
        actionType: 'manageIndex',
        summary,
      };
    },
    execute: async (input, context, deps?: Record<string, unknown>) => {
      const activeProvider: BangumiClientProvider =
        (deps?.clientProvider as BangumiClientProvider) || provider;
      const client =
        (deps?.executionSession as any)?.client ||
        (await activeProvider.requireAuthenticatedClient(context.principalId, ['write:index']))
          .client;
      const indexWriteService = new IndexWriteService(client);

      if (input.action === 'create') {
        const indexId = await indexWriteService.createIndex(input.title, input.description);
        return { success: true, action: 'create', indexId };
      } else if (input.action === 'edit') {
        await indexWriteService.editIndex(input.indexId, input.title, input.description);
        return { success: true, action: 'edit', indexId: input.indexId };
      } else if (input.action === 'add_subject') {
        await indexWriteService.addSubjectToIndex(input.indexId, input.subjectId, input.comment);
        return {
          success: true,
          action: 'add_subject',
          indexId: input.indexId,
          subjectId: input.subjectId,
        };
      } else if (input.action === 'remove_subject') {
        await indexWriteService.removeSubjectFromIndex(input.indexId, input.subjectId);
        return {
          success: true,
          action: 'remove_subject',
          indexId: input.indexId,
          subjectId: input.subjectId,
        };
      }
      throw new Error('UNSUPPORTED_ACTION');
    },
  });

  return [
    updateCollection,
    updateEpisodeProgress,
    manageCharacterCollection,
    managePersonCollection,
    manageIndex,
  ];
}
