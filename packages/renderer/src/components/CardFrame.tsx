import React from 'react';
import { ThemeTokens } from '../themes/index.js';

export interface CardFrameProps {
  theme: ThemeTokens;
  children: React.ReactNode;
  width?: number;
}

export const CardFrame: React.FC<CardFrameProps> = ({ theme, children, width = 960 }) => {
  const design = theme.design;
  const marker =
    design.markerStyle === 'zine' ? (
      <div aria-hidden="true" style={{ display: 'flex', gap: '4px', marginBottom: '-4px' }}>
        <span
          style={{
            width: '24px',
            height: '6px',
            backgroundColor: theme.accent,
            transform: 'skewX(-22deg)',
          }}
        />
        <span
          style={{
            width: '12px',
            height: '6px',
            backgroundColor: theme.score,
            transform: 'skewX(-22deg)',
          }}
        />
        <span
          style={{
            width: '6px',
            height: '6px',
            backgroundColor: theme.success,
            transform: 'skewX(-22deg)',
          }}
        />
      </div>
    ) : (
      <div
        aria-hidden="true"
        style={{
          width: design.markerStyle === 'gallery' ? '56px' : '38px',
          height: design.markerStyle === 'gallery' ? '2px' : '3px',
          backgroundColor: theme.accent,
          marginBottom: '-4px',
        }}
      />
    );

  return (
    <div
      data-render-root
      data-render-pack={theme.designPack}
      data-render-theme={theme.name}
      style={{
        width: `${width}px`,
        boxSizing: 'border-box',
        minWidth: 0,
        maxWidth: '100%',
        backgroundColor: theme.background,
        color: theme.text,
        fontFamily: design.bodyFontFamily,
        padding: design.outerPadding,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          boxSizing: 'border-box',
          minWidth: 0,
          maxWidth: '100%',
          backgroundColor: theme.surface,
          border: `${design.frameBorderWidth} solid ${theme.border}`,
          borderRadius: design.frameRadius,
          padding: design.cardPadding,
          boxShadow: theme.shadow,
          display: 'flex',
          flexDirection: 'column',
          gap: theme.spacing.md,
        }}
      >
        {marker}
        {children}
      </div>
    </div>
  );
};
