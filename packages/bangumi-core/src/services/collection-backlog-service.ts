import { GeneratedBangumiOpenApiClient } from '@bangumi-agent-kit/bangumi-openapi';
import { HttpClient, PublicErrorInfo, toPublicError } from '@bangumi-agent-kit/bangumi-transport';
import { CollectionStatus } from './collection-service.js';
import { UserService } from './user-service.js';
import { UserCollectionItem, UserEpisodeCollectionItem } from '../models/user.js';

export const COLLECTION_BACKLOG_FORMULA_VERSION = 'collection-backlog-v1';
export const COLLECTION_BACKLOG_DEFAULT_MAX_ITEMS = 50;
export const COLLECTION_BACKLOG_MAX_ITEMS = 100;
export const COLLECTION_BACKLOG_DEFAULT_MAX_SUBJECTS = 20;
export const COLLECTION_BACKLOG_MAX_SUBJECTS = 30;
export const COLLECTION_BACKLOG_DEFAULT_MAX_EPISODES_PER_SUBJECT = 200;
export const COLLECTION_BACKLOG_MAX_EPISODES_PER_SUBJECT = 1000;
export const COLLECTION_BACKLOG_COLLECTION_PAGE_SIZE = 50;
export const COLLECTION_BACKLOG_MAX_COLLECTION_PAGES = 8;
export const COLLECTION_BACKLOG_EPISODE_PAGE_SIZE = 100;
export const COLLECTION_BACKLOG_MAX_EPISODE_PAGES = 10;
export const COLLECTION_BACKLOG_MAX_CONCURRENCY = 3;

export type CollectionBacklogState =
  'complete' | 'partial' | 'unavailable' | 'not_computable' | 'conflict';

export type CollectionBacklogRowState =
  'complete' | 'partial' | 'unavailable' | 'not_computable' | 'conflict';

export type CollectionBacklogStatus = Exclude<CollectionStatus, 'unknown'>;

export interface CollectionBacklogOptions {
  maxItems?: number;
  maxSubjects?: number;
  maxEpisodesPerSubject?: number;
  statuses?: CollectionBacklogStatus[];
}

export interface CollectionBacklogItem {
  subjectId: number;
  name: string;
  nameCn?: string;
  subjectType?: string;
  subjectDate?: string;
  subjectImage?: string;
  status: CollectionBacklogStatus;
  statusLabel?: string;
  sourceReportedEpisodes?: number;
  collectionReportedEpisodes?: number;
  watchedEpisodes?: number;
  wishEpisodes?: number;
  droppedEpisodes?: number;
  observedProgressRows: number;
  remainingEpisodes?: number;
  completionPercentage?: number;
  state: CollectionBacklogRowState;
  reasons: string[];
  progressCoverage: {
    sourceTotal?: number;
    observedRows: number;
    pagesAttempted: number;
    pagesSucceeded: number;
    sourceExhausted: boolean;
    truncated: boolean;
    duplicateRows: number;
    paginationStalled: boolean;
  };
}

export interface CollectionBacklogData {
  items: CollectionBacklogItem[];
  summary: {
    eligibleItems: number;
    returnedItems: number;
    completeItems: number;
    incompleteItems: number;
    notComputableItems: number;
    unavailableItems: number;
    conflictItems: number;
    knownRemainingEpisodes: number;
  };
}

export interface CollectionBacklogCoverage {
  state: CollectionBacklogState;
  collection: {
    sourceTotal?: number;
    requestedMaxItems: number;
    observedRows: number;
    uniqueRows: number;
    eligibleRows: number;
    pagesAttempted: number;
    pagesSucceeded: number;
    maxPages: number;
    sourceExhausted: boolean;
    truncated: boolean;
    duplicateRows: number;
    pageFailureOffset?: number;
    pageFailureCode?: string;
    paginationStalled: boolean;
    sourceTotalChanged: boolean;
  };
  hydration: {
    requestedSubjects: number;
    attemptedSubjects: number;
    succeededSubjects: number;
    failedSubjects: number;
    maxSubjects: number;
    concurrency: number;
    budgetExceeded: boolean;
  };
  episodeProgress: {
    maxEpisodesPerSubject: number;
    pagesAttempted: number;
    pagesSucceeded: number;
    observedRows: number;
    truncatedSubjects: number;
    failedSubjects: number;
  };
}

