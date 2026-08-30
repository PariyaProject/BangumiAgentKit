import { BangumiError, HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import {
  GeneratedBangumiOpenApiClient,
  Subject,
  OperationBody,
} from '@bangumi-agent-kit/bangumi-openapi';
import {
  DomainSubject,
  SubjectSearchResult,
  SubjectRelationItem,
  SubjectType,
} from '../models/subject.js';
import { SubjectCandidate } from '../results/result.js';

export function mapSubjectType(typeNum?: number): SubjectType {
  switch (typeNum) {
    case 1:
      return 'book';
    case 2:
      return 'anime';
    case 3:
      return 'music';
    case 4:
      return 'game';
    case 6:
      return 'real';
    default:
      return 'other';
  }
}

export function mapSubject(raw: Subject): DomainSubject {
  const ratingCount: Record<string, number> | undefined = raw.rating?.count
    ? (raw.rating.count as Record<string, number>)
    : undefined;

  return {
    id: raw.id,
    type: mapSubjectType(raw.type),
    name: raw.name || '',
    nameCn: raw.name_cn || raw.name || '',
    summary: raw.summary || '',
    nsfw: Boolean(raw.nsfw),
    locked: Boolean(raw.locked),
    date: raw.date || undefined,
    platform: raw.platform || undefined,
    metaTags: Array.isArray(raw.meta_tags) ? [...raw.meta_tags] : undefined,
    images: raw.images ? (raw.images as Record<string, string>) : undefined,
    score:
      raw.rating?.score !== undefined && raw.rating?.score !== 0 ? raw.rating.score : undefined,
    rank: raw.rating?.rank !== undefined && raw.rating?.rank !== 0 ? raw.rating.rank : undefined,
    ratingTotal: raw.rating?.total ?? undefined,
    ratingCount,
    collectionCounts: raw.collection
      ? {
          wish: raw.collection.wish || 0,
          collect: raw.collection.collect || 0,
          doing: raw.collection.doing || 0,
          onHold: raw.collection.on_hold || 0,
          dropped: raw.collection.dropped || 0,
        }
      : undefined,
    eps: raw.eps ?? undefined,
    totalEpisodes: raw.total_episodes ?? undefined,
  };
}

export function mapSubjectCandidate(raw: Subject): SubjectCandidate {
  const image =
    raw.images?.medium ||
    raw.images?.common ||
    raw.images?.small ||
    raw.images?.grid ||
    raw.images?.large;
  return {
    id: raw.id,
    name: raw.name || '',
    nameCn: raw.name_cn || raw.name || '',
    type: mapSubjectType(raw.type),
    date: raw.date || undefined,
    image,
    score:
      raw.rating?.score !== undefined && raw.rating?.score !== 0 ? raw.rating.score : undefined,
    rank: raw.rating?.rank !== undefined && raw.rating?.rank !== 0 ? raw.rating.rank : undefined,
    nsfw: Boolean(raw.nsfw),
  };
}

export interface SubjectRequestOptions {
  maxResponseBytes?: number;
  strict?: boolean;
}

export interface SubjectRelationsCoverage {
  observed: number;
  returned: number;
  truncated: boolean;
  schemaDriftRows: number;
}

export interface SubjectRelationsResult {
  items: SubjectRelationItem[];
  coverage: SubjectRelationsCoverage;
}

function positiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function imageMap(value: unknown): value is Record<string, string> {
  return (
    value === undefined ||
    value === null ||
    (typeof value === 'object' &&
      !Array.isArray(value) &&
      Object.values(value as Record<string, unknown>).every((item) => typeof item === 'string'))
  );
}

function validSubjectIdentity(value: unknown): value is Subject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return (
    positiveInteger(row.id) &&
    typeof row.type === 'number' &&
    Number.isInteger(row.type) &&
    [1, 2, 3, 4, 6].includes(row.type) &&
    typeof row.name === 'string' &&
    row.name.trim().length > 0 &&
    typeof row.name_cn === 'string' &&
    typeof row.summary === 'string' &&
    typeof row.nsfw === 'boolean' &&
    typeof row.locked === 'boolean' &&
    typeof row.platform === 'string' &&
    imageMap(row.images)
  );
}

