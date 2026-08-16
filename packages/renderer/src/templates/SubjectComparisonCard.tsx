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

function valueLabel(value: number | null | undefined): string {
  return value === null || value === undefined ? '未知' : String(value);
}

function metricValueLabel(
  metric: SubjectComparisonViewModel['metrics'][number],
  index: number,
): string {
  const conflict = metric.conflicts?.find((item) => item.side === (index === 0 ? 'A' : 'B'));
  if (!conflict) return valueLabel(metric.values[index]);
  const labels = [
    conflict.statsValue === undefined ? undefined : `统计 ${valueLabel(conflict.statsValue)}`,
    conflict.subjectValue === undefined ? undefined : `详情 ${valueLabel(conflict.subjectValue)}`,
    conflict.candidates && conflict.candidates.length > 0
      ? `候选 ${conflict.candidates
          .map((candidate) => {
            const source = `${candidate.source.class}/${candidate.source.provider}`;
            const value =
              candidate.metricValue !== undefined
                ? candidate.metricValue
                : typeof candidate.value === 'number'
                  ? candidate.value
                  : null;
            return `${source}=${valueLabel(value)}`;
          })
          .join('；')}`
      : undefined,
  ].filter((value): value is string => Boolean(value));
  return labels.join(' / ') || '冲突候选未知';
}

function deltaLabel(value: number | null, state: 'complete' | 'unknown' | 'conflict'): string {
  if (state === 'conflict') return '冲突，不计算';
  if (value === null) return '不可计算';
  return value > 0 ? `+${value}` : String(value);
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
            <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.5 }}>
              读取：{subject.coverage.sourceRequestsSucceeded}/
              {subject.coverage.sourceRequestsAttempted} 成功 · 区段完整{' '}
              {subject.coverage.sectionsComplete} · 部分 {subject.coverage.sectionsPartial} · 不可用{' '}
              {subject.coverage.sectionsUnavailable} · 不可计算{' '}
              {subject.coverage.sectionsNotComputable}
              {subject.coverage.truncatedSections.length > 0
                ? ` · 截断 ${subject.coverage.truncatedSections.join('、')}`
                : ''}
            </div>
            <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.5 }}>
              区段上限：角色 {subject.coverage.limits.maxCast} · 职员{' '}
              {subject.coverage.limits.maxStaff} · 关联 {subject.coverage.limits.maxRelations}
            </div>
            {subject.warnings.length > 0 ? (
              <div style={{ color: theme.warning, fontSize: '11px', lineHeight: 1.5 }}>
                {subject.warnings
                  .slice(0, 2)
                  .map((warning) => `${warning.code} · ${warning.message}`)
                  .join('；')}
                {subject.warnings.length > 2 ? `；另有 ${subject.warnings.length - 2} 条告警` : ''}
              </div>
            ) : null}
            {subject.limitations.length > 0 ? (
              <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.5 }}>
                限制：{subject.limitations.slice(0, 2).join('；')}
                {subject.limitations.length > 2
                  ? `；另有 ${subject.limitations.length - 2} 条限制`
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
            gridTemplateColumns: '1.4fr 1fr 1fr 1fr',
            gap: theme.spacing.xs,
            padding: theme.spacing.sm,
            color: theme.textMuted,
            backgroundColor: theme.surfaceAlt,
            fontSize: '11px',
          }}
        >
          <span>字段</span>
          <span style={{ overflowWrap: 'anywhere' }}>{subjectTitle(left)}</span>
          <span style={{ overflowWrap: 'anywhere' }}>{subjectTitle(right)}</span>
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
            <span style={{ overflowWrap: 'anywhere' }}>{metricValueLabel(metric, 0)}</span>
            <span style={{ overflowWrap: 'anywhere' }}>{metricValueLabel(metric, 1)}</span>
            <span
              style={{
                color: metric.state === 'complete' ? theme.accent : theme.warning,
                overflowWrap: 'anywhere',
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
          `条目身份已读取 ${viewModel.coverage.returnedSubjects}/${viewModel.coverage.requestedSubjects}`,
          `条目状态完整 ${viewModel.coverage.subjectsComplete} · 部分 ${viewModel.coverage.subjectsPartial} · 不可用 ${viewModel.coverage.subjectsUnavailable} · 未找到 ${viewModel.coverage.subjectsNotFound}`,
          `上限：条目 ${viewModel.coverage.limits.maxSubjects} · 角色 ${viewModel.coverage.limits.maxCast} · 职员 ${viewModel.coverage.limits.maxStaff} · 关联 ${viewModel.coverage.limits.maxRelations} · 共同人物 ${viewModel.coverage.limits.maxOverlapItems}`,
          `公式 ${viewModel.formulaVersion}`,
        ]}
      />

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
        <div style={{ color: theme.accent, fontWeight: 700, fontSize: '14px' }}>
          共同角色与制作人员
        </div>
        <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.5 }}>
          共同人物按两侧本次有界官方关系中的稳定 ID 求交集；省略、缺失 ID
          或不可用区段不等于没有共同人物。
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
                  ? ` · 缺失 ID ${overlap.coverage.left.missingIdRows + overlap.coverage.right.missingIdRows}`
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
                          ID {person.personId}
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
        <div style={{ color: theme.textMuted, fontSize: '10px' }}>
          共同关系公式：{viewModel.overlapFormulaVersion}
        </div>
      </div>

      {viewModel.coverage.omittedMetrics > 0 ? (
        <div style={{ color: theme.warning, fontSize: '11px' }}>
          渲染器省略比较字段：{viewModel.coverage.omittedMetrics} 条。
        </div>
      ) : null}
      {viewModel.warnings.length > 0 ? (
        <div style={{ color: theme.warning, fontSize: '11px', lineHeight: 1.5 }}>
          {viewModel.warnings
            .slice(0, 3)
            .map((warning) => `${warning.code} · ${warning.message}`)
            .join('；')}
          {viewModel.warnings.length > 3 ? `；另有 ${viewModel.warnings.length - 3} 条告警` : ''}
        </div>
      ) : null}
      {viewModel.limitations.length > 0 ? (
        <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.5 }}>
          限制：{viewModel.limitations.slice(0, 3).join('；')}
          {viewModel.limitations.length > 3
            ? `；另有 ${viewModel.limitations.length - 3} 条限制`
            : ''}
        </div>
      ) : null}
      <div style={{ color: theme.textMuted, fontSize: '10px', lineHeight: 1.4 }}>
        来源：official-v0 · {viewModel.source.official.operations.join(' + ') || '未记录'}
        {viewModel.source.official.retrievedAt
          ? ` · 获取于 ${viewModel.source.official.retrievedAt}`
          : ''}
        {' · '}derived-s7 · {viewModel.source.derived.operations.join(' + ') || '未记录'}
        {viewModel.source.derived.retrievedAt
          ? ` · 获取于 ${viewModel.source.derived.retrievedAt}`
          : ''}
      </div>
      <Footer theme={theme} />
    </CardFrame>
  );
};
