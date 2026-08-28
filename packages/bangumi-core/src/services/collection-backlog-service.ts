import { GeneratedBangumiOpenApiClient } from '@bangumi-agent-kit/bangumi-openapi';
import { HttpClient, PublicErrorInfo, toPublicError } from '@bangumi-agent-kit/bangumi-transport';
import { CollectionStatus } from './collection-service.js';
import { UserService } from './user-service.js';
import { UserCollectionItem, UserEpisodeCollectionItem } from '../models/user.js';
import type { DomainEpisode } from '../models/episode.js';

export const COLLECTION_BACKLOG_FORMULA_VERSION = 'collection-backlog-v2';
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
export const COLLECTION_BACKLOG_DURATION_FORMULA_VERSION = 'collection-backlog-duration-v1';

export type CollectionBacklogState =
  | 'complete'
  | 'partial'
  | 'unavailable'
  | 'not_computable'
  | 'conflict'
  | 'auth_required'
  | 'permission_denied'
  | 'rate_limited'
  | 'upstream_error';

export type CollectionBacklogRowState =
  'complete' | 'partial' | 'unavailable' | 'not_computable' | 'conflict';

export type CollectionBacklogAiringState = 'finished' | 'ongoing' | 'unknown';

export type CollectionBacklogDenominatorSource = 'episode_collection' | 'none';

export type CollectionBacklogSourceEvidenceState = 'valid' | 'missing' | 'unknown' | 'invalid';

export type CollectionBacklogStatus = Exclude<CollectionStatus, 'unknown'>;

export type CollectionBacklogSort = 'source' | 'estimated_minutes_asc' | 'estimated_minutes_desc';

export type CollectionBacklogDurationSource = 'server' | 'raw' | 'mixed' | 'none';

export type CollectionBacklogDurationState =
  'complete' | 'partial' | 'not_computable' | 'not_applicable';

export interface CollectionBacklogOptions {
  maxItems?: number;
  maxSubjects?: number;
  maxEpisodesPerSubject?: number;
  statuses?: CollectionBacklogStatus[];
  sortBy?: CollectionBacklogSort;
  signal?: AbortSignal;
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
  sourceReportedEpisodesRaw?: number | string | null;
  sourceReportedEpisodesValidity: CollectionBacklogSourceEvidenceState;
  episodeReportedEpisodes?: number;
  denominatorSource: CollectionBacklogDenominatorSource;
  collectionReportedEpisodes?: number;
  watchedEpisodes?: number;
  wishEpisodes?: number;
  droppedEpisodes?: number;
  observedProgressRows: number;
  airingState: CollectionBacklogAiringState;
  airingReason: string;
  remainingEpisodes?: number;
  completionPercentage?: number;
  plannedEpisodes: number;
  knownDurationEpisodes: number;
  unknownDurationEpisodes: number;
  estimatedRemainingMinutes?: number;
  durationSource: CollectionBacklogDurationSource;
  durationState: CollectionBacklogDurationState;
  state: CollectionBacklogRowState;
  reasons: string[];
  error?: PublicErrorInfo;
  progressCoverage: {
    sourceTotal?: number;
    observedRows: number;
    uniqueRows: number;
    pagesAttempted: number;
    pagesSucceeded: number;
    sourceExhausted: boolean;
    truncated: boolean;
    duplicateRows: number;
    paginationStalled: boolean;
    sourceTotalChanged: boolean;
    pageFailureOffset?: number;
    pageFailureCode?: string;
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
    finishedItems: number;
    finishedIncompleteItems: number;
    ongoingItems: number;
    airingUnknownItems: number;
    knownEstimatedRemainingMinutes?: number;
    durationCompleteItems?: number;
    durationPartialItems?: number;
    durationNotComputableItems?: number;
    unknownDurationEpisodes?: number;
  };
  sortBy?: CollectionBacklogSort;
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
    uniqueRows: number;
    truncatedSubjects: number;
    sourceTotalChangedSubjects: number;
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
  observedRows: number;
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
  uniqueRows: number;
  paginationStalled: boolean;
  sourceTotalChanged: boolean;
  pageFailureOffset?: number;
  pageFailureCode?: string;
  error?: PublicErrorInfo;
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
      finishedItems: 0,
      finishedIncompleteItems: 0,
      ongoingItems: 0,
      airingUnknownItems: 0,
      durationCompleteItems: 0,
      durationPartialItems: 0,
      durationNotComputableItems: 0,
      unknownDurationEpisodes: 0,
    },
    sortBy: 'source',
  };
}

