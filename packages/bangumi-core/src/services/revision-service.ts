import { BangumiError, HttpClient, toPublicError } from '@bangumi-agent-kit/bangumi-transport';
import { GeneratedBangumiOpenApiClient, Revision } from '@bangumi-agent-kit/bangumi-openapi';
import { DomainRevision } from '../models/revision.js';

export function mapRevision(raw: Revision): DomainRevision {
  return {
    id: raw.id,
    type: raw.type,
    summary: raw.summary || '',
    createdAt: raw.created_at || '',
    creator:
      raw.creator &&
      (typeof raw.creator.username === 'string' || typeof raw.creator.nickname === 'string')
        ? {
            ...(typeof raw.creator.username === 'string' ? { username: raw.creator.username } : {}),
            ...(typeof raw.creator.nickname === 'string' ? { nickname: raw.creator.nickname } : {}),
          }
        : undefined,
    data: (raw as unknown as { data?: unknown }).data,
  };
}

export type RevisionEntityType = 'subject' | 'episode' | 'character' | 'person';

export interface RevisionIntelligenceOptions {
  limit?: number;
  offset?: number;
}

export interface RevisionIntelligenceItem {
  id: number;
  type: number;
  summary?: string;
  createdAt?: string;
  creator?: {
    username?: string;
    nickname?: string;
  };
}

export interface RevisionIntelligenceResult {
  state: 'complete' | 'partial' | 'unavailable';
  entityType: RevisionEntityType;
  entityId: number;
  items: RevisionIntelligenceItem[];
  coverage: {
    state: 'complete' | 'partial' | 'unavailable';
    observed: number;
    returned: number;
    total: number;
    totalKind: 'exact' | 'estimated';
    limit: number;
    offset: number;
    truncated: boolean;
    missingFields: Record<string, number>;
  };
  capabilityStates: {
    historical_growth: 'not_computable';
  };
  source: {
    class: 'official-v0';
    operation: string;
    retrievedAt?: string;
    attemptedAt?: string;
  };
  evidence: Array<{
    source: 'official-v0';
    operation: string;
    retrievedAt?: string;
    attemptedAt?: string;
  }>;
  limitations: string[];
  warnings: Array<{
    code: string;
    state: 'partial' | 'unavailable';
    message: string;
  }>;
  error?: ReturnType<typeof toPublicError>;
}

interface RevisionPagePayload {
  total?: number;
  limit?: number;
  offset?: number;
  data: Revision[];
}

const REVISION_DEFAULT_LIMIT = 10;
const REVISION_MAX_LIMIT = 20;
const REVISION_MAX_OFFSET = 1_000_000;

const REVISION_LIST_ROUTE: Record<RevisionEntityType, { path: string; idKey: string }> = {
  subject: { path: '/v0/revisions/subjects', idKey: 'subject_id' },
  episode: { path: '/v0/revisions/episodes', idKey: 'episode_id' },
  character: { path: '/v0/revisions/characters', idKey: 'character_id' },
  person: { path: '/v0/revisions/persons', idKey: 'person_id' },
};

function boundedRevisionLimit(value: number | undefined): number {
  if (!Number.isFinite(value)) return REVISION_DEFAULT_LIMIT;
  return Math.min(REVISION_MAX_LIMIT, Math.max(1, Math.trunc(value as number)));
}

function boundedRevisionOffset(value: number | undefined): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(REVISION_MAX_OFFSET, Math.max(0, Math.trunc(value as number)));
}

function revisionSchemaError(path: string, expected: string): BangumiError {
  return new BangumiError('PARSER_ERROR', `revision.${path} 应为 ${expected}`, false);
}

