import { GeneratedBangumiOpenApiClient } from '@bangumi-agent-kit/bangumi-openapi';
import {
  HttpClient,
  toPublicError,
  type PublicErrorInfo,
} from '@bangumi-agent-kit/bangumi-transport';
import type { UserCollectionItem } from '../models/user.js';
import type { CollectionStatus } from './collection-service.js';
import { UserService } from './user-service.js';

export const COLLECTION_INTELLIGENCE_FORMULA_VERSION = 'collection-intelligence-v1';
export const COLLECTION_INTELLIGENCE_DEFAULT_MAX_ITEMS = 100;
export const COLLECTION_INTELLIGENCE_MAX_ITEMS = 200;
export const COLLECTION_INTELLIGENCE_PAGE_SIZE = 50;
export const COLLECTION_INTELLIGENCE_MAX_PAGES = 8;
export const COLLECTION_INTELLIGENCE_MAX_TAGS_PER_ITEM = 50;
export const COLLECTION_INTELLIGENCE_MAX_UNIQUE_TAGS = 200;
export const COLLECTION_INTELLIGENCE_MAX_TAG_LENGTH = 64;
export const COLLECTION_INTELLIGENCE_MAX_RECENT_ITEMS = 10;

export type CollectionIntelligenceState = 'complete' | 'partial' | 'unavailable';

export interface CollectionIntelligenceOptions {
  maxItems?: number;
}

export interface CollectionIntelligenceData {
  statusCounts: Record<CollectionStatus, number>;
  subjectTypeCounts: Record<string, number>;
  backlog: {
    total: number;
    wish: number;
    doing: number;
    onHold: number;
  };
  ratings: {
    rated: number;
    average?: number;
    distribution: Array<{ rating: number; count: number }>;
  };
  progress: {
    itemsWithProgress: number;
    completedEpisodes: number;
  };
  tags: {
    distinct: number;
    itemsWithTags: number;
    top: Array<{ tag: string; count: number }>;
  };
  latestObservedUpdates: Array<{
    subjectId: number;
    name: string;
    nameCn?: string;
    subjectType?: string;
    status: CollectionStatus;
    rating?: number;
    epStatus?: number;
    updatedAt: string;
  }>;
}

export interface CollectionIntelligenceCoverage {
  state: CollectionIntelligenceState;
  sourceTotal: number;
  requestedMaxItems: number;
  observedRows: number;
  uniqueItems: number;
  returned: number;
  pageSize: number;
  pagesAttempted: number;
  pagesSucceeded: number;
  maxPages: number;
  truncated: boolean;
  sourceExhausted: boolean;
  duplicateRows: number;
  pageFailureOffset?: number;
  pageFailureCode?: string;
  paginationStalled: boolean;
  sourceTotalChanged: boolean;
  missingFields: Record<string, number>;
  skippedTagValues: number;
}

export interface CollectionIntelligenceResult {
  state: CollectionIntelligenceState;
  data: CollectionIntelligenceData;
  coverage: CollectionIntelligenceCoverage;
  source: {
    class: 'official_v0';
    operation: 'GET /v0/users/{username}/collections';
    authScope: 'account';
    attemptedAt: string;
    retrievedAt?: string;
  };
  evidence: Array<{
    source: 'official_v0' | 'derived';
    operation?: string;
    formulaVersion?: string;
    authScope: 'account';
    attemptedAt?: string;
    retrievedAt?: string;
  }>;
  limitations: string[];
  warnings: Array<{
    code: string;
    state: 'partial' | 'unavailable';
    message: string;
  }>;
  error?: PublicErrorInfo;
}

interface BuildMetadata {
  sourceTotal: number;
  requestedMaxItems: number;
  pageSize: number;
  pagesAttempted: number;
  pagesSucceeded: number;
  maxPages: number;
  sourceExhausted: boolean;
  pageFailureOffset?: number;
  pageFailureCode?: string;
  paginationStalled: boolean;
  sourceTotalChanged: boolean;
  attemptedAt: string;
  retrievedAt?: string;
}

const COLLECTION_STATUSES: CollectionStatus[] = [
  'wish',
  'doing',
  'done',
  'on_hold',
  'dropped',
  'unknown',
];

function boundedMaxItems(value: number | undefined): number {
  if (!Number.isFinite(value)) return COLLECTION_INTELLIGENCE_DEFAULT_MAX_ITEMS;
  return Math.min(COLLECTION_INTELLIGENCE_MAX_ITEMS, Math.max(1, Math.trunc(value as number)));
}

