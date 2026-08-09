import type {
  ConceptCandidate,
  DiscoveryBrowseStep,
  DiscoveryPlan,
  DiscoveryQuery,
  DiscoverySearchStep,
  NormalizedDiscoveryQuery,
  PlanFilter,
} from './contracts.js';
import { planFilter } from './capabilities.js';
import { isNormalizedDiscoveryQuery, normalizeDiscoveryQuery } from './query.js';
import type {
  SubjectDiscoveryBrowseRequest,
  SubjectDiscoverySearchRequest,
} from '@bangumi-agent-kit/provider-core';

const MEDIA_TO_TYPE = {
  anime: 2,
  book: 1,
  music: 3,
  game: 4,
  real: 6,
} as const;

const CATEGORY_TO_CAT = { tv: 1, ova: 2, movie: 3, web: 5 } as const;

function rangeExpressions(range: { min?: number; max?: number }): string[] {
  return [
    ...(range.min === undefined ? [] : [`>=${range.min}`]),
    ...(range.max === undefined ? [] : [`<=${range.max}`]),
  ];
}

function canBrowse(query: NormalizedDiscoveryQuery): boolean {
  return (
    query.keyword === '' &&
    query.media.length === 1 &&
    query.concepts.length === 0 &&
    query.tags.length === 0 &&
    query.metaTags.length === 0 &&
    query.excludeMetaTags.length === 0 &&
    query.rating === undefined &&
    query.ratingCount === undefined &&
    query.rank === undefined &&
    query.collectionCount === undefined &&
    query.nsfw === 'include' &&
    query.dateRange === undefined &&
    (query.sort === 'date' || query.sort === 'rank' || query.sort === 'relevance') &&
    (query.year !== undefined || query.month !== undefined || query.categories.length > 0)
  );
}

function conceptFilters(
  operation: 'searchSubjects',
  candidates: readonly ConceptCandidate[],
): PlanFilter[] {
  const tagValues = candidates.filter((item) => item.source === 'tag').map((item) => item.value);
  const metaValues = candidates.filter((item) => item.source === 'meta_tag').map((item) => item.value);
  return [
    ...(tagValues.length === 0 ? [] : [planFilter('concepts', operation, 'contains_all', tagValues)]),
    ...(metaValues.length === 0 ? [] : [planFilter('concepts', operation, 'contains_all', metaValues)]),
  ];
}

function searchRequest(
  query: NormalizedDiscoveryQuery,
  candidates: readonly ConceptCandidate[],
): SubjectDiscoverySearchRequest {
  const type = query.media.map((item) => MEDIA_TO_TYPE[item]);
  const filter: SubjectDiscoverySearchRequest['filter'] = {
    ...(type.length === 0 ? {} : { type }),
    ...(query.tags.length === 0 ? {} : { tag: query.tags }),
    ...(query.metaTags.length === 0 && query.excludeMetaTags.length === 0
      ? {}
      : {
          metaTags: [
            ...query.metaTags,
            ...query.excludeMetaTags.map((item) => `-${item}`),
          ],
        }),
    ...(query.dateRange === undefined
      ? {}
      : { airDate: [`>=${query.dateRange.from}`, `<${query.dateRange.to}`] }),
    ...(query.rating === undefined ? {} : { rating: rangeExpressions(query.rating) }),
    ...(query.ratingCount === undefined ? {} : { ratingCount: rangeExpressions(query.ratingCount) }),
    ...(query.rank === undefined ? {} : { rank: rangeExpressions(query.rank) }),
    ...(query.nsfw === 'include' ? {} : { nsfw: query.nsfw === 'only' }),
  };
  const tagConcepts = candidates.filter((item) => item.source === 'tag').map((item) => item.value);
  const metaConcepts = candidates.filter((item) => item.source === 'meta_tag').map((item) => item.value);
  if (tagConcepts.length > 0) filter.tag = [...(filter.tag ?? []), ...tagConcepts];
  if (metaConcepts.length > 0) filter.metaTags = [...(filter.metaTags ?? []), ...metaConcepts];
  return {
    keyword: query.keyword,
    limit: Math.min(50, Math.max(query.limit, 20)),
    offset: 0,
    sort: query.sort === 'relevance' || query.sort === 'date' ? 'match' : query.sort,
    ...(Object.keys(filter).length === 0 ? {} : { filter }),
  };
}

function browseRequest(query: NormalizedDiscoveryQuery): SubjectDiscoveryBrowseRequest {
  const media = query.media[0];
  const request: SubjectDiscoveryBrowseRequest = {
    type: MEDIA_TO_TYPE[media ?? 'anime'],
    limit: Math.min(50, Math.max(query.limit, 20)),
    offset: 0,
    ...(query.categories[0] === undefined ? {} : { category: CATEGORY_TO_CAT[query.categories[0]] }),
    ...(query.year === undefined ? {} : { year: query.year }),
    ...(query.month === undefined ? {} : { month: query.month }),
  };
  if (query.sort === 'date' || query.sort === 'rank') request.sort = query.sort;
  return request;
}

