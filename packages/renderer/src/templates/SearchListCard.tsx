import React from 'react';
import { SearchListViewModel } from '../view-models/index.js';
import { ThemeTokens } from '../themes/index.js';
import { CardFrame } from '../components/CardFrame.js';
import { TitleBlock } from '../components/TitleBlock.js';
import { Footer } from '../components/Footer.js';

export interface SearchListCardProps {
  viewModel: SearchListViewModel;
  theme: ThemeTokens;
  resolvedImages?: Record<string, string>;
}

export const SearchListCard: React.FC<SearchListCardProps> = ({
  viewModel,
  theme,
  resolvedImages = {},
}) => {
  const { query, total, items, hasMore } = viewModel;

  return (
    <CardFrame theme={theme}>
      <TitleBlock
        title={`搜索结果: "${query}"`}
        subtitle={`共找到 ${total} 条匹配条目`}
        theme={theme}
      />

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: theme.spacing.md,
          marginTop: theme.spacing.sm,
        }}
      >
        {items.map((item) => {
          const imgSrc = item.image ? resolvedImages[item.image] || item.image : undefined;
          return (
            <div
              key={item.id}
              style={{
                backgroundColor: theme.surfaceAlt,
                border: `1px solid ${theme.border}`,
                borderRadius: theme.radius.md,
                padding: theme.spacing.sm,
                display: 'flex',
                gap: theme.spacing.sm,
                alignItems: 'center',
              }}
            >
              {imgSrc ? (
                <img
                  src={imgSrc}
                  alt={item.nameCn || item.name}
                  style={{
                    width: '50px',
                    height: '70px',
                    objectFit: 'cover',
                    borderRadius: theme.radius.sm,
                    border: `1px solid ${theme.border}`,
                  }}
                />
              ) : (
                <div
                  style={{
                    width: '50px',
                    height: '70px',
                    backgroundColor: theme.surface,
                    borderRadius: theme.radius.sm,
                    border: `1px solid ${theme.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '10px',
                    color: theme.textMuted,
                  }}
                >
                  无封面
                </div>
              )}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    fontSize: '14px',
                    fontWeight: 600,
                    color: theme.accent,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {item.nameCn || item.name}
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: theme.textMuted,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {item.name}
                </div>
                <div
                  style={{
                    display: 'flex',
                    gap: theme.spacing.sm,
                    fontSize: '11px',
                    color: theme.textMuted,
                    marginTop: '2px',
                  }}
                >
                  <span>{item.type}</span>
                  {item.score !== undefined && (
                    <span style={{ color: theme.score, fontWeight: 700 }}>
                      ★ {item.score.toFixed(1)}
                    </span>
                  )}
                  {item.rank !== undefined && <span>#{item.rank}</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {hasMore && (
        <div
          style={{
            textAlign: 'center',
            fontSize: '13px',
            color: theme.textMuted,
            padding: theme.spacing.xs,
            backgroundColor: theme.surfaceAlt,
            borderRadius: theme.radius.sm,
            border: `1px dashed ${theme.border}`,
          }}
        >
          另有更多候选结果未在面板中全部展开
        </div>
      )}

      <Footer theme={theme} />
    </CardFrame>
  );
};