export interface CollectionBacklogResult {
  state: CollectionBacklogState;
  data: CollectionBacklogData;
  coverage: CollectionBacklogCoverage;
  source: {
    class: 'official_v0';
    operations: [
      'GET /v0/users/{username}/collections',
      'GET /v0/users/-/collections/{subject_id}/episodes',
    ];
    authScope: 'account';
    attemptedAt: string;
    retrievedAt?: string;
  };
  evidence: Array<{
    source: 'official_v0' | 'derived';
    operations: string[];
    formulaVersion?: string;
    authScope: 'account';
    attemptedAt?: string;
    retrievedAt?: string;
  }>;
  limitations: string[];
  warnings: Array<{
    code: string;
    state: CollectionBacklogState;
    message: string;
  }>;
  error?: PublicErrorInfo;
}

interface CollectionScan {
  items: UserCollectionItem[];
  sourceTotal?: number;
  requestedMaxItems: number;
  pagesAttempted: number;
  pagesSucceeded: number;
  sourceExhausted: boolean;
  truncated: boolean;
  duplicateRows: number;
  pageFailureOffset?: number;
  pageFailureCode?: string;
  paginationStalled: boolean;
  sourceTotalChanged: boolean;
}

interface EpisodeProgressScan {
  items: UserEpisodeCollectionItem[];
  sourceTotal?: number;
  pagesAttempted: number;
  pagesSucceeded: number;
  sourceExhausted: boolean;
  truncated: boolean;
  duplicateRows: number;
  paginationStalled: boolean;
}

interface HydratedRow {
  item: CollectionBacklogItem;
  progress: EpisodeProgressScan;
  error?: PublicErrorInfo;
}

function bounded(value: number | undefined, fallback: number, maximum: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(1, Math.trunc(value as number)));
}

function isValidStatus(status: CollectionStatus): status is CollectionBacklogStatus {
  return status !== 'unknown';
}

function defaultStatuses(): CollectionBacklogStatus[] {
  return ['wish', 'doing', 'on_hold'];
}

function emptyData(): CollectionBacklogData {
  return {
    items: [],
    summary: {
      eligibleItems: 0,
      returnedItems: 0,
      completeItems: 0,
      incompleteItems: 0,
      notComputableItems: 0,
      unavailableItems: 0,
      conflictItems: 0,
      knownRemainingEpisodes: 0,
    },
  };
}

function buildLimitations(): string[] {
  return [
    '结果只覆盖当前账号收藏接口观察到的有界动画收藏样本；超过 collection scan 和 hydration 上限的条目不会被猜测补全。',
    'sourceReportedEpisodes 来自收藏接口的 SlimSubject.eps；它是源报告的集数口径，不等同于 Bangumi 发布的完整观看顺序或未来排播计划。',
    'remainingEpisodes = sourceReportedEpisodes - watched main episodes；仅在 episode collection 分页完整、总集数有效且来源字段没有冲突时计算。',
    '仅请求正篇（episode_type=0）；SP、OP、ED、PV、MAD 和其他章节不会消耗正篇完成度分子或分母。',
    '结果不读取或返回收藏评论、历史状态、日历计划、推荐、口味推断、跨用户比较或任何收藏写入。',
    'collection.updated_at 与 episode.updated_at 只作为源字段；不能解释为可靠的收藏活动或观看事件时间。',
  ];
}

