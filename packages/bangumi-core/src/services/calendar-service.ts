import { HttpClient, toPublicError } from '@bangumi-agent-kit/bangumi-transport';
import { DomainCalendarDay } from '../models/calendar.js';

interface RawCalendarDay {
  weekday?: { en?: string; cn?: string; ja?: string; id?: number };
  items?: Array<{
    id: number;
    type?: number;
    name?: string;
    name_cn?: string;
    summary?: string;
    air_date?: string;
    air_weekday?: number;
    rating?: { score?: number };
    rank?: number;
    collection?: { doing?: number };
    images?: Record<string, string>;
  }>;
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
  };
  source: {
    class: 'official-legacy';
    operation: 'GET /calendar';
    retrievedAt: string;
  };
  evidence: Array<{
    source: 'official-legacy' | 'derived-s7';
    operation?: string;
    formulaVersion?: string;
    retrievedAt: string;
  }>;
  limitations: string[];
  warnings: Array<{
    code: string;
    state: 'partial' | 'unavailable';
    message: string;
  }>;
  error?: ReturnType<typeof toPublicError>;
}

const CALENDAR_DEFAULT_MAX_PER_DAY = 8;
const CALENDAR_MAX_PER_DAY = 8;
const CALENDAR_DEFAULT_MAX_TOTAL = 56;
const CALENDAR_MAX_TOTAL = 56;

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
): CalendarIntelligenceResult {
  const { maxPerDay, maxTotal } = calendarLimitOptions(options);
  const selectedDays = options.weekday
    ? calendarDays.filter((day) => day.weekday.id === options.weekday)
    : calendarDays;
  let remaining = maxTotal;
  let observed = 0;
  let returned = 0;

  const days = selectedDays.map((day): CalendarIntelligenceDay => {
    const sourceItems = day.items || [];
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

  const partial = returned < observed;
  return {
    state: partial ? 'partial' : 'complete',
    days,
    coverage: {
      state: partial ? 'partial' : 'complete',
      observed,
      returned,
      selectedDays: selectedDays.length,
      maxPerDay,
      maxTotal,
    },
    source: {
      class: 'official-legacy',
      operation: 'GET /calendar',
      retrievedAt,
    },
    evidence: [
      {
        source: 'official-legacy',
        operation: 'GET /calendar',
        retrievedAt,
      },
      {
        source: 'derived-s7',
        formulaVersion: 'calendar-schedule-v1',
        retrievedAt,
      },
    ],
    limitations: [
      '官方 /calendar 提供日期而非具体播出时间；顺序不等同于推荐或热度排序。',
      '结果不包含个人收藏、观看进度或账号个性化状态。',
      '评分、排名、类型或日期缺失时保持未知，不从其他页面推断。',
    ],
    warnings: partial
      ? [
          {
            code: 'OUTPUT_TRUNCATED',
            state: 'partial',
            message: '日历关系达到显示上限，coverage 仅代表官方源返回样本。',
          },
        ]
      : [],
  };
}

export class CalendarService {
  constructor(private client: HttpClient) {}

  async getCalendar(): Promise<DomainCalendarDay[]> {
    const raw = await this.client.request<RawCalendarDay[]>({
      method: 'GET',
      path: '/calendar',
      cacheContext: {
        operationId: 'getCalendar',
      },
      cacheTtlSeconds: 3600,
    });

    return (raw || []).map((day) => ({
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
        nameCn: item.name_cn || item.name || '',
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
    const retrievedAt = new Date().toISOString();
    try {
      return buildCalendarIntelligence(await this.getCalendar(), options, retrievedAt);
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
        },
        source: {
          class: 'official-legacy',
          operation: 'GET /calendar',
          retrievedAt,
        },
        evidence: [
          {
            source: 'official-legacy',
            operation: 'GET /calendar',
            retrievedAt,
          },
        ],
        limitations: [
          '官方日历源不可用时不返回猜测的播出计划。',
          '结果不包含个人收藏、观看进度或账号个性化状态。',
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
