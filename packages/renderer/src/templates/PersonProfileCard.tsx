import React from 'react';
import { PersonProfileViewModel } from '../view-models/index.js';
import { ThemeTokens } from '../themes/index.js';
import { CardFrame } from '../components/CardFrame.js';
import { Footer } from '../components/Footer.js';
import { PersonAvatar } from '../components/PersonAvatar.js';
import { TitleBlock } from '../components/TitleBlock.js';

export interface PersonProfileCardProps {
  viewModel: PersonProfileViewModel;
  theme: ThemeTokens;
  resolvedImages?: Record<string, string>;
}

function DistributionList({
  title,
  items,
  theme,
}: {
  title: string;
  items: PersonProfileViewModel['mediaBreakdown'];
  theme: ThemeTokens;
}) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: '260px',
        backgroundColor: theme.surfaceAlt,
        border: `1px solid ${theme.border}`,
        borderRadius: theme.radius.md,
        padding: theme.spacing.md,
      }}
    >
      <div
        style={{
          color: theme.text,
          fontSize: '14px',
          fontWeight: 700,
          marginBottom: theme.spacing.sm,
        }}
      >
        {title}
      </div>
      {items.length === 0 ? (
        <div style={{ color: theme.textMuted, fontSize: '12px' }}>暂无可分组关系</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.xs }}>
          {items.map((item) => (
            <div
              key={item.label}
              style={{ display: 'flex', justifyContent: 'space-between', gap: theme.spacing.sm }}
            >
              <span style={{ color: theme.textMuted, fontSize: '13px' }}>{item.label}</span>
              <span style={{ color: theme.accent, fontSize: '13px', fontWeight: 700 }}>
                {item.count}
                {item.uniqueSubjects > 0 && (
                  <span style={{ color: theme.textMuted, fontWeight: 400 }}>
                    {' '}
                    · {item.uniqueSubjects}部
                  </span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CreditList({
  title,
  items,
  hiddenCount,
  theme,
}: {
  title: string;
  items: PersonProfileViewModel['subjectCredits'];
  hiddenCount?: number;
  theme: ThemeTokens;
}) {
  return (
    <div style={{ flex: 1, minWidth: '360px' }}>
      <div
        style={{
          color: theme.text,
          fontSize: '14px',
          fontWeight: 700,
          marginBottom: theme.spacing.sm,
        }}
      >
        {title}
      </div>
      {items.length === 0 ? (
        <div
          style={{
            backgroundColor: theme.surfaceAlt,
            border: `1px solid ${theme.border}`,
            borderRadius: theme.radius.md,
            padding: theme.spacing.md,
            color: theme.textMuted,
            fontSize: '12px',
          }}
        >
          未返回关系明细
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.xs }}>
          {items.map((item, index) => (
            <div
              key={`${item.id}-${index}`}
              style={{
                backgroundColor: theme.surfaceAlt,
                border: `1px solid ${theme.border}`,
                borderRadius: theme.radius.sm,
                padding: `${theme.spacing.sm} ${theme.spacing.md}`,
              }}
            >
              <div style={{ color: theme.text, fontSize: '13px', fontWeight: 600 }}>
                {item.nameCn || item.name}
              </div>
              {item.nameCn && item.nameCn !== item.name && (
                <div style={{ color: theme.textMuted, fontSize: '11px' }}>{item.name}</div>
              )}
              {(item.role || item.subjectNameCn || item.subjectName || item.eps) && (
                <div style={{ color: theme.textMuted, fontSize: '11px', marginTop: '2px' }}>
                  {[item.role, item.subjectNameCn || item.subjectName, item.eps]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              )}
            </div>
          ))}
          {hiddenCount && hiddenCount > 0 && (
            <div style={{ color: theme.textMuted, fontSize: '11px', textAlign: 'center' }}>
              另有 {hiddenCount} 条关系未展示
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export const PersonProfileCard: React.FC<PersonProfileCardProps> = ({
  viewModel,
  theme,
  resolvedImages = {},
}) => {
  const { person, summary, source, coverage } = viewModel;
  const avatarSrc = person.image ? resolvedImages[person.image] || person.image : undefined;
  const sourceLabel = source.retrievedAt ? `${source.label} · ${source.retrievedAt}` : source.label;

  return (
    <CardFrame theme={theme}>
      <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing.lg }}>
        <PersonAvatar src={avatarSrc} name={person.name} theme={theme} size={76} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.sm, flex: 1 }}>
          <TitleBlock title={person.name} subtitle={`Person ID: ${person.id}`} theme={theme} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing.xs }}>
            {person.career.length > 0 ? (
              person.career.map((career) => (
                <span
                  key={career}
                  style={{
                    color: theme.accent,
                    backgroundColor: theme.surfaceAlt,
                    border: `1px solid ${theme.border}`,
                    borderRadius: theme.radius.sm,
                    padding: '3px 8px',
                    fontSize: '11px',
                  }}
                >
                  {career}
                </span>
              ))
            ) : (
              <span style={{ color: theme.textMuted, fontSize: '12px' }}>未提供职业标签</span>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        {[
          ['去重作品', summary.uniqueSubjects],
          ['作品关系', summary.subjectCredits],
          ['去重角色', summary.uniqueCharacters],
          ['角色关系', summary.characterCredits],
          ['角色作品', summary.characterSubjects],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            style={{
              flex: '1 1 140px',
              backgroundColor: theme.surfaceAlt,
              border: `1px solid ${theme.border}`,
              borderRadius: theme.radius.md,
              padding: theme.spacing.sm,
              textAlign: 'center',
            }}
          >
            <div style={{ color: theme.accent, fontSize: '22px', fontWeight: 700 }}>{value}</div>
            <div style={{ color: theme.textMuted, fontSize: '11px' }}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing.sm }}>
        <DistributionList title="作品媒介" items={viewModel.mediaBreakdown} theme={theme} />
        <DistributionList
          title="作品职位（原始标签）"
          items={viewModel.roleBreakdown}
          theme={theme}
        />
        <DistributionList
          title="角色关系（原始标签）"
          items={viewModel.characterRoleBreakdown}
          theme={theme}
        />
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.spacing.lg }}>
        <CreditList
          title="作品关系"
          items={viewModel.subjectCredits}
          hiddenCount={viewModel.hiddenSubjectCredits}
          theme={theme}
        />
        <CreditList
          title="角色关系"
          items={viewModel.characterCredits}
          hiddenCount={viewModel.hiddenCharacterCredits}
          theme={theme}
        />
      </div>

      <div
        style={{
          backgroundColor: coverage.state === 'partial' ? `${theme.warning}18` : theme.surfaceAlt,
          border: `1px solid ${coverage.state === 'partial' ? theme.warning : theme.border}`,
          borderRadius: theme.radius.md,
          padding: theme.spacing.md,
          color: coverage.state === 'partial' ? theme.warning : theme.textMuted,
          fontSize: '12px',
          lineHeight: 1.5,
        }}
      >
        <div style={{ fontWeight: 700 }}>
          覆盖状态：{coverage.state === 'partial' ? '部分（达到关系上限）' : '完整'} · 已观察{' '}
          {coverage.observed} 条，展示 {coverage.returned} 条
        </div>
        {viewModel.limitations.map((limitation) => (
          <div key={limitation}>• {limitation}</div>
        ))}
      </div>

      <Footer label={sourceLabel} theme={theme} />
    </CardFrame>
  );
};
