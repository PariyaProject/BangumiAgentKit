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
}

export const CalendarCard: React.FC<CalendarCardProps> = ({
  viewModel,
  theme,
  resolvedImages = {},
}) => {
  const { days } = viewModel;

  return (
    <CardFrame theme={theme}>
      <TitleBlock
        title="Bangumi 每日放送表"
        subtitle="每日更新动画列表"
        theme={theme}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
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
                {day.items.length} 部动画
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
                    <span style={{ color: theme.text, fontWeight: 500 }}>
                      {item.nameCn || item.name}
                    </span>
                    {item.score !== undefined && (
                      <span style={{ color: theme.score, fontWeight: 700 }}>
                        ★ {item.score.toFixed(1)}
                      </span>
                    )}
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

      <Footer theme={theme} />
    </CardFrame>
  );
};
