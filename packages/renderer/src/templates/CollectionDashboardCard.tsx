import React from 'react';
import { CardFrame } from '../components/CardFrame.js';
import { Footer } from '../components/Footer.js';
import {
  getRendererIconTone,
  RendererIcon,
  type RendererIconName,
} from '../components/RendererIcon.js';
import { TitleBlock } from '../components/TitleBlock.js';
import { CollectionDashboardViewModel } from '../view-models/index.js';
import { ThemeTokens } from '../themes/index.js';

export interface CollectionDashboardCardProps {
  viewModel: CollectionDashboardViewModel;
  theme: ThemeTokens;
  width?: number;
}

function stateLabel(state: CollectionDashboardViewModel['state']): string {
  if (state === 'complete') return '覆盖完整';
  if (state === 'partial') return '部分覆盖';
  if (state === 'auth_required') return '需要授权';
  if (state === 'permission_denied') return '无权限';
  if (state === 'rate_limited') return '请求受限';
  if (state === 'not_computable') return '无法计算';
  if (state === 'conflict') return '来源冲突';
  if (state === 'upstream_error') return '上游错误';
  return '暂不可用';
}

function boundedText(value: unknown, maximum = 150): string {
  const normalized = String(value ?? '')
    .replace(/\s+/gu, ' ')
    .trim();
  if (normalized.length <= maximum) return normalized;
  return `${Array.from(normalized)
    .slice(0, maximum - 1)
    .join('')}…`;
}

function evidenceLine(
  label: string,
  source: string,
  retrievedAt: string | undefined,
  operation: string,
  theme: ThemeTokens,
): React.ReactNode {
  return (
    <div style={{ color: theme.textMuted, fontSize: '10px', lineHeight: 1.5 }}>
      {label}来源：{boundedText(source, 64)} · 检索 {boundedText(retrievedAt || '未知', 32)}
      <br />
      证据：{boundedText(operation, 110)}
    </div>
  );
}

function omissionLine(
  label: string,
  section: CollectionDashboardViewModel['presentation'][Exclude<
    keyof CollectionDashboardViewModel['presentation'],
    'state'
  >],
  theme: ThemeTokens,
): React.ReactNode {
  if (section.omitted === 0) return null;
  return (
    <div style={{ color: theme.warning, fontSize: '10px', lineHeight: 1.5 }}>
      {label}展示 {section.rendered}/{section.available}，省略 {section.omitted} 条；完整计数仍见
      coverage。
    </div>
  );
}

function sectionHeader(
  title: string,
  state: CollectionDashboardViewModel['state'],
  theme: ThemeTokens,
  icon: RendererIconName,
): React.ReactNode {
  const tone = theme.tones[getRendererIconTone(icon)];
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: theme.spacing.sm,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm, minWidth: 0 }}>
        <RendererIcon name={icon} theme={theme} size={16} badge />
        <span style={{ color: tone.foreground, fontSize: '15px', fontWeight: 700 }}>{title}</span>
      </div>
      <span
        style={{
          color: theme.textMuted,
          fontSize: '11px',
          whiteSpace: 'nowrap',
          border: `1px solid ${theme.border}`,
          borderRadius: '999px',
          padding: '3px 8px',
        }}
      >
        {stateLabel(state)}
      </span>
    </div>
  );
}

function DashboardMetric({
  icon,
  label,
  value,
  detail,
  theme,
}: {
  icon: RendererIconName;
  label: string;
  value: string;
  detail: string;
  theme: ThemeTokens;
}): React.ReactNode {
  return (
    <div
      data-layout="dashboard-metric"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: theme.spacing.sm,
        backgroundColor: theme.surface,
        border: `1px solid ${theme.border}`,
        borderRadius: theme.radius.md,
        padding: theme.spacing.sm,
        minWidth: 0,
      }}
    >
      <RendererIcon name={icon} theme={theme} size={18} badge />
      <div style={{ minWidth: 0 }}>
        <div style={{ color: theme.textMuted, fontSize: '11px' }}>{label}</div>
        <div
          style={{ color: theme.text, fontSize: '18px', fontWeight: 800, overflowWrap: 'anywhere' }}
        >
          {value}
        </div>
        <div style={{ color: theme.textMuted, fontSize: '10px', lineHeight: 1.4 }}>{detail}</div>
      </div>
    </div>
  );
}

function DashboardFact({
  label,
  value,
  theme,
}: {
  label: string;
  value: string | number;
  theme: ThemeTokens;
}): React.ReactNode {
  return (
    <div
      style={{
        minWidth: 0,
        backgroundColor: theme.surface,
        borderRadius: theme.radius.sm,
        padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
      }}
    >
      <div style={{ color: theme.textMuted, fontSize: '10px' }}>{label}</div>
      <div
        style={{ color: theme.text, fontSize: '14px', fontWeight: 700, overflowWrap: 'anywhere' }}
      >
        {value}
      </div>
    </div>
  );
}

