import type { DomainPerson } from './person.js';
import type { SubjectType } from './subject.js';

export type PersonActivityKind = 'voice' | 'staff' | 'all';
export type PersonActivityMedia = 'anime' | 'tv' | 'all';
export type PersonActivityState = 'complete' | 'partial' | 'unavailable' | 'not_computable';
export type PersonActivityRelationKind = 'voice' | 'staff';
export type PersonActivityRoleFamily = 'main' | 'support' | 'staff' | 'unknown';

export interface PersonActivityWindow {
  months: number;
  start: string;
  end: string;
  monthKeys: string[];
  asOfSemantics: 'calendar_months_ending_on_as_of_date';
}

export interface PersonActivityRow {
  subjectId: number;
  subjectName: string;
  subjectNameCn: string;
  subjectType: SubjectType;
  platform?: string;
  firstAirDate: string;
  month: string;
  relationKind: PersonActivityRelationKind;
  relationId?: number;
  characterName?: string;
  rawRole?: string;
  roleFamily: PersonActivityRoleFamily;
}

export type PersonActivityExclusionReason =
  | 'missing_subject_id'
  | 'subject_detail_cap'
  | 'subject_detail_unavailable'
  | 'missing_date'
  | 'invalid_date'
  | 'outside_window'
  | 'media_excluded'
  | 'media_unknown';

export interface PersonActivityExclusion {
  reason: PersonActivityExclusionReason;
  count: number;
  sampleSubjectIds: number[];
}

export interface PersonActivityWindowDistribution {
  key: string;
  label: string;
  creditRows: number;
  uniqueSubjects: number;
  uniqueCharacters: number;
}

export interface PersonActivityMonthBucket {
  month: string;
  creditRows: number;
  uniqueSubjects: number;
  uniqueCharacters: number;
}

export interface PersonActivityWindowSummary {
  creditRows: number;
  uniqueSubjects: number;
  uniqueCharacters: number;
  byRole: PersonActivityWindowDistribution[];
  byMedia: PersonActivityWindowDistribution[];
  byMonth: PersonActivityMonthBucket[];
}

export interface PersonActivityComparisonDelta {
  state: PersonActivityState;
  creditRows?: number;
  uniqueSubjects?: number;
  uniqueCharacters?: number;
}

export interface PersonActivityComparisonPeriod {
  window: PersonActivityWindow;
  summary: PersonActivityWindowSummary;
  state: PersonActivityState;
  coverage: PersonActivityCoverage;
}

export interface PersonActivityPeakMonth {
  period: 'recent' | 'previous';
  month: string;
  creditRows: number;
  uniqueSubjects: number;
  uniqueCharacters: number;
}

export interface PersonActivityComparison {
  state: PersonActivityState;
  windowMonths: number;
  recent: PersonActivityComparisonPeriod;
  previous: PersonActivityComparisonPeriod;
  delta: PersonActivityComparisonDelta;
  peak: {
    metric: 'uniqueSubjects';
    state: PersonActivityState;
    months: PersonActivityPeakMonth[];
  };
  sourceOperations: {
    recent: PersonActivitySourceOperation[];
    previous: PersonActivitySourceOperation[];
  };
}

export interface PersonActivitySourceOperation {
  operation: string;
  attempted: number;
  succeeded: number;
  failed: number;
}

export interface PersonActivityCoverage {
  relationRowsObserved: number;
  relationRowsSelected: number;
  relationRowsDroppedAtLimit: number;
  relationSelectionStrategy: 'all' | 'deterministic_even_spread';
  sampled: boolean;
  subjectIdsObserved: number;
  subjectIdsSelected: number;
  subjectIdsDroppedAtRelationLimit: number;
  subjectDetailIdsObserved: number;
  subjectDetailRequests: number;
  subjectDetailsSucceeded: number;
  subjectDetailsFailed: number;
  subjectDetailIdsDroppedAtLimit: number;
  rowsEligible: number;
  rowsReturned: number;
  outputTruncated: boolean;
  uniqueSubjects: number;
  uniqueCharacters: number;
  missingSubjectIdRows: number;
  missingDateRows: number;
  invalidDateRows: number;
  outsideWindowRows: number;
  mediaExcludedRows: number;
  mediaUnknownRows: number;
  maxRelations: number;
  maxSubjectDetails: number;
  maxRows: number;
  detailConcurrency: number;
  truncated: boolean;
  retrievedAt: string;
}

export interface PersonActivityResult {
  personId: number;
  state: PersonActivityState;
  person?: DomainPerson;
  kind: PersonActivityKind;
  media: PersonActivityMedia;
  window: PersonActivityWindow;
  rows: PersonActivityRow[];
  summary: PersonActivityWindowSummary;
  comparison?: PersonActivityComparison;
  coverage: PersonActivityCoverage;
  exclusions: PersonActivityExclusion[];
  sourceOperations: PersonActivitySourceOperation[];
  evidence: Array<{
    source: 'official-v0' | 'derived-s7';
    operation: string;
    retrievedAt?: string;
    formulaVersion?: string;
    description?: string;
  }>;
  limitations: string[];
  warnings: Array<{
    code: string;
    state: PersonActivityState;
    message: string;
  }>;
}
