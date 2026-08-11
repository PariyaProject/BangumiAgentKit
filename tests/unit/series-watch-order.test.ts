import { describe, expect, it, vi } from 'vitest';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { SeriesService } from '@bangumi-agent-kit/bangumi-core';

function subjectPayload(
  id: number,
  nameCn: string,
  date: string,
  type = 2,
): Record<string, unknown> {
  return {
    id,
    type,
    name: nameCn,
    name_cn: nameCn,
    date,
    images: { medium: `https://example.test/${id}.jpg` },
  };
}

function createService(
  relationRows: Record<number, unknown[] | Error>,
  details: Record<number, Record<string, unknown> | Error>,
) {
  const mockFetch = vi.fn().mockImplementation((url: string) => {
    const relationMatch = url.match(/\/v0\/subjects\/(\d+)\/subjects$/);
    if (relationMatch) {
      const id = Number(relationMatch[1]);
      const rows = relationRows[id];
      if (rows instanceof Error) {
        return Promise.resolve(
          new Response(JSON.stringify({ error: rows.message }), { status: 503 }),
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify(rows || []), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    }

    const detailMatch = url.match(/\/v0\/subjects\/(\d+)$/);
    if (!detailMatch) return Promise.resolve(new Response('{}', { status: 404 }));
    const id = Number(detailMatch[1]);
    const detail = details[id];
    if (detail instanceof Error) {
      return Promise.resolve(
        new Response(JSON.stringify({ error: detail.message }), { status: 503 }),
      );
    }
    return Promise.resolve(
      new Response(JSON.stringify(detail || subjectPayload(id, `条目 ${id}`, '2020-01-01')), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
  });
  return {
    service: new SeriesService(new HttpClient({ fetchFn: mockFetch })),
    mockFetch,
  };
}

function requestedPaths(mockFetch: ReturnType<typeof vi.fn>): string[] {
  return mockFetch.mock.calls.map(([url]) => String(url).replace(/^https?:\/\/[^/]+/, ''));
}

describe('SeriesService bounded watch-order derivation', () => {
  it('preserves raw labels, excludes mixed media, and never treats unknown labels as steps', async () => {
    const { service, mockFetch } = createService(
      {
        100: [
          { id: 102, type: 2, name: '续集', name_cn: '续集', relation: '续集' },
          { id: 99, type: 2, name: '前传', name_cn: '前传', relation: '前传' },
          { id: 103, type: 2, name: '未知标签', name_cn: '未知标签', relation: '特别关联' },
          { id: 200, type: 1, name: '原作书', name_cn: '原作书', relation: '书籍' },
          { id: 300, type: 3, name: '原声集', name_cn: '原声集', relation: '原声集' },
        ],
      },
      {
        100: subjectPayload(100, '起始动画', '2020-01-01'),
        99: subjectPayload(99, '前传动画', '2018-01-01'),
        102: subjectPayload(102, '续集动画', '2022-01-01'),
        103: subjectPayload(103, '未知关系动画', '2021-01-01'),
      },
    );

    const result = await service.getSeriesWatchOrder(100, { depth: 0, maxNodes: 8 });

    expect(result.state).toBe('partial');
    expect(result.capabilityStates.watchOrder).toBe('bounded_recommendation');
    expect(result.watchOrder.map((item) => item.id)).toEqual([99, 100, 102]);
    expect(result.watchOrder.find((item) => item.id === 99)?.placementReason).toContain('前传');
    expect(result.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ toId: 99, relation: '前传', relationKind: 'prequel' }),
        expect.objectContaining({ toId: 102, relation: '续集', relationKind: 'sequel' }),
        expect.objectContaining({ toId: 103, relation: '特别关联', relationKind: 'unknown' }),
      ]),
    );
    expect(result.excluded.byReason).toEqual(
      expect.arrayContaining([
        { reason: 'media_type_not_anime', count: 2 },
        { reason: 'relation_not_watch_step', count: 1 },
      ]),
    );
    expect(result.coverage).toMatchObject({
      relationRequests: 1,
      relationRowsObserved: 5,
      detailsFetched: 3,
      detailsFailed: 0,
      truncated: true,
      truncationReasons: ['depth=0'],
    });
    expect(requestedPaths(mockFetch)).toEqual(
      expect.arrayContaining([
        '/v0/subjects/100',
        '/v0/subjects/100/subjects',
        '/v0/subjects/99',
        '/v0/subjects/102',
        '/v0/subjects/103',
      ]),
    );
    expect(result.evidence.sources).toHaveLength(5);
    expect(result.evidence.derivation).toBe('series-watch-order-v1');
  });

  it('keeps direct root semantics when deeper reverse labels and other bridges are observed', async () => {
    const { service, mockFetch } = createService(
      {
        100: [
          { id: 101, type: 2, name: '续集', name_cn: '续集', relation: '续集' },
          { id: 102, type: 2, name: '跨系列桥', name_cn: '跨系列桥', relation: '其他' },
          { id: 200, type: 2, name: '衍生作', name_cn: '衍生作', relation: '衍生' },
        ],
        101: [{ id: 100, type: 2, name: '起点', name_cn: '起点', relation: '前传' }],
        200: [
          { id: 101, type: 2, name: '续集', name_cn: '续集', relation: '前传' },
          { id: 300, type: 2, name: '另一系列', name_cn: '另一系列', relation: '其他' },
        ],
      },
      {
        100: subjectPayload(100, '起点', '2020-01-01'),
        101: subjectPayload(101, '直接续集', '2021-01-01'),
        102: subjectPayload(102, '跨系列桥', '2019-01-01'),
        200: subjectPayload(200, '衍生作', '2022-01-01'),
      },
    );

    const result = await service.getSeriesWatchOrder(100, { depth: 1, maxNodes: 8 });

    expect(result.watchOrder.map((item) => item.id)).toEqual([100, 101, 200]);
    expect(result.watchOrder.find((item) => item.id === 101)).toMatchObject({
      relationLabels: ['续集'],
      relationKinds: ['sequel'],
    });
    expect(result.related.find((item) => item.id === 101)?.relationLabels).toEqual([
      '前传',
      '续集',
    ]);
    expect(result.excluded.byReason).toEqual(
      expect.arrayContaining([
        { reason: 'depth_evidence_only', count: 1 },
        { reason: 'relation_not_watch_step', count: 1 },
      ]),
    );
    expect(result.coverage.relationRequests).toBe(3);
    expect(result.evidence.sources.map((source) => source.path)).toEqual(
      expect.arrayContaining([
        '/v0/subjects/100',
        '/v0/subjects/100/subjects',
        '/v0/subjects/101/subjects',
        '/v0/subjects/200/subjects',
        '/v0/subjects/101',
        '/v0/subjects/200',
      ]),
    );
    const paths = requestedPaths(mockFetch);
    expect(paths).not.toContain('/v0/subjects/102/subjects');
    expect(paths).not.toContain('/v0/subjects/300/subjects');
  });

  it('keeps anime recommendations identical for media=anime/all without hydrating excluded media', async () => {
    const relationRows = {
      100: [
        { id: 101, type: 2, name: '动画一', name_cn: '动画一', relation: '续集' },
        { id: 102, type: 2, name: '动画二', name_cn: '动画二', relation: '续集' },
        { id: 201, type: 1, name: '小说', name_cn: '小说', relation: '原作' },
        { id: 202, type: 3, name: '音乐', name_cn: '音乐', relation: '音乐' },
        { id: 203, type: 4, name: '游戏', name_cn: '游戏', relation: '游戏' },
      ],
    };
    const details = {
      100: subjectPayload(100, '起点', '2020-01-01'),
      101: subjectPayload(101, '动画一', '2021-01-01'),
      102: subjectPayload(102, '动画二', '2022-01-01'),
    };
    const anime = createService(relationRows, details);
    const all = createService(relationRows, details);

    const animeResult = await anime.service.getSeriesWatchOrder(100, {
      depth: 0,
      maxNodes: 1,
      media: 'anime',
    });
    const allResult = await all.service.getSeriesWatchOrder(100, {
      depth: 0,
      maxNodes: 1,
      media: 'all',
    });

    expect(allResult.watchOrder.map((item) => item.id)).toEqual(
      animeResult.watchOrder.map((item) => item.id),
    );
    expect(allResult.coverage.detailsFetched).toBe(1);
    expect(allResult.excluded.byReason).toEqual(
      expect.arrayContaining([
        { reason: 'media_type_not_anime', count: 3 },
        { reason: 'node_cap', count: 1 },
      ]),
    );
    for (const fixture of [anime, all]) {
      const paths = requestedPaths(fixture.mockFetch);
      expect(paths.filter((path) => path.endsWith('/201'))).toHaveLength(0);
      expect(paths.filter((path) => path.endsWith('/202'))).toHaveLength(0);
      expect(paths.filter((path) => path.endsWith('/203'))).toHaveLength(0);
    }
    expect(allResult.related.map((item) => item.id)).toEqual(
      expect.arrayContaining([101, 201, 202, 203]),
    );
  });

  it('does not expand unknown or non-watch anime labels', async () => {
    const { service, mockFetch } = createService(
      {
        100: [{ id: 104, type: 2, name: '未知', name_cn: '未知', relation: '特别关联' }],
        104: [{ id: 105, type: 2, name: '不应展开', name_cn: '不应展开', relation: '续集' }],
      },
      {
        100: subjectPayload(100, '起点', '2020-01-01'),
        104: subjectPayload(104, '未知', '2021-01-01'),
      },
    );

    const result = await service.getSeriesWatchOrder(100, { depth: 2 });

    expect(result.watchOrder.map((item) => item.id)).toEqual([100]);
    expect(result.excluded.byReason).toEqual([{ reason: 'relation_not_watch_step', count: 1 }]);
    expect(result.coverage.relationRequests).toBe(1);
    expect(requestedPaths(mockFetch)).not.toContain('/v0/subjects/104/subjects');
  });

  it('distinguishes a visited back-edge from an actual depth boundary', async () => {
    const backEdge = createService(
      {
        100: [{ id: 101, type: 2, name: '续集', name_cn: '续集', relation: '续集' }],
        101: [{ id: 100, type: 2, name: '起点', name_cn: '起点', relation: '前传' }],
      },
      {
        100: subjectPayload(100, '起点', '2020-01-01'),
        101: subjectPayload(101, '续集', '2021-01-01'),
      },
    );
    const boundary = createService(
      {
        100: [{ id: 101, type: 2, name: '续集', name_cn: '续集', relation: '续集' }],
        101: [
          { id: 100, type: 2, name: '起点', name_cn: '起点', relation: '前传' },
          { id: 102, type: 2, name: '更深', name_cn: '更深', relation: '续集' },
        ],
      },
      {
        100: subjectPayload(100, '起点', '2020-01-01'),
        101: subjectPayload(101, '续集', '2021-01-01'),
      },
    );

    const complete = await backEdge.service.getSeriesWatchOrder(100, { depth: 1 });
    const partial = await boundary.service.getSeriesWatchOrder(100, { depth: 1 });

    expect(complete.coverage.truncationReasons).not.toContain('depth=1');
    expect(partial.coverage.truncationReasons).toContain('depth=1');
    expect(partial.edges).toEqual(
      expect.arrayContaining([expect.objectContaining({ toId: 100, relation: '前传' })]),
    );
  });

  it('preserves duplicate direct labels and deterministic date/ID ties', async () => {
    const { service } = createService(
      {
        100: [
          { id: 101, type: 2, name: '一', name_cn: '一', relation: '续集' },
          { id: 101, type: 2, name: '一', name_cn: '一', relation: '前传' },
          { id: 102, type: 2, name: '二', name_cn: '二', relation: '续集' },
          { id: 103, type: 2, name: '三', name_cn: '三', relation: '续集' },
        ],
      },
      {
        100: subjectPayload(100, '起点', '2020-01-01'),
        101: subjectPayload(101, '一', '2021-01-01'),
        102: subjectPayload(102, '二', '2022-01-01'),
        103: subjectPayload(103, '三', '2022-01-01'),
      },
    );

    const result = await service.getSeriesWatchOrder(100, { depth: 0 });

    expect(result.watchOrder.map((item) => item.id)).toEqual([101, 100, 102, 103]);
    expect(result.watchOrder[0]?.relationLabels).toEqual(['前传', '续集']);
    expect(result.warnings.join(' ')).toContain('多个关系标签');
  });

  it('keeps optional child relation and detail failures explicit while propagating root failure', async () => {
    const childFailure = createService(
      {
        100: [{ id: 101, type: 2, name: '续集', name_cn: '续集', relation: '续集' }],
        101: new Error('child relation unavailable'),
      },
      {
        100: subjectPayload(100, '起点', '2020-01-01'),
        101: subjectPayload(101, '续集', '2021-01-01'),
      },
    );
    const rootFailure = createService({ 100: [] }, { 100: new Error('root detail unavailable') });

    const partial = await childFailure.service.getSeriesWatchOrder(100, { depth: 1 });
    expect(partial.state).toBe('partial');
    expect(partial.coverage.relationFailures).toBe(1);
    expect(partial.coverage.truncationReasons).toContain('relation-read-failure');
    await expect(rootFailure.service.getSeriesWatchOrder(100, { depth: 0 })).rejects.toThrow(
      /root detail unavailable/,
    );
  });

  it('reports a second-level depth boundary without over-requesting the bounded graph', async () => {
    const { service, mockFetch } = createService(
      {
        100: [{ id: 101, type: 2, name: '一层', name_cn: '一层', relation: '续集' }],
        101: [{ id: 102, type: 2, name: '二层', name_cn: '二层', relation: '续集' }],
        102: [{ id: 103, type: 2, name: '三层', name_cn: '三层', relation: '续集' }],
      },
      {
        100: subjectPayload(100, '起点', '2020-01-01'),
        101: subjectPayload(101, '一层', '2021-01-01'),
      },
    );

    const result = await service.getSeriesWatchOrder(100, { depth: 2, maxNodes: 8 });

    expect(result.coverage.truncationReasons).toContain('depth=2');
    expect(result.coverage.relationRequests).toBe(3);
    expect(requestedPaths(mockFetch)).not.toContain('/v0/subjects/103/subjects');
  });
});
