import React from 'react';
import type {
  SubjectOverviewSectionState,
  SubjectOverviewViewModel,
} from '../view-models/index.js';
import { ThemeTokens } from '../themes/index.js';
import { CardFrame } from '../components/CardFrame.js';
import { CoverImage } from '../components/CoverImage.js';
import { Footer } from '../components/Footer.js';
import { MetaRow } from '../components/MetaRow.js';
import { PersonAvatar } from '../components/PersonAvatar.js';
import {
  getRendererIconTone,
  RendererIcon,
  type RendererIconName,
} from '../components/RendererIcon.js';
import { ScoreBadge } from '../components/ScoreBadge.js';
import { TitleBlock } from '../components/TitleBlock.js';
import { subjectTypeLabel } from '../subject-type-label.js';

export interface SubjectOverviewCardProps {
  viewModel: SubjectOverviewViewModel;
  theme: ThemeTokens;
  resolvedImages?: Record<string, string>;
  width?: number;
}

function stateLabel(
  state: SubjectOverviewSectionState | SubjectOverviewViewModel['state'],
): string {
  switch (state) {
    case 'complete':
      return '本次范围内完整';
    case 'partial':
      return '部分覆盖';
    case 'not_computable':
      return '不可计算';
    case 'not_found':
      return '未找到';
    default:
      return '不可用';
  }
}

function stateColor(
  state: SubjectOverviewSectionState | SubjectOverviewViewModel['state'],
  theme: ThemeTokens,
): string {
  return state === 'complete' ? theme.success : theme.warning;
}

function StatePill({
  state,
  theme,
}: {
  state: SubjectOverviewSectionState | SubjectOverviewViewModel['state'];
  theme: ThemeTokens;
}) {
  return (
    <span
      style={{
        color: stateColor(state, theme),
        border: `1px solid ${stateColor(state, theme)}`,
        borderRadius: '999px',
        padding: '2px 7px',
        fontSize: '13px',
        whiteSpace: 'nowrap',
      }}
    >
      {stateLabel(state)}
    </span>
  );
}

function Panel({
  title,
  state,
  children,
  theme,
  icon = 'overview',
  compact = false,
}: {
  title: string;
  state: SubjectOverviewSectionState;
  children: React.ReactNode;
  theme: ThemeTokens;
  icon?: RendererIconName;
  compact?: boolean;
}) {
  const tone = theme.tones[getRendererIconTone(icon)];
  const zine = theme.designPack === 'graphic-zine';
  const gallery = theme.designPack === 'clean-gallery';
  return (
    <section
      style={{
        flex: '1 1 285px',
        minWidth: 0,
        backgroundColor: gallery ? theme.surface : tone.surface,
        border: `${zine ? '2px' : '1px'} solid ${zine ? tone.foreground : tone.border}`,
        borderTop: gallery ? `3px solid ${tone.foreground}` : undefined,
        borderRadius: zine || gallery ? theme.design.badgeRadius : theme.radius.md,
        clipPath: zine ? 'polygon(0 0, 100% 0, 100% 96%, 96% 100%, 0 100%)' : undefined,
        boxShadow: zine ? `3px 3px 0 ${tone.border}` : undefined,
        padding: theme.spacing.md,
        display: 'flex',
        flexDirection: 'column',
        gap: theme.spacing.sm,
      }}
    >
      <div
        data-layout={compact ? 'compact-panel-header' : 'panel-header'}
        style={{
          display: 'flex',
          flexDirection: compact ? 'column' : 'row',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: compact ? 'stretch' : 'center',
          gap: theme.spacing.sm,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.spacing.sm,
            minWidth: 0,
            flex: compact ? '0 0 auto' : '1 1 160px',
            width: compact ? '100%' : undefined,
          }}
        >
          <RendererIcon name={icon} theme={theme} size={16} badge />
          <h2
            style={{
              margin: 0,
              fontSize: '18px',
              color: theme.text,
              flex: '1 1 auto',
              minWidth: 0,
              overflowWrap: 'anywhere',
            }}
          >
            {title}
          </h2>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
          <StatePill state={state} theme={theme} />
        </div>
      </div>
      {children}
    </section>
  );
}

