import React from 'react';
import type { ThemeTokens } from '../themes/index.js';

export type RendererIconName =
  | 'subject'
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
  | 'comparison';

const iconLabels: Record<RendererIconName, string> = {
  subject: '条目档案',
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
};

export function getRendererIconLabel(name: RendererIconName): string {
  return iconLabels[name];
}

const iconPaths: Record<RendererIconName, React.ReactNode> = {
  subject: (
    <>
      <rect x="4" y="3.5" width="16" height="17" rx="2.2" />
      <path d="M8 7.5h8M8 11h8M8 14.5h5" />
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
};

export interface RendererIconProps {
  name: RendererIconName;
  theme: ThemeTokens;
  size?: number;
  badge?: boolean;
}

export const RendererIcon: React.FC<RendererIconProps> = ({
  name,
  theme,
  size = 18,
  badge = false,
}) => (
  <span
    aria-hidden="true"
    style={{
      width: badge ? 32 : size,
      height: badge ? 32 : size,
      flex: `0 0 ${badge ? 32 : size}px`,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: theme.accent,
      borderRadius: badge ? theme.radius.sm : undefined,
      backgroundColor: badge ? theme.surfaceAlt : undefined,
      border: badge ? `1px solid ${theme.border}` : undefined,
    }}
  >
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {iconPaths[name]}
    </svg>
  </span>
);
