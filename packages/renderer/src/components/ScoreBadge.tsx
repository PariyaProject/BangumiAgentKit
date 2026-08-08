import React from 'react';
import { ThemeTokens } from '../themes/index.js';

export interface ScoreBadgeProps {
  score?: number;
  rank?: number;
  theme: ThemeTokens;
}

export const ScoreBadge: React.FC<ScoreBadgeProps> = ({ score, rank, theme }) => {
  if (!score && !rank) return null;

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
          style={{
            fontSize: '24px',
            fontWeight: 800,
            color: theme.score,
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
            padding: '2px 8px',
            borderRadius: theme.radius.sm,
            border: `1px solid ${theme.border}`,
          }}
        >
          #{rank}
        </span>
      )}
    </div>
  );
};
