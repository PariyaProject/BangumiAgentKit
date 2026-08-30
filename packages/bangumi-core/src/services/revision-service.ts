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
    truncatedFields: Record<string, number>;
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

export type SubjectLatestRevisionState = 'complete' | 'partial' | 'not_found' | 'unavailable';

export interface SubjectLatestRevisionPayloadField {
  key: string;
  value: string | number | boolean | null;
  valueKind: 'string' | 'number' | 'boolean' | 'null' | 'json';
  truncated: boolean;
}

export interface SubjectLatestRevisionResult {
  state: SubjectLatestRevisionState;
  subjectId: number;
  selection: {
    strategy: 'offset-zero-source-order';
    limit: 1;
    offset: 0;
    revisionId?: number;
  };
  list: {
    state: 'complete' | 'partial' | 'unavailable';
    observed: number;
    returned: number;
    total: number;
    totalKind: 'exact' | 'estimated';
    limit: number;
    offset: number;
    truncated: boolean;
  };
  revision?: {
    id: number;
    type: number;
    summary?: string;
    createdAt?: string;
    creator?: {
      username?: string;
      nickname?: string;
    };
  };
  detail: {
    state: 'complete' | 'partial' | 'not_computable' | 'unavailable';
    payload: {
      state: 'complete' | 'partial' | 'not_computable';
      shape: 'object' | 'empty' | 'null' | 'unsupported';
      observedFields: number;
      returnedFields: number;
      omittedFields: number;
      truncatedFields: number;
      fields: SubjectLatestRevisionPayloadField[];
    };
  };
  source: {
    class: 'official-v0';
    operations: Array<{
      operation: string;
      attemptedAt?: string;
      retrievedAt?: string;
    }>;
  };
  evidence: Array<{
    source: 'official-v0';
    operation: string;
    attemptedAt?: string;
    retrievedAt?: string;
  }>;
  limitations: string[];
  warnings: Array<{
    code: string;
    state: 'partial' | 'unavailable' | 'not_found';
    message: string;
  }>;
  error?: ReturnType<typeof toPublicError>;
}

