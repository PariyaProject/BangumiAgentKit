import { z } from 'zod';
import {
  defineTool,
  ResolvedToolPolicy,
  ToolConfirmationPreview,
  ToolExecutionDependencies,
} from '../define-tool.js';
import {
  BangumiClientProvider,
  DefaultBangumiClientProvider,
  TokenBroker,
} from '@bangumi-agent-kit/auth';
import {
  CollectionService,
  EpisodeService,
  IndexReadService,
  IndexWriteService,
  UserService,
} from '@bangumi-agent-kit/bangumi-core';
import { BangumiError, HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { Storage, MemoryStorage } from '@bangumi-agent-kit/db';

const MAX_CONFIRMATION_SUMMARY_BYTES = 4096;
const MAX_CONFIRMATION_EPISODES = 100;
const INDEX_CONFIRMATION_PAGE_SIZE = 100;
const INDEX_CONFIRMATION_MAX_PAGES = 50;
const KNOWN_COLLECTION_STATUSES = new Set(['wish', 'doing', 'done', 'on_hold', 'dropped']);

type EpisodeProgressStatus = 'wish' | 'watched' | 'dropped';

function resolveEpisodeProgressRequest(input: { status?: EpisodeProgressStatus; type?: number }): {
  typeNum: number;
  status: EpisodeProgressStatus;
} {
  if (input.status) {
    const typeByStatus: Record<EpisodeProgressStatus, number> = {
      wish: 1,
      watched: 2,
      dropped: 3,
    };
    return { status: input.status, typeNum: typeByStatus[input.status] };
  }

  const statusByType: Record<number, EpisodeProgressStatus> = {
    1: 'wish',
    2: 'watched',
    3: 'dropped',
  };
  const typeNum = input.type ?? 2;
  const status = statusByType[typeNum];
  if (!status) {
    throw new BangumiError(
      'VALIDATION_ERROR',
      '章节状态 type 只能是 1 (wish)、2 (watched) 或 3 (dropped)。',
      false,
      400,
    );
  }
  return { status, typeNum };
}

function requireConfirmationAccount(deps: ToolExecutionDependencies) {
  const session = deps.executionSession;
  if (!session?.account) {
    throw new BangumiError('AUTH_REQUIRED', '需要先绑定 Bangumi 账号才能预览此写入。', false, 401);
  }
  return { account: session.account, client: session.client };
}

function confirmationPreview(
  summary: string,
  snapshot: unknown,
  executionData?: unknown,
): ToolConfirmationPreview {
  if (Buffer.byteLength(summary, 'utf8') > MAX_CONFIRMATION_SUMMARY_BYTES) {
    throw new BangumiError(
      'CONFIRMATION_PREVIEW_UNAVAILABLE',
      '写入确认摘要超出安全显示范围；没有执行写入。',
      false,
      413,
    );
  }
  return { summary, snapshot, executionData };
}

const display = (value: unknown): string => JSON.stringify(value ?? null);

async function mapWithConcurrency<T, U>(
  values: readonly T[],
  concurrency: number,
  map: (value: T, index: number) => Promise<U>,
): Promise<U[]> {
  const results = new Array<U>(values.length);
  let nextIndex = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, async () => {
      while (nextIndex < values.length) {
        const index = nextIndex++;
        results[index] = await map(values[index]!, index);
      }
    }),
  );
  return results;
}

