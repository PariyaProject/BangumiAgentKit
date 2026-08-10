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
  observed?: number;
  returned?: number;
  items: Array<{
    id: number;
    name: string;
    nameCn?: string;
    image?: string;
    airDate?: string;
    type?: number;
    typeLabel?: string;
    score?: number;
    rank?: number;
    collectionDoing?: number;
  }>;
  overflowCount?: number;
}

export interface CalendarViewModel {
  template: 'calendar';
  version: 1;
  days: CalendarDayViewModel[];
  state?: 'complete' | 'partial' | 'unavailable';
  coverage?: {
    state: 'complete' | 'partial' | 'unavailable';
    observed: number;
    returned: number;
    rendered: number;
    selectedDays: number;
    maxPerDay: number;
    maxTotal: number;
  };
  source?: {
    label: string;
    retrievedAt?: string;
  };
  limitations?: string[];
  warnings?: Array<{
    code: string;
    state: 'partial' | 'unavailable';
    message: string;
  }>;
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
  state: 'complete' | 'partial' | 'not_computable' | 'unavailable';
  person: {
    id: number;
    name: string;
    nameCn?: string;
    image?: string;
    typeLabel?: string;
    aliases?: string[];
    career: string[];
    summary?: string;
    summaryTruncated?: boolean;
    gender?: string;
    bloodType?: number;
    birthDate?: string;
    identityMissingFields: string[];
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
    rawCodes?: number[];
  }>;
  characterMediaBreakdown: Array<{
    label: string;
    count: number;
    uniqueSubjects: number;
    rawCodes?: number[];
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
  unobservedSubjectCredits?: number;
  unobservedCharacterCredits?: number;
  coverage: {
    state: 'complete' | 'partial';
    observed: number;
    returned: number;
    rendered: number;
    unobserved: number;
  };
  limitations: string[];
  warnings: Array<{
    code: string;
    state: 'partial' | 'not_computable' | 'unavailable';
    message: string;
  }>;
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