interface RevisionDetailOptions {
  maxResponseBytes?: number;
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
const REVISION_MAX_SUMMARY_LENGTH = 2_000;
const REVISION_MAX_TIMESTAMP_LENGTH = 128;
const REVISION_MAX_CREATOR_FIELD_LENGTH = 128;
export const SUBJECT_LATEST_REVISION_MAX_RESPONSE_BYTES = 1 * 1024 * 1024;
export const SUBJECT_LATEST_REVISION_MAX_PAYLOAD_FIELDS = 32;
export const SUBJECT_LATEST_REVISION_MAX_PAYLOAD_KEY_CHARACTERS = 128;
export const SUBJECT_LATEST_REVISION_MAX_PAYLOAD_VALUE_CHARACTERS = 2_000;

const REVISION_LIST_ROUTE: Record<RevisionEntityType, { path: string; idKey: string }> = {
  subject: { path: '/v0/revisions/subjects', idKey: 'subject_id' },
  episode: { path: '/v0/revisions/episodes', idKey: 'episode_id' },
  character: { path: '/v0/revisions/characters', idKey: 'character_id' },
  person: { path: '/v0/revisions/persons', idKey: 'person_id' },
};

const REVISION_DETAIL_ROUTE: Record<RevisionEntityType, { path: string }> = {
  subject: { path: '/v0/revisions/subjects' },
  episode: { path: '/v0/revisions/episodes' },
  character: { path: '/v0/revisions/characters' },
  person: { path: '/v0/revisions/persons' },
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

function boundedRevisionText(
  value: string | undefined,
  field: string,
  maxLength: number,
  truncatedFields: Record<string, number>,
): string | undefined {
  if (!value) return undefined;
  if (value.length <= maxLength) return value;
  truncatedFields[field] = (truncatedFields[field] || 0) + 1;
  return `${value.slice(0, maxLength - 1)}…`;
}

function clipLatestRevisionText(
  value: string,
  maximum: number,
): { text: string; truncated: boolean } {
  const codePoints = Array.from(value);
  if (codePoints.length <= maximum) return { text: value, truncated: false };
  if (maximum <= 0) return { text: '', truncated: true };
  if (maximum === 1) return { text: '…', truncated: true };
  return { text: `${codePoints.slice(0, maximum - 1).join('')}…`, truncated: true };
}

function parseRevisionDetail(raw: unknown): Revision {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw revisionSchemaError('detail', '对象');
  }
  const value = raw as Record<string, unknown>;
  if (typeof value.id !== 'number' || !Number.isInteger(value.id) || value.id <= 0) {
    throw revisionSchemaError('detail.id', '正整数');
  }
  if (typeof value.type !== 'number' || !Number.isInteger(value.type) || value.type < 0) {
    throw revisionSchemaError('detail.type', '非负整数');
  }
  if (value.summary !== undefined && value.summary !== null && typeof value.summary !== 'string') {
    throw revisionSchemaError('detail.summary', '字符串');
  }
  if (
    value.created_at !== undefined &&
    value.created_at !== null &&
    typeof value.created_at !== 'string'
  ) {
    throw revisionSchemaError('detail.created_at', '字符串');
  }
  if (value.creator !== undefined && value.creator !== null) {
    if (!value.creator || typeof value.creator !== 'object' || Array.isArray(value.creator)) {
      throw revisionSchemaError('detail.creator', '对象');
    }
    const creator = value.creator as Record<string, unknown>;
    if (
      (creator.username !== undefined &&
        creator.username !== null &&
        typeof creator.username !== 'string') ||
      (creator.nickname !== undefined &&
        creator.nickname !== null &&
        typeof creator.nickname !== 'string')
    ) {
      throw revisionSchemaError('detail.creator', '字符串字段对象');
    }
  }
  return value as unknown as Revision;
}

function projectLatestRevisionPayload(
  data: unknown,
): SubjectLatestRevisionResult['detail']['payload'] {
  if (data === undefined || data === null) {
    return {
      state: 'not_computable',
      shape: data === null ? 'null' : 'empty',
      observedFields: 0,
      returnedFields: 0,
      omittedFields: 0,
      truncatedFields: 0,
      fields: [],
    };
  }
  if (typeof data !== 'object' || Array.isArray(data)) {
    return {
      state: 'not_computable',
      shape: 'unsupported',
      observedFields: 0,
      returnedFields: 0,
      omittedFields: 0,
      truncatedFields: 0,
      fields: [],
    };
  }

  const entries = Object.entries(data);
  const fields: SubjectLatestRevisionPayloadField[] = [];
  let truncatedFields = 0;
  entries.slice(0, SUBJECT_LATEST_REVISION_MAX_PAYLOAD_FIELDS).forEach(([key, rawValue]) => {
    const boundedKey = clipLatestRevisionText(
      key,
      SUBJECT_LATEST_REVISION_MAX_PAYLOAD_KEY_CHARACTERS,
    );
    let value: string | number | boolean | null;
    let valueKind: SubjectLatestRevisionPayloadField['valueKind'];
    let truncated = boundedKey.truncated;
    if (rawValue === null) {
      value = null;
      valueKind = 'null';
    } else if (typeof rawValue === 'string') {
      const boundedValue = clipLatestRevisionText(
        rawValue,
        SUBJECT_LATEST_REVISION_MAX_PAYLOAD_VALUE_CHARACTERS,
      );
      value = boundedValue.text;
      valueKind = 'string';
      truncated ||= boundedValue.truncated;
    } else if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
      value = rawValue;
      valueKind = 'number';
    } else if (typeof rawValue === 'boolean') {
      value = rawValue;
      valueKind = 'boolean';
    } else {
      let serialized: string;
      try {
        serialized = JSON.stringify(rawValue) ?? '未知';
      } catch {
        serialized = '不可序列化';
      }
      const boundedValue = clipLatestRevisionText(
        serialized,
        SUBJECT_LATEST_REVISION_MAX_PAYLOAD_VALUE_CHARACTERS,
      );
      value = boundedValue.text;
      valueKind = 'json';
      truncated ||= boundedValue.truncated;
    }
    if (truncated) truncatedFields += 1;
    fields.push({ key: boundedKey.text, value, valueKind, truncated });
  });

