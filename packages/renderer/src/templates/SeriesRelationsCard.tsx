import React from 'react';
import { SeriesRelationsViewModel, SeriesRelationsRelatedViewModel } from '../view-models/index.js';
import { ThemeTokens } from '../themes/index.js';
import { CardFrame } from '../components/CardFrame.js';
import { Footer } from '../components/Footer.js';
import { TitleBlock } from '../components/TitleBlock.js';

export interface SeriesRelationsCardProps {
  viewModel: SeriesRelationsViewModel;
  theme: ThemeTokens;
  resolvedImages?: Record<string, string>;
  width?: number;
}

const EXCLUSION_LABELS: Record<string, string> = {
  media_type_not_anime: '非动画媒介',
  root_not_anime: '起点不是动画，无法计算观看步骤',
  relation_not_watch_step: '关系不支持排序',
  conflicting_direct_relations: '起点直接关系冲突',
  conflicting_paths: '方向路径冲突',
  node_cap: '达到动画节点上限',
  depth_evidence_only: '仅作为深层关系证据',
  evidence_cap: '达到证据展示上限',
};

function stateLabel(state: SeriesRelationsViewModel['state']): string {
  if (state === 'complete') return '覆盖完整';
  if (state === 'partial') return '部分覆盖';
  return '当前不可计算';
}

function stateColor(state: SeriesRelationsViewModel['state'], theme: ThemeTokens): string {
  return state === 'complete' ? theme.success : theme.warning;
}

function exclusionLabel(reason: string): string {
  return EXCLUSION_LABELS[reason] || reason;
}

