import { GeneratedBangumiOpenApiClient } from '@bangumi-agent-kit/bangumi-openapi';
import { HttpClient, PublicErrorInfo, toPublicError } from '@bangumi-agent-kit/bangumi-transport';
import type { CalendarAnimeItem, DomainCalendarDay } from '../models/calendar.js';
import type { UserCollectionItem } from '../models/user.js';
import type { CollectionStatus } from './collection-service.js';
import { UserService } from './user-service.js';
import { CalendarService } from './calendar-service.js';

export const COLLECTION_SCHEDULE_FORMULA_VERSION = 'collection-schedule-v1';
export const COLLECTION_SCHEDULE_DEFAULT_MAX_COLLECTION_ITEMS = 100;
export const COLLECTION_SCHEDULE_MAX_COLLECTION_ITEMS = 200;
export const COLLECTION_SCHEDULE_COLLECTION_PAGE_SIZE = 50;
export const COLLECTION_SCHEDULE_MAX_COLLECTION_PAGES = 8;
export const COLLECTION_SCHEDULE_DEFAULT_MAX_ROWS = 56;
export const COLLECTION_SCHEDULE_MAX_ROWS = 100;
export const COLLECTION_SCHEDULE_MAX_CALENDAR_ROWS = 512;

export type CollectionScheduleStatus = Exclude<CollectionStatus, 'unknown'>;

export type CollectionScheduleState =
  | 'complete'
  | 'partial'
  | 'unavailable'
  | 'auth_required'
  | 'permission_denied'
  | 'rate_limited'
  | 'upstream_error';

export type CollectionScheduleProgressState = 'reported' | 'unknown' | 'invalid' | 'conflict';

export interface CollectionScheduleOptions {
  maxCollectionItems?: number;
  maxRows?: number;
  statuses?: CollectionScheduleStatus[];
}

export interface CollectionScheduleProgress {
  state: CollectionScheduleProgressState;
  watchedEpisodes?: number;
  reportedTotalEpisodes?: number;
  reportedTotalEpisodesRaw?: number | string | null;
  reportedTotalEpisodesValidity: 'valid' | 'missing' | 'unknown' | 'invalid';
  reportedRemainingEpisodes?: number;
  reasons: string[];
}

export interface CollectionScheduleItem {
  subjectId: number;
  name: string;
  nameCn?: string;
  status: CollectionScheduleStatus;
  statusLabel?: string;
  schedule: {
    weekday: {
      id: number;
      en: string;
      cn: string;
      ja: string;
    };
    airDate?: string;
    airWeekday?: number;
    sourceIndex: number;
  };
  progress: CollectionScheduleProgress;
  reasons: string[];
}

export interface CollectionScheduleUnmatchedCalendarItem {
  subjectId: number;
  name: string;
  nameCn?: string;
  weekday: {
    id: number;
    en: string;
    cn: string;
    ja: string;
  };
  airDate?: string;
  airWeekday?: number;
  sourceIndex: number;
  reason: 'not_collected';
}

export interface CollectionScheduleUnmatchedCollectionItem {
  subjectId: number;
  name: string;
  nameCn?: string;
  subjectDate?: string;
  status: CollectionScheduleStatus;
  statusLabel?: string;
  progress: CollectionScheduleProgress;
  reason: 'not_on_calendar';
}

export interface CollectionScheduleData {
  items: CollectionScheduleItem[];
  unmatchedCalendar: CollectionScheduleUnmatchedCalendarItem[];
  unmatchedCollection: CollectionScheduleUnmatchedCollectionItem[];
  summary: {
    calendarRowsObserved: number;
    eligibleCollectionRows: number;
    matchedRows: number;
    unmatchedCalendarRows: number;
    unmatchedCollectionRows: number;
    progressReportedRows: number;
    progressUnknownRows: number;
    progressInvalidRows: number;
    progressConflictRows: number;
    noMatch: boolean;
  };
}

export interface CollectionScheduleCalendarCoverage {
  state: CollectionScheduleState;
  expectedDays: 7;
  sourceDayCount: number;
  missingWeekdays: number[];
  duplicateWeekdays: number[];
  invalidWeekdayCount: number;
  observedRows: number;
  uniqueRows: number;
  duplicateRows: number;
  invalidItemWeekdayCount: number;
  weekdayConflictCount: number;
  returnedRows: number;
  maxRows: number;
  truncated: boolean;
}

export interface CollectionScheduleCollectionCoverage {
  state: CollectionScheduleState;
  sourceTotal?: number;
  requestedMaxItems: number;
  observedRows: number;
  uniqueRows: number;
  eligibleRows: number;
  pageSize: number;
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
  missingFields: Record<string, number>;
}

