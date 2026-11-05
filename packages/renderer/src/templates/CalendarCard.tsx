import React from 'react';
import { CalendarViewModel } from '../view-models/index.js';
import { ThemeTokens } from '../themes/index.js';
import { CardFrame } from '../components/CardFrame.js';
import { TitleBlock } from '../components/TitleBlock.js';
import { Footer } from '../components/Footer.js';
import { RendererIcon } from '../components/RendererIcon.js';

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

/** Shared with cover preparation so source pixels match the actual composition. */
export function getMagazineCalendarCoverSize(width = 960): { width: number; height: number } {
  const coverWidth = width >= 768 ? 96 : 72;
  return { width: coverWidth, height: (coverWidth * 4) / 3 };
}

/* Hallmark · component: static calendar · genre: editorial · theme: anime-magazine
 * Source states replace interactive states; shared typography and palette are inherited.
 */
const MagazineCalendar: React.FC<CalendarCardProps> = ({
  viewModel,
  theme,
  resolvedImages = {},
  width,
}) => {
  const displayed = viewModel.days.reduce((sum, day) => sum + day.items.length, 0);
  const unavailable = viewModel.state === 'unavailable';
  const partial = viewModel.state === 'partial';
  const textStyle: React.CSSProperties = {
    minWidth: 0,
    overflowWrap: 'anywhere',
    lineBreak: 'strict',
    lineHeight: 1.5,
  };
  const captionStyle: React.CSSProperties = {
    ...textStyle,
    color: theme.textMuted,
    fontSize: '12px',
  };
  const stateLabel = unavailable
    ? '暂时不可用'
    : partial
      ? '部分覆盖'
      : viewModel.state === 'complete'
        ? '覆盖完整'
        : '覆盖未知';
  const missing = viewModel.coverage?.missingWeekdays;
  const warnings = [...new Set(viewModel.warnings?.map((warning) => warning.message) ?? [])];
  const unknownFields = missingFieldSummary(viewModel.coverage?.missingFields);
  const dayStates = viewModel.days.map((day) =>
    day.items.length > 0
      ? 'displayed'
      : day.observed === 0
        ? 'empty'
        : day.observed === undefined
          ? 'unknown'
          : 'omitted',
  );
  const dayLegend = [
    dayStates.includes('omitted') ? '— 本次未展示，不代表停播' : undefined,
    dayStates.includes('empty') ? '0 已知无条目' : undefined,
    dayStates.includes('unknown') ? '? 资料未知' : undefined,
  ]
    .filter(Boolean)
    .join('；');
  const coverage = viewModel.coverage;
  const weekdayIssues = [
    coverage?.duplicateWeekdays?.length
      ? `重复星期：${coverage.duplicateWeekdays.join('、')}`
      : undefined,
    coverage?.invalidWeekdayCount ? `星期资料异常 ${coverage.invalidWeekdayCount} 条` : undefined,
    coverage?.invalidItemWeekdayCount
      ? `条目星期未知 ${coverage.invalidItemWeekdayCount} 条`
      : undefined,
    coverage?.weekdayConflictCount ? `条目星期冲突 ${coverage.weekdayConflictCount} 条` : undefined,
    coverage?.extraDayEnvelopes ? `额外星期资料 ${coverage.extraDayEnvelopes} 组` : undefined,
  ]
    .filter(Boolean)
    .join('；');
  const capturedAt = viewModel.source?.retrievedAt?.replace(
    /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}):\d{2}(?:\.\d+)?Z$/,
    '$1 $2 UTC',
  );

  return (
    <CardFrame
      theme={theme}
      width={width}
      showMarker={false}
      frameStyle={{ padding: theme.spacing.md, gap: theme.spacing.md }}
    >
      <div data-calendar-layout="compact-magazine-v1" style={{ ...textStyle }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
          <span
            aria-hidden="true"
            style={{
              alignSelf: 'stretch',
              width: '4px',
              borderRadius: '4px',
              backgroundColor: theme.accent,
            }}
          />
          <span style={{ ...captionStyle, letterSpacing: '0.16em', fontSize: '11px' }}>
            BANGUMI / 番组周历
          </span>
        </div>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: theme.spacing.sm,
            marginTop: theme.spacing.sm,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: theme.spacing.sm,
              flex: '1 1 auto',
              minWidth: 0,
            }}
          >
            <RendererIcon name="calendar" theme={theme} size={24} tone="indigo" />
            <span
              style={{
                fontFamily: theme.design.displayFontFamily,
                fontSize: '24px',
                fontWeight: 700,
                letterSpacing: '-0.025em',
              }}
            >
              本周放送
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: theme.spacing.sm,
            }}
          >
            <span
              style={{
                ...captionStyle,
                color: theme.surface,
                backgroundColor: theme.accent,
                borderRadius: theme.radius.xl,
                padding: '4px 12px',
              }}
            >
              本次 {displayed} 部
            </span>
            <span
              style={{
                ...captionStyle,
                color: unavailable || partial ? theme.warning : theme.textMuted,
                border: `1px solid ${unavailable || partial ? theme.warning : theme.border}`,
                borderRadius: theme.radius.xl,
                padding: '3px 8px',
              }}
            >
              {stateLabel}
            </span>
          </div>
        </div>
      </div>

      {viewModel.days.length > 0 && (
        <div
          data-calendar-week-rail
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: theme.spacing.xs,
            padding: theme.spacing.xs,
            backgroundColor: theme.surfaceAlt,
            borderRadius: theme.radius.md,
          }}
        >
          {viewModel.days.map((day, index) => {
            const state = dayStates[index];
            const label =
              state === 'displayed'
                ? String(day.items.length)
                : state === 'empty'
                  ? '0'
                  : state === 'unknown'
                    ? '?'
                    : '—';
            return (
              <div
                key={index}
                data-calendar-day-state={state}
                style={{
                  flex: '1 1 24px',
                  minWidth: 0,
                  padding: '4px 0',
                  borderRadius: theme.radius.sm,
                  textAlign: 'center',
                  backgroundColor: state === 'displayed' ? theme.surface : undefined,
                  color: state === 'displayed' ? theme.accent : theme.textMuted,
                }}
              >
                <div
                  style={{
                    ...textStyle,
                    fontSize: '12px',
                    fontWeight: state === 'displayed' ? 700 : 400,
                  }}
                >
                  {day.weekdayCn.replace(/^星期/, '周')}
                </div>
                <div style={{ fontSize: '12px', lineHeight: 1.5 }}>{label}</div>
              </div>
            );
          })}
        </div>
      )}

      {displayed === 0 && (
        <div
          data-calendar-empty-state
          style={{
            ...textStyle,
            padding: `${theme.spacing.md} 0`,
            borderTop: `1px solid ${theme.border}`,
          }}
        >
          <div
            style={{
              color: unavailable ? theme.warning : theme.text,
              fontSize: '16px',
              fontWeight: 700,
            }}
          >
            {unavailable
              ? '官方日历暂时不可用'
              : viewModel.state === 'complete' && viewModel.coverage?.observed === 0
                ? '本次日历没有条目'
                : '本次没有可展示的条目'}
          </div>
          <div style={{ ...captionStyle, marginTop: theme.spacing.xs }}>
            {unavailable
              ? '尚未取得播出资料，请稍后再查看。'
              : partial
                ? '资料仅覆盖部分范围，不能据此判断本周是否有放送。'
                : '仅说明本次资料范围，不代表所有作品都已停播。'}
          </div>
        </div>
      )}

      {viewModel.days
        .filter((day) => day.items.length > 0)
        .map((day, dayIndex) => (
          <section key={dayIndex} data-calendar-day-group style={{ minWidth: 0 }}>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'baseline',
                gap: theme.spacing.sm,
                marginBottom: theme.spacing.sm,
              }}
            >
              <span style={{ ...textStyle, color: theme.text, fontSize: '18px', fontWeight: 700 }}>
                {day.weekdayCn.replace(/^星期/, '周')}
              </span>
              <span style={captionStyle}>
                展示 {day.items.length} 部
                {day.returned !== undefined && day.returned !== day.items.length
                  ? ` · 返回 ${day.returned} 部`
                  : ''}
              </span>
            </div>
            {day.items.map((item, index) => {
              const imgSrc = item.image ? resolvedImages[item.image] || item.image : undefined;
              const coverSize = getMagazineCalendarCoverSize(width);
              return (
                <article
                  key={`${item.id}-${index}`}
                  data-calendar-item
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: theme.spacing.md,
                    padding: `${theme.spacing.sm} 0`,
                    borderBottom: `1px solid ${theme.border}`,
                    minWidth: 0,
                  }}
                >
                  <div
                    data-calendar-cover
                    style={{
                      width: `${coverSize.width}px`,
                      height: `${coverSize.height}px`,
                      flexShrink: 0,
                      alignSelf: 'flex-start',
                      overflow: 'hidden',
                      borderRadius:
                        index === 0 ? '16px 42% 12px 12px / 16px 24px 12px 12px' : theme.radius.md,
                      backgroundColor: theme.surfaceAlt,
                    }}
                  >
                    {imgSrc ? (
                      <img
                        src={imgSrc}
                        alt={item.nameCn || item.name}
                        style={{
                          display: 'block',
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          ...captionStyle,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          height: '100%',
                          padding: theme.spacing.xs,
                          textAlign: 'center',
                        }}
                      >
                        暂无封面
                      </div>
                    )}
                  </div>
                  <div style={{ ...textStyle, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: theme.spacing.sm }}>
                      <span
                        aria-hidden="true"
                        style={{
                          color: index % 2 ? theme.score : theme.accent,
                          backgroundColor: theme.surfaceAlt,
                          borderRadius: theme.radius.sm,
                          padding: '0 4px',
                          fontSize: '14px',
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <div
                        data-calendar-item-title
                        style={{
                          ...textStyle,
                          fontFamily: theme.design.displayFontFamily,
                          fontSize: '20px',
                          fontWeight: 700,
                          lineHeight: 1.35,
                          textWrap: 'balance',
                        }}
                      >
                        {item.nameCn || item.name}
                      </div>
                    </div>
                    {item.nameCn && item.nameCn !== item.name && (
                      <div
                        data-calendar-original-title
                        style={{
                          ...captionStyle,
                          marginTop: theme.spacing.xs,
                          textWrap: 'balance',
                        }}
                      >
                        原名：{item.name}
                      </div>
                    )}
                    <div
                      style={{
                        ...captionStyle,
                        display: 'flex',
                        flexWrap: 'wrap',
                        columnGap: theme.spacing.sm,
                        rowGap: theme.spacing.xs,
                        marginTop: theme.spacing.xs,
                      }}
                    >
                      <span>{calendarTypeLabel(item.typeLabel) || '类型未知'}</span>
                      <span>{item.airDate ? `首播 ${item.airDate}` : '首播日期未知'}</span>
                    </div>
                    <div
                      style={{
                        ...captionStyle,
                        display: 'flex',
                        flexWrap: 'wrap',
                        columnGap: theme.spacing.sm,
                        rowGap: theme.spacing.xs,
                        marginTop: theme.spacing.xs,
                      }}
                    >
                      <span
                        style={{ color: item.score !== undefined ? theme.score : theme.textMuted }}
                      >
                        评分 {item.score !== undefined ? item.score.toFixed(1) : '—'}
                      </span>
                      <span>排名 {item.rank !== undefined ? item.rank : '—'}</span>
                      <span>
                        在看 {item.collectionDoing !== undefined ? item.collectionDoing : '—'}
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}
            {day.overflowCount !== undefined && day.overflowCount > 0 && (
              <div style={{ ...captionStyle, marginTop: theme.spacing.xs }}>
                该日另有 {day.overflowCount} 条未展示。
              </div>
            )}
          </section>
        ))}

      <div
        data-calendar-source-note
        style={{
          ...captionStyle,
          display: 'flex',
          flexDirection: 'column',
          gap: theme.spacing.xs,
          borderTop: displayed === 0 ? `1px solid ${theme.border}` : undefined,
          paddingTop: theme.spacing.xs,
        }}
      >
        {viewModel.coverage && !unavailable && (
          <div>
            观察 {viewModel.coverage.observed} 部 · 返回 {viewModel.coverage.returned} 部 · 展示{' '}
            {displayed} 部
            {viewModel.coverage.sourceDayCount !== undefined
              ? ` · 星期 ${viewModel.coverage.sourceDayCount}/${viewModel.coverage.expectedDays ?? 7}`
              : ''}
          </div>
        )}
        {dayLegend && <div>星期栏：{dayLegend}。</div>}
        {missing && missing.length > 0 && (
          <div style={{ color: theme.warning }}>缺少星期：{missing.join('、')}</div>
        )}
        {weekdayIssues && <div style={{ color: theme.warning }}>{weekdayIssues}</div>}
        {warnings.map((warning, index) => (
          <div key={index} style={{ color: theme.warning }}>
            {warning}
          </div>
        ))}
        {unknownFields && <div>字段未知：{unknownFields}</div>}
        {viewModel.limitations?.map((limit, index) => (
          <div key={index}>{limit}</div>
        ))}
        {viewModel.source && (
          <div style={{ marginTop: theme.spacing.xs }}>
            来源：{viewModel.source.label}
            {capturedAt ? ` · ${capturedAt}` : ''}
          </div>
        )}
      </div>
    </CardFrame>
  );
};

