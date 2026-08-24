import React from 'react';
import type { SubjectStatsHistoryViewModel } from '../view-models/index.js';
import type { ThemeTokens } from '../themes/index.js';
import { CardFrame } from '../components/CardFrame.js';
import { Footer } from '../components/Footer.js';
import { TitleBlock } from '../components/TitleBlock.js';

export interface SubjectStatsHistoryCardProps {
  viewModel: SubjectStatsHistoryViewModel;
  theme: ThemeTokens;
  width?: number;
}

const METRIC_LABELS: Record<string, string> = {
  score: '评分',
  ratingTotal: '评分人数',
  histogramMean: '直方图均值',
  populationStandardDeviation: '总体标准差',
  collectionTotal: '收藏总数',
  completionRate: '完成率',
  ratingBucket1: '评分1',
  ratingBucket2: '评分2',
  ratingBucket3: '评分3',
  ratingBucket4: '评分4',
  ratingBucket5: '评分5',
  ratingBucket6: '评分6',
  ratingBucket7: '评分7',
  ratingBucket8: '评分8',
  ratingBucket9: '评分9',
  ratingBucket10: '评分10',
  collectionWish: '想看',
  collectionCollect: '看过',
  collectionDoing: '在看',
  collectionOnHold: '搁置',
  collectionDropped: '抛弃',
};

function stateLabel(state: string): string {
  return (
    (
      {
        complete: '覆盖完整',
        partial: '部分覆盖',
        conflict: '存在冲突',
        unavailable: '不可用',
        not_found: '未找到',
        not_computable: '不可计算',
      } as Record<string, string>
    )[state] || state
  );
}

function numberLabel(value: number | undefined, digits = 0): string {
  return value === undefined || !Number.isFinite(value)
    ? '未知'
    : value.toLocaleString('zh-CN', {
        maximumFractionDigits: digits,
        minimumFractionDigits: digits,
      });
}

function rateLabel(value: number | undefined): string {
  return value === undefined || !Number.isFinite(value) ? '未知' : `${(value * 100).toFixed(1)}%`;
}

function metricValue(
  observation: SubjectStatsHistoryViewModel['observations'][number],
  key: string,
): string {
  const snapshot = observation.snapshot;
  switch (key) {
    case 'score':
      return numberLabel(snapshot.raw?.score, 1);
    case 'ratingTotal':
      return numberLabel(snapshot.raw?.ratingTotal);
    case 'histogramMean':
      return numberLabel(snapshot.rating.mean, 2);
    case 'populationStandardDeviation':
      return numberLabel(snapshot.rating.standardDeviation, 2);
    case 'collectionTotal':
      return numberLabel(snapshot.collection.total);
    case 'completionRate':
      return rateLabel(snapshot.collection.completionRate);
    case 'ratingBucket1':
    case 'ratingBucket2':
    case 'ratingBucket3':
    case 'ratingBucket4':
    case 'ratingBucket5':
    case 'ratingBucket6':
    case 'ratingBucket7':
    case 'ratingBucket8':
    case 'ratingBucket9':
    case 'ratingBucket10': {
      const score = Number(key.slice('ratingBucket'.length)) as keyof NonNullable<
        typeof snapshot.raw
      >['ratingHistogram'];
      if (snapshot.raw?.ratingHistogramPresence?.[score] === false) return '未知';
      return numberLabel(snapshot.raw?.ratingHistogram?.[score]);
    }
    case 'collectionWish':
    case 'collectionCollect':
    case 'collectionDoing':
    case 'collectionOnHold':
    case 'collectionDropped': {
      const field = key.slice('collection'.length);
      const status =
        field === 'Wish'
          ? 'wish'
          : field === 'Collect'
            ? 'collect'
            : field === 'Doing'
              ? 'doing'
              : field === 'OnHold'
                ? 'onHold'
                : 'dropped';
      if (snapshot.raw?.collectionPresence?.[status] === false) return '未知';
      return numberLabel(snapshot.raw?.collection?.[status]);
    }
    default:
      return '未知';
  }
}

