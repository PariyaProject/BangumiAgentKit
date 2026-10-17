import { describe, expect, it } from 'vitest';
import { GeneratedBangumiOpenApiClient } from '@bangumi-agent-kit/bangumi-openapi';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { createReadTools } from '@bangumi-agent-kit/tools';
import type { ToolDefinition } from '../../packages/tools/src/define-tool.js';

const ROOT_ID = 500;
const ANALYSIS_MODE = 'observed_two_hop_rating';
const context = { principalId: 'test', botInstanceId: 'test', conversationId: 'test' };

function relation(id: number, label = '关联') {
  return {
    id,
    type: 2,
    name: `作品 ${id}`,
    name_cn: `作品 ${id}`,
    relation: label,
  };
}

function subject(id: number, score?: number, total?: number) {
  return {
    id,
    type: 2,
    name: `作品 ${id}`,
    name_cn: `作品 ${id}`,
    summary: '',
    nsfw: false,
    locked: false,
    platform: '',
    images: {},
    ...(score === undefined && total === undefined
      ? {}
      : { rating: { score: score ?? 0, total: total ?? 0, count: {} } }),
  };
}

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function relationPath(url: string): number | undefined {
  const match = url.match(/\/v0\/subjects\/(\d+)\/subjects$/u);
  return match ? Number(match[1]) : undefined;
}

function detailPath(url: string): number | undefined {
  const match = url.match(/\/v0\/subjects\/(\d+)$/u);
  return match ? Number(match[1]) : undefined;
}

function subjectRelationsTool(fetchFn: typeof fetch): ToolDefinition[] {
  return createReadTools(new HttpClient({ fetchFn })) as unknown as ToolDefinition[];
}

function getTool(fetchFn: typeof fetch): ToolDefinition {
  const tool = subjectRelationsTool(fetchFn).find(
    (candidate) => candidate.name === 'bangumi.get_subject_relations',
  );
  if (!tool) throw new Error('bangumi.get_subject_relations was not registered');
  return tool;
}

