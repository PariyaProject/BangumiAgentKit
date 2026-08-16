import type { PublicErrorInfo } from '@bangumi-agent-kit/bangumi-transport';

export type SubjectStatsIntelligenceState =
  'complete' | 'partial' | 'conflict' | 'unavailable' | 'not_found' | 'not_computable';

export type SubjectStatsMetricState =
  'complete' | 'partial' | 'conflict' | 'unavailable' | 'not_computable';

export interface SubjectStatsRatingHistogram {
  1: number;
  2: number;
  3: number;
  4: number;
  5: number;
  6: number;
  7: number;
  8: number;
  9: number;
  10: number;
}

export type SubjectStatsRatingHistogramPresence = {
  [Score in keyof SubjectStatsRatingHistogram]: boolean;
};

export interface SubjectStatsCollectionBuckets {
  wish: number;
  collect: number;
  doing: number;
  onHold: number;
  dropped: number;
}

export interface SubjectStatsCollectionPresence {
  wish: boolean;
  collect: boolean;
  doing: boolean;
  onHold: boolean;
  dropped: boolean;
}

export type SubjectStatsCollectionStatus = 'wish' | 'collect' | 'doing' | 'on_hold' | 'dropped';

export interface SubjectStatsFormulaDescriptor {
  id: string;
  version: number;
  inputs: string[];
  evidenceStatus: 'official_contract' | 'empirically_verified' | 'derived';
  description: string;
}

export interface SubjectStatsEvidence {
  source: 'official-v0' | 'derived-s7';
  provider: string;
  operation?: string;
  retrievedAt?: string;
  fieldPath?: string;
  formula?: string;
  formulaVersion?: number;
  description?: string;
}

export interface SubjectStatsConflictCandidate {
  source: {
    class: 'official-v0' | 'derived-s7';
    provider: string;
    operation?: string;
    version?: string;
  };
  value: number;
  evidence?: SubjectStatsEvidence[];
}

export type SubjectStatsConflictScope = 'headline' | 'rating' | 'collection' | 'unknown';

export interface SubjectStatsConflict {
  state: 'conflict';
  reason: string;
  candidates: SubjectStatsConflictCandidate[];
  fieldPaths?: string[];
  scope?: SubjectStatsConflictScope;
}

export interface SubjectStatsIntelligenceResult {
  subjectId: number;
  state: SubjectStatsIntelligenceState;
  raw?: {
    score: number;
    rank: number;
    ratingTotal: number;
    ratingHistogram: SubjectStatsRatingHistogram;
    ratingHistogramPresence?: SubjectStatsRatingHistogramPresence;
    collection: SubjectStatsCollectionBuckets;
    collectionPresence?: SubjectStatsCollectionPresence;
  };
  rating: {
    state: SubjectStatsMetricState;
    population?: number;
    mean?: number;
    standardDeviation?: number;
    distribution: Array<{ score: number; count?: number; percentage?: number }>;
    formulas: {
      percentages: SubjectStatsFormulaDescriptor;
      histogramMean: SubjectStatsFormulaDescriptor;
      populationStandardDeviation: SubjectStatsFormulaDescriptor;
    };
    conflicts?: SubjectStatsConflict[];
  };
  collection: {
    state: SubjectStatsMetricState;
    total?: number;
    distribution: Array<{
      status: SubjectStatsCollectionStatus;
      count?: number;
      percentage?: number;
    }>;
    completionRate?: number;
    completionState: SubjectStatsMetricState;
    formulas: {
      percentages: SubjectStatsFormulaDescriptor;
      completion: SubjectStatsFormulaDescriptor;
    };
    conflicts?: SubjectStatsConflict[];
  };
  coverage: {
    sourceRequestsAttempted: number;
    sourceRequestsSucceeded: number;
    ratingBucketsExpected: number;
    ratingBucketsObserved: number;
    collectionBucketsExpected: number;
    collectionBucketsObserved: number;
    ratingPopulation?: number;
    collectionPopulation?: number;
    formulasAttempted: number;
    formulasComplete: number;
    formulasPartial: number;
    formulasNotComputable: number;
    formulasConflict: number;
  };
  source: {
    official: {
      class: 'official-v0';
      operations: string[];
      retrievedAt?: string;
    };
    derived: {
      class: 'derived-s7';
      operations: string[];
      retrievedAt?: string;
    };
  };
  conflicts?: SubjectStatsConflict[];
  evidence: SubjectStatsEvidence[];
  warnings: Array<{
    code: string;
    state: SubjectStatsIntelligenceState | SubjectStatsMetricState;
    message: string;
  }>;
  limitations: string[];
  retrievedAt?: string;
  error?: PublicErrorInfo;
}
