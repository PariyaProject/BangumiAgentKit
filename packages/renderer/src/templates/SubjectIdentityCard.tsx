import React from 'react';
import type { SubjectIdentityViewModel } from '../view-models/index.js';
import type { ThemeTokens } from '../themes/index.js';
import { CardFrame } from '../components/CardFrame.js';
import { Footer } from '../components/Footer.js';
import { TitleBlock } from '../components/TitleBlock.js';

export interface SubjectIdentityCardProps {
  viewModel: SubjectIdentityViewModel;
  theme: ThemeTokens;
  width?: number;
}

function stateLabel(state: string): string {
  return (
    (
      {
        complete: '覆盖完整',
        partial: '部分覆盖',
        unavailable: '不可用',
        not_found: '未找到',
        upstream_error: '上游错误',
        auth_required: '需要授权',
        permission_denied: '无权限',
        not_computable: '不可计算',
        unsupported: '不支持',
      } as Record<string, string>
    )[state] || state
  );
}

function display(value: unknown): string {
  if (value === undefined || value === null || value === '') return '未知';
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (typeof value === 'number')
    return Number.isFinite(value) ? value.toLocaleString('zh-CN') : '未知';
  return String(value);
}

function infoboxValue(value: SubjectIdentityViewModel['infobox']['rows'][number]['value']): string {
  if (typeof value === 'string') return value;
  return value.map((item) => (item.k ? `${item.k}: ${item.v}` : item.v)).join(' · ');
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

export const SubjectIdentityCard: React.FC<SubjectIdentityCardProps> = ({
  viewModel,
  theme,
  width,
}) => {
  const subject = viewModel.subject;
  const aliases = viewModel.infobox.aliases;
  const warnings = viewModel.warnings.slice(0, 8);
  const limitations = viewModel.limitations.slice(0, 6);
  const evidence = viewModel.evidence.slice(0, 8);
  const directRows: Array<[string, unknown]> = subject
    ? (
        [
          ['媒介', `${subject.typeLabel} (${subject.type})`],
          ['中文名', subject.nameCn],
          ['平台', subject.platform],
          ['日期', subject.date],
          ['锁定', subject.locked],
          ['NSFW', subject.nsfw],
          ['书籍 series', subject.series],
          ['volumes', subject.volumes],
          ['eps', subject.eps],
          ['totalEpisodes', subject.totalEpisodes],
          ['图片链接', subject.imageLinksAvailable ? '已返回链接（未下载）' : '未返回'],
        ] as Array<[string, unknown]>
      ).filter(([, value]) => value !== undefined)
    : [];

  return (
    <CardFrame theme={theme} width={width}>
      <TitleBlock
        title="条目身份与元数据"
        subtitle={`条目 ${viewModel.subjectId} · official v0 · ${stateLabel(viewModel.state)}`}
        theme={theme}
      />

      {subject ? (
        <div style={panelStyle(theme)}>
          <div style={{ fontSize: '18px', fontWeight: 700, overflowWrap: 'anywhere' }}>
            {subject.name}
          </div>
          <div style={{ color: theme.textMuted, fontSize: '13px', marginTop: theme.spacing.xs }}>
            ID {display(subject.id)}
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: width && width >= 900 ? 'repeat(4, 1fr)' : 'repeat(2, 1fr)',
              gap: theme.spacing.sm,
              marginTop: theme.spacing.md,
            }}
          >
            {directRows.map(([label, value]) => (
              <div key={label} style={{ minWidth: 0 }}>
                <div style={{ color: theme.textMuted, fontSize: '11px' }}>{label}</div>
                <div style={{ fontSize: '13px', overflowWrap: 'anywhere' }}>{display(value)}</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{ ...panelStyle(theme), color: theme.warning, fontSize: '13px' }}>
          未生成身份数据；不会用猜测值填充缺失字段。
        </div>
      )}

      {subject?.metaTags && subject.metaTags.length > 0 ? (
        <div style={panelStyle(theme)}>
          <div style={{ fontWeight: 700, marginBottom: theme.spacing.xs }}>元标签</div>
          <div style={{ color: theme.textMuted, fontSize: '13px', overflowWrap: 'anywhere' }}>
            {subject.metaTags.join(' · ')}
            {viewModel.presentation.metaTags.omitted > 0
              ? ` · 另有 ${viewModel.presentation.metaTags.omitted} 项未展开`
              : ''}
          </div>
        </div>
      ) : null}

      {subject?.tags && subject.tags.length > 0 ? (
        <div style={panelStyle(theme)}>
          <div style={{ fontWeight: 700, marginBottom: theme.spacing.xs }}>标签</div>
          <div style={{ color: theme.textMuted, fontSize: '13px', overflowWrap: 'anywhere' }}>
            {subject.tags.join(' · ')}
            {viewModel.presentation.tags.omitted > 0
              ? ` · 另有 ${viewModel.presentation.tags.omitted} 项未展开`
              : ''}
          </div>
        </div>
      ) : null}

      <div style={panelStyle(theme)}>
        <div style={{ fontWeight: 700, marginBottom: theme.spacing.xs }}>
          别名 · {stateLabel(aliases.state)}
        </div>
        {aliases.values.length > 0 ? (
          <div style={{ fontSize: '13px', overflowWrap: 'anywhere' }}>
            {aliases.values.join(' · ')}
            {viewModel.presentation.aliases.omitted > 0
              ? ` · 另有 ${viewModel.presentation.aliases.omitted} 项未展开`
              : ''}
          </div>
        ) : (
          <div style={{ color: theme.textMuted, fontSize: '13px' }}>
            未识别到可展示的别名值；这不是“没有别名”的结论。
          </div>
        )}
        {aliases.sourceKeys.length > 0 ? (
          <div style={{ color: theme.textMuted, fontSize: '11px', marginTop: theme.spacing.xs }}>
            原始键：{aliases.sourceKeys.join(' · ')}
          </div>
        ) : null}
      </div>

      <div style={panelStyle(theme)}>
        <div style={{ fontWeight: 700, marginBottom: theme.spacing.xs }}>
          Infobox · {stateLabel(viewModel.infobox.state)}
        </div>
        <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.5 }}>
          行 {display(viewModel.infobox.coverage.returnedRows)}/
          {display(viewModel.infobox.coverage.observedRows)} · 异常行{' '}
          {display(viewModel.infobox.coverage.malformedRows)} · 省略行{' '}
          {display(viewModel.infobox.coverage.omittedRows)} · 嵌套值{' '}
          {display(viewModel.infobox.coverage.nestedValuesReturned)}/
          {display(viewModel.infobox.coverage.nestedValuesObserved)}
        </div>
        {viewModel.infobox.rows.length > 0 ? (
          <div style={{ marginTop: theme.spacing.sm, display: 'grid', gap: theme.spacing.xs }}>
            {viewModel.infobox.rows.map((row, index) => (
              <div
                key={`${row.key}-${index}`}
                style={{ fontSize: '12px', overflowWrap: 'anywhere' }}
              >
                <span style={{ color: theme.accent }}>{row.key}</span>
                <span style={{ color: theme.textMuted }}>：{infoboxValue(row.value)}</span>
              </div>
            ))}
            {viewModel.presentation.infobox.omitted > 0 ? (
              <div style={{ color: theme.textMuted, fontSize: '11px' }}>
                另有 {viewModel.presentation.infobox.omitted} 行未展开。
              </div>
            ) : null}
          </div>
        ) : (
          <div style={{ color: theme.textMuted, fontSize: '13px', marginTop: theme.spacing.sm }}>
            没有可展示的 infobox 行。
          </div>
        )}
      </div>

      <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.5 }}>
        覆盖：请求 {display(viewModel.coverage.sourceRequestsSucceeded)}/
        {display(viewModel.coverage.sourceRequestsAttempted)} 成功 · 响应上限{' '}
        {display(viewModel.coverage.responseLimitBytes)} bytes · 获取于{' '}
        {viewModel.retrievedAt || '未知'}
      </div>

      {viewModel.error ? (
        <div style={{ ...panelStyle(theme), color: theme.warning, fontSize: '12px' }}>
          {viewModel.error.message}
        </div>
      ) : null}

      {evidence.length > 0 ? (
        <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.5 }}>
          证据：
          {evidence.map((item, index) => (
            <span key={`${item.source}-${item.operation}-${item.fieldPath}-${index}`}>
              {index > 0 ? ' · ' : ' '}
              {item.source}/{item.operation || 'unknown'}
              {item.fieldPath ? `/${item.fieldPath}` : ''}
            </span>
          ))}
        </div>
      ) : null}

      {warnings.length > 0 ? (
        <div style={panelStyle(theme)}>
          <div style={{ fontWeight: 700, marginBottom: theme.spacing.xs }}>告警</div>
          {warnings.map((warning, index) => (
            <div
              key={`${warning.code}-${index}`}
              style={{ color: theme.warning, fontSize: '12px' }}
            >
              {warning.code} · {warning.message}
            </div>
          ))}
        </div>
      ) : null}

      {limitations.length > 0 ? (
        <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.5 }}>
          限制：{limitations.join(' · ')}
        </div>
      ) : null}

      <Footer label="Bangumi Agent Kit · subject identity" theme={theme} />
    </CardFrame>
  );
};
