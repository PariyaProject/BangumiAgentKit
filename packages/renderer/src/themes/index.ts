export type RenderThemeName = 'bangumi-dark' | 'bangumi-light';

export type RenderDesignPackName = 'warm-editorial' | 'clean-gallery' | 'graphic-zine';

export const DEFAULT_RENDER_THEME: RenderThemeName = 'bangumi-light';
export const DEFAULT_RENDER_DESIGN_PACK: RenderDesignPackName = 'warm-editorial';
export const RENDER_DESIGN_PACK_NAMES: readonly RenderDesignPackName[] = [
  'warm-editorial',
  'clean-gallery',
  'graphic-zine',
];

export type SemanticToneName = 'coral' | 'mint' | 'butter' | 'plum' | 'indigo' | 'blue';

export interface SemanticToneTokens {
  foreground: string;
  surface: string;
  border: string;
}

export interface DesignPackTokens {
  name: RenderDesignPackName;
  label: string;
  bodyFontFamily: string;
  displayFontFamily: string;
  outerPadding: string;
  cardPadding: string;
  frameBorderWidth: string;
  frameRadius: string;
  titleScale: number;
  titleWeight: number;
  titleLetterSpacing: string;
  iconStrokeWidth: number;
  badgeRadius: string;
  coverRadius: string;
  coverBorderWidth: string;
  tagRadius: string;
  metricBorderWidth: string;
  markerStyle: 'editorial' | 'gallery' | 'zine';
  masks: Record<RenderMaskName, string>;
}

export type RenderMaskName =
  'frame' | 'hero' | 'cover' | 'panel' | 'panelAlt' | 'progress' | 'tag' | 'title' | 'badge';

const GALLERY_PANEL_CUT = 'clamp(12px, 2vw, 20px)';
const ZINE_PANEL_CUT = 'clamp(10px, 1.6vw, 16px)';
const EDITORIAL_CURL_START = 'clamp(48px, 8vw, 82px)';
const EDITORIAL_CURL_PEAK = 'clamp(84px, 14vw, 128px)';
const EDITORIAL_CURL_END = 'clamp(116px, 20vw, 180px)';
const EDITORIAL_CURL_LIFT = 'clamp(20px, 4vw, 30px)';
const EDITORIAL_CURL_TANGENT = 'clamp(12px, 1.6vw, 16px)';
const EDITORIAL_COVER_CURL_START = 'clamp(22px, 4vw, 40px)';
const EDITORIAL_COVER_CURL_PEAK = 'clamp(40px, 7vw, 68px)';
const EDITORIAL_COVER_CURL_END = 'clamp(58px, 10vw, 96px)';
const EDITORIAL_COVER_CURL_LIFT = 'clamp(10px, 2vw, 18px)';
const EDITORIAL_COVER_CURL_TANGENT = 'clamp(6px, 1vw, 10px)';

/** CSS shape() mixes fixed-pixel edge details with curves, avoiding height-scaled cuts. */
const DESIGN_MASKS: Readonly<
  Record<RenderDesignPackName, Readonly<Record<RenderMaskName, string>>>
