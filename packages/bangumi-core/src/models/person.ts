export interface DomainPerson {
  id: number;
  name: string;
  type: number;
  career: string[];
  summary: string;
  images?: Record<string, string>;
}

export interface PersonRelationSubject {
  id: number;
  name: string;
  nameCn: string;
  staffRole?: string;
}
