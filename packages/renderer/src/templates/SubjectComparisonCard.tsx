import React from 'react';
import { CardFrame } from '../components/CardFrame.js';
import { Footer } from '../components/Footer.js';
import { MetaRow } from '../components/MetaRow.js';
import { ThemeTokens } from '../themes/index.js';
import { SubjectComparisonViewModel } from '../view-models/index.js';

export interface SubjectComparisonCardProps {
  viewModel: SubjectComparisonViewModel;
  theme: ThemeTokens;
  width?: number;
}

const TYPE_LABELS: Record<string, string> = {
  anime: '动画',
  book: '书籍',
  music: '音乐',
  game: '游戏',
  real: '三次元',
  other: '其他',
};

const SECTION_LABELS: Record<string, string> = {
  complete: '完整',
  partial: '部分',
  unavailable: '不可用',
  not_computable: '不可计算',
};

const SAFE_WARNING_LABELS: Record<string, string> = {
  MISSING_FIELD: '部分统计字段未返回，相关指标保持未知。',
  FORMULA_SUPPRESSED: '部分统计数据未返回，相关指标保持未知。',
  RATING_MEAN_CONFLICT: '评分来源存在差异，保留各来源结果。',
  UPSTREAM_UNAVAILABLE: '统计源暂时不可用，未生成猜测值。',
  ZERO_POPULATION: '当前没有可用于计算的评分或收藏样本。',
  SUBJECT_STATE_DEGRADED: '部分条目资料不完整，缺失区段不会被当作空值。',
  COMPARISON_VALUES_UNKNOWN: '部分比较字段缺少两侧可比数据，差值保持未知。',
  COMPARISON_VALUES_CONFLICT: '部分比较字段存在来源差异，未生成差值。',
};

const STATISTICS_CONFLICT_FIELD_LABELS: Record<string, string> = {
  score: '官方评分',
  'rating.score': '官方评分',
  histogramMean: '评分分布均值',
  'rating.histogramMean': '评分分布均值',
  'rating.standardDeviation': '评分离散度',
  standardDeviation: '评分离散度',
  'rating.population': '评分样本数',
  'rating.distribution': '评分分布',
  'collection.total': '收藏人数',
  'collection.completionRate': '完成率',
  'collection.distribution': '收藏状态分布',
};

const DATA_SECTION_LABELS: Record<string, string> = {
  stats: '统计',
  cast: '角色',
  staff: '制作人员',
  relations: '关联条目',
};

function dataSectionLabel(section: string): string {
  return DATA_SECTION_LABELS[section] || '其他资料';
}

function safeWarningLabel(warning: { code: string }): string {
  return SAFE_WARNING_LABELS[warning.code] || '部分资料未能完整取得，已仅展示可确认内容。';
}

function humanizeLimitation(value: string): string {
  if (value.includes('比较只覆盖两个条目本次官方 v0 概览读取')) {
    return '比较仅依据本次已取得的条目与关联资料；缺失或截断不代表不存在。';
  }
  return value
    .replace(/官方 v0 概览读取/gu, '官方条目资料')
    .replace(/本次官方 v0/gu, '本次官方数据')
    .replace(/有界区段/gu, '本次返回的资料范围')
    .replace(/稳定 ID/gu, '人物编号')
    .replace(/缺失 ID/gu, '缺少人物编号');
}

function formatDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString().slice(0, 10) : undefined;
}

function stateLabel(
  state: SubjectComparisonViewModel['state'] | 'not_computable' | 'unknown' | 'conflict',
): string {
  switch (state) {
    case 'complete':
      return '比较完整';
    case 'partial':
      return '部分比较';
    case 'unavailable':
      return '来源不可用';
    case 'not_found':
      return '未找到';
    case 'not_computable':
      return '不可计算';
    case 'unknown':
      return '未知';
    case 'conflict':
      return '冲突';
  }
}

function valueLabel(value: unknown): string {
  if (value === null || value === undefined) return '未知';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '未知';
  if (typeof value === 'string' || typeof value === 'boolean') return String(value);
  return '复杂数据；完整内容见详细结果';
}