> = {
  'warm-editorial': {
    // A folio silhouette with an asymmetric page turn and a visible lower-edge wave.
    frame:
      'shape(from 34px 0px, line to calc(100% - 56px) 0px, curve to 100% 34px with 100% 0px / 100% 16px, line to 100% calc(100% - 48px), curve to calc(100% - 28px) 100% with 100% calc(100% - 12px) / calc(100% - 12px) 100%, line to 54px 100%, curve to 0px calc(100% - 38px) with 28px 100% / 0px calc(100% - 14px), line to 0px 36px, curve to 34px 0px with 0px 0px / 18px 0px, close)',
    hero: `shape(from 30px 0px, line to calc(100% - 54px) 0px, curve to 100% 42px with 100% 0px / 100% 20px, line to 100% calc(100% - 44px), curve to calc(100% - 26px) 100% with 100% calc(100% - 12px) / calc(100% - 8px) 100%, line to calc(100% - ${EDITORIAL_CURL_START}) 100%, curve to calc(100% - ${EDITORIAL_CURL_PEAK}) calc(100% - ${EDITORIAL_CURL_LIFT}) with calc(100% - ${EDITORIAL_CURL_START} - ${EDITORIAL_CURL_TANGENT}) 100% / calc(100% - ${EDITORIAL_CURL_PEAK} + ${EDITORIAL_CURL_TANGENT}) calc(100% - ${EDITORIAL_CURL_LIFT}), curve to calc(100% - ${EDITORIAL_CURL_END}) 100% with calc(100% - ${EDITORIAL_CURL_PEAK} - ${EDITORIAL_CURL_TANGENT}) calc(100% - ${EDITORIAL_CURL_LIFT}) / calc(100% - ${EDITORIAL_CURL_END} + ${EDITORIAL_CURL_TANGENT}) 100%, line to 58px 100%, curve to 0px calc(100% - 30px) with 30px 100% / 0px calc(100% - 12px), line to 0px 30px, curve to 30px 0px with 0px 0px / 16px 0px, close)`,
    cover: `shape(from 24px 0px, line to calc(100% - 30px) 0px, curve to 100% 24px with 100% 0px / 100% 12px, line to 100% calc(100% - 32px), curve to calc(100% - 22px) 100% with 100% calc(100% - 8px) / calc(100% - 8px) 100%, line to calc(100% - ${EDITORIAL_COVER_CURL_START}) 100%, curve to calc(100% - ${EDITORIAL_COVER_CURL_PEAK}) calc(100% - ${EDITORIAL_COVER_CURL_LIFT}) with calc(100% - ${EDITORIAL_COVER_CURL_START} - ${EDITORIAL_COVER_CURL_TANGENT}) 100% / calc(100% - ${EDITORIAL_COVER_CURL_PEAK} + ${EDITORIAL_COVER_CURL_TANGENT}) calc(100% - ${EDITORIAL_COVER_CURL_LIFT}), curve to calc(100% - ${EDITORIAL_COVER_CURL_END}) 100% with calc(100% - ${EDITORIAL_COVER_CURL_PEAK} - ${EDITORIAL_COVER_CURL_TANGENT}) calc(100% - ${EDITORIAL_COVER_CURL_LIFT}) / calc(100% - ${EDITORIAL_COVER_CURL_END} + ${EDITORIAL_COVER_CURL_TANGENT}) 100%, line to 38px 100%, curve to 0px calc(100% - 24px) with 20px 100% / 0px calc(100% - 8px), line to 0px 22px, curve to 24px 0px with 0px 0px / 12px 0px, close)`,
    panel: `shape(from 24px 0px, line to calc(100% - 34px) 0px, curve to 100% 28px with 100% 0px / 100% 16px, line to 100% calc(100% - 26px), curve to calc(100% - 24px) calc(100% - 8px) with 100% calc(100% - 12px) / calc(100% - 12px) calc(100% - 8px), curve to calc(100% - 54px) 100% with calc(100% - 34px) calc(100% - 8px) / calc(100% - 42px) 100%, line to 30px 100%, curve to 0px calc(100% - 28px) with 0px 100% / 0px calc(100% - 12px), line to 0px 24px, curve to 24px 0px with 0px 0px / 12px 0px, close)`,
    panelAlt: `shape(from 34px 0px, line to calc(100% - 18px) 0px, curve to 100% 18px with 100% 0px / 100% 10px, line to 100% calc(100% - 34px), curve to calc(100% - 34px) 100% with 100% calc(100% - 12px) / calc(100% - 18px) 100%, line to 54px 100%, curve to 34px calc(100% - 14px) with 46px 100% / 34px calc(100% - 6px), curve to 0px calc(100% - 34px) with 22px calc(100% - 14px) / 0px calc(100% - 16px), line to 0px 34px, curve to 34px 0px with 0px 0px / 18px 0px, close)`,
    progress:
      'shape(from 8px 0px, line to calc(100% - 12px) 0px, curve to 100% 6px with 100% 0px / 100% 3px, line to calc(100% - 4px) 100%, line to 8px 100%, curve to 0px 4px with 0px 100% / 0px 6px, close)',
    tag: 'shape(from 12px 0px, line to calc(100% - 12px) 0px, curve to 100% 12px with 100% 0px / 100% 7px, line to calc(100% - 10px) 100%, line to 10px 100%, curve to 0px 8px with 0px 100% / 0px 5px, close)',
    title: 'none',
    badge:
      'shape(from 10px 1px, curve to 19px 4px with 14px 0px / 17px 4px, curve to 28px 3px with 23px 5px / 27px 4px, line to 32px 11px, curve to 28px 19px with 32px 15px / 28px 17px, curve to 30px 27px with 28px 21px / 30px 24px, line to 21px 32px, curve to 13px 28px with 18px 32px / 15px 28px, curve to 5px 30px with 10px 28px / 6px 30px, line to 0px 22px, curve to 4px 14px with 0px 18px / 4px 16px, curve to 1px 6px with 3px 12px / 1px 9px, close)',
  },
  'clean-gallery': {
    // A gallery mat with architectural cuts and one curved recess, in fixed px.
    frame:
      'shape(from 0px 28px, line to 28px 0px, line to calc(100% - 52px) 0px, line to 100% 52px, line to 100% calc(100% - 46px), line to calc(100% - 18px) calc(100% - 24px), curve to calc(100% - 42px) 100% with calc(100% - 18px) calc(100% - 24px) / calc(100% - 30px) 100%, line to 28px 100%, line to 0px calc(100% - 28px), close)',
    hero: 'shape(from 0px 34px, line to 34px 0px, line to calc(100% - 58px) 0px, line to 100% 58px, line to 100% calc(100% - 52px), line to calc(100% - 16px) calc(100% - 28px), curve to calc(100% - 46px) 100% with calc(100% - 18px) calc(100% - 28px) / calc(100% - 32px) 100%, line to 34px 100%, line to 0px calc(100% - 34px), close)',
    cover:
      'shape(from 0px 22px, line to 22px 0px, line to calc(100% - 26px) 0px, line to 100% 26px, line to 100% calc(100% - 28px), line to calc(100% - 28px) 100%, line to 24px 100%, line to 0px calc(100% - 24px), close)',
    panel: `shape(from 0px ${GALLERY_PANEL_CUT}, line to ${GALLERY_PANEL_CUT} 0px, line to calc(100% - ${GALLERY_PANEL_CUT}) 0px, line to 100% ${GALLERY_PANEL_CUT}, line to 100% calc(100% - ${GALLERY_PANEL_CUT}), line to calc(100% - 10px) calc(100% - 8px), curve to calc(100% - ${GALLERY_PANEL_CUT}) 100% with calc(100% - 8px) calc(100% - 4px) / calc(100% - ${GALLERY_PANEL_CUT}) 100%, line to ${GALLERY_PANEL_CUT} 100%, line to 0px calc(100% - ${GALLERY_PANEL_CUT}), close)`,
    panelAlt: `shape(from ${GALLERY_PANEL_CUT} 0px, line to calc(100% - ${GALLERY_PANEL_CUT}) 0px, line to 100% ${GALLERY_PANEL_CUT}, line to 100% calc(100% - ${GALLERY_PANEL_CUT}), line to calc(100% - ${GALLERY_PANEL_CUT}) 100%, line to ${GALLERY_PANEL_CUT} 100%, line to 0px calc(100% - ${GALLERY_PANEL_CUT}), line to 0px ${GALLERY_PANEL_CUT}, close)`,
    progress:
      'shape(from 8px 0px, line to calc(100% - 8px) 0px, line to 100% 100%, line to 8px 100%, line to 0px 0px, close)',
    tag: 'shape(from 8px 0px, line to calc(100% - 8px) 0px, line to 100% 50%, line to calc(100% - 8px) 100%, line to 8px 100%, line to 0px 50%, close)',
    title: 'none',
    badge:
      'shape(from 8px 0px, line to 24px 0px, line to 32px 8px, line to 32px 24px, line to 24px 32px, line to 8px 32px, line to 0px 24px, line to 0px 8px, close)',
  },
  'graphic-zine': {
    // A die-cut cover frame: offset paper teeth stay within the card's padding.
    frame:
      'shape(from 24px 0px, line to calc(100% - 40px) 0px, line to calc(100% - 24px) 12px, line to calc(100% - 12px) 4px, line to 100% 32px, line to calc(100% - 10px) 56px, line to 100% 72px, line to 100% calc(100% - 36px), line to calc(100% - 34px) calc(100% - 12px), line to calc(100% - 54px) 100%, line to 42px 100%, line to 28px calc(100% - 12px), line to 14px 100%, line to 0px calc(100% - 34px), line to 0px 24px, close)',
    hero: 'shape(from 18px 0px, line to calc(100% - 44px) 0px, line to calc(100% - 24px) 14px, line to calc(100% - 10px) 6px, line to 100% 38px, line to calc(100% - 12px) 62px, line to 100% 78px, line to 100% calc(100% - 30px), line to calc(100% - 30px) calc(100% - 10px), line to calc(100% - 50px) 100%, line to 54px 100%, line to 38px calc(100% - 12px), line to 22px 100%, line to 0px calc(100% - 40px), line to 0px 20px, close)',
    cover:
      'shape(from 16px 0px, line to calc(100% - 34px) 0px, line to calc(100% - 20px) 12px, line to calc(100% - 8px) 4px, line to 100% 30px, line to calc(100% - 8px) 48px, line to 100% calc(100% - 24px), line to calc(100% - 24px) 100%, line to 38px 100%, line to 26px calc(100% - 10px), line to 14px 100%, line to 0px calc(100% - 22px), line to 0px 16px, close)',
    panel: `shape(from ${ZINE_PANEL_CUT} 0px, line to calc(100% - 28px) 0px, line to calc(100% - 16px) 10px, line to calc(100% - 8px) 4px, line to 100% ${ZINE_PANEL_CUT}, line to calc(100% - 6px) calc(100% - 12px), line to 100% calc(100% - 6px), line to calc(100% - ${ZINE_PANEL_CUT}) 100%, line to 28px 100%, line to 18px calc(100% - 8px), line to 8px 100%, line to 0px calc(100% - ${ZINE_PANEL_CUT}), line to 0px ${ZINE_PANEL_CUT}, close)`,
    panelAlt: `shape(from 14px 0px, line to calc(100% - ${ZINE_PANEL_CUT}) 0px, line to 100% ${ZINE_PANEL_CUT}, line to 100% calc(100% - 20px), line to calc(100% - 18px) calc(100% - 8px), line to calc(100% - 8px) 100%, line to ${ZINE_PANEL_CUT} 100%, line to 8px calc(100% - 8px), line to 0px calc(100% - ${ZINE_PANEL_CUT}), line to 0px 22px, close)`,
    progress:
      'shape(from 8px 0px, line to calc(100% - 12px) 0px, line to 100% 5px, line to calc(100% - 8px) 100%, line to 10px 100%, line to 0px calc(100% - 5px), close)',
    tag: 'shape(from 8px 0px, line to calc(100% - 12px) 0px, line to 100% 8px, line to calc(100% - 5px) 100%, line to 6px 100%, line to 0px calc(100% - 8px), close)',
    title:
      'shape(from 0px 0px, line to calc(100% - 20px) 0px, line to 100% 18px, line to calc(100% - 8px) 100%, line to 0px 100%, close)',
    badge:
      'shape(from 11px 0px, line to 17px 4px, line to 23px 0px, line to 25px 7px, line to 32px 9px, line to 28px 16px, line to 32px 23px, line to 24px 25px, line to 22px 32px, line to 16px 28px, line to 9px 32px, line to 7px 24px, line to 0px 22px, line to 4px 16px, line to 0px 9px, line to 8px 7px, close)',
  },
};

