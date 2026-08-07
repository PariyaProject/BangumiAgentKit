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

export interface CharacterRelationSubject {
  id: number;
  name: string;
  nameCn: string;
  staffRole?: string;
}

export interface CharacterRelatedPerson {
  id: number;
  name: string;
  roleName?: string;
}
