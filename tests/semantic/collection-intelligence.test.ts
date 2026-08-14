import { describe, expect, it } from 'vitest';
import { GeneratedBangumiOpenApiClient } from '@bangumi-agent-kit/bangumi-openapi';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { createReadTools, type ToolDefinition } from '@bangumi-agent-kit/tools';

function clientWithOneCollection(fetchFn: typeof fetch): GeneratedBangumiOpenApiClient {
  return new GeneratedBangumiOpenApiClient(new HttpClient({ fetchFn }));
}

describe('bangumi.get_collection_intelligence', () => {
  it('is account-bound, scoped, capped, and returns the semantic result', async () => {
    const fetchFn: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          total: 1,
          limit: 50,
          offset: 0,
          data: [
            {
              subject_id: 10,
              type: 3,
              rate: 9,
              tags: ['favorite'],
              ep_status: 4,
              updated_at: '2026-08-14T00:00:00.000Z',
              subject: { type: 2, name: 'Original', name_cn: '中文' },
            },
          ],
        }),
        { status: 200 },
      );
    const tool = (createReadTools(new HttpClient({ fetchFn })) as unknown as ToolDefinition[]).find(
      (candidate) => candidate.name === 'bangumi.get_collection_intelligence',
    );
    expect(tool).toBeDefined();
    expect(tool?.auth).toBe('required');
    expect(tool?.scopes).toEqual(['read:collection']);
    expect(tool?.input.safeParse({ maxItems: 201 }).success).toBe(false);
    expect(tool?.input.safeParse({ username: 'other-user' }).success).toBe(false);

    const result = await tool!.execute(
      { maxItems: 1 },
      { principalId: 'principal-1', botInstanceId: 'bot', conversationId: 'conversation' },
      {
        executionSession: {
          account: { id: 'account-1', username: 'bound-user', nickname: 'Bound User' },
          client: clientWithOneCollection(fetchFn),
        },
      },
    );

    expect(result).toMatchObject({
      state: 'complete',
      coverage: { sourceTotal: 1, uniqueItems: 1 },
      data: { backlog: { doing: 1 }, progress: { completedEpisodes: 4 } },
    });
  });
});
