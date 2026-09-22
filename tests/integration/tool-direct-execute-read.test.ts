import { describe, expect, it, vi } from 'vitest';
import {
  CharacterService,
  EpisodeService,
} from '@bangumi-agent-kit/bangumi-core';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { createReadTools } from '@bangumi-agent-kit/tools';

const context = {
  principalId: 'direct-read-fixture',
  botInstanceId: 'test-bot',
  conversationId: 'test-conversation',
};

describe('direct execute coverage for bounded read tools', () => {
  it('executes episodes, cast, revision intelligence, and latest revision through the tool seam', async () => {
    const fetchFn = vi.fn(async (url: string) => {
      if (url.includes('/v0/revisions/subjects/11')) {
        return new Response(
          JSON.stringify({
            id: 11,
            type: 1,
            summary: '修改条目中文名',
            created_at: '2026-08-01T00:00:00Z',
            creator: { username: 'editor', nickname: '编辑者' },
            data: { name_cn: '测试动画' },
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      return new Response(
        JSON.stringify({
          total: 1,
          limit: 1,
          offset: 0,
          data: [
            {
              id: 11,
              type: 1,
              summary: '修改条目中文名',
              created_at: '2026-08-01T00:00:00Z',
              creator: { username: 'editor', nickname: '编辑者' },
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    });
    const client = new HttpClient({ fetchFn });
    vi.spyOn(EpisodeService.prototype, 'getEpisodes').mockResolvedValue({
      total: 1,
      limit: 5,
      offset: 0,
      items: [{ id: 4, category: 'main', name: '第 1 话' }],
    } as any);
    vi.spyOn(CharacterService.prototype, 'getSubjectCharacters').mockResolvedValue([
      {
        character: { id: 2, name: '角色', type: 1, summary: '' },
        relation: '主角',
        actors: [{ id: 3, name: '声优', career: ['seiyu'] }],
      },
    ] as any);

    const tools = new Map(createReadTools(client).map((tool) => [tool.name, tool]));
    const episodes = await (tools.get('bangumi.get_episodes')!.execute as any)(
      { subjectId: 1, category: 'main', limit: 5 },
      context,
      {},
    );
    expect(episodes).toMatchObject({ total: 1, items: [{ id: 4, category: 'main' }] });
    expect(EpisodeService.prototype.getEpisodes).toHaveBeenCalledWith(1, {
      type: 0,
      limit: 5,
      offset: 0,
    });

    const cast = await (tools.get('bangumi.get_subject_cast')!.execute as any)(
      { subjectId: 1, limit: 5 },
      context,
      {},
    );
    expect(cast).toMatchObject({ cast: [{ character: { id: 2 }, actors: [{ id: 3 }] }] });

    const intelligence = await (tools.get('bangumi.get_revision_intelligence')!.execute as any)(
      { entityType: 'subject', entityId: 1, limit: 1 },
      context,
      { publicHttpClient: client },
    );
    expect(intelligence).toMatchObject({ items: [{ id: 11, summary: '修改条目中文名' }] });

    const latest = await (tools.get('bangumi.get_latest_subject_revision')!.execute as any)(
      { subjectId: 1 },
      context,
      { publicHttpClient: client },
    );
    expect(latest).toMatchObject({
      subjectId: 1,
      selection: { revisionId: 11 },
      revision: { id: 11 },
    });
    expect(fetchFn).toHaveBeenCalled();
  });
});
