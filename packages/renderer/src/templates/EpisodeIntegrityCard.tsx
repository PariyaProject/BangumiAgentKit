import React from 'react';
import { CardFrame } from '../components/CardFrame.js';
import { Footer } from '../components/Footer.js';
import { MetaRow } from '../components/MetaRow.js';
import { ThemeTokens } from '../themes/index.js';
import { EpisodeIntegrityViewModel } from '../view-models/index.js';

export interface EpisodeIntegrityCardProps {
  viewModel: EpisodeIntegrityViewModel;
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

function stateLabel(state: EpisodeIntegrityViewModel['state']): string {
  switch (state) {
    case 'complete':
      return '覆盖完整';
    case 'partial':
      return '部分覆盖';
    case 'conflict':
      return '存在冲突';
    case 'not_computable':
      return '不可计算';
    case 'not_found':
      return '未找到';
    case 'unavailable':
      return '来源不可用';
  }
}

function checkLabel(
  state: EpisodeIntegrityViewModel['integrity']['checks']['reportedVsDatabase']['state'],
): string {
  switch (state) {
    case 'consistent':
      return '一致';
    case 'different':
      return '不同';
    case 'conflict':
      return '冲突';
    case 'partial':
      return '部分';
    case 'not_computable':
      return '不可计算';
  }
}

function checkText(
  check: EpisodeIntegrityViewModel['integrity']['checks']['reportedVsDatabase'],
): string {
  if (check.left === undefined || check.right === undefined) return checkLabel(check.state);
  return checkLabel(check.state) + ' · ' + check.left + ' / ' + check.right;
}

function episodeNumber(item: EpisodeIntegrityViewModel['items'][number]): string {
  if (item.category === 'main' && item.ep !== undefined) return 'EP ' + item.ep;
  if (item.sort !== undefined) return '#' + item.sort;
  return 'ID ' + item.id;
}

export const EpisodeIntegrityCard: React.FC<EpisodeIntegrityCardProps> = ({
  viewModel,
  theme,
  width,
}) => {
  const title =
    viewModel.subject?.nameCn || viewModel.subject?.name || '条目 ' + viewModel.subjectId;
  const counts = viewModel.integrity.counts;
  const dates = viewModel.integrity.dateCoverage;
  const anomalies = viewModel.integrity.anomalies;
  const checks = viewModel.integrity.checks;
  const populations = dates.populations;
  const compact = width !== undefined && width < 720;
  const itemBasis = width && width >= 720 ? 'calc(50% - 4px)' : '100%';
  const populationText = (population: typeof populations.returned): string =>
    `行 ${population.rows} · 合法 ${population.validRows} · 已播 ${population.airedRows} · 未来 ${population.futureRows} · 未知 ${population.unknownRows}`;
  const totalLabel = [
    viewModel.integrity.subjectTotals.episodesReported !== undefined
      ? 'eps ' + viewModel.integrity.subjectTotals.episodesReported
      : 'eps 未知',
    viewModel.integrity.subjectTotals.totalEpisodesReported !== undefined
      ? 'total_episodes ' + viewModel.integrity.subjectTotals.totalEpisodesReported
      : 'total_episodes 未知',
  ].join(' · ');

  return (
    <CardFrame theme={theme} width={width}>
      <div>
        <div style={{ color: theme.accent, fontSize: '11px', letterSpacing: '0.08em' }}>
          EPISODE INTEGRITY
        </div>
        <div style={{ marginTop: theme.spacing.xs }}>
          <h1 style={{ fontSize: '22px', lineHeight: 1.3, overflowWrap: 'anywhere' }}>{title}</h1>
          <div style={{ color: theme.textMuted, fontSize: '13px', marginTop: theme.spacing.xs }}>
            章节完整性 · {stateLabel(viewModel.state)} · 条目 {viewModel.subjectId}
          </div>
        </div>
      </div>

      <MetaRow
        theme={theme}
        items={[
          'UTC as-of ' + viewModel.asOf.date,
          viewModel.asOf.source === 'explicit'
            ? '明确日期'
            : viewModel.asOf.source === 'retrieval'
              ? '章节源获取日期'
              : '评估日期',
          '观察 ' + counts.observedRows,
          '去重 ' + counts.uniqueRows,
          '返回 ' +
            counts.returnedRows +
            '/' +
            (viewModel.coverage.episodeGuide.sourceTotal ?? '?'),
          viewModel.coverage.episodeGuide.truncated ? '有界样本' : undefined,
        ]}
      />

      <div
        style={{
          backgroundColor: theme.surfaceAlt,
          border: '1px solid ' + theme.border,
          borderRadius: theme.radius.md,
          padding: compact ? theme.spacing.sm : theme.spacing.md,
          display: 'flex',
          flexDirection: 'column',
          gap: theme.spacing.xs,
          fontSize: '11px',
          color: theme.textMuted,
        }}
      >
        <div style={{ color: theme.accent, fontWeight: 700 }}>
          方法与证据 · {viewModel.integrity.formulaVersion}
        </div>
        <div>
          分母：{viewModel.coverage.integrity.denominator} · 比较：
          {viewModel.coverage.integrity.comparisons} · 评估于 {viewModel.asOf.evaluatedAt}
        </div>
        {viewModel.source.attempts.slice(0, 2).map((attempt) => (
          <div key={attempt.operation} style={{ overflowWrap: 'anywhere' }}>
            {attempt.operation} · {attempt.state} · 尝试 {attempt.attemptedAt} · 获取{' '}
            {attempt.retrievedAt || '无'}
            {attempt.error ? ' · 错误 ' + attempt.error.code : ''}
          </div>
        ))}
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: theme.spacing.xs,
          fontSize: '12px',
        }}
      >
        {[
          ['正篇', counts.main],
          ['已知特别/其他', counts.special],
          ['未知类别', counts.unknown],
          ['已播正篇', counts.airedMain],
          ['未来正篇', counts.futureMain],
          ['正篇日期未知', counts.mainWithUnknownAirdate],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            style={{
              flex: '1 1 132px',
              minWidth: 0,
              backgroundColor: theme.surfaceAlt,
              border: '1px solid ' + theme.border,
              borderRadius: theme.radius.md,
              padding: theme.spacing.sm,
            }}
          >
            <div style={{ color: theme.textMuted, fontSize: '10px' }}>{label}</div>
            <div style={{ color: theme.accent, fontSize: '20px', fontWeight: 700 }}>
              {String(value)}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          backgroundColor: theme.surfaceAlt,
          border: '1px solid ' + theme.border,
          borderRadius: theme.radius.md,
          padding: theme.spacing.md,
          display: 'flex',
          flexDirection: 'column',
          gap: theme.spacing.xs,
        }}
      >
        <div style={{ color: theme.accent, fontSize: '12px', fontWeight: 700 }}>
          总数一致性 · {totalLabel}
        </div>
        <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.6 }}>
          eps vs total_episodes：{checkText(checks.reportedVsDatabase)}
          <br />
          eps vs 观察正篇：{checkText(checks.reportedVsObservedMain)}
          <br />
          total_episodes vs 观察正篇：{checkText(checks.databaseVsObservedMain)}
          <br />
          eps vs 已播正篇：{checkText(checks.reportedVsAiredMain)}
        </div>
      </div>

      <div
        style={{
          backgroundColor: theme.surfaceAlt,
          border: '1px solid ' + theme.border,
          borderRadius: theme.radius.md,
          padding: theme.spacing.md,
          display: 'flex',
          flexDirection: 'column',
          gap: theme.spacing.xs,
        }}
      >
        <div style={{ color: theme.accent, fontSize: '12px', fontWeight: 700 }}>
          首播日期覆盖 · 截止 {dates.asOfDate} UTC
        </div>
        <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.6 }}>
          返回人口：{populationText(populations.returned)} · 缺失 {dates.missingRows} · 无效{' '}
          {dates.invalidRows}
          <br />
          观察人口：{populationText(populations.observed)} · 去重人口：
          {populationText(populations.unique)} · 省略人口：{populationText(populations.omitted)}
        </div>
        <div style={{ color: theme.textMuted, fontSize: '11px' }}>
          日期依据：{dates.basis} · 状态：{dates.state}；未知日期不计入已播。
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: theme.spacing.xs,
          fontSize: '11px',
          color: theme.textMuted,
        }}
      >
        {Object.entries(counts.byCategory).map(([category, count]) => (
          <span
            key={category}
            style={{
              backgroundColor: theme.surfaceAlt,
              border: '1px solid ' + theme.border,
              borderRadius: theme.radius.sm,
              padding: theme.spacing.xs + ' ' + theme.spacing.sm,
            }}
          >
            {CATEGORY_LABELS[category] || category} {count}
          </span>
        ))}
      </div>

      <div style={{ color: theme.warning, fontSize: '11px', lineHeight: 1.6 }}>
        异常：重复 ID {anomalies.duplicateEpisodeIds} · 逻辑重复 {anomalies.duplicateLogicalKeys} ·
        重复日期冲突 {anomalies.duplicateAirdateConflicts} · 日期冲突组{' '}
        {anomalies.airdateConflictGroups} · 日期逆序 {anomalies.nonMonotonicMainAirdates}
      </div>

      {viewModel.items.length === 0 ? (
        <div
          style={{
            color: theme.warning,
            backgroundColor: theme.surfaceAlt,
            border: '1px solid ' + theme.border,
            borderRadius: theme.radius.md,
            padding: theme.spacing.md,
            fontSize: '12px',
            lineHeight: 1.5,
          }}
        >
          {viewModel.state === 'unavailable'
            ? '官方章节源暂时不可用，未生成猜测的完整性结论。'
            : '没有可展示的章节观察；空结果不证明条目没有章节。'}
        </div>
      ) : null}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        {viewModel.items.map((item) => (
          <div
            key={item.id}
            style={{
              flex: '1 1 ' + itemBasis,
              minWidth: 0,
              backgroundColor: theme.surfaceAlt,
              border: '1px solid ' + theme.border,
              borderRadius: theme.radius.md,
              padding: compact ? theme.spacing.sm : theme.spacing.md,
              display: compact ? 'grid' : 'flex',
              gridTemplateColumns: compact ? 'minmax(58px, auto) minmax(0, 1fr)' : undefined,
              flexDirection: compact ? undefined : 'column',
              gap: theme.spacing.xs,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: theme.spacing.sm,
                gridColumn: compact ? '1 / 2' : undefined,
              }}
            >
              <strong style={{ color: theme.accent, fontSize: '12px' }}>
                {episodeNumber(item)}
              </strong>
              <span style={{ color: theme.textMuted, fontSize: '10px' }}>
                {CATEGORY_LABELS[item.category] || item.category}
              </span>
            </div>
            <div
              style={{
                fontSize: compact ? '12px' : '13px',
                fontWeight: 600,
                overflowWrap: 'anywhere',
                gridColumn: compact ? '2 / 3' : undefined,
              }}
            >
              {item.nameCn || item.name || '章节 ' + item.id}
            </div>
            <div style={{ gridColumn: compact ? '1 / 3' : undefined }}>
              <MetaRow
                theme={theme}
                items={[
                  item.airdate ? '首播 ' + item.airdate : '首播未知',
                  item.duration ? '时长 ' + item.duration : '时长未知',
                ]}
              />
            </div>
          </div>
        ))}
      </div>

      {viewModel.coverage.renderedOmitted > 0 ? (
        <div style={{ color: theme.warning, fontSize: '11px' }}>
          渲染器省略已返回章节：{viewModel.coverage.renderedOmitted} 条（JSON 保留完整有界结果）
        </div>
      ) : null}
      <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.5 }}>
        章节进度、官方观看顺序和播出历史：当前源不支持计算。
      </div>

      {viewModel.warnings.length > 0 ? (
        <div style={{ color: theme.warning, fontSize: '11px', lineHeight: 1.5 }}>
          {viewModel.warnings
            .slice(0, 4)
            .map((warning) => warning.message)
            .join('；')}
          {viewModel.warnings.length > 4
            ? '；另有 ' + (viewModel.warnings.length - 4) + ' 条告警'
            : ''}
        </div>
      ) : null}
      {viewModel.limitations.length > 0 ? (
        <div style={{ color: theme.textMuted, fontSize: '10px', lineHeight: 1.5 }}>
          限制：{viewModel.limitations.slice(0, 2).join('；')}
          {viewModel.limitations.length > 2
            ? '；另有 ' + (viewModel.limitations.length - 2) + ' 条限制'
            : ''}
        </div>
      ) : null}
      <div style={{ color: theme.textMuted, fontSize: '10px', lineHeight: 1.4 }}>
        来源：Bangumi official v0 ·
        每个操作的获取时间与错误码见“方法与证据”；不以聚合时间覆盖失败操作。
      </div>
      <Footer theme={theme} />
    </CardFrame>
  );
};
