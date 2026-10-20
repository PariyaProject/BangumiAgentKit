export type RenderThemeName = 'bangumi-dark' | 'bangumi-light';

export function isRenderThemeName(value: unknown): value is RenderThemeName {
  return value === 'bangumi-dark' || value === 'bangumi-light';
}

export interface ThemeTokens {
  name: RenderThemeName;
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  score: string;
  success: string;
  warning: string;
  radius: {
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  spacing: {
    xs: string;
    sm: string;
    md: string;
    lg: string;
    xl: string;
  };
  shadow: string;
}

export const DARK_THEME: ThemeTokens = {
  name: 'bangumi-dark',
  background: '#0f172a',
  surface: '#1e293b',
  surfaceAlt: '#334155',
  border: '#334155',
  text: '#f8fafc',
  textMuted: '#a4b1c2',
  accent: '#38bdf8',
  score: '#fbbf24',
  success: '#34d399',
  warning: '#ff9999',
  radius: {
    sm: '6px',
    md: '10px',
    lg: '16px',
    xl: '24px',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
  },
  shadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4)',
};

export const LIGHT_THEME: ThemeTokens = {
  name: 'bangumi-light',
  background: '#f5f6f8',
  surface: '#ffffff',
  surfaceAlt: '#f1f3f5',
  border: '#dfe3e8',
  text: '#20242b',
  textMuted: '#596273',
  accent: '#b23a48',
  score: '#a65a00',
  success: '#0f766e',
  warning: '#b42318',
  radius: {
    sm: '6px',
    md: '10px',
    lg: '16px',
    xl: '24px',
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '16px',
    lg: '24px',
    xl: '32px',
  },
  shadow: '0 8px 24px -8px rgba(31, 41, 55, 0.12)',
};

export function getThemeTokens(theme: RenderThemeName = 'bangumi-dark'): ThemeTokens {
  return theme === 'bangumi-light' ? LIGHT_THEME : DARK_THEME;
}
