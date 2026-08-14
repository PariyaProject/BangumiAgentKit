import type {
  CalendarItem,
  OperationBody,
  OperationQuery,
  PagedSubject,
  Subject,
} from '@bangumi-agent-kit/bangumi-openapi';
import { isBangumiError } from '@bangumi-agent-kit/bangumi-transport';
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
  tags?: string[];
  metaTags?: string[];
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
  getSubject(
    subjectId: number,
    context?: ProviderRequestContext,
  ): Promise<CapabilityResult<ProviderSubjectData>>;
  getSubjectStats(
    subjectId: number,
    context?: ProviderRequestContext,
  ): Promise<CapabilityResult<SubjectStatsData>>;
}

export interface SubjectDiscoveryCollection {
  wish?: number;
  collect?: number;
  doing?: number;
  onHold?: number;
  dropped?: number;
}

/** A deliberately small provider boundary for discovery; generated clients stay behind it. */
export interface SubjectDiscoveryCandidate {
  id: number;
  type: number;
  name: string;
  nameCn?: string;
  date?: string;
  platform?: string;
  score?: number;
  rank?: number;
  ratingCount?: number;
  collection?: SubjectDiscoveryCollection;
  tags: string[];
  metaTags: string[];
  images?: Record<string, string | undefined>;
  nsfw?: boolean;
}

export type SubjectDiscoveryTotalKind = 'exact' | 'estimated' | 'unknown';

export interface SubjectDiscoveryPage {
  items: SubjectDiscoveryCandidate[];
  total?: number;
  totalKind: SubjectDiscoveryTotalKind;
  limit: number;
  offset: number;
}

export interface SubjectDiscoverySearchFilter {
  type?: number[];
  tag?: string[];
  metaTags?: string[];
  airDate?: string[];
  rating?: string[];
  ratingCount?: string[];
  rank?: string[];
  nsfw?: boolean;
}

export interface SubjectDiscoverySearchRequest {
  keyword: string;
  limit: number;
  offset: number;
  sort: 'match' | 'heat' | 'rank' | 'score';
  filter?: SubjectDiscoverySearchFilter;
}

export interface SubjectDiscoveryBrowseRequest {
  type: number;
  category?: number;
  year?: number;
  month?: number;
  sort?: 'date' | 'rank';
  limit: number;
  offset: number;
}

export interface SubjectDiscoveryProvider extends SubjectProvider {
  searchSubjects(
    request: SubjectDiscoverySearchRequest,
    context?: ProviderRequestContext,
  ): Promise<CapabilityResult<SubjectDiscoveryPage>>;
  browseSubjects(
    request: SubjectDiscoveryBrowseRequest,
    context?: ProviderRequestContext,
  ): Promise<CapabilityResult<SubjectDiscoveryPage>>;
}

export interface CalendarProvider {
  getCalendar(context?: ProviderRequestContext): Promise<CapabilityResult<CalendarDayData[]>>;
}

export interface OfficialV0Api {
  getSubjectById(subjectId: number): Promise<Subject>;
  searchSubjects?: (
    query: OperationQuery<'searchSubjects'> | undefined,
    body?: OperationBody<'searchSubjects'>,
  ) => Promise<PagedSubject>;
  getSubjects?: (query: OperationQuery<'getSubjects'>) => Promise<PagedSubject>;
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

function requiredBoolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') {
    throw new SchemaDriftError(`Required boolean field ${path} is missing or invalid.`);
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

function failure<T>(source: SourceDescriptor, err: unknown): CapabilityResult<T> {
  let state: CapabilityResult<T>['state'] = 'upstream_error';
  let providerError: ProviderError = { code: 'upstream_error', retryable: false };
  let warningCode: WarningCode = 'UPSTREAM_ERROR';
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
        state = 'not_found';
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
        warningCode = 'UPSTREAM_RATE_LIMITED';
        break;
      case 'NETWORK_ERROR':
        {
          const timedOut = /timed? ?out|timeout/i.test(err.message);
          state = 'unavailable';
          providerError = {
            code: timedOut ? 'timeout' : 'network_error',
            retryable: true,
          };
          warningCode = timedOut ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_ERROR';
        }
        break;
      case 'PARSER_ERROR':
        state = 'unavailable';
        providerError = { code: 'schema_drift', retryable: false };
        warningCode = 'SCHEMA_DRIFT';
        break;
      case 'UPSTREAM_UNAVAILABLE':
        state = 'unavailable';
        providerError = { code: 'upstream_unavailable', retryable: true };
        warningCode = 'UPSTREAM_ERROR';
        break;
      default:
        state = 'upstream_error';
        providerError = { code: 'upstream_error', retryable: err.retryable };
        warningCode = 'UPSTREAM_ERROR';
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
          freshness: { state: 'unknown' },
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
      nsfw: requiredBoolean(value.nsfw, 'nsfw'),
      locked: requiredBoolean(value.locked, 'locked'),
      date: value.date === undefined ? undefined : requiredString(value.date, 'date'),
      platform: requiredString(value.platform, 'platform'),
      images: images as Record<string, string | undefined>,
      eps: requiredNumber(value.eps, 'eps'),
      totalEpisodes: requiredNumber(value.total_episodes, 'total_episodes'),
      tags: stringList(value.tags),
      metaTags: stringList(value.meta_tags),
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
      'tags',
      'meta_tags',
      'collection.wish',
      'collection.collect',
      'collection.doing',
      'collection.on_hold',
      'collection.dropped',
    ],
  };
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === 'string') return [item];
    if (isRecord(item) && typeof item.name === 'string') return [item.name];
    return [];
  });
}