function formattedNumber(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '未知';
  return Number(value.toFixed(digits)).toString();
}

function percentageLabel(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '未知';
  return `${formattedNumber(value * 100, 1)}%`;
}

function comparisonValueLabel(
  key: SubjectComparisonViewModel['metrics'][number]['key'],
  value: number | null | undefined,
): string {
  if (key === 'collectionCompletionRate') return percentageLabel(value);
  if (key === 'ratingMean') return formattedNumber(value, 2);
  if (key === 'ratingStandardDeviation') return formattedNumber(value, 2);
  return valueLabel(value);
}

function comparisonSourceLabel(source: { class: string; provider: string }): string {
  if (
    source.class === 'official-v0' ||
    source.class === 'official_v0' ||
    source.provider === 'bangumi'
  ) {
    return '官方条目数据';
  }
  if (
    source.class === 'derived-s7' ||
    source.class === 'derived' ||
    source.provider === 'bangumi-agent-kit'
  ) {
    return '分布推算';
  }
  return '其他数据来源';
}

function metricValueLabel(
  metric: SubjectComparisonViewModel['metrics'][number],
  index: number,
): string {
  const conflict = metric.conflicts?.find((item) => item.side === (index === 0 ? 'A' : 'B'));
  if (!conflict) return comparisonValueLabel(metric.key, metric.values[index]);
  const candidateValues = (conflict.candidates || []).map((candidate) =>
    candidate.metricValue !== undefined
      ? candidate.metricValue
      : typeof candidate.value === 'number'
        ? candidate.value
        : undefined,
  );
  const statsValueIsInCandidates =
    conflict.statsValue !== undefined && candidateValues.includes(conflict.statsValue);
  const labels = [
    conflict.statsValue === undefined || statsValueIsInCandidates
      ? undefined
      : '统计值 ' + comparisonValueLabel(metric.key, conflict.statsValue),
    conflict.subjectValue === undefined
      ? undefined
      : '条目详情 ' + comparisonValueLabel(metric.key, conflict.subjectValue),
    conflict.candidates && conflict.candidates.length > 0
      ? conflict.candidates
          .map((candidate) => {
            const value =
              candidate.metricValue !== undefined
                ? candidate.metricValue
                : typeof candidate.value === 'number'
                  ? candidate.value
                  : null;
            return (
              comparisonSourceLabel(candidate.source) +
              ' ' +
              comparisonValueLabel(metric.key, value)
            );
          })
          .join('；')
      : undefined,
  ].filter((value): value is string => Boolean(value));
  return labels.join(' / ') || '来源数据不一致';
}

function deltaLabel(
  value: number | null,
  state: 'complete' | 'unknown' | 'conflict',
  key: SubjectComparisonViewModel['metrics'][number]['key'],
): string {
  if (state === 'conflict') return '冲突，不计算';
  if (value === null) return '不可计算';
  const formatted = comparisonValueLabel(key, value);
  return value > 0 ? `+${formatted}` : formatted;
}

function subjectTitle(subject: SubjectComparisonViewModel['subjects'][number]): string {
  return subject.subject?.nameCn || subject.subject?.name || `条目 ${subject.subjectId}`;
}

function overlapStateLabel(state: string): string {
  return (
    (
      {
        complete: '可计算',
        partial: '部分覆盖',
        unavailable: '不可用',
        not_computable: '不可计算',
      } as Record<string, string>
    )[state] || state
  );
}

function overlapCoverageLabel(
  coverage: SubjectComparisonViewModel['overlaps']['cast']['coverage'],
): string {
  const matched = coverage.matchedIds === undefined ? '未知' : coverage.matchedIds;
  return `A 行 ${coverage.left.rowsReturned}/${coverage.left.rowsObserved} · B 行 ${coverage.right.rowsReturned}/${coverage.right.rowsObserved} · 共同 ID ${matched} · 返回 ${coverage.returned} · 省略 ${coverage.omitted}`;
}

type ComparisonStatistics = NonNullable<
  SubjectComparisonViewModel['subjects'][number]['statistics']
>;