function changeLabel(change: SubjectStatsHistoryViewModel['changes'][number]): string {
  return change.metrics
    .map((metric) => {
      const label = METRIC_LABELS[metric.key] || metric.key;
      if (metric.state === 'complete') {
        const delta = metric.delta === undefined ? '未知' : numberLabel(metric.delta, 2);
        return `${label} ${delta.startsWith('-') ? '' : '+'}${delta}`;
      }
      return `${label} ${stateLabel(metric.state)}`;
    })
    .join(' · ');
}

export const SubjectStatsHistoryCard: React.FC<SubjectStatsHistoryCardProps> = ({
  viewModel,
  theme,
  width,
}) => {
  const observations = viewModel.observations.slice(-12);
  const changes = viewModel.changes.slice(-12);
  const omittedObservations = viewModel.observations.length - observations.length;
  const omittedChanges = viewModel.changes.length - changes.length;
  const officialOperations = viewModel.source.official.operations.join(' + ') || '未记录';
  const derivedOperations = viewModel.source.derived.operations.join(' + ') || '未记录';
  const bounds = viewModel.collection.resourceBounds;

  return (
    <CardFrame theme={theme} width={width}>
      <TitleBlock
        title="条目统计观察历史"
        subtitle={`条目 ${viewModel.subjectId} · official v0 + derived-s7 · ${stateLabel(viewModel.state)}`}
        theme={theme}
      />

      <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.5 }}>
        起始 {viewModel.collection.startedAt || '尚未开始'} · 记录{' '}
        {viewModel.collection.recordedObservations} 条 · 保留{' '}
        {viewModel.collection.retainedObservations} 条 · 返回{' '}
        {viewModel.collection.observationsReturned} 条 · 过期{' '}
        {viewModel.collection.expiredObservations} · 淘汰 {viewModel.collection.prunedObservations}{' '}
        · 本次保留策略 {viewModel.collection.retentionDays} 天 · 最多{' '}
        {viewModel.collection.maxObservations} 条
        {viewModel.collection.truncated ? ' · 输出有界' : ''}
        {' · recordCurrent='}
        {viewModel.collection.recordCurrent ? 'true' : 'false'}
        {` · 资源 ${bounds.maxActiveSubjects} active / ${bounds.maxTrackedSubjects} tracked / host ${bounds.hostConcurrency} / cleanup ${bounds.maxCleanupRows}`}
      </div>

      {observations.length === 0 ? (
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
          {viewModel.collection.recordCurrent
            ? '本次未形成可读取的本地观察点。'
            : '尚无历史观察；显式请求 recordCurrent 才会追加当前只读快照。'}
        </div>
      ) : null}

      {observations.length > 0 ? (
        <section>
          <div style={{ color: theme.accent, fontWeight: 700, fontSize: '14px' }}>观察点</div>
          <div style={{ color: theme.textMuted, fontSize: '10px', lineHeight: 1.4 }}>
            {omittedObservations > 0 ? `已省略较早 ${omittedObservations} 条；` : ''}
            观察时间是本地采样时间，不等于 Bangumi 统计事件时间。
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.xs }}>
            {observations.map((observation) => (
              <div
                key={observation.id}
                style={{
                  backgroundColor: theme.surfaceAlt,
                  border: `1px solid ${theme.border}`,
                  borderRadius: theme.radius.sm,
                  padding: theme.spacing.sm,
                  display: 'grid',
                  gridTemplateColumns:
                    width !== undefined && width < 480
                      ? 'minmax(0, 1fr)'
                      : 'minmax(180px, 1.2fr) repeat(4, minmax(70px, 1fr))',
                  gap: theme.spacing.xs,
                  alignItems: 'center',
                  fontSize: '10px',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: theme.text, fontWeight: 600, overflowWrap: 'anywhere' }}>
                    {observation.observedAt}
                  </div>
                  <div style={{ color: theme.textMuted }}>
                    {stateLabel(observation.state)} · {observation.compatibility.state}
                  </div>
                  <div style={{ color: theme.textMuted, overflowWrap: 'anywhere' }}>
                    获取 {observation.retrievedAt || '未知'} · 覆盖{' '}
                    {observation.snapshot.coverage.ratingBucketsObserved}/
                    {observation.snapshot.coverage.ratingBucketsExpected} 评分桶，
                    {observation.snapshot.coverage.collectionBucketsObserved}/
                    {observation.snapshot.coverage.collectionBucketsExpected} 收藏桶
                  </div>
                </div>
                <div>
                  <div style={{ color: theme.textMuted }}>评分</div>
                  <div style={{ color: theme.text }}>{metricValue(observation, 'score')}</div>
                </div>
                <div
                  style={{ gridColumn: '1 / -1', color: theme.textMuted, overflowWrap: 'anywhere' }}
                >
                  分布：评分{' '}
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
                    .map((score) => metricValue(observation, `ratingBucket${score}`))
                    .join(' / ')}{' '}
                  · 收藏{' '}
                  {['Wish', 'Collect', 'Doing', 'OnHold', 'Dropped']
                    .map((status) => metricValue(observation, `collection${status}`))
                    .join(' / ')}
                </div>
                <div>
                  <div style={{ color: theme.textMuted }}>评分人数</div>
                  <div style={{ color: theme.text }}>{metricValue(observation, 'ratingTotal')}</div>
                </div>
                <div>
                  <div style={{ color: theme.textMuted }}>收藏总数</div>
                  <div style={{ color: theme.text }}>
                    {metricValue(observation, 'collectionTotal')}
                  </div>
                </div>
                <div>
                  <div style={{ color: theme.textMuted }}>完成率</div>
                  <div style={{ color: theme.text }}>
                    {metricValue(observation, 'completionRate')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {changes.length > 0 ? (
        <section>
          <div style={{ color: theme.accent, fontWeight: 700, fontSize: '14px' }}>相邻变化</div>
          <div style={{ color: theme.textMuted, fontSize: '10px', lineHeight: 1.4 }}>
            {omittedChanges > 0 ? `已省略较早 ${omittedChanges} 组；` : ''}
            仅对相邻且指标状态均为 complete 的值计算 current - previous。
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.xs }}>
            {changes.map((change) => (
              <div
                key={`${change.fromObservationId}-${change.toObservationId}`}
                style={{
                  backgroundColor: theme.surfaceAlt,
                  border: `1px solid ${theme.border}`,
                  borderRadius: theme.radius.sm,
                  padding: theme.spacing.sm,
                  color: theme.text,
                  fontSize: '10px',
                  lineHeight: 1.5,
                }}
              >
                <div style={{ color: theme.textMuted, overflowWrap: 'anywhere' }}>
                  {change.fromObservedAt} → {change.toObservedAt} · {stateLabel(change.state)} ·{' '}
                  {change.compatibility.state}
                  {change.compatibility.reason ? ` · ${change.compatibility.reason}` : ''}
                </div>
                <div style={{ overflowWrap: 'anywhere' }}>{changeLabel(change)}</div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div style={{ color: theme.textMuted, fontSize: '10px', lineHeight: 1.5 }}>
        官方操作：{officialOperations} · 派生操作：{derivedOperations} · 方法：
        {viewModel.methodology.id}.v{viewModel.methodology.version}
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
          {viewModel.warnings.slice(0, 4).map((warning) => (
            <div key={warning.code}>警告：{warning.message}</div>
          ))}
          {viewModel.limitations.slice(0, 3).map((limitation) => (
            <div key={limitation}>限制：{limitation}</div>
          ))}
        </div>
      ) : null}

      <Footer label="Bangumi Agent Kit · opt-in observation history" theme={theme} />
    </CardFrame>
  );
};
