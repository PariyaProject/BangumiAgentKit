import {
  mapSubjectType,
  type SubjectIdentityData,
  type SubjectIdentityEvidence,
  type SubjectIdentityFieldCoverage,
  type SubjectIdentityInfoboxCoverage,
  type SubjectIdentityInfoboxData,
  type SubjectIdentityResult,
  type SubjectIdentityState,
} from '@bangumi-agent-kit/bangumi-core';
import {
  SUBJECT_IDENTITY_MAX_INFOBOX_ROWS,
  SUBJECT_IDENTITY_MAX_INFOBOX_VALUES,
  SUBJECT_IDENTITY_MAX_RESPONSE_BYTES,
  SUBJECT_IDENTITY_MAX_SCALAR_CHARACTERS,
  type CapabilityResult,
  type EvidenceRef,
  type FieldEvidence,
  type ProviderErrorCode,
  type ProviderRegistry,
  type ProviderSubjectIdentityData,
} from '@bangumi-agent-kit/provider-core';

const OFFICIAL_OPERATION = 'GET /v0/subjects/{subject_id}';

const LIMITATIONS = [
  '结果只来自一次当前官方 v0 条目详情读取，不是历史快照，也不保证响应不可变。',
  'series 是官方定义的书籍系列主条目标记，不是全局 franchise 或观看顺序判断。',
  'eps 是旧服务端解析的报告话数/章节数，totalEpisodes 是数据库章节数量；两者保持分开。',
  '别名只从识别到的 infobox 行按原始顺序提取；缺少或无法识别该行时为 unknown，不代表没有别名。',
  'infobox、metaTags 和 tags 都受本能力的有界输出限制；不读取社区网页、关系、图片字节或持久化历史。',
];

function emptyFields(): SubjectIdentityFieldCoverage {
  return { observed: [], returned: [], missing: [], malformed: [], empty: [], truncated: [] };
}

function emptyInfobox(): SubjectIdentityInfoboxCoverage {
  return {
    state: 'unknown',
    observedRows: 0,
    returnedRows: 0,
    malformedRows: 0,
    omittedRows: 0,
    nestedValuesObserved: 0,
    nestedValuesReturned: 0,
    nestedValuesOmitted: 0,
    malformedValues: 0,
    truncatedValues: 0,
    truncated: false,
    maxRows: SUBJECT_IDENTITY_MAX_INFOBOX_ROWS,
    maxValuesPerRow: SUBJECT_IDENTITY_MAX_INFOBOX_VALUES,
    maxScalarCharacters: SUBJECT_IDENTITY_MAX_SCALAR_CHARACTERS,
  };
}

function emptyResult(subjectId: number): SubjectIdentityResult {
  return {
    subjectId,
    state: 'unavailable',
    coverage: {
      sourceRequestsAttempted: 0,
      sourceRequestsSucceeded: 0,
      responseLimitBytes: SUBJECT_IDENTITY_MAX_RESPONSE_BYTES,
      fields: emptyFields(),
      infobox: emptyInfobox(),
    },
    source: {
      class: 'official-v0',
      provider: 'bangumi',
      operation: OFFICIAL_OPERATION,
      responseLimitBytes: SUBJECT_IDENTITY_MAX_RESPONSE_BYTES,
    },
    evidence: [],
    warnings: [],
    limitations: [...LIMITATIONS],
  };
}

function mapState(
  state: CapabilityResult<unknown>['state'],
  hasData: boolean,
): SubjectIdentityState {
  switch (state) {
    case 'ok':
      return hasData ? 'complete' : 'partial';
    case 'partial':
    case 'stale':
    case 'conflict':
      return 'partial';
    case 'not_found':
      return 'not_found';
    case 'auth_required':
      return 'auth_required';
    case 'permission_denied':
      return 'permission_denied';
    case 'not_computable':
      return 'not_computable';
    case 'unsupported':
      return 'unsupported';
    case 'unavailable':
      return 'unavailable';
    case 'upstream_error':
      return 'upstream_error';
  }
}

function mapPublicError(
  error: CapabilityResult<unknown>['error'],
): SubjectIdentityResult['error'] | undefined {
  if (!error) return undefined;
  const messages: Record<ProviderErrorCode, string> = {
    not_found: '未找到请求的 Bangumi 条目。',
    auth_required: '当前读取需要 Bangumi 账号授权。',
    permission_denied: '当前授权范围不允许读取该条目。',
    rate_limited: 'Bangumi 请求频率受限，请稍后重试。',
    timeout: 'Bangumi 请求超时，请稍后重试。',
    network_error: 'Bangumi 网络请求失败，请稍后重试。',
    schema_drift: 'Bangumi 响应不符合当前安全解析合同。',
    response_too_large: 'Bangumi 响应超过本能力的安全大小限制。',
    upstream_unavailable: 'Bangumi 上游服务暂时不可用。',
    upstream_error: 'Bangumi 上游请求失败。',
  };
  return {
    code: error.code,
    message: messages[error.code] || 'Bangumi 请求失败。',
    retryable: error.retryable,
  };
}

