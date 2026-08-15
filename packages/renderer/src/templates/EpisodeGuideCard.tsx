import React from 'react';
import { CardFrame } from '../components/CardFrame.js';
import { Footer } from '../components/Footer.js';
import { MetaRow } from '../components/MetaRow.js';
import { ThemeTokens } from '../themes/index.js';
import { EpisodeGuideViewModel } from '../view-models/index.js';

export interface EpisodeGuideCardProps {
  viewModel: EpisodeGuideViewModel;
  theme: ThemeTokens;
  width?: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  main: '正篇',
  sp: '特别篇',
  op: 'OP',
  ed: 'ED',
  pv: 'PV',
  mad: 'MAD',
  other: '其他',
  unknown: '未知类别',
};

const FIELD_LABELS: Record<string, string> = {
  'subject.name': '条目名称',
  'subject.nameCn': '中文名称',
  'episode.type': '章节类别',
  'episode.name': '章节原名',
  'episode.nameCn': '章节中文名',
  'episode.sort': '排序/集数',
  'episode.airdate': '首播日期',
  'episode.duration': '时长',
  'episode.description': '简介',
  'episode.discussionCount': '讨论数',
  'episode.subjectId': '来源条目 ID',
  'episode.category': '请求类别',
  'subject.id': '条目 ID',
  'page.total': '来源总数',
};

function stateLabel(state: EpisodeGuideViewModel['state']): string {
  switch (state) {
    case 'complete':
      return '覆盖完整';
    case 'partial':
      return '部分覆盖';
    case 'not_found':
      return '未找到';
    case 'unavailable':
      return '来源不可用';
  }
}

function episodeNumber(item: EpisodeGuideViewModel['items'][number]): string {
  if (item.category === 'main' && item.ep !== undefined) return `EP ${item.ep}`;
  if (item.sort !== undefined) return `#${item.sort}`;
  return `ID ${item.id}`;
}

function fieldSummary(fields: Record<string, number>): string {
  return Object.entries(fields)
    .map(([field, count]) => `${FIELD_LABELS[field] || field} ${count}`)
    .join('、');
}

