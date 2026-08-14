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

  return (
    <CardFrame theme={theme} width={width}>
      <TitleBlock
        title="我的收藏智能概览"
        subtitle={`当前账号 · 官方 v0 · ${stateLabel(viewModel.state)}`}
        theme={theme}
      />

      <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.5 }}>
        覆盖：源报告 {sourceTotal} 条 · 观察 {viewModel.coverage.observedRows} 行 · 去重后{' '}
        {viewModel.coverage.uniqueItems} 条 · {viewModel.coverage.pagesSucceeded}/
        {viewModel.coverage.pagesAttempted} 页{viewModel.coverage.truncated ? ' · 有界样本' : ''}
      </div>

      {viewModel.state === 'unavailable' ? (
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
          官方收藏源暂时不可用，未生成猜测的收藏统计。
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
              ['待看/搁置 backlog', String(viewModel.backlog.total)],
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
                <div style={{ color: theme.textMuted, fontSize: '10px' }}>{label}</div>
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

          <div style={{ color: theme.textMuted, fontSize: '10px', lineHeight: 1.4 }}>
            待看/搁置 backlog = wish + on_hold；进行中 {viewModel.backlog.doing} 条另计。
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
                    <span style={{ width: '20px', color: theme.textMuted, fontSize: '10px' }}>
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
                    <span style={{ color: theme.textMuted, fontSize: '10px' }}>{item.count}</span>
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
                有进度记录 {viewModel.progress.itemsWithProgress} 条；仅统计
                ep_status，未计算完成百分比。
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
              <div style={{ color: theme.textMuted, fontSize: '10px' }}>
                不同标签 {viewModel.tags.distinct} · 有标签记录 {viewModel.tags.itemsWithTags}
              </div>
            </section>
          </div>

          <section>
            <div style={{ color: theme.accent, fontWeight: 700, fontSize: '14px' }}>
              观察样本中的 source-reported updated_at
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

      {viewModel.warnings.length > 0 && (
        <div style={{ color: theme.warning, fontSize: '11px', lineHeight: 1.5 }}>
          {viewModel.warnings.map((warning) => warning.message).join('；')}
        </div>
      )}
      {viewModel.limitations.length > 0 && (
        <div style={{ color: theme.textMuted, fontSize: '10px', lineHeight: 1.5 }}>
          限制：{viewModel.limitations.join('；')}
        </div>
      )}
      <div style={{ color: theme.textMuted, fontSize: '10px', lineHeight: 1.4 }}>
        公式：{viewModel.evidence.formulaVersion || '未生成'} · 账号范围：
        {viewModel.evidence.authScope}
        {viewModel.source.retrievedAt ? ` · ${viewModel.source.retrievedAt}` : ''}
      </div>
      <Footer theme={theme} />
    </CardFrame>
  );
};
