import { describe, expect, it } from 'vitest';
import { GeneratedBangumiOpenApiClient } from '@bangumi-agent-kit/bangumi-openapi';
import { BangumiError, HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import {
  CollectionBacklogService,
  COLLECTION_BACKLOG_DEFAULT_MAX_EPISODES_PER_SUBJECT,
  parseEpisodeDurationSeconds,
} from '@bangumi-agent-kit/bangumi-core';

function buildClient(fetchFn: typeof fetch): GeneratedBangumiOpenApiClient {
  return new GeneratedBangumiOpenApiClient(new HttpClient({ fetchFn }));
}

function collectionRow(
  subjectId: number,
  type: number,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    subject_id: subjectId,
    subject_type: 2,
    type,
    rate: 0,
    comment: 'private comment must not be returned',
    tags: [],
    ep_status: 0,
    vol_status: 0,
    updated_at: '2026-08-14T00:00:00.000Z',
    private: true,
    subject: {
      id: subjectId,
      type: 2,
      name: `Original ${subjectId}`,
      name_cn: `中文 ${subjectId}`,
      short_summary: '',
      eps: 3,
      volumes: 0,
      collection_total: 10,
      score: 8,
      rank: 100,
      tags: [],
      images: { large: `https://img.example/${subjectId}.jpg` },
      date: '2026-01-01',
    },
    ...extra,
  };
}

function episodeRow(
  id: number,
  type: number,
  collectionType: number,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    type: collectionType,
    updated_at: 1_723_600_000,
    episode: {
      id,
      subject_id: 1,
      type,
      name: `Episode ${id}`,
      name_cn: `第 ${id} 集`,
      sort: id,
      ep: id,
      airdate: '2026-01-01',
      duration: '24m',
      ...extra,
    },
  };
}

