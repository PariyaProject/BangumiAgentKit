import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { UserCollectionItem } from '@bangumi-agent-kit/bangumi-core';
import {
  CollectionIntelligenceService,
  buildCollectionIntelligence,
  type CollectionIntelligenceResult,
} from '@bangumi-agent-kit/bangumi-core';
import { GeneratedBangumiOpenApiClient } from '@bangumi-agent-kit/bangumi-openapi';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import {
  buildCollectionIntelligenceViewModel,
  extractImageUrls,
  RenderService,
  renderHtmlTemplate,
} from '@bangumi-agent-kit/renderer';

function fixtureResult(): CollectionIntelligenceResult {
  const items: UserCollectionItem[] = [
    {
      subjectId: 1,
      subjectName: 'A very long original title that must wrap safely in a compact card',
      subjectNameCn: '一个需要在紧凑卡片中安全换行的超长中文标题：少女终末旅行与更多文字',
      subjectType: 'anime',
      status: 'doing',
      rating: 9,
      tags: ['科幻', '旅行', '科幻'],
      epStatus: 6,
      updatedAt: '2026-08-14T10:00:00.000Z',
    },
    {
      subjectId: 2,
      subjectName: 'Sparse item',
      subjectType: 'book',
      status: 'wish',
      tags: [],
    },
  ];
  return buildCollectionIntelligence(items, {
    sourceTotal: 4,
    requestedMaxItems: 2,
    pageSize: 2,
    pagesAttempted: 1,
    pagesSucceeded: 1,
    maxPages: 8,
    sourceExhausted: false,
    paginationStalled: false,
    sourceTotalChanged: false,
    attemptedAt: '2026-08-14T00:00:00.000Z',
    retrievedAt: '2026-08-14T10:00:01.000Z',
  });
}

function buildClient(fetchFn: typeof fetch): GeneratedBangumiOpenApiClient {
  return new GeneratedBangumiOpenApiClient(new HttpClient({ fetchFn }));
}

describe('collection-intelligence renderer', () => {
  let renderService: RenderService;

  beforeAll(() => {
    renderService = new RenderService();
  });

  afterAll(async () => {
    await renderService.close();
  });

  it('renders truthful partial, sparse, long-title data without assets or comments', async () => {
    const result = fixtureResult();
    const viewModel = buildCollectionIntelligenceViewModel(result);
    expect(viewModel.template).toBe('collection-intelligence');
    expect(viewModel.state).toBe('partial');
    expect(viewModel.coverage.renderedRecentCount).toBe(1);
    expect(extractImageUrls(viewModel)).toEqual([]);

    const html = renderHtmlTemplate(viewModel, 'bangumi-dark', {}, 640);
    expect(html).toContain('我的收藏智能概览');
    expect(html).toContain('部分覆盖');
    expect(html).toContain('collection-intelligence-v1');
    expect(html).toContain('一个需要在紧凑卡片中安全换行的超长中文标题');
    expect(html).toContain('统计口径');
    expect(html).toContain('部分收藏记录缺少');
    expect(html).not.toContain('item.rating');
    expect(html).not.toContain('source-reported updated_at');
    expect(html).not.toContain('comment');

    const rendered = await renderService.renderCard(viewModel, { width: 640 });
    expect(rendered.template).toBe('collection-intelligence');
    expect(rendered.buffer.length).toBeGreaterThan(1000);

    const unavailableResult = await new CollectionIntelligenceService(
      buildClient(
        async () => new Response(JSON.stringify({ message: 'temporary failure' }), { status: 503 }),
      ),
    ).getCollectionIntelligence('account-owner');
    const unavailable = buildCollectionIntelligenceViewModel(unavailableResult);
    expect(unavailable.coverage.sourceTotal).toBeUndefined();
    const unavailableHtml = renderHtmlTemplate(unavailable, 'bangumi-light', {}, 960);
    expect(unavailableHtml).toContain('官方收藏暂时不可读取');
    expect(unavailableHtml).toContain('未用猜测填补结果');
    expect(unavailableHtml).toContain('源报告 未知 条');
    expect(unavailableHtml).not.toContain('待看/搁置 backlog</div>');
    expect(unavailableHtml).not.toContain('updated_at');
  });

  it('explains a complete empty collection without presenting it as an error', () => {
    const empty = buildCollectionIntelligence([], {
      sourceTotal: 0,
      requestedMaxItems: 20,
      pageSize: 20,
      pagesAttempted: 1,
      pagesSucceeded: 1,
      maxPages: 8,
      sourceExhausted: true,
      paginationStalled: false,
      sourceTotalChanged: false,
      attemptedAt: '2026-08-14T00:00:00.000Z',
      retrievedAt: '2026-08-14T10:00:01.000Z',
    });
    const html = renderHtmlTemplate(
      buildCollectionIntelligenceViewModel(empty),
      'bangumi-dark',
      {},
      320,
    );

    expect(html).toContain('覆盖完整');
    expect(html).toContain('暂无收藏条目');
    expect(html).toContain('完整的空收藏结果');
    expect(html).not.toContain('暂不可读取');
  });

  it('caps dense tags and recent updates while keeping the card readable', () => {
    const result = buildCollectionIntelligence(
      Array.from({ length: 12 }, (_, index) => ({
        subjectId: index + 1,
        subjectName: `Dense item ${index + 1}`,
        subjectType: 'anime',
        status: 'done' as const,
        rating: 0,
        tags: [`tag-${index + 1}`],
        epStatus: 0,
        updatedAt: `2026-08-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`,
      })),
      {
        sourceTotal: 12,
        requestedMaxItems: 12,
        pageSize: 12,
        pagesAttempted: 1,
        pagesSucceeded: 1,
        maxPages: 8,
        sourceExhausted: true,
        paginationStalled: false,
        sourceTotalChanged: false,
        attemptedAt: '2026-08-14T00:00:00.000Z',
        retrievedAt: '2026-08-14T10:00:01.000Z',
      },
    );
    const viewModel = buildCollectionIntelligenceViewModel(result, {
      maxTags: 8,
      maxRecentUpdates: 8,
    });

    expect(viewModel.coverage.renderedTagCount).toBe(8);
    expect(viewModel.coverage.renderedRecentCount).toBe(8);
    expect(viewModel.presentation).toEqual({
      state: 'partial',
      tags: { available: 12, rendered: 8, omitted: 4 },
      recentUpdates: { available: 10, rendered: 8, omitted: 2 },
    });
    for (const width of [640, 960]) {
      const html = renderHtmlTemplate(viewModel, 'bangumi-dark', {}, width);
      expect(html).toContain('待看与搁置合计');
      expect(html).toContain('展示省略：标签 4 个 · 最近更新 2 条');
    }
  });
});
