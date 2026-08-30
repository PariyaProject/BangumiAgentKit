import { describe, expect, it, vi } from 'vitest';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import {
  SubjectIndexMembershipService,
  SUBJECT_INDEX_MEMBERSHIP_MAX_INDEX_ID,
} from '@bangumi-agent-kit/bangumi-core';

function clientFor(responses: Array<{ body?: unknown; status?: number }>): {
  client: HttpClient;
  fetch: ReturnType<typeof vi.fn>;
} {
  const fetch = vi.fn().mockImplementation(async () => {
    const next = responses.shift();
    if (!next) throw new Error('unexpected request');
    return new Response(next.body === undefined ? '' : JSON.stringify(next.body), {
      status: next.status ?? 200,
      headers: { 'content-type': 'application/json' },
    });
  });
  return { client: new HttpClient({ fetchFn: fetch }), fetch };
}

describe('SubjectIndexMembershipService', () => {
  it('returns exact matches and observed-scope non-matches after bounded pagination', async () => {
    const { client, fetch } = clientFor([
      {
        body: {
          total: 3,
          data: [
            { id: 10, order: 1 },
            { id: 41529, order: 2 },
          ],
        },
      },
      { body: { total: 3, data: [{ id: 11, order: 3 }] } },
      { body: { total: 1, data: [{ id: 99, order: 1 }] } },
    ]);
    const service = new SubjectIndexMembershipService(client);

    const result = await service.getSubjectIndexMembership(41529, [101, 102], {
      pageSize: 2,
      maxPages: 3,
      maxRows: 5,
    });

    expect(result.state).toBe('complete');
    expect(result.summary).toEqual({
      requested: 2,
      matched: 1,
      notMatchedInObservedScope: 1,
      unknown: 0,
    });
    expect(result.indexes[0]).toMatchObject({
      indexId: 101,
      state: 'complete',
      membership: 'matched',
      matches: [{ subjectId: 41529, order: 2 }],
      coverage: {
        pagesAttempted: 2,
        pagesSucceeded: 2,
        rowsObserved: 3,
        total: 3,
        totalKind: 'exact',
        upstreamExhausted: true,
      },
    });
    expect(result.indexes[1]).toMatchObject({
      indexId: 102,
      state: 'complete',
      membership: 'not_matched_in_observed_scope',
      matches: [],
    });
    expect(result.evidence).toHaveLength(2);
    expect(result.evidence[0]).toMatchObject({
      operation: 'GET /v0/indices/{index_id}/subjects',
      fieldPath: 'data[].id',
      observation: 'matched',
    });
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(String(fetch.mock.calls[0]?.[0])).toContain('/v0/indices/101/subjects?limit=2&offset=0');
    expect(String(fetch.mock.calls[1]?.[0])).toContain('/v0/indices/101/subjects?limit=2&offset=2');
  });

  it('keeps an incomplete scan unknown and records upstream failures per index', async () => {
    const { client } = clientFor([
      { body: { total: 4, data: [{ id: 1 }, { id: 2 }] } },
      { status: 503, body: { message: 'temporarily unavailable' } },
    ]);
    const service = new SubjectIndexMembershipService(client);

    const result = await service.getSubjectIndexMembership(41529, [201, 202], {
      pageSize: 2,
      maxPages: 1,
      maxRows: 4,
    });

    expect(result.state).toBe('partial');
    expect(result.summary).toMatchObject({ matched: 0, notMatchedInObservedScope: 0, unknown: 2 });
    expect(result.indexes[0]).toMatchObject({
      state: 'partial',
      membership: 'unknown',
      coverage: { completionReason: 'page_cap', truncated: true },
    });
    expect(result.indexes[1]).toMatchObject({
      state: 'unavailable',
      membership: 'unknown',
      error: { code: 'UPSTREAM_UNAVAILABLE' },
      coverage: { completionReason: 'upstream_error', pagesSucceeded: 0 },
    });
  });

  it('does not call an over-returned page complete when the row cap hid data', async () => {
    const { client } = clientFor([
      {
        body: {
          total: 100,
          data: Array.from({ length: 3 }, (_, index) => ({ id: index + 1 })),
        },
      },
    ]);
    const service = new SubjectIndexMembershipService(client);

    const result = await service.getSubjectIndexMembership(41529, [301], {
      pageSize: 2,
      maxPages: 2,
      maxRows: 2,
    });

    expect(result.indexes[0]).toMatchObject({
      state: 'partial',
      membership: 'unknown',
      coverage: { completionReason: 'row_cap', truncated: true, rowsObserved: 2 },
    });
  });

  it('rejects duplicate and out-of-range IDs before any request', async () => {
    const { client, fetch } = clientFor([]);
    const service = new SubjectIndexMembershipService(client);

    await expect(service.getSubjectIndexMembership(41529, [1, 1])).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    await expect(
      service.getSubjectIndexMembership(41529, [SUBJECT_INDEX_MEMBERSHIP_MAX_INDEX_ID + 1]),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(fetch).not.toHaveBeenCalled();
  });
});
