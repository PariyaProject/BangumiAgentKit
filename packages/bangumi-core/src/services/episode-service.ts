import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { GeneratedBangumiOpenApiClient, Episode } from '@bangumi-agent-kit/bangumi-openapi';
import { DomainEpisode, DomainEpisodeCategory } from '../models/episode.js';

export function mapEpisodeCategory(typeNum: number): DomainEpisodeCategory {
  switch (typeNum) {
    case 0:
      return 'main';
    case 1:
      return 'sp';
    case 2:
      return 'op';
    case 3:
      return 'ed';
    default:
      return 'other';
  }
}

export function mapEpisode(raw: Episode | any, subjectId?: number): DomainEpisode {
  return {
    id: raw.id,
    subjectId: subjectId ?? raw.subject_id,
    category: mapEpisodeCategory(raw.type ?? 0),
    rawType: raw.type ?? 0,
    name: raw.name || '',
    nameCn: raw.name_cn || raw.name || '',
    sort: raw.sort || 0,
    ep: raw.ep ?? raw.sort,
    airdate: raw.airdate || undefined,
    comment: raw.comment ?? undefined,
    duration: raw.duration || undefined,
    desc: raw.desc || undefined,
    disc: raw.disc ?? undefined,
  };
}

export class EpisodeService {
  private api: GeneratedBangumiOpenApiClient;

  constructor(client: GeneratedBangumiOpenApiClient | HttpClient) {
    if (client instanceof GeneratedBangumiOpenApiClient) {
      this.api = client;
    } else {
      this.api = new GeneratedBangumiOpenApiClient(client);
    }
  }

  async getEpisodes(
    subjectId: number,
    options: { type?: number; limit?: number; offset?: number } = {},
  ): Promise<{ total: number; limit: number; offset: number; items: DomainEpisode[] }> {
    const limit = options.limit ?? 100;
    const offset = options.offset ?? 0;

    const res = await this.api.getEpisodes({
      subject_id: subjectId,
      type: options.type as any,
      limit,
      offset,
    });

    const data = res.data || [];
    return {
      total: res.total || 0,
      limit: res.limit || limit,
      offset: res.offset || offset,
      items: data.map((item) => mapEpisode(item, subjectId)),
    };
  }

  async getEpisodeById(episodeId: number): Promise<DomainEpisode> {
    const raw = await this.api.getEpisodeById(episodeId);
    return mapEpisode(raw);
  }

  /**
   * Fetch all episodes for a subject with automatic pagination (limit 100 per page, hard cap 5000).
   */
  async getAllEpisodesForSubject(subjectId: number): Promise<DomainEpisode[]> {
    const allEpisodes: DomainEpisode[] = [];
    const pageSize = 100;
    const hardCap = 5000;
    let offset = 0;

    while (allEpisodes.length < hardCap) {
      const res = await this.getEpisodes(subjectId, { limit: pageSize, offset });
      if (!res.items || res.items.length === 0) {
        break;
      }
      allEpisodes.push(...res.items);
      if (res.items.length < pageSize || allEpisodes.length >= (res.total || 0)) {
        break;
      }
      offset += pageSize;
    }

    return allEpisodes;
  }

  /**
   * Helper method to filter main (or specified category) episodes up to target episode number.
   * Prioritizes ep field over sort.
   */
  filterMainEpisodesUpTo(
    episodes: DomainEpisode[],
    targetEp: number,
    category: DomainEpisodeCategory = 'main',
  ): DomainEpisode[] {
    return episodes
      .filter((ep) => {
        if (ep.category !== category) return false;
        const epNum = ep.ep !== undefined && ep.ep !== 0 ? ep.ep : ep.sort;
        return epNum <= targetEp;
      })
      .sort((a, b) => {
        const aNum = a.ep !== undefined && a.ep !== 0 ? a.ep : a.sort;
        const bNum = b.ep !== undefined && b.ep !== 0 ? b.ep : b.sort;
        return aNum - bNum;
      });
  }

  /**
   * Resolve "through episode N" progress targets into concrete episode IDs with validation warnings.
   */
  async resolveThroughEpisodes(
    subjectId: number,
    targetEpisodeNumber: number,
    category: DomainEpisodeCategory = 'main',
  ): Promise<{
    episodes: DomainEpisode[];
    resolvedEpisodeIds: number[];
    resolvedEpisodeNumbers: number[];
    count: number;
    warning?: string;
  }> {
    const allEpisodes = await this.getAllEpisodesForSubject(subjectId);
    const filtered = this.filterMainEpisodesUpTo(allEpisodes, targetEpisodeNumber, category);

    const hasExactTarget = filtered.some((ep) => {
      const epNum = ep.ep !== undefined && ep.ep !== 0 ? ep.ep : ep.sort;
      return epNum === targetEpisodeNumber;
    });

    let warning: string | undefined;
    if (!hasExactTarget) {
      const latestMatching = filtered[filtered.length - 1];
      const latestNum = latestMatching
        ? latestMatching.ep !== undefined && latestMatching.ep !== 0
          ? latestMatching.ep
          : latestMatching.sort
        : 0;
      warning = `target episode ${targetEpisodeNumber} was not found; updated through latest matching episode ${latestNum}`;
    }

    const resolvedEpisodeIds = filtered.map((e) => e.id);
    const resolvedEpisodeNumbers = filtered.map((e) =>
      e.ep !== undefined && e.ep !== 0 ? e.ep : e.sort,
    );

    return {
      episodes: filtered,
      resolvedEpisodeIds,
      resolvedEpisodeNumbers,
      count: filtered.length,
      warning,
    };
  }
}
