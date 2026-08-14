import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { UserCollectionItem } from '@bangumi-agent-kit/bangumi-core';
import {
  buildCollectionIntelligence,
  type CollectionIntelligenceResult,
} from '@bangumi-agent-kit/bangumi-core';
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
    expect(html).not.toContain('comment');

    const rendered = await renderService.renderCard(viewModel, { width: 640 });
    expect(rendered.template).toBe('collection-intelligence');
    expect(rendered.buffer.length).toBeGreaterThan(1000);

    const unavailable = buildCollectionIntelligenceViewModel({
      ...result,
      state: 'unavailable',
      coverage: { ...result.coverage, state: 'unavailable' },
      warnings: [{ code: 'AUTH_REQUIRED', state: 'unavailable', message: '需要先绑定账号。' }],
    });
    const unavailableHtml = renderHtmlTemplate(unavailable, 'bangumi-light', {}, 960);
    expect(unavailableHtml).toContain('官方收藏源暂时不可用');
    expect(unavailableHtml).not.toContain('Backlog');
  });
});
