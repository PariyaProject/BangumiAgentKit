import type { SubjectType } from './subject.js';

export interface DomainPerson {
  id: number;
  name: string;
  nameCn?: string;
  type: number;
  typeLabel?: string;
  career: string[];
  summary: string;
  images?: Record<string, string>;
  aliases?: string[];
  locked?: boolean;
  lastModified?: string;
  lastModifiedState?: 'known' | 'unknown';
  infobox?: unknown[];
  gender?: string;
  bloodType?: number;
  birthYear?: number;
  birthMonth?: number;
  birthDay?: number;
  stat?: {
    comments: number;
    collects: number;
  };
}

export interface PersonRelationSubject {
  id: number;
  name: string;
  nameCn: string;
  /** Raw official `name_cn`; null means the source field was absent or invalid. */
  nameCnSource?: string | null;
  staffRole?: string;
  mediaType?: SubjectType;
  mediaTypeCode?: number;
  eps?: string;
  image?: string;
}

export interface PersonRelationCharacter {
  id: number;
  name: string;
  type?: number;
  image?: string;
  subjectId?: number;
  subjectType?: SubjectType;
  subjectTypeCode?: number;
  subjectName?: string;
  subjectNameCn?: string;
  staff?: string;
}

export interface SubjectStaffMember {
  id: number;
  name: string;
  type: number;
  career: string[];
  images?: Record<string, string>;
  relation: string;
  rawRelation?: string;
  eps: string;
}

export interface SubjectStaffGroup {
  relation: string;
  count: number;
  memberIds: number[];
}

export interface RelationCollection<T> {
  items: T[];
  observed: number;
  returned: number;
  truncated: boolean;
  schemaDriftRows?: number;
}

export interface PersonReleaseChronologySubject {
  id: number;
  name: string;
}

export interface PersonReleaseChronologyExtreme {
  date: string;
  subjects: PersonReleaseChronologySubject[];
}

export interface PersonReleaseChronology {
  state: 'partial' | 'not_computable';
  sourceCompleteness: 'undocumented';
  dateSemantics: 'official-subject-air-release-date';
  samplingStrategy: 'all-returned-anime-relations' | 'evenly-spaced-returned-anime-relations';
  relationRowsObserved: number;
  relationRowsReturned: number;
  relationRowsTruncated: boolean;
  animeRelationRowsReturned: number;
  uniqueAnimeSubjects: number;
  selectedSubjectIds: number[];
  selectedSubjectDetails: number;
  succeededSubjectDetails: number;
  failedSubjectDetails: number;
  validDateSubjects: number;
  missingDateSubjects: number;
  invalidDateSubjects: number;
  omittedAnimeSubjects: number;
  maxConcurrency: number;
  responseByteLimit: number;
  earliestObserved?: PersonReleaseChronologyExtreme;
  latestObserved?: PersonReleaseChronologyExtreme;
  limitations: string[];
}

export interface PersonActivityDistribution {
  key: string;
  label: string;
  count: number;
  uniqueSubjects: number;
  rawCodes?: number[];
}

export interface PersonActivitySummary {
  subjectCredits: number;
  uniqueSubjects: number;
  characterCredits: number;
  uniqueCharacters: number;
  characterSubjects: number;
  subjectMedia: PersonActivityDistribution[];
  subjectRoles: PersonActivityDistribution[];
  characterMedia: PersonActivityDistribution[];
  characterRoles: PersonActivityDistribution[];
}

export interface PersonActivityProfile {
  person: DomainPerson;
  subjects: RelationCollection<PersonRelationSubject>;
  characters: RelationCollection<PersonRelationCharacter>;
  summary: PersonActivitySummary;
  releaseChronology?: PersonReleaseChronology;
}
