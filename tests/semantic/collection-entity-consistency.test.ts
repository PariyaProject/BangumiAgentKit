import { describe, expect, it } from 'vitest';
import { GeneratedBangumiOpenApiClient } from '@bangumi-agent-kit/bangumi-openapi';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { createReadTools, type ToolDefinition } from '@bangumi-agent-kit/tools';

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const context = {
  principalId: 'consistency-reader',
  botInstanceId: 'bot',
  conversationId: 'conversation',
};

function findTool(client: HttpClient): ToolDefinition {
  const tool = createReadTools(client).find(
    (candidate) => candidate.name === 'bangumi.get_collection_entity_consistency',
  );
  if (!tool) throw new Error('collection entity consistency tool was not registered');
  return tool;
}

describe('bangumi.get_collection_entity_consistency', () => {
  it('uses the bound account, preserves evidence kinds, and exposes bounded input only', async () => {
    const requests: Array<{ url: URL; authorization: string | null }> = [];
    const fetchFn: typeof fetch = async (input, init) => {
      const url = new URL(String(input));
      requests.push({ url, authorization: new Headers(init?.headers).get('authorization') });
      if (url.pathname.endsWith('/collections/-/characters')) {
        return json({
          total: 1,
          limit: 0,
          offset: 0,
          data: [{ id: 10, name: '收藏角色', type: 1, created_at: '2026-01-01T00:00:00Z' }],
        });
      }
      if (url.pathname.endsWith('/collections/-/persons')) {
        return json({
          total: 1,
          limit: 0,
          offset: 0,
          data: [
            {
              id: 20,
              name: '收藏人物',
              type: 1,
              career: ['声优'],
              created_at: '2026-01-01T00:00:00Z',
            },
          ],
        });
      }
      if (url.pathname.endsWith('/collections')) {
        return json({
          total: 1,
          limit: 50,
          offset: 0,
          data: [
            {
              subject_id: 100,
              subject_type: 2,
              type: 2,
              comment: 'private comment must not appear in semantic output',
              tags: ['private-tag'],
              subject: { id: 100, type: 2, name: 'Subject', name_cn: '条目' },
            },
          ],
        });
      }
      if (url.pathname.endsWith('/subjects/100/characters')) {
        return json([
          {
            id: 10,
            name: '角色',
            type: 1,
            summary: 'summary',
            relation: '主角',
            actors: [{ id: 20, name: '人物', career: ['声优'] }],
          },
        ]);
      }
      if (url.pathname.endsWith('/subjects/100/persons')) {
        return json([
          { id: 20, name: '人物', type: 1, career: ['声优'], relation: '制作', eps: '' },
        ]);
      }
      return json({ error: 'not found' }, 404);
    };
    const publicClient = new HttpClient({ fetchFn });
    const boundClient = new GeneratedBangumiOpenApiClient(
      new HttpClient({ fetchFn, accessToken: 'bound-token' }),
    );
    const tool = findTool(publicClient);

    expect(tool.auth).toBe('required');
    expect(tool.scopes).toEqual(['read:collection']);
    expect(tool.input.safeParse({ username: 'someone-else' }).success).toBe(false);
    expect(tool.input.safeParse({ maxSubjects: 25 }).success).toBe(false);
    expect(tool.input.safeParse({ maxSubjectPages: 9 }).success).toBe(false);
    expect(tool.input.safeParse({ maxRelationsPerSubject: 81 }).success).toBe(false);
    expect(tool.input.safeParse({ maxOutputRows: 61 }).success).toBe(false);

    const result = (await tool.execute(
      { maxSubjects: 1, maxSubjectPages: 1, maxRelationsPerSubject: 5, maxOutputRows: 10 },
      context,
      {
        executionSession: {
          account: { id: 'account-1', username: 'bound-user', nickname: 'Bound User' },
          client: boundClient,
        },
      },
    )) as Record<string, any>;

    expect(result).toMatchObject({
      state: 'complete',
      account: { username: 'bound-user' },
      coverage: { relations: { maxConcurrency: 4 } },
    });
    expect(result.matches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ evidenceKind: 'subject-character' }),
        expect.objectContaining({ evidenceKind: 'character-actor' }),
        expect.objectContaining({ evidenceKind: 'subject-person' }),
      ]),
    );
    expect(JSON.stringify(result)).not.toContain('private comment');
    expect(JSON.stringify(result)).not.toContain('private-tag');
    expect(requests).toHaveLength(5);
    const userRequests = requests.filter((request) => request.url.pathname.includes('/users/'));
    expect(userRequests).toHaveLength(3);
    expect(
      userRequests.every((request) => request.url.pathname.includes('/users/bound-user/')),
    ).toBe(true);
    expect(requests.every((request) => request.authorization === 'Bearer bound-token')).toBe(true);
  });
});
