import React from 'react';
import { ThemeTokens } from '../themes/index.js';

export interface CardFrameProps {
  theme: ThemeTokens;
  children: React.ReactNode;
  width?: number;
}

export const CardFrame: React.FC<CardFrameProps> = ({ theme, children, width = 960 }) => {
  return (
    <div
      data-render-root
      style={{
        width: `${width}px`,
        boxSizing: 'border-box',
        backgroundColor: theme.background,
        color: theme.text,
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", "Meiryo", sans-serif',
        padding: theme.spacing.lg,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          backgroundColor: theme.surface,
          border: `1px solid ${theme.border}`,
          borderRadius: theme.radius.lg,
          padding: theme.spacing.lg,
          boxShadow: theme.shadow,
          display: 'flex',
          flexDirection: 'column',
          gap: theme.spacing.md,
        }}
      >
        {children}
      </div>
    </div>
  );
};
