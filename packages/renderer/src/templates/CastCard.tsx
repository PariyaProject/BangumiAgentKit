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
}

export const CastCard: React.FC<CastCardProps> = ({
  viewModel,
  theme,
  resolvedImages = {},
}) => {
  const { subject, items, hiddenCount } = viewModel;

  return (
    <CardFrame theme={theme}>
      <TitleBlock
        title={`角色与演职员表 — ${subject.nameCn || subject.name}`}
        subtitle={`Subject ID: ${subject.id}`}
        theme={theme}
      />

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
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: theme.surfaceAlt,
                border: `1px solid ${theme.border}`,
                borderRadius: theme.radius.md,
                padding: `${theme.spacing.sm} ${theme.spacing.md}`,
              }}
            >
              {/* Character info */}
              <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
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
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: theme.text }}>
                    {item.character.name}
                  </div>
                  <div style={{ fontSize: '12px', color: theme.textMuted }}>
                    {item.relation}
                  </div>
                </div>
              </div>

              {/* CV / Actor list */}
              <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.sm }}>
                {item.actors.length > 0 ? (
                  item.actors.map((actor) => {
                    const actorImg = actor.image
                      ? resolvedImages[actor.image] || actor.image
                      : undefined;
                    return (
                      <div
                        key={actor.id}
                        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
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
                        <span style={{ fontSize: '13px', color: theme.accent }}>
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
