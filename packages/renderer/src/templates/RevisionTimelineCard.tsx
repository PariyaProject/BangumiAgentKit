import React from 'react';
import { CardFrame } from '../components/CardFrame.js';
import { RendererIcon, type RendererIconName } from '../components/RendererIcon.js';
import { TitleBlock } from '../components/TitleBlock.js';
import { Footer } from '../components/Footer.js';
import { SemanticToneName, ThemeTokens } from '../themes/index.js';
import { RevisionTimelineViewModel } from '../view-models/index.js';

export interface RevisionTimelineCardProps {
  viewModel: RevisionTimelineViewModel;
  theme: ThemeTokens;
  width?: number;
}

const ENTITY_LABELS: Record<RevisionTimelineViewModel['entityType'], string> = {
  subject: '条目',
  episode: '章节',
  character: '角色',
  person: '人物',
};

interface RevisionTypePresentation {
  label: string;
  icon: RendererIconName;
  tone: SemanticToneName;
}

const REVISION_TYPE_PRESENTATION: Readonly<Record<number, RevisionTypePresentation>> = {
  1: { label: '条目修订', icon: 'subject', tone: 'coral' },
  2: { label: '角色修订', icon: 'cast', tone: 'plum' },
  3: { label: '人物修订', icon: 'person', tone: 'blue' },
  4: { label: '角色关联修订', icon: 'relations', tone: 'mint' },
  5: { label: '条目角色关联修订', icon: 'relations', tone: 'mint' },
  6: { label: '条目声优关联修订', icon: 'cast', tone: 'plum' },
  7: { label: '角色声优关联修订', icon: 'cast', tone: 'plum' },
  8: { label: '人物声优关联修订', icon: 'cast', tone: 'plum' },
  9: { label: '人物条目关联修订', icon: 'relations', tone: 'mint' },
  10: { label: '条目人物关联修订', icon: 'person', tone: 'blue' },
  11: { label: '条目合并管理', icon: 'merge', tone: 'plum' },
  12: { label: '条目删除管理', icon: 'erase', tone: 'coral' },
  13: { label: '角色合并管理', icon: 'merge', tone: 'plum' },
  14: { label: '角色删除管理', icon: 'erase', tone: 'coral' },
  15: { label: '人物合并管理', icon: 'merge', tone: 'plum' },
  16: { label: '人物删除管理', icon: 'erase', tone: 'coral' },
  17: { label: '条目关联修订', icon: 'relations', tone: 'mint' },
  18: { label: '章节修订', icon: 'episode', tone: 'blue' },
  103: { label: '条目锁定', icon: 'lock', tone: 'indigo' },
  104: { label: '条目解锁', icon: 'unlock', tone: 'mint' },
  181: { label: '章节合并管理', icon: 'merge', tone: 'plum' },
  182: { label: '章节移动管理', icon: 'move', tone: 'blue' },
  183: { label: '章节锁定', icon: 'lock', tone: 'indigo' },
  184: { label: '章节解锁', icon: 'unlock', tone: 'mint' },
  185: { label: '章节删除管理', icon: 'erase', tone: 'coral' },
};

function revisionTypePresentation(type: number): RevisionTypePresentation {
  return (
    REVISION_TYPE_PRESENTATION[type] ?? {
      label: '未分类修订类型',
      icon: 'history',
      tone: 'indigo',
    }
  );
}

function formatRevisionTimestamp(value?: string, includeMidnightTime = false): string {
  if (!value) return '创建时间未知';
  const isoDate =
    /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?/u.exec(
      value,
    );
  if (!isoDate) return value;

  const [, year, month, day, hour, minute, rawZone] = isoDate;
  if (
    !hour ||
    (!includeMidnightTime &&
      hour === '00' &&
      minute === '00' &&
      (!rawZone || rawZone === 'Z' || rawZone === '+00:00' || rawZone === '+0000'))
  ) {
    return `${year}-${month}-${day}`;
  }
  const zone = rawZone === 'Z' ? ' UTC' : rawZone ? ` ${rawZone}` : '';
  return `${year}-${month}-${day} ${hour}:${minute}${zone}`;
}

