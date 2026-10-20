import React from 'react';
import { ThemeTokens } from '../themes/index.js';

export interface MetaRowProps {
  items: Array<string | MetaRowEntry | undefined>;
  theme: ThemeTokens;
}

export interface MetaRowEntry {
  label: string;
  value: string;
}

export const MetaRow: React.FC<MetaRowProps> = ({ items, theme }) => {
  const filtered = items.filter((item): item is string | MetaRowEntry => Boolean(item));
  if (filtered.length === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        columnGap: theme.spacing.md,
        rowGap: theme.spacing.xs,
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        fontSize: '14px',
        color: theme.textMuted,
        fontFamily: theme.design.bodyFontFamily,
      }}
    >
      {filtered.map((item, idx) => (
        <span
          key={idx}
          style={{
            display: 'inline-flex',
            alignItems: 'flex-start',
            gap: theme.spacing.xs,
            flex: '0 1 auto',
            minWidth: 0,
          }}
        >
          {idx > 0 &&
            (theme.design.markerStyle === 'editorial' ? (
              <span
                aria-hidden="true"
                style={{
                  color: theme.accent,
                  fontFamily: theme.design.displayFontFamily,
                  flex: '0 0 auto',
                }}
              >
                ·
              </span>
            ) : (
              <span
                aria-hidden="true"
                style={{
                  width: theme.design.markerStyle === 'zine' ? '5px' : '1px',
                  height: theme.design.markerStyle === 'zine' ? '5px' : '13px',
                  backgroundColor:
                    theme.design.markerStyle === 'zine' ? theme.accent : theme.border,
                  display: 'inline-block',
                  transform: theme.design.markerStyle === 'zine' ? 'rotate(45deg)' : undefined,
                  flex: '0 0 auto',
                  marginTop: '7px',
                }}
              />
            ))}
          {typeof item === 'string' ? (
            <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{item}</span>
          ) : (
            <span
              data-layout="no-wrap-metadata-item"
              style={{ display: 'inline-flex', alignItems: 'baseline', gap: '4px' }}
            >
              <span data-layout="no-wrap-metadata-label" style={{ whiteSpace: 'nowrap' }}>
                {item.label}:
              </span>
              <span data-layout="no-wrap-metadata-value" style={{ whiteSpace: 'nowrap' }}>
                {item.value}
              </span>
            </span>
          )}
        </span>
      ))}
    </div>
  );
};
