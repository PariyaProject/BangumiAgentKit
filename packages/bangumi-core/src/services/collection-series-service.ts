import { GeneratedBangumiOpenApiClient } from '@bangumi-agent-kit/bangumi-openapi';
import {
  HttpClient,
  toPublicError,
  type PublicErrorInfo,
} from '@bangumi-agent-kit/bangumi-transport';
import { SubjectService } from './subject-service.js';
import { UserService } from './user-service.js';
import type { UserCollectionItem } from '../models/user.js';

export const COLLECTION_SERIES_FORMULA_VERSION = 'collection-series-groups-v1';

export const COLLECTION_SERIES_DEFAULTS = {
  maxItems: 100,
  maxRelationSubjects: 24,
  maxRelationsPerSubject: 64,
  maxGroups: 24,
  maxEdges: 96,
} as const;

export const COLLECTION_SERIES_LIMITS = {
  maxItems: 100,
  maxRelationSubjects: 36,
  maxRelationsPerSubject: 96,
  maxGroups: 36,
  maxEdges: 144,
  pageSize: 50,
  maxPages: 8,
  relationConcurrency: 3,
  maxEvidenceSamples: 12,
} as const;

const STABLE_RELATION_KINDS = ['prequel', 'sequel', 'side_story', 'recap'] as const;

export type CollectionSeriesStableRelationKind = (typeof STABLE_RELATION_KINDS)[number];

export type CollectionSeriesRelationKind =
  | CollectionSeriesStableRelationKind
  | 'source'
  | 'adaptation'
  | 'book'
  | 'music'
  | 'game'
  | 'real'
  | 'other'
  | 'unknown';

export type CollectionSeriesStatus = 'wish' | 'doing' | 'done' | 'on_hold' | 'dropped';

export type CollectionSeriesState =
  | 'complete'
  | 'partial'
  | 'conflict'
  | 'unavailable'
  | 'auth_required'
  | 'permission_denied'
  | 'rate_limited'
  | 'upstream_error';

export interface CollectionSeriesOptions {
  maxItems?: number;
  maxRelationSubjects?: number;
  maxRelationsPerSubject?: number;
  maxGroups?: number;
  maxEdges?: number;
  statuses?: CollectionSeriesStatus[];
  signal?: AbortSignal;
}

export interface CollectionSeriesCollectionItem {
  subjectId: number;
  subjectName?: string;
  subjectNameCn?: string;
  subjectType?: string;
  status: CollectionSeriesStatus | 'unknown';
  statusLabel?: string;
  rating?: number;
  subjectDate?: string;
  subjectTotalEpisodes?: number;
  order: number;
}

export interface CollectionSeriesRelationEdge {
  fromSubjectId: number;
  toSubjectId: number;
  fromName?: string;
  fromNameCn?: string;
  toName?: string;
  toNameCn?: string;
  relation: string;
  relationKind: CollectionSeriesRelationKind;
  observedCount: number;
  conflict: boolean;
}

export interface CollectionSeriesGroup {
  groupId: string;
  state: 'complete' | 'conflict';
  items: CollectionSeriesCollectionItem[];
  edges: CollectionSeriesRelationEdge[];
  hiddenItemCount: number;
}

