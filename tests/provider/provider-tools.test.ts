import { describe, expect, it } from 'vitest';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import {
  ProviderRegistry,
  type ProviderSubjectData,
  type SubjectStatsData,
} from '@bangumi-agent-kit/provider-core';
import { createReadTools, type ToolDefinition } from '@bangumi-agent-kit/tools';

const subject: ProviderSubjectData = {
  id: 123,
  type: 2,
  name: 'Canonical title',
  nameCn: 'Canonical CN',
  summary: 'safe fixture',
  nsfw: false,
  locked: false,
  platform: 'TV',
  images: {},
  eps: 12,
  totalEpisodes: 12,
  stats: {
    score: 8.2,
    rank: 42,
    ratingTotal: 100,
    ratingHistogram: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 10, 9: 0, 10: 0 },
    collection: { wish: 1, collect: 2, doing: 3, onHold: 4, dropped: 5 },
  },
};

const stats: SubjectStatsData = subject.stats;

const legacySubject = {
  id: 123,
  type: 2,
  name: '少女終末旅行',
  name_cn: '少女终末旅行',
  summary: 'legacy semantic fixture',
  nsfw: false,
  locked: false,
  date: '2017-10-06',
  platform: 'TV',
  images: { medium: 'https://example.test/medium.png' },
  eps: 12,
  total_episodes: 12,
  rating: {
    score: 8.2,
    rank: 42,
    total: 100,
    count: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6': 0, '7': 0, '8': 10, '9': 0, '10': 0 },
  },
  collection: { wish: 1, collect: 2, doing: 3, on_hold: 4, dropped: 5 },
};

describe('PR-7B semantic tool provider seam', () => {
  it('SC01-SC04: freezes the old get_subject shape while keeping stats evidence-bearing', async () => {
    const registry = new ProviderRegistry({
      v0: {
        async getSubject() {
          return {
            state: 'ok' as const,
            data: subject,
            evidence: {
              name: [
                {
                  source: { class: 'official_v0' as const, provider: 'bangumi' },
                  retrievedAt: '2026-08-09T00:00:00Z',
                  fieldPath: 'name',
                },
              ],
            },
            retrievedAt: '2026-08-09T00:00:00Z',
          };
        },
        async getSubjectStats() {
          return {
            state: 'ok' as const,
            data: stats,
            evidence: {
              'rating.score': [
                {
                  source: { class: 'official_v0' as const, provider: 'bangumi' },
                  retrievedAt: '2026-08-09T00:00:00Z',
                  fieldPath: 'rating.score',
                },
              ],
            },
            retrievedAt: '2026-08-09T00:00:00Z',
          };
        },
      },
    });
    const tools = createReadTools(
      new HttpClient({
        fetchFn: async () =>
          new Response(JSON.stringify(legacySubject), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
      }),
    );
    const getSubject = tools.find((tool) => tool.name === 'bangumi.get_subject') as ToolDefinition;
    const getStats = tools.find(
      (tool) => tool.name === 'bangumi.get_subject_stats',
    ) as ToolDefinition;
    const context = { principalId: 'test', botInstanceId: 'test', conversationId: 'test' };

    const subjectResult = await getSubject?.execute({ subjectId: 123 }, context, {
      providerRegistry: registry,
    });
    const statsResult = await getStats?.execute({ subjectId: 123 }, context, {
      providerRegistry: registry,
    });

    expect(subjectResult).toEqual({
      id: 123,
      type: 'anime',
      name: '少女終末旅行',
      nameCn: '少女终末旅行',
      summary: 'legacy semantic fixture',
      nsfw: false,
      locked: false,
      date: '2017-10-06',
      platform: 'TV',
      images: { medium: 'https://example.test/medium.png' },
      score: 8.2,
      rank: 42,
      ratingTotal: 100,
      ratingCount: {
        '1': 0,
        '2': 0,
        '3': 0,
        '4': 0,
        '5': 0,
        '6': 0,
        '7': 0,
        '8': 10,
        '9': 0,
        '10': 0,
      },
      collectionCounts: { wish: 1, collect: 2, doing: 3, onHold: 4, dropped: 5 },
      eps: 12,
      totalEpisodes: 12,
    });
    expect(subjectResult).not.toHaveProperty('state');
    expect(subjectResult).not.toHaveProperty('data');
    expect(subjectResult).not.toHaveProperty('stats');
    expect(statsResult).toMatchObject({ state: 'ok', data: { score: 8.2 } });
    expect(
      (statsResult as { evidence: Record<string, unknown> }).evidence['rating.score'],
    ).toBeDefined();
  });
});
