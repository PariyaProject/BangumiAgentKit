import type { GeneratedBangumiOpenApiClient } from '@bangumi-agent-kit/bangumi-openapi';
import {
  CharacterService,
  getSubjectCast,
  groupSubjectStaff,
  PersonService,
  SubjectService,
  type SubjectOverviewCastItem,
  type SubjectOverviewEvidence,
  type SubjectOverviewResult,
  type SubjectOverviewSectionCoverage,
  type SubjectOverviewSectionState,
  type SubjectOverviewStats,
  type SubjectOverviewWarning,
} from '@bangumi-agent-kit/bangumi-core';
import type {
  CapabilityResult,
  ProviderRegistry,
  SubjectStatsData,
} from '@bangumi-agent-kit/provider-core';
import { toPublicError, type HttpClient } from '@bangumi-agent-kit/bangumi-transport';

export interface SubjectOverviewLimits {
  maxCast: number;
  maxStaff: number;
  maxRelations: number;
}

export interface SubjectOverviewDependencies {
  client: GeneratedBangumiOpenApiClient | HttpClient;
  providerRegistry?: ProviderRegistry;
}

const SUBJECT_OPERATION = 'GET /v0/subjects/{subject_id}';
const CAST_OPERATION = 'GET /v0/subjects/{subject_id}/characters';
const STAFF_OPERATION = 'GET /v0/subjects/{subject_id}/persons';
const RELATIONS_OPERATION = 'GET /v0/subjects/{subject_id}/subjects';
const STATS_OPERATION = 'GET /v0/subjects/{subject_id} (rating/collection fields)';

function coverage(
  state: SubjectOverviewSectionState,
  observed: number,
  returned: number,
  truncated = false,
): SubjectOverviewSectionCoverage {
  return { state, observed, returned, truncated };
}

function unavailableCoverage(): SubjectOverviewSectionCoverage {
  return coverage('unavailable', 0, 0, false);
}

function mapProviderState(
  state: CapabilityResult<SubjectStatsData>['state'],
  hasData: boolean,
): SubjectOverviewSectionState {
  if (state === 'ok' && hasData) return 'complete';
  if (state === 'not_computable' || state === 'unsupported') return 'not_computable';
  if (state === 'unavailable' || state === 'not_found' || state === 'upstream_error') {
    return 'unavailable';
  }
  return 'partial';
}

function mapStats(data: SubjectStatsData): SubjectOverviewStats {
  return {
    score: data.score,
    rank: data.rank,
    ratingTotal: data.ratingTotal,
    ratingHistogram: { ...data.ratingHistogram },
    collection: { ...data.collection },
  };
}

function mapEvidence(result: CapabilityResult<SubjectStatsData>): SubjectOverviewEvidence[] {
  const evidence = result.evidence || {};
  const operations = new Map<string, SubjectOverviewEvidence>();
  for (const refs of Object.values(evidence)) {
    for (const ref of refs) {
      const source = ref.source.class === 'derived' ? 'derived-s7' : 'official-v0';
      const operation = ref.source.operation || STATS_OPERATION;
      const key = `${source}:${operation}:${ref.retrievedAt}`;
      operations.set(key, {
        source,
        operation,
        retrievedAt: ref.retrievedAt,
      });
    }
  }
  if (operations.size === 0 && result.state !== 'unavailable') {
    operations.set('official-v0:stats', {
      source: 'official-v0',
      operation: STATS_OPERATION,
      retrievedAt: result.retrievedAt,
    });
  }
  return Array.from(operations.values());
}

function mapProviderWarnings(result: CapabilityResult<SubjectStatsData>): SubjectOverviewWarning[] {
  return (result.warnings || []).map((warning) => ({
    code: warning.code,
    state: mapProviderState(result.state, Boolean(result.data)),
    section: 'stats' as const,
    message: warning.message,
  }));
}