function CoverageLine({
  observed,
  returned,
  truncated,
  displayed,
  theme,
}: {
  observed: number;
  returned: number;
  truncated: boolean;
  displayed?: number;
  theme: ThemeTokens;
}) {
  return (
    <div style={{ color: truncated ? theme.warning : theme.textMuted, fontSize: '13px' }}>
      观察 {observed} 条 · 返回 {returned} 条
      {displayed === undefined ? '' : ` · 图片显示 ${displayed} 条`}
      {truncated ? ' · 已截断' : ''}
    </div>
  );
}

function StatsPanel({
  stats,
  theme,
  compact,
}: {
  stats: SubjectOverviewViewModel['stats'];
  theme: ThemeTokens;
  compact: boolean;
}) {
  const maxCount = Math.max(1, ...stats.histogram.map((item) => item.count));
  const collection = stats.collection;
  return (
    <Panel title="评分与收藏统计" state={stats.state} theme={theme} icon="stats" compact={compact}>
      {stats.state === 'unavailable' || stats.state === 'not_computable' ? (
        <div style={{ color: theme.textMuted, fontSize: '14px' }}>当前来源没有可用统计值。</div>
      ) : (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            <Metric
              label="评分"
              value={stats.score === undefined ? '未知' : stats.score.toFixed(1)}
              theme={theme}
            />
            <Metric
              label="排名"
              value={stats.rank === undefined ? '未知' : `#${stats.rank}`}
              theme={theme}
            />
            <Metric
              label="评分数"
              value={stats.ratingTotal === undefined ? '未知' : stats.ratingTotal}
              theme={theme}
            />
          </div>
          {stats.histogram.length > 0 && (
            <div>
              <div
                style={{ color: theme.textMuted, fontSize: '13px', marginBottom: theme.spacing.xs }}
              >
                评分直方图（1–10）
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(10, minmax(0, 1fr))',
                  gap: '4px',
                  alignItems: 'end',
                  height: '70px',
                }}
              >
                {stats.histogram.map((item) => (
                  <div
                    key={item.score}
                    title={`${item.score} 分：${item.count}`}
                    style={{
                      height: `${Math.max(4, Math.round((item.count / maxCount) * 52))}px`,
                      backgroundColor: theme.accent,
                      borderRadius: `${theme.radius.sm} ${theme.radius.sm} 0 0`,
                      opacity: item.count === 0 ? 0.25 : 0.9,
                      display: 'flex',
                      alignItems: 'flex-end',
                      justifyContent: 'center',
                      color: theme.background,
                      fontSize: '12px',
                    }}
                  >
                    {item.score}
                  </div>
                ))}
              </div>
            </div>
          )}
          {collection && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
              {[
                ['想看', collection.wish],
                ['看过', collection.collect],
                ['在看', collection.doing],
                ['搁置', collection.onHold],
                ['抛弃', collection.dropped],
              ].map(([label, value]) => (
                <span
                  key={String(label)}
                  style={{
                    color: theme.textMuted,
                    border: `1px solid ${theme.border}`,
                    borderRadius: theme.radius.sm,
                    padding: '3px 6px',
                    fontSize: '13px',
                  }}
                >
                  {label} {value}
                </span>
              ))}
            </div>
          )}
        </>
      )}
      <CoverageLine {...stats.coverage} theme={theme} />
    </Panel>
  );
}

function Metric({
  label,
  value,
  theme,
}: {
  label: string;
  value: string | number;
  theme: ThemeTokens;
}) {
  return (
    <div
      style={{
        flex: '1 1 76px',
        minWidth: '76px',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
      }}
    >
      <span style={{ color: theme.textMuted, fontSize: '13px' }}>{label}</span>
      <span style={{ color: theme.accent, fontSize: '20px', fontWeight: 800 }}>{value}</span>
    </div>
  );
}

