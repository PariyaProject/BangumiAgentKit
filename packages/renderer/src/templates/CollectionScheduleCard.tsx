import React from 'react';
import { CardFrame } from '../components/CardFrame.js';
import { Footer } from '../components/Footer.js';
import { TitleBlock } from '../components/TitleBlock.js';
import { CollectionScheduleViewModel } from '../view-models/index.js';
import { ThemeTokens } from '../themes/index.js';

export interface CollectionScheduleCardProps {
  viewModel: CollectionScheduleViewModel;
  theme: ThemeTokens;
  width?: number;
}

function stateLabel(state: CollectionScheduleViewModel['state']): string {
  if (state === 'complete') return '覆盖完整';
  if (state === 'partial') return '部分覆盖';
  if (state === 'auth_required') return '需要授权';
  if (state === 'permission_denied') return '无权限';
  if (state === 'rate_limited') return '请求受限';
  if (state === 'upstream_error') return '上游错误';
  return '暂不可用';
}

function progressStateLabel(
  state: CollectionScheduleViewModel['items'][number]['progress']['state'],
): string {
  if (state === 'reported') return '收藏进度';
  if (state === 'conflict') return '进度冲突';
  if (state === 'invalid') return '进度无效';
  return '进度未知';
}

function calendarReasonLabel(
  reason: CollectionScheduleViewModel['unmatchedCalendar'][number]['reason'],
): string {
  if (reason === 'not_collected') return '完整收藏扫描中未发现';
  if (reason === 'status_filtered') return '收藏状态被当前筛选排除';
  if (reason === 'invalid_collection_status') return '收藏状态源值无效';
  return '收藏扫描覆盖不完整';
}

function collectionReasonLabel(
  reason: CollectionScheduleViewModel['unmatchedCollection'][number]['reason'],
): string {
  return reason === 'not_on_calendar' ? '完整日历观察中未发现' : '日历覆盖不完整';
}

function boundedText(value: unknown, maximum = 180): string {
  const normalized = String(value ?? '')
    .replace(/\s+/gu, ' ')
    .trim();
  if (normalized.length <= maximum) return normalized;
  return `${Array.from(normalized)
    .slice(0, maximum - 1)
    .join('')}…`;
}

function progressLabel(item: CollectionScheduleViewModel['items'][number]): string {
  const progress = item.progress;
  if (progress.state === 'reported') {
    return `已看 ${progress.watchedEpisodes ?? 0}/${progress.reportedTotalEpisodes ?? '?'} · 收藏信封剩余 ${progress.reportedRemainingEpisodes ?? '?'} 集`;
  }
  return `${progressStateLabel(progress.state)} · ${boundedText(progress.reasons[0] || '没有足够的收藏进度证据', 140)}`;
}

function weekdayLabel(
  weekday: CollectionScheduleViewModel['items'][number]['schedule']['weekday'],
): string {
  return weekday.cn || weekday.en || weekday.ja || `星期 ${weekday.id}`;
}

