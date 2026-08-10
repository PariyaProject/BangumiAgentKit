import React from 'react';
import { CalendarViewModel } from '../view-models/index.js';
import { ThemeTokens } from '../themes/index.js';
import { CardFrame } from '../components/CardFrame.js';
import { TitleBlock } from '../components/TitleBlock.js';
import { Footer } from '../components/Footer.js';

export interface CalendarCardProps {
  viewModel: CalendarViewModel;
  theme: ThemeTokens;
  resolvedImages?: Record<string, string>;
  width?: number;
}

const TYPE_LABELS: Record<string, string> = {
  anime: '动画',
  book: '书籍',
  music: '音乐',
  game: '游戏',
  real: '三次元',
  other: '其他',
};

function calendarTypeLabel(value?: string): string | undefined {
  return value ? TYPE_LABELS[value] || '类型未知' : undefined;
}

const MISSING_FIELD_LABELS: Record<string, string> = {
  'item.name_cn': '中文名',
  'item.air_date': '首播日期',
  'item.rating.score': '评分',
  'item.rank': '排名',
  'item.type': '类型',
  'item.collection.doing': '在看人数',
};

function missingFieldSummary(fields?: Record<string, number>): string | undefined {
  if (!fields) return undefined;
  const entries = Object.entries(fields).filter(([, count]) => count > 0);
  if (entries.length === 0) return undefined;
  return entries
    .map(([field, count]) => `${MISSING_FIELD_LABELS[field] || field} ${count}`)
    .join('、');
}