function parseRevisionPage(raw: unknown): RevisionPagePayload {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw revisionSchemaError('payload', '对象');
  }
  const value = raw as Record<string, unknown>;
  const data = value.data;
  if (!Array.isArray(data)) {
    throw revisionSchemaError('data', '数组');
  }
  if (data.length > REVISION_MAX_LIMIT) {
    throw revisionSchemaError('data', `最多 ${REVISION_MAX_LIMIT} 条的有界数组`);
  }
  const parsedData = data.map((item, index) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw revisionSchemaError(`data[${index}]`, '对象');
    }
    const revision = item as Record<string, unknown>;
    if (typeof revision.id !== 'number' || !Number.isInteger(revision.id) || revision.id <= 0) {
      throw revisionSchemaError(`data[${index}].id`, '正整数');
    }
    if (
      typeof revision.type !== 'number' ||
      !Number.isInteger(revision.type) ||
      revision.type < 0
    ) {
      throw revisionSchemaError(`data[${index}].type`, '非负整数');
    }
    if (revision.summary !== undefined && typeof revision.summary !== 'string') {
      throw revisionSchemaError(`data[${index}].summary`, '字符串');
    }
    if (revision.created_at !== undefined && typeof revision.created_at !== 'string') {
      throw revisionSchemaError(`data[${index}].created_at`, '字符串');
    }
    if (revision.creator !== undefined) {
      if (
        !revision.creator ||
        typeof revision.creator !== 'object' ||
        Array.isArray(revision.creator)
      ) {
        throw revisionSchemaError(`data[${index}].creator`, '对象');
      }
      const creator = revision.creator as Record<string, unknown>;
      if (
        (creator.username !== undefined && typeof creator.username !== 'string') ||
        (creator.nickname !== undefined && typeof creator.nickname !== 'string')
      ) {
        throw revisionSchemaError(`data[${index}].creator`, '字符串字段对象');
      }
    }
    return revision as unknown as Revision;
  });

  const optionalInteger = (field: string, minimum: number): number | undefined => {
    if (value[field] === undefined || value[field] === null) return undefined;
    if (typeof value[field] !== 'number' || !Number.isInteger(value[field])) {
      throw revisionSchemaError(field, minimum === 0 ? '非负整数' : '正整数');
    }
    if ((value[field] as number) < minimum) {
      throw revisionSchemaError(field, minimum === 0 ? '非负整数' : '正整数');
    }
    return value[field] as number;
  };

  return {
    total: optionalInteger('total', 0),
    limit: optionalInteger('limit', 1),
    offset: optionalInteger('offset', 0),
    data: parsedData,
  };
}

export class RevisionService {
  private api: GeneratedBangumiOpenApiClient;
  private transport?: HttpClient;

  constructor(client: GeneratedBangumiOpenApiClient | HttpClient) {
    if (client instanceof GeneratedBangumiOpenApiClient) {
      this.api = client;
    } else {
      this.transport = client;
      this.api = new GeneratedBangumiOpenApiClient(client);
    }
  }

  async listRevisions(
    entityType: RevisionEntityType,
    entityId: number,
    options: { limit?: number; offset?: number } = {},
  ): Promise<{ total: number; limit: number; offset: number; items: DomainRevision[] }> {
    const limit = options.limit ?? 10;
    const offset = options.offset ?? 0;

    let res: { total?: number; limit?: number; offset?: number; data?: Revision[] };
    switch (entityType) {
      case 'subject':
        res = await this.api.getSubjectRevisions({ subject_id: entityId, limit, offset });
        break;
      case 'episode':
        res = await this.api.getEpisodeRevisions({ episode_id: entityId, limit, offset });
        break;
      case 'character':
        res = await this.api.getCharacterRevisions({ character_id: entityId, limit, offset });
        break;
      case 'person':
        res = await this.api.getPersonRevisions({ person_id: entityId, limit, offset });
        break;
      default:
        throw new Error(`Unsupported entityType: ${entityType}`);
    }

    const data = res.data || [];
    const items = data.map(mapRevision);
    return {
      total: res.total || items.length,
      limit: res.limit || limit,
      offset: res.offset || offset,
      items,
    };
  }

  async getSubjectRevisions(
    subjectId: number,
    options: { limit?: number; offset?: number } = {},
  ): Promise<{ total: number; items: DomainRevision[] }> {
    const res = await this.listRevisions('subject', subjectId, options);
    return { total: res.total, items: res.items };
  }

