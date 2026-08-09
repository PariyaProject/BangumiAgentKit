import {
  createEvidenceRef,
  SOURCE_DERIVED,
  type CapabilityResult,
  type CapabilityConflict,
  type CapabilityWarning,
  type FieldEvidence,
  type SourceDescriptor,
} from './contracts.js';
import { warning } from './contracts.js';
import type { RatingHistogram, SubjectStatsData } from './providers.js';

export type FormulaEvidenceStatus = 'official_contract' | 'empirically_verified' | 'derived';

export interface FormulaDescriptor {
  id: string;
  version: number;
  inputs: string[];
  evidenceStatus: FormulaEvidenceStatus;
  description: string;
}

export const SUBJECT_COLLECTION_BUCKETS = [
  'wish',
  'collect',
  'doing',
  'on_hold',
  'dropped',
] as const;

export type SubjectCollectionBucket = (typeof SUBJECT_COLLECTION_BUCKETS)[number];

export const FORMULA_REGISTRY: readonly FormulaDescriptor[] = Object.freeze([
  {
    id: 'bangumi.subject.completion.v1',
    version: 1,
    inputs: SUBJECT_COLLECTION_BUCKETS.map((bucket) => `collection.${bucket}`),
    evidenceStatus: 'empirically_verified',
    description: 'collect / (wish + collect + doing + on_hold + dropped)',
  },
  {
    id: 'bangumi.rating.percentages.v1',
    version: 1,
    inputs: Array.from({ length: 10 }, (_, index) => `rating.count.${index + 1}`),
    evidenceStatus: 'derived',
    description: 'rating bucket count / rating histogram population × 100',
  },
  {
    id: 'bangumi.rating.population_sd.v1',
    version: 1,
    inputs: Array.from({ length: 10 }, (_, index) => `rating.count.${index + 1}`),
    evidenceStatus: 'derived',
    description: 'population standard deviation over the rating histogram',
  },
]);

export const COMPLETION_FORMULA = FORMULA_REGISTRY[0] as FormulaDescriptor;
export const RATING_PERCENTAGES_FORMULA = FORMULA_REGISTRY[1] as FormulaDescriptor;
export const POPULATION_SD_FORMULA = FORMULA_REGISTRY[2] as FormulaDescriptor;

/** Upstream scores are published to one decimal place; this is the rounding band. */
export const UPSTREAM_SCORE_ROUNDING_TOLERANCE = 0.05;

export interface PopulationStandardDeviationData {
  standardDeviation: number;
  histogramPopulation: number;
  histogramMean: number;
  upstreamScore: number;
}

export type RatingPercentages = Record<keyof RatingHistogram, number>;

function formulaSource(formula: FormulaDescriptor): SourceDescriptor {
  return {
    ...SOURCE_DERIVED,
    operation: formula.id,
    version: String(formula.version),
  };
}

function inputEvidence(input: FieldEvidence, fields: string[]): FieldEvidence {
  return Object.fromEntries(
    fields.flatMap((field) => {
      const refs = input[field];
      return refs && refs.length > 0 ? [[field, refs]] : [];
    }),
  );
}

function formulaEvidence(
  formula: FormulaDescriptor,
  retrievedAt: string,
  fieldPath: string,
): ReturnType<typeof createEvidenceRef> {
  return createEvidenceRef({
    source: formulaSource(formula),
    retrievedAt,
    fieldPath,
    freshness: { state: 'fresh' },
    confidence: 'high',
    formula: formula.id,
  });
}

function histogramPopulation(histogram: RatingHistogram): number {
  return Object.values(histogram).reduce((total, count) => total + count, 0);
}

function histogramMean(histogram: RatingHistogram, population: number): number {
  return (
    Object.entries(histogram).reduce((total, [score, count]) => total + Number(score) * count, 0) /
    population
  );
}

export function getFormulaDescriptor(id: string): FormulaDescriptor | undefined {
  return FORMULA_REGISTRY.find((formula) => formula.id === id);
}

