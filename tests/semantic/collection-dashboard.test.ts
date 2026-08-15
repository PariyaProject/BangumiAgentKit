import { describe, expect, it } from 'vitest';
import { GeneratedBangumiOpenApiClient } from '@bangumi-agent-kit/bangumi-openapi';
import {
  HttpClient,
  HttpClient as TransportHttpClient,
} from '@bangumi-agent-kit/bangumi-transport';
import { createReadTools, type ToolDefinition } from '@bangumi-agent-kit/tools';

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function calendar(): Array<Record<string, unknown>> {
  return Array.from({ length: 7 }, (_, index) => ({
    weekday: { id: index + 1, en: `Day${index + 1}`, cn: `星期${index + 1}`, ja: `日${index + 1}` },
    items:
      index === 0
        ? [
            {
              id: 10,
              type: 2,
              name: 'Original',
              name_cn: '中文条目',
              air_date: '2026-08-10',
              air_weekday: 1,
            },
          ]
        : [],
  }));
}

describe('bangumi.get_collection_dashboard', () => {
  it('is account-bound, preserves the shared status filter, and exposes bounded sections', async () => {
    const fetchFn: typeof fetch = async (input) => {
      const url = new URL(String(input));
      if (url.pathname === '/calendar') return response(calendar());
      if (url.pathname.endsWith('/episodes')) {
        return response({
          total: 1,
          limit: 100,
          offset: 0,
          data: [
            {
              type: 2,
              episode: {
                id: 1,
                subject_id: 10,
                type: 0,
                name: 'Episode',
                name_cn: '第一集',
                sort: 1,
                ep: 1,
                airdate: '2026-01-01',
              },
            },
          ],
        });
      }
      return response({
        total: 1,
        limit: 50,
        offset: 0,
        data: [
          {
            subject_id: 10,
            subject_type: 2,
            type: 3,
            rate: 8,
            ep_status: 1,
            tags: ['tag'],
            updated_at: '2026-08-14T00:00:00.000Z',
            comment: 'private comment',
            subject: {
              id: 10,
              type: 2,
              name: 'Original',
              name_cn: '中文条目',
              date: '2026-08-10',
              eps: 1,
            },
          },
        ],
      });
    };
    const publicClient = new TransportHttpClient({ fetchFn });
    const tool = (createReadTools(publicClient) as unknown as ToolDefinition[]).find(
      (candidate) => candidate.name === 'bangumi.get_collection_dashboard',
    );

    expect(tool).toBeDefined();
    expect(tool?.auth).toBe('required');
    expect(tool?.scopes).toEqual(['read:collection']);
    expect(tool?.input.safeParse({ username: 'other-user' }).success).toBe(false);
    expect(tool?.input.safeParse({ maxCollectionItems: 101 }).success).toBe(false);
    expect(tool?.input.safeParse({ statuses: [] }).success).toBe(false);

    const result = await tool!.execute(
      {
        maxCollectionItems: 1,
        maxSubjects: 1,
        maxEpisodesPerSubject: 1,
        maxRows: 1,
        statuses: ['doing'],
      },
      { principalId: 'principal', botInstanceId: 'bot', conversationId: 'conversation' },
      {
        publicHttpClient: publicClient,
        executionSession: {
          account: { id: 'account', username: 'bound-user', nickname: 'Bound User' },
          client: new GeneratedBangumiOpenApiClient(new HttpClient({ fetchFn })),
        },
      },
    );

    expect(result).toMatchObject({
      state: 'complete',
      coverage: { sectionsSucceeded: 3, collectionRowsRequested: 3 },
      data: {
        sections: {
          intelligence: { state: 'complete' },
          backlog: { state: 'complete' },
          schedule: { state: 'complete' },
        },
      },
    });
    expect(JSON.stringify(result)).not.toContain('private comment');
  });
});