function buildLimitations(): string[] {
  return [
    '结果只覆盖当前账号收藏接口观察到的有界动画收藏样本；超过 collection scan 和 hydration 上限的条目不会被猜测补全。',
    'episodeReportedEpisodes 来自 episode collection 的 episode_type=0 sourceTotal，是 backlog 分母；SlimSubject.eps 的原始值、validity 和交叉证据会保留，malformed 或二者冲突时不计算。',
    'remainingEpisodes = episodeReportedEpisodes - watched main episodes；仅在 episode collection 分页完整、总集数有效且来源字段没有冲突时计算。',
    'airingState 只根据完整、稳定、去重且全为正篇的 episode metadata airdate 推导；finished 只表示当前报告的章节日期均已过去，不能证明未发布后续或排除 hiatus；缺日期、未完成分页或日期矛盾时保持 unknown，不调用日历或 HTML 猜测。',
    '仅请求正篇（episode_type=0）；SP、OP、ED、PV、MAD 和其他章节不会消耗正篇完成度分子或分母。',
    'estimatedRemainingMinutes 只汇总已观察到的未看/想看正篇 episode 时长；durationState=partial 时它是已知时长小计，不是作品总时长，未解析时长会显式保留。已抛弃章节不计入该待看时长，但 remainingEpisodes 仍按正篇分母减已看数计算。',
    'duration_seconds 是官方服务器解析值；仅对带明确单位的原始 duration 做保守解析。无法解析、缺失或 duration_seconds=0 的值不会被猜成零分钟。',
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
      uniqueRows: 0,
      truncatedSubjects: 0,
      sourceTotalChangedSubjects: 0,
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

function positiveInteger(value: number | undefined): value is number {
  return value !== undefined && Number.isSafeInteger(value) && value > 0;
}

/**
 * Parse only duration formats whose units are explicit. Two-field clocks are
 * MM:SS and three-field clocks are HH:MM:SS. A missing or ambiguous source
 * value remains unknown rather than being treated as zero minutes.
 */
export function parseEpisodeDurationSeconds(value: string | undefined): number | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 64) return undefined;

  const clock = /^(\d{1,4}):(\d{2})(?::(\d{2}))?$/u.exec(trimmed);
  if (clock) {
    const first = Number(clock[1]);
    const second = Number(clock[2]);
    const third = clock[3] === undefined ? undefined : Number(clock[3]);
    if (second >= 60 || (third !== undefined && third >= 60) || !Number.isSafeInteger(first)) {
      return undefined;
    }
    const seconds = third === undefined ? first * 60 + second : first * 3600 + second * 60 + third;
    return Number.isSafeInteger(seconds) && seconds > 0 ? seconds : undefined;
  }

  const hours =
    /^(\d{1,4})\s*(?:h|hr|hrs|hour|hours|小时)(?:\s*(\d{1,5})\s*(?:m|min|mins|minute|minutes|分|分钟))?$/iu.exec(
      trimmed,
    );
  if (hours) {
    const hourValue = Number(hours[1]);
    const minuteValue = hours[2] === undefined ? 0 : Number(hours[2]);
    if (minuteValue >= 60) return undefined;
    const seconds = hourValue * 3600 + minuteValue * 60;
    return Number.isSafeInteger(seconds) && seconds > 0 ? seconds : undefined;
  }

  const minutes = /^(\d{1,5})\s*(?:m|min|mins|minute|minutes|分|分钟)$/iu.exec(trimmed);
  if (minutes) {
    const seconds = Number(minutes[1]) * 60;
    return Number.isSafeInteger(seconds) && seconds > 0 ? seconds : undefined;
  }

  return undefined;
}

function episodeDuration(episode: DomainEpisode | undefined): {
  seconds?: number;
  source: Exclude<CollectionBacklogDurationSource, 'mixed' | 'none'>;
} {
  if (!episode) return { source: 'raw' };
  if (positiveInteger(episode.durationSeconds)) {
    return { seconds: episode.durationSeconds, source: 'server' };
  }
  const rawSeconds = parseEpisodeDurationSeconds(episode.duration);
  return rawSeconds === undefined ? { source: 'raw' } : { seconds: rawSeconds, source: 'raw' };
}

