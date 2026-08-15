import {
  COLLECTION_PERCENTAGES_FORMULA,
  COMPLETION_FORMULA,
  computeCollectionCompletionRate,
  computeCollectionPercentages,
  computePopulationStandardDeviation,
  computeRatingPercentages,
  POPULATION_SD_FORMULA,
  RATING_PERCENTAGES_FORMULA,
  type CapabilityResult,
  type CapabilityConflict,
  type EvidenceRef,
  type FieldEvidence,
  type FormulaDescriptor,
  type ProviderRegistry,
  type SubjectStatsData,
} from '@bangumi-agent-kit/provider-core';
import type {
  SubjectStatsCollectionStatus,
  SubjectStatsConflict,
  SubjectStatsEvidence,
  SubjectStatsFormulaDescriptor,
  SubjectStatsIntelligenceResult,
  SubjectStatsIntelligenceState,
  SubjectStatsMetricState,
  SubjectStatsRatingHistogram,
} from '@bangumi-agent-kit/bangumi-core';

const COLLECTION_STATUSES: SubjectStatsCollectionStatus[] = [
  'wish',
  'collect',
  'doing',
  'on_hold',
  'dropped',
];
const RATING_SCORES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
const LIMITATIONS = [
  '评分直方图与收藏桶是本次官方 v0 当前快照，不是历史趋势或跨时间比较。',
  '评分标准差是对 1–10 分直方图的总体标准差；它不等于质量、两极化原因或推荐结论。',
  '收藏完成率公式已用样本交叉验证但不是官方 API 合同；结果保留公式证据与限制。',
  '本能力不读取评论、社区统计、网站专有交叉图表或其他用户的私有收藏数据。',
];

interface SubjectStatsIntelligenceDependencies {
  providerRegistry?: ProviderRegistry;
}

function descriptor(formula: FormulaDescriptor): SubjectStatsFormulaDescriptor {
  return {
    id: formula.id,
    version: formula.version,
    inputs: [...formula.inputs],
    evidenceStatus: formula.evidenceStatus,
    description: formula.description,
  };
}

function sourceClass(value: unknown): SubjectStatsEvidence['source'] | undefined {
  if (value === 'official_v0') return 'official-v0';
  if (value === 'derived') return 'derived-s7';
  return undefined;
}

function mapEvidenceRef(ref: EvidenceRef, fieldPath: string): SubjectStatsEvidence | undefined {
  const mappedSource = sourceClass(ref.source.class);
  if (!mappedSource) return undefined;
  const formulaVersion = ref.source.version ? Number(ref.source.version) : undefined;
  return {
    source: mappedSource,
    provider: ref.source.provider,
    ...(typeof ref.source.operation === 'string' ? { operation: ref.source.operation } : {}),
    ...(typeof ref.retrievedAt === 'string' ? { retrievedAt: ref.retrievedAt } : {}),
    fieldPath,
    ...(typeof ref.formula === 'string' ? { formula: ref.formula } : {}),
    ...(Number.isFinite(formulaVersion) ? { formulaVersion } : {}),
  };
}

function evidenceFromFields(evidence: FieldEvidence | undefined): SubjectStatsEvidence[] {
  if (!evidence) return [];
  return Object.entries(evidence).flatMap(([fieldPath, refs]) =>
    refs.flatMap((ref) => {
      const mapped = mapEvidenceRef(ref, fieldPath);
      return mapped ? [mapped] : [];
    }),
  );
}

