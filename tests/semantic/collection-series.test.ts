import { describe, expect, it } from 'vitest';
import { GeneratedBangumiOpenApiClient } from '@bangumi-agent-kit/bangumi-openapi';
import { HttpClient as OpenApiHttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { createReadTools, type ToolDefinition } from '@bangumi-agent-kit/tools';

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('bangumi.get_collection_series_groups', () => {
  it('is private, bounded, discoverable, and returns direct relation groups', async () => {
    const fetchFn: typeof fetch = async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/collections')) {
        return response({
          total: 2,
          limit: 50,
          offset: 0,
          data: [
            {
              subject_id: 10,
              subject_type: 2,
              type: 3,
              comment: 'private comment',
              subject: { id: 10, type: 2, name: 'One', name_cn: '第一部' },
            },
            {
              subject_id: 11,
              subject_type: 2,
              type: 3,
              subject: { id: 11, type: 2, name: 'Two', name_cn: '第二部' },
            },
          ],
        });
      }
      const subjectId = Number(url.pathname.split('/').at(-2));
      return response(
        subjectId === 10
          ? [
              {
                id: 11,
                type: 2,
                name: 'Two',
                name_cn: '第二部',
                relation: '续集',
              },
            ]
          : [],
      );
    };
    const publicClient = new OpenApiHttpClient({ fetchFn });
    const tool = (createReadTools(publicClient) as unknown as ToolDefinition[]).find(
      (candidate) => candidate.name === 'bangumi.get_collection_series_groups',
    );

    expect(tool).toBeDefined();
    expect(tool?.auth).toBe('required');
    expect(tool?.scopes).toEqual(['read:collection']);
    expect(tool?.input.safeParse({ username: 'other-user' }).success).toBe(false);
    expect(tool?.input.safeParse({ maxRelationSubjects: 37 }).success).toBe(false);
    expect(tool?.input.safeParse({ maxEdges: 145 }).success).toBe(false);
    expect(tool?.input.safeParse({ extra: true }).success).toBe(false);

    const result = await tool!.execute(
      { maxItems: 2, maxRelationSubjects: 2, maxEdges: 4 },
      { principalId: 'principal', botInstanceId: 'bot', conversationId: 'conversation' },
      {
        publicHttpClient: publicClient,
        executionSession: {
          account: { id: 'account', username: 'bound-user', nickname: 'Bound User' },
          client: new GeneratedBangumiOpenApiClient(new OpenApiHttpClient({ fetchFn })),
        },
      },
    );

    expect(result).toMatchObject({
      state: 'complete',
      groups: [
        {
          items: [{ subjectId: 10 }, { subjectId: 11 }],
          edges: [{ relation: '续集' }],
        },
      ],
      coverage: {
        collection: { requestedMaxItems: 2 },
        relations: { requestedSubjects: 2 },
      },
    });
    expect(JSON.stringify(result)).not.toContain('private comment');
  });
});
