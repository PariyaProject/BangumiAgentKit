import React from 'react';
import { CollectionProgressViewModel } from '../view-models/index.js';
import { ThemeTokens } from '../themes/index.js';
import { CardFrame } from '../components/CardFrame.js';
import { CoverImage } from '../components/CoverImage.js';
import { TitleBlock } from '../components/TitleBlock.js';
import { RendererIcon } from '../components/RendererIcon.js';
import { ProgressBar } from '../components/ProgressBar.js';
import { Footer } from '../components/Footer.js';

export interface CollectionProgressCardProps {
  viewModel: CollectionProgressViewModel;
  theme: ThemeTokens;
  resolvedImages?: Record<string, string>;
  width?: number;
}

export const CollectionProgressCard: React.FC<CollectionProgressCardProps> = ({
  viewModel,
  theme,
  resolvedImages = {},
  width,
}) => {
  const {
    subject,
    statusLabel,
    watchedEpisodes,
    totalEpisodes,
    rating,
    comment,
    progressPercentage,
  } = viewModel;
  const coverSrc = subject.image ? resolvedImages[subject.image] || subject.image : undefined;
  const narrowWidth = width !== undefined && width <= 360;
  const coverWidth = narrowWidth ? 100 : 120;
  const coverHeight = narrowWidth ? 138 : 165;

  return (
    <CardFrame theme={theme} width={width}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: narrowWidth ? 'minmax(0, 1fr)' : `${coverWidth}px minmax(0, 1fr)`,
          gap: narrowWidth ? theme.spacing.md : theme.spacing.lg,
          alignItems: 'start',
          minWidth: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: narrowWidth ? 'center' : 'flex-start',
            minWidth: 0,
          }}
        >
          <CoverImage
            src={coverSrc}
            alt={subject.nameCn || subject.name}
            theme={theme}
            width={coverWidth}
            height={coverHeight}
          />
        </div>
        <div style={{ gridColumn: narrowWidth ? '1 / -1' : undefined, minWidth: 0 }}>
          <TitleBlock
            title={subject.nameCn || subject.name}
            subtitle={subject.name}
            theme={theme}
            titleFontSize={width && width > 320 && width <= 360 ? '22px' : undefined}
            icon="collection"
          />
        </div>

        <div
          data-layout="collection-progress-status-row"
          style={{
            gridColumn: '1 / -1',
            display: 'flex',
            flexWrap: narrowWidth ? 'nowrap' : 'wrap',
            justifyContent: narrowWidth ? 'space-between' : undefined,
            gap: narrowWidth ? theme.spacing.xs : theme.spacing.sm,
            alignItems: 'center',
            minWidth: 0,
            width: '100%',
            backgroundColor: theme.surfaceAlt,
            padding: narrowWidth
              ? `${theme.spacing.xs} ${theme.spacing.sm}`
              : `${theme.spacing.xs} ${theme.spacing.md}`,
            borderRadius: theme.radius.sm,
            border: `1px solid ${theme.border}`,
            fontSize: narrowWidth ? '12px' : '14px',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: theme.spacing.xs }}>
            <RendererIcon name="collection" theme={theme} size={15} />
            <span style={{ color: theme.accent, fontWeight: 700, whiteSpace: 'nowrap' }}>
              {statusLabel}
            </span>
          </span>
          <span style={{ color: theme.text, whiteSpace: 'nowrap' }}>
            已看 {watchedEpisodes} {totalEpisodes ? `/ ${totalEpisodes}` : ''} 集
          </span>
          {rating !== undefined && (
            <span style={{ color: theme.score, fontWeight: 700, whiteSpace: 'nowrap' }}>
              ★ {rating} / 10
            </span>
          )}
        </div>

        {progressPercentage !== undefined && (
          <div style={{ gridColumn: '1 / -1', minWidth: 0, width: '100%' }}>
            <ProgressBar percentage={progressPercentage} label="观看进度" theme={theme} />
          </div>
        )}
      </div>

      {comment && (
        <div
          data-render-mask="panel"
          style={{
            marginTop: theme.spacing.sm,
            backgroundColor: theme.surfaceAlt,
            padding: theme.spacing.md,
            borderRadius: theme.radius.md,
            border: `1px solid ${theme.border}`,
            fontSize: '14px',
            lineHeight: 1.5,
            color: theme.text,
            overflowWrap: 'anywhere',
            clipPath: theme.design.masks.panel,
          }}
        >
          <div style={{ fontSize: '12px', color: theme.textMuted, marginBottom: '4px' }}>
            我的评价 / 简评:
          </div>
          <div>"{comment}"</div>
        </div>
      )}

      <Footer theme={theme} />
    </CardFrame>
  );
};
