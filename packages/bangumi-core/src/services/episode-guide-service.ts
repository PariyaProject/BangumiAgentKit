import {
  BangumiError,
  HttpClient,
  PublicErrorInfo,
  toPublicError,
} from '@bangumi-agent-kit/bangumi-transport';
import {
  Episode,
  GeneratedBangumiOpenApiClient,
  Subject,
} from '@bangumi-agent-kit/bangumi-openapi';
import { DomainSubject, SubjectType } from '../models/subject.js';
import { DomainEpisode } from '../models/episode.js';
import { EpisodeService } from './episode-service.js';
import { mapSubject, SubjectService } from './subject-service.js';

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
    totalKind: 'exact' | 'unknown';
    observedRows: number;
    uniqueRows: number;
    returnedRows: number;
    sourceLimit?: number;
    sourceOffset?: number;
    truncated: boolean;
    duplicateRows: number;
    missingFields: Record<string, number>;
    truncatedFields: Record<string, number>;
    invalidFields: Record<string, number>;
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
  };
  evidence: Array<{
    source: 'official_v0' | 'derived';
    operations: string[];
    retrievedAt?: string;
    attemptedAt?: string;
    formulaVersion?: string;
    description?: string;
  }>;
  limitations: string[];
  warnings: Array<{
    code: string;
    state: EpisodeGuideState;
    message: string;
  }>;
  error?: PublicErrorInfo;
}

interface EpisodePage {
  total?: number;
  limit?: number;
  offset?: number;
  data: Episode[];
  missingFields: Record<string, number>;
  truncatedFields: Record<string, number>;
  invalidFields: Record<string, number>;
}

