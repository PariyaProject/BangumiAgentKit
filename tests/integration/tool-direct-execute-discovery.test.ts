import { describe, expect, it, vi } from 'vitest';
import { ProviderRegistry } from '@bangumi-agent-kit/provider-core';
import {
  createDiscoveryTools,
  discoveryQueryInput,
  renderQuerySubjectsInput,
} from '@bangumi-agent-kit/tools';

const context = {
  principalId: 'direct-execute-fixture',
  botInstanceId: 'test-bot',
  conversationId: 'test-conversation',
};

function createFixtureProvider() {
  const subject = {
    id: 1,
    type: 2,
    name: 'Fixture Anime',
    nameCn: '测试动画',
    date: '2026-07-01',
    platform: 'TV',
    summary: '固定夹具条目',
    nsfw: false,
    locked: false,
    images: {},
    eps: 12,
    totalEpisodes: 12,
    tags: ['后宫'],
    metaTags: ['原创'],
    stats: {
      score: 8.5,
      rank: 12,
      ratingTotal: 1200,
      ratingHistogram: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 600, 9: 600, 10: 0 },
      collection: { wish: 10, collect: 500, doing: 20, onHold: 5, dropped: 2 },
    },
  };
  const page = {
    state: 'ok' as const,
    data: {
      items: [
        {
          id: subject.id,
          type: subject.type,
          name: subject.name,
          nameCn: subject.nameCn,
          date: subject.date,
          platform: subject.platform,
          score: subject.stats.score,
          rank: subject.stats.rank,
          ratingCount: subject.stats.ratingTotal,
          collection: { collect: subject.stats.collection.collect },
          tags: subject.tags,
          metaTags: subject.metaTags,
        },
      ],
      total: 1,
      totalKind: 'estimated' as const,
      limit: 20,
      offset: 0,
    },
    evidence: {},
  };
  return {
    getSubject: vi.fn(async () => ({ state: 'ok' as const, data: subject, evidence: {} })),
    getSubjectStats: vi.fn(async () => ({
      state: 'ok' as const,
      data: subject.stats,
      evidence: {},
    })),
    searchSubjects: vi.fn(async () => page),
    browseSubjects: vi.fn(async () => ({
      ...page,
      data: { ...page.data, totalKind: 'exact' as const },
    })),
  };
}

describe('direct execute coverage for discovery tools', () => {
  it('accepts reported episode count only on the discovery query tool', () => {
    expect(discoveryQueryInput.parse({ reportedEpisodeCount: { max: 12 } })).toMatchObject({
      reportedEpisodeCount: { max: 12 },
    });
    expect(discoveryQueryInput.safeParse({ reportedEpisodeCount: { min: -1 } }).success).toBe(
      false,
    );
    expect(discoveryQueryInput.safeParse({ reportedEpisodeCount: { max: 12.5 } }).success).toBe(
      false,
    );
    expect(renderQuerySubjectsInput.safeParse({ reportedEpisodeCount: { max: 12 } }).success).toBe(
      false,
    );
  });

  it('accepts current season through the discovery tool and sends the resolved D05 request', async () => {
    expect(discoveryQueryInput.parse({ season: 'current' })).toMatchObject({ season: 'current' });
    expect(discoveryQueryInput.safeParse({ season: 'this-season' }).success).toBe(false);
    expect(renderQuerySubjectsInput.parse({ season: '2026-autumn' })).toMatchObject({
      season: '2026-autumn',
    });
    expect(renderQuerySubjectsInput.safeParse({ season: 'current' }).success).toBe(true);
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-10-07T15:00:00.000Z'));
      const provider = createFixtureProvider();
      const providerRegistry = new ProviderRegistry({ v0: provider as never });
      const querySubjects = createDiscoveryTools().find(
        (tool) => tool.name === 'bangumi.query_subjects',
      )!;
      const result = await (querySubjects.execute as any)(
        {
          media: 'anime',
          season: 'current',
          tags: ['校园', '恋爱'],
          sort: 'heat',
          limit: 12,
          explain: 'compact',
        },
        context,
        { providerRegistry },
      );

      expect(result.plan).toMatchObject({
        season: '2026-autumn',
        sort: 'heat',
        order: 'desc',
      });
      const cohort = await (
        createDiscoveryTools().find((tool) => tool.name === 'bangumi.compare_subject_cohorts')!
          .execute as any
      )(
        {
          cohorts: [
            {
              label: '当前季度',
              query: { media: 'anime', season: 'current', resultMode: 'all' },
            },
          ],
          maxSubjects: 1,
        },
        context,
        { providerRegistry },
      );
      expect(cohort.cohorts[0].querySummary).toContain('季度=2026-autumn');
      expect(cohort.cohorts[0].querySummary).not.toContain('季度=current');
      expect(provider.searchSubjects).toHaveBeenCalledWith(
        expect.objectContaining({
          sort: 'heat',
          filter: expect.objectContaining({
            type: [2],
            tag: ['校园', '恋爱'],
            airDate: ['>=2026-10-01', '<2027-01-01'],
          }),
        }),
        expect.anything(),
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it('executes query, cohort comparison, aggregation, and concept resolution through the tool seam', async () => {
    const provider = createFixtureProvider();
    const providerRegistry = new ProviderRegistry({ v0: provider as never });
    const tools = new Map(createDiscoveryTools().map((tool) => [tool.name, tool]));

    const queryResult = await (tools.get('bangumi.query_subjects')!.execute as any)(
      { media: 'anime', year: 2026, month: 7, limit: 1, explain: 'compact' },
      context,
      { providerRegistry },
    );
    expect(queryResult).toMatchObject({ state: 'ok', items: [{ id: 1, nameCn: '测试动画' }] });

    const tieBreakResult = await (tools.get('bangumi.query_subjects')!.execute as any)(
      {
        media: 'anime',
        sort: 'score',
        tieBreak: { field: 'ratingCount' },
        limit: 1,
        explain: 'full',
      },
      context,
      { providerRegistry },
    );
    expect(tieBreakResult.plan).toMatchObject({
      sort: 'score',
      tieBreak: { field: 'ratingCount', order: 'desc' },
    });
    expect(tieBreakResult.explanation?.tieBreak).toEqual({ field: 'ratingCount', order: 'desc' });

    const comparisonResult = await (tools.get('bangumi.compare_subject_cohorts')!.execute as any)(
      {
        cohorts: [{ label: 'July', query: { media: 'anime', resultMode: 'all' } }],
        maxSubjects: 1,
      },
      context,
      { providerRegistry },
    );
    expect(comparisonResult).toMatchObject({
      state: 'complete',
      cohorts: [{ subjects: [{ id: 1 }] }],
    });

    const aggregationResult = await (tools.get('bangumi.aggregate_subject_cohort')!.execute as any)(
      { cohort: { label: 'July', query: { media: 'anime', resultMode: 'all' } }, maxSubjects: 1 },
      context,
      { providerRegistry },
    );
    expect(aggregationResult).toMatchObject({
      state: 'complete',
      cohorts: [{ subjects: [{ id: 1 }] }],
    });

    const conceptResult = await (tools.get('bangumi.resolve_subject_concept')!.execute as any)(
      { concept: '原创' },
      context,
      {},
    );
    expect(conceptResult).toMatchObject({ state: 'exact', input: '原创' });
    expect(provider.searchSubjects).toHaveBeenCalled();
    expect(provider.getSubject).toHaveBeenCalled();
  });
});