function emptyCoverage(
  state: CollectionBacklogState,
  options: {
    maxItems: number;
    maxSubjects: number;
    maxEpisodesPerSubject: number;
  },
): CollectionBacklogCoverage {
  return {
    state,
    collection: {
      requestedMaxItems: options.maxItems,
      observedRows: 0,
      uniqueRows: 0,
      eligibleRows: 0,
      pagesAttempted: 0,
      pagesSucceeded: 0,
      maxPages: COLLECTION_BACKLOG_MAX_COLLECTION_PAGES,
      sourceExhausted: false,
      truncated: false,
      duplicateRows: 0,
      paginationStalled: false,
      sourceTotalChanged: false,
    },
    hydration: {
      requestedSubjects: 0,
      attemptedSubjects: 0,
      succeededSubjects: 0,
      failedSubjects: 0,
      maxSubjects: options.maxSubjects,
      concurrency: COLLECTION_BACKLOG_MAX_CONCURRENCY,
      budgetExceeded: false,
    },
    episodeProgress: {
      maxEpisodesPerSubject: options.maxEpisodesPerSubject,
      pagesAttempted: 0,
      pagesSucceeded: 0,
      observedRows: 0,
      truncatedSubjects: 0,
      failedSubjects: 0,
    },
  };
}

function uniqueCollectionItems(items: readonly UserCollectionItem[]): {
  items: UserCollectionItem[];
  duplicateRows: number;
} {
  const seen = new Set<number>();
  const unique: UserCollectionItem[] = [];
  let duplicateRows = 0;
  for (const item of items) {
    if (seen.has(item.subjectId)) {
      duplicateRows += 1;
      continue;
    }
    seen.add(item.subjectId);
    unique.push(item);
  }
  return { items: unique, duplicateRows };
}

