import type { SubjectOverviewSectionState } from './subject-overview.js';
import type { SubjectType } from './subject.js';

export type SubjectOverlapKind = 'cast' | 'staff' | 'all';
export type SubjectOverlapCastRole = 'all' | 'main';
export type SubjectOverlapState =
  'complete' | 'partial' | 'unavailable' | 'not_found' | 'not_computable';
export type SubjectOverlapRelationState = Exclude<SubjectOverlapState, 'not_found'>;
export type SubjectOverlapRoleFamily = 'main' | 'support' | 'unknown';

export interface SubjectOverlapSubject {
  subjectId: number;
  state: SubjectOverlapState;
  subject?: {
    id: number;
    name: string;
    nameCn?: string;
    type: SubjectType;
    date?: string;
    platform?: string;
  };
  sections: {
    cast: SubjectOverviewSectionState;
    staff: SubjectOverviewSectionState;
  };
  coverage: {
    sourceRequestsAttempted: number;
    sourceRequestsSucceeded: number;
    cast: { observed: number; returned: number; truncated: boolean };
    staff: { observed: number; returned: number; truncated: boolean };
  };
}

export interface SubjectOverlapSideCoverage {
  subjectId: number;
  state: SubjectOverlapRelationState;
  rowsObserved: number;
  rowsReturned: number;
  uniqueIdsReturned: number;
  missingIdRows: number;
  unknownRoleRows?: number;
  truncated: boolean;
}

export interface SubjectOverlapCoverage {
  state: SubjectOverlapRelationState;
  left: SubjectOverlapSideCoverage;
  right: SubjectOverlapSideCoverage;
  candidateIds?: number;
  matchedIds?: number;
  unionIds?: number;
  returned: number;
  omitted: number;
  overlapRate?: number;
  truncated: boolean;
}

export interface SubjectOverlapCastCredit {
  subjectId: number;
  characters: Array<{
    characterId?: number;
    name: string;
    relation: string;
    roleFamily: SubjectOverlapRoleFamily;
  }>;
}

export interface SubjectOverlapCastPerson {
  personId: number;
  name: string;
  nameVariants?: string[];
  career: string[];
  matchBasis: 'all_cast_credits' | 'recognized_main_role';
  credits: SubjectOverlapCastCredit[];
}

export interface SubjectOverlapCastRoleEvidence {
  subjectId: number;
  personId: number;
  name: string;
  nameVariants?: string[];
  career: string[];
  roleFamily: SubjectOverlapRoleFamily;
  credits: SubjectOverlapCastCredit[];
}

export interface SubjectOverlapStaffCredit {
  subjectId: number;
  rawRelations: string[];
  relations: string[];
  eps: string[];
}

export interface SubjectOverlapStaffPerson {
  personId: number;
  name: string;
  nameVariants?: string[];
  career: string[];
  credits: SubjectOverlapStaffCredit[];
}

export interface SubjectOverlapCastRelation {
  state: SubjectOverlapRelationState;
  items: SubjectOverlapCastPerson[];
  coverage: SubjectOverlapCoverage;
  roleEvidence?: SubjectOverlapCastRoleEvidence[];
  roleEvidenceOmitted?: number;
}

export interface SubjectOverlapStaffRelation {
  state: SubjectOverlapRelationState;
  items: SubjectOverlapStaffPerson[];
  coverage: SubjectOverlapCoverage;
}

export interface SubjectOverlapPair {
  pairId: string;
  leftSubjectId: number;
  rightSubjectId: number;
  rank: number;
  rankScore: number | null;
  rankBasis: 'cast_matched_ids' | 'staff_matched_ids' | 'combined_matched_ids';
  cast?: SubjectOverlapCastRelation;
  staff?: SubjectOverlapStaffRelation;
}

export interface SubjectOverlapSourceSummary {
  class: 'official-v0' | 'derived-s7';
  operations: string[];
  attemptedAt: string;
  retrievedAt?: string;
}

export type SubjectOverlapOperationOutcome =
  'succeeded' | 'partial' | 'unavailable' | 'not_found' | 'not_computable' | 'schema_drift';

export interface SubjectOverlapOperationEvidence {
  source: 'official-v0' | 'derived-s7';
  operation: string;
  subjectId?: number;
  attemptedAt: string;
  retrievedAt?: string;
  outcome: SubjectOverlapOperationOutcome;
  code?: string;
  message?: string;
}

export interface SubjectOverlapResult {
  subjectIds: number[];
  state: SubjectOverlapState;
  kind: SubjectOverlapKind;
  castRole: SubjectOverlapCastRole;
  subjects: SubjectOverlapSubject[];
  pairs: SubjectOverlapPair[];
  formulaVersion: 'subject-overlap-v1';
  coverage: {
    requestedSubjects: number;
    returnedSubjects: number;
    requestedPairs: number;
    returnedPairs: number;
    omittedPairs: number;
    limits: {
      maxSubjects: number;
      maxCast: number;
      maxStaff: number;
      maxPairs: number;
      maxPeople: number;
    };
    truncated: boolean;
  };
  source: {
    official: SubjectOverlapSourceSummary & { class: 'official-v0' };
    derived: SubjectOverlapSourceSummary & { class: 'derived-s7' };
  };
  operationEvidence: SubjectOverlapOperationEvidence[];
  evidence: Array<{
    source: 'official-v0' | 'derived-s7';
    operation: string;
    subjectIds?: number[];
    attemptedAt?: string;
    retrievedAt?: string;
    formulaVersion?: string;
    description?: string;
  }>;
  warnings: Array<{
    code: string;
    state: SubjectOverlapState;
    subjectId?: number;
    message: string;
  }>;
  limitations: string[];
}