function DashboardListRow({
  icon,
  title,
  detail,
  theme,
}: {
  icon: RendererIconName;
  title: string;
  detail: string;
  theme: ThemeTokens;
}): React.ReactNode {
  return (
    <div
      role="listitem"
      style={{
        display: 'grid',
        gridTemplateColumns: '20px minmax(0, 1fr) auto',
        alignItems: 'center',
        gap: theme.spacing.xs,
        padding: `${theme.spacing.xs} 0`,
        borderBottom: `1px solid ${theme.border}`,
        minWidth: 0,
      }}
    >
      <RendererIcon name={icon} theme={theme} size={16} />
      <span style={{ color: theme.text, fontSize: '12px', overflowWrap: 'anywhere' }}>{title}</span>
      <span
        style={{
          color: theme.accent,
          fontSize: '11px',
          textAlign: 'right',
          overflowWrap: 'anywhere',
        }}
      >
        {detail}
      </span>
    </div>
  );
}

function SectionError({
  error,
  theme,
}: {
  error?: CollectionDashboardViewModel['sections']['intelligence']['error'];
  theme: ThemeTokens;
}): React.ReactNode {
  if (!error) return null;
  return (
    <div style={{ color: theme.warning, fontSize: '11px', lineHeight: 1.5 }}>
      {boundedText(error.message)} {error.nextAction ? boundedText(error.nextAction, 100) : ''}
      <div style={{ fontSize: '10px' }}>错误代码：{boundedText(error.code, 64)}</div>
    </div>
  );
}

