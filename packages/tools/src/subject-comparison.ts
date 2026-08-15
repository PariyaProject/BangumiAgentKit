import { BangumiError } from '@bangumi-agent-kit/bangumi-transport';
import type {
  SubjectComparisonMetric,
  SubjectComparisonMetricKey,
  SubjectComparisonResult,
  SubjectComparisonState,
  SubjectComparisonSubject,
  SubjectComparisonStatsConflict,
  SubjectComparisonStatsKey,
  SubjectOverviewResult,
} from '@bangumi-agent-kit/bangumi-core';
import {
  getSubjectOverview,
  type SubjectOverviewDependencies,
  type SubjectOverviewLimits,
} from './subject-overview.js';

export interface SubjectComparisonOptions {
  maxCast?: number;
  maxStaff?: number;
  maxRelations?: number;
}

const FORMULA_VERSION = 'subject-comparison-v1' as const;
const DEFAULT_LIMITS: SubjectOverviewLimits = {
  maxCast: 4,
  maxStaff: 12,
  maxRelations: 8,
};

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

function earliestTimestamp(values: Array<string | undefined>): string {
  return (
    values.filter((value): value is string => Boolean(value)).sort()[0] || new Date().toISOString()
  );
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function collectionTotal(value: unknown): number | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const values = Object.values(value as Record<string, unknown>);
  if (values.some((item) => finiteNumber(item) === undefined)) return undefined;
  return values.reduce<number>((sum, item) => sum + (finiteNumber(item) || 0), 0);
}

