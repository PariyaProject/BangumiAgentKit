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
  const zine = theme.designPack === 'graphic-zine';

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
            backgroundColor: zine ? theme.surface : theme.surfaceAlt,
            color: theme.text,
            fontSize: '12px',
            fontWeight: zine ? 700 : 500,
            padding: '3px 10px',
            borderRadius: theme.design.tagRadius,
            border: `${zine ? '2px' : theme.design.metricBorderWidth} solid ${zine ? theme.text : theme.border}`,
            clipPath: theme.design.masks.tag,
          }}
        >
          {tag}
        </span>
      ))}
    </div>
  );
};
