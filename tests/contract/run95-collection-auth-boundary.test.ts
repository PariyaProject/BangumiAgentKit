import { describe, expect, it, vi } from 'vitest';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { createReadTools, type ToolDefinition } from '@bangumi-agent-kit/tools';

describe('Run #95 personal collection auth boundary', () => {
  it('fails closed for G12/G13 before any HTTP request without a bound account', async () => {
    const fetchFn = vi.fn<typeof fetch>(
      async () => new Response('unexpected request', { status: 500 }),
    );
    const client = new HttpClient({ fetchFn });
    const tools = new Map(
      (createReadTools(client) as unknown as ToolDefinition[]).map((tool) => [tool.name, tool]),
    );
    const cases = [
      {
        name: 'bangumi.get_collection_schedule',
        input: { maxCollectionItems: 1, maxRows: 1, statuses: ['doing'] },
      },
      {
        name: 'bangumi.get_collection_backlog',
        input: { maxItems: 1, maxSubjects: 1, maxEpisodesPerSubject: 1 },
      },
    ];
    const context = {
      principalId: 'local-auth-boundary-fixture',
      botInstanceId: 'test-bot',
      conversationId: 'test-conversation',
    };

    for (const testCase of cases) {
      const tool = tools.get(testCase.name);
      expect(tool, testCase.name).toBeDefined();
      expect(tool?.auth, testCase.name).toBe('required');
      expect(tool?.scopes, testCase.name).toEqual(['read:collection']);
      expect(tool?.input.safeParse({ username: 'arbitrary-user' }).success, testCase.name).toBe(
        false,
      );
      await expect(
        tool!.execute(testCase.input, context, { executionSession: undefined }),
      ).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });
    }

    expect(fetchFn).not.toHaveBeenCalled();
  });
});
