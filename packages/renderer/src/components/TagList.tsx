import React from 'react';
import { ThemeTokens } from '../themes/index.js';

export interface TagListProps {
  tags?: string[];
  theme: ThemeTokens;
  maxTags?: number;
}

export const TagList: React.FC<TagListProps> = ({ tags, theme, maxTags = 8 }) => {
  if (!tags || tags.length === 0) return null;

  const displayTags = tags.slice(0, maxTags);

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: theme.spacing.xs,
        marginTop: theme.spacing.xs,
      }}
    >
      {displayTags.map((tag, idx) => (
        <span
          key={idx}
          style={{
            backgroundColor: theme.surfaceAlt,
            color: theme.text,
            fontSize: '12px',
            padding: '3px 10px',
            borderRadius: '20px',
            border: `1px solid ${theme.border}`,
          }}
        >
          {tag}
        </span>
      ))}
    </div>
  );
};