function emptyData(): CollectionIntelligenceData {
  return {
    statusCounts: Object.fromEntries(COLLECTION_STATUSES.map((status) => [status, 0])) as Record<
      CollectionStatus,
      number
    >,
    subjectTypeCounts: {},
    backlog: { total: 0, wish: 0, doing: 0, onHold: 0 },
    ratings: {
      rated: 0,
      distribution: Array.from({ length: 10 }, (_, index) => ({ rating: index + 1, count: 0 })),
    },
    progress: { itemsWithProgress: 0, completedEpisodes: 0 },
    tags: { distinct: 0, itemsWithTags: 0, top: [] },
    latestObservedUpdates: [],
  };
}

function recordMissing(missingFields: Record<string, number>, field: string): void {
  missingFields[field] = (missingFields[field] || 0) + 1;
}

function normalizeTag(tag: string): string | undefined {
  const normalized = tag.trim().replace(/\s+/gu, ' ');
  if (!normalized) return undefined;
  return Array.from(normalized).slice(0, COLLECTION_INTELLIGENCE_MAX_TAG_LENGTH).join('');
}

function uniqueItems(items: readonly UserCollectionItem[]): {
  items: UserCollectionItem[];
  duplicateRows: number;
} {
  const seen = new Set<number>();
  const result: UserCollectionItem[] = [];
  let duplicateRows = 0;
  for (const item of items) {
    if (seen.has(item.subjectId)) {
      duplicateRows += 1;
      continue;
    }
    seen.add(item.subjectId);
    result.push(item);
  }
  return { items: result, duplicateRows };
}

function warningForMissingFields(missingFields: Record<string, number>) {
  const entries = Object.entries(missingFields).filter(([, count]) => count > 0);
  if (!entries.length) return undefined;
  return {
    code: 'MISSING_FIELD',
    state: 'partial' as const,
    message: `部分收藏记录缺少字段：${entries.map(([field, count]) => `${field} ${count}`).join('、')}。对应统计未猜测缺失值。`,
  };
}

