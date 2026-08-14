import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GeneratedBangumiOpenApiClient } from '@bangumi-agent-kit/bangumi-openapi';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { CollectionBacklogService } from '@bangumi-agent-kit/bangumi-core';
import {
  buildCollectionBacklogViewModel,
  extractImageUrls,
  RenderService,
  renderHtmlTemplate,
} from '@bangumi-agent-kit/renderer';

function buildClient(fetchFn: typeof fetch): GeneratedBangumiOpenApiClient {
  return new GeneratedBangumiOpenApiClient(new HttpClient({ fetchFn }));
}

describe('collection-backlog renderer', () => {
  let renderService: RenderService;

  beforeAll(() => {
    renderService = new RenderService();
  });

  afterAll(async () => {
    await renderService.close();
  });

  it('renders a dense CJK backlog card without resolving personal assets or comments', async () => {
    const fetchFn: typeof fetch = async (input) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/collections')) {
        return new Response(
          JSON.stringify({
            total: 1,
            limit: 50,
            offset: 0,
            data: [
              {
                subject_id: 1,
                subject_type: 2,
                type: 3,
                rate: 9,
                comment: 'private comment',
                tags: [],
                ep_status: 1,
                vol_status: 0,
                updated_at: '2026-08-14T00:00:00.000Z',
                private: true,
                subject: {
                  id: 1,
                  type: 2,
                  name: 'Long Original Title',
                  name_cn: '一个需要在窄卡片中安全换行的超长收藏标题：少女终末旅行与更多文字',
                  short_summary: '',
                  eps: 3,
                  volumes: 0,
                  collection_total: 10,
                  score: 8,
                  rank: 100,
                  tags: [],
                  images: { large: 'https://img.example/private-collection-cover.jpg' },
                },
              },
            ],
          }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          total: 1,
          limit: 100,
          offset: 0,
          data: [
            {
              type: 2,
              updated_at: 1_723_600_000,
              episode: {
                id: 1,
                subject_id: 1,
                type: 0,
                name: 'Episode 1',
                name_cn: '第一集',
                sort: 1,
                ep: 1,
              },
            },
          ],
        }),
        { status: 200 },
      );
    };
    const result = await new CollectionBacklogService(buildClient(fetchFn)).getCollectionBacklog(
      'account-owner',
    );
    const viewModel = buildCollectionBacklogViewModel(result);

    expect(viewModel.template).toBe('collection-backlog');
    expect(viewModel.state).toBe('complete');
    expect(viewModel.coverage.renderedItems).toBe(1);
    expect(extractImageUrls(viewModel)).toEqual([]);

    const html = renderHtmlTemplate(viewModel, 'bangumi-dark', {}, 640);
    expect(html).toContain('我的收藏 backlog');
    expect(html).toContain('剩余 2 集');
    expect(html).toContain('collection-backlog-v1');
    expect(html).toContain('一个需要在窄卡片中安全换行的超长收藏标题');
    expect(html).not.toContain('private comment');

    const rendered = await renderService.renderCard(viewModel, { width: 640 });
    expect(rendered.template).toBe('collection-backlog');
    expect(rendered.buffer.length).toBeGreaterThan(1000);
  });
});
