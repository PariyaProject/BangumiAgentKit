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
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: theme.spacing.md,
        paddingTop: theme.spacing.sm,
        borderTop: `1px solid ${theme.border}`,
        fontSize: '12px',
        color: theme.textMuted,
      }}
    >
      <span>{label}</span>
      <span>Powered by Bangumi Agent Kit</span>
    </div>
  );
};
