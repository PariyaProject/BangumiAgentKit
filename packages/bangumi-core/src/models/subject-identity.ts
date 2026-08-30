import type { PublicErrorInfo } from '@bangumi-agent-kit/bangumi-transport';
import type { SubjectType } from './subject.js';

export type SubjectIdentityState =
  | 'complete'
  | 'partial'
  | 'unavailable'
  | 'not_found'
  | 'upstream_error'
  | 'auth_required'
  | 'permission_denied'
  | 'not_computable'
  | 'unsupported';

export type SubjectIdentityInfoboxValue = string | Array<{ k?: string; v: string }>;

export interface SubjectIdentityInfoboxRow {
  key: string;
  value: SubjectIdentityInfoboxValue;
}

export interface SubjectIdentityAliasData {
  state: 'known' | 'partial' | 'unknown';
  values: string[];
  sourceKeys: string[];
  sourceRowIndexes: number[];
}

export interface SubjectIdentityInfoboxCoverage {
  state: 'complete' | 'partial' | 'unknown';
  observedRows: number;
  returnedRows: number;
  malformedRows: number;
  omittedRows: number;
  nestedValuesObserved: number;
  nestedValuesReturned: number;
  nestedValuesOmitted: number;
  malformedValues: number;
  truncatedValues: number;
  truncated: boolean;
  maxRows: number;
  maxValuesPerRow: number;
  maxScalarCharacters: number;
}

export interface SubjectIdentityInfoboxData {
  state: 'complete' | 'partial' | 'unknown';
  rows: SubjectIdentityInfoboxRow[];
  aliases: SubjectIdentityAliasData;
  coverage: SubjectIdentityInfoboxCoverage;
}

export interface SubjectIdentityFieldCoverage {
  observed: string[];
  returned: string[];
  missing: string[];
  malformed: string[];
  empty: string[];
  truncated: string[];
}

export interface SubjectIdentityData {
  id: number;
  type: number;
  typeLabel: SubjectType;
  name: string;
  nameCn?: string;
  date?: string;
  platform?: string;
  locked?: boolean;
  nsfw?: boolean;
  series?: boolean;
  volumes?: number;
  eps?: number;
  totalEpisodes?: number;
  metaTags?: string[];
  tags?: string[];
  /** URLs are source links only; this capability never downloads image bytes. */
  images?: Record<string, string | undefined>;
  infobox: SubjectIdentityInfoboxData;
  fields: SubjectIdentityFieldCoverage;
}

export interface SubjectIdentityEvidence {
  source: 'official-v0' | 'derived-s7';
  provider: string;
  operation?: string;
  version?: string;
  retrievedAt?: string;
  fieldPath?: string;
  formula?: string;
  description?: string;
}

export interface SubjectIdentityResult {
  subjectId: number;
  state: SubjectIdentityState;
  data?: SubjectIdentityData;
  coverage: {
    sourceRequestsAttempted: number;
    sourceRequestsSucceeded: number;
    responseLimitBytes: number;
    fields: SubjectIdentityFieldCoverage;
    infobox: SubjectIdentityInfoboxCoverage;
  };
  source: {
    class: 'official-v0';
    provider: 'bangumi';
    operation: string;
    responseLimitBytes: number;
    retrievedAt?: string;
  };
  evidence: SubjectIdentityEvidence[];
  warnings: Array<{
    code: string;
    state: SubjectIdentityState;
    message: string;
  }>;
  limitations: string[];
  retrievedAt?: string;
  error?: PublicErrorInfo;
}
