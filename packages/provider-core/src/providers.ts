import type { CalendarItem, Subject } from '@bangumi-agent-kit/bangumi-openapi';
import { BangumiError, isBangumiError } from '@bangumi-agent-kit/bangumi-transport';
import {
  createEvidenceRef,
  SOURCE_LEGACY,
  SOURCE_V0,
  type AuthScope,
  type CapabilityResult,
  type FieldEvidence,
  type ProviderError,
  type ProviderErrorCode,
  type SourceDescriptor,
  type WarningCode,
} from './contracts.js';
import { warning } from './contracts.js';

export interface ProviderRequestContext {
  authScope?: AuthScope;
}

export interface RatingHistogram {
  1: number;
  2: number;
  3: number;
  4: number;
  5: number;
  6: number;
  7: number;
  8: number;
  9: number;
  10: number;
}

export interface SubjectStatsData {
  score: number;
  rank: number;
  ratingTotal: number;
  ratingHistogram: RatingHistogram;
  collection: {
    wish: number;
    collect: number;
    doing: number;
    onHold: number;
    dropped: number;
  };
}

export interface ProviderSubjectData {
  id: number;
  type: number;
  name: string;
  nameCn: string;
  summary: string;
  nsfw: boolean;
  locked: boolean;
  date?: string;
  platform: string;
  images: Record<string, string | undefined>;
  eps: number;
  totalEpisodes: number;
  stats: SubjectStatsData;
}

export interface CalendarSubjectData {
  id: number;
  name: string;
  nameCn: string;
  airDate: string;
  score?: number;
  images?: Record<string, string>;
}

export interface CalendarDayData {
  weekday: {
    en: string;
    cn: string;
    ja: string;
    id: number;
  };
  items: CalendarSubjectData[];
}

export interface SubjectProvider {
  getSubject(subjectId: number, context?: ProviderRequestContext): Promise<CapabilityResult<ProviderSubjectData>>;
  getSubjectStats(
    subjectId: number,
    context?: ProviderRequestContext,
  ): Promise<CapabilityResult<SubjectStatsData>>;
}

export interface CalendarProvider {
  getCalendar(context?: ProviderRequestContext): Promise<CapabilityResult<CalendarDayData[]>>;
}

export interface OfficialV0Api {
  getSubjectById(subjectId: number): Promise<Subject>;
}

export interface LegacyCalendarApi {
  getCalendar(): Promise<CalendarItem[]>;
}

class SchemaDriftError extends Error {
  readonly code = 'schema_drift';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new SchemaDriftError(`Required numeric field ${path} is missing or invalid.`);
  }
  return value;
}

function requiredString(value: unknown, path: string): string {
  if (typeof value !== 'string') {
    throw new SchemaDriftError(`Required string field ${path} is missing or invalid.`);
  }
  return value;
}

function requiredRecord(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new SchemaDriftError(`Required object field ${path} is missing or invalid.`);
  }
  return value;
}

function mapWarning(
  code: WarningCode,
  message: string,
  source: SourceDescriptor,
): ReturnType<typeof warning> {
  return warning(code, message, { source });
}

function failure<T>(
  source: SourceDescriptor,
  err: unknown,
): CapabilityResult<T> {
  let state: CapabilityResult<T>['state'] = 'upstream_error';
  let providerError: ProviderError = { code: 'upstream_error', retryable: false };
  let warningCode: WarningCode = 'UPSTREAM_TIMEOUT';
  let message = 'Provider request failed.';

  if (err instanceof SchemaDriftError) {
    state = 'unavailable';
    providerError = { code: 'schema_drift', retryable: false };
    warningCode = 'SCHEMA_DRIFT';
    message = 'Provider response did not satisfy the required schema.';
  } else if (isBangumiError(err)) {
    message = 'Provider request returned an expected upstream error.';
    switch (err.code) {
      case 'NOT_FOUND':
        state = 'unavailable';
        providerError = { code: 'not_found', retryable: false };
        warningCode = 'UPSTREAM_NOT_FOUND';
        break;
      case 'AUTH_REQUIRED':
      case 'AUTH_EXPIRED':
        state = 'auth_required';
        providerError = { code: 'auth_required', retryable: false };
        warningCode = 'AUTH_SCOPE_LIMITED';
        break;
      case 'PERMISSION_DENIED':
        state = 'permission_denied';
        providerError = { code: 'permission_denied', retryable: false };
        warningCode = 'AUTH_SCOPE_LIMITED';
        break;
      case 'RATE_LIMITED':
        state = 'upstream_error';
        providerError = { code: 'rate_limited', retryable: true };
        warningCode = 'UPSTREAM_TIMEOUT';
        break;
      case 'NETWORK_ERROR':
        state = 'unavailable';
        providerError = {
          code: /timed? ?out|timeout/i.test(err.message) ? 'timeout' : 'network_error',
          retryable: true,
        };
        warningCode = 'UPSTREAM_TIMEOUT';
        break;
      case 'PARSER_ERROR':
        state = 'unavailable';
        providerError = { code: 'schema_drift', retryable: false };
        warningCode = 'SCHEMA_DRIFT';
        break;
      case 'UPSTREAM_UNAVAILABLE':
        state = 'unavailable';
        providerError = { code: 'upstream_unavailable', retryable: true };
        warningCode = 'UPSTREAM_TIMEOUT';
        break;
      default:
        state = 'upstream_error';
        providerError = { code: 'upstream_error', retryable: err.retryable };
        warningCode = 'UPSTREAM_TIMEOUT';
    }
  } else if (err instanceof Error && /timed? ?out|timeout/i.test(err.message)) {
    state = 'unavailable';
    providerError = { code: 'timeout', retryable: true };
    warningCode = 'UPSTREAM_TIMEOUT';
  }

  return {
    state,
    error: providerError,
    warnings: [mapWarning(warningCode, message, source)],
  };
}

