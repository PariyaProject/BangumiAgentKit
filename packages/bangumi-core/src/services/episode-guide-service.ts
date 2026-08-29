import {
  BangumiError,
  HttpClient,
  PublicErrorInfo,
  toPublicError,
} from '@bangumi-agent-kit/bangumi-transport';
import { GeneratedBangumiOpenApiClient, Subject } from '@bangumi-agent-kit/bangumi-openapi';
import { DomainSubject, SubjectType } from '../models/subject.js';
import { mapSubject } from './subject-service.js';

export type EpisodeGuideCategory = 'main' | 'sp' | 'op' | 'ed' | 'pv' | 'mad' | 'other' | 'unknown';

export type EpisodeGuideState = 'complete' | 'partial' | 'unavailable' | 'not_found';

export interface EpisodeGuideOptions {
  category?: Exclude<EpisodeGuideCategory, 'unknown'> | 'all';
  maxEpisodes?: number;
  includeDescriptions?: boolean;
}

export interface EpisodeGuideItem {
  id: number;
  subjectId: number;
  category: EpisodeGuideCategory;
  sourceSubjectId?: number;
  categoryFilterConflict?: boolean;
  rawType?: number;
  name?: string;
  nameCn?: string;
  sort?: number;
  ep?: number;
  airdate?: string;
  discussionCount?: number;
  duration?: string;
  description?: string;
}

export type EpisodeGuideAirdateQuality = 'valid' | 'missing' | 'invalid';

export interface EpisodeGuideAirdateRow {
  id: number;
  quality: EpisodeGuideAirdateQuality;
  airdate?: string;
  rawAirdate?: string;
  category: EpisodeGuideCategory;
  rawType?: number;
  ep?: number;
  sort?: number;
  unique: boolean;
  returned: boolean;
}

export interface EpisodeGuideResult {
  subjectId: number;
  state: EpisodeGuideState;
  subject?: {
    id: number;
    type: SubjectType;
    name?: string;
    nameCn?: string;
    date?: string;
    platform?: string;
    episodesReported?: number;
    totalEpisodesReported?: number;
  };
  filters: {
    category: EpisodeGuideOptions['category'];
    includeDescriptions: boolean;
  };
  items: EpisodeGuideItem[];
  summary: {
    returned: number;
    byCategory: Partial<Record<EpisodeGuideCategory, number>>;
    withAirdate: number;
    withDuration: number;
    withDescription: number;
    withDiscussionCount: number;
    empty: boolean;
  };
  coverage: {
    state: EpisodeGuideState;
    requestedMaxEpisodes: number;
    sourceTotal?: number;
    totalKind: 'exact' | 'unknown' | 'conflict';
    observedRows: number;
    uniqueRows: number;
    returnedRows: number;
    sourceLimit?: number;
    sourceOffset?: number;
    truncated: boolean;
    duplicateRows: number;
    overReturnedRows: number;
    sourceLimitMismatch: boolean;
    identityConflicts: Record<string, number>;
    filterConflicts: Record<string, number>;
    missingFields: Record<string, number>;
    truncatedFields: Record<string, number>;
    invalidFields: Record<string, number>;
    duplicateConflicts?: Record<string, number>;
    /** Bounded raw-row airdate quality evidence, when the source page parsed successfully. */
    airdateRows?: EpisodeGuideAirdateRow[];
    /** Rows whose type is missing or outside the known official taxonomy. */
    unknownTypeRows?: number;
    unknownTypeValues?: Record<string, number>;
    subject: {
      state: 'complete' | 'unavailable' | 'not_found';
      attempted: boolean;
      retrievedAt?: string;
    };
    episodes: {
      state: 'complete' | 'unavailable' | 'not_found';
      attempted: boolean;
      retrievedAt?: string;
    };
  };
  capabilityStates: {
    episodeProgress: 'not_computable';
    watchOrder: 'not_computable';
  };
  source: {
    class: 'official_v0';
    operations: ['GET /v0/subjects/{subject_id}', 'GET /v0/episodes'];
    attemptedAt: string;
    retrievedAt?: string;
    attempts: Array<{
      operation: string;
      state: 'complete' | 'unavailable' | 'not_found';
      attemptedAt: string;
      retrievedAt?: string;
      error?: PublicErrorInfo;
    }>;
  };
  evidence: Array<{
    source: 'official_v0' | 'derived';
    operations: string[];
    retrievedAt?: string;
    attemptedAt?: string;
    formulaVersion?: string;
    description?: string;
    error?: PublicErrorInfo;
  }>;
  limitations: string[];
  warnings: Array<{
    code: string;
    state: EpisodeGuideState;
    message: string;
  }>;
  error?: PublicErrorInfo;
}