function buildRow(
  collection: UserCollectionItem,
  progress: EpisodeProgressScan,
  maxEpisodesPerSubject: number,
): CollectionBacklogItem {
  const reasons: string[] = [];
  const progressRows = progress.items;
  const uniqueProgress = new Map<number, UserEpisodeCollectionItem>();
  for (const row of progressRows) {
    const episodeId = row.episode?.id;
    if (episodeId !== undefined && !uniqueProgress.has(episodeId)) {
      uniqueProgress.set(episodeId, row);
    }
    if (!row.episode) reasons.push('episode progress row lacks episode metadata');
    if (row.episode && row.episode.category !== 'main') {
      reasons.push('episode collection returned a non-main episode despite episode_type=0');
    }
  }

  const mainRows = [...uniqueProgress.values()].filter((row) => row.episode?.category === 'main');
  const watchedEpisodes = mainRows.filter((row) => row.type === 2).length;
  const wishEpisodes = mainRows.filter((row) => row.type === 1).length;
  const droppedEpisodes = mainRows.filter((row) => row.type === 3).length;
  const sourceReportedEpisodes = collection.subjectTotalEpisodes;
  const collectionReportedEpisodes = collection.epStatus;
  const hasInvalidTotal =
    sourceReportedEpisodes !== undefined &&
    (!Number.isInteger(sourceReportedEpisodes) || sourceReportedEpisodes <= 0);
  const progressMismatch =
    collectionReportedEpisodes !== undefined &&
    Number.isInteger(collectionReportedEpisodes) &&
    collectionReportedEpisodes >= 0 &&
    collectionReportedEpisodes !== watchedEpisodes;
  const progressComplete =
    progress.sourceExhausted &&
    !progress.truncated &&
    !progress.paginationStalled &&
    progress.sourceTotal !== undefined &&
    progress.duplicateRows === 0 &&
    progressRows.every((row) => row.episode?.category === 'main');

  let state: CollectionBacklogRowState = 'complete';
  if (progressMismatch) {
    state = 'conflict';
    reasons.push(
      `collection ep_status (${collectionReportedEpisodes}) 与 episode collection 已看正篇数 (${watchedEpisodes}) 不一致`,
    );
  }
  if (hasInvalidTotal || sourceReportedEpisodes === undefined) {
    state = state === 'conflict' ? state : 'not_computable';
    reasons.push('收藏记录没有有效的源报告正篇总数');
  }
  if (!progressComplete) {
    state = state === 'conflict' ? state : 'partial';
    if (progress.truncated)
      reasons.push(`episode collection 超过每条目 ${maxEpisodesPerSubject} 行上限`);
    if (progress.paginationStalled) reasons.push('episode collection 分页没有产生新的偏移量');
    if (progress.sourceTotal === undefined) reasons.push('episode collection 没有可验证的源总数');
    if (progress.duplicateRows > 0) reasons.push('episode collection 返回了重复章节');
  }
  if (reasons.some((reason) => reason.includes('lacks episode metadata'))) {
    state = state === 'conflict' ? state : 'partial';
  }

  const canCompute =
    state === 'complete' &&
    sourceReportedEpisodes !== undefined &&
    sourceReportedEpisodes >= watchedEpisodes;
  if (sourceReportedEpisodes !== undefined && sourceReportedEpisodes < watchedEpisodes) {
    state = 'conflict';
    reasons.push(`源报告正篇总数 (${sourceReportedEpisodes}) 小于已看正篇数 (${watchedEpisodes})`);
  }

  if (state === 'complete' && !canCompute) state = 'not_computable';

  const uniqueReasons = [...new Set(reasons)];
  return {
    subjectId: collection.subjectId,
    name: collection.subjectName || `Subject ${collection.subjectId}`,
    nameCn: collection.subjectNameCn,
    subjectType: collection.subjectType,
    subjectDate: collection.subjectDate,
    subjectImage: collection.subjectImage,
    status: collection.status as CollectionBacklogStatus,
    statusLabel: collection.statusLabel,
    sourceReportedEpisodes,
    collectionReportedEpisodes,
    watchedEpisodes,
    wishEpisodes,
    droppedEpisodes,
    observedProgressRows: progressRows.length,
    remainingEpisodes: canCompute ? sourceReportedEpisodes - watchedEpisodes : undefined,
    completionPercentage: canCompute
      ? Number(((watchedEpisodes / sourceReportedEpisodes) * 100).toFixed(1))
      : undefined,
    state,
    reasons: uniqueReasons,
    progressCoverage: {
      sourceTotal: progress.sourceTotal,
      observedRows: progressRows.length,
      pagesAttempted: progress.pagesAttempted,
      pagesSucceeded: progress.pagesSucceeded,
      sourceExhausted: progress.sourceExhausted,
      truncated: progress.truncated,
      duplicateRows: progress.duplicateRows,
      paginationStalled: progress.paginationStalled,
    },
  };
}

function buildUnavailableRow(
  collection: UserCollectionItem,
  error: PublicErrorInfo,
): CollectionBacklogItem {
  return {
    subjectId: collection.subjectId,
    name: collection.subjectName || `Subject ${collection.subjectId}`,
    nameCn: collection.subjectNameCn,
    subjectType: collection.subjectType,
    subjectDate: collection.subjectDate,
    subjectImage: collection.subjectImage,
    status: collection.status as CollectionBacklogStatus,
    statusLabel: collection.statusLabel,
    sourceReportedEpisodes: collection.subjectTotalEpisodes,
    collectionReportedEpisodes: collection.epStatus,
    observedProgressRows: 0,
    state: 'unavailable',
    reasons: [error.code],
    progressCoverage: {
      observedRows: 0,
      pagesAttempted: 1,
      pagesSucceeded: 0,
      sourceExhausted: false,
      truncated: false,
      duplicateRows: 0,
      paginationStalled: false,
    },
  };
}