const COLLECTION_STATUS_LABELS: Record<string, string> = {
  wish: '想看',
  collect: '看过',
  doing: '在看',
  on_hold: '搁置',
  dropped: '抛弃',
};

function statisticsStateLabel(state: string): string {
  return (
    {
      complete: '完整',
      partial: '部分数据',
      conflict: '有差异',
      unavailable: '不可用',
      not_found: '未找到',
      not_computable: '无法计算',
      unknown: '未知',
    }[state] || '未知'
  );
}

function statisticsMetricStateLabel(state: string): string {
  return (
    {
      complete: '可计算',
      partial: '数据不全',
      conflict: '来源不一致',
      unavailable: '不可用',
      not_found: '未找到',
      not_computable: '无法计算',
      unknown: '未知',
    }[state] || '未知'
  );
}

function statisticsMetricLabel(stats: ComparisonStatistics, key: 'population' | 'mean' | 'sd') {
  if (key === 'population') return '评分人数 ' + valueLabel(stats.rating.population);
  if (key === 'mean') return '分布均值 ' + formattedNumber(stats.rating.mean);
  return '评分离散度 ' + formattedNumber(stats.rating.standardDeviation);
}

function statisticsSourceLabel(source: { class: string; provider: string }): string {
  if (
    source.class === 'official-v0' ||
    source.class === 'official_v0' ||
    source.provider === 'bangumi'
  ) {
    return '官方条目数据';
  }
  if (
    source.class === 'derived-s7' ||
    source.class === 'derived' ||
    source.provider === 'bangumi-agent-kit'
  ) {
    return '分布推算';
  }
  return '其他数据来源';
}

type ComparisonStatisticsConflict = NonNullable<
  ComparisonStatistics['rating']['conflicts']
>[number];

function statisticsConflictLabel(conflict: ComparisonStatisticsConflict): string {
  const candidates = conflict.candidates
    .slice(0, 3)
    .map((candidate) => statisticsSourceLabel(candidate.source) + ' ' + valueLabel(candidate.value))
    .join('；');
  const labels = (conflict.fieldPaths || []).map((fieldPath) => {
    if (STATISTICS_CONFLICT_FIELD_LABELS[fieldPath]) {
      return STATISTICS_CONFLICT_FIELD_LABELS[fieldPath];
    }
    if (/^rating\.count\./u.test(fieldPath) || /ratingHistogram/u.test(fieldPath)) {
      return '评分分布';
    }
    if (/^collection\./u.test(fieldPath)) return '收藏状态分布';
    return undefined;
  });
  const uniqueLabels = [...new Set(labels.filter((label): label is string => Boolean(label)))];
  const fieldLabel =
    uniqueLabels.slice(0, 3).join('、') ||
    (conflict.scope === 'rating'
      ? '评分统计'
      : conflict.scope === 'collection'
        ? '收藏统计'
        : conflict.scope === 'headline'
          ? '条目统计'
          : '相关统计');
  return `${fieldLabel}：${candidates || '多个统计来源的数据不一致。'}`;
}

