import { describe, expect, it, vi } from 'vitest';
import {
  buildSeriesRelationsViewModel,
  extractImageUrls,
  renderHtmlTemplate,
  RenderService,
} from '@bangumi-agent-kit/renderer';
import type { SeriesWatchOrderResult } from '@bangumi-agent-kit/bangumi-core';
import {
  assertSeriesWatchOrderFixture,
  buildSeriesWatchOrderFixtureResults,
  SERIES_FIXTURE_VARIANTS,
} from '../../scripts/series-watch-order-fixtures.js';

const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+6R9JggAAAABJRU5ErkJggg==',
  'base64',
);

function makeResult(rootType: 'anime' | 'book' = 'anime'): SeriesWatchOrderResult {
  const path = {
    fromId: 100,
    toId: 101,
    depth: 0,
    relation: '前传',
    relationKind: 'prequel' as const,
    pathIds: [100, 101],
    pathKinds: ['prequel' as const],
    direct: true,
  };
  const root = {
    id: 100,
    type: rootType,
    name: 'Long Original Title',
    nameCn: '超长中文起点条目與日本語タイトル',
    date: '2020-01-01',
    relationLabels: [],
    relationKinds: [],
    relationPaths: [],
  };
  const step = {
    ...root,
    id: 101,
    type: 'anime' as const,
    name: 'Prequel Original Title',
    nameCn: '前传条目',
    date: '2019-01-01',
    relationLabels: ['前传'],
    relationKinds: ['prequel' as const],
    relationPaths: [path],
    position: 1,
    isRoot: false,
    placement: 'before_root' as const,
    placementReason: '起点直接关系标记为前传，置于起点前',
  };

  return {
    state: rootType === 'anime' ? 'partial' : 'not_computable',
    subjectId: 100,
    root,
    watchOrder:
      rootType === 'anime'
        ? [step, { ...root, position: 2, isRoot: true, placement: 'root', placementReason: '起点' }]
        : [],
    related: [
      { ...step, depth: 0, includedInWatchOrder: rootType === 'anime' },
      {
        ...root,
        id: 102,
        type: 'book',
        name: 'Source Book',
        nameCn: '原作书',
        relationLabels: ['原作'],
        relationKinds: ['source'],
        relationPaths: [
          {
            ...path,
            toId: 102,
            relation: '原作',
            relationKind: 'source',
            pathIds: [100, 102],
            pathKinds: ['source'],
          },
        ],
        depth: 0,
        includedInWatchOrder: false,
        exclusionReason: 'media_type_not_anime',
      },
    ],
    edges: [path],
    excluded: {
      count: 1,
      byReason: [{ reason: 'media_type_not_anime', count: 1 }],
      samples: [
        {
          id: 102,
          type: 'book',
          name: 'Source Book',
          nameCn: '原作书',
          relationLabels: ['原作'],
          relationKinds: ['source'],
          relationPaths: [
            {
              ...path,
              toId: 102,
              relation: '原作',
              relationKind: 'source',
              pathIds: [100, 102],
              pathKinds: ['source'],
            },
          ],
          reason: 'media_type_not_anime',
        },
      ],
    },
    coverage: {
      depth: 1,
      maxNodes: 8,
      media: 'all',
      animeNodeLimit: 8,
      nonAnimeEvidenceLimit: 8,
      relatedLimit: 16,
      relationRequests: 1,
      relationRowsObserved: 2,
      uniqueRelatedObserved: 2,
      uniqueRelatedReturned: 2,
      animeNodesObserved: 1,
      animeNodesSelected: 1,
      nonAnimeRowsObserved: 1,
      nonAnimeRowsReturned: 1,
      detailsAttempted: 1,
      detailsFetched: 1,
      detailsFailed: 0,
      relationFailures: 0,
      edgeEvidenceLimit: 64,
      edgeEvidenceReturned: 1,
      edgeEvidenceTruncated: false,
      relatedEvidenceTruncated: false,
      truncated: rootType === 'anime',
      truncationReasons: rootType === 'anime' ? ['semantic-conflict'] : [],
      retrievedAt: '2026-08-11T00:00:00.000Z',
    },
    capabilityStates: {
      watchOrder: rootType === 'anime' ? 'bounded_recommendation' : 'not_computable',
    },
    evidence: {
      sources: [
        {
          operation: 'getSubjectById',
          path: '/v0/subjects/100',
          status: 'succeeded',
          subjectId: 100,
        },
        {
          operation: 'getRelatedSubjectsBySubjectId',
          path: '/v0/subjects/100/subjects',
          status: 'succeeded',
          subjectId: 100,
          depth: 0,
        },
      ],
      derivation: 'series-watch-order-v2',
      retrievedAt: '2026-08-11T00:00:00.000Z',
    },
    warnings:
      rootType === 'anime'
        ? ['存在方向冲突的关系证据；冲突条目不会进入 definitive 观看步骤。']
        : [],
    limitations: ['这不是 Bangumi 发布的唯一官方观看顺序。'],
  };
}