async function scanCollection(
  userService: UserService,
  username: string,
  maxItems: number,
): Promise<CollectionScan> {
  const items: UserCollectionItem[] = [];
  let sourceTotal: number | undefined;
  let pagesAttempted = 0;
  let pagesSucceeded = 0;
  let offset = 0;
  let sourceExhausted = false;
  let truncated = false;
  let pageFailureOffset: number | undefined;
  let pageFailureCode: string | undefined;
  let paginationStalled = false;
  let sourceTotalChanged = false;
  let sourceTotalInvalidated = false;

  while (
    items.length < maxItems &&
    pagesAttempted < COLLECTION_BACKLOG_MAX_COLLECTION_PAGES &&
    !sourceExhausted
  ) {
    pagesAttempted += 1;
    const requested = Math.min(COLLECTION_BACKLOG_COLLECTION_PAGE_SIZE, maxItems - items.length);
    try {
      const page = await userService.getUserCollections(username, {
        subjectType: 'anime',
        limit: requested,
        offset,
      });
      pagesSucceeded += 1;
      if (pagesSucceeded === 1) {
        sourceTotal = page.total;
      } else if (!sourceTotalInvalidated && page.total !== sourceTotal) {
        sourceTotalChanged = true;
        sourceTotal = undefined;
        sourceTotalInvalidated = true;
      }
      const pageItems = page.items.slice(0, requested);
      items.push(...pageItems);
      if (pageItems.length === 0 || (sourceTotal !== undefined && sourceTotal <= items.length)) {
        sourceExhausted = true;
        continue;
      }
      const nextOffset = page.offset + pageItems.length;
      if (nextOffset <= offset) {
        paginationStalled = true;
        break;
      }
      offset = nextOffset;
    } catch (error: unknown) {
      pageFailureOffset = offset;
      pageFailureCode = toPublicError(error).code;
      if (pagesSucceeded === 0) throw error;
      break;
    }
  }

  truncated =
    !sourceExhausted ||
    sourceTotal === undefined ||
    sourceTotal > items.length ||
    pageFailureOffset !== undefined ||
    paginationStalled ||
    sourceTotalChanged;

  const unique = uniqueCollectionItems(items);
  return {
    items: unique.items,
    sourceTotal,
    requestedMaxItems: maxItems,
    pagesAttempted,
    pagesSucceeded,
    sourceExhausted,
    truncated,
    duplicateRows: unique.duplicateRows,
    pageFailureOffset,
    pageFailureCode,
    paginationStalled,
    sourceTotalChanged,
  };
}

async function scanEpisodeProgress(
  userService: UserService,
  subjectId: number,
  maxEpisodes: number,
): Promise<EpisodeProgressScan> {
  const items: UserEpisodeCollectionItem[] = [];
  let sourceTotal: number | undefined;
  let pagesAttempted = 0;
  let pagesSucceeded = 0;
  let offset = 0;
  let sourceExhausted = false;
  let paginationStalled = false;

  while (
    items.length < maxEpisodes &&
    pagesAttempted < COLLECTION_BACKLOG_MAX_EPISODE_PAGES &&
    !sourceExhausted
  ) {
    pagesAttempted += 1;
    const requested = Math.min(COLLECTION_BACKLOG_EPISODE_PAGE_SIZE, maxEpisodes - items.length);
    const page = await userService.getUserEpisodeCollections(subjectId, {
      episodeType: 0,
      limit: requested,
      offset,
    });
    pagesSucceeded += 1;
    if (pagesSucceeded === 1) sourceTotal = page.total;
    const pageItems = page.items.slice(0, requested);
    items.push(...pageItems);
    if (pageItems.length === 0 || (sourceTotal !== undefined && sourceTotal <= items.length)) {
      sourceExhausted = true;
      continue;
    }
    const nextOffset = page.offset + pageItems.length;
    if (nextOffset <= offset) {
      paginationStalled = true;
      break;
    }
    offset = nextOffset;
  }

  const seen = new Set<number>();
  let duplicateRows = 0;
  for (const item of items) {
    const episodeId = item.episode?.id;
    if (episodeId === undefined) continue;
    if (seen.has(episodeId)) duplicateRows += 1;
    seen.add(episodeId);
  }
  const truncated =
    !sourceExhausted ||
    sourceTotal === undefined ||
    sourceTotal > items.length ||
    paginationStalled;
  return {
    items,
    sourceTotal,
    pagesAttempted,
    pagesSucceeded,
    sourceExhausted,
    truncated,
    duplicateRows,
    paginationStalled,
  };
}

