import React from 'react';
import { ThemeTokens } from '../themes/index.js';

export interface TitleBlockProps {
  title: string;
  subtitle?: string;
  theme: ThemeTokens;
}

export const TitleBlock: React.FC<TitleBlockProps> = ({ title, subtitle, theme }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.xs }}>
      <h1
        style={{
          fontSize: '24px',
          fontWeight: 700,
          color: theme.accent,
          margin: 0,
          lineHeight: 1.3,
          overflowWrap: 'anywhere',
          wordBreak: 'break-word',
        }}
      >
        {title}
      </h1>
      {subtitle && (
        <div
          style={{
            fontSize: '15px',
            color: theme.textMuted,
            lineHeight: 1.4,
          }}
        >
          {subtitle}
        </div>
      )}
    </div>
  );
};
