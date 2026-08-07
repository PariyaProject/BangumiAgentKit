import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { DomainEpisode, DomainEpisodeCategory } from '../models/episode.js';

function mapEpisodeCategory(typeNum: number): DomainEpisodeCategory {
  switch (typeNum) {
    case 0: return 'main';
    case 1: return 'sp';
    case 2: return 'op';
    case 3: return 'ed';
    default: return 'other';
  }
}

function mapEpisode(raw: any, subjectId?: number): DomainEpisode {
  return {
    id: raw.id,
    subjectId,
    category: mapEpisodeCategory(raw.type ?? 0),
    rawType: raw.type ?? 0,
    name: raw.name || '',
    nameCn: raw.name_cn || raw.name || '',
    sort: raw.sort || 0,
    ep: raw.ep ?? raw.sort,
    airdate: raw.airdate,
    comment: raw.comment,
    duration: raw.duration,
    desc: raw.desc,
    disc: raw.disc,
  };
}

export class EpisodeService {
  constructor(private client: HttpClient) {}

  async getEpisodes(subjectId: number, options: { type?: number; limit?: number; offset?: number } = {}): Promise<DomainEpisode[]> {
    const query: Record<string, unknown> = {
      subject_id: subjectId,
      limit: options.limit ?? 100,
      offset: options.offset ?? 0,
    };
    if (options.type !== undefined) {
      query.type = options.type;
    }

    const raw = await this.client.request<any>({
      method: 'GET',
      path: '/v0/episodes',
      query,
      cacheContext: {
        operationId: 'getEpisodes',
        pathParams: { subjectId },
        queryParams: query,
      },
      cacheTtlSeconds: 300,
    });

    const items = raw.data || raw || [];
    return (Array.isArray(items) ? items : []).map((item) => mapEpisode(item, subjectId));
  }

  async getEpisodeById(episodeId: number): Promise<DomainEpisode> {
    const raw = await this.client.request<any>({
      method: 'GET',
      path: `/v0/episodes/${episodeId}`,
      cacheContext: {
        operationId: 'getEpisodeById',
        pathParams: { episodeId },
      },
      cacheTtlSeconds: 300,
    });

    return mapEpisode(raw);
  }

  /**
   * Helper method to filter main正篇 episodes up to specified episode number
   */
  filterMainEpisodesUpTo(episodes: DomainEpisode[], targetEp: number): DomainEpisode[] {
    return episodes
      .filter((ep) => ep.category === 'main' && (ep.sort <= targetEp || (ep.ep !== undefined && ep.ep <= targetEp)))
      .sort((a, b) => a.sort - b.sort);
  }
}