interface DurationSummary {
  plannedEpisodes: number;
  knownDurationEpisodes: number;
  unknownDurationEpisodes: number;
  estimatedRemainingMinutes?: number;
  durationSource: CollectionBacklogDurationSource;
  durationState: CollectionBacklogDurationState;
}

function minutesFromSeconds(seconds: number): number {
  return Number((seconds / 60).toFixed(1));
}

function summarizeDurations(
  rows: UserEpisodeCollectionItem[],
  coverageComplete: boolean,
): DurationSummary {
  const plannedRows = rows.filter((row) => row.type === 0 || row.type === 1);
  let knownDurationEpisodes = 0;
  let unknownDurationEpisodes = 0;
  let knownSeconds = 0;
  const sources = new Set<'server' | 'raw'>();

  for (const row of plannedRows) {
    const duration =
      row.episode?.category === 'main' && positiveInteger(row.episode.id)
        ? episodeDuration(row.episode)
        : { source: 'raw' as const };
    if (duration.seconds === undefined) {
      unknownDurationEpisodes += 1;
      continue;
    }
    knownDurationEpisodes += 1;
    knownSeconds += duration.seconds;
    sources.add(duration.source);
  }

  const durationSource: CollectionBacklogDurationSource =
    sources.size === 2 ? 'mixed' : sources.values().next().value || 'none';
  const durationState: CollectionBacklogDurationState = !coverageComplete
    ? knownDurationEpisodes > 0
      ? 'partial'
      : 'not_computable'
    : plannedRows.length === 0
      ? 'not_applicable'
      : unknownDurationEpisodes === 0
        ? 'complete'
        : knownDurationEpisodes === 0
          ? 'not_computable'
          : 'partial';

  return {
    plannedEpisodes: plannedRows.length,
    knownDurationEpisodes,
    unknownDurationEpisodes,
    estimatedRemainingMinutes:
      (coverageComplete && plannedRows.length === 0) || knownDurationEpisodes > 0
        ? minutesFromSeconds(knownSeconds)
        : undefined,
    durationSource,
    durationState,
  };
}

function parseAirdate(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(trimmed);
  if (dateOnlyMatch) {
    const normalized = `${trimmed}T23:59:59.999Z`;
    const timestamp = Date.parse(normalized);
    if (!Number.isFinite(timestamp)) return undefined;
    const date = new Date(timestamp);
    if (
      date.getUTCFullYear() !== Number(dateOnlyMatch[1]) ||
      date.getUTCMonth() + 1 !== Number(dateOnlyMatch[2]) ||
      date.getUTCDate() !== Number(dateOnlyMatch[3])
    ) {
      return undefined;
    }
    return timestamp;
  }
  const timestamp = Date.parse(trimmed);
  return Number.isFinite(timestamp) ? timestamp : undefined;
}

const AIRING_FINISHED_REASON =
  '仅表示当前报告的完整正篇 airdate 均已过去，不能证明未发布后续或排除 hiatus';
const AIRING_ONGOING_REASON = '当前报告存在未来正篇 airdate；这不等同于官方正式播出状态';

interface AiringCertification {
  certified: boolean;
  reason?: string;
  timestamps?: number[];
}

function hasCompleteEpisodeProgress(progress: EpisodeProgressScan): boolean {
  return (
    progress.sourceExhausted &&
    !progress.truncated &&
    !progress.paginationStalled &&
    !progress.sourceTotalChanged &&
    progress.sourceTotal !== undefined &&
    positiveInteger(progress.sourceTotal) &&
    progress.duplicateRows === 0 &&
    progress.items.length === progress.sourceTotal &&
    progress.items.every(
      (row) => positiveInteger(row.episode?.id) && row.episode?.category === 'main',
    )
  );
}