function fieldEvidence(
  source: SourceDescriptor,
  retrievedAt: string,
  fields: string[],
  authScope: AuthScope,
): FieldEvidence {
  return Object.fromEntries(
    fields.map((fieldPath) => [
      fieldPath,
      [
        createEvidenceRef({
          source,
          retrievedAt,
          entity: { type: 'subject', id: 0 },
          fieldPath,
          freshness: { state: 'fresh' },
          authScope,
          confidence: 'high',
        }),
      ],
    ]),
  );
}

function subjectEvidence(
  source: SourceDescriptor,
  retrievedAt: string,
  subjectId: number,
  fields: string[],
  authScope: AuthScope,
): FieldEvidence {
  const evidence = fieldEvidence(source, retrievedAt, fields, authScope);
  for (const refs of Object.values(evidence)) {
    const first = refs[0];
    if (first) first.entity = { type: 'subject', id: subjectId };
  }
  return evidence;
}

function parseStats(raw: Subject): SubjectStatsData {
  const rating = requiredRecord(raw.rating, 'rating');
  const ratingCount = requiredRecord(rating.count, 'rating.count');
  const collection = requiredRecord(raw.collection, 'collection');
  const histogram = {} as RatingHistogram;

  for (let score = 1; score <= 10; score += 1) {
    const value = ratingCount[String(score)];
    if (value !== undefined) requiredNumber(value, `rating.count.${score}`);
    histogram[score as keyof RatingHistogram] = value === undefined ? 0 : (value as number);
  }

  return {
    score: requiredNumber(rating.score, 'rating.score'),
    rank: requiredNumber(rating.rank, 'rating.rank'),
    ratingTotal: requiredNumber(rating.total, 'rating.total'),
    ratingHistogram: histogram,
    collection: {
      wish: requiredNumber(collection.wish, 'collection.wish'),
      collect: requiredNumber(collection.collect, 'collection.collect'),
      doing: requiredNumber(collection.doing, 'collection.doing'),
      onHold: requiredNumber(collection.on_hold, 'collection.on_hold'),
      dropped: requiredNumber(collection.dropped, 'collection.dropped'),
    },
  };
}

function parseSubject(raw: Subject): { data: ProviderSubjectData; fields: string[] } {
  const value = raw as unknown as Record<string, unknown>;
  const images = requiredRecord(value.images, 'images');
  for (const [key, image] of Object.entries(images)) {
    if (image !== undefined && typeof image !== 'string') {
      throw new SchemaDriftError(`Image field images.${key} is invalid.`);
    }
  }
  const stats = parseStats(raw);

  return {
    data: {
      id: requiredNumber(value.id, 'id'),
      type: requiredNumber(value.type, 'type'),
      name: requiredString(value.name, 'name'),
      nameCn: requiredString(value.name_cn, 'name_cn'),
      summary: requiredString(value.summary, 'summary'),
      nsfw: Boolean(value.nsfw),
      locked: Boolean(value.locked),
      date: value.date === undefined ? undefined : requiredString(value.date, 'date'),
      platform: requiredString(value.platform, 'platform'),
      images: images as Record<string, string | undefined>,
      eps: requiredNumber(value.eps, 'eps'),
      totalEpisodes: requiredNumber(value.total_episodes, 'total_episodes'),
      stats,
    },
    fields: [
      'id',
      'type',
      'name',
      'name_cn',
      'summary',
      'date',
      'platform',
      'images',
      'eps',
      'total_episodes',
      'rating.score',
      'rating.rank',
      'rating.total',
      'rating.count',
      'collection.wish',
      'collection.collect',
      'collection.doing',
      'collection.on_hold',
      'collection.dropped',
    ],
  };
}

export class OfficialV0Provider implements SubjectProvider {
  constructor(private readonly api: OfficialV0Api) {}

