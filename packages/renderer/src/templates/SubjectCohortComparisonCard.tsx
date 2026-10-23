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

const CohortMetricCaption: React.FC<{
  metric: CohortMetric;
  theme: ThemeTokens;
  width: number;
  titleSize?: string;
}> = ({ metric, theme, width, titleSize = '13px' }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '5px', minWidth: 0 }}>
    <RendererIcon name={metricIconName(metric.key)} theme={theme} size={13} />
    <div style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
      <div
        style={{
          color: theme.text,
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
          color: theme.textMuted,
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
  const columns =
    width <= 400
      ? 'minmax(76px, 1.25fr) repeat(2, minmax(0, 1fr)) minmax(48px, 0.78fr)'
      : 'minmax(150px, 1.65fr) repeat(2, minmax(0, 1fr)) minmax(84px, 0.8fr)';
  const valueFontFamily = theme.design.bodyFontFamily;

  return (
    <div
      data-layout="gallery-comparison-matrix"
      style={{ borderTop: `1px solid ${theme.border}`, minWidth: 0 }}
    >
      <div
        data-layout="gallery-matrix-header"
        style={{
          display: 'grid',
          gridTemplateColumns: columns,
          gap: width <= 400 ? '4px' : '8px',
          padding: '5px 2px 7px',
          color: theme.accent,
          borderBottom: `1px solid ${theme.border}`,
          fontSize: width <= 400 ? '11px' : '13px',
          fontWeight: 800,
          letterSpacing: '0.04em',
        }}
      >
        <div>指标</div>
        <div>分组 A</div>
        <div>分组 B</div>
        <div style={{ textAlign: 'right' }}>B − A</div>
      </div>
      {metrics.map((metric) => (
        <div
          key={metric.key}
          data-layout="cohort-metric-card"
          data-layout-variant="gallery-open-row"
          style={{
            display: 'grid',
            gridTemplateColumns: columns,
            alignItems: 'center',
            gap: width <= 400 ? '4px' : '8px',
            padding: width <= 400 ? '7px 2px' : '10px 2px',
            borderBottom: `1px solid ${theme.border}`,
            minWidth: 0,
          }}
        >
          <CohortMetricCaption metric={metric} theme={theme} width={width} titleSize="12px" />
          {cohorts.map((cohort, index) => (
            <CohortMetricValueBlock
              key={`${metric.key}-${index}`}
              metric={metric}
              cohort={cohort}
              index={index}
              theme={theme}
              valueFontSize={width <= 400 ? '15px' : '17px'}
              valueFontFamily={valueFontFamily}
              coverageFontSize={width <= 400 ? '10px' : '12px'}
              showGroupLabel={false}
            />
          ))}
          <CohortMetricDeltaBlock
            metric={metric}
            theme={theme}
            fontFamily={valueFontFamily}
            valueFontSize={width <= 400 ? '13px' : '15px'}
            showLabel={false}
            align="right"
          />
        </div>
      ))}
    </div>
  );
};

const GraphicZineMetricBoard: React.FC<CohortMetricBoardProps> = ({
  metrics,
  cohorts,
  theme,
  width,
}) => {
  const valueFontFamily = theme.design.bodyFontFamily;

  return (
    <div
      data-layout="zine-sticker-board"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        gap: width <= 400 ? '8px' : '12px',
        padding: '2px 2px 4px',
        minWidth: 0,
      }}
    >
      {metrics.map((metric, metricIndex) => (
        <section
          key={metric.key}
          data-layout="cohort-metric-card"
          data-layout-variant="zine-sticker"
          data-render-mask={metricIndex % 2 === 0 ? 'panel' : 'panel-alt'}
          style={{
            backgroundColor:
              metricIndex % 2 === 0 ? theme.tones.butter.surface : theme.tones.coral.surface,
            clipPath:
              metricIndex % 2 === 0 ? theme.design.masks.panel : theme.design.masks.panelAlt,
            filter: `drop-shadow(1px 2px 0 ${theme.text})`,
            padding: width <= 400 ? '10px 11px 15px' : '13px 16px 18px',
            minWidth: 0,
          }}
        >
          <div style={{ display: 'grid', gap: '5px', minWidth: 0 }}>
            <CohortMetricCaption metric={metric} theme={theme} width={width} titleSize="12px" />
            <div
              data-layout="zine-delta-sticker"
              style={{
                justifySelf: 'end',
                backgroundColor: theme.text,
                clipPath: theme.design.masks.tag,
                color: theme.background,
                padding: '4px 7px',
                fontSize: width <= 400 ? '11px' : '12px',
                fontWeight: 900,
                lineHeight: 1.2,
                textAlign: 'center',
                whiteSpace: 'nowrap',
              }}
            >
              {`B−A ${deltaLabel(metric)}`}
            </div>
          </div>
          <div
            data-layout="zine-metric-pair"
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
              gap: width <= 400 ? '7px' : '12px',
              marginTop: '8px',
              minWidth: 0,
            }}
          >
            {cohorts.map((cohort, index) => (
              <CohortMetricValueBlock
                key={`${metric.key}-${index}`}
                metric={metric}
                cohort={cohort}
                index={index}
                theme={theme}
                valueFontSize={width <= 400 ? '16px' : '19px'}
                valueFontFamily={valueFontFamily}
                coverageFontSize={width <= 400 ? '10px' : '12px'}
              />
            ))}
          </div>
          <div
            style={{
              marginTop: '5px',
              color: metricDeltaColor(metric, theme),
              fontSize: '11px',
              fontWeight: 700,
              lineHeight: 1.2,
            }}
          >
            {stateLabel(metric.state)}
          </div>
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
  const cohortGridColumns =
    showComparison && viewportWidth >= 320 ? 'repeat(2, minmax(0, 1fr))' : '1fr';
  const isZine = theme.designPack === 'graphic-zine';
  const isGallery = theme.designPack === 'clean-gallery';
  const isWarm = theme.designPack === 'warm-editorial';
  const supportingTypeSize = viewportWidth <= 400 ? '14px' : viewportWidth <= 520 ? '14px' : '15px';
  const microTypeSize = viewportWidth <= 400 ? '12px' : viewportWidth <= 520 ? '12px' : '13px';
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
        titleStyle={isGallery ? 'cohort-gallery-open' : 'cohort-report'}
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
                borderTop: isGallery ? `1px solid ${theme.border}` : undefined,
                borderRadius: isWarm ? '18px 5px 18px 5px' : undefined,
                boxShadow: isZine ? `2px 3px 0 ${theme.text}` : undefined,
                clipPath: cohortMask,
                padding: viewportWidth <= 400 ? '9px 10px 14px' : theme.spacing.md,
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
