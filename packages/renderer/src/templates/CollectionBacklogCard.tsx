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
  return '暂不可用';
}

function rowStateLabel(state: CollectionBacklogViewModel['items'][number]['state']): string {
  if (state === 'complete') return '可计算';
  if (state === 'partial') return '部分覆盖';
  if (state === 'conflict') return '来源冲突';
  if (state === 'not_computable') return '无法计算';
  return '不可用';
}

function progressLabel(item: CollectionBacklogViewModel['items'][number]): string {
  if (item.remainingEpisodes !== undefined) {
    return `剩余 ${item.remainingEpisodes} 集 · 已看 ${item.watchedEpisodes ?? 0}/${item.sourceReportedEpisodes ?? '?'}`;
  }
  return item.reasons[0] || rowStateLabel(item.state);
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
    ['可计算条目', String(viewModel.summary.completeItems)],
  ];

  return (
    <CardFrame theme={theme} width={width}>
      <TitleBlock
        title="我的收藏 backlog"
        subtitle={`当前账号 · 官方 v0 · ${stateLabel(viewModel.state)}`}
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

      {viewModel.state === 'unavailable' ? (
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
          官方收藏源暂时不可用，未生成猜测的 backlog 数据。
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

          <section>
            <div style={{ color: theme.accent, fontWeight: 700, fontSize: '14px' }}>
              收藏条目（源顺序）
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
                    {progressLabel(item)} · {rowStateLabel(item.state)}
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
        {viewModel.source.retrievedAt ? ` · ${viewModel.source.retrievedAt}` : ''}
      </div>
      <Footer theme={theme} />
    </CardFrame>
  );
};
