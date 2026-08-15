import React from 'react';
import { PersonActivityViewModel } from '../view-models/index.js';
import { ThemeTokens } from '../themes/index.js';
import { CardFrame } from '../components/CardFrame.js';
import { Footer } from '../components/Footer.js';
import { TitleBlock } from '../components/TitleBlock.js';

export interface PersonActivityCardProps {
  viewModel: PersonActivityViewModel;
  theme: ThemeTokens;
  width?: number;
}

function stateLabel(state: PersonActivityViewModel['state']): string {
  return state === 'complete'
    ? '完整'
    : state === 'partial'
      ? '部分覆盖'
      : state === 'unavailable'
        ? '来源不可用'
        : '当前不可计算';
}

function stateColor(state: PersonActivityViewModel['state'], theme: ThemeTokens): string {
  return state === 'complete' ? theme.success : theme.warning;
}

function kindLabel(kind: PersonActivityViewModel['kind']): string {
  return kind === 'voice' ? '声优关系' : kind === 'staff' ? '制作人员关系' : '声优与制作人员关系';
}

function mediaLabel(media: PersonActivityViewModel['media']): string {
  return media === 'tv' ? '可判断为 TV 的动画' : media === 'anime' ? '全部动画' : '全部媒介';
}

export const PersonActivityCard: React.FC<PersonActivityCardProps> = ({
  viewModel,
  theme,
  width,
}) => {
  const tone = stateColor(viewModel.state, theme);
  const visibleWarnings = viewModel.warnings.slice(0, 4);
  const visibleLimitations = viewModel.limitations.slice(0, 3);
  return (
    <CardFrame theme={theme} width={width}>
      <TitleBlock
        title={viewModel.person.nameCn || viewModel.person.name}
        subtitle={`${kindLabel(viewModel.kind)} · Person ID ${viewModel.person.id}`}
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
        状态：{stateLabel(viewModel.state)} · 窗口：{viewModel.window.start} 至{' '}
        {viewModel.window.end}（{viewModel.window.months} 个日历月） · 媒介：
        {mediaLabel(viewModel.media)}
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: theme.spacing.sm,
        }}
      >
        {[
          ['去重作品', viewModel.summary.uniqueSubjects],
          ['关系行', viewModel.summary.creditRows],
          ['去重角色', viewModel.summary.uniqueCharacters],
          ['落入窗口', viewModel.coverage.rowsEligible],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            style={{
              flex: '1 1 130px',
              backgroundColor: theme.surfaceAlt,
              border: `1px solid ${theme.border}`,
              borderRadius: theme.radius.md,
              padding: theme.spacing.sm,
              textAlign: 'center',
            }}
          >
            <div style={{ color: theme.accent, fontSize: '22px', fontWeight: 700 }}>{value}</div>
            <div style={{ color: theme.textMuted, fontSize: '11px' }}>{label}</div>
          </div>
        ))}
      </div>

      <div
        style={{
          backgroundColor: theme.surfaceAlt,
          border: `1px solid ${theme.border}`,
          borderRadius: theme.radius.md,
          padding: theme.spacing.md,
          color: theme.textMuted,
          fontSize: '12px',
          lineHeight: 1.55,
        }}
      >
        关系观察 {viewModel.coverage.relationRowsObserved} · 选取{' '}
        {viewModel.coverage.relationRowsSelected} · 作品详情请求{' '}
        {viewModel.coverage.subjectDetailRequests} · 成功{' '}
        {viewModel.coverage.subjectDetailsSucceeded} · 失败{' '}
        {viewModel.coverage.subjectDetailsFailed} · 详情并发 {viewModel.coverage.detailConcurrency}{' '}
        · 输出 {viewModel.coverage.rowsReturned}/{viewModel.coverage.rowsEligible}
        {viewModel.coverage.truncated ? ' · 已达到边界' : ''}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        <div style={{ flex: '1 1 280px' }}>
          <div style={{ color: theme.text, fontSize: '14px', fontWeight: 700, marginBottom: 6 }}>
            按月分布
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {viewModel.summary.byMonth.map((item) => (
              <div
                key={item.month}
                style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing.sm }}
              >
                <span style={{ color: theme.textMuted, fontSize: '12px' }}>{item.month}</span>
                <span style={{ color: theme.text, fontSize: '12px' }}>
                  {item.creditRows} 行 · {item.uniqueSubjects} 部
                </span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ flex: '1 1 280px' }}>
          <div style={{ color: theme.text, fontSize: '14px', fontWeight: 700, marginBottom: 6 }}>
            角色/职位分布
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {viewModel.summary.byRole.length === 0 ? (
              <span style={{ color: theme.textMuted, fontSize: '12px' }}>暂无可计算关系</span>
            ) : (
              viewModel.summary.byRole.map((item) => (
                <div
                  key={item.label}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: theme.spacing.sm,
                  }}
                >
                  <span style={{ color: theme.textMuted, fontSize: '12px' }}>{item.label}</span>
                  <span style={{ color: theme.text, fontSize: '12px' }}>
                    {item.creditRows} 行 · {item.uniqueSubjects} 部
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div>
        <div style={{ color: theme.text, fontSize: '14px', fontWeight: 700, marginBottom: 6 }}>
          窗口内作品（按首播日期）
        </div>
        {viewModel.rows.length === 0 ? (
          <div
            style={{
              color: tone,
              backgroundColor: theme.surfaceAlt,
              border: `1px solid ${theme.border}`,
              borderRadius: theme.radius.md,
              padding: theme.spacing.md,
              fontSize: '12px',
            }}
          >
            当前窗口没有可展示的作品关系；请结合缺失日期、媒介筛选和来源状态阅读。
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.xs }}>
            {viewModel.rows.map((row, index) => (
              <div
                key={`${row.subjectId}-${row.relationId || index}`}
                style={{
                  backgroundColor: theme.surfaceAlt,
                  border: `1px solid ${theme.border}`,
                  borderRadius: theme.radius.sm,
                  padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                }}
              >
                <div style={{ color: theme.text, fontSize: '13px', fontWeight: 600 }}>
                  {row.subjectNameCn || row.subjectName}
                </div>
                {row.subjectNameCn && row.subjectNameCn !== row.subjectName && (
                  <div style={{ color: theme.textMuted, fontSize: '11px' }}>{row.subjectName}</div>
                )}
                <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.45 }}>
                  {row.firstAirDate} · {row.relationLabel} · {row.roleFamily}
                  {row.characterName ? ` · ${row.characterName}` : ''}
                  {row.rawRole ? ` · 原始：${row.rawRole}` : ''}
                </div>
              </div>
            ))}
            {viewModel.hiddenRows > 0 && (
              <div style={{ color: theme.warning, fontSize: '11px', textAlign: 'center' }}>
                另有 {viewModel.hiddenRows} 条窗口内关系因展示上限未显示。
              </div>
            )}
          </div>
        )}
      </div>

      {viewModel.exclusions.length > 0 && (
        <div
          style={{
            backgroundColor: theme.surfaceAlt,
            border: `1px solid ${theme.border}`,
            borderRadius: theme.radius.md,
            padding: theme.spacing.md,
          }}
        >
          <div style={{ color: theme.text, fontSize: '14px', fontWeight: 700, marginBottom: 6 }}>
            未计入原因
          </div>
          {viewModel.exclusions.slice(0, 8).map((item) => (
            <div
              key={item.reason}
              style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.5 }}
            >
              {item.reason}：{item.count} 条
              {item.sampleSubjectIds.length > 0
                ? `（示例 ID：${item.sampleSubjectIds.join('、')}）`
                : ''}
            </div>
          ))}
        </div>
      )}

      {visibleWarnings.length > 0 && (
        <div style={{ color: theme.warning, fontSize: '11px', lineHeight: 1.5 }}>
          {visibleWarnings.map((warning) => (
            <div key={warning.code}>⚠ {warning.message}</div>
          ))}
        </div>
      )}
      {visibleLimitations.length > 0 && (
        <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.5 }}>
          限制：{visibleLimitations.join('；')}
        </div>
      )}
      <Footer label={viewModel.source.label} theme={theme} />
    </CardFrame>
  );
};
