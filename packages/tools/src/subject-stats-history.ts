import crypto from 'node:crypto';
import type { Storage, SubjectStatsObservationRecord } from '@bangumi-agent-kit/db';
import { assertSafeEvidence, type ProviderRegistry } from '@bangumi-agent-kit/provider-core';
import type {
  SubjectStatsHistoryChange,
  SubjectStatsHistoryMetricChange,
  SubjectStatsHistoryMetricKey,
  SubjectStatsHistoryMetricState,
  SubjectStatsHistoryObservation,
  SubjectStatsHistoryResult,
  SubjectStatsHistoryState,
  SubjectStatsIntelligenceResult,
} from '@bangumi-agent-kit/bangumi-core';
import { getSubjectStatsIntelligence } from './subject-stats-intelligence.js';

export const SUBJECT_STATS_HISTORY_METHODOLOGY_ID =
  'bangumi.subject.stats.observation-history' as const;
export const SUBJECT_STATS_HISTORY_METHODOLOGY_VERSION = 1 as const;
export const SUBJECT_STATS_HISTORY_DEFAULT_MAX_OBSERVATIONS = 24;
export const SUBJECT_STATS_HISTORY_MAX_OBSERVATIONS = 120;
export const SUBJECT_STATS_HISTORY_DEFAULT_RETENTION_DAYS = 365;
export const SUBJECT_STATS_HISTORY_MAX_RETENTION_DAYS = 3650;
export const SUBJECT_STATS_HISTORY_MIN_INTERVAL_HOURS = 1;

const SUBJECT_STATS_HISTORY_MIN_INTERVAL_MS =
  SUBJECT_STATS_HISTORY_MIN_INTERVAL_HOURS * 60 * 60 * 1000;

const HISTORY_METRICS: SubjectStatsHistoryMetricKey[] = [
  'score',
  'ratingTotal',
  'histogramMean',
  'populationStandardDeviation',
  'collectionTotal',
  'completionRate',
];

const HISTORY_LIMITATIONS = [
  '历史从第一次显式 recordCurrent 观察开始；不会回填启用前的快照，也不代表连续采样。',
  '每个点来自一次官方 v0 统计读取；同一条目观察至少间隔 1 小时，观察次数、输出点数和保留天数均有硬上限，达到上限时必须结合 coverage 解读。',
  '变化是相邻观察点之间的确定性差值，不是趋势、质量、极化、推荐或因果结论；缺失、partial、conflict、unavailable 值不会被转换为零。',
  '本能力不读取账户、凭证、评论、社区统计或网站专有图表，也不执行 Bangumi 写操作；采样只在调用者显式请求 recordCurrent 时发生。',
];

export interface SubjectStatsHistoryOptions {
  recordCurrent?: boolean;
  maxObservations?: number;
  retentionDays?: number;
  now?: Date;
}

export interface SubjectStatsHistoryDependencies {
  storage?: Storage;
  providerRegistry?: ProviderRegistry;
}

