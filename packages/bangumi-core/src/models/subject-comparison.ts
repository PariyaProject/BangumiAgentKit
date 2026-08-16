import type { PublicErrorInfo } from '@bangumi-agent-kit/bangumi-transport';
import type {
  SubjectOverviewEvidence,
  SubjectOverviewStatsConflictCandidate,
  SubjectOverviewSectionState,
  SubjectOverviewWarning,
} from './subject-overview.js';
import type { SubjectStatsIntelligenceResult } from './subject-stats-intelligence.js';
import type { SubjectType } from './subject.js';

export type SubjectComparisonState = 'complete' | 'partial' | 'unavailable' | 'not_found';

export interface SubjectComparisonSourceSummary {
  class: 'official-v0' | 'derived-s7';
  operations: string[];
  attemptedAt: string;
  retrievedAt?: string;
}

export type SubjectComparisonMetricKey =
  | 'episodesReported'
  | 'totalEpisodesReported'
  | 'score'
  | 'rank'
  | 'ratingTotal'
  | 'collectionTotal'
  | 'ratingPopulation'
  | 'ratingMean'
  | 'ratingStandardDeviation'
  | 'collectionPopulation'
  | 'collectionCompletionRate';

export type SubjectComparisonStatsKey = Exclude<
  SubjectComparisonMetricKey,
  'episodesReported' | 'totalEpisodesReported'
>;

export interface SubjectComparisonStatsConflict {
  subjectValue?: number;
  statsValue?: number;
  candidates?: Array<SubjectOverviewStatsConflictCandidate & { metricValue?: number }>;
  reason?: string;
  resolution?: string;
}

export interface SubjectComparisonSubject {
  subjectId: number;
  state: SubjectComparisonState;
  subject?: {
    id: number;
    type: SubjectType;
    name: string;
    nameCn?: string;
    date?: string;
    platform?: string;
    episodesReported?: number;
    totalEpisodesReported?: number;
  };
  stats: {
    state: SubjectOverviewSectionState;
    score?: number;
    rank?: number;
    ratingTotal?: number;
    collectionTotal?: number;
    conflicts?: Partial<Record<SubjectComparisonStatsKey, SubjectComparisonStatsConflict>>;
  };
  sections: {
    stats: SubjectOverviewSectionState;
    cast: SubjectOverviewSectionState;
    staff: SubjectOverviewSectionState;
    relations: SubjectOverviewSectionState;
  };
  coverage: {
    sourceRequestsAttempted: number;
    sourceRequestsSucceeded: number;
    sectionsComplete: number;
    sectionsPartial: number;
    sectionsUnavailable: number;
    sectionsNotComputable: number;
    truncatedSections: string[];
    limits: {
      maxCast: number;
      maxStaff: number;
      maxRelations: number;
    };
  };
  source: {
    official: SubjectComparisonSourceSummary & { class: 'official-v0' };
    derived: SubjectComparisonSourceSummary & { class: 'derived-s7' };
  };
  /**
   * The complete statistics result is additive to the original headline
   * stats. Keeping it nested preserves the compact comparison fields while
   * making formula, coverage, and degraded-state details available to Agents
   * and renderers.
   */
  statistics?: SubjectStatsIntelligenceResult;
  evidence: SubjectOverviewEvidence[];
  warnings: SubjectOverviewWarning[];
  limitations: string[];
  error?: PublicErrorInfo;
}

export interface SubjectComparisonMetric {
  key: SubjectComparisonMetricKey;
  label: string;
  values: [number | null, number | null];
  delta: number | null;
  deltaPrecision: number;
  state: 'complete' | 'unknown' | 'conflict';
  conflicts?: Array<
    {
      side: 'A' | 'B';
    } & SubjectComparisonStatsConflict
  >;
}

export interface SubjectComparisonOverlapSideCoverage {
  state: SubjectOverviewSectionState;
  rowsObserved: number;
  rowsReturned: number;
  uniqueIdsReturned: number;
  missingIdRows: number;
  truncated: boolean;
}

export interface SubjectComparisonOverlapCoverage {
  state: SubjectOverviewSectionState;
  left: SubjectComparisonOverlapSideCoverage;
  right: SubjectComparisonOverlapSideCoverage;
  candidateIds?: number;
  matchedIds?: number;
  returned: number;
  omitted: number;
  truncated: boolean;
}

export interface SubjectComparisonCastOverlapCredit {
  side: 'A' | 'B';
  subjectId: number;
  characters: Array<{
    characterId?: number;
    name: string;
    relation: string;
  }>;
}

export interface SubjectComparisonCastOverlapItem {
  personId: number;
  name: string;
  nameVariants?: string[];
  career: string[];
  credits: SubjectComparisonCastOverlapCredit[];
}

export interface SubjectComparisonStaffOverlapCredit {
  side: 'A' | 'B';
  subjectId: number;
  rawRelations: string[];
  relations: string[];
  eps: string[];
}

export interface SubjectComparisonStaffOverlapItem {
  personId: number;
  name: string;
  nameVariants?: string[];
  career: string[];
  credits: SubjectComparisonStaffOverlapCredit[];
}

export interface SubjectComparisonCastOverlap {
  state: SubjectOverviewSectionState;
  items: SubjectComparisonCastOverlapItem[];
  coverage: SubjectComparisonOverlapCoverage;
}

export interface SubjectComparisonStaffOverlap {
  state: SubjectOverviewSectionState;
  items: SubjectComparisonStaffOverlapItem[];
  coverage: SubjectComparisonOverlapCoverage;
}

export interface SubjectComparisonResult {
  subjectIds: [number, number];
  state: SubjectComparisonState;
  subjects: [SubjectComparisonSubject, SubjectComparisonSubject];
  metrics: SubjectComparisonMetric[];
  formulaVersion: 'subject-comparison-v2';
  statisticsFormulaVersion?: 'subject-comparison-statistics-v1';
  overlapFormulaVersion: 'subject-comparison-overlap-v1';
  overlaps: {
    cast: SubjectComparisonCastOverlap;
    staff: SubjectComparisonStaffOverlap;
  };
  coverage: {
    requestedSubjects: 2;
    returnedSubjects: number;
    subjectsComplete: number;
    subjectsPartial: number;
    subjectsUnavailable: number;
    subjectsNotFound: number;
    metricsComplete: number;
    metricsUnknown: number;
    metricsConflict: number;
    limits: {
      maxSubjects: 2;
      maxCast: number;
      maxStaff: number;
      maxRelations: number;
      maxOverlapItems: number;
    };
  };
  source: {
    official: SubjectComparisonSourceSummary & { class: 'official-v0' };
    derived: SubjectComparisonSourceSummary & { class: 'derived-s7' };
  };
  evidence: Array<SubjectOverviewEvidence & { subjectIds?: number[] }>;
  warnings: Array<{
    code: string;
    state: SubjectComparisonState;
    subjectId?: number;
    message: string;
  }>;
  limitations: string[];
  error?: PublicErrorInfo;
}
