import React from 'react';
import type { SubjectLatestRevisionViewModel } from '../view-models/index.js';
import type { ThemeTokens } from '../themes/index.js';
import { CardFrame } from '../components/CardFrame.js';
import { Footer } from '../components/Footer.js';
import { TitleBlock } from '../components/TitleBlock.js';

export interface SubjectLatestRevisionCardProps {
  viewModel: SubjectLatestRevisionViewModel;
  theme: ThemeTokens;
  width?: number;
}

function stateLabel(state: string): string {
  return (
    {
      complete: '覆盖完整',
      partial: '部分覆盖',
      not_found: '未找到',
      unavailable: '不可用',
      not_computable: '不可计算',
    }[state] || state
  );
}

function valueLabel(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

function panelStyle(theme: ThemeTokens): React.CSSProperties {
  return {
    backgroundColor: theme.surfaceAlt,
    border: `1px solid ${theme.border}`,
    borderRadius: theme.radius.md,
    padding: theme.spacing.md,
    minWidth: 0,
  };
}

export const SubjectLatestRevisionCard: React.FC<SubjectLatestRevisionCardProps> = ({
  viewModel,
  theme,
  width,
}) => {
  const revision = viewModel.revision;
  const payload = viewModel.detail.payload;
  const fields = viewModel.presentation.fieldValues.slice(0, 16);
  const warnings = viewModel.warnings.slice(0, 6);
  const limitations = viewModel.limitations.slice(0, 4);
  const operations = viewModel.source.operations.slice(0, 4);

  return (
    <CardFrame theme={theme} width={width}>
      <TitleBlock
        title="条目最新修订证据"
        subtitle={`条目 ${viewModel.subjectId} · official v0 · ${stateLabel(viewModel.state)}`}
        theme={theme}
      />

      <div
        style={{
          ...panelStyle(theme),
          color: theme.textMuted,
          fontSize: '11px',
          lineHeight: 1.55,
        }}
      >
        口径：选择官方 offset=0、limit=1 返回的第一条源顺序记录；源未保证排序，结果不等同 精确
        before/after 差异。
      </div>

      <div style={panelStyle(theme)}>
        {revision ? (
          <>
            <div style={{ fontSize: '18px', fontWeight: 700, overflowWrap: 'anywhere' }}>
              {revision.summary || '修订摘要未知'}
            </div>
            <div style={{ color: theme.textMuted, fontSize: '11px', marginTop: theme.spacing.xs }}>
              修订 ID {revision.id} · 类型 {revision.type} · 创建时间 {revision.createdAt || '未知'}{' '}
              · 修订者 {revision.creator?.nickname || revision.creator?.username || '未知'}
            </div>
          </>
        ) : (
          <div style={{ color: theme.warning, fontSize: '13px' }}>
            {viewModel.state === 'unavailable'
              ? '官方修订列表不可用，未生成修订证据。'
              : '本次官方修订列表没有可选择的记录；空结果不证明不存在历史。'}
          </div>
        )}
      </div>

      <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.5 }}>
        列表覆盖：观察 {viewModel.list.observed} 条 · 返回 {viewModel.list.returned} 条 · 总数{' '}
        {viewModel.list.totalKind === 'exact' ? viewModel.list.total : '未知'} ·{' '}
        {stateLabel(viewModel.list.state)}
        {viewModel.list.truncated ? ' · 有界/部分' : ''}
        {' · '}详情 {stateLabel(viewModel.detail.state)} · data {stateLabel(payload.state)}
      </div>

      {fields.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.xs }}>
          <div style={{ color: theme.textMuted, fontSize: '11px' }}>
            官方详情 data（证据字段，不是精确差异） · 展示 {viewModel.presentation.fields.rendered}/
            {viewModel.presentation.fields.available} 个字段
          </div>
          {fields.map((field) => (
            <div
              key={field.key}
              style={{
                ...panelStyle(theme),
                display: 'grid',
                gridTemplateColumns: width && width >= 900 ? 'minmax(130px, 0.35fr) 1fr' : '1fr',
                gap: theme.spacing.xs,
                fontSize: '11px',
                lineHeight: 1.45,
              }}
            >
              <div style={{ color: theme.textMuted, overflowWrap: 'anywhere' }}>{field.key}</div>
              <div style={{ overflowWrap: 'anywhere', wordBreak: 'break-word' }}>
                {valueLabel(field.value)}
                {field.truncated ? ' …' : ''}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ ...panelStyle(theme), color: theme.textMuted, fontSize: '12px' }}>
          data 未提供可安全展示的对象字段；不会猜测变更内容。
        </div>
      )}

      <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.5 }}>
        字段覆盖：官方观察 {payload.observedFields} · 返回 {payload.returnedFields} · 源省略{' '}
        {payload.omittedFields} · 源裁剪 {payload.truncatedFields} · 展示省略{' '}
        {viewModel.presentation.fields.omitted} · 展示文本{' '}
        {viewModel.presentation.text.renderedGraphemes}/
        {viewModel.presentation.text.availableGraphemes}（上限{' '}
        {viewModel.presentation.text.maxGraphemes}）
      </div>

      {warnings.length > 0 ? (
        <div style={{ color: theme.warning, fontSize: '11px', lineHeight: 1.5 }}>
          {warnings.map((warning) => `${warning.code}：${warning.message}`).join('；')}
        </div>
      ) : null}

      {limitations.length > 0 ? (
        <div style={{ color: theme.textMuted, fontSize: '10px', lineHeight: 1.5 }}>
          限制：{limitations.join('；')}
        </div>
      ) : null}

      <div style={{ color: theme.textMuted, fontSize: '10px', lineHeight: 1.5 }}>
        来源：{operations.map((operation) => operation.operation).join(' · ') || '未记录'}
      </div>

      <Footer theme={theme} />
    </CardFrame>
  );
};
