import React from 'react';
import { ThemeTokens } from '../themes/index.js';

export interface ProgressBarProps {
  percentage: number;
  label?: string;
  theme: ThemeTokens;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ percentage, label, theme }) => {
  const clamped = Math.max(0, Math.min(100, percentage));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.xs, width: '100%' }}>
      {label && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '13px',
            color: theme.textMuted,
          }}
        >
          <span>{label}</span>
          <span>{clamped}%</span>
        </div>
      )}
      <div
        style={{
          width: '100%',
          height: '8px',
          backgroundColor: theme.surfaceAlt,
          borderRadius: '4px',
          overflow: 'hidden',
          border: `1px solid ${theme.border}`,
        }}
      >
        <div
          style={{
            width: `${clamped}%`,
            height: '100%',
            backgroundColor: theme.accent,
            borderRadius: '4px',
            transition: 'width 0.3s ease',
          }}
        />
      </div>
    </div>
  );
};
