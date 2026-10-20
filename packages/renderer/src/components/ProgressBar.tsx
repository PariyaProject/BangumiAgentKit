import React from 'react';
import { ThemeTokens } from '../themes/index.js';

export interface ProgressBarProps {
  percentage: number;
  label?: string;
  theme: ThemeTokens;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ percentage, label, theme }) => {
  const clamped = Math.max(0, Math.min(100, percentage));
  const zine = theme.designPack === 'graphic-zine';
  const gallery = theme.designPack === 'clean-gallery';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.xs, width: '100%' }}>
      {label && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '13px',
            color: theme.textMuted,
            fontWeight: zine ? 800 : 500,
          }}
        >
          <span>{label}</span>
          <span>{clamped}%</span>
        </div>
      )}
      <div
        style={{
          width: '100%',
          height: zine ? '12px' : gallery ? '5px' : '8px',
          backgroundColor: theme.surfaceAlt,
          borderRadius: zine || gallery ? '0' : theme.radius.sm,
          overflow: 'hidden',
          border: `${zine ? '2px' : gallery ? '0' : '1px'} solid ${theme.border}`,
        }}
      >
        <div
          style={{
            width: `${clamped}%`,
            height: '100%',
            backgroundColor: theme.accent,
            borderRadius: zine || gallery ? '0' : theme.radius.sm,
            transition: 'width 0.3s ease',
          }}
        />
      </div>
    </div>
  );
};