const masksFor = (pack: RenderDesignPackName): DesignPackTokens['masks'] => DESIGN_MASKS[pack];

interface ThemePalette {
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
  shadow: string;
}

export interface ThemeTokens extends ThemePalette {
  designPack: RenderDesignPackName;
  design: DesignPackTokens;
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
}

const WARM_LIGHT_TONES: Record<SemanticToneName, SemanticToneTokens> = {
  coral: { foreground: '#a43a45', surface: '#f7e8e3', border: '#e8c9c1' },
  mint: { foreground: '#17695d', surface: '#e4efe8', border: '#bfd8cb' },
  butter: { foreground: '#795500', surface: '#f5edcf', border: '#e4d7a7' },
  plum: { foreground: '#70477c', surface: '#eee6f2', border: '#d9c6e1' },
  indigo: { foreground: '#40558b', surface: '#e7eaf5', border: '#c9d0e7' },
  blue: { foreground: '#3d6680', surface: '#e4edf2', border: '#c3d5df' },
};

const DARK_TONES: Record<SemanticToneName, SemanticToneTokens> = {
  coral: { foreground: '#ff9e9a', surface: '#463034', border: '#674249' },
  mint: { foreground: '#7bd7b8', surface: '#293d37', border: '#3c6256' },
  butter: { foreground: '#f1cc78', surface: '#423a2b', border: '#665637' },
  plum: { foreground: '#d2a5e2', surface: '#3d3045', border: '#60486a' },
  indigo: { foreground: '#aebaff', surface: '#303750', border: '#4d5c8b' },
  blue: { foreground: '#94c9e6', surface: '#2b3d49', border: '#42677d' },
};

