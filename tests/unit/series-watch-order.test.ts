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
  relationRows: Record<number, unknown[]>,
  details: Record<number, Record<string, unknown> | Error>,
) {
  const mockFetch = vi.fn().mockImplementation((url: string) => {
    const relationMatch = url.match(/\/v0\/subjects\/(\d+)\/subjects$/);
    if (relationMatch) {
      const id = Number(relationMatch[1]);
      return Promise.resolve(
        new Response(JSON.stringify(relationRows[id] || []), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );
    }

    const detailMatch = url.match(/\/v0\/subjects\/(\d+)$/);
    if (!detailMatch) {
      return Promise.resolve(new Response('{}', { status: 404 }));
    }
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

describe('SeriesService bounded watch-order derivation', () => {
  it('preserves raw labels, excludes mixed media, and orders clear prequels/root/sequels', async () => {
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

    expect(result.state).toBe('complete');
    expect(result.capabilityStates.watchOrder).toBe('bounded_recommendation');
    expect(result.watchOrder.map((item) => item.id)).toEqual([99, 100, 102, 103]);
    expect(result.watchOrder.find((item) => item.id === 99)?.placementReason).toContain('前传');
    expect(result.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ toId: 99, relation: '前传', relationKind: 'prequel' }),
        expect.objectContaining({ toId: 102, relation: '续集', relationKind: 'sequel' }),
        expect.objectContaining({ toId: 103, relation: '特别关联', relationKind: 'unknown' }),
      ]),
    );
    expect(result.excluded.byReason).toEqual(
      expect.arrayContaining([{ reason: 'media_type_not_anime', count: 2 }]),
    );
    expect(result.coverage).toMatchObject({
      relationRequests: 1,
      relationRowsObserved: 5,
      detailsFetched: 3,
      detailsFailed: 0,
      truncated: false,
    });
    expect(mockFetch).toHaveBeenCalledTimes(5);
    expect(result.evidence.derivation).toBe('series-watch-order-v1');
  });

  it('bounds child traversal and reports depth/cap truncation', async () => {
    const rootRows = Array.from({ length: 6 }, (_, index) => ({
      id: 200 + index,
      type: 2,
      name: `关联 ${index}`,
      name_cn: `关联 ${index}`,
      relation: '衍生',
    }));
    const { service, mockFetch } = createService(
      {
        100: rootRows,
        200: [{ id: 300, type: 2, name: '更深层', name_cn: '更深层', relation: '续集' }],
        201: [{ id: 301, type: 2, name: '另一层', name_cn: '另一层', relation: '续集' }],
      },
      {
        100: subjectPayload(100, '起点', '2020-01-01'),
        200: subjectPayload(200, '关联 0', '2020-02-01'),
        201: subjectPayload(201, '关联 1', '2020-03-01'),
      },
    );

    const result = await service.getSeriesWatchOrder(100, { depth: 2, maxNodes: 2 });

    expect(result.state).toBe('partial');
    expect(result.coverage.truncated).toBe(true);
    expect(result.coverage.truncationReasons).toEqual(
      expect.arrayContaining(['maxNodes=2', 'depth=2']),
    );
    expect(result.coverage.uniqueRelatedReturned).toBe(2);
    expect(result.coverage.relationRequests).toBeLessThanOrEqual(3);
    expect(mockFetch.mock.calls.length).toBeLessThanOrEqual(7);
  });

  it('keeps relation names and marks optional detail failures as partial', async () => {
    const { service } = createService(
      {
        100: [{ id: 101, type: 2, name: '关系接口名称', name_cn: '', relation: '续集' }],
      },
      {
        100: subjectPayload(100, '起点', '2020-01-01'),
        101: new Error('detail unavailable'),
      },
    );

    const result = await service.getSeriesWatchOrder(100, { depth: 0 });

    expect(result.state).toBe('partial');
    expect(result.coverage.detailsFailed).toBe(1);
    expect(result.related[0]).toMatchObject({
      id: 101,
      name: '关系接口名称',
      includedInWatchOrder: true,
    });
    expect(result.warnings.join(' ')).toContain('详情读取失败');
  });
});
