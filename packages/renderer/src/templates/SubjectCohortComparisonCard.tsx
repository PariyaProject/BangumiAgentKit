import React from 'react';
import { CardFrame } from '../components/CardFrame.js';
import { Footer } from '../components/Footer.js';
import { MetaRow } from '../components/MetaRow.js';
import { TitleBlock } from '../components/TitleBlock.js';
import type { ThemeTokens } from '../themes/index.js';
import type { SubjectCohortComparisonViewModel } from '../view-models/index.js';

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
  return key === 'score' ? 2 : 1;
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
    : `${numberLabel(partial, metricDigits(metric.key))}（partial observation）`;
}

function metricCoverageLabel(
  cohort: SubjectCohortComparisonViewModel['cohorts'][number],
  key: SubjectCohortComparisonViewModel['metrics'][number]['key'],
): string {
  const coverage = cohort.coverage.metrics[key];
  return `${coverage.valid} 有效 · ${coverage.missing} 缺失 · ${coverage.conflicts} 冲突 · ${stateLabel(coverage.state)}`;
}

export const SubjectCohortComparisonCard: React.FC<SubjectCohortComparisonCardProps> = ({
  viewModel,
  theme,
  width,
}) => {
  const dimensions = viewModel.cohorts;
  const showComparison = dimensions.length === 2;
  const officialOperations = viewModel.source.official.operations.join(' · ') || '未记录';
  const hasWarnings = viewModel.warnings.length > 0;

  return (
    <CardFrame theme={theme} width={width}>
      <TitleBlock
        title={showComparison ? '条目群体比较' : '条目群体聚合'}
        subtitle={`官方 v0 + derived-s7 · ${stateLabel(viewModel.state)} · ${showComparison ? '差值为 B − A' : '单 cohort 观察'}，不生成推荐或胜负结论`}
        theme={theme}
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: width !== undefined && width >= 820 ? '1fr 1fr' : '1fr',
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
                {index === 0 ? 'A' : 'B'} · COHORT
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
                  `总数 ${queryCoverage.totalKind}`,
                ]}
              />
              <div style={{ color: theme.textMuted, fontSize: '10px', lineHeight: 1.5 }}>
                查询：{queryCoverage.pagesScanned}/{queryCoverage.pagesRequested} 页 ·{' '}
                {queryCoverage.upstreamExhausted ? '上游耗尽' : '未证明耗尽'} ·{' '}
                {queryCoverage.budgetExceeded ? '达到预算' : '预算内'} · 详情{' '}
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
                返回样本
              </div>
              {cohort.subjects.length === 0 ? (
                <div style={{ color: theme.warning, fontSize: '11px', lineHeight: 1.5 }}>
                  没有可展示的条目；空结果不证明目录中不存在匹配项。
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
                        评分 {numberLabel(subject.score, 2)} · 热度{' '}
                        {numberLabel(subject.collectionTotal, 0)} · 报告话数{' '}
                        {numberLabel(subject.episodesReported, 0)}
                      </div>
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
          均值只对对应指标的有效值计算；部分覆盖只显示为 partial observation，不冒充完整均值；
          {showComparison ? ' delta 仅在两侧指标覆盖完整时显示。' : '单 cohort 不计算 delta。'}
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
                <div style={{ color: theme.textMuted, fontSize: '9px' }}>{metric.sourceField}</div>
              </div>
              {viewModel.cohorts.map((cohort, index) => (
                <div key={`${metric.key}-${index}`} style={{ color: theme.textMuted }}>
                  {index === 0 ? 'A' : 'B'} ·{' '}
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
        资源：每侧最多 {viewModel.coverage.maxSubjectsPerCohort} 条返回样本 · 总返回{' '}
        {viewModel.coverage.totalSubjectsReturned} · 详情读取{' '}
        {viewModel.coverage.detailHydrationsSucceeded}/
        {viewModel.coverage.detailHydrationsAttempted} 成功
        {viewModel.coverage.truncated ? ' · 至少一侧存在有界/部分覆盖' : ''}
        {' · '}证据 {viewModel.coverage.evidence.retained}/{viewModel.coverage.evidence.maxRefs}{' '}
        条、 {viewModel.coverage.evidence.bytes}/{viewModel.coverage.evidence.maxBytes} 字节
        {viewModel.coverage.evidence.omitted > 0
          ? `（省略 ${viewModel.coverage.evidence.omitted}，去重 ${viewModel.coverage.evidence.deduplicated}）`
          : ''}
      </div>

      {hasWarnings ? (
        <div style={{ color: theme.warning, fontSize: '10px', lineHeight: 1.5 }}>
          <div style={{ fontWeight: 700 }}>告警</div>
          {viewModel.warnings.slice(0, 3).map((warning, index) => (
            <div key={`${warning.code}-${index}`}>
              {warning.code} · {warning.message}
            </div>
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
        来源：{officialOperations} · 检索时间 {viewModel.retrievedAt || '未知'} · 公式{' '}
        {viewModel.formulaVersion}
      </div>
      <Footer label="Bangumi 官方 v0 条目 cohort 观察" theme={theme} />
    </CardFrame>
  );
};