  const omittedFields = Math.max(0, entries.length - fields.length);
  return {
    state:
      entries.length === 0 || omittedFields > 0 || truncatedFields > 0 ? 'partial' : 'complete',
    shape: entries.length === 0 ? 'empty' : 'object',
    observedFields: entries.length,
    returnedFields: fields.length,
    omittedFields,
    truncatedFields,
    fields,
  };
}

function emptyLatestRevisionPayload(
  state: SubjectLatestRevisionResult['detail']['payload']['state'] = 'not_computable',
): SubjectLatestRevisionResult['detail']['payload'] {
  return {
    state,
    shape: 'empty',
    observedFields: 0,
    returnedFields: 0,
    omittedFields: 0,
    truncatedFields: 0,
    fields: [],
  };
}

function latestRevisionWarning(
  code: string,
  state: SubjectLatestRevisionResult['warnings'][number]['state'],
  message: string,
): SubjectLatestRevisionResult['warnings'][number] {
  return { code, state, message };
}

function latestRevisionErrorCode(error: ReturnType<typeof toPublicError>): string {
  return error.code === 'PARSER_ERROR'
    ? 'SCHEMA_DRIFT'
    : error.code === 'NOT_FOUND'
      ? 'UPSTREAM_NOT_FOUND'
      : error.code === 'RATE_LIMITED'
        ? 'UPSTREAM_RATE_LIMITED'
        : error.code === 'NETWORK_ERROR'
          ? 'UPSTREAM_NETWORK_ERROR'
          : error.code === 'RESPONSE_TOO_LARGE'
            ? 'RESPONSE_TOO_LARGE'
            : 'UPSTREAM_UNAVAILABLE';
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
    if (
      revision.summary !== undefined &&
      revision.summary !== null &&
      typeof revision.summary !== 'string'
    ) {
      throw revisionSchemaError(`data[${index}].summary`, '字符串');
    }
    if (
      revision.created_at !== undefined &&
      revision.created_at !== null &&
      typeof revision.created_at !== 'string'
    ) {
      throw revisionSchemaError(`data[${index}].created_at`, '字符串');
    }
    if (revision.creator !== undefined && revision.creator !== null) {
      if (
        !revision.creator ||
        typeof revision.creator !== 'object' ||
        Array.isArray(revision.creator)
      ) {
        throw revisionSchemaError(`data[${index}].creator`, '对象');
      }
      const creator = revision.creator as Record<string, unknown>;
      if (
        (creator.username !== undefined &&
          creator.username !== null &&
          typeof creator.username !== 'string') ||
        (creator.nickname !== undefined &&
          creator.nickname !== null &&
          typeof creator.nickname !== 'string')
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
    if (!route) {
      throw new BangumiError(
        'VALIDATION_ERROR',
        `Unsupported revision entityType: ${String(entityType)}`,
        false,
        400,
      );
    }
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
      const missingFields: Record<string, number> = {};
      const truncatedFields: Record<string, number> = {};
      const recordMissing = (field: string) => {
        missingFields[field] = (missingFields[field] || 0) + 1;
      };
      const items = page.data.map((revision) => {
        const mapped = mapRevision(revision);
        const creator = mapped.creator
          ? {
              username: boundedRevisionText(
                mapped.creator.username,
                'revision.creator.username',
                REVISION_MAX_CREATOR_FIELD_LENGTH,
                truncatedFields,
              ),
              nickname: boundedRevisionText(
                mapped.creator.nickname,
                'revision.creator.nickname',
                REVISION_MAX_CREATOR_FIELD_LENGTH,
                truncatedFields,
              ),
            }
          : undefined;
        return {
          id: mapped.id,
          type: mapped.type,
          summary: boundedRevisionText(
            mapped.summary,
            'revision.summary',
            REVISION_MAX_SUMMARY_LENGTH,
            truncatedFields,
          ),
          createdAt: boundedRevisionText(
            mapped.createdAt,
            'revision.createdAt',
            REVISION_MAX_TIMESTAMP_LENGTH,
            truncatedFields,
          ),
          creator: creator && (creator.username || creator.nickname) ? creator : undefined,
        };
      });
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
      const fieldTruncated = Object.keys(truncatedFields).length > 0;
      const partial = truncated || missing || fieldTruncated;
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
          truncatedFields,
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
          ...(fieldTruncated
            ? [
                {
                  code: 'FIELD_TRUNCATED',
                  state: 'partial' as const,
                  message: '部分修订字段超过渲染边界，已截断并保留字段裁剪计数。',
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
          truncatedFields: {},
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
            code:
              publicError.code === 'PARSER_ERROR'
                ? 'SCHEMA_DRIFT'
                : publicError.code === 'NOT_FOUND'
                  ? 'UPSTREAM_NOT_FOUND'
                  : publicError.code === 'RATE_LIMITED'
                    ? 'UPSTREAM_RATE_LIMITED'
                    : publicError.code === 'NETWORK_ERROR'
                      ? 'UPSTREAM_NETWORK_ERROR'
                      : 'UPSTREAM_UNAVAILABLE',
            state: 'unavailable',
            message: '官方修订源暂时不可用，未生成变更历史样本。',
          },
        ],
        error: publicError,
      };
    }
  }

  async getLatestSubjectRevision(subjectId: number): Promise<SubjectLatestRevisionResult> {
    const listResult = await this.getRevisionIntelligence('subject', subjectId, {
      limit: 1,
      offset: 0,
    });
    const listCoverage = listResult.coverage;
    const listOperation = listResult.source.operation;
    const operations: SubjectLatestRevisionResult['source']['operations'] = [
      {
        operation: listOperation,
        attemptedAt: listResult.source.attemptedAt,
        retrievedAt: listResult.source.retrievedAt,
      },
    ];
    const evidence: SubjectLatestRevisionResult['evidence'] = listResult.evidence.map((item) => ({
      source: 'official-v0',
      operation: item.operation,
      attemptedAt: item.attemptedAt,
      retrievedAt: item.retrievedAt,
    }));
    const limitations = [
      '仅选择官方修订列表在 limit=1、offset=0 返回的第一条记录；源未保证该返回顺序等同“最新”。',
      '修订详情中的 summary、created_at 和 data 只是官方返回的证据，不重建 before/after 快照或精确字段差异。',
      '本能力最多读取一条官方列表记录和一条详情记录；其余历史不会在本次结果中展开。',
    ];
    const warnings: SubjectLatestRevisionResult['warnings'] = listResult.warnings.map(
      (warning) => ({
        code: warning.code,
        state: warning.state,
        message: warning.message,
      }),
    );
    warnings.push(
      latestRevisionWarning(
        'SOURCE_ORDER_BOUNDED',
        'partial',
        '“最新”仅表示官方 limit=1、offset=0 响应中的第一条源顺序记录；没有宣称源端排序或全量历史覆盖。',
      ),
      latestRevisionWarning(
        'EXACT_DIFF_UNSUPPORTED',
        'partial',
        '当前源未提供可验证的 before/after 快照差异；summary 或 data 不等同精确字段变更列表。',
      ),
    );
    const list = {
      state: listCoverage.state,
      observed: listCoverage.observed,
      returned: listCoverage.returned,
      total: listCoverage.total,
      totalKind: listCoverage.totalKind,
      limit: listCoverage.limit,
      offset: listCoverage.offset,
      truncated: listCoverage.truncated,
    } satisfies SubjectLatestRevisionResult['list'];
    const source = { class: 'official-v0' as const, operations };
    const selection: SubjectLatestRevisionResult['selection'] = {
      strategy: 'offset-zero-source-order' as const,
      limit: 1 as const,
      offset: 0 as const,
    };

    if (listResult.state === 'unavailable') {
      warnings.push(
        latestRevisionWarning(
          latestRevisionErrorCode(
            listResult.error || { code: 'UPSTREAM_UNAVAILABLE', message: '' },
          ),
          'unavailable',
          '官方修订列表不可用，无法选择一条最新修订证据。',
        ),
      );
      return {
        state: 'unavailable',
        subjectId,
        selection,
        list,
        detail: {
          state: 'unavailable',
          payload: emptyLatestRevisionPayload(),
        },
        source,
        evidence,
        limitations,
        warnings,
        error: listResult.error,
      };
    }

    const selected = listResult.items[0];
    if (!selected) {
      warnings.push(
        latestRevisionWarning(
          'NO_REVISION_FOUND',
          'not_found',
          '官方修订列表为空；空结果不证明条目不存在修订历史。',
        ),
      );
      return {
        state: 'not_found',
        subjectId,
        selection,
        list,
        detail: {
          state: 'not_computable',
          payload: emptyLatestRevisionPayload(),
        },
        source,
        evidence,
        limitations,
        warnings,
      };
    }

    selection.revisionId = selected.id;
    const detailRoute = REVISION_DETAIL_ROUTE.subject;
    const detailOperation = `GET ${detailRoute.path}/${selected.id}`;
    const detailAttemptedAt = new Date().toISOString();
    operations.push({ operation: detailOperation, attemptedAt: detailAttemptedAt });
    evidence.push({
      source: 'official-v0',
      operation: detailOperation,
      attemptedAt: detailAttemptedAt,
    });

    try {
      const detail = await this.getRevision('subject', selected.id, {
        maxResponseBytes: SUBJECT_LATEST_REVISION_MAX_RESPONSE_BYTES,
      });
      if (detail.id !== selected.id) {
        throw new BangumiError(
          'PARSER_ERROR',
          `revision.detail.id ${detail.id} 与请求的 ${selected.id} 不一致`,
          false,
        );
      }
      const detailRetrievedAt = new Date().toISOString();
      operations[1]!.retrievedAt = detailRetrievedAt;
      evidence[1]!.retrievedAt = detailRetrievedAt;
      const payload = projectLatestRevisionPayload(detail.data);
      const revision = {
        id: detail.id,
        type: detail.type,
        ...(detail.summary || selected.summary
          ? { summary: detail.summary || selected.summary }
          : {}),
        ...(detail.createdAt || selected.createdAt
          ? { createdAt: detail.createdAt || selected.createdAt }
          : {}),
        ...(detail.creator || selected.creator
          ? { creator: detail.creator || selected.creator }
          : {}),
      };
      if (payload.state === 'not_computable') {
        warnings.push(
          latestRevisionWarning(
            payload.shape === 'unsupported' ? 'PAYLOAD_UNSUPPORTED' : 'PAYLOAD_NOT_COMPUTABLE',
            'partial',
            payload.shape === 'unsupported'
              ? '官方修订详情的 data 不是可安全展示的对象，未将其当作精确变更字段。'
              : '官方修订详情未提供可计算的 data 对象，已保留修订元数据但不猜测字段变化。',
          ),
        );
      } else if (payload.state === 'partial') {
        warnings.push(
          latestRevisionWarning(
            'PAYLOAD_TRUNCATED',
            'partial',
            `官方修订详情 data 有 ${payload.omittedFields + payload.truncatedFields} 个字段因输出边界未完整展示。`,
          ),
        );
      }
      const detailState =
        payload.state === 'complete'
          ? ('complete' as const)
          : payload.state === 'not_computable'
            ? ('not_computable' as const)
            : ('partial' as const);
      return {
        state: 'partial',
        subjectId,
        selection,
        list,
        revision,
        detail: { state: detailState, payload },
        source,
        evidence,
        limitations,
        warnings,
      };
    } catch (err) {
      const publicError = toPublicError(err);
      warnings.push(
        latestRevisionWarning(
          latestRevisionErrorCode(publicError),
          'unavailable',
          '官方修订详情不可用；已保留列表中的第一条修订元数据，不猜测其字段变化。',
        ),
      );
      return {
        state: 'partial',
        subjectId,
        selection,
        list,
        revision: selected,
        detail: {
          state: 'unavailable',
          payload: emptyLatestRevisionPayload(),
        },
        source,
        evidence,
        limitations,
        warnings,
        error: publicError,
      };
    }
  }

  async getRevision(
    entityType: RevisionEntityType,
    revisionId: number,
    options: RevisionDetailOptions = {},
  ): Promise<DomainRevision> {
    const route = REVISION_DETAIL_ROUTE[entityType];
    if (!route) {
      throw new BangumiError(
        'VALIDATION_ERROR',
        `Unsupported revision entityType: ${String(entityType)}`,
        false,
        400,
      );
    }

    let raw: Revision;
    if (this.transport) {
      raw = parseRevisionDetail(
        await this.transport.request<unknown>({
          method: 'GET',
          path: `${route.path}/${encodeURIComponent(String(revisionId))}`,
          maxResponseBytes: options.maxResponseBytes,
          retryOptions: { maxRetries: 0 },
        }),
      );
    } else {
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
    }
    return mapRevision(raw);
  }
}
