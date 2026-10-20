import React from 'react';
import { CardFrame } from '../components/CardFrame.js';
import { Footer } from '../components/Footer.js';
import { TitleBlock } from '../components/TitleBlock.js';
import { CollectionBacklogViewModel } from '../view-models/index.js';
import { ThemeTokens } from '../themes/index.js';

export interface CollectionBacklogCardProps {
  viewModel: CollectionBacklogViewModel;
  theme: ThemeTokens;
  width?: number;
}

function stateLabel(state: CollectionBacklogViewModel['state']): string {
  if (state === 'complete') return '来源覆盖完整';
  if (state === 'partial') return '部分覆盖';
  if (state === 'conflict') return '数据不一致';
  if (state === 'not_computable') return '暂不能计算';
  if (state === 'auth_required') return '需要授权';
  if (state === 'permission_denied') return '收藏读取权限不足';
  if (state === 'rate_limited') return '请求受限';
  if (state === 'upstream_error') return '数据源暂不可用';
  return '暂不可用';
}

function rowStateLabel(state: CollectionBacklogViewModel['items'][number]['state']): string {
  if (state === 'complete') return '可计算';
  if (state === 'partial') return '部分覆盖';
  if (state === 'conflict') return '来源冲突';
  if (state === 'not_computable') return '无法计算';
  return '不可用';
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

function progressLabel(item: CollectionBacklogViewModel['items'][number]): string {
  if (item.remainingEpisodes !== undefined) {
    return `剩余 ${item.remainingEpisodes} 集 · 已看 ${item.watchedEpisodes ?? 0}/${item.episodeReportedEpisodes ?? '?'}`;
  }
  if (item.error) {
    const message = boundedText(item.error.message);
    const nextAction = item.error.nextAction ? boundedText(item.error.nextAction) : '';
    return nextAction && !message.includes(nextAction) ? `${message} · ${nextAction}` : message;
  }
  return item.reasons[0] || rowStateLabel(item.state);
}

function airingLabel(state: CollectionBacklogViewModel['items'][number]['airingState']): string {
  if (state === 'finished') return '正篇日期已过（作品是否完结未知）';
  if (state === 'ongoing') return '正篇尚有未来日期';
  return '播出状态未知';
}

function sortLabel(sortBy: CollectionBacklogViewModel['sortBy']): string {
  if (sortBy === 'estimated_minutes_asc') return '预计时长从短到长';
  if (sortBy === 'estimated_minutes_desc') return '预计时长从长到短';
  return '收藏顺序';
}

function durationLabel(item: CollectionBacklogViewModel['items'][number]): string {
  if (item.durationState === 'not_applicable') return '待看时长 0 分';
  const estimate =
    item.estimatedRemainingMinutes === undefined
      ? '预计分钟数未知'
      : `已知约 ${item.estimatedRemainingMinutes} 分`;
  const coverage = `时长 ${item.knownDurationEpisodes}/${item.plannedEpisodes} 集`;
  return item.unknownDurationEpisodes > 0
    ? `${estimate} · ${coverage} · 未解析 ${item.unknownDurationEpisodes} 集`
    : `${estimate} · ${coverage}`;
}

function scheduleLabel(item: CollectionBacklogViewModel['items'][number]): string {
  if (item.schedule.state === 'matched') {
    const weekday =
      item.schedule.weekday?.cn ||
      item.schedule.weekday?.en ||
      item.schedule.weekday?.ja ||
      '星期未知';
    return `计划 ${weekday}${item.schedule.airDate ? ` · ${item.schedule.airDate}` : ''}`;
  }
  if (item.schedule.state === 'not_observed') return '七日计划未见匹配';
  return '计划未知';
}

function confidenceLabel(item: CollectionBacklogViewModel['items'][number]): string {
  const labels = { high: '高', medium: '中', low: '低', unknown: '未知' } as const;
  return `证据完整度 ${labels[item.confidence.level]}`;
}

export const CollectionBacklogCard: React.FC<CollectionBacklogCardProps> = ({
  viewModel,
  theme,
  width,
}) => {
  const hasItems = viewModel.items.length > 0 && viewModel.state !== 'unavailable';
  const scheduleCoverage = viewModel.coverage.schedule;
  const presentation = viewModel.presentation;
  const warningMessages =
    presentation?.warningMessages ?? viewModel.warnings.map((warning) => warning.message);
  const summary = [
    ['符合状态', String(viewModel.summary.eligibleItems)],
    ['已返回', String(viewModel.summary.returnedItems)],
    ['已知剩余', `${viewModel.summary.knownRemainingEpisodes} 集`],
    [
      '已知待看时长',
      viewModel.summary.knownEstimatedRemainingMinutes === undefined
        ? '未知'
        : `${viewModel.summary.knownEstimatedRemainingMinutes} 分`,
    ],
    ['已播完未看完*', String(viewModel.summary.finishedIncompleteItems)],
    ['可计算条目', String(viewModel.summary.completeItems)],
    ['计划已匹配', String(viewModel.summary.scheduleMatchedItems ?? 0)],
    ['完整度高', String(viewModel.summary.confidenceHighItems ?? 0)],
  ];

  return (
    <CardFrame theme={theme} width={width}>
      <TitleBlock
        title="我的收藏待看清单"
        subtitle={`当前账号 · 官方 v0 · ${stateLabel(viewModel.state)} · 排序：${sortLabel(viewModel.sortBy)}`}
        theme={theme}
        icon="collection"
      />

      <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.5 }}>
        只读取当前账号的动画收藏与正篇进度；不展示评论，也不写入进度。
      </div>
      <div style={{ color: theme.textMuted, fontSize: '10px', lineHeight: 1.5 }}>
        来源：{presentation?.sourceSummary || 'Bangumi v0 收藏'} · 七日计划：
        {presentation?.scheduleSummary ||
          `覆盖 ${scheduleCoverage.sourceDayCount}/7 天 · 匹配 ${scheduleCoverage.matchedItems} 项`}
      </div>

      {!presentation?.emptyState &&
      (viewModel.coverage.hydration.budgetExceeded || viewModel.coverage.collection.truncated) ? (
        <div style={{ color: theme.warning, fontSize: '11px', lineHeight: 1.5 }}>
          这是有界样本：收藏扫描或进度读取达到安全上限，未读取部分不作推测。
        </div>
      ) : null}

      {viewModel.state !== 'complete' &&
      viewModel.state !== 'partial' &&
      viewModel.state !== 'conflict' &&
      viewModel.state !== 'not_computable' ? (
        <div
          data-render-mask="panel"
          style={{
            color: theme.warning,
            backgroundColor: theme.surfaceAlt,
            border: `1px solid ${theme.border}`,
            borderRadius: theme.radius.md,
            padding: theme.spacing.md,
            fontSize: '12px',
            lineHeight: 1.5,
            clipPath: theme.design.masks.panel,
          }}
        >
          {presentation?.errorMessage ||
            viewModel.error?.message ||
            '暂时无法读取收藏数据，未生成猜测的 backlog。'}
          {presentation?.errorNextAction || viewModel.error?.nextAction
            ? ` ${presentation?.errorNextAction || viewModel.error?.nextAction}`
            : ''}
        </div>
      ) : null}

      {!hasItems && presentation?.emptyState ? (
        <div
          data-render-mask="panel-alt"
          style={{
            color: theme.text,
            backgroundColor: theme.surfaceAlt,
            border: `1px solid ${theme.border}`,
            borderRadius: theme.radius.md,
            padding: theme.spacing.md,
            clipPath: theme.design.masks.panelAlt,
          }}
        >
          <div style={{ fontWeight: 700, fontSize: '13px' }}>{presentation.emptyState.title}</div>
          <div
            style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.5, marginTop: '3px' }}
          >
            {presentation.emptyState.detail}
          </div>
          <div style={{ color: theme.accent, fontSize: '11px', lineHeight: 1.5, marginTop: '3px' }}>
            下一步：{presentation.emptyState.nextAction}
          </div>
        </div>
      ) : null}

      {hasItems ? (
        <>
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
          <div style={{ color: theme.textMuted, fontSize: '10px', lineHeight: 1.4 }}>
            * 日期证据只说明当前报告的正篇播出日期均已过去，不代表作品已完结。
          </div>

          <section>
            <div style={{ color: theme.accent, fontWeight: 700, fontSize: '14px' }}>
              待看条目（{sortLabel(viewModel.sortBy)}）
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', marginTop: '6px' }}>
              {viewModel.items.map((item) => (
                <div
                  key={item.subjectId}
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
                  <div style={{ color: theme.textMuted, lineHeight: 1.5, marginTop: '2px' }}>
                    {progressLabel(item)} · {durationLabel(item)} · {scheduleLabel(item)} ·{' '}
                    {confidenceLabel(item)} · {airingLabel(item.airingState)} ·{' '}
                    {rowStateLabel(item.state)}
                    {item.airingState === 'unknown' && item.airingReason
                      ? ` · ${boundedText(item.airingReason)}`
                      : ''}
                    {item.completionPercentage !== undefined
                      ? ` · ${item.completionPercentage.toFixed(1)}%`
                      : ''}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      ) : null}

      {viewModel.coverage.omittedItems > 0 ? (
        <div style={{ color: theme.warning, fontSize: '11px', lineHeight: 1.5 }}>
          展示省略 {viewModel.coverage.omittedItems} 条已返回条目（源覆盖状态不变）。
        </div>
      ) : null}
      {warningMessages.length > 0 ? (
        <div style={{ color: theme.warning, fontSize: '11px', lineHeight: 1.5 }}>
          {warningMessages.join('；')}
        </div>
      ) : null}
      {(presentation?.limitationSummary.length ?? viewModel.limitations.length) > 0 ? (
        <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.5 }}>
          <div>计算口径：</div>
          {(presentation?.limitationSummary ?? viewModel.limitations).map((limitation) => (
            <div key={limitation}>· {limitation}</div>
          ))}
        </div>
      ) : null}
      <div style={{ color: theme.textMuted, fontSize: '10px', lineHeight: 1.4 }}>
        公式版本：
        {presentation?.formulaSummary.join(' · ') ||
          viewModel.evidence.formulaVersion ||
          '未生成'}{' '}
        · 范围：当前账号
        {presentation?.retrievedAtLabel || viewModel.source.retrievedAt
          ? ` · 取数时间：${presentation?.retrievedAtLabel || viewModel.source.retrievedAt}`
          : ''}
      </div>
      <Footer theme={theme} />
    </CardFrame>
  );
};