function certifyAiringEvidence(progress: EpisodeProgressScan): AiringCertification {
  if (hasCompleteEpisodeProgress(progress)) {
    const dates = progress.items.map((row) => row.episode?.airdate);
    if (dates.some((date) => !date)) {
      return {
        certified: false,
        reason: '正篇 episode metadata 缺少 airdate，完结状态无法计算',
      };
    }
    const timestamps = dates.map((date) => parseAirdate(date));
    if (timestamps.some((timestamp) => timestamp === undefined)) {
      return {
        certified: false,
        reason: '正篇 episode airdate 格式无法验证，完结状态无法计算',
      };
    }
    return { certified: true, timestamps: timestamps as number[] };
  }

  if (progress.duplicateRows > 0) {
    return {
      certified: false,
      reason: '正篇 episode evidence 含重复章节，无法证明完结状态',
    };
  }
  if (progress.items.some((row) => !positiveInteger(row.episode?.id))) {
    return {
      certified: false,
      reason: '正篇 episode evidence 缺少可验证章节 ID，无法证明完结状态',
    };
  }
  if (progress.items.some((row) => row.episode?.category !== 'main')) {
    return {
      certified: false,
      reason: '正篇 episode evidence 含非正篇章节，无法证明完结状态',
    };
  }
  return {
    certified: false,
    reason: '正篇 episode coverage 不完整，无法从结构化 airdate 证明完结状态',
  };
}

function deriveAiringState(progress: EpisodeProgressScan): {
  state: CollectionBacklogAiringState;
  reason: string;
} {
  const certification = certifyAiringEvidence(progress);
  if (!certification.certified || !certification.timestamps) {
    return {
      state: 'unknown',
      reason: certification.reason || '正篇 episode evidence 不足，无法证明完结状态',
    };
  }
  const timestamps = certification.timestamps;
  return timestamps.some((timestamp) => (timestamp as number) > Date.now())
    ? { state: 'ongoing', reason: AIRING_ONGOING_REASON }
    : { state: 'finished', reason: AIRING_FINISHED_REASON };
}

