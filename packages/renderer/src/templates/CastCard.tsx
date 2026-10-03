import React from 'react';
import { CastCardViewModel } from '../view-models/index.js';
import { ThemeTokens } from '../themes/index.js';
import { CardFrame } from '../components/CardFrame.js';
import { TitleBlock } from '../components/TitleBlock.js';
import { Footer } from '../components/Footer.js';

export interface CastCardProps {
  viewModel: CastCardViewModel;
  theme: ThemeTokens;
  resolvedImages?: Record<string, string>;
  width?: number;
}

export const CastCard: React.FC<CastCardProps> = ({
  viewModel,
  theme,
  resolvedImages = {},
  width,
}) => {
  const { subject, items, hiddenCount } = viewModel;
  const compact = width !== undefined && width < 640;

  return (
    <CardFrame theme={theme} width={width}>
      <TitleBlock title="角色与声优" subtitle={subject.nameCn || subject.name} theme={theme} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm }}>
        {items.map((item, idx) => {
          const charImg = item.character.image
            ? resolvedImages[item.character.image] || item.character.image
            : undefined;

          return (
            <div
              key={idx}
              style={{
                display: 'flex',
                flexDirection: compact ? 'column' : 'row',
                alignItems: compact ? 'stretch' : 'center',
                justifyContent: 'space-between',
                backgroundColor: theme.surfaceAlt,
                border: `1px solid ${theme.border}`,
                borderRadius: theme.radius.md,
                padding: `${theme.spacing.sm} ${theme.spacing.md}`,
                gap: theme.spacing.sm,
                minWidth: 0,
              }}
            >
              {/* Character info */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: theme.spacing.sm,
                  minWidth: 0,
                }}
              >
                {charImg ? (
                  <img
                    src={charImg}
                    alt={item.character.name}
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: `1px solid ${theme.border}`,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      backgroundColor: theme.surface,
                      color: theme.accent,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      fontSize: '14px',
                      border: `1px solid ${theme.border}`,
                    }}
                  >
                    {Array.from(item.character.name)[0] || '?'}
                  </div>
                )}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontSize: '14px',
                      fontWeight: 600,
                      color: theme.text,
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {item.character.name}
                  </div>
                  <div
                    style={{ fontSize: '12px', color: theme.textMuted, overflowWrap: 'anywhere' }}
                  >
                    {item.relation}
                  </div>
                </div>
              </div>

              {/* CV / Actor list */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: theme.spacing.sm,
                  flexWrap: 'wrap',
                  minWidth: 0,
                  width: compact ? '100%' : undefined,
                  paddingLeft: compact ? '48px' : undefined,
                }}
              >
                {item.actors.length > 0 ? (
                  item.actors.map((actor) => {
                    const actorImg = actor.image
                      ? resolvedImages[actor.image] || actor.image
                      : undefined;
                    return (
                      <div
                        key={actor.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          minWidth: 0,
                          maxWidth: '100%',
                        }}
                      >
                        {actorImg && (
                          <img
                            src={actorImg}
                            alt={actor.name}
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              objectFit: 'cover',
                            }}
                          />
                        )}
                        <span
                          style={{
                            fontSize: '13px',
                            color: theme.accent,
                            minWidth: 0,
                            overflowWrap: 'anywhere',
                          }}
                        >
                          {actor.name}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <span style={{ fontSize: '12px', color: theme.textMuted }}>暂无 CV/演员</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {hiddenCount && hiddenCount > 0 && (
        <div
          style={{
            textAlign: 'center',
            fontSize: '12px',
            color: theme.textMuted,
            padding: theme.spacing.xs,
          }}
        >
          另有 {hiddenCount} 位关联角色未全部展示
        </div>
      )}

      <Footer theme={theme} />
    </CardFrame>
  );
};
