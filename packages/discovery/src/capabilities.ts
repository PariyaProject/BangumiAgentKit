import type { FilterClassification, PlanFilter } from './contracts.js';

export type DiscoveryProviderOperation = 'searchSubjects' | 'browseSubjects';

export interface SourceCapability {
  field: string;
  operation: DiscoveryProviderOperation;
  classification: FilterClassification;
  notes: string;
}

const MATRIX: readonly SourceCapability[] = [
  { field: 'keyword', operation: 'searchSubjects', classification: 'PUSHDOWN', notes: 'POST keyword search' },
  { field: 'media', operation: 'searchSubjects', classification: 'PUSHDOWN', notes: 'type filter' },
  { field: 'media', operation: 'browseSubjects', classification: 'PUSHDOWN', notes: 'required type' },
  { field: 'categories', operation: 'browseSubjects', classification: 'PUSHDOWN', notes: 'anime cat filter when verified' },
  { field: 'categories', operation: 'searchSubjects', classification: 'POST_FILTER', notes: 'category is not a search filter' },
  { field: 'year', operation: 'browseSubjects', classification: 'PUSHDOWN', notes: 'year browse filter' },
  { field: 'month', operation: 'browseSubjects', classification: 'PUSHDOWN', notes: 'month browse filter' },
  { field: 'dateRange', operation: 'searchSubjects', classification: 'PUSHDOWN', notes: 'half-open air_date expressions' },
  { field: 'tags', operation: 'searchSubjects', classification: 'PUSHDOWN', notes: 'AND tag filter' },
  { field: 'metaTags', operation: 'searchSubjects', classification: 'PUSHDOWN', notes: 'AND meta_tags filter' },
  { field: 'excludeMetaTags', operation: 'searchSubjects', classification: 'POST_FILTER', notes: 'canonical hydrated meta_tags exclusion; upstream minus syntax is not verified' },
  { field: 'concepts', operation: 'searchSubjects', classification: 'PUSHDOWN', notes: 'resolved to literal tag/meta_tag values' },
  { field: 'rating', operation: 'searchSubjects', classification: 'PUSHDOWN', notes: 'rating range expressions' },
  { field: 'ratingCount', operation: 'searchSubjects', classification: 'PUSHDOWN', notes: 'rating_count range expressions' },
  { field: 'rank', operation: 'searchSubjects', classification: 'PUSHDOWN', notes: 'rank range expressions' },
  { field: 'nsfw', operation: 'searchSubjects', classification: 'PUSHDOWN', notes: 'boolean nsfw filter' },
  { field: 'collectionCount', operation: 'searchSubjects', classification: 'DERIVED_FILTER', notes: 'sum collection buckets after hydration' },
  { field: 'sort:relevance', operation: 'searchSubjects', classification: 'PUSHDOWN', notes: 'mapped to upstream match' },
  { field: 'sort:heat', operation: 'searchSubjects', classification: 'PUSHDOWN', notes: 'upstream 收藏人数, not a trend metric' },
  { field: 'sort:rank', operation: 'searchSubjects', classification: 'PUSHDOWN', notes: 'upstream rank order' },
  { field: 'sort:score', operation: 'searchSubjects', classification: 'PUSHDOWN', notes: 'upstream score order' },
  { field: 'sort:date', operation: 'browseSubjects', classification: 'PUSHDOWN', notes: 'browse date order' },
  { field: 'sort:date', operation: 'searchSubjects', classification: 'POST_FILTER', notes: 'stable local ordering after retrieval' },
  { field: 'order', operation: 'searchSubjects', classification: 'DERIVED_FILTER', notes: 'reverse stable local order when requested' },
  { field: 'order', operation: 'browseSubjects', classification: 'DERIVED_FILTER', notes: 'reverse stable local order when requested' },
] as const;

export function getSourceCapabilityMatrix(): readonly SourceCapability[] {
  return MATRIX.map((item) => ({ ...item }));
}

export function capabilityFor(
  field: string,
  operation: DiscoveryProviderOperation,
): SourceCapability | undefined {
  return MATRIX.find((item) => item.field === field && item.operation === operation);
}

export function planFilter(
  field: string,
  operation: DiscoveryProviderOperation,
  operator: PlanFilter['operator'],
  value: PlanFilter['value'],
  reason?: string,
): PlanFilter {
  const capability = capabilityFor(field, operation);
  return {
    field,
    classification: capability?.classification ?? 'UNSUPPORTED',
    operator,
    value,
    source: 'official_v0',
    operation,
    ...(reason === undefined ? {} : { reason }),
  };
}