function optionalCollection(value: unknown): SubjectDiscoveryCollection | undefined {
  if (!isRecord(value)) return undefined;
  const collection: SubjectDiscoveryCollection = {
    wish: optionalNumber(value.wish),
    collect: optionalNumber(value.collect),
    doing: optionalNumber(value.doing),
    onHold: optionalNumber(value.on_hold),
    dropped: optionalNumber(value.dropped),
  };
  return Object.values(collection).some((item) => item !== undefined) ? collection : undefined;
}

function parseDiscoveryCandidate(raw: Subject): SubjectDiscoveryCandidate {
  const value = raw as unknown as Record<string, unknown>;
  const rating = isRecord(value.rating) ? value.rating : undefined;
  return {
    id: requiredNumber(value.id, 'id'),
    type: requiredNumber(value.type, 'type'),
    name: optionalString(value.name) ?? '',
    nameCn: optionalString(value.name_cn),
    date: optionalString(value.date),
    platform: optionalString(value.platform),
    score: rating ? optionalNumber(rating.score) : undefined,
    rank: rating ? optionalNumber(rating.rank) : undefined,
    ratingCount: rating ? optionalNumber(rating.total) : undefined,
    collection: optionalCollection(value.collection),
    tags: stringList(value.tags),
    metaTags: stringList(value.meta_tags),
    images: isRecord(value.images)
      ? Object.fromEntries(
          Object.entries(value.images).flatMap(([key, image]) =>
            image === undefined || typeof image === 'string' ? [[key, image]] : [],
          ),
        )
      : undefined,
    nsfw: typeof value.nsfw === 'boolean' ? value.nsfw : undefined,
  };
}

function parseDiscoveryPage(
  raw: PagedSubject,
  request: { limit: number; offset: number },
  totalKind: SubjectDiscoveryTotalKind,
): SubjectDiscoveryPage {
  const value = raw as unknown as Record<string, unknown>;
  if (!Array.isArray(value.data)) throw new SchemaDriftError('Discovery response data must be an array.');
  const items = value.data.map((item) => parseDiscoveryCandidate(item as Subject));
  return {
    items,
    total: optionalNumber(value.total),
    totalKind,
    limit: optionalNumber(value.limit) ?? request.limit,
    offset: optionalNumber(value.offset) ?? request.offset,
  };
}

function discoveryEvidence(
  source: SourceDescriptor,
  retrievedAt: string,
  page: SubjectDiscoveryPage,
  authScope: AuthScope,
): FieldEvidence {
  const evidence: FieldEvidence = {};
  const fields = ['items', 'total', 'totalKind', 'limit', 'offset'];
  for (const fieldPath of fields) {
    evidence[fieldPath] = [
      createEvidenceRef({
        source,
        retrievedAt,
        fieldPath,
        freshness: { state: 'unknown' },
        authScope,
        confidence: 'high',
      }),
    ];
  }
  for (const item of page.items) {
    for (const fieldPath of ['id', 'name', 'nameCn', 'date', 'platform', 'score', 'rank', 'ratingCount', 'collection', 'tags', 'metaTags', 'images', 'nsfw']) {
      const key = `items[${item.id}].${fieldPath}`;
      evidence[key] = [
        createEvidenceRef({
          source,
          retrievedAt,
          entity: { type: 'subject', id: item.id },
          fieldPath: key,
          freshness: { state: 'unknown' },
          authScope,
          confidence: 'high',
        }),
      ];
    }
  }
  return evidence;
}

function unavailableDiscovery<T>(source: SourceDescriptor): CapabilityResult<T> {
  return {
    state: 'unavailable',
    error: { code: 'upstream_unavailable', retryable: true },
    warnings: [warning('SOURCE_NOT_CONFIGURED', 'The official discovery operation is not configured.', { source })],
  };
}

export class OfficialV0Provider implements SubjectDiscoveryProvider {
  constructor(private readonly api: OfficialV0Api) {}

