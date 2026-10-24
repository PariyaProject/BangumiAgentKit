/* Hallmark · pre-emit critique: P4 H4 E4 S4 R5 V4
 * Component: cohort comparison · genre: editorial · theme: anime-magazine
 * Macrostructure: asymmetric cover pair / aligned score rail / open metric table.
 * Reference-led cover composition; static data states replace interactive states.
 * Typography uses resolved operator fonts and the shared font-size multiplier.
 */
import React from 'react';
import { RendererIcon } from '../components/RendererIcon.js';
import type { ThemeTokens } from '../themes/index.js';
import type { SubjectCohortComparisonViewModel } from '../view-models/index.js';

const TYPE = { title: 30, subject: 18, score: 44, value: 20, body: 16, small: 16 };
const SPACE = { xs: 4, sm: 8, md: 16, lg: 24 };
type Metric = SubjectCohortComparisonViewModel['metrics'][number];
type Cohort = SubjectCohortComparisonViewModel['cohorts'][number];

function numeric(value: number | undefined, digits: number, compact = false): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '未知';
  if (compact && Math.abs(value) >= 1e12) return value.toExponential(1).replace('e+', 'e');
  if (compact && Math.abs(value) >= 10000) {
    return new Intl.NumberFormat('zh-CN', { notation: 'compact', maximumFractionDigits: 1 }).format(
      value,
    );
  }
  return value.toFixed(digits);
}

function observed(metric: Metric | undefined, cohort: Cohort, index: number): number | undefined {
  return metric && cohort.coverage.metrics[metric.key]?.state === 'complete'
    ? metric.averages[index]
    : undefined;
}

function difference(metric: Metric | undefined, paired: boolean): string {
  if (!paired || !metric || metric.state !== 'complete' || !Number.isFinite(metric.delta)) {
    return '不可计算';
  }
  const value = metric.delta as number;
  return `${value > 0 ? '+' : value < 0 ? '−' : ''}${numeric(
    Math.abs(value),
    metric.key === 'score' || metric.key === 'ratingStandardDeviation' ? 2 : 1,
    metric.key === 'heat' || metric.key === 'episodesReported',
  )}`;
}

function dateLabel(value: string | undefined): string {
  return value && Number.isFinite(Date.parse(value))
    ? `${new Date(value).toISOString().slice(0, 10)} UTC`
    : '检索日期未知';
}

function coverageLabel(cohort: Cohort, key: Metric['key']): string {
  const coverage = cohort.coverage.metrics[key];
  const total =
    coverage.valid +
    coverage.partial +
    coverage.missing +
    coverage.conflicts +
    coverage.notComputable;
  if (coverage.state === 'complete') return `${coverage.valid}/${total} 完整`;
  if (coverage.state === 'conflict') return '数据冲突';
  return coverage.missing > 0 && coverage.valid === 0 ? '数据缺失' : '部分覆盖';
}

function humanLimitation(value: string): string {
  if (/每个 cohort 是|每个群体是|每个群体 是/u.test(value)) return '';
  if (value.includes('热度使用官方')) return '收藏人数为官方状态合计；不代表趋势或推荐。';
  return value.replace(/官方 v0 discovery/gu, '公开检索').replace(/cohort/giu, '群体');
}

