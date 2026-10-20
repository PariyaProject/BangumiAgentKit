import React from 'react';
import { CardFrame } from '../components/CardFrame.js';
import { Footer } from '../components/Footer.js';
import { MetaRow } from '../components/MetaRow.js';
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
  if (metric.delta === undefined) return '不可计算';
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

export const SubjectCohortComparisonCard: React.FC<SubjectCohortComparisonCardProps> = ({
  viewModel,
  theme,
  width,
}) => {
  const dimensions = viewModel.cohorts;
  const showComparison = dimensions.length === 2;
  const officialOperations =
    viewModel.source.official.operations
      .map((operation) => OFFICIAL_OPERATION_LABELS[operation] ?? '查询条目数据')
      .join('、') || 'Bangumi 公共条目';
  const hasWarnings = viewModel.warnings.length > 0;

  return (
    <CardFrame theme={theme} width={width}>
      <TitleBlock
        title={showComparison ? '条目群体比较' : '条目群体聚合'}
        subtitle={`Bangumi 公共数据 · ${stateLabel(viewModel.state)} · ${showComparison ? '差值按 B − A 展示' : '仅展示单组样本'}，不生成推荐结论`}
        theme={theme}
        icon="comparison"
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            showComparison && width !== undefined && width >= 820 ? '1fr 1fr' : '1fr',
          gap: theme.spacing.md,
        }}
      >
        {dimensions.map((cohort, index) => {
          const queryCoverage = cohort.coverage.query.coverage;
          const omittedSubjects = viewModel.coverage.omittedSubjectsPerCohort[index] ?? 0;
          return (
            <section
              key={`${cohort.label}-${index}`}
              style={{
                backgroundColor: theme.surfaceAlt,
                border: `1px solid ${theme.border}`,
                borderRadius: theme.radius.md,
                padding: theme.spacing.md,
                minWidth: 0,
              }}
            >
              <div style={{ color: theme.accent, fontSize: '10px', letterSpacing: '0.08em' }}>
                {showComparison ? `分组 ${index === 0 ? 'A' : 'B'}` : '样本分组'}
              </div>
              <div
                style={{
                  color: theme.text,
                  fontSize: '17px',
                  fontWeight: 700,
                  marginTop: theme.spacing.xs,
                  overflowWrap: 'anywhere',
                }}
              >
                {cohort.label}
              </div>
              <div
                style={{
                  color: theme.textMuted,
                  fontSize: '11px',
                  lineHeight: 1.5,
                  marginTop: theme.spacing.xs,
                  overflowWrap: 'anywhere',
                }}
              >
                {cohort.querySummary}
              </div>
              <MetaRow
                theme={theme}
                items={[
                  `状态 ${stateLabel(cohort.coverage.query.state)}`,
                  `返回 ${queryCoverage.returned}`,
                  `观察 ${queryCoverage.scanned}`,
                  totalKindLabel(queryCoverage.totalKind),
                ]}
              />
              <div style={{ color: theme.textMuted, fontSize: '10px', lineHeight: 1.5 }}>
                已读 {queryCoverage.pagesScanned}/{queryCoverage.pagesRequested} 页 ·{' '}
                {queryCoverage.upstreamExhausted ? '本次来源已读完' : '来源尚未读完'} ·{' '}
                {queryCoverage.budgetExceeded ? '已达到查询上限' : '查询未触及上限'} · 详情获取{' '}
                {cohort.coverage.detailHydrationsSucceeded}/
                {cohort.coverage.detailHydrationsAttempted} 成功
              </div>

              <div
                style={{
                  color: theme.accent,
                  fontWeight: 700,
                  fontSize: '13px',
                  marginTop: theme.spacing.sm,
                }}
              >
                {cohort.subjects.length === 0 ? '样本显示情况' : '返回样本'}
              </div>
              {cohort.subjects.length === 0 ? (
                <div style={{ color: theme.warning, fontSize: '11px', lineHeight: 1.5 }}>
                  {queryCoverage.returned > 0
                    ? `检索返回 ${queryCoverage.returned} 条结果，但作品详情暂不可用；本图不显示作品行。详情缺失不代表没有匹配项。`
                    : '本次检索没有可展示的条目；空结果不证明目录中不存在匹配项。'}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.xs }}>
                  {cohort.subjects.map((subject) => (
                    <div
                      key={subject.id}
                      style={{
                        borderTop: `1px solid ${theme.border}`,
                        paddingTop: theme.spacing.xs,
                        minWidth: 0,
                      }}
                    >
                      <div
                        style={{ color: theme.text, fontSize: '11px', overflowWrap: 'anywhere' }}
                      >
                        {subject.displayName}{' '}
                        <span style={{ color: theme.textMuted }}>#{subject.id}</span>
                      </div>
                      <div style={{ color: theme.textMuted, fontSize: '10px', lineHeight: 1.4 }}>
                        评分 {numberLabel(subject.score, 2)} · 评分人数{' '}
                        {subject.ratingCountState === 'invalid'
                          ? '无效'
                          : numberLabel(subject.ratingCount, 0)}{' '}
                        · 收藏人数 {numberLabel(subject.collectionTotal, 0)}
                        {' · '}报告话数 {numberLabel(subject.episodesReported, 0)} · 评分分布离散度{' '}
                        {numberLabel(subject.ratingStandardDeviation, 2)}（样本数{' '}
                        {numberLabel(subject.ratingHistogramPopulation, 0)}）
                      </div>
                      {(subject.ratingStandardDeviationConflicts || []).map((conflict, index) => (
                        <div
                          key={`${subject.id}-rating-conflict-${index}`}
                          style={{ color: theme.warning, fontSize: '9px', lineHeight: 1.35 }}
                        >
                          评分标准差冲突：
                          {conflict.kind === 'score_vs_histogram_mean'
                            ? `官方评分 ${numberLabel(conflict.officialScore, 2)} vs 直方图均值 ${numberLabel(conflict.histogramMean, 2)}`
                            : `搜索人数 ${numberLabel(conflict.discoveryRatingCount, 0)} 与详情总数 ${numberLabel(conflict.detailRatingTotal, 0)} 不一致`}
                        </div>
                      ))}
                      {subject.ratingHistogramTotalValidation &&
                      subject.ratingHistogramTotalValidation.state !== 'match' ? (
                        <div style={{ color: theme.warning, fontSize: '9px', lineHeight: 1.35 }}>
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
              {omittedSubjects > 0 ? (
                <div
                  style={{ color: theme.textMuted, fontSize: '10px', marginTop: theme.spacing.xs }}
                >
                  另有 {omittedSubjects} 条已返回样本未在卡片展开。
                </div>
              ) : null}
            </section>
          );
        })}
      </div>

      <section>
        <div style={{ color: theme.accent, fontWeight: 700, fontSize: '14px' }}>聚合指标</div>
        <div style={{ color: theme.textMuted, fontSize: '10px', lineHeight: 1.4 }}>
          均值仅按已取得的有效样本计算；部分数据不会冒充完整结果；
          {showComparison ? '只有两组数据完整时才显示差值。' : '单组结果不计算差值。'}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.xs }}>
          {viewModel.metrics.map((metric) => (
            <div
              key={metric.key}
              style={{
                display: 'grid',
                gridTemplateColumns:
                  width !== undefined && width >= 760
                    ? showComparison
                      ? '1.7fr 1fr 1fr 1fr'
                      : '1.7fr 1fr 1fr'
                    : '1fr',
                gap: theme.spacing.xs,
                backgroundColor: theme.surfaceAlt,
                border: `1px solid ${theme.border}`,
                borderRadius: theme.radius.sm,
                padding: theme.spacing.sm,
                fontSize: '11px',
              }}
            >
              <div>
                <div style={{ color: theme.text, fontWeight: 700 }}>{metric.label}</div>
                <div style={{ color: theme.textMuted, fontSize: '9px' }}>
                  {metricSourceLabel(metric.key)}
                </div>
                {metric.formula ? (
                  <div style={{ color: theme.textMuted, fontSize: '9px' }}>
                    计算口径：评分分布标准差（v{metric.formula.version}）
                  </div>
                ) : null}
              </div>
              {viewModel.cohorts.map((cohort, index) => (
                <div key={`${metric.key}-${index}`} style={{ color: theme.textMuted }}>
                  {showComparison ? `分组 ${index === 0 ? 'A' : 'B'}` : '样本'} ·{' '}
                  <strong style={{ color: theme.text }}>{averageLabel(metric, index)}</strong>
                  <div>{metricCoverageLabel(cohort, metric.key)}</div>
                </div>
              ))}
              {showComparison ? (
                <div style={{ color: metric.delta === undefined ? theme.warning : theme.text }}>
                  B − A · {deltaLabel(metric)}
                  <div style={{ color: theme.textMuted }}>{stateLabel(metric.state)}</div>
                </div>
              ) : (
                <div
                  style={{ color: metric.state === 'complete' ? theme.textMuted : theme.warning }}
                >
                  状态 · {stateLabel(metric.state)}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <div style={{ color: theme.textMuted, fontSize: '10px', lineHeight: 1.5 }}>
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
        <div style={{ color: theme.warning, fontSize: '10px', lineHeight: 1.5 }}>
          <div style={{ fontWeight: 700 }}>数据说明</div>
          {viewModel.warnings.slice(0, 3).map((warning, index) => (
            <div key={`${warning.code}-${index}`}>{warningText(warning.code, warning.message)}</div>
          ))}
          {viewModel.warnings.length > 3
            ? `卡片另有 ${viewModel.warnings.length - 3} 条告警。`
            : null}
          {viewModel.coverage.warnings.omitted > 0
            ? `语义结果另省略 ${viewModel.coverage.warnings.omitted} 条告警（上限 ${viewModel.coverage.warnings.max}）。`
            : null}
        </div>
      ) : null}

      {viewModel.limitations.length > 0 ? (
        <div style={{ color: theme.textMuted, fontSize: '10px', lineHeight: 1.5 }}>
          <div style={{ color: theme.accent, fontWeight: 700 }}>限制</div>
          {viewModel.limitations.slice(0, 5).map((limitation, index) => (
            <div key={index}>· {limitation}</div>
          ))}
          {viewModel.limitations.length > 5
            ? `另有 ${viewModel.limitations.length - 5} 条限制。`
            : null}
        </div>
      ) : null}

      <div style={{ color: theme.textMuted, fontSize: '10px', lineHeight: 1.5 }}>
        {cohortCalculationMethodLabel(viewModel.formulaVersion)}
      </div>
      <div style={{ color: theme.textMuted, fontSize: '10px', lineHeight: 1.5 }}>
        来源：Bangumi 公共条目 · {officialOperations} · {retrievalDateLabel(viewModel.retrievedAt)}
      </div>
      <Footer label="Bangumi 条目样本统计" theme={theme} />
    </CardFrame>
  );
};