export interface CollectionSeriesResult {
  username: string;
  formulaVersion: string;
  state: CollectionSeriesState;
  groups: CollectionSeriesGroup[];
  ungrouped: CollectionSeriesCollectionItem[];
  summary: {
    collectionRowsObserved: number;
    collectionItems: number;
    eligibleAnimeItems: number;
    groupedItems: number;
    ungroupedItems: number;
    relationSubjectsRequested: number;
    relationSubjectsSucceeded: number;
    relationSubjectsFailed: number;
    relationRowsObserved: number;
    relationEdges: number;
    conflictEdges: number;
    excludedRelationRows: number;
  };
  relationFailures: Array<{
    subjectId: number;
    code: string;
    message: string;
  }>;
  coverage: {
    collection: {
      sourceTotal?: number;
      pagesAttempted: number;
      pagesSucceeded: number;
      maxPages: number;
      requestedMaxItems: number;
      rowsObserved: number;
      uniqueRows: number;
      eligibleRows: number;
      duplicateRows: number;
      filteredRows: number;
      truncated: boolean;
      sourceExhausted: boolean;
      paginationStalled: boolean;
      sourceTotalChanged: boolean;
    };
    relations: {
      requestedSubjects: number;
      attemptedSubjects: number;
      succeededSubjects: number;
      failedSubjects: number;
      maxRelationSubjects: number;
      maxRelationsPerSubject: number;
      rowsObserved: number;
      rowsReturned: number;
      truncatedSubjects: number;
      concurrency: number;
      subjectBudgetExceeded: boolean;
    };
    output: {
      requestedMaxGroups: number;
      requestedMaxEdges: number;
      returnedGroups: number;
      returnedEdges: number;
      hiddenGroupCount: number;
      truncated: boolean;
    };
  };
  excludedRelations: {
    sourceRelations: number;
    stableRelations: number;
    excludedRelations: number;
    unknownRelations: number;
    unmatchedTargets: number;
    samples: Array<{ relation: string; relationKind: CollectionSeriesRelationKind; count: number }>;
  };
  warnings: Array<{ code: string; message: string }>;
  limitations: string[];
  evidence: Array<{
    source: 'official_v0' | 'derived';
    operation: string;
    formulaVersion?: string;
    authScope: 'account';
    attemptedAt: string;
    retrievedAt?: string;
  }>;
  source: {
    operations: string[];
    attemptedAt: string;
    retrievedAt?: string;
  };
  error?: PublicErrorInfo;
}

type CollectionScan = {
  items: CollectionSeriesCollectionItem[];
  sourceTotal?: number;
  rowsObserved: number;
  pagesAttempted: number;
  pagesSucceeded: number;
  truncated: boolean;
  sourceExhausted: boolean;
  paginationStalled: boolean;
  sourceTotalChanged: boolean;
  duplicateRows: number;
  filteredRows: number;
  error?: PublicErrorInfo;
};

type EdgeAggregate = {
  fromSubjectId: number;
  toSubjectId: number;
  fromName?: string;
  fromNameCn?: string;
  toName?: string;
  toNameCn?: string;
  relationKind: CollectionSeriesRelationKind;
  relation: string;
  observedCount: number;
  conflict: boolean;
};

type RelationSample = {
  relation: string;
  relationKind: CollectionSeriesRelationKind;
  count: number;
};

function clamp(value: number | undefined, fallback: number, maximum: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(maximum, Math.floor(value as number)));
}

function normalizeRelationLabel(relation: string): string {
  return relation
    .trim()
    .toLocaleLowerCase()
    .replace(/[\s-]+/g, '_');
}

function classifyRelation(relation: string): CollectionSeriesRelationKind {
  const normalized = normalizeRelationLabel(relation);
  if (['前传', '前篇', 'prequel', 'pre_story'].includes(normalized)) return 'prequel';
  if (['续集', '续篇', 'sequel', 'sequel_story'].includes(normalized)) return 'sequel';
  if (
    ['衍生', '外传', '番外', 'side_story', 'side-story', 'spin_off', 'spinoff'].includes(normalized)
  ) {
    return 'side_story';
  }
  if (['总集篇', '总集', 'recap', 'compilation', 'summary'].includes(normalized)) return 'recap';
  if (['原作', 'source', '原案', '原作小说'].includes(normalized)) return 'source';
  if (['改编', 'adaptation', '改编自'].includes(normalized)) return 'adaptation';
  if (['书籍', '小说', 'book', 'novel', '漫画', 'manga'].includes(normalized)) return 'book';
  if (['音乐', 'music', '歌曲', 'song'].includes(normalized)) return 'music';
  if (['游戏', 'game', '游戏版'].includes(normalized)) return 'game';
  if (['真人', 'real', 'live_action'].includes(normalized)) return 'real';
  if (['其他', 'other'].includes(normalized)) return 'other';
  return 'unknown';
}

function statusSet(statuses: CollectionSeriesStatus[] | undefined): Set<CollectionSeriesStatus> {
  return new Set(statuses?.length ? statuses : ['wish', 'doing', 'done', 'on_hold', 'dropped']);
}

