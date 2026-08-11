import React from 'react';
import { DiscoveryResultsViewModel } from '../view-models/index.js';
import { ThemeTokens } from '../themes/index.js';
import { CardFrame } from '../components/CardFrame.js';
import { TitleBlock } from '../components/TitleBlock.js';
import { Footer } from '../components/Footer.js';

export interface DiscoveryResultsCardProps {
  viewModel: DiscoveryResultsViewModel;
  theme: ThemeTokens;
  resolvedImages?: Record<string, string>;
  width?: number;
}

function stateLabel(state: DiscoveryResultsViewModel['state']): string {
  switch (state) {
    case 'ok':
      return '结果可用';
    case 'partial':
      return '部分覆盖';
    case 'unsupported':
      return '条件不支持';
    case 'unavailable':
      return '来源不可用';
    case 'not_computable':
      return '当前不可计算';
    case 'auth_required':
      return '需要授权';
    case 'permission_denied':
      return '无权限';
    case 'not_found':
      return '未找到';
    case 'conflict':
      return '存在冲突';
    case 'stale':
      return '来源可能过期';
    case 'upstream_error':
      return '上游错误';
    default:
      return state;
  }
}

function stateColor(state: DiscoveryResultsViewModel['state'], theme: ThemeTokens): string {
  return state === 'ok' ? theme.success : state === 'partial' ? theme.warning : theme.warning;
}

function totalLabel(totalKind: string): string {
  if (totalKind === 'exact') return '总数精确';
  if (totalKind === 'estimated') return '总数估计';
  return '总数未知';
}

function numberLabel(value: number | undefined, suffix = ''): string {
  return value === undefined ? `未知${suffix}` : `${value}${suffix}`;
}

const FilterGroup: React.FC<{
  label: string;
  values: string[];
  theme: ThemeTokens;
}> = ({ label, values, theme }) => {
  if (values.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.xs }}>
      <div style={{ color: theme.textMuted, fontSize: '10px', fontWeight: 700 }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing.xs }}>
        {values.map((value, index) => (
          <span
            key={`${value}-${index}`}
            style={{
              color: theme.text,
              backgroundColor: theme.surface,
              border: `1px solid ${theme.border}`,
              borderRadius: theme.radius.sm,
              padding: '3px 6px',
              fontSize: '10px',
              lineHeight: 1.35,
              overflowWrap: 'anywhere',
            }}
          >
            {value}
          </span>
        ))}
      </div>
    </div>
  );
};