function ImageOrPlaceholder({
  image,
  alt,
  theme,
  resolvedImages,
  width = 52,
  height = 72,
}: {
  image?: string;
  alt: string;
  theme: ThemeTokens;
  resolvedImages: Record<string, string>;
  width?: number;
  height?: number;
}) {
  const source = image ? resolvedImages[image] || image : undefined;
  if (source) {
    return (
      <img
        src={source}
        alt={alt}
        style={{
          width: `${width}px`,
          height: `${height}px`,
          objectFit: 'cover',
          borderRadius: theme.radius.sm,
          border: `1px solid ${theme.border}`,
          flexShrink: 0,
        }}
      />
    );
  }
  return (
    <div
      style={{
        width: `${width}px`,
        height: `${height}px`,
        backgroundColor: theme.surface,
        borderRadius: theme.radius.sm,
        border: `1px solid ${theme.border}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: theme.textMuted,
        fontSize: '10px',
        textAlign: 'center',
        flexShrink: 0,
      }}
    >
      无封面
    </div>
  );
}

function RelationChips({
  item,
  theme,
}: {
  item: SeriesRelationsRelatedViewModel;
  theme: ThemeTokens;
}) {
  const labels = item.relationLabels.length > 0 ? item.relationLabels : ['关系未知'];
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing.xs }}>
      {labels.slice(0, 4).map((label, index) => (
        <span
          key={`${label}-${index}`}
          style={{
            color: theme.text,
            backgroundColor: theme.surface,
            border: `1px solid ${theme.border}`,
            borderRadius: theme.radius.sm,
            padding: '3px 6px',
            fontSize: '10px',
            lineHeight: 1.3,
            overflowWrap: 'anywhere',
          }}
        >
          {label}
        </span>
      ))}
      {item.relationLabels.length > 4 ? (
        <span style={{ color: theme.textMuted, fontSize: '10px' }}>
          另有 {item.relationLabels.length - 4} 个标签
        </span>
      ) : null}
    </div>
  );
}

function StepCard({
  item,
  theme,
  resolvedImages,
}: {
  item: SeriesRelationsViewModel['steps'][number];
  theme: ThemeTokens;
  resolvedImages: Record<string, string>;
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: theme.spacing.sm,
        alignItems: 'flex-start',
        backgroundColor: theme.surfaceAlt,
        border: `1px solid ${theme.border}`,
        borderRadius: theme.radius.md,
        padding: theme.spacing.sm,
        minWidth: 0,
      }}
    >
      <div
        style={{
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          backgroundColor: item.isRoot ? theme.accent : theme.surface,
          color: item.isRoot ? theme.background : theme.accent,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '13px',
          fontWeight: 800,
          flexShrink: 0,
        }}
      >
        {item.position}
      </div>
      <ImageOrPlaceholder
        image={item.image}
        alt={item.nameCn || item.name}
        theme={theme}
        resolvedImages={resolvedImages}
        width={44}
        height={62}
      />
      <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div
          style={{
            color: theme.text,
            fontSize: '14px',
            fontWeight: 700,
            lineHeight: 1.35,
            overflowWrap: 'anywhere',
            wordBreak: 'break-word',
          }}
        >
          {item.nameCn || item.name}
        </div>
        {item.nameCn && item.nameCn !== item.name ? (
          <div style={{ color: theme.textMuted, fontSize: '11px', overflowWrap: 'anywhere' }}>
            {item.name}
          </div>
        ) : null}
        <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.45 }}>
          {item.type}
          {item.date ? ` · ${item.date}` : ' · 日期未知'}
          {item.derivedDepth && item.derivedDepth > 1 ? ` · 深度 ${item.derivedDepth}` : ''}
        </div>
        <RelationChips item={item} theme={theme} />
        <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.45 }}>
          {item.placementReason}
        </div>
      </div>
    </div>
  );
}

function EvidenceRow({
  edge,
  theme,
}: {
  edge: SeriesRelationsViewModel['edges'][number];
  theme: ThemeTokens;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '3px',
        backgroundColor: theme.surface,
        border: `1px solid ${theme.border}`,
        borderRadius: theme.radius.sm,
        padding: theme.spacing.sm,
        minWidth: 0,
      }}
    >
      <div
        style={{
          color: theme.text,
          fontSize: '11px',
          lineHeight: 1.45,
          overflowWrap: 'anywhere',
        }}
      >
        {edge.pathIds.join(' → ')} · {edge.relation}
        {edge.direct ? ' · 起点直接' : ` · 深度 ${edge.depth + 1}`}
      </div>
      <div style={{ color: theme.textMuted, fontSize: '10px', lineHeight: 1.35 }}>
        {edge.pathKinds.join(' → ')}
      </div>
    </div>
  );
}

export const SeriesRelationsCard: React.FC<SeriesRelationsCardProps> = ({
  viewModel,
  theme,
  resolvedImages = {},
  width,
}) => {
  const tone = stateColor(viewModel.state, theme);
  const visibleSteps = viewModel.steps.slice(
    0,
    Math.min(17, Math.max(1, Math.floor(viewModel.coverage.maxNodes) + 1)),
  );
  const visibleRelated = viewModel.related.slice(
    0,
    Math.min(16, Math.max(0, Math.floor(viewModel.coverage.relatedLimit))),
  );
  const visibleEdges = viewModel.edges.slice(
    0,
    Math.min(16, Math.max(0, Math.floor(viewModel.coverage.edgeEvidenceLimit))),
  );
  const visibleSamples = viewModel.excluded.samples.slice(0, 8);
  const visibleWarnings = viewModel.warnings.slice(0, 4);
  const visibleLimitations = viewModel.limitations.slice(0, 3);
  const stepBasis = width && width >= 900 ? 'calc(50% - 6px)' : '100%';
  const root = viewModel.root;

  return (
    <CardFrame theme={theme} width={width}>
      <TitleBlock
        title={root.nameCn || root.name}
        subtitle={`系列关系与观看顺序 · ${stateLabel(viewModel.state)}`}
        theme={theme}
      />

      <div
        style={{
          color: tone,
          backgroundColor: `${tone}18`,
          border: `1px solid ${tone}`,
          borderRadius: theme.radius.md,
          padding: theme.spacing.sm,
          fontSize: '12px',
          lineHeight: 1.5,
        }}
      >
        状态：{stateLabel(viewModel.state)} · 起点：{root.type} · 媒介范围：
        {viewModel.coverage.media === 'all' ? '动画 + 有界非动画证据' : '动画推荐'}
      </div>

      <div
        style={{
          display: 'flex',
          gap: theme.spacing.md,
          alignItems: 'flex-start',
          backgroundColor: theme.surfaceAlt,
          border: `1px solid ${theme.border}`,
          borderRadius: theme.radius.md,
          padding: theme.spacing.md,
        }}
      >
        <ImageOrPlaceholder
          image={root.image}
          alt={root.nameCn || root.name}
          theme={theme}
          resolvedImages={resolvedImages}
          width={64}
          height={88}
        />
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <div style={{ color: theme.accent, fontSize: '15px', fontWeight: 800 }}>
            {root.nameCn || root.name}
          </div>
          {root.nameCn && root.nameCn !== root.name ? (
            <div style={{ color: theme.textMuted, fontSize: '11px', overflowWrap: 'anywhere' }}>
              {root.name}
            </div>
          ) : null}
          <div style={{ color: theme.textMuted, fontSize: '11px' }}>
            ID {root.id} · {root.type} · {root.date || '日期未知'}
          </div>
          <div style={{ color: theme.textMuted, fontSize: '12px', lineHeight: 1.5 }}>
            推荐是有限深度的确定性推导，不是 Bangumi 发布的唯一官方观看顺序。
          </div>
        </div>
      </div>

      {viewModel.state === 'not_computable' ? (
        <div
          style={{
            color: theme.warning,
            backgroundColor: theme.surfaceAlt,
            border: `1px solid ${theme.border}`,
            borderRadius: theme.radius.md,
            padding: theme.spacing.md,
            fontSize: '13px',
            lineHeight: 1.55,
          }}
        >
          起点不是动画或没有足够的动画关系数据，当前不能计算观看步骤；下方仍保留已观察到的关系证据。
        </div>
      ) : null}

      <div style={{ color: theme.accent, fontWeight: 800, fontSize: '15px' }}>
        建议观看步骤 ({visibleSteps.length})
      </div>
      {visibleSteps.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing.sm }}>
          {visibleSteps.map((item) => (
            <div
              key={`${item.id}-${item.position}`}
              style={{ flex: `1 1 ${stepBasis}`, minWidth: 0 }}
            >
              <StepCard item={item} theme={theme} resolvedImages={resolvedImages} />
            </div>
          ))}
        </div>
      ) : (
        <div style={{ color: theme.textMuted, fontSize: '12px' }}>没有可确认的观看步骤。</div>
      )}

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: theme.spacing.sm,
          backgroundColor: theme.surfaceAlt,
          border: `1px solid ${theme.border}`,
          borderRadius: theme.radius.md,
          padding: theme.spacing.md,
        }}
      >
        <div style={{ color: theme.accent, fontWeight: 800, fontSize: '14px' }}>
          关系证据 ({visibleEdges.length})
        </div>
        {visibleEdges.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.xs }}>
            {visibleEdges.map((edge, index) => (
              <EvidenceRow
                key={`${edge.fromId}-${edge.toId}-${edge.relation}-${index}`}
                edge={edge}
                theme={theme}
              />
            ))}
          </div>
        ) : (
          <div style={{ color: theme.textMuted, fontSize: '12px' }}>没有返回关系边证据。</div>
        )}
        {viewModel.coverage.edgeEvidenceTruncated ? (
          <div style={{ color: theme.warning, fontSize: '11px', lineHeight: 1.45 }}>
            边证据已达到 {viewModel.coverage.edgeEvidenceLimit}{' '}
            条上限；展示的是有界样本，不代表所有边。
          </div>
        ) : null}
      </div>

      {visibleRelated.length > 0 ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: theme.spacing.sm,
            backgroundColor: theme.surfaceAlt,
            border: `1px solid ${theme.border}`,
            borderRadius: theme.radius.md,
            padding: theme.spacing.md,
          }}
        >
          <div style={{ color: theme.accent, fontWeight: 800, fontSize: '14px' }}>
            其他有界关系证据 ({visibleRelated.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.xs }}>
            {visibleRelated.map((item) => (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  gap: theme.spacing.sm,
                  alignItems: 'flex-start',
                  backgroundColor: theme.surface,
                  border: `1px solid ${theme.border}`,
                  borderRadius: theme.radius.sm,
                  padding: theme.spacing.sm,
                }}
              >
                <ImageOrPlaceholder
                  image={item.image}
                  alt={item.nameCn || item.name}
                  theme={theme}
                  resolvedImages={resolvedImages}
                  width={38}
                  height={52}
                />
                <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <div
                    style={{
                      color: theme.text,
                      fontSize: '12px',
                      fontWeight: 700,
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {item.nameCn || item.name}
                  </div>
                  <div style={{ color: theme.textMuted, fontSize: '10px', lineHeight: 1.4 }}>
                    {item.type} · {item.date || '日期未知'} · 深度 {item.depth}
                  </div>
                  <RelationChips item={item} theme={theme} />
                  {!item.includedInWatchOrder && item.exclusionReason ? (
                    <div style={{ color: theme.warning, fontSize: '10px' }}>
                      排除：{exclusionLabel(item.exclusionReason)}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
          {viewModel.coverage.relatedEvidenceTruncated ? (
            <div style={{ color: theme.warning, fontSize: '11px', lineHeight: 1.45 }}>
              关系证据已按 relatedLimit={viewModel.coverage.relatedLimit} 有界截断。
            </div>
          ) : null}
        </div>
      ) : null}

      <div style={{ color: theme.textMuted, fontSize: '12px', lineHeight: 1.55 }}>
        覆盖：关系请求 {viewModel.coverage.relationRequests} · 观察关系行{' '}
        {viewModel.coverage.relationRowsObserved} · 唯一条目{' '}
        {viewModel.coverage.uniqueRelatedObserved} · 返回证据{' '}
        {viewModel.coverage.uniqueRelatedReturned} · 详情 {viewModel.coverage.detailsFetched}/
        {viewModel.coverage.detailsAttempted} 成功 · 深度 {viewModel.coverage.depth} · 动画节点上限{' '}
        {viewModel.coverage.animeNodeLimit} · related 上限 {viewModel.coverage.relatedLimit}
      </div>
      <div style={{ color: theme.textMuted, fontSize: '12px', lineHeight: 1.55 }}>
        证据：{viewModel.evidence.operations.join('、') || '无'} ·{' '}
        {viewModel.evidence.evidenceCount} 条路径记录 ·{viewModel.evidence.derivation} ·{' '}
        {viewModel.evidence.retrievedAt}
      </div>

      {viewModel.excluded.byReason.length > 0 ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: theme.spacing.xs,
            backgroundColor: theme.surfaceAlt,
            border: `1px solid ${theme.border}`,
            borderRadius: theme.radius.md,
            padding: theme.spacing.md,
          }}
        >
          <div style={{ color: theme.accent, fontWeight: 800, fontSize: '14px' }}>
            排除与不确定性 · {viewModel.excluded.count} 个唯一条目
          </div>
          <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.5 }}>
            {viewModel.excluded.byReason
              .map((item) => `${exclusionLabel(item.reason)} ${item.count}`)
              .join(' · ')}
          </div>
          {visibleSamples.map((sample) => (
            <div
              key={`${sample.id}-${sample.exclusionReason}`}
              style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.45 }}
            >
              {sample.nameCn || sample.name} · {sample.relationLabels.join('、') || '关系未知'} ·{' '}
              <span style={{ color: theme.warning }}>{exclusionLabel(sample.exclusionReason)}</span>
            </div>
          ))}
          {viewModel.excluded.samples.length > visibleSamples.length ? (
            <div style={{ color: theme.textMuted, fontSize: '11px' }}>
              另有 {viewModel.excluded.samples.length - visibleSamples.length} 条排除样本未展开。
            </div>
          ) : null}
        </div>
      ) : null}

      {visibleWarnings.length > 0 ? (
        <div style={{ color: theme.warning, fontSize: '12px', lineHeight: 1.55 }}>
          警告：{visibleWarnings.join('；')}
          {viewModel.warnings.length > visibleWarnings.length
            ? `；另有 ${viewModel.warnings.length - visibleWarnings.length} 条警告`
            : ''}
        </div>
      ) : null}
      {visibleLimitations.length > 0 ? (
        <div style={{ color: theme.textMuted, fontSize: '12px', lineHeight: 1.55 }}>
          限制：{visibleLimitations.join('；')}
          {viewModel.limitations.length > visibleLimitations.length
            ? `；另有 ${viewModel.limitations.length - visibleLimitations.length} 条限制`
            : ''}
        </div>
      ) : null}

      <Footer theme={theme} label="Series / Watch-Order Intelligence" />
    </CardFrame>
  );
};