function mapCollectionItem(
  item: UserCollectionItem,
  order: number,
): CollectionSeriesCollectionItem {
  return {
    subjectId: item.subjectId,
    subjectName: item.subjectName,
    subjectNameCn: item.subjectNameCn,
    subjectType: item.subjectType,
    status: item.status,
    statusLabel: item.statusLabel,
    rating: item.rating,
    subjectDate: item.subjectDate,
    subjectTotalEpisodes: item.subjectTotalEpisodes,
    order,
  };
}

function errorForAbort(): PublicErrorInfo {
  return {
    code: 'UPSTREAM_TIMEOUT',
    message: '请求在完成前被取消。',
    retryable: true,
  };
}

function stateForCollectionError(error: PublicErrorInfo): CollectionSeriesState {
  if (error.code === 'AUTH_REQUIRED') return 'auth_required';
  if (error.code === 'PERMISSION_DENIED') return 'permission_denied';
  if (error.code === 'RATE_LIMITED') return 'rate_limited';
  if (
    error.code === 'UPSTREAM_TIMEOUT' ||
    error.code === 'UPSTREAM_UNAVAILABLE' ||
    error.code === 'UPSTREAM_ERROR'
  ) {
    return 'upstream_error';
  }
  return 'unavailable';
}

function relationSampleKey(relation: string, relationKind: CollectionSeriesRelationKind): string {
  return `${relationKind}:${relation}`;
}

function sortedRelationSamples(samples: Map<string, RelationSample>): RelationSample[] {
  return [...samples.values()]
    .sort((a, b) => b.count - a.count || a.relation.localeCompare(b.relation))
    .slice(0, COLLECTION_SERIES_LIMITS.maxEvidenceSamples);
}

function edgeKey(
  fromSubjectId: number,
  toSubjectId: number,
  relationKind: CollectionSeriesRelationKind,
  relation: string,
): string {
  return `${fromSubjectId}->${toSubjectId}:${relationKind}:${relation}`;
}

function pairKey(left: number, right: number): string {
  return left < right ? `${left}:${right}` : `${right}:${left}`;
}

async function mapConcurrent<T, R>(
  values: T[],
  concurrency: number,
  task: (value: T) => Promise<R>,
): Promise<R[]> {
  const output = new Array<R>(values.length);
  let nextIndex = 0;
  const worker = async (): Promise<void> => {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= values.length) return;
      output[index] = await task(values[index]!);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, Math.max(values.length, 1)) }, () => worker()),
  );
  return output;
}

class DisjointSet {
  private readonly parent = new Map<number, number>();

  add(value: number): void {
    if (!this.parent.has(value)) this.parent.set(value, value);
  }

  find(value: number): number {
    const current = this.parent.get(value) ?? value;
    if (current === value) return value;
    const root = this.find(current);
    this.parent.set(value, root);
    return root;
  }

  union(left: number, right: number): void {
    this.add(left);
    this.add(right);
    const leftRoot = this.find(left);
    const rightRoot = this.find(right);
    if (leftRoot !== rightRoot) this.parent.set(rightRoot, leftRoot);
  }
}

export class CollectionSeriesService {
  private readonly userService: UserService;
  private readonly subjectService: SubjectService;

  constructor(private readonly client: GeneratedBangumiOpenApiClient | HttpClient) {
    this.userService = new UserService(client);
    this.subjectService = new SubjectService(client);
  }