function failureWarning(
  section: SubjectOverviewWarning['section'],
  error: unknown,
  message: string,
): SubjectOverviewWarning {
  const publicError = toPublicError(error);
  const normalizedCode = String(publicError.code || 'UPSTREAM_ERROR').toUpperCase();
  return {
    code: normalizedCode.startsWith('UPSTREAM_') ? normalizedCode : `UPSTREAM_${normalizedCode}`,
    state: 'unavailable',
    section,
    message,
  };
}

function sectionCounts(result: SubjectOverviewResult): {
  complete: number;
  partial: number;
  unavailable: number;
  notComputable: number;
  truncated: string[];
} {
  const sections = [
    ['stats', result.stats],
    ['cast', result.cast],
    ['staff', result.staff],
    ['relations', result.relations],
  ] as const;
  const counts = {
    complete: 0,
    partial: 0,
    unavailable: 0,
    notComputable: 0,
    truncated: [] as string[],
  };
  for (const [name, section] of sections) {
    if (section.state === 'complete') counts.complete += 1;
    if (section.state === 'partial') counts.partial += 1;
    if (section.state === 'unavailable') counts.unavailable += 1;
    if (section.state === 'not_computable') counts.notComputable += 1;
    if (section.coverage.truncated) counts.truncated.push(name);
  }
  return counts;
}

function finalize(
  result: SubjectOverviewResult,
  limits: SubjectOverviewLimits,
): SubjectOverviewResult {
  const counts = sectionCounts(result);
  const hasUnavailable = counts.unavailable > 0;
  const hasPartial = counts.partial > 0 || counts.notComputable > 0 || counts.truncated.length > 0;
  return {
    ...result,
    state: hasUnavailable || hasPartial ? 'partial' : 'complete',
    coverage: {
      ...result.coverage,
      sectionsComplete: counts.complete,
      sectionsPartial: counts.partial,
      sectionsUnavailable: counts.unavailable,
      sectionsNotComputable: counts.notComputable,
      truncatedSections: counts.truncated,
      limits,
    },
  };
}

function emptyResult(subjectId: number, limits: SubjectOverviewLimits): SubjectOverviewResult {
  return {
    state: 'unavailable',
    subjectId,
    stats: { state: 'unavailable', coverage: unavailableCoverage() },
    cast: { state: 'unavailable', items: [], coverage: unavailableCoverage() },
    staff: { state: 'unavailable', items: [], groups: [], coverage: unavailableCoverage() },
    relations: { state: 'unavailable', items: [], coverage: unavailableCoverage() },
    coverage: {
      sourceRequestsAttempted: 0,
      sourceRequestsSucceeded: 0,
      sectionsComplete: 0,
      sectionsPartial: 0,
      sectionsUnavailable: 4,
      sectionsNotComputable: 0,
      truncatedSections: [],
      limits,
    },
    evidence: [],
    limitations: [],
    warnings: [],
  };
}

