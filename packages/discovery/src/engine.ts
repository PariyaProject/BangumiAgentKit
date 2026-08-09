import {
  assertSafeEvidence,
  createEvidenceRef,
  SOURCE_DERIVED,
  type CapabilityResult,
  type CapabilityWarning,
  type EvidenceRef,
  type FieldEvidence,
  type ProviderRequestContext,
  type ProviderSubjectData,
  type SubjectDiscoveryCandidate,
  type SubjectDiscoveryBrowseRequest,
  type SubjectDiscoveryPage,
  type SubjectDiscoveryTotalKind,
  type SubjectDiscoveryProvider,
  type SubjectDiscoverySearchRequest,
} from '@bangumi-agent-kit/provider-core';
import {
  compileDiscoveryPlan,
} from './compiler.js';
import {
  type ConceptCandidate,
  type ConceptResolution,
  type DiscoveryItem,
  type DiscoveryPlan,
  type DiscoveryQuery,
  type DiscoveryResult,
  type DiscoveryCoverage,
  type MediaType,
  type NormalizedDiscoveryQuery,
  type DiscoveryCategory,
  DiscoveryValidationError,
} from './contracts.js';
import { ConceptResolver } from './concept-resolver.js';
import { isNormalizedDiscoveryQuery, normalizeDiscoveryQuery } from './query.js';

interface CandidateWithDetail {
  candidate: SubjectDiscoveryCandidate;
  detail?: ProviderSubjectData;
  detailResult?: CapabilityResult<ProviderSubjectData>;
  pageEvidence?: FieldEvidence;
  order: number;
}

function mediaForType(type: number): MediaType {
  switch (type) {
    case 1:
      return 'book';
    case 2:
      return 'anime';
    case 3:
      return 'music';
    case 4:
      return 'game';
    case 6:
      return 'real';
    default:
      return 'real';
  }
}

function categoryForPlatform(platform: string | undefined): DiscoveryCategory | undefined {
  const value = platform?.trim().toLowerCase();
  if (!value) return undefined;
  if (value === 'tv' || value.includes('电视')) return 'tv';
  if (value === 'ova' || value.includes('ova')) return 'ova';
  if (value === 'movie' || value.includes('剧场') || value.includes('电影')) return 'movie';
  if (value === 'web' || value.includes('网络')) return 'web';
  return undefined;
}

function imageFor(
  candidate: SubjectDiscoveryCandidate,
  detail: ProviderSubjectData | undefined,
): string | undefined {
  const images = detail?.images ?? candidate.images;
  return images?.medium ?? images?.common ?? images?.large ?? images?.small ?? images?.grid;
}

function collectionFor(
  candidate: SubjectDiscoveryCandidate,
  detail: ProviderSubjectData | undefined,
): { total?: number; formula?: string } {
  const collection = detail?.stats.collection ?? candidate.collection;
  if (!collection) return {};
  const values = [collection.wish, collection.collect, collection.doing, collection.onHold, collection.dropped];
  if (values.some((value) => value === undefined)) return {};
  return {
    total: values.reduce<number>((sum, value) => sum + (value ?? 0), 0),
    formula: 'wish + collect + doing + on_hold + dropped',
  };
}

function numberFor(
  candidate: SubjectDiscoveryCandidate,
  detail: ProviderSubjectData | undefined,
  field: 'score' | 'rank' | 'ratingCount',
): number | undefined {
  if (field === 'score') return detail?.stats.score ?? candidate.score;
  if (field === 'rank') return detail?.stats.rank ?? candidate.rank;
  return detail?.stats.ratingTotal ?? candidate.ratingCount;
}