describe('bangumi.get_subject_relations observed two-hop rating mode', () => {
  it('preserves both existing default forms without making detail or traversal requests', async () => {
    for (const input of [{ subjectId: ROOT_ID }, { subjectId: ROOT_ID, includeEvidence: true }]) {
      const urls: string[] = [];
      const fetchFn: typeof fetch = async (inputUrl) => {
        const url = String(inputUrl);
        urls.push(url);
        return jsonResponse([relation(501, '续集')]);
      };
      const tool = getTool(fetchFn);
      expect(tool.input.safeParse(input).success).toBe(true);
      const result = await tool.execute(input, context);
      expect(urls).toHaveLength(1);
      expect(urls[0]).toMatch(/\/v0\/subjects\/500\/subjects$/u);
      if ('includeEvidence' in input) {
        expect(result).toMatchObject({
          state: 'observed',
          subjectId: ROOT_ID,
          coverage: { responseRowsObserved: 1, rowsReturned: 1 },
        });
      } else {
        expect(result).toEqual([expect.objectContaining({ id: 501, relation: '续集' })]);
      }
    }

    const validationTool = getTool(async () => jsonResponse([]));
    expect(
      validationTool.input.safeParse({ subjectId: ROOT_ID, analysisMode: ANALYSIS_MODE }).success,
    ).toBe(true);
    expect(
      validationTool.input.safeParse({ subjectId: ROOT_ID, analysisMode: 'full_graph' }).success,
    ).toBe(false);
  });

  it('uses the public client for analysis even when an authenticated execution session exists', async () => {
    const authorizationHeaders: unknown[] = [];
    const fetchFn: typeof fetch = async (_inputUrl, init) => {
      authorizationHeaders.push(new Headers(init?.headers).get('authorization'));
      return jsonResponse([]);
    };
    const tool = getTool(fetchFn);
    const sessionClient = new GeneratedBangumiOpenApiClient(
      new HttpClient({ fetchFn, accessToken: 'fixture-only-session-token' }),
    );

    await tool.execute({ subjectId: ROOT_ID, analysisMode: ANALYSIS_MODE }, context, {
      executionSession: { client: sessionClient },
    });

    expect(authorizationHeaders).toEqual([null]);
  });

  it('ranks tied positive scores and preserves distinct direct and two-hop relation paths', async () => {
    const urls: string[] = [];
    const route = (url: string): Response => {
      const relationSubjectId = relationPath(url);
      if (relationSubjectId === ROOT_ID) {
        return jsonResponse([
          relation(501, '续集'),
          relation(501, '改编'),
          relation(501, '续集'),
          relation(502, '关联'),
          relation(ROOT_ID, '自指'),
        ]);
      }
      if (relationSubjectId === 501) {
        return jsonResponse([
          relation(503, '前传'),
          relation(503, '前传'),
          relation(502, '共同作品'),
          relation(ROOT_ID, '回到起点'),
          relation(501, '自身循环'),
        ]);
      }
      if (relationSubjectId === 502) {
        return jsonResponse([
          relation(503, '同一作品'),
          relation(ROOT_ID, '回到起点'),
          relation(502, '自身循环'),
        ]);
      }

      const detailSubjectId = detailPath(url);
      if (detailSubjectId === 501) return jsonResponse(subject(501, 8.1, 900));
      if (detailSubjectId === 502) return jsonResponse(subject(502, 8.7, 1200));
      if (detailSubjectId === 503) return jsonResponse(subject(503, 8.7, 850));
      return new Response('unexpected route', { status: 404 });
    };
    const fetchFn: typeof fetch = async (inputUrl) => {
      const url = String(inputUrl);
      urls.push(url);
      return route(url);
    };

    const result = (await getTool(fetchFn).execute(
      { subjectId: ROOT_ID, analysisMode: ANALYSIS_MODE },
      context,
    )) as {
      state: string;
      ratingAnalysis: {
        topScore: number | null;
        topCandidateCount: number;
        topCandidates: Array<{ id: number; paths: Array<{ relationLabels: string[] }> }>;
      };
      coverage: {
        duplicateRelationRows: number;
        cycleEdgesSkipped: number;
        requestBudget: { logicalRequestsAttempted: number; maximumPossibleWireAttempts: number };
      };
    };

    expect(result.state).toBe('observed');
    expect(result.ratingAnalysis).toMatchObject({ topScore: 8.7, topCandidateCount: 2 });
    expect(result.ratingAnalysis.topCandidates.map((candidate) => candidate.id)).toEqual([
      502, 503,
    ]);
    expect(
      result.ratingAnalysis.topCandidates.find((candidate) => candidate.id === 502)?.paths,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceId: ROOT_ID, targetId: 502, relationLabels: ['关联'] }),
        expect.objectContaining({
          sourceId: ROOT_ID,
          targetId: 502,
          relationLabels: ['续集', '共同作品'],
        }),
      ]),
    );
    expect(
      result.ratingAnalysis.topCandidates.find((candidate) => candidate.id === 503)?.paths,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceId: ROOT_ID,
          targetId: 503,
          relationLabels: ['续集', '前传'],
        }),
        expect.objectContaining({
          sourceId: ROOT_ID,
          targetId: 503,
          relationLabels: ['改编', '前传'],
        }),
        expect.objectContaining({
          sourceId: ROOT_ID,
          targetId: 503,
          relationLabels: ['关联', '同一作品'],
        }),
      ]),
    );
    expect(
      result.ratingAnalysis.topCandidates.find((candidate) => candidate.id === 503)?.paths,
    ).toHaveLength(3);
    expect(result.coverage.duplicateRelationRows).toBe(2);
    expect(result.coverage.cycleEdgesSkipped).toBe(5);
    expect(result.coverage.requestBudget).toMatchObject({
      logicalRequestsAttempted: 6,
      maximumPossibleWireAttempts: 33,
    });
    expect(urls.map((url) => new URL(url).pathname)).toEqual([
      `/v0/subjects/${ROOT_ID}/subjects`,
      '/v0/subjects/501/subjects',
      '/v0/subjects/502/subjects',
      '/v0/subjects/501',
      '/v0/subjects/502',
      '/v0/subjects/503',
    ]);
  });

  it('keeps traversal serial and enforces row, candidate, detail, and logical request caps', async () => {
    const urls: string[] = [];
    let activeFetches = 0;
    let maximumConcurrentFetches = 0;
    const fetchFn: typeof fetch = async (inputUrl) => {
      const url = String(inputUrl);
      urls.push(url);
      activeFetches += 1;
      maximumConcurrentFetches = Math.max(maximumConcurrentFetches, activeFetches);
      try {
        await new Promise((resolve) => setTimeout(resolve, 1));
        const relationSubjectId = relationPath(url);
        if (relationSubjectId === ROOT_ID) {
          return jsonResponse(Array.from({ length: 30 }, (_, index) => relation(600 + index)));
        }
        if (relationSubjectId === 600 || relationSubjectId === 601) {
          const offset = relationSubjectId === 600 ? 1000 : 2000;
          return jsonResponse(Array.from({ length: 10 }, (_, index) => relation(offset + index)));
        }
        const detailSubjectId = detailPath(url);
        if (detailSubjectId !== undefined) return jsonResponse(subject(detailSubjectId, 8, 100));
        return new Response('unexpected route', { status: 404 });
      } finally {
        activeFetches -= 1;
      }
    };
    const result = (await getTool(fetchFn).execute(
      { subjectId: ROOT_ID, analysisMode: ANALYSIS_MODE },
      context,
    )) as {
      state: string;
      coverage: {
        rootRelationRowsObserved: number | null;
        rootRelationRowsSelected: number;
        rootRelationRowsOmitted: number | null;
        intermediateSubjectsSelected: number;
        intermediateSubjectsOmitted: number;
        intermediateRelationRowsObserved: number;
        intermediateRelationRowsSelected: number;
        depth1CandidatesSelected: number;
        depth2CandidatesSelected: number;
        depth2CandidatesOmitted: number;
        detailRequestsAttempted: number;
        truncated: boolean;
        requestBudget: {
          logicalRequestsAttempted: number;
          maxLogicalRequests: number;
          maximumPossibleWireAttempts: number;
        };
      };
    };

    expect(result.state).toBe('partial');
    expect(result.coverage).toMatchObject({
      rootRelationRowsObserved: 30,
      rootRelationRowsSelected: 24,
      rootRelationRowsOmitted: 6,
      intermediateSubjectsSelected: 2,
      intermediateSubjectsOmitted: 22,
      intermediateRelationRowsObserved: 20,
      intermediateRelationRowsSelected: 16,
      depth1CandidatesSelected: 4,
      depth2CandidatesSelected: 4,
      depth2CandidatesOmitted: 12,
      detailRequestsAttempted: 8,
      truncated: true,
      requestBudget: {
        logicalRequestsAttempted: 11,
        maxLogicalRequests: 11,
        maximumPossibleWireAttempts: 33,
      },
    });
    expect(urls).toHaveLength(11);
    expect(maximumConcurrentFetches).toBe(1);
  });

  it('does not turn a missing or zero rating into a ranked score', async () => {
    const fetchFn: typeof fetch = async (inputUrl) => {
      const url = String(inputUrl);
      const relationSubjectId = relationPath(url);
      if (relationSubjectId === ROOT_ID) return jsonResponse([relation(501)]);
      if (relationSubjectId === 501) return jsonResponse([]);
      if (detailPath(url) === 501) return jsonResponse(subject(501, 0, 0));
      return new Response('unexpected route', { status: 404 });
    };
    const result = (await getTool(fetchFn).execute(
      { subjectId: ROOT_ID, analysisMode: ANALYSIS_MODE },
      context,
    )) as {
      state: string;
      ratingAnalysis: { topScore: number | null; topCandidates: unknown[] };
      coverage: { missingRatings: number; partialReasons: string[] };
    };

    expect(result.state).toBe('not_computable');
    expect(result.ratingAnalysis).toMatchObject({ topScore: null, topCandidates: [] });
    expect(result.coverage.missingRatings).toBe(1);
    expect(result.coverage.partialReasons).toContain('candidate_rating_unavailable');
  });

  it('stops traversal and detail reads when an intermediate relation read exhausts 429 retries', async () => {
    const urls: string[] = [];
    const fetchFn: typeof fetch = async (inputUrl) => {
      const url = String(inputUrl);
      urls.push(new URL(url).pathname);
      const relationSubjectId = relationPath(url);
      if (relationSubjectId === ROOT_ID) return jsonResponse([relation(501), relation(502)]);
      if (relationSubjectId === 501) return new Response('rate limited', { status: 429 });
      if (relationSubjectId === 502) return jsonResponse([]);
      return new Response('unexpected request after rate limit', { status: 404 });
    };

    const result = (await getTool(fetchFn).execute(
      { subjectId: ROOT_ID, analysisMode: ANALYSIS_MODE },
      context,
    )) as {
      state: string;
      ratingAnalysis: { topScore: number | null; topCandidates: unknown[] };
      coverage: {
        detailRequestsAttempted: number;
        partialReasons: string[];
        requestBudget: { logicalRequestsAttempted: number };
      };
      source: { operations: Array<{ status: string; failureCode?: string }> };
    };

    expect(urls).toEqual([
      `/v0/subjects/${ROOT_ID}/subjects`,
      '/v0/subjects/501/subjects',
      '/v0/subjects/501/subjects',
      '/v0/subjects/501/subjects',
    ]);
    expect(result).toMatchObject({
      state: 'not_computable',
      ratingAnalysis: { topScore: null, topCandidates: [] },
      coverage: {
        detailRequestsAttempted: 0,
        partialReasons: expect.arrayContaining([
          'intermediate_relation_request_failed',
          'upstream_rate_limited',
        ]),
        requestBudget: { logicalRequestsAttempted: 2 },
      },
      source: {
        operations: [{ status: 'succeeded' }, { status: 'failed', failureCode: 'RATE_LIMITED' }],
      },
    });
  });

  it('stops later candidate details when a detail read exhausts 429 retries', async () => {
    const urls: string[] = [];
    const fetchFn: typeof fetch = async (inputUrl) => {
      const url = String(inputUrl);
      const pathname = new URL(url).pathname;
      urls.push(pathname);
      const relationSubjectId = relationPath(url);
      if (relationSubjectId === ROOT_ID) {
        return jsonResponse([relation(501), relation(502), relation(503)]);
      }
      if (relationSubjectId === 501 || relationSubjectId === 502) return jsonResponse([]);
      const detailSubjectId = detailPath(url);
      if (detailSubjectId === 501) return jsonResponse(subject(501, 8.4, 70));
      if (detailSubjectId === 502) return new Response('rate limited', { status: 429 });
      return new Response('unexpected request after rate limit', { status: 404 });
    };

    const result = (await getTool(fetchFn).execute(
      { subjectId: ROOT_ID, analysisMode: ANALYSIS_MODE },
      context,
    )) as {
      state: string;
      ratingAnalysis: { topScore: number | null; topCandidates: Array<{ id: number }> };
      coverage: {
        detailRequestsAttempted: number;
        detailRequestsSucceeded: number;
        detailRequestsFailed: number;
        partialReasons: string[];
        requestBudget: { logicalRequestsAttempted: number };
      };
      source: { operations: Array<{ status: string; failureCode?: string }> };
    };

    expect(urls).toEqual([
      `/v0/subjects/${ROOT_ID}/subjects`,
      '/v0/subjects/501/subjects',
      '/v0/subjects/502/subjects',
      '/v0/subjects/501',
      '/v0/subjects/502',
      '/v0/subjects/502',
      '/v0/subjects/502',
    ]);
    expect(result).toMatchObject({
      state: 'partial',
      ratingAnalysis: { topScore: 8.4, topCandidates: [{ id: 501 }] },
      coverage: {
        detailRequestsAttempted: 2,
        detailRequestsSucceeded: 1,
        detailRequestsFailed: 1,
        partialReasons: expect.arrayContaining([
          'candidate_detail_request_failed',
          'upstream_rate_limited',
        ]),
        requestBudget: { logicalRequestsAttempted: 5 },
      },
      source: {
        operations: [
          { status: 'succeeded' },
          { status: 'succeeded' },
          { status: 'succeeded' },
          { status: 'succeeded' },
          { status: 'failed', failureCode: 'RATE_LIMITED' },
        ],
      },
    });
  });

  it('fails closed on an oversized root response and preserves intermediate/detail failures', async () => {
    const oversizedBody = ' '.repeat(1024 * 1024 + 1);
    const oversizedResponse = () =>
      new Response(oversizedBody, {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'content-length': String(1024 * 1024 + 1),
        },
      });
    let oversizedCalls = 0;
    const oversizedFetch: typeof fetch = async () => {
      oversizedCalls += 1;
      return oversizedResponse();
    };
    const unavailable = (await getTool(oversizedFetch).execute(
      { subjectId: ROOT_ID, analysisMode: ANALYSIS_MODE },
      context,
    )) as {
      state: string;
      ratingAnalysis: { topCandidates: unknown[] };
      source: { operations: unknown[] };
    };
    expect(unavailable.state).toBe('unavailable');
    expect(unavailable.ratingAnalysis.topCandidates).toEqual([]);
    expect(unavailable.source.operations).toHaveLength(1);
    expect(oversizedCalls).toBe(1);

    for (const oversizedStage of ['root', 'intermediate', 'detail'] as const) {
      let stageCalls = 0;
      const stageFetch: typeof fetch = async (inputUrl) => {
        stageCalls += 1;
        const url = String(inputUrl);
        const relationSubjectId = relationPath(url);
        if (relationSubjectId === ROOT_ID) {
          return oversizedStage === 'root' ? oversizedResponse() : jsonResponse([relation(501)]);
        }
        if (relationSubjectId === 501) {
          return oversizedStage === 'intermediate' ? oversizedResponse() : jsonResponse([]);
        }
        if (detailPath(url) === 501) {
          return oversizedStage === 'detail'
            ? oversizedResponse()
            : jsonResponse(subject(501, 8, 50));
        }
        return new Response('unexpected route', { status: 404 });
      };
      const stageResult = (await getTool(stageFetch).execute(
        { subjectId: ROOT_ID, analysisMode: ANALYSIS_MODE },
        context,
      )) as { state: string; coverage: { detailRequestsFailed: number } };
      expect(stageResult.state).toBe(
        oversizedStage === 'root'
          ? 'unavailable'
          : oversizedStage === 'intermediate'
            ? 'partial'
            : 'not_computable',
      );
      expect(stageCalls).toBe(oversizedStage === 'root' ? 1 : 3);
      if (oversizedStage === 'detail') expect(stageResult.coverage.detailRequestsFailed).toBe(1);
    }

    const failedUrls: string[] = [];
    const failedFetch: typeof fetch = async (inputUrl) => {
      const url = String(inputUrl);
      failedUrls.push(url);
      const relationSubjectId = relationPath(url);
      if (relationSubjectId === ROOT_ID) return jsonResponse([relation(501)]);
      if (relationSubjectId === 501)
        return new Response('missing intermediate relations', { status: 404 });
      if (detailPath(url) === 501) return new Response('missing subject detail', { status: 404 });
      return new Response('unexpected route', { status: 404 });
    };
    const notComputable = (await getTool(failedFetch).execute(
      { subjectId: ROOT_ID, analysisMode: ANALYSIS_MODE },
      context,
    )) as {
      state: string;
      ratingAnalysis: { topScore: number | null };
      coverage: { detailRequestsFailed: number; partialReasons: string[] };
      source: { operations: Array<{ status: string; failureCode?: string }> };
    };
    expect(notComputable.state).toBe('not_computable');
    expect(notComputable.ratingAnalysis.topScore).toBeNull();
    expect(notComputable.coverage).toMatchObject({ detailRequestsFailed: 1 });
    expect(notComputable.coverage.partialReasons).toEqual(
      expect.arrayContaining([
        'intermediate_relation_request_failed',
        'candidate_detail_request_failed',
      ]),
    );
    expect(notComputable.source.operations.map((operation) => operation.status)).toEqual([
      'succeeded',
      'failed',
      'failed',
    ]);
    expect(notComputable.source.operations[1]?.failureCode).toBe('NOT_FOUND');
    expect(failedUrls).toHaveLength(3);
  });

  it('does not treat a malformed root relation payload as an empty graph', async () => {
    const fetchFn: typeof fetch = async () => jsonResponse({ unexpected: 'object' });
    const result = (await getTool(fetchFn).execute(
      { subjectId: ROOT_ID, analysisMode: ANALYSIS_MODE },
      context,
    )) as {
      state: string;
      coverage: { rootRelationRowsObserved: number | null; partialReasons: string[] };
      source: { operations: Array<{ failureCode?: string }> };
    };
    expect(result.state).toBe('unavailable');
    expect(result.coverage.rootRelationRowsObserved).toBeNull();
    expect(result.coverage.partialReasons).toContain('root_relation_request_failed');
    expect(result.source.operations[0]?.failureCode).toBe('PARSER_ERROR');
  });
});
