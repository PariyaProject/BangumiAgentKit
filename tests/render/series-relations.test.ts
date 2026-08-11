import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  RenderService,
  SeriesRelationsViewModel,
  renderHtmlTemplate,
} from '@bangumi-agent-kit/renderer';

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const viewModel: SeriesRelationsViewModel = {
  template: 'series-relations',
  version: 1,
  state: 'partial',
  root: {
    id: 68812,
    name: '〈物語〉シリーズ セカンドシーズン',
    nameCn: '〈物语〉系列 第二季',
    type: 'anime',
    date: '2013-07-06',
  },
  watchOrder: [
    {
      id: 82322,
      position: 1,
      name: '花物語',
      nameCn: '花物语',
      type: 'anime',
      date: '2014-08-16',
      relationLabels: ['前传'],
      relationKinds: ['prequel'],
      isRoot: false,
      placementReason: '关系标签标记为前传，置于起始条目前',
    },
    {
      id: 68812,
      position: 2,
      name: '〈物語〉シリーズ セカンドシーズン',
      nameCn: '〈物语〉系列 第二季',
      type: 'anime',
      date: '2013-07-06',
      relationLabels: [],
      relationKinds: [],
      isRoot: true,
      placementReason: '请求的起始条目',
    },
    {
      id: 90001,
      position: 3,
      name: '长名字的衍生作品 Long Title',
      nameCn: '一个很长很长的衍生作品中文标题用于移动宽度换行',
      type: 'anime',
      relationLabels: ['衍生'],
      relationKinds: ['side_story'],
      isRoot: false,
      placementReason: '关系标签标记为衍生/番外，置于核心条目后',
    },
  ],
  related: [
    {
      id: 70000,
      name: '原作小说',
      nameCn: '原作小说',
      type: 'book',
      relationLabels: ['书籍'],
      relationKinds: ['book'],
      includedInWatchOrder: false,
      exclusionReason: 'media_type_not_anime',
    },
  ],
  excluded: {
    count: 1,
    byReason: [{ reason: 'media_type_not_anime', count: 1 }],
    samples: [
      {
        id: 70000,
        name: '原作小说',
        nameCn: '原作小说',
        type: 'book',
        reason: 'media_type_not_anime',
      },
    ],
  },
  coverage: {
    depth: 1,
    maxNodes: 8,
    media: 'anime',
    relationRequests: 2,
    relationRowsObserved: 4,
    uniqueRelatedObserved: 4,
    uniqueRelatedReturned: 3,
    detailsFetched: 2,
    detailsFailed: 1,
    relationFailures: 0,
    truncated: true,
    truncationReasons: ['subject-detail-failure'],
    retrievedAt: '2026-08-11T00:00:00.000Z',
  },
  capabilityStates: { watchOrder: 'bounded_recommendation' },
  evidence: {
    label: 'Bangumi official v0 subject relations',
    operations: ['/v0/subjects/68812', '/v0/subjects/68812/subjects'],
    derivation: 'series-watch-order-v1',
    retrievedAt: '2026-08-11T00:00:00.000Z',
  },
  limitations: ['关系接口没有发布统一的官方观看顺序；本结果是有限深度、有限节点的确定性推荐。'],
  warnings: [
    { code: 'SOURCE_LIMITATION', state: 'partial', message: '部分详情不可用；保留关系接口名称。' },
  ],
};

describe('Series relations renderer card', () => {
  let renderService: RenderService;

  beforeAll(() => {
    renderService = new RenderService();
  });

  afterAll(async () => {
    await renderService.close();
  });

  it('renders a mobile-readable partial card with CJK labels and evidence', async () => {
    const html = renderHtmlTemplate(viewModel, 'bangumi-dark', {}, 640);
    expect(html).toContain('系列关系与观看建议');
    expect(html).toContain('前传');
    expect(html).toContain('部分覆盖');
    expect(html).toContain('series-watch-order-v1');
    expect(html).toContain('原作小说');

    const result = await renderService.renderCard(viewModel, { width: 640 });
    expect(result.buffer.subarray(0, 8).equals(PNG_MAGIC)).toBe(true);
    expect(result.width).toBe(1280);
    expect(result.height).toBeGreaterThan(300);
  });

  it('renders the same contract at the desktop width', async () => {
    const result = await renderService.renderCard(viewModel, { width: 960 });
    expect(result.template).toBe('series-relations');
    expect(result.width).toBe(1920);
    expect(result.height).toBeGreaterThan(300);
  });
});