function mapEvidenceRef(ref: EvidenceRef, fieldPath: string): SubjectIdentityEvidence | undefined {
  const source =
    ref.source.class === 'official_v0'
      ? 'official-v0'
      : ref.source.class === 'derived'
        ? 'derived-s7'
        : undefined;
  if (!source) return undefined;
  return {
    source,
    provider: ref.source.provider,
    ...(ref.source.operation ? { operation: ref.source.operation } : {}),
    ...(ref.source.version ? { version: ref.source.version } : {}),
    ...(ref.retrievedAt ? { retrievedAt: ref.retrievedAt } : {}),
    fieldPath,
    ...(ref.formula ? { formula: ref.formula } : {}),
  };
}

function mapEvidence(evidence: FieldEvidence | undefined): SubjectIdentityEvidence[] {
  if (!evidence) return [];
  const mapped = Object.entries(evidence).flatMap(([fieldPath, refs]) =>
    refs.flatMap((ref) => {
      const item = mapEvidenceRef(ref, fieldPath);
      return item ? [item] : [];
    }),
  );
  const seen = new Set<string>();
  return mapped.filter((item) => {
    const key = JSON.stringify(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function mapInfobox(data: ProviderSubjectIdentityData['infobox']): SubjectIdentityInfoboxData {
  return {
    state: data.state,
    rows: data.rows.map((row) => ({
      key: row.key,
      value:
        typeof row.value === 'string'
          ? row.value
          : row.value.map((value) => ({
              ...(value.k === undefined ? {} : { k: value.k }),
              v: value.v,
            })),
    })),
    aliases: {
      state: data.aliases.state,
      values: [...data.aliases.values],
      sourceKeys: [...data.aliases.sourceKeys],
      sourceRowIndexes: [...data.aliases.sourceRowIndexes],
    },
    coverage: { ...data.coverage },
  };
}

function mapData(data: ProviderSubjectIdentityData): SubjectIdentityData {
  return {
    id: data.id,
    type: data.type,
    typeLabel: mapSubjectType(data.type),
    name: data.name,
    ...(data.nameCn === undefined ? {} : { nameCn: data.nameCn }),
    ...(data.date === undefined ? {} : { date: data.date }),
    ...(data.platform === undefined ? {} : { platform: data.platform }),
    ...(data.locked === undefined ? {} : { locked: data.locked }),
    ...(data.nsfw === undefined ? {} : { nsfw: data.nsfw }),
    ...(data.series === undefined ? {} : { series: data.series }),
    ...(data.volumes === undefined ? {} : { volumes: data.volumes }),
    ...(data.eps === undefined ? {} : { eps: data.eps }),
    ...(data.totalEpisodes === undefined ? {} : { totalEpisodes: data.totalEpisodes }),
    ...(data.metaTags === undefined ? {} : { metaTags: [...data.metaTags] }),
    ...(data.tags === undefined ? {} : { tags: [...data.tags] }),
    ...(data.images === undefined ? {} : { images: { ...data.images } }),
    infobox: mapInfobox(data.infobox),
    fields: {
      observed: [...data.fields.observed],
      returned: [...data.fields.returned],
      missing: [...data.fields.missing],
      malformed: [...data.fields.malformed],
      empty: [...data.fields.empty],
      truncated: [...data.fields.truncated],
    },
  };
}

function mapWarnings(
  result: CapabilityResult<ProviderSubjectIdentityData>,
  state: SubjectIdentityState,
): SubjectIdentityResult['warnings'] {
  return (result.warnings || []).map((item) => ({
    code: item.code,
    state,
    message: item.message,
  }));
}

export interface SubjectIdentityDependencies {
  providerRegistry?: ProviderRegistry;
}

export async function getSubjectIdentity(
  subjectId: number,
  dependencies: SubjectIdentityDependencies = {},
): Promise<SubjectIdentityResult> {
  const result = emptyResult(subjectId);
  if (!dependencies.providerRegistry) {
    result.warnings.push({
      code: 'PROVIDER_NOT_CONFIGURED',
      state: 'unavailable',
      message: '官方条目身份 Provider 未配置，未填充猜测的身份信息。',
    });
    return result;
  }

  let sourceResult: CapabilityResult<ProviderSubjectIdentityData>;
  try {
    sourceResult = await dependencies.providerRegistry.getSubjectIdentity(subjectId, {
      authScope: 'public',
    });
  } catch {
    result.coverage.sourceRequestsAttempted = 1;
    result.warnings.push({
      code: 'UPSTREAM_IDENTITY_UNAVAILABLE',
      state: 'unavailable',
      message: '官方条目身份源请求失败，未生成猜测的身份信息。',
    });
    return result;
  }

  result.coverage.sourceRequestsAttempted = 1;
  result.coverage.sourceRequestsSucceeded = sourceResult.data ? 1 : 0;
  result.state = mapState(sourceResult.state, Boolean(sourceResult.data));
  result.error = mapPublicError(sourceResult.error);
  result.evidence = mapEvidence(sourceResult.evidence);
  result.warnings = mapWarnings(sourceResult, result.state);
  result.retrievedAt = sourceResult.retrievedAt;
  result.source = {
    ...result.source,
    ...(sourceResult.retrievedAt ? { retrievedAt: sourceResult.retrievedAt } : {}),
  };

  if (sourceResult.data) {
    result.data = mapData(sourceResult.data);
    result.coverage.fields = result.data.fields;
    result.coverage.infobox = result.data.infobox.coverage;
  } else if (sourceResult.state === 'ok') {
    result.state = 'partial';
    result.warnings.push({
      code: 'MISSING_IDENTITY_DATA',
      state: 'partial',
      message: '官方条目身份请求成功但没有返回可展示的数据。',
    });
  }

  return result;
}
