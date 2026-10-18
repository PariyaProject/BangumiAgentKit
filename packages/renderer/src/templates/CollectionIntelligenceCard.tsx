import React from 'react';
import type { CollectionIntelligenceViewModel } from '../view-models/index.js';
import type { ThemeTokens } from '../themes/index.js';
import { CardFrame } from '../components/CardFrame.js';
import { Footer } from '../components/Footer.js';
import { TitleBlock } from '../components/TitleBlock.js';

export interface CollectionIntelligenceCardProps {
  viewModel: CollectionIntelligenceViewModel;
  theme: ThemeTokens;
  width?: number;
}

function stateLabel(state: CollectionIntelligenceViewModel['state']): string {
  if (state === 'complete') return '覆盖完整';
  if (state === 'partial') return '部分覆盖';
  return '暂不可用';
}

function formatAverage(value?: number): string {
  return value === undefined ? '未知' : value.toFixed(2);
}

function missingFieldLabel(field: string): string {
  const labels: Record<string, string> = {
    'item.status': '收藏状态',
    'item.status.invalid': '收藏状态',
    'item.subject_type': '媒介',
    'item.rating': '评分',
    'item.rating.invalid': '评分',
    'item.tags': '标签',
    'item.ep_status': '已看集数',
    'item.ep_status.invalid': '已看集数',
    'item.updated_at': '更新时间',
    'item.updated_at.invalid': '更新时间',
  };
  return labels[field] || '其他字段';
}

function warningSummaries(viewModel: CollectionIntelligenceViewModel): string[] {
  const summaries: string[] = [];
  const codes = new Set(viewModel.warnings.map((warning) => warning.code));

  if (codes.has('PARTIAL_SCAN')) {
    const sourceTotal = viewModel.coverage.sourceTotal;
    summaries.push(
      `当前为有界样本：已观察 ${viewModel.coverage.observedRows} 行、去重 ${viewModel.coverage.uniqueItems} 条，源报告 ${sourceTotal === undefined ? '未知' : `${sourceTotal} 条`}。未观察到的收藏未计入统计。`,
    );
  }
  if (codes.has('UPSTREAM_PAGE_FAILURE')) {
    summaries.push('有收藏页面读取失败；结果只包含成功读取的数据，没有补齐缺失记录。');
  }
  if (codes.has('PAGINATION_STALLED')) {
    summaries.push('收藏分页没有继续返回新记录；结果只包含已读取的数据。');
  }
  if (codes.has('SOURCE_TOTAL_CHANGED')) {
    summaries.push('读取期间源记录总数发生变化；结果只代表本次观察到的样本。');
  }
  if (codes.has('DUPLICATE_ROWS')) {
    summaries.push(`发现 ${viewModel.coverage.duplicateRows} 行重复收藏，已按条目去重。`);
  }
  if (codes.has('OUTPUT_TRUNCATED')) {
    summaries.push('部分过长标签未纳入标签统计。');
  }
  if (codes.has('MISSING_FIELD')) {
    const fields = Object.entries(viewModel.coverage.missingFields)
      .filter(([, count]) => count > 0)
      .map(([field]) => missingFieldLabel(field));
    const uniqueFields = [...new Set(fields)];
    const fieldSummary = uniqueFields.slice(0, 3).join('、');
    const additionalFields =
      uniqueFields.length > 3 ? `等 ${uniqueFields.length} 类字段` : fieldSummary;
    summaries.push(
      `部分收藏记录缺少${additionalFields || '可选字段'}；对应统计只采用有值的数据，没有补猜。`,
    );
  }

  return summaries;
}

const STATISTICAL_NOTES = [
  '只统计本次读取到的收藏；部分覆盖时不代表完整收藏。',
  '进度只显示已看集数，不计算完成率；最近更新时间由 Bangumi 提供，可能不会随评分或观看状态更新。',
  '不会读取收藏评论、推测口味、比较不同账号或修改收藏。',
];

function typeLabel(value: string): string {
  return (
    (
      {
        anime: '动画',
        book: '书籍',
        music: '音乐',
        game: '游戏',
        real: '三次元',
        other: '其他',
        unknown: '未知',
      } as Record<string, string>
    )[value] || value
  );
}

