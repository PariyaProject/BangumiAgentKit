import React from 'react';
import { ThemeTokens } from '../themes/index.js';
import { DEFAULT_PLACEHOLDER_DATA_URL } from '../asset-resolver.js';

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
  if (!src || src === DEFAULT_PLACEHOLDER_DATA_URL) {
    const placeholderLabel = src ? '封面暂不可用' : '暂无封面';
    return (
      <div
        role="img"
        aria-label={`${alt}：${placeholderLabel}`}
        style={{
          width: `${width}px`,
          height: `${height}px`,
          boxSizing: 'border-box',
          flexShrink: 0,
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
        {placeholderLabel}
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
