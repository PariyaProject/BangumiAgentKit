import React from 'react';
import { COLLECTION_COMPLETION_UNRESOLVED_CAVEAT } from '@bangumi-agent-kit/discovery';
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

const DISCOVERY_UNRESOLVED_COVERAGE_REASON =
  'Some candidate filters remained unresolved because required data was missing, inconsistent, or not computable.';

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

function warningLabel(code: string): string {
  const labels: Record<string, string> = {
    EXPERIMENTAL_SOURCE: '官方搜索来源提示',
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

function warningText(code: string, message: string): string {
  if (code === 'DISCOVERY_AMBIGUOUS_CONCEPT') {
    return '筛选概念存在歧义，未进行语义扩展。';
  }
  if (code === 'DISCOVERY_UNKNOWN_CONCEPT') {
    return '筛选概念未能确认，未进行语义扩展。';
  }
  if (code === 'DISCOVERY_BUDGET_EXCEEDED') {
    return '检索已到本次处理上限，当前结果可能不完整。';
  }
  if (code === 'DISCOVERY_HYDRATION_BUDGET_EXCEEDED') {
    return '条目核验已到处理上限，部分筛选条件可能尚未确认。';
  }
  if (code === 'DISCOVERY_HYDRATION_UNRESOLVED') {
    return '部分候选的筛选字段未能核实，已按未知处理。';
  }
  if (code === 'DISCOVERY_OUTPUT_TRUNCATED') {
    return '结果已达到返回上限，可能还有匹配条目未纳入列表。';
  }
  if (code === 'EXPERIMENTAL_SOURCE') {
    return '官方作品搜索接口仍处于实验阶段，可能遗漏尚未编入索引的条目。';
  }
  return `${warningLabel(code)}：${message}`;
}

function limitationLabel(message: string): string {
  const labels: Record<string, string> = {
    'Enumeration is bounded by maxPages and maxCandidates.': '检索受最大页数与候选条目数限制',
    'Official subject search is experimental; estimated totals do not establish completeness of the entire Bangumi database.':
      '官方搜索总数为估算值，不能据此认定 Bangumi 全库已完整覆盖',
    'all requests a complete attempt; budget exhaustion is reported as partial.':
      '“尽量完整”会在预算内继续检索；预算耗尽时仍标记为部分覆盖',
    'heat means upstream 收藏人数 and is not a recent-trend metric.':
      '排序热度使用官方当前收藏人数，不代表近期讨论趋势或历史热度',
    'A top-N score tie-break scans the bounded ordered candidate window through the first lower-scored row; an unproven cutoff is reported as partial.':
      '评分同分时会继续检查候选，直到出现更低评分；预算内无法证明分界时标记为部分覆盖',
    'collectionCompletionRate = collect / (wish + collect + doing + on_hold + dropped); this sample-verified ratio is not an official API formula, episode completion, personal progress, or preference. Official subject search is experimental and totals are estimated, so results describe only the bounded observed sample.':
      'collect 状态占比＝collect ÷ 五类收藏状态人数之和；这是样本验证公式，不是官方 API 公式、章节完成率、个人进度或偏好。官方搜索仍处于实验阶段且总数为估计值，结果只代表本次有界观察样本',
    [COLLECTION_COMPLETION_UNRESOLVED_CAVEAT]: COLLECTION_COMPLETION_UNRESOLVED_CAVEAT,
  };
  return labels[message] || message;
}

function coverageReasonLabel(reason: string): string {
  const labels: Record<string, string> = {
    output_cap: '结果已达到返回上限，仍有匹配条目未纳入列表。',
    'Output cap was reached.': '结果已达到返回上限，仍有匹配条目未纳入列表。',
    'Hydration budget was exhausted before all required candidates could be evaluated.':
      '条目核验已到处理上限，部分筛选条件可能尚未确认。',
    [DISCOVERY_UNRESOLVED_COVERAGE_REASON]: '部分候选的筛选字段无法确认，相关结论按未知处理。',
    'Execution budget was exhausted before upstream coverage was proven.':
      '检索已到本次处理上限，尚未证明覆盖全部结果。',
  };
  return labels[reason] ?? '本次结果范围未能完全确认；详细原因保留在结构化结果中。';
}

function joinReaderMessages(messages: string[]): string {
  const joined = messages
    .map((message) => message.trim().replace(/[。；;]+$/u, ''))
    .filter(Boolean)
    .join('；');
  return joined ? `${joined}。` : '';
}

function numberLabel(value: number | undefined, suffix = ''): string {
  return value === undefined ? `未知${suffix}` : `${value}${suffix}`;
}

const DISCOVERY_MAX_RENDERED_ITEMS = 12;

export const DiscoveryResultsCard: React.FC<DiscoveryResultsCardProps> = ({
  viewModel,
  theme,
  resolvedImages = {},
  width,
}) => {
  const itemBasis = width && width >= 900 ? 'calc(50% - 6px)' : '100%';
  const stateTone = stateColor(viewModel.state, theme);
  const coverage = viewModel.coverage;
  const coverageMessages = [
    ...(coverage.budgetExceeded ? ['检索已到本次处理上限，尚未证明覆盖全部结果。'] : []),
    ...(coverage.hydrationBudgetExceeded
      ? ['条目核验已到处理上限，部分筛选条件可能尚未确认。']
      : []),
    ...(!coverage.budgetExceeded && !coverage.hydrationBudgetExceeded && coverage.reason
      ? [coverageReasonLabel(coverage.reason)]
      : []),
  ];
  const coverageNote = [...new Set(coverageMessages)].join('；');
  const coverageReasonIsShown = !coverage.budgetExceeded && !coverage.hydrationBudgetExceeded;
  const coverageIsOutputCap =
    coverage.reason === 'output_cap' || coverage.reason === 'Output cap was reached.';
  const renderWarnings = viewModel.warnings.filter((warning) => {
    if (coverage.budgetExceeded && warning.code === 'DISCOVERY_BUDGET_EXCEEDED') return false;
    if (
      coverage.hydrationBudgetExceeded &&
      warning.code === 'DISCOVERY_HYDRATION_BUDGET_EXCEEDED'
    ) {
      return false;
    }
    if (
      coverageReasonIsShown &&
      coverageIsOutputCap &&
      warning.code === 'DISCOVERY_OUTPUT_TRUNCATED'
    ) {
      return false;
    }
    if (
      coverageReasonIsShown &&
      coverage.reason === DISCOVERY_UNRESOLVED_COVERAGE_REASON &&
      warning.code === 'DISCOVERY_HYDRATION_UNRESOLVED'
    ) {
      return false;
    }
    return true;
  });
  const visibleWarnings = renderWarnings.slice(0, 4);
  const completionLimitations = viewModel.limitations.filter(
    (item) =>
      item.startsWith('collectionCompletionRate =') ||
      item === COLLECTION_COMPLETION_UNRESOLVED_CAVEAT,
  );
  const duplicateBudgetLimitation = coverage.budgetExceeded ? '结果受有界预算限制。' : undefined;
  const otherLimitations = viewModel.limitations.filter(
    (item) => !completionLimitations.includes(item) && item !== duplicateBudgetLimitation,
  );
  const visibleLimitations = otherLimitations.slice(0, 3);
  const hiddenWarnings = Math.max(0, renderWarnings.length - visibleWarnings.length);
  const hiddenLimitations = Math.max(0, otherLimitations.length - visibleLimitations.length);
  const visibleItems = viewModel.items.slice(0, DISCOVERY_MAX_RENDERED_ITEMS);
  const overflowItemCount = Math.max(0, viewModel.items.length - visibleItems.length);
  const effectiveHiddenCount = Math.max(0, (viewModel.hiddenCount ?? 0) + overflowItemCount);
  const renderedCount = visibleItems.length;

  return (
    <CardFrame theme={theme} width={width}>
      <TitleBlock
        title={viewModel.query.label}
        subtitle={`Bangumi 条目发现 · ${stateLabel(viewModel.state)}`}
        theme={theme}
        icon="discovery"
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

      {completionLimitations.length > 0 ? (
        <div style={{ color: theme.textMuted, fontSize: '12px', lineHeight: 1.55 }}>
          条件解释：{joinReaderMessages(completionLimitations.map(limitationLabel))}
        </div>
      ) : null}

      <div
        data-render-mask="panel"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: theme.spacing.sm,
          backgroundColor: theme.surfaceAlt,
          border: `1px solid ${theme.border}`,
          borderRadius: theme.radius.md,
          padding: theme.spacing.md,
          clipPath: theme.design.masks.panel,
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
        {renderedCount} · {totalLabel(coverage.totalKind)}
      </div>
      {coverageNote ? (
        <div style={{ color: theme.textMuted, fontSize: '12px', lineHeight: 1.55 }}>
          范围说明：{coverageNote}
        </div>
      ) : null}

      {visibleWarnings.length > 0 ? (
        <div style={{ color: theme.warning, fontSize: '12px', lineHeight: 1.55 }}>
          提示：
          {joinReaderMessages([
            ...visibleWarnings.map((warning) => warningText(warning.code, warning.message)),
            ...(hiddenWarnings > 0 ? [`另有 ${hiddenWarnings} 条提示`] : []),
          ])}
        </div>
      ) : null}
      {visibleLimitations.length > 0 ? (
        <div style={{ color: theme.textMuted, fontSize: '12px', lineHeight: 1.55 }}>
          限制：{joinReaderMessages(visibleLimitations.map(limitationLabel))}
          {hiddenLimitations > 0 ? `；另有 ${hiddenLimitations} 条限制` : ''}
        </div>
      ) : null}

      {visibleItems.length === 0 ? (
        <div
          data-render-mask="panel-alt"
          style={{
            color: stateTone,
            backgroundColor: theme.surfaceAlt,
            border: `1px solid ${theme.border}`,
            borderRadius: theme.radius.md,
            padding: theme.spacing.md,
            fontSize: '13px',
            lineHeight: 1.55,
            clipPath: theme.design.masks.panelAlt,
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
        {visibleItems.map((item) => {
          const image = item.image ? resolvedImages[item.image] || item.image : undefined;
          return (
            <div
              key={item.id}
              data-render-mask="panel"
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
                clipPath: theme.design.masks.panel,
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
                  {` · 条目 ID ${item.id}`}
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
                {item.collectionCompletionRate !== undefined ? (
                  <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.4 }}>
                    collect 状态占比（五类状态合计）{' '}
                    {(item.collectionCompletionRate * 100).toFixed(1)}%
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {effectiveHiddenCount > 0 ? (
        <div style={{ color: theme.textMuted, fontSize: '12px', lineHeight: 1.55 }}>
          另有 {effectiveHiddenCount} 条本次已返回的结构化条目未在卡片中展开；卡片最多展示 12 条。
        </div>
      ) : null}
      {viewModel.observedNotReturnedCount ? (
        <div style={{ color: theme.textMuted, fontSize: '12px', lineHeight: 1.55 }}>
          另有 {viewModel.observedNotReturnedCount}{' '}
          个匹配候选已被引擎观察到但未纳入本次结构化返回；此处仅显示计数，不代表其字段事实可用。
        </div>
      ) : null}

      <Footer theme={theme} />
    </CardFrame>
  );
};
