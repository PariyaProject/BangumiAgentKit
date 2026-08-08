import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { GeneratedBangumiOpenApiClient } from '@bangumi-agent-kit/bangumi-openapi';
import { UserCollectionItem } from '../models/user.js';

export type CollectionStatus = 'wish' | 'doing' | 'done' | 'on_hold' | 'dropped' | 'unknown';

export function mapCollectionStatus(statusType: number | string): CollectionStatus {
  if (typeof statusType === 'string') {
    if (['wish', 'doing', 'done', 'on_hold', 'dropped'].includes(statusType)) {
      return statusType as CollectionStatus;
    }
  }
  const num = Number(statusType);
  switch (num) {
    case 1:
      return 'wish';
    case 2:
      return 'done';
    case 3:
      return 'doing';
    case 4:
      return 'on_hold';
    case 5:
      return 'dropped';
    default:
      return 'unknown';
  }
}

export function getCollectionStatusLabel(
  subjectType: string,
  status: CollectionStatus | string,
  _locale = 'zh-CN',
): string {
  const normType = subjectType.toLowerCase();
  switch (status) {
    case 'wish':
      if (normType === 'book') return '想读';
      if (normType === 'music') return '想听';
      if (normType === 'game') return '想玩';
      return '想看';
    case 'doing':
      if (normType === 'book') return '在读';
      if (normType === 'music') return '在听';
      if (normType === 'game') return '在玩';
      return '在看';
    case 'done':
      if (normType === 'book') return '读过';
      if (normType === 'music') return '听过';
      if (normType === 'game') return '玩过';
      return '看过';
    case 'on_hold':
      return '搁置';
    case 'dropped':
      return '抛弃';
    default:
      return '未知';
  }
}

export interface UpdateCollectionInput {
  subjectId: number;
  status?: 'wish' | 'doing' | 'done' | 'on_hold' | 'dropped';
  rating?: number;
  tags?: string[];
  comment?: string;
  private?: boolean;
}

export function mapStatusToTypeNum(status?: string): number | undefined {
  switch (status) {
    case 'wish':
      return 1;
    case 'done':
      return 2;
    case 'doing':
      return 3;
    case 'on_hold':
      return 4;
    case 'dropped':
      return 5;
    default:
      return undefined;
  }
}

export class CollectionService {
  private api: GeneratedBangumiOpenApiClient;

  constructor(client: GeneratedBangumiOpenApiClient | HttpClient) {
    if (client instanceof GeneratedBangumiOpenApiClient) {
      this.api = client;
    } else {
      this.api = new GeneratedBangumiOpenApiClient(client);
    }
  }

  async updateCollection(
    input: UpdateCollectionInput,
  ): Promise<UserCollectionItem & { statusLabel: string }> {
    const body: Record<string, unknown> = {};
    if (input.status) {
      body.type = mapStatusToTypeNum(input.status);
    }
    if (input.rating !== undefined) {
      body.rate = input.rating;
    }
    if (input.tags) {
      body.tags = input.tags;
    }
    if (input.comment !== undefined) {
      body.comment = input.comment;
    }
    if (input.private !== undefined) {
      body.private = input.private;
    }

    const raw = await this.api.postUserCollection(input.subjectId, body as any);
    const status = input.status || mapCollectionStatus(raw.type || 3);
    const statusLabel = getCollectionStatusLabel('anime', status);

    return {
      subjectId: input.subjectId,
      status,
      statusLabel,
      rating: raw.rate ?? input.rating,
      comment: raw.comment ?? input.comment,
      tags: raw.tags ?? input.tags,
      epStatus: raw.ep_status,
      updatedAt: raw.updated_at || new Date().toISOString(),
    };
  }

  async updateEpisodeProgress(
    subjectId: number,
    episodeIds: number[],
    type: number = 2,
  ): Promise<{ updatedEpisodes: number[]; count: number }> {
    await this.api.patchUserSubjectEpisodeCollection(subjectId, {
      episode_id: episodeIds,
      type,
    } as any);

    return {
      updatedEpisodes: episodeIds,
      count: episodeIds.length,
    };
  }

  async collectCharacter(characterId: number): Promise<void> {
    await this.api.collectCharacterByCharacterIdAndUserId(characterId);
  }

  async uncollectCharacter(characterId: number): Promise<void> {
    await this.api.uncollectCharacterByCharacterIdAndUserId(characterId);
  }

  async collectPerson(personId: number): Promise<void> {
    await this.api.collectPersonByPersonIdAndUserId(personId);
  }

  async uncollectPerson(personId: number): Promise<void> {
    await this.api.uncollectPersonByPersonIdAndUserId(personId);
  }
}
