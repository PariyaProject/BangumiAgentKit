export const DISCOVERY_SCENARIOS = {
  G02: {
    query: {
      media: 'anime',
      from: '2024-01-01',
      to: '2025-01-01',
      concepts: ['异世界'],
      sort: 'heat',
      order: 'desc',
      resultMode: 'top',
      limit: 10,
      explain: 'full',
    },
    dateFrom: '2024-01-01',
    dateTo: '2025-01-01',
  },
  G03: {
    query: {
      media: 'anime',
      from: '2021-10-03',
      to: '2026-10-03',
      concepts: ['原创'],
      rating: { min: 8 },
      ratingCount: { min: 5001 },
      sort: 'score',
      order: 'desc',
      resultMode: 'top',
      limit: 10,
      explain: 'full',
    },
    dateFrom: '2021-10-03',
    dateTo: '2026-10-03',
  },
  G14: {
    query: {
      media: 'anime',
      season: '2026-spring',
      categories: 'tv',
      concepts: ['原创'],
      sort: 'score',
      order: 'desc',
      tieBreak: { field: 'ratingCount', order: 'desc' },
      resultMode: 'top',
      limit: 10,
      explain: 'full',
    },
    dateFrom: '2026-04-01',
    dateTo: '2026-07-01',
  },
  A05: {
    query: {
      media: 'anime',
      rating: { min: 8 },
      collectionCompletionRate: { max: 0.4 },
      sort: 'score',
      order: 'desc',
      resultMode: 'top',
      limit: 8,
      explain: 'full',
    },
  },
  G26: {
    query: {
      media: 'anime',
      from: '2019-01-01',
      to: '2025-01-01',
      ratingCount: { min: 10001 },
      tags: ['女性向'],
      categories: 'tv',
      resultMode: 'all',
      limit: 100,
      explain: 'full',
    },
    dateFrom: '2019-01-01',
    dateTo: '2025-01-01',
    exactTag: '女性向',
  },
} as const;

export type DiscoveryScenarioId = keyof typeof DISCOVERY_SCENARIOS;

export interface DiscoveryScenarioItem {
  id: number;
  media?: string;
  category?: string;
  date?: string;
  score?: number;
  ratingCount?: number;
  collectionTotal?: number;
  collectionCompletionRate?: number;
  conceptMatched?: boolean;
  exactTagMatched?: boolean;
}

export function summarizeDiscoveryScenarioItems(
  scenario: DiscoveryScenarioId,
  value: unknown,
): DiscoveryScenarioItem[] {
  if (!Array.isArray(value)) return [];
  const concept = scenario === 'G02' ? '异世界' : '原创';
  const conceptField = scenario === 'G02' ? 'tags' : 'metaTags';
  const exactTag = scenario === 'G26' ? DISCOVERY_SCENARIOS.G26.exactTag : undefined;
  return value.flatMap((item) => {
    if (
      !item ||
      typeof item !== 'object' ||
      !Number.isSafeInteger((item as Record<string, unknown>).id)
    ) {
      return [];
    }
    const source = item as Record<string, unknown>;
    return [
      {
        id: source.id as number,
        ...(typeof source.media === 'string' ? { media: source.media } : {}),
        ...(typeof source.category === 'string' ? { category: source.category } : {}),
        ...(typeof source.date === 'string' ? { date: source.date } : {}),
        ...(typeof source.score === 'number' && Number.isFinite(source.score)
          ? { score: source.score }
          : {}),
        ...(typeof source.ratingCount === 'number' && Number.isFinite(source.ratingCount)
          ? { ratingCount: source.ratingCount }
          : {}),
        ...(scenario === 'G02' &&
        typeof source.collectionTotal === 'number' &&
        Number.isFinite(source.collectionTotal)
          ? { collectionTotal: source.collectionTotal }
          : {}),
        ...(scenario === 'A05' &&
        typeof source.collectionCompletionRate === 'number' &&
        Number.isFinite(source.collectionCompletionRate)
          ? { collectionCompletionRate: source.collectionCompletionRate }
          : {}),
        ...(scenario === 'G26'
          ? {
              exactTagMatched:
                Array.isArray(source.tags) && (source.tags as unknown[]).includes(exactTag),
            }
          : scenario === 'A05'
            ? {}
            : {
              conceptMatched:
                Array.isArray(source[conceptField]) &&
                (source[conceptField] as unknown[]).includes(concept),
            }),
      },
    ];
  });
}