describe('CollectionBacklogService', () => {
  it('parses explicit duration formats without guessing ambiguous values', () => {
    expect(parseEpisodeDurationSeconds('24m')).toBe(24 * 60);
    expect(parseEpisodeDurationSeconds('00:59')).toBe(59);
    expect(parseEpisodeDurationSeconds('00:24:00')).toBe(24 * 60);
    expect(parseEpisodeDurationSeconds('1h 30m')).toBe(90 * 60);
    expect(parseEpisodeDurationSeconds('00:60')).toBeUndefined();
    expect(parseEpisodeDurationSeconds('1:99')).toBeUndefined();
    expect(parseEpisodeDurationSeconds('01:59:59')).toBe(1 * 3600 + 59 * 60 + 59);
    expect(parseEpisodeDurationSeconds('01:60:00')).toBeUndefined();
    expect(parseEpisodeDurationSeconds('01:00:60')).toBeUndefined();
    expect(parseEpisodeDurationSeconds('runtime unknown')).toBeUndefined();
    expect(parseEpisodeDurationSeconds('0m')).toBeUndefined();
  });

  it('joins current-account collection rows with main-episode progress without exposing comments', async () => {
    const fetchFn: typeof fetch = async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/collections')) {
        return new Response(
          JSON.stringify({
            total: 2,
            limit: 50,
            offset: 0,
            data: [
              collectionRow(1, 3, {
                ep_status: 1,
                subject: { ...(collectionRow(1, 3).subject as Record<string, unknown>), eps: 2 },
              }),
              collectionRow(2, 1, { ep_status: 0 }),
            ],
          }),
          { status: 200 },
        );
      }
      if (url.pathname.endsWith('/collections/1/episodes')) {
        return new Response(
          JSON.stringify({
            total: 2,
            limit: 100,
            offset: 0,
            data: [episodeRow(1, 0, 2), episodeRow(2, 0, 1)],
          }),
          { status: 200 },
        );
      }
      if (url.pathname.endsWith('/collections/2/episodes')) {
        return new Response(
          JSON.stringify({
            total: 3,
            limit: 100,
            offset: 0,
            data: [episodeRow(3, 0, 1), episodeRow(4, 0, 1), episodeRow(5, 0, 1)],
          }),
          { status: 200 },
        );
      }
      throw new Error(`unexpected request: ${url}`);
    };

    const result = await new CollectionBacklogService(buildClient(fetchFn)).getCollectionBacklog(
      'account-owner',
    );

    expect(result.state).toBe('complete');
    expect(result.coverage.hydration.succeededSubjects).toBe(2);
    expect(result.data.summary.knownRemainingEpisodes).toBe(4);
    expect(result.data.items[0]).toMatchObject({
      subjectId: 1,
      watchedEpisodes: 1,
      wishEpisodes: 1,
      episodeReportedEpisodes: 2,
      remainingEpisodes: 1,
      completionPercentage: 50,
      airingState: 'finished',
      state: 'complete',
    });
    expect(result.data.items[1]).toMatchObject({
      subjectId: 2,
      watchedEpisodes: 0,
      remainingEpisodes: 3,
      episodeReportedEpisodes: 3,
      completionPercentage: 0,
      state: 'complete',
    });
    expect(JSON.stringify(result)).not.toContain('private comment');
    expect(result.evidence[1]?.formulaVersion).toBe('collection-backlog-v2');
  });

  it('calculates observed pending minutes and stably sorts known estimates before unknown ones', async () => {
    const fetchFn: typeof fetch = async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/collections')) {
        return new Response(
          JSON.stringify({
            total: 3,
            limit: 50,
            offset: 0,
            data: [
              collectionRow(1, 3, {
                ep_status: 1,
                subject: { ...(collectionRow(1, 3).subject as Record<string, unknown>), eps: 2 },
              }),
              collectionRow(2, 3, {
                subject: { ...(collectionRow(2, 3).subject as Record<string, unknown>), eps: 2 },
              }),
              collectionRow(3, 3, {
                subject: { ...(collectionRow(3, 3).subject as Record<string, unknown>), eps: 1 },
              }),
            ],
          }),
          { status: 200 },
        );
      }
      const subjectId = Number(url.pathname.split('/').at(-2));
      if (subjectId === 1) {
        return new Response(
          JSON.stringify({
            total: 2,
            limit: 100,
            offset: 0,
            data: [
              episodeRow(1, 0, 2, { duration_seconds: 1500, duration: '24m' }),
              episodeRow(2, 0, 1, { duration: '30m' }),
            ],
          }),
          { status: 200 },
        );
      }
      if (subjectId === 2) {
        return new Response(
          JSON.stringify({
            total: 2,
            limit: 100,
            offset: 0,
            data: [
              episodeRow(1, 0, 1, { duration_seconds: 600 }),
              episodeRow(2, 0, 1, { duration: 'not supplied' }),
            ],
          }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          total: 1,
          limit: 100,
          offset: 0,
          data: [episodeRow(1, 0, 1, { duration: '45m' })],
        }),
        { status: 200 },
      );
    };

    const result = await new CollectionBacklogService(buildClient(fetchFn)).getCollectionBacklog(
      'account-owner',
      { sortBy: 'estimated_minutes_desc' },
    );

    expect(result.data.sortBy).toBe('estimated_minutes_desc');
    expect(result.data.items.map((item) => item.subjectId)).toEqual([3, 1, 2]);
    expect(result.data.items[0]).toMatchObject({
      subjectId: 3,
      plannedEpisodes: 1,
      knownDurationEpisodes: 1,
      unknownDurationEpisodes: 0,
      estimatedRemainingMinutes: 45,
      durationSource: 'raw',
      durationState: 'complete',
    });
    expect(result.data.items[1]).toMatchObject({
      subjectId: 1,
      plannedEpisodes: 1,
      knownDurationEpisodes: 1,
      estimatedRemainingMinutes: 30,
      durationSource: 'raw',
      durationState: 'complete',
    });
    expect(result.data.items[2]).toMatchObject({
      subjectId: 2,
      plannedEpisodes: 2,
      knownDurationEpisodes: 1,
      unknownDurationEpisodes: 1,
      estimatedRemainingMinutes: 10,
      durationSource: 'server',
      durationState: 'partial',
    });
    expect(result.data.summary).toMatchObject({
      knownEstimatedRemainingMinutes: 85,
      durationCompleteItems: 2,
      durationPartialItems: 1,
      unknownDurationEpisodes: 1,
    });
    expect(result.warnings.some((warning) => warning.code === 'UNKNOWN_EPISODE_DURATIONS')).toBe(
      true,
    );
  });

  it('keeps malformed progress rows in explicit partial duration coverage', async () => {
    const fetchFn: typeof fetch = async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/collections')) {
        return new Response(
          JSON.stringify({
            total: 1,
            limit: 50,
            offset: 0,
            data: [
              collectionRow(1, 3, {
                subject: { ...(collectionRow(1, 3).subject as Record<string, unknown>), eps: 2 },
              }),
            ],
          }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          total: 2,
          limit: 100,
          offset: 0,
          data: [
            { type: 1, updated_at: 1_723_600_000 },
            episodeRow(2, 0, 1, { id: 0, duration: '24m' }),
          ],
        }),
        { status: 200 },
      );
    };

    const result = await new CollectionBacklogService(buildClient(fetchFn)).getCollectionBacklog(
      'account-owner',
      { sortBy: 'estimated_minutes_desc' },
    );
    const row = result.data.items[0];

    expect(result.state).toBe('partial');
    expect(row).toMatchObject({
      state: 'partial',
      plannedEpisodes: 2,
      knownDurationEpisodes: 0,
      unknownDurationEpisodes: 2,
      durationState: 'not_computable',
    });
    expect(row?.estimatedRemainingMinutes).toBeUndefined();
    expect(row?.reasons).toEqual(
      expect.arrayContaining([
        'episode progress row lacks episode metadata',
        'episode progress row lacks a valid episode ID',
      ]),
    );
    expect(result.data.summary.knownEstimatedRemainingMinutes).toBeUndefined();
  });

  it('does not fabricate aggregate minutes when episode hydration is unavailable', async () => {
    const fetchFn: typeof fetch = async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/collections')) {
        return new Response(
          JSON.stringify({ total: 1, limit: 50, offset: 0, data: [collectionRow(1, 3)] }),
          { status: 200 },
        );
      }
      throw new BangumiError('PERMISSION_DENIED', 'no episode permission', false, 403);
    };

    const result = await new CollectionBacklogService(buildClient(fetchFn)).getCollectionBacklog(
      'account-owner',
    );

    expect(result.state).toBe('partial');
    expect(result.data.summary.knownEstimatedRemainingMinutes).toBeUndefined();
    expect(result.data.items[0]).toMatchObject({
      state: 'unavailable',
      durationState: 'not_computable',
    });
    expect(result.data.items[0]?.estimatedRemainingMinutes).toBeUndefined();
  });

  it('reports a genuinely empty account backlog as not-applicable zero', async () => {
    const fetchFn: typeof fetch = async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/collections')) {
        return new Response(JSON.stringify({ total: 0, limit: 50, offset: 0, data: [] }), {
          status: 200,
        });
      }
      throw new Error(`unexpected request: ${url}`);
    };

    const result = await new CollectionBacklogService(buildClient(fetchFn)).getCollectionBacklog(
      'account-owner',
    );

    expect(result.state).toBe('complete');
    expect(result.data.items).toEqual([]);
    expect(result.data.summary.knownEstimatedRemainingMinutes).toBe(0);
  });

  it('does not fabricate completion when the source total is missing', async () => {
    const fetchFn: typeof fetch = async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/collections')) {
        return new Response(
          JSON.stringify({
            total: 1,
            limit: 50,
            offset: 0,
            data: [collectionRow(1, 3, { ep_status: 1 })],
          }),
          { status: 200 },
        );
      }
      if (url.pathname.endsWith('/collections/1/episodes')) {
        return new Response(
          JSON.stringify({ limit: 100, offset: 0, data: [episodeRow(1, 0, 2)] }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ total: 0, limit: 100, offset: 0, data: [] }), {
        status: 200,
      });
    };

    const result = await new CollectionBacklogService(buildClient(fetchFn)).getCollectionBacklog(
      'account-owner',
    );
    const row = result.data.items[0];

    expect(result.state).toBe('not_computable');
    expect(row?.state).toBe('not_computable');
    expect(row?.sourceReportedEpisodes).toBe(3);
    expect(row?.episodeReportedEpisodes).toBeUndefined();
    expect(row?.remainingEpisodes).toBeUndefined();
    expect(row?.completionPercentage).toBeUndefined();
    expect(result.warnings.some((warning) => warning.code === 'NOT_COMPUTABLE_ROWS')).toBe(true);
  });

  it('does not certify completion when a malformed source total accompanies episode rows', async () => {
    const fetchFn: typeof fetch = async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/collections')) {
        return new Response(
          JSON.stringify({
            total: 1,
            limit: 50,
            offset: 0,
            data: [collectionRow(1, 3, { ep_status: 1 })],
          }),
          { status: 200 },
        );
      }
      if (url.pathname.endsWith('/collections/1/episodes')) {
        return new Response(
          JSON.stringify({ total: 0, limit: 100, offset: 0, data: [episodeRow(1, 0, 2)] }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ total: 0, limit: 100, offset: 0, data: [] }), {
        status: 200,
      });
    };

    const result = await new CollectionBacklogService(buildClient(fetchFn)).getCollectionBacklog(
      'account-owner',
    );

    expect(result.state).toBe('not_computable');
    expect(result.data.items[0]).toMatchObject({
      state: 'not_computable',
      episodeReportedEpisodes: undefined,
      remainingEpisodes: undefined,
    });
  });

  it('rejects divergent SlimSubject and episode source totals', async () => {
    const fetchFn: typeof fetch = async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/collections')) {
        return new Response(
          JSON.stringify({
            total: 1,
            limit: 50,
            offset: 0,
            data: [
              collectionRow(1, 3, {
                ep_status: 0,
                subject: { ...(collectionRow(1, 3).subject as Record<string, unknown>), eps: 3 },
              }),
            ],
          }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          total: 2,
          limit: 100,
          offset: 0,
          data: [episodeRow(1, 0, 1), episodeRow(2, 0, 1)],
        }),
        { status: 200 },
      );
    };

    const result = await new CollectionBacklogService(buildClient(fetchFn)).getCollectionBacklog(
      'account-owner',
    );

    expect(result.state).toBe('conflict');
    expect(result.data.items[0]).toMatchObject({
      sourceReportedEpisodes: 3,
      episodeReportedEpisodes: 2,
      denominatorSource: 'none',
      remainingEpisodes: undefined,
      state: 'conflict',
    });
    expect(result.data.items[0]?.reasons[0]).toContain('SlimSubject.eps');
  });

  it.each([
    ['fraction', 2.5],
    ['negative', -1],
    ['numeric string', '2'],
    ['unsafe integer', Number.MAX_SAFE_INTEGER + 1],
  ])(
    'preserves malformed SlimSubject totals instead of treating %s as absent',
    async (_label, eps) => {
      const fetchFn: typeof fetch = async (input) => {
        const url = new URL(String(input));
        if (url.pathname.endsWith('/collections')) {
          return new Response(
            JSON.stringify({
              total: 1,
              limit: 50,
              offset: 0,
              data: [
                collectionRow(1, 3, {
                  ep_status: 1,
                  subject: { ...(collectionRow(1, 3).subject as Record<string, unknown>), eps },
                }),
              ],
            }),
            { status: 200 },
          );
        }
        return new Response(
          JSON.stringify({
            total: 2,
            limit: 100,
            offset: 0,
            data: [episodeRow(1, 0, 2), episodeRow(2, 0, 1)],
          }),
          { status: 200 },
        );
      };

      const result = await new CollectionBacklogService(buildClient(fetchFn)).getCollectionBacklog(
        'account-owner',
      );

      expect(result.state).toBe('conflict');
      expect(result.data.items[0]).toMatchObject({
        sourceReportedEpisodes: undefined,
        sourceReportedEpisodesRaw: eps,
        sourceReportedEpisodesValidity: 'invalid',
        denominatorSource: 'none',
        remainingEpisodes: undefined,
      });
    },
  );

  it('preserves permission errors as an actionable top-level state', async () => {
    const fetchFn: typeof fetch = async () =>
      new Response(JSON.stringify({ title: 'Forbidden' }), { status: 403 });

    const result = await new CollectionBacklogService(buildClient(fetchFn)).getCollectionBacklog(
      'account-owner',
    );

    expect(result.state).toBe('permission_denied');
    expect(result.error).toMatchObject({ code: 'PERMISSION_DENIED' });
    expect(result.warnings[0]).toMatchObject({
      code: 'PERMISSION_DENIED',
      state: 'permission_denied',
    });
  });

  it('reports partial when only part of the returned backlog is not computable', async () => {
    const fetchFn: typeof fetch = async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/collections')) {
        return new Response(
          JSON.stringify({
            total: 2,
            limit: 50,
            offset: 0,
            data: [
              collectionRow(1, 3, {
                ep_status: 1,
                subject: { ...(collectionRow(1, 3).subject as Record<string, unknown>), eps: 1 },
              }),
              collectionRow(2, 3, {
                ep_status: 0,
                subject: { ...(collectionRow(2, 3).subject as Record<string, unknown>), eps: 0 },
              }),
            ],
          }),
          { status: 200 },
        );
      }
      if (url.pathname.endsWith('/collections/1/episodes')) {
        return new Response(
          JSON.stringify({ total: 1, limit: 100, offset: 0, data: [episodeRow(1, 0, 2)] }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ total: 0, limit: 100, offset: 0, data: [] }), {
        status: 200,
      });
    };

    const result = await new CollectionBacklogService(buildClient(fetchFn)).getCollectionBacklog(
      'account-owner',
    );

    expect(result.state).toBe('partial');
    expect(result.data.summary.notComputableItems).toBe(1);
    expect(result.data.summary.completeItems).toBe(1);
  });

  it('uses a complete episode source total when SlimSubject.eps is missing', async () => {
    const fetchFn: typeof fetch = async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/collections')) {
        return new Response(
          JSON.stringify({
            total: 1,
            limit: 50,
            offset: 0,
            data: [
              collectionRow(1, 3, {
                ep_status: 1,
                subject: { ...(collectionRow(1, 3).subject as Record<string, unknown>), eps: 0 },
              }),
            ],
          }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({ total: 1, limit: 100, offset: 0, data: [episodeRow(1, 0, 2)] }),
        { status: 200 },
      );
    };

    const result = await new CollectionBacklogService(buildClient(fetchFn)).getCollectionBacklog(
      'account-owner',
    );

    expect(result.state).toBe('complete');
    expect(result.data.items[0]).toMatchObject({
      sourceReportedEpisodes: undefined,
      episodeReportedEpisodes: 1,
      denominatorSource: 'episode_collection',
      remainingEpisodes: 0,
      completionPercentage: 100,
    });
  });

  it('preserves a conflict when collection ep_status disagrees with episode progress', async () => {
    const fetchFn: typeof fetch = async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/collections')) {
        return new Response(
          JSON.stringify({
            total: 1,
            limit: 50,
            offset: 0,
            data: [
              collectionRow(1, 3, {
                ep_status: 2,
                subject: { ...(collectionRow(1, 3).subject as Record<string, unknown>), eps: 1 },
              }),
            ],
          }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({ total: 1, limit: 100, offset: 0, data: [episodeRow(1, 0, 2)] }),
        { status: 200 },
      );
    };

    const result = await new CollectionBacklogService(buildClient(fetchFn)).getCollectionBacklog(
      'account-owner',
    );

    expect(result.state).toBe('conflict');
    expect(result.data.items[0]?.state).toBe('conflict');
    expect(result.data.items[0]?.completionPercentage).toBeUndefined();
    expect(result.warnings.some((warning) => warning.code === 'PROGRESS_CONFLICT')).toBe(true);
  });

  it('keeps airing completion explicit when episode dates are missing or future', async () => {
    const fetchFn: typeof fetch = async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/collections')) {
        return new Response(
          JSON.stringify({
            total: 1,
            limit: 50,
            offset: 0,
            data: [
              collectionRow(1, 3, {
                ep_status: 0,
                subject: { ...(collectionRow(1, 3).subject as Record<string, unknown>), eps: 2 },
              }),
            ],
          }),
          { status: 200 },
        );
      }
      const first = episodeRow(1, 0, 1);
      const second = episodeRow(2, 0, 1);
      delete (first.episode as Record<string, unknown>).airdate;
      (second.episode as Record<string, unknown>).airdate = '2999-01-01';
      return new Response(
        JSON.stringify({ total: 2, limit: 100, offset: 0, data: [first, second] }),
        { status: 200 },
      );
    };

    const result = await new CollectionBacklogService(buildClient(fetchFn)).getCollectionBacklog(
      'account-owner',
    );

    expect(result.state).toBe('complete');
    expect(result.data.items[0]?.airingState).toBe('unknown');
    expect(result.data.items[0]?.reasons).toContain(
      '正篇 episode metadata 缺少 airdate，完结状态无法计算',
    );
  });

  it('reports ongoing when every observed main episode has a future airdate', async () => {
    const fetchFn: typeof fetch = async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/collections')) {
        return new Response(
          JSON.stringify({
            total: 1,
            limit: 50,
            offset: 0,
            data: [
              collectionRow(1, 3, {
                ep_status: 0,
                subject: { ...(collectionRow(1, 3).subject as Record<string, unknown>), eps: 2 },
              }),
            ],
          }),
          { status: 200 },
        );
      }
      const first = episodeRow(1, 0, 1);
      const second = episodeRow(2, 0, 1);
      (first.episode as Record<string, unknown>).airdate = '2999-01-01';
      (second.episode as Record<string, unknown>).airdate = '2999-01-02';
      return new Response(
        JSON.stringify({ total: 2, limit: 100, offset: 0, data: [first, second] }),
        { status: 200 },
      );
    };

    const result = await new CollectionBacklogService(buildClient(fetchFn)).getCollectionBacklog(
      'account-owner',
    );

    expect(result.state).toBe('complete');
    expect(result.data.items[0]?.airingState).toBe('ongoing');
  });

  it('requires valid unique main rows and parseable dates before certifying airing state', async () => {
    const cases = [
      {
        label: 'missing episode id',
        reason: '正篇 episode evidence 缺少可验证章节 ID，无法证明完结状态',
        rows: () => {
          const first = episodeRow(1, 0, 1);
          delete (first.episode as Record<string, unknown>).id;
          return [first, episodeRow(2, 0, 1)];
        },
      },
      {
        label: 'non-main episode',
        reason: '正篇 episode evidence 含非正篇章节，无法证明完结状态',
        rows: () => {
          const first = episodeRow(1, 1, 1);
          return [first, episodeRow(2, 0, 1)];
        },
      },
      {
        label: 'malformed airdate',
        reason: '正篇 episode airdate 格式无法验证，完结状态无法计算',
        rows: () => {
          const first = episodeRow(1, 0, 1);
          (first.episode as Record<string, unknown>).airdate = '2026-02-30';
          return [first, episodeRow(2, 0, 1)];
        },
      },
      {
        label: 'non-string airdate',
        reason: '正篇 episode airdate 格式无法验证，完结状态无法计算',
        rows: () => {
          const first = episodeRow(1, 0, 1);
          (first.episode as Record<string, unknown>).airdate = 1_723_600_000;
          return [first, episodeRow(2, 0, 1)];
        },
      },
    ];

    for (const testCase of cases) {
      const fetchFn: typeof fetch = async (input) => {
        const url = new URL(String(input));
        if (url.pathname.endsWith('/collections')) {
          return new Response(
            JSON.stringify({
              total: 1,
              limit: 50,
              offset: 0,
              data: [
                collectionRow(1, 3, {
                  ep_status: 0,
                  subject: { ...(collectionRow(1, 3).subject as Record<string, unknown>), eps: 2 },
                }),
              ],
            }),
            { status: 200 },
          );
        }
        return new Response(
          JSON.stringify({ total: 2, limit: 100, offset: 0, data: testCase.rows() }),
          { status: 200 },
        );
      };

      const result = await new CollectionBacklogService(buildClient(fetchFn)).getCollectionBacklog(
        'account-owner',
      );

      expect(result.data.items[0]?.airingState, testCase.label).toBe('unknown');
      expect(result.data.items[0]?.airingReason, testCase.label).toBe(testCase.reason);
    }
  });

  it('marks episode progress partial when the per-subject bound is reached', async () => {
    let episodeRequests = 0;
    const fetchFn: typeof fetch = async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/collections')) {
        return new Response(
          JSON.stringify({
            total: 1,
            limit: 50,
            offset: 0,
            data: [
              collectionRow(1, 3, {
                ep_status: 2,
                subject: { ...(collectionRow(1, 3).subject as Record<string, unknown>), eps: 5 },
              }),
            ],
          }),
          { status: 200 },
        );
      }
      episodeRequests += 1;
      return new Response(
        JSON.stringify({
          total: 5,
          limit: 2,
          offset: (episodeRequests - 1) * 2,
          data: [episodeRow(1, 0, 2), episodeRow(2, 0, 2)],
        }),
        { status: 200 },
      );
    };

    const result = await new CollectionBacklogService(buildClient(fetchFn)).getCollectionBacklog(
      'account-owner',
      { maxEpisodesPerSubject: 2 },
    );

    expect(result.state).toBe('partial');
    expect(result.coverage.episodeProgress.truncatedSubjects).toBe(1);
    expect(result.data.items[0]?.remainingEpisodes).toBeUndefined();
    expect(result.data.items[0]?.progressCoverage.truncated).toBe(true);
    expect(result.coverage.episodeProgress.maxEpisodesPerSubject).toBe(2);
  });

  it('does not certify complete coverage when collection pagination repeats a row', async () => {
    const fetchFn: typeof fetch = async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/collections')) {
        const row = collectionRow(1, 3, {
          ep_status: 1,
          subject: { ...(collectionRow(1, 3).subject as Record<string, unknown>), eps: 1 },
        });
        return new Response(JSON.stringify({ total: 2, limit: 50, offset: 0, data: [row, row] }), {
          status: 200,
        });
      }
      return new Response(
        JSON.stringify({ total: 1, limit: 100, offset: 0, data: [episodeRow(1, 0, 2)] }),
        { status: 200 },
      );
    };

    const result = await new CollectionBacklogService(buildClient(fetchFn)).getCollectionBacklog(
      'account-owner',
    );

    expect(result.state).toBe('partial');
    expect(result.coverage.collection).toMatchObject({
      observedRows: 2,
      uniqueRows: 1,
      duplicateRows: 1,
    });
    expect(result.warnings.some((warning) => warning.code === 'COLLECTION_DUPLICATE_ROWS')).toBe(
      true,
    );
  });

  it('does not certify complete coverage when episode pagination repeats a row', async () => {
    const fetchFn: typeof fetch = async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/collections')) {
        return new Response(
          JSON.stringify({
            total: 1,
            limit: 50,
            offset: 0,
            data: [
              collectionRow(1, 3, {
                ep_status: 1,
                subject: { ...(collectionRow(1, 3).subject as Record<string, unknown>), eps: 2 },
              }),
            ],
          }),
          { status: 200 },
        );
      }
      const row = episodeRow(1, 0, 2);
      return new Response(JSON.stringify({ total: 2, limit: 100, offset: 0, data: [row, row] }), {
        status: 200,
      });
    };

    const result = await new CollectionBacklogService(buildClient(fetchFn)).getCollectionBacklog(
      'account-owner',
    );

    expect(result.state).toBe('partial');
    expect(result.data.items[0]).toMatchObject({
      state: 'partial',
      remainingEpisodes: undefined,
      airingState: 'unknown',
      progressCoverage: { duplicateRows: 1, uniqueRows: 1 },
    });
    expect(result.warnings.some((warning) => warning.code === 'PARTIAL_EPISODE_PROGRESS')).toBe(
      true,
    );
  });

  it('preserves accumulated episode coverage when a later page fails', async () => {
    const fetchFn: typeof fetch = async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/collections')) {
        return new Response(
          JSON.stringify({
            total: 1,
            limit: 50,
            offset: 0,
            data: [
              collectionRow(1, 3, {
                ep_status: 1,
                subject: { ...(collectionRow(1, 3).subject as Record<string, unknown>), eps: 101 },
              }),
            ],
          }),
          { status: 200 },
        );
      }
      if (url.searchParams.get('offset') === '0') {
        return new Response(
          JSON.stringify({
            total: 101,
            limit: 100,
            offset: 0,
            data: Array.from({ length: 100 }, (_, index) =>
              episodeRow(index + 1, 0, index === 0 ? 2 : 1),
            ),
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ title: 'temporarily unavailable' }), { status: 503 });
    };

    const result = await new CollectionBacklogService(buildClient(fetchFn)).getCollectionBacklog(
      'account-owner',
    );

    expect(result.state).toBe('partial');
    expect(result.data.items[0]).toMatchObject({
      state: 'partial',
      error: { code: 'UPSTREAM_UNAVAILABLE' },
      observedProgressRows: 100,
      progressCoverage: {
        pagesAttempted: 2,
        pagesSucceeded: 1,
        observedRows: 100,
        uniqueRows: 100,
        pageFailureOffset: 100,
        pageFailureCode: 'UPSTREAM_UNAVAILABLE',
      },
    });
    expect(result.coverage.episodeProgress).toMatchObject({
      observedRows: 100,
      uniqueRows: 100,
      pagesAttempted: 2,
      pagesSucceeded: 1,
    });
    expect(result.data.items[0]?.remainingEpisodes).toBeUndefined();
    expect(
      result.warnings.some((warning) => warning.code === 'EPISODE_COLLECTION_PAGE_FAILURE'),
    ).toBe(true);
  });

  it('preserves a per-subject permission failure on the unavailable row', async () => {
    const fetchFn: typeof fetch = async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/collections')) {
        return new Response(
          JSON.stringify({
            total: 1,
            limit: 50,
            offset: 0,
            data: [collectionRow(1, 3, { ep_status: 0 })],
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ title: 'Forbidden' }), { status: 403 });
    };

    const result = await new CollectionBacklogService(buildClient(fetchFn)).getCollectionBacklog(
      'account-owner',
    );

    expect(result.state).toBe('partial');
    expect(result.data.items[0]).toMatchObject({
      state: 'unavailable',
      error: { code: 'PERMISSION_DENIED' },
      reasons: ['PERMISSION_DENIED'],
    });
  });

  it('preserves a conflict when episode source totals change between pages', async () => {
    let episodeRequests = 0;
    const fetchFn: typeof fetch = async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/collections')) {
        return new Response(
          JSON.stringify({
            total: 1,
            limit: 50,
            offset: 0,
            data: [
              collectionRow(1, 3, {
                ep_status: 1,
                subject: { ...(collectionRow(1, 3).subject as Record<string, unknown>), eps: 2 },
              }),
            ],
          }),
          { status: 200 },
        );
      }
      episodeRequests += 1;
      if (episodeRequests === 1) {
        return new Response(
          JSON.stringify({ total: 2, limit: 1, offset: 0, data: [episodeRow(1, 0, 2)] }),
          { status: 200 },
        );
      }
      if (episodeRequests === 2) {
        return new Response(
          JSON.stringify({ total: 3, limit: 1, offset: 1, data: [episodeRow(2, 0, 1)] }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ total: 3, limit: 1, offset: 2, data: [] }), {
        status: 200,
      });
    };

    const result = await new CollectionBacklogService(buildClient(fetchFn)).getCollectionBacklog(
      'account-owner',
    );

    expect(result.state).toBe('conflict');
    expect(result.coverage.episodeProgress.sourceTotalChangedSubjects).toBe(1);
    expect(result.warnings.some((warning) => warning.code === 'EPISODE_SOURCE_TOTAL_CHANGED')).toBe(
      true,
    );
  });

  it('caps max episode input using the service ceiling', async () => {
    const fetchFn: typeof fetch = async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/collections')) {
        return new Response(
          JSON.stringify({
            total: 0,
            limit: 50,
            offset: 0,
            data: [],
          }),
          { status: 200 },
        );
      }
      throw new Error(`unexpected request: ${url}`);
    };

    const result = await new CollectionBacklogService(buildClient(fetchFn)).getCollectionBacklog(
      'account-owner',
      { maxEpisodesPerSubject: Number.MAX_SAFE_INTEGER },
    );

    expect(result.coverage.episodeProgress.maxEpisodesPerSubject).toBe(
      COLLECTION_BACKLOG_DEFAULT_MAX_EPISODES_PER_SUBJECT * 5,
    );
  });
});
