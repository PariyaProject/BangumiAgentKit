import { BangumiError, HttpClient, toPublicError } from '@bangumi-agent-kit/bangumi-transport';
import { DomainCalendarDay } from '../models/calendar.js';

interface RawCalendarDay {
  weekday: { en?: string; cn?: string; ja?: string; id: number };
  items: RawCalendarItem[];
}

interface RawCalendarItem {
  id: number;
  type?: number;
  name: string;
  name_cn?: string;
  summary?: string;
  air_date?: string;
  air_weekday?: number;
  rating?: { score?: number };
  rank?: number;
  collection?: { doing?: number };
  images?: Record<string, string>;
}

export interface CalendarIntelligenceOptions {
  weekday?: number;
  maxPerDay?: number;
  maxTotal?: number;
}

export interface CalendarIntelligenceDay extends DomainCalendarDay {
  observed: number;
  returned: number;
  overflowCount: number;
}

export interface CalendarIntelligenceResult {
  state: 'complete' | 'partial' | 'unavailable';
  days: CalendarIntelligenceDay[];
  coverage: {
    state: 'complete' | 'partial' | 'unavailable';
    observed: number;
    returned: number;
    selectedDays: number;
    maxPerDay: number;
    maxTotal: number;
    expectedDays: 7;
    sourceDayCount: number;
    missingWeekdays: number[];
    duplicateWeekdays: number[];
    extraDayEnvelopes: number;
    invalidWeekdayCount: number;
    requestedWeekday?: number;
    missingFields: Record<string, number>;
    dateSemantics: 'first_air_date';
    weekdaySemantics: string;
  };
  source: {
    class: 'official-legacy';
    operation: 'GET /calendar';
    retrievedAt?: string;
    attemptedAt?: string;
    cache?: 'bypassed' | 'unknown';
  };
  evidence: Array<{
    source: 'official-legacy' | 'derived-s7';
    operation?: string;
    formulaVersion?: string;
    retrievedAt?: string;
    attemptedAt?: string;
  }>;
  limitations: string[];
  warnings: Array<{
    code: string;
    state: 'partial' | 'unavailable';
    message: string;
  }>;
  error?: ReturnType<typeof toPublicError>;
}

const CALENDAR_EXPECTED_DAYS = 7;
const CALENDAR_DEFAULT_MAX_PER_DAY = 3;
const CALENDAR_MAX_PER_DAY = 8;
const CALENDAR_DEFAULT_MAX_TOTAL = 21;
const CALENDAR_MAX_TOTAL = 56;

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function schemaError(path: string, expected: string): BangumiError {
  return new BangumiError('PARSER_ERROR', `calendar.${path} 应为 ${expected}`, false);
}

function optionalString(value: unknown, path: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw schemaError(path, '字符串');
  return value;
}

function optionalNumber(
  value: unknown,
  path: string,
  options: { integer?: boolean } = {},
): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw schemaError(path, options.integer ? '整数' : '数字');
  }
  if (options.integer && !Number.isInteger(value)) throw schemaError(path, '整数');
  return value;
}

function parseCalendarItem(value: unknown, path: string): RawCalendarItem {
  if (!isRecord(value)) throw schemaError(path, '对象');

  const id = optionalNumber(value.id, `${path}.id`, { integer: true });
  if (id === undefined || id <= 0) throw schemaError(`${path}.id`, '正整数');
  const name = optionalString(value.name, `${path}.name`);
  if (name === undefined) throw schemaError(`${path}.name`, '字符串');

  const rating = value.rating;
  let parsedRating: RawCalendarItem['rating'];
  if (rating !== undefined && rating !== null) {
    if (!isRecord(rating)) throw schemaError(`${path}.rating`, '对象');
    parsedRating = {
      score: optionalNumber(rating.score, `${path}.rating.score`),
    };
  }

  const collection = value.collection;
  let parsedCollection: RawCalendarItem['collection'];
  if (collection !== undefined && collection !== null) {
    if (!isRecord(collection)) throw schemaError(`${path}.collection`, '对象');
    parsedCollection = {
      doing: optionalNumber(collection.doing, `${path}.collection.doing`),
    };
  }

  const images = value.images;
  let parsedImages: RawCalendarItem['images'];
  if (images !== undefined && images !== null) {
    if (!isRecord(images)) throw schemaError(`${path}.images`, '对象');
    parsedImages = {};
    for (const [key, image] of Object.entries(images)) {
      if (typeof image !== 'string') throw schemaError(`${path}.images.${key}`, '字符串');
      parsedImages[key] = image;
    }
  }

  return {
    id,
    type: optionalNumber(value.type, `${path}.type`, { integer: true }),
    name,
    name_cn: optionalString(value.name_cn, `${path}.name_cn`),
    summary: optionalString(value.summary, `${path}.summary`),
    air_date: optionalString(value.air_date, `${path}.air_date`),
    air_weekday: optionalNumber(value.air_weekday, `${path}.air_weekday`, { integer: true }),
    rating: parsedRating,
    rank: optionalNumber(value.rank, `${path}.rank`, { integer: true }),
    collection: parsedCollection,
    images: parsedImages,
  };
}

