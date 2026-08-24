import type { SubjectStatsIntelligenceResult } from './subject-stats-intelligence.js';

export type SubjectStatsHistoryState =
  'complete' | 'partial' | 'conflict' | 'unavailable' | 'not_found' | 'not_computable';

export type SubjectStatsHistoryMetricKey =
  | 'score'
  | 'ratingTotal'
  | 'histogramMean'
  | 'populationStandardDeviation'
  | 'collectionTotal'
  | 'completionRate'
  | 'ratingBucket1'
  | 'ratingBucket2'
  | 'ratingBucket3'
  | 'ratingBucket4'
  | 'ratingBucket5'
  | 'ratingBucket6'
  | 'ratingBucket7'
  | 'ratingBucket8'
  | 'ratingBucket9'
  | 'ratingBucket10'
  | 'collectionWish'
  | 'collectionCollect'
  | 'collectionDoing'
  | 'collectionOnHold'
  | 'collectionDropped';

export type SubjectStatsHistoryMetricState = 'complete' | 'partial' | 'conflict' | 'not_computable';
export type SubjectStatsHistoryCompatibilityState = 'compatible' | 'unsupported';

export interface SubjectStatsHistoryObservation {
  id: string;
  observedAt: string;
  retrievedAt?: string;
  retentionUntil: string;
  state: SubjectStatsHistoryState;
  methodologyVersion: string;
  compatibility: {
    state: SubjectStatsHistoryCompatibilityState;
    reason?: string;
  };
  snapshot: SubjectStatsIntelligenceResult;
}

export interface SubjectStatsHistoryMetricChange {
  key: SubjectStatsHistoryMetricKey;
  state: SubjectStatsHistoryMetricState;
  from?: number;
  to?: number;
  delta?: number;
  reason?: string;
}

export interface SubjectStatsHistoryChange {
  fromObservationId: string;
  toObservationId: string;
  fromObservedAt: string;
  toObservedAt: string;
  state: SubjectStatsHistoryMetricState;
  compatibility: {
    state: SubjectStatsHistoryCompatibilityState;
    reason?: string;
  };
  metrics: SubjectStatsHistoryMetricChange[];
}

export interface SubjectStatsHistoryResult {
  subjectId: number;
  state: SubjectStatsHistoryState;
  collection: {
    startedAt?: string;
    retentionDays: number;
    maxObservations: number;
    recordedObservations: number;
    retainedObservations: number;
    observationsObserved: number;
    observationsReturned: number;
    completeObservations: number;
    changePairs: number;
    truncated: boolean;
    expiredObservations: number;
    prunedObservations: number;
    retentionUntilEarliest?: string;
    retentionUntilLatest?: string;
    resourceBounds: {
      maxActiveSubjects: number;
      hostConcurrency: number;
      maxSubjectId: number;
      maxCleanupRows: number;
    };
    recordCurrent: boolean;
    recordedObservationId?: string;
  };
  observations: SubjectStatsHistoryObservation[];
  changes: SubjectStatsHistoryChange[];
  methodology: {
    id: 'bangumi.subject.stats.observation-history';
    version: 1;
    metrics: SubjectStatsHistoryMetricKey[];
    description: string;
  };
  source: {
    official: {
      class: 'official-v0';
      operations: string[];
      observationCount: number;
    };
    derived: {
      class: 'derived-s7';
      operations: string[];
      observationCount: number;
    };
  };
  warnings: Array<{ code: string; message: string }>;
  limitations: string[];
}
