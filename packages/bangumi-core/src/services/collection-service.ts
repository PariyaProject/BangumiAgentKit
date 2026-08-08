import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { GeneratedBangumiOpenApiClient, OperationBody } from '@bangumi-agent-kit/bangumi-openapi';
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
      if (normType === 'other') return '想收藏';
      return '想看';
    case 'doing':
      if (normType === 'book') return '在读';
      if (normType === 'music') return '在听';
      if (normType === 'game') return '在玩';
      if (normType === 'other') return '进行中';
      return '在看';
    case 'done':
      if (normType === 'book') return '读过';
      if (normType === 'music') return '听过';
      if (normType === 'game') return '玩过';
      if (normType === 'other') return '已完成';
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

export function mapStatusToTypeNum(status?: string): 1 | 2 | 3 | 4 | 5 | undefined {
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

export interface UpdateCollectionSuccessResult {
  success: true;
  collection: UserCollectionItem & { statusLabel: string };
}

export interface UpdateCollectionRefreshFailedResult {
  success: true;
  status: 'updated_but_refresh_failed';
  applied: UpdateCollectionInput;
  warning: string;
}

export type UpdateCollectionResult =
  UpdateCollectionSuccessResult | UpdateCollectionRefreshFailedResult;

export class CollectionService {
  private api: GeneratedBangumiOpenApiClient;
  private client: GeneratedBangumiOpenApiClient | HttpClient;

  constructor(client: GeneratedBangumiOpenApiClient | HttpClient) {
    this.client = client;
    if (client instanceof GeneratedBangumiOpenApiClient) {
      this.api = client;
    } else {
      this.api = new GeneratedBangumiOpenApiClient(client);
    }
  }

  async updateCollection(
    input: UpdateCollectionInput,
    username?: string,
    userServiceFetch?: (
      username: string,
      subjectId: number,
    ) => Promise<{
      found: boolean;
      collection?: UserCollectionItem & { statusLabel: string };
    }>,
  ): Promise<UpdateCollectionResult> {
    const body: OperationBody<'postUserCollection'> = {};
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

    // POST returns 204 No Content on success
    await this.api.postUserCollection(input.subjectId, body);

    if (username && userServiceFetch) {
      try {
        const canonical = await userServiceFetch(username, input.subjectId);
        if (canonical.found && canonical.collection) {
          return {
            success: true,
            collection: canonical.collection,
          };
        }
      } catch {
        // Refresh GET failed after POST 204 succeeded
      }
    }

    return {
      success: true,
      status: 'updated_but_refresh_failed',
      applied: input,
      warning: 'Collection updated on server, but failed to fetch canonical collection state.',
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
    } as OperationBody<'patchUserSubjectEpisodeCollection'>);

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