function buildRow(
  collection: UserCollectionItem,
  progress: EpisodeProgressScan,
  maxEpisodesPerSubject: number,
): CollectionBacklogItem {
  const reasons: string[] = [];
  const progressRows = progress.items;
  const uniqueProgress = new Map<number, UserEpisodeCollectionItem>();
  const uniqueProgressRows: UserEpisodeCollectionItem[] = [];
  for (const row of progressRows) {
    const episodeId = row.episode?.id;
    if (!positiveInteger(episodeId)) {
      uniqueProgressRows.push(row);
    } else if (!uniqueProgress.has(episodeId)) {
      uniqueProgress.set(episodeId, row);
      uniqueProgressRows.push(row);
    }
    if (!row.episode) reasons.push('episode progress row lacks episode metadata');
    if (row.episode && !positiveInteger(row.episode.id)) {
      reasons.push('episode progress row lacks a valid episode ID');
    }
    if (row.episode && row.episode.category !== 'main') {
      reasons.push('episode collection returned a non-main episode despite episode_type=0');
    }
  }

  const mainRows = [...uniqueProgress.values()].filter(
    (row) => row.episode?.category === 'main' && positiveInteger(row.episode.id),
  );
  const watchedEpisodes = mainRows.filter((row) => row.type === 2).length;
  const wishEpisodes = mainRows.filter((row) => row.type === 1).length;
  const droppedEpisodes = mainRows.filter((row) => row.type === 3).length;
  const sourceReportedEpisodes = collection.subjectTotalEpisodes;
  const sourceReportedEpisodesRaw = collection.subjectTotalEpisodesRaw;
  const sourceReportedEpisodesValidity: CollectionBacklogSourceEvidenceState =
    collection.subjectTotalEpisodesValidity ??
    (sourceReportedEpisodes === undefined ? 'missing' : 'valid');
  const episodeReportedEpisodes = progress.sourceTotal;
  const collectionReportedEpisodes = collection.epStatus;
  const hasInvalidEpisodeTotal =
    episodeReportedEpisodes !== undefined && !positiveInteger(episodeReportedEpisodes);
  const progressMismatch =
    collectionReportedEpisodes !== undefined &&
    Number.isInteger(collectionReportedEpisodes) &&
    collectionReportedEpisodes >= 0 &&
    collectionReportedEpisodes !== watchedEpisodes;
  const totalsConflict =
    sourceReportedEpisodesValidity === 'valid' &&
    positiveInteger(sourceReportedEpisodes) &&
    positiveInteger(episodeReportedEpisodes) &&
    sourceReportedEpisodes !== episodeReportedEpisodes;
  const progressComplete = hasCompleteEpisodeProgress(progress);

  let state: CollectionBacklogRowState = 'complete';
  if (progress.sourceTotalChanged) {
    state = 'conflict';
    reasons.push('episode collection 分页期间 sourceTotal 发生变化');
  }
  if (totalsConflict) {
    state = 'conflict';
    reasons.push(
      `SlimSubject.eps (${sourceReportedEpisodes}) 与 episode collection sourceTotal (${episodeReportedEpisodes}) 不一致`,
    );
  }
  if (sourceReportedEpisodesValidity === 'invalid') {
    state = 'conflict';
    reasons.push(
      `SlimSubject.eps 原始值 (${sourceReportedEpisodesRaw ?? 'unknown'}) 无法验证为正整数`,
    );
  }
  if (progressMismatch) {
    state = 'conflict';
    reasons.push(
      `collection ep_status (${collectionReportedEpisodes}) 与 episode collection 已看正篇数 (${watchedEpisodes}) 不一致`,
    );
  }
  if (positiveInteger(sourceReportedEpisodes) && sourceReportedEpisodes < watchedEpisodes) {
    state = 'conflict';
    reasons.push(`SlimSubject.eps (${sourceReportedEpisodes}) 小于已看正篇数 (${watchedEpisodes})`);
  }
  if (positiveInteger(episodeReportedEpisodes) && episodeReportedEpisodes < watchedEpisodes) {
    state = 'conflict';
    reasons.push(
      `episode collection sourceTotal (${episodeReportedEpisodes}) 小于已看正篇数 (${watchedEpisodes})`,
    );
  }
  if (hasInvalidEpisodeTotal) {
    state = state === 'conflict' ? state : 'not_computable';
    reasons.push('episode collection 没有有效的正篇 sourceTotal');
  }
  if (!progressComplete) {
    state =
      state === 'conflict'
        ? state
        : episodeReportedEpisodes === undefined || hasInvalidEpisodeTotal
          ? 'not_computable'
          : 'partial';
    if (progress.truncated)
      reasons.push(`episode collection 超过每条目 ${maxEpisodesPerSubject} 行上限`);
    if (progress.paginationStalled) reasons.push('episode collection 分页没有产生新的偏移量');
    if (progress.sourceTotal === undefined) reasons.push('episode collection 没有可验证的源总数');
    if (progress.duplicateRows > 0) reasons.push('episode collection 返回了重复章节');
    if (progress.pageFailureCode) {
      reasons.push(
        `episode collection 在偏移 ${progress.pageFailureOffset ?? '?'} 处读取失败 (${progress.pageFailureCode})`,
      );
    }
    if (progressRows.length !== progress.sourceTotal && progress.sourceTotal !== undefined) {
      reasons.push(
        `episode collection 观察到 ${progressRows.length} 行，但 sourceTotal 为 ${progress.sourceTotal}`,
      );
    }
  }

  const airing = deriveAiringState(progress);
  if (airing.state === 'unknown') reasons.push(airing.reason);

  const duration = summarizeDurations(uniqueProgressRows, progressComplete);

  const canCompute =
    state === 'complete' &&
    positiveInteger(episodeReportedEpisodes) &&
    episodeReportedEpisodes >= watchedEpisodes;
  if (
    state === 'complete' &&
    (duration.durationState === 'partial' || duration.durationState === 'not_computable')
  ) {
    state = 'partial';
    reasons.push(
      duration.unknownDurationEpisodes > 0
        ? `待看正篇有 ${duration.unknownDurationEpisodes} 集时长无法验证`
        : '待看正篇时长覆盖不完整，预计分钟数不是完整总量',
    );
  }
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
    sourceReportedEpisodesRaw,
    sourceReportedEpisodesValidity,
    episodeReportedEpisodes,
    denominatorSource: canCompute ? 'episode_collection' : 'none',
    collectionReportedEpisodes,
    watchedEpisodes,
    wishEpisodes,
    droppedEpisodes,
    observedProgressRows: progressRows.length,
    airingState: airing.state,
    airingReason: airing.reason,
    remainingEpisodes: canCompute ? episodeReportedEpisodes - watchedEpisodes : undefined,
    completionPercentage: canCompute
      ? Number(((watchedEpisodes / episodeReportedEpisodes) * 100).toFixed(1))
      : undefined,
    ...duration,
    state,
    reasons: uniqueReasons,
    progressCoverage: {
      sourceTotal: progress.sourceTotal,
      observedRows: progressRows.length,
      uniqueRows: progressRows.length - progress.duplicateRows,
      pagesAttempted: progress.pagesAttempted,
      pagesSucceeded: progress.pagesSucceeded,
      sourceExhausted: progress.sourceExhausted,
      truncated: progress.truncated,
      duplicateRows: progress.duplicateRows,
      paginationStalled: progress.paginationStalled,
      sourceTotalChanged: progress.sourceTotalChanged,
      pageFailureOffset: progress.pageFailureOffset,
      pageFailureCode: progress.pageFailureCode,
    },
  };
}

