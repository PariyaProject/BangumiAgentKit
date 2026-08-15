import { describe, expect, it } from 'vitest';
import { GeneratedBangumiOpenApiClient } from '@bangumi-agent-kit/bangumi-openapi';
import {
  CollectionSeriesService,
  type CollectionSeriesResult,
} from '@bangumi-agent-kit/bangumi-core';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function collectionRow(id: number, subjectType = 2, type = 3): Record<string, unknown> {
  return {
    subject_id: id,
    subject_type: subjectType,
    type,
    rate: id + 5,
    comment: 'private comment must not be returned',
    subject: {
      id,
      type: subjectType,
      name: 'Original ' + id,
      name_cn: '条目 ' + id,
      date: '2026-01-01',
      eps: 12,
    },
  };
}

function relation(id: number, relationLabel: string, type = 2): Record<string, unknown> {
  return {
    id,
    type,
    name: 'Related ' + id,
    name_cn: '关联 ' + id,
    relation: relationLabel,
  };
}

function buildClient(fetchFn: typeof fetch): GeneratedBangumiOpenApiClient {
  return new GeneratedBangumiOpenApiClient(new HttpClient({ fetchFn }));
}

describe('CollectionSeriesService', () => {
  it('groups current-account anime collections with bounded direct relation evidence', async () => {
    const requests: URL[] = [];
    const fetchFn: typeof fetch = async (input) => {
      const url = new URL(String(input));
      requests.push(url);
      if (url.pathname.endsWith('/collections')) {
        return response({
          total: 5,
          limit: 50,
          offset: Number(url.searchParams.get('offset') || 0),
          data: [
            collectionRow(1),
            collectionRow(2),
            collectionRow(3),
            collectionRow(4),
            collectionRow(5, 1),
          ],
        });
      }
      const subjectId = Number(url.pathname.split('/').at(-2));
      const rows: Record<number, unknown[]> = {
        1: [relation(2, '续集'), relation(2, '前传'), relation(5, '原作')],
        2: [relation(1, '前传'), relation(3, '衍生'), relation(4, '关联条目')],
        3: [relation(2, '续集')],
        4: [],
      };
      return response(rows[subjectId] || []);
    };

    const result = await new CollectionSeriesService(
      buildClient(fetchFn),
    ).getCollectionSeriesGroups('bound-user');

    expect(result.state).toBe('conflict');
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0]?.items.map((item) => item.subjectId)).toEqual([1, 2, 3]);
    expect(result.groups[0]?.state).toBe('conflict');
    expect(result.groups[0]?.edges.map((edge) => edge.relation)).toContain('续集');
    expect(result.ungrouped.map((item) => item.subjectId)).toEqual([4]);
    expect(result.summary).toMatchObject({
      collectionRowsObserved: 5,
      eligibleAnimeItems: 4,
      groupedItems: 3,
      ungroupedItems: 1,
      relationSubjectsRequested: 4,
      relationSubjectsSucceeded: 4,
      conflictEdges: 3,
    });
    expect(result.excludedRelations.unknownRelations).toBe(1);
    expect(result.coverage.relations.concurrency).toBe(3);
    expect(JSON.stringify(result)).not.toContain('private comment');
    expect(requests.filter((url) => url.pathname.endsWith('/collections'))).toHaveLength(1);
    expect(requests.filter((url) => url.pathname.endsWith('/subjects'))).toHaveLength(4);
  });

  it('records collection, relation, and output caps instead of presenting a complete graph', async () => {
    let relationRequests = 0;
    const fetchFn: typeof fetch = async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/collections')) {
        return response({
          total: 3,
          limit: 50,
          offset: 0,
          data: [collectionRow(1), collectionRow(2), collectionRow(3)],
        });
      }
      relationRequests += 1;
      return response([relation(2, '续集'), relation(3, '衍生'), relation(2, '前传')]);
    };

    const result = await new CollectionSeriesService(
      buildClient(fetchFn),
    ).getCollectionSeriesGroups('bound-user', {
      maxRelationSubjects: 1,
      maxRelationsPerSubject: 1,
      maxGroups: 1,
      maxEdges: 1,
    });

    expect(relationRequests).toBe(1);
    expect(result.state).toBe('partial');
    expect(result.coverage.relations).toMatchObject({
      requestedSubjects: 1,
      subjectBudgetExceeded: true,
      truncatedSubjects: 1,
      rowsReturned: 1,
    });
    expect(result.coverage.output).toMatchObject({
      returnedGroups: 1,
      returnedEdges: 1,
    });
    expect(result.warnings.map((warning) => warning.code)).toEqual(
      expect.arrayContaining(['RELATION_SUBJECT_CAP', 'RELATION_ROW_CAP']),
    );
  });

  it('keeps duplicate collection rows and empty collections explicit', async () => {
    const duplicateResult = await new CollectionSeriesService(
      buildClient(async (input) => {
        const url = new URL(String(input));
        if (url.pathname.endsWith('/collections')) {
          return response({
            total: 2,
            limit: 50,
            offset: 0,
            data: [collectionRow(1), collectionRow(1)],
          });
        }
        return response([]);
      }),
    ).getCollectionSeriesGroups('bound-user');

    expect(duplicateResult.state).toBe('complete');
    expect(duplicateResult.coverage.collection).toMatchObject({
      rowsObserved: 2,
      uniqueRows: 1,
      duplicateRows: 1,
    });
    expect(duplicateResult.warnings.map((warning) => warning.code)).toContain(
      'DUPLICATE_COLLECTION_ROWS',
    );

    const emptyResult = await new CollectionSeriesService(
      buildClient(async (input) => {
        const url = new URL(String(input));
        if (url.pathname.endsWith('/collections')) {
          return response({ total: 0, limit: 50, offset: 0, data: [] });
        }
        return response([]);
      }),
    ).getCollectionSeriesGroups('bound-user');

    expect(emptyResult).toMatchObject({
      state: 'complete',
      groups: [],
      ungrouped: [],
      summary: { eligibleAnimeItems: 0, relationSubjectsRequested: 0 },
    });
    expect(emptyResult.coverage.collection.sourceExhausted).toBe(true);
  });

  it('retains relation read failures as partial coverage with subject-level diagnostics', async () => {
    const result = await new CollectionSeriesService(
      buildClient(async (input) => {
        const url = new URL(String(input));
        if (url.pathname.endsWith('/collections')) {
          return response({
            total: 2,
            limit: 50,
            offset: 0,
            data: [collectionRow(1), collectionRow(2)],
          });
        }
        const subjectId = Number(url.pathname.split('/').at(-2));
        return subjectId === 1 ? response({ message: 'relation down' }, 503) : response([]);
      }),
    ).getCollectionSeriesGroups('bound-user');

    expect(result.state).toBe('partial');
    expect(result.relationFailures).toHaveLength(1);
    expect(result.relationFailures[0]).toMatchObject({
      subjectId: 1,
      message: expect.any(String),
    });
    expect(result.coverage.relations.failedSubjects).toBe(1);
    expect(result.warnings.map((warning) => warning.code)).toContain('RELATION_READ_FAILURE');
  });

  it('preserves an authenticated-source failure as an unavailable result', async () => {
    const result: CollectionSeriesResult = await new CollectionSeriesService(
      buildClient(async () => response({ message: 'login required' }, 401)),
    ).getCollectionSeriesGroups('bound-user');

    expect(result.state).toBe('auth_required');
    expect(result.groups).toEqual([]);
    expect(result.coverage.relations.attemptedSubjects).toBe(0);
    expect(result.error?.code).toBe('AUTH_REQUIRED');
  });
});
