/* Hallmark · component: C07 cohort comparison poster · genre: editorial · theme: Bangumi Graphic Zine
 * pre-emit critique: P4 H5 E4 S5 R4 V5 · contrast: pass (40–41)
 */
import React from 'react';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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

const COHORT_WATERFRONT_DATA_URI = `data:image/png;base64,${readFileSync(
  path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../assets/illustrations/run95-c07-waterfront-watercolor-2026-10-24.png',
  ),
).toString('base64')}`;

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
  if (key === 'score') return 'rating';
  if (key === 'heat') return 'collection';
  if (key === 'episodesReported') return 'subject';
  if (key === 'ratingStandardDeviation') return 'stats';
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
  if (key === 'ratingStandardDeviation') return '评分分布标准差 v1';
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
type CohortMember = SubjectCohortComparisonViewModel['cohorts'][number];

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
  return index === 0 ? theme.tones.blue.foreground : theme.tones.mint.foreground;
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

const CohortMetricCaption: React.FC<{
  metric: CohortMetric;
  theme: ThemeTokens;
  width: number;
  titleSize?: string;
  titleColor?: string;
  sourceColor?: string;
}> = ({ metric, theme, width, titleSize = '13px', titleColor, sourceColor }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '5px', minWidth: 0 }}>
    <RendererIcon name={metricIconName(metric.key)} theme={theme} size={13} />
    <div style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
      <div
        style={{
          color: titleColor ?? theme.text,
          fontFamily: theme.design.bodyFontFamily,
          fontSize: titleSize,
          fontWeight: 700,
          lineHeight: 1.25,
        }}
      >
        {width <= 520 ? compactMetricLabel(metric.key) : metric.label}
      </div>
      <div
        style={{
          color: sourceColor ?? theme.textMuted,
          opacity: sourceColor ? 0.88 : undefined,
          fontSize: width <= 400 ? '11px' : '12px',
          lineHeight: 1.3,
        }}
      >
        {width <= 520 ? compactMetricSourceLabel(metric.key) : metricSourceLabel(metric.key)}
      </div>
      {metric.formula && width > 520 ? (
        <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.3 }}>
          计算口径：评分分布标准差（v{metric.formula.version}）
        </div>
      ) : null}
    </div>
  </div>
);

