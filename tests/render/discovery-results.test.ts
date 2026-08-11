import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  buildDiscoveryResultsViewModel,
  renderHtmlTemplate,
  RenderService,
} from '@bangumi-agent-kit/renderer';

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

type FixtureState = 'ok' | 'partial' | 'unsupported' | 'unavailable';

function makeResult(state: FixtureState = 'partial', itemCount = 13) {
  const coverageState: 'complete' | 'partial' | 'not_applicable' =
    state === 'ok' ? 'complete' : state === 'unsupported' ? 'not_applicable' : 'partial';
  return {
    state,
    items: Array.from({ length: itemCount }, (_, index) => ({
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
      quality: state === 'unsupported' ? 'unsupported' : 'exact',
      pushdown: [
        { field: 'media', operator: 'in', value: ['anime'] },
        { field: 'dateRange', operator: 'range', value: { from: '2026-01-01', to: '2027-01-01' } },
      ],
      postFilters: [{ field: 'categories', operator: 'in', value: ['tv'] }],
      derivedFilters: [{ field: 'order', operator: 'eq', value: 'desc' }],
      unsupported: [],
      limitations: ['官方搜索总数是估计值。', '结果受有界预算限制。'],
    },
    coverage: {
      state: coverageState,
      requested: 10,
      scanned: 20,
      matched: itemCount,
      returned: itemCount,
      pagesScanned: 2,
      totalKind: state === 'ok' ? 'exact' : 'estimated',
      upstreamExhausted: state === 'ok',
      budgetExceeded: state !== 'ok',
      outputCap: state === 'partial' ? 12 : undefined,
      hydrationsAttempted: state === 'ok' ? 0 : 5,
      hydrationsSucceeded: state === 'ok' ? 0 : 4,
      hydrationsFailed: state === 'ok' ? 0 : 1,
      hydrationsUnresolved: state === 'ok' ? 0 : 1,
      hydrationBudgetExceeded: false,
      reason: state === 'ok' ? undefined : 'Execution budget was exhausted.',
    },
    warnings:
      state === 'ok'
        ? []
        : [
            { code: 'DISCOVERY_BUDGET_EXCEEDED', message: '已达到有界执行预算。' },
            { code: 'DISCOVERY_HYDRATION_UNRESOLVED', message: '部分字段仍未知。' },
          ],
    limitations: state === 'ok' ? [] : ['卡片只展示前 12 条。'],
    evidence: [
      {
        source: { class: 'official_v0', operation: 'searchSubjects', experimental: state !== 'ok' },
        retrievedAt: '2026-08-11T00:00:00.000Z',
      },
    ],
    explanation: state === 'ok' ? undefined : { limitations: ['实验性搜索不证明全库完整性。'] },
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
    expect(viewModel.observedNotReturnedCount).toBeUndefined();
    expect(viewModel.coverage).toMatchObject({
      observed: 20,
      matched: 13,
      returned: 13,
      rendered: 12,
    });
    expect(viewModel.query.facets).toEqual(
      expect.arrayContaining(['媒介：动画', '概念：后宫', '评分：≥8']),
    );
    expect(viewModel.items[2]?.score).toBeUndefined();
    expect(viewModel.plan.pushdown[0]).toContain('媒介');
    expect(viewModel.plan.pushdown[0]).toContain('动画');
    expect(viewModel.plan.postFilters[0]).toContain('分类');
    expect(viewModel.plan.postFilters[0]).toContain('TV');
    expect(viewModel.plan.derivedFilters[0]).toContain('降序');
    expect(viewModel.source.operations).toEqual(expect.arrayContaining(['searchSubjects']));
    expect(viewModel.coverage.budgetExceeded).toBe(true);
  });

  it('separates card-hidden rows from observed candidates omitted by the engine', () => {
    const result = makeResult('partial', 10);
    result.coverage.matched = 50;
    result.coverage.returned = 10;

    const viewModel = buildDiscoveryResultsViewModel(result, {}, 100);

    expect(viewModel.items).toHaveLength(10);
    expect(viewModel.hiddenCount).toBeUndefined();
    expect(viewModel.observedNotReturnedCount).toBe(40);
    const html = renderHtmlTemplate(viewModel, 'bangumi-dark', {}, 640);
    expect(html).toContain('40 个匹配候选');
    expect(html).toContain('不代表其字段事实可用');
    expect(html).not.toContain('完整结构化结果仍由');

    const cappedViewModel = buildDiscoveryResultsViewModel(makeResult('partial', 20), {}, 100);
    expect(cappedViewModel.items).toHaveLength(12);
    expect(cappedViewModel.hiddenCount).toBe(8);
  });

  it('bounds schema-valid criteria and discloses omitted groups and values', () => {
    const longCriteria = Array.from(
      { length: 50 },
      (_, index) => `条件${index}-${'长文本'.repeat(40)}`,
    );
    const viewModel = buildDiscoveryResultsViewModel(makeResult('partial', 1), {
      tags: longCriteria,
      metaTags: longCriteria,
      excludeMetaTags: longCriteria,
      concepts: longCriteria,
      limit: 50,
      sort: 'date',
      order: 'desc',
      resultMode: 'all',
    });

    expect(viewModel.query.facets.length).toBeLessThanOrEqual(12);
    expect(viewModel.query.facets.join('')).toContain('另有');
    expect(viewModel.query.facets.every((facet) => Array.from(facet).length <= 128)).toBe(true);
    expect(viewModel.plan.pushdown.every((filter) => Array.from(filter).length <= 128)).toBe(true);
  });

  it('shows coverage reasons even when no detail hydration was attempted', () => {
    const result = makeResult('partial', 1);
    result.coverage.hydrationsAttempted = 0;
    result.coverage.hydrationsSucceeded = 0;
    result.coverage.hydrationsFailed = 0;
    result.coverage.hydrationsUnresolved = 0;
    result.coverage.reason = 'Output cap was reached.';

    const html = renderHtmlTemplate(
      buildDiscoveryResultsViewModel(result, {}),
      'bangumi-dark',
      {},
      640,
    );
    expect(html).toContain('覆盖说明：Output cap was reached.');
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

  it('renders the complete state and input-envelope matrix at mobile and desktop widths', async () => {
    const longCjk = '超長中文條目名稱與日本語タイトル'.repeat(18);
    const maxCriteria = Array.from({ length: 50 }, (_, index) => `${index}-${'長文本'.repeat(40)}`);
    const cases = [
      {
        label: 'complete',
        viewModel: buildDiscoveryResultsViewModel(makeResult('ok', 4), { media: 'anime' }),
      },
      {
        label: 'partial',
        viewModel: buildDiscoveryResultsViewModel(makeResult('partial'), {
          media: 'anime',
          categories: 'tv',
          concepts: ['后宫'],
          explain: 'compact',
        }),
      },
      {
        label: 'unsupported',
        viewModel: buildDiscoveryResultsViewModel(makeResult('unsupported', 0), {}),
      },
      {
        label: 'unavailable',
        viewModel: buildDiscoveryResultsViewModel(makeResult('unavailable', 0), {}),
      },
      {
        label: 'empty',
        viewModel: buildDiscoveryResultsViewModel(makeResult('partial', 0), { keyword: '空结果' }),
      },
      {
        label: 'long-cjk',
        viewModel: buildDiscoveryResultsViewModel(makeResult('partial', 3), {
          keyword: longCjk,
          tags: [longCjk, longCjk],
        }),
      },
      {
        label: 'max-input',
        viewModel: buildDiscoveryResultsViewModel(
          makeResult('partial', 12),
          {
            tags: maxCriteria,
            metaTags: maxCriteria,
            excludeMetaTags: maxCriteria,
            concepts: maxCriteria,
            limit: 50,
            sort: 'date',
            order: 'desc',
            resultMode: 'all',
          },
          100,
        ),
      },
    ];

    for (const testCase of cases) {
      for (const width of [640, 960]) {
        const result = await renderService.renderCard(testCase.viewModel, {
          width,
          deviceScaleFactor: 1,
        });
        expect(result.template, testCase.label).toBe('discovery-results');
        expect(result.width, testCase.label).toBe(width);
        expect(result.height, testCase.label).toBeGreaterThan(200);
        expect(result.height, testCase.label).toBeLessThan(5000);
        expect(result.buffer.subarray(0, 8).equals(PNG_MAGIC), testCase.label).toBe(true);
      }
    }
  }, 30_000);
});