/** Validate the legacy calendar envelope before mapping any fields into domain data. */
export function parseCalendarPayload(raw: unknown): RawCalendarDay[] {
  if (!Array.isArray(raw)) throw schemaError('payload', '七日数组');

  return raw.map((value, dayIndex) => {
    if (!isRecord(value)) throw schemaError(`days[${dayIndex}]`, '对象');
    if (!isRecord(value.weekday)) throw schemaError(`days[${dayIndex}].weekday`, '对象');
    const weekdayId = optionalNumber(value.weekday.id, `days[${dayIndex}].weekday.id`, {
      integer: true,
    });
    if (weekdayId === undefined || weekdayId < 1 || weekdayId > CALENDAR_EXPECTED_DAYS) {
      throw schemaError(`days[${dayIndex}].weekday.id`, '1 至 7 的整数');
    }
    if (!Array.isArray(value.items)) throw schemaError(`days[${dayIndex}].items`, '数组');

    return {
      weekday: {
        en: optionalString(value.weekday.en, `days[${dayIndex}].weekday.en`),
        cn: optionalString(value.weekday.cn, `days[${dayIndex}].weekday.cn`),
        ja: optionalString(value.weekday.ja, `days[${dayIndex}].weekday.ja`),
        id: weekdayId,
      },
      items: value.items.map((item, itemIndex) =>
        parseCalendarItem(item, `days[${dayIndex}].items[${itemIndex}]`),
      ),
    };
  });
}

export function calendarSubjectTypeLabel(type?: number): string | undefined {
  if (type === undefined) return undefined;
  return (
    (
      {
        1: 'book',
        2: 'anime',
        3: 'music',
        4: 'game',
        6: 'real',
      } as Record<number, string>
    )[type] || 'other'
  );
}

function boundedLimit(value: number | undefined, fallback: number, maximum: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(1, Math.trunc(value as number)));
}

function calendarLimitOptions(options: CalendarIntelligenceOptions = {}) {
  return {
    maxPerDay: boundedLimit(options.maxPerDay, CALENDAR_DEFAULT_MAX_PER_DAY, CALENDAR_MAX_PER_DAY),
    maxTotal: boundedLimit(options.maxTotal, CALENDAR_DEFAULT_MAX_TOTAL, CALENDAR_MAX_TOTAL),
  };
}

function calendarWarningCode(errorCode: string): string {
  if (errorCode === 'RATE_LIMITED') return 'UPSTREAM_RATE_LIMITED';
  if (errorCode === 'NOT_FOUND') return 'UPSTREAM_NOT_FOUND';
  if (errorCode === 'PARSER_ERROR') return 'SCHEMA_DRIFT';
  return 'UPSTREAM_UNAVAILABLE';
}

