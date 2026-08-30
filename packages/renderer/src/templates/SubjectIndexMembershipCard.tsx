import React from 'react';
import type { SubjectIndexMembershipViewModel } from '../view-models/index.js';
import type { ThemeTokens } from '../themes/index.js';
import { CardFrame } from '../components/CardFrame.js';
import { Footer } from '../components/Footer.js';
import { TitleBlock } from '../components/TitleBlock.js';

export interface SubjectIndexMembershipCardProps {
  viewModel: SubjectIndexMembershipViewModel;
  theme: ThemeTokens;
  width?: number;
}

const STATE_LABELS: Record<string, string> = {
  complete: '完整',
  partial: '部分',
  unavailable: '不可用',
  not_found: '未找到',
};

const MEMBERSHIP_LABELS: Record<string, string> = {
  matched: '已观察到精确匹配',
  not_matched_in_observed_scope: '完整 observed scope 内未匹配',
  unknown: '未知（未完整扫描）',
};

function stateLabel(value: string): string {
  return STATE_LABELS[value] || value;
}

function membershipLabel(value: string): string {
  return MEMBERSHIP_LABELS[value] || value;
}

export const SubjectIndexMembershipCard: React.FC<SubjectIndexMembershipCardProps> = ({
  viewModel,
  theme,
  width,
}) => {
  return (
    <CardFrame theme={theme} width={width}>
      <TitleBlock
        title="条目目录归属观察"
        subtitle={`条目 ${viewModel.subjectId} · official v0 · ${stateLabel(viewModel.state)}`}
        theme={theme}
      />

      <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.5 }}>
        仅扫描调用方提供的目录 ID；未匹配不是所有目录中的全局否定。
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: width !== undefined && width < 520 ? '1fr' : 'repeat(4, 1fr)',
          gap: theme.spacing.xs,
        }}
      >
        {[
          ['请求目录', viewModel.summary.requested],
          ['精确匹配', viewModel.summary.matched],
          ['observed scope 未匹配', viewModel.summary.notMatchedInObservedScope],
          ['未知', viewModel.summary.unknown],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            style={{
              backgroundColor: theme.surfaceAlt,
              border: `1px solid ${theme.border}`,
              borderRadius: theme.radius.sm,
              padding: theme.spacing.sm,
            }}
          >
            <div style={{ color: theme.textMuted, fontSize: '10px' }}>{label}</div>
            <div style={{ color: theme.text, fontSize: '18px', fontWeight: 700 }}>{value}</div>
          </div>
        ))}
      </div>

      <section>
        <div style={{ color: theme.accent, fontWeight: 700, fontSize: '14px' }}>目录结果</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.xs }}>
          {viewModel.indexes.map((index) => (
            <div
              key={index.indexId}
              style={{
                backgroundColor: theme.surfaceAlt,
                border: `1px solid ${theme.border}`,
                borderRadius: theme.radius.sm,
                padding: theme.spacing.sm,
                color: theme.text,
                fontSize: '11px',
                lineHeight: 1.5,
              }}
            >
              <div style={{ fontWeight: 700 }}>
                目录 #{index.indexId} · {membershipLabel(index.membership)} ·{' '}
                {stateLabel(index.state)}
              </div>
              <div style={{ color: theme.textMuted }}>
                页 {index.coverage.pagesSucceeded}/{index.coverage.pagesAttempted} · 行{' '}
                {index.coverage.rowsReturned} · 有效 {index.coverage.validRows} · 异常{' '}
                {index.coverage.malformedRows} · 原始总数{' '}
                {index.coverage.totalKind === 'exact' ? index.coverage.total : '未知'}
                {index.coverage.truncated ? ` · ${index.coverage.completionReason}` : ''}
              </div>
              {index.matches.length > 0 ? (
                <div style={{ color: theme.success }}>
                  正向证据：subject ID {index.matches.map((match) => match.subjectId).join(', ')}
                </div>
              ) : null}
              {index.error ? (
                <div style={{ color: theme.warning }}>
                  错误：{index.error.code} · {index.error.message}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <div style={{ color: theme.textMuted, fontSize: '10px', lineHeight: 1.5 }}>
        请求 {viewModel.coverage.requestsSucceeded}/{viewModel.coverage.requestsAttempted} 成功 · 页{' '}
        {viewModel.coverage.pagesSucceeded}/{viewModel.coverage.pagesAttempted} · 每页上限{' '}
        {viewModel.coverage.pageSize} · 每目录最多 {viewModel.coverage.maxPages} 页 /{' '}
        {viewModel.coverage.maxRows} 行 · 响应上限 {viewModel.coverage.responseLimitBytes} bytes
      </div>

      {viewModel.warnings.length > 0 || viewModel.limitations.length > 0 ? (
        <div
          style={{
            color: theme.textMuted,
            fontSize: '10px',
            lineHeight: 1.5,
            backgroundColor: theme.surfaceAlt,
            border: `1px solid ${theme.border}`,
            borderRadius: theme.radius.sm,
            padding: theme.spacing.sm,
          }}
        >
          {viewModel.warnings.slice(0, 4).map((warning, index) => (
            <div key={`${warning.code}-${index}`}>
              警告：{warning.code} · {warning.message}
            </div>
          ))}
          {viewModel.limitations.slice(0, 3).map((limitation) => (
            <div key={limitation}>限制：{limitation}</div>
          ))}
        </div>
      ) : null}

      <Footer label="Bangumi Agent Kit · bounded index membership" theme={theme} />
    </CardFrame>
  );
};
