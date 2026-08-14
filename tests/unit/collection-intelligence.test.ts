import { describe, expect, it } from 'vitest';
import { GeneratedBangumiOpenApiClient } from '@bangumi-agent-kit/bangumi-openapi';
import {
  CollectionIntelligenceService,
  buildCollectionIntelligence,
} from '@bangumi-agent-kit/bangumi-core';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';

function collectionRow(
  subjectId: number,
  type: number,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    subject_id: subjectId,
    type,
    rate: subjectId === 1 ? 9 : 7,
    comment: 'private comment must not be copied into intelligence output',
    tags: subjectId === 1 ? ['favorite', 'scifi'] : ['scifi'],
    ep_status: subjectId === 1 ? 6 : 0,
    updated_at: subjectId === 1 ? '2026-08-14T10:00:00.000Z' : '2026-08-13T10:00:00.000Z',
    subject: {
      id: subjectId,
      type: 2,
      name: `Original ${subjectId}`,
      name_cn: `中文 ${subjectId}`,
    },
    ...extra,
  };
}

function buildClient(fetchFn: typeof fetch): GeneratedBangumiOpenApiClient {
  return new GeneratedBangumiOpenApiClient(new HttpClient({ fetchFn }));
}

describe('CollectionIntelligenceService', () => {
  it('paginates a bounded current-account collection and derives truthful metrics', async () => {
    const fetchFn: typeof fetch = async (input) => {
      const url = new URL(String(input));
      const offset = Number(url.searchParams.get('offset'));
      if (offset === 0) {
        return new Response(
          JSON.stringify({
            total: 3,
            limit: 2,
            offset: 0,
            data: [collectionRow(1, 3), collectionRow(2, 1)],
          }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          total: 3,
          limit: 2,
          offset: 2,
          data: [collectionRow(3, 2, { rate: undefined, tags: [], ep_status: 12 })],
        }),
        { status: 200 },
      );
    };

    const result = await new CollectionIntelligenceService(
      buildClient(fetchFn),
    ).getCollectionIntelligence('account-owner', { maxItems: 10 });

    expect(result.state).toBe('partial');
    expect(result.coverage.sourceTotal).toBe(3);
    expect(result.coverage.observedRows).toBe(3);
    expect(result.coverage.uniqueItems).toBe(3);
    expect(result.coverage.pagesSucceeded).toBe(2);
    expect(result.coverage.sourceExhausted).toBe(true);
    expect(result.data.statusCounts.done).toBe(1);
    expect(result.data.statusCounts.wish).toBe(1);
    expect(result.data.statusCounts.doing).toBe(1);
    expect(result.data.backlog.total).toBe(1);
    expect(result.data.ratings.rated).toBe(2);
    expect(result.data.ratings.average).toBe(8);
    expect(result.data.progress.completedEpisodes).toBe(18);
    expect(result.data.tags.top[0]).toEqual({ tag: 'scifi', count: 2 });
    expect(result.data.latestObservedUpdates[0]?.subjectId).toBe(1);
    expect(result.source.retrievedAt).toBeDefined();
    expect(Date.parse(result.source.retrievedAt!)).toBeGreaterThanOrEqual(
      Date.parse(result.source.attemptedAt),
    );
    expect(JSON.stringify(result)).not.toContain('private comment');
  });

  it('retains successful pages and marks a later upstream failure partial', async () => {
    const fetchFn: typeof fetch = async (input) => {
      const url = new URL(String(input));
      if (url.searchParams.get('offset') === '0') {
        return new Response(
          JSON.stringify({
            total: 2,
            limit: 1,
            offset: 0,
            data: [collectionRow(1, 3)],
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ message: 'temporary failure' }), { status: 503 });
    };

    const result = await new CollectionIntelligenceService(
      buildClient(fetchFn),
    ).getCollectionIntelligence('account-owner', { maxItems: 10 });

    expect(result.state).toBe('partial');
    expect(result.coverage.observedRows).toBe(1);
    expect(result.coverage.pageFailureOffset).toBe(1);
    expect(result.coverage.pageFailureCode).toBe('UPSTREAM_UNAVAILABLE');
    expect(result.warnings.some((warning) => warning.code === 'UPSTREAM_PAGE_FAILURE')).toBe(true);
  });

  it('returns unavailable without fabricating data when the first page fails', async () => {
    const fetchFn: typeof fetch = async () =>
      new Response(JSON.stringify({ message: 'unauthorized' }), { status: 401 });

    const result = await new CollectionIntelligenceService(
      buildClient(fetchFn),
    ).getCollectionIntelligence('account-owner');

    expect(result.state).toBe('unavailable');
    expect(result.data.backlog.total).toBe(0);
    expect(result.coverage.sourceTotal).toBeUndefined();
    expect(result.coverage.pagesSucceeded).toBe(0);
    expect(result.error?.code).toBe('AUTH_REQUIRED');
    expect(result.source.retrievedAt).toBeUndefined();
  });

  it('deduplicates source rows and enforces formula coverage on incomplete fields', () => {
    const result = buildCollectionIntelligence(
      [
        {
          subjectId: 1,
          subjectName: 'One',
          status: 'done',
          rating: 8,
          tags: ['x'],
          epStatus: 1,
          updatedAt: '2026-08-14T00:00:00.000Z',
        },
        {
          subjectId: 1,
          subjectName: 'One duplicate',
          status: 'done',
        },
        {
          subjectId: 2,
          subjectName: 'Two',
          status: 'wish',
        },
      ],
      {
        sourceTotal: 3,
        requestedMaxItems: 10,
        pageSize: 50,
        pagesAttempted: 1,
        pagesSucceeded: 1,
        maxPages: 8,
        sourceExhausted: true,
        paginationStalled: false,
        sourceTotalChanged: false,
        attemptedAt: '2026-08-14T00:00:00.000Z',
        retrievedAt: '2026-08-14T00:00:01.000Z',
      },
    );

    expect(result.state).toBe('partial');
    expect(result.coverage.duplicateRows).toBe(1);
    expect(result.coverage.uniqueItems).toBe(2);
    expect(result.coverage.missingFields['item.rating']).toBe(1);
    expect(result.evidence[1]?.formulaVersion).toBe('collection-intelligence-v1');
  });

  it('maps contract subject_type and rate zero without degrading complete coverage', async () => {
    const fetchFn: typeof fetch = async () =>
      new Response(
        JSON.stringify({
          total: 1,
          limit: 1,
          offset: 0,
          data: [
            collectionRow(1, 2, {
              subject_type: 2,
              subject: undefined,
              rate: 0,
              tags: [],
              ep_status: 0,
            }),
          ],
        }),
        { status: 200 },
      );

    const result = await new CollectionIntelligenceService(
      buildClient(fetchFn),
    ).getCollectionIntelligence('account-owner', { maxItems: 1 });

    expect(result.state).toBe('complete');
    expect(result.data.subjectTypeCounts.anime).toBe(1);
    expect(result.data.ratings.rated).toBe(0);
    expect(result.coverage.missingFields['item.rating.invalid']).toBeUndefined();
  });

  it('marks long tags partial instead of silently rewriting their identity', () => {
    const result = buildCollectionIntelligence(
      [
        {
          subjectId: 1,
          subjectType: 'anime',
          status: 'done',
          rating: 0,
          tags: ['x'.repeat(65)],
          epStatus: 0,
          updatedAt: '2026-08-14T00:00:00.000Z',
        },
      ],
      {
        sourceTotal: 1,
        requestedMaxItems: 1,
        pageSize: 1,
        pagesAttempted: 1,
        pagesSucceeded: 1,
        maxPages: 8,
        sourceExhausted: true,
        paginationStalled: false,
        sourceTotalChanged: false,
        attemptedAt: '2026-08-14T00:00:00.000Z',
        retrievedAt: '2026-08-14T00:00:01.000Z',
      },
    );

    expect(result.state).toBe('partial');
    expect(result.coverage.skippedTagValues).toBe(1);
    expect(result.data.tags.top).toEqual([]);
    expect(result.warnings.some((warning) => warning.code === 'OUTPUT_TRUNCATED')).toBe(true);
  });

  it('stops after a pagination offset stalls instead of repeating the same page', async () => {
    let requests = 0;
    const fetchFn: typeof fetch = async (input) => {
      requests += 1;
      const offset = Number(new URL(String(input)).searchParams.get('offset'));
      if (offset === 0) {
        return new Response(
          JSON.stringify({
            total: 10,
            limit: 2,
            offset: 0,
            data: [collectionRow(1, 3), collectionRow(2, 3)],
          }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          total: 10,
          limit: 2,
          offset: 1,
          data: [collectionRow(1, 3)],
        }),
        { status: 200 },
      );
    };

    const result = await new CollectionIntelligenceService(
      buildClient(fetchFn),
    ).getCollectionIntelligence('account-owner', { maxItems: 10 });

    expect(requests).toBe(2);
    expect(result.coverage.paginationStalled).toBe(true);
    expect(result.warnings.some((warning) => warning.code === 'PAGINATION_STALLED')).toBe(true);
  });
});
