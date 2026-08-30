export type CollectionEntityConsistencyState =
  'complete' | 'partial' | 'unavailable' | 'not_computable';

export type CollectionEntityKind = 'character' | 'person';

export type CollectionEntityConsistencyConflictScope =
  'subject-root' | 'character-collection' | 'person-collection';

export interface CollectionEntityConsistencyConflict {
  scope: CollectionEntityConsistencyConflictScope;
  id: number;
  observed: number;
  fields: string[];
}

export interface CollectionEntityConsistencyOptions {
  subjectType?: number | string;
  status?: number | string;
  maxSubjects?: number;
  maxSubjectPages?: number;
  maxRelationsPerSubject?: number;
  maxOutputRows?: number;
  signal?: AbortSignal;
}

export type CollectionEntityConsistencyEvidenceKind =
  'subject-character' | 'character-actor' | 'subject-person';

export interface CollectionEntityConsistencySubject {
  id: number;
  name?: string;
  nameCn?: string;
  type?: string;
  status: string;
  statusLabel?: string;
}

export interface CollectionEntityConsistencyEntity {
  id: number;
  name: string;
  type?: number;
  career?: string[];
}

export interface CollectionEntityConsistencyMatch {
  subject: CollectionEntityConsistencySubject;
  entity: CollectionEntityConsistencyEntity & { kind: CollectionEntityKind };
  evidenceKind: CollectionEntityConsistencyEvidenceKind;
  relation: string;
  viaCharacter?: {
    id: number;
    name: string;
  };
  source: {
    class: 'official-v0';
    operation: string;
    subjectId: number;
    retrievedAt: string;
  };
}

export interface CollectionEntityConsistencyUnmatched {
  entity: CollectionEntityConsistencyEntity & { kind: CollectionEntityKind };
  scope: 'selected-subject-roots';
}

export interface CollectionEntityConsistencySubjectCoverage {
  operation: 'GET /v0/users/{username}/collections';
  maxPages: number;
  maxRoots: number;
  pagesAttempted: number;
  pagesSucceeded: number;
  sourceTotal?: number;
  rowsObserved: number;
  uniqueRootsObserved: number;
  rootsSelected: number;
  malformedRows: number;
  conflictRows: number;
  conflictingSubjectIds: number[];
  duplicateSubjectIds: number;
  truncated: boolean;
  stalled: boolean;
  failed: boolean;
}

export interface CollectionEntityConsistencyEntityListCoverage {
  operation: string;
  state: Exclude<CollectionEntityConsistencyState, 'not_computable'>;
  maxItems: number;
  sourceTotal?: number;
  observed: number;
  returned: number;
  malformedRows: number;
  conflictRows: number;
  conflictingIds: number[];
  truncated: boolean;
  duplicateIds: number;
}

export interface CollectionEntityConsistencyRelationCoverage {
  maxConcurrency: number;
  maxRowsPerSubject: number;
  maxResponseBytes: number;
  rootsRequested: number;
  rootsSucceeded: number;
  rootsFailed: number;
  sourceRequestsAttempted: number;
  sourceRequestsSucceeded: number;
  sourceRequestsFailed: number;
  rowsObserved: number;
  rowsReturned: number;
  rowsDroppedAtLimit: number;
  schemaDriftRows: number;
  invalidActorIdRows: number;
  failedSubjectIds: number[];
  skipped: boolean;
  truncated: boolean;
}

export interface CollectionEntityConsistencyOutputCoverage {
  maxRows: number;
  matchesObserved: number;
  matchesReturned: number;
  unmatchedObserved: number;
  unmatchedReturned: number;
  rowsDroppedAtLimit: number;
  truncated: boolean;
}

export interface CollectionEntityConsistencyCoverage {
  state: CollectionEntityConsistencyState;
  subjectCollections: CollectionEntityConsistencySubjectCoverage;
  entityCollections: {
    characters: CollectionEntityConsistencyEntityListCoverage;
    persons: CollectionEntityConsistencyEntityListCoverage;
  };
  relations: CollectionEntityConsistencyRelationCoverage;
  output: CollectionEntityConsistencyOutputCoverage;
}

export type CollectionEntityConsistencyOperationOutcome =
  'succeeded' | 'partial' | 'unavailable' | 'not_computable';

export interface CollectionEntityConsistencyOperationEvidence {
  source: 'official-v0';
  operation: string;
  subjectId?: number;
  attemptedAt: string;
  retrievedAt?: string;
  outcome: CollectionEntityConsistencyOperationOutcome;
  observed?: number;
  returned?: number;
  truncated?: boolean;
  malformedRows?: number;
  conflictRows?: number;
  errorCode?: string;
}

export interface CollectionEntityConsistencyResult {
  state: CollectionEntityConsistencyState;
  account: {
    username: string;
  };
  filters: {
    subjectType?: string;
    status?: string;
  };
  matches: CollectionEntityConsistencyMatch[];
  unmatchedInObservedScope: CollectionEntityConsistencyUnmatched[];
  conflicts: CollectionEntityConsistencyConflict[];
  coverage: CollectionEntityConsistencyCoverage;
  formulaVersion: 'collection-entity-consistency-v1';
  source: {
    class: 'official-v0';
    operations: string[];
    authScope: 'account';
    retrievedAt?: string;
  };
  operationEvidence: CollectionEntityConsistencyOperationEvidence[];
  warnings: Array<{
    code: string;
    state: CollectionEntityConsistencyState;
    message: string;
  }>;
  limitations: string[];
}
