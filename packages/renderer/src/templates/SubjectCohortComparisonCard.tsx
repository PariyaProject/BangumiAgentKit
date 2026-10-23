import React from 'react';
import { CardFrame } from '../components/CardFrame.js';
import { Footer } from '../components/Footer.js';
import { MetaRow } from '../components/MetaRow.js';
import { RendererIcon, type RendererIconName } from '../components/RendererIcon.js';
import { TitleBlock } from '../components/TitleBlock.js';
import type { ThemeTokens } from '../themes/index.js';
import type { SubjectCohortComparisonViewModel } from '../view-models/index.js';

const OFFICIAL_OPERATION_LABELS: Record<string, string> = {
  searchSubjects: '检索条目',
  getSubjectById: '读取条目详情',
};

export interface SubjectCohortComparisonCardProps {
  viewModel: SubjectCohortComparisonViewModel;
  theme: ThemeTokens;
  width?: number;
}

function stateLabel(state: string): string {
  return (
    (
      {
        complete: '完整',
        partial: '部分覆盖',
        ok: '成功',
        conflict: '存在冲突',
        unavailable: '不可用',
        not_computable: '不可计算',
        not_found: '未找到',
        unsupported: '不支持',
        upstream_error: '上游错误',
        stale: '数据过期',
        auth_required: '需要授权',
        permission_denied: '无权限',
      } as Record<string, string>
    )[state] || state
  );
}