const GALLERY_LIGHT_TONES: Record<SemanticToneName, SemanticToneTokens> = {
  coral: { foreground: '#99403f', surface: '#fbebea', border: '#ecc9c6' },
  mint: { foreground: '#155f4c', surface: '#e4f3ed', border: '#bfded1' },
  butter: { foreground: '#6f5000', surface: '#fff5d9', border: '#e9dba8' },
  plum: { foreground: '#62437d', surface: '#f1eafa', border: '#d9c9e9' },
  indigo: { foreground: '#3c5388', surface: '#e9eefb', border: '#ccd6ef' },
  blue: { foreground: '#145d87', surface: '#e4f3fa', border: '#b9dce9' },
};

const ZINE_LIGHT_TONES: Record<SemanticToneName, SemanticToneTokens> = {
  coral: { foreground: '#7b2522', surface: '#ffc9bb', border: '#d98576' },
  mint: { foreground: '#155b49', surface: '#e5f1e6', border: '#bed8c1' },
  butter: { foreground: '#624600', surface: '#ffe15a', border: '#c7a72a' },
  plum: { foreground: '#673c70', surface: '#f0e4f0', border: '#d7bfd9' },
  indigo: { foreground: '#354b80', surface: '#e7eaf5', border: '#c0cbe7' },
  blue: { foreground: '#1e4b86', surface: '#e3eff3', border: '#bed3da' },
};

