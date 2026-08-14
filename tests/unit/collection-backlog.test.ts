import { describe, expect, it } from 'vitest';
import { GeneratedBangumiOpenApiClient } from '@bangumi-agent-kit/bangumi-openapi';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import {
  CollectionBacklogService,
  COLLECTION_BACKLOG_DEFAULT_MAX_EPISODES_PER_SUBJECT,
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

function episodeRow(id: number, type: number, collectionType: number): Record<string, unknown> {
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
    },
  };
}

describe('CollectionBacklogService', () => {
  it('joins current-account collection rows with main-episode progress without exposing comments', async () => {
    const fetchFn: typeof fetch = async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/collections')) {
        return new Response(
          JSON.stringify({
            total: 2,
            limit: 50,
            offset: 0,
            data: [collectionRow(1, 3, { ep_status: 1 }), collectionRow(2, 1, { ep_status: 0 })],
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
        return new Response(JSON.stringify({ total: 0, limit: 100, offset: 0, data: [] }), {
          status: 200,
        });
      }
      throw new Error(`unexpected request: ${url}`);
    };

    const result = await new CollectionBacklogService(buildClient(fetchFn)).getCollectionBacklog(
      'account-owner',
    );

    expect(result.state).toBe('complete');
    expect(result.coverage.hydration.succeededSubjects).toBe(2);
    expect(result.data.summary.knownRemainingEpisodes).toBe(5);
    expect(result.data.items[0]).toMatchObject({
      subjectId: 1,
      watchedEpisodes: 1,
      wishEpisodes: 1,
      remainingEpisodes: 2,
      completionPercentage: 33.3,
      state: 'complete',
    });
    expect(result.data.items[1]).toMatchObject({
      subjectId: 2,
      watchedEpisodes: 0,
      remainingEpisodes: 3,
      completionPercentage: 0,
      state: 'complete',
    });
    expect(JSON.stringify(result)).not.toContain('private comment');
    expect(result.evidence[1]?.formulaVersion).toBe('collection-backlog-v1');
  });

  it('does not fabricate completion when the source total is missing', async () => {
    const fetchFn: typeof fetch = async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/collections')) {
        const subject = collectionRow(1, 3).subject as Record<string, unknown>;
        return new Response(
          JSON.stringify({
            total: 1,
            limit: 50,
            offset: 0,
            data: [collectionRow(1, 3, { ep_status: 1, subject: { ...subject, eps: 0 } })],
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
    const row = result.data.items[0];

    expect(result.state).toBe('not_computable');
    expect(row?.state).toBe('not_computable');
    expect(row?.remainingEpisodes).toBeUndefined();
    expect(row?.completionPercentage).toBeUndefined();
    expect(result.warnings.some((warning) => warning.code === 'NOT_COMPUTABLE_ROWS')).toBe(true);
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
              collectionRow(1, 3, { ep_status: 1 }),
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

  it('preserves a conflict when collection ep_status disagrees with episode progress', async () => {
    const fetchFn: typeof fetch = async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/collections')) {
        return new Response(
          JSON.stringify({
            total: 1,
            limit: 50,
            offset: 0,
            data: [collectionRow(1, 3, { ep_status: 2 })],
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
            data: [collectionRow(1, 3, { ep_status: 2 })],
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
