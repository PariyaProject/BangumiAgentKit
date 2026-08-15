import { describe, expect, it } from 'vitest';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { MemoryStorage } from '@bangumi-agent-kit/db';
import { createReadTools, ToolRegistry, type ToolContext } from '@bangumi-agent-kit/tools';

const context: ToolContext = {
  principalId: 'episode-guide-test',
  botInstanceId: 'test',
  conversationId: 'test',
};

function response(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

describe('episode guide semantic tool', () => {
  it('is discoverable and maps bounded semantic input to official v0 reads', async () => {
    const requests: string[] = [];
    const client = new HttpClient({
      fetchFn: async (input) => {
        const url = new URL(String(input));
        requests.push(url.toString());
        if (url.pathname === '/v0/subjects/7') {
          return response({ id: 7, type: 2, name: 'Original', name_cn: '中文名' });
        }
        return response({
          total: 1,
          limit: 10,
          offset: 0,
          data: [
            {
              id: 70,
              subject_id: 7,
              type: 0,
              name: 'Episode',
              name_cn: '第一集',
              sort: 1,
              ep: 1,
              airdate: '2026-08-01',
              comment: 3,
              duration: '00:24:00',
              desc: 'safe description',
            },
          ],
        });
      },
    });
    const tool = createReadTools(client).find(
      (candidate) => candidate.name === 'bangumi.get_episode_guide',
    );
    expect(tool?.description).toContain('证据型章节指南');
    expect(tool).toBeDefined();

    const result = await (
      tool!.execute as (
        input: {
          subjectId: number;
          category: 'main';
          maxEpisodes: number;
          includeDescriptions: boolean;
        },
        context: ToolContext,
      ) => Promise<unknown>
    )({ subjectId: 7, category: 'main', maxEpisodes: 10, includeDescriptions: false }, context);

    expect(result).toMatchObject({
      state: 'complete',
      subjectId: 7,
      filters: { category: 'main', includeDescriptions: false },
      items: [{ id: 70, category: 'main' }],
    });
    expect((result as { items: Array<Record<string, unknown>> }).items[0]).not.toHaveProperty(
      'description',
    );
    expect(requests).toEqual(
      expect.arrayContaining([
        expect.stringContaining('/v0/subjects/7'),
        expect.stringContaining('/v0/episodes?subject_id=7&type=0&limit=10&offset=0'),
      ]),
    );
  });

  it('survives the generated public-client path used by ToolRegistry', async () => {
    const client = new HttpClient({
      fetchFn: async (input) => {
        const url = new URL(String(input));
        if (url.pathname === '/v0/subjects/7') {
          return response({ id: 7, type: 2, name: 'Original', name_cn: '中文名' });
        }
        return response({
          total: 1,
          limit: 50,
          offset: 0,
          data: [
            {
              id: 70,
              subject_id: 7,
              type: 0,
              name: 'Episode',
              name_cn: '第一集',
              sort: 1,
              ep: 1,
              airdate: '2026-08-01',
              comment: 0,
              duration: '00:24:00',
              desc: 'safe description',
            },
          ],
        });
      },
    });
    const registry = new ToolRegistry({
      storage: new MemoryStorage(),
      publicHttpClient: client,
    });

    const result = (await registry.executeTool(
      'bangumi.get_episode_guide',
      { subjectId: 7 },
      context,
    )) as {
      state: string;
      subject?: { nameCn?: string };
      items: Array<{
        category: string;
        nameCn?: string;
        discussionCount?: number;
        sourceSubjectId?: number;
      }>;
    };

    expect(result).toMatchObject({
      state: 'complete',
      subject: { nameCn: '中文名' },
      items: [{ category: 'main', nameCn: '第一集', discussionCount: 0, sourceSubjectId: 7 }],
    });
  });
});
