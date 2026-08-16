import { BangumiError } from '@bangumi-agent-kit/bangumi-transport';
import type {
  SubjectComparisonMetric,
  SubjectComparisonMetricKey,
  SubjectComparisonResult,
  SubjectComparisonState,
  SubjectComparisonSubject,
  SubjectComparisonSourceSummary,
  SubjectComparisonStatsConflict,
  SubjectComparisonStatsKey,
  SubjectStatsConflict,
  SubjectStatsIntelligenceResult,
  SubjectOverviewResult,
  SubjectOverviewStatsConflict,
  SubjectOverviewSectionState,
} from '@bangumi-agent-kit/bangumi-core';
import {
  getSubjectOverview,
  type SubjectOverviewDependencies,
  type SubjectOverviewLimits,
} from './subject-overview.js';
import { getSubjectStatsIntelligence } from './subject-stats-intelligence.js';

export interface SubjectComparisonOptions {
  maxCast?: number;
  maxStaff?: number;
  maxRelations?: number;
}

const FORMULA_VERSION = 'subject-comparison-v2' as const;
const DELTA_PRECISION: Record<SubjectComparisonMetricKey, number> = {
  episodesReported: 0,
  totalEpisodesReported: 0,
  score: 1,
  rank: 0,
  ratingTotal: 0,
  collectionTotal: 0,
  ratingPopulation: 0,
  ratingMean: 1,
  ratingStandardDeviation: 2,
  collectionPopulation: 0,
  collectionCompletionRate: 3,
};
const DELTA_POLICY_DESCRIPTION =
  '差值按第二个条目减第一个条目；评分差值规范化为 1 位小数，话数、排名和人数差值规范化为整数；非有限差值保持不可计算。';
const DEFAULT_LIMITS: SubjectOverviewLimits = {
  maxCast: 4,
  maxStaff: 12,
  maxRelations: 8,
};
const COMPARISON_STATS_KEYS: SubjectComparisonStatsKey[] = [
  'score',
  'rank',
  'ratingTotal',
  'collectionTotal',
];
const OVERLAP_FORMULA_VERSION = 'subject-comparison-overlap-v1' as const;
const MAX_OVERLAP_ITEMS = 24;
const OVERLAP_DESCRIPTION =
  '按官方 v0 本次有界角色声优与制作人员关系中的稳定人物 ID 求交集；保留每侧角色/原始职位标签、重复关系的确定性去重、缺失 ID、section/output 截断和来源状态，不把未读取或不可用的关系解释为不存在。';
const STATISTICS_FORMULA_VERSION = 'subject-comparison-statistics-v1' as const;
const STATISTICS_DESCRIPTION =
  '在同一对官方 v0 统计观察上，保留评分直方图、收藏桶及其确定性百分比/均值/总体标准差/观察完成率公式；差值只在两侧对应公式状态 complete 且有限时计算，不产生推荐、质量或历史趋势结论。';

function bounded(value: number | undefined, fallback: number, maximum: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(1, Math.trunc(value as number)));
}

function validateSubjectIds(subjectIds: readonly number[]): [number, number] {
  if (
    subjectIds.length !== 2 ||
    subjectIds.some((subjectId) => !Number.isInteger(subjectId) || subjectId <= 0) ||
    subjectIds[0] === subjectIds[1]
  ) {
    throw new BangumiError(
      'VALIDATION_ERROR',
      'subjectIds 必须包含两个不同的正整数条目 ID',
      false,
      400,
    );
  }
  return [subjectIds[0]!, subjectIds[1]!];
}

function latestTimestamp(values: Array<string | undefined>): string | undefined {
  return values
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);
}

function summarizeSource<T extends SubjectComparisonSourceSummary['class']>(
  evidence: SubjectOverviewResult['evidence'],
  sourceClass: T,
  fallbackAttemptedAt: string,
): SubjectComparisonSourceSummary & { class: T } {
  const matching = evidence.filter((item) => item.source === sourceClass);
  const attemptedAt = earliestTimestamp([
    ...matching.map((item) => item.attemptedAt),
    fallbackAttemptedAt,
  ]);
  const retrievedAt = latestTimestamp(matching.map((item) => item.retrievedAt));
  return {
    class: sourceClass,
    operations: Array.from(new Set(matching.map((item) => item.operation))),
    attemptedAt,
    ...(retrievedAt ? { retrievedAt } : {}),
  };
}

function mergeSources<T extends SubjectComparisonSourceSummary['class']>(
  sources: Array<SubjectComparisonSourceSummary & { class: T }>,
  sourceClass: T,
  fallbackAttemptedAt: string,
): SubjectComparisonSourceSummary & { class: T } {
  const attemptedAt = earliestTimestamp([
    ...sources.map((source) => source.attemptedAt),
    fallbackAttemptedAt,
  ]);
  const retrievedAt = latestTimestamp(sources.map((source) => source.retrievedAt));
  return {
    class: sourceClass,
    operations: Array.from(new Set(sources.flatMap((source) => source.operations))),
    attemptedAt,
    ...(retrievedAt ? { retrievedAt } : {}),
  };
}