export async function getSubjectStatsHistory(
  subjectId: number,
  options: SubjectStatsHistoryOptions,
  dependencies: SubjectStatsHistoryDependencies,
): Promise<SubjectStatsHistoryResult> {
  const recordCurrent = options.recordCurrent === true;
  const maxObservations = boundedInteger(
    options.maxObservations,
    SUBJECT_STATS_HISTORY_DEFAULT_MAX_OBSERVATIONS,
    SUBJECT_STATS_HISTORY_MAX_OBSERVATIONS,
  );
  const retentionDays = boundedInteger(
    options.retentionDays,
    SUBJECT_STATS_HISTORY_DEFAULT_RETENTION_DAYS,
    SUBJECT_STATS_HISTORY_MAX_RETENTION_DAYS,
  );

  if (!dependencies.storage) {
    return emptyHistory(
      subjectId,
      maxObservations,
      retentionDays,
      recordCurrent,
      [
        {
          code: 'OBSERVATION_STORE_UNAVAILABLE',
          message: '本地统计观察存储未配置，未读取或写入历史。',
        },
      ],
      'unavailable',
    );
  }

  const transientWarnings: Array<{ code: string; message: string }> = [];

  const now = options.now ? new Date(options.now) : new Date();
  let records: SubjectStatsObservationRecord[];
  try {
    records = await dependencies.storage.listSubjectStatsObservations({
      subjectId,
      limit: maxObservations,
      now,
    });
  } catch {
    return emptyHistory(
      subjectId,
      maxObservations,
      retentionDays,
      recordCurrent,
      [{ code: 'OBSERVATION_STORE_UNAVAILABLE', message: '本地统计观察历史读取失败。' }],
      'unavailable',
    );
  }

  let recordedObservationId: string | undefined;

  if (recordCurrent) {
    const latest = records.at(-1);
    const intervalElapsed =
      !latest ||
      now.getTime() - latest.observedAt.getTime() >= SUBJECT_STATS_HISTORY_MIN_INTERVAL_MS;
    if (!intervalElapsed) {
      transientWarnings.push({
        code: 'OBSERVATION_INTERVAL_NOT_ELAPSED',
        message: `同一条目两次观察至少间隔 ${SUBJECT_STATS_HISTORY_MIN_INTERVAL_HOURS} 小时；本次未发起官方统计请求。`,
      });
    } else {
      try {
        const result = await getSubjectStatsIntelligence(subjectId, {
          providerRegistry: dependencies.providerRegistry,
        });
        for (const evidence of result.evidence) {
          assertSafeEvidence({
            source: {
              class: evidence.source === 'official-v0' ? 'official_v0' : 'derived',
              provider: evidence.provider,
              ...(evidence.operation ? { operation: evidence.operation } : {}),
              ...(evidence.formulaVersion !== undefined
                ? { version: String(evidence.formulaVersion) }
                : {}),
            },
            retrievedAt: evidence.retrievedAt || result.retrievedAt || now.toISOString(),
            ...(evidence.fieldPath ? { fieldPath: evidence.fieldPath } : {}),
            ...(evidence.formula ? { formula: evidence.formula } : {}),
          });
        }
        const record: SubjectStatsObservationRecord = {
          id: `obs_${crypto.randomUUID()}`,
          subjectId,
          observedAt: now,
          retrievedAt: parseDate(result.retrievedAt),
          state: result.state,
          resultJson: JSON.stringify(result),
          methodologyVersion: `${SUBJECT_STATS_HISTORY_METHODOLOGY_ID}.v${SUBJECT_STATS_HISTORY_METHODOLOGY_VERSION}`,
          retentionUntil: new Date(now.getTime() + retentionDays * 24 * 60 * 60 * 1000),
        };
        await dependencies.storage.appendSubjectStatsObservation(record, {
          maxObservations,
          now,
        });
        recordedObservationId = record.id;
        transientWarnings.push(
          ...result.warnings.map((warning) => ({
            code: warning.code,
            message: warning.message,
          })),
        );
      } catch {
        transientWarnings.push({
          code: 'OBSERVATION_NOT_RECORDED',
          message: '当前官方统计观察未能写入本地历史；未伪造新的历史点。',
        });
      }
    }
  }

  if (recordedObservationId) {
    try {
      records = await dependencies.storage.listSubjectStatsObservations({
        subjectId,
        limit: maxObservations,
        now,
      });
    } catch {
      return emptyHistory(
        subjectId,
        maxObservations,
        retentionDays,
        recordCurrent,
        [
          ...transientWarnings,
          { code: 'OBSERVATION_STORE_UNAVAILABLE', message: '本地统计观察历史读取失败。' },
        ],
        'unavailable',
      );
    }
  }

  const warnings = [...transientWarnings];
  const observations: SubjectStatsHistoryObservation[] = [];
  for (const record of records) {
    try {
      const snapshot = JSON.parse(record.resultJson) as SubjectStatsIntelligenceResult;
      if (
        snapshot.subjectId !== subjectId ||
        !snapshot.state ||
        !snapshot.rating ||
        !snapshot.collection
      ) {
        throw new Error('invalid observation payload');
      }
      observations.push({
        id: record.id,
        observedAt: record.observedAt.toISOString(),
        ...(record.retrievedAt ? { retrievedAt: record.retrievedAt.toISOString() } : {}),
        retentionUntil: record.retentionUntil.toISOString(),
        state: snapshot.state,
        snapshot,
      });
    } catch {
      warnings.push({
        code: 'INVALID_STORED_OBSERVATION',
        message: `观察 ${record.id} 的持久化快照无法解析，已从派生序列中排除。`,
      });
    }
  }

  const changes = buildChanges(observations);
  const result = buildHistoryResult({
    subjectId,
    observations,
    changes,
    maxObservations,
    retentionDays,
    recordCurrent,
    recordedObservationId,
    warnings,
  });
  return result;
}