export const CollectionScheduleCard: React.FC<CollectionScheduleCardProps> = ({
  viewModel,
  theme,
  width,
}) => {
  const statusText = viewModel.filters.statuses.join('、');
  const summary = [
    ['匹配播出', String(viewModel.summary.matchedRows)],
    ['符合收藏状态', String(viewModel.summary.eligibleCollectionRows)],
    ['未匹配日历', String(viewModel.summary.unmatchedCollectionRows)],
    ['日历未匹配', String(viewModel.summary.unmatchedCalendarRows)],
  ];
  const calendarReasonCounts = viewModel.unmatchedCalendar.reduce<Record<string, number>>(
    (counts, item) => {
      counts[item.reason] = (counts[item.reason] || 0) + 1;
      return counts;
    },
    {},
  );
  const hasItems = viewModel.items.length > 0 && viewModel.state !== 'unavailable';

  return (
    <CardFrame theme={theme} width={width}>
      <TitleBlock
        title="我的本周播出计划"
        subtitle={`当前账号 · 官方日历 + v0 收藏 · ${stateLabel(viewModel.state)}`}
        theme={theme}
      />

      <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.5 }}>
        默认状态：{statusText || '未指定'}。按 subject ID
        对齐；官方日历只提供星期和日期，不提供时区或具体播出时刻。
      </div>

      {viewModel.error ? (
        <div
          style={{
            color: theme.warning,
            backgroundColor: theme.surfaceAlt,
            border: `1px solid ${theme.border}`,
            borderRadius: theme.radius.md,
            padding: theme.spacing.md,
            fontSize: '12px',
            lineHeight: 1.5,
          }}
        >
          {viewModel.error.message} {viewModel.error.nextAction || ''}
          <div style={{ marginTop: '3px', fontSize: '10px' }}>错误代码：{viewModel.error.code}</div>
        </div>
      ) : null}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: width && width >= 900 ? 'repeat(4, 1fr)' : 'repeat(2, 1fr)',
          gap: theme.spacing.sm,
        }}
      >
        {summary.map(([label, value]) => (
          <div
            key={label}
            style={{
              backgroundColor: theme.surfaceAlt,
              border: `1px solid ${theme.border}`,
              borderRadius: theme.radius.sm,
              padding: theme.spacing.sm,
              minWidth: 0,
            }}
          >
            <div style={{ color: theme.textMuted, fontSize: '10px' }}>{label}</div>
            <div
              style={{
                color: theme.text,
                fontSize: '17px',
                fontWeight: 700,
                overflowWrap: 'anywhere',
              }}
            >
              {value}
            </div>
          </div>
        ))}
      </div>

      {viewModel.unmatchedCalendar.length > 0 ? (
        <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.5 }}>
          展示的日历未匹配原因：
          {Object.entries(calendarReasonCounts)
            .map(
              ([reason, count]) =>
                `${calendarReasonLabel(reason as CollectionScheduleViewModel['unmatchedCalendar'][number]['reason'])} ${count}`,
            )
            .join(' · ')}
        </div>
      ) : null}

      {hasItems ? (
        <section>
          <div style={{ color: theme.accent, fontWeight: 700, fontSize: '14px' }}>
            本周匹配条目（官方日历源顺序）
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', marginTop: '6px' }}>
            {viewModel.items.map((item) => (
              <div
                key={`${item.subjectId}-${item.schedule.sourceIndex}`}
                style={{
                  borderBottom: `1px solid ${theme.border}`,
                  paddingBottom: '6px',
                  color: theme.text,
                  fontSize: '11px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                  <span style={{ minWidth: 0, overflowWrap: 'anywhere', fontWeight: 600 }}>
                    {item.nameCn || item.name}
                  </span>
                  <span style={{ color: theme.textMuted, whiteSpace: 'nowrap' }}>
                    {item.statusLabel || item.status}
                  </span>
                </div>
                <div style={{ color: theme.accent, lineHeight: 1.5, marginTop: '2px' }}>
                  {weekdayLabel(item.schedule.weekday)}
                  {item.schedule.airDate ? ` · ${item.schedule.airDate}` : ' · 日期未知'}
                </div>
                <div style={{ color: theme.textMuted, lineHeight: 1.5 }}>
                  {progressLabel(item)}
                  {item.reasons.length > 0 ? ` · ${boundedText(item.reasons[0], 140)}` : ''}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <div style={{ color: theme.textMuted, fontSize: '12px', lineHeight: 1.5 }}>
          没有返回匹配的收藏播出条目；请结合未匹配计数和覆盖状态理解，不把空结果当作“本周没有播出”。
        </div>
      )}

      {viewModel.unmatchedCollection.length > 0 ? (
        <section>
          <div style={{ color: theme.accent, fontWeight: 700, fontSize: '13px' }}>
            收藏中未能与本周日历确认匹配的条目
          </div>
          <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.5 }}>
            完整日历观察未发现或日历覆盖不完整时，均不证明条目已下档或收藏失效。
          </div>
          {viewModel.unmatchedCollection.map((item) => (
            <div
              key={item.subjectId}
              style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.5 }}
            >
              · {item.nameCn || item.name} · {item.statusLabel || item.status} ·{' '}
              {collectionReasonLabel(item.reason)} · {progressStateLabel(item.progress.state)}
            </div>
          ))}
        </section>
      ) : null}

      {viewModel.unmatchedCalendar.length > 0 ? (
        <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.5 }}>
          官方日历另有 {viewModel.summary.unmatchedCalendarRows}{' '}
          条未匹配播出条目；具体是状态筛选、覆盖不完整还是完整收藏扫描未发现，见原因说明。
        </div>
      ) : null}

      {viewModel.coverage.omittedRows > 0 ? (
        <div style={{ color: theme.warning, fontSize: '11px', lineHeight: 1.5 }}>
          展示省略 {viewModel.coverage.omittedRows} 条已返回行；源覆盖状态不变。
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
      <div style={{ color: theme.textMuted, fontSize: '10px', lineHeight: 1.5 }}>
        进度来源：收藏接口 ep_status / subject.eps；公式：
        {viewModel.evidence.formulaVersion || '未生成'} · 覆盖：
        {viewModel.coverage.join.returnedRows}/{viewModel.coverage.join.maxRows}
        {viewModel.evidence.retrievedAt ? ` · ${viewModel.evidence.retrievedAt}` : ''}
      </div>
      <Footer theme={theme} />
    </CardFrame>
  );
};
