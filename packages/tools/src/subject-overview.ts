import type { GeneratedBangumiOpenApiClient } from '@bangumi-agent-kit/bangumi-openapi';
import {
  CharacterService,
  getSubjectCast,
  PersonService,
  SubjectService,
  type SubjectOverviewActorCoverage,
  type SubjectOverviewCastItem,
  type SubjectOverviewEvidence,
  type SubjectOverviewResult,
  type SubjectOverviewConflictEvidence,
  type SubjectOverviewConflictSource,
  type SubjectOverviewSectionCoverage,
  type SubjectOverviewSectionState,
  type SubjectOverviewStatsConflict,
  type SubjectOverviewStats,
  type SubjectOverviewWarning,
  type SubjectStaffGroup,
  type SubjectStaffMember,
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
  /**
   * Allows a composed capability to share one bounded statistics request with
   * the overview and its derived statistics adapter.
   */
  statsResult?: Promise<CapabilityResult<SubjectStatsData>>;
}

const SUBJECT_OPERATION = 'GET /v0/subjects/{subject_id}';
const CAST_OPERATION = 'GET /v0/subjects/{subject_id}/characters';
const STAFF_OPERATION = 'GET /v0/subjects/{subject_id}/persons';
const RELATIONS_OPERATION = 'GET /v0/subjects/{subject_id}/subjects';
const STATS_OPERATION = 'GET /v0/subjects/{subject_id} (rating/collection fields)';
const COMPOSITION_OPERATION = 'subject-overview-composition';
const COMPOSITION_FORMULA_VERSION = 'subject-overview-composition-v1';
const COMPOSITION_DESCRIPTION =
  'Deterministically composes subject, stats, cast, staff, and relations in that order; preserves each section state including partial, unavailable, and not-computable states, applies the recorded section and actor limits, and derives only from constituent official-v0 observations without asserting a new upstream source.';
const MAX_ACTORS_PER_CHARACTER = 4;
const MAX_ACTOR_REFERENCES = 32;

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

function emptyActorCoverage(): SubjectOverviewActorCoverage {
  return { observed: 0, returned: 0, truncated: false };
}

function actorLimits() {
  return {
    perCharacter: MAX_ACTORS_PER_CHARACTER,
    total: MAX_ACTOR_REFERENCES,
  };
}

function mapProviderState(
  state: CapabilityResult<SubjectStatsData>['state'],
  hasData: boolean,
): SubjectOverviewSectionState {
  switch (state) {
    case 'ok':
      return hasData ? 'complete' : 'partial';
    case 'partial':
    case 'stale':
    case 'conflict':
      return 'partial';
    case 'not_computable':
    case 'unsupported':
      return 'not_computable';
    case 'auth_required':
    case 'permission_denied':
    case 'unavailable':
    case 'not_found':
    case 'upstream_error':
      return 'unavailable';
  }
}