function numberLabel(value: number | undefined, digits: number): string {
  if (value === undefined || !Number.isFinite(value)) return '未知';
  return value.toLocaleString('zh-CN', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function metricDigits(key: string): number {
  return key === 'score' || key === 'ratingStandardDeviation' ? 2 : 1;
}

function metricSourceLabel(key: string): string {
  return (
    (
      {
        score: '来源：Bangumi 评分',
        heat: '来源：收藏人数合计',
        episodesReported: '来源：报告话数',
        ratingStandardDeviation: '来源：评分分布',
      } as Record<string, string>
    )[key] ?? '来源：返回条目数据'
  );
}

function metricIconName(
  key: SubjectCohortComparisonViewModel['metrics'][number]['key'],
): RendererIconName {
  if (key === 'heat') return 'collection';
  if (key === 'episodesReported') return 'episode';
  if (key === 'ratingStandardDeviation') return 'overview';
  return 'stats';
}

function compactMetricLabel(
  key: SubjectCohortComparisonViewModel['metrics'][number]['key'],
): string {
  if (key === 'heat') return '平均收藏数';
  if (key === 'episodesReported') return '平均话数';
  if (key === 'ratingStandardDeviation') return '评分标准差';
  return '平均评分';
}

function compactMetricSourceLabel(
  key: SubjectCohortComparisonViewModel['metrics'][number]['key'],
): string {
  if (key === 'heat') return '收藏总数';
  if (key === 'episodesReported') return '报告话数';
  if (key === 'ratingStandardDeviation') return '评分分布 · 标准差 v1';
  return 'Bangumi 评分';
}

function totalKindLabel(kind: string): string {
  return (
    (
      {
        estimated: '总数为估算',
        exact: '总数完整',
        unknown: '总数未知',
      } as Record<string, string>
    )[kind] ?? '总数未知'
  );
}

function retrievalDateLabel(value?: string): string {
  if (!value) return '检索时间未知';
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return '检索时间未知';
  return `检索日期 ${new Intl.DateTimeFormat('zh-CN', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(timestamp)} UTC`;
}

function cohortCalculationMethodLabel(formulaVersion: string): string {
  if (formulaVersion === 'subject-cohort-comparison-v1') {
    return '计算方法：群体均值与差值 v1';
  }
  return '计算方法：群体均值与差值（版本待确认）';
}

function warningText(code: string, message: string): string {
  if (
    code === 'EXPERIMENTAL_SOURCE' &&
    message === 'Official v0 subject search is marked experimental upstream.'
  ) {
    return '官方作品搜索接口仍处于实验阶段。';
  }
  return message || '部分数据无法确认；缺失值不会按 0 计算。';
}

function deltaLabel(metric: SubjectCohortComparisonViewModel['metrics'][number]): string {
  if (metric.state !== 'complete' || metric.delta === undefined) return '不可计算';
  const value = numberLabel(metric.delta, metricDigits(metric.key));
  return metric.delta > 0 ? `+${value}` : value;
}

function averageLabel(
  metric: SubjectCohortComparisonViewModel['metrics'][number],
  index: number,
): string {
  const accepted = metric.averages[index];
  if (accepted !== undefined) return numberLabel(accepted, metricDigits(metric.key));
  const partial = metric.partialAverages?.[index];
  return partial === undefined
    ? '未知'
    : `${numberLabel(partial, metricDigits(metric.key))}（部分样本）`;
}

function metricCoverageLabel(
  cohort: SubjectCohortComparisonViewModel['cohorts'][number],
  key: SubjectCohortComparisonViewModel['metrics'][number]['key'],
): string {
  const coverage = cohort.coverage.metrics[key];
  if (
    coverage.state === 'complete' &&
    coverage.partial === 0 &&
    coverage.missing === 0 &&
    coverage.conflicts === 0 &&
    coverage.notComputable === 0
  ) {
    return `${coverage.valid} 条完整样本`;
  }
  const counts = [
    coverage.valid > 0 ? `${coverage.valid} 条有效` : null,
    coverage.partial > 0 ? `${coverage.partial} 条部分` : null,
    coverage.missing > 0 ? `${coverage.missing} 条缺失` : null,
    coverage.conflicts > 0 ? `${coverage.conflicts} 条冲突` : null,
    coverage.notComputable > 0 ? `${coverage.notComputable} 条不可计算` : null,
  ].filter((value): value is string => value !== null);
  return [...counts, stateLabel(coverage.state)].join(' · ');
}

function metricCoverageCompactLabel(
  cohort: SubjectCohortComparisonViewModel['cohorts'][number],
  key: SubjectCohortComparisonViewModel['metrics'][number]['key'],
): string {
  const coverage = cohort.coverage.metrics[key];
  const total =
    coverage.valid +
    coverage.partial +
    coverage.missing +
    coverage.conflicts +
    coverage.notComputable;
  const status =
    coverage.state === 'partial'
      ? coverage.valid === 0 && coverage.partial === 0 && coverage.missing > 0
        ? '缺失'
        : '部分'
      : coverage.state === 'conflict'
        ? '冲突'
        : stateLabel(coverage.state);
  return `${coverage.valid}/${total} ${status}`;
}

type CohortMetric = SubjectCohortComparisonViewModel['metrics'][number];

function observedAverage(metric: CohortMetric, index: number): number | undefined {
  return metric.averages[index] ?? metric.partialAverages?.[index];
}

function metricBarWidth(metric: CohortMetric, index: number): number | undefined {
  const value = observedAverage(metric, index);
  if (value === undefined || !Number.isFinite(value) || value < 0) return undefined;
  const values = [0, 1]
    .map((cohortIndex) => observedAverage(metric, cohortIndex))
    .filter((candidate): candidate is number => candidate !== undefined && candidate >= 0);
  if (metric.averages.length < 2 || values.length < 2) return undefined;
  const maximum = Math.max(0, ...values);
  return maximum === 0 ? 0 : Math.round((value / maximum) * 100);
}

function cohortMetricColor(theme: ThemeTokens, index: number): string {
  if (theme.designPack === 'warm-editorial') return index === 0 ? theme.accent : theme.score;
  if (theme.designPack === 'clean-gallery') return index === 0 ? theme.accent : theme.success;
  return index === 0 ? theme.accent : theme.warning;
}

function metricDeltaColor(metric: CohortMetric, theme: ThemeTokens): string {
  if (metric.state !== 'complete' || metric.delta === undefined) return theme.warning;
  if (metric.delta > 0) return theme.success;
  if (metric.delta < 0) return theme.warning;
  return theme.textMuted;
}

const CohortMetricBar: React.FC<{
  metric: CohortMetric;
  index: number;
  theme: ThemeTokens;
}> = ({ metric, index, theme }) => {
  const width = metricBarWidth(metric, index);
  const hasObservedValue = observedAverage(metric, index) !== undefined;
  const isPartial =
    metric.averages[index] === undefined && metric.partialAverages?.[index] !== undefined;
  const state =
    width !== undefined
      ? isPartial
        ? 'partial'
        : 'complete'
      : hasObservedValue
        ? 'unscaled'
        : 'missing';
  return (
    <div
      data-layout="cohort-metric-bar"
      data-state={state}
      aria-hidden="true"
      style={{
        height: theme.designPack === 'graphic-zine' ? '7px' : '5px',
        width: '100%',
        overflow: 'hidden',
        backgroundColor: theme.border,
        border: width === undefined ? '1px dashed ' + theme.textMuted : 'none',
        borderRadius: theme.designPack === 'warm-editorial' ? '999px' : '1px',
        marginTop: '4px',
      }}
    >
      {width === undefined ? null : (
        <span
          style={{
            display: 'block',
            height: '100%',
            width: String(width) + '%',
            backgroundColor: cohortMetricColor(theme, index),
            borderRadius: theme.designPack === 'warm-editorial' ? '999px' : '1px',
            opacity: isPartial ? 0.55 : 1,
          }}
        />
      )}
    </div>
  );
};

export const SubjectCohortComparisonCard: React.FC<SubjectCohortComparisonCardProps> = ({
  viewModel,
  theme,
  width,
}) => {
  const dimensions = viewModel.cohorts;
  const viewportWidth = width ?? 960;
  const showComparison = dimensions.length === 2;
  const compactComparison = showComparison && viewportWidth <= 640;
  const twoColumnComparison = compactComparison && viewportWidth <= 400;
  const cohortGridColumns =
    showComparison && viewportWidth >= 320 ? 'repeat(2, minmax(0, 1fr))' : '1fr';
  const isZine = theme.designPack === 'graphic-zine';
  const isGallery = theme.designPack === 'clean-gallery';
  const isWarm = theme.designPack === 'warm-editorial';
  const supportingTypeSize = viewportWidth <= 400 ? '15px' : viewportWidth <= 520 ? '14px' : '15px';
  const microTypeSize = viewportWidth <= 400 ? '14px' : '12px';
  const visibleSubjectsPerCohort =
    viewportWidth <= 400 ? 1 : viewportWidth < 520 ? 3 : viewportWidth < 760 ? 6 : 8;
  const warningLimit = 3;
  const limitationLimit = viewportWidth <= 360 ? 2 : viewportWidth < 520 ? 3 : 5;
  const compactTextClamp =
    viewportWidth <= 360
      ? {
          display: '-webkit-box',
          WebkitBoxOrient: 'vertical' as const,
          WebkitLineClamp: 2,
          overflow: 'hidden',
        }
      : viewportWidth <= 520
        ? {
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical' as const,
            WebkitLineClamp: 3,
            overflow: 'hidden',
          }
        : {};
  const querySummaryClamp =
    viewportWidth <= 360 && twoColumnComparison
      ? {
          display: '-webkit-box',
          WebkitBoxOrient: 'vertical' as const,
          WebkitLineClamp: 2,
          overflow: 'hidden',
        }
      : viewportWidth <= 360
        ? {
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical' as const,
            WebkitLineClamp: 2,
            overflow: 'hidden',
          }
        : viewportWidth <= 520
          ? {
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical' as const,
              WebkitLineClamp: 3,
              overflow: 'hidden',
            }
          : {};
  const cohortLabelClamp =
    viewportWidth <= 360
      ? {
          display: '-webkit-box',
          WebkitBoxOrient: 'vertical' as const,
          WebkitLineClamp: 2,
          overflow: 'hidden',
        }
      : viewportWidth <= 520
        ? {
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical' as const,
            WebkitLineClamp: 3,
            overflow: 'hidden',
          }
        : {};
  const officialOperations =
    viewModel.source.official.operations
      .map((operation) => OFFICIAL_OPERATION_LABELS[operation] ?? '查询条目数据')
      .join('、') || 'Bangumi 公共条目';
  const warningCounts = new Map<string, number>();
  for (const warning of viewModel.warnings) {
    const message = warningText(warning.code, warning.message);
    warningCounts.set(message, (warningCounts.get(message) ?? 0) + 1);
  }
  const warningMessages = [...warningCounts.entries()].map(([message, count]) =>
    count > 1 ? `${message}（共 ${count} 条）` : message,
  );
  const hasWarnings = warningMessages.length > 0;

  return (
    <CardFrame theme={theme} width={width}>
      <TitleBlock
        title={showComparison ? '条目群体比较' : '条目群体聚合'}
        subtitle={`Bangumi 公共数据 · ${stateLabel(viewModel.state)} · ${showComparison ? '差值按 B − A 展示' : '仅展示单组样本'}，不生成推荐结论`}
        theme={theme}
        icon="comparison"
        iconSize={22}
        titleFontSize="27px"
        subtitleFontSize="16px"
        eyebrowFontSize="13px"
        titleStyle="cohort-report"
      />

      <div
        data-layout="cohort-overview"
        style={{
          display: 'grid',
          gridTemplateColumns: cohortGridColumns,
          gap: viewportWidth <= 400 ? theme.spacing.sm : theme.spacing.md,
        }}
      >
        {dimensions.map((cohort, index) => {
          const queryCoverage = cohort.coverage.query.coverage;
          const omittedSubjects = viewModel.coverage.omittedSubjectsPerCohort[index] ?? 0;
          const visibleSubjects = cohort.subjects.slice(0, visibleSubjectsPerCohort);
          const omittedForPresentation = cohort.subjects.length - visibleSubjects.length;
          const returnedSubjects = cohort.subjects.length + omittedSubjects;
          const cohortMask = index === 0 ? theme.design.masks.panel : theme.design.masks.panelAlt;
          const compactQuerySummary =
            viewportWidth <= 400 && cohort.querySummary.startsWith(cohort.label)
              ? cohort.querySummary.slice(cohort.label.length).replace(/^[\s·•:：]+/u, '') ||
                cohort.querySummary
              : cohort.querySummary;
          const cohortSurface = isZine
            ? index === 0
              ? theme.tones.butter.surface
              : theme.tones.coral.surface
            : theme.surfaceAlt;
          return (
            <section
              key={`${cohort.label}-${index}`}
              data-layout="cohort-column"
              data-render-mask={index === 0 ? 'panel' : 'panel-alt'}
              style={{
                backgroundColor: cohortSurface,
                border: 'none',
                borderLeft: isGallery ? `2px solid ${theme.accent}` : undefined,
                borderRadius: isWarm ? '18px 5px 18px 5px' : undefined,
                boxShadow: isZine ? `2px 3px 0 ${theme.text}` : undefined,
                clipPath: cohortMask,
                padding: viewportWidth <= 400 ? '9px 10px' : theme.spacing.md,
                margin: isZine ? '0 2px 3px 0' : undefined,
                minWidth: 0,
              }}
            >
              <div
                data-layout="cohort-kicker"
                style={{
                  color: isZine ? theme.background : theme.accent,
                  backgroundColor: isZine ? theme.accent : undefined,
                  clipPath: isZine ? theme.design.masks.tag : undefined,
                  borderRadius:
                    theme.designPack === 'warm-editorial' ? '999px 5px 999px 5px' : '2px',
                  display: 'inline-block',
                  padding: '3px 7px',
                  fontSize: microTypeSize,
                  fontWeight: 800,
                  letterSpacing: '0.08em',
                }}
              >
                {showComparison ? `分组 ${index === 0 ? 'A' : 'B'}` : '样本分组'}
              </div>
              <div
                data-layout="cohort-label"
                style={{
                  color: theme.text,
                  fontFamily: theme.design.displayFontFamily,
                  fontSize: viewportWidth <= 400 ? '13px' : '17px',
                  fontWeight: 700,
                  marginTop: theme.spacing.xs,
                  overflowWrap: 'anywhere',
                  ...cohortLabelClamp,
                }}
              >
                {cohort.label}
              </div>
              <div
                style={{
                  color: theme.textMuted,
                  fontSize: supportingTypeSize,
                  lineHeight: 1.5,
                  marginTop: theme.spacing.xs,
                  overflowWrap: 'anywhere',
                  ...querySummaryClamp,
                }}
              >
                {compactQuerySummary}
              </div>
              {viewportWidth <= 640 ? (
                <div
                  data-layout="cohort-meta-compact"
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    columnGap: viewportWidth <= 400 ? '5px' : theme.spacing.sm,
                    rowGap: viewportWidth <= 400 ? '2px' : theme.spacing.xs,
                    color: theme.textMuted,
                    fontSize: microTypeSize,
                    lineHeight: 1.35,
                  }}
                >
                  <span>{stateLabel(cohort.coverage.query.state)}</span>
                  <span>
                    {viewportWidth <= 400
                      ? `${queryCoverage.returned}/${queryCoverage.scanned} · ${queryCoverage.totalKind === 'estimated' ? '估算' : totalKindLabel(queryCoverage.totalKind)}`
                      : `返回 ${queryCoverage.returned} · 观察 ${queryCoverage.scanned} · ${totalKindLabel(queryCoverage.totalKind)}`}
                  </span>
                </div>
              ) : (
                <MetaRow
                  theme={theme}
                  items={[
                    `状态 ${stateLabel(cohort.coverage.query.state)}`,
                    `返回 ${queryCoverage.returned}`,
                    `观察 ${queryCoverage.scanned}`,
                    totalKindLabel(queryCoverage.totalKind),
                  ]}
                />
              )}
              <div
                style={{
                  color: theme.textMuted,
                  fontSize: microTypeSize,
                  lineHeight: 1.4,
                  marginTop: '2px',
                }}
              >
                {viewportWidth <= 400
                  ? `页 ${queryCoverage.pagesScanned}/${queryCoverage.pagesRequested} · 详情 ${cohort.coverage.detailHydrationsSucceeded}/${cohort.coverage.detailHydrationsAttempted}`
                  : queryCoverage.pagesScanned < queryCoverage.pagesRequested
                    ? `来源已读取 ${queryCoverage.pagesScanned}/${queryCoverage.pagesRequested} 页`
                    : '本次检索页数已读完'}
                {viewportWidth <= 400
                  ? null
                  : ` · 详情 ${cohort.coverage.detailHydrationsSucceeded}/${cohort.coverage.detailHydrationsAttempted}`}
                {!queryCoverage.upstreamExhausted ? ' · 来源未读完' : ''}
                {queryCoverage.budgetExceeded ? ' · 已达查询上限' : ''}
              </div>

              {cohort.subjects.length === 0 || viewportWidth > 400 ? (
                <div
                  style={{
                    color: theme.accent,
                    fontWeight: 700,
                    fontSize: microTypeSize,
                    marginTop: theme.spacing.sm,
                  }}
                >
                  {cohort.subjects.length === 0 ? '样本显示情况' : '返回样本'}
                </div>
              ) : null}
              {cohort.subjects.length === 0 ? (
                <div
                  style={{ color: theme.warning, fontSize: supportingTypeSize, lineHeight: 1.5 }}
                >
                  {queryCoverage.returned > 0
                    ? showComparison && viewportWidth <= 400
                      ? `返回 ${queryCoverage.returned} 条 · 详情不可用；不代表无匹配项。`
                      : `检索返回 ${queryCoverage.returned} 条结果，但作品详情暂不可用；本图不显示作品行。详情缺失不代表没有匹配项。`
                    : viewportWidth <= 400
                      ? '暂无可展示条目；不代表无匹配项。'
                      : '本次检索没有可展示的条目；空结果不证明目录中不存在匹配项。'}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.xs }}>
                  {visibleSubjects.map((subject) => (
                    <div
                      key={subject.id}
                      data-layout="cohort-subject-item"
                      style={{
                        borderTop: `1px solid ${theme.border}`,
                        paddingTop: theme.spacing.xs,
                        minWidth: 0,
                      }}
                    >
                      <div
                        style={{
                          display: viewportWidth <= 400 ? 'grid' : 'flex',
                          gridTemplateColumns:
                            viewportWidth <= 400 ? '15px minmax(0, 1fr)' : undefined,
                          alignItems: 'flex-start',
                          gap: viewportWidth <= 400 ? '3px 5px' : theme.spacing.xs,
                          minWidth: 0,
                        }}
                      >
                        <RendererIcon name="subject" theme={theme} size={15} />
                        <span
                          style={{
                            color: theme.text,
                            fontSize: supportingTypeSize,
                            minWidth: 0,
                            overflowWrap: 'break-word',
                            ...(viewportWidth <= 520
                              ? {
                                  display: '-webkit-box',
                                  WebkitBoxOrient: 'vertical',
                                  WebkitLineClamp: viewportWidth <= 400 ? 3 : 4,
                                  overflow: 'hidden',
                                }
                              : {}),
                          }}
                        >
                          {subject.displayName}
                        </span>
                        <span
                          style={{
                            color: theme.textMuted,
                            flex: viewportWidth <= 400 ? undefined : '0 0 auto',
                            gridColumn: viewportWidth <= 400 ? '2' : undefined,
                            justifySelf: viewportWidth <= 400 ? 'end' : undefined,
                            lineHeight: 1,
                            fontSize: microTypeSize,
                          }}
                        >
                          #{subject.id}
                        </span>
                      </div>
                      {compactComparison ? null : viewportWidth < 520 ? (
                        <div
                          data-layout="cohort-subject-metrics"
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                            gap: '3px 5px',
                            marginTop: '3px',
                            color: theme.textMuted,
                            fontSize: microTypeSize,
                            lineHeight: 1.35,
                          }}
                        >
                          {[
                            ['评分', numberLabel(subject.score, 2)],
                            [
                              '评分人数',
                              subject.ratingCountState === 'invalid'
                                ? '无效'
                                : numberLabel(subject.ratingCount, 0),
                            ],
                            ['收藏', numberLabel(subject.collectionTotal, 0)],
                            ['报告话数', numberLabel(subject.episodesReported, 0)],
                            [
                              '离散度',
                              `${numberLabel(subject.ratingStandardDeviation, 2)} · 样本 ${numberLabel(subject.ratingHistogramPopulation, 0)}`,
                            ],
                          ].map(([label, value]) => (
                            <div
                              key={`${subject.id}-${label}`}
                              style={{
                                backgroundColor: theme.surfaceAlt,
                                borderRadius: theme.radius.sm,
                                padding: '3px 4px',
                                minWidth: 0,
                                overflowWrap: 'break-word',
                              }}
                            >
                              {label} <strong style={{ color: theme.text }}>{value}</strong>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div
                          style={{
                            color: theme.textMuted,
                            fontSize: microTypeSize,
                            lineHeight: 1.4,
                          }}
                        >
                          评分 {numberLabel(subject.score, 2)} · 评分人数{' '}
                          {subject.ratingCountState === 'invalid'
                            ? '无效'
                            : numberLabel(subject.ratingCount, 0)}{' '}
                          · 收藏人数 {numberLabel(subject.collectionTotal, 0)}
                          {' · '}报告话数 {numberLabel(subject.episodesReported, 0)} ·
                          评分分布离散度 {numberLabel(subject.ratingStandardDeviation, 2)}（样本数{' '}
                          {numberLabel(subject.ratingHistogramPopulation, 0)}）
                        </div>
                      )}
                      {(subject.ratingStandardDeviationConflicts || []).map((conflict, index) => (
                        <div
                          key={`${subject.id}-rating-conflict-${index}`}
                          style={{
                            color: theme.warning,
                            fontSize: microTypeSize,
                            lineHeight: 1.35,
                          }}
                        >
                          评分标准差冲突：
                          {conflict.kind === 'score_vs_histogram_mean'
                            ? `官方评分 ${numberLabel(conflict.officialScore, 2)} vs 直方图均值 ${numberLabel(conflict.histogramMean, 2)}`
                            : `搜索人数 ${numberLabel(conflict.discoveryRatingCount, 0)} 与详情总数 ${numberLabel(conflict.detailRatingTotal, 0)} 不一致`}
                        </div>
                      ))}
                      {subject.ratingHistogramTotalValidation &&
                      subject.ratingHistogramTotalValidation.state !== 'match' ? (
                        <div
                          style={{
                            color: theme.warning,
                            fontSize: microTypeSize,
                            lineHeight: 1.35,
                          }}
                        >
                          详情评分总数
                          {subject.ratingHistogramTotalValidation.state === 'invalid'
                            ? '无效'
                            : ` ${numberLabel(subject.ratingHistogramTotalValidation.detailRatingTotal, 0)}`}{' '}
                          与直方图样本{' '}
                          {numberLabel(
                            subject.ratingHistogramTotalValidation.histogramPopulation,
                            0,
                          )}{' '}
                          不匹配。
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
              {omittedSubjects + omittedForPresentation > 0 ? (
                <div
                  data-layout="cohort-subject-summary"
                  style={{
                    color: theme.textMuted,
                    fontSize: microTypeSize,
                    lineHeight: 1.45,
                    marginTop: theme.spacing.xs,
                  }}
                >
                  图片展示 {visibleSubjects.length}/{returnedSubjects} 条已返回样本；另有{' '}
                  {omittedSubjects + omittedForPresentation}{' '}
                  条未展开，聚合指标仍按已取得的有效样本计算。
                </div>
              ) : null}
            </section>
          );
        })}
      </div>

      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
          <RendererIcon name="stats" theme={theme} size={20} badge />
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                color: theme.accent,
                fontFamily: theme.design.displayFontFamily,
                fontWeight: theme.design.titleWeight,
                fontSize: viewportWidth <= 400 ? '16px' : '18px',
                lineHeight: 1.2,
              }}
            >
              聚合指标
            </div>
            <div style={{ color: theme.textMuted, fontSize: microTypeSize, lineHeight: 1.4 }}>
              均值按已取得的有效样本计算；缺失值不按 0 补齐，双方完整时才显示差值。
            </div>
          </div>
        </div>
        <div
          data-layout="cohort-metric-board"
          style={{
            backgroundColor: 'transparent',
            padding: '4px 0 0',
            minWidth: 0,
          }}
        >
          {!showComparison && width !== undefined && width >= 760 ? (
            <div
              data-layout="cohort-metric-header"
              style={{
                display: 'grid',
                gridTemplateColumns: twoColumnComparison
                  ? isGallery
                    ? 'minmax(78px, 0.78fr) repeat(2, minmax(0, 1fr))'
                    : 'repeat(2, minmax(0, 1fr))'
                  : width !== undefined && width >= 760
                    ? showComparison
                      ? '1.7fr 1fr 1fr 1fr'
                      : '1.7fr 1fr 1fr'
                    : showComparison
                      ? 'repeat(3, minmax(0, 1fr))'
                      : 'repeat(2, minmax(0, 1fr))',
                gap: theme.spacing.xs,
                color: theme.accent,
                fontSize: microTypeSize,
                fontWeight: 800,
                letterSpacing: '0.06em',
                padding: '4px 6px 8px',
                borderBottom: '1px solid ' + theme.border,
              }}
            >
              {twoColumnComparison && isGallery ? (
                <>
                  <div>指标</div>
                  <div>分组 A</div>
                  <div>分组 B</div>
                </>
              ) : twoColumnComparison ? (
                <>
                  <div>分组 A</div>
                  <div>分组 B</div>
                </>
              ) : width !== undefined && width >= 760 ? (
                <>
                  <div>指标</div>
                  {showComparison ? (
                    <>
                      <div>分组 A</div>
                      <div>分组 B</div>
                      <div>B − A</div>
                    </>
                  ) : (
                    <>
                      <div>样本均值</div>
                      <div>数据状态</div>
                    </>
                  )}
                </>
              ) : showComparison ? (
                <>
                  <div>分组 A</div>
                  <div>分组 B</div>
                  <div>B − A</div>
                </>
              ) : (
                <>
                  <div>样本</div>
                  <div>状态</div>
                </>
              )}
            </div>
          ) : null}
          <div
            style={{
              display: showComparison && viewportWidth >= 520 ? 'grid' : 'flex',
              gridTemplateColumns:
                showComparison && viewportWidth >= 520 ? 'repeat(2, minmax(0, 1fr))' : undefined,
              gap:
                showComparison && viewportWidth >= 520
                  ? viewportWidth <= 640
                    ? '8px'
                    : theme.spacing.sm
                  : undefined,
              flexDirection: showComparison && viewportWidth >= 520 ? undefined : 'column',
              minWidth: 0,
            }}
          >
            {viewModel.metrics.map((metric, metricIndex) => (
              <div
                key={metric.key}
                data-layout="cohort-metric-card"
                data-render-mask={
                  isWarm || isZine ? (metricIndex % 2 === 0 ? 'panel' : 'panel-alt') : undefined
                }
                style={{
                  display: 'grid',
                  gridTemplateColumns: showComparison
                    ? 'minmax(0, 1fr)'
                    : width !== undefined && width >= 760
                      ? '1.7fr 1fr 1fr'
                      : '1fr',
                  gap: theme.spacing.xs,
                  backgroundColor: isWarm
                    ? theme.surfaceAlt
                    : isZine
                      ? metricIndex % 2 === 0
                        ? theme.tones.butter.surface
                        : theme.tones.coral.surface
                      : theme.surface,
                  border: isGallery ? `1px solid ${theme.border}` : undefined,
                  borderLeft: isGallery ? `2px solid ${theme.accent}` : undefined,
                  borderRadius: isWarm ? '14px 4px 14px 4px' : undefined,
                  clipPath:
                    isWarm || isZine
                      ? metricIndex % 2 === 0
                        ? theme.design.masks.panel
                        : theme.design.masks.panelAlt
                      : undefined,
                  filter: isZine ? `drop-shadow(1px 2px 0 ${theme.text})` : undefined,
                  margin: isGallery ? '0' : undefined,
                  padding:
                    viewportWidth <= 400
                      ? isWarm || isZine
                        ? '8px 9px 16px'
                        : '8px 8px'
                      : isWarm || isZine
                        ? '11px 14px 18px'
                        : '11px 12px',
                  minWidth: 0,
                }}
              >
                <div data-layout="cohort-metric-label" style={{ minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: viewportWidth <= 400 ? 'baseline' : 'flex-start',
                      gap: theme.spacing.xs,
                    }}
                  >
                    <RendererIcon
                      name={metricIconName(metric.key)}
                      theme={theme}
                      size={15}
                      badge={isZine}
                    />
                    <div
                      style={{
                        display: viewportWidth <= 400 ? 'flex' : 'block',
                        alignItems: 'baseline',
                        flexWrap: 'wrap',
                        gap: viewportWidth <= 400 ? '4px' : undefined,
                        minWidth: 0,
                      }}
                    >
                      <div
                        style={{
                          color: theme.text,
                          fontFamily: theme.design.bodyFontFamily,
                          fontWeight: 700,
                          fontSize: viewportWidth <= 400 ? '15px' : '14px',
                          lineHeight: 1.3,
                        }}
                      >
                        {isGallery && twoColumnComparison
                          ? compactMetricLabel(metric.key)
                          : metric.label}
                      </div>
                      <div
                        style={{
                          color: theme.textMuted,
                          fontSize: microTypeSize,
                          lineHeight: 1.35,
                        }}
                      >
                        {showComparison && viewportWidth <= 520
                          ? compactMetricSourceLabel(metric.key)
                          : metricSourceLabel(metric.key)}
                      </div>
                      {metric.formula && !(showComparison && viewportWidth <= 520) ? (
                        <div
                          style={{
                            color: theme.textMuted,
                            fontSize: microTypeSize,
                            lineHeight: 1.35,
                          }}
                        >
                          计算口径：评分分布标准差（v{metric.formula.version}）
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
                {showComparison ? (
                  <div
                    data-layout="cohort-metric-comparison"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                      gap: viewportWidth <= 400 ? '6px' : theme.spacing.sm,
                      minWidth: 0,
                    }}
                  >
                    {viewModel.cohorts.map((cohort, index) => (
                      <div
                        key={`${metric.key}-${index}`}
                        data-layout="cohort-metric-value"
                        style={{
                          minWidth: 0,
                          color: cohortMetricColor(theme, index),
                          borderRight: index === 0 ? `1px solid ${theme.border}` : undefined,
                          paddingRight: index === 0 ? '4px' : undefined,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'baseline',
                            justifyContent: 'space-between',
                            gap: '4px',
                          }}
                        >
                          <div
                            style={{
                              color: theme.textMuted,
                              fontSize: microTypeSize,
                              fontWeight: 700,
                              letterSpacing: '0.04em',
                            }}
                          >
                            {`分组 ${index === 0 ? 'A' : 'B'}`}
                          </div>
                          <div
                            style={{
                              color: cohortMetricColor(theme, index),
                              fontFamily: theme.design.displayFontFamily,
                              fontSize: viewportWidth <= 400 ? '17px' : '19px',
                              fontWeight: theme.design.titleWeight,
                              lineHeight: 1.2,
                              overflowWrap: 'anywhere',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {averageLabel(metric, index)}
                          </div>
                        </div>
                        <CohortMetricBar metric={metric} index={index} theme={theme} />
                        <div
                          style={{
                            fontSize: microTypeSize,
                            lineHeight: 1.35,
                          }}
                        >
                          {metricCoverageCompactLabel(cohort, metric.key)}
                        </div>
                      </div>
                    ))}
                    {showComparison ? (
                      <div
                        data-layout="cohort-metric-value"
                        style={{
                          minWidth: 0,
                          color: metricDeltaColor(metric, theme),
                          gridColumn: '1 / -1',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'baseline',
                          gap: '4px',
                          borderTop: `1px solid ${theme.border}`,
                          paddingTop: '4px',
                          backgroundColor: isZine ? theme.tones.butter.surface : undefined,
                          clipPath: isZine ? theme.design.masks.tag : undefined,
                          padding: isZine ? '4px 6px' : undefined,
                          marginTop: isZine ? '2px' : undefined,
                        }}
                      >
                        <div
                          style={{
                            color: theme.accent,
                            fontSize: microTypeSize,
                            fontWeight: 800,
                            letterSpacing: '0.04em',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {`B − A · ${stateLabel(metric.state)}`}
                        </div>
                        <div
                          style={{
                            fontSize: viewportWidth <= 400 ? '14px' : '16px',
                            fontFamily: theme.design.displayFontFamily,
                            fontWeight: theme.design.titleWeight,
                            lineHeight: 1.2,
                            overflowWrap: 'anywhere',
                            textAlign: 'right',
                            whiteSpace: 'nowrap',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {deltaLabel(metric)}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <>
                    {viewModel.cohorts.map((cohort, index) => {
                      const wide = width !== undefined && width >= 760;
                      return (
                        <div
                          key={`${metric.key}-${index}`}
                          data-layout="cohort-metric-value"
                          style={{ color: cohortMetricColor(theme, index), minWidth: 0 }}
                        >
                          {wide
                            ? null
                            : showComparison
                              ? `分组 ${index === 0 ? 'A' : 'B'} · `
                              : '样本 · '}
                          <strong
                            style={{
                              color: cohortMetricColor(theme, index),
                              fontFamily: theme.design.bodyFontFamily,
                              fontSize: wide ? '17px' : undefined,
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {averageLabel(metric, index)}
                          </strong>
                          {wide && showComparison ? (
                            <CohortMetricBar metric={metric} index={index} theme={theme} />
                          ) : null}
                          <div>{metricCoverageLabel(cohort, metric.key)}</div>
                        </div>
                      );
                    })}
                    {showComparison ? (
                      <div
                        style={{
                          color: metricDeltaColor(metric, theme),
                        }}
                      >
                        B − A · {deltaLabel(metric)}
                        <div style={{ color: theme.textMuted }}>{stateLabel(metric.state)}</div>
                      </div>
                    ) : (
                      <div
                        style={{
                          color: metric.state === 'complete' ? theme.textMuted : theme.warning,
                        }}
                      >
                        状态 · {stateLabel(metric.state)}
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section
        data-layout="cohort-method-notes"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: viewportWidth <= 400 ? '6px' : '8px',
          borderTop: `1px solid ${theme.border}`,
          paddingTop: '8px',
          color: theme.textMuted,
          fontSize: microTypeSize,
          lineHeight: 1.45,
        }}
      >
        <div>
          数据范围：每组最多 {viewModel.coverage.maxSubjectsPerCohort} 条 · 本次返回{' '}
          {viewModel.coverage.totalSubjectsReturned} · 详情读取{' '}
          {viewModel.coverage.detailHydrationsSucceeded}/
          {viewModel.coverage.detailHydrationsAttempted} 成功
          {viewModel.coverage.truncated ? ' · 至少一侧存在有界/部分覆盖' : ''}
          {viewModel.coverage.evidence.omitted > 0 ? ' · 部分来源依据未在卡片展开' : ''}
          {viewModel.coverage.overlap.count > 0
            ? ` · 两侧重复 ${viewModel.coverage.overlap.count} 项（仍分别计入均值）：${viewModel.coverage.overlap.subjectIds
                .slice(0, 12)
                .map((id) => `#${id}`)
                .join(', ')}${viewModel.coverage.overlap.count > 12 ? ' …' : ''}`
            : ''}
        </div>

        {hasWarnings ? (
          <div style={{ color: theme.warning }}>
            <strong>数据说明</strong>
            {warningMessages.slice(0, warningLimit).map((message, index) => (
              <div key={`warning-${index}`} style={compactTextClamp}>
                {message}
              </div>
            ))}
            {warningMessages.length > warningLimit
              ? `卡片另有 ${warningMessages.length - warningLimit} 条告警未展开。`
              : null}
            {viewModel.coverage.warnings.omitted > 0
              ? `语义结果另省略 ${viewModel.coverage.warnings.omitted} 条告警（上限 ${viewModel.coverage.warnings.max}）。`
              : null}
          </div>
        ) : null}

        {viewModel.limitations.length > 0 ? (
          <div>
            <strong style={{ color: theme.accent }}>限制</strong>
            {viewModel.limitations.slice(0, limitationLimit).map((limitation, index) => (
              <div key={index} style={compactTextClamp}>
                · {limitation}
              </div>
            ))}
            {viewModel.limitations.length > limitationLimit
              ? `另有 ${viewModel.limitations.length - limitationLimit} 条限制未展开。`
              : null}
          </div>
        ) : null}

        <div>{cohortCalculationMethodLabel(viewModel.formulaVersion)}</div>
        <div>
          来源：Bangumi 公共条目 · {officialOperations} ·{' '}
          {retrievalDateLabel(viewModel.retrievedAt)}
        </div>
      </section>
      <Footer label="Bangumi 条目样本统计" theme={theme} />
    </CardFrame>
  );
};
