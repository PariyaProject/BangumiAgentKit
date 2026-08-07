export interface DomainIndex {
  id: number;
  title: string;
  desc: string;
  total: number;
  collects: number;
  comments: number;
  createdAt: string;
}

export interface DomainIndexSubjectItem {
  id: number;
  name: string;
  nameCn: string;
  order: number;
  comment?: string;
}