export interface CollectionScheduleJoinCoverage {
  state: CollectionScheduleState;
  matchedRows: number;
  unmatchedCalendarRows: number;
  unmatchedCollectionRows: number;
  returnedRows: number;
  maxRows: number;
  truncated: boolean;
}

export interface CollectionScheduleResult {
  state: CollectionScheduleState;
  filters: {
    statuses: CollectionScheduleStatus[];
  };
  data: CollectionScheduleData;
  coverage: {
    state: CollectionScheduleState;
    calendar: CollectionScheduleCalendarCoverage;
    collection: CollectionScheduleCollectionCoverage;
    join: CollectionScheduleJoinCoverage;
  };
  source: {
    calendar: {
      class: 'official-legacy';
      operation: 'GET /calendar';
      attemptedAt: string;
      retrievedAt?: string;
    };
    collection: {
      class: 'official_v0';
      operation: 'GET /v0/users/{username}/collections';
      authScope: 'account';
      attemptedAt: string;
      retrievedAt?: string;
    };
  };
  evidence: Array<{
    source: 'official-legacy' | 'official_v0' | 'derived';
    operation?: string;
    operations?: string[];
    formulaVersion?: string;
    authScope?: 'account';
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

interface CalendarRow {
  item: CalendarAnimeItem;
  weekday: DomainCalendarDay['weekday'];
  sourceIndex: number;
}

interface CalendarScan {
  rows: CalendarRow[];
  coverage: CollectionScheduleCalendarCoverage;
  attemptedAt: string;
  retrievedAt?: string;
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
  missingFields: Record<string, number>;
  attemptedAt: string;
  retrievedAt?: string;
  error?: PublicErrorInfo;
}

interface CollectionObservation {
  item: UserCollectionItem;
  duplicateCount: number;
  conflictReasons: string[];
}

function bounded(value: number | undefined, fallback: number, maximum: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(1, Math.trunc(value as number)));
}

function boundedStatuses(
  value: CollectionScheduleStatus[] | undefined,
): CollectionScheduleStatus[] {
  const defaults: CollectionScheduleStatus[] = ['wish', 'doing', 'on_hold'];
  if (!Array.isArray(value) || value.length === 0) return defaults;
  const allowed = new Set<CollectionScheduleStatus>([
    'wish',
    'doing',
    'done',
    'on_hold',
    'dropped',
  ]);
  const statuses = [...new Set(value.filter((status) => allowed.has(status)))];
  return statuses.length > 0 ? statuses : defaults;
}

function emptyData(): CollectionScheduleData {
  return {
    items: [],
    unmatchedCalendar: [],
    unmatchedCollection: [],
    summary: {
      calendarRowsObserved: 0,
      eligibleCollectionRows: 0,
      matchedRows: 0,
      unmatchedCalendarRows: 0,
      unmatchedCollectionRows: 0,
      progressReportedRows: 0,
      progressUnknownRows: 0,
      progressInvalidRows: 0,
      progressConflictRows: 0,
      noMatch: true,
    },
  };
}

function emptyCalendarCoverage(
  state: CollectionScheduleState,
  maxRows: number,
): CollectionScheduleCalendarCoverage {
  return {
    state,
    expectedDays: 7,
    sourceDayCount: 0,
    missingWeekdays: [1, 2, 3, 4, 5, 6, 7],
    duplicateWeekdays: [],
    invalidWeekdayCount: 0,
    observedRows: 0,
    uniqueRows: 0,
    duplicateRows: 0,
    invalidItemWeekdayCount: 0,
    weekdayConflictCount: 0,
    returnedRows: 0,
    maxRows,
    truncated: false,
  };
}

function emptyJoinCoverage(
  state: CollectionScheduleState,
  maxRows: number,
): CollectionScheduleJoinCoverage {
  return {
    state,
    matchedRows: 0,
    unmatchedCalendarRows: 0,
    unmatchedCollectionRows: 0,
    returnedRows: 0,
    maxRows,
    truncated: false,
  };
}

function stateForError(error: PublicErrorInfo): CollectionScheduleState {
  if (error.code === 'AUTH_REQUIRED' || error.code === 'AUTH_EXPIRED') return 'auth_required';
  if (error.code === 'PERMISSION_DENIED') return 'permission_denied';
  if (error.code === 'RATE_LIMITED') return 'rate_limited';
  if (error.code === 'UPSTREAM_ERROR' || error.code === 'UPSTREAM_UNAVAILABLE') {
    return 'upstream_error';
  }
  return 'unavailable';
}

function recordMissing(missingFields: Record<string, number>, field: string): void {
  missingFields[field] = (missingFields[field] || 0) + 1;
}

function sameOptionalValue(left: unknown, right: unknown): boolean {
  return (
    left === right ||
    (left === undefined && right === null) ||
    (left === null && right === undefined)
  );
}

function buildCollectionObservations(items: readonly UserCollectionItem[]): {
  observations: CollectionObservation[];
  duplicateRows: number;
} {
  const byId = new Map<number, CollectionObservation>();
  let duplicateRows = 0;
  for (const item of items) {
    const existing = byId.get(item.subjectId);
    if (!existing) {
      byId.set(item.subjectId, { item, duplicateCount: 0, conflictReasons: [] });
      continue;
    }
    duplicateRows += 1;
    existing.duplicateCount += 1;
    if (existing.item.status !== item.status) {
      existing.conflictReasons.push('重复收藏行的 status 不一致');
    }
    if (!sameOptionalValue(existing.item.epStatus, item.epStatus)) {
      existing.conflictReasons.push('重复收藏行的 ep_status 不一致');
    }
    if (
      existing.item.subjectTotalEpisodes !== item.subjectTotalEpisodes ||
      existing.item.subjectTotalEpisodesValidity !== item.subjectTotalEpisodesValidity
    ) {
      existing.conflictReasons.push('重复收藏行的 subject.eps 证据不一致');
    }
  }
  return {
    observations: [...byId.values()].map((observation) => ({
      ...observation,
      conflictReasons: [...new Set(observation.conflictReasons)],
    })),
    duplicateRows,
  };
}

function progressForCollection(observation: CollectionObservation): CollectionScheduleProgress {
  const item = observation.item;
  const reasons = [...observation.conflictReasons];
  const total = item.subjectTotalEpisodes;
  const watched = item.epStatus;
  const validity = item.subjectTotalEpisodesValidity ?? (total === undefined ? 'missing' : 'valid');
  if (observation.duplicateCount > 0 && observation.conflictReasons.length === 0) {
    reasons.push('重复收藏行已按 subjectId 去重；首行作为展示证据');
  }
  if (validity === 'invalid') reasons.push('subject.eps 原始值无法验证为正整数');
  if (validity === 'unknown') reasons.push('subject.eps 为未知总集数');
  if (validity === 'missing') reasons.push('收藏记录缺少 subject.eps 总集数');
  if (watched === undefined) reasons.push('收藏记录缺少 ep_status 已看集数');
  if (watched !== undefined && (!Number.isSafeInteger(watched) || watched < 0)) {
    reasons.push('收藏记录 ep_status 不是有效的非负整数');
  }
  if (total !== undefined && watched !== undefined && watched > total) {
    reasons.push(`ep_status (${watched}) 大于 subject.eps (${total})`);
  }

  const conflict =
    observation.conflictReasons.length > 0 ||
    (total !== undefined && watched !== undefined && watched > total);
  const invalid =
    validity === 'invalid' ||
    (watched !== undefined && (!Number.isSafeInteger(watched) || watched < 0));
  const validReportedProgress =
    validity === 'valid' &&
    total !== undefined &&
    Number.isSafeInteger(total) &&
    total > 0 &&
    watched !== undefined &&
    Number.isSafeInteger(watched) &&
    watched >= 0 &&
    watched <= total;

  return {
    state: conflict
      ? 'conflict'
      : invalid
        ? 'invalid'
        : validReportedProgress
          ? 'reported'
          : 'unknown',
    watchedEpisodes:
      watched !== undefined && Number.isSafeInteger(watched) && watched >= 0 ? watched : undefined,
    reportedTotalEpisodes: total,
    reportedTotalEpisodesRaw: item.subjectTotalEpisodesRaw,
    reportedTotalEpisodesValidity: validity,
    reportedRemainingEpisodes: validReportedProgress ? total - watched : undefined,
    reasons: [...new Set(reasons)],
  };
}

function calendarRowsFromDays(days: readonly DomainCalendarDay[], maxRows: number): CalendarScan {
  const canonicalByWeekday = new Map<number, DomainCalendarDay>();
  const duplicateWeekdays = new Set<number>();
  let invalidWeekdayCount = 0;
  for (const day of days) {
    const weekdayId = day.weekday.id;
    if (!Number.isInteger(weekdayId) || weekdayId < 1 || weekdayId > 7) {
      invalidWeekdayCount += 1;
      continue;
    }
    const existing = canonicalByWeekday.get(weekdayId);
    if (existing) {
      duplicateWeekdays.add(weekdayId);
      existing.items.push(...day.items);
    } else {
      canonicalByWeekday.set(weekdayId, { ...day, items: [...day.items] });
    }
  }

  const canonicalDays = [...canonicalByWeekday.values()];
  const missingWeekdays = [1, 2, 3, 4, 5, 6, 7].filter(
    (weekday) => !canonicalByWeekday.has(weekday),
  );
  let invalidItemWeekdayCount = 0;
  let weekdayConflictCount = 0;
  const rows: CalendarRow[] = [];
  let sourceIndex = 0;
  for (const day of canonicalDays) {
    for (const item of day.items) {
      if (
        item.airWeekday !== undefined &&
        (!Number.isInteger(item.airWeekday) || item.airWeekday < 1 || item.airWeekday > 7)
      ) {
        invalidItemWeekdayCount += 1;
      } else if (item.airWeekday !== undefined && item.airWeekday !== day.weekday.id) {
        weekdayConflictCount += 1;
      }
      rows.push({ item, weekday: day.weekday, sourceIndex });
      sourceIndex += 1;
    }
  }

  const seenIds = new Set<number>();
  let duplicateRows = 0;
  const uniqueRows = rows.filter((row) => {
    if (seenIds.has(row.item.id)) {
      duplicateRows += 1;
      return false;
    }
    seenIds.add(row.item.id);
    return true;
  });
  const truncated = rows.length > COLLECTION_SCHEDULE_MAX_CALENDAR_ROWS;
  const boundedRows = rows.slice(0, COLLECTION_SCHEDULE_MAX_CALENDAR_ROWS);
  const partial =
    days.length !== 7 ||
    missingWeekdays.length > 0 ||
    duplicateWeekdays.size > 0 ||
    invalidWeekdayCount > 0 ||
    invalidItemWeekdayCount > 0 ||
    weekdayConflictCount > 0 ||
    duplicateRows > 0 ||
    truncated;
  return {
    rows: boundedRows,
    coverage: {
      state: partial ? 'partial' : 'complete',
      expectedDays: 7,
      sourceDayCount: days.length,
      missingWeekdays,
      duplicateWeekdays: [...duplicateWeekdays],
      invalidWeekdayCount,
      observedRows: rows.length,
      uniqueRows: uniqueRows.length,
      duplicateRows,
      invalidItemWeekdayCount,
      weekdayConflictCount,
      returnedRows: 0,
      maxRows,
      truncated,
    },
    attemptedAt: '',
    retrievedAt: undefined,
  };
}

async function scanCalendar(
  calendarService: CalendarService,
  maxRows: number,
): Promise<CalendarScan> {
  const attemptedAt = new Date().toISOString();
  try {
    const days = await calendarService.getCalendar({ useCache: false });
    const retrievedAt = new Date().toISOString();
    const scan = calendarRowsFromDays(days, maxRows);
    scan.attemptedAt = attemptedAt;
    scan.retrievedAt = retrievedAt;
    return scan;
  } catch (error: unknown) {
    const publicError = toPublicError(error);
    return {
      rows: [],
      coverage: emptyCalendarCoverage(stateForError(publicError), maxRows),
      attemptedAt,
      error: publicError,
    };
  }
}

function markCollectionMissingFields(
  missingFields: Record<string, number>,
  item: UserCollectionItem,
): void {
  if (!item.subjectName && !item.subjectNameCn) recordMissing(missingFields, 'subject.name');
  if (!item.subjectDate) recordMissing(missingFields, 'subject.date');
  if (item.epStatus === undefined) recordMissing(missingFields, 'item.ep_status');
  if (item.subjectTotalEpisodesValidity !== 'valid') {
    recordMissing(missingFields, 'subject.eps');
  }
}

async function scanCollection(
  userService: UserService,
  username: string,
  maxItems: number,
): Promise<CollectionScan> {
  const attemptedAt = new Date().toISOString();
  const items: UserCollectionItem[] = [];
  const missingFields: Record<string, number> = {};
  let sourceTotal: number | undefined;
  let pagesAttempted = 0;
  let pagesSucceeded = 0;
  let offset = 0;
  let sourceExhausted = false;
  let pageFailureOffset: number | undefined;
  let pageFailureCode: string | undefined;
  let paginationStalled = false;
  let sourceTotalChanged = false;
  let sourceTotalInvalidated = false;
  let error: PublicErrorInfo | undefined;

  while (
    items.length < maxItems &&
    pagesAttempted < COLLECTION_SCHEDULE_MAX_COLLECTION_PAGES &&
    !sourceExhausted
  ) {
    pagesAttempted += 1;
    const requested = Math.min(COLLECTION_SCHEDULE_COLLECTION_PAGE_SIZE, maxItems - items.length);
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
      pageItems.forEach((item) => markCollectionMissingFields(missingFields, item));
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
    } catch (caught: unknown) {
      error = toPublicError(caught);
      pageFailureOffset = offset;
      pageFailureCode = error.code;
      break;
    }
  }

