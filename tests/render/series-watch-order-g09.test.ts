import { describe, expect, it, vi } from 'vitest';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { SeriesService } from '@bangumi-agent-kit/bangumi-core';
import { buildSeriesRelationsViewModel, renderHtmlTemplate } from '@bangumi-agent-kit/renderer';

const G09_ROOT_ID = 218707;
const G09_DERIVATIVE_ID = 227245;

const rootRelations = [
  { id: 128202, type: 1, name: 'Source book', name_cn: '原作书籍', relation: '书籍' },
  { id: G09_DERIVATIVE_ID, type: 2, name: 'Shuumatsu spin-off', name_cn: '少女周末授课', relation: '衍生' },
  { id: 228591, type: 3, name: 'Opening theme', name_cn: '片头曲', relation: '片头曲' },
  { id: 228592, type: 3, name: 'Ending theme', name_cn: '片尾曲', relation: '片尾曲' },
  { id: 228753, type: 6, name: 'Live action', name_cn: '真人衍生', relation: '衍生' },
  { id: 229037, type: 3, name: 'Soundtrack', name_cn: '原声集', relation: '原声集' },
  { id: 239966, type: 1, name: 'Source book 2', name_cn: '相关书籍', relation: '书籍' },
  { id: 244123, type: 3, name: 'Other music', name_cn: '其他音乐', relation: '其他' },
  { id: 246006, type: 3, name: 'Soundtrack 2', name_cn: '原声集', relation: '原声集' },
];

describe('G09 Girls’ Last Tour bounded watch-order scenario', () => {
  it('keeps the direct derivative as a bounded recommendation and renders its limits', async () => {
    const requests: string[] = [];
    const fetchFn = vi.fn(async (input: string | URL) => {
      const url = String(input);
      requests.push(url);

      if (url.endsWith(`/v0/subjects/${G09_ROOT_ID}`)) {
        return new Response(
          JSON.stringify({
            id: G09_ROOT_ID,
            type: 2,
            name: 'Shuumatsu no Tabitabi',
            name_cn: '少女終末旅行',
            date: '2017-10-06',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      if (url.endsWith(`/v0/subjects/${G09_ROOT_ID}/subjects`)) {
        return new Response(JSON.stringify(rootRelations), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
      if (url.endsWith(`/v0/subjects/${G09_DERIVATIVE_ID}/subjects`)) {
        return new Response(
          JSON.stringify([
            {
              id: G09_ROOT_ID,
              type: 2,
              name: 'Shuumatsu no Tabitabi',
              name_cn: '少女終末旅行',
              relation: '主线故事',
            },
          ]),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      if (url.endsWith(`/v0/subjects/${G09_DERIVATIVE_ID}`)) {
        return new Response(
          JSON.stringify({
            id: G09_DERIVATIVE_ID,
            type: 2,
            name: 'Shuumatsu no Jugyou',
            name_cn: '少女周末授课',
            date: '2017-10-06',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      return new Response('unexpected fixture request', { status: 404 });
    });

    const result = await new SeriesService(
      new HttpClient({ fetchFn: fetchFn as typeof fetch }),
    ).getSeriesWatchOrder(G09_ROOT_ID, { depth: 2, maxNodes: 8, media: 'anime' });

    expect(requests).toEqual([
      `https://api.bgm.tv/v0/subjects/${G09_ROOT_ID}`,
      `https://api.bgm.tv/v0/subjects/${G09_ROOT_ID}/subjects`,
      `https://api.bgm.tv/v0/subjects/${G09_DERIVATIVE_ID}/subjects`,
      `https://api.bgm.tv/v0/subjects/${G09_DERIVATIVE_ID}`,
    ]);
    expect(result).toMatchObject({
      state: 'complete',
      subjectId: G09_ROOT_ID,
      root: { id: G09_ROOT_ID, type: 'anime' },
      watchOrder: [
        { id: G09_ROOT_ID, position: 1, placement: 'root', isRoot: true },
        {
          id: G09_DERIVATIVE_ID,
          position: 2,
          placement: 'after_root',
          isRoot: false,
          relationLabels: ['衍生'],
        },
      ],
      coverage: {
        depth: 2,
        maxNodes: 8,
        media: 'anime',
        relationRequests: 2,
        relationRowsObserved: 10,
        uniqueRelatedObserved: 9,
        uniqueRelatedReturned: 1,
        animeNodesObserved: 1,
        animeNodesSelected: 1,
        nonAnimeRowsObserved: 8,
        nonAnimeRowsReturned: 0,
        detailsAttempted: 1,
        detailsFetched: 1,
        detailsFailed: 0,
        relationFailures: 0,
        truncated: false,
      },
      excluded: {
        count: 8,
        byReason: [{ reason: 'media_type_not_anime', count: 8 }],
      },
    });
    expect(result.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fromId: G09_ROOT_ID,
          toId: G09_DERIVATIVE_ID,
          relation: '衍生',
          relationKind: 'side_story',
          pathIds: [G09_ROOT_ID, G09_DERIVATIVE_ID],
          direct: true,
        }),
      ]),
    );
    expect(result.limitations.join(' ')).toContain('没有发布统一的官方观看顺序');

    const viewModel = buildSeriesRelationsViewModel(result);
    for (const width of [360, 720]) {
      const html = renderHtmlTemplate(viewModel, 'bangumi-dark', {}, width);
      expect(html).toContain('少女終末旅行');
      expect(html).toContain('少女周末授课');
      expect(html).toContain('衍生');
      expect(html).toContain('推荐是有限深度的确定性推导');
      expect(html).toContain('不是 Bangumi 发布的唯一官方观看顺序');
      expect(html).toContain('非动画媒介');
    }
  });
});
