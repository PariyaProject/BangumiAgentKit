import { describe, expect, it, vi } from 'vitest';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { createReadTools, type ToolDefinition } from '@bangumi-agent-kit/tools';

describe('subject index membership semantic tool', () => {
  it('exposes a read-only bounded exact-ID contract', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          total: 1,
          data: [{ id: 41529 }],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
    const client = new HttpClient({ fetchFn: fetch });
    const tool = createReadTools(client).find(
      (candidate) => candidate.name === 'bangumi.get_subject_index_membership',
    ) as ToolDefinition | undefined;
    expect(tool).toBeDefined();
    expect(tool).toMatchObject({ auth: 'none', risk: 'read' });

    const parsed = tool?.input.safeParse({ subjectId: 41529, indexIds: [77] });
    expect(parsed?.success).toBe(true);
    if (!parsed?.success || !tool) return;

    const result = (await tool.execute(parsed.data, {
      principalId: 'semantic-test',
      botInstanceId: 'bot',
      conversationId: 'conversation',
    })) as {
      state: string;
      summary: Record<string, number>;
      indexes: Array<Record<string, unknown>>;
    };

    expect(result.state).toBe('complete');
    expect(result.summary).toEqual({
      requested: 1,
      matched: 1,
      notMatchedInObservedScope: 0,
      unknown: 0,
    });
    expect(result.indexes[0]).toMatchObject({ indexId: 77, membership: 'matched' });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(String(fetch.mock.calls[0]?.[0])).toContain('/v0/indices/77/subjects');
  });

  it('rejects broad or ambiguous input at the tool boundary', () => {
    const tool = createReadTools(new HttpClient()).find(
      (candidate) => candidate.name === 'bangumi.get_subject_index_membership',
    ) as ToolDefinition | undefined;
    expect(tool).toBeDefined();
    expect(tool?.input.safeParse({ subjectId: 41529, indexIds: [77, 77] }).success).toBe(false);
    expect(tool?.input.safeParse({ subjectId: 41529, indexIds: [] }).success).toBe(false);
    expect(tool?.input.safeParse({ subjectId: 41529, indexIds: [77], unknown: true }).success).toBe(
      false,
    );
  });
});
