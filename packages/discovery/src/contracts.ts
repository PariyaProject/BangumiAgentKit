import type {
  CapabilityState,
  CapabilityWarning,
  Coverage,
  EvidenceRef,
  FieldEvidence,
  SubjectDiscoveryCandidate,
  SubjectDiscoveryPage,
  SubjectDiscoveryTotalKind,
  SubjectDiscoverySearchRequest,
  SubjectDiscoveryBrowseRequest,
} from '@bangumi-agent-kit/provider-core';

export const MEDIA_TYPES = ['anime', 'book', 'music', 'game', 'real'] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

export const DISCOVERY_CATEGORIES = ['tv', 'ova', 'movie', 'web'] as const;
export type DiscoveryCategory = (typeof DISCOVERY_CATEGORIES)[number];

export const DISCOVERY_SORTS = ['relevance', 'heat', 'rank', 'score', 'date'] as const;
export type DiscoverySort = (typeof DISCOVERY_SORTS)[number];

export type DiscoveryOrder = 'asc' | 'desc';
export type DiscoveryResultMode = 'top' | 'all';
export type DiscoveryExplainMode = 'none' | 'compact' | 'full';
export type NsfwFilter = 'include' | 'exclude' | 'only';

export interface NumericRangeInput {
  min?: number;
  max?: number;
}

export interface DiscoveryBudgetInput {
  maxPages?: number;
  maxCandidates?: number;
  maxHydrations?: number;
  concurrency?: number;
  maxConceptProbes?: number;
  maxReturnedItems?: number;
}

export interface DiscoveryQuery {
  keyword?: string;
  media?: MediaType | readonly MediaType[];
  categories?: DiscoveryCategory | readonly DiscoveryCategory[];
  year?: number;
  month?: number;
  season?: string;
  from?: string;
  to?: string;
  tags?: readonly string[];
  metaTags?: readonly string[];
  excludeMetaTags?: readonly string[];
  concepts?: readonly string[];
  rating?: NumericRangeInput;
  ratingCount?: NumericRangeInput;
  rank?: NumericRangeInput;
  collectionCount?: NumericRangeInput;
  nsfw?: NsfwFilter | boolean;
  sort?: DiscoverySort;
  order?: DiscoveryOrder;
  resultMode?: DiscoveryResultMode;
  limit?: number;
  explain?: DiscoveryExplainMode;
  budget?: DiscoveryBudgetInput;
}

export interface DateRange {
  /** ISO date, inclusive. */
  from: string;
  /** ISO date, exclusive. */
  to: string;
}

export interface NumericRange {
  min?: number;
  max?: number;
}

export interface NormalizedDiscoveryQuery {
  keyword: string;
  media: MediaType[];
  categories: DiscoveryCategory[];
  year?: number;
  month?: number;
  dateRange?: DateRange;
  tags: string[];
  metaTags: string[];
  excludeMetaTags: string[];
  concepts: string[];
  rating?: NumericRange;
  ratingCount?: NumericRange;
  rank?: NumericRange;
  collectionCount?: NumericRange;
  nsfw: NsfwFilter;
  sort: DiscoverySort;
  order: DiscoveryOrder;
  resultMode: DiscoveryResultMode;
  limit: number;
  explain: DiscoveryExplainMode;
  budget: ExecutionBudget;
}

export interface ExecutionBudget {
  maxPages: number;
  maxCandidates: number;
  maxHydrations: number;
  concurrency: number;
  maxConceptProbes: number;
  maxReturnedItems: number;
}

export type FilterClassification = 'PUSHDOWN' | 'POST_FILTER' | 'DERIVED_FILTER' | 'UNSUPPORTED';

export interface PlanFilter {
  field: string;
  classification: FilterClassification;
  operator: 'eq' | 'in' | 'contains_all' | 'contains_any' | 'gte' | 'lte' | 'lt' | 'range';
  value: string | number | boolean | string[] | NumericRange | DateRange;
  source: 'official_v0';
  operation: 'searchSubjects' | 'browseSubjects';
  reason?: string;
}

export interface DiscoverySearchStep {
  kind: 'search';
  source: 'official_v0';
  operation: 'searchSubjects';
  page: number;
  request: SubjectDiscoverySearchRequest;
}

export interface DiscoveryBrowseStep {
  kind: 'browse';
  source: 'official_v0';
  operation: 'browseSubjects';
  page: number;
  request: SubjectDiscoveryBrowseRequest;
}

export interface DiscoveryHydrateStep {
  kind: 'hydrate';
  source: 'official_v0';
  operation: 'getSubjectById';
  ids: number[];
}

export type DiscoveryPlanStep =
  | DiscoverySearchStep
  | DiscoveryBrowseStep
  | DiscoveryHydrateStep;

