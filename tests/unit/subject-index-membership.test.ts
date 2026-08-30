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

  it('keeps malformed rows from producing an observed-scope negative', async () => {
    const { client } = clientFor([
      {
        body: {
          total: 2,
          data: [{ id: 1 }, { id: '41529' }],
        },
      },
    ]);
    const service = new SubjectIndexMembershipService(client);

    const result = await service.getSubjectIndexMembership(41529, [401], {
      pageSize: 2,
      maxPages: 2,
      maxRows: 4,
    });

    expect(result.indexes[0]).toMatchObject({
      state: 'partial',
      membership: 'unknown',
      coverage: {
        malformedRows: 1,
        integrity: 'inconsistent',
        completionReason: 'invalid_response',
        truncated: true,
      },
      warnings: [{ code: 'INDEX_MEMBERSHIP_INVALID_RESPONSE', state: 'partial' }],
    });
    expect(result.summary).toMatchObject({ matched: 0, notMatchedInObservedScope: 0, unknown: 1 });
  });

  it('preserves an exact positive when the same page also has malformed evidence', async () => {
    const { client } = clientFor([
      {
        body: {
          total: 2,
          data: [{ id: 41529 }, { id: null }],
        },
      },
    ]);
    const service = new SubjectIndexMembershipService(client);

    const result = await service.getSubjectIndexMembership(41529, [402], {
      pageSize: 2,
      maxPages: 1,
      maxRows: 2,
    });

    expect(result.indexes[0]).toMatchObject({ state: 'partial', membership: 'matched' });
    expect(result.indexes[0]?.evidence[0]).toMatchObject({
      observation: 'matched',
      observationScope: 'successful_pages',
    });
    expect(result.summary).toMatchObject({ matched: 1, notMatchedInObservedScope: 0, unknown: 0 });
  });

  it('rejects contradictory totals and short pages before declaring exhaustion', async () => {
    const { client } = clientFor([{ body: { total: 4, data: [{ id: 1 }] } }]);
    const service = new SubjectIndexMembershipService(client);

    const result = await service.getSubjectIndexMembership(41529, [403], {
      pageSize: 2,
      maxPages: 2,
      maxRows: 4,
    });

    expect(result.indexes[0]).toMatchObject({
      state: 'partial',
      membership: 'unknown',
      coverage: { integrity: 'inconsistent', completionReason: 'invalid_response' },
    });
    expect(result.indexes[0]?.warnings[0]?.message).toContain('short_page_before_total');
  });

  it('rejects changing totals and stalled duplicate pages as incomplete evidence', async () => {
    const { client } = clientFor([
      { body: { total: 4, data: [{ id: 1 }, { id: 2 }] } },
      { body: { total: 5, data: [{ id: 1 }, { id: 2 }] } },
    ]);
    const service = new SubjectIndexMembershipService(client);

    const result = await service.getSubjectIndexMembership(41529, [406], {
      pageSize: 2,
      maxPages: 3,
      maxRows: 6,
    });

    expect(result.indexes[0]).toMatchObject({
      state: 'partial',
      membership: 'unknown',
      coverage: {
        duplicateRows: 2,
        integrity: 'inconsistent',
        completionReason: 'invalid_response',
      },
    });
    expect(result.indexes[0]?.warnings[0]?.message).toContain('changing_total');
  });

  it('does not expose a stale exact total after an upward total change', async () => {
    const { client } = clientFor([
      { body: { total: 4, data: [{ id: 41529 }, { id: 1 }] } },
      { body: { total: 5, data: [{ id: 2 }, { id: 3 }] } },
    ]);
    const service = new SubjectIndexMembershipService(client);

    const result = await service.getSubjectIndexMembership(41529, [408], {
      pageSize: 2,
      maxPages: 3,
      maxRows: 6,
    });

    expect(result.indexes[0]).toMatchObject({
      state: 'partial',
      membership: 'matched',
      coverage: { totalKind: 'unknown', integrity: 'inconsistent' },
    });
    expect(result.indexes[0]?.coverage).not.toHaveProperty('total');
  });

  it('does not expose a stale exact total after a downward total change', async () => {
    const { client } = clientFor([
      { body: { total: 5, data: [{ id: 41529 }, { id: 1 }] } },
      { body: { total: 4, data: [{ id: 2 }, { id: 3 }] } },
    ]);
    const service = new SubjectIndexMembershipService(client);

    const result = await service.getSubjectIndexMembership(41529, [409], {
      pageSize: 2,
      maxPages: 3,
      maxRows: 6,
    });

    expect(result.indexes[0]).toMatchObject({
      state: 'partial',
      membership: 'matched',
      coverage: { totalKind: 'unknown', integrity: 'inconsistent' },
    });
    expect(result.indexes[0]?.coverage).not.toHaveProperty('total');
  });

  it('does not expose a valid total after a later invalid total', async () => {
    const { client } = clientFor([
      { body: { total: 4, data: [{ id: 41529 }, { id: 1 }] } },
      { body: { total: '4', data: [{ id: 2 }, { id: 3 }] } },
    ]);
    const service = new SubjectIndexMembershipService(client);

    const result = await service.getSubjectIndexMembership(41529, [410], {
      pageSize: 2,
      maxPages: 3,
      maxRows: 6,
    });

    expect(result.indexes[0]).toMatchObject({
      state: 'partial',
      membership: 'matched',
      coverage: { totalKind: 'unknown', integrity: 'inconsistent' },
    });
    expect(result.indexes[0]?.coverage).not.toHaveProperty('total');
  });

  it('does not expose a declared total when rows extend beyond it', async () => {
    const { client } = clientFor([{ body: { total: 1, data: [{ id: 41529 }, { id: 1 }] } }]);
    const service = new SubjectIndexMembershipService(client);

    const result = await service.getSubjectIndexMembership(41529, [411], {
      pageSize: 2,
      maxPages: 1,
      maxRows: 2,
    });

    expect(result.indexes[0]).toMatchObject({
      state: 'partial',
      membership: 'matched',
      coverage: { totalKind: 'unknown', integrity: 'inconsistent' },
    });
    expect(result.indexes[0]?.coverage).not.toHaveProperty('total');
  });

  it('keeps a late not-found failure partial and retains prior positive evidence', async () => {
    const { client } = clientFor([
      { body: { total: 4, data: [{ id: 41529 }, { id: 1 }] } },
      { status: 404, body: { message: 'index disappeared' } },
    ]);
    const service = new SubjectIndexMembershipService(client);

    const result = await service.getSubjectIndexMembership(41529, [404], {
      pageSize: 2,
      maxPages: 2,
      maxRows: 4,
    });

    expect(result.state).toBe('partial');
    expect(result.indexes[0]).toMatchObject({
      state: 'partial',
      membership: 'matched',
      error: { code: 'NOT_FOUND' },
      coverage: {
        pagesSucceeded: 1,
        completionReason: 'upstream_error',
        truncated: true,
      },
    });
    expect(result.indexes[0]?.evidence[0]).toMatchObject({
      observation: 'matched',
      observationScope: 'successful_pages',
    });
  });

  it('does not fabricate official observation evidence for a first-page failure', async () => {
    const { client } = clientFor([{ status: 503, body: { message: 'temporarily unavailable' } }]);
    const service = new SubjectIndexMembershipService(client);

    const result = await service.getSubjectIndexMembership(41529, [405]);

    expect(result.indexes[0]).toMatchObject({
      state: 'unavailable',
      membership: 'unknown',
      evidence: [],
      source: { attemptedAt: expect.any(String) },
      coverage: { pagesAttempted: 1, pagesSucceeded: 0 },
    });
    expect(result.indexes[0]?.source).not.toHaveProperty('retrievedAt');
    expect(result.evidence).toEqual([]);
    expect(result.source).not.toHaveProperty('retrievedAt');
    expect(result.retrievedAt).toBeUndefined();
  });

  it('does not fabricate evidence when the first response cannot be parsed', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response('not-json', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const service = new SubjectIndexMembershipService(new HttpClient({ fetchFn: fetch }));

    const result = await service.getSubjectIndexMembership(41529, [407]);

    expect(result.indexes[0]).toMatchObject({
      state: 'unavailable',
      membership: 'unknown',
      evidence: [],
      error: { code: 'PARSER_ERROR' },
    });
    expect(result.indexes[0]?.source).not.toHaveProperty('retrievedAt');
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