function mergeEvidence(
  candidate: SubjectDiscoveryCandidate,
  pageEvidence: FieldEvidence | undefined,
  detailResult: CapabilityResult<ProviderSubjectData> | undefined,
  derivedCollection: string | undefined,
): FieldEvidence {
  const evidence: FieldEvidence = {};
  const id = candidate.id;
  for (const field of ['id', 'name', 'nameCn', 'date', 'platform', 'score', 'rank', 'ratingCount', 'collection', 'tags', 'metaTags', 'images', 'nsfw']) {
    const pageKey = `items[${id}].${field}`;
    const refs = pageEvidence?.[pageKey] ?? [];
    if (refs.length > 0) evidence[field] = [...refs];
  }
  for (const [field, refs] of Object.entries(detailResult?.evidence ?? {})) {
    evidence[field] = [...(evidence[field] ?? []), ...refs];
  }
  if (derivedCollection) {
    evidence.collectionTotal = [
      createEvidenceRef({
        source: SOURCE_DERIVED,
        retrievedAt: new Date().toISOString(),
        entity: { type: 'subject', id },
        fieldPath: 'collectionTotal',
        formula: derivedCollection,
        freshness: { state: 'unknown' },
        confidence: 'high',
      }),
    ];
  }
  return evidence;
}

function matchesRange(value: number | undefined, range: { min?: number; max?: number } | undefined): boolean {
  if (!range) return true;
  if (value === undefined) return false;
  if (range.min !== undefined && value < range.min) return false;
  if (range.max !== undefined && value > range.max) return false;
  return true;
}

function matchesCategory(item: CandidateWithDetail, categories: readonly DiscoveryCategory[]): boolean {
  if (categories.length === 0) return true;
  return categories.includes(categoryForPlatform(item.detail?.platform ?? item.candidate.platform) as DiscoveryCategory);
}

function matchesExcludedMetaTags(item: CandidateWithDetail, excluded: readonly string[]): boolean {
  if (excluded.length === 0) return true;
  const metaTags = item.detail?.metaTags ?? item.candidate.metaTags;
  return excluded.every((tag) => !metaTags.includes(tag));
}

function sortItems(items: CandidateWithDetail[], query: NormalizedDiscoveryQuery): CandidateWithDetail[] {
  const ordered = [...items];
  if (query.sort === 'score' || query.sort === 'rank' || query.sort === 'date') {
    ordered.sort((left, right) => {
      const leftValue = query.sort === 'date'
        ? left.detail?.date ?? left.candidate.date
        : numberFor(left.candidate, left.detail, query.sort === 'score' ? 'score' : 'rank');
      const rightValue = query.sort === 'date'
        ? right.detail?.date ?? right.candidate.date
        : numberFor(right.candidate, right.detail, query.sort === 'score' ? 'score' : 'rank');
      if (leftValue === undefined && rightValue === undefined) return left.order - right.order;
      if (leftValue === undefined) return 1;
      if (rightValue === undefined) return -1;
      const comparison = leftValue < rightValue ? -1 : leftValue > rightValue ? 1 : 0;
      return (query.order === 'asc' ? comparison : -comparison) || left.order - right.order;
    });
  } else if (query.order === 'asc') {
    ordered.reverse();
  }
  return ordered;
}

function nativeOrder(
  operation: DiscoveryPlan['operation'],
  sort: NormalizedDiscoveryQuery['sort'],
): NormalizedDiscoveryQuery['order'] | undefined {
  if (operation === 'browseSubjects') {
    if (sort === 'rank') return 'asc';
    if (sort === 'date') return 'desc';
    return undefined;
  }
  if (sort === 'rank') return 'asc';
  if (sort === 'heat' || sort === 'score' || sort === 'relevance') return 'desc';
  return undefined;
}

function canStopTop(
  query: NormalizedDiscoveryQuery,
  plan: DiscoveryPlan,
): boolean {
  return (
    query.resultMode === 'top' &&
    query.order === nativeOrder(plan.operation, query.sort) &&
    !plan.postFilters.some((item) => item.field === 'sort:date') &&
    !plan.derivedFilters.some((item) => item.field === 'order')
  );
}

function emptyCoverage(query: NormalizedDiscoveryQuery, reason?: string): DiscoveryCoverage {
  return {
    state: 'unknown',
    requested: query.resultMode === 'all' ? 0 : query.limit,
    scanned: 0,
    matched: 0,
    returned: 0,
    pagesRequested: 0,
    pagesScanned: 0,
    upstreamExhausted: false,
    budgetExceeded: false,
    postFilterCount: 0,
    totalKind: 'unknown',
    ...(reason === undefined ? {} : { reason }),
  };
}

function allEvidence(result: CapabilityResult<SubjectDiscoveryPage>): EvidenceRef[] {
  return Object.values(result.evidence ?? {}).flat();
}