interface GuideEpisodeSource {
  id: number;
  subjectId: number;
  sourceSubjectId?: number;
  categoryFilterConflict?: boolean;
  type?: number;
  name?: string;
  nameCn?: string;
  sort?: number;
  ep?: number;
  airdate?: string;
  comment?: number;
  duration?: string;
  desc?: string;
}

interface EpisodePage {
  total?: number;
  limit?: number;
  offset?: number;
  data: GuideEpisodeSource[];
  missingFields: Record<string, number>;
  truncatedFields: Record<string, number>;
  invalidFields: Record<string, number>;
  identityConflicts: Record<string, number>;
  filterConflicts: Record<string, number>;
  airdateRows: Array<Omit<EpisodeGuideAirdateRow, 'unique' | 'returned'>>;
  unknownTypeRows: number;
  unknownTypeValues: Record<string, number>;
}

interface EpisodeSourceAttempt {
  state: 'complete' | 'unavailable' | 'not_found';
  page?: EpisodePage;
  error?: PublicErrorInfo;
  attemptedAt: string;
  retrievedAt?: string;
}

interface SubjectSourceAttempt {
  state: 'complete' | 'unavailable' | 'not_found';
  subject?: DomainSubject;
  missingFields: Record<string, number>;
  identityConflicts: Record<string, number>;
  error?: PublicErrorInfo;
  attemptedAt: string;
  retrievedAt?: string;
}

export const EPISODE_GUIDE_DEFAULT_MAX_EPISODES = 50;
export const EPISODE_GUIDE_MAX_EPISODES = 200;
export const EPISODE_GUIDE_MAX_DESCRIPTION_LENGTH = 600;
export const EPISODE_GUIDE_FORMULA_VERSION = 'episode-guide-v1';

const CATEGORY_TO_TYPE: Record<Exclude<EpisodeGuideCategory, 'unknown' | 'all'>, number> = {
  main: 0,
  sp: 1,
  op: 2,
  ed: 3,
  pv: 4,
  mad: 5,
  other: 6,
};

const CATEGORY_ORDER: EpisodeGuideCategory[] = [
  'main',
  'sp',
  'op',
  'ed',
  'pv',
  'mad',
  'other',
  'unknown',
];

function boundedMaxEpisodes(value: number | undefined): number {
  if (!Number.isFinite(value)) return EPISODE_GUIDE_DEFAULT_MAX_EPISODES;
  return Math.min(EPISODE_GUIDE_MAX_EPISODES, Math.max(1, Math.trunc(value as number)));
}

function increment(counter: Record<string, number>, field: string): void {
  counter[field] = (counter[field] || 0) + 1;
}

function recordMissing(value: unknown, field: string, missingFields: Record<string, number>): void {
  if (value === undefined || value === null || value === '') increment(missingFields, field);
}

function categoryForType(type: number | undefined): EpisodeGuideCategory {
  switch (type) {
    case 0:
      return 'main';
    case 1:
      return 'sp';
    case 2:
      return 'op';
    case 3:
      return 'ed';
    case 4:
      return 'pv';
    case 5:
      return 'mad';
    case 6:
      return 'other';
    default:
      return 'unknown';
  }
}

function finiteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function positiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function validIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month! - 1 && date.getUTCDate() === day
  );
}

function parserError(path: string, expected: string): BangumiError {
  return new BangumiError('PARSER_ERROR', `episode-guide.${path} 应为 ${expected}`, false);
}

function subjectIdentityMismatchError(
  requestedSubjectId: number,
  sourceSubjectId: number,
): BangumiError {
  return new BangumiError(
    'PARSER_ERROR',
    `episode-guide.subject.id identity mismatch: expected ${requestedSubjectId}, received ${sourceSubjectId}`,
    false,
  );
}