export function compileDiscoveryPlan(
  input: DiscoveryQuery | NormalizedDiscoveryQuery,
  resolvedConcepts: readonly ConceptCandidate[] = [],
): DiscoveryPlan {
  const query = isNormalizedDiscoveryQuery(input)
    ? input
    : normalizeDiscoveryQuery(input as DiscoveryQuery);
  const operation: DiscoveryPlan['operation'] = canBrowse(query) ? 'browseSubjects' : 'searchSubjects';
  const pushdown: PlanFilter[] = [];
  const postFilters: PlanFilter[] = [];
  const derivedFilters: PlanFilter[] = [];
  const unsupported: PlanFilter[] = [];

  if (operation === 'browseSubjects') {
    if (query.media.length === 1) pushdown.push(planFilter('media', operation, 'eq', query.media[0] ?? 'anime'));
    if (query.categories.length > 0) pushdown.push(planFilter('categories', operation, 'in', query.categories));
    if (query.year !== undefined) pushdown.push(planFilter('year', operation, 'eq', query.year));
    if (query.month !== undefined) pushdown.push(planFilter('month', operation, 'eq', query.month));
    pushdown.push(planFilter(`sort:${query.sort}`, operation, 'eq', query.sort));
  } else {
    if (query.keyword) pushdown.push(planFilter('keyword', operation, 'eq', query.keyword));
    if (query.media.length > 0) pushdown.push(planFilter('media', operation, 'in', query.media));
    if (query.tags.length > 0) pushdown.push(planFilter('tags', operation, 'contains_all', query.tags));
    if (query.metaTags.length > 0) pushdown.push(planFilter('metaTags', operation, 'contains_all', query.metaTags));
    if (query.excludeMetaTags.length > 0) pushdown.push(planFilter('excludeMetaTags', operation, 'contains_all', query.excludeMetaTags));
    if (query.dateRange) pushdown.push(planFilter('dateRange', operation, 'range', query.dateRange));
    if (query.rating) pushdown.push(planFilter('rating', operation, 'range', query.rating));
    if (query.ratingCount) pushdown.push(planFilter('ratingCount', operation, 'range', query.ratingCount));
    if (query.rank) pushdown.push(planFilter('rank', operation, 'range', query.rank));
    if (query.nsfw !== 'include') pushdown.push(planFilter('nsfw', operation, 'eq', query.nsfw === 'only'));
    if (query.categories.length > 0) postFilters.push(planFilter('categories', operation, 'in', query.categories));
    if (query.collectionCount) derivedFilters.push(planFilter('collectionCount', operation, 'range', query.collectionCount));
    pushdown.push(planFilter(`sort:${query.sort}`, operation, 'eq', query.sort));
    pushdown.push(...conceptFilters(operation, resolvedConcepts));
    if (query.sort === 'date') postFilters.push(planFilter('sort:date', operation, 'eq', query.sort));
  }
  if (query.order === 'asc') derivedFilters.push(planFilter('order', operation, 'eq', query.order));
  if (operation === 'browseSubjects' && query.collectionCount) derivedFilters.push(planFilter('collectionCount', operation, 'range', query.collectionCount));

  const request = operation === 'browseSubjects' ? browseRequest(query) : searchRequest(query, resolvedConcepts);
  const firstStep: DiscoverySearchStep | DiscoveryBrowseStep = operation === 'browseSubjects'
    ? { kind: 'browse', source: 'official_v0', operation, page: 0, request: request as SubjectDiscoveryBrowseRequest }
    : { kind: 'search', source: 'official_v0', operation, page: 0, request: request as SubjectDiscoverySearchRequest };
  const limitations = [
    'Enumeration is bounded by maxPages and maxCandidates.',
    ...(query.resultMode === 'all' ? ['all requests a complete attempt; budget exhaustion is reported as partial.'] : []),
    ...(query.sort === 'heat' ? ['heat means upstream 收藏人数 and is not a recent-trend metric.'] : []),
  ];
  return {
    source: 'official_v0',
    operation,
    pushdown,
    postFilters,
    derivedFilters,
    unsupported,
    hydrationRequired: postFilters.length > 0 || derivedFilters.length > 0,
    requestedTopN: query.limit,
    resultMode: query.resultMode,
    quality: query.resultMode === 'all' ? 'bounded_exact' : 'exact',
    budget: query.budget,
    steps: [firstStep],
    limitations,
  };
}
