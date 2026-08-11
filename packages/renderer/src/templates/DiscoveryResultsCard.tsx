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
  const labels: Record<DiscoveryResultsViewModel['state'], string> = {
    ok: '结果可用',
    partial: '部分覆盖',
    stale: '来源可能过期',
    conflict: '存在冲突',
    auth_required: '需要授权',
    permission_denied: '无权限',
    unavailable: '来源不可用',
    not_computable: '当前不可计算',
    unsupported: '条件不支持',
    not_found: '未找到',
    upstream_error: '上游错误',
  };
  return labels[state];
}

function stateColor(state: DiscoveryResultsViewModel['state'], theme: ThemeTokens): string {
  return state === 'ok' ? theme.success : theme.warning;
}

function totalLabel(totalKind: DiscoveryResultsViewModel['coverage']['totalKind']): string {
  if (totalKind === 'exact') return '总数精确';
  if (totalKind === 'estimated') return '总数估计';
  return '总数未知';
}

function operationLabel(operation: string): string {
  if (operation === 'searchSubjects') return '条目搜索';
  if (operation === 'browseSubjects') return '条目浏览';
  return '来源操作';
}

function qualityLabel(quality: string): string {
  if (quality === 'exact') return '条件精确';
  if (quality === 'bounded_exact') return '有界精确';
  if (quality === 'partial_possible') return '可能部分覆盖';
  if (quality === 'unsupported') return '条件不支持';
  return '质量未知';
}

function warningLabel(code: string): string {
  const labels: Record<string, string> = {
    DISCOVERY_AMBIGUOUS_CONCEPT: '概念存在歧义',
    DISCOVERY_UNKNOWN_CONCEPT: '概念未解析',
    DISCOVERY_BUDGET_EXCEEDED: '执行预算达到',
    DISCOVERY_HYDRATION_BUDGET_EXCEEDED: '详情预算达到',
    DISCOVERY_HYDRATION_UNRESOLVED: '详情字段未解析',
    DISCOVERY_OUTPUT_TRUNCATED: '结果输出已截断',
    DISCOVERY_UNSUPPORTED_FILTER: '条件不受支持',
    UPSTREAM_ERROR: '来源返回错误',
  };
  return labels[code] || '发现告警';
}