function buildHistoryResult(input: {
  subjectId: number;
  observations: SubjectStatsHistoryObservation[];
  changes: SubjectStatsHistoryChange[];
  maxObservations: number;
  retentionDays: number;
  recordCurrent: boolean;
  recordedObservationId?: string;
  warnings: Array<{ code: string; message: string }>;
}): SubjectStatsHistoryResult {
  const completeObservations = input.observations.filter(
    (item) => item.state === 'complete',
  ).length;
  const latestState = input.observations.at(-1)?.state;
  const truncated = input.observations.length >= input.maxObservations;
  const state = historyState(input.observations, completeObservations);
  const officialOperations = unique(
    input.observations.flatMap((item) => item.snapshot.source.official.operations),
  );
  const derivedOperations = unique(
    input.observations.flatMap((item) => item.snapshot.source.derived.operations),
  );
  const warnings = [...input.warnings];
  if (truncated) {
    warnings.push({
      code: 'OBSERVATION_OUTPUT_TRUNCATED',
      message: `历史最多返回 ${input.maxObservations} 个观察点，达到上限时不宣称完整历史。`,
    });
  }
  if (input.observations.length === 1) {
    warnings.push({
      code: 'CHANGE_NOT_COMPUTABLE',
      message: '当前只有一个观察点，尚不足以计算相邻变化。',
    });
  }
  if (latestState === 'not_found' && input.observations.length === 1) {
    warnings.push({
      code: 'LATEST_SOURCE_NOT_FOUND',
      message: '最近一次官方统计读取未找到该条目；没有据此生成猜测值。',
    });
  }

  return {
    subjectId: input.subjectId,
    state,
    collection: {
      ...(input.observations[0] ? { startedAt: input.observations[0].observedAt } : {}),
      retentionDays: input.retentionDays,
      maxObservations: input.maxObservations,
      observationsObserved: input.observations.length,
      observationsReturned: input.observations.length,
      completeObservations,
      changePairs: input.changes.length,
      truncated,
      recordCurrent: input.recordCurrent,
      ...(input.recordedObservationId
        ? { recordedObservationId: input.recordedObservationId }
        : {}),
    },
    observations: input.observations,
    changes: input.changes,
    methodology: {
      id: SUBJECT_STATS_HISTORY_METHODOLOGY_ID,
      version: SUBJECT_STATS_HISTORY_METHODOLOGY_VERSION,
      metrics: [...HISTORY_METRICS],
      description:
        '只对相邻且指标状态均为 complete 的官方统计观察计算 current - previous；其他指标保留 not_computable/partial/conflict 原因。',
    },
    source: {
      official: {
        class: 'official-v0',
        operations: officialOperations,
        observationCount: input.observations.filter(
          (item) => item.snapshot.source.official.operations.length > 0,
        ).length,
      },
      derived: {
        class: 'derived-s7',
        operations: derivedOperations,
        observationCount: input.observations.filter(
          (item) => item.snapshot.source.derived.operations.length > 0,
        ).length,
      },
    },
    warnings: warnings.slice(0, 24),
    limitations: [...HISTORY_LIMITATIONS],
  };
}

function buildChanges(observations: SubjectStatsHistoryObservation[]): SubjectStatsHistoryChange[] {
  const changes: SubjectStatsHistoryChange[] = [];
  for (let index = 1; index < observations.length; index += 1) {
    const previous = observations[index - 1]!;
    const current = observations[index]!;
    const metrics = HISTORY_METRICS.map((key) =>
      metricChange(previous.snapshot, current.snapshot, key),
    );
    const state = pairState(metrics);
    changes.push({
      fromObservationId: previous.id,
      toObservationId: current.id,
      fromObservedAt: previous.observedAt,
      toObservedAt: current.observedAt,
      state,
      metrics,
    });
  }
  return changes;
}