export const RevisionTimelineCard: React.FC<RevisionTimelineCardProps> = ({
  viewModel,
  theme,
  width,
}) => {
  const renderWidth = width ?? 960;
  const gallery = theme.designPack === 'clean-gallery';
  const zine = theme.designPack === 'graphic-zine';
  const narrow = renderWidth < 360;
  const timelineLimit = renderWidth < 520 ? 4 : renderWidth < 900 ? 6 : 10;
  const summaryLimit = narrow ? 72 : renderWidth < 520 ? 100 : 300;
  const items = viewModel.items.slice(0, timelineLimit);
  const stateLabel =
    viewModel.state === 'complete'
      ? '覆盖完整'
      : viewModel.state === 'partial'
        ? '部分覆盖'
        : '不可用';
  return (
    <CardFrame theme={theme} width={width}>
      <TitleBlock
        title="Bangumi 修订历史"
        subtitle={`${ENTITY_LABELS[viewModel.entityType]} ${viewModel.entityId} · ${stateLabel}`}
        theme={theme}
        icon="history"
        titleMaxLines={2}
      />

      <div
        data-layout="timeline-coverage"
        role="group"
        aria-label="修订覆盖信息"
        style={{
          display: renderWidth <= 360 ? 'grid' : 'flex',
          gridTemplateColumns: renderWidth <= 360 ? 'repeat(2, minmax(0, 1fr))' : undefined,
          flexWrap: renderWidth <= 360 ? undefined : 'wrap',
          alignItems: 'stretch',
          gap: theme.spacing.xs,
          color: theme.textMuted,
          fontSize: '11px',
          lineHeight: 1.35,
        }}
      >
        {[
          `观察 ${viewModel.coverage.observed} 条`,
          `返回 ${viewModel.coverage.returned} 条`,
          `图片显示 ${items.length} 条`,
          `总数 ${viewModel.coverage.totalKind === 'exact' ? viewModel.coverage.total : '未知'}`,
          ...(viewModel.coverage.truncated ? ['有界样本'] : []),
        ].map((item) => (
          <span
            key={item}
            data-layout="timeline-coverage-item"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 0,
              whiteSpace: 'nowrap',
              padding: '3px 8px',
              color: zine ? theme.text : theme.textMuted,
              backgroundColor: zine
                ? theme.tones.butter.surface
                : gallery
                  ? theme.surface
                  : theme.surfaceAlt,
              border: `${zine ? '2px' : '1px'} solid ${zine ? theme.text : theme.border}`,
              borderRadius: zine ? theme.design.badgeRadius : gallery ? '2px' : '999px',
              boxShadow: zine ? `2px 2px 0 ${theme.border}` : undefined,
            }}
          >
            {item}
          </span>
        ))}
      </div>

      {viewModel.state === 'unavailable' || viewModel.items.length === 0 ? (
        <div
          data-render-mask="panel"
          style={{
            color: theme.warning,
            backgroundColor: theme.surfaceAlt,
            border: `1px solid ${theme.border}`,
            borderRadius: theme.radius.md,
            padding: theme.spacing.md,
            fontSize: '12px',
            clipPath: theme.design.masks.panel,
          }}
        >
          {viewModel.state === 'unavailable'
            ? '官方修订源暂时不可用，未生成变更历史样本。'
            : '本次官方分页没有可展示的修订记录。'}
        </div>
      ) : null}

      <div
        data-layout="timeline-rail"
        role="list"
        aria-label="Bangumi 修订记录时间线"
        style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}
      >
        {items.map((item, index) => {
          const presentation = revisionTypePresentation(item.type);
          const toneName = presentation.tone;
          const tone = theme.tones[toneName];
          const summary = item.summary || '修订摘要未知';
          const summaryCharacters = Array.from(summary);
          const summaryExcerpt = summaryCharacters.slice(0, summaryLimit).join('');
          const summaryTruncated = summaryCharacters.length > summaryLimit;
          return (
            <div
              key={item.id}
              role="listitem"
              data-timeline-pack={theme.designPack}
              style={{
                display: 'grid',
                gridTemplateColumns: gallery
                  ? '32px minmax(0, 1fr)'
                  : zine
                    ? '38px minmax(0, 1fr)'
                    : '32px minmax(0, 1fr)',
                gap: theme.spacing.sm,
                minWidth: 0,
              }}
            >
              <div
                data-layout="timeline-event-marker"
                aria-hidden="true"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  minHeight: '100%',
                }}
              >
                <RendererIcon
                  name={presentation.icon}
                  theme={theme}
                  size={16}
                  badge
                  tone={toneName}
                />
                {index < items.length - 1 ? (
                  <div
                    style={{
                      flex: 1,
                      width: '2px',
                      minHeight: theme.spacing.md,
                      backgroundColor: tone.border,
                    }}
                  />
                ) : null}
              </div>
              <article
                data-render-mask="panel"
                style={{
                  minWidth: 0,
                  backgroundColor: gallery ? theme.surface : theme.surfaceAlt,
                  border: gallery
                    ? '0'
                    : `${zine ? '2px' : '1px'} solid ${zine ? tone.foreground : theme.border}`,
                  borderBottom: gallery ? `1px solid ${theme.border}` : undefined,
                  borderLeft: zine ? `5px solid ${tone.foreground}` : undefined,
                  borderRadius: gallery ? '0' : zine ? theme.design.badgeRadius : theme.radius.md,
                  clipPath: theme.design.masks.panel,
                  boxShadow: zine ? `3px 3px 0 ${tone.border}` : undefined,
                  padding: theme.spacing.md,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: theme.spacing.xs,
                }}
              >
                <div
                  data-layout="timeline-event-meta"
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: `0 ${theme.spacing.sm}`,
                    minWidth: 0,
                    color: theme.textMuted,
                    fontSize: '11px',
                  }}
                >
                  <span
                    style={{
                      color: tone.foreground,
                      backgroundColor: zine ? theme.surface : tone.surface,
                      border: zine ? `2px solid ${tone.foreground}` : undefined,
                      borderRadius: zine ? theme.design.badgeRadius : gallery ? '0' : '999px',
                      clipPath: zine ? 'polygon(0 0, 100% 0, 94% 100%, 0 100%)' : undefined,
                      padding: '3px 8px',
                      fontSize: '11px',
                      fontWeight: 700,
                    }}
                  >
                    {formatRevisionTimestamp(item.createdAt)}
                  </span>
                  <span
                    data-layout="timeline-event-meta-item"
                    style={{ whiteSpace: 'nowrap', padding: '3px 0' }}
                  >
                    {presentation.label} · 类型 {item.type}
                  </span>
                  <span
                    data-layout="timeline-event-meta-item"
                    style={{ whiteSpace: 'nowrap', padding: '3px 0' }}
                  >
                    修订 ID {item.id}
                  </span>
                </div>
                {summaryTruncated ? (
                  <div style={{ color: theme.accent, fontSize: '10px', fontWeight: 700 }}>
                    摘要节选 · 前 {summaryLimit} 字符
                  </div>
                ) : null}
                <div
                  data-layout="timeline-summary"
                  style={{
                    color: theme.text,
                    fontFamily: zine ? theme.design.displayFontFamily : theme.design.bodyFontFamily,
                    fontWeight: zine ? 700 : 600,
                    fontSize: zine ? (narrow ? '14px' : '15px') : narrow ? '13px' : '14px',
                    lineHeight: 1.45,
                    overflowWrap: 'anywhere',
                    wordBreak: 'break-word',
                  }}
                >
                  {summaryExcerpt}
                  {summaryTruncated ? '…' : ''}
                </div>
                <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.4 }}>
                  修订者：{item.creator?.nickname || item.creator?.username || '未知'}
                </div>
              </article>
            </div>
          );
        })}
      </div>

      {viewModel.coverage.returned > items.length ? (
        <div style={{ color: theme.textMuted, fontSize: '11px' }}>
          另有 {viewModel.coverage.returned - items.length} 条已返回修订记录未在图片中展示。
        </div>
      ) : null}

      {viewModel.coverage.missingFields &&
      Object.keys(viewModel.coverage.missingFields).length > 0 ? (
        <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.5 }}>
          字段未知：
          {Object.entries(viewModel.coverage.missingFields)
            .map(([field, count]) => `${field} ${count}`)
            .join('、')}
        </div>
      ) : null}

      {viewModel.coverage.truncatedFields &&
      Object.keys(viewModel.coverage.truncatedFields).length > 0 ? (
        <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.5 }}>
          字段已裁剪：
          {Object.entries(viewModel.coverage.truncatedFields)
            .map(([field, count]) => `${field} ${count}`)
            .join('、')}
        </div>
      ) : null}

      {viewModel.capabilityStates.historical_growth === 'not_computable' ? (
        <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.5 }}>
          历史增长趋势：当前源不支持计算。
        </div>
      ) : null}

      {viewModel.warnings.length > 0 ? (
        <div style={{ color: theme.warning, fontSize: '11px', lineHeight: 1.5 }}>
          {viewModel.warnings.map((warning) => warning.message).join('；')}
        </div>
      ) : null}
      {viewModel.limitations.length > 0 ? (
        <div style={{ color: theme.textMuted, fontSize: '10px', lineHeight: 1.5 }}>
          限制：{viewModel.limitations[0]}
        </div>
      ) : null}
      {viewModel.source ? (
        <div
          data-layout="timeline-source-info"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'baseline',
            gap: `${theme.spacing.xs} ${theme.spacing.sm}`,
            color: theme.textMuted,
            fontSize: '10px',
            lineHeight: 1.4,
            minWidth: 0,
          }}
        >
          <span
            data-layout="timeline-source-descriptor"
            style={{ minWidth: 0, overflowWrap: 'anywhere' }}
          >
            来源：{viewModel.source.label} · {viewModel.source.operation}
          </span>
          {viewModel.source.retrievedAt ? (
            <span data-layout="timeline-source-timestamp" style={{ whiteSpace: 'nowrap' }}>
              获取于 {formatRevisionTimestamp(viewModel.source.retrievedAt, true)}
            </span>
          ) : viewModel.source.attemptedAt ? (
            <span data-layout="timeline-source-timestamp" style={{ whiteSpace: 'nowrap' }}>
              尝试于 {formatRevisionTimestamp(viewModel.source.attemptedAt, true)}
            </span>
          ) : null}
        </div>
      ) : null}

      <Footer theme={theme} />
    </CardFrame>
  );
};
