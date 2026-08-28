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
  if (state === 'complete') return '覆盖完整';
  if (state === 'partial') return '部分覆盖';
  if (state === 'conflict') return '来源冲突';
  if (state === 'not_computable') return '无法计算';
  if (state === 'auth_required') return '需要授权';
  if (state === 'permission_denied') return '无权限';
  if (state === 'rate_limited') return '请求受限';
  if (state === 'upstream_error') return '上游错误';
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
    return `${boundedText(item.error.code, 64)} · ${boundedText(item.error.message)}${item.error.nextAction ? ` · ${boundedText(item.error.nextAction)}` : ''}`;
  }
  return item.reasons[0] || rowStateLabel(item.state);
}

function airingLabel(state: CollectionBacklogViewModel['items'][number]['airingState']): string {
  if (state === 'finished') return '已播完（日期证据；未证明后续/hiatus）';
  if (state === 'ongoing') return '可能在播（未来日期证据）';
  return '播出状态未知';
}

function sortLabel(sortBy: CollectionBacklogViewModel['sortBy']): string {
  if (sortBy === 'estimated_minutes_asc') return '预计分钟数升序';
  if (sortBy === 'estimated_minutes_desc') return '预计分钟数降序';
  return '源顺序';
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

export const CollectionBacklogCard: React.FC<CollectionBacklogCardProps> = ({
  viewModel,
  theme,
  width,
}) => {
  const hasItems = viewModel.items.length > 0 && viewModel.state !== 'unavailable';
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
  ];

  return (
    <CardFrame theme={theme} width={width}>
      <TitleBlock
        title="我的收藏 backlog"
        subtitle={`当前账号 · 官方 v0 · ${stateLabel(viewModel.state)} · 排序：${sortLabel(viewModel.sortBy)}`}
        theme={theme}
      />

      <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.5 }}>
        只读取当前账号的动画收藏与正篇 episode collection；不显示评论或写入任何进度。
      </div>

      {viewModel.coverage.hydration.budgetExceeded || viewModel.coverage.collection.truncated ? (
        <div style={{ color: theme.warning, fontSize: '11px', lineHeight: 1.5 }}>
          这是有界样本：收藏扫描或条目 hydration 达到安全上限，未观察部分没有被猜测补全。
        </div>
      ) : null}

      {viewModel.state !== 'complete' &&
      viewModel.state !== 'partial' &&
      viewModel.state !== 'conflict' &&
      viewModel.state !== 'not_computable' ? (
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
          {viewModel.error?.message || '官方收藏源暂时不可用，未生成猜测的 backlog 数据。'}
          {viewModel.error?.nextAction ? ` ${viewModel.error.nextAction}` : ''}
        </div>
      ) : null}

      {viewModel.error ? (
        <div style={{ color: theme.warning, fontSize: '11px', lineHeight: 1.5 }}>
          错误代码：{viewModel.error.code}
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
            * “已播完”仅表示当前报告的正篇 airdate 均已过去，不能证明未发布后续或排除 hiatus。
          </div>

          <section>
            <div style={{ color: theme.accent, fontWeight: 700, fontSize: '14px' }}>
              收藏条目（{sortLabel(viewModel.sortBy)}）
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
                    {progressLabel(item)} · {durationLabel(item)} · {airingLabel(item.airingState)}{' '}
                    · {rowStateLabel(item.state)}
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
      {viewModel.warnings.length > 0 ? (
        <div style={{ color: theme.warning, fontSize: '11px', lineHeight: 1.5 }}>
          {viewModel.warnings.map((warning) => warning.message).join('；')}
        </div>
      ) : null}
      {viewModel.limitations.length > 0 ? (
        <div style={{ color: theme.textMuted, fontSize: '10px', lineHeight: 1.5 }}>
          限制：{viewModel.limitations.join('；')}
        </div>
      ) : null}
      <div style={{ color: theme.textMuted, fontSize: '10px', lineHeight: 1.4 }}>
        公式：{viewModel.evidence.formulaVersion || '未生成'} · 账号范围：
        {viewModel.evidence.authScope}
        {viewModel.evidence.durationFormulaVersion
          ? ` · 时长公式：${viewModel.evidence.durationFormulaVersion}`
          : ''}
        {viewModel.source.retrievedAt ? ` · ${viewModel.source.retrievedAt}` : ''}
      </div>
      <Footer theme={theme} />
    </CardFrame>
  );
};