const WARM_LIGHT: ThemePalette = {
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
  tones: WARM_LIGHT_TONES,
  shadow: '0 8px 24px -8px rgba(31, 41, 55, 0.12)',
};

const WARM_DARK: ThemePalette = {
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
  tones: DARK_TONES,
  shadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4)',
};

const DESIGN_PACKS: Record<RenderDesignPackName, DesignPackTokens> = {
  'warm-editorial': {
    name: 'warm-editorial',
    label: '暖调编辑',
    bodyFontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", "Meiryo", sans-serif',
    displayFontFamily:
      'Georgia, "Songti SC", "Noto Serif CJK SC", "Noto Serif CJK JP", "Hiragino Mincho ProN", serif',
    outerPadding: '12px',
    cardPadding: '24px',
    frameBorderWidth: '1px',
    frameRadius: '28px',
    titleScale: 1.08,
    titleWeight: 700,
    titleLetterSpacing: '-0.035em',
    iconStrokeWidth: 1.65,
    badgeRadius: '14px',
    coverRadius: '18px',
    coverBorderWidth: '1px',
    tagRadius: '999px',
    metricBorderWidth: '1px',
    markerStyle: 'editorial',
    masks: masksFor('warm-editorial'),
  },
  'clean-gallery': {
    name: 'clean-gallery',
    label: '清爽画廊',
    bodyFontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", "Meiryo", sans-serif',
    displayFontFamily:
      'Avenir Next, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Noto Sans CJK SC", sans-serif',
    outerPadding: '16px',
    cardPadding: '24px',
    frameBorderWidth: '1px',
    frameRadius: '4px',
    titleScale: 1.04,
    titleWeight: 650,
    titleLetterSpacing: '-0.018em',
    iconStrokeWidth: 1.55,
    badgeRadius: '4px',
    coverRadius: '2px',
    coverBorderWidth: '2px',
    tagRadius: '4px',
    metricBorderWidth: '1px',
    markerStyle: 'gallery',
    masks: masksFor('clean-gallery'),
  },
  'graphic-zine': {
    name: 'graphic-zine',
    label: '漫画杂志',
    bodyFontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", "Meiryo", sans-serif',
    displayFontFamily:
      'Impact, "Arial Black", "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif',
    outerPadding: '10px',
    cardPadding: '20px',
    frameBorderWidth: '2px',
    frameRadius: '4px',
    titleScale: 1.1,
    titleWeight: 900,
    titleLetterSpacing: '-0.045em',
    iconStrokeWidth: 2.35,
    badgeRadius: '2px',
    coverRadius: '2px',
    coverBorderWidth: '2px',
    tagRadius: '2px',
    metricBorderWidth: '2px',
    markerStyle: 'zine',
    masks: masksFor('graphic-zine'),
  },
};