export const CollectionIntelligenceCard: React.FC<CollectionIntelligenceCardProps> = ({
  viewModel,
  theme,
  width,
}) => {
  const totalObserved = viewModel.coverage.uniqueItems;
  const sourceTotal =
    viewModel.coverage.sourceTotal === undefined ? '未知' : String(viewModel.coverage.sourceTotal);
  const ratingMax = Math.max(1, ...viewModel.ratings.distribution.map((item) => item.count));
  const hasData = totalObserved > 0 && viewModel.state !== 'unavailable';
  const emptyResult = totalObserved === 0 && viewModel.state !== 'unavailable';
  const summarizedWarnings = viewModel.state === 'unavailable' ? [] : warningSummaries(viewModel);

  return (
    <CardFrame theme={theme} width={width}>
      <TitleBlock
        title="我的收藏智能概览"
        subtitle={`当前账号 · 官方 v0 · ${stateLabel(viewModel.state)}`}
        theme={theme}
      />

      <div style={{ color: theme.textMuted, fontSize: '12px', lineHeight: 1.55 }}>
        覆盖：源报告 {sourceTotal} 条 · 已读取 {viewModel.coverage.observedRows} 行 · 去重后{' '}
        {viewModel.coverage.uniqueItems} 条 · 成功读取 {viewModel.coverage.pagesSucceeded}/
        {viewModel.coverage.pagesAttempted} 页{viewModel.coverage.truncated ? ' · 部分样本' : ''}
      </div>

      {viewModel.presentation.state === 'partial' ? (
        <div style={{ color: theme.textMuted, fontSize: '12px', lineHeight: 1.5 }}>
          展示省略：标签 {viewModel.presentation.tags.omitted} 个 · 最近更新{' '}
          {viewModel.presentation.recentUpdates.omitted} 条（源覆盖状态不变）
        </div>
      ) : null}

      {viewModel.state === 'unavailable' ? (
        <div
          style={{
            color: theme.warning,
            backgroundColor: theme.surfaceAlt,
            border: `1px solid ${theme.border}`,
            borderRadius: theme.radius.md,
            padding: theme.spacing.md,
            fontSize: '13px',
            lineHeight: 1.5,
          }}
        >
          官方收藏暂时不可读取，因此没有可用统计；未用猜测填补结果。请稍后重试。
        </div>
      ) : null}

      {emptyResult ? (
        <div
          style={{
            color: theme.text,
            backgroundColor: theme.surfaceAlt,
            border: `1px solid ${theme.border}`,
            borderRadius: theme.radius.md,
            padding: theme.spacing.md,
            fontSize: '13px',
            lineHeight: 1.6,
          }}
        >
          <div style={{ fontWeight: 700 }}>暂无收藏条目</div>
          <div style={{ color: theme.textMuted }}>
            Bangumi 已返回完整的空收藏结果，当前统计为 0 条。
          </div>
        </div>
      ) : null}

      {hasData ? (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: width && width >= 900 ? 'repeat(4, 1fr)' : 'repeat(2, 1fr)',
              gap: theme.spacing.sm,
            }}
          >
            {[
              ['观察条目', String(totalObserved)],
              ['待看 / 搁置', String(viewModel.backlog.total)],
              [
                '已评分',
                `${viewModel.ratings.rated} · 均分 ${formatAverage(viewModel.ratings.average)}`,
              ],
              ['完成集数', String(viewModel.progress.completedEpisodes)],
            ].map(([label, value]) => (
              <div
                key={label}
                style={{
                  backgroundColor: theme.surfaceAlt,
                  border: `1px solid ${theme.border}`,
                  borderRadius: theme.radius.sm,
                  padding: theme.spacing.sm,
                  minWidth: 0,
                }}
              >
                <div style={{ color: theme.textMuted, fontSize: '11px' }}>{label}</div>
                <div
                  style={{
                    color: theme.text,
                    fontSize: '17px',
                    fontWeight: 700,
                    overflowWrap: 'anywhere',
                  }}
                >
                  {value}
                </div>
              </div>
            ))}
          </div>

          <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.45 }}>
            待看与搁置合计；进行中 {viewModel.backlog.doing} 条另计。
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: width && width >= 900 ? '1fr 1fr' : '1fr',
              gap: theme.spacing.md,
            }}
          >
            <section>
              <div style={{ color: theme.accent, fontWeight: 700, fontSize: '14px' }}>收藏状态</div>
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}
              >
                {viewModel.statusCounts.map((item) => (
                  <div
                    key={item.status}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: '8px',
                      color: theme.text,
                      fontSize: '11px',
                    }}
                  >
                    <span>{item.label}</span>
                    <span style={{ color: item.count > 0 ? theme.text : theme.textMuted }}>
                      {item.count}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <div style={{ color: theme.accent, fontWeight: 700, fontSize: '14px' }}>评分分布</div>
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '6px' }}
              >
                {viewModel.ratings.distribution.map((item) => (
                  <div
                    key={item.rating}
                    style={{ display: 'flex', alignItems: 'center', gap: '5px' }}
                  >
                    <span style={{ width: '20px', color: theme.textMuted, fontSize: '11px' }}>
                      {item.rating}
                    </span>
                    <div
                      style={{
                        height: '7px',
                        width: `${Math.max(2, (item.count / ratingMax) * 100)}%`,
                        backgroundColor: item.count > 0 ? theme.accent : theme.border,
                        borderRadius: '4px',
                      }}
                    />
                    <span style={{ color: theme.textMuted, fontSize: '11px' }}>{item.count}</span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: width && width >= 900 ? '1fr 1fr' : '1fr',
              gap: theme.spacing.md,
            }}
          >
            <section>
              <div style={{ color: theme.accent, fontWeight: 700, fontSize: '14px' }}>
                媒介分布与进度
              </div>
              <div
                style={{
                  color: theme.textMuted,
                  fontSize: '11px',
                  lineHeight: 1.5,
                  marginTop: '6px',
                }}
              >
                {viewModel.subjectTypeCounts
                  .map((item) => `${typeLabel(item.type)} ${item.count}`)
                  .join(' · ') || '媒介未知'}
              </div>
              <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.5 }}>
                有进度记录 {viewModel.progress.itemsWithProgress} 条；只显示已看集数，不计算完成率。
              </div>
            </section>
            <section>
              <div style={{ color: theme.accent, fontWeight: 700, fontSize: '14px' }}>标签频率</div>
              <div
                style={{
                  color: theme.textMuted,
                  fontSize: '11px',
                  lineHeight: 1.5,
                  marginTop: '6px',
                }}
              >
                {viewModel.tags.top.length
                  ? viewModel.tags.top.map((item) => `${item.tag} ×${item.count}`).join(' · ')
                  : '没有观察到标签'}
              </div>
              <div style={{ color: theme.textMuted, fontSize: '11px' }}>
                不同标签 {viewModel.tags.distinct} · 有标签记录 {viewModel.tags.itemsWithTags}
              </div>
            </section>
          </div>

          <section>
            <div style={{ color: theme.accent, fontWeight: 700, fontSize: '14px' }}>
              最近更新（当前观察到的条目）
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '6px' }}>
              {viewModel.latestObservedUpdates.length ? (
                viewModel.latestObservedUpdates.map((item) => (
                  <div
                    key={`${item.subjectId}-${item.updatedAt}`}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: '10px',
                      color: theme.text,
                      fontSize: '11px',
                      borderBottom: `1px solid ${theme.border}`,
                      paddingBottom: '4px',
                    }}
                  >
                    <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                      {item.nameCn || item.name}
                    </span>
                    <span style={{ color: theme.textMuted, whiteSpace: 'nowrap' }}>
                      {item.updatedAt.slice(0, 10)}
                    </span>
                  </div>
                ))
              ) : (
                <div style={{ color: theme.textMuted, fontSize: '11px' }}>没有可用更新时间。</div>
              )}
            </div>
          </section>
        </>
      ) : null}

      {summarizedWarnings.length > 0 && (
        <div
          style={{
            color: theme.text,
            backgroundColor: theme.surfaceAlt,
            border: `1px solid ${theme.border}`,
            borderRadius: theme.radius.md,
            padding: theme.spacing.md,
            fontSize: '12px',
            lineHeight: 1.55,
          }}
        >
          <div style={{ color: theme.accent, fontWeight: 700, marginBottom: theme.spacing.xs }}>
            数据说明
          </div>
          {summarizedWarnings.map((summary) => (
            <div key={summary}>{summary}</div>
          ))}
        </div>
      )}
      {viewModel.limitations.length > 0 && (
        <div style={{ color: theme.textMuted, fontSize: '12px', lineHeight: 1.6 }}>
          <div style={{ color: theme.text, fontWeight: 700, marginBottom: theme.spacing.xs }}>
            统计口径
          </div>
          {STATISTICAL_NOTES.map((note) => (
            <div key={note}>· {note}</div>
          ))}
        </div>
      )}
      <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.5 }}>
        统计版本：{viewModel.evidence.formulaVersion || '未生成'} · 范围：当前授权账号
        {viewModel.source.retrievedAt ? ` · ${viewModel.source.retrievedAt}` : ''}
      </div>
      <Footer theme={theme} />
    </CardFrame>
  );
};
