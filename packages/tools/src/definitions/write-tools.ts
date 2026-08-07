import { z } from 'zod';
import { defineTool, ResolvedToolPolicy } from '../define-tool.js';
import { BangumiClientProvider, DefaultBangumiClientProvider, TokenBroker } from '@bangumi-agent-kit/auth';
import { CollectionService, IndexWriteService } from '@bangumi-agent-kit/bangumi-core';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { Storage, MemoryStorage } from '@bangumi-agent-kit/db';

export function createWriteTools(clientProviderOrHttpClient?: BangumiClientProvider | HttpClient, db?: Storage) {
  let provider: BangumiClientProvider;
  if (clientProviderOrHttpClient && 'requireAuthenticatedClient' in clientProviderOrHttpClient) {
    provider = clientProviderOrHttpClient;
  } else {
    const http = (clientProviderOrHttpClient as HttpClient) || new HttpClient();
    const storage = db || new MemoryStorage();
    const broker = new TokenBroker(storage, { secretKey: 'test-secret-key-123456789' }, http);
    provider = new DefaultBangumiClientProvider(broker);
  }

  const updateCollection = defineTool({
    name: 'bangumi.update_collection',
    description: '更新当前绑定 Bangumi 账号对某个条目的收藏状态（在看/看过/想看等）、评分（1-10）、标签或评价。',
    input: z.object({
      subjectId: z.number().int().positive().describe('Bangumi 条目 ID'),
      status: z.enum(['wish', 'doing', 'done', 'on_hold', 'dropped']).optional().describe('收藏状态'),
      rating: z.number().int().min(1).max(10).optional().describe('评分 (1-10)'),
      tags: z.array(z.string()).optional().describe('标签列表'),
      comment: z.string().max(1000).optional().describe('评价文字'),
    }),
    auth: 'required',
    scopes: ['write:collection'],
    risk: 'write',
    execute: async (input, context, deps?: Record<string, unknown>) => {
      const activeProvider: BangumiClientProvider = (deps?.clientProvider as BangumiClientProvider) || provider;
      const client = (deps?.executionSession as any)?.client ||
        (await activeProvider.requireAuthenticatedClient(context.principalId, ['write:collection'])).client;
      const collectionService = new CollectionService(client);
      return await collectionService.updateCollection(input);
    },
  });

  const updateEpisodeProgress = defineTool({
    name: 'bangumi.update_episode_progress',
    description: '更新单个或批量正篇章节的播放进度（如看到第 N 集）。超过 20 集的大批量变更将自动要求二次确认。',
    input: z.object({
      subjectId: z.number().int().positive().describe('Bangumi 条目 ID'),
      episodeIds: z.array(z.number().int().min(1)).min(1).describe('要更新的章节 ID 数组'),
      type: z.number().int().optional().default(2).describe('2=看过, 1=想看, 3=抛弃'),
    }),
    auth: 'required',
    scopes: ['write:collection'],
    risk: 'write',
    resolvePolicy: (input): ResolvedToolPolicy => {
      const isBulk = input.episodeIds.length > 20;
      return {
        auth: 'required',
        requiredCapabilities: ['write:collection'],
        risk: 'write',
        requiresConfirmation: isBulk,
        affectedCount: input.episodeIds.length,
        actionType: 'updateEpisodeProgress',
        summary: `更新条目 ${input.subjectId} 的 ${input.episodeIds.length} 个章节进度`,
      };
    },
    execute: async (input, context, deps?: Record<string, unknown>) => {
      const activeProvider: BangumiClientProvider = (deps?.clientProvider as BangumiClientProvider) || provider;
      const client = (deps?.executionSession as any)?.client ||
        (await activeProvider.requireAuthenticatedClient(context.principalId, ['write:collection'])).client;
      const collectionService = new CollectionService(client);
      return await collectionService.updateEpisodeProgress(input.subjectId, input.episodeIds, input.type);
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
      const activeProvider: BangumiClientProvider = (deps?.clientProvider as BangumiClientProvider) || provider;
      const client = (deps?.executionSession as any)?.client ||
        (await activeProvider.requireAuthenticatedClient(context.principalId, ['write:collection'])).client;
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
        summary: `${input.action === 'uncollect' ? '取消收藏' : '收藏'}人物 ${input.personId}`,
      };
    },
    execute: async (input, context, deps?: Record<string, unknown>) => {
      const activeProvider: BangumiClientProvider = (deps?.clientProvider as BangumiClientProvider) || provider;
      const client = (deps?.executionSession as any)?.client ||
        (await activeProvider.requireAuthenticatedClient(context.principalId, ['write:collection'])).client;
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
    description: '创建、编辑目录，向目录添加/删除条目，或收藏/取消收藏目录。从目录删除条目与取消收藏目录属于破坏性操作，需要二次确认。',
    input: z.object({
      action: z.enum(['create', 'edit', 'add_subject', 'remove_subject', 'collect', 'uncollect']),
      indexId: z.number().int().optional().describe('目录 ID (编辑/添加/删除/收藏/取消收藏时必填)'),
      subjectId: z.number().int().optional().describe('条目 ID (添加/删除条目时必填)'),
      title: z.string().optional().describe('目录标题'),
      desc: z.string().optional().describe('目录描述'),
      comment: z.string().optional().describe('条目批注'),
    }),
    auth: 'required',
    scopes: ['write:indices'],
    risk: 'write',
    resolvePolicy: (input): ResolvedToolPolicy => {
      const risk = (input.action === 'remove_subject' || input.action === 'uncollect') ? 'destructive' : 'write';
      const requiredCapabilities = (input.action === 'collect' || input.action === 'uncollect')
        ? ['write:collection']
        : ['write:indices'];
      return {
        auth: 'required',
        requiredCapabilities,
        risk,
        actionType: `manageIndex_${input.action}`,
        summary: `目录操作: ${input.action}`,
      };
    },
    execute: async (input, context, deps?: Record<string, unknown>) => {
      const reqCaps = (input.action === 'collect' || input.action === 'uncollect')
        ? ['write:collection']
        : ['write:indices'];
      const activeProvider: BangumiClientProvider = (deps?.clientProvider as BangumiClientProvider) || provider;
      const client = (deps?.executionSession as any)?.client ||
        (await activeProvider.requireAuthenticatedClient(context.principalId, reqCaps)).client;
      const indexWriteService = new IndexWriteService(client);

      if (input.action === 'create') {
        return await indexWriteService.createIndex(input.title, input.desc);
      }

      if (input.action === 'edit') {
        if (!input.indexId) throw new Error('MISSING_PARAMETER: indexId is required for edit action');
        await indexWriteService.editIndex(input.indexId, input.title, input.desc);
        return { success: true, action: input.action, indexId: input.indexId };
      }

      if (input.action === 'add_subject') {
        if (!input.indexId || !input.subjectId) throw new Error('MISSING_PARAMETER: indexId and subjectId are required for add_subject action');
        await indexWriteService.addSubjectToIndex(input.indexId, input.subjectId, input.comment);
        return { success: true, action: input.action, indexId: input.indexId, subjectId: input.subjectId };
      }

      if (input.action === 'remove_subject') {
        if (!input.indexId || !input.subjectId) throw new Error('MISSING_PARAMETER: indexId and subjectId are required for remove_subject action');
        await indexWriteService.removeSubjectFromIndex(input.indexId, input.subjectId);
        return { success: true, action: input.action, indexId: input.indexId, subjectId: input.subjectId };
      }

      if (input.action === 'collect') {
        if (!input.indexId) throw new Error('MISSING_PARAMETER: indexId is required for collect action');
        await indexWriteService.collectIndex(input.indexId);
        return { success: true, action: input.action, indexId: input.indexId };
      }

      if (input.action === 'uncollect') {
        if (!input.indexId) throw new Error('MISSING_PARAMETER: indexId is required for uncollect action');
        await indexWriteService.uncollectIndex(input.indexId);
        return { success: true, action: input.action, indexId: input.indexId };
      }

      throw new Error(`UNSUPPORTED_ACTION: Action "${input.action}" is not supported`);
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
