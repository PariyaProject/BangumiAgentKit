import type { PublicErrorInfo } from '@bangumi-agent-kit/bangumi-transport';

export type SubjectIndexMembershipState = 'complete' | 'partial' | 'unavailable' | 'not_found';

export type SubjectIndexMembership = 'matched' | 'not_matched_in_observed_scope' | 'unknown';

export interface SubjectIndexMembershipMatch {
  subjectId: number;
  order?: number;
}

export interface SubjectIndexMembershipEvidence {
  source: 'official-v0';
  provider: 'bangumi';
  operation: 'GET /v0/indices/{index_id}/subjects';
  version: 'v0';
  indexId: number;
  subjectId: number;
  fieldPath: 'data[].id';
  observation: SubjectIndexMembership;
  observationScope: 'complete_scan' | 'successful_pages';
  retrievedAt: string;
}

export interface SubjectIndexMembershipCoverage {
  pageSize: number;
  maxPages: number;
  maxRows: number;
  responseLimitBytes: number;
  attemptedAt: string;
  retrievedAt?: string;
  pagesAttempted: number;
  pagesSucceeded: number;
  rowsObserved: number;
  rowsReturned: number;
  validRows: number;
  malformedRows: number;
  duplicateRows: number;
  total?: number;
  totalKind: 'exact' | 'unknown';
  upstreamExhausted: boolean;
  truncated: boolean;
  integrity: 'consistent' | 'inconsistent';
  completionReason:
    | 'upstream_exhausted'
    | 'page_cap'
    | 'row_cap'
    | 'upstream_error'
    | 'not_found'
    | 'invalid_response';
}

export interface SubjectIndexMembershipIndexResult {
  indexId: number;
  state: SubjectIndexMembershipState;
  membership: SubjectIndexMembership;
  matches: SubjectIndexMembershipMatch[];
  coverage: SubjectIndexMembershipCoverage;
  source: {
    class: 'official-v0';
    provider: 'bangumi';
    operation: 'GET /v0/indices/{index_id}/subjects';
    responseLimitBytes: number;
    attemptedAt: string;
    retrievedAt?: string;
  };
  evidence: SubjectIndexMembershipEvidence[];
  warnings: Array<{
    code: string;
    state: SubjectIndexMembershipState;
    message: string;
  }>;
  error?: PublicErrorInfo;
}

export interface SubjectIndexMembershipResult {
  subjectId: number;
  state: SubjectIndexMembershipState;
  indexes: SubjectIndexMembershipIndexResult[];
  summary: {
    requested: number;
    matched: number;
    notMatchedInObservedScope: number;
    unknown: number;
  };
  coverage: {
    indexesRequested: number;
    indexesComplete: number;
    indexesPartial: number;
    indexesUnavailable: number;
    requestsAttempted: number;
    requestsSucceeded: number;
    pagesAttempted: number;
    pagesSucceeded: number;
    pageSize: number;
    maxPages: number;
    maxRows: number;
    responseLimitBytes: number;
    attemptedAt: string;
    retrievedAt?: string;
  };
  source: {
    class: 'official-v0';
    provider: 'bangumi';
    operations: Array<'GET /v0/indices/{index_id}/subjects'>;
    responseLimitBytes: number;
    attemptedAt: string;
    retrievedAt?: string;
  };
  evidence: SubjectIndexMembershipEvidence[];
  warnings: Array<{
    code: string;
    state: SubjectIndexMembershipState;
    message: string;
  }>;
  limitations: string[];
  attemptedAt: string;
  retrievedAt?: string;
}