function parseEpisodePage(
  raw: unknown,
  subjectId: number,
  category: EpisodeGuideOptions['category'],
): EpisodePage {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw parserError('payload', '对象');
  }
  const value = raw as Record<string, unknown>;
  if (!Array.isArray(value.data)) throw parserError('data', '数组');
  if (value.data.length > EPISODE_GUIDE_MAX_EPISODES) {
    throw parserError('data', `最多 ${EPISODE_GUIDE_MAX_EPISODES} 条的有界数组`);
  }

  const optionalInteger = (field: string, minimum: number): number | undefined => {
    const current = value[field];
    if (current === undefined || current === null) return undefined;
    if (typeof current !== 'number' || !Number.isInteger(current) || current < minimum) {
      throw parserError(field, minimum === 0 ? '非负整数' : '正整数');
    }
    return current as number;
  };

  const missingFields: Record<string, number> = {};
  const truncatedFields: Record<string, number> = {};
  const invalidFields: Record<string, number> = {};
  const identityConflicts: Record<string, number> = {};
  const filterConflicts: Record<string, number> = {};
  const airdateRows: EpisodePage['airdateRows'] = [];
  const unknownTypeValues: Record<string, number> = {};
  let unknownTypeRows = 0;
  const requestedType = category && category !== 'all' ? CATEGORY_TO_TYPE[category] : undefined;
  const data = value.data.map((rawItem, index) => {
    if (!rawItem || typeof rawItem !== 'object' || Array.isArray(rawItem)) {
      throw parserError(`data[${index}]`, '对象');
    }
    const item = rawItem as Record<string, unknown>;
    if (!positiveInteger(item.id)) throw parserError(`data[${index}].id`, '正整数');
    if (
      item.subject_id !== undefined &&
      item.subject_id !== null &&
      !positiveInteger(item.subject_id)
    ) {
      throw parserError(`data[${index}].subject_id`, '正整数');
    }
    if (item.type !== undefined && item.type !== null) {
      if (!Number.isInteger(item.type) || (item.type as number) < 0) {
        throw parserError(`data[${index}].type`, '非负整数');
      }
      if ((item.type as number) > 6) {
        unknownTypeRows += 1;
        increment(unknownTypeValues, String(item.type));
      }
    }
    for (const field of ['name', 'name_cn', 'airdate', 'duration', 'desc']) {
      if (item[field] !== undefined && item[field] !== null && typeof item[field] !== 'string') {
        throw parserError(`data[${index}].${field}`, '字符串');
      }
    }
    for (const field of ['sort', 'ep', 'comment']) {
      if (item[field] !== undefined && item[field] !== null && !finiteNumber(item[field])) {
        throw parserError(`data[${index}].${field}`, '有限数字');
      }
    }
    recordMissing(item.name, 'episode.name', missingFields);
    recordMissing(item.name_cn, 'episode.nameCn', missingFields);
    recordMissing(item.type, 'episode.type', missingFields);
    recordMissing(item.sort, 'episode.sort', missingFields);
    recordMissing(item.airdate, 'episode.airdate', missingFields);
    recordMissing(item.duration, 'episode.duration', missingFields);
    recordMissing(item.desc, 'episode.description', missingFields);
    recordMissing(item.comment, 'episode.discussionCount', missingFields);
    const normalizedItem: GuideEpisodeSource = {
      id: item.id as number,
      subjectId,
      ...(positiveInteger(item.subject_id) ? { sourceSubjectId: item.subject_id } : {}),
      type: finiteNumber(item.type) ? item.type : undefined,
      name: typeof item.name === 'string' && item.name ? item.name : undefined,
      nameCn: typeof item.name_cn === 'string' && item.name_cn ? item.name_cn : undefined,
      sort: finiteNumber(item.sort) ? item.sort : undefined,
      ep: finiteNumber(item.ep) ? item.ep : undefined,
      airdate: typeof item.airdate === 'string' && item.airdate ? item.airdate : undefined,
      comment: finiteNumber(item.comment) ? item.comment : undefined,
      duration: typeof item.duration === 'string' && item.duration ? item.duration : undefined,
      desc: typeof item.desc === 'string' && item.desc ? item.desc : undefined,
    };
    if (
      normalizedItem.sourceSubjectId !== undefined &&
      normalizedItem.sourceSubjectId !== subjectId
    ) {
      increment(identityConflicts, 'episode.subjectId');
    }
    if (
      requestedType !== undefined &&
      normalizedItem.type !== undefined &&
      normalizedItem.type !== requestedType
    ) {
      normalizedItem.categoryFilterConflict = true;
      increment(filterConflicts, 'episode.category');
    }
    const airdateQuality: EpisodeGuideAirdateQuality =
      item.airdate === undefined || item.airdate === null || item.airdate === ''
        ? 'missing'
        : validIsoDate(item.airdate as string)
          ? 'valid'
          : 'invalid';
    if (airdateQuality === 'invalid') {
      increment(invalidFields, 'episode.airdate');
      delete normalizedItem.airdate;
    }
    if (
      finiteNumber(item.comment) &&
      (!Number.isInteger(item.comment) || (item.comment as number) < 0)
    ) {
      increment(invalidFields, 'episode.discussionCount');
      delete normalizedItem.comment;
    }

    if (normalizedItem.type === undefined || normalizedItem.type > 6) {
      unknownTypeRows += normalizedItem.type === undefined ? 1 : 0;
      if (normalizedItem.type === undefined) increment(unknownTypeValues, 'missing');
    }
    airdateRows.push({
      id: normalizedItem.id,
      quality: airdateQuality,
      ...(airdateQuality === 'valid' && normalizedItem.airdate
        ? { airdate: normalizedItem.airdate }
        : {}),
      ...(airdateQuality === 'invalid' && typeof item.airdate === 'string'
        ? { rawAirdate: item.airdate }
        : {}),
      category: categoryForType(normalizedItem.type),
      ...(normalizedItem.type === undefined ? {} : { rawType: normalizedItem.type }),
      ...(normalizedItem.ep === undefined ? {} : { ep: normalizedItem.ep }),
      ...(normalizedItem.sort === undefined ? {} : { sort: normalizedItem.sort }),
    });

    return normalizedItem;
  });

  return {
    total: optionalInteger('total', 0),
    limit: optionalInteger('limit', 1),
    offset: optionalInteger('offset', 0),
    data,
    missingFields,
    truncatedFields,
    invalidFields,
    identityConflicts,
    filterConflicts,
    airdateRows,
    unknownTypeRows,
    unknownTypeValues,
  };
}

