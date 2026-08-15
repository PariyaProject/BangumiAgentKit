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

function stateLabel(state: SubjectComparisonViewModel['state']): string {
  switch (state) {
    case 'complete':
      return '比较完整';
    case 'partial':
      return '部分比较';
    case 'unavailable':
      return '来源不可用';
    case 'not_found':
      return '未找到';
  }
}

function valueLabel(value: number | null): string {
  return value === null ? '未知' : String(value);
}

function deltaLabel(value: number | null, state: 'complete' | 'unknown' | 'conflict'): string {
  if (state === 'conflict') return '冲突，不计算';
  if (value === null) return '不可计算';
  return value > 0 ? `+${value}` : String(value);
}

function subjectTitle(subject: SubjectComparisonViewModel['subjects'][number]): string {
  return subject.subject?.nameCn || subject.subject?.name || `条目 ${subject.subjectId}`;
}

export const SubjectComparisonCard: React.FC<SubjectComparisonCardProps> = ({
  viewModel,
  theme,
  width,
}) => {
  const left = viewModel.subjects[0];
  const right = viewModel.subjects[1];
  const columns = [left, right];

  return (
    <CardFrame theme={theme} width={width}>
      <div>
        <div style={{ color: theme.accent, fontSize: '11px', letterSpacing: '0.08em' }}>
          SUBJECT COMPARISON
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
            gridTemplateColumns: '1.4fr 1fr 1fr 1fr',
            gap: theme.spacing.xs,
            padding: theme.spacing.sm,
            color: theme.textMuted,
            backgroundColor: theme.surfaceAlt,
            fontSize: '11px',
          }}
        >
          <span>字段</span>
          <span>{subjectTitle(left)}</span>
          <span>{subjectTitle(right)}</span>
          <span>差值 B−A</span>
        </div>
        {viewModel.metrics.map((metric) => (
          <div
            key={metric.key}
            style={{
              display: 'grid',
              gridTemplateColumns: '1.4fr 1fr 1fr 1fr',
              gap: theme.spacing.xs,
              padding: theme.spacing.sm,
              borderTop: `1px solid ${theme.border}`,
              fontSize: '12px',
              lineHeight: 1.4,
            }}
          >
            <span>{metric.label}</span>
            <span>{valueLabel(metric.values[0])}</span>
            <span>{valueLabel(metric.values[1])}</span>
            <span
              style={{
                color: metric.state === 'complete' ? theme.accent : theme.warning,
              }}
            >
              {deltaLabel(metric.delta, metric.state)}
            </span>
          </div>
        ))}
      </div>

      <MetaRow
        theme={theme}
        items={[
          `字段可计算 ${viewModel.coverage.metricsComplete}/${viewModel.coverage.metricsComplete + viewModel.coverage.metricsUnknown + viewModel.coverage.metricsConflict}`,
          `未知 ${viewModel.coverage.metricsUnknown} · 冲突 ${viewModel.coverage.metricsConflict}`,
          `来源请求 ${viewModel.coverage.subjectsComplete}/${viewModel.coverage.requestedSubjects} 条目完整`,
          `上限 2 个条目`,
          `公式 ${viewModel.formulaVersion}`,
        ]}
      />

      {viewModel.coverage.omittedMetrics > 0 ? (
        <div style={{ color: theme.warning, fontSize: '11px' }}>
          渲染器省略比较字段：{viewModel.coverage.omittedMetrics} 条。
        </div>
      ) : null}
      {viewModel.warnings.length > 0 ? (
        <div style={{ color: theme.warning, fontSize: '11px', lineHeight: 1.5 }}>
          {viewModel.warnings
            .slice(0, 3)
            .map((warning) => warning.message)
            .join('；')}
          {viewModel.warnings.length > 3 ? `；另有 ${viewModel.warnings.length - 3} 条告警` : ''}
        </div>
      ) : null}
      <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.5 }}>
        限制：{viewModel.limitations[0]}
      </div>
      <div style={{ color: theme.textMuted, fontSize: '10px', lineHeight: 1.4 }}>
        来源：Bangumi official v0 · {viewModel.source.operations.join(' + ')}
        {viewModel.source.retrievedAt ? ` · 获取于 ${viewModel.source.retrievedAt}` : ''}
      </div>
      <Footer theme={theme} />
    </CardFrame>
  );
};
