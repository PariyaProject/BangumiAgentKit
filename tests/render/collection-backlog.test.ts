import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GeneratedBangumiOpenApiClient } from '@bangumi-agent-kit/bangumi-openapi';
import { BangumiError, HttpClient } from '@bangumi-agent-kit/bangumi-transport';
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

async function buildEmptyBacklogViewModel(calendarAvailable: boolean) {
  const fetchFn: typeof fetch = async (input) => {
    const url = new URL(String(input));
    if (url.pathname === '/calendar') {
      if (!calendarAvailable) {
        throw new BangumiError('UPSTREAM_UNAVAILABLE', 'synthetic calendar outage', false, 503);
      }
      return new Response(
        JSON.stringify(
          Array.from({ length: 7 }, (_, index) => ({
            weekday: {
              id: index + 1,
              en: `Day${index + 1}`,
              cn: `星期${index + 1}`,
              ja: `曜日${index + 1}`,
            },
            items: [],
          })),
        ),
        { status: 200 },
      );
    }
    if (url.pathname.endsWith('/collections')) {
      return new Response(JSON.stringify({ total: 0, limit: 50, offset: 0, data: [] }), {
        status: 200,
      });
    }
    throw new Error(`Unexpected synthetic request: ${url.pathname}`);
  };
  const httpClient = new HttpClient({ fetchFn });
  const result = await new CollectionBacklogService(buildClient(fetchFn), httpClient).getCollectionBacklog(
    'synthetic-bound-user',
    { includeSchedule: true },
  );
  return buildCollectionBacklogViewModel(result);
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
      if (url.pathname === '/calendar') {
        return new Response(
          JSON.stringify(
            Array.from({ length: 7 }, (_, index) => ({
              weekday: {
                id: index + 1,
                en: `Day${index + 1}`,
                cn: `星期${index + 1}`,
                ja: `曜日${index + 1}`,
              },
              items:
                index === 0
                  ? [
                      {
                        id: 1,
                        type: 2,
                        name: 'Long Original Title',
                        name_cn: '一个需要在窄卡片中安全换行的超长收藏标题：少女终末旅行与更多文字',
                        air_date: '2026-08-24',
                        air_weekday: 1,
                      },
                    ]
                  : [],
            })),
          ),
          { status: 200 },
        );
      }
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
          total: 3,
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
                airdate: '2026-01-01',
                duration_seconds: 1500,
              },
            },
            {
              type: 1,
              updated_at: 1_723_600_000,
              episode: {
                id: 2,
                subject_id: 1,
                type: 0,
                name: 'Episode 2',
                name_cn: '第二集',
                sort: 2,
                ep: 2,
                airdate: '2026-01-02',
                duration: '24m',
              },
            },
            {
              type: 1,
              updated_at: 1_723_600_000,
              episode: {
                id: 3,
                subject_id: 1,
                type: 0,
                name: 'Episode 3',
                name_cn: '第三集',
                sort: 3,
                ep: 3,
                airdate: '2026-01-03',
                duration: '24m',
              },
            },
          ],
        }),
        { status: 200 },
      );
    };
    const result = await new CollectionBacklogService(
      buildClient(fetchFn),
      new HttpClient({ fetchFn }),
    ).getCollectionBacklog('account-owner', { includeSchedule: true });
    const viewModel = buildCollectionBacklogViewModel(result);

    expect(viewModel.template).toBe('collection-backlog');
    expect(viewModel.state).toBe('complete');
    expect(viewModel.coverage.renderedItems).toBe(1);
    expect(extractImageUrls(viewModel)).toEqual([]);

    const html = renderHtmlTemplate(viewModel, 'bangumi-dark', {}, 640);
    expect(html).toContain('我的收藏待看清单');
    expect(html).toContain('剩余 2 集');
    expect(html).toContain('公式版本：backlog v2');
    expect(html).toContain('时长 v1');
    expect(html).toContain('播出 v1');
    expect(html).toContain('完整度 v1');
    expect(html).toContain('一个需要在窄卡片中安全换行的超长收藏标题');
    expect(html).toContain('已知待看时长');
    expect(html).toContain('已知约 48 分');
    expect(html).toContain('计划 星期1');
    expect(html).toContain('证据完整度 高');
    expect(html).not.toContain('collection-backlog-schedule-v1');
    expect(html).not.toContain('collection-backlog-confidence-v1');
    expect(html).not.toContain('private comment');
    expect(viewModel.evidence.formulaVersion).toBe('collection-backlog-v2');
    expect(viewModel.evidence.durationFormulaVersion).toBe('collection-backlog-duration-v1');
    expect(viewModel.evidence.scheduleFormulaVersion).toBe('collection-backlog-schedule-v1');
    expect(viewModel.evidence.confidenceFormulaVersion).toBe('collection-backlog-confidence-v1');

    const rendered = await renderService.renderCard(viewModel, { width: 640 });
    expect(rendered.template).toBe('collection-backlog');
    expect(rendered.buffer.length).toBeGreaterThan(1000);
  });

  it('distinguishes a complete empty result from a partial empty sample', async () => {
    const complete = await buildEmptyBacklogViewModel(true);
    const partial = await buildEmptyBacklogViewModel(false);
    const completeHtml = renderHtmlTemplate(complete, 'bangumi-dark', {}, 320);
    const partialHtml = renderHtmlTemplate(partial, 'bangumi-dark', {}, 320);

    expect(complete.state).toBe('complete');
    expect(complete.presentation?.emptyState?.title).toBe('没有符合条件的待看条目');
    expect(completeHtml).toContain('当前收藏已完整读取');
    expect(completeHtml).toContain('可调整状态筛选后再查看');

    expect(partial.state).toBe('partial');
    expect(partial.presentation?.emptyState?.title).toBe('暂未发现符合条件的条目');
    expect(partialHtml).toContain('未读取部分仍可能有符合条件的待看条目');
    expect(partialHtml).toContain('暂不要据此判断收藏为空');
    expect(partialHtml).not.toContain('收藏已完整读取');
    expect(partial.presentation?.warningMessages).toEqual([]);
    expect(partialHtml).not.toContain('UPSTREAM_UNAVAILABLE');

    expect(complete.presentation?.limitationSummary.length).toBeLessThan(
      complete.limitations.length,
    );
    expect(complete.limitations.length).toBeGreaterThan(4);
    expect(partial.limitations).toEqual(complete.limitations);
  });

  it('keeps permission-denied semantics visible in the zero-network card', () => {
    const result = {
      state: 'permission_denied' as const,
      data: {
        items: [],
        summary: {
          eligibleItems: 0,
          returnedItems: 0,
          completeItems: 0,
          incompleteItems: 0,
          notComputableItems: 0,
          unavailableItems: 0,
          conflictItems: 0,
          knownRemainingEpisodes: 0,
          finishedItems: 0,
          finishedIncompleteItems: 0,
          ongoingItems: 0,
          airingUnknownItems: 0,
        },
      },
      coverage: {
        state: 'permission_denied' as const,
        collection: {
          requestedMaxItems: 50,
          observedRows: 0,
          uniqueRows: 0,
          eligibleRows: 0,
          pagesAttempted: 1,
          pagesSucceeded: 0,
          maxPages: 8,
          sourceExhausted: false,
          truncated: false,
          duplicateRows: 0,
          paginationStalled: false,
          sourceTotalChanged: false,
        },
        hydration: {
          requestedSubjects: 0,
          attemptedSubjects: 0,
          succeededSubjects: 0,
          failedSubjects: 0,
          maxSubjects: 20,
          concurrency: 3,
          budgetExceeded: false,
        },
        episodeProgress: {
          maxEpisodesPerSubject: 200,
          pagesAttempted: 0,
          pagesSucceeded: 0,
          observedRows: 0,
          uniqueRows: 0,
          truncatedSubjects: 0,
          sourceTotalChangedSubjects: 0,
          failedSubjects: 0,
        },
        schedule: {
          state: 'not_requested' as const,
          attempted: false,
          expectedDays: 7 as const,
          sourceDayCount: 0,
          missingWeekdays: [1, 2, 3, 4, 5, 6, 7],
          duplicateWeekdays: [],
          invalidWeekdayCount: 0,
          observedRows: 0,
          uniqueRows: 0,
          duplicateRows: 0,
          invalidItemWeekdayCount: 0,
          weekdayConflictCount: 0,
          matchedItems: 0,
          nonAnimeRows: 0,
          truncated: false,
        },
      },
      source: {
        class: 'official_v0' as const,
        operations: [
          'GET /v0/users/{username}/collections',
          'GET /v0/users/-/collections/{subject_id}/episodes',
        ] as [
          'GET /v0/users/{username}/collections',
          'GET /v0/users/-/collections/{subject_id}/episodes',
        ],
        authScope: 'account' as const,
        attemptedAt: '2026-08-14T00:00:00.000Z',
      },
      evidence: [],
      limitations: [],
      warnings: [
        {
          code: 'PERMISSION_DENIED',
          state: 'permission_denied' as const,
          message: '当前账号没有执行此操作所需的权限。',
        },
      ],
      error: {
        code: 'PERMISSION_DENIED',
        message: '当前账号没有执行此操作所需的权限。',
        nextAction: '请重新授权',
      },
    };
    const viewModel = buildCollectionBacklogViewModel(result);
    const html = renderHtmlTemplate(viewModel, 'bangumi-dark', {}, 640);

    expect(viewModel.state).toBe('permission_denied');
    expect(viewModel.error?.code).toBe('PERMISSION_DENIED');
    expect(html).toContain('收藏读取权限不足');
    expect(html).toContain('请确认授权范围后重试。');
    expect(html).not.toContain('PERMISSION_DENIED');
    expect(html).toContain('当前授权没有收藏读取权限。');
    expect(html.match(/当前授权没有收藏读取权限。/gu)).toHaveLength(1);
    expect(viewModel.warnings[0]?.code).toBe('PERMISSION_DENIED');
    expect(viewModel.presentation?.warningMessages).toEqual([]);
  });

  it('preserves row-level recovery metadata through the view model and rendered card', async () => {
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
                ep_status: 1,
                subject: {
                  id: 1,
                  type: 2,
                  name: 'Auth Expired Row',
                  name_cn: '凭证失效行',
                  eps: 101,
                  date: '2026-01-01',
                  images: {},
                },
              },
            ],
          }),
          { status: 200 },
        );
      }
      if (url.searchParams.get('offset') === '100') {
        throw new BangumiError('AUTH_EXPIRED', 'credential expired', false, 401, '请重新授权');
      }
      return new Response(
        JSON.stringify({
          total: 101,
          limit: 100,
          offset: 0,
          data: Array.from({ length: 100 }, (_, index) => ({
            type: index === 0 ? 2 : 1,
            updated_at: 1_723_600_000,
            episode: {
              id: index + 1,
              subject_id: 1,
              type: 0,
              name: `Episode ${index + 1}`,
              name_cn: `第 ${index + 1} 集`,
              sort: index + 1,
              ep: index + 1,
              airdate: '2026-01-01',
            },
          })),
        }),
        { status: 200 },
      );
    };

    const result = await new CollectionBacklogService(buildClient(fetchFn)).getCollectionBacklog(
      'account-owner',
    );
    const viewModel = buildCollectionBacklogViewModel(result);

    expect(result.data.items[0]?.error).toMatchObject({
      code: 'AUTH_EXPIRED',
      message: 'Bangumi 登录凭证已失效，请重新授权。',
      nextAction: '请重新授权',
    });
    expect(viewModel.items[0]?.error).toMatchObject({
      code: 'AUTH_EXPIRED',
      nextAction: '请重新授权',
    });

    const html = renderHtmlTemplate(viewModel, 'bangumi-dark', {}, 640);
    expect(html).not.toContain('AUTH_EXPIRED');
    expect(html).toContain('Bangumi 登录凭证已失效，请重新授权。');
    expect(html).toContain('请重新授权');
    expect(viewModel.items[0]?.error?.code).toBe('AUTH_EXPIRED');

    const rendered = await renderService.renderCard(viewModel, { width: 640 });
    expect(rendered.template).toBe('collection-backlog');
    expect(rendered.buffer.length).toBeGreaterThan(1000);
  });
});
