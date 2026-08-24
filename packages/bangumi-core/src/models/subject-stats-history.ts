import type { SubjectStatsIntelligenceResult } from './subject-stats-intelligence.js';

export type SubjectStatsHistoryState =
  'complete' | 'partial' | 'conflict' | 'unavailable' | 'not_found' | 'not_computable';

export type SubjectStatsHistoryMetricKey =
  | 'score'
  | 'ratingTotal'
  | 'histogramMean'
  | 'populationStandardDeviation'
  | 'collectionTotal'
  | 'completionRate';

export type SubjectStatsHistoryMetricState = 'complete' | 'partial' | 'conflict' | 'not_computable';

export interface SubjectStatsHistoryObservation {
  id: string;
  observedAt: string;
  retrievedAt?: string;
  retentionUntil: string;
  state: SubjectStatsHistoryState;
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
  metrics: SubjectStatsHistoryMetricChange[];
}

export interface SubjectStatsHistoryResult {
  subjectId: number;
  state: SubjectStatsHistoryState;
  collection: {
    startedAt?: string;
    retentionDays: number;
    maxObservations: number;
    observationsObserved: number;
    observationsReturned: number;
    completeObservations: number;
    changePairs: number;
    truncated: boolean;
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
