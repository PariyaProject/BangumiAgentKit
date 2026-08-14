import { describe, expect, it } from 'vitest';
import { GeneratedBangumiOpenApiClient } from '@bangumi-agent-kit/bangumi-openapi';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { createReadTools, type ToolDefinition } from '@bangumi-agent-kit/tools';

const weekdays = [
  ['Mon', '星期一', '月曜日'],
  ['Tue', '星期二', '火曜日'],
  ['Wed', '星期三', '水曜日'],
  ['Thu', '星期四', '木曜日'],
  ['Fri', '星期五', '金曜日'],
  ['Sat', '星期六', '土曜日'],
  ['Sun', '星期日', '日曜日'],
] as const;

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function buildCalendar(): Array<Record<string, unknown>> {
  return weekdays.map(([en, cn, ja], index) => ({
    weekday: { en, cn, ja, id: index + 1 },
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

function buildAuthenticatedClient(fetchFn: typeof fetch): GeneratedBangumiOpenApiClient {
  return new GeneratedBangumiOpenApiClient(new HttpClient({ fetchFn }));
}

describe('bangumi.get_collection_schedule', () => {
  it('is account-bound, scoped, capped, and joins using the bound account only', async () => {
    const fetchFn: typeof fetch = async (input) => {
      const url = new URL(String(input));
      if (url.pathname === '/calendar') return response(buildCalendar());
      expect(url.pathname).toBe('/v0/users/bound-user/collections');
      expect(url.searchParams.get('subject_type')).toBe('2');
      return response({
        total: 1,
        limit: 50,
        offset: 0,
        data: [
          {
            subject_id: 10,
            subject_type: 2,
            type: 3,
            ep_status: 4,
            comment: 'private comment',
            subject: {
              id: 10,
              type: 2,
              name: 'Original',
              name_cn: '中文条目',
              date: '2026-08-10',
              eps: 12,
            },
          },
        ],
      });
    };
    const publicClient = new HttpClient({ fetchFn });
    const tool = (createReadTools(publicClient) as unknown as ToolDefinition[]).find(
      (candidate) => candidate.name === 'bangumi.get_collection_schedule',
    );

    expect(tool).toBeDefined();
    expect(tool?.auth).toBe('required');
    expect(tool?.scopes).toEqual(['read:collection']);
    expect(tool?.input.safeParse({ maxCollectionItems: 201 }).success).toBe(false);
    expect(tool?.input.safeParse({ maxRows: 101 }).success).toBe(false);
    expect(tool?.input.safeParse({ username: 'other-user' }).success).toBe(false);
    expect(tool?.input.safeParse({ statuses: [] }).success).toBe(false);

    const result = await tool!.execute(
      { maxCollectionItems: 1, maxRows: 1, statuses: ['doing'] },
      { principalId: 'principal-1', botInstanceId: 'bot', conversationId: 'conversation' },
      {
        publicHttpClient: publicClient,
        executionSession: {
          account: { id: 'account-1', username: 'bound-user', nickname: 'Bound User' },
          client: buildAuthenticatedClient(fetchFn),
        },
      },
    );

    expect(result).toMatchObject({
      state: 'complete',
      filters: { statuses: ['doing'] },
      data: {
        items: [
          {
            subjectId: 10,
            status: 'doing',
            progress: { watchedEpisodes: 4, reportedRemainingEpisodes: 8 },
          },
        ],
      },
      source: { collection: { authScope: 'account' } },
    });
    expect(JSON.stringify(result)).not.toContain('private comment');
  });
});
