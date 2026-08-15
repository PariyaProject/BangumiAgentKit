import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GeneratedBangumiOpenApiClient } from '@bangumi-agent-kit/bangumi-openapi';
import { CollectionSeriesService } from '@bangumi-agent-kit/bangumi-core';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import {
  buildCollectionSeriesViewModel,
  extractImageUrls,
  RenderService,
  renderHtmlTemplate,
  type RenderResult,
} from '@bangumi-agent-kit/renderer';
import { RendererLruCache } from '../../packages/renderer/src/lru-cache.js';

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

describe('collection-series renderer', () => {
  let renderService: RenderService;

  beforeAll(() => {
    renderService = new RenderService();
  });

  afterAll(async () => {
    await renderService.close();
  });

  it('renders a narrow-readable private image-free series card with coverage', async () => {
    const fetchFn: typeof fetch = async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/collections')) {
        return response({
          total: 3,
          limit: 50,
          offset: 0,
          data: [
            {
              subject_id: 1,
              subject_type: 2,
              type: 3,
              comment: 'private comment must not be rendered',
              subject: {
                id: 1,
                type: 2,
                name: 'Original One',
                name_cn: '一个很长的中文收藏标题：第一部',
              },
            },
            {
              subject_id: 2,
              subject_type: 2,
              type: 3,
              subject: { id: 2, type: 2, name: 'Original Two', name_cn: '第二部' },
            },
            {
              subject_id: 3,
              subject_type: 2,
              type: 3,
              subject: { id: 3, type: 2, name: 'Original Three', name_cn: '未归组条目' },
            },
          ],
        });
      }
      const subjectId = Number(url.pathname.split('/').at(-2));
      return response(
        subjectId === 1
          ? [{ id: 2, type: 2, name: 'Two', name_cn: '第二部', relation: '续集' }]
          : [],
      );
    };

    const result = await new CollectionSeriesService(
      new GeneratedBangumiOpenApiClient(new HttpClient({ fetchFn })),
    ).getCollectionSeriesGroups('bound-user', { maxItems: 3 });
    const viewModel = buildCollectionSeriesViewModel(result);

    expect(viewModel.template).toBe('collection-series');
    expect(extractImageUrls(viewModel)).toEqual([]);
    expect(viewModel.presentation.groups).toMatchObject({
      available: 1,
      rendered: 1,
      omitted: 0,
    });
    for (const width of [640, 960]) {
      const html = renderHtmlTemplate(viewModel, 'bangumi-dark', {}, width);
      expect(html).toContain('我的收藏系列组');
      expect(html).toContain('第二部');
      expect(html).toContain('collection-series-groups-v1');
      expect(html).toContain('覆盖：收藏');
      expect(html).not.toContain('private comment');
    }

    const rendered = await renderService.renderCard(viewModel, { width: 640 });
    expect(rendered.template).toBe('collection-series');
    expect(rendered.buffer.length).toBeGreaterThan(1000);

    const sourceGroup = result.groups[0]!;
    const denseResult = {
      ...result,
      groups: Array.from({ length: 9 }, (_, index) => ({
        ...sourceGroup,
        groupId: `series-${index + 1}`,
      })),
      coverage: {
        ...result.coverage,
        output: { ...result.coverage.output, returnedGroups: 9 },
      },
    };
    const denseViewModel = buildCollectionSeriesViewModel(denseResult);
    expect(denseViewModel.presentation.groups).toEqual({
      available: 9,
      rendered: 8,
      omitted: 1,
    });
    const denseHtml = renderHtmlTemplate(denseViewModel, 'bangumi-dark', {}, 640);
    expect(denseHtml).toContain('系列组展示 8/9，省略 1 个');

    const privateCache = new RendererLruCache<RenderResult>(2);
    const privateRenderService = new RenderService(undefined, privateCache);
    await privateRenderService.renderCard(viewModel, { width: 640 });
    expect(privateCache.size).toBe(0);
    await privateRenderService.close();
  });
});
