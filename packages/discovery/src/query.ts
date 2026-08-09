import {
  DISCOVERY_CATEGORIES,
  DISCOVERY_SORTS,
  MEDIA_TYPES,
  type DateRange,
  type DiscoveryBudgetInput,
  type DiscoveryQuery,
  type ExecutionBudget,
  type NumericRange,
  type NormalizedDiscoveryQuery,
  type NsfwFilter,
  DiscoveryValidationError,
} from './contracts.js';

const DEFAULT_BUDGET: ExecutionBudget = {
  maxPages: 10,
  maxCandidates: 500,
  maxHydrations: 120,
  concurrency: 6,
  maxConceptProbes: 8,
  maxReturnedItems: 100,
};

const SEASON_MONTHS = {
  winter: [1, 4],
  spring: [4, 7],
  summer: [7, 10],
  autumn: [10, 1],
} as const;

function asStringArray(value: string | string[] | undefined, field: string, issues: string[]): string[] {
  if (value === undefined) return [];
  const values = Array.isArray(value) ? value : [value];
  const normalized = values.map((item) => item.trim()).filter(Boolean);
  if (normalized.some((item) => item.length > 120)) issues.push(`${field} values must be at most 120 characters`);
  return [...new Set(normalized)];
}

function asEnumArray<T extends string>(
  value: T | T[] | undefined,
  allowed: readonly T[],
  field: string,
  issues: string[],
): T[] {
  const values = value === undefined ? [] : Array.isArray(value) ? value : [value];
  const invalid = values.filter((item) => !allowed.includes(item));
  if (invalid.length > 0) issues.push(`${field} contains unsupported value(s): ${invalid.join(', ')}`);
  return [...new Set(values.filter((item) => allowed.includes(item)))];
}

function assertInteger(value: number | undefined, field: string, min: number, max: number, issues: string[]): void {
  if (value === undefined) return;
  if (!Number.isInteger(value) || value < min || value > max) {
    issues.push(`${field} must be an integer from ${min} to ${max}`);
  }
}

function normalizeRange(
  value: { min?: number; max?: number } | undefined,
  field: string,
  issues: string[],
): NumericRange | undefined {
  if (value === undefined) return undefined;
  const min = value.min;
  const max = value.max;
  if (min !== undefined && !Number.isFinite(min)) issues.push(`${field}.min must be finite`);
  if (max !== undefined && !Number.isFinite(max)) issues.push(`${field}.max must be finite`);
  if (min !== undefined && max !== undefined && min > max) issues.push(`${field}.min must not exceed ${field}.max`);
  if (min === undefined && max === undefined) issues.push(`${field} must contain min or max`);
  return { ...(min === undefined ? {} : { min }), ...(max === undefined ? {} : { max }) };
}

function isoDate(value: string | undefined, field: string, issues: string[]): string | undefined {
  if (value === undefined) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    issues.push(`${field} must use YYYY-MM-DD`);
    return undefined;
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    issues.push(`${field} is not a valid calendar date`);
    return undefined;
  }
  return value;
}

function dateRangeForYearMonth(year: number, month: number): DateRange {
  const from = `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-01`;
  const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  return {
    from,
    to: `${next.year.toString().padStart(4, '0')}-${next.month.toString().padStart(2, '0')}-01`,
  };
}

function dateRangeForSeason(value: string, issues: string[]): DateRange | undefined {
  const match = /^(\d{4})-(winter|spring|summer|autumn)$/u.exec(value);
  if (!match) {
    issues.push('season must use YYYY-winter|spring|summer|autumn');
    return undefined;
  }
  const year = Number(match[1]);
  const season = match[2] as keyof typeof SEASON_MONTHS;
  const [fromMonth, toMonth] = SEASON_MONTHS[season];
  const toYear = season === 'autumn' ? year + 1 : year;
  return {
    from: dateRangeForYearMonth(year, fromMonth).from,
    to: dateRangeForYearMonth(toYear, toMonth).from,
  };
}

function normalizeBudget(input: DiscoveryBudgetInput | undefined, issues: string[]): ExecutionBudget {
  const budget = { ...DEFAULT_BUDGET, ...(input ?? {}) };
  assertInteger(budget.maxPages, 'budget.maxPages', 1, 1000, issues);
  assertInteger(budget.maxCandidates, 'budget.maxCandidates', 1, 100_000, issues);
  assertInteger(budget.maxHydrations, 'budget.maxHydrations', 0, 10_000, issues);
  assertInteger(budget.concurrency, 'budget.concurrency', 1, 32, issues);
  assertInteger(budget.maxConceptProbes, 'budget.maxConceptProbes', 0, 100, issues);
  assertInteger(budget.maxReturnedItems, 'budget.maxReturnedItems', 1, 1000, issues);
  return budget;
}

function normalizeNsfw(value: DiscoveryQuery['nsfw'], issues: string[]): NsfwFilter {
  if (value === undefined || value === 'include' || value === true) return 'include';
  if (value === false || value === 'exclude') return 'exclude';
  if (value === 'only') return 'only';
  issues.push('nsfw must be include, exclude, only, true, or false');
  return 'include';
}

export const DEFAULT_EXECUTION_BUDGET = Object.freeze({ ...DEFAULT_BUDGET });

