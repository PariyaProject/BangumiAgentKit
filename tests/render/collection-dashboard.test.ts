import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GeneratedBangumiOpenApiClient } from '@bangumi-agent-kit/bangumi-openapi';
import { CollectionDashboardService } from '@bangumi-agent-kit/bangumi-core';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import {
  buildCollectionDashboardViewModel,
  extractImageUrls,
  RenderService,
  renderHtmlTemplate,
} from '@bangumi-agent-kit/renderer';

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function buildCalendar(): Array<Record<string, unknown>> {
  return Array.from({ length: 7 }, (_, index) => ({
    weekday: { id: index + 1, en: `Day${index + 1}`, cn: `星期${index + 1}`, ja: `日${index + 1}` },
    items:
      index === 0
        ? [
            {
              id: 1,
              type: 2,
              name: 'Original',
              name_cn: '一个很长的中文收藏标题：少女终末旅行',
              air_date: '2026-08-10',
              air_weekday: 1,
            },
          ]
        : [],
  }));
}

function buildClient(fetchFn: typeof fetch): GeneratedBangumiOpenApiClient {
  return new GeneratedBangumiOpenApiClient(new HttpClient({ fetchFn }));
}

describe('collection-dashboard renderer', () => {
  let renderService: RenderService;

  beforeAll(() => {
    renderService = new RenderService();
  });

  afterAll(async () => {
    await renderService.close();
  });

  it('renders the three private sections as one image-free, narrow-readable card', async () => {
    const fetchFn: typeof fetch = async (input) => {
      const url = new URL(String(input));
      if (url.pathname === '/calendar') return response(buildCalendar());
      if (url.pathname.endsWith('/episodes')) {
        return response({
          total: 2,
          limit: 100,
          offset: 0,
          data: [
            {
              type: 2,
              episode: {
                id: 1,
                subject_id: 1,
                type: 0,
                name: 'Episode 1',
                ep: 1,
                airdate: '2026-01-01',
              },
            },
            {
              type: 1,
              episode: {
                id: 2,
                subject_id: 1,
                type: 0,
                name: 'Episode 2',
                ep: 2,
                airdate: '2026-01-02',
              },
            },
          ],
        });
      }
      return response({
        total: 1,
        limit: 50,
        offset: 0,
        data: [
          {
            subject_id: 1,
            subject_type: 2,
            type: 3,
            rate: 9,
            tags: ['科幻', '旅行'],
            ep_status: 1,
            updated_at: '2026-08-14T00:00:00.000Z',
            comment: 'private comment must not be rendered',
            subject: {
              id: 1,
              type: 2,
              name: 'Original',
              name_cn: '一个很长的中文收藏标题：少女终末旅行',
              date: '2026-08-10',
              eps: 2,
            },
          },
        ],
      });
    };
    const result = await new CollectionDashboardService(
      buildClient(fetchFn),
      new HttpClient({ fetchFn }),
    ).getCollectionDashboard('bound-user', {
      maxCollectionItems: 1,
      maxSubjects: 1,
      maxEpisodesPerSubject: 2,
      maxRows: 4,
      statuses: ['doing'],
    });
    const viewModel = buildCollectionDashboardViewModel(result);

    expect(viewModel.template).toBe('collection-dashboard');
    expect(viewModel.state).toBe('complete');
    expect(extractImageUrls(viewModel)).toEqual([]);
    for (const width of [640, 960]) {
      const html = renderHtmlTemplate(viewModel, 'bangumi-dark', {}, width);
      expect(html).toContain('我的收藏 Dashboard');
      expect(html).toContain('收藏概览');
      expect(html).toContain('七日播出计划');
      expect(html).toContain('collection-dashboard-v1');
      expect(html).toContain('日历行上限');
      expect(html).toContain('限制：');
      expect(html).toContain('一个很长的中文收藏标题');
      expect(html).not.toContain('private comment');
    }

    const rendered = await renderService.renderCard(viewModel, { width: 640 });
    expect(rendered.template).toBe('collection-dashboard');
    expect(rendered.buffer.length).toBeGreaterThan(1000);
  });
});
