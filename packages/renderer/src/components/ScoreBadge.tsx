import React from 'react';
import { ThemeTokens } from '../themes/index.js';

export interface ScoreBadgeProps {
  score?: number;
  rank?: number;
  theme: ThemeTokens;
  size?: 'default' | 'hero';
  heroFontSize?: string;
}

export const ScoreBadge: React.FC<ScoreBadgeProps> = ({
  score,
  rank,
  theme,
  size = 'default',
  heroFontSize,
}) => {
  if (!score && !rank) return null;
  const scoreColor = theme.design.markerStyle === 'gallery' ? theme.accent : theme.score;
  const scoreFontSize =
    size === 'hero'
      ? (heroFontSize ?? (theme.design.markerStyle === 'zine' ? '60px' : '54px'))
      : theme.design.markerStyle === 'zine'
        ? '30px'
        : theme.design.markerStyle === 'gallery'
          ? '28px'
          : '24px';

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: theme.spacing.sm,
      }}
    >
      {score !== undefined && (
        <span
          data-layout="score-value"
          data-score-pack={theme.designPack}
          data-score-size={size}
          style={{
            fontFamily: theme.design.displayFontFamily,
            fontSize: scoreFontSize,
            fontWeight: theme.design.titleWeight,
            color: scoreColor,
            whiteSpace: 'nowrap',
            backgroundColor: theme.designPack === 'graphic-zine' ? theme.surfaceAlt : undefined,
            border:
              theme.designPack === 'graphic-zine'
                ? `${theme.design.metricBorderWidth} solid ${theme.text}`
                : undefined,
            borderRadius:
              theme.designPack === 'graphic-zine' ? theme.design.badgeRadius : undefined,
            padding: theme.designPack === 'graphic-zine' ? '1px 7px' : undefined,
          }}
        >
          ★ {score.toFixed(1)}
        </span>
      )}
      {rank !== undefined && (
        <span
          style={{
            backgroundColor: theme.surfaceAlt,
            color: theme.accent,
            fontSize: '12px',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            padding: '2px 8px',
            borderRadius: theme.design.badgeRadius,
            border: `${theme.design.metricBorderWidth} solid ${theme.border}`,
          }}
        >
          #{rank}
        </span>
      )}
    </div>
  );
};
