import React from 'react';
import { ThemeTokens } from '../themes/index.js';

export interface TitleBlockProps {
  title: string;
  subtitle?: string;
  theme: ThemeTokens;
  titleFontSize?: string;
  subtitleFontSize?: string;
}

export const TitleBlock: React.FC<TitleBlockProps> = ({
  title,
  subtitle,
  theme,
  titleFontSize = '24px',
  subtitleFontSize = '15px',
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.xs }}>
      <h1
        style={{
          fontSize: titleFontSize,
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
            fontSize: subtitleFontSize,
            color: theme.textMuted,
            lineHeight: 1.4,
            overflowWrap: 'anywhere',
            wordBreak: 'break-word',
          }}
        >
          {subtitle}
        </div>
      )}
    </div>
  );
};
