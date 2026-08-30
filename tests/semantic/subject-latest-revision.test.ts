import { describe, expect, it, vi } from 'vitest';
import {
  RevisionService,
  SUBJECT_LATEST_REVISION_MAX_RESPONSE_BYTES,
} from '@bangumi-agent-kit/bangumi-core';
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
