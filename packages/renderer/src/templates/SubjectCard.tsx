import React from 'react';
import type { SubjectCardViewModel } from '../view-models/index.js';
import type { ThemeTokens } from '../themes/index.js';
import { CardFrame } from '../components/CardFrame.js';
import { CoverImage } from '../components/CoverImage.js';
import { TitleBlock } from '../components/TitleBlock.js';
import { MetaRow } from '../components/MetaRow.js';
import { ScoreBadge } from '../components/ScoreBadge.js';
import { TagList } from '../components/TagList.js';
import { Footer } from '../components/Footer.js';
import { RendererIcon } from '../components/RendererIcon.js';
import { subjectTypeLabel } from '../subject-type-label.js';

export interface SubjectCardProps {
  viewModel: SubjectCardViewModel;
  theme: ThemeTokens;
  resolvedImages?: Record<string, string>;
  width?: number;
}

export const SubjectCard: React.FC<SubjectCardProps> = ({
  viewModel,
  theme,
  resolvedImages = {},
  width,
}) => {
  const { subject, collection, source } = viewModel;
  const displayTitle = subject.nameCn || subject.name;
  const originalTitle = subject.name.trim() !== displayTitle.trim() ? subject.name : undefined;
  const renderWidth = width ?? 960;
  const gallery = theme.designPack === 'clean-gallery';
  const zine = theme.designPack === 'graphic-zine';
  const gallerySourceCaption = /合成|演示|synthetic/iu.test(source.label)
    ? '演示数据'
    : source.label;
  const coverSrc = subject.image ? resolvedImages[subject.image] || subject.image : undefined;
  const stageHeight = Math.min(560, Math.max(196, Math.round(renderWidth * 0.58)));
  const titleFontSize = gallery
    ? Math.round(Math.min(54, Math.max(18, renderWidth * 0.056)))
    : zine
      ? Math.round(Math.min(72, Math.max(22, renderWidth * 0.074)))
      : Math.round(Math.min(50, Math.max(22, renderWidth * 0.052)));
  const heroScoreFontSize = gallery
    ? renderWidth >= 900
      ? '76px'
      : renderWidth >= 520
        ? '56px'
        : '28px'
    : zine
      ? renderWidth <= 360
        ? '42px'
        : `${Math.round(Math.min(96, Math.max(60, renderWidth * 0.1)))}px`
      : renderWidth <= 360
        ? '36px'
        : `${Math.round(Math.min(86, Math.max(54, renderWidth * 0.09)))}px`;
  const collectionProgress =
    collection &&
    typeof collection.progressPercentage === 'number' &&
    Number.isFinite(collection.progressPercentage)
      ? Math.max(0, Math.min(100, collection.progressPercentage))
      : undefined;
  const titleBlock = (
    <TitleBlock
      title={displayTitle}
      subtitle={originalTitle}
      theme={theme}
      icon="subject"
      eyebrow={zine ? '条目档案' : undefined}
      titleFontSize={`${titleFontSize}px`}
      eyebrowSurface={zine ? theme.tones.butter.surface : undefined}
      eyebrowColor={zine ? theme.text : undefined}
      showIconEyebrow={!gallery}
    />
  );
  const galleryScoreStacks = renderWidth <= 360;

  const backdropFilter = zine
    ? 'saturate(1.25) contrast(1.08)'
    : gallery
      ? 'saturate(0.82) brightness(1.05)'
      : 'saturate(0.9)';
  const backdropWash = zine
    ? 'linear-gradient(115deg, rgba(12, 52, 110, 0.24), rgba(12, 52, 110, 0.02) 62%, rgba(193, 56, 47, 0.10))'
    : gallery
      ? 'linear-gradient(100deg, rgba(20, 93, 135, 0.04), rgba(255, 255, 255, 0.08))'
      : 'linear-gradient(100deg, rgba(72, 48, 33, 0.20), rgba(72, 48, 33, 0.03) 68%, rgba(176, 108, 73, 0.12))';
  const heroShape = theme.design.masks.hero;
  const collectionStatus = collection ? (
    <div
      data-layout="linked-collection-status"
      data-render-mask="panel"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: theme.spacing.sm,
        backgroundColor: zine ? theme.tones.butter.surface : theme.surfaceAlt,
        padding: `${theme.spacing.sm} ${theme.spacing.md}`,
        borderRadius: zine ? theme.design.badgeRadius : theme.radius.md,
        border: `${zine ? '2px' : '1px'} solid ${zine ? theme.text : theme.border}`,
        clipPath: theme.design.masks.panel,
        boxShadow: zine ? `2px 2px 0 ${theme.border}` : undefined,
        fontSize: '13px',
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: theme.spacing.xs,
          minWidth: 0,
        }}
      >
        <RendererIcon name="collection" theme={theme} size={16} />
        <span style={{ color: theme.accent, fontWeight: 700, whiteSpace: 'nowrap' }}>
          {collection.statusLabel || collection.status}
        </span>
        {collection.episodeProgress && (
          <span style={{ color: theme.textMuted, overflowWrap: 'anywhere' }}>
            {collection.episodeProgress}
          </span>
        )}
      </div>
      {collection.rating !== undefined && (
        <span style={{ color: theme.score, fontWeight: 700 }}>★ {collection.rating} / 10</span>
      )}
      {collectionProgress !== undefined ? (
        <div
          role="progressbar"
          aria-label="观看进度"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={collectionProgress}
          aria-valuetext={collection.episodeProgress ?? `${collectionProgress}%`}
          data-layout="subject-progress-track"
          style={{
            flex: '1 0 100%',
            height: zine ? '12px' : gallery ? '8px' : '10px',
            backgroundColor: theme.surface,
            border: zine ? `1px solid ${theme.text}` : `1px solid ${theme.border}`,
            borderRadius: zine ? '0' : gallery ? '999px' : theme.radius.sm,
            overflow: 'hidden',
            clipPath: theme.design.masks.progress,
          }}
        >
          <div
            style={{
              width: `${collectionProgress}%`,
              height: '100%',
              backgroundColor: zine ? theme.tones.coral.foreground : theme.accent,
            }}
          />
        </div>
      ) : null}
    </div>
  ) : null;
  const galleryDetails = (
    <div
      data-layout="gallery-subject-details"
      style={{
        display: 'grid',
        gridTemplateColumns: renderWidth >= 520 ? 'repeat(2, minmax(0, 1fr))' : '1fr',
        gap: theme.spacing.sm,
      }}
    >
      {subject.date ? (
        <div
          data-layout="gallery-subject-date"
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) auto',
            alignItems: 'center',
            columnGap: theme.spacing.sm,
            minWidth: 0,
          }}
        >
          <span
            data-layout="gallery-subject-date-label"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: theme.spacing.xs,
              minWidth: 0,
              whiteSpace: 'nowrap',
              color: theme.textMuted,
              fontSize: '12px',
            }}
          >
            <RendererIcon name="calendar" theme={theme} size={16} />
            <span>首播/发售</span>
          </span>
          <strong
            data-layout="gallery-subject-date-value"
            style={{ color: theme.text, whiteSpace: 'nowrap', fontSize: '14px' }}
          >
            {subject.date}
          </strong>
        </div>
      ) : null}
    </div>
  );
  const warmScoreProgress = (
    <div
      data-layout="warm-score-progress-hero"
      style={{
        display: 'grid',
        gridTemplateColumns:
          collectionStatus && renderWidth >= 520 ? 'minmax(0, 1fr) minmax(0, 1fr)' : '1fr',
        alignItems: 'stretch',
        gap: theme.spacing.sm,
      }}
    >
      <div
        data-layout="warm-score-panel"
        data-render-mask="panel"
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: theme.spacing.xs,
          padding: theme.spacing.md,
          backgroundColor: theme.surfaceAlt,
          border: `1px solid ${theme.border}`,
          borderRadius: theme.radius.md,
          clipPath: theme.design.masks.panel,
          minWidth: 0,
        }}
      >
        <span style={{ color: theme.textMuted, fontSize: '12px' }}>评分</span>
        <ScoreBadge
          score={subject.score}
          rank={subject.rank}
          theme={theme}
          size="hero"
          heroFontSize={heroScoreFontSize}
        />
      </div>
      {collectionStatus}
    </div>
  );
  const zineScoreProgress = (
    <div
      data-layout="zine-score-progress-hero"
      data-render-mask="panel"
      style={{
        display: 'grid',
        gridTemplateColumns:
          collectionStatus && renderWidth >= 520 ? 'minmax(0, 1fr) minmax(0, 1fr)' : '1fr',
        alignItems: 'center',
        gap: theme.spacing.sm,
        padding: theme.spacing.sm,
        backgroundColor: theme.tones.butter.surface,
        border: `2px solid ${theme.text}`,
        clipPath: theme.design.masks.panel,
        boxShadow: `3px 3px 0 ${theme.border}`,
      }}
    >
      <div data-layout="zine-score-panel" style={{ minWidth: 0 }}>
        <div style={{ color: theme.tones.coral.foreground, fontSize: '11px', fontWeight: 900 }}>
          综合评分
        </div>
        <ScoreBadge
          score={subject.score}
          rank={subject.rank}
          theme={theme}
          size="hero"
          heroFontSize={heroScoreFontSize}
        />
      </div>
      {collectionStatus}
    </div>
  );

  return (
    <CardFrame theme={theme} width={width}>
      <section
        data-layout={`${theme.designPack}-cover-hero`}
        data-render-mask="panel"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: theme.spacing.md,
          padding: theme.spacing.md,
          backgroundColor: theme.surface,
          border: `${zine ? '3px' : '1px'} solid ${zine ? theme.text : theme.border}`,
          borderRadius: zine ? theme.design.badgeRadius : gallery ? '4px' : theme.radius.lg,
          boxShadow: zine ? `4px 4px 0 ${theme.border}` : undefined,
          minWidth: 0,
          clipPath: theme.design.masks.panel,
        }}
      >
        {gallery ? (
          <div
            data-layout="gallery-category-header"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: theme.spacing.sm,
              minWidth: 0,
              color: theme.textMuted,
              fontSize: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.xs }}>
              <RendererIcon name="screen" theme={theme} size={18} />
              <strong style={{ color: theme.accent, whiteSpace: 'nowrap' }}>
                {subjectTypeLabel(subject.type)}
              </strong>
            </div>
            <span
              title={source.label}
              style={{
                maxWidth: '56%',
                minWidth: 0,
                overflow: 'hidden',
                textAlign: 'right',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {gallerySourceCaption}
            </span>
          </div>
        ) : null}
        <div
          data-layout="subject-cover-art-stage"
          style={{
            position: 'relative',
            width: '100%',
            height: `${stageHeight}px`,
            overflow: 'hidden',
            isolation: 'isolate',
            backgroundColor: theme.surfaceAlt,
            border: `${zine ? '3px' : gallery ? '2px' : '1px'} solid ${zine ? theme.text : theme.border}`,
            borderRadius: gallery ? '2px' : zine ? theme.design.badgeRadius : theme.radius.md,
            clipPath: heroShape,
          }}
        >
          <CoverImage
            src={coverSrc}
            alt={displayTitle}
            theme={theme}
            width={renderWidth}
            height={stageHeight}
            fill
            filter={backdropFilter}
          />
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              inset: 0,
              background: backdropWash,
            }}
          />
          {zine ? (
            <div
              aria-hidden="true"
              data-layout="zine-cover-stickers"
              style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none' }}
            >
              <span
                style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  width: '16%',
                  height: '18%',
                  backgroundColor: theme.tones.coral.foreground,
                  clipPath: 'polygon(24% 0, 100% 0, 100% 100%, 0 0)',
                  opacity: 0.76,
                }}
              />
              <span
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  width: '18%',
                  height: '12%',
                  backgroundColor: theme.score,
                  clipPath: 'polygon(0 28%, 100% 0, 78% 100%, 0 100%)',
                  opacity: 0.68,
                }}
              />
            </div>
          ) : null}
          {zine ? (
            <div
              data-layout="zine-subject-title-overlay"
              style={{
                position: 'absolute',
                zIndex: 4,
                top: theme.spacing.sm,
                left: theme.spacing.sm,
                width: '76%',
                minWidth: 0,
              }}
            >
              {titleBlock}
            </div>
          ) : null}
        </div>

        <div
          data-layout="subject-card-copy"
          style={{
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: theme.spacing.sm,
            padding: gallery ? `${theme.spacing.xs} ${theme.spacing.sm}` : '0',
          }}
        >
          {!zine &&
            (gallery ? (
              <div
                data-layout="gallery-title-score-row"
                style={{
                  display: 'grid',
                  gridTemplateColumns: galleryScoreStacks
                    ? 'minmax(0, 1fr)'
                    : 'minmax(0, 1fr) auto',
                  alignItems: galleryScoreStacks ? 'start' : 'end',
                  justifyItems: galleryScoreStacks ? 'start' : undefined,
                  gap: theme.spacing.sm,
                }}
              >
                {titleBlock}
                <ScoreBadge
                  score={subject.score}
                  rank={subject.rank}
                  theme={theme}
                  size="hero"
                  heroFontSize={heroScoreFontSize}
                />
              </div>
            ) : (
              <>
                {titleBlock}
                {gallery ? (
                  <ScoreBadge score={subject.score} rank={subject.rank} theme={theme} />
                ) : null}
              </>
            ))}
          {gallery ? (
            galleryDetails
          ) : (
            <MetaRow
              items={[
                { label: '类型', value: subjectTypeLabel(subject.type) },
                subject.date ? { label: '首播/发售', value: subject.date } : undefined,
              ]}
              theme={theme}
            />
          )}
          <TagList tags={subject.tags} theme={theme} />
          {gallery ? collectionStatus : zine ? zineScoreProgress : warmScoreProgress}
        </div>
      </section>

      {subject.summary && (
        <div
          data-layout="subject-card-summary"
          data-render-mask={theme.designPack === 'warm-editorial' ? 'panel-alt' : 'panel'}
          style={{
            fontSize: '14px',
            lineHeight: 1.7,
            color: theme.textMuted,
            backgroundColor: zine ? theme.tones.coral.surface : theme.surfaceAlt,
            padding: theme.spacing.md,
            borderRadius: zine ? theme.design.badgeRadius : theme.radius.md,
            border: `${zine ? '2px' : '1px'} solid ${zine ? theme.tones.coral.border : theme.border}`,
            borderLeft: zine ? `6px solid ${theme.tones.coral.foreground}` : undefined,
            clipPath:
              theme.designPack === 'warm-editorial'
                ? theme.design.masks.panelAlt
                : theme.design.masks.panel,
            overflowWrap: 'anywhere',
          }}
        >
          {subject.summary}
        </div>
      )}

      <Footer label={source.label} theme={theme} />
    </CardFrame>
  );
};