async function mapConcurrent<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const current = index++;
      const item = items[current];
      if (item !== undefined) results[current] = await fn(item);
    }
  });
  await Promise.all(workers);
  return results;
}

function summarize(items: CollectionBacklogItem[], eligibleItems: number): CollectionBacklogData {
  const summary = {
    eligibleItems,
    returnedItems: items.length,
    completeItems: items.filter((item) => item.state === 'complete').length,
    incompleteItems: items.filter(
      (item) => item.remainingEpisodes !== undefined && item.remainingEpisodes > 0,
    ).length,
    notComputableItems: items.filter((item) => item.state === 'not_computable').length,
    unavailableItems: items.filter((item) => item.state === 'unavailable').length,
    conflictItems: items.filter((item) => item.state === 'conflict').length,
    knownRemainingEpisodes: items.reduce(
      (total, item) => total + (item.remainingEpisodes === undefined ? 0 : item.remainingEpisodes),
      0,
    ),
  };
  return { items, summary };
}

function resultState(
  scan: CollectionScan,
  hydrationBudgetExceeded: boolean,
  rows: CollectionBacklogItem[],
): CollectionBacklogState {
  const hasConflict = rows.some((row) => row.state === 'conflict');
  if (hasConflict) return 'conflict';
  if (rows.length > 0 && rows.every((row) => row.state === 'not_computable')) {
    return 'not_computable';
  }
  if (
    scan.truncated ||
    hydrationBudgetExceeded ||
    scan.pageFailureOffset !== undefined ||
    rows.some(
      (row) =>
        row.state === 'partial' || row.state === 'unavailable' || row.state === 'not_computable',
    )
  ) {
    return 'partial';
  }
  return 'complete';
}

function warningForScan(scan: CollectionScan): CollectionBacklogResult['warnings'] {
  const warnings: CollectionBacklogResult['warnings'] = [];
  if (scan.truncated) {
    warnings.push({
      code: 'PARTIAL_COLLECTION_SCAN',
      state: 'partial',
      message: `收藏扫描观察到 ${scan.items.length} 行，源报告 ${scan.sourceTotal ?? '未知'} 行；结果受扫描上限或分页边界约束。`,
    });
  }
  if (scan.pageFailureOffset !== undefined) {
    warnings.push({
      code: 'COLLECTION_PAGE_FAILURE',
      state: 'partial',
      message: `收藏第 ${scan.pageFailureOffset} 偏移页读取失败；已保留此前成功读取的数据。`,
    });
  }
  if (scan.paginationStalled) {
    warnings.push({
      code: 'COLLECTION_PAGINATION_STALLED',
      state: 'partial',
      message: '官方收藏分页没有产生新的偏移量；扫描已停止。',
    });
  }
  if (scan.sourceTotalChanged) {
    warnings.push({
      code: 'COLLECTION_SOURCE_TOTAL_CHANGED',
      state: 'partial',
      message: '分页期间官方收藏 sourceTotal 发生变化；本次聚合只代表观察到的样本。',
    });
  }
  if (scan.duplicateRows > 0) {
    warnings.push({
      code: 'COLLECTION_DUPLICATE_ROWS',
      state: 'partial',
      message: `官方收藏分页返回 ${scan.duplicateRows} 行重复条目；统计已按 subjectId 去重。`,
    });
  }
  return warnings;
}

export class CollectionBacklogService {
  private readonly userService: UserService;

  constructor(client: GeneratedBangumiOpenApiClient | HttpClient) {
    this.userService = new UserService(client);
  }

