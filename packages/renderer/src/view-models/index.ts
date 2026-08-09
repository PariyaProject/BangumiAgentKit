export interface SubjectCardViewModel {
  template: 'subject-card';
  version: 1;
  subject: {
    id: number;
    name: string;
    nameCn?: string;
    type: string;
    date?: string;
    image?: string;
    score?: number;
    rank?: number;
    summary?: string;
    tags?: string[];
  };
  collection?: {
    status: string;
    statusLabel?: string;
    rating?: number;
    comment?: string;
    episodeProgress?: string;
  };
  source: {
    label: string;
  };
}

export interface SearchItemViewModel {
  id: number;
  name: string;
  nameCn?: string;
  type: string;
  date?: string;
  score?: number;
  rank?: number;
  image?: string;
}

export interface SearchListViewModel {
  template: 'search-list';
  version: 1;
  query: string;
  total: number;
  items: SearchItemViewModel[];
  hasMore?: boolean;
}

export interface CastItemViewModel {
  character: {
    id: number;
    name: string;
    image?: string;
  };
  relation: string;
  actors: Array<{
    id: number;
    name: string;
    image?: string;
  }>;
}

export interface CastCardViewModel {
  template: 'cast-card';
  version: 1;
  subject: {
    id: number;
    name: string;
    nameCn?: string;
  };
  items: CastItemViewModel[];
  hiddenCount?: number;
}

export interface CollectionProgressViewModel {
  template: 'collection-progress';
  version: 1;
  subject: {
    id: number;
    name: string;
    nameCn?: string;
    image?: string;
  };
  status: string;
  statusLabel: string;
  watchedEpisodes: number;
  totalEpisodes?: number;
  rating?: number;
  comment?: string;
  progressPercentage?: number;
}

export interface CalendarDayViewModel {
  weekdayCn: string;
  items: Array<{
    id: number;
    name: string;
    nameCn?: string;
    image?: string;
    score?: number;
  }>;
  overflowCount?: number;
}

export interface CalendarViewModel {
  template: 'calendar';
  version: 1;
  days: CalendarDayViewModel[];
}

export interface PersonProfileCreditViewModel {
  id: number;
  name: string;
  nameCn?: string;
  role?: string;
  subjectName?: string;
  subjectNameCn?: string;
  eps?: string;
}

export interface PersonProfileViewModel {
  template: 'person-profile';
  version: 1;
  person: {
    id: number;
    name: string;
    nameCn?: string;
    image?: string;
    career: string[];
  };
  summary: {
    uniqueSubjects: number;
    subjectCredits: number;
    uniqueCharacters: number;
    characterCredits: number;
    characterSubjects: number;
  };
  mediaBreakdown: Array<{
    label: string;
    count: number;
    uniqueSubjects: number;
  }>;
  roleBreakdown: Array<{
    label: string;
    count: number;
    uniqueSubjects: number;
  }>;
  characterRoleBreakdown: Array<{
    label: string;
    count: number;
    uniqueSubjects: number;
  }>;
  subjectCredits: PersonProfileCreditViewModel[];
  characterCredits: PersonProfileCreditViewModel[];
  hiddenSubjectCredits?: number;
  hiddenCharacterCredits?: number;
  coverage: {
    state: 'complete' | 'partial';
    observed: number;
    returned: number;
  };
  limitations: string[];
  source: {
    label: string;
    retrievedAt?: string;
  };
}

export type RenderViewModel =
  | SubjectCardViewModel
  | SearchListViewModel
  | CastCardViewModel
  | CollectionProgressViewModel
  | CalendarViewModel
  | PersonProfileViewModel;