function parseSubjectPayload(
  raw: unknown,
  requestedSubjectId: number,
): { subject: DomainSubject; missingFields: string[] } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw parserError('subject', '对象');
  }
  const value = raw as Record<string, unknown>;
  if (!positiveInteger(value.id)) throw parserError('subject.id', '正整数');
  if (value.id !== requestedSubjectId) {
    throw subjectIdentityMismatchError(requestedSubjectId, value.id as number);
  }
  if (!Number.isInteger(value.type)) throw parserError('subject.type', '整数');
  for (const field of ['name', 'name_cn', 'date', 'platform']) {
    if (value[field] !== undefined && value[field] !== null && typeof value[field] !== 'string') {
      throw parserError(`subject.${field}`, '字符串');
    }
  }
  const missingFields = ['name', 'name_cn', 'type'].filter(
    (field) => value[field] === undefined || value[field] === null || value[field] === '',
  );
  const subject = mapSubject(value as unknown as Subject);
  if (!value.name) subject.name = '';
  if (!value.name_cn) subject.nameCn = '';
  return { subject, missingFields };
}

function boundedText(
  value: string | undefined,
  field: string,
  truncatedFields: Record<string, number>,
): string | undefined {
  if (!value) return undefined;
  if (value.length <= EPISODE_GUIDE_MAX_DESCRIPTION_LENGTH) return value;
  increment(truncatedFields, field);
  return `${value.slice(0, EPISODE_GUIDE_MAX_DESCRIPTION_LENGTH - 1)}…`;
}

function mapGuideItem(
  raw: GuideEpisodeSource,
  subjectId: number,
  includeDescriptions: boolean,
  truncatedFields: Record<string, number>,
): EpisodeGuideItem {
  return {
    id: raw.id,
    subjectId,
    category: categoryForType(raw.type),
    ...(raw.sourceSubjectId === undefined ? {} : { sourceSubjectId: raw.sourceSubjectId }),
    ...(raw.categoryFilterConflict ? { categoryFilterConflict: true } : {}),
    ...(raw.type === undefined ? {} : { rawType: raw.type }),
    ...(raw.name ? { name: raw.name } : {}),
    ...(raw.nameCn ? { nameCn: raw.nameCn } : {}),
    ...(finiteNumber(raw.sort) ? { sort: raw.sort } : {}),
    ...(finiteNumber(raw.ep) ? { ep: raw.ep } : {}),
    ...(raw.airdate ? { airdate: raw.airdate } : {}),
    ...(finiteNumber(raw.comment) ? { discussionCount: raw.comment } : {}),
    ...(raw.duration ? { duration: raw.duration } : {}),
    ...(includeDescriptions
      ? { description: boundedText(raw.desc, 'episode.description', truncatedFields) }
      : {}),
  };
}

function sortEpisodes(items: EpisodeGuideItem[]): EpisodeGuideItem[] {
  const categoryRank = new Map(CATEGORY_ORDER.map((category, index) => [category, index]));
  return [...items].sort((left, right) => {
    const categoryDifference =
      (categoryRank.get(left.category) ?? CATEGORY_ORDER.length) -
      (categoryRank.get(right.category) ?? CATEGORY_ORDER.length);
    if (categoryDifference !== 0) return categoryDifference;
    const leftNumber = left.ep ?? left.sort ?? Number.POSITIVE_INFINITY;
    const rightNumber = right.ep ?? right.sort ?? Number.POSITIVE_INFINITY;
    if (leftNumber !== rightNumber) return leftNumber - rightNumber;
    return left.id - right.id;
  });
}

function mapSubjectSummary(subject: DomainSubject | undefined): EpisodeGuideResult['subject'] {
  if (!subject) return undefined;
  return {
    id: subject.id,
    type: subject.type,
    ...(subject.name ? { name: subject.name } : {}),
    ...(subject.nameCn ? { nameCn: subject.nameCn } : {}),
    ...(subject.date ? { date: subject.date } : {}),
    ...(subject.platform ? { platform: subject.platform } : {}),
    ...(subject.eps !== undefined ? { episodesReported: subject.eps } : {}),
    ...(subject.totalEpisodes !== undefined
      ? { totalEpisodesReported: subject.totalEpisodes }
      : {}),
  };
}

