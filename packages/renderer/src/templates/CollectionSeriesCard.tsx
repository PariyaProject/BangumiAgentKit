import React from 'react';
import { CardFrame } from '../components/CardFrame.js';
import { Footer } from '../components/Footer.js';
import { TitleBlock } from '../components/TitleBlock.js';
import { CollectionSeriesViewModel } from '../view-models/index.js';
import { ThemeTokens } from '../themes/index.js';

export interface CollectionSeriesCardProps {
  viewModel: CollectionSeriesViewModel;
  theme: ThemeTokens;
  width?: number;
}

function stateLabel(state: CollectionSeriesViewModel['state']): string {
  if (state === 'complete') return '覆盖完整';
  if (state === 'partial') return '部分覆盖';
  if (state === 'conflict') return '关系冲突';
  if (state === 'auth_required') return '需要授权';
  if (state === 'permission_denied') return '无权限';
  if (state === 'rate_limited') return '请求受限';
  if (state === 'upstream_error') return '上游错误';
  return '暂不可用';
}

function boundedText(value: unknown, maximum = 150): string {
  const normalized = String(value ?? '')
    .replace(/\s+/gu, ' ')
    .trim();
  if (normalized.length <= maximum) return normalized;
  return (
    Array.from(normalized)
      .slice(0, maximum - 1)
      .join('') + '…'
  );
}

function itemName(item: CollectionSeriesViewModel['groups'][number]['items'][number]): string {
  return boundedText(item.subjectNameCn || item.subjectName || '#' + item.subjectId, 56);
}

function edgeName(edge: CollectionSeriesViewModel['groups'][number]['edges'][number]): string {
  const from = boundedText(edge.fromNameCn || edge.fromName || '#' + edge.fromSubjectId, 36);
  const to = boundedText(edge.toNameCn || edge.toName || '#' + edge.toSubjectId, 36);
  const conflict = edge.conflict ? ' · 冲突' : '';
  return from + ' —' + edge.relation + '→ ' + to + conflict;
}

