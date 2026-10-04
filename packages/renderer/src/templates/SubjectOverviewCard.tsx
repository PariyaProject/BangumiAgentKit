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
        borderRadius: theme.radius.sm,
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
}: {
  title: string;
  state: SubjectOverviewSectionState;
  children: React.ReactNode;
  theme: ThemeTokens;
}) {
  return (
    <section
      style={{
        flex: '1 1 285px',
        minWidth: 0,
        backgroundColor: theme.surfaceAlt,
        border: `1px solid ${theme.border}`,
        borderRadius: theme.radius.md,
        padding: theme.spacing.md,
        display: 'flex',
        flexDirection: 'column',
        gap: theme.spacing.sm,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing.sm }}>
        <h2 style={{ margin: 0, fontSize: '18px', color: theme.text }}>{title}</h2>
        <StatePill state={state} theme={theme} />
      </div>
      {children}
    </section>
  );
}

function CoverageLine({
  observed,
  returned,
  truncated,
  theme,
}: {
  observed: number;
  returned: number;
  truncated: boolean;
  theme: ThemeTokens;
}) {
  return (
    <div style={{ color: truncated ? theme.warning : theme.textMuted, fontSize: '13px' }}>
      观察 {observed} 条 · 返回 {returned} 条{truncated ? ' · 已截断' : ''}
    </div>
  );
}

function StatsPanel({
  stats,
  theme,
}: {
  stats: SubjectOverviewViewModel['stats'];
  theme: ThemeTokens;
}) {
  const maxCount = Math.max(1, ...stats.histogram.map((item) => item.count));
  const collection = stats.collection;
  return (
    <Panel title="评分与收藏统计" state={stats.state} theme={theme}>
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
  const cover = subject.image ? resolvedImages[subject.image] : undefined;
  const title = subject.nameCn || subject.name;
  const subtitle =
    subject.nameCn && subject.nameCn !== subject.name ? subject.name : `Subject ID: ${subject.id}`;
  const hasCoverageNotes = viewModel.warnings.length > 0 || viewModel.limitations.length > 0;
  const sourceLabel = viewModel.source.retrievedAt
    ? `${viewModel.source.label} · ${viewModel.source.retrievedAt}`
    : viewModel.source.label;

  return (
    <CardFrame theme={theme} width={width}>
      <div
        style={{
          display: 'flex',
          gap: theme.spacing.lg,
          alignItems: 'flex-start',
          flexWrap: 'wrap',
        }}
      >
        <CoverImage src={cover} alt={title} theme={theme} width={132} height={184} />
        <div
          style={{
            flex: '1 1 360px',
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: theme.spacing.sm,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: theme.spacing.sm,
              alignItems: 'flex-start',
            }}
          >
            <TitleBlock title={title} subtitle={subtitle} theme={theme} />
            <StatePill state={viewModel.state} theme={theme} />
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
          <ScoreBadge score={subject.score} rank={subject.rank} theme={theme} />
          {subject.summary && (
            <div
              style={{
                color: theme.textMuted,
                fontSize: '16px',
                lineHeight: 1.55,
                overflowWrap: 'anywhere',
              }}
            >
              {subject.summary}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing.md }}>
        <StatsPanel stats={viewModel.stats} theme={theme} />
        <Panel title="角色与声优" state={viewModel.cast.state} theme={theme}>
          {viewModel.cast.items.length === 0 ? (
            <div style={{ color: theme.textMuted, fontSize: '14px' }}>未返回角色关系。</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
              {viewModel.cast.items.map((item) => (
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
              {viewModel.cast.hiddenCount ? (
                <div style={{ color: theme.textMuted, fontSize: '13px' }}>
                  另有 {viewModel.cast.hiddenCount} 条已返回角色未展示。
                </div>
              ) : null}
            </div>
          )}
          <CoverageLine {...viewModel.cast.coverage} theme={theme} />
          {viewModel.cast.actorCoverage.truncated ? (
            <div style={{ color: theme.warning, fontSize: '13px', overflowWrap: 'anywhere' }}>
              声优展示达到上限，覆盖数量见本区段统计。
            </div>
          ) : null}
        </Panel>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing.md }}>
        <Panel title="制作人员" state={viewModel.staff.state} theme={theme}>
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
              {viewModel.staff.groups.map((group) => (
                <div
                  key={group.relation}
                  style={{ display: 'flex', gap: theme.spacing.sm, alignItems: 'baseline' }}
                >
                  <span
                    style={{
                      color: theme.accent,
                      fontSize: '14px',
                      minWidth: '64px',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {group.relation}
                  </span>
                  <span style={{ color: theme.text, fontSize: '15px', overflowWrap: 'anywhere' }}>
                    {group.members.map((member) => member.name).join('、') || '成员未知'}
                  </span>
                  <span style={{ color: theme.textMuted, fontSize: '12px' }}>({group.count})</span>
                </div>
              ))}
              {viewModel.staff.hiddenCount ? (
                <div style={{ color: theme.textMuted, fontSize: '13px' }}>
                  另有 {viewModel.staff.hiddenCount} 条已返回职员关系未展示。
                </div>
              ) : null}
            </div>
          )}
          <CoverageLine {...viewModel.staff.coverage} theme={theme} />
        </Panel>
        <Panel title="关联条目" state={viewModel.relations.state} theme={theme}>
          {viewModel.relations.items.length === 0 ? (
            <div style={{ color: theme.textMuted, fontSize: '14px' }}>未返回关联条目。</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.xs }}>
              {viewModel.relations.items.map((item) => (
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
              {viewModel.relations.hiddenCount ? (
                <div style={{ color: theme.textMuted, fontSize: '13px' }}>
                  另有 {viewModel.relations.hiddenCount} 条已返回关系未展示。
                </div>
              ) : null}
            </div>
          )}
          <CoverageLine {...viewModel.relations.coverage} theme={theme} />
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
