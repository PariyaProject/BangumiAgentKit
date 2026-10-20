import React from 'react';
import type { SemanticToneName, ThemeTokens } from '../themes/index.js';

export type RendererIconName =
  | 'subject'
  | 'screen'
  | 'cast'
  | 'person'
  | 'calendar'
  | 'collection'
  | 'stats'
  | 'history'
  | 'search'
  | 'discovery'
  | 'relations'
  | 'integrity'
  | 'episode'
  | 'tag'
  | 'overview'
  | 'comparison'
  | 'edit'
  | 'merge'
  | 'erase'
  | 'lock'
  | 'unlock'
  | 'move';

const iconLabels: Record<RendererIconName, string> = {
  subject: '条目档案',
  screen: '作品类型',
  cast: '角色与声优',
  person: '人物档案',
  calendar: '放送日历',
  collection: '收藏进度',
  stats: '统计观察',
  history: '历史记录',
  search: '条目搜索',
  discovery: '条目发现',
  relations: '关联关系',
  integrity: '来源完整性',
  episode: '章节指南',
  tag: '标签观察',
  overview: '信息总览',
  comparison: '条目比较',
  edit: '内容修订',
  merge: '合并管理',
  erase: '删除管理',
  lock: '锁定管理',
  unlock: '解锁管理',
  move: '移动管理',
};

export function getRendererIconLabel(name: RendererIconName): string {
  return iconLabels[name];
}

const iconTones: Record<RendererIconName, SemanticToneName> = {
  subject: 'coral',
  screen: 'blue',
  cast: 'plum',
  person: 'blue',
  calendar: 'butter',
  collection: 'mint',
  stats: 'coral',
  history: 'indigo',
  search: 'blue',
  discovery: 'plum',
  relations: 'mint',
  integrity: 'mint',
  episode: 'blue',
  tag: 'butter',
  overview: 'coral',
  comparison: 'indigo',
  edit: 'coral',
  merge: 'plum',
  erase: 'coral',
  lock: 'indigo',
  unlock: 'mint',
  move: 'blue',
};

export function getRendererIconTone(name: RendererIconName): SemanticToneName {
  return iconTones[name];
}