export const CalendarCard: React.FC<CalendarCardProps> = ({
  viewModel,
  theme,
  resolvedImages = {},
  width,
}) => {
  if (theme.designPack === 'anime-magazine') {
    return (
      <MagazineCalendar
        viewModel={viewModel}
        theme={theme}
        resolvedImages={resolvedImages}
        width={width}
      />
    );
  }
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
        icon="calendar"
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
            data-render-mask="panel"
            style={{
              color: theme.warning,
              backgroundColor: theme.surfaceAlt,
              border: `1px solid ${theme.border}`,
              borderRadius: theme.radius.md,
              padding: theme.spacing.md,
              fontSize: '12px',
              clipPath: theme.design.masks.panel,
            }}
          >
            没有可展示的官方日历数据。
          </div>
        ) : null}
        {days.map((day, idx) => (
          <div
            key={idx}
            data-render-mask="panel-alt"
            style={{
              backgroundColor: theme.surfaceAlt,
              border: `1px solid ${theme.border}`,
              borderRadius: theme.radius.md,
              padding: theme.spacing.md,
              display: 'flex',
              flexDirection: 'column',
              gap: theme.spacing.sm,
              clipPath: theme.design.masks.panelAlt,
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
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: theme.spacing.xs }}>
                <RendererIcon name="calendar" theme={theme} size={16} />
                {day.weekdayCn}
              </span>
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