function providerStateSucceeded(state: CapabilityResult<SubjectStatsData>['state']): boolean {
  return state === 'ok' || state === 'partial' || state === 'stale' || state === 'conflict';
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

function mapConflictSource(source: {
  class: string;
  provider: string;
  operation?: string;
  version?: string;
  experimental?: boolean;
}): SubjectOverviewConflictSource {
  return {
    class: source.class,
    provider: source.provider,
    ...(source.operation ? { operation: source.operation } : {}),
    ...(source.version ? { version: source.version } : {}),
    ...(source.experimental === undefined ? {} : { experimental: source.experimental }),
  };
}

function mapConflictEvidence(ref: {
  source: {
    class: string;
    provider: string;
    operation?: string;
    version?: string;
    experimental?: boolean;
  };
  retrievedAt: string;
  entity?: { type: string; id: string | number };
  fieldPath?: string;
  freshness?: { state: string; expiresAt?: string; sourceAgeMs?: number };
  authScope?: string;
  confidence?: string;
  formula?: string;
}): SubjectOverviewConflictEvidence {
  return {
    source: mapConflictSource(ref.source),
    retrievedAt: ref.retrievedAt,
    ...(ref.entity ? { entity: { ...ref.entity } } : {}),
    ...(ref.fieldPath ? { fieldPath: ref.fieldPath } : {}),
    ...(ref.freshness ? { freshness: { ...ref.freshness } } : {}),
    ...(ref.authScope ? { authScope: ref.authScope } : {}),
    ...(ref.confidence ? { confidence: ref.confidence } : {}),
    ...(ref.formula ? { formula: ref.formula } : {}),
  };
}

function mapProviderConflicts(
  result: CapabilityResult<SubjectStatsData>,
): SubjectOverviewStatsConflict[] | undefined {
  if (!result.conflicts || result.conflicts.length === 0) return undefined;
  return result.conflicts.map((conflict) => ({
    state: 'conflict' as const,
    reason: conflict.reason,
    ...(conflict.resolution ? { resolution: conflict.resolution } : {}),
    candidates: conflict.candidates.map((candidate) => ({
      source: mapConflictSource(candidate.source),
      value: candidate.value,
      ...(candidate.evidence
        ? { evidence: candidate.evidence.map((ref) => mapConflictEvidence(ref)) }
        : {}),
    })),
  }));
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
  return Array.from(operations.values());
}

function groupSubjectStaffByRawRelation(
  members: readonly SubjectStaffMember[],
): SubjectStaffGroup[] {
  const groups = new Map<string, Set<number>>();
  for (const member of members) {
    const rawRelation = member.rawRelation ?? '';
    const relation = rawRelation.length > 0 ? rawRelation : member.relation.trim() || '未知';
    const group = groups.get(relation) || new Set<number>();
    group.add(member.id);
    groups.set(relation, group);
  }

  return Array.from(groups.entries())
    .map(([relation, memberIds]) => ({
      relation,
      count: memberIds.size,
      memberIds: Array.from(memberIds),
    }))
    .sort((left, right) => right.count - left.count || left.relation.localeCompare(right.relation));
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
    cast: {
      state: 'unavailable',
      items: [],
      coverage: unavailableCoverage(),
      actorCoverage: emptyActorCoverage(),
    },
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
      actorLimits: actorLimits(),
    },
    evidence: [],
    limitations: [],
    warnings: [],
  };
}

interface TimedOperation<T> {
  attemptedAt: string;
  promise: Promise<{ value: T; retrievedAt: string }>;
}

function startTimedOperation<T>(operation: () => Promise<T>): TimedOperation<T> {
  const attemptedAt = new Date().toISOString();
  const promise = Promise.resolve()
    .then(operation)
    .then((value) => ({ value, retrievedAt: new Date().toISOString() }));
  return { attemptedAt, promise };
}

function statsEvidence(
  result: CapabilityResult<SubjectStatsData>,
  attemptedAt: string,
  retrievedAt: string,
): SubjectOverviewEvidence[] {
  if (!providerStateSucceeded(result.state)) {
    return [{ source: 'official-v0', operation: STATS_OPERATION, attemptedAt }];
  }

  const mapped = mapEvidence(result);
  if (mapped.length > 0) return mapped.map((item) => ({ ...item, attemptedAt }));
  return [
    {
      source: 'official-v0',
      operation: STATS_OPERATION,
      attemptedAt,
      retrievedAt: result.retrievedAt || retrievedAt,
    },
  ];
}