export const EpisodeGuideCard: React.FC<EpisodeGuideCardProps> = ({ viewModel, theme, width }) => {
  const title =
    viewModel.subject?.nameCn || viewModel.subject?.name || `条目 ${viewModel.subjectId}`;
  const categoryLabel =
    viewModel.filters.category === 'all'
      ? '全部章节'
      : CATEGORY_LABELS[viewModel.filters.category || 'all'] || '章节';
  const totalLabel =
    viewModel.coverage.totalKind === 'exact'
      ? String(viewModel.coverage.sourceTotal ?? viewModel.coverage.observedRows)
      : viewModel.coverage.totalKind === 'conflict'
        ? `冲突(${viewModel.coverage.sourceTotal ?? '未知'})`
        : '未知';
  const itemBasis = width && width >= 900 ? 'calc(50% - 4px)' : '100%';
  const emptyMessage =
    viewModel.coverage.episodes.state === 'unavailable'
      ? '官方章节源暂时不可用，未生成猜测的章节列表。'
      : viewModel.coverage.episodes.state === 'not_found'
        ? '官方章节源没有找到对应章节页面。'
        : '官方章节源返回空结果；空结果不证明没有后续内容。';

  return (
    <CardFrame theme={theme} width={width}>
      <div>
        <div style={{ color: theme.accent, fontSize: '11px', letterSpacing: '0.08em' }}>
          EPISODE GUIDE
        </div>
        <div style={{ marginTop: theme.spacing.xs }}>
          <h1 style={{ fontSize: '22px', lineHeight: 1.3, overflowWrap: 'anywhere' }}>{title}</h1>
          <div style={{ color: theme.textMuted, fontSize: '13px', marginTop: theme.spacing.xs }}>
            章节指南 · {stateLabel(viewModel.state)} · 条目 {viewModel.subjectId}
          </div>
        </div>
      </div>

      <MetaRow
        theme={theme}
        items={[
          categoryLabel,
          `观察 ${viewModel.coverage.observedRows}`,
          `返回 ${viewModel.coverage.returnedRows}/${totalLabel}`,
          `读取上限 ${viewModel.coverage.requestedMaxEpisodes}`,
          viewModel.filters.includeDescriptions ? '含简介' : '省略简介',
          viewModel.coverage.truncated || viewModel.coverage.renderedOmitted > 0
            ? '有界样本'
            : undefined,
        ]}
      />

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: theme.spacing.xs,
          fontSize: '11px',
          color: theme.textMuted,
        }}
      >
        {Object.entries(viewModel.summary.byCategory).map(([category, count]) => (
          <span
            key={category}
            style={{
              backgroundColor: theme.surfaceAlt,
              border: `1px solid ${theme.border}`,
              borderRadius: theme.radius.sm,
              padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
            }}
          >
            {CATEGORY_LABELS[category] || category} {count}
          </span>
        ))}
      </div>

      {viewModel.items.length === 0 ? (
        <div
          style={{
            color: theme.warning,
            backgroundColor: theme.surfaceAlt,
            border: `1px solid ${theme.border}`,
            borderRadius: theme.radius.md,
            padding: theme.spacing.md,
            fontSize: '12px',
            lineHeight: 1.5,
          }}
        >
          {emptyMessage}
        </div>
      ) : null}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        {viewModel.items.map((item) => (
          <div
            key={item.id}
            style={{
              flex: `1 1 ${itemBasis}`,
              minWidth: 0,
              backgroundColor: theme.surfaceAlt,
              border: `1px solid ${theme.border}`,
              borderRadius: theme.radius.md,
              padding: theme.spacing.md,
              display: 'flex',
              flexDirection: 'column',
              gap: theme.spacing.xs,
            }}
          >
            <div
              style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing.sm }}
            >
              <strong style={{ color: theme.accent, fontSize: '12px' }}>
                {episodeNumber(item)}
              </strong>
              <span style={{ color: theme.textMuted, fontSize: '10px' }}>
                {CATEGORY_LABELS[item.category] || item.category}
              </span>
            </div>
            <div style={{ fontSize: '14px', fontWeight: 600, overflowWrap: 'anywhere' }}>
              {item.nameCn || item.name || `章节 ${item.id}`}
            </div>
            {item.nameCn && item.name && item.nameCn !== item.name ? (
              <div style={{ color: theme.textMuted, fontSize: '11px', overflowWrap: 'anywhere' }}>
                {item.name}
              </div>
            ) : null}
            <MetaRow
              theme={theme}
              items={[
                item.airdate ? `首播 ${item.airdate}` : '首播未知',
                item.duration ? `时长 ${item.duration}` : '时长未知',
                item.discussionCount !== undefined ? `讨论 ${item.discussionCount}` : '讨论未知',
              ]}
            />
            {item.description ? (
              <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.5 }}>
                {item.description}
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <MetaRow
        theme={theme}
        items={[
          `字段覆盖：日期 ${viewModel.summary.withAirdate}/${viewModel.summary.returned}`,
          `时长 ${viewModel.summary.withDuration}/${viewModel.summary.returned}`,
          `简介 ${viewModel.summary.withDescription}/${viewModel.summary.returned}`,
          `讨论数 ${viewModel.summary.withDiscussionCount}/${viewModel.summary.returned}`,
        ]}
      />

      {Object.keys(viewModel.coverage.missingFields).length > 0 ? (
        <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.5 }}>
          缺失字段：{fieldSummary(viewModel.coverage.missingFields)}
        </div>
      ) : null}
      {Object.keys(viewModel.coverage.truncatedFields).length > 0 ? (
        <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.5 }}>
          已裁剪字段：{fieldSummary(viewModel.coverage.truncatedFields)}
        </div>
      ) : null}
      {Object.keys(viewModel.coverage.invalidFields).length > 0 ? (
        <div style={{ color: theme.warning, fontSize: '11px', lineHeight: 1.5 }}>
          无效字段：{fieldSummary(viewModel.coverage.invalidFields)}
        </div>
      ) : null}
      {Object.keys(viewModel.coverage.identityConflicts).length > 0 ? (
        <div style={{ color: theme.warning, fontSize: '11px', lineHeight: 1.5 }}>
          身份冲突：{fieldSummary(viewModel.coverage.identityConflicts)}
        </div>
      ) : null}
      {Object.keys(viewModel.coverage.filterConflicts).length > 0 ? (
        <div style={{ color: theme.warning, fontSize: '11px', lineHeight: 1.5 }}>
          类别过滤冲突：{fieldSummary(viewModel.coverage.filterConflicts)}
        </div>
      ) : null}
      {viewModel.coverage.duplicateRows > 0 ? (
        <div style={{ color: theme.warning, fontSize: '11px' }}>
          重复章节 ID：{viewModel.coverage.duplicateRows}（输出保留首次观察）
        </div>
      ) : null}
      {viewModel.coverage.overReturnedRows > 0 || viewModel.coverage.sourceLimitMismatch ? (
        <div style={{ color: theme.warning, fontSize: '11px', lineHeight: 1.5 }}>
          来源上限异常：超出返回 {viewModel.coverage.overReturnedRows} 条
          {viewModel.coverage.sourceLimitMismatch ? '，source limit 与请求不一致' : ''}。
        </div>
      ) : null}
      {viewModel.coverage.renderedOmitted > 0 ? (
        <div style={{ color: theme.warning, fontSize: '11px' }}>
          渲染器省略已返回章节：{viewModel.coverage.renderedOmitted} 条（JSON 保留完整有界结果）
        </div>
      ) : null}
      <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.5 }}>
        章节进度与官方观看顺序：当前源不支持计算。
      </div>

      {viewModel.warnings.length > 0 ? (
        <div style={{ color: theme.warning, fontSize: '11px', lineHeight: 1.5 }}>
          {viewModel.warnings
            .slice(0, 3)
            .map((warning) => warning.message)
            .join('；')}
          {viewModel.warnings.length > 3 ? `；另有 ${viewModel.warnings.length - 3} 条告警` : ''}
        </div>
      ) : null}
      {viewModel.limitations.length > 0 ? (
        <div style={{ color: theme.textMuted, fontSize: '10px', lineHeight: 1.5 }}>
          限制：{viewModel.limitations[0]}
        </div>
      ) : null}
      <div style={{ color: theme.textMuted, fontSize: '10px', lineHeight: 1.4 }}>
        来源：Bangumi official v0 · {viewModel.source.operations.join(' + ')}
        {viewModel.source.retrievedAt ? ` · 获取于 ${viewModel.source.retrievedAt}` : ''}
      </div>
      <Footer theme={theme} />
    </CardFrame>
  );
};