export function validateDiscoveryScenarioItems(
  scenario: DiscoveryScenarioId,
  items: readonly DiscoveryScenarioItem[],
): Record<string, boolean> {
  if (scenario === 'A05') {
    const query = DISCOVERY_SCENARIOS.A05.query;
    const rating = query.rating as { min?: number; max?: number };
    const completionRate = query.collectionCompletionRate as { min?: number; max?: number };
    return {
      nonEmpty: items.length > 0,
      uniqueIds: new Set(items.map((item) => item.id)).size === items.length,
      mediaType: items.length > 0 && items.every((item) => item.media === 'anime'),
      scoreThreshold:
        items.length > 0 && items.every((item) => typeof item.score === 'number' && item.score >= 8),
      collectionCompletionRateAvailable:
        items.length > 0 &&
        items.every(
          (item) =>
            typeof item.collectionCompletionRate === 'number' &&
            Number.isFinite(item.collectionCompletionRate) &&
            item.collectionCompletionRate >= 0 &&
            item.collectionCompletionRate <= 1,
        ),
      collectionCompletionRateThreshold:
        items.length > 0 &&
        items.every(
          (item) =>
            typeof item.collectionCompletionRate === 'number' &&
            item.collectionCompletionRate <= 0.4,
        ),
      explicitThresholds:
        query.media === 'anime' &&
        rating.min === 8 &&
        rating.max === undefined &&
        completionRate.min === undefined &&
        completionRate.max === 0.4 &&
        query.sort === 'score' &&
        query.order === 'desc' &&
        query.limit === 8 &&
        query.resultMode === 'top' &&
        query.explain === 'full' &&
        !Object.prototype.hasOwnProperty.call(query, 'budget'),
      scoreDescending:
        items.length > 0 &&
        items.slice(1).every((item, index) => {
          const previous = items[index];
          return previous?.score !== undefined && item.score !== undefined && previous.score >= item.score;
        }),
    };
  }
  const selected = DISCOVERY_SCENARIOS[scenario];
  const uniqueIds = new Set(items.map((item) => item.id)).size === items.length;
  const mediaType = items.length > 0 && items.every((item) => item.media === 'anime');
  const dateWindow =
    items.length > 0 &&
    items.every(
      (item) =>
        typeof item.date === 'string' &&
        item.date >= selected.dateFrom &&
        item.date < selected.dateTo,
    );
  const exactFacetMatch =
    items.length > 0 &&
    items.every((item) =>
      scenario === 'G26' ? item.exactTagMatched === true : item.conceptMatched === true,
    );
  const checks: Record<string, boolean> = {
    nonEmpty: items.length > 0,
    uniqueIds,
    mediaType,
    dateWindow,
    ...(scenario === 'G26'
      ? { exactTagMatch: exactFacetMatch }
      : { exactConceptMatch: exactFacetMatch }),
  };

  if (scenario === 'G26') {
    const query = DISCOVERY_SCENARIOS.G26.query;
    checks.exactQueryScope =
      query.media === 'anime' &&
      query.from === '2019-01-01' &&
      query.to === '2025-01-01' &&
      query.ratingCount.min === 10001 &&
      query.tags.length === 1 &&
      query.tags[0] === DISCOVERY_SCENARIOS.G26.exactTag &&
      query.categories === 'tv' &&
      query.resultMode === 'all' &&
      query.limit === 100 &&
      !('metaTags' in query) &&
      !('concepts' in query);
    checks.strictRatingCountThreshold =
      items.length > 0 &&
      items.every((item) => typeof item.ratingCount === 'number' && item.ratingCount >= 10001);
    checks.tvCategory = items.length > 0 && items.every((item) => item.category === 'tv');
    return checks;
  }

  if (scenario === 'G02') {
    checks.heatSortRequested =
      DISCOVERY_SCENARIOS.G02.query.sort === 'heat' &&
      DISCOVERY_SCENARIOS.G02.query.order === 'desc';
    checks.heatOrderDescending =
      items.length > 0 &&
      items.every(
        (item) =>
          typeof item.collectionTotal === 'number' &&
          Number.isFinite(item.collectionTotal) &&
          item.collectionTotal >= 0,
      ) &&
      items.slice(1).every((item, index) => {
        const previous = items[index];
        return (
          previous?.collectionTotal !== undefined &&
          item.collectionTotal !== undefined &&
          previous.collectionTotal >= item.collectionTotal
        );
      });
    return checks;
  }

  checks.scoreAndRatingAvailable =
    items.length > 0 &&
    items.every((item) => typeof item.score === 'number' && typeof item.ratingCount === 'number');

  if (scenario === 'G03') {
    checks.ratingThresholds =
      items.length > 0 &&
      items.every(
        (item) =>
          (item.score ?? Number.NEGATIVE_INFINITY) >= 8 &&
          (item.ratingCount ?? Number.NEGATIVE_INFINITY) >= 5001,
      );
    checks.scoreDescending =
      items.length > 0 &&
      items.slice(1).every((item, index) => {
        const previous = items[index];
        return (
          previous?.score !== undefined && item.score !== undefined && previous.score >= item.score
        );
      });
    return checks;
  }

  checks.ratingCountTieBreakRequested =
    DISCOVERY_SCENARIOS.G14.query.tieBreak.field === 'ratingCount' &&
    DISCOVERY_SCENARIOS.G14.query.tieBreak.order === 'desc';
  checks.tvCategory = items.length > 0 && items.every((item) => item.category === 'tv');
  checks.scoreThenRatingOrder =
    items.length > 0 &&
    items.slice(1).every((item, index) => {
      const previous = items[index];
      if (
        !previous ||
        previous.score === undefined ||
        item.score === undefined ||
        previous.ratingCount === undefined ||
        item.ratingCount === undefined
      )
        return false;
      return (
        previous.score > item.score ||
        (previous.score === item.score && previous.ratingCount >= item.ratingCount)
      );
    });
  return checks;
}

export function selectDiscoveryScenario(args: readonly string[]): DiscoveryScenarioId {
  const indices = args.flatMap((arg, index) => (arg === '--scenario' ? [index] : []));
  const flagIndex = indices[0];
  if (indices.length !== 1 || flagIndex === undefined) {
    throw new Error(
      'Pass exactly one --scenario <scenario-id> to prevent running other scenarios.',
    );
  }
  const value = args[flagIndex + 1];
  if (!value || value.startsWith('--')) {
    throw new Error('Pass one scenario ID after --scenario.');
  }
  if (!Object.prototype.hasOwnProperty.call(DISCOVERY_SCENARIOS, value)) {
    throw new Error(`Unknown discovery scenario: ${value}`);
  }
  return value as DiscoveryScenarioId;
}
