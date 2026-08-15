import type { PublicErrorInfo } from '@bangumi-agent-kit/bangumi-transport';
import type {
  SubjectOverviewEvidence,
  SubjectOverviewSectionState,
  SubjectOverviewWarning,
} from './subject-overview.js';
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
  | 'collectionTotal';

export type SubjectComparisonStatsKey = Exclude<
  SubjectComparisonMetricKey,
  'episodesReported' | 'totalEpisodesReported'
>;

export interface SubjectComparisonStatsConflict {
  subjectValue: number;
  statsValue: number;
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
  conflicts?: Array<{
    side: 'A' | 'B';
    subjectValue: number;
    statsValue: number;
  }>;
}

export interface SubjectComparisonResult {
  subjectIds: [number, number];
  state: SubjectComparisonState;
  subjects: [SubjectComparisonSubject, SubjectComparisonSubject];
  metrics: SubjectComparisonMetric[];
  formulaVersion: 'subject-comparison-v2';
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
