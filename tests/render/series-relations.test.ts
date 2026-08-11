import { describe, expect, it, vi } from 'vitest';
import {
  buildSeriesRelationsViewModel,
  extractImageUrls,
  renderHtmlTemplate,
  RenderService,
} from '@bangumi-agent-kit/renderer';
import {
  assertSeriesWatchOrderFixture,
  buildSeriesWatchOrderFixtureRuns,
  SERIES_FIXTURE_VARIANTS,
} from '../../scripts/series-watch-order-fixtures.js';

const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+6R9JggAAAABJRU5ErkJggg==',
  'base64',
);

describe('series-relations renderer', () => {
  it('accepts only service-emittable complete, partial, and not-computable QA fixtures', async () => {
    const fixtures = await buildSeriesWatchOrderFixtureRuns();

    for (const variant of SERIES_FIXTURE_VARIANTS) {
      const fixture = fixtures[variant];
      expect(() => assertSeriesWatchOrderFixture(fixture), variant).not.toThrow();
      const viewModel = buildSeriesRelationsViewModel(fixture.result);
      expect(viewModel.state).toBe(variant === 'not-computable' ? 'not_computable' : variant);
      expect(viewModel.coverage.uniqueRelatedObserved).toBe(
        fixture.result.coverage.uniqueRelatedObserved,
      );
      expect(viewModel.evidence.evidenceCount).toBe(fixture.result.evidence.sources.length);
    }
  });

  it('renders service-emittable CJK, raw labels, exclusions, paths, coverage, and partial state at both target widths', async () => {
    const fixtures = await buildSeriesWatchOrderFixtureRuns();
    const fixture = fixtures.partial;
    assertSeriesWatchOrderFixture(fixture);
    const viewModel = buildSeriesRelationsViewModel(fixture.result);

    for (const width of [640, 960]) {
      const html = renderHtmlTemplate(viewModel, 'bangumi-dark', {}, width);
      expect(html).toContain('系列关系与观看顺序');
      expect(html).toContain('部分覆盖起点');
      expect(html).toContain('前传');
      expect(html).toContain('300 → 301');
      expect(html).toContain('非动画媒介');
      expect(html).toContain('部分覆盖');
      expect(html).toContain('关系请求');
      expect(html).toContain('series-watch-order-v2');
      expect(html).toContain('无封面');
    }
  });

  it('keeps a service-emittable non-anime root explicitly not computable while retaining evidence sections', async () => {
    const fixtures = await buildSeriesWatchOrderFixtureRuns();
    const fixture = fixtures['not-computable'];
    assertSeriesWatchOrderFixture(fixture);
    const viewModel = buildSeriesRelationsViewModel(fixture.result);
    const html = renderHtmlTemplate(viewModel, 'bangumi-light', {}, 640);

    expect(viewModel.state).toBe('not_computable');
    expect(html).toContain('当前不可计算');
    expect(html).toContain('当前不能计算观看步骤');
    expect(html).toContain('关系证据');
  });

  it('caps caller-created series view models before asset resolution and screenshot rendering', async () => {
    const fixtures = await buildSeriesWatchOrderFixtureRuns();
    assertSeriesWatchOrderFixture(fixtures.complete);
    const base = buildSeriesRelationsViewModel(fixtures.complete.result);
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
    const fixtures = await buildSeriesWatchOrderFixtureRuns();
    assertSeriesWatchOrderFixture(fixtures.complete);
    const base = buildSeriesRelationsViewModel(fixtures.complete.result);
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
