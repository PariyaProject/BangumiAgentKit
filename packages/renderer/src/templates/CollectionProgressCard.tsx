import React from 'react';
import { CollectionProgressViewModel } from '../view-models/index.js';
import { ThemeTokens } from '../themes/index.js';
import { CardFrame } from '../components/CardFrame.js';
import { CoverImage } from '../components/CoverImage.js';
import { TitleBlock } from '../components/TitleBlock.js';
import { ProgressBar } from '../components/ProgressBar.js';
import { Footer } from '../components/Footer.js';

export interface CollectionProgressCardProps {
  viewModel: CollectionProgressViewModel;
  theme: ThemeTokens;
  resolvedImages?: Record<string, string>;
}

export const CollectionProgressCard: React.FC<CollectionProgressCardProps> = ({
  viewModel,
  theme,
  resolvedImages = {},
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

  return (
    <CardFrame theme={theme}>
      <div style={{ display: 'flex', gap: theme.spacing.lg, alignItems: 'flex-start' }}>
        <CoverImage src={coverSrc} alt={subject.nameCn || subject.name} theme={theme} width={120} height={165} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md, flex: 1 }}>
          <TitleBlock title={subject.nameCn || subject.name} subtitle={subject.name} theme={theme} />

          <div
            style={{
              display: 'flex',
              gap: theme.spacing.md,
              alignItems: 'center',
              backgroundColor: theme.surfaceAlt,
              padding: `${theme.spacing.xs} ${theme.spacing.md}`,
              borderRadius: theme.radius.sm,
              border: `1px solid ${theme.border}`,
              fontSize: '14px',
            }}
          >
            <span style={{ color: theme.accent, fontWeight: 700 }}>{statusLabel}</span>
            <span style={{ color: theme.textMuted }}>•</span>
            <span style={{ color: theme.text }}>
              已看 {watchedEpisodes} {totalEpisodes ? `/ ${totalEpisodes}` : ''} 集
            </span>
            {rating !== undefined && (
              <>
                <span style={{ color: theme.textMuted }}>•</span>
                <span style={{ color: theme.score, fontWeight: 700 }}>
                  ★ {rating} / 10
                </span>
              </>
            )}
          </div>

          {progressPercentage !== undefined && (
            <ProgressBar percentage={progressPercentage} label="观看进度" theme={theme} />
          )}
        </div>
      </div>

      {comment && (
        <div
          style={{
            marginTop: theme.spacing.sm,
            backgroundColor: theme.surfaceAlt,
            padding: theme.spacing.md,
            borderRadius: theme.radius.md,
            border: `1px solid ${theme.border}`,
            fontSize: '14px',
            lineHeight: 1.5,
            color: theme.text,
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
