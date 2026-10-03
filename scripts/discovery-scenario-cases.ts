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
} as const;

export type DiscoveryScenarioId = keyof typeof DISCOVERY_SCENARIOS;

export interface DiscoveryScenarioItem {
  id: number;
  media?: string;
  category?: string;
  date?: string;
  score?: number;
  ratingCount?: number;
  conceptMatched?: boolean;
}

export function summarizeDiscoveryScenarioItems(
  scenario: DiscoveryScenarioId,
  value: unknown,
): DiscoveryScenarioItem[] {
  if (!Array.isArray(value)) return [];
  const concept = scenario === 'G02' ? '异世界' : '原创';
  const conceptField = scenario === 'G02' ? 'tags' : 'metaTags';
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
        conceptMatched:
          Array.isArray(source[conceptField]) &&
          (source[conceptField] as unknown[]).includes(concept),
      },
    ];
  });
}

export function validateDiscoveryScenarioItems(
  scenario: DiscoveryScenarioId,
  items: readonly DiscoveryScenarioItem[],
): Record<string, boolean> {
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
  const exactConceptMatch = items.length > 0 && items.every((item) => item.conceptMatched === true);
  const checks: Record<string, boolean> = {
    nonEmpty: items.length > 0,
    uniqueIds,
    mediaType,
    dateWindow,
    exactConceptMatch,
  };

  if (scenario === 'G02') {
    checks.heatSortRequested = selected.query.sort === 'heat' && selected.query.order === 'desc';
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