function uniqueEvidence(evidence: SubjectStatsEvidence[]): SubjectStatsEvidence[] {
  const seen = new Set<string>();
  return evidence.filter((item) => {
    const key = JSON.stringify([
      item.source,
      item.provider,
      item.operation,
      item.retrievedAt,
      item.fieldPath,
      item.formula,
      item.formulaVersion,
    ]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function formulaEvidence(
  result: CapabilityResult<unknown>,
  description: string,
): SubjectStatsEvidence[] {
  return evidenceFromFields(result.evidence).map((item) => ({ ...item, description }));
}

function finiteNonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function nonNegativeInteger(value: unknown): value is number {
  return finiteNonNegative(value) && Number.isInteger(value);
}

function validHistogram(value: unknown): value is SubjectStatsRatingHistogram {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return RATING_SCORES.every((score) =>
    nonNegativeInteger((value as Record<number, unknown>)[score]),
  );
}

function validStatsData(value: unknown): value is SubjectStatsData {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const stats = value as Record<string, unknown>;
  const collection = stats.collection;
  if (!collection || typeof collection !== 'object' || Array.isArray(collection)) return false;
  const buckets = collection as Record<string, unknown>;
  return (
    finiteNonNegative(stats.score) &&
    finiteNonNegative(stats.rank) &&
    nonNegativeInteger(stats.ratingTotal) &&
    validHistogram(stats.ratingHistogram) &&
    nonNegativeInteger(buckets.wish) &&
    nonNegativeInteger(buckets.collect) &&
    nonNegativeInteger(buckets.doing) &&
    nonNegativeInteger(buckets.onHold) &&
    nonNegativeInteger(buckets.dropped)
  );
}

function mapProviderState(
  result: CapabilityResult<SubjectStatsData>,
): SubjectStatsIntelligenceState {
  if (result.state === 'ok') return 'complete';
  if (result.state === 'not_found' || result.error?.code === 'not_found') return 'not_found';
  if (result.state === 'not_computable') return 'not_computable';
  if (result.state === 'conflict') return 'conflict';
  if (result.state === 'partial') return 'partial';
  return 'unavailable';
}

function stateForFormula(result: CapabilityResult<unknown>): SubjectStatsMetricState {
  if (result.state === 'ok') return 'complete';
  if (result.state === 'conflict') return 'conflict';
  if (result.state === 'not_computable') return 'not_computable';
  if (result.state === 'partial') return 'partial';
  return 'unavailable';
}

function resultError(result: CapabilityResult<unknown>): SubjectStatsIntelligenceResult['error'] {
  if (!result.error) return undefined;
  return {
    code: result.error.code,
    message:
      result.error.code === 'not_found'
        ? '官方统计源未找到该条目。'
        : '官方统计源暂时不可用，未生成猜测的统计值。',
    retryable: result.error.retryable,
  };
}

function emptyResult(subjectId: number): SubjectStatsIntelligenceResult {
  return {
    subjectId,
    state: 'unavailable',
    rating: {
      state: 'unavailable',
      distribution: [],
      formulas: {
        percentages: descriptor(RATING_PERCENTAGES_FORMULA),
        populationStandardDeviation: descriptor(POPULATION_SD_FORMULA),
      },
    },
    collection: {
      state: 'unavailable',
      distribution: [],
      completionState: 'unavailable',
      formulas: {
        percentages: descriptor(COLLECTION_PERCENTAGES_FORMULA),
        completion: descriptor(COMPLETION_FORMULA),
      },
    },
    coverage: {
      sourceRequestsAttempted: 0,
      sourceRequestsSucceeded: 0,
      ratingBucketsExpected: RATING_SCORES.length,
      ratingBucketsObserved: 0,
      collectionBucketsExpected: COLLECTION_STATUSES.length,
      collectionBucketsObserved: 0,
      formulasAttempted: 0,
      formulasComplete: 0,
      formulasNotComputable: 0,
      formulasConflict: 0,
    },
    source: {
      official: { class: 'official-v0', operations: [] },
      derived: { class: 'derived-s7', operations: [] },
    },
    evidence: [],
    warnings: [],
    limitations: [...LIMITATIONS],
  };
}

function formatFormulaWarnings(
  result: CapabilityResult<unknown>,
  state: SubjectStatsMetricState,
): SubjectStatsIntelligenceResult['warnings'] {
  return (result.warnings || []).map((item) => ({
    code: item.code,
    state,
    message: item.message,
  }));
}

function addConflictEvidence(
  conflicts: CapabilityConflict[] | undefined,
  evidence: SubjectStatsEvidence[],
): SubjectStatsConflict[] | undefined {
  if (!conflicts || conflicts.length === 0) return undefined;
  return conflicts.map((conflict) => ({
    state: 'conflict' as const,
    reason: conflict.reason,
    candidates: conflict.candidates.map((candidate) => {
      const mappedClass = candidate.source.class === 'official_v0' ? 'official-v0' : 'derived-s7';
      return {
        source: {
          class: mappedClass,
          provider: candidate.source.provider,
          ...(candidate.source.operation ? { operation: candidate.source.operation } : {}),
          ...(candidate.source.version ? { version: candidate.source.version } : {}),
        },
        value: typeof candidate.value === 'number' ? candidate.value : Number(candidate.value),
        evidence: evidence.filter(
          (item) =>
            item.source === mappedClass &&
            (candidate.source.operation === undefined ||
              item.operation === candidate.source.operation),
        ),
      };
    }),
  }));
}

function deriveOverallState(
  providerState: SubjectStatsIntelligenceState,
  ratingState: SubjectStatsMetricState,
  collectionState: SubjectStatsMetricState,
  completionState: SubjectStatsMetricState,
): SubjectStatsIntelligenceState {
  if (providerState === 'not_found' || providerState === 'unavailable') return providerState;
  if (ratingState === 'conflict') return 'conflict';
  if (providerState === 'conflict') return 'conflict';
  if (providerState === 'partial' || collectionState === 'partial') return 'partial';
  const states = [ratingState, collectionState, completionState];
  if (states.every((state) => state === 'not_computable')) return 'not_computable';
  if (states.some((state) => state === 'unavailable')) return 'partial';
  if (states.some((state) => state === 'not_computable')) return 'partial';
  return 'complete';
}

export async function getSubjectStatsIntelligence(
  subjectId: number,
  dependencies: SubjectStatsIntelligenceDependencies,
): Promise<SubjectStatsIntelligenceResult> {
  const result = emptyResult(subjectId);
  if (!dependencies.providerRegistry) {
    result.warnings.push({
      code: 'PROVIDER_NOT_CONFIGURED',
      state: 'unavailable',
      message: '官方统计 Provider 未配置，未填充猜测的统计值。',
    });
    return result;
  }

  const sourceResult = await dependencies.providerRegistry.getSubjectStats(subjectId, {
    authScope: 'public',
  });
  const sourceEvidence = evidenceFromFields(sourceResult.evidence);
  result.evidence = sourceEvidence;
  result.coverage.sourceRequestsAttempted = 1;
  result.coverage.sourceRequestsSucceeded = sourceResult.data ? 1 : 0;
  result.source.official = {
    class: 'official-v0',
    operations: Array.from(
      new Set(
        sourceEvidence
          .filter((item) => item.source === 'official-v0')
          .map((item) => item.operation),
      ),
    ).filter((value): value is string => Boolean(value)),
    ...(sourceResult.retrievedAt ? { retrievedAt: sourceResult.retrievedAt } : {}),
  };

  const providerState = mapProviderState(sourceResult);
  if (!validStatsData(sourceResult.data)) {
    result.state = providerState;
    result.error = resultError(sourceResult);
    result.warnings.push(
      ...(sourceResult.warnings || []).map((item) => ({
        code: item.code,
        state: providerState,
        message: item.message,
      })),
    );
    if (sourceResult.data !== undefined) {
      result.warnings.push({
        code: 'INVALID_STATS_INPUT',
        state: 'partial',
        message: '官方统计响应包含缺失或非法数值，未将其转换为派生统计。',
      });
      result.state = 'partial';
    } else if (providerState === 'complete') {
      result.warnings.push({
        code: 'MISSING_STATS_DATA',
        state: 'partial',
        message: '官方统计请求成功但未返回统计数据，未生成猜测的统计值。',
      });
      result.state = 'partial';
    }
    return result;
  }

  const stats = sourceResult.data;
  result.raw = {
    score: stats.score,
    rank: stats.rank,
    ratingTotal: stats.ratingTotal,
    ratingHistogram: stats.ratingHistogram,
    collection: stats.collection,
  };
  result.coverage.ratingBucketsObserved = RATING_SCORES.filter(
    (score) => stats.ratingHistogram[score] !== undefined,
  ).length;
  result.coverage.collectionBucketsObserved = COLLECTION_STATUSES.filter(
    (status) => stats.collection[status === 'on_hold' ? 'onHold' : status] !== undefined,
  ).length;

  const retrievedAt = sourceResult.retrievedAt || new Date().toISOString();
  const ratingPercentages = computeRatingPercentages(
    stats.ratingHistogram,
    sourceResult.evidence,
    retrievedAt,
  );
  const ratingDeviation = computePopulationStandardDeviation(
    stats,
    sourceResult.evidence,
    retrievedAt,
  );
  const collectionPercentages = computeCollectionPercentages(
    stats,
    sourceResult.evidence,
    retrievedAt,
  );
  const completion = computeCollectionCompletionRate(stats, sourceResult.evidence, retrievedAt);
  const ratingState =
    stateForFormula(ratingDeviation) === 'conflict'
      ? 'conflict'
      : stateForFormula(ratingPercentages);
  const collectionState = stateForFormula(collectionPercentages);
  const completionState = stateForFormula(completion);

  const ratingPopulation = ratingDeviation.data?.histogramPopulation;
  const collectionPopulation =
    stats.collection.wish +
    stats.collection.collect +
    stats.collection.doing +
    stats.collection.onHold +
    stats.collection.dropped;
  const formulaResults = [ratingPercentages, ratingDeviation, collectionPercentages, completion];
  result.coverage.ratingPopulation = ratingPopulation;
  result.coverage.collectionPopulation = collectionPopulation;
  result.coverage.formulasAttempted = 4;
  result.coverage.formulasComplete = formulaResults.filter((item) => item.state === 'ok').length;
  result.coverage.formulasNotComputable = formulaResults.filter(
    (item) => item.state === 'not_computable',
  ).length;
  result.coverage.formulasConflict = formulaResults.filter(
    (item) => item.state === 'conflict',
  ).length;
  const ratingConflicts = addConflictEvidence(
    ratingDeviation.conflicts,
    formulaEvidence(ratingDeviation, POPULATION_SD_FORMULA.description),
  );

  result.rating = {
    state: ratingState,
    ...(ratingPopulation === undefined ? {} : { population: ratingPopulation }),
    ...(ratingDeviation.data?.histogramMean === undefined
      ? {}
      : { mean: ratingDeviation.data.histogramMean }),
    ...(ratingDeviation.data?.standardDeviation === undefined
      ? {}
      : { standardDeviation: ratingDeviation.data.standardDeviation }),
    distribution: RATING_SCORES.map((score) => ({
      score,
      count: stats.ratingHistogram[score],
      ...(ratingPercentages.data ? { percentage: ratingPercentages.data[score] } : {}),
    })),
    formulas: {
      percentages: descriptor(RATING_PERCENTAGES_FORMULA),
      populationStandardDeviation: descriptor(POPULATION_SD_FORMULA),
    },
    ...(ratingConflicts ? { conflicts: ratingConflicts } : {}),
  };

  result.collection = {
    state: collectionState,
    total: collectionPopulation,
    distribution: COLLECTION_STATUSES.map((status) => {
      const key = status === 'on_hold' ? 'onHold' : status;
      return {
        status,
        count: stats.collection[key],
        ...(collectionPercentages.data ? { percentage: collectionPercentages.data[status] } : {}),
      };
    }),
    ...(completion.data === null || completion.data === undefined
      ? {}
      : { completionRate: completion.data }),
    completionState,
    formulas: {
      percentages: descriptor(COLLECTION_PERCENTAGES_FORMULA),
      completion: descriptor(COMPLETION_FORMULA),
    },
  };

  const formulaEvidenceItems = uniqueEvidence([
    ...formulaEvidence(ratingPercentages, RATING_PERCENTAGES_FORMULA.description),
    ...formulaEvidence(ratingDeviation, POPULATION_SD_FORMULA.description),
    ...formulaEvidence(collectionPercentages, COLLECTION_PERCENTAGES_FORMULA.description),
    ...formulaEvidence(completion, COMPLETION_FORMULA.description),
  ]);
  result.evidence = uniqueEvidence([...sourceEvidence, ...formulaEvidenceItems]);
  result.source.derived = {
    class: 'derived-s7',
    operations: formulaEvidenceItems
      .map((item) => item.operation)
      .filter((value): value is string => Boolean(value)),
    retrievedAt,
  };
  result.retrievedAt = retrievedAt;
  result.state = deriveOverallState(
    providerState === 'unavailable' ? 'partial' : providerState,
    ratingState,
    collectionState,
    completionState,
  );
  result.error = resultError(sourceResult);
  result.warnings.push(
    ...(sourceResult.warnings || []).map((item) => ({
      code: item.code,
      state: result.state,
      message: item.message,
    })),
    ...formatFormulaWarnings(ratingPercentages, ratingState),
    ...formatFormulaWarnings(ratingDeviation, ratingState),
    ...formatFormulaWarnings(collectionPercentages, collectionState),
    ...formatFormulaWarnings(completion, completionState),
  );
  if (stats.ratingTotal !== ratingPopulation) {
    result.warnings.push({
      code: 'RATING_TOTAL_MISMATCH',
      state: 'partial',
      message: `官方评分总数 ${stats.ratingTotal} 与评分直方图样本数 ${ratingPopulation ?? '未知'} 不一致；两者均保留，未静默修正。`,
    });
    if (result.state === 'complete') result.state = 'partial';
  }
  if (ratingState === 'conflict') {
    result.warnings.push({
      code: 'RATING_MEAN_CONFLICT',
      state: 'conflict',
      message: '评分直方图均值与官方评分存在不可忽略差异；标准差保留但不选择单一真值。',
    });
  }
  return result;
}
