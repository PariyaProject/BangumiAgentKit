import type { PublicErrorInfo } from '@bangumi-agent-kit/bangumi-transport';
import type { DomainCharacter } from './character.js';

export const CHARACTER_CREDIT_INTEGRITY_FORMULA_VERSION = 'character-credit-integrity-v1' as const;

export const CHARACTER_CREDIT_INTEGRITY_OPERATIONS = [
  'GET /v0/characters/{character_id}',
  'GET /v0/characters/{character_id}/subjects',
  'GET /v0/characters/{character_id}/persons',
] as const;

export const CHARACTER_CREDIT_INTEGRITY_DEFAULT_MAX_SUBJECTS = 32;
export const CHARACTER_CREDIT_INTEGRITY_MAX_SUBJECTS = 64;
export const CHARACTER_CREDIT_INTEGRITY_DEFAULT_MAX_PERSONS = 32;
export const CHARACTER_CREDIT_INTEGRITY_MAX_PERSONS = 64;
export const CHARACTER_CREDIT_INTEGRITY_MAX_RESPONSE_BYTES = 1_048_576;
export const CHARACTER_CREDIT_INTEGRITY_MAX_CREDITS_PER_PERSON = 32;
export const CHARACTER_CREDIT_INTEGRITY_MAX_RISKS = 64;
export const CHARACTER_CREDIT_INTEGRITY_MAX_RISK_MEMBERS = 16;

export type CharacterCreditIntegrityState =
  'complete' | 'partial' | 'conflict' | 'unavailable' | 'not_found';

export type CharacterCreditIntegritySourceState =
  'complete' | 'partial' | 'unavailable' | 'not_found';

export type CharacterCreditIntegrityOperationOutcome =
  'succeeded' | 'partial' | 'unavailable' | 'not_found';

export type CharacterCreditIntegrityRiskKind =
  'duplicate_stable_id' | 'same_name_distinct_ids' | 'stable_id_name_conflict';

export interface CharacterCreditIntegrityOptions {
  maxSubjects?: number;
  maxPersons?: number;
  maxResponseBytes?: number;
  signal?: AbortSignal;
}

export interface CharacterCreditSubject {
  id: number;
  type: number;
  name: string;
  nameCn: string;
  staff: string;
  eps: string;
  observedRows: number;
  duplicateRows: number;
  nameVariants?: string[];
  nameCnVariants?: string[];
  staffVariants?: string[];
  epsVariants?: string[];
  conflictingFields: string[];
}

export interface CharacterCreditPersonSubject {
  subjectId: number;
  subjectType: number;
  subjectName: string;
  subjectNameCn: string;
  staff?: string;
  subjectNameVariants?: string[];
  subjectNameCnVariants?: string[];
  staffVariants?: string[];
}

export interface CharacterCreditPerson {
  id: number;
  type: number;
  name: string;
  observedRows: number;
  duplicateRows: number;
  duplicateRelationRows: number;
  subjects: CharacterCreditPersonSubject[];
  subjectsOmitted: number;
  nameVariants?: string[];
  conflictingFields: string[];
}

export interface CharacterCreditIntegrityRisk {
  kind: CharacterCreditIntegrityRiskKind;
  entity: 'subject' | 'person';
  scope: 'subject_credits' | 'person_credits';
  ids: number[];
  names: string[];
  normalizedName?: string;
  observedRows: number;
  membersOmitted?: number;
  namesOmitted?: number;
  message: string;
}

export interface CharacterCreditIntegrityListCoverage {
  operation: (typeof CHARACTER_CREDIT_INTEGRITY_OPERATIONS)[number];
  state: CharacterCreditIntegritySourceState;
  maxRows: number;
  observedRows: number;
  validRows: number;
  uniqueIdsObserved: number;
  returnedRows: number;
  malformedRows: number;
  duplicateRows: number;
  duplicateRelationRows?: number;
  duplicateIds: number[];
  conflictRows: number;
  conflictingIds: number[];
  truncated: boolean;
  errorCode?: string;
}

export interface CharacterCreditIntegrityDetailCoverage {
  operation: (typeof CHARACTER_CREDIT_INTEGRITY_OPERATIONS)[0];
  state: CharacterCreditIntegritySourceState;
  maxResponseBytes: number;
  errorCode?: string;
}

export interface CharacterCreditIntegrityCoverage {
  detail: CharacterCreditIntegrityDetailCoverage;
  subjects: CharacterCreditIntegrityListCoverage;
  persons: CharacterCreditIntegrityListCoverage;
  output: {
    maxSubjects: number;
    maxPersons: number;
    returnedSubjects: number;
    returnedPersons: number;
    returnedPersonSubjectCredits: number;
    omittedPersonSubjectCredits: number;
    risksReturned: number;
    risksOmitted: number;
    truncated: boolean;
  };
}

export interface CharacterCreditIntegrityOperationEvidence {
  source: 'official-v0';
  operation: (typeof CHARACTER_CREDIT_INTEGRITY_OPERATIONS)[number];
  attemptedAt: string;
  retrievedAt?: string;
  outcome: CharacterCreditIntegrityOperationOutcome;
  observedRows: number;
  returnedRows: number;
  malformedRows: number;
  duplicateRows: number;
  duplicateRelationRows?: number;
  conflictRows: number;
  truncated: boolean;
  errorCode?: string;
}

export interface CharacterCreditIntegrityWarning {
  code: string;
  state: CharacterCreditIntegrityState;
  message: string;
}

export interface CharacterCreditIntegrityResult {
  formulaVersion: typeof CHARACTER_CREDIT_INTEGRITY_FORMULA_VERSION;
  state: CharacterCreditIntegrityState;
  character?: DomainCharacter;
  subjectCredits: CharacterCreditSubject[];
  personCredits: CharacterCreditPerson[];
  risks: CharacterCreditIntegrityRisk[];
  coverage: CharacterCreditIntegrityCoverage;
  source: {
    class: 'official-v0';
    operations: Array<(typeof CHARACTER_CREDIT_INTEGRITY_OPERATIONS)[number]>;
    attemptedAt: string;
    retrievedAt?: string;
  };
  operationEvidence: CharacterCreditIntegrityOperationEvidence[];
  warnings: CharacterCreditIntegrityWarning[];
  limitations: string[];
  error?: PublicErrorInfo;
}
