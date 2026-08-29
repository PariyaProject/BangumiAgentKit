import type { DomainPerson } from './person.js';
import type { SubjectType } from './subject.js';

export type PersonCollaborationKind = 'voice' | 'staff' | 'all';
export type PersonCollaborationMedia = 'anime' | 'all';
export type PersonCollaborationRelationKind = 'voice' | 'staff';
export type PersonCollaborationState =
  'complete' | 'partial' | 'unavailable' | 'not_computable' | 'not_found';

export interface PersonCollaborationOptions {
  kind?: PersonCollaborationKind;
  media?: PersonCollaborationMedia;
  /** Literal, case-insensitive match against the target person's source role label. */
  targetRole?: string;
  /** Literal, case-insensitive match against a staff collaborator's source relation label. */
  collaboratorRole?: string;
  maxRelations?: number;
  maxSubjects?: number;
  maxCollaborators?: number;
  maxSharedSubjects?: number;
}

export interface PersonCollaborationSharedSubject {
  id: number;
  name: string;
  nameCn: string;
  type: SubjectType;
  relationKinds: PersonCollaborationRelationKind[];
  targetRoles: string[];
  collaboratorRoles: string[];
}

export interface PersonCollaborationCollaborator {
  id: number;
  name: string;
  nameCn?: string;
  image?: string;
  career: string[];
  uniqueSubjects: number;
  creditRows: number;
  relationKinds: PersonCollaborationRelationKind[];
  roleLabels: string[];
  sharedSubjects: PersonCollaborationSharedSubject[];
  sharedSubjectsOmitted: number;
}

export type PersonCollaborationExclusionReason =
  | 'missing_subject_id'
  | 'missing_subject_type'
  | 'target_role_excluded'
  | 'media_excluded'
  | 'media_unknown'
  | 'subject_cap'
  | 'malformed_relation'
  | 'collaborator_role_excluded'
  | 'collaborator_role_unavailable'
  | 'malformed_participant'
  | 'self_collaboration'
  | 'fanout_unavailable'
  | 'collaborator_output_cap'
  | 'shared_subject_output_cap'
  | 'source_response_cap';

export interface PersonCollaborationExclusion {
  reason: PersonCollaborationExclusionReason;
  count: number;
  sampleSubjectIds: number[];
}

export interface PersonCollaborationSourceOperation {
  operation: string;
  attempted: number;
  succeeded: number;
  failed: number;
  rowsOmitted?: number;
  rowsMalformed?: number;
  outcomes: Array<{
    state: 'succeeded' | 'failed';
    retrievedAt: string;
    errorCode?: string;
    rowsOmitted?: number;
    rowsMalformed?: number;
  }>;
}

export interface PersonCollaborationCoverage {
  relationRowsObserved: number;
  relationRowsMatchingFilters: number;
  relationRowsSelected: number;
  relationRowsDroppedAtLimit: number;
  relationSelectionStrategy: 'all' | 'deterministic_even_spread';
  sampled: boolean;
  subjectIdsObserved: number;
  subjectIdsSelected: number;
  subjectIdsDroppedAtRelationLimit: number;
  subjectIdsDroppedAtSubjectLimit: number;
  relationRowsDroppedAtSourceLimit: number;
  malformedRelationRows: number;
  fanoutRowsDroppedAtSourceLimit: number;
  participantRowsDroppedAtSourceLimit: number;
  participantRequests: number;
  participantRequestsSucceeded: number;
  participantRequestsFailed: number;
  participantRequestsSkippedForRoleFilter: number;
  participantRowsObserved: number;
  participantRowsReturned: number;
  malformedParticipantRows: number;
  selfRowsExcluded: number;
  collaboratorRoleExcludedRows: number;
  collaboratorRoleUnavailableRows: number;
  collaboratorsObserved: number;
  collaboratorsReturned: number;
  collaboratorIdsDroppedAtLimit: number;
  sharedSubjectRowsObserved: number;
  sharedSubjectRowsReturned: number;
  sharedSubjectRowsOmittedAtLimit: number;
  maxRelations: number;
  maxSubjects: number;
  maxCollaborators: number;
  maxSharedSubjects: number;
  fanoutConcurrency: number;
  mediaExcludedRows: number;
  mediaUnknownRows: number;
  targetRoleExcludedRows: number;
  missingSubjectIdRows: number;
  missingSubjectTypeRows: number;
  truncated: boolean;
  retrievedAt: string;
}

export interface PersonCollaborationResult {
  personId: number;
  state: PersonCollaborationState;
  person?: DomainPerson;
  kind: PersonCollaborationKind;
  media: PersonCollaborationMedia;
  targetRole?: string;
  collaboratorRole?: string;
  collaborators: PersonCollaborationCollaborator[];
  coverage: PersonCollaborationCoverage;
  exclusions: PersonCollaborationExclusion[];
  sourceOperations: PersonCollaborationSourceOperation[];
  evidence: Array<{
    source: 'official-v0' | 'derived-s7';
    operation: string;
    retrievedAt?: string;
    outcome?: 'succeeded' | 'failed';
    errorCode?: string;
    rowsOmitted?: number;
    rowsMalformed?: number;
    formulaVersion?: string;
    description?: string;
  }>;
  limitations: string[];
  warnings: Array<{
    code: string;
    state: PersonCollaborationState;
    message: string;
  }>;
}
