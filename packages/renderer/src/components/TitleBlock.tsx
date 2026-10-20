import React from 'react';
import type { ThemeTokens } from '../themes/index.js';
import { getRendererIconLabel, RendererIcon, type RendererIconName } from './RendererIcon.js';

export interface TitleBlockProps {
  title: string;
  subtitle?: string;
  theme: ThemeTokens;
  icon?: RendererIconName;
  eyebrow?: string;
  titleFontSize?: string;
  subtitleFontSize?: string;
}

export const TitleBlock: React.FC<TitleBlockProps> = ({
  title,
  subtitle,
  theme,
  icon = 'subject',
  eyebrow,
  titleFontSize = '24px',
  subtitleFontSize = '15px',
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.xs, minWidth: 0 }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: theme.spacing.sm,
          minWidth: 0,
        }}
      >
        <RendererIcon name={icon} theme={theme} size={16} badge />
        <div
          style={{
            color: theme.accent,
            fontSize: '10px',
            fontWeight: 800,
            letterSpacing: '0.09em',
            lineHeight: 1.2,
            minWidth: 0,
            overflowWrap: 'anywhere',
            wordBreak: 'break-word',
          }}
        >
          {eyebrow || `BANGUMI · ${getRendererIconLabel(icon)}`}
        </div>
      </div>
      <h1
        style={{
          fontSize: titleFontSize,
          fontWeight: 700,
          color: theme.text,
          margin: 0,
          lineHeight: 1.24,
          letterSpacing: '-0.02em',
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