function buildData(items: readonly UserCollectionItem[], missingFields: Record<string, number>) {
  const data = emptyData();
  const ratingSums = { total: 0 };
  const tagCounts = new Map<string, number>();
  const updateCandidates: CollectionIntelligenceData['latestObservedUpdates'] = [];
  let skippedTagValues = 0;

  for (const item of items) {
    const status = item.status || 'unknown';
    data.statusCounts[status] += 1;
    const subjectType = item.subjectType?.trim() || 'unknown';
    data.subjectTypeCounts[subjectType] = (data.subjectTypeCounts[subjectType] || 0) + 1;

    if (status === 'wish') data.backlog.wish += 1;
    if (status === 'doing') data.backlog.doing += 1;
    if (status === 'on_hold') data.backlog.onHold += 1;
    data.backlog.total = data.backlog.wish + data.backlog.doing + data.backlog.onHold;

    if (item.rating === undefined) {
      recordMissing(missingFields, 'item.rating');
    } else if (Number.isInteger(item.rating) && item.rating >= 1 && item.rating <= 10) {
      data.ratings.rated += 1;
      ratingSums.total += item.rating;
      data.ratings.distribution[item.rating - 1]!.count += 1;
    } else {
      recordMissing(missingFields, 'item.rating.invalid');
    }

    if (item.epStatus === undefined) {
      recordMissing(missingFields, 'item.ep_status');
    } else if (Number.isInteger(item.epStatus) && item.epStatus >= 0) {
      if (item.epStatus > 0) data.progress.itemsWithProgress += 1;
      data.progress.completedEpisodes += item.epStatus;
    } else {
      recordMissing(missingFields, 'item.ep_status.invalid');
    }

    if (item.tags === undefined) {
      recordMissing(missingFields, 'item.tags');
    } else {
      const tags = item.tags.slice(0, COLLECTION_INTELLIGENCE_MAX_TAGS_PER_ITEM);
      if (item.tags.length > tags.length) skippedTagValues += item.tags.length - tags.length;
      if (tags.length > 0) data.tags.itemsWithTags += 1;
      for (const rawTag of tags) {
        const tag = normalizeTag(rawTag);
        if (
          !tag ||
          tagCounts.has(tag) ||
          tagCounts.size < COLLECTION_INTELLIGENCE_MAX_UNIQUE_TAGS
        ) {
          if (tag) tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        } else {
          skippedTagValues += 1;
        }
      }
    }

    if (!item.updatedAt) {
      recordMissing(missingFields, 'item.updated_at');
    } else if (!Number.isNaN(Date.parse(item.updatedAt))) {
      updateCandidates.push({
        subjectId: item.subjectId,
        name: item.subjectName || `Subject ${item.subjectId}`,
        nameCn: item.subjectNameCn,
        subjectType: item.subjectType,
        status,
        rating: item.rating,
        epStatus: item.epStatus,
        updatedAt: item.updatedAt,
      });
    } else {
      recordMissing(missingFields, 'item.updated_at.invalid');
    }
  }

  data.ratings.average = data.ratings.rated
    ? Number((ratingSums.total / data.ratings.rated).toFixed(2))
    : undefined;
  data.tags.distinct = tagCounts.size;
  data.tags.top = [...tagCounts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((left, right) => right.count - left.count || left.tag.localeCompare(right.tag))
    .slice(0, 12);
  data.latestObservedUpdates = updateCandidates
    .sort(
      (left, right) =>
        Date.parse(right.updatedAt) - Date.parse(left.updatedAt) ||
        left.subjectId - right.subjectId,
    )
    .slice(0, COLLECTION_INTELLIGENCE_MAX_RECENT_ITEMS);

  return { data, skippedTagValues };
}

function buildLimitations(): string[] {
  return [
    '统计只覆盖本次官方收藏接口观察到的有界样本；sourceTotal 大于 observed 时不能代表完整收藏。',
    'latestObservedUpdates 只在已观察记录内按 updated_at 排序，不证明全量收藏的最新活动，也不计算历史趋势。',
    '进度只统计收藏接口中的 ep_status 已完成集数；由于没有逐条目总集数，本结果不计算完成百分比。',
    '结果不读取或返回收藏评论，不执行推荐、口味推断、跨用户比较或任何收藏写入。',
  ];
}

export function buildCollectionIntelligence(
  items: readonly UserCollectionItem[],
  metadata: BuildMetadata,
): CollectionIntelligenceResult {
  const { items: deduplicatedItems, duplicateRows } = uniqueItems(items);
  const missingFields: Record<string, number> = {};
  const { data, skippedTagValues } = buildData(deduplicatedItems, missingFields);
  const truncated = !metadata.sourceExhausted || metadata.sourceTotal > items.length;
  const pageFailure = metadata.pageFailureOffset !== undefined;
  const partial =
    truncated ||
    pageFailure ||
    metadata.paginationStalled ||
    metadata.sourceTotalChanged ||
    duplicateRows > 0 ||
    Object.keys(missingFields).length > 0 ||
    skippedTagValues > 0;
  const state: CollectionIntelligenceState = partial ? 'partial' : 'complete';
  const warnings: CollectionIntelligenceResult['warnings'] = [];
  if (truncated) {
    warnings.push({
      code: 'PARTIAL_SCAN',
      state: 'partial',
      message: `收藏扫描观察到 ${items.length} 行，源报告 ${metadata.sourceTotal} 行；结果受 ${metadata.requestedMaxItems} 条扫描上限和分页边界约束。`,
    });
  }
  if (pageFailure) {
    warnings.push({
      code: 'UPSTREAM_PAGE_FAILURE',
      state: 'partial',
      message: `收藏第 ${metadata.pageFailureOffset} 偏移页读取失败；已保留此前成功读取的数据，未填充缺失记录。`,
    });
  }
  if (metadata.paginationStalled) {
    warnings.push({
      code: 'PAGINATION_STALLED',
      state: 'partial',
      message: '官方收藏分页没有产生新的偏移量；扫描已停止并标记为 partial。',
    });
  }
  if (metadata.sourceTotalChanged) {
    warnings.push({
      code: 'SOURCE_TOTAL_CHANGED',
      state: 'partial',
      message: '分页期间官方 sourceTotal 发生变化；本次聚合只代表观察到的样本。',
    });
  }
  if (duplicateRows > 0) {
    warnings.push({
      code: 'DUPLICATE_ROWS',
      state: 'partial',
      message: `官方分页返回 ${duplicateRows} 行重复收藏；统计已按 subjectId 去重。`,
    });
  }
  if (skippedTagValues > 0) {
    warnings.push({
      code: 'OUTPUT_TRUNCATED',
      state: 'partial',
      message: `标签统计跳过 ${skippedTagValues} 个超出安全上限的标签值。`,
    });
  }
  const missingWarning = warningForMissingFields(missingFields);
  if (missingWarning) warnings.push(missingWarning);

  return {
    state,
    data,
    coverage: {
      state,
      sourceTotal: metadata.sourceTotal,
      requestedMaxItems: metadata.requestedMaxItems,
      observedRows: items.length,
      uniqueItems: deduplicatedItems.length,
      returned: deduplicatedItems.length,
      pageSize: metadata.pageSize,
      pagesAttempted: metadata.pagesAttempted,
      pagesSucceeded: metadata.pagesSucceeded,
      maxPages: metadata.maxPages,
      truncated,
      sourceExhausted: metadata.sourceExhausted,
      duplicateRows,
      pageFailureOffset: metadata.pageFailureOffset,
      pageFailureCode: metadata.pageFailureCode,
      paginationStalled: metadata.paginationStalled,
      sourceTotalChanged: metadata.sourceTotalChanged,
      missingFields,
      skippedTagValues,
    },
    source: {
      class: 'official_v0',
      operation: 'GET /v0/users/{username}/collections',
      authScope: 'account',
      attemptedAt: metadata.attemptedAt,
      retrievedAt: metadata.retrievedAt,
    },
    evidence: [
      {
        source: 'official_v0',
        operation: 'GET /v0/users/{username}/collections',
        authScope: 'account',
        attemptedAt: metadata.attemptedAt,
        retrievedAt: metadata.retrievedAt,
      },
      {
        source: 'derived',
        formulaVersion: COLLECTION_INTELLIGENCE_FORMULA_VERSION,
        authScope: 'account',
        attemptedAt: metadata.attemptedAt,
        retrievedAt: metadata.retrievedAt,
      },
    ],
    limitations: buildLimitations(),
    warnings,
  };
}

function unavailableResult(
  maxItems: number,
  attemptedAt: string,
  error: PublicErrorInfo,
): CollectionIntelligenceResult {
  return {
    state: 'unavailable',
    data: emptyData(),
    coverage: {
      state: 'unavailable',
      sourceTotal: 0,
      requestedMaxItems: maxItems,
      observedRows: 0,
      uniqueItems: 0,
      returned: 0,
      pageSize: Math.min(COLLECTION_INTELLIGENCE_PAGE_SIZE, maxItems),
      pagesAttempted: 1,
      pagesSucceeded: 0,
      maxPages: COLLECTION_INTELLIGENCE_MAX_PAGES,
      truncated: false,
      sourceExhausted: false,
      duplicateRows: 0,
      paginationStalled: false,
      sourceTotalChanged: false,
      missingFields: {},
      skippedTagValues: 0,
    },
    source: {
      class: 'official_v0',
      operation: 'GET /v0/users/{username}/collections',
      authScope: 'account',
      attemptedAt,
    },
    evidence: [
      {
        source: 'official_v0',
        operation: 'GET /v0/users/{username}/collections',
        authScope: 'account',
        attemptedAt,
      },
    ],
    limitations: buildLimitations(),
    warnings: [
      {
        code: error.code,
        state: 'unavailable',
        message: '官方收藏源暂时不可用，未生成猜测的收藏统计。',
      },
    ],
    error,
  };
}

export class CollectionIntelligenceService {
  private readonly userService: UserService;

  constructor(client: GeneratedBangumiOpenApiClient | HttpClient) {
    this.userService = new UserService(client);
  }

  async getCollectionIntelligence(
    username: string,
    options: CollectionIntelligenceOptions = {},
  ): Promise<CollectionIntelligenceResult> {
    const maxItems = boundedMaxItems(options.maxItems);
    const pageSize = Math.min(COLLECTION_INTELLIGENCE_PAGE_SIZE, maxItems);
    const attemptedAt = new Date().toISOString();
    const items: UserCollectionItem[] = [];
    let sourceTotal = 0;
    let pagesAttempted = 0;
    let pagesSucceeded = 0;
    let offset = 0;
    let sourceExhausted = false;
    let pageFailureOffset: number | undefined;
    let pageFailureCode: string | undefined;
    let paginationStalled = false;
    let sourceTotalChanged = false;

    while (
      items.length < maxItems &&
      pagesAttempted < COLLECTION_INTELLIGENCE_MAX_PAGES &&
      !sourceExhausted
    ) {
      pagesAttempted += 1;
      const requested = Math.min(pageSize, maxItems - items.length);
      try {
        const page = await this.userService.getUserCollections(username, {
          limit: requested,
          offset,
        });
        pagesSucceeded += 1;
        if (pagesSucceeded === 1) sourceTotal = page.total;
        else if (page.total !== sourceTotal) {
          sourceTotalChanged = true;
          sourceTotal = Math.max(sourceTotal, page.total);
        }
        const pageItems = page.items.slice(0, requested);
        items.push(...pageItems);
        if (pageItems.length === 0 || sourceTotal <= items.length) {
          sourceExhausted = true;
          continue;
        }
        const nextOffset = page.offset + pageItems.length;
        if (nextOffset <= offset) {
          paginationStalled = true;
          continue;
        }
        offset = nextOffset;
      } catch (error: unknown) {
        pageFailureOffset = offset;
        pageFailureCode = toPublicError(error).code;
        if (pagesSucceeded === 0)
          return unavailableResult(maxItems, attemptedAt, toPublicError(error));
        break;
      }
    }

    const retrievedAt = new Date().toISOString();
    return buildCollectionIntelligence(items, {
      sourceTotal,
      requestedMaxItems: maxItems,
      pageSize,
      pagesAttempted,
      pagesSucceeded,
      maxPages: COLLECTION_INTELLIGENCE_MAX_PAGES,
      sourceExhausted,
      pageFailureOffset,
      pageFailureCode,
      paginationStalled,
      sourceTotalChanged,
      attemptedAt,
      retrievedAt,
    });
  }
}