  const retrievedAt = pagesSucceeded > 0 ? new Date().toISOString() : undefined;
  const truncated =
    !sourceExhausted &&
    (items.length >= maxItems || pagesAttempted >= COLLECTION_SCHEDULE_MAX_COLLECTION_PAGES);
  return {
    items,
    sourceTotal,
    requestedMaxItems: maxItems,
    pagesAttempted,
    pagesSucceeded,
    sourceExhausted,
    truncated,
    duplicateRows: buildCollectionObservations(items).duplicateRows,
    pageFailureOffset,
    pageFailureCode,
    paginationStalled,
    sourceTotalChanged,
    missingFields,
    attemptedAt,
    retrievedAt,
    error,
  };
}

function progressStateCount(
  data: CollectionScheduleData,
  progress: CollectionScheduleProgress,
): void {
  if (progress.state === 'reported') data.summary.progressReportedRows += 1;
  if (progress.state === 'unknown') data.summary.progressUnknownRows += 1;
  if (progress.state === 'invalid') data.summary.progressInvalidRows += 1;
  if (progress.state === 'conflict') data.summary.progressConflictRows += 1;
}

function makeUnmatchedCollectionItem(
  observation: CollectionObservation,
): CollectionScheduleUnmatchedCollectionItem {
  const item = observation.item;
  return {
    subjectId: item.subjectId,
    name: item.subjectName || `Subject ${item.subjectId}`,
    nameCn: item.subjectNameCn,
    subjectDate: item.subjectDate,
    status: item.status as CollectionScheduleStatus,
    statusLabel: item.statusLabel,
    progress: progressForCollection(observation),
    reason: 'not_on_calendar',
  };
}

