import { describe, expect, it } from 'vitest';
import { GeneratedBangumiOpenApiClient } from '@bangumi-agent-kit/bangumi-openapi';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { createReadTools, type ToolDefinition } from '@bangumi-agent-kit/tools';

function collectionRow(): Record<string, unknown> {
  return {
    subject_id: 10,
    subject_type: 2,
    type: 3,
    rate: 9,
    comment: 'private comment',
    tags: ['favorite'],
    ep_status: 1,
    vol_status: 0,
    updated_at: '2026-08-14T00:00:00.000Z',
    private: true,
    subject: {
      id: 10,
      type: 2,
      name: 'Original',
      name_cn: '中文',
      short_summary: '',
      eps: 2,
      volumes: 0,
      collection_total: 10,
      score: 8,
      rank: 100,
      tags: [],
      images: {},
    },
  };
}

describe('bangumi.get_collection_backlog', () => {
  it('is account-bound, scoped, bounded, and preserves official progress semantics', async () => {
    const requests: URL[] = [];
    const fetchFn: typeof fetch = async (input) => {
      const url = new URL(String(input));
      requests.push(url);
      if (url.pathname.endsWith('/collections')) {
        return new Response(
          JSON.stringify({ total: 1, limit: 50, offset: 0, data: [collectionRow()] }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          total: 2,
          limit: 100,
          offset: 0,
          data: [
            {
              type: 2,
              updated_at: 1_723_600_000,
              episode: {
                id: 100,
                subject_id: 10,
                type: 0,
                name: 'Episode',
                name_cn: '第一集',
                sort: 1,
                ep: 1,
                airdate: '2026-01-01',
              },
            },
            {
              type: 1,
              updated_at: 1_723_600_000,
              episode: {
                id: 101,
                subject_id: 10,
                type: 0,
                name: 'Episode 2',
                name_cn: '第二集',
                sort: 2,
                ep: 2,
                airdate: '2026-01-02',
              },
            },
          ],
        }),
        { status: 200 },
      );
    };
    const tool = (createReadTools(new HttpClient({ fetchFn })) as unknown as ToolDefinition[]).find(
      (candidate) => candidate.name === 'bangumi.get_collection_backlog',
    );

    expect(tool).toBeDefined();
    expect(tool?.auth).toBe('required');
    expect(tool?.scopes).toEqual(['read:collection']);
    expect(tool?.input.safeParse({ username: 'other-user' }).success).toBe(false);
    expect(tool?.input.safeParse({ maxSubjects: 31 }).success).toBe(false);
    expect(tool?.input.safeParse({ statuses: [] }).success).toBe(false);

    const result = await tool!.execute(
      { maxItems: 1, maxSubjects: 1, maxEpisodesPerSubject: 2 },
      { principalId: 'principal-1', botInstanceId: 'bot', conversationId: 'conversation' },
      {
        executionSession: {
          account: { id: 'account-1', username: 'bound-user', nickname: 'Bound User' },
          client: new GeneratedBangumiOpenApiClient(new HttpClient({ fetchFn })),
        },
      },
    );

    expect(result).toMatchObject({
      state: 'complete',
      coverage: { collection: { sourceTotal: 1 }, hydration: { succeededSubjects: 1 } },
      data: { summary: { knownRemainingEpisodes: 1 } },
    });
    expect(JSON.stringify(result)).not.toContain('private comment');
    expect(requests.some((url) => url.searchParams.get('episode_type') === '0')).toBe(true);
  });
});