  async getCollectionSeriesGroups(
    username: string,
    options: CollectionSeriesOptions = {},
  ): Promise<CollectionSeriesResult> {
    const attemptedAt = new Date().toISOString();
    const maxItems = clamp(
      options.maxItems,
      COLLECTION_SERIES_DEFAULTS.maxItems,
      COLLECTION_SERIES_LIMITS.maxItems,
    );
    const maxRelationSubjects = clamp(
      options.maxRelationSubjects,
      COLLECTION_SERIES_DEFAULTS.maxRelationSubjects,
      COLLECTION_SERIES_LIMITS.maxRelationSubjects,
    );
    const maxRelationsPerSubject = clamp(
      options.maxRelationsPerSubject,
      COLLECTION_SERIES_DEFAULTS.maxRelationsPerSubject,
      COLLECTION_SERIES_LIMITS.maxRelationsPerSubject,
    );
    const maxGroups = clamp(
      options.maxGroups,
      COLLECTION_SERIES_DEFAULTS.maxGroups,
      COLLECTION_SERIES_LIMITS.maxGroups,
    );
    const maxEdges = clamp(
      options.maxEdges,
      COLLECTION_SERIES_DEFAULTS.maxEdges,
      COLLECTION_SERIES_LIMITS.maxEdges,
    );
    const statuses = statusSet(options.statuses);
    const operations = [
      'GET /v0/users/{username}/collections',
      'GET /v0/subjects/{subject_id}/subjects',
    ];
    const scan = await this.scanCollection(username, maxItems, statuses, options.signal);

    if (scan.error) {
      return this.unavailableResult(username, attemptedAt, operations, scan, scan.error, {
        maxItems,
        maxRelationSubjects,
        maxRelationsPerSubject,
        maxGroups,
        maxEdges,
      });
    }

    const collectionById = new Map(scan.items.map((item) => [item.subjectId, item]));
    const eligibleItems = scan.items.filter((item) => item.subjectType === 'anime');
    const relationRoots = eligibleItems.slice(0, maxRelationSubjects);
    const relationReads = await mapConcurrent(
      relationRoots,
      COLLECTION_SERIES_LIMITS.relationConcurrency,
      async (item) => {
        if (options.signal?.aborted) {
          return {
            subjectId: item.subjectId,
            rows: [],
            rawRows: 0,
            truncated: false,
            error: errorForAbort(),
          };
        }
        try {
          const rawRows = await this.subjectService.getSubjectRelations(item.subjectId);
          const rows = rawRows.slice(0, maxRelationsPerSubject);
          return {
            subjectId: item.subjectId,
            rows,
            rawRows: rawRows.length,
            truncated: rawRows.length > rows.length,
          };
        } catch (error) {
          return {
            subjectId: item.subjectId,
            rows: [],
            rawRows: 0,
            truncated: false,
            error: toPublicError(error),
          };
        }
      },
    );

    const relationSamples = new Map<string, RelationSample>();
    const edgeAggregates = new Map<string, EdgeAggregate>();
    const pairKinds = new Map<string, Map<number, Set<CollectionSeriesStableRelationKind>>>();
    const dsu = new DisjointSet();
    const relationFailures = relationReads.filter((read) => read.error);
    let relationRowsObserved = 0;
    let relationRowsReturned = 0;
    let truncatedSubjects = 0;
    let excludedRelationRows = 0;
    let stableRelations = 0;
    let unknownRelations = 0;
    let unmatchedTargets = 0;

    for (const item of eligibleItems) dsu.add(item.subjectId);

    for (const read of relationReads) {
      relationRowsObserved += read.rawRows;
      relationRowsReturned += read.rows.length;
      if (read.truncated) truncatedSubjects += 1;
      const from = collectionById.get(read.subjectId);
      if (!from) continue;

      for (const relation of read.rows) {
        const relationKind = classifyRelation(relation.relation);
        if (relationKind === 'unknown') unknownRelations += 1;
        const sampleKey = relationSampleKey(relation.relation, relationKind);
        const sample = relationSamples.get(sampleKey) ?? {
          relation: relation.relation,
          relationKind,
          count: 0,
        };
        sample.count += 1;
        relationSamples.set(sampleKey, sample);

        const target = collectionById.get(relation.id);
        if (!target || target.subjectType !== 'anime') {
          excludedRelationRows += 1;
          unmatchedTargets += 1;
          continue;
        }
        if (!STABLE_RELATION_KINDS.includes(relationKind as CollectionSeriesStableRelationKind)) {
          excludedRelationRows += 1;
          continue;
        }

        stableRelations += 1;
        const stableKind = relationKind as CollectionSeriesStableRelationKind;
        dsu.union(from.subjectId, target.subjectId);
        const pair = pairKey(from.subjectId, target.subjectId);
        const pairDirections =
          pairKinds.get(pair) ?? new Map<number, Set<CollectionSeriesStableRelationKind>>();
        const directionKinds =
          pairDirections.get(from.subjectId) ?? new Set<CollectionSeriesStableRelationKind>();
        directionKinds.add(stableKind);
        pairDirections.set(from.subjectId, directionKinds);
        pairKinds.set(pair, pairDirections);

        const key = edgeKey(from.subjectId, target.subjectId, stableKind, relation.relation);
        const aggregate = edgeAggregates.get(key) ?? {
          fromSubjectId: from.subjectId,
          toSubjectId: target.subjectId,
          fromName: from.subjectName,
          fromNameCn: from.subjectNameCn,
          toName: target.subjectName ?? relation.name,
          toNameCn: target.subjectNameCn ?? relation.nameCn,
          relationKind: stableKind,
          relation: relation.relation,
          observedCount: 0,
          conflict: false,
        };
        aggregate.observedCount += 1;
        edgeAggregates.set(key, aggregate);
      }
    }

    const conflictPairs = new Set<string>();
    for (const [pair, directions] of pairKinds) {
      if ([...directions.values()].some((kinds) => kinds.size > 1)) conflictPairs.add(pair);
    }
    for (const edge of edgeAggregates.values()) {
      edge.conflict = conflictPairs.has(pairKey(edge.fromSubjectId, edge.toSubjectId));
    }

    const allGroups = [...new Set(eligibleItems.map((item) => dsu.find(item.subjectId)))]
      .map((root) => {
        const items = eligibleItems
          .filter((item) => dsu.find(item.subjectId) === root)
          .sort((left, right) => left.order - right.order);
        const itemIds = new Set(items.map((item) => item.subjectId));
        const edges = [...edgeAggregates.values()]
          .filter((edge) => itemIds.has(edge.fromSubjectId) && itemIds.has(edge.toSubjectId))
          .sort((left, right) => {
            return (
              left.fromSubjectId - right.fromSubjectId ||
              left.toSubjectId - right.toSubjectId ||
              left.relation.localeCompare(right.relation)
            );
          });
        return {
          root,
          firstOrder: items[0]?.order ?? Number.MAX_SAFE_INTEGER,
          items,
          edges,
          hasConflict: edges.some((edge) => edge.conflict),
        };
      })
      .filter((group) => group.edges.length > 0)
      .sort((left, right) => left.firstOrder - right.firstOrder || left.root - right.root);

    const selectedGroups = allGroups.slice(0, maxGroups);
    const outputEdges = selectedGroups.flatMap((group) => group.edges).slice(0, maxEdges);
    const groups: CollectionSeriesGroup[] = selectedGroups.map((group, index) => ({
      groupId: `series-${index + 1}`,
      state: group.hasConflict ? 'conflict' : 'complete',
      items: group.items,
      edges: group.edges.filter((edge) => outputEdges.includes(edge)),
      hiddenItemCount: 0,
    }));
    const allGroupedSubjectIds = new Set(
      allGroups.flatMap((group) => group.items.map((item) => item.subjectId)),
    );
    const ungrouped = eligibleItems.filter((item) => !allGroupedSubjectIds.has(item.subjectId));
    const conflicts = [...edgeAggregates.values()].filter((edge) => edge.conflict).length;
    const collectionPartial = scan.truncated || scan.paginationStalled || scan.sourceTotalChanged;
    const relationPartial =
      eligibleItems.length > relationRoots.length ||
      relationFailures.length > 0 ||
      truncatedSubjects > 0 ||
      Boolean(options.signal?.aborted);
    const outputPartial =
      allGroups.length > selectedGroups.length ||
      outputEdges.length < selectedGroups.flatMap((group) => group.edges).length;
    const warnings: Array<{ code: string; message: string }> = [];
    if (collectionPartial)
      warnings.push({
        code: 'PARTIAL_COLLECTION_SCAN',
        message: '收藏列表受到页数、上游变化或分页边界影响，结果可能不完整。',
      });
    if (scan.paginationStalled)
      warnings.push({
        code: 'COLLECTION_PAGINATION_STALLED',
        message: '收藏分页没有前进，已停止继续读取。',
      });
    if (scan.sourceTotalChanged)
      warnings.push({
        code: 'COLLECTION_SOURCE_TOTAL_CHANGED',
        message: '收藏列表的上游总数在分页期间发生变化。',
      });
    if (scan.duplicateRows > 0)
      warnings.push({
        code: 'DUPLICATE_COLLECTION_ROWS',
        message: `收藏列表包含 ${scan.duplicateRows} 条重复 subject 记录，已按 subject 去重。`,
      });
    if (scan.filteredRows > 0)
      warnings.push({
        code: 'FILTERED_COLLECTION_ROWS',
        message: `${scan.filteredRows} 条收藏记录因状态筛选或非动画类型未参与分组。`,
      });
    if (eligibleItems.length > relationRoots.length)
      warnings.push({
        code: 'RELATION_SUBJECT_CAP',
        message: `仅读取前 ${maxRelationSubjects} 个动画收藏条目的关系。`,
      });
    if (truncatedSubjects > 0)
      warnings.push({
        code: 'RELATION_ROW_CAP',
        message: `${truncatedSubjects} 个条目的关系超过单条读取上限，已截断。`,
      });
    if (relationFailures.length > 0)
      warnings.push({
        code: 'RELATION_READ_FAILURE',
        message: `${relationFailures.length} 个收藏条目的关系读取失败。`,
      });
    if (excludedRelationRows > 0)
      warnings.push({
        code: 'EXCLUDED_RELATION_KINDS',
        message: `${excludedRelationRows} 条关系不是可用于动画系列分组的稳定关系，已保留在排除统计中。`,
      });
    if (conflicts > 0)
      warnings.push({
        code: 'CONFLICTING_RELATION_EVIDENCE',
        message: `${conflicts} 条关系在同一收藏对上出现方向或类型冲突。`,
      });
    if (outputPartial)
      warnings.push({ code: 'OUTPUT_CAP', message: '输出受到系列组或关系边上限影响。' });

    const state: CollectionSeriesState =
      conflicts > 0 && !collectionPartial && !relationPartial && !outputPartial
        ? 'conflict'
        : collectionPartial || relationPartial || outputPartial
          ? 'partial'
          : 'complete';
    const retrievedAt = new Date().toISOString();
    return {
      username,
      formulaVersion: COLLECTION_SERIES_FORMULA_VERSION,
      state,
      groups,
      ungrouped,
      summary: {
        collectionRowsObserved: scan.rowsObserved,
        collectionItems: scan.items.length,
        eligibleAnimeItems: eligibleItems.length,
        groupedItems: allGroups.reduce((total, group) => total + group.items.length, 0),
        ungroupedItems: ungrouped.length,
        relationSubjectsRequested: relationRoots.length,
        relationSubjectsSucceeded: relationReads.filter((read) => !read.error).length,
        relationSubjectsFailed: relationFailures.length,
        relationRowsObserved,
        relationEdges: edgeAggregates.size,
        conflictEdges: conflicts,
        excludedRelationRows,
      },
      relationFailures: relationFailures.flatMap((read) =>
        read.error
          ? [{ subjectId: read.subjectId, code: read.error.code, message: read.error.message }]
          : [],
      ),
      coverage: {
        collection: {
          sourceTotal: scan.sourceTotal,
          pagesAttempted: scan.pagesAttempted,
          pagesSucceeded: scan.pagesSucceeded,
          maxPages: COLLECTION_SERIES_LIMITS.maxPages,
          requestedMaxItems: maxItems,
          rowsObserved: scan.rowsObserved,
          uniqueRows: scan.items.length,
          eligibleRows: eligibleItems.length,
          duplicateRows: scan.duplicateRows,
          filteredRows: scan.filteredRows,
          truncated: scan.truncated,
          sourceExhausted: scan.sourceExhausted,
          paginationStalled: scan.paginationStalled,
          sourceTotalChanged: scan.sourceTotalChanged,
        },
        relations: {
          requestedSubjects: relationRoots.length,
          attemptedSubjects: relationReads.length,
          succeededSubjects: relationReads.filter((read) => !read.error).length,
          failedSubjects: relationFailures.length,
          maxRelationSubjects,
          maxRelationsPerSubject,
          rowsObserved: relationRowsObserved,
          rowsReturned: relationRowsReturned,
          truncatedSubjects,
          concurrency: COLLECTION_SERIES_LIMITS.relationConcurrency,
          subjectBudgetExceeded: eligibleItems.length > relationRoots.length,
        },
        output: {
          requestedMaxGroups: maxGroups,
          requestedMaxEdges: maxEdges,
          returnedGroups: groups.length,
          returnedEdges: outputEdges.length,
          hiddenGroupCount: Math.max(0, allGroups.length - selectedGroups.length),
          truncated: outputPartial,
        },
      },
      excludedRelations: {
        sourceRelations: relationRowsObserved,
        stableRelations,
        excludedRelations: excludedRelationRows,
        unknownRelations,
        unmatchedTargets,
        samples: sortedRelationSamples(relationSamples),
      },
      warnings,
      limitations: [
        '系列组是当前收藏中、基于直接稳定动画关系形成的有向关系连通分量，不是官方提供的 canonical watch order。',
        '收藏扫描、关系条目数、关系根条目数、并发数和输出均有硬上限；达到上限时必须结合 coverage 与 warnings 解读。',
        '关系接口本身不提供分页，本结果会保留原始关系标签并在超过本地上限时标记截断。',
        '结果只面向当前认证账号的收藏；不返回评论、用户隐私字段、跨账号数据或写入能力。',
      ],
      evidence: [
        {
          source: 'official_v0',
          operation: 'GET /v0/users/{username}/collections',
          authScope: 'account',
          attemptedAt,
          retrievedAt,
        },
        {
          source: 'official_v0',
          operation: 'GET /v0/subjects/{subject_id}/subjects',
          authScope: 'account',
          attemptedAt,
          retrievedAt,
        },
        {
          source: 'derived',
          operation: 'Bounded connected-component grouping over stable anime relation kinds',
          formulaVersion: COLLECTION_SERIES_FORMULA_VERSION,
          authScope: 'account',
          attemptedAt,
          retrievedAt,
        },
      ],
      source: { operations, attemptedAt, retrievedAt },
    };
  }