interface GuideEpisodeSource {
  id: number;
  subjectId: number;
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

function parserError(path: string, expected: string): BangumiError {
  return new BangumiError('PARSER_ERROR', `episode-guide.${path} 应为 ${expected}`, false);
}

function parseEpisodePage(raw: unknown): EpisodePage {
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
  const data = value.data.map((rawItem, index) => {
    if (!rawItem || typeof rawItem !== 'object' || Array.isArray(rawItem)) {
      throw parserError(`data[${index}]`, '对象');
    }
    const item = rawItem as Record<string, unknown>;
    if (!positiveInteger(item.id)) throw parserError(`data[${index}].id`, '正整数');
    if (item.type !== undefined && item.type !== null) {
      if (!Number.isInteger(item.type) || (item.type as number) < 0 || (item.type as number) > 6) {
        throw parserError(`data[${index}].type`, '0 到 6 的整数');
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
    const normalizedItem = { ...item };
    if (
      typeof item.airdate === 'string' &&
      item.airdate !== '' &&
      !/^\d{4}-\d{2}-\d{2}$/u.test(item.airdate)
    ) {
      increment(invalidFields, 'episode.airdate');
      delete normalizedItem.airdate;
    }

    return normalizedItem as unknown as Episode;
  });

  return {
    total: optionalInteger('total', 0),
    limit: optionalInteger('limit', 1),
    offset: optionalInteger('offset', 0),
    data,
    missingFields,
    truncatedFields,
    invalidFields,
  };
}

function parseSubjectPayload(raw: unknown): { subject: DomainSubject; missingFields: string[] } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw parserError('subject', '对象');
  }
  const value = raw as Record<string, unknown>;
  if (!positiveInteger(value.id)) throw parserError('subject.id', '正整数');
  if (!Number.isInteger(value.type)) throw parserError('subject.type', '整数');
  for (const field of ['name', 'name_cn', 'date', 'platform']) {
    if (value[field] !== undefined && value[field] !== null && typeof value[field] !== 'string') {
      throw parserError(`subject.${field}`, '字符串');
    }
  }
  const missingFields = ['name', 'name_cn', 'type'].filter(
    (field) => value[field] === undefined || value[field] === null || value[field] === '',
  );
  return { subject: mapSubject(value as unknown as Subject), missingFields };
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

function mapOpenApiEpisode(item: Episode, subjectId: number): GuideEpisodeSource {
  const raw = item as unknown as Record<string, unknown>;
  return {
    id: item.id,
    subjectId,
    type: finiteNumber(raw.type) ? raw.type : undefined,
    name: typeof raw.name === 'string' && raw.name ? raw.name : undefined,
    nameCn: typeof raw.name_cn === 'string' && raw.name_cn ? raw.name_cn : undefined,
    sort: finiteNumber(raw.sort) ? raw.sort : undefined,
    ep: finiteNumber(raw.ep) ? raw.ep : undefined,
    airdate: typeof raw.airdate === 'string' && raw.airdate ? raw.airdate : undefined,
    comment: finiteNumber(raw.comment) ? raw.comment : undefined,
    duration: typeof raw.duration === 'string' && raw.duration ? raw.duration : undefined,
    desc: typeof raw.desc === 'string' && raw.desc ? raw.desc : undefined,
  };
}

function mapTypedEpisode(item: DomainEpisode, subjectId: number): GuideEpisodeSource {
  return {
    id: item.id,
    subjectId,
    type: item.rawType,
    name: item.name || undefined,
    nameCn: item.nameCn || undefined,
    sort: finiteNumber(item.sort) ? item.sort : undefined,
    ep: finiteNumber(item.ep) ? item.ep : undefined,
    airdate: item.airdate,
    comment: item.comment,
    duration: item.duration,
    desc: item.desc,
  };
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
  private subjectService: SubjectService;
  private episodeService: EpisodeService;

  constructor(client: GeneratedBangumiOpenApiClient | HttpClient) {
    if (!(client instanceof GeneratedBangumiOpenApiClient)) {
      this.transport = client;
    }
    this.subjectService = new SubjectService(client);
    this.episodeService = new EpisodeService(client);
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
        const parsed = parseSubjectPayload(raw);
        const missingFields: Record<string, number> = {};
        for (const field of parsed.missingFields) increment(missingFields, `subject.${field}`);
        return {
          state: 'complete',
          subject: parsed.subject,
          missingFields,
          attemptedAt,
          retrievedAt: new Date().toISOString(),
        };
      }
      const subject = await this.subjectService.getSubjectById(subjectId);
      return {
        state: 'complete',
        subject,
        missingFields: {},
        attemptedAt,
        retrievedAt: new Date().toISOString(),
      };
    } catch (err) {
      const error = toPublicError(err);
      return {
        state: error.code === 'NOT_FOUND' ? 'not_found' : 'unavailable',
        missingFields: {},
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
          page: parseEpisodePage(raw),
          attemptedAt,
          retrievedAt: new Date().toISOString(),
        };
      }
      const page = await this.episodeService.getEpisodes(subjectId, {
        type: type as 0 | 1 | 2 | 3 | 4 | 5 | 6 | undefined,
        limit: maxEpisodes,
        offset: 0,
      });
      return {
        state: 'complete',
        page: {
          total: page.total,
          limit: page.limit,
          offset: page.offset,
          data: page.items.map((item) => ({
            id: item.id,
            type: item.rawType,
            name: item.name,
            name_cn: item.nameCn,
            sort: item.sort,
            ep: item.ep,
            airdate: item.airdate,
            comment: item.comment,
            duration: item.duration,
            desc: item.desc,
          })) as unknown as Episode[],
          missingFields: {},
          truncatedFields: {},
          invalidFields: {},
        },
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
    const sourcePage = episodeAttempt.page;
    const rawRows = sourcePage?.data || [];
    const observedRows = rawRows.length;
    const uniqueSources = new Map<number, GuideEpisodeSource>();
    let duplicateRows = 0;
    for (const raw of rawRows) {
      const source = this.transport
        ? mapOpenApiEpisode(raw, subjectId)
        : mapTypedEpisode(raw as unknown as DomainEpisode, subjectId);
      if (uniqueSources.has(source.id)) {
        duplicateRows += 1;
        continue;
      }
      uniqueSources.set(source.id, source);
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
    }
    const items = sortEpisodes(
      Array.from(uniqueSources.values()).map((item) =>
        mapGuideItem(item, subjectId, includeDescriptions, truncatedFields),
      ),
    );
    if (!includeDescriptions) {
      delete missingFields['episode.description'];
      delete truncatedFields['episode.description'];
    }
    if (sourcePage && sourcePage.total === undefined) increment(missingFields, 'page.total');
    const sourceTotal = sourcePage?.total;
    const totalKind = sourceTotal === undefined ? 'unknown' : 'exact';
    const inconsistentTotal = sourceTotal !== undefined && sourceTotal < observedRows;
    const truncated =
      (sourceTotal !== undefined && sourceTotal > observedRows) ||
      Boolean(sourcePage && sourcePage.offset && sourcePage.offset > 0);
    const qualityDegraded =
      truncated ||
      duplicateRows > 0 ||
      inconsistentTotal ||
      Object.keys(missingFields).length > 0 ||
      Object.keys(truncatedFields).length > 0 ||
      Object.keys(invalidFields).length > 0 ||
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
          'SUBJECT_IDENTITY_UNAVAILABLE',
          state,
          subjectAttempt.state === 'not_found'
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
          `官方章节报告 ${sourceTotal ?? '未知'} 条，本次观察 ${observedRows} 条且最多返回 ${maxEpisodes} 条；未读取部分不代表不存在。`,
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
    if (inconsistentTotal) {
      warnings.push(
        warning(
          'SOURCE_INCONSISTENT',
          'partial',
          '官方 total 小于本次观察条数，覆盖状态按 partial 处理。',
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
        missingFields,
        truncatedFields,
        invalidFields,
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
      },
      evidence: [
        {
          source: 'official_v0',
          operations,
          ...(retrievedAt ? { retrievedAt } : {}),
          attemptedAt,
        },
        {
          source: 'derived',
          operations: ['episode-guide-composition'],
          ...(retrievedAt ? { retrievedAt } : {}),
          formulaVersion: EPISODE_GUIDE_FORMULA_VERSION,
          description:
            '保留官方章节字段；按分类、ep/sort、ID 确定性排序；重复 ID 只保留首次观察；所有省略、缺失和字段裁剪都进入 coverage。',
        },
      ],
      limitations: limitations(),
      warnings,
      ...(error ? { error } : {}),
    };
  }
}