export function normalizeDiscoveryQuery(input: DiscoveryQuery = {}): NormalizedDiscoveryQuery {
  const issues: string[] = [];
  const keyword = input.keyword?.trim() ?? '';
  if (keyword.length > 200) issues.push('keyword must be at most 200 characters');

  const media = asEnumArray(input.media, MEDIA_TYPES, 'media', issues);
  const categories = asEnumArray(input.categories, DISCOVERY_CATEGORIES, 'categories', issues);
  if (categories.length > 0 && media.some((item) => item !== 'anime')) {
    issues.push('categories are only valid with media=anime');
  }

  assertInteger(input.year, 'year', 1900, 2200, issues);
  assertInteger(input.month, 'month', 1, 12, issues);
  const tags = asStringArray(input.tags, 'tags', issues);
  const metaTags = asStringArray(input.metaTags, 'metaTags', issues);
  const excludeMetaTags = asStringArray(input.excludeMetaTags, 'excludeMetaTags', issues);
  const concepts = asStringArray(input.concepts, 'concepts', issues);
  const overlap = metaTags.filter((tag) => excludeMetaTags.includes(tag));
  if (overlap.length > 0) issues.push(`metaTags and excludeMetaTags contradict for: ${overlap.join(', ')}`);

  const from = isoDate(input.from, 'from', issues);
  const to = isoDate(input.to, 'to', issues);
  if (from && to && from >= to) issues.push('from must be earlier than to');
  if ((from && !to) || (!from && to)) issues.push('from and to must be provided together');

  let dateRange: DateRange | undefined = from && to ? { from, to } : undefined;
  if (input.season !== undefined && input.month !== undefined) {
    issues.push('season and month cannot be combined');
  }
  if (input.season !== undefined && input.year !== undefined) {
    issues.push('season already contains a year and cannot be combined with year');
  }
  if (input.season !== undefined) {
    dateRange = dateRangeForSeason(input.season, issues);
    if (from || to) issues.push('season cannot be combined with from/to');
  } else if (input.month !== undefined && input.year !== undefined) {
    dateRange = dateRangeForYearMonth(input.year, input.month);
    if (from || to) issues.push('year/month cannot be combined with from/to');
  }

  const rating = normalizeRange(input.rating, 'rating', issues);
  const ratingCount = normalizeRange(input.ratingCount, 'ratingCount', issues);
  const rank = normalizeRange(input.rank, 'rank', issues);
  const collectionCount = normalizeRange(input.collectionCount, 'collectionCount', issues);
  const sort = input.sort ?? 'relevance';
  if (!DISCOVERY_SORTS.includes(sort)) issues.push(`sort must be one of: ${DISCOVERY_SORTS.join(', ')}`);
  const order = input.order ?? 'desc';
  if (order !== 'asc' && order !== 'desc') issues.push('order must be asc or desc');
  const resultMode = input.resultMode ?? 'top';
  if (resultMode !== 'top' && resultMode !== 'all') issues.push('resultMode must be top or all');
  const explain = input.explain ?? 'none';
  if (explain !== 'none' && explain !== 'compact' && explain !== 'full') issues.push('explain must be none, compact, or full');
  const limit = input.limit ?? 20;
  assertInteger(limit, 'limit', 1, 1000, issues);
  const budget = normalizeBudget(input.budget, issues);
  if (limit > budget.maxReturnedItems) issues.push('limit must not exceed budget.maxReturnedItems');

  const nsfw = normalizeNsfw(input.nsfw, issues);
  if (issues.length > 0) throw new DiscoveryValidationError(issues);
  return {
    keyword,
    media,
    categories,
    ...(input.year === undefined ? {} : { year: input.year }),
    ...(input.month === undefined ? {} : { month: input.month }),
    ...(dateRange === undefined ? {} : { dateRange }),
    tags,
    metaTags,
    excludeMetaTags,
    concepts,
    ...(rating === undefined ? {} : { rating }),
    ...(ratingCount === undefined ? {} : { ratingCount }),
    ...(rank === undefined ? {} : { rank }),
    ...(collectionCount === undefined ? {} : { collectionCount }),
    nsfw,
    sort: sort as NormalizedDiscoveryQuery['sort'],
    order: order as NormalizedDiscoveryQuery['order'],
    resultMode: resultMode as NormalizedDiscoveryQuery['resultMode'],
    limit,
    explain: explain as NormalizedDiscoveryQuery['explain'],
    budget,
  };
}

export function isNormalizedDiscoveryQuery(value: DiscoveryQuery | NormalizedDiscoveryQuery): value is NormalizedDiscoveryQuery {
  const candidate = value as Partial<NormalizedDiscoveryQuery>;
  return (
    Array.isArray(candidate.media) &&
    Array.isArray(candidate.categories) &&
    Array.isArray(candidate.tags) &&
    Array.isArray(candidate.metaTags) &&
    Array.isArray(candidate.excludeMetaTags) &&
    Array.isArray(candidate.concepts) &&
    typeof candidate.nsfw === 'string' &&
    typeof candidate.resultMode === 'string' &&
    typeof candidate.limit === 'number' &&
    typeof candidate.budget === 'object' &&
    candidate.budget !== null
  );
}
