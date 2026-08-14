import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  CollectionScheduleService,
  type CollectionScheduleResult,
} from '@bangumi-agent-kit/bangumi-core';
import { GeneratedBangumiOpenApiClient } from '@bangumi-agent-kit/bangumi-openapi';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import {
  buildCollectionScheduleViewModel,
  extractImageUrls,
  RenderService,
  renderHtmlTemplate,
} from '@bangumi-agent-kit/renderer';

const weekdays = [
  ['Mon', '星期一', '月曜日'],
  ['Tue', '星期二', '火曜日'],
  ['Wed', '星期三', '水曜日'],
  ['Thu', '星期四', '木曜日'],
  ['Fri', '星期五', '金曜日'],
  ['Sat', '星期六', '土曜日'],
  ['Sun', '星期日', '日曜日'],
] as const;

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function fixtureService(): CollectionScheduleService {
  const fetchFn: typeof fetch = async (input) => {
    const url = new URL(String(input));
    if (url.pathname === '/calendar') {
      return response(
        weekdays.map(([en, cn, ja], index) => ({
          weekday: { en, cn, ja, id: index + 1 },
          items:
            index === 0
              ? [
                  {
                    id: 1,
                    type: 2,
                    name: 'Original title that should remain available as fallback',
                    name_cn:
                      '一个需要在图片卡片中安全换行的超长中文收藏动画标题：少女终末旅行与更多文字',
                    air_date: '2026-08-10',
                    air_weekday: 1,
                  },
                  {
                    id: 2,
                    type: 2,
                    name: 'Uncollected calendar item',
                    name_cn: '未收藏日历条目',
                    air_date: '2026-08-10',
                    air_weekday: 1,
                  },
                ]
              : [],
        })),
      );
    }
    return response({
      total: 2,
      limit: 50,
      offset: 0,
      data: [
        {
          subject_id: 1,
          subject_type: 2,
          type: 3,
          ep_status: 6,
          comment: 'private comment must not reach the artifact',
          subject: {
            id: 1,
            type: 2,
            name: 'Original title that should remain available as fallback',
            name_cn: '一个需要在图片卡片中安全换行的超长中文收藏动画标题：少女终末旅行与更多文字',
            date: '2026-08-10',
            eps: 12,
          },
        },
        {
          subject_id: 3,
          subject_type: 2,
          type: 1,
          ep_status: 0,
          comment: 'private unmatched comment',
          subject: {
            id: 3,
            type: 2,
            name: 'Unmatched collection item',
            name_cn: '未匹配收藏条目',
            date: '2026-08-10',
            eps: 0,
          },
        },
      ],
    });
  };
  const transport = new HttpClient({ fetchFn });
  return new CollectionScheduleService(new GeneratedBangumiOpenApiClient(transport), transport);
}

async function fixtureResult(): Promise<CollectionScheduleResult> {
  return fixtureService().getCollectionSchedule('bound-user');
}

describe('collection-schedule renderer', () => {
  let renderService: RenderService;

  beforeAll(() => {
    renderService = new RenderService();
  });

  afterAll(async () => {
    await renderService.close();
  });

  it('renders bounded partial schedule evidence without assets or private comments', async () => {
    const result = await fixtureResult();
    const viewModel = buildCollectionScheduleViewModel(result);

    expect(result.state).toBe('partial');
    expect(viewModel.template).toBe('collection-schedule');
    expect(viewModel.coverage.renderedItems).toBe(1);
    expect(viewModel.coverage.renderedUnmatchedCalendar).toBe(1);
    expect(viewModel.coverage.renderedUnmatchedCollection).toBe(1);
    expect(extractImageUrls(viewModel)).toEqual([]);

    const html = renderHtmlTemplate(viewModel, 'bangumi-dark', {}, 640);
    expect(html).toContain('我的本周播出计划');
    expect(html).toContain('部分覆盖');
    expect(html).toContain('collection-schedule-v1');
    expect(html).toContain('一个需要在图片卡片中安全换行的超长中文收藏动画标题');
    expect(html).toContain('收藏中未出现在本周日历的条目');
    expect(html).not.toContain('private comment');

    const rendered = await renderService.renderCard(viewModel, { width: 640 });
    expect(rendered.template).toBe('collection-schedule');
    expect(rendered.buffer.length).toBeGreaterThan(1000);
  });
});
