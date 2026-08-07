export interface DomainUser {
  id: number;
  username: string;
  nickname: string;
  avatar?: Record<string, string>;
  sign?: string;
}

export interface UserCollectionItem {
  subjectId: number;
  subjectName?: string;
  subjectNameCn?: string;
  status: 'wish' | 'doing' | 'done' | 'on_hold' | 'dropped';
  rating?: number;
  comment?: string;
  tags?: string[];
  epStatus?: number;
  updatedAt?: string;
}
