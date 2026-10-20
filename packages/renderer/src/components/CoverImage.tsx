import React from 'react';
import { ThemeTokens } from '../themes/index.js';
import { DEFAULT_PLACEHOLDER_DATA_URL } from '../asset-resolver.js';

export interface CoverImageProps {
  src?: string;
  alt?: string;
  theme: ThemeTokens;
  width?: number;
  height?: number;
  fill?: boolean;
  filter?: string;
}

export const CoverImage: React.FC<CoverImageProps> = ({
  src,
  alt = 'Cover',
  theme,
  width = 160,
  height = 220,
  fill = false,
  filter,
}) => {
  if (!src || src === DEFAULT_PLACEHOLDER_DATA_URL) {
    const placeholderLabel = src ? '封面暂不可用' : '暂无封面';
    return (
      <div
        role="img"
        aria-label={`${alt}：${placeholderLabel}`}
        data-cover-pack={theme.designPack}
        data-layout={fill ? 'subject-cover-artwork' : undefined}
        data-cover-placeholder={fill ? 'poster' : 'portrait'}
        style={{
          width: fill ? '100%' : `${width}px`,
          height: fill ? '100%' : `${height}px`,
          boxSizing: 'border-box',
          flexShrink: 0,
          position: fill ? 'absolute' : undefined,
          inset: fill ? 0 : undefined,
          backgroundColor: theme.surfaceAlt,
          backgroundImage: fill
            ? `linear-gradient(135deg, ${theme.tones.butter.surface} 0%, ${theme.surfaceAlt} 54%, ${theme.tones.blue.surface} 100%)`
            : undefined,
          borderRadius: fill ? 0 : theme.design.coverRadius,
          clipPath: fill ? theme.design.masks.hero : theme.design.masks.cover,
          display: 'flex',
          alignItems: fill ? 'flex-end' : 'center',
          justifyContent: 'center',
          color: theme.textMuted,
          fontSize: fill ? '12px' : '14px',
          border: fill ? 0 : `${theme.design.coverBorderWidth} solid ${theme.border}`,
          padding: fill ? theme.spacing.md : 0,
          boxShadow:
            !fill && theme.designPack === 'graphic-zine' ? `3px 3px 0 ${theme.text}` : undefined,
        }}
      >
        <span
          style={{
            padding: fill ? '4px 10px' : 0,
            backgroundColor: fill ? theme.surface : undefined,
            border: fill ? `1px solid ${theme.border}` : undefined,
            borderRadius: fill ? theme.design.badgeRadius : undefined,
          }}
        >
          {placeholderLabel}
        </span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      data-cover-pack={theme.designPack}
      data-layout={fill ? 'subject-cover-artwork' : undefined}
      style={{
        width: fill ? '100%' : `${width}px`,
        height: fill ? '100%' : `${height}px`,
        position: fill ? 'absolute' : undefined,
        inset: fill ? 0 : undefined,
        objectFit: 'cover',
        filter,
        borderRadius: fill ? 0 : theme.design.coverRadius,
        clipPath: fill ? theme.design.masks.hero : theme.design.masks.cover,
        border: fill ? 0 : `${theme.design.coverBorderWidth} solid ${theme.border}`,
        boxShadow:
          !fill && theme.designPack === 'graphic-zine' ? `3px 3px 0 ${theme.text}` : undefined,
      }}
    />
  );
};
