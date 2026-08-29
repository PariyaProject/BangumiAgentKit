import { describe, expect, it } from 'vitest';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { createReadTools, ToolRegistry, type ToolContext } from '@bangumi-agent-kit/tools';
import { MemoryStorage } from '@bangumi-agent-kit/db';

const context: ToolContext = {
  principalId: 'episode-integrity-test',
  botInstanceId: 'test',
  conversationId: 'test',
};

function response(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function client(): HttpClient {
  return new HttpClient({
    fetchFn: async (input) => {
      const url = new URL(String(input));
      if (url.pathname === '/v0/subjects/7') {
        return response({
          id: 7,
          type: 2,
          name: 'Original',
          name_cn: '中文名',
          eps: 2,
          total_episodes: 2,
        });
      }
      return response({
        total: 3,
        limit: 50,
        offset: 0,
        data: [
          {
            id: 70,
            subject_id: 7,
            type: 0,
            name: 'Episode 1',
            name_cn: '第一集',
            sort: 1,
            ep: 1,
            airdate: '2026-08-01',
            comment: 3,
            duration: '00:24:00',
            desc: 'safe description',
          },
          {
            id: 71,
            subject_id: 7,
            type: 1,
            name: 'Special',
            name_cn: '特别篇',
            sort: 1,
            airdate: '2026-08-02',
            comment: 0,
            duration: '00:12:00',
            desc: 'safe description',
          },
          {
            id: 72,
            subject_id: 7,
            type: 0,
            name: 'Episode 2',
            name_cn: '第二集',
            sort: 2,
            ep: 2,
            airdate: '2026-09-01',
            comment: 1,
            duration: '00:24:00',
            desc: 'safe description',
          },
        ],
      });
    },
  });
}

describe('episode integrity semantic tool', () => {
  it('is discoverable and preserves official evidence plus explicit UTC semantics', async () => {
    const tool = createReadTools(client()).find(
      (candidate) => candidate.name === 'bangumi.get_episode_integrity',
    );
    expect(tool).toBeDefined();
    expect(tool?.description).toContain('章节完整性分析');
    expect(tool?.description).toContain('明确 UTC as-of 日期');

    const execute = tool!.execute as (
      input: { subjectId: number; asOfDate: string },
      context: ToolContext,
    ) => Promise<unknown>;
    const result = (await execute({ subjectId: 7, asOfDate: '2026-08-31' }, context)) as {
      state: string;
      asOf: { date: string; source: string };
      integrity: {
        counts: { main: number; special: number; airedMain: number; futureMain: number };
      };
      evidence: Array<{ source: string; formulaVersion?: string }>;
    };

    expect(result).toMatchObject({
      state: 'complete',
      asOf: { date: '2026-08-31', source: 'explicit' },
      integrity: { counts: { main: 2, special: 1, airedMain: 1, futureMain: 1 } },
    });
    expect(result.evidence).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: 'official_v0' }),
        expect.objectContaining({
          source: 'derived',
          formulaVersion: 'episode-integrity-v1',
        }),
      ]),
    );
  });

  it('survives the generated ToolRegistry public-client path', async () => {
    const registry = new ToolRegistry({
      storage: new MemoryStorage(),
      publicHttpClient: client(),
    });

    const result = (await registry.executeTool(
      'bangumi.get_episode_integrity',
      { subjectId: 7, asOfDate: '2026-08-31' },
      context,
    )) as {
      integrity: { counts: { airedMain: number } };
      coverage: { episodeGuide: { episodes: { state: string } } };
    };

    expect(result).toMatchObject({
      integrity: { counts: { airedMain: 1 } },
      coverage: { episodeGuide: { episodes: { state: 'complete' } } },
    });
  });
});