export async function getSubjectOverview(
  subjectId: number,
  limits: SubjectOverviewLimits,
  dependencies: SubjectOverviewDependencies,
): Promise<SubjectOverviewResult> {
  const attemptedAt = new Date().toISOString();
  const subjectService = new SubjectService(dependencies.client);
  let subject;
  try {
    subject = await subjectService.getSubjectById(subjectId);
  } catch (error) {
    const publicError = toPublicError(error);
    const result = emptyResult(subjectId, limits);
    result.state = publicError.code === 'NOT_FOUND' ? 'not_found' : 'unavailable';
    result.coverage.sourceRequestsAttempted = 1;
    result.evidence.push({
      source: 'official-v0',
      operation: SUBJECT_OPERATION,
      attemptedAt,
    });
    result.warnings.push({
      ...failureWarning('subject', error, '官方条目详情不可用，未继续请求概览的其他区段。'),
      code:
        publicError.code === 'NOT_FOUND' ? 'UPSTREAM_NOT_FOUND' : 'UPSTREAM_SUBJECT_UNAVAILABLE',
    });
    result.limitations.push('条目详情不可用时，不对统计、角色、职员或关联条目做猜测。');
    return result;
  }

  const retrievedAt = new Date().toISOString();
  const evidence: SubjectOverviewEvidence[] = [
    { source: 'official-v0', operation: SUBJECT_OPERATION, retrievedAt },
  ];
  const sectionsAttemptedAt = new Date().toISOString();
  const characterService = new CharacterService(dependencies.client);
  const personService = new PersonService(dependencies.client);
  const promises = {
    stats: dependencies.providerRegistry
      ? dependencies.providerRegistry.getSubjectStats(subjectId, { authScope: 'public' })
      : Promise.resolve(undefined),
    cast: getSubjectCast(characterService, subjectId, { limit: limits.maxCast }),
    staff: personService.getSubjectStaff(subjectId, limits.maxStaff),
    relations: subjectService.getSubjectRelations(subjectId),
  };
  const settled = await Promise.allSettled([
    promises.stats,
    promises.cast,
    promises.staff,
    promises.relations,
  ]);
  const [statsResult, castResult, staffResult, relationsResult] = settled;
  const warnings: SubjectOverviewWarning[] = [];
  let successfulSections = 0;

  let stats: SubjectOverviewResult['stats'];
  if (statsResult.status === 'fulfilled' && statsResult.value) {
    const providerResult = statsResult.value as CapabilityResult<SubjectStatsData>;
    const state = mapProviderState(providerResult.state, Boolean(providerResult.data));
    stats = {
      state,
      data: providerResult.data ? mapStats(providerResult.data) : undefined,
      coverage: coverage(state, providerResult.data ? 1 : 0, providerResult.data ? 1 : 0),
    };
    evidence.push(...mapEvidence(providerResult));
    warnings.push(...mapProviderWarnings(providerResult));
    if (state !== 'unavailable') successfulSections += 1;
    if (state === 'unavailable' && !providerResult.warnings?.length) {
      warnings.push({
        code: 'SUBJECT_STATS_UNAVAILABLE',
        state: 'unavailable',
        section: 'stats',
        message: '官方统计字段不可用，未填充猜测的统计值。',
      });
    }
  } else if (statsResult.status === 'rejected') {
    stats = { state: 'unavailable', coverage: unavailableCoverage() };
    evidence.push({
      source: 'official-v0',
      operation: STATS_OPERATION,
      attemptedAt: sectionsAttemptedAt,
    });
    warnings.push(
      failureWarning('stats', statsResult.reason, '官方统计区段不可用，未填充猜测的统计值。'),
    );
  } else {
    stats = { state: 'unavailable', coverage: unavailableCoverage() };
    warnings.push({
      code: 'PROVIDER_NOT_CONFIGURED',
      state: 'unavailable',
      section: 'stats',
      message: '统计 Provider 未配置，未填充猜测的统计值。',
    });
  }

  let cast: SubjectOverviewResult['cast'];
  if (castResult.status === 'fulfilled') {
    const items: SubjectOverviewCastItem[] = castResult.value.cast.map((item) => ({
      character: item.character,
      relation: item.relation,
      actors: item.actors.map((actor) => ({
        id: actor.id,
        name: actor.name,
        career: actor.career,
        image: actor.image,
      })),
    }));
    const state: SubjectOverviewSectionState = castResult.value.truncated ? 'partial' : 'complete';
    cast = {
      state,
      items,
      coverage: coverage(
        state,
        castResult.value.observed,
        castResult.value.returned,
        castResult.value.truncated,
      ),
    };
    successfulSections += 1;
    if (castResult.value.truncated) {
      warnings.push({
        code: 'CAST_OUTPUT_TRUNCATED',
        state: 'partial',
        section: 'cast',
        message: '角色/声优区段达到本次显示上限，未宣称完整角色表。',
      });
    }
    evidence.push({
      source: 'official-v0',
      operation: CAST_OPERATION,
      retrievedAt,
    });
  } else {
    cast = { state: 'unavailable', items: [], coverage: unavailableCoverage() };
    evidence.push({
      source: 'official-v0',
      operation: CAST_OPERATION,
      attemptedAt: sectionsAttemptedAt,
    });
    warnings.push(
      failureWarning('cast', castResult.reason, '角色与声优区段不可用，未生成猜测内容。'),
    );
  }

  let staff: SubjectOverviewResult['staff'];
  if (staffResult.status === 'fulfilled') {
    const state: SubjectOverviewSectionState = staffResult.value.truncated ? 'partial' : 'complete';
    staff = {
      state,
      items: staffResult.value.items,
      groups: groupSubjectStaff(staffResult.value.items),
      coverage: coverage(
        state,
        staffResult.value.observed,
        staffResult.value.returned,
        staffResult.value.truncated,
      ),
    };
    successfulSections += 1;
    if (staffResult.value.truncated) {
      warnings.push({
        code: 'STAFF_OUTPUT_TRUNCATED',
        state: 'partial',
        section: 'staff',
        message: '制作人员区段达到本次显示上限，保留官方原始职位标签但未宣称完整职员表。',
      });
    }
    evidence.push({
      source: 'official-v0',
      operation: STAFF_OPERATION,
      retrievedAt,
    });
  } else {
    staff = { state: 'unavailable', items: [], groups: [], coverage: unavailableCoverage() };
    evidence.push({
      source: 'official-v0',
      operation: STAFF_OPERATION,
      attemptedAt: sectionsAttemptedAt,
    });
    warnings.push(
      failureWarning('staff', staffResult.reason, '制作人员区段不可用，未生成猜测内容。'),
    );
  }

  let relations: SubjectOverviewResult['relations'];
  if (relationsResult.status === 'fulfilled') {
    const observed = relationsResult.value.length;
    const items = relationsResult.value.slice(0, limits.maxRelations);
    const truncated = observed > items.length;
    const state: SubjectOverviewSectionState = truncated ? 'partial' : 'complete';
    relations = { state, items, coverage: coverage(state, observed, items.length, truncated) };
    successfulSections += 1;
    evidence.push({ source: 'official-v0', operation: RELATIONS_OPERATION, retrievedAt });
    if (truncated) {
      warnings.push({
        code: 'RELATIONS_OUTPUT_TRUNCATED',
        state: 'partial',
        section: 'relations',
        message: '关联条目区段达到本次显示上限，未宣称完整关系表。',
      });
    }
  } else {
    relations = { state: 'unavailable', items: [], coverage: unavailableCoverage() };
    evidence.push({
      source: 'official-v0',
      operation: RELATIONS_OPERATION,
      attemptedAt: sectionsAttemptedAt,
    });
    warnings.push(
      failureWarning('relations', relationsResult.reason, '关联条目区段不可用，未生成猜测内容。'),
    );
  }

  const result: SubjectOverviewResult = {
    state: 'complete',
    subjectId,
    subject,
    stats,
    cast,
    staff,
    relations,
    coverage: {
      sourceRequestsAttempted: 4 + (dependencies.providerRegistry ? 1 : 0),
      sourceRequestsSucceeded: successfulSections + 1,
      sectionsComplete: 0,
      sectionsPartial: 0,
      sectionsUnavailable: 0,
      sectionsNotComputable: 0,
      truncatedSections: [],
      limits,
    },
    evidence,
    limitations: [
      '每个区段只代表本次官方 v0 有界响应与本次 cap，不宣称完整角色、职员或关联条目历史。',
      '制作人员和关联条目保留官方原始标签；本结果不推断更宽泛的职位、前后传或推荐语义。',
      '统计是当前官方快照字段；本结果不计算历史趋势、社区热度或跨时间比较。',
    ],
    warnings,
  };
  return finalize(result, limits);
}