  async getSubject(
    subjectId: number,
    context: ProviderRequestContext = {},
  ): Promise<CapabilityResult<ProviderSubjectData>> {
    const source: SourceDescriptor = { ...SOURCE_V0, operation: 'getSubjectById' };
    const retrievedAt = new Date().toISOString();
    const authScope = context.authScope ?? 'public';

    try {
      const raw = await this.api.getSubjectById(subjectId);
      const parsed = parseSubject(raw);
      return {
        state: 'ok',
        data: parsed.data,
        evidence: subjectEvidence(source, retrievedAt, parsed.data.id, parsed.fields, authScope),
        coverage: { state: 'complete', requested: 1, scanned: 1, matched: 1, returned: 1 },
        retrievedAt,
      };
    } catch (err: unknown) {
      return failure(source, err);
    }
  }

  async getSubjectStats(
    subjectId: number,
    context: ProviderRequestContext = {},
  ): Promise<CapabilityResult<SubjectStatsData>> {
    const subject = await this.getSubject(subjectId, context);
    if (!subject.data) {
      return subject as unknown as CapabilityResult<SubjectStatsData>;
    }
    return {
      ...subject,
      data: subject.data.stats,
      evidence: Object.fromEntries(
        Object.entries(subject.evidence ?? {}).filter(([field]) => field.startsWith('rating.') || field.startsWith('collection.')),
      ),
    };
  }
}

function parseCalendar(raw: CalendarItem[]): CalendarDayData[] {
  if (!Array.isArray(raw)) throw new SchemaDriftError('Calendar response must be an array.');

  return raw.map((day, dayIndex) => {
    const dayValue = day as unknown as Record<string, unknown>;
    const weekday = requiredRecord(dayValue.weekday, `calendar[${dayIndex}].weekday`);
    const items = dayValue.items;
    if (!Array.isArray(items)) {
      throw new SchemaDriftError(`Required array field calendar[${dayIndex}].items is invalid.`);
    }

    return {
      weekday: {
        en: requiredString(weekday.en, `calendar[${dayIndex}].weekday.en`),
        cn: requiredString(weekday.cn, `calendar[${dayIndex}].weekday.cn`),
        ja: requiredString(weekday.ja, `calendar[${dayIndex}].weekday.ja`),
        id: requiredNumber(weekday.id, `calendar[${dayIndex}].weekday.id`),
      },
      items: items.map((item, itemIndex) => {
        const value = requiredRecord(item, `calendar[${dayIndex}].items[${itemIndex}]`);
        const images = value.images;
        if (images !== undefined && !isRecord(images)) {
          throw new SchemaDriftError(`Calendar image field is invalid at ${dayIndex}.${itemIndex}.`);
        }
        return {
          id: requiredNumber(value.id, `calendar[${dayIndex}].items[${itemIndex}].id`),
          name: requiredString(value.name, `calendar[${dayIndex}].items[${itemIndex}].name`),
          nameCn: requiredString(value.name_cn, `calendar[${dayIndex}].items[${itemIndex}].name_cn`),
          airDate: requiredString(value.air_date, `calendar[${dayIndex}].items[${itemIndex}].air_date`),
          score: isRecord(value.rating) && value.rating.score !== undefined
            ? requiredNumber(value.rating.score, `calendar[${dayIndex}].items[${itemIndex}].rating.score`)
            : undefined,
          images: images as Record<string, string> | undefined,
        };
      }),
    };
  });
}

export class OfficialLegacyCalendarProvider implements CalendarProvider {
  constructor(private readonly api: LegacyCalendarApi) {}

  async getCalendar(
    context: ProviderRequestContext = {},
  ): Promise<CapabilityResult<CalendarDayData[]>> {
    const source: SourceDescriptor = { ...SOURCE_LEGACY, operation: 'getCalendar' };
    const retrievedAt = new Date().toISOString();
    const authScope = context.authScope ?? 'public';
    try {
      const data = parseCalendar(await this.api.getCalendar());
      const evidence: FieldEvidence = {
        membership: [
          createEvidenceRef({
            source,
            retrievedAt,
            fieldPath: 'items',
            freshness: { state: 'fresh' },
            authScope,
            confidence: 'high',
          }),
        ],
        weekday: [
          createEvidenceRef({
            source,
            retrievedAt,
            fieldPath: 'weekday',
            freshness: { state: 'fresh' },
            authScope,
            confidence: 'high',
          }),
        ],
      };
      return {
        state: 'ok',
        data,
        evidence,
        coverage: { state: 'complete', returned: data.reduce((count, day) => count + day.items.length, 0) },
        retrievedAt,
      };
    } catch (err: unknown) {
      return failure(source, err);
    }
  }
}

export function providerErrorCode(result: CapabilityResult<unknown>): ProviderErrorCode | undefined {
  return result.error?.code;
}
