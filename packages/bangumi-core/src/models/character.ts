import { PersonCandidate } from '../results/result.js';

export interface DomainCharacter {
  id: number;
  name: string;
  roleName?: string;
  type: number;
  summary: string;
  images?: Record<string, string>;
  comment?: number;
  collects?: number;
}

export interface DomainRelatedCharacter {
  character: {
    id: number;
    name: string;
    type: number;
    summary?: string;
    images?: Record<string, string>;
  };
  relation: string;
  actors: PersonCandidate[];
}

export interface SubjectCharactersCoverage {
  observed: number;
  returned: number;
  truncated: boolean;
  schemaDriftRows: number;
  invalidActorIdRows: number;
}

export interface SubjectCharactersResult {
  items: DomainRelatedCharacter[];
  coverage: SubjectCharactersCoverage;
}

export interface CharacterRelationSubject {
  id: number;
  name: string;
  nameCn: string;
  staffRole?: string;
}

export interface CharacterRelatedPerson {
  id: number;
  name: string;
  type?: number;
  subjectId: number;
  subjectType?: number;
  subjectName?: string;
  subjectNameCn?: string;
  staff?: string;
}