  private async scanCollection(
    username: string,
    maxItems: number,
    statuses: Set<CollectionSeriesStatus>,
    signal?: AbortSignal,
  ): Promise<CollectionScan> {
    const rows: CollectionSeriesCollectionItem[] = [];
    const seen = new Set<number>();
    let sourceTotal: number | undefined;
    let pagesAttempted = 0;
    let pagesSucceeded = 0;
    let rowsObserved = 0;
    let duplicateRows = 0;
    let filteredRows = 0;
    let offset = 0;
    let truncated = false;
    let sourceExhausted = false;
    let paginationStalled = false;
    let sourceTotalChanged = false;
    let error: PublicErrorInfo | undefined;

    while (rowsObserved < maxItems && pagesAttempted < COLLECTION_SERIES_LIMITS.maxPages) {
      pagesAttempted += 1;
      if (signal?.aborted) {
        error = errorForAbort();
        break;
      }
      try {
        const page = await this.userService.getUserCollections(username, {
          limit: Math.min(COLLECTION_SERIES_LIMITS.pageSize, maxItems - rowsObserved),
          offset,
          signal,
        });
        pagesSucceeded += 1;
        if (sourceTotal === undefined) sourceTotal = page.total;
        else if (page.total !== undefined && sourceTotal !== page.total) {
          sourceTotalChanged = true;
          sourceTotal = undefined;
        }

        const pageRows = page.items.slice(0, maxItems - rowsObserved);
        rowsObserved += pageRows.length;
        for (const item of pageRows) {
          if (seen.has(item.subjectId)) {
            duplicateRows += 1;
            continue;
          }
          seen.add(item.subjectId);
          if (!statuses.has(item.status as CollectionSeriesStatus)) {
            filteredRows += 1;
            continue;
          }
          rows.push(mapCollectionItem(item, rows.length));
        }

        const nextOffset = page.offset + pageRows.length;
        if (pageRows.length === 0 || (page.total !== undefined && nextOffset >= page.total)) {
          sourceExhausted = true;
          break;
        }
        if (nextOffset <= offset) {
          paginationStalled = true;
          break;
        }
        offset = nextOffset;
      } catch (caught) {
        error = toPublicError(caught);
        break;
      }
    }

    if (
      !sourceExhausted &&
      !paginationStalled &&
      !error &&
      (rowsObserved >= maxItems || pagesAttempted >= COLLECTION_SERIES_LIMITS.maxPages)
    ) {
      truncated = true;
    }
    return {
      items: rows,
      sourceTotal,
      rowsObserved,
      pagesAttempted,
      pagesSucceeded,
      truncated,
      sourceExhausted,
      paginationStalled,
      sourceTotalChanged,
      duplicateRows,
      filteredRows,
      error,
    };
  }