const iconPaths: Record<RendererIconName, React.ReactNode> = {
  subject: (
    <>
      <rect x="4" y="3.5" width="16" height="17" rx="2.2" />
      <path d="M8 7.5h8M8 11h8M8 14.5h5" />
    </>
  ),
  screen: (
    <>
      <rect x="3.5" y="7" width="17" height="12" rx="1.8" />
      <path d="m8 3.5 4 3 4-3M7 15h3m4 0h3" />
    </>
  ),
  cast: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.8 19v-1.2a4.2 4.2 0 0 1 4.2-4.2h2a4.2 4.2 0 0 1 4.2 4.2V19M16 5.4a3 3 0 0 1 0 5.7M17 13.7a4 4 0 0 1 3.2 3.9V19" />
    </>
  ),
  person: (
    <>
      <circle cx="12" cy="7.5" r="3.5" />
      <path d="M4.5 20v-1.7a5.8 5.8 0 0 1 5.8-5.8h3.4a5.8 5.8 0 0 1 5.8 5.8V20" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M7.5 3.5v3M16.5 3.5v3M3.5 9h17M8 12.5h2M14 12.5h2M8 16h2" />
    </>
  ),
  collection: (
    <>
      <path d="M6 4.5h12a1.5 1.5 0 0 1 1.5 1.5v14L12 16l-7.5 4V6A1.5 1.5 0 0 1 6 4.5Z" />
      <path d="M8.5 8h7M8.5 11h7" />
    </>
  ),
  stats: (
    <>
      <path d="M4 20V11M9.3 20V5M14.7 20V8M20 20V3.5M3 20.5h18" />
    </>
  ),
  history: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5l3.5 2M5.4 5.8 3.5 4v4.3h4.2" />
    </>
  ),
  search: (
    <>
      <circle cx="10.8" cy="10.8" r="6.8" />
      <path d="m16 16 4.3 4.3" />
    </>
  ),
  discovery: (
    <>
      <path d="m12 2.8 1.8 6.1 6.1 1.8-6.1 1.8-1.8 6.1-1.8-6.1-6.1-1.8 6.1-1.8L12 2.8ZM19 16.5l.6 2.2 2.2.6-2.2.6-.6 2.2-.6-2.2-2.2-.6 2.2-.6.6-2.2Z" />
    </>
  ),
  relations: (
    <>
      <circle cx="6" cy="12" r="2.2" />
      <circle cx="18" cy="6" r="2.2" />
      <circle cx="18" cy="18" r="2.2" />
      <path d="m8 11 7.8-4M8 13l7.8 4" />
    </>
  ),
  integrity: (
    <>
      <path d="M12 3 19 6v5.2c0 4.3-2.8 7.8-7 9.8-4.2-2-7-5.5-7-9.8V6l7-3Z" />
      <path d="m8.5 12 2.3 2.3 4.8-5" />
    </>
  ),
  episode: (
    <>
      <rect x="3.5" y="5" width="17" height="14" rx="2" />
      <path d="m10 8.5 5.5 3.5-5.5 3.5v-7Z" fill="currentColor" stroke="none" />
    </>
  ),
  tag: (
    <>
      <path d="M3.5 12V5.5h6.8l10.2 10.2-4.8 4.8L5.5 10.3" />
      <circle cx="7.3" cy="7.3" r=".8" fill="currentColor" />
    </>
  ),
  overview: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="1.4" />
      <rect x="13" y="4" width="7" height="4" rx="1.2" />
      <rect x="13" y="10" width="7" height="10" rx="1.4" />
      <rect x="4" y="13" width="7" height="7" rx="1.4" />
    </>
  ),
  comparison: (
    <>
      <path d="M5 7h13M14.5 3.5 18 7l-3.5 3.5M19 17H6M9.5 13.5 6 17l3.5 3.5" />
    </>
  ),
  edit: (
    <>
      <path d="m4 16.8-.9 4.1 4.1-.9L19 8.2 15.8 5 4 16.8Z" />
      <path d="m13.8 7 3.2 3.2M4 17l3 3" />
    </>
  ),
  merge: (
    <>
      <circle cx="6" cy="6" r="2" />
      <circle cx="6" cy="18" r="2" />
      <circle cx="18" cy="12" r="2" />
      <path d="M8 6h2a4 4 0 0 1 4 4v2M8 18h2a4 4 0 0 0 4-4v-2" />
    </>
  ),
  erase: (
    <>
      <path d="M4 7h16M9 7V4h6v3M6.5 7l1 13h9l1-13M10 11v5M14 11v5" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="10" width="14" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
    </>
  ),
  unlock: (
    <>
      <rect x="5" y="10" width="14" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 7-2.7M12 14v3" />
    </>
  ),
  move: (
    <>
      <path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M21 12l-3-3M21 12l-3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3" />
    </>
  ),
};

const galleryIconPaths: Partial<Record<RendererIconName, React.ReactNode>> = {
  subject: (
    <>
      <rect x="5" y="3.5" width="14" height="17" />
      <path d="M8 8h8M8 11.5h8M8 15h5" />
    </>
  ),
  screen: (
    <>
      <rect x="3.5" y="7" width="17" height="12" />
      <path d="m8 3.5 4 3.5 4-3.5M7 15h3m4 0h3" />
    </>
  ),
  cast: (
    <>
      <circle cx="8.5" cy="8" r="3" />
      <path d="M3.5 20v-1.4a5 5 0 0 1 5-5h1a5 5 0 0 1 5 5V20M16 5.5a3 3 0 0 1 0 5.5M17 14a4 4 0 0 1 3.5 4v2" />
    </>
  ),
  person: (
    <>
      <circle cx="12" cy="7.5" r="3.5" />
      <path d="M4.5 20v-1.8a6 6 0 0 1 6-6h3a6 6 0 0 1 6 6V20" />
    </>
  ),
  calendar: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" />
      <path d="M7.5 3.5v3M16.5 3.5v3M3.5 9h17M8 12h2v2H8zM14 12h2v2h-2zM8 16h2v2H8z" />
    </>
  ),
  collection: (
    <>
      <path d="M6 4h12v16l-6-3.5L6 20z" />
      <path d="M9 8h6M9 11h6" />
    </>
  ),
  stats: (
    <>
      <rect x="4" y="12" width="3.5" height="8" />
      <rect x="10.25" y="6" width="3.5" height="14" />
      <rect x="16.5" y="3.5" width="3.5" height="16.5" />
    </>
  ),
  history: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5h4" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m15.5 15.5 5 5" />
    </>
  ),
  episode: (
    <>
      <rect x="3.5" y="5" width="17" height="14" />
      <path d="m10 8.5 5.5 3.5-5.5 3.5z" />
    </>
  ),
  overview: (
    <>
      <rect x="4" y="4" width="7" height="7" />
      <rect x="13" y="4" width="7" height="4" />
      <rect x="13" y="10" width="7" height="10" />
      <rect x="4" y="13" width="7" height="7" />
    </>
  ),
  comparison: <path d="M4 7h14m-4-4 4 4-4 4M20 17H6m4-4-4 4 4 4" />,
};

