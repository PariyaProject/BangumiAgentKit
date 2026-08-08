import React from 'react';
import { ThemeTokens } from '../themes/index.js';

export interface PersonAvatarProps {
  src?: string;
  name: string;
  subName?: string;
  theme: ThemeTokens;
  size?: number;
}

export const PersonAvatar: React.FC<PersonAvatarProps> = ({
  src,
  name,
  subName,
  theme,
  size = 48,
}) => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
      {src ? (
        <img
          src={src}
          alt={name}
          style={{
            width: `${size}px`,
            height: `${size}px`,
            borderRadius: '50%',
            objectFit: 'cover',
            border: `1px solid ${theme.border}`,
          }}
        />
      ) : (
        <div
          style={{
            width: `${size}px`,
            height: `${size}px`,
            borderRadius: '50%',
            backgroundColor: theme.surfaceAlt,
            color: theme.accent,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: `${Math.floor(size * 0.4)}px`,
            border: `1px solid ${theme.border}`,
          }}
        >
          {Array.from(name)[0] || '?'}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: '14px', fontWeight: 600, color: theme.text }}>{name}</span>
        {subName && (
          <span style={{ fontSize: '12px', color: theme.textMuted }}>{subName}</span>
        )}
      </div>
    </div>
  );
};