const DESIGN_RADIUS: Record<RenderDesignPackName, ThemeTokens['radius']> = {
  'warm-editorial': { sm: '6px', md: '10px', lg: '16px', xl: '24px' },
  'clean-gallery': { sm: '3px', md: '5px', lg: '8px', xl: '10px' },
  'graphic-zine': { sm: '2px', md: '4px', lg: '6px', xl: '8px' },
};

const DESIGN_SPACING: Record<RenderDesignPackName, ThemeTokens['spacing']> = {
  'warm-editorial': { xs: '4px', sm: '8px', md: '16px', lg: '24px', xl: '32px' },
  'clean-gallery': { xs: '5px', sm: '10px', md: '18px', lg: '26px', xl: '34px' },
  'graphic-zine': { xs: '4px', sm: '8px', md: '14px', lg: '18px', xl: '24px' },
};

export function isRenderThemeName(value: unknown): value is RenderThemeName {
  return value === 'bangumi-dark' || value === 'bangumi-light';
}

export function isRenderDesignPackName(value: unknown): value is RenderDesignPackName {
  return (
    typeof value === 'string' && RENDER_DESIGN_PACK_NAMES.includes(value as RenderDesignPackName)
  );
}

function paletteFor(theme: RenderThemeName, designPack: RenderDesignPackName): ThemePalette {
  if (designPack === 'warm-editorial') return theme === 'bangumi-dark' ? WARM_DARK : WARM_LIGHT;

  if (designPack === 'clean-gallery' && theme === 'bangumi-light') {
    return {
      ...WARM_LIGHT,
      background: '#f5faff',
      surface: '#ffffff',
      surfaceAlt: '#edf5fa',
      border: '#d0e1eb',
      text: '#203140',
      textMuted: '#536776',
      accent: '#145d87',
      score: '#6f5000',
      success: '#155f4d',
      warning: '#91342d',
      tones: GALLERY_LIGHT_TONES,
      shadow: '0 8px 22px -10px rgba(42, 91, 122, 0.12)',
    };
  }

  if (designPack === 'graphic-zine' && theme === 'bangumi-light') {
    return {
      ...WARM_LIGHT,
      background: '#fffaf0',
      surface: '#fffef8',
      surfaceAlt: '#fff1cf',
      border: '#d7c8a4',
      text: '#292827',
      textMuted: '#5c5548',
      accent: '#1e4b86',
      score: '#96302b',
      success: '#155d4b',
      warning: '#91352c',
      tones: ZINE_LIGHT_TONES,
      shadow: '4px 4px 0 rgba(40, 50, 70, 0.12)',
    };
  }

  if (designPack === 'clean-gallery') {
    return {
      ...WARM_DARK,
      background: '#101923',
      surface: '#192735',
      surfaceAlt: '#243746',
      border: '#3b5b70',
      text: '#f5fbff',
      textMuted: '#c0d0da',
      accent: '#83c8ed',
      score: '#ffe18a',
      success: '#83dfbd',
      warning: '#ffaaa1',
      shadow: '0 10px 24px -10px rgba(0, 0, 0, 0.5)',
    };
  }

  return {
    ...WARM_DARK,
    background: '#171a29',
    surface: '#24273a',
    surfaceAlt: '#32354a',
    border: '#55586e',
    text: '#fffaf2',
    textMuted: '#d0c9bc',
    accent: '#8bc6ff',
    score: '#ff8e84',
    success: '#8ce1b5',
    warning: '#ffaaa1',
    shadow: '4px 4px 0 rgba(0, 0, 0, 0.3)',
  };
}

export function getThemeTokens(
  theme: RenderThemeName = DEFAULT_RENDER_THEME,
  designPack: RenderDesignPackName = DEFAULT_RENDER_DESIGN_PACK,
): ThemeTokens {
  return {
    ...paletteFor(theme, designPack),
    designPack,
    design: DESIGN_PACKS[designPack],
    radius: DESIGN_RADIUS[designPack],
    spacing: DESIGN_SPACING[designPack],
  };
}

export const DARK_THEME = getThemeTokens('bangumi-dark');
export const LIGHT_THEME = getThemeTokens('bangumi-light');
