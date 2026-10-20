export type RenderThemeName = 'bangumi-dark' | 'bangumi-light';

export type SemanticToneName = 'coral' | 'mint' | 'butter' | 'plum' | 'indigo' | 'blue';

export interface SemanticToneTokens {
  foreground: string;
  surface: string;
  border: string;
}

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
  tones: Record<SemanticToneName, SemanticToneTokens>;
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
  tones: {
    coral: { foreground: '#ff9e9a', surface: '#463034', border: '#674249' },
    mint: { foreground: '#7bd7b8', surface: '#293d37', border: '#3c6256' },
    butter: { foreground: '#f1cc78', surface: '#423a2b', border: '#665637' },
    plum: { foreground: '#d2a5e2', surface: '#3d3045', border: '#60486a' },
    indigo: { foreground: '#aebaff', surface: '#303750', border: '#4d5c8b' },
    blue: { foreground: '#94c9e6', surface: '#2b3d49', border: '#42677d' },
  },
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
  background: '#f4efe5',
  surface: '#fffcf5',
  surfaceAlt: '#f2ebdf',
  border: '#e3d9c9',
  text: '#2b2926',
  textMuted: '#615d56',
  accent: '#a43a45',
  score: '#795500',
  success: '#17695d',
  warning: '#a53f37',
  tones: {
    coral: { foreground: '#a43a45', surface: '#f7e8e3', border: '#e8c9c1' },
    mint: { foreground: '#17695d', surface: '#e4efe8', border: '#bfd8cb' },
    butter: { foreground: '#795500', surface: '#f5edcf', border: '#e4d7a7' },
    plum: { foreground: '#70477c', surface: '#eee6f2', border: '#d9c6e1' },
    indigo: { foreground: '#40558b', surface: '#e7eaf5', border: '#c9d0e7' },
    blue: { foreground: '#3d6680', surface: '#e4edf2', border: '#c3d5df' },
  },
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