export const CollectionSeriesCard: React.FC<CollectionSeriesCardProps> = ({
  viewModel,
  theme,
  width,
}) => {
  const summary = [
    ['动画收藏', String(viewModel.summary.eligibleAnimeItems)],
    ['系列组', String(viewModel.coverage.output.returnedGroups)],
    ['已归组', String(viewModel.summary.groupedItems)],
    ['未归组', String(viewModel.summary.ungroupedItems)],
    ['关系边', String(viewModel.summary.relationEdges)],
  ];
  const warningMessages = viewModel.warnings
    .slice(0, 5)
    .map((warning) => boundedText(warning.message));
  const limitationMessages = viewModel.limitations
    .slice(0, 3)
    .map((limitation) => boundedText(limitation));

  return (
    <CardFrame theme={theme} width={width}>
      <TitleBlock
        title="我的收藏系列组"
        subtitle={'当前账号 · 官方 v0 直接关系 · ' + stateLabel(viewModel.state)}
        theme={theme}
      />

      <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.5 }}>
        只将当前收藏中有直接稳定动画关系（前传、续集、衍生、总集篇）的条目连成组；
        原始标签、方向、冲突和未观察部分都不会被隐藏或补猜。
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: width && width >= 900 ? 'repeat(5, 1fr)' : 'repeat(2, 1fr)',
          gap: theme.spacing.sm,
        }}
      >
        {summary.map(([label, value]) => (
          <div
            key={label}
            style={{
              backgroundColor: theme.surfaceAlt,
              border: '1px solid ' + theme.border,
              borderRadius: theme.radius.sm,
              padding: theme.spacing.sm,
              minWidth: 0,
            }}
          >
            <div style={{ color: theme.textMuted, fontSize: '10px' }}>{label}</div>
            <div style={{ color: theme.text, fontSize: '16px', fontWeight: 700 }}>{value}</div>
          </div>
        ))}
      </div>

      {viewModel.error ? (
        <div style={{ color: theme.warning, fontSize: '11px', lineHeight: 1.5 }}>
          {boundedText(viewModel.error.message)} · 错误代码：{boundedText(viewModel.error.code, 64)}
        </div>
      ) : null}

      {viewModel.groups.length > 0 ? (
        <section>
          <div style={{ color: theme.accent, fontWeight: 700, fontSize: '14px' }}>
            系列组（返回顺序）
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: theme.spacing.sm,
              marginTop: theme.spacing.sm,
            }}
          >
            {viewModel.groups.map((group) => (
              <div
                key={group.groupId}
                style={{
                  border: '1px solid ' + theme.border,
                  borderRadius: theme.radius.md,
                  padding: theme.spacing.sm,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                  <span style={{ color: theme.text, fontSize: '12px', fontWeight: 700 }}>
                    {group.groupId + ' · ' + group.items.length + ' 个收藏条目'}
                  </span>
                  <span
                    style={{
                      color: group.state === 'conflict' ? theme.warning : theme.textMuted,
                      fontSize: '10px',
                    }}
                  >
                    {group.state === 'conflict' ? '关系冲突' : '关系一致'}
                  </span>
                </div>
                <div
                  style={{
                    color: theme.text,
                    fontSize: '11px',
                    lineHeight: 1.55,
                    marginTop: '5px',
                    whiteSpace: 'pre-line',
                  }}
                >
                  {group.items
                    .map(
                      (item) =>
                        itemName(item) + ' · ' + boundedText(item.statusLabel || item.status, 20),
                    )
                    .join('\n')}
                </div>
                {group.edges.length > 0 ? (
                  <div
                    style={{
                      color: theme.textMuted,
                      fontSize: '10px',
                      lineHeight: 1.5,
                      marginTop: '5px',
                      whiteSpace: 'pre-line',
                    }}
                  >
                    {group.edges
                      .map((edge) => edgeName(edge) + ' ×' + edge.observedCount)
                      .join('\n')}
                  </div>
                ) : null}
                {group.hiddenItemCount > 0 ? (
                  <div style={{ color: theme.warning, fontSize: '10px', marginTop: '4px' }}>
                    另有 {group.hiddenItemCount} 项关系或条目未展示；详见 coverage。
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : (
        <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.5 }}>
          当前返回范围没有形成可确认的系列组；这不等同于收藏为空。
        </div>
      )}

      {viewModel.presentation.groups.omitted > 0 ? (
        <div style={{ color: theme.warning, fontSize: '10px', lineHeight: 1.5 }}>
          系列组展示 {viewModel.presentation.groups.rendered}/
          {viewModel.presentation.groups.available}，省略 {viewModel.presentation.groups.omitted} 个；
          完整组计数仍见 coverage。
        </div>
      ) : null}

      {viewModel.ungrouped.length > 0 ? (
        <section>
          <div style={{ color: theme.accent, fontWeight: 700, fontSize: '13px' }}>
            {'未归入系列组（展示 ' +
              viewModel.ungrouped.length +
              '/' +
              viewModel.presentation.ungrouped.available +
              '）'}
          </div>
          <div
            style={{ color: theme.textMuted, fontSize: '10px', lineHeight: 1.5, marginTop: '4px' }}
          >
            {viewModel.ungrouped.map((item) => itemName(item)).join(' · ')}
          </div>
        </section>
      ) : null}

      <div style={{ color: theme.textMuted, fontSize: '10px', lineHeight: 1.5 }}>
        {'关系排除：观察 ' +
          viewModel.excludedRelations.sourceRelations +
          ' · 稳定 ' +
          viewModel.excludedRelations.stableRelations +
          ' · 排除 ' +
          viewModel.excludedRelations.excludedRelations +
          ' · 未知 ' +
          viewModel.excludedRelations.unknownRelations +
          ' · 未匹配目标 ' +
          viewModel.excludedRelations.unmatchedTargets}
        {viewModel.excludedRelations.samples.length > 0
          ? ' · 样本 ' +
            viewModel.excludedRelations.samples
              .slice(0, 3)
              .map((sample) => boundedText(sample.relation, 24) + '(' + sample.count + ')')
              .join('、')
          : ''}
      </div>

      {warningMessages.length > 0 ? (
        <div style={{ color: theme.warning, fontSize: '10px', lineHeight: 1.5 }}>
          {warningMessages.join('；')}
          {viewModel.warnings.length > warningMessages.length
            ? '；另有 ' + (viewModel.warnings.length - warningMessages.length) + ' 条告警'
            : ''}
        </div>
      ) : null}
      {limitationMessages.length > 0 ? (
        <div style={{ color: theme.textMuted, fontSize: '10px', lineHeight: 1.5 }}>
          {'限制：' + limitationMessages.join('；')}
        </div>
      ) : null}
      <div style={{ color: theme.textMuted, fontSize: '10px', lineHeight: 1.5 }}>
        {'覆盖：收藏 ' +
          viewModel.coverage.collection.uniqueRows +
          '/' +
          viewModel.coverage.collection.requestedMaxItems +
          ' · 关系 ' +
          viewModel.coverage.relations.succeededSubjects +
          '/' +
          viewModel.coverage.relations.requestedSubjects +
          ' · 输出组 ' +
          viewModel.coverage.output.returnedGroups +
          ' · 输出边 ' +
          viewModel.coverage.output.returnedEdges +
          ' · 公式 ' +
          (viewModel.evidence.find((item) => item.source === 'derived')?.formulaVersion ||
            '未生成') +
          ' · 检索 ' +
          (viewModel.source.retrievedAt || '未知')}
      </div>
      <Footer theme={theme} />
    </CardFrame>
  );
};