function makeUnmatchedCalendarItem(row: CalendarRow): CollectionScheduleUnmatchedCalendarItem {
  return {
    subjectId: row.item.id,
    name: row.item.name,
    nameCn: row.item.nameCn,
    weekday: row.weekday,
    airDate: row.item.airDate,
    airWeekday: row.item.airWeekday,
    sourceIndex: row.sourceIndex,
    reason: 'not_collected',
  };
}

function limitations(): string[] {
  return [
    '日历来自官方 legacy GET /calendar；air_date 表示作品首播日期，不是本周具体播出时刻，官方源未提供时区语义。',
    '收藏进度来自当前账号收藏接口的 ep_status 与 subject.eps 源字段；这是收藏信封证据，不是逐章节 episode collection 的完整进度认证。',
    '结果只覆盖选定收藏状态和本次官方分页观察到的有界动画收藏样本；未匹配不等同于作品本周没有播出或收藏已失效。',
    'collection.updated_at 只保留为上游字段的可见性，不解释为可靠的观看事件或收藏活动时间。',
    '结果不读取评论、不调用 HTML/Structured Web/快照、不计算历史趋势、不执行推荐或任何收藏写入。',
  ];
}

function baseResult(
  options: { maxItems: number; maxRows: number; statuses: CollectionScheduleStatus[] },
  calendar: CalendarScan,
  collection: CollectionScan,
): CollectionScheduleResult {
  const calendarState = calendar.error ? stateForError(calendar.error) : calendar.coverage.state;
  const collectionState =
    collection.error && collection.pagesSucceeded === 0
      ? stateForError(collection.error)
      : collection.pagesSucceeded > 0
        ? collection.sourceTotalChanged || collection.truncated || collection.pageFailureCode
          ? 'partial'
          : 'complete'
        : collection.error
          ? stateForError(collection.error)
          : 'complete';
  const state = calendar.error
    ? calendarState
    : collection.error && collection.pagesSucceeded === 0
      ? collectionState
      : 'partial';
  const result: CollectionScheduleResult = {
    state,
    filters: { statuses: [...options.statuses] },
    data: emptyData(),
    coverage: {
      state,
      calendar: calendar.coverage,
      collection: {
        state: collectionState,
        sourceTotal: collection.sourceTotal,
        requestedMaxItems: options.maxItems,
        observedRows: collection.items.length,
        uniqueRows: 0,
        eligibleRows: 0,
        pageSize: Math.min(COLLECTION_SCHEDULE_COLLECTION_PAGE_SIZE, options.maxItems),
        pagesAttempted: collection.pagesAttempted,
        pagesSucceeded: collection.pagesSucceeded,
        maxPages: COLLECTION_SCHEDULE_MAX_COLLECTION_PAGES,
        sourceExhausted: collection.sourceExhausted,
        truncated: collection.truncated,
        duplicateRows: collection.duplicateRows,
        pageFailureOffset: collection.pageFailureOffset,
        pageFailureCode: collection.pageFailureCode,
        paginationStalled: collection.paginationStalled,
        sourceTotalChanged: collection.sourceTotalChanged,
        missingFields: collection.missingFields,
      },
      join: emptyJoinCoverage(state, options.maxRows),
    },
    source: {
      calendar: {
        class: 'official-legacy',
        operation: 'GET /calendar',
        attemptedAt: calendar.attemptedAt,
        retrievedAt: calendar.retrievedAt,
      },
      collection: {
        class: 'official_v0',
        operation: 'GET /v0/users/{username}/collections',
        authScope: 'account',
        attemptedAt: collection.attemptedAt,
        retrievedAt: collection.retrievedAt,
      },
    },
    evidence: [
      {
        source: 'official-legacy',
        operation: 'GET /calendar',
        attemptedAt: calendar.attemptedAt,
        retrievedAt: calendar.retrievedAt,
      },
      {
        source: 'official_v0',
        operation: 'GET /v0/users/{username}/collections',
        authScope: 'account',
        attemptedAt: collection.attemptedAt,
        retrievedAt: collection.retrievedAt,
      },
    ],
    limitations: limitations(),
    warnings: [],
    error: calendar.error || collection.error,
  };
  return result;
}