function limitations(): string[] {
  return [
    '结果只覆盖本次官方 v0 章节接口返回的有界页面；超过 maxEpisodes 的章节不会被猜测补全。',
    '章节顺序按章节分类、ep/sort 和 ID 做确定性排序，不代表官方观看顺序或推荐顺序。',
    'airdate、duration、desc 和 comment 是官方字段；缺失时保持未知，description 只在输出需要时返回并受长度上限约束。',
    '本能力不读取评论正文、不推断播出时刻、观看进度、后续集数、历史趋势或社区热度变化。',
  ];
}

function warning(
  code: string,
  state: EpisodeGuideState,
  message: string,
): EpisodeGuideResult['warnings'][number] {
  return { code, state, message };
}

export class EpisodeGuideService {
  private transport?: HttpClient;
  private generatedClient?: GeneratedBangumiOpenApiClient;

  constructor(client: GeneratedBangumiOpenApiClient | HttpClient) {
    if (client instanceof GeneratedBangumiOpenApiClient) this.generatedClient = client;
    else this.transport = client;
  }

  private async fetchSubject(subjectId: number): Promise<SubjectSourceAttempt> {
    const attemptedAt = new Date().toISOString();
    try {
      if (this.transport) {
        const raw = await this.transport.request<unknown>({
          method: 'GET',
          path: `/v0/subjects/${encodeURIComponent(String(subjectId))}`,
          retryOptions: { maxRetries: 0 },
        });
        const parsed = parseSubjectPayload(raw, subjectId);
        const missingFields: Record<string, number> = {};
        for (const field of parsed.missingFields) increment(missingFields, `subject.${field}`);
        return {
          state: 'complete',
          subject: parsed.subject,
          missingFields,
          identityConflicts: {},
          attemptedAt,
          retrievedAt: new Date().toISOString(),
        };
      }
      const raw = await this.generatedClient!.getSubjectById(subjectId);
      const parsed = parseSubjectPayload(raw, subjectId);
      const missingFields: Record<string, number> = {};
      for (const field of parsed.missingFields) increment(missingFields, `subject.${field}`);
      return {
        state: 'complete',
        subject: parsed.subject,
        missingFields,
        identityConflicts: {},
        attemptedAt,
        retrievedAt: new Date().toISOString(),
      };
    } catch (err) {
      const error = toPublicError(err);
      const identityConflicts: Record<string, number> = {};
      if (
        err instanceof BangumiError &&
        err.code === 'PARSER_ERROR' &&
        err.message.includes('episode-guide.subject.id identity mismatch')
      ) {
        increment(identityConflicts, 'subject.id');
      }
      return {
        state: error.code === 'NOT_FOUND' ? 'not_found' : 'unavailable',
        missingFields: {},
        identityConflicts,
        error,
        attemptedAt,
      };
    }
  }

  private async fetchEpisodes(
    subjectId: number,
    category: EpisodeGuideOptions['category'],
    maxEpisodes: number,
  ): Promise<EpisodeSourceAttempt> {
    const attemptedAt = new Date().toISOString();
    const type = category && category !== 'all' ? CATEGORY_TO_TYPE[category] : undefined;
    try {
      if (this.transport) {
        const raw = await this.transport.request<unknown>({
          method: 'GET',
          path: '/v0/episodes',
          query: {
            subject_id: subjectId,
            type,
            limit: maxEpisodes,
            offset: 0,
          },
          retryOptions: { maxRetries: 0 },
        });
        return {
          state: 'complete',
          page: parseEpisodePage(raw, subjectId, category),
          attemptedAt,
          retrievedAt: new Date().toISOString(),
        };
      }
      const raw = await this.generatedClient!.getEpisodes({
        subject_id: subjectId,
        type: type as 0 | 1 | 2 | 3 | 4 | 5 | 6 | undefined,
        limit: maxEpisodes,
        offset: 0,
      });
      return {
        state: 'complete',
        page: parseEpisodePage(raw, subjectId, category),
        attemptedAt,
        retrievedAt: new Date().toISOString(),
      };
    } catch (err) {
      const error = toPublicError(err);
      return {
        state: error.code === 'NOT_FOUND' ? 'not_found' : 'unavailable',
        error,
        attemptedAt,
      };
    }
  }