export function buildCalendarIntelligence(
  calendarDays: readonly DomainCalendarDay[],
  options: CalendarIntelligenceOptions = {},
  retrievedAt = new Date().toISOString(),
  attemptedAt = retrievedAt,
  cache: 'bypassed' | 'unknown' = 'unknown',
): CalendarIntelligenceResult {
  const { maxPerDay, maxTotal } = calendarLimitOptions(options);
  const sourceDayCount = calendarDays.length;
  const canonicalByWeekday = new Map<number, DomainCalendarDay>();
  const duplicateWeekdays = new Set<number>();
  let invalidWeekdayCount = 0;
  for (const day of calendarDays) {
    const weekdayId = day.weekday.id;
    if (!Number.isInteger(weekdayId) || weekdayId < 1 || weekdayId > CALENDAR_EXPECTED_DAYS) {
      invalidWeekdayCount += 1;
      continue;
    }
    const existing = canonicalByWeekday.get(weekdayId);
    if (existing) {
      duplicateWeekdays.add(weekdayId);
      canonicalByWeekday.set(weekdayId, {
        ...existing,
        items: [...existing.items, ...day.items],
      });
      continue;
    }
    canonicalByWeekday.set(weekdayId, day);
  }
  const canonicalDays = Array.from(canonicalByWeekday.values()).slice(0, CALENDAR_EXPECTED_DAYS);
  const seenWeekdays = new Set(canonicalDays.map((day) => day.weekday.id));
  const missingWeekdays = Array.from(
    { length: CALENDAR_EXPECTED_DAYS },
    (_, index) => index + 1,
  ).filter((weekday) => !seenWeekdays.has(weekday));
  const weekdayFilterIsValid =
    options.weekday === undefined ||
    (Number.isInteger(options.weekday) &&
      options.weekday >= 1 &&
      options.weekday <= CALENDAR_EXPECTED_DAYS);
  const filteredDays = !weekdayFilterIsValid
    ? []
    : options.weekday === undefined
      ? canonicalDays
      : canonicalDays.filter((day) => day.weekday.id === options.weekday);
  let remaining = maxTotal;
  let observed = 0;
  let returned = 0;
  const missingFields: Record<string, number> = {};

  const recordMissing = (field: string) => {
    missingFields[field] = (missingFields[field] || 0) + 1;
  };

  const days = filteredDays.map((day): CalendarIntelligenceDay => {
    const sourceItems = day.items || [];
    for (const item of sourceItems) {
      if (item.nameCnProvided === false || !item.nameCn.trim()) recordMissing('item.name_cn');
      if (!item.airDate.trim()) recordMissing('item.air_date');
      if (item.score === undefined) recordMissing('item.rating.score');
      if (item.rank === undefined) recordMissing('item.rank');
      if (item.collectionDoing === undefined) recordMissing('item.collection.doing');
      if (item.type === undefined) recordMissing('item.type');
    }
    const itemLimit = Math.min(maxPerDay, remaining);
    const items = sourceItems.slice(0, itemLimit);
    observed += sourceItems.length;
    returned += items.length;
    remaining -= items.length;
    return {
      ...day,
      items,
      observed: sourceItems.length,
      returned: items.length,
      overflowCount: Math.max(0, sourceItems.length - items.length),
    };
  });

  const sourceCoveragePartial =
    sourceDayCount !== CALENDAR_EXPECTED_DAYS ||
    missingWeekdays.length > 0 ||
    duplicateWeekdays.size > 0 ||
    invalidWeekdayCount > 0;
  const outputTruncated = returned < observed;
  const invalidWeekdayFilter = !weekdayFilterIsValid;
  const partial = sourceCoveragePartial || outputTruncated || invalidWeekdayFilter;
  const warnings: CalendarIntelligenceResult['warnings'] = [];
  if (sourceCoveragePartial) {
    const sourceDetails = [
      `官方日历返回 ${sourceDayCount} 个星期，预期 7 个`,
      missingWeekdays.length ? `缺少星期 ${missingWeekdays.join('、')}` : undefined,
      duplicateWeekdays.size
        ? `重复星期 ${Array.from(duplicateWeekdays).join('、')} 已合并条目`
        : undefined,
      invalidWeekdayCount ? `忽略 ${invalidWeekdayCount} 个无效星期` : undefined,
    ]
      .filter(Boolean)
      .join('；');
    warnings.push({
      code: 'SOURCE_DAY_COVERAGE',
      state: 'partial',
      message: `${sourceDetails}，coverage 为 partial。`,
    });
  }
  if (invalidWeekdayFilter) {
    warnings.push({
      code: 'INVALID_WEEKDAY_FILTER',
      state: 'partial',
      message: 'weekday 必须是 1 至 7 的整数；未生成筛选结果。',
    });
  }
  if (outputTruncated) {
    warnings.push({
      code: 'OUTPUT_TRUNCATED',
      state: 'partial',
      message: '日历关系达到显示上限，coverage 仅代表官方源返回样本。',
    });
  }
  return {
    state: partial ? 'partial' : 'complete',
    days,
    coverage: {
      state: partial ? 'partial' : 'complete',
      observed,
      returned,
      selectedDays: filteredDays.length,
      maxPerDay,
      maxTotal,
      expectedDays: CALENDAR_EXPECTED_DAYS,
      sourceDayCount,
      missingWeekdays,
      duplicateWeekdays: Array.from(duplicateWeekdays),
      extraDayEnvelopes: Math.max(0, sourceDayCount - canonicalDays.length),
      invalidWeekdayCount,
      requestedWeekday: options.weekday,
      missingFields,
      dateSemantics: 'first_air_date',
      weekdaySemantics:
        '1=Monday,2=Tuesday,3=Wednesday,4=Thursday,5=Friday,6=Saturday,7=Sunday; timezone=source-unspecified',
    },
    source: {
      class: 'official-legacy',
      operation: 'GET /calendar',
      retrievedAt,
      attemptedAt,
      cache,
    },
    evidence: [
      {
        source: 'official-legacy',
        operation: 'GET /calendar',
        retrievedAt,
        attemptedAt,
      },
      {
        source: 'derived-s7',
        formulaVersion: 'calendar-schedule-v1',
        retrievedAt,
        attemptedAt,
      },
    ],
    limitations: [
      'air_date 表示作品首播日期，不是本周具体播出时间或播出时刻；顺序不等同于推荐或热度排序。',
      'weekday 使用官方周一至周日编号（1=周一，7=周日）；官方源未提供时区语义。',
      '结果不包含个人收藏、观看进度或账号个性化状态。',
      '评分、排名、类型或日期缺失时保持未知，不从其他页面推断。',
    ],
    warnings,
  };
}

