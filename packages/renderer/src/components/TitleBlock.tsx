import React from 'react';
import type { ThemeTokens } from '../themes/index.js';
import { getRendererIconLabel, RendererIcon, type RendererIconName } from './RendererIcon.js';

export interface TitleBlockProps {
  title: string;
  subtitle?: string;
  theme: ThemeTokens;
  icon?: RendererIconName;
  eyebrow?: string;
  titleFontSize?: string;
  subtitleFontSize?: string;
  titleMaxLines?: number;
  subtitleMaxLines?: number;
  eyebrowFontSize?: string;
  eyebrowSurface?: string;
  eyebrowColor?: string;
  showIconEyebrow?: boolean;
  iconSize?: number;
  titleStyle?: 'standard' | 'cohort-report' | 'cohort-gallery-open';
}

export const TitleBlock: React.FC<TitleBlockProps> = ({
  title,
  subtitle,
  theme,
  icon = 'subject',
  eyebrow,
  titleFontSize = '24px',
  subtitleFontSize = '15px',
  titleMaxLines = 2,
  subtitleMaxLines,
  eyebrowFontSize = '10px',
  eyebrowSurface,
  eyebrowColor,
  showIconEyebrow = true,
  iconSize = 16,
  titleStyle = 'standard',
}) => {
  const titleSize = Number.parseFloat(titleFontSize);
  const designedTitleSize = Number.isFinite(titleSize)
    ? `${titleSize * theme.design.titleScale}px`
    : titleFontSize;
  const packTitleStyle =
    titleStyle === 'cohort-gallery-open'
      ? { borderBottom: `1px solid ${theme.border}`, paddingBottom: '5px' }
      : titleStyle === 'cohort-report'
        ? theme.designPack === 'graphic-zine'
          ? {
              padding: '4px 10px 6px',
              clipPath: theme.design.masks.title,
              backgroundColor: theme.surfaceAlt,
            }
          : theme.designPack === 'clean-gallery'
            ? { borderLeft: `3px solid ${theme.accent}`, paddingLeft: '10px' }
            : {
                borderBottom: `1px solid ${theme.border}`,
                paddingBottom: '5px',
              }
        : theme.designPack === 'clean-gallery'
          ? { borderLeft: `3px solid ${theme.accent}`, paddingLeft: '10px' }
          : theme.designPack === 'graphic-zine'
            ? {
                borderLeft: `6px solid ${theme.accent}`,
                paddingLeft: '8px',
                paddingRight: '14px',
                clipPath: theme.design.masks.title,
                backgroundColor: theme.surfaceAlt,
              }
            : {
                borderBottom: `1px solid ${theme.border}`,
                paddingBottom: '5px',
              };

  return (
    <div
      data-title-pack={theme.designPack}
      style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.xs, minWidth: 0 }}
    >
      {showIconEyebrow ? (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: theme.spacing.sm,
            minWidth: 0,
          }}
        >
          <RendererIcon name={icon} theme={theme} size={iconSize} badge />
          <div
            data-title-eyebrow-backplate={eyebrowSurface ? 'true' : undefined}
            style={{
              color: eyebrowColor ?? theme.accent,
              fontSize: eyebrowFontSize,
              fontWeight: 800,
              letterSpacing: '0.09em',
              lineHeight: 1.2,
              minWidth: 0,
              overflowWrap: 'anywhere',
              wordBreak: 'break-word',
              backgroundColor: eyebrowSurface,
              padding: eyebrowSurface ? '4px 7px' : undefined,
              border: eyebrowSurface ? `2px solid ${theme.text}` : undefined,
              boxShadow: eyebrowSurface ? `2px 2px 0 ${theme.border}` : undefined,
              clipPath: eyebrowSurface ? theme.design.masks.tag : undefined,
            }}
          >
            {eyebrow || `BANGUMI · ${getRendererIconLabel(icon)}`}
          </div>
        </div>
      ) : null}
      <h1
        data-title-max-lines={titleMaxLines}
        title={title}
        style={{
          ...packTitleStyle,
          fontFamily: theme.design.displayFontFamily,
          fontSize: designedTitleSize,
          fontWeight: theme.design.titleWeight,
          color: theme.text,
          margin: 0,
          lineHeight: theme.designPack === 'graphic-zine' ? 1.16 : 1.24,
          letterSpacing: theme.design.titleLetterSpacing,
          textWrap: theme.designPack === 'graphic-zine' ? 'balance' : undefined,
          display: '-webkit-box',
          WebkitBoxOrient: 'vertical',
          WebkitLineClamp: titleMaxLines,
          overflow: 'hidden',
          overflowWrap: 'anywhere',
          wordBreak: 'break-word',
        }}
      >
        {title}
      </h1>
      {subtitle && (
        <div
          data-subtitle-max-lines={subtitleMaxLines}
          title={subtitleMaxLines ? subtitle : undefined}
          style={{
            fontSize: subtitleFontSize,
            color: theme.textMuted,
            lineHeight: 1.4,
            fontFamily: theme.design.bodyFontFamily,
            overflowWrap: 'anywhere',
            wordBreak: 'break-word',
            display: subtitleMaxLines ? '-webkit-box' : undefined,
            WebkitBoxOrient: subtitleMaxLines ? 'vertical' : undefined,
            WebkitLineClamp: subtitleMaxLines,
            overflow: subtitleMaxLines ? 'hidden' : undefined,
          }}
        >
          {subtitle}
        </div>
      )}
    </div>
  );
};
