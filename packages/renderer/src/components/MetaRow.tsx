import React from 'react';
import { ThemeTokens } from '../themes/index.js';

export interface MetaRowProps {
  items: Array<string | undefined>;
  theme: ThemeTokens;
}

export const MetaRow: React.FC<MetaRowProps> = ({ items, theme }) => {
  const filtered = items.filter(Boolean);
  if (filtered.length === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        gap: theme.spacing.md,
        alignItems: 'center',
        flexWrap: 'wrap',
        fontSize: '14px',
        color: theme.textMuted,
      }}
    >
      {filtered.map((item, idx) => (
        <React.Fragment key={idx}>
          {idx > 0 && <span style={{ color: theme.border }}>•</span>}
          <span>{item}</span>
        </React.Fragment>
      ))}
    </div>
  );
};