describe('series-relations renderer', () => {
  it('accepts only service-shaped complete, partial, and not-computable QA fixtures', () => {
    const fixtures = buildSeriesWatchOrderFixtureResults();

    for (const variant of SERIES_FIXTURE_VARIANTS) {
      const result = fixtures[variant];
      expect(() => assertSeriesWatchOrderFixture(result), variant).not.toThrow();
      const viewModel = buildSeriesRelationsViewModel(result);
      expect(viewModel.state).toBe(variant === 'not-computable' ? 'not_computable' : variant);
      expect(viewModel.coverage.uniqueRelatedObserved).toBe(result.coverage.uniqueRelatedObserved);
      expect(viewModel.evidence.evidenceCount).toBe(result.evidence.sources.length);
    }
  });

  it('renders CJK, raw labels, exclusions, paths, coverage, and partial state at both target widths', () => {
    const viewModel = buildSeriesRelationsViewModel(makeResult());

    for (const width of [640, 960]) {
      const html = renderHtmlTemplate(viewModel, 'bangumi-dark', {}, width);
      expect(html).toContain('系列关系与观看顺序');
      expect(html).toContain('超长中文起点条目');
      expect(html).toContain('前传');
      expect(html).toContain('100 → 101');
      expect(html).toContain('非动画媒介');
      expect(html).toContain('部分覆盖');
      expect(html).toContain('关系请求');
      expect(html).toContain('series-watch-order-v2');
      expect(html).toContain('无封面');
    }
  });

  it('keeps a non-anime root explicitly not computable while retaining evidence sections', () => {
    const viewModel = buildSeriesRelationsViewModel(makeResult('book'));
    const html = renderHtmlTemplate(viewModel, 'bangumi-light', {}, 640);

    expect(viewModel.state).toBe('not_computable');
    expect(html).toContain('当前不可计算');
    expect(html).toContain('当前不能计算观看步骤');
    expect(html).toContain('关系证据');
  });

  it('caps caller-created series view models before asset resolution and screenshot rendering', async () => {
    const base = buildSeriesRelationsViewModel(makeResult());
    const oversized = {
      ...base,
      steps: Array.from({ length: 20 }, (_, index) => ({
        ...base.steps[0]!,
        id: 1000 + index,
        image: `https://img.example/step-${index}.jpg`,
      })),
      related: Array.from({ length: 30 }, (_, index) => ({
        ...base.related[0]!,
        id: 2000 + index,
        image: `https://img.example/related-${index}.jpg`,
      })),
      edges: Array.from({ length: 70 }, (_, index) => ({
        ...base.edges[0]!,
        fromId: 3000 + index,
        toId: 4000 + index,
      })),
      coverage: {
        ...base.coverage,
        maxNodes: 16,
        relatedLimit: 40,
        uniqueRelatedReturned: 30,
        edgeEvidenceReturned: 70,
        edgeEvidenceTruncated: false,
        relatedEvidenceTruncated: false,
      },
    };

    expect(extractImageUrls(oversized)).toHaveLength(41);

    let renderedHtml = '';
    const assetResolver = {
      resolveAsset: vi.fn(async () => ({ dataUrl: 'data:image/png;base64,AA==' })),
    };
    const browserPool = {
      renderHtmlToBuffer: vi.fn(async (html: string) => {
        renderedHtml = html;
        return ONE_PIXEL_PNG;
      }),
      close: vi.fn(async () => undefined),
    };
    const service = new RenderService(browserPool as never, undefined, assetResolver as never);

    try {
      await service.renderCard(oversized, { width: 640, deviceScaleFactor: 1 });
      expect(assetResolver.resolveAsset).toHaveBeenCalledTimes(41);
      expect(renderedHtml).toContain('安全显示上限');
      expect(renderedHtml).toContain('省略 步骤 3、关系证据 6、边证据 6');
      expect(renderedHtml).not.toContain('step-19.jpg');
      expect(renderedHtml).not.toContain('related-29.jpg');
    } finally {
      await service.close();
    }
  });

  it('renders every valid related and edge item up to the declared evidence caps', async () => {
    const base = buildSeriesRelationsViewModel(makeResult());
    const validMaximum = {
      ...base,
      state: 'complete' as const,
      related: Array.from({ length: 24 }, (_, index) => ({
        ...base.related[0]!,
        id: 2000 + index,
        name: `Maximum related ${index}`,
        nameCn: `最大关系证据 ${index}`,
        image: `https://img.example/valid-related-${index}.jpg`,
      })),
      edges: Array.from({ length: 64 }, (_, index) => ({
        ...base.edges[0]!,
        fromId: 5000 + index,
        toId: 6000 + index,
        pathIds: [5000 + index, 6000 + index],
      })),
      coverage: {
        ...base.coverage,
        relatedLimit: 24,
        uniqueRelatedReturned: 24,
        edgeEvidenceLimit: 64,
        edgeEvidenceReturned: 64,
        relatedEvidenceTruncated: false,
        edgeEvidenceTruncated: false,
        truncated: false,
        truncationReasons: [],
      },
      warnings: [],
    };

    expect(extractImageUrls(validMaximum)).toHaveLength(24);

    let renderedHtml = '';
    const assetResolver = {
      resolveAsset: vi.fn(async () => ({ dataUrl: 'data:image/png;base64,AA==' })),
    };
    const browserPool = {
      renderHtmlToBuffer: vi.fn(async (html: string) => {
        renderedHtml = html;
        return ONE_PIXEL_PNG;
      }),
      close: vi.fn(async () => undefined),
    };
    const service = new RenderService(browserPool as never, undefined, assetResolver as never);

    try {
      await service.renderCard(validMaximum, { width: 960, deviceScaleFactor: 1 });
      expect(assetResolver.resolveAsset).toHaveBeenCalledTimes(24);
      expect(renderedHtml).toContain('最大关系证据 23');
      expect(renderedHtml).toContain('5063 → 6063');
      expect(renderedHtml).not.toContain('安全显示上限');
    } finally {
      await service.close();
    }
  });
});
