import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  COLLECTION_COMPLETION_UNRESOLVED_CAVEAT,
  DiscoveryEngine,
} from '@bangumi-agent-kit/discovery';
import { ProviderRegistry } from '@bangumi-agent-kit/provider-core';
import {
  buildDiscoveryResultsViewModel,
  extractImageUrls,
  renderHtmlTemplate,
  RenderService,
} from '@bangumi-agent-kit/renderer';
import { closeMobileLayoutBrowser, measureRenderRootLayout } from './helpers/mobile-layout.js';

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+6R0JggAAAABJRU5ErkJggg==',
  'base64',
);

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
      collectionCompletionRate: index === 6 ? undefined : 0.4,
    })),
    plan: {
      operation: 'searchSubjects',
      quality: state === 'unsupported' ? 'unsupported' : 'exact',
      pushdown: [
        { field: 'media', operator: 'in', value: ['anime'] },
        { field: 'dateRange', operator: 'range', value: { from: '2026-01-01', to: '2027-01-01' } },
      ],
      postFilters: [{ field: 'categories', operator: 'in', value: ['tv'] }],
      derivedFilters: [{ field: 'order', operator: 'eq', value: 'desc' }] as Array<{
        field: string;
        operator: string;
        value: unknown;
      }>,
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
      unresolvedCandidates: state === 'ok' ? 0 : 1,
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
    await closeMobileLayoutBrowser();
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

  it('labels collection heat precisely and shows the score tie-break boundary in Chinese', () => {
    const heatResult = makeResult('ok', 1);
    heatResult.plan.pushdown = [{ field: 'sort:heat', operator: 'eq', value: ['heat'] }];
    const heatViewModel = buildDiscoveryResultsViewModel(heatResult, {
      media: 'anime',
      sort: 'heat',
    });

    expect(heatViewModel.query.facets).toContain('排序：收藏人数（当前）');
    expect(heatViewModel.plan.pushdown[0]).toContain('收藏人数（当前）');
    expect(heatViewModel.plan.pushdown[0]).not.toContain('热度');

    const tieResult = makeResult('ok', 1);
    tieResult.plan.limitations = [
      'A top-N score tie-break scans the bounded ordered candidate window through the first lower-scored row; an unproven cutoff is reported as partial.',
    ];
    const tieViewModel = buildDiscoveryResultsViewModel(tieResult, {
      media: 'anime',
      sort: 'score',
      tieBreak: { field: 'ratingCount', order: 'desc' },
    });
    const html = renderHtmlTemplate(tieViewModel, 'bangumi-dark', {}, 360);

    expect(tieViewModel.query.facets).toContain('同分排序：评分人数 / 降序');
    expect(html).toContain(
      '评分同分时会继续检查候选，直到出现更低评分；预算内无法证明分界时标记为部分覆盖',
    );
  });

  it('renders the collection-share threshold, row values, and formula caveat before bounded rows', () => {
    const result = makeResult('partial', 2);
    result.plan.derivedFilters = [
      {
        field: 'collectionCompletionRate',
        operator: 'range',
        value: { max: 0.4 },
      },
    ];
    result.plan.limitations = [
      'collectionCompletionRate = collect / (wish + collect + doing + on_hold + dropped); this sample-verified ratio is not an official API formula, episode completion, personal progress, or preference. Official subject search is experimental and totals are estimated, so results describe only the bounded observed sample.',
      COLLECTION_COMPLETION_UNRESOLVED_CAVEAT,
    ];
    result.coverage.unresolvedCandidates = 3;
    result.items[0]!.collectionCompletionRate = 0.2;
    result.items[1]!.collectionCompletionRate = 0.4;

    const viewModel = buildDiscoveryResultsViewModel(result, {
      media: 'anime',
      rating: { min: 8 },
      collectionCompletionRate: { max: 0.4 },
    });
    const html = renderHtmlTemplate(viewModel, 'bangumi-dark', {}, 640);

    expect(viewModel.query.facets).toContain('collect 在五类收藏状态中的占比：≤40.0%');
    expect(viewModel.items[0]?.collectionCompletionRate).toBe(0.2);
    expect(viewModel.coverage.unresolvedCandidates).toBe(3);
    expect(html).toContain('collect 状态占比（五类状态合计） 20.0%');
    expect(html).toContain('40.0%');
    expect(html).toContain('不是官方 API 公式、章节完成率、个人进度或偏好');
    expect(html).toContain(COLLECTION_COMPLETION_UNRESOLVED_CAVEAT);
    expect(html).toContain('未解析候选 3');
    expect(html.indexOf('条件解释')).toBeLessThan(html.indexOf('Original title 1'));
  });

  it('renders the resolved season when the query requested the current season', () => {
    const result = makeResult('partial', 1);
    Object.assign(result.plan, { season: '2026-autumn' });
    const viewModel = buildDiscoveryResultsViewModel(result, {
      media: 'anime',
      season: 'current',
      tags: ['校园', '恋爱'],
      sort: 'heat',
      order: 'desc',
      limit: 12,
    });

    expect(viewModel.query.facets).toEqual(
      expect.arrayContaining([
        '季度：2026-autumn',
        '标签：校园、恋爱',
        '排序：收藏人数（当前） / 降序',
      ]),
    );
    expect(viewModel.query.facets).not.toContain('季度：current');
  });

  it('explains experimental search and bounded coverage in Chinese at mobile chat size', async () => {
    const result = makeResult('ok', 15);
    result.items = result.items.map((item, index) => ({
      ...item,
      date: `2026-07-${String((index % 28) + 1).padStart(2, '0')}`,
    }));
    result.plan.limitations = [
      'Enumeration is bounded by maxPages and maxCandidates.',
      'Official subject search is experimental; estimated totals do not establish completeness of the entire Bangumi database.',
      'all requests a complete attempt; budget exhaustion is reported as partial.',
      '未识别的来源说明仍保留。',
    ];
    result.coverage.requested = 100;
    result.coverage.scanned = 15;
    result.coverage.matched = 15;
    result.coverage.pagesScanned = 1;
    result.coverage.totalKind = 'estimated';
    result.warnings = [
      {
        code: 'EXPERIMENTAL_SOURCE',
        message: 'Official v0 subject search is marked experimental upstream.',
      },
      { code: 'FUTURE_DISCOVERY_NOTICE', message: '未知来源提示仍保留。' },
    ];
    result.evidence[0]!.source.experimental = true;

    const viewModel = buildDiscoveryResultsViewModel(result, {
      media: 'anime',
      year: 2026,
      month: 7,
      concepts: ['后宫'],
      resultMode: 'all',
      limit: 100,
    });
    const html = renderHtmlTemplate(viewModel, 'bangumi-dark', {}, 360);

    expect(html).toContain('官方作品搜索接口仍处于实验阶段。');
    expect(html).toContain('检索受最大页数与候选条目数限制');
    expect(html).toContain('官方搜索总数为估算值，不能据此认定 Bangumi 全库已完整覆盖');
    expect(html).toContain('“尽量完整”会在预算内继续检索；预算耗尽时仍标记为部分覆盖');
    expect(html).toContain('未知来源提示仍保留。');
    expect(html).toContain('另有 1 条限制');
    expect(html).not.toContain('Official v0 subject search is marked experimental upstream.');
    expect(html).not.toContain('Enumeration is bounded by maxPages and maxCandidates.');
    expect(html).not.toContain(
      'Official subject search is experimental; estimated totals do not establish completeness of the entire Bangumi database.',
    );
    expect(html).not.toContain(
      'all requests a complete attempt; budget exhaustion is reported as partial.',
    );
    expect(viewModel.warnings[0]?.message).toBe(
      'Official v0 subject search is marked experimental upstream.',
    );
    expect(viewModel.plan.limitations).toEqual(result.plan.limitations);

    const forwardCompatibilityResult = makeResult('ok', 1);
    forwardCompatibilityResult.plan.limitations = ['未识别的来源说明仍保留。'];
    const unfamiliarExperimentalMessage =
      'Experimental search may omit newly indexed subjects from this bounded result.';
    forwardCompatibilityResult.warnings = [
      { code: 'FUTURE_DISCOVERY_NOTICE', message: '未知来源提示仍保留。' },
      { code: 'EXPERIMENTAL_SOURCE', message: unfamiliarExperimentalMessage },
    ];
    const forwardCompatibilityViewModel = buildDiscoveryResultsViewModel(
      forwardCompatibilityResult,
      {},
    );
    const forwardCompatibilityHtml = renderHtmlTemplate(
      forwardCompatibilityViewModel,
      'bangumi-dark',
      {},
      360,
    );
    expect(forwardCompatibilityHtml).toContain('未识别的来源说明仍保留。');
    expect(forwardCompatibilityHtml).toContain('未知来源提示仍保留。');
    expect(forwardCompatibilityHtml).toContain(
      `官方搜索来源提示：${unfamiliarExperimentalMessage}`,
    );
    expect(forwardCompatibilityHtml).not.toContain('官方作品搜索接口仍处于实验阶段。');

    for (const width of [320, 360, 520]) {
      const mobileHtml = renderHtmlTemplate(viewModel, 'bangumi-dark', {}, width);
      const layout = await measureRenderRootLayout(mobileHtml, width);
      expect(layout.clientWidth, `[G01] root width at ${width}px`).toBe(width);
      expect(layout.scrollWidth, `[G01] scroll width at ${width}px`).toBe(width);
      expect(layout.overflowing, `[G01] overflowing elements at ${width}px`).toEqual([]);
    }

    const image = await renderService.renderCard(viewModel, {
      width: 360,
      deviceScaleFactor: 2,
    });
    expect(image.width).toBe(720);
    expect(image.height).toBeLessThan(8192);
    expect(image.buffer.subarray(0, 8).equals(PNG_MAGIC)).toBe(true);
    expect(html).toContain('另有 3 条本次已返回的结构化条目未在卡片中展开');
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

  it('enforces the 12-item renderer and asset-resolution ceiling for caller-created view models', async () => {
    const baseViewModel = buildDiscoveryResultsViewModel(makeResult('partial', 1), {});
    const oversizedViewModel = {
      ...baseViewModel,
      items: Array.from({ length: 13 }, (_, index) => ({
        ...baseViewModel.items[0]!,
        id: index + 100,
        name: `Oversized title ${index + 1}`,
        nameCn: `超出边界 ${index + 1}`,
        image: `https://img.example/${index + 1}.jpg`,
      })),
      hiddenCount: undefined,
      coverage: {
        ...baseViewModel.coverage,
        matched: 13,
        returned: 13,
        rendered: 13,
      },
    };

    expect(extractImageUrls(oversizedViewModel)).toHaveLength(12);

    let renderedHtml = '';
    const assetResolver = {
      resolveAsset: vi.fn(async () => ({
        dataUrl: 'data:image/png;base64,AA==',
      })),
    };
    const browserPool = {
      renderHtmlToBuffer: vi.fn(async (html: string) => {
        renderedHtml = html;
        return ONE_PIXEL_PNG;
      }),
      close: vi.fn(async () => undefined),
    };
    const service = new RenderService(browserPool as never, undefined, assetResolver as never);

    try {
      await service.renderCard(oversizedViewModel, { width: 640, deviceScaleFactor: 1 });
      expect(assetResolver.resolveAsset).toHaveBeenCalledTimes(12);
      expect(browserPool.renderHtmlToBuffer).toHaveBeenCalledTimes(1);
      expect(renderedHtml).toContain('另有 1 条本次已返回的结构化条目');
      expect(renderedHtml).toMatch(/展示(?:<!-- -->)?\s*12/u);
      expect(renderedHtml).not.toContain('Oversized title 13');
    } finally {
      await service.close();
    }
  });

  it('keeps genuine unsupported and unavailable engine results evidence-honest', async () => {
    const searchSubjects = vi.fn(async () => ({
      state: 'unavailable' as const,
      error: { code: 'upstream_unavailable' as const, retryable: true },
      warnings: [{ code: 'UPSTREAM_ERROR' as const, message: 'fixture provider unavailable' }],
    }));
    const unavailableRegistry = new ProviderRegistry({
      v0: {
        getSubject: vi.fn(async () => ({ state: 'not_found' as const })),
        getSubjectStats: vi.fn(async () => ({ state: 'not_found' as const })),
        searchSubjects,
        browseSubjects: vi.fn(async () => ({
          state: 'ok' as const,
          data: { items: [], total: 0, totalKind: 'exact' as const, limit: 20, offset: 0 },
          evidence: {},
        })),
      },
    });
    const unknownConceptRegistry = new ProviderRegistry({
      v0: {
        getSubject: vi.fn(async () => ({ state: 'not_found' as const })),
        getSubjectStats: vi.fn(async () => ({ state: 'not_found' as const })),
        searchSubjects: vi.fn(),
        browseSubjects: vi.fn(),
      },
    });

    const unsupportedResult = await new DiscoveryEngine(unknownConceptRegistry).query({
      concepts: ['not-in-vocabulary'],
      explain: 'compact',
    });
    const unavailableResult = await new DiscoveryEngine(unavailableRegistry).query({
      keyword: 'fixture unavailable',
      explain: 'compact',
    });

    expect(unsupportedResult.state).toBe('unsupported');
    expect(unavailableResult.state).toBe('unavailable');
    expect(searchSubjects).toHaveBeenCalledTimes(1);

    for (const result of [unsupportedResult, unavailableResult]) {
      const viewModel = buildDiscoveryResultsViewModel(result, {});
      expect(viewModel.source.operations).toEqual([]);
      expect(viewModel.source.experimental).toBeUndefined();
      const html = renderHtmlTemplate(viewModel, 'bangumi-dark', {}, 640);
      expect(html).toContain('无证据来源路径');
      expect(html).not.toContain('证据来源路径<!-- --> 条目搜索');
    }
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
