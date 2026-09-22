import { describe, expect, it, vi } from 'vitest';
import {
  CharacterService,
  EpisodeService,
} from '@bangumi-agent-kit/bangumi-core';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { ProviderRegistry } from '@bangumi-agent-kit/provider-core';
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

  it('executes stats, stats intelligence, identity, and history fallback directly', async () => {
    const stats = {
      score: 8.5,
      rank: 12,
      ratingTotal: 1200,
      ratingHistogram: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 500, 9: 600, 10: 100 },
      collection: { wish: 10, collect: 500, doing: 20, onHold: 5, dropped: 2 },
    };
    const identity = {
      id: 1,
      type: 2,
      name: 'Fixture Anime',
      nameCn: '测试动画',
      date: '2026-07-01',
      platform: 'TV',
      locked: false,
      nsfw: false,
      series: false,
      volumes: 0,
      eps: 12,
      totalEpisodes: 12,
      metaTags: ['原创'],
      tags: ['后宫'],
      images: {},
      infobox: {
        state: 'complete',
        rows: [],
        aliases: { state: 'unknown', values: [], sourceKeys: [], sourceRowIndexes: [] },
        coverage: {
          state: 'complete',
          observedRows: 0,
          returnedRows: 0,
          malformedRows: 0,
          omittedRows: 0,
          nestedValuesObserved: 0,
          nestedValuesReturned: 0,
          nestedValuesOmitted: 0,
          malformedValues: 0,
          truncatedValues: 0,
          truncated: false,
          maxRows: 64,
          maxValuesPerRow: 8,
          maxScalarCharacters: 1000,
        },
      },
      fields: {
        observed: ['id', 'type', 'name', 'name_cn', 'infobox'],
        returned: ['id', 'type', 'name', 'name_cn', 'infobox'],
        missing: [],
        malformed: [],
        empty: [],
        truncated: [],
      },
    };
    const providerRegistry = new ProviderRegistry({
      v0: {
        async getSubject() {
          return { state: 'not_found' as const };
        },
        async getSubjectStats() {
          return { state: 'ok' as const, data: stats, evidence: {} };
        },
        async getSubjectIdentity() {
          return { state: 'ok' as const, data: identity, evidence: {} };
        },
      } as never,
    });
    const tools = new Map(createReadTools(new HttpClient()).map((tool) => [tool.name, tool]));

    const rawStats = await (tools.get('bangumi.get_subject_stats')!.execute as any)(
      { subjectId: 1 },
      context,
      { providerRegistry },
    );
    expect(rawStats).toMatchObject({ state: 'ok', data: { score: 8.5, ratingTotal: 1200 } });

    const intelligence = await (tools.get('bangumi.get_subject_stats_intelligence')!.execute as any)(
      { subjectId: 1 },
      context,
      { providerRegistry },
    );
    expect(intelligence).toMatchObject({ subjectId: 1, state: expect.any(String) });

    const subjectIdentity = await (tools.get('bangumi.get_subject_identity')!.execute as any)(
      { subjectId: 1 },
      context,
      { providerRegistry },
    );
    expect(subjectIdentity).toMatchObject({ subjectId: 1, data: { name: 'Fixture Anime' } });

    const history = await (tools.get('bangumi.get_subject_stats_history')!.execute as any)(
      { subjectId: 1 },
      context,
      {},
    );
    expect(history).toMatchObject({ state: 'unavailable', subjectId: 1 });
  });

  it('executes complex read tools directly and preserves bounded upstream failure states', async () => {
    const client = new HttpClient({
      fetchFn: vi.fn(async () =>
        new Response(JSON.stringify({ error: 'fixture unavailable' }), {
          status: 400,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    });
    const tools = new Map(createReadTools(client).map((tool) => [tool.name, tool]));
    const run = async (tool: any, input: Record<string, unknown>, name: string) => {
      let result: any;
      try {
        result = await tool.execute(input, context, {});
      } catch (error) {
        result = error;
      }
      if (result instanceof Error) {
        expect(result, name).toMatchObject({ code: expect.any(String) });
      } else if (result.ok === false) {
        expect(result, name).toMatchObject({
          ok: false,
          error: { code: expect.any(String), retryable: expect.any(Boolean) },
        });
      } else {
        expect(result, name).toMatchObject({ state: expect.any(String) });
        expect(result, name).toEqual(expect.objectContaining({ warnings: expect.any(Array) }));
      }
    };
    await run(
      tools.get('bangumi.get_character_credit_integrity')!,
      { characterId: 1, maxSubjects: 1, maxPersons: 1 },
      'bangumi.get_character_credit_integrity',
    );
    await run(
      tools.get('bangumi.get_subject_comparison')!,
      { subjectIds: [1, 2], maxCast: 1, maxStaff: 1, maxRelations: 1 },
      'bangumi.get_subject_comparison',
    );
    await run(
      tools.get('bangumi.get_subject_overlap')!,
      { subjectIds: [1, 2], maxCast: 1, maxStaff: 1, maxPairs: 1, maxPeople: 1 },
      'bangumi.get_subject_overlap',
    );
    await run(
      tools.get('bangumi.get_series_watch_order')!,
      { subjectId: 1, depth: 0, maxNodes: 1 },
      'bangumi.get_series_watch_order',
    );
    await run(
      tools.get('bangumi.get_person_activity')!,
      { personId: 1, windowMonths: 3, maxRelations: 1, maxSubjectDetails: 1, maxRows: 1 },
      'bangumi.get_person_activity',
    );
    await run(
      tools.get('bangumi.get_person_collaboration')!,
      { personId: 1, maxRelations: 1, maxSubjects: 1, maxCollaborators: 1, maxSharedSubjects: 1 },
      'bangumi.get_person_collaboration',
    );
    await run(
      tools.get('bangumi.get_subject_index_membership')!,
      { subjectId: 1, indexIds: [1], pageSize: 1, maxPages: 1, maxRows: 1 },
      'bangumi.get_subject_index_membership',
    );
    await run(
      tools.get('bangumi.get_subject_overview')!,
      { subjectId: 1, maxCast: 1, maxStaff: 1, maxRelations: 1 },
      'bangumi.get_subject_overview',
    );
  });
});
