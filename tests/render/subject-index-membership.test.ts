import { describe, expect, it } from 'vitest';
import type { SubjectIndexMembershipResult } from '@bangumi-agent-kit/bangumi-core';
import {
  buildSubjectIndexMembershipViewModel,
  extractImageUrls,
  renderHtmlTemplate,
} from '@bangumi-agent-kit/renderer';

const result: SubjectIndexMembershipResult = {
  subjectId: 41529,
  state: 'complete',
  indexes: [
    {
      indexId: 77,
      state: 'complete',
      membership: 'matched',
      matches: [{ subjectId: 41529, order: 1 }],
      coverage: {
        pageSize: 50,
        maxPages: 8,
        maxRows: 400,
        responseLimitBytes: 1_048_576,
        attemptedAt: '2026-08-30T00:00:00.000Z',
        retrievedAt: '2026-08-30T00:00:00.000Z',
        pagesAttempted: 1,
        pagesSucceeded: 1,
        rowsObserved: 1,
        rowsReturned: 1,
        validRows: 1,
        malformedRows: 0,
        duplicateRows: 0,
        total: 1,
        totalKind: 'exact',
        upstreamExhausted: true,
        truncated: false,
        integrity: 'consistent',
        completionReason: 'upstream_exhausted',
      },
      source: {
        class: 'official-v0',
        provider: 'bangumi',
        operation: 'GET /v0/indices/{index_id}/subjects',
        responseLimitBytes: 1_048_576,
        attemptedAt: '2026-08-30T00:00:00.000Z',
        retrievedAt: '2026-08-30T00:00:00.000Z',
      },
      evidence: [
        {
          source: 'official-v0',
          provider: 'bangumi',
          operation: 'GET /v0/indices/{index_id}/subjects',
          version: 'v0',
          indexId: 77,
          subjectId: 41529,
          fieldPath: 'data[].id',
          observation: 'matched',
          observationScope: 'complete_scan',
          retrievedAt: '2026-08-30T00:00:00.000Z',
        },
      ],
      warnings: [],
    },
  ],
  summary: { requested: 1, matched: 1, notMatchedInObservedScope: 0, unknown: 0 },
  coverage: {
    indexesRequested: 1,
    indexesComplete: 1,
    indexesPartial: 0,
    indexesUnavailable: 0,
    requestsAttempted: 1,
    requestsSucceeded: 1,
    pagesAttempted: 1,
    pagesSucceeded: 1,
    pageSize: 50,
    maxPages: 8,
    maxRows: 400,
    responseLimitBytes: 1_048_576,
    attemptedAt: '2026-08-30T00:00:00.000Z',
    retrievedAt: '2026-08-30T00:00:00.000Z',
  },
  source: {
    class: 'official-v0',
    provider: 'bangumi',
    operations: ['GET /v0/indices/{index_id}/subjects'],
    responseLimitBytes: 1_048_576,
    attemptedAt: '2026-08-30T00:00:00.000Z',
    retrievedAt: '2026-08-30T00:00:00.000Z',
  },
  evidence: [],
  warnings: [],
  limitations: ['只扫描调用方提供的 indexIds。'],
  attemptedAt: '2026-08-30T00:00:00.000Z',
  retrievedAt: '2026-08-30T00:00:00.000Z',
};

describe('subject index membership renderer', () => {
  it('builds an image-free view model and registered HTML card', () => {
    const viewModel = buildSubjectIndexMembershipViewModel(result);

    expect(viewModel.template).toBe('subject-index-membership');
    expect(extractImageUrls(viewModel)).toEqual([]);

    const html = renderHtmlTemplate(viewModel, 'bangumi-dark', {}, 960);
    expect(html).toContain('条目目录归属观察');
    expect(html).toContain('目录 #77');
    expect(html).toContain('已观察到精确匹配');
    expect(html).toContain('只扫描调用方提供的 indexIds');
  });

  it('renders an unknown total after inconsistent pagination metadata', () => {
    const inconsistentResult = structuredClone(result);
    const index = inconsistentResult.indexes[0]!;
    delete index.coverage.total;
    index.coverage.totalKind = 'unknown';
    index.state = 'partial';
    index.membership = 'unknown';

    const html = renderHtmlTemplate(
      buildSubjectIndexMembershipViewModel(inconsistentResult),
      'bangumi-dark',
      {},
      960,
    );

    expect(html).toContain('原始总数 未知');
  });
});