export const DiscoveryResultsCard: React.FC<DiscoveryResultsCardProps> = ({
  viewModel,
  theme,
  resolvedImages = {},
  width,
}) => {
  const itemBasis = width && width >= 900 ? 'calc(50% - 6px)' : '100%';
  const stateTone = stateColor(viewModel.state, theme);
  const visibleWarnings = viewModel.warnings.slice(0, 4);
  const visibleLimitations = viewModel.limitations.slice(0, 3);
  const hiddenWarnings = Math.max(0, viewModel.warnings.length - visibleWarnings.length);
  const hiddenLimitations = Math.max(0, viewModel.limitations.length - visibleLimitations.length);

  return (
    <CardFrame theme={theme} width={width}>
      <TitleBlock
        title={viewModel.query.label}
        subtitle={`Bangumi 条目发现 · ${stateLabel(viewModel.state)}`}
        theme={theme}
      />

      <div
        style={{
          color: stateTone,
          backgroundColor: `${stateTone}18`,
          border: `1px solid ${stateTone}`,
          borderRadius: theme.radius.md,
          padding: theme.spacing.sm,
          fontSize: '11px',
          lineHeight: 1.5,
        }}
      >
        状态：{stateLabel(viewModel.state)} · 来源：{viewModel.source.label}
        {viewModel.source.experimental ? ' · 搜索接口标记为 experimental' : ''}
      </div>

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
        <div style={{ color: theme.accent, fontWeight: 700, fontSize: '13px' }}>查询条件</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing.xs }}>
          {viewModel.query.facets.map((facet, index) => (
            <span
              key={`${facet}-${index}`}
              style={{
                color: theme.text,
                backgroundColor: theme.surface,
                border: `1px solid ${theme.border}`,
                borderRadius: theme.radius.sm,
                padding: '4px 7px',
                fontSize: '11px',
                lineHeight: 1.35,
                overflowWrap: 'anywhere',
              }}
            >
              {facet}
            </span>
          ))}
        </div>
      </div>

      <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.5 }}>
        覆盖：扫描 {viewModel.coverage.scanned} · 匹配 {viewModel.coverage.matched} · 返回{' '}
        {viewModel.coverage.returned} · 页面 {viewModel.coverage.pagesScanned} ·{' '}
        {totalLabel(viewModel.coverage.totalKind)}
        {viewModel.coverage.budgetExceeded ? ' · 达到执行预算' : ''}
        {!viewModel.coverage.upstreamExhausted && !viewModel.coverage.budgetExceeded
          ? ' · 上游范围未证明耗尽'
          : ''}
      </div>
      {(viewModel.coverage.hydrationsAttempted > 0 ||
        viewModel.coverage.hydrationsUnresolved > 0) && (
        <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.5 }}>
          详情验证：尝试 {viewModel.coverage.hydrationsAttempted} · 成功{' '}
          {viewModel.coverage.hydrationsSucceeded} · 失败 {viewModel.coverage.hydrationsFailed}
          {viewModel.coverage.hydrationsUnresolved > 0
            ? ` · 未解析 ${viewModel.coverage.hydrationsUnresolved}`
            : ''}
          {viewModel.coverage.reason ? ` · ${viewModel.coverage.reason}` : ''}
        </div>
      )}

      {viewModel.items.length === 0 ? (
        <div
          style={{
            color: stateTone,
            backgroundColor: theme.surfaceAlt,
            border: `1px solid ${theme.border}`,
            borderRadius: theme.radius.md,
            padding: theme.spacing.md,
            fontSize: '12px',
            lineHeight: 1.5,
          }}
        >
          {viewModel.state === 'unsupported'
            ? '当前查询条件没有可执行的官方解释，未发起结果请求。'
            : viewModel.state === 'unavailable' || viewModel.state === 'upstream_error'
              ? '官方发现源暂时不可用，未生成可靠的条目列表。'
              : '本次有界查询没有可展示的匹配条目。'}
        </div>
      ) : null}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        {viewModel.items.map((item) => {
          const image = item.image ? resolvedImages[item.image] || item.image : undefined;
          return (
            <div
              key={item.id}
              style={{
                flex: `1 1 ${itemBasis}`,
                minWidth: 0,
                backgroundColor: theme.surfaceAlt,
                border: `1px solid ${theme.border}`,
                borderRadius: theme.radius.md,
                padding: theme.spacing.sm,
                display: 'flex',
                gap: theme.spacing.sm,
                alignItems: 'flex-start',
              }}
            >
              {image ? (
                <img
                  src={image}
                  alt={item.nameCn || item.name}
                  style={{
                    width: '52px',
                    height: '72px',
                    objectFit: 'cover',
                    borderRadius: theme.radius.sm,
                    border: `1px solid ${theme.border}`,
                    flexShrink: 0,
                  }}
                />
              ) : (
                <div
                  style={{
                    width: '52px',
                    height: '72px',
                    flexShrink: 0,
                    backgroundColor: theme.surface,
                    borderRadius: theme.radius.sm,
                    border: `1px solid ${theme.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: theme.textMuted,
                    fontSize: '10px',
                    textAlign: 'center',
                  }}
                >
                  无封面
                </div>
              )}
              <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                <div
                  style={{
                    color: theme.accent,
                    fontSize: '13px',
                    fontWeight: 700,
                    lineHeight: 1.35,
                    overflowWrap: 'anywhere',
                    wordBreak: 'break-word',
                  }}
                >
                  {item.nameCn || item.name}
                </div>
                <div
                  style={{
                    color: theme.textMuted,
                    fontSize: '10px',
                    lineHeight: 1.35,
                    overflowWrap: 'anywhere',
                    wordBreak: 'break-word',
                  }}
                >
                  {item.name}
                </div>
                <div style={{ color: theme.textMuted, fontSize: '10px', lineHeight: 1.4 }}>
                  {item.media}
                  {item.category ? ` · ${item.category}` : ''}
                  {item.date ? ` · ${item.date}` : ' · 日期未知'}
                </div>
                <div style={{ color: theme.textMuted, fontSize: '10px', lineHeight: 1.4 }}>
                  {item.score !== undefined ? `★ ${item.score.toFixed(1)}` : '评分未知'} ·{' '}
                  {item.rank !== undefined ? `#${item.rank}` : '排名未知'} ·{' '}
                  {numberLabel(item.ratingCount, ' 人评分')}
                </div>
                {item.collectionTotal !== undefined ? (
                  <div style={{ color: theme.textMuted, fontSize: '10px' }}>
                    收藏合计 {item.collectionTotal}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {viewModel.hiddenCount ? (
        <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.5 }}>
          另有 {viewModel.hiddenCount} 条匹配结果未在卡片中展开；完整结构化结果仍由{' '}
          `bangumi.query_subjects` 提供。
        </div>
      ) : null}

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
        <div style={{ color: theme.accent, fontWeight: 700, fontSize: '13px' }}>计划与证据边界</div>
        <div style={{ color: theme.textMuted, fontSize: '10px', lineHeight: 1.5 }}>
          {viewModel.plan.operation} · 质量 {viewModel.plan.quality} ·{' '}
          {viewModel.source.evidenceCount} 条字段证据
          {viewModel.source.operations.length > 0
            ? ` · 操作 ${viewModel.source.operations.join('、')}`
            : ' · 操作未知'}
          {viewModel.source.retrievedAt ? ` · 获取于 ${viewModel.source.retrievedAt}` : ''}
        </div>
        <FilterGroup label="上游直接支持" values={viewModel.plan.pushdown} theme={theme} />
        <FilterGroup label="本地结果过滤" values={viewModel.plan.postFilters} theme={theme} />
        <FilterGroup label="派生或排序条件" values={viewModel.plan.derivedFilters} theme={theme} />
      </div>

      {visibleWarnings.length > 0 ? (
        <div style={{ color: theme.warning, fontSize: '11px', lineHeight: 1.5 }}>
          警告：{visibleWarnings.map((warning) => `${warning.code}：${warning.message}`).join('；')}
          {hiddenWarnings > 0 ? `；另有 ${hiddenWarnings} 条警告` : ''}
        </div>
      ) : null}
      {visibleLimitations.length > 0 ? (
        <div style={{ color: theme.textMuted, fontSize: '10px', lineHeight: 1.5 }}>
          限制：{visibleLimitations.join('；')}
          {hiddenLimitations > 0 ? `；另有 ${hiddenLimitations} 条限制` : ''}
        </div>
      ) : null}

      <Footer theme={theme} />
    </CardFrame>
  );
};