  async getEpisodeGuide(
    subjectId: number,
    options: EpisodeGuideOptions = {},
  ): Promise<EpisodeGuideResult> {
    const category = options.category ?? 'all';
    const maxEpisodes = boundedMaxEpisodes(options.maxEpisodes);
    const includeDescriptions = options.includeDescriptions ?? true;
    const attemptedAt = new Date().toISOString();
    const [subjectAttempt, episodeAttempt] = await Promise.all([
      this.fetchSubject(subjectId),
      this.fetchEpisodes(subjectId, category, maxEpisodes),
    ]);

    const missingFields: Record<string, number> = { ...subjectAttempt.missingFields };
    const truncatedFields: Record<string, number> = {};
    const invalidFields: Record<string, number> = {};
    const identityConflicts: Record<string, number> = {};
    const filterConflicts: Record<string, number> = {};
    for (const [field, count] of Object.entries(subjectAttempt.identityConflicts)) {
      identityConflicts[field] = (identityConflicts[field] || 0) + count;
    }
    const sourcePage = episodeAttempt.page;
    const rawRows = sourcePage?.data || [];
    const observedRows = rawRows.length;
    const uniqueSources = new Map<number, GuideEpisodeSource>();
    let duplicateRows = 0;
    const duplicateConflicts: Record<string, number> = {};
    for (const raw of rawRows) {
      if (uniqueSources.has(raw.id)) {
        const first = uniqueSources.get(raw.id)!;
        if (
          first.airdate !== undefined &&
          raw.airdate !== undefined &&
          first.airdate !== raw.airdate
        ) {
          increment(duplicateConflicts, 'episode.airdate');
        }
        duplicateRows += 1;
        continue;
      }
      uniqueSources.set(raw.id, raw);
    }
    if (episodeAttempt.page) {
      for (const [field, count] of Object.entries(episodeAttempt.page.missingFields)) {
        missingFields[field] = (missingFields[field] || 0) + count;
      }
      for (const [field, count] of Object.entries(episodeAttempt.page.truncatedFields)) {
        truncatedFields[field] = (truncatedFields[field] || 0) + count;
      }
      for (const [field, count] of Object.entries(episodeAttempt.page.invalidFields)) {
        invalidFields[field] = (invalidFields[field] || 0) + count;
      }
      for (const [field, count] of Object.entries(episodeAttempt.page.identityConflicts)) {
        identityConflicts[field] = (identityConflicts[field] || 0) + count;
      }
      for (const [field, count] of Object.entries(episodeAttempt.page.filterConflicts)) {
        filterConflicts[field] = (filterConflicts[field] || 0) + count;
      }
    }
    const allItems = sortEpisodes(
      Array.from(uniqueSources.values()).map((item) =>
        mapGuideItem(item, subjectId, includeDescriptions, truncatedFields),
      ),
    );
    const items = allItems.slice(0, maxEpisodes);
    const returnedIds = new Set(items.map((item) => item.id));
    const seenAirdateIds = new Set<number>();
    const airdateRows = (sourcePage?.airdateRows || []).map((row) => {
      const unique = !seenAirdateIds.has(row.id);
      seenAirdateIds.add(row.id);
      return {
        ...row,
        unique,
        returned: unique && returnedIds.has(row.id),
      };
    });
    if (!includeDescriptions) {
      delete missingFields['episode.description'];
      delete truncatedFields['episode.description'];
    }
    if (sourcePage && sourcePage.total === undefined) increment(missingFields, 'page.total');
    const sourceTotal = sourcePage?.total;
    const inconsistentTotal = sourceTotal !== undefined && sourceTotal < observedRows;
    const totalKind =
      sourceTotal === undefined ? 'unknown' : inconsistentTotal ? 'conflict' : 'exact';
    const overReturnedRows = Math.max(0, observedRows - maxEpisodes);
    const sourceLimitMismatch = sourcePage?.limit !== undefined && sourcePage.limit > maxEpisodes;
    const truncated =
      (sourceTotal !== undefined && sourceTotal > observedRows) ||
      overReturnedRows > 0 ||
      Boolean(sourcePage && sourcePage.offset && sourcePage.offset > 0);
    const qualityDegraded =
      truncated ||
      duplicateRows > 0 ||
      inconsistentTotal ||
      sourceLimitMismatch ||
      Object.keys(identityConflicts).length > 0 ||
      Object.keys(filterConflicts).length > 0 ||
      Object.keys(missingFields).length > 0 ||
      Object.keys(truncatedFields).length > 0 ||
      Object.keys(invalidFields).length > 0 ||
      (sourcePage?.unknownTypeRows || 0) > 0 ||
      subjectAttempt.state !== 'complete';

    const byCategory: Partial<Record<EpisodeGuideCategory, number>> = {};
    for (const item of items) byCategory[item.category] = (byCategory[item.category] || 0) + 1;
    const summary = {
      returned: items.length,
      byCategory,
      withAirdate: items.filter((item) => Boolean(item.airdate)).length,
      withDuration: items.filter((item) => Boolean(item.duration)).length,
      withDescription: items.filter((item) => Boolean(item.description)).length,
      withDiscussionCount: items.filter((item) => item.discussionCount !== undefined).length,
      empty: items.length === 0,
    };

    let state: EpisodeGuideState;
    if (!sourcePage && episodeAttempt.state === 'not_found') {
      state = subjectAttempt.state === 'not_found' ? 'not_found' : 'partial';
    } else if (!sourcePage && episodeAttempt.state === 'unavailable') {
      state = subjectAttempt.state === 'unavailable' ? 'unavailable' : 'partial';
    } else {
      state = qualityDegraded ? 'partial' : 'complete';
    }

    const warnings: EpisodeGuideResult['warnings'] = [];
    if (summary.empty && episodeAttempt.state === 'complete') {
      warnings.push(
        warning(
          'NO_EPISODES_OBSERVED',
          state,
          '官方章节接口返回空结果；这不等同于条目没有后续内容或官方观看顺序。',
        ),
      );
    }
    if (subjectAttempt.state !== 'complete') {
      warnings.push(
        warning(
          subjectAttempt.identityConflicts['subject.id']
            ? 'SUBJECT_SOURCE_MISMATCH'
            : 'SUBJECT_IDENTITY_UNAVAILABLE',
          state,
          subjectAttempt.identityConflicts['subject.id']
            ? '官方条目源返回的 subject_id 与请求条目不一致；条目身份按 schema drift/conflict 处理，未标记为完整。'
            : subjectAttempt.state === 'not_found'
              ? '未找到对应条目身份信息；章节源结果不会被当作完整条目概览。'
              : '条目身份源暂时不可用；章节结果仍按可获取的官方页面返回。',
        ),
      );
    }
    if (episodeAttempt.state !== 'complete') {
      warnings.push(
        warning(
          episodeAttempt.error?.code === 'PARSER_ERROR'
            ? 'SCHEMA_DRIFT'
            : 'EPISODE_SOURCE_UNAVAILABLE',
          state,
          episodeAttempt.state === 'not_found'
            ? '官方章节源未找到该条目的章节页面。'
            : '官方章节源暂时不可用，未生成猜测的章节列表。',
        ),
      );
    }
    if (truncated) {
      warnings.push(
        warning(
          'OUTPUT_TRUNCATED',
          'partial',
          `官方章节报告 ${sourceTotal ?? '未知'} 条，本次观察 ${observedRows} 条，输出最多 ${maxEpisodes} 条；省略或未读取部分不代表不存在。`,
        ),
      );
    }
    if (overReturnedRows > 0) {
      warnings.push(
        warning(
          'SOURCE_OVER_RETURNED',
          'partial',
          `官方章节源返回 ${observedRows} 条，超过请求上限 ${maxEpisodes} 条；输出只保留有界结果。`,
        ),
      );
    }
    if (sourceLimitMismatch) {
      warnings.push(
        warning(
          'SOURCE_LIMIT_MISMATCH',
          'partial',
          `官方章节源报告 limit=${sourcePage?.limit}，大于请求上限 ${maxEpisodes}。`,
        ),
      );
    }
    if (duplicateRows > 0) {
      warnings.push(
        warning(
          'DUPLICATE_EPISODE_ROWS',
          'partial',
          `官方章节源返回 ${duplicateRows} 条重复 ID，输出保留首次观察并公开重复计数。`,
        ),
      );
    }
    if (identityConflicts['episode.subjectId']) {
      warnings.push(
        warning(
          'SOURCE_ID_MISMATCH',
          'partial',
          '部分章节的官方 subject_id 与请求条目不一致，已保留 sourceSubjectId 并标记 partial。',
        ),
      );
    }
    if (Object.keys(filterConflicts).length > 0) {
      warnings.push(
        warning(
          'CATEGORY_FILTER_MISMATCH',
          'partial',
          '章节源返回了不符合请求类别的行，已保留实际类别并标记冲突。',
        ),
      );
    }
    if (Object.keys(missingFields).length > 0) {
      warnings.push(
        warning('MISSING_FIELDS', 'partial', '部分章节字段缺失，已保持未知而没有用默认值填充。'),
      );
    }
    if (Object.keys(truncatedFields).length > 0) {
      warnings.push(
        warning('FIELD_TRUNCATED', 'partial', '部分描述超过输出边界，已截断并保留字段裁剪计数。'),
      );
    }
    if (Object.keys(invalidFields).length > 0) {
      warnings.push(
        warning(
          'INVALID_FIELDS',
          'partial',
          '部分章节字段格式不可用，已保持该字段未知并公开计数。',
        ),
      );
    }
    if ((sourcePage?.unknownTypeRows || 0) > 0) {
      const unknownTypes = Object.keys(sourcePage?.unknownTypeValues || {})
        .filter((value) => value !== 'missing')
        .slice(0, 6)
        .join(', ');
      warnings.push(
        warning(
          'UNKNOWN_EPISODE_TYPES',
          'partial',
          `发现 ${sourcePage?.unknownTypeRows} 条未知章节类型${unknownTypes ? `（raw type: ${unknownTypes}）` : ''}；已保留原始类型并按 unknown 分类，未计入已知特别篇。`,
        ),
      );
    }
    if (inconsistentTotal) {
      warnings.push(
        warning(
          'SOURCE_INCONSISTENT',
          'partial',
          '官方 total 小于本次观察条数，分母标记为 conflict，覆盖状态按 partial 处理。',
        ),
      );
    }

    const retrievedAt = [subjectAttempt.retrievedAt, episodeAttempt.retrievedAt]
      .filter((value): value is string => Boolean(value))
      .sort()
      .at(-1);
    const operations: EpisodeGuideResult['source']['operations'] = [
      'GET /v0/subjects/{subject_id}',
      'GET /v0/episodes',
    ];
    const operationAttempts = [
      {
        operation: operations[0],
        state: subjectAttempt.state,
        attemptedAt: subjectAttempt.attemptedAt,
        ...(subjectAttempt.retrievedAt ? { retrievedAt: subjectAttempt.retrievedAt } : {}),
        ...(subjectAttempt.error ? { error: subjectAttempt.error } : {}),
      },
      {
        operation: operations[1],
        state: episodeAttempt.state,
        attemptedAt: episodeAttempt.attemptedAt,
        ...(episodeAttempt.retrievedAt ? { retrievedAt: episodeAttempt.retrievedAt } : {}),
        ...(episodeAttempt.error ? { error: episodeAttempt.error } : {}),
      },
    ];
    const error = episodeAttempt.error || subjectAttempt.error;
    return {
      subjectId,
      state,
      subject: mapSubjectSummary(subjectAttempt.subject),
      filters: { category, includeDescriptions },
      items,
      summary,
      coverage: {
        state,
        requestedMaxEpisodes: maxEpisodes,
        ...(sourceTotal === undefined ? {} : { sourceTotal }),
        totalKind,
        observedRows,
        uniqueRows: uniqueSources.size,
        returnedRows: items.length,
        ...(sourcePage?.limit === undefined ? {} : { sourceLimit: sourcePage.limit }),
        ...(sourcePage?.offset === undefined ? {} : { sourceOffset: sourcePage.offset }),
        truncated,
        duplicateRows,
        overReturnedRows,
        sourceLimitMismatch,
        identityConflicts,
        filterConflicts,
        missingFields,
        truncatedFields,
        invalidFields,
        ...(Object.keys(duplicateConflicts).length > 0 ? { duplicateConflicts } : {}),
        airdateRows,
        unknownTypeRows: sourcePage?.unknownTypeRows || 0,
        unknownTypeValues: sourcePage?.unknownTypeValues || {},
        subject: {
          state: subjectAttempt.state,
          attempted: true,
          ...(subjectAttempt.retrievedAt ? { retrievedAt: subjectAttempt.retrievedAt } : {}),
        },
        episodes: {
          state: episodeAttempt.state,
          attempted: true,
          ...(episodeAttempt.retrievedAt ? { retrievedAt: episodeAttempt.retrievedAt } : {}),
        },
      },
      capabilityStates: {
        episodeProgress: 'not_computable',
        watchOrder: 'not_computable',
      },
      source: {
        class: 'official_v0',
        operations,
        attemptedAt,
        ...(retrievedAt ? { retrievedAt } : {}),
        attempts: operationAttempts,
      },
      evidence: [
        {
          source: 'official_v0',
          operations: [operations[0]],
          attemptedAt: subjectAttempt.attemptedAt,
          ...(subjectAttempt.retrievedAt ? { retrievedAt: subjectAttempt.retrievedAt } : {}),
          ...(subjectAttempt.error ? { error: subjectAttempt.error } : {}),
        },
        {
          source: 'official_v0',
          operations: [operations[1]],
          attemptedAt: episodeAttempt.attemptedAt,
          ...(episodeAttempt.retrievedAt ? { retrievedAt: episodeAttempt.retrievedAt } : {}),
          ...(episodeAttempt.error ? { error: episodeAttempt.error } : {}),
        },
        {
          source: 'derived',
          operations: ['episode-guide-composition'],
          attemptedAt,
          formulaVersion: EPISODE_GUIDE_FORMULA_VERSION,
          description:
            '保留官方章节字段；按分类、ep/sort、ID 确定性排序；重复 ID 只保留首次观察；输出受 requestedMaxEpisodes 限制；所有省略、缺失、冲突和字段裁剪都进入 coverage。',
        },
      ],
      limitations: limitations(),
      warnings,
      ...(error ? { error } : {}),
    };
  }
}