export const SubjectOverviewCard: React.FC<SubjectOverviewCardProps> = ({
  viewModel,
  theme,
  resolvedImages = {},
  width,
}) => {
  const { subject } = viewModel;
  const renderWidth = width ?? 960;
  const gallery = theme.designPack === 'clean-gallery';
  const zine = theme.designPack === 'graphic-zine';
  const compactHero = renderWidth < 520;
  const galleryStacks = gallery && renderWidth <= 360;
  const coverWidth =
    gallery && compactHero
      ? galleryStacks
        ? 112
        : 68
      : zine && renderWidth >= 760
        ? 216
        : renderWidth < 520
          ? 112
          : renderWidth < 760
            ? 136
            : 196;
  const heroColumns = compactHero
    ? gallery && !galleryStacks
      ? `${coverWidth}px minmax(0, 1fr)`
      : 'minmax(0, 1fr)'
    : gallery
      ? `minmax(0, 1fr) ${coverWidth}px`
      : `${coverWidth}px minmax(0, 1fr)`;
  const compactPanelHeader = renderWidth < 520;
  const summaryLimit = compactHero ? 96 : 180;
  const castLimit = renderWidth < 520 ? 2 : renderWidth < 900 ? 6 : 12;
  const staffGroupLimit = renderWidth < 520 ? 2 : renderWidth < 900 ? 6 : 8;
  const staffMemberLimit = renderWidth < 520 ? 1 : renderWidth < 900 ? 3 : 4;
  const relationLimit = renderWidth < 520 ? 2 : renderWidth < 900 ? 6 : 8;
  const castItems = viewModel.cast.items.slice(0, castLimit);
  const staffGroups = viewModel.staff.groups.slice(0, staffGroupLimit);
  const relationItems = viewModel.relations.items.slice(0, relationLimit);
  const displayedStaffMembers = staffGroups.reduce(
    (count, group) => count + Math.min(group.members.length, staffMemberLimit),
    0,
  );
  const cover = subject.image ? resolvedImages[subject.image] : undefined;
  const title = subject.nameCn || subject.name;
  const subtitle =
    subject.nameCn && subject.nameCn !== subject.name ? subject.name : `条目 ID：${subject.id}`;
  const summary = subject.summary?.replace(/\s+/gu, ' ').trim();
  const summaryCharacters = summary ? Array.from(summary) : [];
  const summaryExcerpt = summaryCharacters.slice(0, summaryLimit).join('');
  const summaryTruncated = summaryCharacters.length > summaryLimit;
  const hasCoverageNotes = viewModel.warnings.length > 0 || viewModel.limitations.length > 0;
  const sourceLabel = viewModel.source.retrievedAt
    ? `${viewModel.source.label} · ${viewModel.source.retrievedAt}`
    : viewModel.source.label;

  return (
    <CardFrame theme={theme} width={width}>
      <section
        data-layout={`${theme.designPack}-cover-hero`}
        style={{
          display: 'grid',
          gridTemplateColumns: heroColumns,
          gap: theme.spacing.md,
          alignItems: 'stretch',
          padding: theme.spacing.md,
          position: 'relative',
          overflow: 'hidden',
          backgroundColor: zine ? theme.surface : theme.surfaceAlt,
          border: `${zine ? '2px' : '1px'} solid ${theme.border}`,
          borderRadius: zine ? theme.design.badgeRadius : gallery ? '4px' : theme.radius.lg,
          boxShadow: zine ? `4px 4px 0 ${theme.border}` : undefined,
        }}
      >
        {zine ? (
          <div
            aria-hidden="true"
            data-layout="zine-hero-cut"
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: '96px',
              height: '12px',
              backgroundColor: theme.accent,
              clipPath: 'polygon(12% 0, 100% 0, 88% 100%, 0 100%)',
            }}
          />
        ) : null}
        <div
          data-layout="subject-overview-cover"
          style={
            compactHero && (!gallery || galleryStacks)
              ? {
                  display: 'flex',
                  justifyContent: 'center',
                  minWidth: 0,
                  gridColumn: '1',
                  gridRow: '1',
                }
              : {
                  minWidth: 0,
                  gridColumn: gallery && !compactHero ? '2' : '1',
                  gridRow: '1',
                }
          }
        >
          <CoverImage
            src={cover}
            alt={title}
            theme={theme}
            width={coverWidth}
            height={Math.round(coverWidth * 1.42)}
          />
        </div>
        <div
          data-layout="subject-overview-copy"
          style={{
            flex: '1 1 360px',
            minWidth: 0,
            gridColumn: compactHero ? (gallery && !galleryStacks ? '2' : '1') : gallery ? '1' : '2',
            gridRow: compactHero ? (gallery && !galleryStacks ? '1' : '2') : '1',
            display: 'flex',
            flexDirection: 'column',
            gap: theme.spacing.md,
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: theme.spacing.sm,
              alignItems: 'stretch',
            }}
          >
            <div
              style={{
                display: 'flex',
                flexDirection: compactHero ? 'column' : 'row',
                justifyContent: 'space-between',
                alignItems: compactHero ? 'stretch' : 'flex-start',
                gap: theme.spacing.sm,
              }}
            >
              <TitleBlock
                title={title}
                subtitle={subtitle}
                theme={theme}
                icon="overview"
                titleFontSize={compactHero ? '20px' : renderWidth < 760 ? '24px' : '30px'}
                subtitleFontSize={compactHero ? '12px' : '14px'}
                titleMaxLines={2}
              />
              <StatePill state={viewModel.state} theme={theme} />
            </div>
            <div data-layout="subject-overview-score">
              <ScoreBadge score={subject.score} rank={subject.rank} theme={theme} />
            </div>
          </div>
          <MetaRow
            items={[
              `类型: ${subjectTypeLabel(subject.type)}`,
              subject.platform ? `平台: ${subject.platform}` : undefined,
              subject.date ? `首播/发售: ${subject.date}` : undefined,
              subject.totalEpisodes || subject.eps
                ? `话数: ${subject.totalEpisodes || subject.eps}`
                : undefined,
            ]}
            theme={theme}
          />
          {viewModel.stats.collection ? (
            <div
              data-layout="editorial-public-collection"
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: theme.spacing.xs,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.xs }}>
                <RendererIcon name="collection" theme={theme} size={15} />
                <span style={{ color: theme.textMuted, fontSize: '11px' }}>社区收藏统计</span>
              </div>
              {[
                ['想看', viewModel.stats.collection.wish],
                ['看过', viewModel.stats.collection.collect],
                ['在看', viewModel.stats.collection.doing],
                ['搁置', viewModel.stats.collection.onHold],
                ['抛弃', viewModel.stats.collection.dropped],
              ].map(([label, value]) => (
                <span
                  key={String(label)}
                  style={{
                    color: theme.accent,
                    backgroundColor: theme.surface,
                    border: `1px solid ${theme.border}`,
                    borderRadius: '999px',
                    padding: '3px 7px',
                    fontSize: '11px',
                  }}
                >
                  {label} {value}
                </span>
              ))}
            </div>
          ) : null}
          {summary && (
            <div
              data-layout="editorial-summary"
              style={{
                color: theme.textMuted,
                fontSize: compactHero ? '13px' : '15px',
                lineHeight: 1.6,
                overflowWrap: 'anywhere',
                borderTop: `1px solid ${theme.border}`,
                paddingTop: theme.spacing.sm,
              }}
            >
              <div
                style={{ color: theme.accent, fontSize: '11px', fontWeight: 700, marginBottom: 4 }}
              >
                简介{summaryTruncated ? `节选 · 前 ${summaryLimit} 字` : ''}
              </div>
              {summaryExcerpt}
              {summaryTruncated ? '…' : ''}
            </div>
          )}
        </div>
      </section>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing.md }}>
        <StatsPanel stats={viewModel.stats} theme={theme} compact={compactPanelHeader} />
        <Panel
          title="角色与声优"
          state={viewModel.cast.state}
          theme={theme}
          icon="cast"
          compact={compactPanelHeader}
        >
          {viewModel.cast.items.length === 0 ? (
            <div style={{ color: theme.textMuted, fontSize: '14px' }}>未返回角色关系。</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
              {castItems.map((item) => (
                <div
                  key={item.character.id}
                  style={{ display: 'flex', gap: theme.spacing.sm, alignItems: 'flex-start' }}
                >
                  <PersonAvatar
                    src={item.character.image ? resolvedImages[item.character.image] : undefined}
                    name={item.character.name}
                    theme={theme}
                    size={34}
                    showName={false}
                  />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        color: theme.text,
                        fontSize: '16px',
                        fontWeight: 700,
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {item.character.name}
                    </div>
                    <div
                      style={{ color: theme.textMuted, fontSize: '14px', overflowWrap: 'anywhere' }}
                    >
                      {item.relation} ·{' '}
                      {item.actors.length > 0
                        ? item.actors.map((actor) => actor.name).join(' / ')
                        : '声优未知'}
                    </div>
                  </div>
                </div>
              ))}
              {viewModel.cast.coverage.returned > castItems.length ? (
                <div style={{ color: theme.textMuted, fontSize: '13px' }}>
                  另有 {viewModel.cast.coverage.returned - castItems.length}{' '}
                  条已返回角色关系未在图片中展示。
                </div>
              ) : null}
            </div>
          )}
          <CoverageLine {...viewModel.cast.coverage} displayed={castItems.length} theme={theme} />
          {viewModel.cast.actorCoverage.truncated ? (
            <div style={{ color: theme.warning, fontSize: '13px', overflowWrap: 'anywhere' }}>
              声优展示达到上限，覆盖数量见本区段统计。
            </div>
          ) : null}
        </Panel>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing.md }}>
        <Panel
          title="制作人员"
          state={viewModel.staff.state}
          theme={theme}
          icon="person"
          compact={compactPanelHeader}
        >
          <div
            style={{
              color: theme.textMuted,
              fontSize: '12px',
              lineHeight: 1.45,
              overflowWrap: 'anywhere',
            }}
          >
            职位按本次 Bangumi
            返回的原始标签分组；未观察到某标签只表示本次有界结果未返回，不代表职位不存在，也不推断“主创”等分类。
          </div>
          {viewModel.staff.groups.length === 0 ? (
            <div style={{ color: theme.textMuted, fontSize: '14px' }}>未返回制作人员关系。</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.xs }}>
              {staffGroups.map((group) => {
                const members = group.members.slice(0, staffMemberLimit);
                const groupCount = Math.max(group.count, group.members.length);
                return (
                  <div
                    key={group.relation}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(60px, auto) minmax(0, 1fr) auto',
                      gap: theme.spacing.sm,
                      alignItems: 'baseline',
                    }}
                  >
                    <span
                      style={{
                        color: theme.accent,
                        fontSize: '13px',
                        minWidth: 0,
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {group.relation}
                    </span>
                    <span style={{ color: theme.text, fontSize: '13px', overflowWrap: 'anywhere' }}>
                      {members.map((member) => member.name).join('、') || '成员未知'}
                    </span>
                    <span
                      style={{ color: theme.textMuted, fontSize: '11px', whiteSpace: 'nowrap' }}
                    >
                      显示 {members.length}/{groupCount}
                    </span>
                  </div>
                );
              })}
              {viewModel.staff.groups.length > staffGroups.length ? (
                <div style={{ color: theme.textMuted, fontSize: '12px' }}>
                  职位分组图片展示 {staffGroups.length}/{viewModel.staff.groups.length}{' '}
                  组；其余分组未在图片中展开。
                </div>
              ) : null}
            </div>
          )}
          <CoverageLine
            {...viewModel.staff.coverage}
            displayed={displayedStaffMembers}
            theme={theme}
          />
        </Panel>
        <Panel
          title="关联条目"
          state={viewModel.relations.state}
          theme={theme}
          icon="relations"
          compact={compactPanelHeader}
        >
          {viewModel.relations.items.length === 0 ? (
            <div style={{ color: theme.textMuted, fontSize: '14px' }}>未返回关联条目。</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.xs }}>
              {relationItems.map((item) => (
                <div
                  key={`${item.id}-${item.relation}`}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: theme.spacing.sm,
                    alignItems: 'baseline',
                  }}
                >
                  <span style={{ color: theme.text, fontSize: '15px', overflowWrap: 'anywhere' }}>
                    {item.nameCn || item.name}
                  </span>
                  <span
                    style={{
                      color: theme.textMuted,
                      fontSize: '12px',
                      textAlign: 'right',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {item.relation} · {subjectTypeLabel(item.type)}
                  </span>
                </div>
              ))}
              {viewModel.relations.coverage.returned > relationItems.length ? (
                <div style={{ color: theme.textMuted, fontSize: '13px' }}>
                  另有 {viewModel.relations.coverage.returned - relationItems.length}{' '}
                  条已返回关系未在图片中展示。
                </div>
              ) : null}
            </div>
          )}
          <CoverageLine
            {...viewModel.relations.coverage}
            displayed={relationItems.length}
            theme={theme}
          />
        </Panel>
      </div>

      {hasCoverageNotes && (
        <div
          style={{
            backgroundColor: theme.surfaceAlt,
            border: `1px solid ${theme.border}`,
            borderRadius: theme.radius.md,
            padding: theme.spacing.md,
            display: 'flex',
            flexDirection: 'column',
            gap: theme.spacing.xs,
            color: theme.textMuted,
            fontSize: '13px',
            lineHeight: 1.5,
          }}
        >
          部分区段展示的是 Bangumi 当前公开返回的有界样本，完整程度以各区段标注为准。
        </div>
      )}

      <Footer label={sourceLabel} theme={theme} />
    </CardFrame>
  );
};