  async getRevisionIntelligence(
    entityType: RevisionEntityType,
    entityId: number,
    options: RevisionIntelligenceOptions = {},
  ): Promise<RevisionIntelligenceResult> {
    const limit = boundedRevisionLimit(options.limit);
    const offset = boundedRevisionOffset(options.offset);
    const route = REVISION_LIST_ROUTE[entityType];
    const attemptedAt = new Date().toISOString();

    try {
      const page = this.transport
        ? parseRevisionPage(
            await this.transport.request<unknown>({
              method: 'GET',
              path: route.path,
              query: { [route.idKey]: entityId, limit, offset },
              retryOptions: { maxRetries: 0 },
            }),
          )
        : await this.listRevisions(entityType, entityId, { limit, offset }).then((result) => ({
            total: result.total,
            limit: result.limit,
            offset: result.offset,
            data: result.items.map(
              (item) =>
                ({
                  id: item.id,
                  type: item.type,
                  summary: item.summary,
                  created_at: item.createdAt,
                  creator: item.creator,
                }) as unknown as Revision,
            ),
          }));
      const retrievedAt = new Date().toISOString();
      const sourceLimit = Math.min(REVISION_MAX_LIMIT, page.limit || limit);
      const sourceOffset = Math.min(REVISION_MAX_OFFSET, page.offset ?? offset);
      const totalKind = page.total === undefined ? 'estimated' : 'exact';
      const total = page.total ?? page.data.length;
      const items = page.data.map((revision) => {
        const mapped = mapRevision(revision);
        return {
          id: mapped.id,
          type: mapped.type,
          summary: mapped.summary || undefined,
          createdAt: mapped.createdAt || undefined,
          creator: mapped.creator,
        };
      });
      const missingFields: Record<string, number> = {};
      const recordMissing = (field: string) => {
        missingFields[field] = (missingFields[field] || 0) + 1;
      };
      for (const item of items) {
        if (!item.summary) recordMissing('revision.summary');
        if (!item.createdAt) recordMissing('revision.createdAt');
        if (!item.creator?.username) recordMissing('revision.creator.username');
        if (!item.creator?.nickname) recordMissing('revision.creator.nickname');
      }
      const inconsistentTotal = total < items.length;
      const truncated =
        total > items.length || sourceOffset > 0 || totalKind === 'estimated' || inconsistentTotal;
      const missing = Object.keys(missingFields).length > 0;
      const partial = truncated || missing;
      const operation = `GET ${route.path}`;
      return {
        state: partial ? 'partial' : 'complete',
        entityType,
        entityId,
        items,
        coverage: {
          state: partial ? 'partial' : 'complete',
          observed: items.length,
          returned: items.length,
          total,
          totalKind,
          limit: sourceLimit,
          offset: sourceOffset,
          truncated,
          missingFields,
        },
        capabilityStates: { historical_growth: 'not_computable' },
        source: { class: 'official-v0', operation, retrievedAt, attemptedAt },
        evidence: [{ source: 'official-v0', operation, retrievedAt, attemptedAt }],
        limitations: [
          '当前结果只代表本次官方修订接口返回的有界页面，不证明完整生命周期历史。',
          '修订时间是官方 created_at，不等同于条目播出时间或内容热度趋势。',
          '当前源不支持历史增长、流行度变化或连续快照推断。',
        ],
        warnings: [
          ...(truncated
            ? [
                {
                  code: 'OUTPUT_TRUNCATED',
                  state: 'partial' as const,
                  message: '修订历史达到本次分页或来源总数边界，未宣称完整生命周期历史。',
                },
              ]
            : []),
          ...(missing
            ? [
                {
                  code: 'MISSING_FIELD',
                  state: 'partial' as const,
                  message: '部分修订记录缺少摘要、创建时间或修订者字段，已保留为未知。',
                },
              ]
            : []),
          ...(inconsistentTotal
            ? [
                {
                  code: 'SOURCE_INCONSISTENT',
                  state: 'partial' as const,
                  message: '官方修订源的 total 小于本次返回条数，覆盖状态按 partial 处理。',
                },
              ]
            : []),
        ],
      };
    } catch (err) {
      const publicError = toPublicError(err);
      const operation = route?.path ? `GET ${route.path}` : 'GET /v0/revisions';
      return {
        state: 'unavailable',
        entityType,
        entityId,
        items: [],
        coverage: {
          state: 'unavailable',
          observed: 0,
          returned: 0,
          total: 0,
          totalKind: 'estimated',
          limit,
          offset,
          truncated: false,
          missingFields: {},
        },
        capabilityStates: { historical_growth: 'not_computable' },
        source: { class: 'official-v0', operation, attemptedAt },
        evidence: [{ source: 'official-v0', operation, attemptedAt }],
        limitations: [
          '官方修订源不可用时不返回猜测的变更历史。',
          '当前源不支持历史增长、流行度变化或连续快照推断。',
        ],
        warnings: [
          {
            code: publicError.code === 'PARSER_ERROR' ? 'SCHEMA_DRIFT' : 'UPSTREAM_UNAVAILABLE',
            state: 'unavailable',
            message: '官方修订源暂时不可用，未生成变更历史样本。',
          },
        ],
        error: publicError,
      };
    }
  }

  async getRevision(entityType: RevisionEntityType, revisionId: number): Promise<DomainRevision> {
    let raw: Revision;
    switch (entityType) {
      case 'subject':
        raw = await this.api.getSubjectRevisionByRevisionId(revisionId);
        break;
      case 'episode':
        raw = await this.api.getEpisodeRevisionByRevisionId(revisionId);
        break;
      case 'character':
        raw = await this.api.getCharacterRevisionByRevisionId(revisionId);
        break;
      case 'person':
        raw = await this.api.getPersonRevisionByRevisionId(revisionId);
        break;
      default:
        throw new Error(`Unsupported entityType: ${entityType}`);
    }
    return mapRevision(raw);
  }
}