function buildUnavailableRow(
  collection: UserCollectionItem,
  error: PublicErrorInfo,
  progress: EpisodeProgressScan,
): CollectionBacklogItem {
  const airingReason = 'episode collection 不可用，没有足够的结构化 airdate 证据';
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
    sourceReportedEpisodesRaw: collection.subjectTotalEpisodesRaw,
    sourceReportedEpisodesValidity:
      collection.subjectTotalEpisodesValidity ??
      (collection.subjectTotalEpisodes === undefined ? 'missing' : 'valid'),
    denominatorSource: 'none',
    collectionReportedEpisodes: collection.epStatus,
    observedProgressRows: progress.items.length,
    airingState: 'unknown',
    airingReason,
    plannedEpisodes: 0,
    knownDurationEpisodes: 0,
    unknownDurationEpisodes: 0,
    durationSource: 'none',
    durationState: 'not_computable',
    state: 'unavailable',
    reasons: [error.code],
    error,
    progressCoverage: {
      sourceTotal: progress.sourceTotal,
      observedRows: progress.items.length,
      uniqueRows: progress.items.length - progress.duplicateRows,
      pagesAttempted: progress.pagesAttempted,
      pagesSucceeded: progress.pagesSucceeded,
      sourceExhausted: progress.sourceExhausted,
      truncated: progress.truncated,
      duplicateRows: progress.duplicateRows,
      paginationStalled: progress.paginationStalled,
      sourceTotalChanged: progress.sourceTotalChanged,
      pageFailureOffset: progress.pageFailureOffset,
      pageFailureCode: progress.pageFailureCode,
    },
  };
}

