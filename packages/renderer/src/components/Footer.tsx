import React from 'react';
import { ThemeTokens } from '../themes/index.js';

export interface FooterProps {
  label?: string;
  theme: ThemeTokens;
}

export const Footer: React.FC<FooterProps> = ({ label = 'Bangumi Agent Kit', theme }) => {
  return (
    <div
      style={{
        boxSizing: 'border-box',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: theme.spacing.xs,
        marginTop: theme.spacing.md,
        paddingTop: theme.spacing.sm,
        borderTop: `1px solid ${theme.border}`,
        fontSize: '12px',
        color: theme.textMuted,
      }}
    >
      <span
        style={{
          minWidth: 0,
          maxWidth: '100%',
          flex: '1 1 12rem',
          overflowWrap: 'anywhere',
          wordBreak: 'break-word',
        }}
      >
        {label}
      </span>
      <span
        style={{
          minWidth: 0,
          maxWidth: '100%',
          flex: '0 1 auto',
          overflowWrap: 'anywhere',
          wordBreak: 'break-word',
          textAlign: 'right',
        }}
      >
        Powered by Bangumi Agent Kit
      </span>
    </div>
  );
};
