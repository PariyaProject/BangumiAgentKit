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

export type DiscoveryResultsState =
  | 'ok'
  | 'partial'
  | 'stale'
  | 'conflict'
  | 'auth_required'
  | 'permission_denied'
  | 'unavailable'
  | 'not_computable'
  | 'unsupported'
  | 'not_found'
  | 'upstream_error';

export interface DiscoveryResultsItemViewModel {
  id: number;
  name: string;
  nameCn?: string;
  media: string;
  category?: string;
  date?: string;
  score?: number;
  rank?: number;
  ratingCount?: number;
  collectionTotal?: number;
  image?: string;
}

export interface DiscoveryResultsViewModel {
  template: 'discovery-results';
  version: 1;
  state: DiscoveryResultsState;
  query: {
    label: string;
    facets: string[];
  };
  items: DiscoveryResultsItemViewModel[];
  hiddenCount?: number;
  observedNotReturnedCount?: number;
  plan: {
    operation: string;
    quality: string;
    pushdown: string[];
    postFilters: string[];
    derivedFilters: string[];
    unsupportedFilters: string[];
    limitations: string[];
  };
  coverage: {
    state: 'complete' | 'partial' | 'unknown' | 'not_applicable';
    requested: number;
    observed: number;
    scanned: number;
    matched: number;
    returned: number;
    rendered: number;
    pagesScanned: number;
    totalKind: 'exact' | 'estimated' | 'unknown';
    upstreamExhausted: boolean;
    budgetExceeded: boolean;
    outputCap?: number;
    hydrationsAttempted: number;
    hydrationsSucceeded: number;
    hydrationsFailed: number;
    hydrationsUnresolved: number;
    hydrationBudgetExceeded: boolean;
    reason?: string;
  };
  source: {
    label: string;
    operations: string[];
    evidenceCount: number;
    retrievedAt?: string;
    experimental?: boolean;
  };
  warnings: Array<{ code: string; message: string; state?: string }>;
  limitations: string[];
}

export type SeriesRelationsState = 'complete' | 'partial' | 'not_computable';

export type SeriesRelationsExclusionReason =
  | 'media_type_not_anime'
  | 'root_not_anime'
  | 'relation_not_watch_step'
  | 'conflicting_direct_relations'
  | 'conflicting_paths'
  | 'node_cap'
  | 'depth_evidence_only'
  | 'evidence_cap';

export interface SeriesRelationPathViewModel {
  fromId: number;
  toId: number;
  depth: number;
  relation: string;
  relationKind: string;
  pathIds: number[];
  pathKinds: string[];
  direct: boolean;
}

export interface SeriesRelationsRelatedViewModel {
  id: number;
  name: string;
  nameCn?: string;
  type: string;
  date?: string;
  image?: string;
  relationLabels: string[];
  relationKinds: string[];
  relationPaths: SeriesRelationPathViewModel[];
  depth: number;
  includedInWatchOrder: boolean;
  exclusionReason?: SeriesRelationsExclusionReason;
}

export interface SeriesRelationsStepViewModel extends SeriesRelationsRelatedViewModel {
  position: number;
  isRoot: boolean;
  placement: 'root' | 'before_root' | 'after_root';
  placementReason: string;
  derivedDepth?: number;
}