export const CollectionDashboardCard: React.FC<CollectionDashboardCardProps> = ({
  viewModel,
  theme,
  width,
}) => {
  const intelligence = viewModel.sections.intelligence.result;
  const backlog = viewModel.sections.backlog.result;
  const schedule = viewModel.sections.schedule.result;
  const sectionGrid = width && width >= 900 ? 'repeat(3, minmax(0, 1fr))' : '1fr';
  const intelligenceTone = theme.tones.coral;
  const backlogTone = theme.tones.mint;
  const scheduleTone = theme.tones.butter;
  const warningMessages = viewModel.warnings
    .filter((warning) => warning.section !== undefined)
    .slice(0, 5)
    .map((warning) => boundedText(warning.message));
  const limitationMessages = viewModel.limitations
    .slice(0, 2)
    .map((limitation) => boundedText(limitation));

  return (
    <CardFrame theme={theme} width={width}>
      <TitleBlock
        title="我的收藏 Dashboard"
        subtitle={`当前账号 · 三个只读区段 · ${stateLabel(viewModel.state)}`}
        theme={theme}
        icon="overview"
      />

      <div
        data-layout="dashboard-context"
        style={{
          color: theme.textMuted,
          fontSize: '12px',
          lineHeight: 1.55,
          backgroundColor: theme.tones.blue.surface,
          borderRadius: theme.radius.md,
          padding: theme.spacing.sm,
        }}
      >
        三个只读区段：收藏概览、backlog、七日播出计划。日期不表示具体时刻或时区；未观察到的数据不会补猜。
        <div style={{ color: theme.accent, fontSize: '11px', marginTop: theme.spacing.xs }}>
          活跃状态过滤：{viewModel.filters.length ? viewModel.filters.join('、') : '未设置'} ·
          展示内容：
          {viewModel.presentation.state === 'complete' ? '无省略' : '有条目省略'}
        </div>
      </div>

      <div
        data-layout="dashboard-metrics"
        style={{
          display: 'grid',
          gridTemplateColumns:
            width && width >= 900 ? 'repeat(4, minmax(0, 1fr))' : 'repeat(2, 1fr)',
          gap: theme.spacing.sm,
        }}
      >
        {[
          {
            icon: 'overview' as const,
            label: '区段成功',
            value: `${viewModel.coverage.sectionsSucceeded} / ${viewModel.coverage.sectionsInvoked}`,
            detail: `请求 ${viewModel.coverage.sectionsRequested} 个区段`,
          },
          {
            icon: 'collection' as const,
            label: '收藏观察',
            value: `${viewModel.coverage.collectionRowsObserved} / ${viewModel.coverage.collectionRowsBound}`,
            detail: '观察行数 / 约束上限',
          },
          {
            icon: 'episode' as const,
            label: 'Backlog 条目',
            value: `${viewModel.coverage.backlogSubjectsSucceeded} / ${viewModel.coverage.backlogSubjectsRequested}`,
            detail: '成功 / 请求',
          },
          {
            icon: 'calendar' as const,
            label: '日历观察',
            value: String(viewModel.coverage.calendarRowsObserved),
            detail: `请求 ${viewModel.coverage.calendarRowsRequested} 行`,
          },
        ].map((metric) => (
          <DashboardMetric key={metric.label} {...metric} theme={theme} />
        ))}
      </div>

      <div
        data-layout="dashboard-bento"
        style={{
          display: 'grid',
          gridTemplateColumns: sectionGrid,
          gap: theme.spacing.md,
          alignItems: 'start',
        }}
      >
        <section
          style={{
            border: `1px solid ${intelligenceTone.border}`,
            borderRadius: theme.radius.md,
            padding: theme.spacing.md,
            borderLeft: `4px solid ${intelligenceTone.foreground}`,
            backgroundColor: intelligenceTone.surface,
            minWidth: 0,
          }}
        >
          {sectionHeader('收藏概览', viewModel.sections.intelligence.state, theme, 'overview')}
          <SectionError error={viewModel.sections.intelligence.error} theme={theme} />
          {intelligence ? (
            <>
              <div
                data-layout="dashboard-facts"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: theme.spacing.xs,
                }}
              >
                <DashboardFact
                  label="Backlog 总量"
                  value={intelligence.backlog.total}
                  theme={theme}
                />
                <DashboardFact
                  label="想看 / 搁置 / 在看"
                  value={`${intelligence.backlog.wish} / ${intelligence.backlog.onHold} / ${intelligence.backlog.doing}`}
                  theme={theme}
                />
                <DashboardFact label="已评分" value={intelligence.ratings.rated} theme={theme} />
                <DashboardFact
                  label="平均评分"
                  value={intelligence.ratings.average ?? '未知'}
                  theme={theme}
                />
                <DashboardFact label="不同标签" value={intelligence.tags.distinct} theme={theme} />
                <DashboardFact
                  label="已有进度"
                  value={intelligence.progress.itemsWithProgress}
                  theme={theme}
                />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing.xs }}>
                {intelligence.tags.top.length ? (
                  intelligence.tags.top.map((item) => (
                    <span
                      key={item.tag}
                      style={{
                        color: theme.textMuted,
                        border: `1px solid ${theme.border}`,
                        borderRadius: '999px',
                        padding: '3px 8px',
                        fontSize: '10px',
                      }}
                    >
                      {boundedText(item.tag, 32)} · {item.count}
                    </span>
                  ))
                ) : (
                  <span style={{ color: theme.textMuted, fontSize: '10px' }}>无可用标签证据</span>
                )}
              </div>
              {omissionLine('概览更新：', viewModel.presentation.intelligence, theme)}
              {evidenceLine(
                '',
                intelligence.source.label,
                intelligence.source.retrievedAt,
                intelligence.evidence.operation,
                theme,
              )}
            </>
          ) : (
            <div style={{ color: theme.textMuted, fontSize: '11px' }}>未生成收藏概览结果。</div>
          )}
        </section>

        <section
          style={{
            border: `1px solid ${backlogTone.border}`,
            borderRadius: theme.radius.md,
            padding: theme.spacing.md,
            borderLeft: `4px solid ${backlogTone.foreground}`,
            backgroundColor: backlogTone.surface,
            minWidth: 0,
          }}
        >
          {sectionHeader('Backlog', viewModel.sections.backlog.state, theme, 'collection')}
          <SectionError error={viewModel.sections.backlog.error ?? backlog?.error} theme={theme} />
          {backlog ? (
            <>
              <div
                data-layout="dashboard-facts"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: theme.spacing.xs,
                }}
              >
                <DashboardFact
                  label="返回条目"
                  value={backlog.summary.returnedItems}
                  theme={theme}
                />
                <DashboardFact
                  label="已知剩余集数"
                  value={backlog.summary.knownRemainingEpisodes}
                  theme={theme}
                />
                <DashboardFact label="可计算" value={backlog.summary.completeItems} theme={theme} />
                <DashboardFact
                  label="无法计算"
                  value={backlog.summary.notComputableItems}
                  theme={theme}
                />
                <DashboardFact
                  label="播完未看完"
                  value={backlog.summary.finishedIncompleteItems}
                  theme={theme}
                />
              </div>
              <div role="list" aria-label="Backlog 条目" style={{ minWidth: 0 }}>
                {backlog.items.length ? (
                  backlog.items.map((item) => (
                    <DashboardListRow
                      key={item.subjectId}
                      icon="episode"
                      title={boundedText(item.nameCn || item.name, 48)}
                      detail={
                        item.remainingEpisodes !== undefined
                          ? `剩余 ${item.remainingEpisodes} 集`
                          : item.state
                      }
                      theme={theme}
                    />
                  ))
                ) : (
                  <div style={{ color: theme.textMuted, fontSize: '11px' }}>
                    没有可展示的 backlog 条目；空结果不等同于 backlog 为空。
                  </div>
                )}
              </div>
              {omissionLine('Backlog：', viewModel.presentation.backlog, theme)}
              {evidenceLine(
                '',
                backlog.source.label,
                backlog.source.retrievedAt,
                backlog.evidence.operations.join(' · '),
                theme,
              )}
            </>
          ) : (
            <div style={{ color: theme.textMuted, fontSize: '11px' }}>未生成 backlog 结果。</div>
          )}
        </section>

        <section
          style={{
            border: `1px solid ${scheduleTone.border}`,
            borderRadius: theme.radius.md,
            padding: theme.spacing.md,
            borderLeft: `4px solid ${scheduleTone.foreground}`,
            backgroundColor: scheduleTone.surface,
            minWidth: 0,
          }}
        >
          {sectionHeader('七日播出计划', viewModel.sections.schedule.state, theme, 'calendar')}
          <SectionError
            error={viewModel.sections.schedule.error ?? schedule?.error}
            theme={theme}
          />
          {schedule ? (
            <>
              <div
                data-layout="dashboard-facts"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: theme.spacing.xs,
                }}
              >
                <DashboardFact
                  label="匹配播出"
                  value={schedule.summary.matchedRows}
                  theme={theme}
                />
                <DashboardFact
                  label="收藏未匹配"
                  value={schedule.summary.unmatchedCollectionRows}
                  theme={theme}
                />
                <DashboardFact
                  label="日历未匹配"
                  value={schedule.summary.unmatchedCalendarRows}
                  theme={theme}
                />
                <DashboardFact
                  label="进度未知 / 冲突"
                  value={
                    schedule.summary.progressUnknownRows + schedule.summary.progressConflictRows
                  }
                  theme={theme}
                />
              </div>
              <div role="list" aria-label="七日播出计划条目" style={{ minWidth: 0 }}>
                {schedule.items.length ? (
                  schedule.items.map((item) => (
                    <DashboardListRow
                      key={item.subjectId}
                      icon="calendar"
                      title={boundedText(item.nameCn || item.name, 48)}
                      detail={`${item.schedule.weekday.cn || item.schedule.weekday.en || '星期未知'}${item.schedule.airDate ? ` · ${item.schedule.airDate}` : ''}`}
                      theme={theme}
                    />
                  ))
                ) : (
                  <div style={{ color: theme.textMuted, fontSize: '11px' }}>
                    没有确认匹配的收藏播出条目；请结合覆盖和未匹配原因理解。
                  </div>
                )}
              </div>
              {omissionLine('播出计划：', viewModel.presentation.schedule, theme)}
              {evidenceLine(
                '日历',
                schedule.source.calendar.class,
                schedule.source.calendar.retrievedAt,
                schedule.evidence.operations[0] || schedule.source.calendar.operation,
                theme,
              )}
              {evidenceLine(
                '收藏',
                schedule.source.label,
                schedule.source.collection.retrievedAt,
                schedule.evidence.operations[1] || schedule.source.collection.operation,
                theme,
              )}
            </>
          ) : (
            <div style={{ color: theme.textMuted, fontSize: '11px' }}>未生成播出计划结果。</div>
          )}
        </section>
      </div>

      {warningMessages.length > 0 ? (
        <div style={{ color: theme.warning, fontSize: '10px', lineHeight: 1.5 }}>
          {warningMessages.join('；')}
          {viewModel.warnings.length > warningMessages.length
            ? `；另有 ${viewModel.warnings.length - warningMessages.length} 条告警`
            : ''}
        </div>
      ) : null}
      {limitationMessages.length > 0 ? (
        <div style={{ color: theme.textMuted, fontSize: '10px', lineHeight: 1.5 }}>
          限制：{limitationMessages.join('；')}
          {viewModel.limitations.length > limitationMessages.length
            ? `；另有 ${viewModel.limitations.length - limitationMessages.length} 条限制`
            : ''}
        </div>
      ) : null}
      <div style={{ color: theme.textMuted, fontSize: '10px', lineHeight: 1.5 }}>
        组合公式：
        {viewModel.evidence.find((item) => item.section === 'dashboard')?.formulaVersion ||
          '未生成'}{' '}
        · 收藏行上限 {viewModel.coverage.collectionRowsBound} · episode 行上限{' '}
        {viewModel.coverage.episodeRowsRequested} · 日历行上限{' '}
        {viewModel.coverage.calendarRowsRequested} · 输出行上限{' '}
        {viewModel.coverage.outputRowsRequested} · 检索时间{' '}
        {viewModel.coverage.retrievedAt || '未知'} · 区段超时 {viewModel.coverage.timedOutSections}{' '}
        · 截止跳过 {viewModel.coverage.deadlineSkippedSections}
      </div>
      <Footer theme={theme} />
    </CardFrame>
  );
};