function addWarning(
  result: CollectionScheduleResult,
  code: string,
  state: 'partial' | 'unavailable',
  message: string,
): void {
  result.warnings.push({ code, state, message });
}

function finalizeUnavailable(result: CollectionScheduleResult): CollectionScheduleResult {
  const primaryError = result.error;
  if (primaryError) {
    addWarning(
      result,
      primaryError.code,
      'unavailable',
      '所需数据源暂时不可用，未生成猜测的个人播出计划。',
    );
  }
  result.coverage.join.state = result.state;
  result.coverage.state = result.state;
  return result;
}

function finalizeSchedule(
  result: CollectionScheduleResult,
  calendar: CalendarScan,
  collection: CollectionScan,
  statuses: readonly CollectionScheduleStatus[],
  maxRows: number,
): CollectionScheduleResult {
  if (calendar.error || (collection.error && collection.pagesSucceeded === 0)) {
    return finalizeUnavailable(result);
  }

  const { observations, duplicateRows } = buildCollectionObservations(collection.items);
  const eligible = observations.filter((observation) =>
    statuses.includes(observation.item.status as CollectionScheduleStatus),
  );
  const bySubjectId = new Map(
    eligible.map((observation) => [observation.item.subjectId, observation]),
  );
  const calendarSubjectIds = new Set(calendar.rows.map((row) => row.item.id));
  const matched: CollectionScheduleItem[] = [];
  const unmatchedCalendar: CollectionScheduleUnmatchedCalendarItem[] = [];
  for (const row of calendar.rows) {
    const observation = bySubjectId.get(row.item.id);
    if (!observation) {
      unmatchedCalendar.push(makeUnmatchedCalendarItem(row));
      continue;
    }
    const progress = progressForCollection(observation);
    const reasons = [...progress.reasons];
    if (row.item.airDate.trim() === '') reasons.push('日历条目缺少 air_date');
    if (
      row.item.airWeekday !== undefined &&
      Number.isInteger(row.item.airWeekday) &&
      row.item.airWeekday !== row.weekday.id
    ) {
      reasons.push('日历条目的 air_weekday 与所属星期不一致');
    }
    matched.push({
      subjectId: row.item.id,
      name: row.item.name || observation.item.subjectName || `Subject ${row.item.id}`,
      nameCn: row.item.nameCn || observation.item.subjectNameCn,
      status: observation.item.status as CollectionScheduleStatus,
      statusLabel: observation.item.statusLabel,
      schedule: {
        weekday: row.weekday,
        airDate: row.item.airDate,
        airWeekday: row.item.airWeekday,
        sourceIndex: row.sourceIndex,
      },
      progress,
      reasons: [...new Set(reasons)],
    });
  }

  const unmatchedCollection = eligible
    .filter((observation) => !calendarSubjectIds.has(observation.item.subjectId))
    .map(makeUnmatchedCollectionItem);
  const allRows = [
    ...matched.map((item) => ({ kind: 'matched' as const, item })),
    ...unmatchedCalendar.map((item) => ({ kind: 'calendar' as const, item })),
    ...unmatchedCollection.map((item) => ({ kind: 'collection' as const, item })),
  ];
  const returnedRows = allRows.slice(0, maxRows);
  const returnedMatched = returnedRows
    .filter((row) => row.kind === 'matched')
    .map((row) => row.item as CollectionScheduleItem);
  const returnedCalendar = returnedRows
    .filter((row) => row.kind === 'calendar')
    .map((row) => row.item as CollectionScheduleUnmatchedCalendarItem);
  const returnedCollection = returnedRows
    .filter((row) => row.kind === 'collection')
    .map((row) => row.item as CollectionScheduleUnmatchedCollectionItem);
  const data: CollectionScheduleData = {
    items: returnedMatched,
    unmatchedCalendar: returnedCalendar,
    unmatchedCollection: returnedCollection,
    summary: {
      calendarRowsObserved: calendar.rows.length,
      eligibleCollectionRows: eligible.length,
      matchedRows: matched.length,
      unmatchedCalendarRows: unmatchedCalendar.length,
      unmatchedCollectionRows: unmatchedCollection.length,
      progressReportedRows: 0,
      progressUnknownRows: 0,
      progressInvalidRows: 0,
      progressConflictRows: 0,
      noMatch: matched.length === 0,
    },
  };
  [...matched, ...unmatchedCollection].forEach((item) => {
    progressStateCount(data, item.progress);
  });

  const sourcePartial =
    calendar.coverage.state === 'partial' ||
    collection.truncated ||
    collection.pageFailureCode !== undefined ||
    collection.paginationStalled ||
    collection.sourceTotalChanged ||
    duplicateRows > 0 ||
    Object.keys(collection.missingFields).length > 0 ||
    data.summary.progressInvalidRows > 0 ||
    data.summary.progressConflictRows > 0 ||
    data.summary.progressUnknownRows > 0 ||
    returnedRows.length < allRows.length;
  const state: CollectionScheduleState = sourcePartial ? 'partial' : 'complete';
  const collectionPartial =
    collection.truncated ||
    collection.pageFailureCode !== undefined ||
    collection.paginationStalled ||
    collection.sourceTotalChanged ||
    duplicateRows > 0 ||
    Object.keys(collection.missingFields).length > 0 ||
    data.summary.progressInvalidRows > 0 ||
    data.summary.progressConflictRows > 0 ||
    data.summary.progressUnknownRows > 0;
  const collectionState: CollectionScheduleState = collectionPartial
    ? 'partial'
    : result.coverage.collection.state;
  result.state = state;
  result.data = data;
  result.coverage.calendar = {
    ...calendar.coverage,
    returnedRows: returnedMatched.length + returnedCalendar.length,
    state: calendar.coverage.state,
  };
  result.coverage.collection = {
    ...result.coverage.collection,
    state: collectionState,
    uniqueRows: observations.length,
    eligibleRows: eligible.length,
  };
  result.coverage.join = {
    state,
    matchedRows: matched.length,
    unmatchedCalendarRows: unmatchedCalendar.length,
    unmatchedCollectionRows: unmatchedCollection.length,
    returnedRows: returnedRows.length,
    maxRows,
    truncated: returnedRows.length < allRows.length,
  };
  result.coverage.state = state;
  result.evidence.push({
    source: 'derived',
    operations: ['GET /calendar', 'GET /v0/users/{username}/collections'],
    formulaVersion: COLLECTION_SCHEDULE_FORMULA_VERSION,
    authScope: 'account',
    attemptedAt: result.source.collection.attemptedAt,
    retrievedAt: result.source.collection.retrievedAt,
  });
  if (state === 'partial') {
    if (
      calendar.coverage.missingWeekdays.length > 0 ||
      calendar.coverage.duplicateWeekdays.length > 0
    ) {
      addWarning(
        result,
        'CALENDAR_DAY_COVERAGE',
        'partial',
        '官方日历星期覆盖不完整或含重复星期；未补造缺失日期。',
      );
    }
    if (
      calendar.coverage.invalidItemWeekdayCount > 0 ||
      calendar.coverage.weekdayConflictCount > 0
    ) {
      addWarning(
        result,
        'CALENDAR_WEEKDAY_CONFLICT',
        'partial',
        '部分日历条目的 air_weekday 无效或与所属星期冲突；保留源字段，不自行改写。',
      );
    }
    if (calendar.coverage.duplicateRows > 0) {
      addWarning(
        result,
        'CALENDAR_DUPLICATE_ROWS',
        'partial',
        `官方日历返回 ${calendar.coverage.duplicateRows} 条重复 subject 行；重复证据未静默删除。`,
      );
    }
    if (calendar.coverage.truncated) {
      addWarning(
        result,
        'CALENDAR_OUTPUT_TRUNCATED',
        'partial',
        '官方日历观察行达到安全上限；未观察内容没有被猜测补全。',
      );
    }
    if (collection.truncated) {
      addWarning(
        result,
        'COLLECTION_PARTIAL_SCAN',
        'partial',
        '当前账号动画收藏达到扫描上限；未观察收藏不会被猜测加入本周计划。',
      );
    }
    if (collection.pageFailureCode) {
      addWarning(
        result,
        'COLLECTION_PAGE_FAILURE',
        'partial',
        `收藏在偏移 ${collection.pageFailureOffset ?? '?'} 处读取失败；已保留此前成功观察的数据。`,
      );
    }
    if (collection.paginationStalled) {
      addWarning(
        result,
        'COLLECTION_PAGINATION_STALLED',
        'partial',
        '收藏分页没有产生新的偏移量；扫描已停止。',
      );
    }
    if (collection.sourceTotalChanged) {
      addWarning(
        result,
        'COLLECTION_SOURCE_TOTAL_CHANGED',
        'partial',
        '收藏分页期间 sourceTotal 发生变化；覆盖仅代表本次观察样本。',
      );
    }
    if (collection.duplicateRows > 0) {
      addWarning(
        result,
        'COLLECTION_DUPLICATE_ROWS',
        'partial',
        `官方收藏分页返回 ${collection.duplicateRows} 条重复 subject 行；匹配按 subjectId 去重。`,
      );
    }
    if (Object.keys(collection.missingFields).length > 0) {
      addWarning(
        result,
        'COLLECTION_MISSING_FIELDS',
        'partial',
        '部分收藏记录缺少进度或总集数字段；对应进度保持 unknown。',
      );
    }
    if (data.summary.progressConflictRows > 0 || data.summary.progressInvalidRows > 0) {
      addWarning(
        result,
        'COLLECTION_PROGRESS_CONFLICT',
        'partial',
        '部分收藏进度字段冲突或无效；未生成剩余集数。',
      );
    }
    if (data.summary.progressUnknownRows > 0) {
      addWarning(
        result,
        'COLLECTION_PROGRESS_UNKNOWN',
        'partial',
        '部分收藏缺少可验证的总集数或 ep_status；进度保持 unknown。',
      );
    }
    if (result.coverage.join.truncated) {
      addWarning(
        result,
        'SCHEDULE_OUTPUT_TRUNCATED',
        'partial',
        `匹配与未匹配行达到 ${maxRows} 条输出上限；覆盖计数仍保留。`,
      );
    }
  }
  result.source.calendar.retrievedAt = calendar.retrievedAt;
  result.source.collection.retrievedAt = collection.retrievedAt;
  if (collection.error && collection.pagesSucceeded > 0) result.error = collection.error;
  return result;
}