  async getSubject(
    subjectId: number,
    context: ProviderRequestContext = {},
  ): Promise<CapabilityResult<ProviderSubjectData>> {
    const source: SourceDescriptor = { ...SOURCE_V0, operation: 'getSubjectById' };
    const authScope = context.authScope ?? 'public';

    try {
      const raw = await this.api.getSubjectById(subjectId);
      const retrievedAt = new Date().toISOString();
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
        Object.entries(subject.evidence ?? {}).filter(
          ([field]) => field.startsWith('rating.') || field.startsWith('collection.'),
        ),
      ),
    };
  }

  async searchSubjects(
    request: SubjectDiscoverySearchRequest,
    context: ProviderRequestContext = {},
  ): Promise<CapabilityResult<SubjectDiscoveryPage>> {
    const source: SourceDescriptor = {
      ...SOURCE_V0,
      operation: 'searchSubjects',
      experimental: true,
    };
    const retrievedAt = new Date().toISOString();
    const authScope = context.authScope ?? 'public';
    if (!this.api.searchSubjects) return unavailableDiscovery(source);
    try {
      const filter: NonNullable<OperationBody<'searchSubjects'>['filter']> = {};
      if (request.filter?.type) filter.type = request.filter.type as typeof filter.type;
      if (request.filter?.tag) filter.tag = request.filter.tag;
      if (request.filter?.metaTags) filter.meta_tags = request.filter.metaTags;
      if (request.filter?.airDate) filter.air_date = request.filter.airDate;
      if (request.filter?.rating) filter.rating = request.filter.rating;
      if (request.filter?.ratingCount) filter.rating_count = request.filter.ratingCount;
      if (request.filter?.rank) filter.rank = request.filter.rank;
      if (request.filter?.nsfw !== undefined) filter.nsfw = request.filter.nsfw;
      const raw = await this.api.searchSubjects(
        { limit: request.limit, offset: request.offset },
        {
          keyword: request.keyword,
          sort: request.sort,
          filter: Object.keys(filter).length > 0 ? filter : undefined,
        },
      );
      const data = parseDiscoveryPage(raw, request, 'estimated');
      return {
        state: 'ok',
        data,
        evidence: discoveryEvidence(source, retrievedAt, data, authScope),
        coverage: {
          state: 'complete',
          requested: request.limit,
          scanned: data.items.length,
          matched: data.items.length,
          returned: data.items.length,
        },
        retrievedAt,
        warnings: [warning('EXPERIMENTAL_SOURCE', 'Official v0 subject search is marked experimental upstream.', { source })],
      };
    } catch (err: unknown) {
      return failure(source, err);
    }
  }

  async browseSubjects(
    request: SubjectDiscoveryBrowseRequest,
    context: ProviderRequestContext = {},
  ): Promise<CapabilityResult<SubjectDiscoveryPage>> {
    const source: SourceDescriptor = { ...SOURCE_V0, operation: 'browseSubjects' };
    const retrievedAt = new Date().toISOString();
    const authScope = context.authScope ?? 'public';
    if (!this.api.getSubjects) return unavailableDiscovery(source);
    try {
      const raw = await this.api.getSubjects({
        type: request.type as OperationQuery<'getSubjects'> extends { type: infer T } ? T : never,
        ...(request.category === undefined ? {} : { cat: request.category as never }),
        ...(request.year === undefined ? {} : { year: request.year }),
        ...(request.month === undefined ? {} : { month: request.month }),
        ...(request.sort === undefined ? {} : { sort: request.sort }),
        limit: request.limit,
        offset: request.offset,
      } as OperationQuery<'getSubjects'>);
      const data = parseDiscoveryPage(raw, request, 'exact');
      return {
        state: 'ok',
        data,
        evidence: discoveryEvidence(source, retrievedAt, data, authScope),
        coverage: {
          state: 'complete',
          requested: request.limit,
          scanned: data.items.length,
          matched: data.items.length,
          returned: data.items.length,
        },
        retrievedAt,
      };
    } catch (err: unknown) {
      return failure(source, err);
    }
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
          throw new SchemaDriftError(
            `Calendar image field is invalid at ${dayIndex}.${itemIndex}.`,
          );
        }
        return {
          id: requiredNumber(value.id, `calendar[${dayIndex}].items[${itemIndex}].id`),
          name: requiredString(value.name, `calendar[${dayIndex}].items[${itemIndex}].name`),
          nameCn: requiredString(
            value.name_cn,
            `calendar[${dayIndex}].items[${itemIndex}].name_cn`,
          ),
          airDate: requiredString(
            value.air_date,
            `calendar[${dayIndex}].items[${itemIndex}].air_date`,
          ),
          score:
            isRecord(value.rating) && value.rating.score !== undefined
              ? requiredNumber(
                  value.rating.score,
                  `calendar[${dayIndex}].items[${itemIndex}].rating.score`,
                )
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
            freshness: { state: 'unknown' },
            authScope,
            confidence: 'high',
          }),
        ],
        weekday: [
          createEvidenceRef({
            source,
            retrievedAt,
            fieldPath: 'weekday',
            freshness: { state: 'unknown' },
            authScope,
            confidence: 'high',
          }),
        ],
      };
      return {
        state: 'ok',
        data,
        evidence,
        coverage: {
          state: 'complete',
          returned: data.reduce((count, day) => count + day.items.length, 0),
        },
        retrievedAt,
      };
    } catch (err: unknown) {
      return failure(source, err);
    }
  }
}

export function providerErrorCode(
  result: CapabilityResult<unknown>,
): ProviderErrorCode | undefined {
  return result.error?.code;
}
