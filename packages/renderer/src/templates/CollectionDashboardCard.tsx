import React from 'react';
import { CardFrame } from '../components/CardFrame.js';
import { Footer } from '../components/Footer.js';
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

function sectionHeader(
  title: string,
  state: CollectionDashboardViewModel['state'],
  theme: ThemeTokens,
): React.ReactNode {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
      <span style={{ color: theme.accent, fontSize: '14px', fontWeight: 700 }}>{title}</span>
      <span style={{ color: theme.textMuted, fontSize: '10px', whiteSpace: 'nowrap' }}>
        {stateLabel(state)}
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
      />

      <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.5 }}>
        收藏概览、backlog
        和未来七日播出计划分别读取；日期不表示具体时刻或时区，未观察数据不会被补猜。
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            width && width >= 900 ? 'repeat(4, minmax(0, 1fr))' : 'repeat(2, 1fr)',
          gap: theme.spacing.sm,
        }}
      >
        {[
          [
            '区段成功',
            `${viewModel.coverage.sectionsSucceeded}/${viewModel.coverage.sectionsAttempted}`,
          ],
          [
            '收藏观察',
            `${viewModel.coverage.collectionRowsObserved}/${viewModel.coverage.collectionRowsBound}`,
          ],
          [
            'backlog 条目',
            `${viewModel.coverage.backlogSubjectsSucceeded}/${viewModel.coverage.backlogSubjectsRequested}`,
          ],
          ['日历观察', String(viewModel.coverage.calendarRowsObserved)],
        ].map(([label, value]) => (
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
            <div style={{ color: theme.text, fontSize: '16px', fontWeight: 700 }}>{value}</div>
          </div>
        ))}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: sectionGrid,
          gap: theme.spacing.md,
          alignItems: 'start',
        }}
      >
        <section
          style={{
            border: `1px solid ${theme.border}`,
            borderRadius: theme.radius.md,
            padding: theme.spacing.md,
            minWidth: 0,
          }}
        >
          {sectionHeader('收藏概览', viewModel.sections.intelligence.state, theme)}
          <SectionError error={viewModel.sections.intelligence.error} theme={theme} />
          {intelligence ? (
            <>
              <div style={{ color: theme.text, fontSize: '11px', lineHeight: 1.6 }}>
                backlog {intelligence.backlog.total}（想看 {intelligence.backlog.wish} · 搁置{' '}
                {intelligence.backlog.onHold} · 在看 {intelligence.backlog.doing}）
                <br />
                已评分 {intelligence.ratings.rated}
                {intelligence.ratings.average !== undefined
                  ? ` · 平均 ${intelligence.ratings.average}`
                  : ''}
                <br />
                标签 {intelligence.tags.distinct} · 已有进度{' '}
                {intelligence.progress.itemsWithProgress}
              </div>
              <div style={{ color: theme.textMuted, fontSize: '10px', lineHeight: 1.5 }}>
                高频标签：
                {intelligence.tags.top.length
                  ? intelligence.tags.top
                      .slice(0, 5)
                      .map((item) => `${boundedText(item.tag, 32)}(${item.count})`)
                      .join(' · ')
                  : '无可用标签证据'}
              </div>
            </>
          ) : (
            <div style={{ color: theme.textMuted, fontSize: '11px' }}>未生成收藏概览结果。</div>
          )}
        </section>

        <section
          style={{
            border: `1px solid ${theme.border}`,
            borderRadius: theme.radius.md,
            padding: theme.spacing.md,
            minWidth: 0,
          }}
        >
          {sectionHeader('Backlog', viewModel.sections.backlog.state, theme)}
          <SectionError error={viewModel.sections.backlog.error ?? backlog?.error} theme={theme} />
          {backlog ? (
            <>
              <div style={{ color: theme.text, fontSize: '11px', lineHeight: 1.6 }}>
                返回 {backlog.summary.returnedItems} · 已知剩余{' '}
                {backlog.summary.knownRemainingEpisodes} 集
                <br />
                可计算 {backlog.summary.completeItems} · 无法计算{' '}
                {backlog.summary.notComputableItems}
                <br />
                已播完未看完 {backlog.summary.finishedIncompleteItems}
              </div>
              <div style={{ color: theme.textMuted, fontSize: '10px', lineHeight: 1.5 }}>
                {backlog.items.length
                  ? backlog.items
                      .slice(0, 4)
                      .map(
                        (item) =>
                          `${boundedText(item.nameCn || item.name, 42)} · ${item.remainingEpisodes !== undefined ? `剩余 ${item.remainingEpisodes}` : item.state}`,
                      )
                      .join('\n')
                  : '没有可展示的 backlog 条目；空结果不等同于 backlog 为空。'}
              </div>
            </>
          ) : (
            <div style={{ color: theme.textMuted, fontSize: '11px' }}>未生成 backlog 结果。</div>
          )}
        </section>

        <section
          style={{
            border: `1px solid ${theme.border}`,
            borderRadius: theme.radius.md,
            padding: theme.spacing.md,
            minWidth: 0,
          }}
        >
          {sectionHeader('七日播出计划', viewModel.sections.schedule.state, theme)}
          <SectionError
            error={viewModel.sections.schedule.error ?? schedule?.error}
            theme={theme}
          />
          {schedule ? (
            <>
              <div style={{ color: theme.text, fontSize: '11px', lineHeight: 1.6 }}>
                匹配播出 {schedule.summary.matchedRows} · 收藏未匹配{' '}
                {schedule.summary.unmatchedCollectionRows}
                <br />
                日历未匹配 {schedule.summary.unmatchedCalendarRows} · 进度未知{' '}
                {schedule.summary.progressUnknownRows + schedule.summary.progressConflictRows}
              </div>
              <div style={{ color: theme.textMuted, fontSize: '10px', lineHeight: 1.5 }}>
                {schedule.items.length
                  ? schedule.items
                      .slice(0, 4)
                      .map(
                        (item) =>
                          `${boundedText(item.nameCn || item.name, 42)} · ${item.schedule.weekday.cn || item.schedule.weekday.en || '星期未知'}${item.schedule.airDate ? ` ${item.schedule.airDate}` : ''}`,
                      )
                      .join('\n')
                  : '没有确认匹配的收藏播出条目；请结合覆盖和未匹配原因理解。'}
              </div>
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
        {viewModel.coverage.retrievedAt || '未知'}
      </div>
      <Footer theme={theme} />
    </CardFrame>
  );
};