function validSubjectRelation(value: unknown): value is {
  id: number;
  type: number;
  name: string;
  name_cn: string;
  images?: Record<string, string>;
  relation: string;
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return (
    positiveInteger(row.id) &&
    typeof row.type === 'number' &&
    Number.isInteger(row.type) &&
    typeof row.name === 'string' &&
    typeof row.name_cn === 'string' &&
    typeof row.relation === 'string' &&
    imageMap(row.images)
  );
}

export interface SearchSubjectsOptions {
  limit?: number;
  offset?: number;
  type?: number;
  sort?: 'match' | 'heat' | 'rank' | 'score';
  nsfw?: 'exclude' | 'include' | 'only';
  tags?: string[];
  metaTags?: string[];
}

export class SubjectService {
  private api: GeneratedBangumiOpenApiClient;

  constructor(client: GeneratedBangumiOpenApiClient | HttpClient) {
    if (client instanceof GeneratedBangumiOpenApiClient) {
      this.api = client;
    } else {
      this.api = new GeneratedBangumiOpenApiClient(client);
    }
  }

  async searchSubjects(
    keyword: string,
    options: SearchSubjectsOptions = {},
  ): Promise<SubjectSearchResult> {
    const limit = options.limit ?? 10;
    const offset = options.offset ?? 0;

    let nsfwFilter: boolean | undefined;
    if (options.nsfw === 'only') {
      nsfwFilter = true;
    } else if (options.nsfw === 'exclude') {
      nsfwFilter = false;
    } else {
      // 'include' or undefined -> do not filter nsfw (returns all)
      nsfwFilter = undefined;
    }

    const filter: NonNullable<OperationBody<'searchSubjects'>['filter']> = {};
    if (options.type) {
      filter.type = [options.type as 1 | 2 | 3 | 4 | 6];
    }
    if (nsfwFilter !== undefined) {
      filter.nsfw = nsfwFilter;
    }
    if (options.tags && options.tags.length > 0) {
      filter.tag = options.tags;
    }
    if (options.metaTags && options.metaTags.length > 0) {
      filter.meta_tags = options.metaTags;
    }

    const res = await this.api.searchSubjects(
      { limit, offset },
      {
        keyword,
        sort: options.sort,
        filter: Object.keys(filter).length > 0 ? filter : undefined,
      },
    );

    const data = res.data || [];
    return {
      total: res.total || 0,
      limit: res.limit || limit,
      offset: res.offset || offset,
      items: data.map(mapSubject),
    };
  }

  async getSubjectById(
    subjectId: number,
    options: SubjectRequestOptions = {},
  ): Promise<DomainSubject> {
    const raw = await this.api.getSubjectById(subjectId, {
      ...(options.maxResponseBytes === undefined
        ? {}
        : { maxResponseBytes: options.maxResponseBytes }),
    });
    if (options.strict && !validSubjectIdentity(raw)) {
      throw new BangumiError(
        'PARSER_ERROR',
        `SCHEMA_DRIFT: subject ${subjectId} is missing required identity fields.`,
        false,
      );
    }
    return mapSubject(raw);
  }

  async getSubjectRelations(
    subjectId: number,
    options: { limit?: number; maxResponseBytes?: number } = {},
  ): Promise<SubjectRelationItem[]> {
    const result = await this.getSubjectRelationsWithCoverage(subjectId, options);
    return result.items;
  }

  async getSubjectRelationsWithCoverage(
    subjectId: number,
    options: { limit?: number; maxResponseBytes?: number } = {},
  ): Promise<SubjectRelationsResult> {
    const raw = await this.api.getRelatedSubjectsBySubjectId(subjectId, {
      ...(options.maxResponseBytes === undefined
        ? {}
        : { maxResponseBytes: options.maxResponseBytes }),
    });
    const rawRows = Array.isArray(raw) ? raw : [];
    const validRows = rawRows.filter(validSubjectRelation);
    const schemaDriftRows = rawRows.length - validRows.length;
    const limit = Math.max(0, Math.floor(options.limit ?? Number.MAX_SAFE_INTEGER));
    const selectedRows = validRows.slice(0, limit);
    const items = selectedRows.map((item) => ({
      id: item.id,
      type: mapSubjectType(item.type),
      name: item.name,
      nameCn: item.name_cn,
      relation: item.relation,
      ...(item.images === undefined || item.images === null ? {} : { images: item.images }),
    }));
    return {
      items,
      coverage: {
        observed: rawRows.length,
        returned: items.length,
        truncated: validRows.length > selectedRows.length || schemaDriftRows > 0,
        schemaDriftRows,
      },
    };
  }
}
