import React from 'react';
import { ThemeTokens } from '../themes/index.js';

export interface CoverImageProps {
  src?: string;
  alt?: string;
  theme: ThemeTokens;
  width?: number;
  height?: number;
}

export const CoverImage: React.FC<CoverImageProps> = ({
  src,
  alt = 'Cover',
  theme,
  width = 160,
  height = 220,
}) => {
  if (!src) {
    return (
      <div
        style={{
          width: `${width}px`,
          height: `${height}px`,
          backgroundColor: theme.surfaceAlt,
          borderRadius: theme.radius.md,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: theme.textMuted,
          fontSize: '14px',
          border: `1px solid ${theme.border}`,
        }}
      >
        No Image
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      style={{
        width: `${width}px`,
        height: `${height}px`,
        objectFit: 'cover',
        borderRadius: theme.radius.md,
        border: `1px solid ${theme.border}`,
      }}
    />
  );
};