export type DiscoveryPlanQuality =
  | 'exact'
  | 'bounded_exact'
  | 'partial_possible'
  | 'unsupported';

export type DiscoveryHydrationReason =
  | 'canonical_meta_tags'
  | 'category_filter'
  | 'collection_count_filter'
  | 'rating_filter'
  | 'rating_count_filter'
  | 'rank_filter'
  | 'nsfw_filter'
  | 'date_sort'
  | 'score_sort'
  | 'rank_sort';

export interface DiscoveryHydrationRequirement {
  reason: DiscoveryHydrationReason;
  fields: string[];
  source: 'candidate_or_detail' | 'canonical_detail';
}

export interface DiscoveryPlan {
  source: 'official_v0';
  operation: 'searchSubjects' | 'browseSubjects';
  totalKind: SubjectDiscoveryTotalKind;
  pushdown: PlanFilter[];
  postFilters: PlanFilter[];
  derivedFilters: PlanFilter[];
  unsupported: PlanFilter[];
  hydrationRequired: boolean;
  hydrationRequirements: DiscoveryHydrationRequirement[];
  requestedTopN: number;
  resultMode: DiscoveryResultMode;
  quality: DiscoveryPlanQuality;
  budget: ExecutionBudget;
  steps: DiscoveryPlanStep[];
  limitations: string[];
}

export interface DiscoveryCoverage extends Coverage {
  requested: number;
  scanned: number;
  matched: number;
  returned: number;
  pagesRequested: number;
  pagesScanned: number;
  upstreamExhausted: boolean;
  budgetExceeded: boolean;
  postFilterCount: number;
  totalKind: SubjectDiscoveryTotalKind;
  hydrationsAttempted: number;
  hydrationsSucceeded: number;
  hydrationsFailed: number;
  hydrationsUnresolved: number;
  hydrationBudgetExceeded: boolean;
  outputCap?: number;
  reason?: string;
}

export interface DiscoveryItem {
  id: number;
  name: string;
  nameCn?: string;
  displayName: string;
  media: MediaType;
  category?: DiscoveryCategory;
  date?: string;
  score?: number;
  rank?: number;
  ratingCount?: number;
  collectionTotal?: number;
  tags: string[];
  metaTags: string[];
  image?: string;
  nsfw?: boolean;
  evidence: FieldEvidence;
}

export interface HeatEvidence {
  key: 'heat';
  source: 'official_v0';
  operation: 'searchSubjects';
  meaning: '收藏人数';
}

export interface DiscoveryExplanation {
  mode: Exclude<DiscoveryExplainMode, 'none'>;
  summary: string;
  source: 'official_v0';
  operation: 'searchSubjects' | 'browseSubjects';
  pushdown: PlanFilter[];
  postFilters: PlanFilter[];
  derivedFilters: PlanFilter[];
  quality: DiscoveryPlanQuality;
  totalKind: SubjectDiscoveryTotalKind;
  coverageScope: string;
  coverage: DiscoveryCoverage;
  limitations: string[];
  heat?: HeatEvidence;
}

export interface DiscoveryResult {
  state: CapabilityState;
  items: DiscoveryItem[];
  plan: DiscoveryPlan;
  coverage: DiscoveryCoverage;
  warnings: CapabilityWarning[];
  evidence: EvidenceRef[];
  explanation?: DiscoveryExplanation;
  conceptResolution?: ConceptResolution[];
}

export type ConceptSource = 'tag' | 'meta_tag';
export type ConceptResolutionState = 'exact' | 'ambiguous' | 'unknown';

export interface ConceptCandidate {
  source: ConceptSource;
  value: string;
  canonical: string;
  reason: string;
  evidence: EvidenceRef[];
}

export interface ConceptResolution {
  input: string;
  state: ConceptResolutionState;
  candidates: ConceptCandidate[];
  message: string;
}

export interface ConceptDefinition {
  input: string;
  canonical: string;
  source: ConceptSource;
  reason: string;
  lastVerified: string;
}

export interface DiscoveryProviderPage {
  result: {
    state: CapabilityState;
    data?: SubjectDiscoveryPage;
    evidence?: FieldEvidence;
    coverage?: Coverage;
    warnings?: CapabilityWarning[];
    retrievedAt?: string;
  };
  request: SubjectDiscoverySearchRequest | SubjectDiscoveryBrowseRequest;
}

export type DiscoveryCandidate = SubjectDiscoveryCandidate;

export class DiscoveryValidationError extends Error {
  readonly code = 'VALIDATION_ERROR' as const;

  constructor(readonly issues: string[]) {
    super(`Discovery query validation failed: ${issues.join('; ')}`);
    this.name = 'DiscoveryValidationError';
  }
}