async function boundedHydration(
  provider: SubjectDiscoveryProvider,
  candidates: CandidateWithDetail[],
  budget: NormalizedDiscoveryQuery['budget'],
  context: ProviderRequestContext,
): Promise<void> {
  const toHydrate = candidates.slice(0, budget.maxHydrations);
  for (let start = 0; start < toHydrate.length; start += budget.concurrency) {
    const batch = toHydrate.slice(start, start + budget.concurrency);
    const results = await Promise.all(
      batch.map(async (item) => ({
        item,
        result: await provider.getSubject(item.candidate.id, context),
      })),
    );
    for (const { item, result } of results) {
      item.detailResult = result;
      item.detail = result.data;
    }
  }
}

export class DiscoveryEngine {
  constructor(
    private readonly provider: SubjectDiscoveryProvider,
    private readonly concepts: ConceptResolver = new ConceptResolver(),
  ) {}

  async query(
    input: DiscoveryQuery | NormalizedDiscoveryQuery,
    context: ProviderRequestContext = {},
  ): Promise<DiscoveryResult> {
    let query: NormalizedDiscoveryQuery;
    try {
      query = isNormalizedDiscoveryQuery(input)
        ? input
        : normalizeDiscoveryQuery(input as DiscoveryQuery);
    } catch (error) {
      if (error instanceof DiscoveryValidationError) throw error;
      throw error;
    }
    const conceptResolution = this.concepts.resolveMany(query.concepts);
    const conceptCandidates: ConceptCandidate[] = conceptResolution
      .filter((item) => item.state === 'exact')
      .flatMap((item) => item.candidates);
    const plan = compileDiscoveryPlan(query, conceptCandidates);
    if (conceptResolution.some((item) => item.state !== 'exact')) {
      return this.conceptFailure(query, plan, conceptResolution);
    }

    const warnings: CapabilityWarning[] = [];
    const evidence: EvidenceRef[] = [];
    const matched = new Map<number, CandidateWithDetail>();
    const seenIds = new Set<number>();
    let scanned = 0;
    let pagesRequested = 0;
    let pagesScanned = 0;
    let postFilterCount = 0;
    let upstreamExhausted = false;
    let budgetExceeded = false;
    let totalKind: SubjectDiscoveryTotalKind = 'unknown';
    let orderCounter = 0;
    let lastState: DiscoveryResult['state'] = 'ok';
    let offset = 0;
    const pageSize = plan.steps[0]?.kind === 'search' || plan.steps[0]?.kind === 'browse'
      ? plan.steps[0].request.limit
      : Math.min(50, Math.max(query.limit, 20));
    const requestKeys = new Set<string>();
    const canStopTopQuery = canStopTop(query, plan);

    while (pagesScanned < query.budget.maxPages && scanned < query.budget.maxCandidates) {
      const step = plan.steps[0];
      if (!step || (step.kind !== 'search' && step.kind !== 'browse')) break;
      const request = { ...step.request, offset };
      const requestKey = JSON.stringify(request);
      if (requestKeys.has(requestKey)) {
        budgetExceeded = true;
        break;
      }
      requestKeys.add(requestKey);
      pagesRequested += 1;
      const result = step.kind === 'search'
        ? await this.provider.searchSubjects(request as SubjectDiscoverySearchRequest, context)
        : await this.provider.browseSubjects(request as SubjectDiscoveryBrowseRequest, context);
      pagesScanned += 1;
      warnings.push(...(result.warnings ?? []));
      evidence.push(...allEvidence(result));
      if (result.state !== 'ok' || !result.data) {
        lastState = result.state;
        if (matched.size > 0) lastState = 'partial';
        break;
      }
      const page = result.data;
      totalKind = page.totalKind ?? 'unknown';
      if (page.items.length === 0) {
        upstreamExhausted = true;
        break;
      }
      for (const candidate of page.items) {
        scanned += 1;
        if (scanned > query.budget.maxCandidates) {
          budgetExceeded = true;
          break;
        }
        if (seenIds.has(candidate.id)) continue;
        seenIds.add(candidate.id);
        matched.set(candidate.id, {
          candidate,
          pageEvidence: result.evidence,
          order: orderCounter++,
        });
      }
      const candidates = [...matched.values()];
      const needsHydration = plan.hydrationRequired;
      if (needsHydration) {
        await boundedHydration(this.provider, candidates.filter((item) => !item.detailResult), query.budget, context);
        if (candidates.length > query.budget.maxHydrations) budgetExceeded = true;
      }
      for (const item of candidates) {
        const collection = collectionFor(item.candidate, item.detail);
        const score = numberFor(item.candidate, item.detail, 'score');
        const rank = numberFor(item.candidate, item.detail, 'rank');
        const ratingCount = numberFor(item.candidate, item.detail, 'ratingCount');
        const collectionValue = collection.total;
        const isMatch =
          matchesCategory(item, query.categories) &&
          matchesExcludedMetaTags(item, query.excludeMetaTags) &&
          matchesRange(score, query.rating) &&
          matchesRange(ratingCount, query.ratingCount) &&
          matchesRange(rank, query.rank) &&
          matchesRange(collectionValue, query.collectionCount);
        if (!isMatch) {
          postFilterCount += 1;
          matched.delete(item.candidate.id);
        }
      }
      if (canStopTopQuery && matched.size >= query.limit) break;
      const total = page.total;
      if (page.totalKind === 'exact' && total !== undefined && offset + page.items.length >= total) {
        upstreamExhausted = true;
        break;
      }
      if (page.items.length < (page.limit || pageSize)) {
        upstreamExhausted = true;
        break;
      }
      offset += page.items.length;
    }
    if (!upstreamExhausted && pagesScanned >= query.budget.maxPages) budgetExceeded = true;
    if (!upstreamExhausted && scanned >= query.budget.maxCandidates) budgetExceeded = true;
    const sorted = sortItems([...matched.values()], query);
    const outputCap = query.resultMode === 'all' ? query.budget.maxReturnedItems : query.limit;
    const outputTruncated = query.resultMode === 'all' && sorted.length > outputCap;
    const returnedItems = sorted
      .slice(0, outputCap)
      .map((item) => this.toItem(item, item.pageEvidence ?? {}, query));
    const coverage: DiscoveryCoverage = {
      state: budgetExceeded || outputTruncated ? 'partial' : upstreamExhausted ? 'complete' : 'unknown',
      requested: query.resultMode === 'all' ? (upstreamExhausted ? scanned : 0) : query.limit,
      scanned,
      matched: sorted.length,
      returned: returnedItems.length,
      pagesRequested,
      pagesScanned,
      upstreamExhausted,
      budgetExceeded,
      postFilterCount,
      totalKind,
      ...(outputTruncated
        ? { outputCap, reason: 'output_cap' }
        : budgetExceeded
          ? { reason: 'Execution budget was exhausted before upstream coverage was proven.' }
          : {}),
    };
    if (budgetExceeded) {
      warnings.push({
        code: 'DISCOVERY_BUDGET_EXCEEDED',
        message: 'Discovery returned a bounded partial result because the execution budget was exhausted.',
      });
      lastState = 'partial';
    }
    if (outputTruncated) {
      warnings.push({
        code: 'DISCOVERY_OUTPUT_TRUNCATED',
        message: 'Discovery matched more items than the trusted output cap; the result is partial.',
        matched: sorted.length,
        returned: returnedItems.length,
        outputCap,
      });
      lastState = 'partial';
    }
    if (lastState !== 'ok' && returnedItems.length === 0 && warnings.length === 0) {
      warnings.push({ code: 'UPSTREAM_ERROR', message: 'The official discovery provider did not return data.' });
    }
    const finalState = lastState === 'ok' ? (budgetExceeded || outputTruncated ? 'partial' : 'ok') : lastState;
    const result: DiscoveryResult = {
      state: finalState,
      items: returnedItems,
      plan: {
        ...plan,
        steps: plan.steps,
      },
      coverage,
      warnings,
      evidence: [...new Set(evidence)],
      ...(query.explain === 'none' ? {} : { explanation: this.explain(query, plan, coverage) }),
      ...(query.concepts.length === 0 ? {} : { conceptResolution }),
    };
    result.evidence.forEach((item) => assertSafeEvidence(item));
    return result;
  }

