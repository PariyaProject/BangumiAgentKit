import { describe, expect, it, vi } from 'vitest';
import {
  RevisionService,
  SUBJECT_LATEST_REVISION_MAX_RESPONSE_BYTES,
} from '@bangumi-agent-kit/bangumi-core';
import { GeneratedBangumiOpenApiClient } from '@bangumi-agent-kit/bangumi-openapi';
import { BangumiError, HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { createReadTools } from '@bangumi-agent-kit/tools';

function fakeService(responses: unknown[]) {
  const request = vi.fn();
  for (const response of responses) request.mockResolvedValueOnce(response);
  const client = { request } as unknown as HttpClient;
  return { request, service: new RevisionService(client) };
}

function revisionList(overrides: Record<string, unknown> = {}) {
  return {
    total: 2,
    limit: 1,
    offset: 0,
    data: [
      {
        id: 1567985,
        type: 1,
        summary: '内容扩充',
        created_at: '2025-06-08T00:00:00Z',
        creator: { username: 'editor', nickname: '编辑者' },
      },
    ],
    ...overrides,
  };
}

function revisionDetail(data: unknown = { summary: '内容扩充', name_cn: '少女终末旅行' }) {
  return {
    id: 1567985,
    type: 1,
    summary: '内容扩充',
    created_at: '2025-06-08T00:00:00Z',
    creator: { username: 'editor', nickname: '编辑者' },
    data,
  };
}

describe('subject latest revision evidence contract', () => {
  it('reads exactly one offset-zero list item and one bounded detail', async () => {
    const fields = Object.fromEntries(
      Array.from({ length: 35 }, (_, index) => [`字段-${index}`, `值-${index}`]),
    );
    const { request, service } = fakeService([revisionList(), revisionDetail(fields)]);

    const result = await service.getLatestSubjectRevision(41529);

    expect(result).toMatchObject({
      state: 'partial',
      subjectId: 41529,
      selection: {
        strategy: 'offset-zero-source-order',
        limit: 1,
        offset: 0,
        revisionId: 1567985,
      },
      list: { observed: 1, returned: 1, total: 2, totalKind: 'exact', truncated: true },
      revision: { id: 1567985, summary: '内容扩充' },
      detail: {
        state: 'partial',
        payload: { shape: 'object', observedFields: 35, returnedFields: 32, omittedFields: 3 },
      },
    });
    expect(result.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: 'SOURCE_ORDER_BOUNDED' }),
        expect.objectContaining({ code: 'EXACT_DIFF_UNSUPPORTED' }),
        expect.objectContaining({ code: 'PAYLOAD_TRUNCATED' }),
      ]),
    );
    expect(request).toHaveBeenNthCalledWith(1, {
      method: 'GET',
      path: '/v0/revisions/subjects',
      query: { subject_id: 41529, limit: 1, offset: 0 },
      maxResponseBytes: SUBJECT_LATEST_REVISION_MAX_RESPONSE_BYTES,
      retryOptions: { maxRetries: 0 },
    });
    expect(request).toHaveBeenNthCalledWith(2, {
      method: 'GET',
      path: '/v0/revisions/subjects/1567985',
      maxResponseBytes: SUBJECT_LATEST_REVISION_MAX_RESPONSE_BYTES,
      retryOptions: { maxRetries: 0 },
    });
    expect(result.source.operations).toHaveLength(2);
    expect(result.evidence).toHaveLength(2);
  });

  it('preserves explicit null and unsupported detail payload states', async () => {
    const nullResult = await fakeService([
      revisionList({ total: 1 }),
      revisionDetail(null),
    ]).service.getLatestSubjectRevision(7);
    expect(nullResult.detail.payload).toMatchObject({ state: 'not_computable', shape: 'null' });
    expect(nullResult.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'PAYLOAD_NOT_COMPUTABLE' })]),
    );

    const unsupportedResult = await fakeService([
      revisionList({ total: 1 }),
      revisionDetail(['not', 'an', 'object']),
    ]).service.getLatestSubjectRevision(8);
    expect(unsupportedResult.detail.payload).toMatchObject({
      state: 'not_computable',
      shape: 'unsupported',
    });
    expect(unsupportedResult.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'PAYLOAD_UNSUPPORTED' })]),
    );
  });

  it('returns not_found without attempting a detail request for an empty page', async () => {
    const { request, service } = fakeService([{ total: 0, limit: 1, offset: 0, data: [] }]);

    const result = await service.getLatestSubjectRevision(41529);

    expect(result).toMatchObject({
      state: 'not_found',
      list: { observed: 0, returned: 0, total: 0 },
      detail: { state: 'not_computable' },
    });
    expect(result.revision).toBeUndefined();
    expect(request).toHaveBeenCalledTimes(1);
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'NO_REVISION_FOUND' })]),
    );
  });

  it('does not select a revision when source pagination or row metadata contradicts the request', async () => {
    const secondRevision = { ...revisionList().data[0], id: 1567986 };
    const cases = [
      { page: revisionList({ limit: 7 }), warningCode: 'SOURCE_SELECTION_UNVERIFIED' },
      { page: revisionList({ offset: 7 }), warningCode: 'SOURCE_SELECTION_UNVERIFIED' },
      {
        page: revisionList({ data: [revisionList().data[0], secondRevision], total: 2 }),
        warningCode: 'SOURCE_SELECTION_UNVERIFIED',
      },
      { page: revisionList({ total: 0 }), warningCode: 'SOURCE_SELECTION_UNVERIFIED' },
    ];

    for (const testCase of cases) {
      const { request, service } = fakeService([testCase.page]);
      const result = await service.getLatestSubjectRevision(41529);

      expect(result).toMatchObject({
        state: 'partial',
        detail: { state: 'not_computable' },
      });
      expect(result.revision).toBeUndefined();
      expect(result.warnings).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: testCase.warningCode })]),
      );
      expect(request).toHaveBeenCalledTimes(1);
    }
  });

  it('does not claim not_found when an empty page has a positive exact total', async () => {
    const { request, service } = fakeService([{ total: 5, limit: 1, offset: 0, data: [] }]);

    const result = await service.getLatestSubjectRevision(41529);

    expect(result).toMatchObject({
      state: 'partial',
      list: { state: 'partial', observed: 0, returned: 0, total: 5 },
      detail: { state: 'not_computable' },
    });
    expect(result.revision).toBeUndefined();
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'SOURCE_PAGE_CONTRADICTION' })]),
    );
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('keeps the selected list evidence when the detail read is unavailable', async () => {
    const { request, service } = fakeService([revisionList(), undefined]);
    request.mockReset();
    request.mockResolvedValueOnce(revisionList());
    request.mockRejectedValueOnce(new BangumiError('NETWORK_ERROR', 'offline', true));

    const result = await service.getLatestSubjectRevision(41529);

    expect(result).toMatchObject({
      state: 'partial',
      revision: { id: 1567985, summary: '内容扩充' },
      detail: { state: 'unavailable', payload: { state: 'not_computable' } },
      error: { code: 'NETWORK_ERROR' },
    });
    expect(result.evidence[1]).toMatchObject({
      operation: 'GET /v0/revisions/subjects/1567985',
    });
    expect(result.evidence[1]).not.toHaveProperty('retrievedAt');
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'UPSTREAM_NETWORK_ERROR' })]),
    );
  });

  it('turns list schema drift into unavailable without guessing a latest record', async () => {
    const { request, service } = fakeService([{ data: [{ id: 'wrong' }] }]);

    const result = await service.getLatestSubjectRevision(41529);

    expect(result.state).toBe('unavailable');
    expect(result.revision).toBeUndefined();
    expect(result.error).toMatchObject({ code: 'PARSER_ERROR' });
    expect(request).toHaveBeenCalledTimes(1);
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'SCHEMA_DRIFT' })]),
    );
  });

  it('preserves list evidence when the bounded detail response exceeds the byte limit', async () => {
    const client = new HttpClient({
      fetchFn: async (input) => {
        const url = new URL(String(input));
        if (url.pathname === '/v0/revisions/subjects') {
          return new Response(JSON.stringify(revisionList()), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          });
        }
        return new Response(JSON.stringify(revisionDetail()), {
          status: 200,
          headers: {
            'content-type': 'application/json',
            'content-length': String(SUBJECT_LATEST_REVISION_MAX_RESPONSE_BYTES + 1),
          },
        });
      },
    });
    const result = await new RevisionService(client).getLatestSubjectRevision(41529);

    expect(result).toMatchObject({
      state: 'partial',
      revision: { id: 1567985 },
      detail: { state: 'unavailable' },
      error: { code: 'RESPONSE_TOO_LARGE' },
    });
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'RESPONSE_TOO_LARGE' })]),
    );
  });

  it('bounds oversized list responses before selecting a revision', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(revisionList()), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'content-length': String(SUBJECT_LATEST_REVISION_MAX_RESPONSE_BYTES + 1),
        },
      }),
    );
    const result = await new RevisionService(new HttpClient({ fetchFn })).getLatestSubjectRevision(
      41529,
    );

    expect(result).toMatchObject({
      state: 'unavailable',
      detail: { state: 'unavailable' },
      error: { code: 'RESPONSE_TOO_LARGE' },
    });
    expect(result.revision).toBeUndefined();
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('bounds chunked list and detail responses without retry or extra fan-out', async () => {
    const oversizedChunkedResponse = () =>
      new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new Uint8Array(SUBJECT_LATEST_REVISION_MAX_RESPONSE_BYTES + 1));
            controller.close();
          },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );

    for (const phase of ['list', 'detail'] as const) {
      const fetchFn = vi.fn().mockImplementation(async (input) => {
        const url = new URL(String(input));
        if (url.pathname === '/v0/revisions/subjects') {
          return phase === 'list'
            ? oversizedChunkedResponse()
            : new Response(JSON.stringify(revisionList()), {
                status: 200,
                headers: { 'content-type': 'application/json' },
              });
        }
        return phase === 'detail'
          ? oversizedChunkedResponse()
          : new Response(JSON.stringify(revisionDetail()), {
              status: 200,
              headers: { 'content-type': 'application/json' },
            });
      });
      const result = await new RevisionService(
        new HttpClient({ fetchFn }),
      ).getLatestSubjectRevision(41529);

      expect(result.error).toMatchObject({ code: 'RESPONSE_TOO_LARGE' });
      expect(fetchFn).toHaveBeenCalledTimes(phase === 'list' ? 1 : 2);
      expect(result.state).toBe(phase === 'list' ? 'unavailable' : 'partial');
    }
  });

  it('preserves default retries for legacy revision detail callers', async () => {
    const detailResponse = () =>
      new Response(JSON.stringify(revisionDetail({ name_cn: '中文' })), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    const fetchFor = () => {
      let attempts = 0;
      return vi.fn().mockImplementation(async () => {
        attempts += 1;
        if (attempts === 1) throw new BangumiError('NETWORK_ERROR', 'temporary', true);
        return detailResponse();
      });
    };

    for (const entityType of ['subject', 'episode', 'character', 'person'] as const) {
      const fetchFn = fetchFor();
      const result = await new RevisionService(new HttpClient({ fetchFn })).getRevision(
        entityType,
        1567985,
      );
      expect(result.id).toBe(1567985);
      expect(fetchFn).toHaveBeenCalledTimes(2);
    }

    const generatedFetch = fetchFor();
    const generatedClient = new GeneratedBangumiOpenApiClient(
      new HttpClient({ fetchFn: generatedFetch }),
    );
    const generatedResult = await new RevisionService(generatedClient).getRevision(
      'subject',
      1567985,
    );
    expect(generatedResult.id).toBe(1567985);
    expect(generatedFetch).toHaveBeenCalledTimes(2);
  });

  it('keeps list metadata as the authoritative identity when detail identity or metadata conflicts', async () => {
    const identityConflict = await fakeService([
      revisionList({ total: 1 }),
      { ...revisionDetail(), id: 999999 },
    ]).service.getLatestSubjectRevision(41529);
    expect(identityConflict).toMatchObject({
      state: 'partial',
      revision: { id: 1567985, type: 1, summary: '内容扩充' },
      detail: { state: 'unavailable' },
      error: { code: 'PARSER_ERROR' },
    });
    expect(identityConflict.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'DETAIL_IDENTITY_CONFLICT' })]),
    );
    expect(identityConflict.evidence[1]?.retrievedAt).toBeTruthy();

    const metadataConflict = await fakeService([
      revisionList({ total: 1 }),
      {
        ...revisionDetail(),
        type: 2,
        summary: '不同摘要',
        created_at: '2026-01-01T00:00:00Z',
        creator: { username: 'different', nickname: '不同修订者' },
      },
    ]).service.getLatestSubjectRevision(41529);
    expect(metadataConflict).toMatchObject({
      state: 'partial',
      revision: {
        id: 1567985,
        type: 1,
        summary: '内容扩充',
        createdAt: '2025-06-08T00:00:00Z',
        creator: { username: 'editor', nickname: '编辑者' },
      },
      detail: { state: 'partial', payload: { state: 'complete' } },
    });
    expect(metadataConflict.warnings).toEqual(
      expect.arrayContaining([expect.objectContaining({ code: 'DETAIL_METADATA_CONFLICT' })]),
    );
  });

  it('registers a strict semantic tool with the same bounded service contract', async () => {
    const { request } = fakeService([
      revisionList({ total: 1 }),
      revisionDetail({ name_cn: '中文' }),
    ]);
    const tool = createReadTools({ request } as unknown as HttpClient).find(
      (candidate) => candidate.name === 'bangumi.get_latest_subject_revision',
    );
    expect(tool).toBeDefined();
    expect(tool!.input.safeParse({ subjectId: 41529 }).success).toBe(true);
    expect(tool!.input.safeParse({ subjectId: 0 }).success).toBe(false);
    expect(tool!.input.safeParse({ subjectId: 41529, extra: true }).success).toBe(false);
  });
});
