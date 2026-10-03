import React from 'react';
import { SubjectCardViewModel } from '../view-models/index.js';
import { ThemeTokens } from '../themes/index.js';
import { CardFrame } from '../components/CardFrame.js';
import { CoverImage } from '../components/CoverImage.js';
import { TitleBlock } from '../components/TitleBlock.js';
import { MetaRow } from '../components/MetaRow.js';
import { ScoreBadge } from '../components/ScoreBadge.js';
import { TagList } from '../components/TagList.js';
import { Footer } from '../components/Footer.js';
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
  const coverSrc = subject.image ? resolvedImages[subject.image] || subject.image : undefined;
  const displayTitle = subject.nameCn || subject.name;
  const originalTitle = subject.name.trim() !== displayTitle.trim() ? subject.name : undefined;
  const compact = width !== undefined && width < 640;
  const coverWidth = compact && width < 420 ? 120 : 160;
  const coverHeight = Math.round((coverWidth * 220) / 160);

  return (
    <CardFrame theme={theme} width={width}>
      <TitleBlock title={displayTitle} subtitle={originalTitle} theme={theme} />
      <div
        style={{
          display: 'flex',
          flexDirection: compact ? 'column' : 'row',
          alignItems: compact ? 'stretch' : 'flex-start',
          gap: compact ? theme.spacing.md : theme.spacing.lg,
          minWidth: 0,
        }}
      >
        <div style={compact ? { display: 'flex', justifyContent: 'center' } : undefined}>
          <CoverImage
            src={coverSrc}
            alt={displayTitle}
            theme={theme}
            width={coverWidth}
            height={coverHeight}
          />
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: theme.spacing.sm,
            flex: 1,
            minWidth: 0,
          }}
        >
          <MetaRow
            items={[
              `类型: ${subjectTypeLabel(subject.type)}`,
              subject.date ? `首播/发售: ${subject.date}` : undefined,
            ]}
            theme={theme}
          />
          <ScoreBadge score={subject.score} rank={subject.rank} theme={theme} />
          <TagList tags={subject.tags} theme={theme} />
        </div>
      </div>

      {subject.summary && (
        <div
          style={{
            fontSize: '14px',
            lineHeight: 1.6,
            color: theme.textMuted,
            backgroundColor: theme.surfaceAlt,
            padding: theme.spacing.md,
            borderRadius: theme.radius.md,
            border: `1px solid ${theme.border}`,
          }}
        >
          {subject.summary}
        </div>
      )}

      {collection && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: theme.surfaceAlt,
            padding: `${theme.spacing.sm} ${theme.spacing.md}`,
            borderRadius: theme.radius.md,
            border: `1px solid ${theme.border}`,
            fontSize: '13px',
          }}
        >
          <div>
            <span style={{ color: theme.accent, fontWeight: 600 }}>
              {collection.statusLabel || collection.status}
            </span>
            {collection.episodeProgress && (
              <span style={{ marginLeft: theme.spacing.sm, color: theme.textMuted }}>
                ({collection.episodeProgress})
              </span>
            )}
          </div>
          {collection.rating !== undefined && (
            <span style={{ color: theme.score, fontWeight: 700 }}>
              评分: {collection.rating} / 10
            </span>
          )}
        </div>
      )}

      <Footer label={source.label} theme={theme} />
    </CardFrame>
  );
};