function uniqueStatisticsConflicts(stats: ComparisonStatistics): ComparisonStatisticsConflict[] {
  const conflicts = [
    ...(stats.rating.conflicts || []),
    ...(stats.collection.conflicts || []),
    ...(stats.conflicts || []),
  ];
  const seen = new Set<string>();
  return conflicts.filter((conflict) => {
    const identity = JSON.stringify([
      conflict.scope || 'unknown',
      [...(conflict.fieldPaths || [])].sort(),
      conflict.reason,
      conflict.candidates.map((candidate) => [
        candidate.source.class,
        candidate.source.provider,
        candidate.value,
      ]),
    ]);
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
}

function statisticsCountLabel(value: number | undefined): string {
  return value === undefined ? '未知' : value.toLocaleString('zh-CN');
}

function statisticsPercentLabel(value: number | undefined): string {
  return value === undefined || !Number.isFinite(value) ? '未知' : value.toFixed(1) + '%';
}

export const SubjectComparisonCard: React.FC<SubjectComparisonCardProps> = ({
  viewModel,
  theme,
  width,
}) => {
  const left = viewModel.subjects[0];
  const right = viewModel.subjects[1];
  const columns = [left, right];
  const compact = width !== undefined && width < 760;
  const completionFormulaEvidenceStatus = columns.map(
    (subject) => subject.statistics?.collection.formulas?.completion?.evidenceStatus,
  );
  const completionFormulaNote = completionFormulaEvidenceStatus.includes('empirically_verified')
    ? '完成率＝看过人数 ÷ 五类收藏状态总人数；该公式经样本验证，并非官方 API 契约。'
    : '完成率＝看过人数 ÷ 五类收藏状态总人数；仅按本次已返回数据计算。';

  return (
    <CardFrame theme={theme} width={width}>
      <div>
        <div style={{ color: theme.accent, fontSize: '11px', letterSpacing: '0.08em' }}>
          BANGUMI · 条目比较
        </div>
        <h1 style={{ fontSize: '22px', lineHeight: 1.3, marginTop: theme.spacing.xs }}>
          条目并列比较
        </h1>
        <div style={{ color: theme.textMuted, fontSize: '13px', marginTop: theme.spacing.xs }}>
          {stateLabel(viewModel.state)} · 不生成推荐或胜负结论
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        {columns.map((subject, index) => (
          <div
            key={subject.subjectId}
            style={{
              flex: '1 1 280px',
              minWidth: 0,
              backgroundColor: theme.surfaceAlt,
              border: `1px solid ${theme.border}`,
              borderRadius: theme.radius.md,
              padding: theme.spacing.md,
            }}
          >
            <div style={{ color: theme.accent, fontSize: '10px', letterSpacing: '0.08em' }}>
              {index === 0 ? 'A' : 'B'} · 条目 {subject.subjectId}
            </div>
            <div
              style={{
                fontSize: '16px',
                fontWeight: 600,
                marginTop: theme.spacing.xs,
                overflowWrap: 'anywhere',
              }}
            >
              {subjectTitle(subject)}
            </div>
            {subject.subject?.nameCn && subject.subject.name ? (
              <div style={{ color: theme.textMuted, fontSize: '11px', overflowWrap: 'anywhere' }}>
                {subject.subject.name}
              </div>
            ) : null}
            <MetaRow
              theme={theme}
              items={[
                subject.subject?.type
                  ? TYPE_LABELS[subject.subject.type] || subject.subject.type
                  : '类型未知',
                subject.subject?.date ? `日期 ${subject.subject.date}` : '日期未知',
                subject.subject?.platform ? `平台 ${subject.subject.platform}` : '平台未知',
              ]}
            />
            <MetaRow
              theme={theme}
              items={[
                subject.subject?.episodesReported !== undefined
                  ? `报告话数 ${subject.subject.episodesReported}`
                  : '报告话数未知',
                subject.subject?.totalEpisodesReported !== undefined
                  ? `总话数 ${subject.subject.totalEpisodesReported}`
                  : '总话数未知',
                `状态 ${stateLabel(subject.state)}`,
              ]}
            />
            <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.5 }}>
              区段：统计 {SECTION_LABELS[subject.sections.stats] || subject.sections.stats} · 角色{' '}
              {SECTION_LABELS[subject.sections.cast] || subject.sections.cast} · 职员{' '}
              {SECTION_LABELS[subject.sections.staff] || subject.sections.staff} · 关联{' '}
              {SECTION_LABELS[subject.sections.relations] || subject.sections.relations}
            </div>
            <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.5 }}>
              读取：{subject.coverage.sourceRequestsSucceeded}/
              {subject.coverage.sourceRequestsAttempted} 成功 · 区段完整{' '}
              {subject.coverage.sectionsComplete} · 部分 {subject.coverage.sectionsPartial} · 不可用{' '}
              {subject.coverage.sectionsUnavailable} · 不可计算{' '}
              {subject.coverage.sectionsNotComputable}
              {subject.coverage.truncatedSections.length > 0
                ? ` · 达到展示上限：${subject.coverage.truncatedSections.map(dataSectionLabel).join('、')}`
                : ''}
            </div>
            <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.5 }}>
              区段上限：角色 {subject.coverage.limits.maxCast} · 职员{' '}
              {subject.coverage.limits.maxStaff} · 关联 {subject.coverage.limits.maxRelations}
            </div>
            {subject.warnings.length > 0 ? (
              <div style={{ color: theme.warning, fontSize: '11px', lineHeight: 1.5 }}>
                {subject.warnings.slice(0, 2).map(safeWarningLabel).join('；')}
                {subject.warnings.length > 2 ? `；另有 ${subject.warnings.length - 2} 条告警` : ''}
              </div>
            ) : null}
            {subject.limitations.filter(
              (limitation) =>
                !(subject.coverage.truncatedSections.length > 0 && limitation.includes('有界上限')),
            ).length > 0 ? (
              <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.5 }}>
                {subject.limitations
                  .filter(
                    (limitation) =>
                      !(
                        subject.coverage.truncatedSections.length > 0 &&
                        limitation.includes('有界上限')
                      ),
                  )
                  .slice(0, 2)
                  .map(humanizeLimitation)
                  .join('；')}
                {subject.limitations.filter(
                  (limitation) =>
                    !(
                      subject.coverage.truncatedSections.length > 0 &&
                      limitation.includes('有界上限')
                    ),
                ).length > 2
                  ? `；另有 ${
                      subject.limitations.filter(
                        (limitation) =>
                          !(
                            subject.coverage.truncatedSections.length > 0 &&
                            limitation.includes('有界上限')
                          ),
                      ).length - 2
                    } 条说明`
                  : ''}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <div
        style={{
          border: `1px solid ${theme.border}`,
          borderRadius: theme.radius.md,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: compact ? '1fr auto' : '1.4fr 1fr 1fr 1fr',
            gap: theme.spacing.xs,
            padding: theme.spacing.sm,
            color: theme.textMuted,
            backgroundColor: theme.surfaceAlt,
            fontSize: '11px',
          }}
        >
          {compact ? (
            <>
              <span>比较项目</span>
              <span>差值 B−A</span>
            </>
          ) : (
            <>
              <span>字段</span>
              <span style={{ overflowWrap: 'anywhere' }}>{subjectTitle(left)}</span>
              <span style={{ overflowWrap: 'anywhere' }}>{subjectTitle(right)}</span>
              <span>差值 B−A</span>
            </>
          )}
        </div>
        {viewModel.metrics.map((metric) => (
          <div
            key={metric.key}
            style={{
              display: 'grid',
              gridTemplateColumns: compact ? '1fr auto' : '1.4fr 1fr 1fr 1fr',
              gap: theme.spacing.xs,
              padding: theme.spacing.sm,
              borderTop: `1px solid ${theme.border}`,
              fontSize: '12px',
              lineHeight: 1.4,
            }}
          >
            {compact ? (
              <>
                <span style={{ fontWeight: 700 }}>{metric.label}</span>
                <span
                  style={{
                    color: metric.state === 'complete' ? theme.accent : theme.warning,
                    overflowWrap: 'anywhere',
                    textAlign: 'right',
                  }}
                >
                  {deltaLabel(metric.delta, metric.state, metric.key)}
                </span>
                <span style={{ gridColumn: '1 / -1', overflowWrap: 'anywhere' }}>
                  A · {metricValueLabel(metric, 0)}
                </span>
                <span style={{ gridColumn: '1 / -1', overflowWrap: 'anywhere' }}>
                  B · {metricValueLabel(metric, 1)}
                </span>
              </>
            ) : (
              <>
                <span>{metric.label}</span>
                <span style={{ overflowWrap: 'anywhere' }}>{metricValueLabel(metric, 0)}</span>
                <span style={{ overflowWrap: 'anywhere' }}>{metricValueLabel(metric, 1)}</span>
              </>
            )}
            {!compact ? (
              <span
                style={{
                  color: metric.state === 'complete' ? theme.accent : theme.warning,
                  overflowWrap: 'anywhere',
                }}
              >
                {deltaLabel(metric.delta, metric.state, metric.key)}
              </span>
            ) : null}
          </div>
        ))}
      </div>

      {columns.some((subject) => subject.statistics !== undefined) ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: theme.spacing.sm,
            border: '1px solid ' + theme.border,
            borderRadius: theme.radius.md,
            padding: theme.spacing.md,
            backgroundColor: theme.surfaceAlt,
          }}
        >
          <div style={{ color: theme.accent, fontWeight: 700, fontSize: '15px' }}>
            评分与收藏分布
          </div>
          <div style={{ color: theme.textMuted, fontSize: '12px', lineHeight: 1.5 }}>
            以下是本次官方快照。分布均值和完成率按已返回数据计算，不代表历史趋势或推荐。
          </div>
          <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.45 }}>
            {completionFormulaNote}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            {columns.map((subject, index) => {
              const stats = subject.statistics;
              if (!stats) {
                return (
                  <div
                    key={subject.subjectId}
                    style={{ flex: '1 1 280px', color: theme.textMuted, fontSize: '12px' }}
                  >
                    {index === 0 ? 'A' : 'B'} · 统计源未提供，未填充猜测值。
                  </div>
                );
              }
              const ratingMax = Math.max(
                1,
                ...stats.rating.distribution.map((item) => item.count ?? 0),
              );
              const collectionMax = Math.max(
                1,
                ...stats.collection.distribution.map((item) => item.count ?? 0),
              );
              const conflicts = uniqueStatisticsConflicts(stats);
              const warnings = stats.warnings.map(safeWarningLabel);
              return (
                <div
                  key={subject.subjectId}
                  style={{
                    flex: '1 1 280px',
                    minWidth: 0,
                    border: '1px solid ' + theme.border,
                    borderRadius: theme.radius.sm,
                    padding: theme.spacing.sm,
                  }}
                >
                  <div style={{ color: theme.text, fontSize: '13px', fontWeight: 700 }}>
                    {index === 0 ? 'A' : 'B'} · {subjectTitle(subject)} ·{' '}
                    {statisticsStateLabel(stats.state)}
                  </div>
                  <MetaRow
                    theme={theme}
                    items={[
                      statisticsMetricLabel(stats, 'population'),
                      statisticsMetricLabel(stats, 'mean'),
                      statisticsMetricLabel(stats, 'sd'),
                      '收藏人数 ' + statisticsCountLabel(stats.collection.total),
                      '完成率 ' + percentageLabel(stats.collection.completionRate),
                    ]}
                  />
                  <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.45 }}>
                    评分 {statisticsStateLabel(stats.rating.state)} · 收藏{' '}
                    {statisticsStateLabel(stats.collection.state)} · 完成率{' '}
                    {statisticsMetricStateLabel(stats.collection.completionState)}
                  </div>
                  <div style={{ color: theme.textMuted, fontSize: '11px', marginTop: '7px' }}>
                    评分分布 · {stats.coverage.ratingBucketsObserved}/
                    {stats.coverage.ratingBucketsExpected} 档已收到
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
                      gap: '5px',
                      marginTop: '4px',
                    }}
                  >
                    {stats.rating.distribution.slice(0, 10).map((item) => (
                      <div
                        key={item.score}
                        style={{
                          minWidth: 0,
                          padding: '4px',
                          backgroundColor: theme.surfaceAlt,
                          borderRadius: theme.radius.sm,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: '2px',
                            fontSize: '10px',
                          }}
                        >
                          <span>{item.score}分</span>
                          <span>{statisticsCountLabel(item.count)}</span>
                        </div>
                        <div
                          style={{
                            height: '4px',
                            backgroundColor: theme.border,
                            borderRadius: '2px',
                            overflow: 'hidden',
                            marginTop: '3px',
                          }}
                        >
                          {item.count !== undefined ? (
                            <div
                              style={{
                                width: Math.min(100, (item.count / ratingMax) * 100) + '%',
                                height: '100%',
                                backgroundColor: theme.accent,
                              }}
                            />
                          ) : null}
                        </div>
                        <div
                          style={{ color: theme.textMuted, fontSize: '10px', textAlign: 'right' }}
                        >
                          {statisticsPercentLabel(item.percentage)}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ color: theme.textMuted, fontSize: '11px', marginTop: '8px' }}>
                    收藏状态 · {stats.coverage.collectionBucketsObserved}/
                    {stats.coverage.collectionBucketsExpected} 类已收到
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
                      gap: '5px',
                      marginTop: '4px',
                    }}
                  >
                    {stats.collection.distribution.slice(0, 5).map((item) => (
                      <div
                        key={item.status}
                        style={{
                          minWidth: 0,
                          padding: '4px',
                          backgroundColor: theme.surfaceAlt,
                          borderRadius: theme.radius.sm,
                        }}
                      >
                        <div
                          style={{
                            color: theme.textMuted,
                            fontSize: '10px',
                            overflowWrap: 'anywhere',
                          }}
                        >
                          {COLLECTION_STATUS_LABELS[item.status] || '其他'}
                        </div>
                        <div style={{ color: theme.text, fontSize: '11px', fontWeight: 700 }}>
                          {statisticsCountLabel(item.count)}
                        </div>
                        <div style={{ color: theme.textMuted, fontSize: '10px' }}>
                          {statisticsPercentLabel(item.percentage)}
                        </div>
                        <div
                          style={{
                            height: '4px',
                            backgroundColor: theme.border,
                            borderRadius: '2px',
                            overflow: 'hidden',
                            marginTop: '3px',
                          }}
                        >
                          {item.count !== undefined ? (
                            <div
                              style={{
                                width: Math.min(100, (item.count / collectionMax) * 100) + '%',
                                height: '100%',
                                backgroundColor: theme.accent,
                              }}
                            />
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                  {conflicts.length > 0 ? (
                    <div
                      style={{
                        color: theme.warning,
                        fontSize: '11px',
                        lineHeight: 1.45,
                        marginTop: '7px',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      统计来源存在差异：
                      {conflicts.slice(0, 2).map(statisticsConflictLabel).join('；')}
                      {conflicts.length > 2 ? '；另有 ' + (conflicts.length - 2) + ' 条' : ''}
                    </div>
                  ) : null}
                  {warnings.length > 0 ? (
                    <div
                      style={{
                        color: theme.warning,
                        fontSize: '11px',
                        lineHeight: 1.45,
                        marginTop: '5px',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {warnings.slice(0, 2).join('；')}
                      {warnings.length > 2 ? '；另有 ' + (warnings.length - 2) + ' 条数据提示' : ''}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: theme.spacing.sm,
          border: `1px solid ${theme.border}`,
          borderRadius: theme.radius.md,
          padding: theme.spacing.md,
          backgroundColor: theme.surfaceAlt,
        }}
      >
        <MetaRow
          theme={theme}
          items={[
            '本次条目 ' +
              viewModel.coverage.returnedSubjects +
              '/' +
              viewModel.coverage.requestedSubjects,
            '可比较字段 ' +
              viewModel.coverage.metricsComplete +
              '/' +
              (viewModel.coverage.metricsComplete +
                viewModel.coverage.metricsUnknown +
                viewModel.coverage.metricsConflict),
            viewModel.coverage.metricsUnknown > 0
              ? '资料不足 ' + viewModel.coverage.metricsUnknown + ' 项'
              : '资料不足 0 项',
            viewModel.coverage.metricsConflict > 0
              ? '来源差异 ' + viewModel.coverage.metricsConflict + ' 项'
              : '来源一致',
          ]}
        />

        <div style={{ color: theme.accent, fontWeight: 700, fontSize: '14px' }}>
          共同角色与制作人员
        </div>
        <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.5 }}>
          共同人物按两边本次返回的关系资料和人物编号匹配；资料缺失或不可用时，无法据此判断没有共同人物。
        </div>
        {(
          [
            ['cast', '共同声优', viewModel.overlaps.cast],
            ['staff', '共同制作人员', viewModel.overlaps.staff],
          ] as const
        ).map(([kind, title, overlap]) => {
          const visible = overlap.items.slice(0, 12);
          const omitted = Math.max(0, overlap.items.length - visible.length);
          return (
            <section key={kind} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ color: theme.text, fontSize: '12px', fontWeight: 700 }}>
                {title} · {overlapStateLabel(overlap.state)}
              </div>
              <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.5 }}>
                {overlapCoverageLabel(overlap.coverage)}
                {overlap.coverage.left.missingIdRows + overlap.coverage.right.missingIdRows > 0
                  ? ` · 缺少编号 ${overlap.coverage.left.missingIdRows + overlap.coverage.right.missingIdRows}`
                  : ''}
                {overlap.coverage.truncated ? ' · 交集仅代表已观察覆盖' : ''}
              </div>
              {visible.length === 0 ? (
                <div style={{ color: theme.textMuted, fontSize: '11px' }}>
                  {overlap.state === 'complete'
                    ? '本次完整观察中没有共同人物。'
                    : '当前不能从可用区段确认共同人物。'}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                  {visible.map((person) => {
                    const credits = person.credits
                      .map((credit) => {
                        if (kind === 'cast') {
                          const castCredit =
                            credit as (typeof viewModel.overlaps.cast.items)[number]['credits'][number];
                          return `${credit.side}：${
                            castCredit.characters
                              .map((character) => `${character.name}（${character.relation}）`)
                              .join('、') || '角色未知'
                          }`;
                        }
                        const staffCredit =
                          credit as (typeof viewModel.overlaps.staff.items)[number]['credits'][number];
                        const labels = staffCredit.rawRelations.filter(Boolean);
                        return `${credit.side}：${labels.join('、') || staffCredit.relations.join('、') || '职位未知'}`;
                      })
                      .join('；');
                    return (
                      <div
                        key={`${kind}-${person.personId}`}
                        style={{
                          color: theme.text,
                          fontSize: '11px',
                          lineHeight: 1.45,
                          overflowWrap: 'anywhere',
                        }}
                      >
                        <span style={{ color: theme.accent, fontWeight: 700 }}>{person.name}</span>{' '}
                        <span style={{ color: theme.textMuted }}>
                          编号 {person.personId}
                          {person.career.length ? ` · ${person.career.join('、')}` : ''} · {credits}
                          {person.nameVariants && person.nameVariants.length > 1
                            ? ` · 名称候选：${person.nameVariants.join('、')}`
                            : ''}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
              {overlap.coverage.omitted + omitted > 0 ? (
                <div style={{ color: theme.warning, fontSize: '11px' }}>
                  另有 {overlap.coverage.omitted + omitted} 个共同人物未展开。
                </div>
              ) : null}
            </section>
          );
        })}
      </div>

      {viewModel.coverage.omittedMetrics > 0 ? (
        <div style={{ color: theme.warning, fontSize: '11px' }}>
          渲染器省略比较字段：{viewModel.coverage.omittedMetrics} 条。
        </div>
      ) : null}
      {viewModel.warnings.length > 0 ? (
        <div
          style={{
            color: theme.warning,
            fontSize: '11px',
            lineHeight: 1.5,
            overflowWrap: 'anywhere',
          }}
        >
          {viewModel.warnings.slice(0, 3).map(safeWarningLabel).join('；')}
          {viewModel.warnings.length > 3 ? `；另有 ${viewModel.warnings.length - 3} 条告警` : ''}
        </div>
      ) : null}
      {viewModel.limitations.length > 0 ? (
        <div
          style={{
            color: theme.textMuted,
            fontSize: '11px',
            lineHeight: 1.5,
            overflowWrap: 'anywhere',
          }}
        >
          {viewModel.limitations.slice(0, 3).map(humanizeLimitation).join('；')}
          {viewModel.limitations.length > 3
            ? `；另有 ${viewModel.limitations.length - 3} 条限制`
            : ''}
        </div>
      ) : null}
      <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.4 }}>
        数据来源：Bangumi 官方条目与统计信息
        {formatDate(viewModel.source.official.retrievedAt)
          ? ' · 更新于 ' + formatDate(viewModel.source.official.retrievedAt)
          : ''}
      </div>
      <Footer theme={theme} />
    </CardFrame>
  );
};