export const CalendarCard: React.FC<CalendarCardProps> = ({
  viewModel,
  theme,
  resolvedImages = {},
  width,
}) => {
  const { days } = viewModel;
  const itemBasis = width && width >= 900 ? 'calc(33.333% - 8px)' : 'calc(50% - 8px)';
  const itemMaxWidth = width && width >= 900 ? 'calc(33.333% - 4px)' : 'calc(50% - 4px)';
  const stateLabel =
    viewModel.state === 'partial'
      ? '部分覆盖'
      : viewModel.state === 'unavailable'
        ? '不可用'
        : viewModel.state === 'complete'
          ? '覆盖完整'
          : undefined;

  return (
    <CardFrame theme={theme} width={width}>
      <TitleBlock
        title="Bangumi 每日放送表"
        subtitle={stateLabel ? `官方日历 · ${stateLabel}` : '每日更新动画列表'}
        theme={theme}
      />

      {viewModel.coverage && (
        <div
          style={{
            color: viewModel.state === 'unavailable' ? theme.warning : theme.textMuted,
            fontSize: '11px',
            lineHeight: 1.5,
          }}
        >
          {viewModel.state === 'unavailable'
            ? '官方日历暂时不可用，未生成播出样本。'
            : `覆盖：观察 ${viewModel.coverage.observed} 条 · 返回 ${viewModel.coverage.returned} 条 · 展示 ${viewModel.coverage.rendered} 条${
                viewModel.coverage.sourceDayCount !== undefined
                  ? ` · 星期 ${viewModel.coverage.sourceDayCount}/${viewModel.coverage.expectedDays ?? 7}`
                  : ''
              }${viewModel.state === 'partial' ? ' · 部分覆盖' : ''}`}
        </div>
      )}

      {viewModel.coverage?.missingWeekdays && viewModel.coverage.missingWeekdays.length > 0 && (
        <div style={{ color: theme.warning, fontSize: '11px', lineHeight: 1.5 }}>
          缺少星期：{viewModel.coverage.missingWeekdays.join('、')}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
        {days.length === 0 && viewModel.state !== 'complete' ? (
          <div
            style={{
              color: theme.warning,
              backgroundColor: theme.surfaceAlt,
              border: `1px solid ${theme.border}`,
              borderRadius: theme.radius.md,
              padding: theme.spacing.md,
              fontSize: '12px',
            }}
          >
            没有可展示的官方日历数据。
          </div>
        ) : null}
        {days.map((day, idx) => (
          <div
            key={idx}
            style={{
              backgroundColor: theme.surfaceAlt,
              border: `1px solid ${theme.border}`,
              borderRadius: theme.radius.md,
              padding: theme.spacing.md,
              display: 'flex',
              flexDirection: 'column',
              gap: theme.spacing.sm,
            }}
          >
            <div
              style={{
                fontSize: '16px',
                fontWeight: 700,
                color: theme.accent,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>{day.weekdayCn}</span>
              <span style={{ fontSize: '12px', color: theme.textMuted }}>
                {day.returned ?? day.items.length} 条目
                {day.observed !== undefined && day.observed !== day.returned
                  ? ` / 观察 ${day.observed}`
                  : ''}
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: theme.spacing.sm,
              }}
            >
              {day.items.map((item) => {
                const imgSrc = item.image ? resolvedImages[item.image] || item.image : undefined;
                return (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      backgroundColor: theme.surface,
                      border: `1px solid ${theme.border}`,
                      borderRadius: theme.radius.sm,
                      padding: '4px 8px',
                      fontSize: '12px',
                      flex: `1 1 ${itemBasis}`,
                      minWidth: 0,
                      maxWidth: itemMaxWidth,
                    }}
                  >
                    {imgSrc && (
                      <img
                        src={imgSrc}
                        alt={item.nameCn || item.name}
                        style={{
                          width: '20px',
                          height: '28px',
                          objectFit: 'cover',
                          borderRadius: '2px',
                        }}
                      />
                    )}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          color: theme.text,
                          fontWeight: 500,
                          overflowWrap: 'anywhere',
                          wordBreak: 'break-word',
                        }}
                      >
                        {item.nameCn || item.name}
                      </div>
                      {item.nameCn && item.nameCn !== item.name && (
                        <div
                          style={{
                            color: theme.textMuted,
                            fontSize: '10px',
                            overflowWrap: 'anywhere',
                            wordBreak: 'break-word',
                          }}
                        >
                          原名：{item.name}
                        </div>
                      )}
                      <div
                        style={{
                          color: theme.textMuted,
                          fontSize: '10px',
                          lineHeight: 1.35,
                          display: 'flex',
                          flexWrap: 'wrap',
                          columnGap: '6px',
                          rowGap: '2px',
                          overflowWrap: 'anywhere',
                          wordBreak: 'break-word',
                        }}
                      >
                        {[
                          item.airDate ? `首播日期 ${item.airDate}` : '首播日期未知',
                          calendarTypeLabel(item.typeLabel) || '类型未知',
                          item.score !== undefined ? `评分 ${item.score.toFixed(1)}` : '评分未知',
                          item.rank !== undefined ? `排名 ${item.rank}` : '排名未知',
                          item.collectionDoing !== undefined
                            ? `在看 ${item.collectionDoing}`
                            : '在看人数未知',
                        ].map((field) => (
                          <span key={field}>{field}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}

              {day.overflowCount && day.overflowCount > 0 ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: theme.surface,
                    border: `1px dashed ${theme.border}`,
                    borderRadius: theme.radius.sm,
                    padding: '4px 8px',
                    fontSize: '12px',
                    color: theme.textMuted,
                  }}
                >
                  + {day.overflowCount} 更多
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {viewModel.warnings && viewModel.warnings.length > 0 && (
        <div style={{ color: theme.warning, fontSize: '11px', lineHeight: 1.5 }}>
          {viewModel.warnings.map((warning) => warning.message).join('；')}
        </div>
      )}
      {missingFieldSummary(viewModel.coverage?.missingFields) && (
        <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.5 }}>
          字段未知：{missingFieldSummary(viewModel.coverage?.missingFields)}
        </div>
      )}
      {viewModel.limitations && viewModel.limitations.length > 0 && (
        <div style={{ color: theme.textMuted, fontSize: '11px', lineHeight: 1.5 }}>
          限制：{viewModel.limitations[0]}
        </div>
      )}
      {viewModel.source && (
        <div style={{ color: theme.textMuted, fontSize: '10px' }}>
          来源：{viewModel.source.label}
          {viewModel.source.retrievedAt ? ` · ${viewModel.source.retrievedAt}` : ''}
        </div>
      )}

      <Footer theme={theme} />
    </CardFrame>
  );
};
