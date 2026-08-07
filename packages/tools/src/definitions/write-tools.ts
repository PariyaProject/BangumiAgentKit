import { z } from 'zod';
import { defineTool } from '../define-tool.js';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { DatabaseStore } from '@bangumi-agent-kit/db';
import { CollectionService, IndexWriteService, AuditService } from '@bangumi-agent-kit/bangumi-core';
import { PolicyManager } from '../policy.js';

export function createWriteTools(httpClient: HttpClient, db: DatabaseStore) {
  const collectionService = new CollectionService(httpClient);
  const indexWriteService = new IndexWriteService(httpClient);
  const auditService = new AuditService(db);

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
    execute: async (input, context) => {
      PolicyManager.assertWriteAllowed({
        db,
        context,
        actionType: 'updateCollection',
        summary: `更新条目 ${input.subjectId} 的收藏状态`,
        risk: 'write',
        payload: input,
      });

      const res = await collectionService.updateCollection(input, context.accessToken!);

      await auditService.recordWrite({
        principalId: context.principalId,
        operationId: 'patchUserCollection',
        riskLevel: 'write',
        resourceType: 'subject',
        resourceId: String(input.subjectId),
        changeSummary: input,
        result: 'success',
      });

      return res;
    },
  });

  const updateEpisodeProgress = defineTool({
    name: 'bangumi.update_episode_progress',
    description: '更新单个或批量正篇章节的播放进度（如看到第 N 集）。超过 20 集的大批量变更将自动要求二次确认。',
    input: z.object({
      subjectId: z.number().int().positive().describe('Bangumi 条目 ID'),
      episodeIds: z.array(z.number().int().positive()).min(1).describe('要更新的章节 ID 数组'),
      type: z.number().int().optional().default(2).describe('2=看过, 1=想看, 3=抛弃'),
    }),
    auth: 'required',
    scopes: ['write:collection'],
    risk: 'write',
    execute: async (input, context) => {
      const isBulk = input.episodeIds.length > 20;

      PolicyManager.assertWriteAllowed({
        db,
        context,
        actionType: 'updateEpisodeProgress',
        summary: `更新条目 ${input.subjectId} 的 ${input.episodeIds.length} 个章节进度`,
        risk: 'write',
        payload: input,
        isBulk,
        affectedCount: input.episodeIds.length,
      });

      const res = await collectionService.updateEpisodeProgress(
        input.subjectId,
        input.episodeIds,
        input.type,
        context.accessToken!
      );

      await auditService.recordWrite({
        principalId: context.principalId,
        operationId: 'patchUserSubjectEpisodeCollection',
        riskLevel: 'write',
        resourceType: 'episodes',
        resourceId: String(input.subjectId),
        changeSummary: { count: input.episodeIds.length },
        result: 'success',
      });

      return res;
    },
  });

  const manageCharacterCollection = defineTool({
    name: 'bangumi.manage_character_collection',
    description: '收藏或取消收藏指定的虚拟角色。',
    input: z.object({
      characterId: z.number().int().positive().describe('角色 ID'),
      action: z.enum(['collect', 'uncollect']).describe('操作动作'),
    }),
    auth: 'required',
    scopes: ['write:collection'],
    risk: 'write',
    execute: async (input, context) => {
      const risk = input.action === 'uncollect' ? 'destructive' : 'write';

      PolicyManager.assertWriteAllowed({
        db,
        context,
        actionType: 'manageCharacterCollection',
        summary: `${input.action === 'uncollect' ? '取消收藏' : '收藏'}角色 ${input.characterId}`,
        risk,
        payload: input,
      });

      if (input.action === 'collect') {
        await collectionService.collectCharacter(input.characterId, context.accessToken!);
      } else {
        await collectionService.uncollectCharacter(input.characterId, context.accessToken!);
      }

      await auditService.recordWrite({
        principalId: context.principalId,
        operationId: input.action === 'collect' ? 'collectCharacter' : 'uncollectCharacter',
        riskLevel: risk,
        resourceType: 'character',
        resourceId: String(input.characterId),
        changeSummary: input,
        result: 'success',
      });

      return { success: true, action: input.action, characterId: input.characterId };
    },
  });

  const managePersonCollection = defineTool({
    name: 'bangumi.manage_person_collection',
    description: '收藏或取消收藏指定的现实人物/声优。',
    input: z.object({
      personId: z.number().int().positive().describe('人物 ID'),
      action: z.enum(['collect', 'uncollect']).describe('操作动作'),
    }),
    auth: 'required',
    scopes: ['write:collection'],
    risk: 'write',
    execute: async (input, context) => {
      const risk = input.action === 'uncollect' ? 'destructive' : 'write';

      PolicyManager.assertWriteAllowed({
        db,
        context,
        actionType: 'managePersonCollection',
        summary: `${input.action === 'uncollect' ? '取消收藏' : '收藏'}人物 ${input.personId}`,
        risk,
        payload: input,
      });

      if (input.action === 'collect') {
        await collectionService.collectPerson(input.personId, context.accessToken!);
      } else {
        await collectionService.uncollectPerson(input.personId, context.accessToken!);
      }

      await auditService.recordWrite({
        principalId: context.principalId,
        operationId: input.action === 'collect' ? 'collectPerson' : 'uncollectPerson',
        riskLevel: risk,
        resourceType: 'person',
        resourceId: String(input.personId),
        changeSummary: input,
        result: 'success',
      });

      return { success: true, action: input.action, personId: input.personId };
    },
  });

  const manageIndex = defineTool({
    name: 'bangumi.manage_index',
    description: '创建、编辑目录，或向目录中添加/删除条目。从目录删除条目属于破坏性操作，需要二次确认。',
    input: z.object({
      action: z.enum(['create', 'edit', 'add_subject', 'remove_subject', 'collect', 'uncollect']),
      indexId: z.number().int().optional().describe('目录 ID (编辑/添加/删除时必填)'),
      subjectId: z.number().int().optional().describe('条目 ID (添加/删除条目时必填)'),
      title: z.string().optional().describe('目录标题'),
      desc: z.string().optional().describe('目录描述'),
      comment: z.string().optional().describe('条目批注'),
    }),
    auth: 'required',
    scopes: ['write:indices'],
    risk: 'write',
    execute: async (input, context) => {
      const risk = (input.action === 'remove_subject' || input.action === 'uncollect') ? 'destructive' : 'write';

      PolicyManager.assertWriteAllowed({
        db,
        context,
        actionType: 'manageIndex',
        summary: `目录操作: ${input.action}`,
        risk,
        payload: input,
      });

      let res: unknown = { success: true };

      if (input.action === 'create') {
        if (!input.title || !input.desc) throw new Error('title and desc required for create index');
        res = await indexWriteService.createIndex(input.title, input.desc, context.accessToken!);
      } else if (input.action === 'add_subject') {
        if (!input.indexId || !input.subjectId) throw new Error('indexId and subjectId required');
        await indexWriteService.addSubjectToIndex(input.indexId, input.subjectId, input.comment, context.accessToken);
      } else if (input.action === 'remove_subject') {
        if (!input.indexId || !input.subjectId) throw new Error('indexId and subjectId required');
        await indexWriteService.removeSubjectFromIndex(input.indexId, input.subjectId, context.accessToken);
      }

      await auditService.recordWrite({
        principalId: context.principalId,
        operationId: `manageIndex_${input.action}`,
        riskLevel: risk,
        resourceType: 'index',
        resourceId: String(input.indexId || 0),
        changeSummary: input,
        result: 'success',
      });

      return res;
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
