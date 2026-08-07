export interface SubjectCardViewModel {
  template: 'subject-card';
  version: 1;
  subject: {
    id: number;
    name: string;
    nameCn?: string;
    type: string;
    date?: string;
    imageUrl?: string;
    score?: number;
    rank?: number;
    summary?: string;
    tags?: string[];
  };
  userCollection?: {
    status: string;
    rating?: number;
    comment?: string;
    watchedEps?: number;
    totalEps?: number;
  };
  sourceLabel: string;
}

export interface SearchItemViewModel {
  id: number;
  name: string;
  nameCn?: string;
  type: string;
  score?: number;
  imageUrl?: string;
}

export interface SearchListViewModel {
  template: 'search-list';
  version: 1;
  query: string;
  total: number;
  page: number;
  items: SearchItemViewModel[];
}

export interface CalendarDayViewModel {
  weekdayCn: string;
  items: Array<{
    id: number;
    nameCn: string;
    score?: number;
    imageUrl?: string;
  }>;
}

export interface CalendarViewModel {
  template: 'calendar';
  version: 1;
  days: CalendarDayViewModel[];
}

export interface CollectionProgressViewModel {
  template: 'collection-progress';
  version: 1;
  subjectId: number;
  subjectNameCn: string;
  watchedEps: number;
  totalEps?: number;
  status: string;
  rating?: number;
}

export type RenderViewModel =
  | SubjectCardViewModel
  | SearchListViewModel
  | CalendarViewModel
  | CollectionProgressViewModel;
