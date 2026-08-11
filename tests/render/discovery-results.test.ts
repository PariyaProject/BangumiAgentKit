import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  buildDiscoveryResultsViewModel,
  renderHtmlTemplate,
  RenderService,
} from '@bangumi-agent-kit/renderer';

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function makeResult(state: 'ok' | 'partial' | 'unsupported' | 'unavailable' = 'partial') {
  const coverageState: 'complete' | 'partial' = state === 'ok' ? 'complete' : 'partial';
  return {
    state,
    items: Array.from({ length: 13 }, (_, index) => ({
      id: index + 1,
      name: `Original title ${index + 1}`,
      nameCn: index === 0 ? `超长中文条目名称${'繁體簡體'.repeat(8)}` : `示例动画 ${index + 1}`,
      displayName: `示例动画 ${index + 1}`,
      media: 'anime',
      category: 'tv',
      date: index === 1 ? undefined : '2026-07-01',
      score: index === 2 ? undefined : 8.2,
      rank: index === 3 ? undefined : index + 1,
      ratingCount: index === 4 ? undefined : 5000 + index,
      collectionTotal: index === 5 ? undefined : 100 + index,
    })),
    plan: {
      operation: 'searchSubjects',
      quality: 'exact',
      pushdown: [
        {
          field: 'media',
          classification: 'PUSHDOWN',
          operator: 'in',
          value: ['anime'],
        },
        {
          field: 'dateRange',
          classification: 'PUSHDOWN',
          operator: 'range',
          value: { from: '2026-01-01', to: '2027-01-01' },
        },
      ],
      postFilters: [
        {
          field: 'categories',
          classification: 'POST_FILTER',
          operator: 'in',
          value: ['tv'],
        },
      ],
      derivedFilters: [
        {
          field: 'order',
          classification: 'DERIVED_FILTER',
          operator: 'eq',
          value: 'desc',
        },
      ],
      limitations: ['官方搜索总数是估计值。', '结果受有界预算限制。'],
    },
    coverage: {
      state: coverageState,
      requested: 10,
      scanned: 20,
      matched: 13,
      returned: 13,
      pagesScanned: 2,
      totalKind: 'estimated',
      upstreamExhausted: false,
      budgetExceeded: true,
      hydrationsAttempted: 5,
      hydrationsSucceeded: 4,
      hydrationsFailed: 1,
      hydrationsUnresolved: 1,
      reason: 'Execution budget was exhausted.',
    },
    warnings: [
      { code: 'DISCOVERY_BUDGET_EXCEEDED', message: '已达到有界执行预算。' },
      { code: 'DISCOVERY_HYDRATION_UNRESOLVED', message: '部分字段仍未知。' },
    ],
    limitations: ['卡片只展示前 12 条。'],
    evidence: [
      {
        source: { class: 'official_v0', operation: 'searchSubjects', experimental: true },
        retrievedAt: '2026-08-11T00:00:00.000Z',
      },
    ],
    explanation: { limitations: ['experimental 搜索不证明全库完整性。'] },
  };
}

describe('discovery-results renderer', () => {
  let renderService: RenderService;

  beforeAll(() => {
    renderService = new RenderService();
  });

  afterAll(async () => {
    await renderService.close();
  });

  it('builds a bounded, evidence-aware view model without fabricating missing fields', () => {
    const viewModel = buildDiscoveryResultsViewModel(makeResult(), {
      keyword: '<script>alert(1)</script>',
      media: 'anime',
      concepts: ['后宫'],
      rating: { min: 8 },
      sort: 'score',
      limit: 10,
    });

    expect(viewModel.template).toBe('discovery-results');
    expect(viewModel.state).toBe('partial');
    expect(viewModel.items).toHaveLength(12);
    expect(viewModel.hiddenCount).toBe(1);
    expect(viewModel.query.facets).toEqual(
      expect.arrayContaining(['媒介：动画', '概念：后宫', '评分：≥8']),
    );
    expect(viewModel.items[2]?.score).toBeUndefined();
    expect(viewModel.plan.pushdown[0]).toContain('媒介');
    expect(viewModel.plan.postFilters[0]).toContain('分类');
    expect(viewModel.source.operations).toEqual(expect.arrayContaining(['searchSubjects']));
    expect(viewModel.coverage.budgetExceeded).toBe(true);
  });

  it('escapes query text and keeps unsupported/unavailable states explicit', () => {
    const partialViewModel = buildDiscoveryResultsViewModel(makeResult(), {
      keyword: '<script>alert(1)</script>',
    });
    const html = renderHtmlTemplate(partialViewModel, 'bangumi-dark', {}, 640);
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).not.toContain('<script>alert(1)</script>');

    for (const state of ['unsupported', 'unavailable'] as const) {
      const viewModel = buildDiscoveryResultsViewModel({ ...makeResult(state), items: [] }, {});
      const stateHtml = renderHtmlTemplate(viewModel, 'bangumi-dark', {}, 640);
      expect(stateHtml).toContain(state === 'unsupported' ? '条件不支持' : '来源不可用');
    }
  });

  it('renders representative mobile and desktop PNGs', async () => {
    const viewModel = buildDiscoveryResultsViewModel(makeResult(), {
      media: 'anime',
      categories: 'tv',
      concepts: ['后宫'],
      explain: 'compact',
    });
    for (const width of [640, 960]) {
      const result = await renderService.renderCard(viewModel, {
        width,
        deviceScaleFactor: 1,
      });
      expect(result.template).toBe('discovery-results');
      expect(result.width).toBe(width);
      expect(result.height).toBeGreaterThan(200);
      expect(result.buffer.subarray(0, 8).equals(PNG_MAGIC)).toBe(true);
    }
  });
});
