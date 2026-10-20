import React from 'react';
import { CardFrame } from '../components/CardFrame.js';
import { RendererIcon } from '../components/RendererIcon.js';
import { TitleBlock } from '../components/TitleBlock.js';
import { Footer } from '../components/Footer.js';
import { ThemeTokens } from '../themes/index.js';
import { RevisionTimelineViewModel } from '../view-models/index.js';

export interface RevisionTimelineCardProps {
  viewModel: RevisionTimelineViewModel;
  theme: ThemeTokens;
  width?: number;
}

const ENTITY_LABELS: Record<RevisionTimelineViewModel['entityType'], string> = {
  subject: '条目',
  episode: '章节',
  character: '角色',
  person: '人物',
};

export const RevisionTimelineCard: React.FC<RevisionTimelineCardProps> = ({
  viewModel,
  theme,
  width,
}) => {
  const renderWidth = width ?? 960;
  const timelineLimit = renderWidth < 520 ? 4 : renderWidth < 900 ? 6 : 10;
  const summaryLimit = renderWidth < 520 ? 160 : 300;
  const items = viewModel.items.slice(0, timelineLimit);
  const stateLabel =
    viewModel.state === 'complete'
      ? '覆盖完整'
      : viewModel.state === 'partial'
        ? '部分覆盖'
        : '不可用';
  return (
    <CardFrame theme={theme} width={width}>
      <TitleBlock
        title="Bangumi 修订历史"
        subtitle={`${ENTITY_LABELS[viewModel.entityType]} ${viewModel.entityId} · ${stateLabel}`}
        theme={theme}
        icon="history"
      />

      <div
        data-layout="timeline-coverage"
        style={{
          color: theme.textMuted,
          fontSize: '12px',
          lineHeight: 1.5,
          backgroundColor: theme.surfaceAlt,
          borderRadius: theme.radius.md,
          padding: theme.spacing.sm,
        }}
      >
        观察 {viewModel.coverage.observed} 条 · 返回 {viewModel.coverage.returned} 条 · 图片显示{' '}
        {items.length} 条 ·
        {` 总数 ${viewModel.coverage.totalKind === 'exact' ? viewModel.coverage.total : '未知'}`}
        {viewModel.coverage.truncated ? ' · 有界样本' : ''}
      </div>

      {viewModel.state === 'unavailable' || viewModel.items.length === 0 ? (
        <div
          style={{
            color: theme.warning,
            backgroundColor: theme.surfaceAlt,
            border: `1px solid ${theme.border}`,
            borderRadius: theme.radius.md,
            padding: theme.spacing.md,
            fontSize: '12px',
          }}
        >
          {viewModel.state === 'unavailable'
            ? '官方修订源暂时不可用，未生成变更历史样本。'
            : '本次官方分页没有可展示的修订记录。'}
        </div>
      ) : null}

      <div
        data-layout="timeline-rail"
        role="list"
        aria-label="Bangumi 修订记录时间线"
        style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}
      >
        {items.map((item, index) => {
          const summary = item.summary || '修订摘要未知';
          const summaryCharacters = Array.from(summary);
          const summaryExcerpt = summaryCharacters.slice(0, summaryLimit).join('');
          const summaryTruncated = summaryCharacters.length > summaryLimit;
          return (
            <div
              key={item.id}
              role="listitem"
              style={{
                display: 'grid',
                gridTemplateColumns: '28px minmax(0, 1fr)',
                gap: theme.spacing.sm,
                minWidth: 0,
              }}
            >
              <div
                aria-hidden="true"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  minHeight: '100%',
                }}
              >
                <RendererIcon name="history" theme={theme} size={16} badge />
                {index < items.length - 1 ? (
                  <div
                    style={{
                      flex: 1,
                      width: '2px',
                      minHeight: theme.spacing.md,
                      backgroundColor: theme.border,
                    }}
                  />
                ) : null}
              </div>
              <article
                style={{
                  minWidth: 0,
                  backgroundColor: theme.surfaceAlt,
                  border: `1px solid ${theme.border}`,
                  borderRadius: theme.radius.md,
                  padding: theme.spacing.md,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: theme.spacing.xs,
                }}
              >
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing.xs }}>
                  <span
                    style={{
                      color: theme.accent,
                      backgroundColor: theme.surface,
                      borderRadius: '999px',
                      padding: '3px 8px',
                      fontSize: '11px',
                      fontWeight: 700,
                    }}
                  >
                    {item.createdAt ? item.createdAt : '创建时间未知'}
                  </span>
                  <span style={{ color: theme.textMuted, fontSize: '11px', padding: '3px 0' }}>
                    类型 {item.type} · 修订 ID {item.id}
                  </span>
                </div>
                {summaryTruncated ? (
                  <div style={{ color: theme.accent, fontSize: '10px', fontWeight: 700 }}>
                    摘要节选 · 前 {summaryLimit} 字符
                  </div>
                ) : null}
                <div
                  data-layout="timeline-summary"
                  style={{
                    color: theme.text,
                    fontWeight: 700,
                    fontSize: '14px',
                    lineHeight: 1.5,
                    overflowWrap: 'anywhere',
                    wordBreak: 'break-word',
                  }}
                >
                  {summaryExcerpt}
                  {summaryTruncated ? '…' : ''}
                </div>
                <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.4 }}>
                  修订者：{item.creator?.nickname || item.creator?.username || '未知'}
                </div>
              </article>
            </div>
          );
        })}
      </div>

      {viewModel.coverage.returned > items.length ? (
        <div style={{ color: theme.textMuted, fontSize: '11px' }}>
          另有 {viewModel.coverage.returned - items.length} 条已返回修订记录未在图片中展示。
        </div>
      ) : null}

      {viewModel.coverage.missingFields &&
      Object.keys(viewModel.coverage.missingFields).length > 0 ? (
        <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.5 }}>
          字段未知：
          {Object.entries(viewModel.coverage.missingFields)
            .map(([field, count]) => `${field} ${count}`)
            .join('、')}
        </div>
      ) : null}

      {viewModel.coverage.truncatedFields &&
      Object.keys(viewModel.coverage.truncatedFields).length > 0 ? (
        <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.5 }}>
          字段已裁剪：
          {Object.entries(viewModel.coverage.truncatedFields)
            .map(([field, count]) => `${field} ${count}`)
            .join('、')}
        </div>
      ) : null}

      {viewModel.capabilityStates.historical_growth === 'not_computable' ? (
        <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.5 }}>
          历史增长趋势：当前源不支持计算。
        </div>
      ) : null}

      {viewModel.warnings.length > 0 ? (
        <div style={{ color: theme.warning, fontSize: '11px', lineHeight: 1.5 }}>
          {viewModel.warnings.map((warning) => warning.message).join('；')}
        </div>
      ) : null}
      {viewModel.limitations.length > 0 ? (
        <div style={{ color: theme.textMuted, fontSize: '10px', lineHeight: 1.5 }}>
          限制：{viewModel.limitations[0]}
        </div>
      ) : null}
      {viewModel.source ? (
        <div style={{ color: theme.textMuted, fontSize: '10px' }}>
          来源：{viewModel.source.label} · {viewModel.source.operation}
          {viewModel.source.retrievedAt
            ? ` · 获取于 ${viewModel.source.retrievedAt}`
            : viewModel.source.attemptedAt
              ? ` · 尝试于 ${viewModel.source.attemptedAt}`
              : ''}
        </div>
      ) : null}

      <Footer theme={theme} />
    </CardFrame>
  );
};
