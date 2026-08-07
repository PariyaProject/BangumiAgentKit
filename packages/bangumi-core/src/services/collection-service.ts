import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
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
  constructor(private client: HttpClient) {}

  async updateCollection(
    input: UpdateCollectionInput,
    accessToken: string
  ): Promise<UserCollectionItem> {
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

    const raw = await this.client.request<any>({
      method: 'POST',
      path: `/v0/users/-/collections/${input.subjectId}`,
      accessToken,
      body,
    });

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
    type: number = 2, // 2 = watched/看过
    accessToken: string
  ): Promise<{ updatedEpisodes: number[]; count: number }> {
    await this.client.request<any>({
      method: 'PATCH',
      path: `/v0/users/-/collections/${subjectId}/episodes`,
      accessToken,
      body: {
        episode_id: episodeIds,
        type,
      },
    });

    return {
      updatedEpisodes: episodeIds,
      count: episodeIds.length,
    };
  }

  async collectCharacter(characterId: number, accessToken: string): Promise<void> {
    await this.client.request<any>({
      method: 'POST',
      path: `/v0/users/-/collections/characters/${characterId}`,
      accessToken,
    });
  }

  async uncollectCharacter(characterId: number, accessToken: string): Promise<void> {
    await this.client.request<any>({
      method: 'DELETE',
      path: `/v0/users/-/collections/characters/${characterId}`,
      accessToken,
    });
  }

  async collectPerson(personId: number, accessToken: string): Promise<void> {
    await this.client.request<any>({
      method: 'POST',
      path: `/v0/users/-/collections/persons/${personId}`,
      accessToken,
    });
  }

  async uncollectPerson(personId: number, accessToken: string): Promise<void> {
    await this.client.request<any>({
      method: 'DELETE',
      path: `/v0/users/-/collections/persons/${personId}`,
      accessToken,
    });
  }
}
