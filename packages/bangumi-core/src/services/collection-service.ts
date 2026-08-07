import { GeneratedBangumiOpenApiClient } from '@bangumi-agent-kit/bangumi-openapi';
import { UserCollectionItem } from '../models/user.js';

export interface UpdateCollectionInput {
  subjectId: number;
  status?: 'wish' | 'doing' | 'done' | 'on_hold' | 'dropped';
  rating?: number;
  tags?: string[];
  comment?: string;
  private?: boolean;
}

function mapStatusToTypeNum(status?: string): number | undefined {
  switch (status) {
    case 'wish': return 1;
    case 'done': return 2;
    case 'doing': return 3;
    case 'on_hold': return 4;
    case 'dropped': return 5;
    default: return undefined;
  }
}

export class CollectionService {
  constructor(private client: GeneratedBangumiOpenApiClient) {}

  async updateCollection(input: UpdateCollectionInput): Promise<UserCollectionItem> {
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

    const raw = await this.client.postUserCollection(input.subjectId, body as any);

    return {
      subjectId: input.subjectId,
      status: input.status || 'doing',
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
    type: number = 2
  ): Promise<{ updatedEpisodes: number[]; count: number }> {
    await this.client.patchUserSubjectEpisodeCollection(subjectId, {
      episode_id: episodeIds,
      type,
    } as any);

    return {
      updatedEpisodes: episodeIds,
      count: episodeIds.length,
    };
  }

  async collectCharacter(characterId: number): Promise<void> {
    await this.client.collectCharacterByCharacterIdAndUserId(characterId);
  }

  async uncollectCharacter(characterId: number): Promise<void> {
    await this.client.uncollectCharacterByCharacterIdAndUserId(characterId);
  }

  async collectPerson(personId: number): Promise<void> {
    await this.client.collectPersonByPersonIdAndUserId(personId);
  }

  async uncollectPerson(personId: number): Promise<void> {
    await this.client.uncollectPersonByPersonIdAndUserId(personId);
  }
}