  private unavailableResult(
    username: string,
    attemptedAt: string,
    operations: string[],
    scan: CollectionScan,
    error: PublicErrorInfo,
    limits: {
      maxItems: number;
      maxRelationSubjects: number;
      maxRelationsPerSubject: number;
      maxGroups: number;
      maxEdges: number;
    },
  ): CollectionSeriesResult {
    return {
      username,
      formulaVersion: COLLECTION_SERIES_FORMULA_VERSION,
      state: stateForCollectionError(error),
      groups: [],
      ungrouped: [],
      summary: {
        collectionRowsObserved: scan.rowsObserved,
        collectionItems: scan.items.length,
        eligibleAnimeItems: 0,
        groupedItems: 0,
        ungroupedItems: 0,
        relationSubjectsRequested: 0,
        relationSubjectsSucceeded: 0,
        relationSubjectsFailed: 0,
        relationRowsObserved: 0,
        relationEdges: 0,
        conflictEdges: 0,
        excludedRelationRows: 0,
      },
      relationFailures: [],
      coverage: {
        collection: {
          sourceTotal: scan.sourceTotal,
          pagesAttempted: scan.pagesAttempted,
          pagesSucceeded: scan.pagesSucceeded,
          maxPages: COLLECTION_SERIES_LIMITS.maxPages,
          requestedMaxItems: limits.maxItems,
          rowsObserved: scan.rowsObserved,
          uniqueRows: scan.items.length,
          eligibleRows: 0,
          duplicateRows: scan.duplicateRows,
          filteredRows: scan.filteredRows,
          truncated: scan.truncated,
          sourceExhausted: scan.sourceExhausted,
          paginationStalled: scan.paginationStalled,
          sourceTotalChanged: scan.sourceTotalChanged,
        },
        relations: {
          requestedSubjects: 0,
          attemptedSubjects: 0,
          succeededSubjects: 0,
          failedSubjects: 0,
          maxRelationSubjects: limits.maxRelationSubjects,
          maxRelationsPerSubject: limits.maxRelationsPerSubject,
          rowsObserved: 0,
          rowsReturned: 0,
          truncatedSubjects: 0,
          concurrency: COLLECTION_SERIES_LIMITS.relationConcurrency,
          subjectBudgetExceeded: false,
        },
        output: {
          requestedMaxGroups: limits.maxGroups,
          requestedMaxEdges: limits.maxEdges,
          returnedGroups: 0,
          returnedEdges: 0,
          hiddenGroupCount: 0,
          truncated: false,
        },
      },
      excludedRelations: {
        sourceRelations: 0,
        stableRelations: 0,
        excludedRelations: 0,
        unknownRelations: 0,
        unmatchedTargets: 0,
        samples: [],
      },
      warnings: [{ code: 'COLLECTION_READ_FAILURE', message: '收藏读取失败，无法计算系列分组。' }],
      limitations: ['收藏读取失败时不会猜测系列归属，也不会返回未经证据支持的分组。'],
      evidence: [
        {
          source: 'official_v0',
          operation: 'GET /v0/users/{username}/collections',
          authScope: 'account',
          attemptedAt,
        },
      ],
      source: { operations, attemptedAt },
      error,
    };
  }
}