export class CollectionScheduleService {
  private readonly userService: UserService;
  private readonly calendarService: CalendarService;

  constructor(client: GeneratedBangumiOpenApiClient | HttpClient, publicClient?: HttpClient) {
    this.userService = new UserService(client);
    this.calendarService = new CalendarService(
      publicClient || (client instanceof HttpClient ? client : new HttpClient()),
    );
  }

  async getCollectionSchedule(
    username: string,
    options: CollectionScheduleOptions = {},
  ): Promise<CollectionScheduleResult> {
    const maxItems = bounded(
      options.maxCollectionItems,
      COLLECTION_SCHEDULE_DEFAULT_MAX_COLLECTION_ITEMS,
      COLLECTION_SCHEDULE_MAX_COLLECTION_ITEMS,
    );
    const maxRows = bounded(
      options.maxRows,
      COLLECTION_SCHEDULE_DEFAULT_MAX_ROWS,
      COLLECTION_SCHEDULE_MAX_ROWS,
    );
    const statuses = boundedStatuses(options.statuses);
    const [calendar, collection] = await Promise.all([
      scanCalendar(this.calendarService, maxRows),
      scanCollection(this.userService, username, maxItems),
    ]);
    const result = baseResult({ maxItems, maxRows, statuses }, calendar, collection);
    return finalizeSchedule(result, calendar, collection, statuses, maxRows);
  }
}
