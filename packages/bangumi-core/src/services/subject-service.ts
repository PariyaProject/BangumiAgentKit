import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { GeneratedBangumiOpenApiClient, Subject } from '@bangumi-agent-kit/bangumi-openapi';
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

export function mapSubject(raw: Subject | any): DomainSubject {
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
    images: raw.images,
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

export function mapSubjectCandidate(raw: Subject | any): SubjectCandidate {
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
    if (options.nsfw === 'include' || options.nsfw === 'only') {
      nsfwFilter = true;
    } else if (options.nsfw === 'exclude') {
      nsfwFilter = false;
    }

    const filter: any = {};
    if (options.type) {
      filter.type = [options.type];
    }
    if (nsfwFilter !== undefined) {
      filter.nsfw = nsfwFilter;
    }
    if (options.tags && options.tags.length > 0) {
      filter.tag = options.tags;
    }
    if (options.metaTags && options.metaTags.length > 0) {
      filter.meta_tag = options.metaTags;
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

  async getSubjectById(subjectId: number): Promise<DomainSubject> {
    const raw = await this.api.getSubjectById(subjectId);
    return mapSubject(raw);
  }

  async getSubjectRelations(subjectId: number): Promise<SubjectRelationItem[]> {
    const raw = await this.api.getRelatedSubjectsBySubjectId(subjectId);
    return (raw || []).map((item: any) => ({
      id: item.id,
      type: mapSubjectType(item.type),
      name: item.name || '',
      nameCn: item.name_cn || item.name || '',
      relation: item.relation || '关联条目',
      images: item.images,
    }));
  }
}