const CohortMetricValueBlock: React.FC<{
  metric: CohortMetric;
  cohort: CohortMember;
  index: number;
  theme: ThemeTokens;
  valueFontSize: string;
  valueFontFamily: string;
  coverageFontSize?: string;
  showGroupLabel?: boolean;
  align?: 'left' | 'right';
}> = ({
  metric,
  cohort,
  index,
  theme,
  valueFontSize,
  valueFontFamily,
  coverageFontSize = '11px',
  showGroupLabel = true,
  align = 'left',
}) => (
  <div
    data-layout="cohort-metric-value"
    data-cohort-index={index}
    style={{ minWidth: 0, color: cohortMetricColor(theme, index), textAlign: align }}
  >
    {showGroupLabel ? (
      <div
        style={{
          color: theme.textMuted,
          fontSize: '11px',
          fontWeight: 700,
          letterSpacing: '0.04em',
          lineHeight: 1.2,
        }}
      >
        {`分组 ${index === 0 ? 'A' : 'B'}`}
      </div>
    ) : null}
    <div
      data-layout="cohort-metric-number"
      style={{
        color: cohortMetricColor(theme, index),
        fontFamily: valueFontFamily,
        fontSize: valueFontSize,
        fontWeight: theme.designPack === 'graphic-zine' ? 700 : theme.design.titleWeight,
        lineHeight: 1.15,
        overflowWrap: 'anywhere',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {averageLabel(metric, index)}
    </div>
    <CohortMetricBar metric={metric} index={index} theme={theme} />
    <div
      style={{
        color: theme.textMuted,
        fontSize: coverageFontSize,
        lineHeight: 1.2,
        overflowWrap: 'anywhere',
      }}
    >
      {metricCoverageCompactLabel(cohort, metric.key)}
    </div>
  </div>
);

const CohortMetricDeltaBlock: React.FC<{
  metric: CohortMetric;
  theme: ThemeTokens;
  fontFamily: string;
  valueFontSize: string;
  showLabel?: boolean;
  showState?: boolean;
  align?: 'left' | 'right';
}> = ({
  metric,
  theme,
  fontFamily,
  valueFontSize,
  showLabel = true,
  showState = true,
  align = 'left',
}) => (
  <div
    data-layout="cohort-metric-value"
    data-cohort-index="delta"
    style={{ minWidth: 0, color: metricDeltaColor(metric, theme), textAlign: align }}
  >
    {showLabel ? (
      <div style={{ color: theme.textMuted, fontSize: '11px', fontWeight: 700, lineHeight: 1.2 }}>
        B − A
      </div>
    ) : null}
    <div
      data-layout="cohort-metric-delta"
      style={{
        fontFamily,
        fontSize: valueFontSize,
        fontWeight: theme.design.titleWeight,
        lineHeight: 1.15,
        overflowWrap: 'anywhere',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {deltaLabel(metric)}
    </div>
    {showState ? (
      <div style={{ color: theme.textMuted, fontSize: '10px', lineHeight: 1.2 }}>
        {stateLabel(metric.state)}
      </div>
    ) : null}
  </div>
);

interface CohortMetricBoardProps {
  metrics: CohortMetric[];
  cohorts: CohortMember[];
  theme: ThemeTokens;
  width: number;
}

const WarmEditorialMetricBoard: React.FC<CohortMetricBoardProps> = ({
  metrics,
  cohorts,
  theme,
  width,
}) => {
  const leadIndex = Math.max(
    0,
    metrics.findIndex((metric) => metric.key === 'score'),
  );
  const lead = metrics[leadIndex];
  const secondary = metrics.filter((_, index) => index !== leadIndex);
  const valueFontFamily = theme.design.displayFontFamily;

  return (
    <div data-layout="warm-folio-board" style={{ display: 'grid', gap: '3px', minWidth: 0 }}>
      {lead ? (
        <section
          data-layout="cohort-metric-card"
          data-render-mask="panel"
          data-layout-variant="warm-folio-lead"
          style={{
            backgroundColor: theme.surfaceAlt,
            clipPath: theme.design.masks.panel,
            padding: width <= 400 ? '10px 12px 17px' : '12px 16px 18px',
            minWidth: 0,
          }}
        >
          <div
            data-layout="cohort-metric-comparison"
            style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: '8px' }}
          >
            <CohortMetricCaption metric={lead} theme={theme} width={width} titleSize="15px" />
            <CohortMetricDeltaBlock
              metric={lead}
              theme={theme}
              fontFamily={valueFontFamily}
              valueFontSize={width <= 400 ? '15px' : '18px'}
              align="right"
              showState={false}
            />
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) 1px minmax(0, 1fr)',
              alignItems: 'center',
              gap: width <= 400 ? '9px' : '14px',
              marginTop: '8px',
            }}
          >
            <CohortMetricValueBlock
              metric={lead}
              cohort={cohorts[0]!}
              index={0}
              theme={theme}
              valueFontSize={width <= 400 ? '22px' : '30px'}
              valueFontFamily={valueFontFamily}
              coverageFontSize="11px"
            />
            <div aria-hidden="true" style={{ height: '100%', backgroundColor: theme.border }} />
            <CohortMetricValueBlock
              metric={lead}
              cohort={cohorts[1]!}
              index={1}
              theme={theme}
              valueFontSize={width <= 400 ? '22px' : '30px'}
              valueFontFamily={valueFontFamily}
              coverageFontSize="11px"
            />
          </div>
        </section>
      ) : null}
      <div style={{ display: 'grid', minWidth: 0 }}>
        {secondary.map((metric) => (
          <section
            key={metric.key}
            data-layout="cohort-metric-card"
            data-layout-variant="warm-folio-row"
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) auto',
              columnGap: '8px',
              rowGap: '5px',
              borderBottom: `1px solid ${theme.border}`,
              padding: width <= 400 ? '7px 2px 8px' : '9px 3px 10px',
              minWidth: 0,
            }}
          >
            <CohortMetricCaption metric={metric} theme={theme} width={width} />
            <CohortMetricDeltaBlock
              metric={metric}
              theme={theme}
              fontFamily={valueFontFamily}
              valueFontSize="13px"
              align="right"
              showState={false}
            />
            <div
              data-layout="cohort-metric-comparison"
              data-layout-variant="warm-folio-values"
              style={{
                gridColumn: '1 / -1',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '10px',
              }}
            >
              {cohorts.map((cohort, index) => (
                <CohortMetricValueBlock
                  key={`${metric.key}-${index}`}
                  metric={metric}
                  cohort={cohort}
                  index={index}
                  theme={theme}
                  valueFontSize="15px"
                  valueFontFamily={valueFontFamily}
                  coverageFontSize="11px"
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};

const CleanGalleryMetricBoard: React.FC<CohortMetricBoardProps> = ({
  metrics,
  cohorts,
  theme,
  width,
}) => {
  const lead = metrics.find((metric) => metric.key === 'score') ?? metrics[0];
  const secondary = metrics.filter((metric) => metric !== lead);
  const columns =
    width <= 400
      ? 'minmax(90px, 1.35fr) repeat(2, minmax(0, 0.7fr)) minmax(48px, 0.62fr)'
      : 'minmax(160px, 1.55fr) repeat(2, minmax(0, 0.82fr)) minmax(74px, 0.72fr)';
  const valueFontFamily = theme.design.displayFontFamily;
  const deltaColor = lead?.state === 'complete' ? theme.accent : theme.textMuted;

  return (
    <div
      data-layout="gallery-score-composition"
      style={{ display: 'grid', gap: width <= 400 ? '5px' : '9px', minWidth: 0 }}
    >
      {lead ? (
        <section
          data-layout="cohort-metric-card"
          data-layout-variant="gallery-score-lead"
          style={{
            borderBottom: `1px solid ${theme.border}`,
            padding: width <= 400 ? '4px 0 7px' : '8px 2px 10px',
            minWidth: 0,
          }}
        >
          <div
            style={{ display: 'flex', alignItems: 'baseline', gap: width <= 400 ? '6px' : '10px' }}
          >
            <CohortMetricCaption
              metric={lead}
              theme={theme}
              width={width}
              titleSize={width <= 400 ? '13px' : '15px'}
            />
          </div>
          <div
            data-layout="gallery-score-pair"
            style={{
              position: 'relative',
              minHeight: width <= 400 ? '76px' : '94px',
              marginTop: width <= 400 ? '7px' : '11px',
            }}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 320 94"
              preserveAspectRatio="none"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
            >
              <path
                d="M0 23C34 4 67 3 98 18c27 14 42 27 62 28v34c-25-2-41 8-69 1C56 73 28 87 0 65Z"
                fill={theme.tones.blue.surface}
                opacity="0.74"
              />
              <path
                d="M160 46c21-1 36-14 62-28 32-16 65-14 98 5v42c-28 22-56 8-91 16-28 7-44-3-69-1Z"
                fill={theme.tones.mint.surface}
                opacity="0.74"
              />
            </svg>
            <div
              style={{
                position: 'relative',
                zIndex: 1,
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: width <= 400 ? '14px' : '28px',
                padding: width <= 400 ? '7px 8px 0' : '10px 12px 0',
              }}
            >
              {cohorts.map((cohort, index) => (
                <div
                  key={`${cohort.label}-${lead.key}`}
                  data-layout="cohort-featured-value"
                  data-cohort-index={index}
                  style={{ minWidth: 0, textAlign: index === 0 ? 'left' : 'right' }}
                >
                  <div
                    style={{
                      color: cohortMetricColor(theme, index),
                      fontSize: width <= 400 ? '10px' : '11px',
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      lineHeight: 1.25,
                    }}
                  >
                    {index === 0 ? '分组 A' : '分组 B'}
                  </div>
                  <div
                    data-layout="cohort-metric-number"
                    style={{
                      color: cohortMetricColor(theme, index),
                      fontFamily: valueFontFamily,
                      fontSize: width <= 400 ? '31px' : '40px',
                      fontWeight: theme.design.titleWeight,
                      lineHeight: 1.05,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {averageLabel(lead, index)}
                  </div>
                  <div
                    style={{
                      color: theme.textMuted,
                      fontSize: width <= 400 ? '9px' : '10px',
                      lineHeight: 1.2,
                    }}
                  >
                    {metricCoverageCompactLabel(cohort, lead.key)}
                  </div>
                </div>
              ))}
            </div>
            <div
              data-layout="gallery-score-bridge"
              style={{
                position: 'absolute',
                left: '50%',
                top: width <= 400 ? '34px' : '43px',
                transform: 'translateX(-50%)',
                zIndex: 2,
              }}
            >
              <div
                data-layout="cohort-metric-delta"
                style={{
                  display: 'grid',
                  justifyItems: 'center',
                  gap: '1px',
                  color: deltaColor,
                  fontFamily: valueFontFamily,
                  fontSize: width <= 400 ? '13px' : '15px',
                  fontWeight: theme.design.titleWeight,
                  lineHeight: 1.1,
                  fontVariantNumeric: 'tabular-nums',
                  whiteSpace: 'nowrap',
                }}
              >
                <span
                  style={{
                    color: theme.textMuted,
                    fontFamily: theme.design.bodyFontFamily,
                    fontSize: width <= 400 ? '8px' : '9px',
                    letterSpacing: '0.04em',
                    lineHeight: 1.1,
                  }}
                >
                  B − A
                </span>
                {deltaLabel(lead)}
              </div>
            </div>
          </div>
        </section>
      ) : null}
      <div data-layout="gallery-comparison-matrix" style={{ minWidth: 0 }}>
        <div
          data-layout="gallery-matrix-header"
          style={{
            display: 'grid',
            gridTemplateColumns: columns,
            gap: width <= 400 ? '4px' : '8px',
            padding: '7px 2px 6px',
            color: theme.accent,
            borderBottom: `1px solid ${theme.border}`,
            fontSize: width <= 400 ? '10px' : '12px',
            fontWeight: 800,
            letterSpacing: '0.04em',
          }}
        >
          <div>指标</div>
          <div>A</div>
          <div>B</div>
          <div style={{ textAlign: 'right' }}>B − A</div>
        </div>
        {secondary.map((metric) => (
          <div
            key={metric.key}
            data-layout="cohort-metric-card"
            data-layout-variant="gallery-open-row"
            style={{
              display: 'grid',
              gridTemplateColumns: columns,
              alignItems: 'center',
              gap: width <= 400 ? '4px' : '8px',
              padding: width <= 400 ? '8px 2px' : '10px 2px',
              borderBottom: `1px solid ${theme.border}`,
              minWidth: 0,
            }}
          >
            <CohortMetricCaption
              metric={metric}
              theme={theme}
              width={width}
              titleSize={width <= 400 ? '11px' : '13px'}
            />
            {cohorts.map((cohort, index) => (
              <div
                key={metric.key + '-' + index}
                data-layout="cohort-metric-value"
                data-cohort-index={index}
                style={{ minWidth: 0, color: cohortMetricColor(theme, index) }}
              >
                <div
                  data-layout="cohort-metric-number"
                  style={{
                    color: cohortMetricColor(theme, index),
                    fontFamily: valueFontFamily,
                    fontSize: width <= 400 ? '14px' : '17px',
                    fontWeight: theme.design.titleWeight,
                    lineHeight: 1.2,
                    overflowWrap: 'anywhere',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {averageLabel(metric, index)}
                </div>
                <div style={{ color: theme.textMuted, fontSize: '9px', lineHeight: 1.2 }}>
                  {metricCoverageCompactLabel(cohort, metric.key)}
                </div>
              </div>
            ))}
            <div
              data-layout="cohort-metric-value"
              data-cohort-index="delta"
              style={{ minWidth: 0, textAlign: 'right' }}
            >
              <div
                data-layout="cohort-metric-delta"
                style={{
                  color: metric.state === 'complete' ? theme.accent : theme.textMuted,
                  fontFamily: valueFontFamily,
                  fontSize: width <= 400 ? '11px' : '14px',
                  fontWeight: theme.design.titleWeight,
                  lineHeight: 1.2,
                  fontVariantNumeric: 'tabular-nums',
                  whiteSpace: 'nowrap',
                }}
              >
                {deltaLabel(metric)}
              </div>
              {metric.state !== 'complete' ? (
                <div style={{ color: theme.warning, fontSize: '9px', lineHeight: 1.2 }}>
                  {stateLabel(metric.state)}
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const CohortZineMasthead: React.FC<{
  cohorts: CohortMember[];
  theme: ThemeTokens;
  width: number;
}> = ({ cohorts, theme, width }) => (
  <div
    data-layout="cohort-overview"
    data-layout-variant="cohort-zine-headline-pair"
    style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      gap: width <= 400 ? '16px' : '32px',
      borderBottom: '1px solid ' + theme.border,
      paddingBottom: width <= 400 ? '8px' : '12px',
      minWidth: 0,
    }}
  >
    {cohorts.slice(0, 2).map((cohort, index) => {
      const subject = cohort.subjects[0];
      const queryCoverage = cohort.coverage.query.coverage;
      const title = subject?.displayName || subject?.name || '暂无可展示作品';
      const querySummary = cohort.querySummary.startsWith(cohort.label)
        ? cohort.querySummary.slice(cohort.label.length).replace(/^[\s·•:：]+/u, '') ||
          cohort.querySummary
        : cohort.querySummary;
      const alternateName =
        subject?.displayName && subject.name && subject.displayName !== subject.name
          ? subject.name
          : undefined;

      return (
        <section
          key={cohort.label + '-' + index}
          data-layout="cohort-column"
          style={{
            minWidth: 0,
            borderBottom:
              '2px solid ' +
              (index === 0 ? theme.tones.blue.foreground : theme.tones.coral.foreground),
            paddingBottom: '4px',
            textAlign: index === 0 ? 'left' : 'right',
          }}
        >
          <div
            data-layout="cohort-kicker"
            style={{
              display: 'flex',
              justifyContent: index === 0 ? 'flex-start' : 'flex-end',
              alignItems: 'baseline',
              gap: '8px',
              color: index === 0 ? theme.tones.blue.foreground : theme.tones.coral.foreground,
              fontSize: width <= 400 ? '9px' : '11px',
              fontWeight: 700,
              letterSpacing: '0.06em',
              lineHeight: 1.2,
            }}
          >
            <span>{index === 0 ? 'A' : 'B'}</span>
            <span>{cohort.label}</span>
          </div>
          <div
            data-layout="cohort-label"
            style={{
              color: theme.text,
              fontFamily: theme.design.displayFontFamily,
              fontSize: width <= 400 ? '15px' : '21px',
              fontWeight: 600,
              lineHeight: 1.18,
              marginTop: '4px',
              overflowWrap: 'anywhere',
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: 2,
              overflow: 'hidden',
            }}
          >
            {title}
          </div>
          <div
            data-layout="cohort-query-summary"
            title={cohort.querySummary}
            style={{
              color: theme.textMuted,
              fontSize: width <= 400 ? '9px' : '10px',
              lineHeight: 1.25,
              marginTop: '4px',
              overflowWrap: 'anywhere',
            }}
          >
            {querySummary}
          </div>
          {alternateName ? (
            <div
              style={{
                color: theme.textMuted,
                fontSize: width <= 400 ? '10px' : '12px',
                lineHeight: 1.25,
                marginTop: '4px',
                overflowWrap: 'anywhere',
                display: '-webkit-box',
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: 1,
                overflow: 'hidden',
              }}
            >
              {alternateName}
            </div>
          ) : null}
          <div
            data-layout="cohort-meta-compact"
            style={{
              color: theme.textMuted,
              fontSize: width <= 400 ? '9px' : '10px',
              lineHeight: 1.25,
              marginTop: '4px',
              overflowWrap: 'anywhere',
            }}
          >
            {subject ? '作品 #' + subject.id + ' · ' : ''}
            {queryCoverage.returned}/{queryCoverage.scanned} 条 ·{' '}
            {totalKindLabel(queryCoverage.totalKind)}
            {' · '}详情 {cohort.coverage.detailHydrationsSucceeded}/
            {cohort.coverage.detailHydrationsAttempted}
          </div>
        </section>
      );
    })}
  </div>
);

const CohortWaterfrontScene: React.FC<{
  theme: ThemeTokens;
  width: number;
}> = ({ theme, width }) => (
  <div
    data-layout="zine-waterfront-illustration"
    style={{
      position: 'relative',
      width: '100%',
      height: width <= 400 ? '132px' : width <= 640 ? '180px' : '260px',
      marginTop: width <= 400 ? '-8px' : '-12px',
      overflow: 'hidden',
      backgroundColor: 'transparent',
    }}
  >
    <img
      src={COHORT_WATERFRONT_DATA_URI}
      alt=""
      aria-hidden="true"
      draggable={false}
      style={{
        position: 'absolute',
        left: 0,
        bottom: 0,
        width: '100%',
        height: '140%',
        objectFit: 'fill',
        objectPosition: 'center bottom',
        opacity: theme.name === 'bangumi-dark' ? 0.78 : 1,
        filter: theme.name === 'bangumi-dark' ? 'brightness(0.72) saturate(0.76)' : undefined,
      }}
    />
  </div>
);

const GraphicZineMetricBoard: React.FC<CohortMetricBoardProps> = ({
  metrics,
  cohorts,
  theme,
  width,
}) => {
  const lead = metrics.find((metric) => metric.key === 'score') ?? metrics[0];
  const secondary = metrics.filter((metric) => metric !== lead);
  const valueFontFamily = theme.design.displayFontFamily;
  const columns =
    width <= 400
      ? 'minmax(96px, 0.92fr) repeat(3, minmax(0, 1fr))'
      : 'minmax(220px, 1.25fr) repeat(3, minmax(90px, 1fr))';

  return (
    <div
      data-layout="zine-poster-board"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: width <= 400 ? '4px' : '8px',
        minWidth: 0,
      }}
    >
      <CohortWaterfrontScene theme={theme} width={width} />
      {lead ? (
        <section
          data-layout="cohort-metric-card"
          data-layout-variant="zine-score-lead"
          style={{
            position: 'relative',
            marginTop: width <= 400 ? '-16px' : '-28px',
            paddingBottom: width <= 400 ? '8px' : '12px',
            borderBottom: '1px solid ' + theme.border,
            minWidth: 0,
          }}
        >
          <CohortMetricCaption
            metric={lead}
            theme={theme}
            width={width}
            titleSize={width <= 400 ? '11px' : '14px'}
          />
          <div
            data-layout="zine-score-pair"
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
              alignItems: 'end',
              gap: width <= 400 ? '8px' : '24px',
              marginTop: width <= 400 ? '4px' : '8px',
              minWidth: 0,
            }}
          >
            {cohorts[0] ? (
              <div
                data-layout="cohort-metric-value"
                data-cohort-index="0"
                style={{ minWidth: 0, color: cohortMetricColor(theme, 0) }}
              >
                <div style={{ fontSize: width <= 400 ? '9px' : '11px', lineHeight: 1.2 }}>
                  分组 A
                </div>
                <div
                  data-layout="cohort-metric-number"
                  style={{
                    fontFamily: valueFontFamily,
                    fontSize:
                      averageLabel(lead, 0).length > 6 ? '18px' : width <= 400 ? '34px' : '56px',
                    fontWeight: 600,
                    lineHeight: 1,
                    letterSpacing: '-0.035em',
                    fontVariantNumeric: 'tabular-nums',
                    overflowWrap: 'anywhere',
                  }}
                >
                  {averageLabel(lead, 0)}
                </div>
                <div
                  style={{
                    color: theme.textMuted,
                    fontSize: width <= 400 ? '9px' : '11px',
                    lineHeight: 1.2,
                  }}
                >
                  {metricCoverageCompactLabel(cohorts[0], lead.key)}
                </div>
              </div>
            ) : null}
            <div
              data-layout="zine-score-bridge"
              style={{
                minWidth: width <= 400 ? '54px' : '82px',
                textAlign: 'center',
                paddingBottom: width <= 400 ? '4px' : '8px',
                color: theme.tones.coral.foreground,
              }}
            >
              <div
                style={{
                  color: theme.textMuted,
                  fontSize: width <= 400 ? '8px' : '10px',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                }}
              >
                B − A
              </div>
              <div
                data-layout="cohort-metric-delta"
                data-state={lead.state}
                style={{
                  fontFamily: valueFontFamily,
                  fontSize: width <= 400 ? '14px' : '20px',
                  fontWeight: 700,
                  lineHeight: 1.1,
                  fontVariantNumeric: 'tabular-nums',
                  overflowWrap: 'anywhere',
                }}
              >
                {deltaLabel(lead)}
              </div>
              <svg
                aria-hidden="true"
                viewBox="0 0 120 18"
                style={{ display: 'block', width: '100%', height: '12px' }}
              >
                <path
                  d="M3 13C32 0 76 20 116 5"
                  fill="none"
                  stroke={theme.tones.coral.foreground}
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
                <path
                  d="m109 5 7 0-4 6"
                  fill="none"
                  stroke={theme.tones.coral.foreground}
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            {cohorts[1] ? (
              <div
                data-layout="cohort-metric-value"
                data-cohort-index="1"
                style={{ minWidth: 0, color: cohortMetricColor(theme, 1), textAlign: 'right' }}
              >
                <div style={{ fontSize: width <= 400 ? '9px' : '11px', lineHeight: 1.2 }}>
                  分组 B
                </div>
                <div
                  data-layout="cohort-metric-number"
                  style={{
                    fontFamily: valueFontFamily,
                    fontSize:
                      averageLabel(lead, 1).length > 6 ? '18px' : width <= 400 ? '34px' : '56px',
                    fontWeight: 600,
                    lineHeight: 1,
                    letterSpacing: '-0.035em',
                    fontVariantNumeric: 'tabular-nums',
                    overflowWrap: 'anywhere',
                  }}
                >
                  {averageLabel(lead, 1)}
                </div>
                <div
                  style={{
                    color: theme.textMuted,
                    fontSize: width <= 400 ? '9px' : '11px',
                    lineHeight: 1.2,
                  }}
                >
                  {metricCoverageCompactLabel(cohorts[1], lead.key)}
                </div>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
      <div
        data-layout="zine-metric-header"
        style={{
          display: 'grid',
          gridTemplateColumns: columns,
          gap: width <= 400 ? '4px' : '8px',
          color: theme.textMuted,
          fontSize: width <= 400 ? '9px' : '11px',
          fontWeight: 700,
          letterSpacing: '0.04em',
          padding: width <= 400 ? '4px 4px' : '8px 4px 4px',
        }}
      >
        <div>指标</div>
        <div style={{ textAlign: 'center' }}>A</div>
        <div style={{ textAlign: 'center' }}>B</div>
        <div style={{ textAlign: 'right' }}>B − A</div>
      </div>
      {secondary.map((metric, metricIndex) => (
        <section
          key={metric.key}
          data-layout="cohort-metric-card"
          data-layout-variant="zine-waterline-row"
          style={{
            display: 'grid',
            gridTemplateColumns: columns,
            alignItems: 'center',
            gap: width <= 400 ? '4px' : '8px',
            borderTop: '1px solid ' + theme.border,
            padding: width <= 400 ? '8px 4px' : '12px 4px',
            minWidth: 0,
            position: 'relative',
          }}
        >
          <div
            data-layout="cohort-metric-label"
            style={{
              minWidth: 0,
              display: 'flex',
              alignItems: 'center',
              gap: width <= 400 ? '4px' : '8px',
            }}
          >
            <RendererIcon
              name={metricIconName(metric.key)}
              theme={theme}
              size={width <= 400 ? 14 : 18}
            />
            <div style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
              <div
                style={{
                  color: theme.text,
                  fontSize: width <= 400 ? '10px' : '14px',
                  fontWeight: 600,
                  lineHeight: 1.2,
                }}
              >
                {compactMetricLabel(metric.key)}
              </div>
              <div
                style={{
                  color: theme.textMuted,
                  fontSize: width <= 400 ? '8px' : '10px',
                  lineHeight: 1.2,
                }}
              >
                {compactMetricSourceLabel(metric.key)}
              </div>
            </div>
          </div>
          {cohorts.slice(0, 2).map((cohort, index) => (
            <div
              key={metric.key + '-' + index}
              data-layout="cohort-metric-value"
              data-cohort-index={index}
              style={{
                color: cohortMetricColor(theme, index),
                textAlign: 'center',
                minWidth: 0,
              }}
            >
              <div
                data-layout="cohort-metric-number"
                style={{
                  fontFamily: valueFontFamily,
                  fontSize: width <= 400 ? '12px' : '17px',
                  fontWeight: 600,
                  lineHeight: 1.15,
                  fontVariantNumeric: 'tabular-nums',
                  overflowWrap: 'anywhere',
                }}
              >
                {averageLabel(metric, index)}
              </div>
              <div
                style={{
                  color: theme.textMuted,
                  fontSize: width <= 400 ? '8px' : '10px',
                  lineHeight: 1.2,
                }}
              >
                {metricCoverageCompactLabel(cohort, metric.key)}
              </div>
            </div>
          ))}
          <div
            data-layout="cohort-metric-value"
            data-cohort-index="delta"
            style={{
              color: theme.tones.coral.foreground,
              textAlign: 'right',
              minWidth: 0,
            }}
          >
            <div
              data-layout="cohort-metric-delta"
              data-state={metric.state}
              style={{
                fontFamily: valueFontFamily,
                fontSize: width <= 400 ? '11px' : '15px',
                fontWeight: 700,
                lineHeight: 1.15,
                fontVariantNumeric: 'tabular-nums',
                overflowWrap: 'anywhere',
              }}
            >
              {deltaLabel(metric)}
            </div>
            {metric.state !== 'complete' ? (
              <div
                style={{
                  color: theme.warning,
                  fontSize: width <= 400 ? '8px' : '10px',
                  lineHeight: 1.2,
                }}
              >
                {stateLabel(metric.state)}
              </div>
            ) : null}
          </div>
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: 0,
              bottom: 0,
              width: metricIndex % 2 === 0 ? '22px' : '12px',
              height: '2px',
              backgroundColor:
                metricIndex % 2 === 0 ? theme.tones.coral.foreground : theme.tones.blue.foreground,
              transform: metricIndex % 2 === 0 ? 'rotate(-1deg)' : 'rotate(1deg)',
              transformOrigin: 'left center',
            }}
          />
        </section>
      ))}
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
  const cohortOverviewLayout = showComparison ? 'paired' : 'single';
  const cohortGridColumns = cohortOverviewLayout === 'paired' ? 'repeat(2, minmax(0, 1fr))' : '1fr';
  const isZine = theme.designPack === 'graphic-zine';
  const isGallery = theme.designPack === 'clean-gallery';
  const isWarm = theme.designPack === 'warm-editorial';
  const sharedGalleryOverview = isGallery && twoColumnComparison;
  const sharedZineOverview = isZine && showComparison;
  const isZineComparison = isZine && showComparison;
  const supportingTypeSize =
    viewportWidth <= 400
      ? isGallery || isZine
        ? '12px'
        : '14px'
      : viewportWidth <= 520
        ? isZine
          ? '13px'
          : '14px'
        : '15px';
  const microTypeSize = viewportWidth <= 520 ? (isGallery || isZine ? '11px' : '14px') : '13px';
  const footnoteTypeSize =
    (isGallery && viewportWidth <= 400) || (isZine && viewportWidth <= 400)
      ? '11px'
      : microTypeSize;
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
    <CardFrame
      theme={theme}
      width={width}
      showMarker={!isZineComparison}
      rootStyle={
        isZineComparison
          ? { padding: viewportWidth <= 400 ? '16px 12px 12px' : '24px 36px 20px' }
          : undefined
      }
      frameStyle={
        isZineComparison
          ? {
              backgroundColor: 'transparent',
              border: 'none',
              borderRadius: 0,
              clipPath: 'none',
              padding: 0,
              boxShadow: 'none',
              gap: viewportWidth <= 400 ? '12px' : '20px',
            }
          : undefined
      }
    >
      <TitleBlock
        title={showComparison ? '条目群体比较' : '条目群体聚合'}
        subtitle={
          showComparison && viewportWidth <= 360
            ? `Bangumi · ${stateLabel(viewModel.state)} · B−A · 仅作对照`
            : `Bangumi 公共数据 · ${stateLabel(viewModel.state)} · ${showComparison ? '差值按 B − A 展示' : '仅展示单组样本'}，不生成推荐结论`
        }
        theme={theme}
        icon="comparison"
        iconSize={18}
        titleFontSize={viewportWidth <= 400 ? '20px' : '23px'}
        subtitleFontSize={viewportWidth <= 320 ? '11px' : viewportWidth <= 400 ? '12px' : '14px'}
        eyebrowFontSize="12px"
        titleStyle={
          isGallery ? 'cohort-gallery-open' : isZine ? 'cohort-zine-poster' : 'cohort-report'
        }
        showIconEyebrow={!isZine}
      />

      {isZineComparison ? (
        <CohortZineMasthead cohorts={dimensions} theme={theme} width={viewportWidth} />
      ) : (
        <div
          data-layout="cohort-overview"
          data-layout-variant={`cohort-${cohortOverviewLayout}`}
          style={{
            display: 'grid',
            gridTemplateColumns: cohortGridColumns,
            gap:
              sharedGalleryOverview || sharedZineOverview
                ? 0
                : viewportWidth <= 400
                  ? theme.spacing.sm
                  : theme.spacing.md,
            borderBottom:
              sharedGalleryOverview || sharedZineOverview ? `1px solid ${theme.border}` : undefined,
            paddingBottom: sharedZineOverview ? '8px' : undefined,
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
                data-render-mask={
                  sharedGalleryOverview || sharedZineOverview
                    ? undefined
                    : index === 0
                      ? 'panel'
                      : 'panel-alt'
                }
                style={{
                  backgroundColor:
                    sharedGalleryOverview || sharedZineOverview ? 'transparent' : cohortSurface,
                  border: 'none',
                  borderTop:
                    isGallery && !sharedGalleryOverview ? `1px solid ${theme.border}` : undefined,
                  borderLeft:
                    sharedGalleryOverview && index === 1
                      ? `1px solid ${theme.border}`
                      : sharedZineOverview
                        ? `3px solid ${index === 0 ? theme.tones.butter.foreground : theme.tones.coral.foreground}`
                        : undefined,
                  borderRadius: isWarm ? '18px 5px 18px 5px' : undefined,
                  boxShadow: isZine && !sharedZineOverview ? `2px 3px 0 ${theme.text}` : undefined,
                  clipPath: sharedGalleryOverview || sharedZineOverview ? undefined : cohortMask,
                  padding: sharedZineOverview
                    ? '6px 10px 7px'
                    : sharedGalleryOverview
                      ? '6px 10px 9px'
                      : viewportWidth <= 400
                        ? '12px 14px 16px'
                        : theme.spacing.md,
                  margin: isZine && !sharedZineOverview ? '0 2px 3px 0' : undefined,
                  minWidth: 0,
                }}
              >
                <div
                  data-layout="cohort-kicker"
                  style={{
                    color: sharedZineOverview
                      ? index === 0
                        ? theme.tones.blue.foreground
                        : theme.tones.coral.foreground
                      : isZine
                        ? theme.background
                        : theme.accent,
                    backgroundColor: isZine && !sharedZineOverview ? theme.accent : undefined,
                    clipPath: isZine && !sharedZineOverview ? theme.design.masks.tag : undefined,
                    borderBottom: sharedZineOverview ? `1px solid ${theme.border}` : undefined,
                    borderRadius:
                      sharedGalleryOverview || sharedZineOverview
                        ? 0
                        : theme.designPack === 'warm-editorial'
                          ? '999px 5px 999px 5px'
                          : '2px',
                    display: 'inline-block',
                    padding: sharedGalleryOverview ? 0 : sharedZineOverview ? '0 0 2px' : '3px 7px',
                    fontSize: sharedZineOverview ? '9px' : microTypeSize,
                    fontWeight: sharedZineOverview ? 700 : 800,
                    letterSpacing:
                      sharedGalleryOverview || sharedZineOverview ? '0.04em' : '0.08em',
                  }}
                >
                  {showComparison ? `分组 ${index === 0 ? 'A' : 'B'}` : '样本分组'}
                </div>
                <div
                  data-layout="cohort-label"
                  style={{
                    color: theme.text,
                    fontFamily: theme.design.displayFontFamily,
                    fontSize:
                      viewportWidth <= 400 ? (isGallery || isZine ? '14px' : '16px') : '17px',
                    fontWeight: isZine ? 650 : 700,
                    marginTop:
                      sharedGalleryOverview || sharedZineOverview ? '4px' : theme.spacing.xs,
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
                    lineHeight: sharedGalleryOverview || sharedZineOverview ? 1.3 : 1.5,
                    marginTop:
                      sharedGalleryOverview || sharedZineOverview ? '3px' : theme.spacing.xs,
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
                      fontSize: sharedZineOverview && viewportWidth <= 400 ? '10px' : microTypeSize,
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
                    fontSize: sharedZineOverview && viewportWidth <= 400 ? '10px' : microTypeSize,
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
                              fontSize: sharedGalleryOverview ? '12px' : supportingTypeSize,
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
      )}

      <section data-layout="cohort-metric-section">
        {(isGallery || isZine) && showComparison ? null : (
          <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
            <RendererIcon name="stats" theme={theme} size={18} />
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
        )}
        <div
          data-layout="cohort-metric-board"
          style={{
            backgroundColor: 'transparent',
            padding: isGallery && showComparison ? '0' : '4px 0 0',
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
          {showComparison ? (
            isWarm ? (
              <WarmEditorialMetricBoard
                metrics={viewModel.metrics}
                cohorts={viewModel.cohorts}
                theme={theme}
                width={viewportWidth}
              />
            ) : isGallery ? (
              <CleanGalleryMetricBoard
                metrics={viewModel.metrics}
                cohorts={viewModel.cohorts}
                theme={theme}
                width={viewportWidth}
              />
            ) : (
              <GraphicZineMetricBoard
                metrics={viewModel.metrics}
                cohorts={viewModel.cohorts}
                theme={theme}
                width={viewportWidth}
              />
            )
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
              {viewModel.metrics.map((metric, metricIndex) => (
                <div
                  key={metric.key}
                  data-layout="cohort-metric-card"
                  data-render-mask={
                    isWarm || isZine ? (metricIndex % 2 === 0 ? 'panel' : 'panel-alt') : undefined
                  }
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      width !== undefined && width >= 760 ? '1.7fr 1fr 1fr' : '1fr',
                    gap: theme.spacing.xs,
                    backgroundColor: isWarm
                      ? theme.surfaceAlt
                      : isZine
                        ? metricIndex % 2 === 0
                          ? theme.tones.butter.surface
                          : theme.tones.coral.surface
                        : theme.surface,
                    border: isGallery ? `1px solid ${theme.border}` : undefined,
                    borderRadius: isWarm ? '14px 4px 14px 4px' : undefined,
                    clipPath:
                      isWarm || isZine
                        ? metricIndex % 2 === 0
                          ? theme.design.masks.panel
                          : theme.design.masks.panelAlt
                        : undefined,
                    filter: isZine ? `drop-shadow(1px 2px 0 ${theme.text})` : undefined,
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
                    <CohortMetricCaption
                      metric={metric}
                      theme={theme}
                      width={viewportWidth}
                      titleSize={viewportWidth <= 400 ? '13px' : '14px'}
                    />
                    {metric.formula && viewportWidth > 520 ? (
                      <div
                        style={{
                          color: theme.textMuted,
                          fontSize: microTypeSize,
                          lineHeight: 1.35,
                          marginTop: '3px',
                        }}
                      >
                        计算口径：评分分布标准差（v{metric.formula.version}）
                      </div>
                    ) : null}
                  </div>
                  {viewModel.cohorts.map((cohort, index) => {
                    const wide = width !== undefined && width >= 760;
                    return (
                      <div
                        key={`${metric.key}-${index}`}
                        data-layout="cohort-metric-value"
                        style={{ color: cohortMetricColor(theme, index), minWidth: 0 }}
                      >
                        {wide ? null : '样本 · '}
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
                        {wide ? (
                          <CohortMetricBar metric={metric} index={index} theme={theme} />
                        ) : null}
                        <div>{metricCoverageLabel(cohort, metric.key)}</div>
                      </div>
                    );
                  })}
                  <div
                    style={{
                      color: metric.state === 'complete' ? theme.textMuted : theme.warning,
                    }}
                  >
                    状态 · {stateLabel(metric.state)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section
        data-layout="cohort-method-notes"
        data-layout-variant={
          isGallery && viewportWidth <= 400
            ? 'gallery-open-method-notes'
            : isZineComparison
              ? 'zine-colophon-notes'
              : undefined
        }
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap:
            isGallery && viewportWidth <= 400
              ? '4px'
              : isZineComparison
                ? '8px'
                : viewportWidth <= 400
                  ? '6px'
                  : '8px',
          borderTop: `1px solid ${theme.border}`,
          paddingTop: '8px',
          color: theme.textMuted,
          fontSize: isZineComparison ? (viewportWidth <= 400 ? '10px' : '12px') : footnoteTypeSize,
          lineHeight: isGallery && viewportWidth <= 400 ? 1.35 : 1.45,
        }}
      >
        <div data-layout="cohort-scope-summary">
          {isGallery && viewportWidth <= 400 ? '范围 · ' : '数据范围：'}
          每组最多 {viewModel.coverage.maxSubjectsPerCohort} 条 · 本次返回{' '}
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
          <div data-layout="cohort-warning-summary" style={{ color: theme.warning }}>
            <strong style={{ marginRight: '4px', color: theme.text }}>
              {isGallery && viewportWidth <= 400 ? '来源 ·' : '数据说明'}
            </strong>
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
          <div data-layout="cohort-limitations-summary">
            <strong style={{ color: theme.accent }}>
              {isGallery && viewportWidth <= 400 ? '阅读边界' : '限制'}
            </strong>
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

        {isGallery && viewportWidth <= 400 ? (
          <div data-layout="cohort-citation-summary">
            {cohortCalculationMethodLabel(viewModel.formulaVersion)} · Bangumi 公共条目 ·{' '}
            {officialOperations} · {retrievalDateLabel(viewModel.retrievedAt)}
          </div>
        ) : (
          <>
            <div>{cohortCalculationMethodLabel(viewModel.formulaVersion)}</div>
            <div>
              来源：Bangumi 公共条目 · {officialOperations} ·{' '}
              {retrievalDateLabel(viewModel.retrievedAt)}
            </div>
          </>
        )}
      </section>
      {isZineComparison ? (
        <footer
          data-layout="zine-colophon"
          style={{
            color: theme.textMuted,
            fontSize: viewportWidth <= 400 ? '10px' : '12px',
            lineHeight: 1.3,
          }}
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 960 18"
            preserveAspectRatio="none"
            style={{ display: 'block', width: '100%', height: '8px', marginBottom: '5px' }}
          >
            <path
              d="M0 9c90-5 142 5 230 0s143-5 230 0 143 5 230 0 143-5 270 0"
              fill="none"
              stroke={theme.tones.blue.foreground}
              strokeWidth="2"
              strokeDasharray="5 8"
              opacity="0.68"
            />
          </svg>
          Bangumi 条目样本统计 <span aria-hidden="true">·</span> Powered by Bangumi Agent Kit
        </footer>
      ) : (
        <Footer label="Bangumi 条目样本统计" theme={theme} />
      )}
    </CardFrame>
  );
};
