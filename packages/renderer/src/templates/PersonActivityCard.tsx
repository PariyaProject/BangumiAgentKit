import React from 'react';
import {
  SUBJECT_META_TAGS_MAX_COUNT,
  SUBJECT_META_TAG_MAX_CHARACTERS,
} from '@bangumi-agent-kit/bangumi-core';
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

function staffRoleLabel(staffRole: NonNullable<PersonActivityViewModel['staffRole']>): string {
  return staffRole === 'director' ? '导演' : staffRole;
}

function comparisonStateLabel(
  state: NonNullable<PersonActivityViewModel['comparison']>['state'],
): string {
  return state === 'complete'
    ? '完整'
    : state === 'partial'
      ? '部分覆盖'
      : state === 'unavailable'
        ? '来源不可用'
        : '当前不可计算';
}

function signed(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

function sourceOperationState(
  operation: PersonActivityViewModel['sourceOperations'][number],
): string {
  if (operation.attempted === 0) return '未请求';
  if (operation.failed >= operation.attempted) return '失败';
  if (operation.failed > 0) return '部分成功';
  return '成功';
}

function boundedMetaTag(value: string): { value: string; truncated: boolean } {
  const characters = Array.from(value);
  if (characters.length <= SUBJECT_META_TAG_MAX_CHARACTERS) {
    return { value, truncated: false };
  }
  return {
    value: `${characters.slice(0, SUBJECT_META_TAG_MAX_CHARACTERS - 1).join('')}…`,
    truncated: true,
  };
}

function originTags(origin: PersonActivityViewModel['rows'][number]['origin']): {
  values: string[];
  omitted: number;
  malformed: number;
  textTruncated: number;
} {
  if (!Array.isArray(origin.metaTags)) {
    return {
      values: [],
      omitted: 0,
      malformed: origin.metaTagsCoverage?.malformed ?? 0,
      textTruncated: 0,
    };
  }
  const valid = origin.metaTags.filter((tag): tag is string => typeof tag === 'string');
  const visible = valid.slice(0, SUBJECT_META_TAGS_MAX_COUNT).map(boundedMetaTag);
  return {
    values: visible.map((tag) => tag.value),
    omitted: Math.max(
      origin.metaTagsCoverage?.omitted ?? 0,
      Math.max(0, valid.length - visible.length),
    ),
    malformed: origin.metaTagsCoverage?.malformed ?? origin.metaTags.length - valid.length,
    textTruncated: Math.max(
      origin.metaTagsCoverage?.textTruncated ?? 0,
      visible.filter((tag) => tag.truncated).length,
    ),
  };
}

function comparisonPeriodSummary(
  period: NonNullable<PersonActivityViewModel['comparison']>['recent'],
): string {
  if (period.uniqueSubjects === undefined) {
    return `作品数、关系行和角色数不可用（${comparisonStateLabel(period.state)}）`;
  }
  return `${period.uniqueSubjects} 部作品 · ${period.creditRows} 行 · ${period.uniqueCharacters} 个角色`;
}

export const PersonActivityCard: React.FC<PersonActivityCardProps> = ({
  viewModel,
  theme,
  width,
}) => {
  const tone = stateColor(viewModel.state, theme);
  const visibleWarnings = viewModel.warnings.slice(0, 4);
  const visibleLimitations = viewModel.limitations.slice(0, 3);
  const primaryCountsAvailable =
    viewModel.state === 'complete' ||
    (viewModel.state === 'partial' && viewModel.coverage.rowsEligible > 0);
  const primaryCount = (value: number): number | string =>
    primaryCountsAvailable ? value : '不可用';
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
        {viewModel.staffRole ? ` · 职位筛选：${staffRoleLabel(viewModel.staffRole)}` : ''}
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: theme.spacing.sm,
        }}
      >
        {[
          ['去重作品', primaryCount(viewModel.summary.uniqueSubjects)],
          ['关系行', primaryCount(viewModel.summary.creditRows)],
          ['去重角色', primaryCount(viewModel.summary.uniqueCharacters)],
          ['落入窗口', primaryCount(viewModel.coverage.rowsEligible)],
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
        {viewModel.coverage.relationRowsSelected} · 作品 ID 观察{' '}
        {viewModel.coverage.subjectIdsObserved} / 选取 {viewModel.coverage.subjectIdsSelected} ·
        作品详情请求 {viewModel.coverage.subjectDetailRequests} · 成功{' '}
        {viewModel.coverage.subjectDetailsSucceeded} · 失败{' '}
        {viewModel.coverage.subjectDetailsFailed} · 关系 ID 省略{' '}
        {viewModel.coverage.subjectIdsDroppedAtRelationLimit} · 详情未请求{' '}
        {viewModel.coverage.subjectDetailIdsDroppedAtLimit} 个 · 详情并发{' '}
        {viewModel.coverage.detailConcurrency} · 缺少作品 ID{' '}
        {viewModel.coverage.missingSubjectIdRows} · 输出 {viewModel.coverage.rowsReturned}/
        {viewModel.coverage.rowsEligible}
        {viewModel.staffRole
          ? ` · 职位筛选排除 ${viewModel.coverage.staffRoleExcludedRows} · 职位未知 ${viewModel.coverage.staffRoleUnknownRows}`
          : ''}
        {viewModel.coverage.truncated
          ? ` · 已达到边界${viewModel.coverage.sampled ? '（确定性等距样本）' : ''}`
          : ''}
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
        <div style={{ color: theme.text, fontSize: '14px', fontWeight: 700, marginBottom: 6 }}>
          作品来源观察（官方 v0 subject.meta_tags）
        </div>
        <div>
          覆盖 {viewModel.coverage.origin.subjectsObserved} 部去重作品 · 明确原创{' '}
          {viewModel.coverage.origin.explicitOriginalSubjects} 部 · 未观察到原创标签{' '}
          {viewModel.coverage.origin.notObservedSubjects} 部 · 来源未知{' '}
          {viewModel.coverage.origin.unknownSubjects} 部
        </div>
        <div style={{ marginTop: theme.spacing.xs }}>
          标签覆盖：观察 {viewModel.coverage.origin.tagsObserved} · 合法{' '}
          {viewModel.coverage.origin.tagsValid} · 返回 {viewModel.coverage.origin.tagsReturned} ·
          省略 {viewModel.coverage.origin.tagsOmitted} · 异常{' '}
          {viewModel.coverage.origin.malformedTagValues} · 文本截断{' '}
          {viewModel.coverage.origin.textTruncatedTags} · 截断作品{' '}
          {viewModel.coverage.origin.truncatedSubjects} · 上限{' '}
          {viewModel.coverage.origin.maxTagsPerSubject} 项/
          {viewModel.coverage.origin.maxTagCharacters} 字 · 响应上限{' '}
          {viewModel.coverage.origin.responseLimitBytes} bytes
        </div>
        <div style={{ marginTop: theme.spacing.xs }}>
          来源与检索：{viewModel.source.label} · {viewModel.source.retrievedAt}
        </div>
        <div style={{ color: theme.text, marginTop: theme.spacing.xs }}>
          未观察到“原创”标签不等于“改编”；这里只报告官方字段中的正向观察，不从其他字段推断。
        </div>
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
        <div style={{ color: theme.text, fontSize: '14px', fontWeight: 700, marginBottom: 6 }}>
          来源操作（官方 v0 请求）
        </div>
        {viewModel.sourceOperations.length === 0 ? (
          <div>未记录来源操作。</div>
        ) : (
          viewModel.sourceOperations.slice(0, 8).map((operation) => (
            <div key={operation.operation} style={{ overflowWrap: 'anywhere' }}>
              {operation.operation} · {sourceOperationState(operation)} · 尝试 {operation.attempted}{' '}
              · 成功 {operation.succeeded} · 失败 {operation.failed}
            </div>
          ))
        )}
        {viewModel.sourceOperations.length > 8 && (
          <div>另有 {viewModel.sourceOperations.length - 8} 项来源操作未展开。</div>
        )}
      </div>

      {viewModel.comparison && (
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
          <div style={{ color: theme.text, fontSize: '14px', fontWeight: 700, marginBottom: 6 }}>
            前后窗口对比 · {viewModel.comparison.windowMonths} 个日历月 · 状态：
            {comparisonStateLabel(viewModel.comparison.state)}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing.sm }}>
            {(
              [
                { label: '最近窗口', period: viewModel.comparison.recent },
                { label: '之前窗口', period: viewModel.comparison.previous },
              ] as const
            ).map(({ label, period }) => (
              <div
                key={String(label)}
                style={{
                  flex: '1 1 210px',
                  border: `1px solid ${theme.border}`,
                  borderRadius: theme.radius.sm,
                  padding: theme.spacing.sm,
                }}
              >
                <div style={{ color: theme.text, fontWeight: 600 }}>
                  {label} · {comparisonStateLabel(period.state)}
                </div>
                <div>
                  {period.start} 至 {period.end}
                </div>
                <div>
                  {comparisonPeriodSummary(period)}
                  {period.truncated || period.sampled ? ' · 部分覆盖' : ''}
                </div>
                {period.exclusions.length > 0 && (
                  <div style={{ marginTop: theme.spacing.xs, color: theme.textMuted }}>
                    未计入：
                    {period.exclusions
                      .slice(0, 4)
                      .map(
                        (item) =>
                          `${item.reason} ${item.count}${item.sampleSubjectIds.length > 0 ? `（${item.sampleSubjectIds.join('、')}）` : ''}`,
                      )
                      .join('；')}
                    {period.exclusions.length > 4 ? '；另有原因未展开' : ''}
                  </div>
                )}
              </div>
            ))}
          </div>
          {viewModel.comparison.delta.uniqueSubjects === undefined ? (
            <div style={{ color: theme.text, marginTop: theme.spacing.sm }}>
              差值（最近 − 之前）：不可用（{comparisonStateLabel(viewModel.comparison.delta.state)}
              ； 不把不可用窗口当作零）
            </div>
          ) : (
            <div style={{ color: theme.text, marginTop: theme.spacing.sm }}>
              {viewModel.comparison.delta.state === 'complete' ? '差值' : '观察差值'}（最近 −
              之前）：
              {signed(viewModel.comparison.delta.uniqueSubjects)} 部作品 ·{' '}
              {signed(viewModel.comparison.delta.creditRows ?? 0)} 行 ·{' '}
              {signed(viewModel.comparison.delta.uniqueCharacters ?? 0)} 个角色
              {viewModel.comparison.delta.state !== 'complete' ? ' · 仅代表部分覆盖观察' : ''}
            </div>
          )}
          <div style={{ marginTop: theme.spacing.xs }}>
            {viewModel.comparison.peak.state === 'complete'
              ? `观察到的发布月份峰值（按去重作品）：${viewModel.comparison.peak.months
                  .map(
                    (item) =>
                      `${item.month}（${item.period === 'recent' ? '最近' : '之前'}，${item.uniqueSubjects} 部）`,
                  )
                  .join('、')}`
              : viewModel.comparison.peak.state === 'partial' &&
                  viewModel.comparison.peak.months.length > 0
                ? `部分覆盖下观察到的发布月份峰值（按去重作品）：${viewModel.comparison.peak.months
                    .map(
                      (item) =>
                        `${item.month}（${item.period === 'recent' ? '最近' : '之前'}，${item.uniqueSubjects} 部）`,
                    )
                    .join('、')}`
                : `发布月份峰值不可用（${comparisonStateLabel(viewModel.comparison.peak.state)}）。`}
          </div>
          <div style={{ marginTop: theme.spacing.xs }}>
            以上按当前官方关系中的作品首播日期归窗，不代表历史快照、实际工作量或劳动时长。
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        <div style={{ flex: '1 1 280px' }}>
          <div style={{ color: theme.text, fontSize: '14px', fontWeight: 700, marginBottom: 6 }}>
            按月分布
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {primaryCountsAvailable ? (
              viewModel.summary.byMonth.map((item) => (
                <div
                  key={item.month}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: theme.spacing.sm,
                  }}
                >
                  <span style={{ color: theme.textMuted, fontSize: '12px' }}>{item.month}</span>
                  <span style={{ color: theme.text, fontSize: '12px' }}>
                    {item.creditRows} 行 · {item.uniqueSubjects} 部
                  </span>
                </div>
              ))
            ) : (
              <span style={{ color: theme.textMuted, fontSize: '12px' }}>
                当前窗口的月度计数不可用（{stateLabel(viewModel.state)}）。
              </span>
            )}
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
            {viewModel.rows.map((row, index) => {
              const tags = originTags(row.origin);
              return (
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
                    <div style={{ color: theme.textMuted, fontSize: '11px' }}>
                      {row.subjectName}
                    </div>
                  )}
                  <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.45 }}>
                    {row.firstAirDate} · {row.relationLabel} · {row.roleFamily}
                    {row.characterName ? ` · ${row.characterName}` : ''}
                    {row.rawRole ? ` · 原始：${row.rawRole}` : ''}
                    {` · 来源观察：${row.origin.label}`}
                    {row.origin.metaTags !== undefined
                      ? ` · 官方 meta_tags：${tags.values.join('、') || '（空）'}${tags.omitted > 0 ? ` · 另有 ${tags.omitted} 项省略` : ''}${tags.textTruncated > 0 ? ` · 文本截断 ${tags.textTruncated} 项` : ''}${tags.malformed > 0 ? ` · 异常 ${tags.malformed} 项` : ''}`
                      : ''}
                  </div>
                </div>
              );
            })}
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
