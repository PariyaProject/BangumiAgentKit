import type {
  CalendarItem,
  OperationBody,
  OperationQuery,
  PagedSubject,
  Subject,
} from '@bangumi-agent-kit/bangumi-openapi';
import { isBangumiError, type HttpRequestOptions } from '@bangumi-agent-kit/bangumi-transport';
import {
  createEvidenceRef,
  SOURCE_LEGACY,
  SOURCE_DERIVED,
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

export type RatingHistogramPresence = {
  [Score in keyof RatingHistogram]: boolean;
};

export interface SubjectCollectionPresence {
  wish: boolean;
  collect: boolean;
  doing: boolean;
  onHold: boolean;
  dropped: boolean;
}

export interface SubjectStatsData {
  score: number;
  rank: number;
  ratingTotal: number;
  ratingHistogram: RatingHistogram;
  /** Present only on the tolerant stats read; false means missing or invalid upstream input. */
  ratingHistogramPresence?: RatingHistogramPresence;
  collection: {
    wish: number;
    collect: number;
    doing: number;
    onHold: number;
    dropped: number;
  };
  /** Present only on the tolerant stats read; false means missing or invalid upstream input. */
  collectionPresence?: SubjectCollectionPresence;
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

export const SUBJECT_IDENTITY_MAX_RESPONSE_BYTES = 1_048_576;
export const SUBJECT_IDENTITY_MAX_INFOBOX_ROWS = 64;
export const SUBJECT_IDENTITY_MAX_INFOBOX_VALUES = 8;
export const SUBJECT_IDENTITY_MAX_SCALAR_CHARACTERS = 1_000;
export const SUBJECT_IDENTITY_MAX_LIST_ITEMS = 128;

export type SubjectIdentityInfoboxValue = string | Array<{ k?: string; v: string }>;

export interface SubjectIdentityInfoboxRow {
  key: string;
  value: SubjectIdentityInfoboxValue;
}

export interface SubjectIdentityAliasData {
  state: 'known' | 'partial' | 'unknown';
  values: string[];
  sourceKeys: string[];
  sourceRowIndexes: number[];
}

export interface SubjectIdentityInfoboxCoverage {
  state: 'complete' | 'partial' | 'unknown';
  observedRows: number;
  returnedRows: number;
  malformedRows: number;
  omittedRows: number;
  nestedValuesObserved: number;
  nestedValuesReturned: number;
  nestedValuesOmitted: number;
  malformedValues: number;
  truncatedValues: number;
  truncated: boolean;
  maxRows: number;
  maxValuesPerRow: number;
  maxScalarCharacters: number;
}

export interface SubjectIdentityInfoboxData {
  state: 'complete' | 'partial' | 'unknown';
  rows: SubjectIdentityInfoboxRow[];
  aliases: SubjectIdentityAliasData;
  coverage: SubjectIdentityInfoboxCoverage;
}

export interface SubjectIdentityFieldCoverage {
  observed: string[];
  returned: string[];
  missing: string[];
  malformed: string[];
  empty: string[];
  truncated: string[];
}

export interface ProviderSubjectIdentityData {
  id: number;
  type: number;
  name: string;
  nameCn?: string;
  date?: string;
  platform?: string;
  locked?: boolean;
  nsfw?: boolean;
  series?: boolean;
  volumes?: number;
  eps?: number;
  totalEpisodes?: number;
  metaTags?: string[];
  tags?: string[];
  images?: Record<string, string | undefined>;
  infobox: SubjectIdentityInfoboxData;
  fields: SubjectIdentityFieldCoverage;
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

/** Separate identity metadata boundary; existing subject providers stay source-compatible. */
export interface SubjectIdentityProvider {
  getSubjectIdentity(
    subjectId: number,
    context?: ProviderRequestContext,
  ): Promise<CapabilityResult<ProviderSubjectIdentityData>>;
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
  getSubjectById(
    subjectId: number,
    requestOptions?: Pick<HttpRequestOptions, 'maxResponseBytes'>,
  ): Promise<Subject>;
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
      case 'RESPONSE_TOO_LARGE':
        state = 'unavailable';
        providerError = { code: 'response_too_large', retryable: false };
        warningCode = 'RESPONSE_TOO_LARGE';
        message = 'Provider response exceeded the bounded response size.';
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

function parseStats(
  raw: Subject,
  options: { allowIncomplete: boolean } = { allowIncomplete: false },
): SubjectStatsData {
  const allowIncomplete = options.allowIncomplete;
  const rating = requiredRecord(raw.rating, 'rating');
  const ratingCount = requiredRecord(rating.count, 'rating.count');
  const collection = requiredRecord(raw.collection, 'collection');
  const histogram = {} as RatingHistogram;
  const ratingHistogramPresence = {} as RatingHistogramPresence;

  const parseIncompleteNumber = (value: unknown): { value: number; present: boolean } =>
    typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value) && value >= 0
      ? { value, present: true }
      : { value: 0, present: false };

  for (let score = 1; score <= 10; score += 1) {
    const value = ratingCount[String(score)];
    if (allowIncomplete) {
      const parsed = parseIncompleteNumber(value);
      histogram[score as keyof RatingHistogram] = parsed.value;
      ratingHistogramPresence[score as keyof RatingHistogram] = parsed.present;
    } else {
      if (value !== undefined) requiredNumber(value, `rating.count.${score}`);
      histogram[score as keyof RatingHistogram] = value === undefined ? 0 : (value as number);
    }
  }

  const collectionValue = (key: string, path: string): { value: number; present: boolean } => {
    const value = collection[key];
    if (!allowIncomplete) return { value: requiredNumber(value, path), present: true };
    return parseIncompleteNumber(value);
  };
  const wish = collectionValue('wish', 'collection.wish');
  const collect = collectionValue('collect', 'collection.collect');
  const doing = collectionValue('doing', 'collection.doing');
  const onHold = collectionValue('on_hold', 'collection.on_hold');
  const dropped = collectionValue('dropped', 'collection.dropped');

  return {
    score: requiredNumber(rating.score, 'rating.score'),
    rank: requiredNumber(rating.rank, 'rating.rank'),
    ratingTotal: requiredNumber(rating.total, 'rating.total'),
    ratingHistogram: histogram,
    ...(allowIncomplete ? { ratingHistogramPresence } : {}),
    collection: {
      wish: wish.value,
      collect: collect.value,
      doing: doing.value,
      onHold: onHold.value,
      dropped: dropped.value,
    },
    ...(allowIncomplete
      ? {
          collectionPresence: {
            wish: wish.present,
            collect: collect.present,
            doing: doing.present,
            onHold: onHold.present,
            dropped: dropped.present,
          },
        }
      : {}),
  };
}

function statsEvidenceFields(stats: SubjectStatsData): string[] {
  const fields = ['rating.score', 'rating.rank', 'rating.total'];
  for (let score = 1; score <= 10; score += 1) {
    if (stats.ratingHistogramPresence?.[score as keyof RatingHistogram] !== false) {
      fields.push(`rating.count.${score}`);
    }
  }
  const collectionFields: Array<[keyof SubjectCollectionPresence, string]> = [
    ['wish', 'collection.wish'],
    ['collect', 'collection.collect'],
    ['doing', 'collection.doing'],
    ['onHold', 'collection.on_hold'],
    ['dropped', 'collection.dropped'],
  ];
  for (const [key, field] of collectionFields) {
    if (stats.collectionPresence?.[key] !== false) fields.push(field);
  }
  return fields;
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

type SubjectIdentityField =
  | 'id'
  | 'type'
  | 'name'
  | 'name_cn'
  | 'date'
  | 'platform'
  | 'locked'
  | 'nsfw'
  | 'series'
  | 'volumes'
  | 'eps'
  | 'total_episodes'
  | 'meta_tags'
  | 'tags'
  | 'images'
  | 'infobox';

const SUBJECT_IDENTITY_ALIAS_KEYS = new Set(['别名', 'alias', 'aliases', 'aka', 'also known as']);

type OptionalIdentityValue<T> = {
  value: T;
  malformed?: boolean;
  empty?: boolean;
  truncated?: boolean;
};

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

function truncateIdentityScalar(value: string): { value: string; truncated: boolean } {
  const codePoints = Array.from(value);
  if (codePoints.length <= SUBJECT_IDENTITY_MAX_SCALAR_CHARACTERS) {
    return { value, truncated: false };
  }
  return {
    value:
      codePoints.slice(0, Math.max(0, SUBJECT_IDENTITY_MAX_SCALAR_CHARACTERS - 1)).join('') + '…',
    truncated: true,
  };
}

function normalizeIdentityKey(value: string): string {
  return value.trim().toLocaleLowerCase('en-US').replace(/\s+/gu, ' ');
}

function isIdentityAliasKey(value: string): boolean {
  return SUBJECT_IDENTITY_ALIAS_KEYS.has(normalizeIdentityKey(value));
}

function unknownInfobox(): SubjectIdentityInfoboxData {
  return {
    state: 'unknown',
    rows: [],
    aliases: { state: 'unknown', values: [], sourceKeys: [], sourceRowIndexes: [] },
    coverage: {
      state: 'unknown',
      observedRows: 0,
      returnedRows: 0,
      malformedRows: 0,
      omittedRows: 0,
      nestedValuesObserved: 0,
      nestedValuesReturned: 0,
      nestedValuesOmitted: 0,
      malformedValues: 0,
      truncatedValues: 0,
      truncated: false,
      maxRows: SUBJECT_IDENTITY_MAX_INFOBOX_ROWS,
      maxValuesPerRow: SUBJECT_IDENTITY_MAX_INFOBOX_VALUES,
      maxScalarCharacters: SUBJECT_IDENTITY_MAX_SCALAR_CHARACTERS,
    },
  };
}

interface ParsedIdentityInfobox {
  data: SubjectIdentityInfoboxData;
  malformed: boolean;
  returnedRowIndexes: number[];
}

function parseIdentityInfobox(value: unknown): ParsedIdentityInfobox | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return undefined;

  const rows: SubjectIdentityInfoboxRow[] = [];
  const returnedRowIndexes: number[] = [];
  const aliasValues: string[] = [];
  const aliasSourceKeys: string[] = [];
  const aliasSourceRowIndexes: number[] = [];
  let aliasFound = false;
  let aliasPartial = false;
  let malformedRows = 0;
  let malformedValues = 0;
  let nestedValuesObserved = 0;
  let nestedValuesReturned = 0;
  let nestedValuesOmitted = 0;
  let truncatedValues = 0;

  for (let rowIndex = 0; rowIndex < value.length; rowIndex += 1) {
    const row = value[rowIndex];
    if (!isRecord(row) || typeof row.key !== 'string' || row.key.trim().length === 0) {
      malformedRows += 1;
      continue;
    }

    const key = row.key;
    const isAlias = isIdentityAliasKey(key);
    if (isAlias) {
      aliasFound = true;
      aliasSourceKeys.push(key);
      aliasSourceRowIndexes.push(rowIndex);
      if (rowIndex >= SUBJECT_IDENTITY_MAX_INFOBOX_ROWS) aliasPartial = true;
    }

    const shouldReturnRow = rowIndex < SUBJECT_IDENTITY_MAX_INFOBOX_ROWS;
    const rawValue = row.value;
    if (typeof rawValue === 'string') {
      const scalar = truncateIdentityScalar(rawValue);
      if (scalar.truncated) truncatedValues += 1;
      if (isAlias) {
        if (shouldReturnRow && rawValue.length > 0) aliasValues.push(scalar.value);
        else aliasPartial = true;
        if (scalar.truncated) aliasPartial = true;
      }
      if (shouldReturnRow) {
        rows.push({ key, value: scalar.value });
        returnedRowIndexes.push(rowIndex);
      }
      continue;
    }

    if (Array.isArray(rawValue)) {
      nestedValuesObserved += rawValue.length;
      const nested: Array<{ k?: string; v: string }> = [];
      const nestedLimit = Math.min(rawValue.length, SUBJECT_IDENTITY_MAX_INFOBOX_VALUES);
      if (shouldReturnRow && rawValue.length > nestedLimit) {
        nestedValuesOmitted += rawValue.length - nestedLimit;
        if (isAlias) aliasPartial = true;
      }

      if (!shouldReturnRow) {
        nestedValuesOmitted += rawValue.length;
        continue;
      }

      for (let nestedIndex = 0; nestedIndex < rawValue.length; nestedIndex += 1) {
        const nestedValue = rawValue[nestedIndex];
        if (nestedIndex >= nestedLimit) continue;
        if (!isRecord(nestedValue) || typeof nestedValue.v !== 'string') {
          malformedValues += 1;
          if (isAlias) aliasPartial = true;
          continue;
        }
        if (nestedValue.k !== undefined && typeof nestedValue.k !== 'string') {
          malformedValues += 1;
          if (isAlias) aliasPartial = true;
        }
        const scalar = truncateIdentityScalar(nestedValue.v);
        if (scalar.truncated) {
          truncatedValues += 1;
          if (isAlias) aliasPartial = true;
        }
        nested.push({
          ...(typeof nestedValue.k === 'string' ? { k: nestedValue.k } : {}),
          v: scalar.value,
        });
        if (shouldReturnRow) nestedValuesReturned += 1;
        if (isAlias && nestedValue.v.length > 0) aliasValues.push(scalar.value);
      }

      rows.push({ key, value: nested });
      returnedRowIndexes.push(rowIndex);
      continue;
    }

    malformedRows += 1;
    if (isAlias) aliasPartial = true;
  }

  const omittedRows = Math.max(0, value.length - SUBJECT_IDENTITY_MAX_INFOBOX_ROWS);
  const truncated = omittedRows > 0 || nestedValuesOmitted > 0 || truncatedValues > 0;
  const malformed = malformedRows > 0 || malformedValues > 0;
  const aliases: SubjectIdentityAliasData = {
    state: !aliasFound ? 'unknown' : aliasPartial || malformed || truncated ? 'partial' : 'known',
    values: aliasValues,
    sourceKeys: aliasSourceKeys,
    sourceRowIndexes: aliasSourceRowIndexes,
  };

  return {
    data: {
      state: malformed || truncated ? 'partial' : 'complete',
      rows,
      aliases,
      coverage: {
        state: malformed || truncated ? 'partial' : 'complete',
        observedRows: value.length,
        returnedRows: rows.length,
        malformedRows,
        omittedRows,
        nestedValuesObserved,
        nestedValuesReturned,
        nestedValuesOmitted,
        malformedValues,
        truncatedValues,
        truncated,
        maxRows: SUBJECT_IDENTITY_MAX_INFOBOX_ROWS,
        maxValuesPerRow: SUBJECT_IDENTITY_MAX_INFOBOX_VALUES,
        maxScalarCharacters: SUBJECT_IDENTITY_MAX_SCALAR_CHARACTERS,
      },
    },
    malformed: malformed || truncated,
    returnedRowIndexes,
  };
}

function boundedIdentityList(
  value: unknown,
  allowObjects: boolean,
): OptionalIdentityValue<string[]> | undefined {
  if (!Array.isArray(value)) return undefined;
  const parsed: string[] = [];
  let malformed = false;
  for (const item of value.slice(0, SUBJECT_IDENTITY_MAX_LIST_ITEMS)) {
    if (typeof item === 'string') {
      parsed.push(item);
    } else if (allowObjects && isRecord(item) && typeof item.name === 'string') {
      parsed.push(item.name);
    } else {
      malformed = true;
    }
  }
  const truncated = value.length > SUBJECT_IDENTITY_MAX_LIST_ITEMS;
  return {
    value: parsed.slice(0, SUBJECT_IDENTITY_MAX_LIST_ITEMS),
    malformed,
    empty: value.length === 0,
    truncated,
  };
}

function parseIdentityImages(
  value: unknown,
): OptionalIdentityValue<Record<string, string | undefined>> | undefined {
  if (!isRecord(value)) return undefined;
  const images: Record<string, string | undefined> = {};
  let malformed = false;
  for (const [key, image] of Object.entries(value)) {
    if (image === undefined || typeof image === 'string') images[key] = image;
    else malformed = true;
  }
  return { value: images, malformed, empty: Object.keys(images).length === 0 };
}

function parseIdentityCounter(value: unknown): OptionalIdentityValue<number> | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return undefined;
  return { value };
}

function parseSubjectIdentity(raw: Subject): {
  data: ProviderSubjectIdentityData;
  evidenceFields: string[];
} {
  const value = raw as unknown as Record<string, unknown>;
  const id = requiredNumber(value.id, 'id');
  if (!Number.isInteger(id) || id <= 0) {
    throw new SchemaDriftError('Required numeric field id must be a positive integer.');
  }
  const type = requiredNumber(value.type, 'type');
  const name = requiredString(value.name, 'name');
  if (name.trim().length === 0) {
    throw new SchemaDriftError('Required string field name must not be empty.');
  }

  const fields: SubjectIdentityFieldCoverage = {
    observed: [],
    returned: [],
    missing: [],
    malformed: [],
    empty: [],
    truncated: [],
  };
  const data: ProviderSubjectIdentityData = {
    id,
    type,
    name,
    infobox: unknownInfobox(),
    fields,
  };

  const requiredReturned = ['id', 'type', 'name'];
  fields.observed.push(...requiredReturned);
  fields.returned.push(...requiredReturned);

  const readOptional = <T>(
    field: SubjectIdentityField,
    parser: (input: unknown) => OptionalIdentityValue<T> | undefined,
    assign: (parsed: T) => void,
  ): void => {
    if (!hasOwn(value, field)) {
      fields.missing.push(field);
      return;
    }
    fields.observed.push(field);
    const parsed = parser(value[field]);
    if (!parsed) {
      fields.malformed.push(field);
      return;
    }
    fields.returned.push(field);
    if (parsed.empty) fields.empty.push(field);
    if (parsed.malformed) fields.malformed.push(field);
    if (parsed.truncated) fields.truncated.push(field);
    assign(parsed.value);
  };

  readOptional(
    'name_cn',
    (input) =>
      typeof input === 'string' ? { value: input, empty: input.length === 0 } : undefined,
    (parsed) => {
      data.nameCn = parsed;
    },
  );
  readOptional(
    'date',
    (input) =>
      typeof input === 'string' ? { value: input, empty: input.length === 0 } : undefined,
    (parsed) => {
      data.date = parsed;
    },
  );
  readOptional(
    'platform',
    (input) =>
      typeof input === 'string' ? { value: input, empty: input.length === 0 } : undefined,
    (parsed) => {
      data.platform = parsed;
    },
  );
  for (const field of ['locked', 'nsfw', 'series'] as const) {
    readOptional(
      field,
      (input) => (typeof input === 'boolean' ? { value: input } : undefined),
      (parsed) => {
        data[field] = parsed;
      },
    );
  }
  for (const field of ['volumes', 'eps', 'total_episodes'] as const) {
    readOptional(field, parseIdentityCounter, (parsed) => {
      if (field === 'total_episodes') data.totalEpisodes = parsed;
      else data[field] = parsed;
    });
  }
  readOptional(
    'meta_tags',
    (input) => boundedIdentityList(input, false),
    (parsed) => {
      data.metaTags = parsed;
    },
  );
  readOptional(
    'tags',
    (input) => boundedIdentityList(input, true),
    (parsed) => {
      data.tags = parsed;
    },
  );
  readOptional('images', parseIdentityImages, (parsed) => {
    data.images = parsed;
  });

  let infoboxEvidenceFields: string[] = [];
  const rawInfobox = hasOwn(value, 'infobox') ? value.infobox : undefined;
  if (!hasOwn(value, 'infobox')) {
    fields.missing.push('infobox');
  } else {
    fields.observed.push('infobox');
    const parsedInfobox = parseIdentityInfobox(rawInfobox);
    if (!parsedInfobox) {
      fields.malformed.push('infobox');
    } else {
      fields.returned.push('infobox');
      data.infobox = parsedInfobox.data;
      if (parsedInfobox.malformed) fields.malformed.push('infobox');
      infoboxEvidenceFields = [
        'infobox',
        ...parsedInfobox.returnedRowIndexes.map((rowIndex) => `infobox[${rowIndex}]`),
      ];
    }
  }
  return {
    data,
    evidenceFields: [
      ...fields.returned.filter((field) => field !== 'infobox'),
      ...infoboxEvidenceFields,
    ],
  };
}

function subjectIdentityIsPartial(data: ProviderSubjectIdentityData): boolean {
  return (
    data.fields.missing.length > 0 ||
    data.fields.malformed.length > 0 ||
    data.fields.empty.length > 0 ||
    data.fields.truncated.length > 0 ||
    data.infobox.state !== 'complete' ||
    data.infobox.aliases.state !== 'known'
  );
}

function subjectIdentityWarnings(
  data: ProviderSubjectIdentityData,
  source: SourceDescriptor,
): ReturnType<typeof warning>[] {
  const warnings: ReturnType<typeof warning>[] = [];
  for (const fieldPath of data.fields.missing) {
    warnings.push(
      warning('MISSING_FIELD', `Identity field ${fieldPath} was not returned.`, {
        source,
        fieldPath,
      }),
    );
  }
  for (const fieldPath of data.fields.empty) {
    warnings.push(
      warning('MISSING_FIELD', `Identity field ${fieldPath} was returned empty.`, {
        source,
        fieldPath,
      }),
    );
  }
  for (const fieldPath of data.fields.malformed) {
    if (fieldPath === 'infobox') continue;
    warnings.push(
      warning('SCHEMA_DRIFT', `Identity field ${fieldPath} was malformed.`, {
        source,
        fieldPath,
      }),
    );
  }
  for (const fieldPath of data.fields.truncated) {
    warnings.push(
      warning(
        'IDENTITY_LIST_TRUNCATED',
        `Identity list ${fieldPath} reached its local output cap.`,
        {
          source,
          fieldPath,
          outputCap: SUBJECT_IDENTITY_MAX_LIST_ITEMS,
        },
      ),
    );
  }
  if (data.infobox.coverage.malformedRows > 0 || data.infobox.coverage.malformedValues > 0) {
    warnings.push(
      warning('INFOBOX_MALFORMED', 'Some official infobox rows or values could not be parsed.', {
        source,
        fieldPath: 'infobox',
      }),
    );
  }
  if (data.infobox.coverage.truncated) {
    warnings.push(
      warning('INFOBOX_TRUNCATED', 'The official infobox reached one or more local safety caps.', {
        source,
        fieldPath: 'infobox',
        outputCap: SUBJECT_IDENTITY_MAX_INFOBOX_ROWS,
      }),
    );
  }
  if (data.infobox.aliases.state === 'unknown') {
    warnings.push(
      warning(
        'ALIAS_UNKNOWN',
        'No recognized alias row was returned; this is unknown, not evidence that aliases do not exist.',
        { source, fieldPath: 'infobox.aliases' },
      ),
    );
  }
  return warnings;
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
  if (!Array.isArray(value.data))
    throw new SchemaDriftError('Discovery response data must be an array.');
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
    for (const fieldPath of [
      'id',
      'name',
      'nameCn',
      'date',
      'platform',
      'score',
      'rank',
      'ratingCount',
      'collection',
      'tags',
      'metaTags',
      'images',
      'nsfw',
    ]) {
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
    warnings: [
      warning('SOURCE_NOT_CONFIGURED', 'The official discovery operation is not configured.', {
        source,
      }),
    ],
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

  async getSubjectIdentity(
    subjectId: number,
    context: ProviderRequestContext = {},
  ): Promise<CapabilityResult<ProviderSubjectIdentityData>> {
    const source: SourceDescriptor = { ...SOURCE_V0, operation: 'getSubjectById' };
    const authScope = context.authScope ?? 'public';
    try {
      const raw = await this.api.getSubjectById(subjectId, {
        maxResponseBytes: SUBJECT_IDENTITY_MAX_RESPONSE_BYTES,
      });
      const retrievedAt = new Date().toISOString();
      const parsed = parseSubjectIdentity(raw);
      const partial = subjectIdentityIsPartial(parsed.data);
      const evidence = subjectEvidence(
        source,
        retrievedAt,
        parsed.data.id,
        parsed.evidenceFields,
        authScope,
      );
      if (parsed.data.infobox.aliases.sourceRowIndexes.length > 0) {
        const derivedSource: SourceDescriptor = {
          ...SOURCE_DERIVED,
          operation: 'subject-identity-alias-extraction',
          version: 'subject-identity-alias-v1',
        };
        evidence['infobox.aliases'] = [
          createEvidenceRef({
            source: derivedSource,
            retrievedAt,
            entity: { type: 'subject', id: parsed.data.id },
            fieldPath: 'infobox.aliases',
            freshness: { state: 'unknown' },
            authScope,
            confidence: 'medium',
            formula: 'subject-identity-alias-v1',
          }),
        ];
      }
      return {
        state: partial ? 'partial' : 'ok',
        data: parsed.data,
        evidence,
        coverage: {
          state: partial ? 'partial' : 'complete',
          requested: 1,
          scanned: 1,
          matched: 1,
          returned: 1,
        },
        retrievedAt,
        warnings: subjectIdentityWarnings(parsed.data, source),
      };
    } catch (err: unknown) {
      return failure(source, err);
    }
  }

  async getSubjectStats(
    subjectId: number,
    context: ProviderRequestContext = {},
  ): Promise<CapabilityResult<SubjectStatsData>> {
    const source: SourceDescriptor = { ...SOURCE_V0, operation: 'getSubjectById' };
    const authScope = context.authScope ?? 'public';
    try {
      const raw = await this.api.getSubjectById(subjectId);
      const retrievedAt = new Date().toISOString();
      const stats = parseStats(raw, { allowIncomplete: true });
      const id = requiredNumber((raw as unknown as Record<string, unknown>).id, 'id');
      const complete =
        Object.values(stats.ratingHistogramPresence || {}).every(Boolean) &&
        Object.values(stats.collectionPresence || {}).every(Boolean);
      return {
        state: complete ? 'ok' : 'partial',
        data: stats,
        evidence: subjectEvidence(source, retrievedAt, id, statsEvidenceFields(stats), authScope),
        coverage: {
          state: complete ? 'complete' : 'partial',
          requested: 1,
          scanned: 1,
          matched: 1,
          returned: 1,
        },
        retrievedAt,
        ...(complete
          ? {}
          : {
              warnings: [
                warning(
                  'MISSING_FIELD',
                  'Subject stats response omitted or contained invalid rating or collection buckets.',
                  { source },
                ),
              ],
            }),
      };
    } catch (err: unknown) {
      return failure(source, err);
    }
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
        warnings: [
          warning(
            'EXPERIMENTAL_SOURCE',
            'Official v0 subject search is marked experimental upstream.',
            { source },
          ),
        ],
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