const zineIconRenderers: Record<RendererIconName, (cutout: string) => React.ReactNode> = {
  subject: (cutout) => (
    <>
      <path d="M4 3h10l6 6v12H4z" />
      <path d="M8 9h8M8 12.5h8M8 16h5" fill="none" stroke={cutout} strokeWidth="2" />
    </>
  ),
  screen: (cutout) => (
    <>
      <path d="M3 7h18v12H3z" />
      <path d="m8 4 4 3 4-3M7 15h3m4 0h3" fill="none" stroke={cutout} strokeWidth="2" />
    </>
  ),
  cast: () => (
    <>
      <circle cx="8" cy="7.5" r="3.5" />
      <path d="M1.5 20v-1.2A6.5 6.5 0 0 1 8 12.3a6.5 6.5 0 0 1 6.5 6.5V20z" />
      <circle cx="17.5" cy="8.5" r="2.7" />
      <path d="M15 13.2a6 6 0 0 1 7.5 5.8V20h-6" />
    </>
  ),
  person: () => (
    <>
      <circle cx="12" cy="7.5" r="4" />
      <path d="M3.5 21v-1.5a8.5 8.5 0 0 1 17 0V21z" />
    </>
  ),
  calendar: (cutout) => (
    <>
      <rect x="3" y="5" width="18" height="16" rx="1" />
      <path d="M3 9h18M7 3v4M17 3v4" fill="none" stroke={cutout} strokeWidth="2" />
      <circle cx="8" cy="13" r="1" fill={cutout} stroke="none" />
      <circle cx="12" cy="13" r="1" fill={cutout} stroke="none" />
      <circle cx="16" cy="13" r="1" fill={cutout} stroke="none" />
      <circle cx="8" cy="17" r="1" fill={cutout} stroke="none" />
      <circle cx="12" cy="17" r="1" fill={cutout} stroke="none" />
    </>
  ),
  collection: (cutout) => (
    <>
      <path d="M5 3.5h14v18l-7-4.5-7 4.5z" />
      <path d="M8 8h8M8 11h8" fill="none" stroke={cutout} strokeWidth="2" />
    </>
  ),
  stats: () => (
    <>
      <rect x="3.5" y="12" width="4" height="8" />
      <rect x="10" y="6" width="4" height="14" />
      <rect x="16.5" y="3" width="4" height="17" />
    </>
  ),
  history: (cutout) => (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 6.5v5.8l4.4 2.2" fill="none" stroke={cutout} strokeWidth="2.4" />
    </>
  ),
  search: (cutout) => (
    <>
      <circle cx="10.5" cy="10.5" r="7" />
      <circle cx="10.5" cy="10.5" r="3.2" fill={cutout} stroke="none" />
      <path d="m15.5 15.5 5.3 5.3" fill="none" stroke="currentColor" strokeWidth="3.2" />
    </>
  ),
  discovery: () => (
    <>
      <path d="m12 2.5 2.1 6.8 6.9 2.2-6.9 2.1-2.1 6.9-2.1-6.9L3 11.5l6.9-2.2z" />
      <path d="m19 16 .8 2.2 2.2.8-2.2.8L19 22l-.8-2.2-2.2-.8 2.2-.8z" />
    </>
  ),
  relations: () => (
    <>
      <path d="m7.5 11 7.8-4M7.5 13l7.8 4" fill="none" stroke="currentColor" strokeWidth="3" />
      <circle cx="5.5" cy="12" r="3.2" />
      <circle cx="18.5" cy="5.5" r="3.2" />
      <circle cx="18.5" cy="18.5" r="3.2" />
    </>
  ),
  integrity: (cutout) => (
    <>
      <path d="m12 2.5 8 3.4v5.4c0 4.6-3.1 8.3-8 10.7-4.9-2.4-8-6.1-8-10.7V5.9z" />
      <path d="m8.1 12 2.5 2.6 5.5-5.6" fill="none" stroke={cutout} strokeWidth="2.6" />
    </>
  ),
  episode: (cutout) => (
    <>
      <rect x="3" y="5" width="18" height="14" rx="1" />
      <path d="m10 8 6 4-6 4z" fill={cutout} stroke="none" />
    </>
  ),
  tag: (cutout) => (
    <>
      <path d="M3 12V4h8l10 10-7 7z" />
      <circle cx="7" cy="8" r="1.4" fill={cutout} stroke="none" />
    </>
  ),
  overview: () => (
    <>
      <rect x="3.5" y="3.5" width="8" height="8" />
      <rect x="13" y="3.5" width="7.5" height="5" />
      <rect x="13" y="10.5" width="7.5" height="10" />
      <rect x="3.5" y="13" width="8" height="7.5" />
    </>
  ),
  comparison: () => (
    <>
      <path d="M3 6h15l-4-4h4l5 5-5 5h-4l4-4H3zM21 18H6l4 4H6l-5-5 5-5h4l-4 4h15z" />
    </>
  ),
  edit: () => <path d="m4 16.5 11-12 5.5 5.5-11 12L3 23zM13.5 7l5.5 5.5" />,
  merge: () => (
    <>
      <path
        d="M7 6h3a5 5 0 0 1 5 5v2a5 5 0 0 0 5 5h1"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
      />
      <path d="M18 15l4 3-4 3z" />
      <circle cx="5" cy="6" r="3" />
      <circle cx="5" cy="18" r="3" />
    </>
  ),
  erase: (cutout) => (
    <>
      <path d="M5 7h14l-1 14H6zM8 4h8l1 3H7z" />
      <path d="M10 11v6M14 11v6" fill="none" stroke={cutout} strokeWidth="2" />
    </>
  ),
  lock: (cutout) => (
    <>
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path
        d="M7.5 10V7a4.5 4.5 0 0 1 9 0v3M12 14v3"
        fill="none"
        stroke={cutout}
        strokeWidth="2.2"
      />
    </>
  ),
  unlock: (cutout) => (
    <>
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path
        d="M7.5 10V7a4.5 4.5 0 0 1 8.1-2.7M12 14v3"
        fill="none"
        stroke={cutout}
        strokeWidth="2.2"
      />
    </>
  ),
  move: () => (
    <>
      <path d="M12 2 7 7h3v4H6V8l-5 4 5 4v-3h4v4H7l5 5 5-5h-3v-4h4v3l5-4-5-4v3h-4V7h3z" />
    </>
  ),
};