export class CalendarService {
  constructor(private client: HttpClient) {}

  async getCalendar(options: { useCache?: boolean } = {}): Promise<DomainCalendarDay[]> {
    const useCache = options.useCache !== false;
    const raw = await this.client.request<unknown>({
      method: 'GET',
      path: '/calendar',
      cacheContext: useCache ? { operationId: 'getCalendar' } : undefined,
      cacheTtlSeconds: useCache ? 3600 : undefined,
    });

    return parseCalendarPayload(raw).map((day) => ({
      weekday: {
        en: day.weekday?.en || '',
        cn: day.weekday?.cn || '',
        ja: day.weekday?.ja || '',
        id: day.weekday?.id || 0,
      },
      items: (day.items || []).map((item) => ({
        id: item.id,
        type: item.type,
        typeLabel: calendarSubjectTypeLabel(item.type),
        name: item.name || '',
        nameCn: item.name_cn?.trim() || item.name,
        nameCnProvided: Boolean(item.name_cn?.trim()),
        airDate: item.air_date || '',
        airWeekday: item.air_weekday,
        summary: item.summary,
        score: item.rating?.score,
        rank: item.rank,
        collectionDoing: item.collection?.doing,
        images: item.images,
      })),
    }));
  }

  async getCalendarIntelligence(
    options: CalendarIntelligenceOptions = {},
  ): Promise<CalendarIntelligenceResult> {
    const attemptedAt = new Date().toISOString();
    try {
      const calendar = await this.getCalendar({ useCache: false });
      const retrievedAt = new Date().toISOString();
      return buildCalendarIntelligence(calendar, options, retrievedAt, attemptedAt, 'bypassed');
    } catch (err) {
      const publicError = toPublicError(err);
      const { maxPerDay, maxTotal } = calendarLimitOptions(options);
      return {
        state: 'unavailable',
        days: [],
        coverage: {
          state: 'unavailable',
          observed: 0,
          returned: 0,
          selectedDays: 0,
          maxPerDay,
          maxTotal,
          expectedDays: CALENDAR_EXPECTED_DAYS,
          sourceDayCount: 0,
          missingWeekdays: Array.from({ length: CALENDAR_EXPECTED_DAYS }, (_, index) => index + 1),
          duplicateWeekdays: [],
          extraDayEnvelopes: 0,
          invalidWeekdayCount: 0,
          requestedWeekday: options.weekday,
          missingFields: {},
          dateSemantics: 'first_air_date',
          weekdaySemantics:
            '1=Monday,2=Tuesday,3=Wednesday,4=Thursday,5=Friday,6=Saturday,7=Sunday; timezone=source-unspecified',
        },
        source: {
          class: 'official-legacy',
          operation: 'GET /calendar',
          attemptedAt,
          cache: 'bypassed',
        },
        evidence: [
          {
            source: 'official-legacy',
            operation: 'GET /calendar',
            attemptedAt,
          },
        ],
        limitations: [
          '官方日历源不可用时不返回猜测的播出计划。',
          'weekday 使用官方周一至周日编号（1=周一，7=周日）；官方源未提供时区语义。',
          '结果不包含个人收藏、观看进度或账号个性化状态。',
          'air_date 表示作品首播日期，不是本周具体播出时间或播出时刻。',
        ],
        warnings: [
          {
            code: calendarWarningCode(publicError.code),
            state: 'unavailable',
            message: '官方日历源暂时不可用，未生成日历样本。',
          },
        ],
        error: publicError,
      };
    }
  }
}