function mapSubjectOverview(
  overview: SubjectOverviewResult,
  limits: SubjectOverviewLimits,
): SubjectComparisonSubject {
  const statsData = overview.stats.data;
  const total = collectionTotal(statsData?.collection);
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
  const evidence = overview.evidence;
  const operations = Array.from(new Set(evidence.map((item) => item.operation)));
  const attemptedAt = earliestTimestamp(evidence.map((item) => item.attemptedAt));
  const retrievedAt = latestTimestamp(evidence.map((item) => item.retrievedAt));
  return {
    subjectId: overview.subjectId,
    state: overview.state,
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
      state: overview.stats.state,
      ...(providerStats.score === undefined ? {} : { score: providerStats.score }),
      ...(providerStats.rank === undefined ? {} : { rank: providerStats.rank }),
      ...(providerStats.ratingTotal === undefined
        ? {}
        : { ratingTotal: providerStats.ratingTotal }),
      ...(total === undefined ? {} : { collectionTotal: total }),
      ...(Object.keys(conflicts).length > 0 ? { conflicts } : {}),
    },
    sections: {
      stats: overview.stats.state,
      cast: overview.cast.state,
      staff: overview.staff.state,
      relations: overview.relations.state,
    },
    coverage: {
      sourceRequestsAttempted: overview.coverage.sourceRequestsAttempted,
      sourceRequestsSucceeded: overview.coverage.sourceRequestsSucceeded,
      sectionsComplete: overview.coverage.sectionsComplete,
      sectionsPartial: overview.coverage.sectionsPartial,
      sectionsUnavailable: overview.coverage.sectionsUnavailable,
      sectionsNotComputable: overview.coverage.sectionsNotComputable,
      truncatedSections: [...overview.coverage.truncatedSections],
      limits,
    },
    source: { operations, attemptedAt, ...(retrievedAt ? { retrievedAt } : {}) },
    evidence,
    warnings: overview.warnings,
    limitations: overview.limitations,
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
  const values: [number | null, number | null] = [left ?? null, right ?? null];
  const conflicts = [
    leftConflict ? { side: 'A' as const, ...leftConflict } : undefined,
    rightConflict ? { side: 'B' as const, ...rightConflict } : undefined,
  ].filter((value): value is NonNullable<typeof value> => Boolean(value));
  if (conflicts.length > 0) {
    return { key, label, values, delta: null, state: 'conflict', conflicts };
  }
  const complete = values[0] !== null && values[1] !== null;
  return {
    key,
    label,
    values,
    delta: complete ? values[1]! - values[0]! : null,
    state: complete ? 'complete' : 'unknown',
  };
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
  ];
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
  const subjects: SubjectComparisonSubject[] = [];
  for (const subjectId of ids) {
    subjects.push(
      mapSubjectOverview(await getSubjectOverview(subjectId, limits, dependencies), limits),
    );
  }
  const pair = subjects as [SubjectComparisonSubject, SubjectComparisonSubject];
  const metrics = buildMetrics(pair);
  const subjectState = overallState(pair);
  const derivedRetrievedAt = new Date().toISOString();
  const unknownMetrics = metrics.filter((item) => item.state === 'unknown').length;
  const conflictMetrics = metrics.filter((item) => item.state === 'conflict').length;
  const state: SubjectComparisonState =
    subjectState === 'complete' && (unknownMetrics > 0 || conflictMetrics > 0)
      ? 'partial'
      : subjectState;
  const warnings: SubjectComparisonResult['warnings'] = [];
  for (const subject of pair) {
    if (subject.state !== 'complete') {
      warnings.push({
        code: 'SUBJECT_STATE_DEGRADED',
        state,
        subjectId: subject.subjectId,
        message: `条目 ${subject.subjectId} 的概览状态为 ${subject.state}；比较保留可获取事实，不把缺失区段当作空值。`,
      });
    }
  }
  if (unknownMetrics > 0) {
    warnings.push({
      code: 'COMPARISON_VALUES_UNKNOWN',
      state: state === 'complete' ? 'partial' : state,
      message: `${unknownMetrics} 个比较字段缺少两侧兼容的官方数值，差值保持不可计算。`,
    });
  }
  if (conflictMetrics > 0) {
    warnings.push({
      code: 'COMPARISON_VALUES_CONFLICT',
      state: state === 'complete' ? 'partial' : state,
      message: `${conflictMetrics} 个比较字段在条目详情与统计区段之间出现冲突，差值保持不可计算。`,
    });
  }
  const sourceOperations = Array.from(
    new Set(pair.flatMap((subject) => subject.source.operations)),
  );
  const sourceRetrievedAt = latestTimestamp(pair.map((subject) => subject.source.retrievedAt));
  const evidence: SubjectComparisonResult['evidence'] = [
    ...pair.flatMap((subject) =>
      subject.evidence.map((item) => ({ ...item, subjectIds: [subject.subjectId] })),
    ),
    {
      source: 'derived-s7',
      operation: 'subject-comparison',
      attemptedAt,
      retrievedAt: derivedRetrievedAt,
      formulaVersion: FORMULA_VERSION,
      description:
        '按 subjectIds 输入顺序并列官方条目事实；numeric delta = 第二个条目值 - 第一个条目值；差值不代表推荐或胜负。',
    },
  ];
  const returnedSubjects = pair.filter((subject) => subject.state !== 'not_found').length;
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
    limits: { maxSubjects: 2, ...limits },
  };
  return {
    subjectIds: ids,
    state,
    subjects: pair,
    metrics,
    formulaVersion: FORMULA_VERSION,
    coverage,
    source: {
      class: 'official_v0',
      operations: sourceOperations,
      attemptedAt,
      ...(sourceRetrievedAt ? { retrievedAt: sourceRetrievedAt } : {}),
    },
    evidence,
    warnings,
    limitations: [
      '比较只覆盖两个条目本次官方 v0 概览读取与有界区段；缺失或截断不代表不存在。',
      '差值按输入顺序计算为第二个条目减第一个条目，不等同于推荐、质量结论或观看顺序。',
      '统计是当前官方快照；本能力不计算历史趋势、社区热度、评论、偏好或 episode-row 级比较。',
    ],
  };
}