function coverageReasonLabel(reason: string): string {
  if (reason === 'output_cap') return '输出上限已达到。';
  return reason;
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
      <div style={{ color: theme.textMuted, fontSize: '11px', fontWeight: 700 }}>{label}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing.xs }}>
        {values.map((value, index) => (
          <span
            key={`${value}-${index}`}
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
  const coverage = viewModel.coverage;
  const sourceOperations = viewModel.source.operations.map(operationLabel);

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
          fontSize: '12px',
          lineHeight: 1.5,
        }}
      >
        状态：{stateLabel(viewModel.state)} · 来源：{viewModel.source.label}
        {viewModel.source.experimental ? ' · 来源覆盖边界较窄' : ''}
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
        <div style={{ color: theme.accent, fontWeight: 700, fontSize: '14px' }}>查询条件</div>
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
                lineHeight: 1.4,
                overflowWrap: 'anywhere',
              }}
            >
              {facet}
            </span>
          ))}
        </div>
      </div>

      <div style={{ color: theme.textMuted, fontSize: '12px', lineHeight: 1.55 }}>
        覆盖：观察 {coverage.observed} · 匹配 {coverage.matched} · 返回 {coverage.returned} · 展示{' '}
        {coverage.rendered} · 页面 {coverage.pagesScanned} · {totalLabel(coverage.totalKind)}
        {coverage.requested > 0 ? ` · 请求上限 ${coverage.requested}` : ''}
        {coverage.budgetExceeded ? ' · 达到执行预算' : ''}
        {coverage.outputCap !== undefined ? ` · 输出上限 ${coverage.outputCap}` : ''}
        {!coverage.upstreamExhausted && !coverage.budgetExceeded ? ' · 上游范围未证明耗尽' : ''}
      </div>
      {(coverage.hydrationsAttempted > 0 || coverage.hydrationsUnresolved > 0) && (
        <div style={{ color: theme.textMuted, fontSize: '12px', lineHeight: 1.55 }}>
          详情验证：尝试 {coverage.hydrationsAttempted} · 成功 {coverage.hydrationsSucceeded} · 失败{' '}
          {coverage.hydrationsFailed} · 未解析 {coverage.hydrationsUnresolved}
          {coverage.hydrationBudgetExceeded ? ' · 详情预算达到' : ''}
        </div>
      )}
      {coverage.reason ? (
        <div style={{ color: theme.textMuted, fontSize: '12px', lineHeight: 1.55 }}>
          覆盖说明：{coverageReasonLabel(coverage.reason)}
        </div>
      ) : null}

      {viewModel.items.length === 0 ? (
        <div
          style={{
            color: stateTone,
            backgroundColor: theme.surfaceAlt,
            border: `1px solid ${theme.border}`,
            borderRadius: theme.radius.md,
            padding: theme.spacing.md,
            fontSize: '13px',
            lineHeight: 1.55,
          }}
        >
          {viewModel.state === 'unsupported'
            ? '当前查询条件没有可执行的官方解释，未发起可靠的结果请求。'
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
              <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div
                  style={{
                    color: theme.accent,
                    fontSize: '14px',
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
                    fontSize: '11px',
                    lineHeight: 1.35,
                    overflowWrap: 'anywhere',
                    wordBreak: 'break-word',
                  }}
                >
                  {item.name}
                </div>
                <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.4 }}>
                  {item.media}
                  {item.category ? ` · ${item.category}` : ''}
                  {item.date ? ` · ${item.date}` : ' · 日期未知'}
                </div>
                <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.4 }}>
                  {item.score !== undefined ? `★ ${item.score.toFixed(1)}` : '评分未知'} ·{' '}
                  {item.rank !== undefined ? `#${item.rank}` : '排名未知'} ·{' '}
                  {numberLabel(item.ratingCount, ' 人评分')}
                </div>
                {item.collectionTotal !== undefined ? (
                  <div style={{ color: theme.textMuted, fontSize: '11px' }}>
                    收藏合计 {item.collectionTotal}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {viewModel.hiddenCount ? (
        <div style={{ color: theme.textMuted, fontSize: '12px', lineHeight: 1.55 }}>
          另有 {viewModel.hiddenCount} 条本次已返回的结构化条目未在卡片中展开；卡片最多展示 12 条。
        </div>
      ) : null}
      {viewModel.observedNotReturnedCount ? (
        <div style={{ color: theme.textMuted, fontSize: '12px', lineHeight: 1.55 }}>
          另有 {viewModel.observedNotReturnedCount}{' '}
          个匹配候选已被引擎观察到但未纳入本次结构化返回；此处仅显示计数，不代表其字段事实可用。
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
        <div style={{ color: theme.accent, fontWeight: 700, fontSize: '14px' }}>计划与证据边界</div>
        <div style={{ color: theme.textMuted, fontSize: '12px', lineHeight: 1.55 }}>
          {operationLabel(viewModel.plan.operation)} · {qualityLabel(viewModel.plan.quality)} ·{' '}
          {viewModel.source.evidenceCount} 条字段证据
          {sourceOperations.length > 0
            ? ` · 来源路径 ${sourceOperations.join('、')}`
            : ' · 操作未知'}
          {viewModel.source.retrievedAt ? ` · 获取于 ${viewModel.source.retrievedAt}` : ''}
        </div>
        <FilterGroup label="上游直接支持" values={viewModel.plan.pushdown} theme={theme} />
        <FilterGroup label="本地结果过滤" values={viewModel.plan.postFilters} theme={theme} />
        <FilterGroup label="派生或排序条件" values={viewModel.plan.derivedFilters} theme={theme} />
        <FilterGroup
          label="不支持的条件"
          values={viewModel.plan.unsupportedFilters}
          theme={theme}
        />
      </div>

      {visibleWarnings.length > 0 ? (
        <div style={{ color: theme.warning, fontSize: '12px', lineHeight: 1.55 }}>
          警告：
          {visibleWarnings
            .map((warning) => `${warningLabel(warning.code)}：${warning.message}`)
            .join('；')}
          {hiddenWarnings > 0 ? `；另有 ${hiddenWarnings} 条警告` : ''}
        </div>
      ) : null}
      {visibleLimitations.length > 0 ? (
        <div style={{ color: theme.textMuted, fontSize: '12px', lineHeight: 1.55 }}>
          限制：{visibleLimitations.join('；')}
          {hiddenLimitations > 0 ? `；另有 ${hiddenLimitations} 条限制` : ''}
        </div>
      ) : null}

      <Footer theme={theme} />
    </CardFrame>
  );
};
