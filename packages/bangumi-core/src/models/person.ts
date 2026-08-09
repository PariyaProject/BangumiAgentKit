import type { SubjectType } from './subject.js';

export interface DomainPerson {
  id: number;
  name: string;
  type: number;
  typeLabel?: string;
  career: string[];
  summary: string;
  images?: Record<string, string>;
  aliases?: string[];
  locked?: boolean;
  lastModified?: string;
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
}
