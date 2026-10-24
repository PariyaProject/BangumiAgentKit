import type { DesignPackTokens, RenderThemeName, ThemeTokens } from './index.js';
type MagazinePalette = Omit<ThemeTokens, 'designPack' | 'design' | 'radius' | 'spacing'>;

export const ANIME_MAGAZINE_DESIGN: DesignPackTokens = {
  name: 'anime-magazine',
  label: '番剧杂志',
  bodyFontFamily: '"GenSen Rounded", "PingFang SC", "Noto Sans CJK SC", sans-serif',
  displayFontFamily: '"GenSen Rounded", "PingFang SC", "Noto Sans CJK SC", sans-serif',
  outerPadding: '12px',
  cardPadding: '20px',
  frameBorderWidth: '0px',
  frameRadius: '20px',
  titleScale: 1,
  titleWeight: 700,
  titleLetterSpacing: '-0.025em',
  iconStrokeWidth: 1.6,
  badgeRadius: '8px',
  coverRadius: '16px',
  coverBorderWidth: '0px',
  tagRadius: '8px',
  metricBorderWidth: '0px',
  markerStyle: 'gallery',
  masks: {
    frame: 'none',
    hero: 'none',
    cover: 'none',
    panel: 'none',
    panelAlt: 'none',
    progress: 'none',
    tag: 'none',
    title: 'none',
    badge: 'none',
  },
};
export const ANIME_MAGAZINE_RADIUS: ThemeTokens['radius'] = {
  sm: '6px',
  md: '10px',
  lg: '16px',
  xl: '24px',
};
export const ANIME_MAGAZINE_SPACING: ThemeTokens['spacing'] = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
};
const LIGHT: MagazinePalette = {
  name: 'bangumi-light',
  background: 'oklch(98% 0.008 250)',
  surface: 'oklch(99% 0.005 250)',
  surfaceAlt: 'oklch(95% 0.018 250)',
  border: 'oklch(86% 0.025 250)',
  text: 'oklch(24% 0.045 265)',
  textMuted: 'oklch(48% 0.045 260)',
  accent: 'oklch(49% 0.19 255)',
  score: 'oklch(50% 0.17 28)',
  success: 'oklch(42% 0.08 195)',
  warning: 'oklch(49% 0.16 28)',
  tones: {
    coral: {
      foreground: '#a43a45',
      surface: '#f7e8e3',
      border: '#e8c9c1',
    },
    mint: {
      foreground: '#17695d',
      surface: '#e4efe8',
      border: '#bfd8cb',
    },
    butter: {
      foreground: '#795500',
      surface: '#f5edcf',
      border: '#e4d7a7',
    },
    plum: {
      foreground: '#70477c',
      surface: '#eee6f2',
      border: '#d9c6e1',
    },
    indigo: {
      foreground: '#40558b',
      surface: '#e7eaf5',
      border: '#c9d0e7',
    },
    blue: {
      foreground: '#3d6680',
      surface: '#e4edf2',
      border: '#c3d5df',
    },
  },
  shadow: 'none',
};
const DARK: MagazinePalette = {
  name: 'bangumi-dark',
  background: 'oklch(18% 0.025 260)',
  surface: 'oklch(22% 0.028 260)',
  surfaceAlt: 'oklch(27% 0.035 255)',
  border: 'oklch(42% 0.04 250)',
  text: 'oklch(96% 0.01 250)',
  textMuted: 'oklch(79% 0.025 250)',
  accent: 'oklch(78% 0.11 250)',
  score: 'oklch(82% 0.13 28)',
  success: 'oklch(82% 0.10 190)',
  warning: 'oklch(83% 0.11 30)',
  tones: {
    coral: {
      foreground: '#ff9e9a',
      surface: '#463034',
      border: '#674249',
    },
    mint: {
      foreground: '#7bd7b8',
      surface: '#293d37',
      border: '#3c6256',
    },
    butter: {
      foreground: '#f1cc78',
      surface: '#423a2b',
      border: '#665637',
    },
    plum: {
      foreground: '#d2a5e2',
      surface: '#3d3045',
      border: '#60486a',
    },
    indigo: {
      foreground: '#aebaff',
      surface: '#303750',
      border: '#4d5c8b',
    },
    blue: {
      foreground: '#94c9e6',
      surface: '#2b3d49',
      border: '#42677d',
    },
  },
  shadow: 'none',
};
export function animeMagazinePalette(theme: RenderThemeName): MagazinePalette {
  return theme === 'bangumi-dark' ? DARK : LIGHT;
}