  async getCollectionBacklog(
    username: string,
    options: CollectionBacklogOptions = {},
  ): Promise<CollectionBacklogResult> {
    const maxItems = bounded(
      options.maxItems,
      COLLECTION_BACKLOG_DEFAULT_MAX_ITEMS,
      COLLECTION_BACKLOG_MAX_ITEMS,
    );
    const maxSubjects = bounded(
      options.maxSubjects,
      COLLECTION_BACKLOG_DEFAULT_MAX_SUBJECTS,
      COLLECTION_BACKLOG_MAX_SUBJECTS,
    );
    const maxEpisodesPerSubject = bounded(
      options.maxEpisodesPerSubject,
      COLLECTION_BACKLOG_DEFAULT_MAX_EPISODES_PER_SUBJECT,
      COLLECTION_BACKLOG_MAX_EPISODES_PER_SUBJECT,
    );
    const statuses = new Set<CollectionBacklogStatus>(options.statuses || defaultStatuses());
    const attemptedAt = new Date().toISOString();

    let scan: CollectionScan;
    try {
      scan = await scanCollection(this.userService, username, maxItems);
    } catch (error: unknown) {
      const publicError = toPublicError(error);
      return {
        state: 'unavailable',
        data: emptyData(),
        coverage: emptyCoverage('unavailable', { maxItems, maxSubjects, maxEpisodesPerSubject }),
        source: {
          class: 'official_v0',
          operations: [
            'GET /v0/users/{username}/collections',
            'GET /v0/users/-/collections/{subject_id}/episodes',
          ],
          authScope: 'account',
          attemptedAt,
        },
        evidence: [
          {
            source: 'official_v0',
            operations: ['GET /v0/users/{username}/collections'],
            authScope: 'account',
            attemptedAt,
          },
        ],
        limitations: buildLimitations(),
        warnings: [
          {
            code: publicError.code,
            state: 'unavailable',
            message: '官方收藏源暂时不可用，未生成猜测的 backlog 统计。',
          },
        ],
        error: publicError,
      };
    }

    const eligible = scan.items.filter(
      (item): item is UserCollectionItem & { status: CollectionBacklogStatus } =>
        isValidStatus(item.status) && statuses.has(item.status),
    );
    const toHydrate = eligible.slice(0, maxSubjects);
    const hydrationBudgetExceeded = eligible.length > toHydrate.length;
    const hydrated = await mapConcurrent(
      toHydrate,
      COLLECTION_BACKLOG_MAX_CONCURRENCY,
      async (item) => {
        try {
          const progress = await scanEpisodeProgress(
            this.userService,
            item.subjectId,
            maxEpisodesPerSubject,
          );
          return {
            item: buildRow(item, progress, maxEpisodesPerSubject),
            progress,
          } satisfies HydratedRow;
        } catch (error: unknown) {
          const publicError = toPublicError(error);
          return {
            item: buildUnavailableRow(item, publicError),
            progress: {
              items: [],
              pagesAttempted: 1,
              pagesSucceeded: 0,
              sourceExhausted: false,
              truncated: false,
              duplicateRows: 0,
              paginationStalled: false,
            },
            error: publicError,
          } satisfies HydratedRow;
        }
      },
    );

    const rows = hydrated.map((entry) => entry.item);
    const state = resultState(scan, hydrationBudgetExceeded, rows);
    const data = summarize(rows, eligible.length);
    const warnings = warningForScan(scan);
    if (hydrationBudgetExceeded) {
      warnings.push({
        code: 'HYDRATION_BUDGET_EXCEEDED',
        state: 'partial',
        message: `符合状态过滤的收藏有 ${eligible.length} 条，仅对前 ${toHydrate.length} 条执行 episode collection 读取。`,
      });
    }
    const unavailableCount = rows.filter((row) => row.state === 'unavailable').length;
    if (unavailableCount > 0) {
      warnings.push({
        code: 'EPISODE_COLLECTION_FAILURE',
        state: 'partial',
        message: `${unavailableCount} 个条目的 episode collection 不可用；对应条目未填充猜测的进度。`,
      });
    }
    const partialCount = rows.filter((row) => row.state === 'partial').length;
    if (partialCount > 0) {
      warnings.push({
        code: 'PARTIAL_EPISODE_PROGRESS',
        state: 'partial',
        message: `${partialCount} 个条目的 episode collection 覆盖不完整；对应完成度未作为精确值输出。`,
      });
    }
    const conflictCount = rows.filter((row) => row.state === 'conflict').length;
    if (conflictCount > 0) {
      warnings.push({
        code: 'PROGRESS_CONFLICT',
        state: 'conflict',
        message: `${conflictCount} 个条目的收藏 ep_status 与 episode collection 读数冲突；对应完成度未采用任一单一来源。`,
      });
    }
    if (rows.some((row) => row.state === 'not_computable')) {
      warnings.push({
        code: 'NOT_COMPUTABLE_ROWS',
        state: 'not_computable',
        message: '部分条目缺少有效源报告正篇总数，无法计算剩余集数或完成百分比。',
      });
    }

    const retrievedAt = new Date().toISOString();
    const coverage: CollectionBacklogCoverage = {
      state,
      collection: {
        sourceTotal: scan.sourceTotal,
        requestedMaxItems: scan.requestedMaxItems,
        observedRows: scan.items.length,
        uniqueRows: scan.items.length,
        eligibleRows: eligible.length,
        pagesAttempted: scan.pagesAttempted,
        pagesSucceeded: scan.pagesSucceeded,
        maxPages: COLLECTION_BACKLOG_MAX_COLLECTION_PAGES,
        sourceExhausted: scan.sourceExhausted,
        truncated: scan.truncated,
        duplicateRows: scan.duplicateRows,
        pageFailureOffset: scan.pageFailureOffset,
        pageFailureCode: scan.pageFailureCode,
        paginationStalled: scan.paginationStalled,
        sourceTotalChanged: scan.sourceTotalChanged,
      },
      hydration: {
        requestedSubjects: eligible.length,
        attemptedSubjects: hydrated.length,
        succeededSubjects: hydrated.filter((entry) => !entry.error).length,
        failedSubjects: hydrated.filter((entry) => Boolean(entry.error)).length,
        maxSubjects,
        concurrency: COLLECTION_BACKLOG_MAX_CONCURRENCY,
        budgetExceeded: hydrationBudgetExceeded,
      },
      episodeProgress: {
        maxEpisodesPerSubject,
        pagesAttempted: hydrated.reduce((total, entry) => total + entry.progress.pagesAttempted, 0),
        pagesSucceeded: hydrated.reduce((total, entry) => total + entry.progress.pagesSucceeded, 0),
        observedRows: hydrated.reduce((total, entry) => total + entry.progress.items.length, 0),
        truncatedSubjects: hydrated.filter((entry) => entry.progress.truncated).length,
        failedSubjects: hydrated.filter((entry) => Boolean(entry.error)).length,
      },
    };

    return {
      state,
      data,
      coverage,
      source: {
        class: 'official_v0',
        operations: [
          'GET /v0/users/{username}/collections',
          'GET /v0/users/-/collections/{subject_id}/episodes',
        ],
        authScope: 'account',
        attemptedAt,
        retrievedAt,
      },
      evidence: [
        {
          source: 'official_v0',
          operations: [
            'GET /v0/users/{username}/collections',
            'GET /v0/users/-/collections/{subject_id}/episodes',
          ],
          authScope: 'account',
          attemptedAt,
          retrievedAt,
        },
        {
          source: 'derived',
          operations: [
            'sourceReportedEpisodes - watched main episodes',
            'watched main episodes / sourceReportedEpisodes',
          ],
          formulaVersion: COLLECTION_BACKLOG_FORMULA_VERSION,
          authScope: 'account',
          attemptedAt,
          retrievedAt,
        },
      ],
      limitations: buildLimitations(),
      warnings,
    };
  }
}