async function scanCollection(
  userService: UserService,
  username: string,
  maxItems: number,
  signal?: AbortSignal,
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
    !sourceExhausted &&
    !signal?.aborted
  ) {
    pagesAttempted += 1;
    const requested = Math.min(COLLECTION_BACKLOG_COLLECTION_PAGE_SIZE, maxItems - items.length);
    try {
      const page = await userService.getUserCollections(username, {
        subjectType: 'anime',
        limit: requested,
        offset,
        signal,
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
      if (signal?.aborted) throw error;
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
    observedRows: items.length,
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
  signal?: AbortSignal,
): Promise<EpisodeProgressScan> {
  const items: UserEpisodeCollectionItem[] = [];
  let sourceTotal: number | undefined;
  let pagesAttempted = 0;
  let pagesSucceeded = 0;
  let offset = 0;
  let sourceExhausted = false;
  let paginationStalled = false;
  let sourceTotalChanged = false;
  let sourceTotalInvalidated = false;
  let pageFailureOffset: number | undefined;
  let pageFailureCode: string | undefined;
  let scanError: PublicErrorInfo | undefined;

  while (
    items.length < maxEpisodes &&
    pagesAttempted < COLLECTION_BACKLOG_MAX_EPISODE_PAGES &&
    !sourceExhausted &&
    !signal?.aborted
  ) {
    pagesAttempted += 1;
    const requested = Math.min(COLLECTION_BACKLOG_EPISODE_PAGE_SIZE, maxEpisodes - items.length);
    let page;
    try {
      page = await userService.getUserEpisodeCollections(subjectId, {
        episodeType: 0,
        limit: requested,
        offset,
        signal,
      });
    } catch (error: unknown) {
      if (signal?.aborted) throw error;
      pageFailureOffset = offset;
      scanError = toPublicError(error);
      pageFailureCode = scanError.code;
      break;
    }
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
    paginationStalled ||
    sourceTotalChanged ||
    pageFailureOffset !== undefined;
  const uniqueRows = items.length - duplicateRows;
  return {
    items,
    sourceTotal,
    pagesAttempted,
    pagesSucceeded,
    sourceExhausted,
    truncated,
    duplicateRows,
    uniqueRows,
    paginationStalled,
    sourceTotalChanged,
    pageFailureOffset,
    pageFailureCode,
    error: scanError,
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

function sortItems(
  items: CollectionBacklogItem[],
  sortBy: CollectionBacklogSort,
): CollectionBacklogItem[] {
  if (sortBy === 'source') return items;

  return items
    .map((item, sourceIndex) => ({ item, sourceIndex }))
    .sort((left, right) => {
      const leftUnknown =
        left.item.state !== 'complete' ||
        left.item.durationState === 'partial' ||
        left.item.durationState === 'not_computable';
      const rightUnknown =
        right.item.state !== 'complete' ||
        right.item.durationState === 'partial' ||
        right.item.durationState === 'not_computable';
      if (leftUnknown !== rightUnknown) return leftUnknown ? 1 : -1;
      if (!leftUnknown && !rightUnknown) {
        const difference =
          (left.item.estimatedRemainingMinutes || 0) - (right.item.estimatedRemainingMinutes || 0);
        if (difference !== 0) {
          return sortBy === 'estimated_minutes_asc' ? difference : -difference;
        }
      }
      return left.sourceIndex - right.sourceIndex;
    })
    .map(({ item }) => item);
}

function summarize(
  items: CollectionBacklogItem[],
  eligibleItems: number,
  sortBy: CollectionBacklogSort,
): CollectionBacklogData {
  const hasDurationEvidence =
    items.length === 0 ||
    items.some((item) => item.knownDurationEpisodes > 0) ||
    items.every((item) => item.durationState === 'not_applicable');
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
    finishedItems: items.filter((item) => item.airingState === 'finished').length,
    finishedIncompleteItems: items.filter(
      (item) =>
        item.airingState === 'finished' &&
        item.remainingEpisodes !== undefined &&
        item.remainingEpisodes > 0,
    ).length,
    ongoingItems: items.filter((item) => item.airingState === 'ongoing').length,
    airingUnknownItems: items.filter((item) => item.airingState === 'unknown').length,
    knownEstimatedRemainingMinutes: hasDurationEvidence
      ? Number(
          items
            .reduce((total, item) => total + (item.estimatedRemainingMinutes || 0), 0)
            .toFixed(1),
        )
      : undefined,
    durationCompleteItems: items.filter((item) => item.durationState === 'complete').length,
    durationPartialItems: items.filter((item) => item.durationState === 'partial').length,
    durationNotComputableItems: items.filter((item) => item.durationState === 'not_computable')
      .length,
    unknownDurationEpisodes: items.reduce(
      (total, item) => total + (item.unknownDurationEpisodes || 0),
      0,
    ),
  };
  return { items, summary, sortBy };
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
    scan.duplicateRows > 0 ||
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
      message: `收藏扫描观察到 ${scan.observedRows} 行，去重后 ${scan.items.length} 条，源报告 ${scan.sourceTotal ?? '未知'} 行；结果受扫描上限或分页边界约束。`,
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

function stateForError(error: PublicErrorInfo): CollectionBacklogState {
  if (error.code === 'AUTH_REQUIRED' || error.code === 'AUTH_EXPIRED') return 'auth_required';
  if (error.code === 'PERMISSION_DENIED') return 'permission_denied';
  if (error.code === 'RATE_LIMITED') return 'rate_limited';
  if (error.code === 'NETWORK_ERROR' || error.code === 'UPSTREAM_UNAVAILABLE') {
    return 'upstream_error';
  }
  return 'unavailable';
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
    const sortBy: CollectionBacklogSort =
      options.sortBy === 'estimated_minutes_asc' || options.sortBy === 'estimated_minutes_desc'
        ? options.sortBy
        : 'source';
    const attemptedAt = new Date().toISOString();

    let scan: CollectionScan;
    try {
      scan = await scanCollection(this.userService, username, maxItems, options.signal);
    } catch (error: unknown) {
      const publicError = toPublicError(error);
      const errorState = stateForError(publicError);
      const data = emptyData();
      data.sortBy = sortBy;
      return {
        state: errorState,
        data,
        coverage: emptyCoverage(errorState, { maxItems, maxSubjects, maxEpisodesPerSubject }),
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
            state: errorState,
            message: publicError.message,
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
        if (options.signal?.aborted) {
          throw new Error('Collection dashboard deadline reached.');
        }
        try {
          const progress = await scanEpisodeProgress(
            this.userService,
            item.subjectId,
            maxEpisodesPerSubject,
            options.signal,
          );
          const row =
            progress.error && progress.pagesSucceeded === 0
              ? buildUnavailableRow(item, progress.error, progress)
              : buildRow(item, progress, maxEpisodesPerSubject);
          if (progress.error && row.state !== 'unavailable') {
            row.error = progress.error;
            row.reasons = [...new Set([...row.reasons, progress.error.code])];
          }
          return {
            item: row,
            progress,
            error: progress.error,
          } satisfies HydratedRow;
        } catch (error: unknown) {
          const publicError = toPublicError(error);
          const progress: EpisodeProgressScan = {
            items: [],
            pagesAttempted: 1,
            pagesSucceeded: 0,
            sourceExhausted: false,
            truncated: true,
            duplicateRows: 0,
            uniqueRows: 0,
            paginationStalled: false,
            sourceTotalChanged: false,
            pageFailureOffset: 0,
            pageFailureCode: publicError.code,
            error: publicError,
          };
          return {
            item: buildUnavailableRow(item, publicError, progress),
            progress,
            error: publicError,
          } satisfies HydratedRow;
        }
      },
    );

    const sourceRows = hydrated.map((entry) => entry.item);
    const rows = sortItems(sourceRows, sortBy);
    const state = resultState(scan, hydrationBudgetExceeded, rows);
    const data = summarize(rows, eligible.length, sortBy);
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
    const episodeFailureCount = hydrated.filter((entry) => Boolean(entry.progress.error)).length;
    if (episodeFailureCount > 0) {
      warnings.push({
        code: 'EPISODE_COLLECTION_PAGE_FAILURE',
        state: 'partial',
        message: `${episodeFailureCount} 个条目的 episode collection 页面读取失败；已保留成功页面的覆盖和失败位置。`,
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
    const sourceTotalChangedCount = hydrated.filter(
      (entry) => entry.progress.sourceTotalChanged,
    ).length;
    if (sourceTotalChangedCount > 0) {
      warnings.push({
        code: 'EPISODE_SOURCE_TOTAL_CHANGED',
        state: 'conflict',
        message: `${sourceTotalChangedCount} 个条目的 episode collection sourceTotal 在分页期间发生变化；对应完成度未采用不稳定的分母。`,
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
    const unknownDurationCount = rows.filter((row) => row.unknownDurationEpisodes > 0).length;
    if (unknownDurationCount > 0) {
      warnings.push({
        code: 'UNKNOWN_EPISODE_DURATIONS',
        state: 'partial',
        message: `${unknownDurationCount} 个条目含未解析或缺失的待看正篇时长；estimatedRemainingMinutes 只代表已知时长小计。`,
      });
    }
    const partialDurationCoverageCount = rows.filter(
      (row) =>
        row.state !== 'unavailable' &&
        row.unknownDurationEpisodes === 0 &&
        (row.durationState === 'partial' || row.durationState === 'not_computable'),
    ).length;
    if (partialDurationCoverageCount > 0) {
      warnings.push({
        code: 'PARTIAL_DURATION_COVERAGE',
        state: 'partial',
        message: `${partialDurationCoverageCount} 个条目的 episode coverage 不完整；预计分钟数只代表已观察的待看正篇小计。`,
      });
    }

    const retrievedAt = new Date().toISOString();
    const coverage: CollectionBacklogCoverage = {
      state,
      collection: {
        sourceTotal: scan.sourceTotal,
        requestedMaxItems: scan.requestedMaxItems,
        observedRows: scan.observedRows,
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
        uniqueRows: hydrated.reduce((total, entry) => total + entry.progress.uniqueRows, 0),
        truncatedSubjects: hydrated.filter((entry) => entry.progress.truncated).length,
        sourceTotalChangedSubjects: hydrated.filter((entry) => entry.progress.sourceTotalChanged)
          .length,
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
            'episode collection sourceTotal - watched main episodes',
            'watched main episodes / episode collection sourceTotal',
          ],
          formulaVersion: COLLECTION_BACKLOG_FORMULA_VERSION,
          authScope: 'account',
          attemptedAt,
          retrievedAt,
        },
        {
          source: 'derived',
          operations: [
            'uncollected/wish main episode duration_seconds or strict raw duration parsing',
            'known planned episode duration seconds / 60',
          ],
          formulaVersion: COLLECTION_BACKLOG_DURATION_FORMULA_VERSION,
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