function metricChange(
  previous: SubjectStatsIntelligenceResult,
  current: SubjectStatsIntelligenceResult,
  key: SubjectStatsHistoryMetricKey,
): SubjectStatsHistoryMetricChange {
  const previousMetric = metricValue(previous, key);
  const currentMetric = metricValue(current, key);
  if (previousMetric.state === 'conflict' || currentMetric.state === 'conflict') {
    return {
      key,
      state: 'conflict',
      reason: '相邻观察中至少一个指标存在 source conflict。',
    };
  }
  if (previousMetric.state !== 'complete' || currentMetric.state !== 'complete') {
    return {
      key,
      state:
        previousMetric.state === 'partial' || currentMetric.state === 'partial'
          ? 'partial'
          : 'not_computable',
      reason: '相邻观察的指标没有同时达到 complete，未生成差值。',
    };
  }
  const from = previousMetric.value!;
  const to = currentMetric.value!;
  return { key, state: 'complete', from, to, delta: roundDelta(to - from) };
}

function metricValue(
  result: SubjectStatsIntelligenceResult,
  key: SubjectStatsHistoryMetricKey,
): { state: SubjectStatsHistoryMetricState; value?: number } {
  const sectionState =
    key === 'score' || key === 'ratingTotal'
      ? result.state
      : key === 'completionRate' || key === 'collectionTotal'
        ? result.collection.state
        : result.rating.state;
  const value =
    key === 'score'
      ? result.raw?.score
      : key === 'ratingTotal'
        ? result.raw?.ratingTotal
        : key === 'histogramMean'
          ? result.rating.mean
          : key === 'populationStandardDeviation'
            ? result.rating.standardDeviation
            : key === 'collectionTotal'
              ? result.collection.total
              : result.collection.completionRate;
  if (sectionState === 'conflict') return { state: 'conflict' };
  if (typeof value !== 'number' || !Number.isFinite(value)) return { state: 'not_computable' };
  if (sectionState !== 'complete') return { state: 'partial', value };
  return { state: 'complete', value };
}

function pairState(metrics: SubjectStatsHistoryMetricChange[]): SubjectStatsHistoryMetricState {
  if (metrics.some((metric) => metric.state === 'conflict')) return 'conflict';
  if (metrics.every((metric) => metric.state === 'complete')) return 'complete';
  if (metrics.some((metric) => metric.state === 'complete' || metric.state === 'partial'))
    return 'partial';
  return 'not_computable';
}

function historyState(
  observations: SubjectStatsHistoryObservation[],
  completeObservations: number,
): SubjectStatsHistoryState {
  if (observations.length === 0) return 'not_computable';
  const latest = observations.at(-1)!.state;
  if (latest === 'conflict') return 'conflict';
  if (observations.length === 1 && latest === 'not_found') return 'not_found';
  if (observations.every((item) => item.state === 'unavailable')) return 'unavailable';
  if (observations.length >= 2 && completeObservations === observations.length) return 'complete';
  if (completeObservations > 0 || observations.length > 1) return 'partial';
  if (latest === 'not_found') return 'not_found';
  if (latest === 'unavailable') return 'unavailable';
  return 'not_computable';
}

function emptyHistory(
  subjectId: number,
  maxObservations: number,
  retentionDays: number,
  recordCurrent: boolean,
  warnings: Array<{ code: string; message: string }>,
  state: SubjectStatsHistoryState = 'not_computable',
): SubjectStatsHistoryResult {
  return {
    subjectId,
    state,
    collection: {
      retentionDays,
      maxObservations,
      observationsObserved: 0,
      observationsReturned: 0,
      completeObservations: 0,
      changePairs: 0,
      truncated: false,
      recordCurrent,
    },
    observations: [],
    changes: [],
    methodology: {
      id: SUBJECT_STATS_HISTORY_METHODOLOGY_ID,
      version: SUBJECT_STATS_HISTORY_METHODOLOGY_VERSION,
      metrics: [...HISTORY_METRICS],
      description:
        '只对相邻且指标状态均为 complete 的官方统计观察计算 current - previous；其他指标保留 not_computable/partial/conflict 原因。',
    },
    source: {
      official: { class: 'official-v0', operations: [], observationCount: 0 },
      derived: { class: 'derived-s7', operations: [], observationCount: 0 },
    },
    warnings,
    limitations: [...HISTORY_LIMITATIONS],
  };
}

function boundedInteger(value: number | undefined, fallback: number, maximum: number): number {
  if (value === undefined) return fallback;
  return Math.min(maximum, Math.max(1, Math.trunc(value)));
}

function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

function roundDelta(value: number): number {
  return Number(value.toFixed(12));
}
