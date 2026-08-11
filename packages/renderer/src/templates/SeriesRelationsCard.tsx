import React from 'react';
import { CardFrame } from '../components/CardFrame.js';
import { Footer } from '../components/Footer.js';
import { TitleBlock } from '../components/TitleBlock.js';
import { ThemeTokens } from '../themes/index.js';
import { SeriesRelationsViewModel } from '../view-models/index.js';

export interface SeriesRelationsCardProps {
  viewModel: SeriesRelationsViewModel;
  theme: ThemeTokens;
  resolvedImages?: Record<string, string>;
  width?: number;
}

const TYPE_LABELS: Record<string, string> = {
  anime: '动画',
  book: '书籍',
  music: '音乐',
  game: '游戏',
  real: '真人',
  other: '其他',
};

const EXCLUSION_LABELS: Record<string, string> = {
  media_type_not_anime: '非动画媒介',
  relation_not_watch_step: '关系不是观看步骤',
  node_cap: '节点上限',
  depth_evidence_only: '深度关系证据',
};

function displayName(item: { id?: number; name: string; nameCn?: string }): string {
  return item.nameCn || item.name || (item.id ? `条目 ${item.id}` : '未知条目');
}

function stateLabel(viewModel: SeriesRelationsViewModel): string {
  if (viewModel.capabilityStates.watchOrder === 'not_computable') return '无法计算';
  return viewModel.state === 'partial' ? '部分覆盖' : '有界建议';
}

