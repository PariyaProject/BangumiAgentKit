import { describe, expect, it } from 'vitest';
import { cohortComparisonResult } from './fixtures/subject-cohort-comparison.fixture';
import type { SubjectCohortComparisonResult } from '@bangumi-agent-kit/discovery';
import {
  buildSubjectCohortComparisonViewModel,
  extractImageUrls,
  RenderService,
  renderHtmlTemplate,
} from '@bangumi-agent-kit/renderer';
import { inspectC07PngArtifact } from '../../scripts/lib/c07-png-artifact-validation.mjs';

const result = cohortComparisonResult;

describe('subject cohort comparison renderer', () => {
  it('builds a bounded first-class card without image/network dependencies', () => {
    const viewModel = buildSubjectCohortComparisonViewModel(result, { maxSubjectsPerCohort: 1 });
    expect(viewModel.template).toBe('subject-cohort-comparison');
    expect(viewModel.coverage.omittedSubjectsPerCohort).toEqual([0, 0]);
    expect(extractImageUrls(viewModel)).toEqual([]);

    const html = renderHtmlTemplate(viewModel, 'bangumi-dark', {}, 720);
    expect(html).toContain('条目群体比较');
    expect(html).toContain('2026 春季');
    expect(html).toContain('评分总体标准差');
    expect(html).toContain('评分分布标准差');
    expect(html).toContain('计算方法：群体均值与差值 v1');
    expect(html).not.toContain('subject-cohort-comparison-v1');
    expect(html).not.toContain('bangumi.rating.population_sd.v1');
    expect(html).not.toContain('subject.rating.score');
    expect(html).not.toContain('searchSubjects');
    expect(html).toContain('B − A');
  });

  it('uses the available width for one cohort and keeps renderer details reader-facing', () => {
    const single = buildSubjectCohortComparisonViewModel({
      ...result,
      cohorts: [result.cohorts[0]!],
      coverage: {
        ...result.coverage,
        totalSubjectsReturned: 1,
        cohortsComplete: 1,
      },
    });
    const html = renderHtmlTemplate(single, 'bangumi-dark', {}, 960);
    expect(html).toContain('样本分组');
    expect(html).toContain('Bangumi 公共数据');
    expect(html).not.toContain('derived-s7');
    expect(html).not.toContain('sourceField');
    expect(html).not.toContain('searchSubjects');
  });

  it('uses pack-specific metric structure and cohort treatments for the comparison card', () => {
    const viewModel = buildSubjectCohortComparisonViewModel(result, { maxSubjectsPerCohort: 1 });
    const warmHtml = renderHtmlTemplate(viewModel, 'bangumi-light', {}, 320, 'warm-editorial');
    const galleryHtml = renderHtmlTemplate(viewModel, 'bangumi-light', {}, 320, 'clean-gallery');
    const zineHtml = renderHtmlTemplate(viewModel, 'bangumi-light', {}, 320, 'graphic-zine');

    expect(warmHtml).toContain('data-layout-variant="warm-folio-lead"');
    expect(warmHtml).toContain('data-layout-variant="warm-folio-row"');
    expect(galleryHtml).toContain('data-title-pack="clean-gallery"');
    expect(galleryHtml).not.toContain('border-left:3px solid');
    expect(galleryHtml).toContain('border-bottom:1px solid');
    expect(zineHtml).toContain('data-title-pack="graphic-zine"');
    expect(zineHtml).not.toContain('border-left:6px solid');
    expect(zineHtml).not.toContain('data-render-mask="panel"');
    expect(zineHtml).not.toContain('data-render-mask="panel-alt"');
    expect(galleryHtml).toContain('data-layout-variant="cohort-paired"');
    expect(galleryHtml).toContain('data-layout-variant="gallery-score-lead"');
    expect(galleryHtml).toContain('data-layout="gallery-score-bridge"');
    expect(galleryHtml).not.toContain('data-layout="gallery-score-orbit"');
    expect(galleryHtml).toContain('data-layout="gallery-comparison-matrix"');
    expect(galleryHtml).toContain('data-layout-variant="gallery-open-row"');
    expect(galleryHtml).toContain('data-layout-variant="gallery-open-method-notes"');
    expect(galleryHtml).not.toContain('data-layout="cohort-metric-bar"');
    expect(zineHtml).not.toContain('drop-shadow(2px 3px 0');
    expect(zineHtml).toContain('data-layout="zine-poster-board"');
    expect(zineHtml).toContain('data-layout="zine-title-paper"');
    expect(zineHtml).toContain('data-layout-variant="cohort-zine-headline-pair"');
    expect(zineHtml).toContain('data-layout-variant="zine-cohort-paper"');
    expect(zineHtml).toContain('Georgia');
    expect(zineHtml).toContain('data-layout="cohort-query-summary"');
    expect(zineHtml).toContain('媒介=anime');
    expect(zineHtml).toContain('data-layout="zine-waterfront-illustration"');
    expect(zineHtml).toContain('data-layout="zine-score-caption"');
    expect(zineHtml).toContain('aria-label="分组 A 平均评分 8.00"');
    expect(zineHtml).not.toContain('data-layout="zine-score-pair"');
    expect(zineHtml).not.toContain('data-layout-variant="zine-score-paper"');
    expect(zineHtml).toContain('data-layout="zine-score-bridge"');
    expect(zineHtml).toContain('data-layout-variant="zine-delta-paper"');
    expect(zineHtml).toContain('data-layout-variant="zine-paper-row"');
    expect(zineHtml).toContain('data-layout="zine-metric-header"');
    expect(zineHtml).toContain('data-layout-variant="zine-colophon-notes"');
    expect(zineHtml).toContain('data-layout="zine-colophon"');
    expect(zineHtml).toContain('2026 春季');
    expect(zineHtml).toContain('Spring One');
    expect(zineHtml).not.toContain('聚合指标');
    expect(zineHtml).not.toContain('data-layout-variant="zine-sticker"');
    expect(zineHtml).not.toContain('data-layout="zine-delta-sticker"');
  });

  it('prioritizes A, B, and delta values at narrow widths without repeating sample metrics', () => {
    const viewModel = buildSubjectCohortComparisonViewModel(result, { maxSubjectsPerCohort: 1 });
    const mobileHtml = renderHtmlTemplate(viewModel, 'bangumi-light', {}, 320);

    expect(mobileHtml).toContain('data-layout="cohort-overview"');
    expect(mobileHtml).toContain('data-layout-variant="cohort-paired"');
    expect(mobileHtml).toContain('data-layout="cohort-meta-compact"');
    expect(mobileHtml).toContain('Bangumi · 完整 · B−A · 仅作对照');
    expect(mobileHtml).toContain('padding:12px 14px 16px');
    expect(mobileHtml).toContain('flex-direction:column');
    expect(mobileHtml.match(/data-layout="cohort-metric-board"/gu)).toHaveLength(1);
    expect(mobileHtml.match(/data-layout="cohort-metric-header"/gu)).toBeNull();
    expect(mobileHtml.match(/data-layout="cohort-metric-bar"/gu)).toHaveLength(8);
    expect(mobileHtml).toContain('data-render-mask="panel"');
    expect(mobileHtml.match(/data-layout="cohort-metric-card"/gu)).toHaveLength(4);
    expect(mobileHtml.match(/data-layout="cohort-metric-comparison"/gu)).toHaveLength(4);
    expect(mobileHtml.match(/data-layout="cohort-metric-value"/gu)).toHaveLength(12);
    expect(mobileHtml).not.toContain('data-layout="cohort-subject-metrics"');
    expect(mobileHtml).not.toContain('评分 8.00');
    expect(mobileHtml).not.toContain('评分 7.00');
    expect(mobileHtml).toContain('8.00');
    expect(mobileHtml).toContain('7.00');
    expect(mobileHtml).toContain('-1.00');
    expect(mobileHtml).toContain('1/1 完整');

    const desktopHtml = renderHtmlTemplate(viewModel, 'bangumi-light', {}, 960);
    expect(desktopHtml.match(/data-layout="cohort-metric-comparison"/gu)).toHaveLength(4);
    expect(desktopHtml).toContain('计算口径：评分分布标准差');

    const pairedHtml = renderHtmlTemplate(viewModel, 'bangumi-light', {}, 520, 'clean-gallery');
    expect(pairedHtml).toContain('data-layout-variant="cohort-paired"');
    expect(pairedHtml).toContain('data-layout="gallery-comparison-matrix"');
  });

  it('never renders a numeric delta for a partial metric with a stale value', () => {
    const partialWithStaleDeltas = buildSubjectCohortComparisonViewModel({
      ...result,
      state: 'partial',
      metrics: result.metrics.map((metric) => ({
        ...metric,
        averages: [undefined, undefined],
        partialAverages: [metric.averages?.[0], undefined],
        state: 'partial',
        // Deliberately keep the complete-state delta to guard against stale fixture data.
        delta: metric.delta,
      })),
    });
    const html = renderHtmlTemplate(partialWithStaleDeltas, 'bangumi-light', {}, 320);
    const partialZineHtml = renderHtmlTemplate(
      partialWithStaleDeltas,
      'bangumi-light',
      {},
      320,
      'graphic-zine',
    );

    expect(html.match(/不可计算/gu)).toHaveLength(result.metrics.length);
    expect(partialZineHtml).toContain('Bangumi · 部分覆盖 · B−A · 仅作对照');
    expect(html.match(/data-state="missing"/gu)).toHaveLength(result.metrics.length);
    expect(html.match(/data-state="unscaled"/gu)).toHaveLength(result.metrics.length);
  });

  it('decodes the offline C07 comparison card and verifies its nonblank pixel signal', async () => {
    const viewModel = buildSubjectCohortComparisonViewModel(result, { maxSubjectsPerCohort: 1 });
    const service = new RenderService();
    try {
      const rendered = await service.renderCard(viewModel, {
        width: 360,
        deviceScaleFactor: 2,
        cache: false,
      });
      expect(inspectC07PngArtifact(rendered.buffer, rendered.width, rendered.height)).toEqual({
        decoded: true,
        dimensionsMatch: true,
        nonblankPixelSignalVerified: true,
      });
    } finally {
      await service.close();
    }
  });

  it('labels partial observations separately from accepted averages', () => {
    const partial = buildSubjectCohortComparisonViewModel({
      ...result,
      state: 'partial',
      cohorts: result.cohorts.map((cohort, index) =>
        index === 1
          ? {
              ...cohort,
              coverage: {
                ...cohort.coverage,
                metrics: {
                  ...cohort.coverage.metrics,
                  score: {
                    ...cohort.coverage.metrics.score,
                    valid: 0,
                    missing: 1,
                    state: 'partial',
                  },
                },
              },
            }
          : cohort,
      ),
      metrics: [
        {
          ...result.metrics[0]!,
          averages: [undefined, undefined],
          partialAverages: [8, 7],
          delta: undefined,
          state: 'partial',
        },
        ...result.metrics.slice(1),
      ],
    });
    const html = renderHtmlTemplate(partial, 'bangumi-dark', {}, 720);
    expect(html).toContain('部分样本');
    const narrowGalleryHtml = renderHtmlTemplate(
      partial,
      'bangumi-light',
      {},
      320,
      'clean-gallery',
    );
    expect(narrowGalleryHtml).toContain('data-layout-variant="gallery-open-row"');
    expect(narrowGalleryHtml).toContain('不可计算');
    expect(narrowGalleryHtml).toContain('0/1 缺失');
  });

  it('shows warning guidance without exposing internal warning codes', () => {
    const html = renderHtmlTemplate(
      {
        ...buildSubjectCohortComparisonViewModel(result),
        warnings: [
          {
            code: 'SYNTHETIC_PARTIAL_FIXTURE',
            state: 'partial',
            message: '条目详情暂不可用；缺失字段不会按 0 计算。',
          },
          {
            code: 'EXPERIMENTAL_SOURCE',
            state: 'partial',
            message: 'Official v0 subject search is marked experimental upstream.',
          },
          {
            code: 'FUTURE_PROVIDER_WARNING',
            state: 'partial',
            message: 'An unrecognized provider warning remains readable.',
          },
        ],
      },
      'bangumi-dark',
      {},
      360,
    );
    expect(html).toContain('条目详情暂不可用');
    expect(html).toContain('官方作品搜索接口仍处于实验阶段。');
    expect(html).not.toContain('Official v0 subject search is marked experimental upstream.');
    expect(html).toContain('An unrecognized provider warning remains readable.');
    expect(html).not.toContain('SYNTHETIC_PARTIAL_FIXTURE');
    expect(html).not.toContain('EXPERIMENTAL_SOURCE');
    expect(html).not.toContain('FUTURE_PROVIDER_WARNING');
  });

  it('deduplicates repeated provider warnings in the visual summary', () => {
    const viewModel = buildSubjectCohortComparisonViewModel(result);
    const duplicate = {
      code: 'EXPERIMENTAL_SOURCE',
      state: 'partial' as const,
      message: 'Official v0 subject search is marked experimental upstream.',
    };
    const html = renderHtmlTemplate(
      { ...viewModel, warnings: [duplicate, duplicate] },
      'bangumi-light',
      {},
      320,
    );

    expect(html.match(/官方作品搜索接口仍处于实验阶段。（共 2 条）/gu)).toHaveLength(1);
  });

  it('explains when search returned a row but no subject detail can be displayed', () => {
    const partial = buildSubjectCohortComparisonViewModel({
      ...result,
      state: 'partial',
      cohorts: [{ ...result.cohorts[0]!, subjects: [] }],
    });
    const html = renderHtmlTemplate(partial, 'bangumi-dark', {}, 360);

    expect(html).toContain('样本显示情况');
    expect(html).toContain('检索返回');
    expect(html).toContain('本图不显示作品行');
    expect(html).not.toContain('返回样本');
  });

  it('shows invalid discovery counts and score-versus-histogram conflict values', () => {
    const diagnosticResult: SubjectCohortComparisonResult = {
      ...result,
      state: 'conflict',
      cohorts: result.cohorts.map((cohort, index) => ({
        ...cohort,
        subjects: [
          {
            ...cohort.subjects[0]!,
            ...(index === 0
              ? {
                  ratingCount: undefined,
                  ratingCountState: 'invalid' as const,
                  ratingStandardDeviationConflicts: [
                    {
                      kind: 'score_vs_histogram_mean' as const,
                      officialScore: 9,
                      histogramMean: 8,
                      reason:
                        'official detail score materially differs from the histogram-derived mean',
                    },
                  ],
                  ratingHistogramTotalValidation: {
                    state: 'mismatch' as const,
                    detailRatingTotal: 99,
                    histogramPopulation: 100,
                  },
                  metricStates: {
                    ...cohort.subjects[0]!.metricStates,
                    ratingStandardDeviation: 'conflict' as const,
                  },
                }
              : {}),
          },
        ],
      })),
      metrics: result.metrics.map((metric) =>
        metric.key === 'ratingStandardDeviation'
          ? {
              ...metric,
              averages: [undefined, undefined],
              partialAverages: [undefined, 1.75],
              validCounts: [0, 1],
              conflictCounts: [1, 0],
              delta: undefined,
              state: 'conflict' as const,
            }
          : metric,
      ),
    };
    const viewModel = buildSubjectCohortComparisonViewModel(diagnosticResult);
    const html = renderHtmlTemplate(viewModel, 'bangumi-dark', {}, 720);

    expect(html).toContain('评分人数 无效');
    expect(html).toContain('官方评分 9.00 vs 直方图均值 8.00');
    expect(html).toContain('详情评分总数 99 与直方图样本 100 不匹配');
  });

  it('renders a bounded long cohort card at both supported widths', async () => {
    const longResult: SubjectCohortComparisonResult = {
      ...result,
      cohorts: result.cohorts.map((cohort, cohortIndex) => ({
        ...cohort,
        label: `${cohort.label} ${'非常长的标题'.repeat(20)}`,
        querySummary: `${cohort.querySummary} ${'很长的查询摘要'.repeat(40)}`,
        subjects: Array.from({ length: 60 }, (_, index) => ({
          ...cohort.subjects[0]!,
          id: cohortIndex * 1000 + index + 1,
          name: `${'原始条目名称'.repeat(30)} ${index}`,
          displayName: `${'超长中文条目名称'.repeat(30)} ${index}`,
        })),
      })),
      warnings: Array.from({ length: 12 }, (_, index) => ({
        code: `LONG_WARNING_${index}`,
        state: 'partial' as const,
        message: '有界渲染告警'.repeat(40),
      })),
      limitations: Array.from({ length: 8 }, (_, index) => `限制 ${index} ${'说明'.repeat(80)}`),
    };
    const viewModel = buildSubjectCohortComparisonViewModel(longResult, {
      maxSubjectsPerCohort: 12,
    });
    const mobileHtml = renderHtmlTemplate(viewModel, 'bangumi-light', {}, 320);
    expect(mobileHtml.match(/data-layout="cohort-label"/gu)).toHaveLength(2);
    expect(mobileHtml).toContain('-webkit-line-clamp:2');
    expect(mobileHtml.match(/data-layout="cohort-subject-item"/gu)).toHaveLength(2);
    expect(mobileHtml.match(/data-layout="cohort-subject-metrics"/gu) ?? []).toHaveLength(0);
    expect(mobileHtml.match(/data-layout="cohort-subject-summary"/gu)).toHaveLength(2);
    expect(mobileHtml.match(/图片展示 1\/60 条已返回样本/gu)).toHaveLength(2);
    expect(mobileHtml).toContain('（共 12 条）');
    expect(mobileHtml).toContain('另有 6 条限制未展开。');
    expect(mobileHtml).toContain('聚合指标仍按已取得的有效样本计算。');

    const midWidthHtml = renderHtmlTemplate(viewModel, 'bangumi-light', {}, 520);
    expect(midWidthHtml).toContain('-webkit-line-clamp:3');
    expect(midWidthHtml.match(/data-layout="cohort-subject-item"/gu)).toHaveLength(12);
    expect(midWidthHtml.match(/图片展示 6\/60 条已返回样本/gu)).toHaveLength(2);

    const desktopHtml = renderHtmlTemplate(viewModel, 'bangumi-light', {}, 960);
    expect(desktopHtml.match(/data-layout="cohort-subject-item"/gu)).toHaveLength(16);
    expect(desktopHtml.match(/图片展示 8\/60 条已返回样本/gu)).toHaveLength(2);

    const service = new RenderService();
    try {
      const mobileRender = await service.renderCard(viewModel, { width: 320, cache: false });
      expect(mobileRender.height).toBeLessThan(6500);
      for (const width of [640, 960]) {
        const rendered = await service.renderCard(viewModel, { width, cache: false });
        expect(rendered.buffer.subarray(0, 8)).toEqual(
          Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        );
        expect(rendered.height).toBeLessThan(6200);
      }
    } finally {
      await service.close();
    }
  });

  it('renders one cohort without inventing a B-minus-A column', () => {
    const oneCohort = buildSubjectCohortComparisonViewModel({
      ...result,
      cohorts: [result.cohorts[0]!],
      metrics: result.metrics.map((metric) => ({
        ...metric,
        averages: [metric.averages[0]],
        delta: undefined,
      })),
    });
    const html = renderHtmlTemplate(oneCohort, 'bangumi-dark', {}, 720);
    expect(html).toContain('条目群体聚合');
    expect(html).toContain('仅展示单组样本');
    expect(html).not.toContain('B − A');
  });
});