  private conceptFailure(
    query: NormalizedDiscoveryQuery,
    plan: DiscoveryPlan,
    resolutions: ConceptResolution[],
  ): DiscoveryResult {
    const ambiguous = resolutions.find((item) => item.state === 'ambiguous');
    const warningCode = ambiguous ? 'DISCOVERY_AMBIGUOUS_CONCEPT' : 'DISCOVERY_UNKNOWN_CONCEPT';
    const coverage = emptyCoverage(query, ambiguous?.message ?? resolutions.find((item) => item.state === 'unknown')?.message);
    const result: DiscoveryResult = {
      state: 'unsupported',
      items: [],
      plan: { ...plan, quality: 'unsupported', unsupported: [] },
      coverage,
      warnings: [{ code: warningCode, message: resolutions.map((item) => item.message).join(' ') }],
      evidence: resolutions.flatMap((item) => item.candidates.flatMap((candidate) => candidate.evidence)),
      ...(query.explain === 'none' ? {} : { explanation: this.explain(query, plan, coverage) }),
      conceptResolution: resolutions,
    };
    result.evidence.forEach((item) => assertSafeEvidence(item));
    return result;
  }

  private explain(query: NormalizedDiscoveryQuery, plan: DiscoveryPlan, coverage: DiscoveryCoverage) {
    return {
      mode: query.explain as 'compact' | 'full',
      summary: `${plan.operation} via official_v0; scanned ${coverage.scanned}, returned ${coverage.returned}.`,
      source: 'official_v0' as const,
      operation: plan.operation,
      pushdown: plan.pushdown,
      postFilters: plan.postFilters,
      derivedFilters: plan.derivedFilters,
      quality: plan.quality,
      totalKind: coverage.totalKind,
      coverageScope: 'Currently enabled official source result set under the stated query semantics; experimental search does not prove mathematical completeness of the entire Bangumi database.',
      coverage,
      limitations: plan.limitations,
      ...(query.sort === 'heat'
        ? { heat: { key: 'heat' as const, source: 'official_v0' as const, operation: 'searchSubjects' as const, meaning: '收藏人数' as const } }
        : {}),
    };
  }