export function computeCollectionCompletionRate(
  stats: SubjectStatsData,
  input: FieldEvidence = {},
  retrievedAt = new Date().toISOString(),
): CapabilityResult<number | null> {
  const denominator =
    stats.collection.wish +
    stats.collection.collect +
    stats.collection.doing +
    stats.collection.onHold +
    stats.collection.dropped;
  const formulaRef = formulaEvidence(COMPLETION_FORMULA, retrievedAt, 'completionRate');
  const inputs = inputEvidence(input, COMPLETION_FORMULA.inputs);

  if (denominator === 0) {
    return {
      state: 'not_computable',
      data: null,
      evidence: { value: [formulaRef], ...inputs },
      retrievedAt,
      warnings: [
        warning('MISSING_FIELD', 'Collection denominator is zero; completion is not computable.'),
      ],
    };
  }

  return {
    state: 'ok',
    data: stats.collection.collect / denominator,
    evidence: { value: [formulaRef], ...inputs },
    retrievedAt,
    warnings: [
      warning(
        'FORMULA_EMPIRICALLY_VERIFIED',
        'Completion formula matched five live samples; it is not an official API contract.',
        { source: formulaSource(COMPLETION_FORMULA) },
      ),
    ],
  };
}

export function computeRatingPercentages(
  histogram: RatingHistogram,
  input: FieldEvidence = {},
  retrievedAt = new Date().toISOString(),
): CapabilityResult<RatingPercentages | null> {
  const population = histogramPopulation(histogram);
  const formulaRef = formulaEvidence(RATING_PERCENTAGES_FORMULA, retrievedAt, 'percentages');
  const inputs = inputEvidence(input, RATING_PERCENTAGES_FORMULA.inputs);
  if (population === 0) {
    return {
      state: 'not_computable',
      data: null,
      evidence: { value: [formulaRef], ...inputs },
      retrievedAt,
      warnings: [
        warning(
          'MISSING_FIELD',
          'Rating histogram population is zero; percentages are not computable.',
        ),
      ],
    };
  }

  const data = {} as RatingPercentages;
  for (let score = 1; score <= 10; score += 1) {
    data[score as keyof RatingHistogram] =
      (histogram[score as keyof RatingHistogram] / population) * 100;
  }
  return { state: 'ok', data, evidence: { value: [formulaRef], ...inputs }, retrievedAt };
}

export function computePopulationStandardDeviation(
  stats: SubjectStatsData,
  input: FieldEvidence = {},
  retrievedAt = new Date().toISOString(),
): CapabilityResult<PopulationStandardDeviationData | null> {
  const population = histogramPopulation(stats.ratingHistogram);
  const formulaRef = formulaEvidence(POPULATION_SD_FORMULA, retrievedAt, 'standardDeviation');
  const inputs = inputEvidence(input, POPULATION_SD_FORMULA.inputs);
  if (population === 0) {
    return {
      state: 'not_computable',
      data: null,
      evidence: { value: [formulaRef], ...inputs },
      retrievedAt,
      warnings: [
        warning(
          'MISSING_FIELD',
          'Rating histogram population is zero; standard deviation is not computable.',
        ),
      ],
    };
  }

  const mean = histogramMean(stats.ratingHistogram, population);
  const variance =
    Object.entries(stats.ratingHistogram).reduce(
      (total, [score, count]) => total + count * (Number(score) - mean) ** 2,
      0,
    ) / population;
  const data: PopulationStandardDeviationData = {
    standardDeviation: Math.sqrt(variance),
    histogramPopulation: population,
    histogramMean: mean,
    upstreamScore: stats.score,
  };
  const warnings: CapabilityWarning[] = [];
  const conflicts: CapabilityConflict<number>[] = [];
  const scoreDelta = Math.abs(mean - stats.score);
  if (scoreDelta > 0) {
    warnings.push(
      warning(
        'SOURCE_DISAGREEMENT',
        scoreDelta <= UPSTREAM_SCORE_ROUNDING_TOLERANCE
          ? 'Histogram mean differs within the upstream one-decimal score rounding band.'
          : 'Histogram mean differs materially from upstream score; both values are retained.',
        { source: formulaSource(POPULATION_SD_FORMULA) },
      ),
    );
    if (scoreDelta > UPSTREAM_SCORE_ROUNDING_TOLERANCE) {
      conflicts.push({
        state: 'conflict',
        reason: 'derived histogram mean differs materially from upstream score',
        candidates: [
          { source: SOURCE_DERIVED, value: mean, evidence: [formulaRef] },
          {
            source: {
              class: 'official_v0',
              provider: 'bangumi',
              operation: 'getSubjectById',
            } as const,
            value: stats.score,
            evidence: input.score,
          },
        ],
      });
    }
  }

  return {
    state: conflicts.length > 0 ? 'conflict' : 'ok',
    data,
    evidence: { value: [formulaRef], ...inputs },
    retrievedAt,
    warnings,
    conflicts: conflicts.length > 0 ? conflicts : undefined,
  };
}