export async function getSubjectOverview(
  subjectId: number,
  limits: SubjectOverviewLimits,
  dependencies: SubjectOverviewDependencies,
): Promise<SubjectOverviewResult> {
  const subjectAttemptedAt = new Date().toISOString();
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
      attemptedAt: subjectAttemptedAt,
    });
    result.warnings.push({
      ...failureWarning('subject', error, '官方条目详情不可用，未继续请求概览的其他区段。'),
      code:
        publicError.code === 'NOT_FOUND' ? 'UPSTREAM_NOT_FOUND' : 'UPSTREAM_SUBJECT_UNAVAILABLE',
    });
    result.limitations.push('条目详情不可用时，不对统计、角色、职员或关联条目做猜测。');
    return result;
  }

  const subjectRetrievedAt = new Date().toISOString();
  const evidence: SubjectOverviewEvidence[] = [
    {
      source: 'official-v0',
      operation: SUBJECT_OPERATION,
      attemptedAt: subjectAttemptedAt,
      retrievedAt: subjectRetrievedAt,
    },
  ];
  const characterService = new CharacterService(dependencies.client);
  const personService = new PersonService(dependencies.client);
  const statsRequest = dependencies.statsResult
    ? {
        attemptedAt: new Date().toISOString(),
        promise: dependencies.statsResult.then((value) => ({
          value,
          retrievedAt: value.retrievedAt || new Date().toISOString(),
        })),
      }
    : dependencies.providerRegistry
      ? startTimedOperation(() =>
          dependencies.providerRegistry!.getSubjectStats(subjectId, { authScope: 'public' }),
        )
      : undefined;
  const castRequest = startTimedOperation(() =>
    getSubjectCast(characterService, subjectId, { limit: limits.maxCast }),
  );
  const staffRequest = startTimedOperation(() =>
    personService.getSubjectStaff(subjectId, limits.maxStaff),
  );
  const relationsRequest = startTimedOperation(() => subjectService.getSubjectRelations(subjectId));
  const settled = await Promise.allSettled([
    statsRequest?.promise ?? Promise.resolve(undefined),
    castRequest.promise,
    staffRequest.promise,
    relationsRequest.promise,
  ]);
  const [statsResult, castResult, staffResult, relationsResult] = settled;
  const warnings: SubjectOverviewWarning[] = [];
  let successfulSections = 0;

  let stats: SubjectOverviewResult['stats'];
  if (statsResult.status === 'fulfilled' && statsResult.value) {
    const providerResult = statsResult.value.value as CapabilityResult<SubjectStatsData>;
    const state = mapProviderState(providerResult.state, Boolean(providerResult.data));
    const conflicts = mapProviderConflicts(providerResult);
    stats = {
      state,
      data: providerResult.data ? mapStats(providerResult.data) : undefined,
      coverage: coverage(state, providerResult.data ? 1 : 0, providerResult.data ? 1 : 0),
      ...(conflicts ? { conflicts } : {}),
    };
    evidence.push(
      ...statsEvidence(providerResult, statsRequest!.attemptedAt, statsResult.value.retrievedAt),
    );
    warnings.push(...mapProviderWarnings(providerResult));
    if (conflicts && !providerResult.warnings?.length) {
      warnings.push({
        code: 'SUBJECT_STATS_CONFLICT',
        state: 'partial',
        section: 'stats',
        message: `${conflicts.length} 个官方统计冲突保留候选值，未选择单一真值。`,
      });
    }
    if (providerStateSucceeded(providerResult.state)) successfulSections += 1;
    if (state === 'unavailable' && !providerResult.warnings?.length) {
      warnings.push({
        code: 'SUBJECT_STATS_UNAVAILABLE',
        state: 'unavailable',
        section: 'stats',
        message: '官方统计字段不可用，未填充猜测的统计值。',
      });
    } else if (state === 'not_computable' && !providerResult.warnings?.length) {
      warnings.push({
        code: 'SUBJECT_STATS_NOT_COMPUTABLE',
        state: 'not_computable',
        section: 'stats',
        message: '当前来源无法计算官方统计字段，未填充猜测的统计值。',
      });
    }
  } else if (statsResult.status === 'rejected') {
    stats = { state: 'unavailable', coverage: unavailableCoverage() };
    evidence.push({
      source: 'official-v0',
      operation: STATS_OPERATION,
      attemptedAt: statsRequest!.attemptedAt,
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
    const castData = castResult.value.value;
    let actorReferencesObserved = 0;
    let actorReferencesReturned = 0;
    const items: SubjectOverviewCastItem[] = castData.cast.map((item) => {
      const observed = item.actors.length;
      const available = Math.max(0, MAX_ACTOR_REFERENCES - actorReferencesReturned);
      const actors = item.actors
        .slice(0, Math.min(MAX_ACTORS_PER_CHARACTER, available))
        .map((actor) => ({
          id: actor.id,
          name: actor.name,
          career: actor.career,
          image: actor.image,
        }));
      actorReferencesObserved += observed;
      actorReferencesReturned += actors.length;
      return {
        character: item.character,
        relation: item.relation,
        actors,
        actorCoverage: {
          observed,
          returned: actors.length,
          truncated: actors.length < observed,
        },
      };
    });
    const actorCoverage: SubjectOverviewActorCoverage = {
      observed: actorReferencesObserved,
      returned: actorReferencesReturned,
      truncated: actorReferencesReturned < actorReferencesObserved,
    };
    const truncated = castData.truncated || actorCoverage.truncated;
    const state: SubjectOverviewSectionState = truncated ? 'partial' : 'complete';
    cast = {
      state,
      items,
      coverage: coverage(state, castData.observed, castData.returned, truncated),
      actorCoverage,
    };
    successfulSections += 1;
    if (castData.truncated) {
      warnings.push({
        code: 'CAST_OUTPUT_TRUNCATED',
        state: 'partial',
        section: 'cast',
        message: '角色/声优区段达到本次显示上限，未宣称完整角色表。',
      });
    }
    if (actorCoverage.truncated) {
      warnings.push({
        code: 'CAST_ACTOR_OUTPUT_TRUNCATED',
        state: 'partial',
        section: 'cast',
        message: `每个角色最多返回 ${MAX_ACTORS_PER_CHARACTER} 个声优且全区段最多返回 ${MAX_ACTOR_REFERENCES} 个声优引用，未宣称完整声优表。`,
      });
    }
    evidence.push({
      source: 'official-v0',
      operation: CAST_OPERATION,
      attemptedAt: castRequest.attemptedAt,
      retrievedAt: castResult.value.retrievedAt,
    });
  } else {
    cast = {
      state: 'unavailable',
      items: [],
      coverage: unavailableCoverage(),
      actorCoverage: emptyActorCoverage(),
    };
    evidence.push({
      source: 'official-v0',
      operation: CAST_OPERATION,
      attemptedAt: castRequest.attemptedAt,
    });
    warnings.push(
      failureWarning('cast', castResult.reason, '角色与声优区段不可用，未生成猜测内容。'),
    );
  }

  let staff: SubjectOverviewResult['staff'];
  if (staffResult.status === 'fulfilled') {
    const staffData = staffResult.value.value;
    const state: SubjectOverviewSectionState = staffData.truncated ? 'partial' : 'complete';
    staff = {
      state,
      items: staffData.items,
      groups: groupSubjectStaffByRawRelation(staffData.items),
      coverage: coverage(state, staffData.observed, staffData.returned, staffData.truncated),
    };
    successfulSections += 1;
    if (staffData.truncated) {
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
      attemptedAt: staffRequest.attemptedAt,
      retrievedAt: staffResult.value.retrievedAt,
    });
  } else {
    staff = { state: 'unavailable', items: [], groups: [], coverage: unavailableCoverage() };
    evidence.push({
      source: 'official-v0',
      operation: STAFF_OPERATION,
      attemptedAt: staffRequest.attemptedAt,
    });
    warnings.push(
      failureWarning('staff', staffResult.reason, '制作人员区段不可用，未生成猜测内容。'),
    );
  }

  let relations: SubjectOverviewResult['relations'];
  if (relationsResult.status === 'fulfilled') {
    const relationData = relationsResult.value.value;
    const observed = relationData.length;
    const items = relationData.slice(0, limits.maxRelations);
    const truncated = observed > items.length;
    const state: SubjectOverviewSectionState = truncated ? 'partial' : 'complete';
    relations = { state, items, coverage: coverage(state, observed, items.length, truncated) };
    successfulSections += 1;
    evidence.push({
      source: 'official-v0',
      operation: RELATIONS_OPERATION,
      attemptedAt: relationsRequest.attemptedAt,
      retrievedAt: relationsResult.value.retrievedAt,
    });
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
      attemptedAt: relationsRequest.attemptedAt,
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
      sourceRequestsAttempted: 4 + (statsRequest ? 1 : 0),
      sourceRequestsSucceeded: successfulSections + 1,
      sectionsComplete: 0,
      sectionsPartial: 0,
      sectionsUnavailable: 0,
      sectionsNotComputable: 0,
      truncatedSections: [],
      limits,
      actorLimits: actorLimits(),
    },
    evidence: [
      ...evidence,
      {
        source: 'derived-s7',
        operation: COMPOSITION_OPERATION,
        formulaVersion: COMPOSITION_FORMULA_VERSION,
        description: COMPOSITION_DESCRIPTION,
        retrievedAt: new Date().toISOString(),
      },
    ],
    limitations: [
      '每个区段只代表本次官方 v0 有界响应与本次 cap，不宣称完整角色、职员或关联条目历史。',
      '制作人员和关联条目保留官方原始标签；本结果不推断更宽泛的职位、前后传或推荐语义。',
      '统计是当前官方快照字段；本结果不计算历史趋势、社区热度或跨时间比较。',
    ],
    warnings,
  };
  return finalize(result, limits);
}