export interface RendererIconProps {
  name: RendererIconName;
  theme: ThemeTokens;
  size?: number;
  badge?: boolean;
  tone?: SemanticToneName;
}

export const RendererIcon: React.FC<RendererIconProps> = ({
  name,
  theme,
  size = 18,
  badge = false,
  tone,
}) => {
  const toneTokens = theme.tones[tone ?? getRendererIconTone(name)];
  const pack = theme.designPack;
  const badgeBackground =
    pack === 'graphic-zine'
      ? toneTokens.foreground
      : pack === 'clean-gallery'
        ? theme.surface
        : toneTokens.surface;
  const badgeBorder =
    pack === 'graphic-zine' ? `2px solid ${theme.text}` : `1px solid ${toneTokens.border}`;
  const treatment =
    pack === 'graphic-zine'
      ? 'zine-filled'
      : pack === 'clean-gallery'
        ? 'gallery-geometry'
        : 'editorial-stamp';
  const iconCutout = badge ? badgeBackground : theme.surface;
  const iconContent =
    pack === 'graphic-zine'
      ? zineIconRenderers[name](iconCutout)
      : pack === 'clean-gallery'
        ? (galleryIconPaths[name] ?? iconPaths[name])
        : iconPaths[name];

  return (
    <span
      aria-hidden="true"
      data-tone={tone ?? getRendererIconTone(name)}
      data-icon-pack={pack}
      data-icon-treatment={treatment}
      data-icon-mask={badge ? 'badge' : undefined}
      style={{
        width: badge ? 32 : size,
        height: badge ? 32 : size,
        flex: `0 0 ${badge ? 32 : size}px`,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: badge && pack === 'graphic-zine' ? theme.surface : toneTokens.foreground,
        borderRadius: badge ? theme.design.badgeRadius : undefined,
        backgroundColor: badge ? badgeBackground : undefined,
        border: badge ? badgeBorder : undefined,
        clipPath: badge ? theme.design.masks.badge : undefined,
        boxShadow: badge && pack === 'graphic-zine' ? `2px 2px 0 ${toneTokens.border}` : undefined,
      }}
    >
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill={pack === 'graphic-zine' ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={theme.design.iconStrokeWidth}
        strokeLinecap={pack === 'clean-gallery' ? 'square' : 'round'}
        strokeLinejoin={pack === 'clean-gallery' ? 'miter' : 'round'}
        shapeRendering={pack === 'clean-gallery' ? 'geometricPrecision' : undefined}
      >
        {iconContent}
      </svg>
    </span>
  );
};