export const SeriesRelationsCard: React.FC<SeriesRelationsCardProps> = ({
  viewModel,
  theme,
  resolvedImages = {},
  width,
}) => {
  const rootImage = viewModel.root.image
    ? resolvedImages[viewModel.root.image] || viewModel.root.image
    : undefined;
  const isWide = Boolean(width && width >= 900);
  const warningState = viewModel.capabilityStates.watchOrder === 'not_computable';

  return (
    <CardFrame theme={theme} width={width}>
      <TitleBlock
        title="系列关系与观看建议"
        subtitle={`${displayName(viewModel.root)} · ${stateLabel(viewModel)}`}
        theme={theme}
      />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: theme.spacing.sm,
          color: theme.textMuted,
          fontSize: '11px',
          lineHeight: 1.45,
        }}
      >
        {rootImage ? (
          <img
            src={rootImage}
            alt={displayName(viewModel.root)}
            style={{ width: '28px', height: '40px', objectFit: 'cover', borderRadius: '3px' }}
          />
        ) : null}
        <div style={{ minWidth: 0, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
          起点 #{viewModel.root.id} · {TYPE_LABELS[viewModel.root.type] || '类型未知'}
          {viewModel.root.date ? ` · ${viewModel.root.date}` : ' · 日期未知'}
          <div style={{ color: theme.text, fontSize: '13px', fontWeight: 600 }}>
            {viewModel.root.nameCn || viewModel.root.name}
          </div>
        </div>
      </div>

      <div
        style={{
          color: theme.textMuted,
          fontSize: '11px',
          lineHeight: 1.5,
          backgroundColor: theme.surfaceAlt,
          border: `1px solid ${theme.border}`,
          borderRadius: theme.radius.md,
          padding: theme.spacing.sm,
        }}
      >
        覆盖：关系行 {viewModel.coverage.relationRowsObserved} · 关联节点{' '}
        {viewModel.coverage.uniqueRelatedReturned}/{viewModel.coverage.uniqueRelatedObserved} · 详情{' '}
        {viewModel.coverage.detailsFetched}
        {viewModel.coverage.detailsFailed > 0
          ? `（失败 ${viewModel.coverage.detailsFailed}）`
          : ''}{' '}
        · 深度 {viewModel.coverage.depth} · 媒介{' '}
        {viewModel.coverage.media === 'anime' ? '动画优先' : '全部'}
        {viewModel.coverage.truncated ? ' · 有界截断' : ''}
      </div>

      {warningState ? (
        <div
          style={{
            color: theme.warning,
            backgroundColor: theme.surfaceAlt,
            border: `1px solid ${theme.warning}`,
            borderRadius: theme.radius.md,
            padding: theme.spacing.md,
            fontSize: '12px',
            lineHeight: 1.5,
          }}
        >
          当前覆盖不足以计算观看步骤；请把下方关系证据当作原始关联，而不是观看顺序。
        </div>
      ) : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
        <div style={{ color: theme.accent, fontSize: '14px', fontWeight: 700 }}>
          有界观看建议{' '}
          {viewModel.watchOrder.length > 0 ? `· ${viewModel.watchOrder.length} 步` : ''}
        </div>
        {viewModel.watchOrder.length === 0 ? (
          <div
            style={{
              color: theme.textMuted,
              backgroundColor: theme.surfaceAlt,
              border: `1px dashed ${theme.border}`,
              borderRadius: theme.radius.md,
              padding: theme.spacing.md,
              fontSize: '12px',
            }}
          >
            没有可展示的观看步骤。
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.xs }}>
            {viewModel.watchOrder.map((item) => {
              const image = item.image ? resolvedImages[item.image] || item.image : undefined;
              return (
                <div
                  key={`${item.position}-${item.id}`}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: theme.spacing.sm,
                    padding: theme.spacing.sm,
                    backgroundColor: item.isRoot ? theme.surfaceAlt : theme.surface,
                    border: `1px solid ${item.isRoot ? theme.accent : theme.border}`,
                    borderRadius: theme.radius.md,
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      flex: '0 0 26px',
                      height: '26px',
                      borderRadius: '50%',
                      backgroundColor: item.isRoot ? theme.accent : theme.surfaceAlt,
                      color: item.isRoot ? theme.background : theme.accent,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: 700,
                    }}
                  >
                    {item.position}
                  </div>
                  {image ? (
                    <img
                      src={image}
                      alt={displayName(item)}
                      style={{
                        width: '28px',
                        height: '40px',
                        objectFit: 'cover',
                        borderRadius: '3px',
                      }}
                    />
                  ) : null}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        color: theme.text,
                        fontWeight: 600,
                        fontSize: '13px',
                        overflowWrap: 'anywhere',
                        wordBreak: 'break-word',
                      }}
                    >
                      {displayName(item)}
                    </div>
                    {item.nameCn && item.nameCn !== item.name ? (
                      <div
                        style={{
                          color: theme.textMuted,
                          fontSize: '10px',
                          overflowWrap: 'anywhere',
                          wordBreak: 'break-word',
                        }}
                      >
                        原名：{item.name}
                      </div>
                    ) : null}
                    <div
                      style={{
                        color: theme.textMuted,
                        fontSize: '10px',
                        lineHeight: 1.4,
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '4px 8px',
                        overflowWrap: 'anywhere',
                        wordBreak: 'break-word',
                      }}
                    >
                      <span>
                        {item.isRoot ? '起点' : item.relationLabels.join(' / ') || '关联条目'}
                      </span>
                      <span>{TYPE_LABELS[item.type] || '类型未知'}</span>
                      <span>{item.date ? `日期 ${item.date}` : '日期未知'}</span>
                    </div>
                    <div style={{ color: theme.textMuted, fontSize: '10px', lineHeight: 1.35 }}>
                      {item.placementReason}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {viewModel.related.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.xs }}>
          <div style={{ color: theme.accent, fontSize: '14px', fontWeight: 700 }}>
            关联证据 · {viewModel.related.length} 项
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: theme.spacing.xs,
              color: theme.textMuted,
              fontSize: '10px',
              lineHeight: 1.45,
            }}
          >
            {viewModel.related.slice(0, isWide ? 16 : 8).map((item) => (
              <div
                key={`${item.id}-${item.depth}`}
                style={{
                  padding: theme.spacing.xs,
                  backgroundColor: theme.surfaceAlt,
                  borderRadius: theme.radius.sm,
                  overflowWrap: 'anywhere',
                  wordBreak: 'break-word',
                }}
              >
                <span style={{ color: theme.text, fontWeight: 600 }}>{displayName(item)}</span> ·{' '}
                {TYPE_LABELS[item.type] || '类型未知'} · 深度 {item.depth} · 关系{' '}
                {item.relationLabels.join(' / ') || '未提供'} ·{' '}
                {item.includedInWatchOrder
                  ? '已进入观看建议'
                  : EXCLUSION_LABELS[item.exclusionReason || ''] ||
                    item.exclusionReason ||
                    '未纳入'}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {viewModel.excluded.count > 0 ? (
        <div
          style={{
            display: 'flex',
            flexDirection: isWide ? 'row' : 'column',
            gap: theme.spacing.sm,
            alignItems: isWide ? 'flex-start' : undefined,
          }}
        >
          <div style={{ flex: 1, color: theme.textMuted, fontSize: '11px', lineHeight: 1.5 }}>
            排除 {viewModel.excluded.count} 项：
            {viewModel.excluded.byReason
              .map((item) => `${EXCLUSION_LABELS[item.reason] || item.reason} ${item.count}`)
              .join('、')}
          </div>
          {viewModel.excluded.samples.length > 0 ? (
            <div
              style={{
                flex: 1,
                color: theme.textMuted,
                fontSize: '10px',
                lineHeight: 1.45,
                overflowWrap: 'anywhere',
                wordBreak: 'break-word',
              }}
            >
              示例：
              {viewModel.excluded.samples
                .slice(0, isWide ? 4 : 3)
                .map(
                  (item) =>
                    `${displayName(item)}（${item.relationLabels?.join(' / ') || '未提供'} · ${
                      EXCLUSION_LABELS[item.reason] || item.reason
                    }）`,
                )
                .join('、')}
            </div>
          ) : null}
        </div>
      ) : null}

      {viewModel.warnings.length > 0 ? (
        <div style={{ color: theme.warning, fontSize: '11px', lineHeight: 1.5 }}>
          {viewModel.warnings
            .slice(0, 4)
            .map((warning) => warning.message)
            .join('；')}
        </div>
      ) : null}

      <div style={{ color: theme.textMuted, fontSize: '10px', lineHeight: 1.5 }}>
        来源：{viewModel.evidence.label} · 推导 {viewModel.evidence.derivation}
        {viewModel.evidence.retrievedAt ? ` · 获取于 ${viewModel.evidence.retrievedAt}` : ''}
      </div>
      {viewModel.limitations.length > 0 ? (
        <div style={{ color: theme.textMuted, fontSize: '10px', lineHeight: 1.5 }}>
          限制：{viewModel.limitations[0]}
        </div>
      ) : null}

      <Footer theme={theme} />
    </CardFrame>
  );
};