  private toItem(item: CandidateWithDetail, pageEvidence: FieldEvidence, _query: NormalizedDiscoveryQuery): DiscoveryItem {
    const detail = item.detail;
    const collection = collectionFor(item.candidate, detail);
    const name = detail?.name ?? item.candidate.name;
    const nameCn = detail?.nameCn || item.candidate.nameCn || undefined;
    const evidence = mergeEvidence(item.candidate, pageEvidence, item.detailResult, collection.formula);
    return {
      id: item.candidate.id,
      name,
      ...(nameCn === undefined ? {} : { nameCn }),
      displayName: nameCn || name,
      media: mediaForType(detail?.type ?? item.candidate.type),
      ...(categoryForPlatform(detail?.platform ?? item.candidate.platform) === undefined
        ? {}
        : { category: categoryForPlatform(detail?.platform ?? item.candidate.platform) }),
      ...(detail?.date ?? item.candidate.date
        ? { date: detail?.date ?? item.candidate.date }
        : {}),
      ...(numberFor(item.candidate, detail, 'score') === undefined
        ? {}
        : { score: numberFor(item.candidate, detail, 'score') }),
      ...(numberFor(item.candidate, detail, 'rank') === undefined
        ? {}
        : { rank: numberFor(item.candidate, detail, 'rank') }),
      ...(numberFor(item.candidate, detail, 'ratingCount') === undefined
        ? {}
        : { ratingCount: numberFor(item.candidate, detail, 'ratingCount') }),
      ...(collection.total === undefined ? {} : { collectionTotal: collection.total }),
      tags: [...item.candidate.tags],
      metaTags: [...item.candidate.metaTags],
      ...(imageFor(item.candidate, detail) === undefined ? {} : { image: imageFor(item.candidate, detail) }),
      ...(detail?.nsfw ?? item.candidate.nsfw) === undefined
        ? {}
        : { nsfw: detail?.nsfw ?? item.candidate.nsfw },
      evidence,
    };
  }
}
