import { describe, expect, it, vi } from 'vitest';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import {
  SeriesService,
  type SeriesWatchOrderResult,
} from '../../packages/bangumi-core/src/index.js';

interface SubjectFixture {
  id: number;
  type: number;
  name?: string;
  name_cn?: string;
  date?: string;
}

interface RelationFixture {
  id: number;
  type: number;
  name?: string;
  name_cn?: string;
  relation: string;
}

interface FixtureOptions {
  subjects: SubjectFixture[];
  relations: Record<number, RelationFixture[]>;
  failedDetails?: number[];
  failedRelations?: number[];
}

function subject(id: number, type = 2, date = `202${id % 10}-01-01`): SubjectFixture {
  return {
    id,
    type,
    name: `作品 ${id}`,
    name_cn: `作品 ${id}`,
    date,
  };
}

function relation(
  id: number,
  relationLabel: string,
  type = 2,
  name = `作品 ${id}`,
): RelationFixture {
  return { id, type, name, name_cn: name, relation: relationLabel };
}

function fixture(options: FixtureOptions) {
  const calls: string[] = [];
  const subjects = new Map(options.subjects.map((item) => [item.id, item]));
  const failedDetails = new Set(options.failedDetails || []);
  const failedRelations = new Set(options.failedRelations || []);
  const fetchFn = vi.fn(async (input: string | URL) => {
    const url = String(input);
    calls.push(url);
    const relationMatch = url.match(/\/v0\/subjects\/(\d+)\/subjects$/u);
    if (relationMatch) {
      const id = Number(relationMatch[1]);
      if (failedRelations.has(id)) return new Response('relation unavailable', { status: 404 });
      return new Response(JSON.stringify(options.relations[id] || []), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }

    const detailMatch = url.match(/\/v0\/subjects\/(\d+)$/u);
    if (detailMatch) {
      const id = Number(detailMatch[1]);
      if (failedDetails.has(id)) return new Response('detail unavailable', { status: 404 });
      const value = subjects.get(id);
      if (!value) return new Response('missing subject', { status: 404 });
      return new Response(JSON.stringify(value), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }
    return new Response('unexpected fixture request', { status: 404 });
  });

  return {
    calls,
    fetchFn,
    service: new SeriesService(new HttpClient({ fetchFn: fetchFn as typeof fetch })),
  };
}

function ids(result: SeriesWatchOrderResult): number[] {
  return result.watchOrder.map((item) => item.id);
}

describe('SeriesService bounded watch-order intelligence', () => {
  it('keeps direct direction, raw labels, media exclusions, and deterministic steps', async () => {
    const { service, calls } = fixture({
      subjects: [subject(100), subject(101), subject(102), subject(103), subject(106)],
      relations: {
        100: [
          relation(103, '外传'),
          relation(104, '原作', 1, '原作书'),
          relation(102, '续集'),
          relation(105, '相关作品'),
          relation(101, '前传'),
          relation(106, '总集篇'),
        ],
      },
    });

    const result = await service.getSeriesWatchOrder(100, { depth: 0, media: 'all' });

    expect(ids(result)).toEqual([101, 100, 102, 103, 106]);
    expect(result.watchOrder.find((item) => item.id === 101)?.relationLabels).toEqual(['前传']);
    expect(result.watchOrder.find((item) => item.id === 101)?.relationPaths[0]).toMatchObject({
      fromId: 100,
      toId: 101,
      relation: '前传',
      direct: true,
    });
    expect(result.related.map((item) => item.id)).toEqual([101, 102, 103, 106, 105, 104]);
    expect(result.related.find((item) => item.id === 104)).toMatchObject({
      includedInWatchOrder: false,
      exclusionReason: 'media_type_not_anime',
    });
    expect(result.related.find((item) => item.id === 105)).toMatchObject({
      includedInWatchOrder: false,
      exclusionReason: 'relation_not_watch_step',
    });
    expect(result.coverage).toMatchObject({
      depth: 0,
      media: 'all',
      nonAnimeEvidenceLimit: 8,
      detailsAttempted: 4,
      detailsFetched: 4,
      nonAnimeRowsReturned: 1,
    });
    expect(calls.some((url) => url.endsWith('/104'))).toBe(false);
    expect(calls.some((url) => url.endsWith('/105'))).toBe(false);
  });

  it('composes only same-direction deeper paths and preserves reverse/mixed evidence', async () => {
    const { service } = fixture({
      subjects: [
        subject(100),
        subject(101),
        subject(102),
        subject(104),
        subject(105),
        subject(106),
      ],
      relations: {
        100: [relation(102, '续集'), relation(101, '前传')],
        101: [relation(104, '前传'), relation(105, '续集')],
        102: [relation(104, '前传'), relation(106, '相关作品')],
        104: [],
        105: [],
        106: [],
      },
    });

    const result = await service.getSeriesWatchOrder(100, { depth: 2 });

    expect(ids(result)).toContain(104);
    expect(result.watchOrder.find((item) => item.id === 104)).toMatchObject({
      placement: 'before_root',
      derivedDepth: 2,
    });
    expect(result.watchOrder.find((item) => item.id === 104)?.relationPaths).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ pathKinds: ['prequel', 'prequel'], direct: false }),
        expect.objectContaining({ pathKinds: ['sequel', 'prequel'], direct: false }),
      ]),
    );
    expect(result.excluded.samples).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 105, reason: 'depth_evidence_only' }),
        expect.objectContaining({ id: 106, reason: 'depth_evidence_only' }),
      ]),
    );
    expect(result.watchOrder.map((item) => item.id)).not.toContain(105);
    expect(result.watchOrder.map((item) => item.id)).not.toContain(106);
  });

  it('retains every safe direct seed when duplicate after-root labels lead to a deeper sequel', async () => {
    const { service, calls } = fixture({
      subjects: [subject(100), subject(110), subject(120)],
      relations: {
        100: [relation(110, '外传'), relation(110, '续集')],
        110: [relation(120, '续集')],
        120: [],
      },
    });

    const result = await service.getSeriesWatchOrder(100, { depth: 2 });

    expect(ids(result)).toEqual([100, 110, 120]);
    expect(result.watchOrder.find((item) => item.id === 120)).toMatchObject({
      placement: 'after_root',
      derivedDepth: 2,
    });
    expect(result.watchOrder.find((item) => item.id === 120)?.relationPaths).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ pathKinds: ['sequel', 'sequel'], direct: false }),
        expect.objectContaining({ pathKinds: ['side_story', 'sequel'], direct: false }),
      ]),
    );
    expect(calls.filter((url) => url.endsWith('/110/subjects'))).toHaveLength(1);
  });

  it('excludes a direct prequel/sequel conflict instead of guessing a side', async () => {
    const { service } = fixture({
      subjects: [subject(100)],
      relations: {
        100: [relation(201, '前传'), relation(201, '续集')],
      },
    });

    const result = await service.getSeriesWatchOrder(100, { depth: 1 });

    expect(ids(result)).toEqual([100]);
    expect(result.state).toBe('partial');
    expect(result.excluded.byReason).toEqual([
      { reason: 'conflicting_direct_relations', count: 1 },
    ]);
    expect(result.excluded.samples[0]).toMatchObject({
      id: 201,
      reason: 'conflicting_direct_relations',
      relationLabels: ['前传', '续集'],
    });
    expect(result.warnings.join(' ')).toContain('方向冲突');
  });

  it('keeps anime node and detail budgets separate from media=all evidence', async () => {
    const base = fixture({
      subjects: [subject(100), subject(301), subject(302), subject(303)],
      relations: {
        100: [
          relation(301, '原作', 1, '小说原作'),
          relation(302, '游戏', 4),
          relation(303, '续集'),
        ],
      },
    });
    const animeOnly = await base.service.getSeriesWatchOrder(100, {
      depth: 0,
      maxNodes: 1,
      media: 'anime',
    });
    const allMedia = await base.service.getSeriesWatchOrder(100, {
      depth: 0,
      maxNodes: 1,
      media: 'all',
    });

    expect(animeOnly.watchOrder.map((item) => item.id)).toEqual([100, 303]);
    expect(animeOnly.related.map((item) => item.id)).toEqual([303]);
    expect(animeOnly.state).toBe('partial');
    expect(allMedia.watchOrder.map((item) => item.id)).toEqual([100, 303]);
    expect(allMedia.related.map((item) => item.id)).toEqual([303, 301, 302]);
    expect(allMedia.coverage).toMatchObject({
      maxNodes: 1,
      animeNodeLimit: 1,
      nonAnimeEvidenceLimit: 8,
      relatedLimit: 9,
      animeNodesSelected: 1,
      nonAnimeRowsReturned: 2,
      detailsAttempted: 1,
    });
    expect(base.calls.filter((url) => /\/subjects\/(301|302)$/.test(url))).toHaveLength(0);
  });

  it('does not compute anime steps or traverse from a non-anime root', async () => {
    const { service, calls } = fixture({
      subjects: [subject(100, 1), subject(701), subject(702, 1)],
      relations: {
        100: [relation(701, '续集'), relation(702, '原作', 1)],
      },
    });

    const result = await service.getSeriesWatchOrder(100, { depth: 2, media: 'all' });

    expect(result.watchOrder).toEqual([]);
    expect(result.state).toBe('not_computable');
    expect(result.capabilityStates.watchOrder).toBe('not_computable');
    expect(result.coverage).toMatchObject({
      relationRequests: 1,
      detailsAttempted: 0,
      animeNodesSelected: 0,
      nonAnimeRowsReturned: 1,
    });
    expect(result.related).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 701, exclusionReason: 'root_not_anime' }),
        expect.objectContaining({ id: 702, exclusionReason: 'root_not_anime' }),
      ]),
    );
    expect(calls.some((url) => url.includes('/701/subjects'))).toBe(false);
    expect(calls.some((url) => url.endsWith('/701'))).toBe(false);
  });

  it('removes a selected candidate when detail hydration reveals a non-anime media type', async () => {
    const { service } = fixture({
      subjects: [subject(100), subject(703, 1)],
      relations: {
        100: [relation(703, '续集')],
      },
    });

    const result = await service.getSeriesWatchOrder(100, { depth: 0, media: 'all' });

    expect(result.watchOrder.map((item) => item.id)).toEqual([100]);
    expect(result.coverage).toMatchObject({
      animeNodesSelected: 0,
      detailsAttempted: 1,
      detailsFetched: 1,
      nonAnimeRowsReturned: 1,
    });
    expect(result.related[0]).toMatchObject({
      id: 703,
      type: 'book',
      exclusionReason: 'media_type_not_anime',
    });
    expect(result.warnings.join(' ')).toContain('详情媒介不是动画');
  });

  it('records optional relation and detail failures without fabricating completeness', async () => {
    const { service, calls } = fixture({
      subjects: [subject(100), subject(401), subject(402)],
      relations: {
        100: [relation(401, '续集'), relation(402, '续集')],
        402: [],
      },
      failedRelations: [401],
      failedDetails: [402],
    });

    const result = await service.getSeriesWatchOrder(100, { depth: 1 });

    expect(result.state).toBe('partial');
    expect(result.coverage).toMatchObject({
      relationFailures: 1,
      detailsAttempted: 2,
      detailsFetched: 1,
      detailsFailed: 1,
    });
    expect(result.evidence.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: '/v0/subjects/401/subjects',
          status: 'failed',
        }),
        expect.objectContaining({ path: '/v0/subjects/402', status: 'failed' }),
      ]),
    );
    expect(result.watchOrder.find((item) => item.id === 402)).toMatchObject({
      id: 402,
      name: '作品 402',
    });
    expect(calls.some((url) => url.endsWith('/401/subjects'))).toBe(true);
  });

  it('does not fabricate a series result when the required root detail fails', async () => {
    const { service } = fixture({
      subjects: [subject(100)],
      relations: {},
      failedDetails: [100],
    });

    await expect(service.getSeriesWatchOrder(100)).rejects.toThrow('detail unavailable');
  });

  it('does not fabricate a series result when the required root relation read fails', async () => {
    const { service } = fixture({
      subjects: [subject(100)],
      relations: {},
      failedRelations: [100],
    });

    await expect(service.getSeriesWatchOrder(100)).rejects.toThrow('relation unavailable');
  });

  it('handles back-edges with a bounded visited set and keeps a deeper boundary deterministic', async () => {
    const { service } = fixture({
      subjects: [subject(100), subject(501), subject(502)],
      relations: {
        100: [relation(501, '续集')],
        501: [relation(502, '续集')],
        502: [relation(501, '前传')],
      },
    });

    const result = await service.getSeriesWatchOrder(100, { depth: 2 });

    expect(ids(result)).toEqual([100, 501, 502]);
    expect(result.coverage.relationRequests).toBe(3);
    expect(result.watchOrder.find((item) => item.id === 502)).toMatchObject({
      derivedDepth: 2,
      placement: 'after_root',
    });
    expect(result.watchOrder.find((item) => item.id === 501)?.relationPaths).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ pathKinds: ['sequel'], direct: true }),
        expect.objectContaining({ pathKinds: ['sequel', 'sequel', 'prequel'], direct: false }),
      ]),
    );
  });

  it('uses ID tie-breaking, exposes node-cap exclusions, and marks 64-edge truncation', async () => {
    const rows = Array.from({ length: 70 }, (_, index) => relation(600 + index, '续集'));
    const subjects = [subject(100), ...rows.slice(0, 16).map((item) => subject(item.id))];
    const { service } = fixture({ subjects, relations: { 100: rows } });

    const result = await service.getSeriesWatchOrder(100, { depth: 0, maxNodes: 1 });

    expect(ids(result)).toEqual([100, 600]);
    expect(result.coverage).toMatchObject({
      uniqueRelatedObserved: 70,
      animeNodesSelected: 1,
      edgeEvidenceLimit: 64,
      edgeEvidenceReturned: 64,
      edgeEvidenceTruncated: true,
    });
    expect(result.state).toBe('partial');
    expect(result.excluded.byReason).toEqual([{ reason: 'node_cap', count: 69 }]);
    expect(result.related.map((item) => item.id)).toEqual([600]);
  });
});
