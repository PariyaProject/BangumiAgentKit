export type RenderThemeName = 'bangumi-dark' | 'bangumi-light';

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
  textMuted: '#94a3b8',
  accent: '#38bdf8',
  score: '#fbbf24',
  success: '#34d399',
  warning: '#f87171',
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
  background: '#f8fafc',
  surface: '#ffffff',
  surfaceAlt: '#f1f5f9',
  border: '#e2e8f0',
  text: '#0f172a',
  textMuted: '#64748b',
  accent: '#0284c7',
  score: '#d97706',
  success: '#059669',
  warning: '#dc2626',
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
  shadow: '0 10px 25px -5px rgba(0, 0, 0, 0.08)',
};

export function getThemeTokens(theme: RenderThemeName = 'bangumi-dark'): ThemeTokens {
  return theme === 'bangumi-light' ? LIGHT_THEME : DARK_THEME;
}