export interface SeriesRelationsViewModel {
  template: 'series-relations';
  version: 1;
  state: SeriesRelationsState;
  subjectId: number;
  root: {
    id: number;
    name: string;
    nameCn?: string;
    type: string;
    date?: string;
    image?: string;
  };
  steps: SeriesRelationsStepViewModel[];
  related: SeriesRelationsRelatedViewModel[];
  edges: SeriesRelationPathViewModel[];
  excluded: {
    count: number;
    byReason: Array<{ reason: SeriesRelationsExclusionReason; count: number }>;
    samples: Array<
      SeriesRelationsRelatedViewModel & { exclusionReason: SeriesRelationsExclusionReason }
    >;
  };
  coverage: {
    depth: number;
    maxNodes: number;
    media: 'anime' | 'all';
    animeNodeLimit: number;
    nonAnimeEvidenceLimit: number;
    relatedLimit: number;
    relationRequests: number;
    relationRowsObserved: number;
    uniqueRelatedObserved: number;
    uniqueRelatedReturned: number;
    animeNodesObserved: number;
    animeNodesSelected: number;
    nonAnimeRowsObserved: number;
    nonAnimeRowsReturned: number;
    detailsAttempted: number;
    detailsFetched: number;
    detailsFailed: number;
    relationFailures: number;
    edgeEvidenceLimit: number;
    edgeEvidenceReturned: number;
    edgeEvidenceTruncated: boolean;
    relatedEvidenceTruncated: boolean;
    truncated: boolean;
    truncationReasons: string[];
    renderedOmitted?: {
      steps: number;
      related: number;
      edges: number;
    };
    retrievedAt: string;
  };
  evidence: {
    operations: string[];
    evidenceCount: number;
    derivation: string;
    retrievedAt: string;
  };
  warnings: string[];
  limitations: string[];
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

export interface CollectionIntelligenceViewModel {
  template: 'collection-intelligence';
  version: 1;
  state: 'complete' | 'partial' | 'unavailable';
  statusCounts: Array<{ status: string; label: string; count: number }>;
  subjectTypeCounts: Array<{ type: string; label: string; count: number }>;
  backlog: { total: number; wish: number; doing: number; onHold: number };
  ratings: {
    rated: number;
    average?: number;
    distribution: Array<{ rating: number; count: number }>;
  };
  progress: { itemsWithProgress: number; completedEpisodes: number };
  tags: {
    distinct: number;
    itemsWithTags: number;
    top: Array<{ tag: string; count: number }>;
  };
  latestObservedUpdates: Array<{
    subjectId: number;
    name: string;
    nameCn?: string;
    subjectType?: string;
    status: string;
    rating?: number;
    epStatus?: number;
    updatedAt: string;
  }>;
  presentation: {
    state: 'complete' | 'partial';
    tags: { available: number; rendered: number; omitted: number };
    recentUpdates: { available: number; rendered: number; omitted: number };
  };
  coverage: {
    state: 'complete' | 'partial' | 'unavailable';
    sourceTotal?: number;
    requestedMaxItems: number;
    observedRows: number;
    uniqueItems: number;
    returned: number;
    pageSize: number;
    pagesAttempted: number;
    pagesSucceeded: number;
    maxPages: number;
    truncated: boolean;
    sourceExhausted: boolean;
    duplicateRows: number;
    pageFailureOffset?: number;
    pageFailureCode?: string;
    paginationStalled: boolean;
    sourceTotalChanged: boolean;
    missingFields: Record<string, number>;
    skippedTagValues: number;
    renderedStatusCount: number;
    renderedTagCount: number;
    renderedRecentCount: number;
  };
  evidence: {
    operation: string;
    formulaVersion?: string;
    authScope: 'account';
    retrievedAt?: string;
  };
  warnings: Array<{ code: string; state: 'partial' | 'unavailable'; message: string }>;
  limitations: string[];
  source: { label: string; retrievedAt?: string };
}

export interface CollectionBacklogViewModel {
  template: 'collection-backlog';
  version: 1;
  state: import('@bangumi-agent-kit/bangumi-core').CollectionBacklogResult['state'];
  items: import('@bangumi-agent-kit/bangumi-core').CollectionBacklogResult['data']['items'];
  summary: import('@bangumi-agent-kit/bangumi-core').CollectionBacklogResult['data']['summary'];
  sortBy?: import('@bangumi-agent-kit/bangumi-core').CollectionBacklogSort;
  coverage: import('@bangumi-agent-kit/bangumi-core').CollectionBacklogResult['coverage'] & {
    renderedItems: number;
    omittedItems: number;
  };
  source: import('@bangumi-agent-kit/bangumi-core').CollectionBacklogResult['source'] & {
    label: string;
  };
  evidence: {
    operations: string[];
    formulaVersion?: string;
    durationFormulaVersion?: string;
    scheduleFormulaVersion?: string;
    confidenceFormulaVersion?: string;
    authScope: 'account';
    retrievedAt?: string;
  };
  warnings: import('@bangumi-agent-kit/bangumi-core').CollectionBacklogResult['warnings'];
  limitations: string[];
  error?: import('@bangumi-agent-kit/bangumi-core').CollectionBacklogResult['error'];
}

export interface CollectionScheduleViewModel {
  template: 'collection-schedule';
  version: 1;
  state: import('@bangumi-agent-kit/bangumi-core').CollectionScheduleResult['state'];
  filters: import('@bangumi-agent-kit/bangumi-core').CollectionScheduleResult['filters'];
  items: import('@bangumi-agent-kit/bangumi-core').CollectionScheduleResult['data']['items'];
  unmatchedCalendar: import('@bangumi-agent-kit/bangumi-core').CollectionScheduleResult['data']['unmatchedCalendar'];
  unmatchedCollection: import('@bangumi-agent-kit/bangumi-core').CollectionScheduleResult['data']['unmatchedCollection'];
  summary: import('@bangumi-agent-kit/bangumi-core').CollectionScheduleResult['data']['summary'];
  coverage: import('@bangumi-agent-kit/bangumi-core').CollectionScheduleResult['coverage'] & {
    renderedItems: number;
    renderedUnmatchedCalendar: number;
    renderedUnmatchedCollection: number;
    omittedRows: number;
  };
  source: import('@bangumi-agent-kit/bangumi-core').CollectionScheduleResult['source'] & {
    label: string;
  };
  evidence: {
    operations: string[];
    formulaVersion?: string;
    authScope: 'account';
    retrievedAt?: string;
  };
  warnings: import('@bangumi-agent-kit/bangumi-core').CollectionScheduleResult['warnings'];
  limitations: string[];
  error?: import('@bangumi-agent-kit/bangumi-core').CollectionScheduleResult['error'];
}

export interface CollectionDashboardViewModel {
  template: 'collection-dashboard';
  version: 1;
  state: import('@bangumi-agent-kit/bangumi-core').CollectionDashboardResult['state'];
  sections: {
    intelligence: {
      state: import('@bangumi-agent-kit/bangumi-core').CollectionDashboardResult['state'];
      result?: CollectionIntelligenceViewModel;
      error?: import('@bangumi-agent-kit/bangumi-transport').PublicErrorInfo;
    };
    backlog: {
      state: import('@bangumi-agent-kit/bangumi-core').CollectionDashboardResult['state'];
      result?: CollectionBacklogViewModel;
      error?: import('@bangumi-agent-kit/bangumi-transport').PublicErrorInfo;
    };
    schedule: {
      state: import('@bangumi-agent-kit/bangumi-core').CollectionDashboardResult['state'];
      result?: CollectionScheduleViewModel;
      error?: import('@bangumi-agent-kit/bangumi-transport').PublicErrorInfo;
    };
  };
  coverage: import('@bangumi-agent-kit/bangumi-core').CollectionDashboardResult['coverage'];
  source: import('@bangumi-agent-kit/bangumi-core').CollectionDashboardResult['source'];
  evidence: import('@bangumi-agent-kit/bangumi-core').CollectionDashboardResult['evidence'];
  warnings: import('@bangumi-agent-kit/bangumi-core').CollectionDashboardResult['warnings'];
  limitations: string[];
  filters: string[];
  presentation: {
    state: 'complete' | 'partial';
    intelligence: { available: number; rendered: number; omitted: number };
    backlog: { available: number; rendered: number; omitted: number };
    schedule: { available: number; rendered: number; omitted: number };
  };
}

export interface CollectionSeriesViewModel {
  template: 'collection-series';
  version: 1;
  state: import('@bangumi-agent-kit/bangumi-core').CollectionSeriesResult['state'];
  groups: import('@bangumi-agent-kit/bangumi-core').CollectionSeriesResult['groups'];
  ungrouped: import('@bangumi-agent-kit/bangumi-core').CollectionSeriesResult['ungrouped'];
  summary: import('@bangumi-agent-kit/bangumi-core').CollectionSeriesResult['summary'];
  coverage: import('@bangumi-agent-kit/bangumi-core').CollectionSeriesResult['coverage'];
  excludedRelations: import('@bangumi-agent-kit/bangumi-core').CollectionSeriesResult['excludedRelations'];
  source: import('@bangumi-agent-kit/bangumi-core').CollectionSeriesResult['source'] & {
    label: string;
  };
  evidence: import('@bangumi-agent-kit/bangumi-core').CollectionSeriesResult['evidence'];
  warnings: import('@bangumi-agent-kit/bangumi-core').CollectionSeriesResult['warnings'];
  limitations: string[];
  presentation: {
    groups: { available: number; rendered: number; omitted: number };
    items: { available: number; rendered: number; omitted: number };
    edges: { available: number; rendered: number; omitted: number };
    ungrouped: { available: number; rendered: number; omitted: number };
  };
  error?: import('@bangumi-agent-kit/bangumi-core').CollectionSeriesResult['error'];
}

export interface CollectionEntityConsistencyViewModel {
  template: 'collection-entity-consistency';
  version: 1;
  state: import('@bangumi-agent-kit/bangumi-core').CollectionEntityConsistencyResult['state'];
  account: import('@bangumi-agent-kit/bangumi-core').CollectionEntityConsistencyResult['account'];
  filters: import('@bangumi-agent-kit/bangumi-core').CollectionEntityConsistencyResult['filters'];
  matches: import('@bangumi-agent-kit/bangumi-core').CollectionEntityConsistencyResult['matches'];
  unmatchedInObservedScope: import('@bangumi-agent-kit/bangumi-core').CollectionEntityConsistencyResult['unmatchedInObservedScope'];
  coverage: import('@bangumi-agent-kit/bangumi-core').CollectionEntityConsistencyResult['coverage'];
  formulaVersion: import('@bangumi-agent-kit/bangumi-core').CollectionEntityConsistencyResult['formulaVersion'];
  source: import('@bangumi-agent-kit/bangumi-core').CollectionEntityConsistencyResult['source'];
  operationEvidence: import('@bangumi-agent-kit/bangumi-core').CollectionEntityConsistencyResult['operationEvidence'];
  warnings: import('@bangumi-agent-kit/bangumi-core').CollectionEntityConsistencyResult['warnings'];
  limitations: string[];
  presentation: {
    state: 'complete' | 'partial';
    matches: { available: number; rendered: number; omitted: number };
    unmatched: { available: number; rendered: number; omitted: number };
  };
}

export interface CharacterCreditIntegrityViewModel {
  template: 'character-credit-integrity';
  version: 1;
  state: import('@bangumi-agent-kit/bangumi-core').CharacterCreditIntegrityResult['state'];
  formulaVersion: import('@bangumi-agent-kit/bangumi-core').CharacterCreditIntegrityResult['formulaVersion'];
  character?: {
    id: number;
    name: string;
    summary: string;
  };
  subjectCredits: import('@bangumi-agent-kit/bangumi-core').CharacterCreditIntegrityResult['subjectCredits'];
  personCredits: import('@bangumi-agent-kit/bangumi-core').CharacterCreditIntegrityResult['personCredits'];
  risks: import('@bangumi-agent-kit/bangumi-core').CharacterCreditIntegrityResult['risks'];
  coverage: import('@bangumi-agent-kit/bangumi-core').CharacterCreditIntegrityResult['coverage'];
  source: import('@bangumi-agent-kit/bangumi-core').CharacterCreditIntegrityResult['source'];
  operationEvidence: import('@bangumi-agent-kit/bangumi-core').CharacterCreditIntegrityResult['operationEvidence'];
  warnings: import('@bangumi-agent-kit/bangumi-core').CharacterCreditIntegrityResult['warnings'];
  limitations: string[];
  presentation: {
    state: 'complete' | 'partial';
    subjects: { available: number; rendered: number; omitted: number };
    persons: { available: number; rendered: number; omitted: number };
    personSubjects: { available: number; rendered: number; omitted: number };
    risks: { available: number; rendered: number; omitted: number };
  };
  error?: import('@bangumi-agent-kit/bangumi-core').CharacterCreditIntegrityResult['error'];
}

export interface CalendarDayViewModel {
  weekdayCn: string;
  observed?: number;
  returned?: number;
  items: Array<{
    id: number;
    name: string;
    nameCn?: string;
    nameCnProvided?: boolean;
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
    expectedDays?: number;
    sourceDayCount?: number;
    missingWeekdays?: number[];
    duplicateWeekdays?: number[];
    extraDayEnvelopes?: number;
    invalidWeekdayCount?: number;
    invalidItemWeekdayCount?: number;
    weekdayConflictCount?: number;
    missingFields?: Record<string, number>;
    dateSemantics?: 'first_air_date';
    weekdaySemantics?: string;
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

export interface PersonActivityViewModel {
  template: 'person-activity';
  version: 1;
  state: 'complete' | 'partial' | 'not_computable' | 'unavailable';
  person: {
    id: number;
    name: string;
    nameCn?: string;
    career: string[];
  };
  kind: 'voice' | 'staff' | 'all';
  media: 'anime' | 'tv' | 'all';
  window: {
    months: number;
    start: string;
    end: string;
    monthKeys: string[];
  };
  rows: Array<{
    subjectId: number;
    subjectName: string;
    subjectNameCn: string;
    subjectType: string;
    platform?: string;
    firstAirDate: string;
    month: string;
    relationLabel: string;
    relationId?: number;
    characterName?: string;
    rawRole?: string;
    roleFamily: string;
    origin: {
      state: 'explicit_original' | 'not_observed' | 'unknown';
      label: string;
      metaTags?: string[];
      metaTagsCoverage?: import('@bangumi-agent-kit/bangumi-core').DomainSubjectMetaTagsCoverage;
    };
  }>;
  hiddenRows: number;
  summary: {
    creditRows: number;
    uniqueSubjects: number;
    uniqueCharacters: number;
    byRole: Array<{
      label: string;
      creditRows: number;
      uniqueSubjects: number;
      uniqueCharacters: number;
    }>;
    byMedia: Array<{
      label: string;
      creditRows: number;
      uniqueSubjects: number;
      uniqueCharacters: number;
    }>;
    byMonth: Array<{
      month: string;
      creditRows: number;
      uniqueSubjects: number;
      uniqueCharacters: number;
    }>;
    origin: {
      explicitOriginalSubjects: number;
      notObservedSubjects: number;
      unknownSubjects: number;
    };
  };
  comparison?: {
    state: 'complete' | 'partial' | 'not_computable' | 'unavailable';
    windowMonths: number;
    recent: {
      state: 'complete' | 'partial' | 'not_computable' | 'unavailable';
      start: string;
      end: string;
      creditRows?: number;
      uniqueSubjects?: number;
      uniqueCharacters?: number;
      rowsEligible: number;
      sampled: boolean;
      truncated: boolean;
      exclusions: Array<{ reason: string; count: number; sampleSubjectIds: number[] }>;
    };
    previous: {
      state: 'complete' | 'partial' | 'not_computable' | 'unavailable';
      start: string;
      end: string;
      creditRows?: number;
      uniqueSubjects?: number;
      uniqueCharacters?: number;
      rowsEligible: number;
      sampled: boolean;
      truncated: boolean;
      exclusions: Array<{ reason: string; count: number; sampleSubjectIds: number[] }>;
    };
    delta: {
      state: 'complete' | 'partial' | 'not_computable' | 'unavailable';
      creditRows?: number;
      uniqueSubjects?: number;
      uniqueCharacters?: number;
    };
    peak: {
      state: 'complete' | 'partial' | 'not_computable' | 'unavailable';
      months: Array<{
        period: 'recent' | 'previous';
        month: string;
        creditRows: number;
        uniqueSubjects: number;
        uniqueCharacters: number;
      }>;
    };
  };
  coverage: {
    relationRowsObserved: number;
    relationRowsSelected: number;
    relationRowsDroppedAtLimit: number;
    relationSelectionStrategy: 'all' | 'deterministic_even_spread';
    sampled: boolean;
    subjectIdsObserved: number;
    subjectIdsSelected: number;
    subjectIdsDroppedAtRelationLimit: number;
    subjectDetailIdsObserved: number;
    subjectDetailRequests: number;
    subjectDetailsSucceeded: number;
    subjectDetailsFailed: number;
    subjectDetailIdsDroppedAtLimit: number;
    rowsEligible: number;
    rowsReturned: number;
    outputTruncated: boolean;
    missingSubjectIdRows: number;
    missingDateRows: number;
    invalidDateRows: number;
    outsideWindowRows: number;
    mediaExcludedRows: number;
    mediaUnknownRows: number;
    maxRelations: number;
    maxSubjectDetails: number;
    maxRows: number;
    detailConcurrency: number;
    truncated: boolean;
    origin: import('@bangumi-agent-kit/bangumi-core').PersonActivityOriginCoverage;
  };
  exclusions: Array<{ reason: string; count: number; sampleSubjectIds: number[] }>;
  sourceOperations: Array<{
    operation: string;
    attempted: number;
    succeeded: number;
    failed: number;
  }>;
  limitations: string[];
  warnings: Array<{ code: string; state: string; message: string }>;
  source: { label: string; retrievedAt: string };
}

export interface PersonCollaborationViewModel {
  template: 'person-collaboration';
  version: 1;
  state: 'complete' | 'partial' | 'not_computable' | 'unavailable' | 'not_found';
  person: {
    id: number;
    name: string;
    nameCn?: string;
    career: string[];
  };
  kind: 'voice' | 'staff' | 'all';
  media: 'anime' | 'all';
  targetRole?: string;
  collaboratorRole?: string;
  collaborators: Array<{
    id: number;
    name: string;
    nameCn?: string;
    image?: string;
    career: string[];
    uniqueSubjects: number;
    creditRows: number;
    relationLabels: string[];
    roleLabels: string[];
    sharedSubjects: Array<{
      id: number;
      name: string;
      nameCn: string;
      type: string;
      relationLabels: string[];
      targetRoles: string[];
      collaboratorRoles: string[];
    }>;
    sharedSubjectsOmitted: number;
  }>;
  hiddenCollaborators: number;
  coverage: {
    relationRowsObserved: number;
    relationRowsMatchingFilters: number;
    relationRowsSelected: number;
    relationRowsDroppedAtLimit: number;
    relationSelectionStrategy: 'all' | 'deterministic_even_spread';
    sampled: boolean;
    subjectIdsObserved: number;
    subjectIdsSelected: number;
    subjectIdsDroppedAtRelationLimit: number;
    subjectIdsDroppedAtSubjectLimit: number;
    relationRowsDroppedAtSourceLimit: number;
    malformedRelationRows: number;
    fanoutRowsDroppedAtSourceLimit: number;
    participantRowsDroppedAtSourceLimit: number;
    participantRequests: number;
    participantRequestsSucceeded: number;
    participantRequestsFailed: number;
    participantRequestsSkippedForRoleFilter: number;
    participantRowsObserved: number;
    participantRowsReturned: number;
    malformedParticipantRows: number;
    selfRowsExcluded: number;
    collaboratorRoleExcludedRows: number;
    collaboratorRoleUnavailableRows: number;
    collaboratorsObserved: number;
    collaboratorsReturned: number;
    collaboratorIdsDroppedAtLimit: number;
    sharedSubjectRowsObserved: number;
    sharedSubjectRowsReturned: number;
    sharedSubjectRowsOmittedAtLimit: number;
    maxRelations: number;
    maxSubjects: number;
    maxCollaborators: number;
    maxSharedSubjects: number;
    fanoutConcurrency: number;
    mediaExcludedRows: number;
    mediaUnknownRows: number;
    targetRoleExcludedRows: number;
    missingSubjectIdRows: number;
    missingSubjectTypeRows: number;
    truncated: boolean;
  };
  exclusions: Array<{ reason: string; count: number; sampleSubjectIds: number[] }>;
  sourceOperations: Array<{
    operation: string;
    attempted: number;
    succeeded: number;
    failed: number;
    rowsOmitted?: number;
    outcomes: Array<{
      state: 'succeeded' | 'failed';
      retrievedAt: string;
      errorCode?: string;
      rowsOmitted?: number;
    }>;
  }>;
  evidence: Array<{
    source: 'official-v0' | 'derived-s7';
    operation: string;
    retrievedAt?: string;
    outcome?: 'succeeded' | 'failed';
    errorCode?: string;
    rowsOmitted?: number;
    formulaVersion?: string;
    description?: string;
  }>;
  limitations: string[];
  warnings: Array<{ code: string; state: string; message: string }>;
  source: { label: string; retrievedAt: string };
}

export interface RevisionTimelineViewModel {
  template: 'revision-timeline';
  version: 1;
  state: 'complete' | 'partial' | 'unavailable';
  entityType: 'subject' | 'episode' | 'character' | 'person';
  entityId: number;
  items: Array<{
    id: number;
    type: number;
    summary?: string;
    createdAt?: string;
    creator?: {
      username?: string;
      nickname?: string;
    };
  }>;
  coverage: {
    state: 'complete' | 'partial' | 'unavailable';
    observed: number;
    returned: number;
    total: number;
    totalKind: 'exact' | 'estimated';
    limit: number;
    offset: number;
    truncated: boolean;
    rendered: number;
    missingFields: Record<string, number>;
    truncatedFields: Record<string, number>;
  };
  capabilityStates: {
    historical_growth: 'not_computable';
  };
  source: {
    label: string;
    operation: string;
    retrievedAt?: string;
    attemptedAt?: string;
  };
  limitations: string[];
  warnings: Array<{
    code: string;
    state: 'partial' | 'unavailable';
    message: string;
  }>;
}

export interface SubjectLatestRevisionViewModel {
  template: 'subject-latest-revision';
  version: 1;
  state: import('@bangumi-agent-kit/bangumi-core').SubjectLatestRevisionState;
  subjectId: number;
  selection: import('@bangumi-agent-kit/bangumi-core').SubjectLatestRevisionResult['selection'];
  list: import('@bangumi-agent-kit/bangumi-core').SubjectLatestRevisionResult['list'];
  revision?: {
    id: number;
    type: number;
    summary?: string;
    createdAt?: string;
    creator?: {
      username?: string;
      nickname?: string;
    };
  };
  detail: import('@bangumi-agent-kit/bangumi-core').SubjectLatestRevisionResult['detail'];
  source: import('@bangumi-agent-kit/bangumi-core').SubjectLatestRevisionResult['source'];
  evidence: import('@bangumi-agent-kit/bangumi-core').SubjectLatestRevisionResult['evidence'];
  presentation: {
    text: {
      maxGraphemes: number;
      availableGraphemes: number;
      renderedGraphemes: number;
      omittedGraphemes: number;
      truncated: boolean;
    };
    fields: {
      observed: number;
      available: number;
      rendered: number;
      omitted: number;
      truncated: number;
      sourceOmitted: number;
      sourceTruncated: number;
      presentationOmitted: number;
      presentationTruncated: number;
    };
    fieldValues: Array<
      import('@bangumi-agent-kit/bangumi-core').SubjectLatestRevisionPayloadField & {
        sourceTruncated: boolean;
        presentationTruncated: boolean;
      }
    >;
  };
  limitations: string[];
  warnings: import('@bangumi-agent-kit/bangumi-core').SubjectLatestRevisionResult['warnings'];
  error?: import('@bangumi-agent-kit/bangumi-core').SubjectLatestRevisionResult['error'];
}

export interface EpisodeGuideViewModel {
  template: 'episode-guide';
  version: 1;
  subjectId: number;
  state: import('@bangumi-agent-kit/bangumi-core').EpisodeGuideState;
  subject?: import('@bangumi-agent-kit/bangumi-core').EpisodeGuideResult['subject'];
  filters: import('@bangumi-agent-kit/bangumi-core').EpisodeGuideResult['filters'];
  items: import('@bangumi-agent-kit/bangumi-core').EpisodeGuideItem[];
  summary: import('@bangumi-agent-kit/bangumi-core').EpisodeGuideResult['summary'];
  coverage: import('@bangumi-agent-kit/bangumi-core').EpisodeGuideResult['coverage'] & {
    renderedRows: number;
    renderedOmitted: number;
  };
  capabilityStates: import('@bangumi-agent-kit/bangumi-core').EpisodeGuideResult['capabilityStates'];
  source: import('@bangumi-agent-kit/bangumi-core').EpisodeGuideResult['source'];
  evidence: import('@bangumi-agent-kit/bangumi-core').EpisodeGuideResult['evidence'];
  limitations: string[];
  warnings: import('@bangumi-agent-kit/bangumi-core').EpisodeGuideResult['warnings'];
  error?: import('@bangumi-agent-kit/bangumi-core').EpisodeGuideResult['error'];
}

export interface EpisodeIntegrityViewModel {
  template: 'episode-integrity';
  version: 1;
  subjectId: number;
  state: import('@bangumi-agent-kit/bangumi-core').EpisodeIntegrityState;
  subject: import('@bangumi-agent-kit/bangumi-core').EpisodeIntegrityResult['subject'];
  filters: import('@bangumi-agent-kit/bangumi-core').EpisodeIntegrityResult['filters'];
  items: import('@bangumi-agent-kit/bangumi-core').EpisodeIntegrityResult['items'];
  summary: import('@bangumi-agent-kit/bangumi-core').EpisodeIntegrityResult['summary'];
  asOf: import('@bangumi-agent-kit/bangumi-core').EpisodeIntegrityResult['asOf'];
  integrity: import('@bangumi-agent-kit/bangumi-core').EpisodeIntegrityResult['integrity'];
  coverage: import('@bangumi-agent-kit/bangumi-core').EpisodeIntegrityResult['coverage'] & {
    renderedRows: number;
    renderedOmitted: number;
  };
  capabilityStates: import('@bangumi-agent-kit/bangumi-core').EpisodeIntegrityResult['capabilityStates'];
  source: import('@bangumi-agent-kit/bangumi-core').EpisodeIntegrityResult['source'];
  evidence: import('@bangumi-agent-kit/bangumi-core').EpisodeIntegrityResult['evidence'];
  limitations: string[];
  warnings: import('@bangumi-agent-kit/bangumi-core').EpisodeIntegrityResult['warnings'];
  error?: import('@bangumi-agent-kit/bangumi-core').EpisodeIntegrityResult['error'];
}

export type SubjectOverviewState = 'complete' | 'partial' | 'unavailable' | 'not_found';
export type SubjectOverviewSectionState = 'complete' | 'partial' | 'unavailable' | 'not_computable';

export interface SubjectOverviewViewModel {
  template: 'subject-overview';
  version: 1;
  state: SubjectOverviewState;
  subject: {
    id: number;
    name: string;
    nameCn?: string;
    type: string;
    date?: string;
    platform?: string;
    image?: string;
    score?: number;
    rank?: number;
    summary?: string;
    eps?: number;
    totalEpisodes?: number;
  };
  stats: {
    state: SubjectOverviewSectionState;
    score?: number;
    rank?: number;
    ratingTotal?: number;
    histogram: Array<{ score: number; count: number }>;
    collection?: {
      wish: number;
      collect: number;
      doing: number;
      onHold: number;
      dropped: number;
    };
    coverage: { observed: number; returned: number; truncated: boolean };
  };
  cast: {
    state: SubjectOverviewSectionState;
    items: Array<{
      character: { id: number; name: string; image?: string };
      relation: string;
      actors: Array<{ id: number; name: string; image?: string }>;
    }>;
    hiddenCount?: number;
    coverage: { observed: number; returned: number; truncated: boolean };
    actorCoverage: { observed: number; returned: number; truncated: boolean };
  };
  staff: {
    state: SubjectOverviewSectionState;
    groups: Array<{
      relation: string;
      count: number;
      members: Array<{ id: number; name: string; image?: string }>;
    }>;
    hiddenCount?: number;
    coverage: { observed: number; returned: number; truncated: boolean };
  };
  relations: {
    state: SubjectOverviewSectionState;
    items: Array<{
      id: number;
      name: string;
      nameCn?: string;
      type: string;
      relation: string;
      image?: string;
    }>;
    hiddenCount?: number;
    coverage: { observed: number; returned: number; truncated: boolean };
  };
  coverage: {
    sourceRequestsAttempted: number;
    sourceRequestsSucceeded: number;
    sectionsComplete: number;
    sectionsPartial: number;
    sectionsUnavailable: number;
    sectionsNotComputable: number;
    truncatedSections: string[];
    limits: { maxCast: number; maxStaff: number; maxRelations: number };
    actorLimits: { perCharacter: number; total: number };
  };
  evidence: { operations: string[]; count: number; retrievedAt?: string };
  warnings: Array<{ code: string; state: string; message: string }>;
  limitations: string[];
  source: { label: string; retrievedAt?: string };
}

export interface SubjectComparisonViewModel {
  template: 'subject-comparison';
  /** Version 1 is accepted for additive compatibility; builders emit version 2. */
  version: 1 | 2;
  state: import('@bangumi-agent-kit/bangumi-core').SubjectComparisonState;
  subjectIds: [number, number];
  subjects: import('@bangumi-agent-kit/bangumi-core').SubjectComparisonResult['subjects'];
  metrics: import('@bangumi-agent-kit/bangumi-core').SubjectComparisonResult['metrics'];
  formulaVersion: import('@bangumi-agent-kit/bangumi-core').SubjectComparisonResult['formulaVersion'];
  statisticsFormulaVersion?: import('@bangumi-agent-kit/bangumi-core').SubjectComparisonResult['statisticsFormulaVersion'];
  overlapFormulaVersion: import('@bangumi-agent-kit/bangumi-core').SubjectComparisonResult['overlapFormulaVersion'];
  overlaps: import('@bangumi-agent-kit/bangumi-core').SubjectComparisonResult['overlaps'];
  coverage: import('@bangumi-agent-kit/bangumi-core').SubjectComparisonResult['coverage'] & {
    renderedMetrics: number;
    omittedMetrics: number;
  };
  source: import('@bangumi-agent-kit/bangumi-core').SubjectComparisonResult['source'];
  evidence: import('@bangumi-agent-kit/bangumi-core').SubjectComparisonResult['evidence'];
  warnings: import('@bangumi-agent-kit/bangumi-core').SubjectComparisonResult['warnings'];
  limitations: string[];
}

export interface SubjectCohortComparisonViewModel {
  template: 'subject-cohort-comparison';
  version: 1;
  state: import('@bangumi-agent-kit/discovery').SubjectCohortComparisonResult['state'];
  cohorts: import('@bangumi-agent-kit/discovery').SubjectCohortComparisonResult['cohorts'];
  metrics: import('@bangumi-agent-kit/discovery').SubjectCohortComparisonResult['metrics'];
  formulaVersion: import('@bangumi-agent-kit/discovery').SubjectCohortComparisonResult['formulaVersion'];
  coverage: import('@bangumi-agent-kit/discovery').SubjectCohortComparisonResult['coverage'] & {
    renderedSubjectsPerCohort: number;
    omittedSubjectsPerCohort: number[];
  };
  source: import('@bangumi-agent-kit/discovery').SubjectCohortComparisonResult['source'];
  evidence: import('@bangumi-agent-kit/discovery').SubjectCohortComparisonResult['evidence'];
  warnings: import('@bangumi-agent-kit/discovery').SubjectCohortComparisonResult['warnings'];
  limitations: string[];
  retrievedAt?: string;
}

export interface SubjectOverlapViewModel {
  template: 'subject-overlap';
  version: 1;
  state: import('@bangumi-agent-kit/bangumi-core').SubjectOverlapResult['state'];
  kind: import('@bangumi-agent-kit/bangumi-core').SubjectOverlapResult['kind'];
  castRole: import('@bangumi-agent-kit/bangumi-core').SubjectOverlapResult['castRole'];
  subjects: import('@bangumi-agent-kit/bangumi-core').SubjectOverlapResult['subjects'];
  pairs: import('@bangumi-agent-kit/bangumi-core').SubjectOverlapResult['pairs'];
  formulaVersion: import('@bangumi-agent-kit/bangumi-core').SubjectOverlapResult['formulaVersion'];
  coverage: import('@bangumi-agent-kit/bangumi-core').SubjectOverlapResult['coverage'];
  source: import('@bangumi-agent-kit/bangumi-core').SubjectOverlapResult['source'];
  operationEvidence: import('@bangumi-agent-kit/bangumi-core').SubjectOverlapResult['operationEvidence'];
  evidence: import('@bangumi-agent-kit/bangumi-core').SubjectOverlapResult['evidence'];
  warnings: import('@bangumi-agent-kit/bangumi-core').SubjectOverlapResult['warnings'];
  limitations: string[];
}

export interface SubjectStatsViewModel {
  template: 'subject-stats';
  version: 1;
  subjectId: number;
  state: import('@bangumi-agent-kit/bangumi-core').SubjectStatsIntelligenceState;
  raw?: import('@bangumi-agent-kit/bangumi-core').SubjectStatsIntelligenceResult['raw'];
  rating: import('@bangumi-agent-kit/bangumi-core').SubjectStatsIntelligenceResult['rating'];
  collection: import('@bangumi-agent-kit/bangumi-core').SubjectStatsIntelligenceResult['collection'];
  coverage: import('@bangumi-agent-kit/bangumi-core').SubjectStatsIntelligenceResult['coverage'];
  source: import('@bangumi-agent-kit/bangumi-core').SubjectStatsIntelligenceResult['source'];
  evidence: import('@bangumi-agent-kit/bangumi-core').SubjectStatsIntelligenceResult['evidence'];
  warnings: import('@bangumi-agent-kit/bangumi-core').SubjectStatsIntelligenceResult['warnings'];
  limitations: string[];
  retrievedAt?: string;
}

export interface SubjectIdentityViewModel {
  template: 'subject-identity';
  version: 1;
  subjectId: number;
  state: import('@bangumi-agent-kit/bangumi-core').SubjectIdentityState;
  subject?: {
    id: number;
    type: number;
    typeLabel: import('@bangumi-agent-kit/bangumi-core').SubjectIdentityData['typeLabel'];
    name: string;
    nameCn?: string;
    date?: string;
    platform?: string;
    locked?: boolean;
    nsfw?: boolean;
    series?: boolean;
    volumes?: number;
    eps?: number;
    totalEpisodes?: number;
    metaTags?: string[];
    tags?: string[];
    imageLinksAvailable: boolean;
  };
  infobox: import('@bangumi-agent-kit/bangumi-core').SubjectIdentityInfoboxData;
  coverage: import('@bangumi-agent-kit/bangumi-core').SubjectIdentityResult['coverage'];
  source: import('@bangumi-agent-kit/bangumi-core').SubjectIdentityResult['source'];
  evidence: import('@bangumi-agent-kit/bangumi-core').SubjectIdentityEvidence[];
  presentation: {
    state: 'complete' | 'partial';
    text: {
      maxGraphemes: number;
      availableGraphemes: number;
      renderedGraphemes: number;
      omittedGraphemes: number;
      truncated: boolean;
    };
    direct: { available: number; rendered: number; omitted: number; truncated: number };
    infobox: {
      available: number;
      rendered: number;
      omitted: number;
      truncated: number;
      valuesAvailable: number;
      valuesRendered: number;
      valuesOmitted: number;
    };
    aliases: {
      available: number;
      rendered: number;
      omitted: number;
      truncated: number;
      sourceKeysAvailable: number;
      sourceKeysRendered: number;
      sourceKeysOmitted: number;
    };
    metaTags: { available: number; rendered: number; omitted: number; truncated: number };
    tags: { available: number; rendered: number; omitted: number; truncated: number };
  };
  warnings: import('@bangumi-agent-kit/bangumi-core').SubjectIdentityResult['warnings'];
  limitations: string[];
  retrievedAt?: string;
  error?: import('@bangumi-agent-kit/bangumi-core').SubjectIdentityResult['error'];
}

export interface SubjectStatsHistoryViewModel {
  template: 'subject-stats-history';
  version: 1;
  subjectId: number;
  state: import('@bangumi-agent-kit/bangumi-core').SubjectStatsHistoryState;
  collection: import('@bangumi-agent-kit/bangumi-core').SubjectStatsHistoryResult['collection'];
  observations: import('@bangumi-agent-kit/bangumi-core').SubjectStatsHistoryResult['observations'];
  changes: import('@bangumi-agent-kit/bangumi-core').SubjectStatsHistoryResult['changes'];
  methodology: import('@bangumi-agent-kit/bangumi-core').SubjectStatsHistoryResult['methodology'];
  source: import('@bangumi-agent-kit/bangumi-core').SubjectStatsHistoryResult['source'];
  warnings: import('@bangumi-agent-kit/bangumi-core').SubjectStatsHistoryResult['warnings'];
  limitations: string[];
}

export type SubjectIndexMembershipViewModel =
  import('@bangumi-agent-kit/bangumi-core').SubjectIndexMembershipResult & {
    template: 'subject-index-membership';
    version: 1;
  };

export type RenderViewModel =
  | SubjectCardViewModel
  | SearchListViewModel
  | DiscoveryResultsViewModel
  | SeriesRelationsViewModel
  | CastCardViewModel
  | CollectionProgressViewModel
  | CollectionIntelligenceViewModel
  | CollectionBacklogViewModel
  | CollectionScheduleViewModel
  | CollectionDashboardViewModel
  | CollectionSeriesViewModel
  | CollectionEntityConsistencyViewModel
  | CharacterCreditIntegrityViewModel
  | CalendarViewModel
  | RevisionTimelineViewModel
  | SubjectLatestRevisionViewModel
  | EpisodeGuideViewModel
  | EpisodeIntegrityViewModel
  | PersonProfileViewModel
  | PersonActivityViewModel
  | PersonCollaborationViewModel
  | SubjectOverviewViewModel
  | SubjectComparisonViewModel
  | SubjectCohortComparisonViewModel
  | SubjectOverlapViewModel
  | SubjectStatsViewModel
  | SubjectIdentityViewModel
  | SubjectStatsHistoryViewModel
  | SubjectIndexMembershipViewModel;