function isNotFound(error: unknown): boolean {
  const value = error as { code?: string; status?: number; statusCode?: number } | null;
  return value?.code === 'NOT_FOUND' || value?.status === 404 || value?.statusCode === 404;
}

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
    resolvePolicy: (): ResolvedToolPolicy => ({
      auth: 'required',
      requiredCapabilities: ['write:collection'],
      risk: 'write',
      requiresConfirmation: true,
      actionType: 'updateCollection',
      summary: '更新当前账号的条目收藏',
    }),
    prepareConfirmation: async (input, _context, deps) => {
      const { account, client } = requireConfirmationAccount(deps);
      const userService = new UserService(client);
      const current = await userService.getUserSubjectCollection(account.username, input.subjectId);
      if (
        (current.found &&
          (!current.collection ||
            current.collection.subjectId !== input.subjectId ||
            !KNOWN_COLLECTION_STATUSES.has(current.collection.status))) ||
        (!current.found && current.collection !== undefined)
      ) {
        throw new BangumiError(
          'CONFIRMATION_PREVIEW_UNAVAILABLE',
          '条目收藏状态未知或与目标不匹配；没有执行写入。',
          false,
          409,
        );
      }
      const currentState =
        current.found && current.collection
          ? {
              status: current.collection.status,
              rating: current.collection.rating ?? null,
              tags: current.collection.tags ?? [],
              comment: current.collection.comment ?? null,
            }
          : { collection: 'not_collected' };
      const requestedState = Object.fromEntries(
        Object.entries({
          status: input.status,
          rating: input.rating,
          tags: input.tags,
          comment: input.comment,
        }).filter(([, value]) => value !== undefined),
      );
      const title = current.collection?.subjectNameCn || current.collection?.subjectName;
      const summary = [
        `Bangumi 账号 ${display(account.username)}`,
        `条目 ${display(title || `#${input.subjectId}`)}（ID ${input.subjectId}）`,
        `当前状态 ${display(currentState)}`,
        `请求变化 ${display(requestedState)}`,
      ].join('；');
      return confirmationPreview(summary, {
        subjectId: input.subjectId,
        subjectLabel: title ?? null,
        currentState,
      });
    },
    execute: async (input, context, deps) => {
      const activeProvider: BangumiClientProvider = deps?.clientProvider || provider;
      const client =
        deps?.executionSession?.client ||
        (await activeProvider.requireAuthenticatedClient(context.principalId, ['write:collection']))
          .client;
      const collectionService = new CollectionService(client);
      const userService = new UserService(client);
      const username = deps?.executionSession?.account?.username;

      return await collectionService.updateCollection(input, username, (un: string, sid: number) =>
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
      let count = 0;
      let summaryStr = `更新条目 ${input.subjectId} 的章节进度`;

      if (input.target?.kind === 'through') {
        const epNum = input.target.episodeNumber;
        count = epNum;
        const catMap: Record<string, string> = { main: '正篇', sp: 'SP', op: 'OP', ed: 'ED' };
        const catLabel = catMap[input.target.category || 'main'] || '正篇';
        summaryStr = `将把条目 ${input.subjectId} 的 ${catLabel} 观看进度更新至第 ${epNum} 集`;
      } else {
        const ids = input.target?.kind === 'ids' ? input.target.episodeIds : input.episodeIds || [];
        count = ids.length;
        summaryStr = `更新条目 ${input.subjectId} 的 ${count} 个章节进度`;
      }

      return {
        auth: 'required',
        requiredCapabilities: ['write:collection'],
        risk: 'write',
        requiresConfirmation: true,
        affectedCount: count,
        actionType: 'updateEpisodeProgress',
        summary: summaryStr,
      };
    },
    prepareConfirmation: async (input, _context, deps) => {
      const { account, client } = requireConfirmationAccount(deps);
      const episodeService = new EpisodeService(client);
      const userService = new UserService(client);
      let episodeIds: number[];
      let episodeNumbers: number[] | undefined;
      let throughResolution:
        Awaited<ReturnType<EpisodeService['resolveThroughEpisodes']>> | undefined;
      const progressRequest = resolveEpisodeProgressRequest(input);

      if (input.target?.kind === 'through') {
        throughResolution = await episodeService.resolveThroughEpisodes(
          input.subjectId,
          input.target.episodeNumber,
          input.target.category || 'main',
        );
        episodeIds = throughResolution.resolvedEpisodeIds;
        episodeNumbers = throughResolution.resolvedEpisodeNumbers;
        if (
          throughResolution.warning ||
          !episodeNumbers.includes(input.target.episodeNumber) ||
          episodeNumbers.length !== episodeIds.length
        ) {
          throw new BangumiError(
            'CONFIRMATION_PREVIEW_UNAVAILABLE',
            '无法准确解析到请求的章节范围；没有执行写入。',
            false,
            409,
          );
        }
      } else {
        episodeIds =
          input.target?.kind === 'ids' ? input.target.episodeIds : input.episodeIds || [];
      }
      if (episodeIds.length === 0) {
        throw new BangumiError(
          'VALIDATION_ERROR',
          '没有解析出可更新的章节；没有执行写入。',
          false,
          400,
        );
      }
      if (episodeIds.length > MAX_CONFIRMATION_EPISODES) {
        throw new BangumiError(
          'CONFIRMATION_PREVIEW_UNAVAILABLE',
          `一次确认最多预览 ${MAX_CONFIRMATION_EPISODES} 个章节；没有执行写入。`,
          false,
          413,
        );
      }

      const currentStates = await mapWithConcurrency(episodeIds, 4, async (episodeId) => {
        try {
          const current = await userService.getUserEpisodeCollection(episodeId);
          if (current.status === 'unknown') {
            throw new BangumiError(
              'CONFIRMATION_PREVIEW_UNAVAILABLE',
              '章节当前收藏状态未知；没有执行写入。',
              false,
              409,
            );
          }
          return { episodeId, status: current.status };
        } catch (error) {
          if (isNotFound(error)) return { episodeId, status: 'uncollected' as const };
          throw error;
        }
      });
      const requestedStatus = progressRequest.status;
      const requestedTarget =
        input.target?.kind === 'through'
          ? {
              throughEpisode: input.target.episodeNumber,
              category: input.target.category || 'main',
              resolvedEpisodeNumbers: episodeNumbers,
            }
          : { episodeIds };
      const summary = [
        `Bangumi 账号 ${display(account.username)}`,
        `条目 #${input.subjectId}，章节 ${display(requestedTarget)}`,
        `当前章节状态 ${display(currentStates)}`,
        `请求状态 ${display(requestedStatus)}`,
      ].join('；');
      return confirmationPreview(
        summary,
        {
          subjectId: input.subjectId,
          requestedTarget,
          currentStates,
          requestedStatus,
          resolvedEpisodeNumbers: episodeNumbers,
        },
        throughResolution,
      );
    },
    execute: async (input, context, deps) => {
      const activeProvider: BangumiClientProvider = deps?.clientProvider || provider;
      const client =
        deps?.executionSession?.client ||
        (await activeProvider.requireAuthenticatedClient(context.principalId, ['write:collection']))
          .client;
      const collectionService = new CollectionService(client);

      const { typeNum } = resolveEpisodeProgressRequest(input);

      const epService = new EpisodeService(client);

      if (input.target?.kind === 'through') {
        const resolution =
          (deps?.preparedConfirmation?.executionData as
            Awaited<ReturnType<EpisodeService['resolveThroughEpisodes']>> | undefined) ??
          (await epService.resolveThroughEpisodes(
            input.subjectId,
            input.target.episodeNumber,
            input.target.category || 'main',
          ));

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
        requiresConfirmation: true,
        actionType: 'manageCharacterCollection',
        summary: `${input.action === 'uncollect' ? '取消收藏' : '收藏'}角色 ${input.characterId}`,
      };
    },
    prepareConfirmation: async (input, _context, deps) => {
      const { account, client } = requireConfirmationAccount(deps);
      const current = await new UserService(client).getUserCharacterCollection(
        account.username,
        input.characterId,
      );
      if (
        (current.found && (!current.item || current.item.id !== input.characterId)) ||
        (!current.found && current.item !== undefined)
      ) {
        throw new BangumiError(
          'CONFIRMATION_PREVIEW_UNAVAILABLE',
          '角色收藏状态未知或与目标不匹配；没有执行写入。',
          false,
          409,
        );
      }
      const currentState =
        current.found && current.item
          ? { collected: true, name: current.item.name }
          : { collected: false };
      const requestedState = input.action === 'collect' ? 'collected' : 'not_collected';
      const summary = [
        `Bangumi 账号 ${display(account.username)}`,
        `角色 ${display(current.item?.name || `#${input.characterId}`)}（ID ${input.characterId}）`,
        `当前状态 ${display(currentState)}`,
        `请求状态 ${display(requestedState)}`,
      ].join('；');
      return confirmationPreview(summary, {
        characterId: input.characterId,
        currentState,
        requestedState,
      });
    },
    execute: async (input, context, deps) => {
      const activeProvider: BangumiClientProvider = deps?.clientProvider || provider;
      const client =
        deps?.executionSession?.client ||
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
        requiresConfirmation: true,
        actionType: 'managePersonCollection',
        summary: `${input.action === 'uncollect' ? '取消收藏' : '收藏'}现实人物 ${input.personId}`,
      };
    },
    prepareConfirmation: async (input, _context, deps) => {
      const { account, client } = requireConfirmationAccount(deps);
      const current = await new UserService(client).getUserPersonCollection(
        account.username,
        input.personId,
      );
      if (
        (current.found && (!current.item || current.item.id !== input.personId)) ||
        (!current.found && current.item !== undefined)
      ) {
        throw new BangumiError(
          'CONFIRMATION_PREVIEW_UNAVAILABLE',
          '人物收藏状态未知或与目标不匹配；没有执行写入。',
          false,
          409,
        );
      }
      const currentState =
        current.found && current.item
          ? { collected: true, name: current.item.name }
          : { collected: false };
      const requestedState = input.action === 'collect' ? 'collected' : 'not_collected';
      const summary = [
        `Bangumi 账号 ${display(account.username)}`,
        `人物 ${display(current.item?.name || `#${input.personId}`)}（ID ${input.personId}）`,
        `当前状态 ${display(currentState)}`,
        `请求状态 ${display(requestedState)}`,
      ].join('；');
      return confirmationPreview(summary, {
        personId: input.personId,
        currentState,
        requestedState,
      });
    },
    execute: async (input, context, deps) => {
      const activeProvider: BangumiClientProvider = deps?.clientProvider || provider;
      const client =
        deps?.executionSession?.client ||
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
    scopes: ['write:indices'],
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
        requiredCapabilities: ['write:indices'],
        risk,
        requiresConfirmation: true,
        actionType: 'manageIndex',
        summary,
      };
    },
    prepareConfirmation: async (input, _context, deps) => {
      const { account, client } = requireConfirmationAccount(deps);
      const indexReadService = new IndexReadService(client);
      if (input.action === 'create') {
        const requestedState = { title: input.title, description: input.description ?? '' };
        return confirmationPreview(
          [
            `Bangumi 账号 ${display(account.username)}`,
            '新目录（当前不存在）',
            `请求创建 ${display(requestedState)}`,
          ].join('；'),
          { action: 'create', currentState: null, requestedState },
        );
      }

      const index = await indexReadService.getIndexById(input.indexId);
      if (
        !Number.isSafeInteger(index.id) ||
        index.id !== input.indexId ||
        typeof index.title !== 'string' ||
        !index.title.trim() ||
        typeof index.desc !== 'string'
      ) {
        throw new BangumiError(
          'CONFIRMATION_PREVIEW_UNAVAILABLE',
          '目录当前信息未知或与目标不匹配；没有执行写入。',
          false,
          409,
        );
      }
      if (input.action === 'edit') {
        const currentState = { title: index.title, description: index.desc };
        const requestedState = {
          title: input.title ?? index.title,
          description: input.description ?? index.desc,
        };
        return confirmationPreview(
          [
            `Bangumi 账号 ${display(account.username)}`,
            `目录 ${display(index.title)}（ID ${input.indexId}）`,
            `当前状态 ${display(currentState)}`,
            `请求状态 ${display(requestedState)}`,
          ].join('；'),
          { action: 'edit', indexId: input.indexId, currentState },
        );
      }

      let offset = 0;
      let membership: { id: number; nameCn: string; comment?: string } | undefined;
      let complete = false;
      let expectedTotal: number | undefined;
      const seenSubjectIds = new Set<number>();
      for (let pageNumber = 0; pageNumber < INDEX_CONFIRMATION_MAX_PAGES; pageNumber += 1) {
        const page = await client.getIndexSubjectsByIndexId(input.indexId, {
          limit: INDEX_CONFIRMATION_PAGE_SIZE,
          offset,
        });
        if (!Array.isArray(page.data)) {
          throw new BangumiError(
            'CONFIRMATION_PREVIEW_UNAVAILABLE',
            '无法完整核对目录成员状态；没有执行写入。',
            false,
            409,
          );
        }
        const items = page.data as Array<{
          id: number;
          name?: string;
          name_cn?: string;
          comment?: string;
        }>;
        if (items.length > INDEX_CONFIRMATION_PAGE_SIZE) {
          throw new BangumiError(
            'CONFIRMATION_PREVIEW_UNAVAILABLE',
            '目录成员响应超出确认预览页大小；没有执行写入。',
            false,
            409,
          );
        }
        for (const item of items) {
          if (
            !item ||
            !Number.isSafeInteger(item.id) ||
            item.id <= 0 ||
            (item.name !== undefined && typeof item.name !== 'string') ||
            (item.name_cn !== undefined &&
              item.name_cn !== null &&
              typeof item.name_cn !== 'string') ||
            (item.comment !== undefined &&
              item.comment !== null &&
              typeof item.comment !== 'string') ||
            seenSubjectIds.has(item.id)
          ) {
            throw new BangumiError(
              'CONFIRMATION_PREVIEW_UNAVAILABLE',
              '目录成员响应含有未知或重复条目；没有执行写入。',
              false,
              409,
            );
          }
          seenSubjectIds.add(item.id);
        }
        const sourceTotal =
          typeof page.total === 'number' && Number.isSafeInteger(page.total) && page.total >= 0
            ? page.total
            : undefined;
        if (page.total !== undefined && sourceTotal === undefined) {
          throw new BangumiError(
            'CONFIRMATION_PREVIEW_UNAVAILABLE',
            '目录成员总数无法安全核对；没有执行写入。',
            false,
            409,
          );
        }
        if (sourceTotal !== undefined) {
          if (
            (expectedTotal !== undefined && sourceTotal !== expectedTotal) ||
            offset > sourceTotal ||
            offset + items.length > sourceTotal ||
            (items.length === 0 && offset < sourceTotal)
          ) {
            throw new BangumiError(
              'CONFIRMATION_PREVIEW_UNAVAILABLE',
              '目录成员分页总数前后不一致；没有执行写入。',
              false,
              409,
            );
          }
          expectedTotal = sourceTotal;
        }
        const found = items.find((item) => item.id === input.subjectId);
        membership = found
          ? {
              id: found.id,
              nameCn: found.name_cn || found.name || '',
              comment: found.comment,
            }
          : undefined;
        if (membership) {
          complete = true;
          break;
        }
        if (
          items.length === 0 ||
          (sourceTotal !== undefined && offset + items.length >= sourceTotal)
        ) {
          complete = true;
          break;
        }
        offset += items.length;
      }
      if (!complete) {
        throw new BangumiError(
          'CONFIRMATION_PREVIEW_UNAVAILABLE',
          '目录成员状态超出确认预览上限；没有执行写入。',
          false,
          409,
        );
      }

      const currentState = membership
        ? { present: true, comment: membership.comment ?? null }
        : { present: false };
      const requestedState =
        input.action === 'add_subject'
          ? { present: true, comment: input.comment ?? null }
          : { present: false };
      const subjectLabel = membership?.nameCn || `#${input.subjectId}`;
      const summary = [
        `Bangumi 账号 ${display(account.username)}`,
        `目录 ${display(index.title)}（ID ${input.indexId}）`,
        `条目 ${display(subjectLabel)}（ID ${input.subjectId}）`,
        `当前状态 ${display(currentState)}`,
        `请求状态 ${display(requestedState)}`,
      ].join('；');
      return confirmationPreview(summary, {
        action: input.action,
        indexId: input.indexId,
        subjectId: input.subjectId,
        indexTitle: index.title,
        subjectLabel,
        currentState,
        requestedState,
      });
    },
    execute: async (input, context, deps) => {
      const activeProvider: BangumiClientProvider = deps?.clientProvider || provider;
      const client =
        deps?.executionSession?.client ||
        (await activeProvider.requireAuthenticatedClient(context.principalId, ['write:indices']))
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
  ] as const;
}
