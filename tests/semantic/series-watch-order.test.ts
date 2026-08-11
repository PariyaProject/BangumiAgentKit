import { describe, expect, it, vi } from 'vitest';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { createReadTools } from '@bangumi-agent-kit/tools';

describe('bangumi.get_series_watch_order semantic contract', () => {
  it('is a public read tool with bounded input and evidence-bearing output', async () => {
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.endsWith('/v0/subjects/100/subjects')) {
        return Promise.resolve(
          new Response(
            JSON.stringify([
              { id: 101, type: 2, name: '续集', name_cn: '续集', relation: '续集' },
              { id: 102, type: 2, name: '衍生', name_cn: '衍生', relation: '衍生' },
              { id: 201, type: 1, name: '原作', name_cn: '原作', relation: '书籍' },
            ]),
            { status: 200, headers: { 'content-type': 'application/json' } },
          ),
        );
      }
      const subjectId = Number(url.match(/\/v0\/subjects\/(\d+)$/)?.[1]);
      return Promise.resolve(
        new Response(
          JSON.stringify({
            id: subjectId,
            type: subjectId === 201 ? 1 : 2,
            name: subjectId === 100 ? '起点' : `条目 ${subjectId}`,
            name_cn: subjectId === 100 ? '起点' : `条目 ${subjectId}`,
            date: '2020-01-01',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      );
    });
    const tool = createReadTools(new HttpClient({ fetchFn: mockFetch })).find(
      (candidate) => candidate.name === 'bangumi.get_series_watch_order',
    );

    expect(tool).toBeDefined();
    if (!tool) return;
    expect(tool.auth).toBe('none');
    expect(tool.risk).toBe('read');
    expect(tool.input.safeParse({ subjectId: 100, depth: 2, maxNodes: 16 }).success).toBe(true);
    expect(tool.input.safeParse({ subjectId: 100, maxNodes: 17 }).success).toBe(false);

    const result = (await tool.execute({ subjectId: 100, depth: 0, maxNodes: 1 } as never, {
      principalId: 'test',
      botInstanceId: 'test',
      conversationId: 'test',
    })) as {
      state: string;
      watchOrder: Array<{ id: number }>;
      excluded: { byReason: Array<{ reason: string; count: number }> };
      evidence: { derivation: string; sources: Array<{ path: string }> };
      coverage: { maxNodes: number; truncated: boolean };
    };

    expect(result.state).toBe('partial');
    expect(result.watchOrder.map((item) => item.id)).toEqual([100, 101]);
    expect(result.excluded.byReason).toEqual(
      expect.arrayContaining([{ reason: 'node_cap', count: 1 }]),
    );
    expect(result.evidence).toMatchObject({
      derivation: 'series-watch-order-v1',
      sources: expect.arrayContaining([
        expect.objectContaining({ path: '/v0/subjects/100' }),
        expect.objectContaining({ path: '/v0/subjects/100/subjects' }),
      ]),
    });
    expect(result.coverage).toMatchObject({ maxNodes: 1, truncated: true });
  });
});