function earliestTimestamp(values: Array<string | undefined>): string {
  return (
    values.filter((value): value is string => Boolean(value)).sort()[0] || new Date().toISOString()
  );
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function collectionTotal(value: unknown, presence?: object): number | undefined {
  if (!value || typeof value !== 'object') return undefined;
  if (presence && Object.values(presence).some((present) => !present)) return undefined;
  const values = Object.values(value as Record<string, unknown>);
  if (values.some((item) => finiteNumber(item) === undefined)) return undefined;
  const total = values.reduce<number>((sum, item) => sum + (finiteNumber(item) || 0), 0);
  return Number.isFinite(total) ? total : undefined;
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function candidateMetricValue(value: unknown, key: SubjectComparisonStatsKey): number | undefined {
  const direct = finiteNumber(value);
  if (direct !== undefined) return direct;
  const details = record(value);
  if (!details) return undefined;
  const field = finiteNumber(details[key]);
  if (field !== undefined) return field;
  if (key === 'collectionTotal') {
    return collectionTotal(details.collection ?? details.collectionCounts);
  }
  return undefined;
}

function providerConflictKeys(conflict: SubjectOverviewStatsConflict): SubjectComparisonStatsKey[] {
  const hints = [
    conflict.reason,
    ...conflict.candidates.flatMap((candidate) =>
      (candidate.evidence || []).map((evidence) => evidence.fieldPath || ''),
    ),
  ]
    .join(' ')
    .toLowerCase();
  const keys = new Set<SubjectComparisonStatsKey>();
  if (/score|rating[._ -]?score|评分/iu.test(hints)) keys.add('score');
  if (/rank|rating[._ -]?rank|排名/iu.test(hints)) keys.add('rank');
  if (/rating[._ -]?total|rating[._ -]?count|评分人数/iu.test(hints)) keys.add('ratingTotal');
  if (/collection|收藏/iu.test(hints)) keys.add('collectionTotal');

  for (const key of COMPARISON_STATS_KEYS) {
    if (
      conflict.candidates.some(
        (candidate) =>
          record(candidate.value) !== undefined &&
          candidateMetricValue(candidate.value, key) !== undefined,
      )
    ) {
      keys.add(key);
    }
  }
  return keys.size > 0
    ? COMPARISON_STATS_KEYS.filter((key) => keys.has(key))
    : COMPARISON_STATS_KEYS;
}

function mapProviderConflict(
  key: SubjectComparisonStatsKey,
  conflict: SubjectOverviewStatsConflict,
): SubjectComparisonStatsConflict {
  const targetKeys = providerConflictKeys(conflict);
  return {
    reason: conflict.reason,
    ...(conflict.resolution ? { resolution: conflict.resolution } : {}),
    candidates: conflict.candidates.map((candidate) => {
      const metricValue =
        record(candidate.value) || targetKeys.length === 1
          ? candidateMetricValue(candidate.value, key)
          : undefined;
      return metricValue === undefined ? { ...candidate } : { ...candidate, metricValue };
    }),
  };
}

function mapStatisticsSectionState(
  statistics: SubjectStatsIntelligenceResult,
): SubjectOverviewSectionState {
  switch (statistics.state) {
    case 'complete':
      return 'complete';
    case 'not_computable':
      return 'not_computable';
    case 'unavailable':
    case 'not_found':
      return 'unavailable';
    case 'partial':
    case 'conflict':
      return 'partial';
  }
}

function mapStatisticsWarningState(
  state: SubjectStatsIntelligenceResult['warnings'][number]['state'],
): SubjectOverviewSectionState {
  if (state === 'complete') return 'complete';
  if (state === 'not_computable') return 'not_computable';
  if (state === 'unavailable' || state === 'not_found') return 'unavailable';
  return 'partial';
}

function mergeSourceSummary<T extends SubjectComparisonSourceSummary['class']>(
  summary: SubjectComparisonSourceSummary & { class: T },
  operations: string[],
  retrievedAt?: string,
): SubjectComparisonSourceSummary & { class: T } {
  return {
    ...summary,
    operations: Array.from(new Set([...summary.operations, ...operations])),
    ...(latestTimestamp([summary.retrievedAt, retrievedAt])
      ? { retrievedAt: latestTimestamp([summary.retrievedAt, retrievedAt]) }
      : {}),
  };
}

function mapSubjectOverview(
  overview: SubjectOverviewResult,
  limits: SubjectOverviewLimits,
  statistics?: SubjectStatsIntelligenceResult,
): SubjectComparisonSubject {
  // A provider may finish after the identity request has already established
  // NOT_FOUND/UNAVAILABLE. Do not attach an otherwise valid-looking stats
  // payload to an unknown subject.
  if (!overview.subject) statistics = undefined;
  const statsData = statistics?.raw ?? overview.stats.data;
  const total = collectionTotal(statsData?.collection, statsData?.collectionPresence);
  const subjectStats: Partial<Record<SubjectComparisonStatsKey, number | undefined>> = {
    score: finiteNumber(overview.subject?.score),
    rank: finiteNumber(overview.subject?.rank),
    ratingTotal: finiteNumber(overview.subject?.ratingTotal),
    collectionTotal: collectionTotal(overview.subject?.collectionCounts),
  };
  const providerStats: Partial<Record<SubjectComparisonStatsKey, number | undefined>> = {
    score: finiteNumber(statsData?.score),
    rank: finiteNumber(statsData?.rank),
    ratingTotal: finiteNumber(statsData?.ratingTotal),
    collectionTotal: total,
  };
  const conflicts = (Object.keys(providerStats) as SubjectComparisonStatsKey[]).reduce(
    (result, key) => {
      const subjectValue = subjectStats[key];
      const statsValue = providerStats[key];
      if (subjectValue !== undefined && statsValue !== undefined && subjectValue !== statsValue) {
        result[key] = { subjectValue, statsValue };
      }
      return result;
    },
    {} as Partial<Record<SubjectComparisonStatsKey, SubjectComparisonStatsConflict>>,
  );
  for (const providerConflict of overview.stats.conflicts || []) {
    for (const key of providerConflictKeys(providerConflict)) {
      const mapped = mapProviderConflict(key, providerConflict);
      const existing = conflicts[key];
      conflicts[key] = {
        ...(existing || {}),
        ...(mapped.reason && !existing?.reason ? { reason: mapped.reason } : {}),
        ...(mapped.resolution && !existing?.resolution ? { resolution: mapped.resolution } : {}),
        candidates: [...(existing?.candidates || []), ...(mapped.candidates || [])],
      };
    }
  }
  const evidence = overview.evidence;
  const attemptedAt = earliestTimestamp(evidence.map((item) => item.attemptedAt));
  const statisticsSectionState = statistics
    ? mapStatisticsSectionState(statistics)
    : overview.stats.state;
  const state: SubjectComparisonSubject['state'] =
    overview.state === 'not_found'
      ? 'not_found'
      : overview.state === 'unavailable'
        ? 'unavailable'
        : statisticsSectionState === 'complete'
          ? overview.state
          : 'partial';
  const officialSource = mergeSourceSummary(
    summarizeSource(evidence, 'official-v0', attemptedAt),
    statistics?.source.official.operations || [],
    statistics?.source.official.retrievedAt,
  );
  const derivedSource = mergeSourceSummary(
    summarizeSource(evidence, 'derived-s7', attemptedAt),
    statistics?.source.derived.operations || [],
    statistics?.source.derived.retrievedAt,
  );
  const statisticsWarnings =
    statistics?.warnings.map((warning) => ({
      code: warning.code,
      state: mapStatisticsWarningState(warning.state),
      section: 'stats' as const,
      message: warning.message,
    })) || [];
  const projectedSectionStates = [
    statisticsSectionState,
    overview.cast.state,
    overview.staff.state,
    overview.relations.state,
  ];
  const projectedCoverage = {
    complete: projectedSectionStates.filter((section) => section === 'complete').length,
    partial: projectedSectionStates.filter((section) => section === 'partial').length,
    unavailable: projectedSectionStates.filter((section) => section === 'unavailable').length,
    notComputable: projectedSectionStates.filter((section) => section === 'not_computable').length,
  };
  return {
    subjectId: overview.subjectId,
    state,
    ...(overview.subject
      ? {
          subject: {
            id: overview.subject.id,
            type: overview.subject.type,
            name: overview.subject.name,
            ...(overview.subject.nameCn ? { nameCn: overview.subject.nameCn } : {}),
            ...(overview.subject.date ? { date: overview.subject.date } : {}),
            ...(overview.subject.platform ? { platform: overview.subject.platform } : {}),
            ...(overview.subject.eps === undefined
              ? {}
              : { episodesReported: overview.subject.eps }),
            ...(overview.subject.totalEpisodes === undefined
              ? {}
              : { totalEpisodesReported: overview.subject.totalEpisodes }),
          },
        }
      : {}),
    stats: {
      state: statisticsSectionState,
      ...(providerStats.score === undefined ? {} : { score: providerStats.score }),
      ...(providerStats.rank === undefined ? {} : { rank: providerStats.rank }),
      ...(providerStats.ratingTotal === undefined
        ? {}
        : { ratingTotal: providerStats.ratingTotal }),
      ...(total === undefined ? {} : { collectionTotal: total }),
      ...(Object.keys(conflicts).length > 0 ? { conflicts } : {}),
    },
    sections: {
      stats: statisticsSectionState,
      cast: overview.cast.state,
      staff: overview.staff.state,
      relations: overview.relations.state,
    },
    coverage: {
      sourceRequestsAttempted: overview.coverage.sourceRequestsAttempted,
      sourceRequestsSucceeded: overview.coverage.sourceRequestsSucceeded,
      sectionsComplete: projectedCoverage.complete,
      sectionsPartial: projectedCoverage.partial,
      sectionsUnavailable: projectedCoverage.unavailable,
      sectionsNotComputable: projectedCoverage.notComputable,
      truncatedSections: [...overview.coverage.truncatedSections],
      limits,
    },
    source: {
      official: officialSource,
      derived: derivedSource,
    },
    ...(statistics ? { statistics } : {}),
    evidence,
    warnings: [...overview.warnings, ...statisticsWarnings],
    limitations: Array.from(new Set([...overview.limitations, ...(statistics?.limitations || [])])),
  };
}

function metric(
  key: SubjectComparisonMetricKey,
  label: string,
  left: number | undefined,
  right: number | undefined,
  leftConflict?: SubjectComparisonStatsConflict,
  rightConflict?: SubjectComparisonStatsConflict,
): SubjectComparisonMetric {
  const deltaPrecision = DELTA_PRECISION[key];
  const values: [number | null, number | null] = [left ?? null, right ?? null];
  const conflicts = [
    leftConflict ? { side: 'A' as const, ...leftConflict } : undefined,
    rightConflict ? { side: 'B' as const, ...rightConflict } : undefined,
  ].filter((value): value is NonNullable<typeof value> => Boolean(value));
  if (conflicts.length > 0) {
    return { key, label, values, delta: null, deltaPrecision, state: 'conflict', conflicts };
  }
  const complete = values[0] !== null && values[1] !== null;
  const rawDelta = complete ? values[1]! - values[0]! : undefined;
  const scale = 10 ** deltaPrecision;
  const roundedDelta =
    rawDelta !== undefined && Number.isFinite(rawDelta)
      ? (() => {
          const rounded = Math.round(rawDelta * scale) / scale;
          return Number.isFinite(rounded) ? rounded : rawDelta;
        })()
      : undefined;
  const delta = roundedDelta !== undefined && Object.is(roundedDelta, -0) ? 0 : roundedDelta;
  return {
    key,
    label,
    values,
    delta: delta ?? null,
    deltaPrecision,
    state: complete && delta !== undefined ? 'complete' : 'unknown',
  };
}

type StatisticsMetricState = SubjectStatsIntelligenceResult['rating']['state'];

function ratingConflictAffects(
  statistics: SubjectStatsIntelligenceResult,
  field: 'population' | 'mean' | 'standardDeviation',
): boolean {
  return (statistics.rating.conflicts || []).some((conflict) => {
    if (conflict.scope !== 'rating' && conflict.scope !== 'unknown') return false;
    const paths = conflict.fieldPaths || [];
    if (paths.length === 0) return true;
    if (paths.some((path) => /^rating\.count\.|ratingHistogram|histogramPopulation/iu.test(path))) {
      return true;
    }
    if (field === 'mean') {
      return paths.some((path) => /histogramMean|rating\.score|^score$/iu.test(path));
    }
    return false;
  });
}

function statisticsMetric(
  key: SubjectComparisonMetricKey,
  label: string,
  left: number | undefined,
  right: number | undefined,
  leftState: StatisticsMetricState,
  rightState: StatisticsMetricState,
): SubjectComparisonMetric {
  const result = metric(key, label, left, right);
  if (leftState === 'conflict' || rightState === 'conflict') {
    return { ...result, delta: null, state: 'conflict' };
  }
  if (result.state !== 'complete' || leftState !== 'complete' || rightState !== 'complete') {
    return { ...result, delta: null, state: 'unknown' };
  }
  return result;
}

function ratingMetricState(
  statistics: SubjectStatsIntelligenceResult | undefined,
  field: 'population' | 'mean' | 'standardDeviation',
): StatisticsMetricState {
  if (!statistics) return 'unavailable';
  if (ratingConflictAffects(statistics, field)) return 'conflict';
  if (
    statistics.rating.state === 'conflict' &&
    field !== 'mean' &&
    statistics.rating[field] !== undefined
  ) {
    // A histogram mean conflict does not invalidate the observed population
    // or the independently derived standard deviation.
    return 'complete';
  }
  return statistics.rating.state;
}

function buildStatisticsMetrics(
  subjects: [SubjectComparisonSubject, SubjectComparisonSubject],
): SubjectComparisonMetric[] {
  const [left, right] = subjects;
  const leftStats = left.statistics;
  const rightStats = right.statistics;
  if (!leftStats && !rightStats) return [];
  return [
    statisticsMetric(
      'ratingPopulation',
      '评分直方图样本数',
      leftStats?.rating.population,
      rightStats?.rating.population,
      ratingMetricState(leftStats, 'population'),
      ratingMetricState(rightStats, 'population'),
    ),
    statisticsMetric(
      'ratingMean',
      '评分直方图均值',
      leftStats?.rating.mean,
      rightStats?.rating.mean,
      ratingMetricState(leftStats, 'mean'),
      ratingMetricState(rightStats, 'mean'),
    ),
    statisticsMetric(
      'ratingStandardDeviation',
      '评分总体标准差',
      leftStats?.rating.standardDeviation,
      rightStats?.rating.standardDeviation,
      ratingMetricState(leftStats, 'standardDeviation'),
      ratingMetricState(rightStats, 'standardDeviation'),
    ),
    statisticsMetric(
      'collectionPopulation',
      '收藏分布样本数',
      leftStats?.collection.total,
      rightStats?.collection.total,
      leftStats?.collection.state || 'unavailable',
      rightStats?.collection.state || 'unavailable',
    ),
    statisticsMetric(
      'collectionCompletionRate',
      '观察完成率',
      leftStats?.collection.completionRate,
      rightStats?.collection.completionRate,
      leftStats?.collection.completionState || 'unavailable',
      rightStats?.collection.completionState || 'unavailable',
    ),
  ];
}

function statisticsConflictIdentity(conflict: SubjectStatsConflict): string {
  return JSON.stringify({
    scope: conflict.scope || 'unknown',
    reason: conflict.reason,
    fieldPaths: [...(conflict.fieldPaths || [])].sort(),
    candidates: conflict.candidates.map((candidate) => ({
      source: candidate.source,
      value: candidate.value,
      evidence: (candidate.evidence || []).map((item) => ({
        source: item.source,
        provider: item.provider,
        operation: item.operation,
        fieldPath: item.fieldPath,
        formula: item.formula,
      })),
    })),
  });
}

function buildMetrics(
  subjects: [SubjectComparisonSubject, SubjectComparisonSubject],
): SubjectComparisonMetric[] {
  const [left, right] = subjects;
  return [
    metric(
      'episodesReported',
      '条目报告话数',
      left.subject?.episodesReported,
      right.subject?.episodesReported,
    ),
    metric(
      'totalEpisodesReported',
      '条目报告总话数',
      left.subject?.totalEpisodesReported,
      right.subject?.totalEpisodesReported,
    ),
    metric(
      'score',
      '官方评分',
      left.stats.score,
      right.stats.score,
      left.stats.conflicts?.score,
      right.stats.conflicts?.score,
    ),
    metric(
      'rank',
      '官方排名',
      left.stats.rank,
      right.stats.rank,
      left.stats.conflicts?.rank,
      right.stats.conflicts?.rank,
    ),
    metric(
      'ratingTotal',
      '评分人数',
      left.stats.ratingTotal,
      right.stats.ratingTotal,
      left.stats.conflicts?.ratingTotal,
      right.stats.conflicts?.ratingTotal,
    ),
    metric(
      'collectionTotal',
      '收藏总数',
      left.stats.collectionTotal,
      right.stats.collectionTotal,
      left.stats.conflicts?.collectionTotal,
      right.stats.conflicts?.collectionTotal,
    ),
    ...buildStatisticsMetrics(subjects),
  ];
}

type OverlapSide = 'A' | 'B';

interface CastAccumulator {
  names: Set<string>;
  career: Set<string>;
  credits: Map<
    string,
    {
      subjectId: number;
      characters: Map<string, { characterId?: number; name: string; relation: string }>;
    }
  >;
}

interface StaffAccumulator {
  names: Set<string>;
  career: Set<string>;
  credits: Map<
    string,
    { subjectId: number; rawRelations: Set<string>; relations: Set<string>; eps: Set<string> }
  >;
}

interface OverlapSideCoverage {
  state: SubjectOverviewSectionState;
  rowsObserved: number;
  rowsReturned: number;
  uniqueIdsReturned: number;
  missingIdRows: number;
  truncated: boolean;
}

interface CastSideData {
  people: Map<number, CastAccumulator>;
  coverage: OverlapSideCoverage;
}

interface StaffSideData {
  people: Map<number, StaffAccumulator>;
  coverage: OverlapSideCoverage;
}

function positiveId(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined;
}

function sortedStrings(values: Iterable<string>): string[] {
  return [...new Set([...values].filter((value) => value.length > 0))].sort((left, right) =>
    left.localeCompare(right),
  );
}

function overlapState(
  left: SubjectOverviewSectionState,
  right: SubjectOverviewSectionState,
  missingIds: number,
  outputTruncated: boolean,
): SubjectOverviewSectionState {
  if (left === 'not_computable' || right === 'not_computable') return 'not_computable';
  if (left === 'unavailable' || right === 'unavailable') return 'unavailable';
  if (left === 'partial' || right === 'partial' || missingIds > 0 || outputTruncated) {
    return 'partial';
  }
  return 'complete';
}

function overlapSideCoverage(
  state: SubjectOverviewSectionState,
  rowsObserved: number,
  rowsReturned: number,
  uniqueIdsReturned: number,
  missingIdRows: number,
  truncated: boolean,
): OverlapSideCoverage {
  return {
    state,
    rowsObserved,
    rowsReturned,
    uniqueIdsReturned,
    missingIdRows,
    truncated: truncated || missingIdRows > 0,
  };
}

function collectCastSide(overview: SubjectOverviewResult, subjectId: number): CastSideData {
  const people = new Map<number, CastAccumulator>();
  let missingIdRows = 0;
  let rowsReturned = 0;

  for (const item of overview.cast.items) {
    for (const actor of item.actors) {
      rowsReturned += 1;
      const personId = positiveId(actor.id);
      if (personId === undefined) {
        missingIdRows += 1;
        continue;
      }
      const person = people.get(personId) || {
        names: new Set<string>(),
        career: new Set<string>(),
        credits: new Map(),
      };
      if (actor.name.trim()) person.names.add(actor.name.trim());
      for (const career of actor.career) {
        if (career.trim()) person.career.add(career.trim());
      }
      const creditKey = String(subjectId);
      const credit = person.credits.get(creditKey) || {
        subjectId,
        characters: new Map(),
      };
      const characterId = positiveId(item.character.id);
      const characterName = item.character.name.trim() || `角色 ${item.character.id}`;
      const relation = item.relation.trim() || '未知';
      const characterKey = `${characterId ?? ''}|${characterName}|${relation}`;
      credit.characters.set(characterKey, { characterId, name: characterName, relation });
      person.credits.set(creditKey, credit);
      people.set(personId, person);
    }
  }

  return {
    people,
    coverage: overlapSideCoverage(
      overview.cast.state,
      overview.cast.actorCoverage.observed,
      overview.cast.actorCoverage.returned || rowsReturned,
      people.size,
      missingIdRows,
      overview.cast.coverage.truncated || overview.cast.actorCoverage.truncated,
    ),
  };
}

function collectStaffSide(overview: SubjectOverviewResult, subjectId: number): StaffSideData {
  const people = new Map<number, StaffAccumulator>();
  let missingIdRows = 0;

  for (const member of overview.staff.items) {
    const personId = positiveId(member.id);
    if (personId === undefined) {
      missingIdRows += 1;
      continue;
    }
    const person = people.get(personId) || {
      names: new Set<string>(),
      career: new Set<string>(),
      credits: new Map(),
    };
    if (member.name.trim()) person.names.add(member.name.trim());
    for (const career of member.career) {
      if (career.trim()) person.career.add(career.trim());
    }
    const creditKey = String(subjectId);
    const credit = person.credits.get(creditKey) || {
      subjectId,
      rawRelations: new Set<string>(),
      relations: new Set<string>(),
      eps: new Set<string>(),
    };
    credit.rawRelations.add(member.rawRelation ?? '');
    credit.relations.add(member.relation.trim() || '未知');
    if (member.eps.trim()) credit.eps.add(member.eps.trim());
    person.credits.set(creditKey, credit);
    people.set(personId, person);
  }

  return {
    people,
    coverage: overlapSideCoverage(
      overview.staff.state,
      overview.staff.coverage.observed,
      overview.staff.coverage.returned,
      people.size,
      missingIdRows,
      overview.staff.coverage.truncated,
    ),
  };
}

function castOverlap(
  overviews: [SubjectOverviewResult, SubjectOverviewResult],
  subjectIds: [number, number],
) {
  const sides = subjectIds.map((subjectId, index) =>
    collectCastSide(overviews[index]!, subjectId),
  ) as [CastSideData, CastSideData];
  const commonIds = [...sides[0].people.keys()]
    .filter((personId) => sides[1].people.has(personId))
    .sort((left, right) => left - right);
  const allItems = commonIds.map((personId) => {
    const credits = sides.map((side, index) => {
      const person = side.people.get(personId)!;
      return {
        side: (index === 0 ? 'A' : 'B') as OverlapSide,
        subjectId: subjectIds[index]!,
        characters: [...person.credits.values()]
          .flatMap((credit) => [...credit.characters.values()])
          .sort(
            (left, right) =>
              (left.characterId ?? Number.MAX_SAFE_INTEGER) -
                (right.characterId ?? Number.MAX_SAFE_INTEGER) ||
              left.name.localeCompare(right.name) ||
              left.relation.localeCompare(right.relation),
          ),
      };
    });
    const names = sortedStrings(
      sides.flatMap((side) => [...(side.people.get(personId)?.names || [])]),
    );
    return {
      personId,
      name: names[0] || `人物 ${personId}`,
      ...(names.length > 1 ? { nameVariants: names } : {}),
      career: sortedStrings(
        sides.flatMap((side) => [...(side.people.get(personId)?.career || [])]),
      ),
      credits,
    };
  });
  const missingIds = sides[0].coverage.missingIdRows + sides[1].coverage.missingIdRows;
  const state = overlapState(
    sides[0].coverage.state,
    sides[1].coverage.state,
    missingIds,
    allItems.length > MAX_OVERLAP_ITEMS,
  );
  const items = allItems.slice(0, MAX_OVERLAP_ITEMS);
  return {
    state,
    items,
    coverage: {
      state,
      left: sides[0].coverage,
      right: sides[1].coverage,
      ...(state === 'unavailable' || state === 'not_computable'
        ? {}
        : {
            candidateIds: new Set([...sides[0].people.keys(), ...sides[1].people.keys()]).size,
            matchedIds: allItems.length,
          }),
      returned: items.length,
      omitted: allItems.length - items.length,
      truncated:
        sides[0].coverage.truncated ||
        sides[1].coverage.truncated ||
        items.length < allItems.length,
    },
  };
}

function staffOverlap(
  overviews: [SubjectOverviewResult, SubjectOverviewResult],
  subjectIds: [number, number],
) {
  const sides = subjectIds.map((subjectId, index) =>
    collectStaffSide(overviews[index]!, subjectId),
  ) as [StaffSideData, StaffSideData];
  const commonIds = [...sides[0].people.keys()]
    .filter((personId) => sides[1].people.has(personId))
    .sort((left, right) => left - right);
  const allItems = commonIds.map((personId) => {
    const credits = sides.map((side, index) => {
      const person = side.people.get(personId)!;
      const values = [...person.credits.values()][0]!;
      return {
        side: (index === 0 ? 'A' : 'B') as OverlapSide,
        subjectId: subjectIds[index]!,
        rawRelations: sortedStrings(values.rawRelations),
        relations: sortedStrings(values.relations),
        eps: sortedStrings(values.eps),
      };
    });
    const names = sortedStrings(
      sides.flatMap((side) => [...(side.people.get(personId)?.names || [])]),
    );
    return {
      personId,
      name: names[0] || `人物 ${personId}`,
      ...(names.length > 1 ? { nameVariants: names } : {}),
      career: sortedStrings(
        sides.flatMap((side) => [...(side.people.get(personId)?.career || [])]),
      ),
      credits,
    };
  });
  const missingIds = sides[0].coverage.missingIdRows + sides[1].coverage.missingIdRows;
  const state = overlapState(
    sides[0].coverage.state,
    sides[1].coverage.state,
    missingIds,
    allItems.length > MAX_OVERLAP_ITEMS,
  );
  const items = allItems.slice(0, MAX_OVERLAP_ITEMS);
  return {
    state,
    items,
    coverage: {
      state,
      left: sides[0].coverage,
      right: sides[1].coverage,
      ...(state === 'unavailable' || state === 'not_computable'
        ? {}
        : {
            candidateIds: new Set([...sides[0].people.keys(), ...sides[1].people.keys()]).size,
            matchedIds: allItems.length,
          }),
      returned: items.length,
      omitted: allItems.length - items.length,
      truncated:
        sides[0].coverage.truncated ||
        sides[1].coverage.truncated ||
        items.length < allItems.length,
    },
  };
}

function overallState(
  subjects: [SubjectComparisonSubject, SubjectComparisonSubject],
): SubjectComparisonState {
  const states = subjects.map((subject) => subject.state);
  if (states.every((state) => state === 'not_found')) return 'not_found';
  if (states.every((state) => state === 'unavailable')) return 'unavailable';
  if (states.every((state) => state === 'complete')) return 'complete';
  return 'partial';
}

export async function getSubjectComparison(
  subjectIds: readonly number[],
  options: SubjectComparisonOptions = {},
  dependencies: SubjectOverviewDependencies,
): Promise<SubjectComparisonResult> {
  const ids = validateSubjectIds(subjectIds);
  const limits: SubjectOverviewLimits = {
    maxCast: bounded(options.maxCast, DEFAULT_LIMITS.maxCast, 20),
    maxStaff: bounded(options.maxStaff, DEFAULT_LIMITS.maxStaff, 80),
    maxRelations: bounded(options.maxRelations, DEFAULT_LIMITS.maxRelations, 32),
  };
  const attemptedAt = new Date().toISOString();
  const overviews: SubjectOverviewResult[] = [];
  const subjects: SubjectComparisonSubject[] = [];
  for (const subjectId of ids) {
    let sharedStatsResult:
      ReturnType<NonNullable<typeof dependencies.providerRegistry>['getSubjectStats']> | undefined;
    const statsResultFactory = dependencies.providerRegistry
      ? () => {
          sharedStatsResult ??= dependencies.providerRegistry!.getSubjectStats(subjectId, {
            authScope: 'public',
          });
          return sharedStatsResult;
        }
      : undefined;
    const overview = await getSubjectOverview(subjectId, limits, {
      ...dependencies,
      ...(statsResultFactory ? { statsResultFactory } : {}),
    });
    const statistics = overview.subject
      ? await getSubjectStatsIntelligence(subjectId, {
          ...(dependencies.providerRegistry
            ? { providerRegistry: dependencies.providerRegistry }
            : {}),
          ...(sharedStatsResult ? { sourceResult: sharedStatsResult } : {}),
        })
      : undefined;
    overviews.push(overview);
    subjects.push(mapSubjectOverview(overview, limits, statistics));
  }
  const overviewPair = overviews as [SubjectOverviewResult, SubjectOverviewResult];
  const pair = subjects as [SubjectComparisonSubject, SubjectComparisonSubject];
  const metrics = buildMetrics(pair);
  const overlaps = {
    cast: castOverlap(overviewPair, ids),
    staff: staffOverlap(overviewPair, ids),
  };
  const subjectState = overallState(pair);
  const derivedRetrievedAt = new Date().toISOString();
  const unknownMetrics = metrics.filter((item) => item.state === 'unknown').length;
  const conflictMetrics = metrics.filter((item) => item.state === 'conflict').length;
  const statisticsMetrics = metrics.filter((item) =>
    [
      'ratingPopulation',
      'ratingMean',
      'ratingStandardDeviation',
      'collectionPopulation',
      'collectionCompletionRate',
    ].includes(item.key),
  );
  const statisticsUnknownMetrics = statisticsMetrics.filter(
    (item) => item.state === 'unknown',
  ).length;
  const statisticsConflictMetrics = statisticsMetrics.filter(
    (item) => item.state === 'conflict',
  ).length;
  const statisticsConflictDetails = new Set(
    pair.flatMap((subject) =>
      [
        ...(subject.statistics?.conflicts || []),
        ...(subject.statistics?.rating.conflicts || []),
        ...(subject.statistics?.collection.conflicts || []),
      ].map(statisticsConflictIdentity),
    ),
  ).size;
  const state: SubjectComparisonState =
    subjectState === 'complete' &&
    (unknownMetrics > 0 ||
      conflictMetrics > 0 ||
      overlaps.cast.state !== 'complete' ||
      overlaps.staff.state !== 'complete')
      ? 'partial'
      : subjectState;
  const warnings: SubjectComparisonResult['warnings'] = [];
  for (const subject of pair) {
    if (subject.state !== 'complete') {
      warnings.push({
        code: 'SUBJECT_STATE_DEGRADED',
        state: subject.state,
        subjectId: subject.subjectId,
        message: `条目 ${subject.subjectId} 的概览状态为 ${subject.state}；比较保留可获取事实，不把缺失区段当作空值。`,
      });
    }
  }
  if (unknownMetrics > 0) {
    warnings.push({
      code: 'COMPARISON_VALUES_UNKNOWN',
      state: state === 'complete' ? 'partial' : state,
      message: `${unknownMetrics} 个比较字段缺少两侧兼容的有限官方数值，差值保持不可计算。`,
    });
  }
  if (conflictMetrics > 0) {
    warnings.push({
      code: 'COMPARISON_VALUES_CONFLICT',
      state: state === 'complete' ? 'partial' : state,
      message: `${conflictMetrics} 个比较字段存在来源或公式冲突，差值保持不可计算。`,
    });
  }
  if (statisticsUnknownMetrics > 0) {
    warnings.push({
      code: 'COMPARISON_STATISTICS_UNKNOWN',
      state: state === 'complete' ? 'partial' : state,
      message: `${statisticsUnknownMetrics} 个统计比较字段因缺失、部分或不可用公式状态而保持不可计算。`,
    });
  }
  if (statisticsConflictMetrics > 0 || statisticsConflictDetails > 0) {
    warnings.push({
      code: 'COMPARISON_STATISTICS_CONFLICT',
      state: state === 'complete' ? 'partial' : state,
      message: `${statisticsConflictMetrics} 个统计比较字段或 ${statisticsConflictDetails} 条统计冲突证据需要保留候选值，受影响差值保持不可计算。`,
    });
  }
  for (const [kind, overlap] of [
    ['cast', overlaps.cast] as const,
    ['staff', overlaps.staff] as const,
  ]) {
    if (overlap.state !== 'complete') {
      warnings.push({
        code: `COMPARISON_${kind.toUpperCase()}_OVERLAP_DEGRADED`,
        state,
        message:
          overlap.state === 'unavailable'
            ? `${kind === 'cast' ? '角色声优' : '制作人员'}区段至少一侧不可用，不能把空交集解释为没有共同人物。`
            : overlap.state === 'not_computable'
              ? `${kind === 'cast' ? '角色声优' : '制作人员'}共同关系当前不可计算。`
              : `${kind === 'cast' ? '角色声优' : '制作人员'}共同关系受缺失 ID 或有界截断影响，交集只代表已观察覆盖。`,
      });
    }
    if (overlap.items.some((item) => (item.nameVariants?.length || 0) > 1)) {
      warnings.push({
        code: `COMPARISON_${kind.toUpperCase()}_OVERLAP_NAME_VARIANTS`,
        state,
        message: `${kind === 'cast' ? '角色声优' : '制作人员'}共同关系中存在同一稳定人物 ID 的多个官方名称，名称候选保留在 nameVariants。`,
      });
    }
  }
  const statisticsEvidence: SubjectComparisonResult['evidence'] = pair.flatMap((subject) =>
    (subject.statistics?.evidence || []).map((item) => ({
      source: item.source,
      operation: item.operation || item.formula || 'subject-stats-intelligence',
      ...(item.retrievedAt ? { retrievedAt: item.retrievedAt } : {}),
      formulaVersion: STATISTICS_FORMULA_VERSION,
      ...(item.description ? { description: item.description } : {}),
      subjectIds: [subject.subjectId],
    })),
  );
  const evidence: SubjectComparisonResult['evidence'] = [
    ...pair.flatMap((subject) =>
      subject.evidence.map((item) => ({ ...item, subjectIds: [subject.subjectId] })),
    ),
    ...statisticsEvidence,
    {
      source: 'derived-s7',
      operation: 'subject-comparison',
      attemptedAt,
      retrievedAt: derivedRetrievedAt,
      formulaVersion: FORMULA_VERSION,
      description: `${DELTA_POLICY_DESCRIPTION} 差值不代表推荐或胜负。`,
    },
    {
      source: 'derived-s7',
      operation: 'subject-comparison-statistics',
      attemptedAt,
      retrievedAt: derivedRetrievedAt,
      formulaVersion: STATISTICS_FORMULA_VERSION,
      description: STATISTICS_DESCRIPTION,
    },
    {
      source: 'derived-s7',
      operation: 'subject-comparison-overlap',
      attemptedAt,
      retrievedAt: derivedRetrievedAt,
      formulaVersion: OVERLAP_FORMULA_VERSION,
      description: OVERLAP_DESCRIPTION,
    },
  ];
  const derivedComparisonSource: SubjectComparisonSourceSummary & { class: 'derived-s7' } = {
    class: 'derived-s7',
    operations: [
      'subject-comparison',
      'subject-comparison-statistics',
      'subject-comparison-overlap',
    ],
    attemptedAt,
    retrievedAt: derivedRetrievedAt,
  };
  const source = {
    official: mergeSources(
      pair.map((subject) => subject.source.official),
      'official-v0' as const,
      attemptedAt,
    ),
    derived: mergeSources(
      [...pair.map((subject) => subject.source.derived), derivedComparisonSource],
      'derived-s7' as const,
      attemptedAt,
    ),
  };
  const returnedSubjects = pair.filter((subject) => subject.subject !== undefined).length;
  const coverage: SubjectComparisonResult['coverage'] = {
    requestedSubjects: 2,
    returnedSubjects,
    subjectsComplete: pair.filter((subject) => subject.state === 'complete').length,
    subjectsPartial: pair.filter((subject) => subject.state === 'partial').length,
    subjectsUnavailable: pair.filter((subject) => subject.state === 'unavailable').length,
    subjectsNotFound: pair.filter((subject) => subject.state === 'not_found').length,
    metricsComplete: metrics.filter((item) => item.state === 'complete').length,
    metricsUnknown: unknownMetrics,
    metricsConflict: conflictMetrics,
    limits: { maxSubjects: 2, ...limits, maxOverlapItems: MAX_OVERLAP_ITEMS },
  };
  return {
    subjectIds: ids,
    state,
    subjects: pair,
    metrics,
    formulaVersion: FORMULA_VERSION,
    statisticsFormulaVersion: STATISTICS_FORMULA_VERSION,
    overlapFormulaVersion: OVERLAP_FORMULA_VERSION,
    overlaps,
    coverage,
    source,
    evidence,
    warnings,
    limitations: [
      '比较只覆盖两个条目本次官方 v0 概览读取与有界区段；缺失或截断不代表不存在。',
      `${DELTA_POLICY_DESCRIPTION} 不等同于推荐、质量结论或观看顺序。`,
      '统计直方图、收藏桶和派生公式只代表两侧本次官方 v0 快照；不计算历史趋势、社区热度、评论、偏好或 episode-row 级比较。',
      `${STATISTICS_DESCRIPTION}`,
      `${OVERLAP_DESCRIPTION} 共同人物只代表两侧本次返回的角色/职员关系，不是完整演职员表或系列协作图。`,
    ],
  };
}