export const AnimeMagazineComparisonCard: React.FC<{
  viewModel: SubjectCohortComparisonViewModel;
  theme: ThemeTokens;
  width?: number;
  resolvedImages?: Record<string, string>;
}> = ({ viewModel, theme, width = 960, resolvedImages = {} }) => {
  const cohorts = viewModel.cohorts.slice(0, 2);
  const paired = cohorts.length === 2;
  const score = viewModel.metrics.find((metric) => metric.key === 'score');
  const metrics = viewModel.metrics.filter((metric) => metric.key !== 'score').slice(0, 3);
  const hasCover = cohorts.some((cohort) => {
    const image = cohort.subjects[0]?.image;
    return image && resolvedImages[image];
  });
  const coverHeight = hasCover ? Math.min(420, Math.max(190, width * (paired ? 0.69 : 0.52))) : 96;
  const briefLimitations = viewModel.limitations.map(humanLimitation).filter(Boolean).slice(0, 1);
  const complete = viewModel.state === 'complete';
  const state = complete
    ? '本次样本完整'
    : viewModel.state === 'conflict'
      ? '存在数据冲突'
      : '部分数据可用';
  const warning =
    viewModel.warnings.find((item) => item.code !== 'EXPERIMENTAL_SOURCE') ?? viewModel.warnings[0];
  const warningLabel =
    warning?.code === 'EXPERIMENTAL_SOURCE' ? '公开条目搜索仍处于实验阶段。' : warning?.message;
  const css = {
    '--mag-paper': theme.surface,
    '--mag-wash': theme.surfaceAlt,
    '--mag-ink': theme.text,
    '--mag-muted': theme.textMuted,
    '--mag-rule': theme.border,
    '--mag-a': theme.accent,
    '--mag-b': theme.warning,
    '--mag-delta': theme.success,
    '--mag-cover-ink': 'oklch(99% 0.005 250)',
    '--mag-cover-scrim': 'oklch(20% 0.04 260 / 0.84)',
    '--font-body': theme.design.bodyFontFamily,
    '--font-display': theme.design.displayFontFamily,
    width,
    maxWidth: '100%',
    minWidth: 0,
    padding: SPACE.md,
    background: 'var(--mag-paper)',
    color: 'var(--mag-ink)',
    fontFamily: 'var(--font-body)',
    fontSize: TYPE.body,
    lineHeight: 1.55,
    fontVariantNumeric: 'tabular-nums',
    overflow: 'clip',
    containerType: 'inline-size',
    containerName: 'anime-magazine',
  } as React.CSSProperties;
  const row: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `minmax(0, 1.45fr) repeat(${cohorts.length || 1}, minmax(0, 1fr))${paired ? ' minmax(0, 1.2fr)' : ''}`,
    gap: SPACE.sm,
    alignItems: 'center',
    minWidth: 0,
  };

  return (
    <article
      data-render-root
      data-render-pack="anime-magazine"
      data-render-theme={theme.name}
      data-design-baseline="c07-anime-magazine-v1"
      style={css}
    >
      <style>{`
        @container anime-magazine (max-width: 20em) {
          .magazine-score-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          .magazine-score-delta { grid-row: 5 !important; grid-column: 1 / -1; flex-direction: row !important; align-items: center !important; justify-content: space-between !important; }
          .magazine-metric-row { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; }
          .magazine-metric-label { grid-column: 1 / -1; }
        }
      `}</style>
      <header
        style={{ display: 'flex', alignItems: 'center', gap: SPACE.sm, marginBottom: SPACE.sm }}
      >
        <span
          aria-hidden
          style={{ width: 4, alignSelf: 'stretch', background: 'var(--mag-a)', borderRadius: 2 }}
        />
        <div style={{ minWidth: 0 }}>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: TYPE.title,
              fontWeight: 700,
              minWidth: 0,
              overflowWrap: 'anywhere',
              letterSpacing: '-0.025em',
              lineHeight: 1.2,
            }}
          >
            条目群体比较
          </h1>
          <p style={{ color: 'var(--mag-muted)', fontSize: TYPE.small, marginTop: SPACE.xs }}>
            {state} · 每组最多 {viewModel.coverage.maxSubjectsPerCohort} 条
          </p>
        </div>
      </header>

      <section
        aria-label="群体代表封面"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cohorts.length || 1}, minmax(0, 1fr))`,
          gap: SPACE.sm,
          marginInline: -SPACE.sm,
        }}
      >
        {cohorts.map((cohort, index) => {
          const subject = cohort.subjects[0];
          const image = subject?.image ? resolvedImages[subject.image] : undefined;
          return (
            <figure
              key={index}
              style={{ minWidth: 0, marginTop: paired && index === 0 ? SPACE.md : 0 }}
            >
              <div
                data-layout="magazine-cover"
                style={{
                  height: image ? coverHeight - (paired && index === 0 ? SPACE.md : 0) : undefined,
                  minHeight: coverHeight - (paired && index === 0 ? SPACE.md : 0),
                  display: 'flex',
                  flexDirection: 'column',
                  overflow: 'clip',
                  borderRadius:
                    index === 0
                      ? '56% 44% 20px 20px / 12% 9% 20px 20px'
                      : '20px 70% 20px 20px / 20px 24% 20px 20px',
                  background: 'var(--mag-wash)',
                  position: 'relative',
                }}
              >
                {image ? (
                  <img
                    src={image}
                    alt={subject?.displayName || '群体样本封面'}
                    style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <div
                    data-cover-state="missing"
                    style={{
                      flexGrow: 1,
                      minHeight: 64,
                      paddingBlock: SPACE.sm,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: SPACE.sm,
                      color: 'var(--mag-muted)',
                      fontSize: TYPE.body,
                    }}
                  >
                    <RendererIcon name="subject" theme={theme} size={32} />
                    <span>{subject ? '封面暂缺' : '暂无可展示作品'}</span>
                  </div>
                )}
                {subject?.name ? (
                  <figcaption
                    style={{
                      position: image ? 'absolute' : 'static',
                      insetInline: 0,
                      bottom: 0,
                      padding: SPACE.sm,
                      fontSize: TYPE.small,
                      lineHeight: 1.4,
                      overflowWrap: 'anywhere',
                      color: 'var(--mag-cover-ink)',
                      background: 'var(--mag-cover-scrim)',
                    }}
                  >
                    {subject.name}
                  </figcaption>
                ) : null}
              </div>
            </figure>
          );
        })}
      </section>

      {cohorts.length === 0 ? (
        <p style={{ marginBlock: SPACE.lg }}>尚未取得群体样本，无法计算比较结果。</p>
      ) : null}
      <section
        aria-label="样本均分"
        className={paired ? 'magazine-score-grid' : undefined}
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cohorts.length || 1}, minmax(0, 1fr))${paired ? ' minmax(0, 0.75fr)' : ''}`,
          gridTemplateRows: 'auto auto auto auto',
          columnGap: SPACE.sm,
          rowGap: SPACE.xs,
          marginTop: SPACE.md,
          alignItems: 'stretch',
        }}
      >
        {cohorts.map((cohort, index) => {
          const subject = cohort.subjects[0];
          const value = observed(score, cohort, index);
          const color = index === 0 ? 'var(--mag-a)' : 'var(--mag-b)';
          const title =
            cohort.subjects.length === 1 && subject ? subject.displayName : cohort.label;
          return (
            <div
              key={index}
              style={{
                minWidth: 0,
                paddingLeft: SPACE.sm,
                borderLeft: `2px solid ${color}`,
                display: 'grid',
                gridRow: '1 / span 4',
                gridTemplateRows: 'subgrid',
              }}
            >
              <div style={{ minWidth: 0, textWrap: 'balance', lineHeight: 1.4 }}>
                <span
                  style={{ color, fontSize: TYPE.small, fontWeight: 700, marginRight: SPACE.xs }}
                >
                  {index === 0 ? 'A' : 'B'}
                </span>
                <h2
                  style={{
                    fontSize: TYPE.subject,
                    fontWeight: 700,
                    display: 'inline',
                    overflowWrap: 'anywhere',
                    lineHeight: 1.4,
                  }}
                >
                  {title || '未命名群体'}
                </h2>
              </div>
              <div>
                <p style={{ fontSize: TYPE.small, color: 'var(--mag-muted)', marginTop: SPACE.sm }}>
                  样本均分
                </p>
                {cohort.coverage.metrics.score.state !== 'complete' ? (
                  <p style={{ fontSize: TYPE.small, color: 'var(--mag-muted)' }}>
                    {coverageLabel(cohort, 'score')}
                  </p>
                ) : null}
              </div>
              <strong
                data-metric="score"
                style={{
                  display: 'block',
                  fontSize: value === undefined ? TYPE.value : TYPE.score,
                  fontWeight: 700,
                  color,
                  lineHeight: 1.25,
                }}
              >
                {numeric(value, 2)}
              </strong>
              <div
                aria-hidden
                style={{
                  height: 4,
                  marginTop: 0,
                  background: 'var(--mag-wash)',
                  borderRadius: 4,
                  overflow: 'clip',
                }}
              >
                {typeof value === 'number' && value >= 0 && value <= 10 ? (
                  <div
                    style={{
                      width: `${value * 10}%`,
                      height: '100%',
                      background: color,
                      borderRadius: 4,
                    }}
                  />
                ) : null}
              </div>
            </div>
          );
        })}
        {paired ? (
          <div
            data-layout="magazine-score-delta"
            className="magazine-score-delta"
            style={{
              gridRow: '1 / span 4',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              justifyContent: 'center',
              gap: SPACE.sm,
              background: 'var(--mag-wash)',
              borderRadius: 12,
              padding: SPACE.sm,
              fontSize: TYPE.small,
            }}
          >
            <span>
              评分差 <span style={{ display: 'block', whiteSpace: 'nowrap' }}>B − A</span>
            </span>
            <strong
              style={{
                fontSize: score?.state === 'complete' ? TYPE.title : TYPE.body,
                color: 'var(--mag-delta)',
                fontWeight: 700,
              }}
            >
              {difference(score, paired)}
            </strong>
          </div>
        ) : null}
      </section>

      <section aria-label="指标比较" style={{ marginTop: SPACE.md }}>
        <div
          className={paired ? 'magazine-metric-row' : undefined}
          style={{
            ...row,
            padding: SPACE.xs,
            background: 'var(--mag-wash)',
            borderRadius: 8,
            color: 'var(--mag-muted)',
            fontSize: TYPE.small,
          }}
        >
          <span className={paired ? 'magazine-metric-label' : undefined}>本次样本</span>
          {cohorts.map((_, index) => (
            <span key={index} style={{ textAlign: 'center' }}>
              {index === 0 ? 'A' : 'B'}
            </span>
          ))}
          {paired ? <span style={{ textAlign: 'right' }}>差值 B − A</span> : null}
        </div>
        {metrics.map((metric) => {
          const label =
            metric.key === 'heat'
              ? '收藏人数'
              : metric.key === 'episodesReported'
                ? '报告话数'
                : '评分离散';
          const digits = metric.key === 'ratingStandardDeviation' ? 2 : 1;
          return (
            <div
              key={metric.key}
              data-metric={metric.key}
              className={paired ? 'magazine-metric-row' : undefined}
              style={{
                ...row,
                padding: `${SPACE.xs}px ${SPACE.xs}px`,
                borderBottom: '1px solid var(--mag-rule)',
              }}
            >
              <div
                className={paired ? 'magazine-metric-label' : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: SPACE.xs,
                  minWidth: 0,
                  fontSize: TYPE.body,
                }}
              >
                <RendererIcon
                  name={
                    metric.key === 'heat'
                      ? 'person'
                      : metric.key === 'episodesReported'
                        ? 'subject'
                        : 'stats'
                  }
                  theme={theme}
                  size={18}
                />
                <span>{label}</span>
              </div>
              {cohorts.map((cohort, index) => (
                <div
                  key={index}
                  style={{
                    minWidth: 0,
                    textAlign: 'center',
                    color: index === 0 ? 'var(--mag-a)' : 'var(--mag-b)',
                  }}
                >
                  <strong style={{ fontSize: TYPE.value, fontWeight: 600 }}>
                    {numeric(
                      observed(metric, cohort, index),
                      digits,
                      metric.key === 'heat' || metric.key === 'episodesReported',
                    )}
                  </strong>
                  {cohort.coverage.metrics[metric.key]?.state !== 'complete' ? (
                    <p style={{ fontSize: TYPE.small, color: 'var(--mag-muted)' }}>
                      {coverageLabel(cohort, metric.key)}
                    </p>
                  ) : null}
                </div>
              ))}
              {paired ? (
                <strong
                  style={{
                    fontSize: metric.state === 'complete' ? TYPE.value : TYPE.small,
                    textAlign: 'right',
                    color: 'var(--mag-delta)',
                    fontWeight: 600,
                  }}
                >
                  {difference(metric, paired)}
                </strong>
              ) : null}
            </div>
          );
        })}
      </section>

      <footer
        style={{
          marginTop: SPACE.md,
          color: 'var(--mag-muted)',
          fontSize: TYPE.small,
          lineHeight: 1.5,
        }}
      >
        <p>
          样本 {viewModel.coverage.totalSubjectsReturned} 条 · 详情{' '}
          {viewModel.coverage.detailHydrationsSucceeded}/
          {viewModel.coverage.detailHydrationsAttempted} · 非全站统计
        </p>
        {viewModel.coverage.overlap.count > 0 ? (
          <p>两个群体包含 {viewModel.coverage.overlap.count} 个重叠条目。</p>
        ) : null}
        {warningLabel ? <p style={{ marginTop: SPACE.sm }}>{warningLabel}</p> : null}
        {briefLimitations.map((value, index) => (
          <p key={index} style={{ marginTop: SPACE.xs }}>
            {value}
          </p>
        ))}
        {viewModel.limitations.length > briefLimitations.length ? (
          <p>另有 {viewModel.limitations.length - briefLimitations.length} 项详细限制未展开。</p>
        ) : null}
        <div
          style={{
            marginTop: SPACE.md,
            paddingTop: SPACE.sm,
            borderTop: '1px solid var(--mag-rule)',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            gap: SPACE.sm,
          }}
        >
          <span>Bangumi 公共条目 · {dateLabel(viewModel.source.official.retrievedAt)}</span>
          <span>
            {viewModel.formulaVersion === 'subject-cohort-comparison-v1'
              ? '群体均值与差值 v1'
              : `方法版本：${viewModel.formulaVersion}`}
          </span>
        </div>
      </footer>
    </article>
  );
};
